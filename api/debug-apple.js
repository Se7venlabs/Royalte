// api/debug-apple.js
// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY diagnostic endpoint for Apple Music authentication.
// Generates a fresh MusicKit JWT, hits Apple's search endpoint,
// returns everything needed to pinpoint why Apple scans are failing.
//
// 🚨 DELETE THIS FILE ONCE APPLE SCANS ARE WORKING.
//    Keeping a debug endpoint alive in production is a security risk.
//
// Access gated behind ?secret=${INTERNAL_API_SECRET} query param.
// ─────────────────────────────────────────────────────────────────────────────

import { generateAppleToken } from './apple-token.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Gate access — only callers with INTERNAL_API_SECRET can use this
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    return res.status(503).json({
      error: 'INTERNAL_API_SECRET not configured on this environment',
    });
  }
  if (req.query.secret !== expected) {
    return res.status(403).json({ error: 'Forbidden — provide ?secret=<INTERNAL_API_SECRET>' });
  }

  const result = {
    timestamp: new Date().toISOString(),
    env_vars: {
      APPLE_TEAM_ID_set:     !!process.env.APPLE_TEAM_ID,
      APPLE_TEAM_ID_length:  (process.env.APPLE_TEAM_ID || '').length,
      APPLE_KEY_ID_set:      !!process.env.APPLE_KEY_ID,
      APPLE_KEY_ID_value:    process.env.APPLE_KEY_ID || null,   // safe to log — public ID
      APPLE_KEY_ID_length:   (process.env.APPLE_KEY_ID || '').length,
      APPLE_PRIVATE_KEY_set: !!process.env.APPLE_PRIVATE_KEY,
      APPLE_PRIVATE_KEY_length: (process.env.APPLE_PRIVATE_KEY || '').length,
      APPLE_PRIVATE_KEY_has_begin_marker: (process.env.APPLE_PRIVATE_KEY || '').includes('-----BEGIN PRIVATE KEY-----'),
      APPLE_PRIVATE_KEY_has_end_marker:   (process.env.APPLE_PRIVATE_KEY || '').includes('-----END PRIVATE KEY-----'),
      APPLE_PRIVATE_KEY_has_escaped_newlines: (process.env.APPLE_PRIVATE_KEY || '').includes('\\n'),
      APPLE_PRIVATE_KEY_has_real_newlines:    (process.env.APPLE_PRIVATE_KEY || '').includes('\n'),
    },
  };

  // Step 1 — Generate token
  let token;
  try {
    token = generateAppleToken();
    result.token_generation = {
      success: true,
      token_length: token.length,
      token_preview_first_40:  token.substring(0, 40),
      token_preview_last_40:   token.substring(token.length - 40),
      token_parts: token.split('.').length,  // should be 3 for valid JWT
    };

    // Decode header + payload for verification
    try {
      const [headerB64, payloadB64] = token.split('.');
      const header  = JSON.parse(Buffer.from(headerB64,  'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      result.token_decoded = {
        header,
        payload_iss: payload.iss,
        payload_iat: payload.iat,
        payload_exp: payload.exp,
        payload_ttl_seconds: payload.exp - payload.iat,
        payload_expires_in_days: Math.floor((payload.exp - Math.floor(Date.now() / 1000)) / 86400),
      };
    } catch (decodeErr) {
      result.token_decode_error = decodeErr.message;
    }
  } catch (err) {
    result.token_generation = {
      success: false,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
    // Can't proceed without a token
    return res.status(200).json(result);
  }

  // Step 2 — Call Apple Music API directly
  const appleUrl = 'https://api.music.apple.com/v1/catalog/us/search?term=drake&types=artists&limit=1';
  try {
    const t0 = Date.now();
    const appleResp = await fetch(appleUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const latencyMs = Date.now() - t0;

    const respText = await appleResp.text();
    let respBody = respText;
    try { respBody = JSON.parse(respText); } catch (_) {}

    result.apple_api_call = {
      url: appleUrl,
      http_status: appleResp.status,
      http_status_text: appleResp.statusText,
      latency_ms: latencyMs,
      response_headers: {
        'content-type':   appleResp.headers.get('content-type'),
        'apple-try-again-after': appleResp.headers.get('apple-try-again-after'),
        'www-authenticate':      appleResp.headers.get('www-authenticate'),
      },
      response_body: respBody,
    };
  } catch (err) {
    result.apple_api_call = {
      url: appleUrl,
      fetch_error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }

  return res.status(200).json(result);
}
