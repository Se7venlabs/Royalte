// api/apple-token.js
// ─────────────────────────────────────────────────────────────────────────────
// Royaltē — Apple Music Developer Token Generator (rebuilt clean)
//
// Produces a valid Apple MusicKit JWT using ES256 on Node's built-in crypto.
// Zero npm dependencies. Runs on Vercel serverless functions (Node 20).
//
// Public exports:
//   getAppleDeveloperToken()   — preferred name, auto-refreshing
//   generateAppleToken()       — alias for backwards compatibility
//
// Env vars (required):
//   APPLE_TEAM_ID              — Apple Developer Team ID (10 chars, e.g. D2472VHQJY)
//   APPLE_KEY_ID               — 10-char MusicKit Key ID (e.g. 733AS3YV7J)
//   APPLE_PRIVATE_KEY          — full .p8 contents (with BEGIN/END lines)
//                                 accepts either real newlines OR literal "\n" escapes
// ─────────────────────────────────────────────────────────────────────────────

import { createPrivateKey, createSign } from 'crypto';

// Apple allows tokens up to 180 days. We generate for 6 months (maximum).
// We pre-emptively refresh 1 hour before true expiry so in-flight calls never race expiry.
const TOKEN_TTL_SECONDS  = 60 * 60 * 24 * 180;  // 180 days (Apple max)
const REFRESH_BUFFER_MS  = 60 * 60 * 1000;      // refresh 1h before expiry

// Module-scoped cache. Shared across requests on the same Vercel instance.
let _cachedToken    = null;
let _cachedExpiryMs = 0;

// ── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Returns a valid Apple MusicKit developer token.
 * Reuses cached token if still valid; regenerates otherwise.
 *
 * @returns {string} JWT suitable for Authorization: Bearer <token>
 * @throws if env vars are missing or key is invalid
 */
export function getAppleDeveloperToken() {
  if (_cachedToken && Date.now() < _cachedExpiryMs - REFRESH_BUFFER_MS) {
    return _cachedToken;
  }
  return _mintNewToken();
}

/** Backwards-compatible alias — keeps existing `import { generateAppleToken }` call sites working. */
export function generateAppleToken() {
  return getAppleDeveloperToken();
}

// ── INTERNAL: MINT A FRESH TOKEN ─────────────────────────────────────────────

function _mintNewToken() {
  const { teamId, keyId, privateKeyPem } = _readEnv();

  // Parse the .p8 into a KeyObject (validates format up-front)
  let keyObject;
  try {
    keyObject = createPrivateKey({ key: privateKeyPem, format: 'pem' });
  } catch (err) {
    throw new Error(
      `[apple-token] Failed to parse APPLE_PRIVATE_KEY as PEM: ${err.message}. ` +
      'Ensure the env var contains the full .p8 file contents including ' +
      '"-----BEGIN PRIVATE KEY-----" and "-----END PRIVATE KEY-----" lines.'
    );
  }

  // Sanity-check: MusicKit keys must be EC P-256
  const { asymmetricKeyType } = keyObject;
  if (asymmetricKeyType !== 'ec') {
    throw new Error(
      `[apple-token] Private key is not EC (got type="${asymmetricKeyType}"). ` +
      'MusicKit requires an EC P-256 key — confirm the key has MusicKit enabled in Apple Developer.'
    );
  }

  // Build JWT
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + TOKEN_TTL_SECONDS;

  const header  = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: teamId, iat: nowSec, exp: expSec };

  const headerB64  = _base64UrlEncode(JSON.stringify(header));
  const payloadB64 = _base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Sign with ES256 (P-256 + SHA-256). Node emits DER-encoded signature.
  // JWT requires raw r||s concatenation — convert.
  let rawSig;
  try {
    const signer = createSign('SHA256');
    signer.update(signingInput);
    signer.end();
    const derSig = signer.sign(keyObject);
    rawSig = _derToJose(derSig, 32); // 32 bytes each for r and s on P-256
  } catch (err) {
    throw new Error(
      `[apple-token] Signing failed: ${err.message}. ` +
      'This usually means the key is not a MusicKit key or the .p8 content is corrupted.'
    );
  }

  const signatureB64 = _bufferToBase64Url(rawSig);
  const token = `${signingInput}.${signatureB64}`;

  _cachedToken    = token;
  _cachedExpiryMs = expSec * 1000;

  return token;
}

