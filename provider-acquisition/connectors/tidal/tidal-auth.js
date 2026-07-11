// TIDAL client credentials auth — Phase 4.0 TIDAL Connector™
//
// Constitutional constraint: no business logic, no normalization.
// Returns raw access_token; callers decide what to do with it.
//
// TIDAL uses OAuth 2.1 client credentials flow.
// Token endpoint: https://auth.tidal.com/v1/oauth2/token
// Tokens are valid for 24 hours (86400s) by default.

export const TIDAL_AUTH_URL = 'https://auth.tidal.com/v1/oauth2/token';

/**
 * Obtain a TIDAL client credentials access token.
 *
 * @param {{ clientId: string, clientSecret: string }} config
 * @param {Function} [fetchFn] — injectable for testing
 * @returns {Promise<string>} access_token
 * @throws {Error} if credentials missing or TIDAL auth fails
 */
export async function getTidalClientToken(config, fetchFn = globalThis.fetch) {
  const { clientId, clientSecret } = config ?? {};
  if (!clientId || !clientSecret) {
    throw new Error('TidalConnector: clientId and clientSecret required');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');

  const resp = await fetchFn(TIDAL_AUTH_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(
      `TIDAL auth failed: HTTP ${resp.status}. ` +
      `Check TIDAL_CLIENT_ID and TIDAL_CLIENT_SECRET. Response: ${body.substring(0, 200)}`
    );
  }

  let data;
  try { data = await resp.json(); } catch { throw new Error('TIDAL auth: non-JSON response'); }
  if (!data?.access_token) throw new Error('TIDAL auth: missing access_token in response');
  return data.access_token;
}
