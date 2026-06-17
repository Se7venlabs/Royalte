// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing — MLC runtime client  (Phase 5B)
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
//  Auth flow (locked in api/mlc-test.js — kept in sync with this client):
//
//    Step 1 — POST /oauth/token   { username, password } | { refreshToken }
//                                 → { accessToken, idToken, … }
//    Step 2 — POST /search/songcode  Authorization: Bearer <idToken>
//                                 → [ { iswc, mlcSongCode, workTitle,
//                                       writers[…] }, … ]
//
//  The bearer-field selection (idToken vs accessToken) is locked to
//  idToken — empirically MLC's API Gateway authorizer validates the
//  idToken; accessToken returns 401. Documented in mlc-test.js.
// ─────────────────────────────────────────────────────────────────────

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const TOKEN_PATH           = '/oauth/token';
const SEARCH_PATH          = '/search/songcode';

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
    return {
      observation: { availability: 'NOT_FOUND', details: null },
      rawWorks:    [],
    };
  }

  const env       = (options && options.env)        || process.env || {};
  const fetchImpl = (options && options.fetchImpl)  || (typeof fetch === 'function' ? fetch : null);

  if (typeof fetchImpl !== 'function') {
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
  if (!hasPwdCreds && !hasRefresh) {
    return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
  }

  const baseUrl = String(env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');
  const tokenEndpoint  = `${baseUrl}${TOKEN_PATH}`;
  const searchEndpoint = `${baseUrl}${SEARCH_PATH}`;
  const tokenBody      = hasPwdCreds ? { username, password } : { refreshToken };

  // ─── Step 1 — token exchange ───────────────────────────────────────
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
    return { observation: unknownErrorObservation(`token_transport: ${err?.message || err}`), rawWorks: [] };
  }

  let tokenJson;
  try {
    tokenJson = await tokenResp.json();
  } catch {
    tokenJson = null;
  }

  if (!tokenResp.ok) {
    // 401 / 403 on credential exchange → AUTH_UNAVAILABLE. Any other
    // non-OK status surfaces as ERROR so it doesn't get confused with
    // a legitimate "looked, found nothing."
    if (tokenResp.status === 401 || tokenResp.status === 403) {
      return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
    }
    return {
      observation: unknownErrorObservation(`token_http_${tokenResp.status}`),
      rawWorks:    [],
    };
  }

  // Per mlc-test.js auth-flow analysis: idToken is the bearer the MLC
  // API Gateway authorizer expects. Do NOT switch to accessToken.
  const bearer = tokenJson?.idToken;
  if (typeof bearer !== 'string' || bearer === '') {
    return {
      observation: unknownErrorObservation('token_missing_idToken'),
      rawWorks:    [],
    };
  }

  // ─── Step 2 — authenticated search ────────────────────────────────
  // MLC's API Gateway request validator rejects { title } alone with
  // an empty 400 — writers must be present (even as []). The artist
  // name flows through as a writer hint here so MLC scopes its match;
  // an empty array still satisfies the validator and broadens the hit
  // set. We use the writer-hint shape per the locked mlc-test.js probe.
  const searchBody = {
    title:   artistName,
    writers: [],
  };

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
    return {
      observation: unknownErrorObservation(`search_transport: ${err?.message || err}`),
      rawWorks:    [],
    };
  }

  let searchJson;
  try {
    searchJson = await searchResp.json();
  } catch {
    searchJson = null;
  }

  if (!searchResp.ok) {
    if (searchResp.status === 401 || searchResp.status === 403) {
      return { observation: MLC_OBSERVATION_AUTH_UNAVAILABLE, rawWorks: [] };
    }
    return {
      observation: unknownErrorObservation(`search_http_${searchResp.status}`),
      rawWorks:    [],
    };
  }

  const rawWorks = Array.isArray(searchJson) ? searchJson : [];
  if (rawWorks.length === 0) {
    return {
      observation: { availability: 'NOT_FOUND', details: null },
      rawWorks:    [],
    };
  }

  // VERIFIED — pre-compute the per-source detail fields the Publishing
  // Intelligence™ assembler reads to derive per-metric state. The
  // details payload is OPAQUE to the assembler beyond its declared
  // keys; future fields can be added without renderer changes.
  const iswcCount   = rawWorks.filter((w) => w && typeof w.iswc === 'string' && w.iswc.trim() !== '').length;
  const writerCount = rawWorks.reduce((n, w) => n + (Array.isArray(w?.writers) ? w.writers.length : 0), 0);

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
