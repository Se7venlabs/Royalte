// Royalte MLC connectivity probe — /api/mlc-test
//
// Phase 1 of the intelligence-wiring sprint. Sole objective: prove Royaltē
// can authenticate against the MLC Public Search API and receive valid
// musical-work JSON.
//
//   no normalization · no business logic · no DB write · no UI consumer
//
// ─── Implemented strictly from the official MLC OpenAPI specification ───
//   Spec UI:    https://public-api.themlc.com/api/doc
//   Base URL:   https://public-api.themlc.com/
//   Auth:       HTTP Bearer, security scheme `bearerAuth`,
//               bearerFormat: JWT
//               → Authorization: Bearer ${MLC_API_KEY}
//   Endpoint:   POST /search/songcode  (requires bearerAuth)
//   Request:    { "title": <string> }
//   Response:   array of { iswc, mlcSongCode, workTitle, writers[...] }
//
// Why /search/songcode for the probe:
//   - It is bearer-protected, so a 200 proves authentication actually works
//     (vs an open endpoint where a malformed token would still succeed).
//   - It returns `writers` which include the artist's name for any
//     well-known title, satisfying the Board's "known artist returned"
//     success criterion.
//   - Searching `"Shape of You"` is guaranteed to surface Ed Sheeran in
//     the writers array (along with co-writers Steve Mac and Johnny
//     McDaid). For `?title=Retrograde` James Blake will surface similarly.
//
// Required env (already configured in Vercel by the CEO):
//   MLC_API_KEY  — JWT bearer token issued by MLC
//   MLC_API_URL  — optional; defaults to the documented base URL if unset
//
// Optional query-string override for follow-up probes:
//   ?title=<song title>   — search title (default: "Shape of You")

const MLC_BASE_URL_DEFAULT = 'https://public-api.themlc.com';
const MLC_SEARCH_PATH      = '/search/songcode';
const DEFAULT_TITLE        = 'Shape of You';

export default async function handler(req, res) {
  const apiKey = process.env.MLC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'mlc_config_missing',
      have: { MLC_API_KEY: false },
    });
  }

  const baseUrl = (process.env.MLC_API_URL || MLC_BASE_URL_DEFAULT).replace(/\/+$/, '');
  const target  = `${baseUrl}${MLC_SEARCH_PATH}`;
  const title   = (req.query.title || DEFAULT_TITLE).toString();
  const requestBody = { title };

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'User-Agent':    'Royalte/1.0 (mlc-test)',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    return res.status(502).json({
      ok: false,
      error: 'fetch_failed',
      message: e?.message || String(e),
      target,
    });
  }

  const text = await upstream.text();
  let body = text;
  try { body = JSON.parse(text); } catch { /* leave as text */ }

  return res.status(200).json({
    ok:           upstream.ok,
    status:       upstream.status,
    statusText:   upstream.statusText,
    target,
    method:       'POST',
    authScheme:   'Bearer (JWT) — Authorization: Bearer ${MLC_API_KEY}',
    requestBody,
    contentType:  upstream.headers.get('content-type'),
    body,
  });
}
