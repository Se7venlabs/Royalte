// Last.fm HTTP client — Phase 3.6 Provider Expansion 09
//
// Wraps fetch for all Last.fm API calls. All requests are GET to:
//   https://ws.audioscrobbler.com/2.0/?method=...&api_key={key}&format=json
//
// Last.fm specifics:
//   - API key appended as query parameter (no Bearer token).
//   - format=json required; otherwise XML is returned.
//   - Error responses use HTTP 200 with body: { error: N, message: "..." }
//     Error codes: 6 = artist not found, 29 = rate limit exceeded.
//   - User-Agent header required to identify the client.
//
// Constitutional constraint: no business logic, no normalization.
// Returns what Last.fm said; callers decide what it means.

export const LASTFM_API_BASE   = 'https://ws.audioscrobbler.com/2.0';
export const LASTFM_USER_AGENT = 'RoyalteAudit/1.0 (audit@royalte.ai)';

const LASTFM_ERROR_NOT_FOUND    = 6;
const LASTFM_ERROR_RATE_LIMITED = 29;

const DEFAULT_TIMEOUT_MS  = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 500;
const MAX_BACKOFF_MS      = 16_000;
const MAX_RATE_LIMIT_WAIT = 30_000;

/**
 * Perform a GET against the Last.fm API.
 *
 * @param {string} method — Last.fm method name (e.g. 'artist.getinfo')
 * @param {Record<string, string>} params — extra query params (excluding api_key, format, method)
 * @param {object} options — { apiKey, fetchFn, timeoutMs, maxRetries, baseUrl }
 * @returns {{
 *   ok:          boolean,
 *   status?:     number,
 *   rawText?:    string,
 *   data?:       any,
 *   healthState: string,
 *   error?:      string,
 * }}
 */
export async function lastfmGet(method, params = {}, options = {}) {
  const {
    apiKey,
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = LASTFM_API_BASE,
    userAgent  = LASTFM_USER_AGENT,
  } = options;

  if (!apiKey) {
    return { ok: false, healthState: 'AUTH_UNAVAILABLE', error: 'Last.fm API key not configured' };
  }

  const searchParams = new URLSearchParams({
    method,
    api_key: apiKey,
    format:  'json',
    ...params,
  });
  const url     = `${baseUrl}?${searchParams.toString()}`;
  const headers = { 'User-Agent': userAgent };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      const rawText = await safeText(res);

      // Last.fm returns HTTP 200 for most errors — parse JSON to check
      if (res.ok) {
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }

        // Detect Last.fm application-level errors (always in a 200 response)
        if (data?.error) {
          if (data.error === LASTFM_ERROR_NOT_FOUND) {
            return { ok: false, status: 200, rawText, healthState: 'PARTIAL_RESPONSE',
              error: data.message ?? 'artist not found' };
          }
          if (data.error === LASTFM_ERROR_RATE_LIMITED) {
            if (attempt < maxRetries) {
              await sleep(jitteredBackoff(attempt));
              continue;
            }
            return { ok: false, status: 200, rawText, healthState: 'RATE_LIMITED',
              error: data.message ?? 'rate limited' };
          }
          // Any other Last.fm error
          return { ok: false, status: 200, rawText, healthState: 'MAINTENANCE',
            error: data.message ?? `last.fm error ${data.error}` };
        }

        return { ok: true, status: res.status, rawText, data };
      }

      // 429 — HTTP-level rate limit
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfterMs = parseRetryAfter(res) * 1000;
          await sleep(Math.min(retryAfterMs, MAX_RATE_LIMIT_WAIT));
          continue;
        }
        return { ok: false, status: 429, rawText, healthState: 'RATE_LIMITED' };
      }

      // 5xx — retry with backoff
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: res.status, rawText, healthState: 'MAINTENANCE' };
      }

      // 4xx — not retryable
      return { ok: false, status: res.status, rawText, healthState: 'MAINTENANCE' };

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
