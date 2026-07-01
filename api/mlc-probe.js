// Royaltē — MLC Endpoint Investigation Probe
//
// Board Directive 2026-07-01: investigate all MLC endpoints, determine
// whether ISRC-first publishing lookup is viable, return recommendation
// before modifying production pipeline.
//
// Endpoints under test (MLC Public Search API v1.2.0):
//   POST /search/recordings — { artist, isrc, title } — NO writer required
//   POST /search/songcode   — { title, writers[] }    — current production
//   GET  /work/id/{id}      — full Work (artists, ISWC, writers+IPI, publishers)
//   POST /works             — batch Work lookup by mlcSongCode array
//
// Usage:
//   /api/mlc-probe
//     → runs all tests against Black Alternative defaults
//   /api/mlc-probe?artist=Ed+Sheeran&songs=Shape+of+You&isrc=GBAHS1600463
//     → custom artist + known ISRC
//   /api/mlc-probe?songCodes=N58C5D,L8886K
//     → /work/id and /works batch for known codes
//
// Security: no credential values echoed. No DB writes.

const MLC_BASE = 'https://public-api.themlc.com';

// ── Auth ──────────────────────────────────────────────────────────────
async function getBearer(env) {
  const { MLC_USERNAME: username, MLC_PASSWORD: password, MLC_REFRESH_TOKEN: refreshToken } = env;
  if (!username && !password && !refreshToken) return { bearer: null, error: 'no_credentials' };
  const body = (username && password) ? { username, password } : { refreshToken };
  const resp  = await fetch(`${MLC_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Royalte/1.0 (mlc-probe)' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) return { bearer: null, error: `token_http_${resp.status}` };
  const json = await resp.json().catch(() => null);
  const bearer = json?.idToken;
  if (!bearer) return { bearer: null, error: 'no_idToken' };
  return { bearer, tokenType: json?.tokenType, expiresIn: json?.expiresIn };
}

// ── HTTP helpers ──────────────────────────────────────────────────────
async function post(path, bearer, body) {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${MLC_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearer}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Royalte/1.0 (mlc-probe)',
      },
      body: JSON.stringify(body),
    });
    return await parseResp(resp, Date.now() - t0);
  } catch (err) {
    return { ok: false, error: err?.message, ms: Date.now() - t0 };
  }
}

async function get(path, bearer) {
  const t0 = Date.now();
  try {
    const resp = await fetch(`${MLC_BASE}${path}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${bearer}`, 'Accept': 'application/json', 'User-Agent': 'Royalte/1.0 (mlc-probe)' },
    });
    return await parseResp(resp, Date.now() - t0);
  } catch (err) {
    return { ok: false, error: err?.message, ms: Date.now() - t0 };
  }
}

async function parseResp(resp, ms) {
  const headers = {};
  for (const h of ['retry-after','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','content-type']) {
    const v = resp.headers.get(h); if (v) headers[h] = v;
  }
  const text   = await resp.text().catch(() => '');
  let   parsed = null;
  try { parsed = JSON.parse(text); } catch {}
  return { ok: resp.ok, httpStatus: resp.status, ms, headers, body: parsed, rawText: parsed ? null : text.slice(0, 400) };
}

// ── Summarise a result for reporting ─────────────────────────────────
function summarise(r, fullBody = false) {
  const base = { ok: r.ok, httpStatus: r.httpStatus, ms: r.ms };
  if (!r.ok) return { ...base, headers: r.headers, rawText: r.rawText, error: r.error ?? null };
  const body = r.body;
  const arr  = Array.isArray(body) ? body : (body ? [body] : []);
  const out  = {
    ...base,
    resultsCount: arr.length,
    sample: arr.slice(0, 3).map(projectWork),
  };
  if (fullBody) out.fullBody = body;
  return out;
}

function projectWork(w) {
  if (!w) return null;
  return {
    // Recording fields (from /search/recordings)
    recordingId:  w.id         ?? null,
    isrc:         w.isrc       ?? null,
    recordTitle:  w.title      ?? null,
    recordArtist: w.artist     ?? null,
    labels:       w.labels     ?? null,
    // Work fields (from /search/songcode, /work/id, /works)
    workTitle:    w.workTitle    ?? w.primaryTitle ?? null,
    mlcSongCode:  w.mlcSongCode  ?? w.mlcsongCode  ?? null,
    iswc:         w.iswc         ?? null,
    artists:      w.artists      ?? null,
    membersSongId: w.membersSongId ?? null,
    akas:         Array.isArray(w.akas) ? w.akas.slice(0, 4) : null,
    writers: (Array.isArray(w.writers) ? w.writers : []).slice(0, 4).map(wr => ({
      name: [wr.writerFirstName, wr.writerLastName].filter(Boolean).join(' ') || null,
      ipi:  wr.writerIPI ?? null,
      role: wr.writerRoleCode ?? null,
    })),
    publishers: (Array.isArray(w.publishers) ? w.publishers : []).slice(0, 4).map(p => ({
      name:      p.publisherName       ?? null,
      ipi:       p.publisherIpiNumber  ?? null,
      role:      p.publisherRoleCode   ?? null,
      share:     p.collectionShare     ?? null,
      mlcNumber: p.mlcPublisherNumber  ?? null,
    })),
  };
}

// ── Title normalizer — strip version/mix suffixes ─────────────────────
// Returns the base title for a more permissive search
function normalizeTitle(title) {
  if (typeof title !== 'string') return title;
  return title
    .replace(/\s*[\(\[][^\)\]]*\b(remix|mix|edit|remaster(?:ed)?|live|acoustic|instrumental|version|extended|radio|feat\.?|ft\.?)[^\)\]]*[\)\]]\s*$/gi, '')
    .replace(/\s*[-–]\s*(remix|mix|edit|remaster(?:ed)?|live|acoustic|instrumental|version|extended|radio)\s*$/gi, '')
    .trim() || title;
}

// ── Main handler ──────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { bearer, tokenType, expiresIn, error: authError } = await getBearer(process.env);
  if (!bearer) return res.status(200).json({ ok: false, authError });

  const artistName  = (req.query.artist    || 'Black Alternative').toString().trim();
  const songsRaw    = (req.query.songs     || 'Nosferatu,Life of Eternity').toString();
  const isrc        = req.query.isrc       ? req.query.isrc.toString().trim()  : null;
  const songCodes   = req.query.songCodes
    ? req.query.songCodes.toString().split(',').map(s => s.trim()).filter(Boolean)
    : ['N58C5D', 'N38CDX', 'L8886K'];  // Black Alternative known codes

  const rawTitles = songsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  // Produce both original and normalized for each title
  const titlePairs = rawTitles.map(t => ({ original: t, normalized: normalizeTitle(t) }));

  const report = {
    meta: {
      auth:       { ok: true, tokenType, expiresIn, credentials: { username: !!process.env.MLC_USERNAME, password: !!process.env.MLC_PASSWORD } },
      artist:     artistName,
      titles:     titlePairs,
      isrc:       isrc ?? null,
      songCodes,
      spec:       'MLC Public Search API v1.2.0',
      strategy:   'ISRC-first investigation — Board Directive 2026-07-01',
    },
    findings: {},
  };

  // ════════════════════════════════════════════════════════════════════
  // INVESTIGATION 1 — POST /search/recordings (ISRC-first endpoint)
  //
  // This endpoint accepts { artist, isrc, title } — no writer required.
  // Per spec: SearchRecording { artist: string, isrc: string, title: string }
  // Returns: [Recording { id, isrc, title, artist, labels, mlcsongCode }]
  //
  // mlcsongCode in the Recording response links directly to /work/id/{id}
  // for the full publishing work (ISWC, writers+IPI, publishers).
  // ════════════════════════════════════════════════════════════════════
  report.findings.recordings = {
    endpoint:    'POST /search/recordings',
    description: 'Artist-first endpoint — accepts artist, ISRC, or title. NO writer name required.',
    specFields:  { input: ['artist', 'isrc', 'title'], allOptional: true },
    tests: [],
  };

  // Test 1a: ISRC only (purest form — if ISRC available this should be definitive)
  if (isrc) {
    const r = await post('/search/recordings', bearer, { isrc });
    report.findings.recordings.tests.push({
      label:       `ISRC="${isrc}" only`,
      requestBody: { isrc },
      ...summarise(r),
    });
  }

  // Test 1b: artist + title (no ISRC, no writer)
  for (const { original, normalized } of titlePairs) {
    const r = await post('/search/recordings', bearer, { artist: artistName, title: original });
    report.findings.recordings.tests.push({
      label:       `artist="${artistName}" + title="${original}"`,
      requestBody: { artist: artistName, title: original },
      ...summarise(r),
    });

    // Also test with normalized title if different
    if (normalized !== original) {
      const r2 = await post('/search/recordings', bearer, { artist: artistName, title: normalized });
      report.findings.recordings.tests.push({
        label:       `artist="${artistName}" + normalizedTitle="${normalized}"`,
        requestBody: { artist: artistName, title: normalized },
        ...summarise(r2),
      });
    }
  }

  // Test 1c: title only (no artist, no ISRC — broadest search)
  for (const { original, normalized } of titlePairs.slice(0, 2)) {
    const r = await post('/search/recordings', bearer, { title: normalized || original });
    report.findings.recordings.tests.push({
      label:       `title="${normalized || original}" only (no artist, no writer)`,
      requestBody: { title: normalized || original },
      ...summarise(r),
    });
  }

  // Test 1d: known Ed Sheeran ISRC if default probe includes him
  if (artistName === 'Ed Sheeran' || isrc === 'GBAHS1600463') {
    const r = await post('/search/recordings', bearer, { isrc: 'GBAHS1600463', artist: 'Ed Sheeran' });
    report.findings.recordings.tests.push({
      label:       'ISRC="GBAHS1600463" (Shape of You) + artist="Ed Sheeran" [known ISRC control test]',
      requestBody: { isrc: 'GBAHS1600463', artist: 'Ed Sheeran' },
      ...summarise(r),
    });
    const r2 = await post('/search/recordings', bearer, { isrc: 'GBAHS1600463' });
    report.findings.recordings.tests.push({
      label:       'ISRC="GBAHS1600463" only [known ISRC, no artist filter]',
      requestBody: { isrc: 'GBAHS1600463' },
      ...summarise(r2),
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // INVESTIGATION 2 — GET /work/id/{id}
  //
  // Fetches the FULL Work object for a given mlcSongCode.
  // Returns much richer data than /search/songcode:
  //   artists (recording artist), primaryTitle, mlcSongCode, iswc,
  //   membersSongId, akas[], writers[] (with IPI + role),
  //   publishers[] (with IPI, name, share, role)
  // ════════════════════════════════════════════════════════════════════
  report.findings.workById = {
    endpoint:    'GET /work/id/{id}',
    description: 'Full Work object. Returns artists, ISWC, writers+IPI, publishers+IPI, AKAs. Richer than /search/songcode.',
    tests: [],
  };

  for (const code of songCodes) {
    const r = await get(`/work/id/${code}`, bearer);
    report.findings.workById.tests.push({
      label:    `/work/id/${code}`,
      code,
      ...summarise(r, true),
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // INVESTIGATION 3 — POST /works (batch)
  //
  // Batch version of /work/id/{id}. Input: [{ mlcsongCode }].
  // Useful when /search/recordings returns multiple mlcsongCodes —
  // fetch all works in one round-trip instead of N sequential GETs.
  // ════════════════════════════════════════════════════════════════════
  report.findings.worksBatch = {
    endpoint:    'POST /works',
    description: 'Batch Work lookup by mlcSongCode. One request for multiple codes.',
  };

  const batchBody = songCodes.map(c => ({ mlcsongCode: c }));
  const rb = await post('/works', bearer, batchBody);
  report.findings.worksBatch = {
    ...report.findings.worksBatch,
    requestBody: batchBody,
    ...summarise(rb, true),
  };

  // ════════════════════════════════════════════════════════════════════
  // INVESTIGATION 4 — POST /search/songcode (current production, normalized titles)
  //
  // Testing normalized title variants against current production approach
  // to understand whether title normalization alone fixes the false negative.
  // ════════════════════════════════════════════════════════════════════
  const lastSpace   = artistName.lastIndexOf(' ');
  const writerEntry = lastSpace === -1
    ? { writerLastName: artistName }
    : { writerFirstName: artistName.slice(0, lastSpace), writerLastName: artistName.slice(lastSpace + 1) };

  report.findings.songcodeNormalized = {
    endpoint:    'POST /search/songcode',
    description: 'Current production approach with title normalization applied',
    writerEntry,
    tests: [],
  };

  for (const { original, normalized } of titlePairs) {
    if (normalized !== original) {
      const r = await post('/search/songcode', bearer, { title: normalized, writers: [writerEntry] });
      report.findings.songcodeNormalized.tests.push({
        label:       `normalizedTitle="${normalized}" + writer=${JSON.stringify(writerEntry)} [current-prod writer]`,
        requestBody: { title: normalized, writers: [writerEntry] },
        ...summarise(r),
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // SUMMARY — What each path yields
  // ════════════════════════════════════════════════════════════════════
  report.summary = {
    recordingsEndpoint: {
      description: 'POST /search/recordings — ISRC-first candidate',
      requiresWriter: false,
      acceptsISRC:    true,
      acceptsArtist:  true,
      successCount: report.findings.recordings.tests.filter(t => t.ok && t.resultsCount > 0).length,
      failCount:    report.findings.recordings.tests.filter(t => !t.ok).length,
      totalTests:   report.findings.recordings.tests.length,
      allResults:   report.findings.recordings.tests.map(t => ({
        label: t.label, ok: t.ok, httpStatus: t.httpStatus, count: t.resultsCount ?? 0
      })),
    },
    workByIdEndpoint: {
      description: 'GET /work/id/{id} — full Work enrichment',
      successCount: report.findings.workById.tests.filter(t => t.ok).length,
      totalTests:   report.findings.workById.tests.length,
    },
    worksBatchEndpoint: {
      description: 'POST /works — batch enrichment',
      ok:           report.findings.worksBatch.ok,
      httpStatus:   report.findings.worksBatch.httpStatus,
      count:        report.findings.worksBatch.resultsCount ?? 0,
    },
  };

  return res.status(200).json(report);
}
