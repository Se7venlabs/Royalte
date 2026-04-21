// api/debug-tidal.js
// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY diagnostic endpoint for Tidal API authentication.
// Generates a fresh OAuth token via client-credentials, hits Tidal's search
// endpoint, returns full diagnostic info.
//
// 🚨 DELETE THIS FILE ONCE TIDAL SCANS ARE VERIFIED WORKING.
//    Leaving diagnostic endpoints in production is a security concern.
//
// Access gated behind ?secret=${INTERNAL_API_SECRET} query param.
// ─────────────────────────────────────────────────────────────────────────────

import { getTidalAccessToken } from './tidal-token.js';

const TIDAL_API_BASE = 'https://openapi.tidal.com/v2';

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
      TIDAL_CLIENT_ID_set:      !!process.env.TIDAL_CLIENT_ID,
      TIDAL_CLIENT_ID_length:   (process.env.TIDAL_CLIENT_ID || '').length,
      TIDAL_CLIENT_ID_value:    process.env.TIDAL_CLIENT_ID || null,  // public identifier, safe to log
      TIDAL_CLIENT_SECRET_set:  !!process.env.TIDAL_CLIENT_SECRET,
      TIDAL_CLIENT_SECRET_length: (process.env.TIDAL_CLIENT_SECRET || '').length,
    },
  };

  // Step 1 — Get access token
  let token;
  try {
    const t0 = Date.now();
    token = await getTidalAccessToken();
    result.token_fetch = {
      success: true,
      latency_ms: Date.now() - t0,
      token_length: token.length,
      token_preview_first_20: token.substring(0, 20),
    };
  } catch (err) {
    result.token_fetch = {
      success: false,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
    return res.status(200).json(result);
  }

  // Step 2 — Call Tidal search endpoint to verify token works
  const searchQuery = 'drake';
  const searchUrl = `${TIDAL_API_BASE}/searchresults/${encodeURIComponent(searchQuery)}?countryCode=US&include=artists`;
  try {
    const t0 = Date.now();
    const apiResp = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/vnd.tidal.v1+json',
      },
    });
    const latencyMs = Date.now() - t0;

    const respText = await apiResp.text();
    let respBody = respText;
    try { respBody = JSON.parse(respText); } catch (_) {}

    result.tidal_api_call = {
      url: searchUrl,
      http_status: apiResp.status,
      http_status_text: apiResp.statusText,
      latency_ms: latencyMs,
      response_headers: {
        'content-type':       apiResp.headers.get('content-type'),
        'x-ratelimit-remaining': apiResp.headers.get('x-ratelimit-remaining'),
        'x-ratelimit-limit':     apiResp.headers.get('x-ratelimit-limit'),
        'retry-after':           apiResp.headers.get('retry-after'),
      },
      // Truncate response body if huge — Tidal responses can be 50KB+
      response_body: typeof respBody === 'string' && respBody.length > 2000
        ? respBody.substring(0, 2000) + '...[truncated]'
        : respBody,
    };
  } catch (err) {
    result.tidal_api_call = {
      url: searchUrl,
      fetch_error: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    };
  }

  return res.status(200).json(result);
}
