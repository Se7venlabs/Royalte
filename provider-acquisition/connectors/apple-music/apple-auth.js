// Apple Music developer token generator — Phase 2.2
//
// Generates ES256 JWT for Apple MusicKit API authentication.
// Accepts credentials as parameters (injectable) — does NOT read env vars.
// Production callers read APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY
// from their environment and pass them in. Tests inject mock credentials.
//
// Uses jsonwebtoken (already in repo deps). No new runtime dependencies.

import jwt from 'jsonwebtoken';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days (Apple maximum)

/**
 * Generate a signed Apple MusicKit developer token.
 * @param {{ teamId: string, keyId: string, privateKey: string }} credentials
 * @returns {string} JWT bearer token
 */
export function generateAppleToken({ teamId, keyId, privateKey }) {
  if (!teamId)     throw new TypeError('apple-auth: teamId is required');
  if (!keyId)      throw new TypeError('apple-auth: keyId is required');
  if (!privateKey) throw new TypeError('apple-auth: privateKey is required');

  const pem = normalizePrivateKey(privateKey);

  return jwt.sign(
    { iss: teamId },
    pem,
    { algorithm: 'ES256', keyid: keyId, expiresIn: TOKEN_TTL_SECONDS }
  );
}

// ── Key normalization ─────────────────────────────────────────────────────────
// Handles the same edge cases as api/apple-token.js:
//   - quoted strings (pasted as JSON)
//   - literal \n escapes (Vercel env var storage)
//   - raw base64 without PEM framing
//   - missing END marker (Vercel UI truncation)
//   - CRLF normalization

function normalizePrivateKey(raw) {
  let pem = String(raw).trim();

  if ((pem.startsWith('"') && pem.endsWith('"')) ||
      (pem.startsWith("'") && pem.endsWith("'"))) {
    pem = pem.slice(1, -1);
  }

  if (pem.includes('\\n')) pem = pem.replace(/\\n/g, '\n');

  if (!pem.includes('-----BEGIN PRIVATE KEY-----')) {
    const body    = pem.replace(/\s+/g, '');
    const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
    pem = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
  } else if (!pem.includes('-----END PRIVATE KEY-----')) {
    const lines = pem.split('\n').map(l => l.trimEnd()).filter(Boolean);
    lines.push('-----END PRIVATE KEY-----');
    pem = lines.join('\n');
  }

  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!pem.endsWith('\n')) pem += '\n';
  return pem;
}
