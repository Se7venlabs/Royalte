// MusicBrainz HTTP client — Phase 3.8
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and MusicBrainz-specific 503 rate-limit handling.
//
// MusicBrainz requirements:
//   • No API key — open database
//   • User-Agent REQUIRED: "AppName/Version (contact)" per MB ToS
//   • Rate limit: ~1 req/sec for unauthenticated — 503 signals excess
//   • Always append &fmt=json
//
// Constitutional constraint: no business logic, no normalization.
// Returns what MusicBrainz said; callers decide what it means.

export const MB_API_BASE    = 'https://musicbrainz.org/ws/2';
export const MB_USER_AGENT  = 'RoyalteAudit/1.0 (audit@royalte.ai)';

const DEFAULT_TIMEOUT_MS  = 15_000;  // MB can be slow — allow more time
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 1_100;   // respects 1 req/sec rate limit on first retry
const MAX_BACKOFF_MS      = 16_000;

/**
 * Perform a GET request against the MusicBrainz API.
 *
 * Path must NOT include &fmt=json — this client appends it automatically.
 *
 * @returns {{
 *   ok:          boolean,
 *   status?:     number,
 *   rawText?:    string,
 *   data?:       any,
 *   healthState: string,
 *   error?:      string,
 * }}
 */
export async function mbGet(path, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = MB_API_BASE,
    userAgent  = MB_USER_AGENT,
  } = options;

  // Append fmt=json if not already present
  const separator = path.includes('?') ? '&' : '?';
  const url = (path.startsWith('http') ? path : `${baseUrl}${path}`) + `${separator}fmt=json`;

  const headers = {
    'User-Agent': userAgent,
    'Accept':     'application/json',
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
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 503 — rate limited; back off and retry
      if (res.status === 503) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: 503, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
      }

      // 400 — bad request; not retryable
      if (res.status === 400) {
        return { ok: false, status: 400, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // 404 — not found; not retryable
      if (res.status === 404) {
        return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
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