// ── INTERNAL: ENV VAR READING + NORMALIZATION ────────────────────────────────

function _readEnv() {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId  = process.env.APPLE_KEY_ID;
  let   raw    = process.env.APPLE_PRIVATE_KEY;

  const missing = [];
  if (!teamId) missing.push('APPLE_TEAM_ID');
  if (!keyId)  missing.push('APPLE_KEY_ID');
  if (!raw)    missing.push('APPLE_PRIVATE_KEY');
  if (missing.length) {
    throw new Error(`[apple-token] Missing env vars: ${missing.join(', ')}`);
  }

  // Normalize private key:
  //   1) Strip surrounding quotes if pasted as JSON string
  //   2) Replace literal "\n" with real newlines (Vercel sometimes stores them this way)
  //   3) Ensure PEM framing; if raw base64 was pasted, wrap it
  //   4) Normalize CRLF → LF
  let pem = raw.trim();
  if ((pem.startsWith('"') && pem.endsWith('"')) || (pem.startsWith("'") && pem.endsWith("'"))) {
    pem = pem.slice(1, -1);
  }
  if (pem.includes('\\n')) {
    pem = pem.replace(/\\n/g, '\n');
  }
  if (!pem.includes('-----BEGIN PRIVATE KEY-----')) {
    const body = pem.replace(/\s+/g, '');
    const wrapped = body.match(/.{1,64}/g)?.join('\n') || body;
    pem = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;
  }
  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!pem.endsWith('\n')) pem += '\n';

  return { teamId, keyId, privateKeyPem: pem };
}

// ── INTERNAL: BASE64URL HELPERS ──────────────────────────────────────────────

function _base64UrlEncode(str) {
  return _bufferToBase64Url(Buffer.from(str, 'utf8'));
}

function _bufferToBase64Url(buf) {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// ── INTERNAL: DER ECDSA → JOSE raw (r||s) ────────────────────────────────────
// Node's createSign('SHA256') with an EC key emits DER-encoded ECDSA signatures.
// JWT ES256 requires the JOSE format: fixed-length r||s concatenation.
// For P-256, r and s are each 32 bytes → total 64 bytes.
function _derToJose(derBuf, componentLength) {
  // DER format:
  //   0x30 <seq-length>
  //     0x02 <r-length> <r-bytes>
  //     0x02 <s-length> <s-bytes>
  let offset = 0;

  if (derBuf[offset++] !== 0x30) {
    throw new Error('[apple-token] Invalid DER: expected SEQUENCE tag');
  }
  // Sequence length (may be short-form or long-form)
  let seqLen = derBuf[offset++];
  if (seqLen & 0x80) {
    const lenBytes = seqLen & 0x7f;
    seqLen = 0;
    for (let i = 0; i < lenBytes; i++) {
      seqLen = (seqLen << 8) | derBuf[offset++];
    }
  }

  // r INTEGER
  if (derBuf[offset++] !== 0x02) {
    throw new Error('[apple-token] Invalid DER: expected INTEGER tag for r');
  }
  const rLen = derBuf[offset++];
  let r = derBuf.slice(offset, offset + rLen);
  offset += rLen;

  // s INTEGER
  if (derBuf[offset++] !== 0x02) {
    throw new Error('[apple-token] Invalid DER: expected INTEGER tag for s');
  }
  const sLen = derBuf[offset++];
  let s = derBuf.slice(offset, offset + sLen);

  // DER INTEGER may have a leading 0x00 to disambiguate sign — strip it
  if (r.length > componentLength && r[0] === 0x00) r = r.slice(r.length - componentLength);
  if (s.length > componentLength && s[0] === 0x00) s = s.slice(s.length - componentLength);

  // Left-pad to fixed component length
  const rPadded = Buffer.concat([Buffer.alloc(componentLength - r.length, 0), r]);
  const sPadded = Buffer.concat([Buffer.alloc(componentLength - s.length, 0), s]);

  return Buffer.concat([rPadded, sPadded]);
}
