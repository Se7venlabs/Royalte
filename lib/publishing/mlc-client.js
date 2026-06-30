// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing — MLC runtime client  (Phase 5B / Board 2026-06-30)
// ─────────────────────────────────────────────────────────────────────
//
//  Thin wrapper around the documented MLC public API that the scan
//  lifecycle (api/audit.js → enrichment callback) invokes to fetch
//  publishing works for an artist.
//
//  Sole responsibility: produce a source observation in the canonical
//  shape the CIO + Publishing Intelligence™ assembler expect, plus the
//  raw works array. Never throws. Never partially returns.
//
//      fetchMlcWorksByArtist(artistName, { fetchImpl?, env? }) →
//        Promise<{
//          observation: { availability, details },   // for cio.observations.publishingSources.mlc
//          rawWorks:    Array<rawMlcWork>,            // for normalizeMlcWorks()
//        }>
//
//  Four-state availability semantics (Board D5 — same vocabulary as
//  every other intelligence domain):
//
//    'VERIFIED'         — call succeeded AND ≥1 work returned
//    'NOT_FOUND'        — call succeeded AND 0 works returned
//    'AUTH_UNAVAILABLE' — MLC credentials missing or token exchange
//                          rejected the credentials (401 / 403)
//    'ERROR'            — anything else (transport, 5xx, malformed
//                          JSON, missing bearer in token response, …)
//
//  AUTH_UNAVAILABLE and ERROR resolve downstream to UNABLE_TO_CONFIRM
//  — NEVER NOT_FOUND. This is constitutional (Board D5 invariant).
//
//  Official two-stage search strategy (Board-approved 2026-06-30):
//
//    Stage 1 — Recording discovery (no auth required):
//      POST /search/recordings   { "artist": artistName }
//      ← [ { mlcsongCode, title, isrc, artist, labels, id }, … ]
//
//    Stage 2 — Work detail lookup (auth required, capped at WORK_CAP):
//      GET /work/id/{mlcSongCode}   Authorization: Bearer <idToken>
//      ← { primaryTitle, iswc, mlcSongCode, writers[…], publishers[…], … }
//
//    The /search/recordings endpoint accepts a plain artist name string
//    with no title required and no writer-name splitting. /work/id returns
//    the full composition record with ISWC, writer IPIs, and publisher
//    shares. This replaces the broken /search/songcode approach which
//    required a song title and rejected empty writer arrays with HTTP 400.
//
//  Response shape mapping:
//    /work/id returns `primaryTitle`; normalizeMlcWork() reads `workTitle`.
//    This file maps primaryTitle → workTitle before calling the adapter.
//    mlc-adapter.js remains the sole owner of field-name parsing for
//    downstream consumers — it is never modified for this client's needs.
//
//  Auth flow (bearer-field selection locked to idToken):
//    POST /oauth/token  { username, password } | { refreshToken }
//                       → { accessToken, idToken, … }
//    The MLC API Gateway authorizer validates idToken; accessToken
//    returns 401. Locked in mlc-test.js stage diagnostics.
// ─────────────────────────────────────────────────────────────────────

const MLC_BASE_URL_DEFAULT  = 'https://public-api.themlc.com';
const TOKEN_PATH            = '/oauth/token';
const RECORDINGS_PATH       = '/search/recordings';
const WORK_DETAIL_PATH      = '/work/id';
const WORK_CAP              = 20;   // Board-approved v1.0 limit per scan

const MLC_OBSERVATION_AUTH_UNAVAILABLE = Object.freeze({
  availability: 'AUTH_UNAVAILABLE',
  details:      null,
});

function unknownErrorObservation(reason) {
  return {
    availability: 'ERROR',
    details:      reason ? { reason: String(reason).slice(0, 240) } : null,
  };
}

