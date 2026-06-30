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
//      fetchMlcWorksByArtist(artistName, options) →
//        Promise<{
//          observation: { availability, details },   // for cio.observations.publishingSources.mlc
//          rawWorks:    Array<rawMlcWork>,            // for normalizeMlcWorks()
//        }>
//
//  Four-state availability semantics (Board D5):
//
//    'VERIFIED'         — call succeeded AND ≥1 work returned
//    'NOT_FOUND'        — call succeeded AND 0 works returned
//    'AUTH_UNAVAILABLE' — credentials missing or token exchange rejected
//    'ERROR'            — transport, 5xx, malformed JSON, no bearer, …
//
//  AUTH_UNAVAILABLE and ERROR resolve downstream to UNABLE_TO_CONFIRM
//  — NEVER NOT_FOUND (Board D5 invariant).
//
//  Production search strategy (Board-approved 2026-06-30):
//
//    Endpoint: POST /search/songcode  Authorization: Bearer <idToken>
//    Body per song: { title: songTitle, writers: [writerEntry] }
//
//    Caller (audit.js) supplies song titles extracted from the canonical
//    scan payload (Spotify top-track, ISRC lookup, Deezer top tracks).
//    The artist name is split into first/last for the writerEntry so the
//    search is scoped to the artist's works, not every work with that title.
//
//    /search/songcode returns the COMPLETE work object — workTitle,
//    mlcSongCode, iswc, writers (with IPIs) — so no follow-up /work/id
//    call is needed. The response shape matches mlc-adapter.js exactly.
//
//    Searches run sequentially (one per song title) to avoid triggering
//    burst rate limits. Results are deduplicated by mlcSongCode. Max
//    SONG_TITLE_CAP titles searched; max WORK_CAP unique works returned.
//
//    /search/recordings was attempted (2026-06-30) but returns persistent
//    HTTP 429 for this account tier regardless of cooldown. Pivoted back
//    to the proven /search/songcode path per Board directive.
//
//  Auth flow (bearer-field locked to idToken):
//    POST /oauth/token  { username, password } | { refreshToken }
//                       → { idToken, accessToken, … }
//    MLC's API Gateway validates idToken; accessToken returns 401.
//
//  options:
//    songTitles   string[]   — song titles to search (required for results)
//    fetchImpl    function   — replace global fetch (testing)
//    env          object     — replace process.env (testing)
// ─────────────────────────────────────────────────────────────────────

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const TOKEN_PATH           = '/oauth/token';
const SEARCH_PATH          = '/search/songcode';
const SONG_TITLE_CAP       = 5;   // max song titles to search per scan
const WORK_CAP             = 20;  // max unique works to collect

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

// Split artist name into MLC writer fields.
// "Ed Sheeran"       → { writerFirstName: "Ed",    writerLastName: "Sheeran" }
// "Taylor Swift"     → { writerFirstName: "Taylor", writerLastName: "Swift"   }
// "The Weeknd"       → { writerFirstName: "The",    writerLastName: "Weeknd"  }
// "Drake"            → {                             writerLastName: "Drake"   }
// "Black Alternative"→ { writerFirstName: "Black",  writerLastName: "Alternative" }
function buildWriterEntry(artistName) {
  const trimmed   = artistName.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) {
    return { writerLastName: trimmed };
  }
  return {
    writerFirstName: trimmed.slice(0, lastSpace),
    writerLastName:  trimmed.slice(lastSpace + 1),
  };
}

