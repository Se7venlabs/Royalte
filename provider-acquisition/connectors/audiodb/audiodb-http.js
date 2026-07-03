// TheAudioDB HTTP client — Phase 3.6 Provider Expansion 08
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and rate-limit handling. Returns raw response bytes alongside parsed JSON so the
// connector can produce integrity hashes.
//
// TheAudioDB specifics:
//   - Public API key '2' for free tier; no Bearer token required.
//   - User-Agent header required to identify the client.
//   - Rate limits: not published; conservative retry handles transient failures.
//   - Responses: { artists: [...] } or { album: [...] } or { mvids: [...] } — always wrapped.
//
// Constitutional constraint: no business logic, no normalization.
// Returns what TheAudioDB said; callers decide what it means.

export const AUDIODB_API_BASE  = 'https://www.theaudiodb.com/api/v1/json/2';
export const AUDIODB_USER_AGENT = 'RoyalteAudit/1.0 (audit@royalte.ai)';

const DEFAULT_TIMEOUT_MS  = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 500;
const MAX_BACKOFF_MS      = 16_000;
const MAX_RATE_LIMIT_WAIT = 30_000;

/**
 * Perform a GET against TheAudioDB API.
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
export async function audiodbGet(path, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = AUDIODB_API_BASE,
    userAgent  = AUDIODB_USER_AGENT,
  } = options;

  const url     = path.startsWith('http') ? path : `${baseUrl}${path}`;
  const headers = { 'User-Agent': userAgent };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { headers, signal: controller.signal });
      clearTimeout(timer);

      const rawText = await safeText(res);

      if (res.ok) {
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON body → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 429 — rate limited; honor Retry-After then retry
      if (res.status === 429) {
        if (attempt < maxRetries) {
          const retryAfterMs = parseRetryAfter(res) * 1000;
          await sleep(Math.min(retryAfterMs, MAX_RATE_LIMIT_WAIT));
          continue;
        }
        return { ok: false, status: 429, rawText, healthState: 'RATE_LIMITED' };
      }

      // 5xx — transient server error; retry with backoff
      if (res.status >= 500) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: res.status, rawText, healthState: 'MAINTENANCE' };
      }

      // 404 — not found
      if (res.status === 404) {
        return { ok: false, status: 404, rawText, healthState: 'PARTIAL_RESPONSE' };
      }

      // Other 4xx — not retryable
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
