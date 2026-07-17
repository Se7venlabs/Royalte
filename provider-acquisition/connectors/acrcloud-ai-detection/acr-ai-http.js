// ACRCloud File Scanning HTTP client — Phase 5.0 (ACRCloud AI Detection Connector™)
//
// Wraps fetch with retry (exponential backoff + jitter), timeout
// (AbortController), and File Scanning-specific response classification.
// Structure mirrors mlc-http.js / acr-http.js (Phase 3.6/3.9) but classifies
// on standard HTTP status codes, not an embedded status.code field — File
// Scanning's Console-API family (Bearer token auth) behaves like every other
// Console-API product researched in this PAL (Metadata, Buckets, Monitoring),
// unlike the Identify API's HMAC-signed /v1/identify.
//
// File Scanning API requirements (https://docs.acrcloud.com/reference/console-api/file-scanning):
//   Auth: Authorization: Bearer <token> — static console-generated token.
//   Container retrieve/health: https://api-v2.acrcloud.com (global host)
//   File submit/poll:          https://api-{region}.acrcloud.com (region-specific)
//     region ∈ { eu-west-1, us-west-2, ap-southeast-1 }
//
// Constitutional constraint: no business logic, no normalization.
// Returns what ACRCloud said; callers decide what it means.

const DEFAULT_TIMEOUT_MS  = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 1_000;
const MAX_BACKOFF_MS      = 8_000;

/**
 * Bearer-authenticated GET — used for container health-check retrieval and
 * file-status polling.
 *
 * @param {string} url — full URL
 * @param {string} token — Bearer console token
 * @param {object} options — { fetchFn, timeoutMs, maxRetries }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function acrFsGet(url, token, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer       = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetchFn(url, { method: 'GET', headers, signal: controller.signal });
      clearTimeout(timer);
      const classified = await classifyResponse(res, attempt, maxRetries);
      if (classified === 'retry') continue;
      return classified;
    } catch (err) {
      clearTimeout(timer);
      const classified = classifyError(err, attempt, maxRetries);
      if (classified === 'retry') { await sleep(jitteredBackoff(attempt)); continue; }
      return classified;
    }
  }
  return { ok: false, healthState: 'MAINTENANCE', error: 'max retries exceeded' };
}

/**
 * Bearer-authenticated multipart/form-data POST — used for file submission.
 *
 * @param {string} url — full URL
 * @param {string} token — Bearer console token
 * @param {object} fields — form fields (e.g. { data_type, name, url })
 * @param {Buffer|null} file — raw file bytes, or null for URL-based submission
 * @param {object} options — { fetchFn, timeoutMs, maxRetries }
 * @returns {{ ok, status?, rawText?, data?, healthState, error? }}
 */
export async function acrFsSubmitFile(url, token, fields, file, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  const headers = { Authorization: `Bearer ${token}` };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer       = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const form = buildForm(fields, file);
      const res  = await fetchFn(url, { method: 'POST', headers, body: form, signal: controller.signal });
      clearTimeout(timer);
      const classified = await classifyResponse(res, attempt, maxRetries);
      if (classified === 'retry') continue;
      return classified;
    } catch (err) {
      clearTimeout(timer);
      const classified = classifyError(err, attempt, maxRetries);
      if (classified === 'retry') { await sleep(jitteredBackoff(attempt)); continue; }
      return classified;
    }
  }
  return { ok: false, healthState: 'MAINTENANCE', error: 'max retries exceeded' };
}

// ── Response classification ─────────────────────────────────────────────────
// Returns the literal string 'retry' to signal the caller should loop again
// (after the caller awaits a backoff), or a terminal result object.

async function classifyResponse(res, attempt, maxRetries) {
  if (res.ok) {
    const rawText = await safeText(res);
    let data = null;
    try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }
    return { ok: true, status: res.status, rawText, data };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, healthState: 'AUTH_FAILED', rawText: await safeText(res) };
  }
  if (res.status === 404) {
    return { ok: false, status: 404, healthState: 'PARTIAL_RESPONSE', rawText: await safeText(res) };
  }
  if (res.status === 429) {
    if (attempt < maxRetries) { await sleep(jitteredBackoff(attempt)); return 'retry'; }
    return { ok: false, status: 429, healthState: 'RATE_LIMITED', rawText: await safeText(res) };
  }
  if (res.status >= 500) {
    if (attempt < maxRetries) { await sleep(jitteredBackoff(attempt)); return 'retry'; }
    return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
  }
  // Other 4xx — not retryable
  return { ok: false, status: res.status, healthState: 'MAINTENANCE', rawText: await safeText(res) };
}

function classifyError(err, attempt, maxRetries) {
  if (err.name === 'AbortError') {
    return { ok: false, healthState: 'TIMEOUT', error: 'request timed out' };
  }
  if (attempt < maxRetries) return 'retry';
  return { ok: false, healthState: 'MAINTENANCE', error: err.message };
}

// ── Request assembly ──────────────────────────────────────────────────────────

function buildForm(fields, file) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (value !== undefined && value !== null) form.append(key, value);
  }
  if (file) {
    form.append('file', new Blob([file]), fields?.name ?? 'file');
  }
  return form;
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
