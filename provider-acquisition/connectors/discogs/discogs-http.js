// Discogs HTTP client — Phase 3.6
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and Discogs-specific 429 rate-limit handling.
//
// Discogs requirements:
//   • Auth: `Authorization: Discogs key={KEY}, secret={SECRET}` header
//   • User-Agent required: "AppName/Version (contact)" per Discogs ToS
//   • Rate limit: 60/min unauthenticated, 240/min authenticated — 429 signals excess
//
// Constitutional constraint: no business logic, no normalization.
// Returns what Discogs said; callers decide what it means.

export const DISCOGS_API_BASE           = 'https://api.discogs.com';
export const DISCOGS_USER_AGENT_DEFAULT = 'RoyalteAudit/1.0 (audit@royalte.ai)';

const DEFAULT_TIMEOUT_MS  = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 2_000;  // 240 req/min = 1 per 250ms; 2s gives comfortable headroom
const MAX_BACKOFF_MS      = 16_000;

/**
 * Perform a GET request against the Discogs API.
 *
 * @param {string} path — API path (e.g. '/database/search?q=...')
 * @param {object} options — { consumerKey, consumerSecret, userAgent, fetchFn, timeoutMs, maxRetries, baseUrl }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function discogsGet(path, options = {}) {
  const {
    consumerKey  = '',
    consumerSecret = '',
    userAgent    = DISCOGS_USER_AGENT_DEFAULT,
    fetchFn      = globalThis.fetch,
    timeoutMs    = DEFAULT_TIMEOUT_MS,
    maxRetries   = DEFAULT_MAX_RETRIES,
    baseUrl      = DISCOGS_API_BASE,
  } = options;

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers = {
    'User-Agent': userAgent,
    'Accept':     'application/json',
  };
  if (consumerKey && consumerSecret) {
    headers['Authorization'] = `Discogs key=${consumerKey}, secret=${consumerSecret}`;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const rawText = await res.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 429 — rate limited; back off and retry
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: 429, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
      }

      // 404 — not found; not retryable
      if (res.status === 404) {
        return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
      }

      // 401 — unauthorized (bad credentials)
      if (res.status === 401) {
        return { ok: false, status: 401, healthState: 'AUTH_FAILED', rawText: await safeText(res) };
      }

      // 422 — unprocessable (bad request params); not retryable
      if (res.status === 422 || res.status === 400) {
        return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // 5xx — server error; retry
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // Other 4xx — not retryable
      return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };

    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, healthState: 'TIMEOUT', error: 'request timed out' };
      }
      if (attempt < maxRetries) {
        await sleep(jitteredBackoff(attempt));
        continue;
      }
      return { ok: false, healthState: 'MAINTENANCE', error: err.message };
    }
  }

  return { ok: false, healthState: 'MAINTENANCE', error: 'max retries exceeded' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function jitteredBackoff(attempt) {
  const base = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
  return base + Math.random() * 500;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
