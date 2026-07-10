// YouTube HTTP client — Phase 3.6 (YouTube)
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and YouTube Data API v3 error handling.
//
// YouTube API v3 requirements:
//   • Auth: `key={YOUTUBE_API_KEY}` query parameter
//   • No User-Agent requirement (Google API key in URL is sufficient)
//   • Quota-based rate limiting — 403 with reason 'quotaExceeded' signals exhaustion
//   • 400 — bad request (invalid params); not retryable
//
// Constitutional constraint: no business logic, no normalization.
// Returns what YouTube said; callers decide what it means.

export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

const DEFAULT_TIMEOUT_MS  = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 1_000;
const MAX_BACKOFF_MS      = 8_000;

/**
 * Perform a GET request against the YouTube Data API v3.
 *
 * Path must include all query params except `key`; this client appends it.
 * e.g. `/search?part=snippet&q=Artist&type=channel&maxResults=10`
 *
 * @param {string} path
 * @param {object} options — { apiKey, fetchFn, timeoutMs, maxRetries, baseUrl }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function youtubeGet(path, options = {}) {
  const {
    apiKey     = '',
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = YOUTUBE_API_BASE,
  } = options;

  const separator = path.includes('?') ? '&' : '?';
  const url = (path.startsWith('http') ? path : `${baseUrl}${path}`) +
              (apiKey ? `${separator}key=${apiKey}` : '');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const rawText = await res.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 403 — quota exceeded or auth error
      if (res.status === 403) {
        const rawText = await safeText(res);
        let reason = 'forbidden';
        try {
          const parsed = JSON.parse(rawText);
          reason = parsed?.error?.errors?.[0]?.reason ?? 'forbidden';
        } catch { /* ignore */ }
        const healthState = reason === 'quotaExceeded' ? 'RATE_LIMITED' : 'AUTH_FAILED';
        return { ok: false, status: 403, healthState, rawText, error: reason };
      }

      // 400 — bad request; not retryable
      if (res.status === 400) {
        return { ok: false, status: 400, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // 404 — not found; not retryable
      if (res.status === 404) {
        return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
      }

      // 429 — rate limited (non-quota); back off and retry
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: 429, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
      }

      // 5xx — server error; retry
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

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
  return base + Math.random() * 300;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
