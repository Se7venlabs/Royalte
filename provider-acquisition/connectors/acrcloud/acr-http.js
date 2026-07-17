// ACRCloud HTTP client — Phase 3.9 (ACRCloud)
//
// Wraps fetch with retry (exponential backoff + jitter), timeout (AbortController),
// multipart/form-data request assembly, and ACRCloud Identify API response
// classification. Structure mirrors mlc-http.js (Phase 3.6).
//
// ACRCloud Identify API requirements:
//   Method: POST multipart/form-data
//   Host:   per-project, assigned at ACRCloud console project creation
//           (e.g. identify-eu-west-1.acrcloud.com) — never a fixed constant.
//   Auth:   signed form fields (access_key, signature, signature_version,
//           timestamp) — see acr-auth.js. No Authorization header.
//
// Response classification note: ACRCloud's Identify API returns HTTP 200 for
// almost every outcome, including auth failures and no-match results — the
// real result lives in the JSON body's status.code, not the HTTP status line.
// Per https://docs.acrcloud.com (Identify API + Error Codes reference):
//   0    — success (match found)
//   1001 — no recognition result (not an error — genuinely "no match")
//   3001 — wrong access key            → AUTH_FAILED
//   3014 — invalid signature           → AUTH_FAILED
//   3003 — request count limit exceeded → RATE_LIMITED (retry)
//   3015 — QPS limit exceeded          → RATE_LIMITED (retry)
//   3002 — invalid HTTP request        → not retryable
//   3006 — invalid arguments           → not retryable
//   3000 — recognition service error (network/host)  → retry
//   3010 — recognition service error (internal)       → retry
//
// Constitutional constraint: no business logic, no normalization.
// Returns what ACRCloud said; callers decide what it means.

const DEFAULT_TIMEOUT_MS  = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS  = 1_000;
const MAX_BACKOFF_MS      = 8_000;

const AUTH_FAILED_CODES    = new Set([3001, 3014]);
const RATE_LIMITED_CODES   = new Set([3003, 3015]);
const NOT_RETRYABLE_CODES  = new Set([3002, 3006]);
const SERVICE_ERROR_CODES  = new Set([3000, 3010]);

/**
 * POST a signed multipart/form-data request to an ACRCloud endpoint.
 *
 * @param {string} url — full URL, e.g. `https://{host}/v1/identify`
 * @param {object} fields — signed form fields from acr-auth.buildSignedFields(), e.g.
 *   { access_key, data_type, signature_version, signature, timestamp }
 * @param {Buffer} sample — raw audio or fingerprint bytes
 * @param {object} options — { fetchFn, timeoutMs, maxRetries }
 * @returns {{ ok, acrStatusCode?, healthState, data?, rawText?, error? }}
 */
export async function acrIdentify(url, fields, sample, options = {}) {
  const {
    fetchFn    = globalThis.fetch,
    timeoutMs  = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer       = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = buildIdentifyForm(fields, sample);
      const res  = await fetchFn(url, { method: 'POST', body, signal: controller.signal });
      clearTimeout(timer);

      if (!res.ok) {
        // Transport-level failure (rare — ACRCloud usually answers 200 with
        // the real outcome in the JSON body). Treat like any HTTP failure.
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          await sleep(jitteredBackoff(attempt));
          continue;
        }
        return { ok: false, healthState: 'MAINTENANCE', rawText: await safeText(res),
          error: `HTTP ${res.status}` };
      }

      const rawText = await res.text();
      let data = null;
      try { data = JSON.parse(rawText); } catch { /* non-JSON → data stays null */ }

      if (data === null) {
        return { ok: false, healthState: 'SCHEMA_CHANGED', rawText, error: 'response body was not valid JSON' };
      }

      const acrStatusCode = data?.status?.code;
      const classification = classifyStatusCode(acrStatusCode);

      if (classification.retry && attempt < maxRetries) {
        await sleep(jitteredBackoff(attempt));
        continue;
      }

      return {
        ok:            classification.healthState === 'AVAILABLE' || classification.healthState === 'PARTIAL_RESPONSE',
        acrStatusCode,
        healthState:   classification.healthState,
        data,
        rawText,
      };

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

// ── Response classification ─────────────────────────────────────────────────

function classifyStatusCode(code) {
  if (code === 0)                        return { healthState: 'AVAILABLE',   retry: false };
  if (code === 1001)                     return { healthState: 'PARTIAL_RESPONSE', retry: false }; // no match ≠ error
  if (AUTH_FAILED_CODES.has(code))       return { healthState: 'AUTH_FAILED', retry: false };
  if (RATE_LIMITED_CODES.has(code))      return { healthState: 'RATE_LIMITED', retry: true };
  if (NOT_RETRYABLE_CODES.has(code))     return { healthState: 'MAINTENANCE', retry: false };
  if (SERVICE_ERROR_CODES.has(code))     return { healthState: 'MAINTENANCE', retry: true };
  return { healthState: 'UNAVAILABLE', retry: false };
}

// ── Request assembly ──────────────────────────────────────────────────────────

function buildIdentifyForm(fields, sample) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  form.append('sample_bytes', String(sample?.byteLength ?? sample?.length ?? 0));
  form.append('sample', new Blob([sample ?? Buffer.alloc(0)]), 'sample');
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
