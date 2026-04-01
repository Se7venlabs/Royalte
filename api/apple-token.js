const jwt = require('jsonwebtoken');

let cachedToken = null;
let tokenExpiry = null;

function generateAppleToken() {
  // Return cached token if still valid (tokens last 6 months, we refresh every 12 hours)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const keyId = process.env.APPLE_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error('Missing Apple Music credentials. Check APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY env vars.');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 60 * 60 * 12; // 12 hours

  const token = jwt.sign(
    {
      iss: teamId,
      iat: now,
      exp: now + expiresIn,
    },
    privateKey,
    {
      algorithm: 'ES256',
      keyid: keyId,
    }
  );

  cachedToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000 - 60000; // refresh 1 min before expiry

  return token;
}

module.exports = { generateAppleToken };
