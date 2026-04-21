// api/tidal-token.js
// ─────────────────────────────────────────────────────────────────────────────
// Royaltē — Tidal Developer Platform OAuth 2.1 Token Generator
//
// Tidal uses standard OAuth 2.1 client-credentials flow. Access tokens are
// valid for 24 hours (86400 seconds). We cache the token in module scope and
// refresh 1 hour before expiry so in-flight calls never race expiration.
//
// Public exports:
//   getTidalAccessToken()      — preferred name, auto-refreshing
//   generateTidalToken()       — alias for consistency with apple-token.js
//
// Env vars (required):
//   TIDAL_CLIENT_ID            — public identifier from Tidal Developer dashboard
//   TIDAL_CLIENT_SECRET        — secret from Tidal Developer dashboard (sensitive)
//
// API reference:
//   https://developer.tidal.com/documentation/api-sdk/api-sdk-authorization
//   Token endpoint: https://auth.tidal.com/v1/oauth2/token
// ─────────────────────────────────────────────────────────────────────────────

const TIDAL_TOKEN_URL    = 'https://auth.tidal.com/v1/oauth2/token';
const REFRESH_BUFFER_MS  = 60 * 60 * 1000;  // refresh 1h before real expiry

// Module-scoped cache. Shared across requests on the same Vercel instance.
let _cachedToken    = null;
let _cachedExpiryMs = 0;

// ── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns a valid Tidal OAuth access token.
 * Reuses cached token if still valid; fetches a new one otherwise.
 *
 * @returns {Promise<string>} Access token suitable for Authorization: Bearer <token>
 * @throws if env vars are missing or Tidal auth endpoint rejects credentials
 */
export async function getTidalAccessToken() {
  if (_cachedToken && Date.now() < _cachedExpiryMs - REFRESH_BUFFER_MS) {
    return _cachedToken;
  }
  return _fetchNewToken();
}

/** Alias for consistency with apple-token.js naming. */
export async function generateTidalToken() {
  return getTidalAccessToken();
}

// ── INTERNAL: FETCH NEW TOKEN ────────────────────────────────────────────────

async function _fetchNewToken() {
  const clientId     = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;

  const missing = [];
  if (!clientId)     missing.push('TIDAL_CLIENT_ID');
  if (!clientSecret) missing.push('TIDAL_CLIENT_SECRET');
  if (missing.length) {
    throw new Error(`[tidal-token] Missing env vars: ${missing.join(', ')}`);
  }

  // Build HTTP Basic auth header: base64(client_id:client_secret)
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');

  let resp;
  try {
    resp = await fetch(TIDAL_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
  } catch (err) {
    throw new Error(`[tidal-token] Network error calling Tidal token endpoint: ${err.message}`);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(
      `[tidal-token] Tidal token endpoint returned ${resp.status} ${resp.statusText}. ` +
      `Response: ${body.substring(0, 300)}. ` +
      'Check TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET are correct.'
    );
  }

  let data;
  try {
    data = await resp.json();
  } catch (err) {
    throw new Error(`[tidal-token] Failed to parse Tidal token response as JSON: ${err.message}`);
  }

  const { access_token, expires_in, token_type } = data;
  if (!access_token || typeof access_token !== 'string') {
    throw new Error(`[tidal-token] Tidal token response missing access_token field`);
  }

  const ttlSeconds = Number(expires_in) > 0 ? Number(expires_in) : 86400; // default 24h

  _cachedToken    = access_token;
  _cachedExpiryMs = Date.now() + ttlSeconds * 1000;

  return access_token;
}
