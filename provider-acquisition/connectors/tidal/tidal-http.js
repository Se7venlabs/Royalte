// TIDAL HTTP client — Phase 4.0 TIDAL Connector™
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and rate-limit handling (honors Retry-After). Returns raw response bytes alongside
// the parsed JSON so the connector can produce integrity hashes.
//
// TIDAL API v2 specifics:
//   - Base URL: https://openapi.tidal.com/v2
//   - All requests require Authorization: Bearer <access_token>
//   - Responses use a JSON:API-adjacent structure with per-item `resource` wrappers.
//   - 401 means the token expired or is invalid — never retry, let connector re-auth.
//   - Rate limit: honor Retry-After header.
//
// Constitutional constraint: no business logic, no normalization.
// Returns what TIDAL said; callers decide what it means.

export const TIDAL_API_BASE = 'https://openapi.tidal.com/v2';

const DEFAULT_TIMEOUT_MS  = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 500;
const MAX_BACKOFF_MS      = 16_000;
const MAX_RATE_LIMIT_WAIT = 30_000;

/**
 * Perform an authenticated GET against the TIDAL API v2.
 *
 * @param {string} path   - path relative to TIDAL_API_BASE, or full URL
 * @param {string} token  - Bearer access token
 * @param {object} options
 * @returns {{
 *   ok:          boolean,
 *   status?:     number,
 *   rawText?:    string,
 *   data?:       any,
 *   healthState: string,
 *   error?:      string,
 * }}
 */
export async function tidalGet(path, token, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = TIDAL_API_BASE,
  } = options;

  const url     = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept:        'application/vnd.api+json',
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const rawText = await res.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON body → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 401 — auth rejected; never retry
      if (res.status === 401) {
        return { ok: false, status: 401, healthState: 'AUTH_FAILED', rawText: await safeText(res) };
      }

      // 429 — rate limited; honor Retry-After then retry
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfterMs = parseRetryAfter(res) * 1000;
          await sleep(Math.min(retryAfterMs, MAX_RATE_LIMIT_WAIT));
          continue;
        }
        return { ok: false, status: 429, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
      }

      // 5xx — transient server error; retry with backoff
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // 404 — not found; not retryable
      if (res.status === 404) {
        return { ok: false, status: 404, rawText: await safeText(res), healthState: 'PARTIAL_RESPONSE' };
      }

      // Other 4xx — not retryable
      return { ok: false, status: res.status, rawText: await safeText(res), healthState: 'MAINTENANCE' };

    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        return { ok: false, healthState: 'TIMEOUT', error: 'request timed out' };
      }
      // Network failure — retry
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

function parseRetryAfter(res) {
  const val = res.headers?.get?.('Retry-After');
  const n   = parseInt(val ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
