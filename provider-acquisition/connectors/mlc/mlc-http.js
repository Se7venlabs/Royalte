// MLC HTTP client — Phase 3.6 (The MLC)
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// and MLC Public Search API v1 error handling.
//
// MLC API requirements:
//   Base URL: https://public-api.themlc.com
//   Auth: Bearer {idToken} header (obtained via POST /oauth/token)
//   Content-Type: application/json on all POST requests
//   No documented rate limits. No User-Agent requirement.
//
// Error codes:
//   401 — expired/invalid token; signals AUTH_FAILED (trigger re-auth)
//   400 — bad request params; not retryable
//   404 — not found; not retryable
//   5xx — server error; retry with backoff
//
// Constitutional constraint: no business logic, no normalization.
// Returns what The MLC said; callers decide what it means.

export const MLC_API_BASE = 'https://public-api.themlc.com';

const DEFAULT_TIMEOUT_MS  = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 1_000;
const MAX_BACKOFF_MS      = 8_000;

/**
 * POST request to the MLC API.
 *
 * @param {string} path — e.g. '/oauth/token', '/works', '/search/recordings'
 * @param {object} body — request payload (serialized to JSON)
 * @param {object} options — { idToken?, fetchFn, timeoutMs, maxRetries, baseUrl }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function mlcPost(path, body, options = {}) {
  const {
    idToken    = null,
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = MLC_API_BASE,
  } = options;

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, {
        method:  'POST',
        headers,
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const rawText = await res.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      // 401 — expired or invalid token
      if (res.status === 401) {
        return { ok: false, status: 401, healthState: 'AUTH_FAILED', rawText: await safeText(res) };
      }

      // 400 — bad request; not retryable
      if (res.status === 400) {
        return { ok: false, status: 400, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }

      // 404 — not found; not retryable
      if (res.status === 404) {
        return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
      }

      // 429 — rate limited; back off and retry
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

/**
 * GET request to the MLC API. Mirrors mlcPost's retry/backoff/error
 * classification exactly; added alongside it (not merged into it) so the
 * existing POST wrapper is untouched.
 *
 * @param {string} path — e.g. '/work/id/{id}'
 * @param {object} options — { idToken?, fetchFn, timeoutMs, maxRetries, baseUrl }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function mlcGet(path, options = {}) {
  const {
    idToken    = null,
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    baseUrl    = MLC_API_BASE,
  } = options;

  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;

  const headers = { Accept: 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, {
        method:  'GET',
        headers,
        signal:  controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const rawText = await res.text();
        let data = null;
        try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
        return { ok: true, status: res.status, rawText, data };
      }

      if (res.status === 401) {
        return { ok: false, status: 401, healthState: 'AUTH_FAILED', rawText: await safeText(res) };
      }
      if (res.status === 400) {
        return { ok: false, status: 400, healthState: 'MAINTENANCE', rawText: await safeText(res) };
      }
      if (res.status === 404) {
        return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
      }
      if (res.status === 429) {
        if (attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, status: 429, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
      }
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
  return base + Math.random() * 400;
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