// fetchMlcWorksByArtist
//
// Resolves to { observation, rawWorks }. The function is documented
// as never-throws — every internal failure converts to an observation
// with availability ∈ { 'AUTH_UNAVAILABLE', 'ERROR' } and rawWorks = [].
//
// Optional dependency-injection points for testing:
//   options.fetchImpl  — replace global fetch (Node test runtime)
//   options.env        — replace process.env (deterministic test inputs)
export async function fetchMlcWorksByArtist(artistName, options = {}) {
  if (typeof artistName !== 'string' || artistName.trim() === '') {
    console.log('[mlc] Stage 1 — artist name missing or empty → NOT_FOUND');
    return {
      observation: { availability: 'NOT_FOUND', details: null },
      rawWorks:    [],
    };
  }

  const env       = (options && options.env)        || process.env || {};
  const fetchImpl = (options && options.fetchImpl)  || (typeof fetch === 'function' ? fetch : null);

  if (typeof fetchImpl !== 'function') {
    console.log('[mlc] Stage 1 — fetch unavailable in runtime → ERROR');
    return {
      observation: unknownErrorObservation('fetch_unavailable'),
      rawWorks:    [],
    };
  }

  const username     = env.MLC_USERNAME;
  const password     = env.MLC_PASSWORD;
  const refreshToken = env.MLC_REFRESH_TOKEN;
  const hasPwdCreds  = !!(username && password);
  const hasRefresh   = !!refreshToken;

  // Never log credential values — log presence booleans only.
  console.log('[mlc] Stage 1 — credentials: MLC_USERNAME=%s MLC_PASSWORD=%s MLC_REFRESH_TOKEN=%s',
    !!username, !!password, !!refreshToken);

  // Credentials checked upfront because Stage 2 (work detail) requires
  // a bearer token. Without credentials we cannot complete the lookup.
  if (!hasPwdCreds && !hasRefresh) {
    console.log('[mlc] Stage 1 — credentials missing → AUTH_UNAVAILABLE (add MLC_USERNAME+MLC_PASSWORD or MLC_REFRESH_TOKEN to Vercel env)');
    return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
  }

  const baseUrl            = String(env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');
  const tokenEndpoint      = `${baseUrl}${TOKEN_PATH}`;
  const recordingsEndpoint = `${baseUrl}${RECORDINGS_PATH}`;
  const workDetailBase     = `${baseUrl}${WORK_DETAIL_PATH}`;
  const tokenMode          = hasPwdCreds ? 'username+password' : 'refreshToken';
  const tokenBody          = hasPwdCreds ? { username, password } : { refreshToken };

  // ── Stage 1 — Recording discovery (no auth required) ─────────────
  // POST /search/recordings { "artist": artistName }
  // Official MLC artist-level discovery endpoint. Returns one record
  // per recording with mlcSongCode linking to the underlying composition.
  // No title required, no writer-name splitting, no auth.
  console.log('[mlc] Stage 2 — recordings discovery: artistName="%s" endpoint=%s', artistName, recordingsEndpoint);

  let recordingsResp;
  try {
    recordingsResp = await fetchImpl(recordingsEndpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Royalte/1.0 (mlc-client)',
      },
      body: JSON.stringify({ artist: artistName }),
    });
  } catch (err) {
    console.log('[mlc] Stage 2 — recordings: transport error: %s → ERROR', err?.message || err);
    return {
      observation: unknownErrorObservation(`recordings_transport: ${err?.message || err}`),
      rawWorks:    [],
    };
  }

  console.log('[mlc] Stage 3 — recordings: status=%d ok=%s', recordingsResp.status, recordingsResp.ok);

  if (!recordingsResp.ok) {
    if (recordingsResp.status === 401 || recordingsResp.status === 403) {
      console.log('[mlc] Stage 3 — recordings: auth rejected (HTTP %d) → AUTH_UNAVAILABLE', recordingsResp.status);
      return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
    }
    console.log('[mlc] Stage 3 — recordings: HTTP %d → ERROR', recordingsResp.status);
    return {
      observation: unknownErrorObservation(`recordings_http_${recordingsResp.status}`),
      rawWorks:    [],
    };
  }

  let recordingsJson;
  try { recordingsJson = await recordingsResp.json(); } catch { recordingsJson = null; }

  const recordings = Array.isArray(recordingsJson) ? recordingsJson : [];
  console.log('[mlc] Stage 3 — recordings: count=%d', recordings.length);

  if (recordings.length === 0) {
    console.log('[mlc] Stage 3 — recordings: 0 results → NOT_FOUND');
    return { observation: { availability: 'NOT_FOUND', details: null }, rawWorks: [] };
  }

  // Extract unique mlcSongCode values from recording results.
  // /search/recordings may use 'mlcsongCode' (lowercase) or 'mlcSongCode'
  // (camelCase) — handle both to be safe.
  const songCodeSet = new Set();
  for (const rec of recordings) {
    if (!rec || typeof rec !== 'object') continue;
    const code = rec.mlcSongCode || rec.mlcsongCode;
    if (typeof code === 'string' && code.trim() !== '') {
      songCodeSet.add(code.trim());
      if (songCodeSet.size >= WORK_CAP) break;
    }
  }

  if (songCodeSet.size === 0) {
    console.log('[mlc] Stage 3 — recordings: no mlcSongCode values in response → NOT_FOUND');
    return { observation: { availability: 'NOT_FOUND', details: null }, rawWorks: [] };
  }
  console.log('[mlc] Stage 3 — recordings: %d unique mlcSongCode values (cap=%d)', songCodeSet.size, WORK_CAP);

  // ── Stage 1.5 — Token exchange (for Stage 2 work detail lookups) ──
  console.log('[mlc] Stage 4 — token exchange: mode=%s endpoint=%s', tokenMode, tokenEndpoint);
  let tokenResp;
  try {
    tokenResp = await fetchImpl(tokenEndpoint, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'User-Agent':   'Royalte/1.0 (mlc-client)',
      },
      body: JSON.stringify(tokenBody),
    });
  } catch (err) {
    console.log('[mlc] Stage 4 — token exchange: transport error: %s → ERROR', err?.message || err);
    return { observation: unknownErrorObservation(`token_transport: ${err?.message || err}`), rawWorks: [] };
  }

  console.log('[mlc] Stage 5 — token exchange: status=%d ok=%s', tokenResp.status, tokenResp.ok);

  let tokenJson;
  try { tokenJson = await tokenResp.json(); } catch { tokenJson = null; }

  if (!tokenResp.ok) {
    if (tokenResp.status === 401 || tokenResp.status === 403) {
      console.log('[mlc] Stage 5 — token exchange: credentials rejected (HTTP %d) → AUTH_UNAVAILABLE', tokenResp.status);
      return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
    }
    console.log('[mlc] Stage 5 — token exchange: unexpected HTTP %d → ERROR', tokenResp.status);
    return {
      observation: unknownErrorObservation(`token_http_${tokenResp.status}`),
      rawWorks:    [],
    };
  }

  // Per mlc-test.js auth-flow analysis: idToken is the bearer the MLC
  // API Gateway authorizer expects. Do NOT switch to accessToken.
  const bearer = tokenJson?.idToken;
  if (typeof bearer !== 'string' || bearer === '') {
    console.log('[mlc] Stage 5 — token: idToken absent (keys=%s) → ERROR',
      tokenJson && typeof tokenJson === 'object' ? Object.keys(tokenJson).join(',') : 'none');
    return {
      observation: unknownErrorObservation('token_missing_idToken'),
      rawWorks:    [],
    };
  }
  console.log('[mlc] Stage 5 — token acquired: idToken=present expiresIn=%s tokenType=%s',
    tokenJson?.expiresIn ?? null, tokenJson?.tokenType ?? 'unknown');

  // ── Stage 2 — Work detail lookup (parallel, allSettled) ───────────
  // GET /work/id/{mlcSongCode}  Authorization: Bearer <idToken>
  // Returns full composition: ISWC, writers (with IPI), publishers.
  // Board-approved cap: WORK_CAP works per scan.
  const songCodes = Array.from(songCodeSet);
  console.log('[mlc] Stage 6 — work detail: fetching %d works in parallel', songCodes.length);

  const settled = await Promise.allSettled(
    songCodes.map(async (code) => {
      const resp = await fetchImpl(`${workDetailBase}/${encodeURIComponent(code)}`, {
        method:  'GET',
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Accept':        'application/json',
          'User-Agent':    'Royalte/1.0 (mlc-client)',
        },
      });
      if (!resp.ok) throw new Error(`work_http_${resp.status}`);
      return resp.json();
    })
  );

  // Map /work/id response shape to the mlc-adapter's expected shape.
  // /work/id uses `primaryTitle`; normalizeMlcWork() reads `workTitle`.
  // This is the only cross-endpoint field translation — the adapter
  // (mlc-adapter.js) remains the sole field-name parser for all downstream
  // consumers and is not modified for this endpoint difference.
  const mappedWorks = settled
    .filter((r) => r.status === 'fulfilled' && r.value && typeof r.value === 'object')
    .map((r) => {
      const w = r.value;
      return {
        workTitle:   typeof w.primaryTitle === 'string' ? w.primaryTitle
                   : typeof w.workTitle    === 'string' ? w.workTitle
                   : null,
        mlcSongCode: w.mlcSongCode || w.mlcsongCode || null,
        iswc:        typeof w.iswc === 'string' ? w.iswc : null,
        writers:     Array.isArray(w.writers) ? w.writers : [],
      };
    })
    .filter((w) => w.workTitle !== null && w.mlcSongCode !== null);

  const failedCount = settled.filter((r) => r.status === 'rejected').length;
  console.log('[mlc] Stage 6 — work detail: resolved=%d failed=%d mapped=%d',
    settled.filter((r) => r.status === 'fulfilled').length, failedCount, mappedWorks.length);

  if (mappedWorks.length === 0) {
    console.log('[mlc] Stage 7 — result: all work detail lookups failed → ERROR');
    return {
      observation: unknownErrorObservation('work_detail_all_failed'),
      rawWorks:    [],
    };
  }

  // VERIFIED — pre-compute detail fields the Publishing Intelligence™
  // assembler reads to derive per-metric state.
  const iswcCount   = mappedWorks.filter((w) => typeof w.iswc === 'string' && w.iswc.trim() !== '').length;
  const writerCount = mappedWorks.reduce((n, w) => n + w.writers.length, 0);

  console.log('[mlc] Stage 7 — result: VERIFIED worksCount=%d iswcCount=%d writerCount=%d',
    mappedWorks.length, iswcCount, writerCount);

  return {
    observation: {
      availability: 'VERIFIED',
      details: {
        worksCount:  mappedWorks.length,
        iswcCount,
        writerCount,
      },
    },
    rawWorks: mappedWorks,
  };
}
