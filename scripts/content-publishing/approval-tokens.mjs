// ─────────────────────────────────────────────────────────────────────
//  Content Approval Center™ — Phase 1, Signed Approval Tokens
// ─────────────────────────────────────────────────────────────────────
//
//  Pure crypto only -- no fs, no network, no Supabase. HMAC-SHA256 over a
//  base64url-encoded JSON payload, in the same hand-rolled-signing style
//  as api/apple-token.js's JWT (Node's built-in crypto, no dependency).
//  HMAC (not ES256) is deliberate: the only verifier is this same
//  codebase, so a symmetric secret is simpler and sufficient -- there is
//  no third party that needs a public key.
//
//  The token itself only proves "this exact (requestId, action) pair was
//  legitimately issued and hasn't expired." It does NOT prove single-use
//  on its own -- that's enforced by the caller's atomic
//  "UPDATE content_approval_requests ... WHERE used_at IS NULL" against
//  the requestId, same guard pattern as the existing rate-limit RPC. A
//  verified-but-already-used token must still be rejected by the caller.
//
//  `now`/`nonce` are always caller-supplied, never read internally
//  (matching isEligibleForPublishing's explicit `today` convention) --
//  this makes sign/verify trivially deterministic and testable.
// ─────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function base64UrlDecode(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function hmac(payloadB64, secret) {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

// signToken({requestId, action, expiresAt, nonce}, secret) -> string
// `expiresAt` is an ISO 8601 string. Throws on missing required fields --
// a token issued without every field is a bug, not a runtime condition to
// handle gracefully.
export function signToken({ requestId, action, expiresAt, nonce }, secret) {
  if (!requestId || !action || !expiresAt || !nonce) {
    throw new Error('signToken requires requestId, action, expiresAt, and nonce');
  }
  if (!secret) throw new Error('signToken requires a secret');
  const payloadB64 = base64UrlEncode(JSON.stringify({ requestId, action, expiresAt, nonce }));
  const signature = hmac(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

// verifyToken(token, secret, now) -> { valid, payload?, reason? }
// `reason` is one of 'malformed' | 'invalid_signature' | 'expired' when
// valid is false -- distinct reasons so the audit log (Objective 15's
// security review) can record exactly what kind of attempt this was,
// not just pass/fail.
export function verifyToken(token, secret, now) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' };
  }
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) return { valid: false, reason: 'malformed' };

  const expectedSignature = hmac(payloadB64, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  // timingSafeEqual throws on length mismatch rather than returning false
  // -- an attacker-supplied signature of the wrong length is exactly the
  // "invalid_signature" case, not a crash.
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { valid: false, reason: 'malformed' };
  }
  if (!payload || !payload.requestId || !payload.action || !payload.expiresAt || !payload.nonce) {
    return { valid: false, reason: 'malformed' };
  }
  if (payload.expiresAt <= now) {
    return { valid: false, reason: 'expired', payload };
  }
  return { valid: true, payload };
}

// decodeTokenUnsafe(token) -> {requestId, action, expiresAt, nonce} | null
//
// NEVER use this for an authorization decision -- it does not check the
// signature. Its only legitimate purpose is audit logging: even a
// tampered, forged, or malformed token's claimed requestId is useful
// forensic context (Objective 15's security review wants every attempt
// logged with as much safe detail as possible, not just "something
// failed") -- but the requestId itself is never trusted beyond using it
// to look up the *actual* article from the trusted Supabase row. If the
// base64url payload segment isn't even parseable JSON, returns null --
// there is genuinely nothing safe to report in that case, and callers
// must not fabricate a value.
export function decodeTokenUnsafe(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64] = token.split('.');
  if (!payloadB64) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    return (payload && typeof payload === 'object') ? payload : null;
  } catch {
    return null;
  }
}
