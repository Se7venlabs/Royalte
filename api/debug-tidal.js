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

  // Step 2 — Try BOTH known Tidal search endpoint formats (Tidal has shipped two)
  // Format A: /v2/searchresults/{query}?countryCode=X (JSON:API v2, documented)
  // Format B: /v2/search?query={term}&types=ARTISTS&countryCode=X (alternate)
  const searchQuery = 'drake';

  result.tidal_api_tests = [];

  // Test A — searchresults path
  try {
    const urlA = `${TIDAL_API_BASE}/searchresults/${encodeURIComponent(searchQuery)}?countryCode=US&include=artists`;
    const t0 = Date.now();
    const respA = await fetch(urlA, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept':        'application/vnd.tidal.v1+json',
        'Content-Type':  'application/vnd.tidal.v1+json',
      },
    });
    const textA = await respA.text();
    let bodyA = textA;
    try { bodyA = JSON.parse(textA); } catch (_) {}
    result.tidal_api_tests.push({
      label: 'A: /searchresults/{query}',
      url: urlA,
      http_status: respA.status,
      latency_ms: Date.now() - t0,
      content_type: respA.headers.get('content-type'),
      response_body: typeof bodyA === 'string' && bodyA.length > 500 ? bodyA.substring(0, 500) + '...' : bodyA,
    });
  } catch (err) {
    result.tidal_api_tests.push({ label: 'A: /searchresults/{query}', error: err.message });
  }

  // Test B — /search path with query param
  try {
    const urlB = `${TIDAL_API_BASE}/search?query=${encodeURIComponent(searchQuery)}&countryCode=US&include=artists&type=ARTISTS`;
    const t0 = Date.now();
    const respB = await fetch(urlB, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept':        'application/vnd.tidal.v1+json',
        'Content-Type':  'application/vnd.tidal.v1+json',
      },
    });
    const textB = await respB.text();
    let bodyB = textB;
    try { bodyB = JSON.parse(textB); } catch (_) {}
    result.tidal_api_tests.push({
      label: 'B: /search?query=...',
      url: urlB,
      http_status: respB.status,
      latency_ms: Date.now() - t0,
      content_type: respB.headers.get('content-type'),
      response_body: typeof bodyB === 'string' && bodyB.length > 500 ? bodyB.substring(0, 500) + '...' : bodyB,
    });
  } catch (err) {
    result.tidal_api_tests.push({ label: 'B: /search?query=...', error: err.message });
  }

  // Test C — known-good endpoint from Tidal quick-start (direct album lookup)
  try {
    const urlC = `${TIDAL_API_BASE}/albums/59727856?countryCode=US`;
    const t0 = Date.now();
    const respC = await fetch(urlC, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'accept':        'application/vnd.tidal.v1+json',
        'Content-Type':  'application/vnd.tidal.v1+json',
      },
    });
    const textC = await respC.text();
    let bodyC = textC;
    try { bodyC = JSON.parse(textC); } catch (_) {}
    result.tidal_api_tests.push({
      label: 'C: /albums/59727856 (known-good from docs)',
      url: urlC,
      http_status: respC.status,
      latency_ms: Date.now() - t0,
      content_type: respC.headers.get('content-type'),
      response_body: typeof bodyC === 'string' && bodyC.length > 500 ? bodyC.substring(0, 500) + '...' : bodyC,
    });
  } catch (err) {
    result.tidal_api_tests.push({ label: 'C: /albums/59727856', error: err.message });
  }

  return res.status(200).json(result);
}