// fetchMlcWorksByArtist
//
// Resolves to { observation, rawWorks }. Never throws — every failure
// converts to an observation with rawWorks = [].
export async function fetchMlcWorksByArtist(artistName, options = {}) {
  if (typeof artistName !== 'string' || artistName.trim() === '') {
    console.log('[mlc] Stage 1 — artist name missing or empty → NOT_FOUND');
    return { observation: { availability: 'NOT_FOUND', details: null }, rawWorks: [] };
  }

  const env       = (options && options.env)        || process.env || {};
  const fetchImpl = (options && options.fetchImpl)  || (typeof fetch === 'function' ? fetch : null);

  // Validate song titles from caller (audit.js extracts them from the
  // canonical scan payload before invoking this function).
  const songTitles = Array.isArray(options?.songTitles)
    ? options.songTitles
        .filter((t) => typeof t === 'string' && t.trim() !== '')
        .slice(0, SONG_TITLE_CAP)
    : [];

  if (typeof fetchImpl !== 'function') {
    console.log('[mlc] Stage 1 — fetch unavailable in runtime → ERROR');
    return { observation: unknownErrorObservation('fetch_unavailable'), rawWorks: [] };
  }

  if (songTitles.length === 0) {
    // No song titles: cannot search /search/songcode (title is required).
    // Resolves to UNABLE_TO_CONFIRM downstream — not NOT_FOUND.
    console.log('[mlc] Stage 1 — no song titles in scan payload → ERROR(no_song_titles_for_search)');
    return {
      observation: unknownErrorObservation('no_song_titles_for_search'),
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

  if (!hasPwdCreds && !hasRefresh) {
    console.log('[mlc] Stage 1 — credentials missing → AUTH_UNAVAILABLE');
    return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
  }

  const baseUrl        = String(env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');
  const tokenEndpoint  = `${baseUrl}${TOKEN_PATH}`;
  const searchEndpoint = `${baseUrl}${SEARCH_PATH}`;
  const tokenMode      = hasPwdCreds ? 'username+password' : 'refreshToken';
  const tokenBody      = hasPwdCreds ? { username, password } : { refreshToken };

  // ── Stage 1 — Token exchange ───────────────────────────────────────
  console.log('[mlc] Stage 2 — token exchange: mode=%s endpoint=%s', tokenMode, tokenEndpoint);
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
    console.log('[mlc] Stage 2 — token exchange: transport error: %s → ERROR', err?.message || err);
    return { observation: unknownErrorObservation(`token_transport: ${err?.message || err}`), rawWorks: [] };
  }

  console.log('[mlc] Stage 3 — token exchange: status=%d ok=%s', tokenResp.status, tokenResp.ok);

  let tokenJson;
  try { tokenJson = await tokenResp.json(); } catch { tokenJson = null; }

  if (!tokenResp.ok) {
    if (tokenResp.status === 401 || tokenResp.status === 403) {
      console.log('[mlc] Stage 3 — token exchange: credentials rejected (HTTP %d) → AUTH_UNAVAILABLE', tokenResp.status);
      return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
    }
    console.log('[mlc] Stage 3 — token exchange: unexpected HTTP %d → ERROR', tokenResp.status);
    return { observation: unknownErrorObservation(`token_http_${tokenResp.status}`), rawWorks: [] };
  }

  // Per mlc-test.js: idToken is the bearer the MLC API Gateway validates.
  // Do NOT switch to accessToken.
  const bearer = tokenJson?.idToken;
  if (typeof bearer !== 'string' || bearer === '') {
    console.log('[mlc] Stage 3 — token: idToken absent (keys=%s) → ERROR',
      tokenJson && typeof tokenJson === 'object' ? Object.keys(tokenJson).join(',') : 'none');
    return { observation: unknownErrorObservation('token_missing_idToken'), rawWorks: [] };
  }
  console.log('[mlc] Stage 3 — token acquired: idToken=present expiresIn=%s', tokenJson?.expiresIn ?? null);

  // ── Stage 2 — Per-song publishing search ─────────────────────────
  // POST /search/songcode { title: songTitle, writers: [writerEntry] }
  // Runs sequentially — one search per song title — to avoid burst
  // rate limits. Deduplicates results across all songs by mlcSongCode.
  //
  // /search/songcode returns the COMPLETE work (workTitle, mlcSongCode,
  // iswc, writers + IPIs). No follow-up /work/id lookup needed. The
  // response shape is what mlc-adapter.js normalizeMlcWorks() expects.
  const writerEntry  = buildWriterEntry(artistName);
  const songCodeSet  = new Set();
  const rawWorks     = [];
  let   searchErrors = 0;
  let   fatalAuth    = false;

  console.log('[mlc] Stage 4 — search: %d songs writerEntry=%j', songTitles.length, writerEntry);

  for (const songTitle of songTitles) {
    if (songCodeSet.size >= WORK_CAP || fatalAuth) break;

    const searchBody = { title: songTitle, writers: [writerEntry] };
    let searchResp;
    try {
      searchResp = await fetchImpl(searchEndpoint, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${bearer}`,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
          'User-Agent':    'Royalte/1.0 (mlc-client)',
        },
        body: JSON.stringify(searchBody),
      });
    } catch (err) {
      console.log('[mlc] Stage 4 — search "%s": transport error: %s', songTitle, err?.message || err);
      searchErrors++;
      continue;
    }

    console.log('[mlc] Stage 5 — search "%s": status=%d ok=%s', songTitle, searchResp.status, searchResp.ok);

    if (!searchResp.ok) {
      if (searchResp.status === 401 || searchResp.status === 403) {
        console.log('[mlc] Stage 5 — search: bearer rejected (HTTP %d) → AUTH_UNAVAILABLE', searchResp.status);
        fatalAuth = true;
        break;
      }
      console.log('[mlc] Stage 5 — search "%s": HTTP %d — skipping', songTitle, searchResp.status);
      searchErrors++;
      continue;
    }

    let searchJson;
    try { searchJson = await searchResp.json(); } catch { searchJson = null; }

    const works     = Array.isArray(searchJson) ? searchJson : [];
    let   newForSong = 0;
    for (const work of works) {
      if (songCodeSet.size >= WORK_CAP) break;
      const code = work?.mlcSongCode;
      if (typeof code === 'string' && code.trim() !== '' && !songCodeSet.has(code)) {
        songCodeSet.add(code);
        rawWorks.push(work);
        newForSong++;
      }
    }
    console.log('[mlc] Stage 5 — search "%s": returned=%d new=%d total=%d',
      songTitle, works.length, newForSong, rawWorks.length);
  }

  // ── Stage 3 — Resolve observation ─────────────────────────────────
  if (fatalAuth) {
    return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
  }

  if (rawWorks.length === 0 && searchErrors > 0 && searchErrors === songTitles.length) {
    console.log('[mlc] Stage 6 — all %d searches errored → ERROR', searchErrors);
    return {
      observation: unknownErrorObservation(`all_searches_failed_${searchErrors}_errors`),
      rawWorks:    [],
    };
  }

  if (rawWorks.length === 0) {
    console.log('[mlc] Stage 6 — 0 unique works found → NOT_FOUND');
    return { observation: { availability: 'NOT_FOUND', details: null }, rawWorks: [] };
  }

  const iswcCount   = rawWorks.filter((w) => w && typeof w.iswc === 'string' && w.iswc.trim() !== '').length;
  const writerCount = rawWorks.reduce((n, w) => n + (Array.isArray(w?.writers) ? w.writers.length : 0), 0);

  console.log('[mlc] Stage 7 — result: VERIFIED worksCount=%d iswcCount=%d writerCount=%d',
    rawWorks.length, iswcCount, writerCount);

  return {
    observation: {
      availability: 'VERIFIED',
      details: {
        worksCount:  rawWorks.length,
        iswcCount,
        writerCount,
      },
    },
    rawWorks,
  };
}
