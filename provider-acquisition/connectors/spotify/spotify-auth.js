// Spotify client credentials auth — Phase 3.6
//
// Constitutional constraint: no business logic, no normalization.
// Returns raw access_token; callers decide what to do with it.

export const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/api/token';

/**
 * Obtain a Spotify client credentials access token.
 *
 * @param {{ clientId: string, clientSecret: string }} config
 * @param {Function} [fetchFn] — injectable for testing
 * @returns {Promise<string>} access_token
 * @throws {Error} if credentials missing or Spotify auth fails
 */
export async function getSpotifyClientToken(config, fetchFn = globalThis.fetch) {
  const { clientId, clientSecret } = config ?? {};
  if (!clientId || !clientSecret) {
    throw new Error('SpotifyConnector: clientId and clientSecret required');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const resp = await fetchFn(SPOTIFY_AUTH_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    throw new Error(`Spotify auth failed: HTTP ${resp.status}`);
  }

  let data;
  try { data = await resp.json(); } catch { throw new Error('Spotify auth: non-JSON response'); }
  if (!data?.access_token) throw new Error('Spotify auth: missing access_token in response');
  return data.access_token;
}
