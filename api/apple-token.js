// api/apple-token.js
// Fixed: ESM export (matches audit.js import syntax)
// Fixed: No jsonwebtoken dependency — uses Node.js built-in crypto only
// Fixed: Handles Vercel \n encoding in APPLE_PRIVATE_KEY
// Apple Music developer tokens are valid for up to 180 days.
// We cache for 12 hours and regenerate, same as before.

import { createPrivateKey, createSign } from 'crypto';

let cachedToken = null;
let tokenExpiry = null;

export function generateAppleToken() {
  // Return cached token if still valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const keyId      = process.env.APPLE_KEY_ID;
  const teamId     = process.env.APPLE_TEAM_ID;
  let   privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error(
      'Missing Apple Music credentials. Check APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY env vars.'
    );
  }

  // FIX 1: Vercel stores multiline env vars with literal \n
  // Convert to real newlines so the PEM key parses correctly.
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // FIX 2: Ensure PEM headers are present
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    const body    = privateKey.replace(/\s+/g, '');
    const wrapped = body.match(/.{1,64}/g)?.join('\n') || body;
    privateKey    = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }

  console.log('[AppleToken] Key OK — begins:', privateKey.substring(0, 36));
  console.log('[AppleToken] Team ID:', teamId, '| Key ID:', keyId);

  // Parse EC private key
  let keyObject;
  try {
    keyObject = createPrivateKey({ key: privateKey, format: 'pem' });
  } catch (err) {
    throw new Error(
      `Apple private key parse failed: ${err.message}. ` +
      'Ensure APPLE_PRIVATE_KEY is the full .p8 file content including PEM headers.'
    );
  }

  // Build JWT — no jsonwebtoken dependency, pure Node crypto
  const now      = Math.floor(Date.now() / 1000);
  const exp      = now + 60 * 60 * 12; // 12 hours

  const header  = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now, exp };

  const headerB64  = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(payload));
  const input      = `${headerB64}.${payloadB64}`;

  let sig;
  try {
    const signer = createSign('SHA256');
    signer.update(input);
    signer.end();
    sig = derToRawSignature(signer.sign(keyObject));
  } catch (err) {
    throw new Error(
      `Apple JWT signing failed: ${err.message}. ` +
      'Ensure the key is an EC P-256 MusicKit key (not App Store Connect).'
    );
  }

  const token = `${input}.${sig.toString('base64url')}`;

  console.log('[AppleToken] Token generated. Length:', token.length,
              '| Expires:', new Date(exp * 1000).toISOString());

  cachedToken = token;
  tokenExpiry = Date.now() + (exp - now) * 1000 - 60_000;

  return token;
}

function b64url(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// DER-encoded ECDSA → raw r‖s (JWT requires 64-byte raw format)
function derToRawSignature(der) {
  let offset = 2;
  if (der[1] & 0x80) offset += der[1] & 0x7f;

  offset++;
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen);
  offset += rLen;

  offset++;
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);

  if (r[0] === 0x00) r = r.slice(1);
  if (s[0] === 0x00) s = s.slice(1);

  const rPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r]);
  const sPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s]);

  return Buffer.concat([rPad, sPad]);
}
