// Royalte MLC connectivity probe — /api/mlc-test
//
// Phase 1 of the intelligence-wiring sprint. The sole objective is to prove
// Royaltē can reach the MLC Public API with the credentials stored in
// Vercel environment variables. There is intentionally:
//   - no normalization
//   - no business logic
//   - no database write
//   - no UI consumer
//
// The endpoint forwards the raw upstream MLC response inside a thin diagnostic
// wrapper (HTTP status, target URL, content-type, parsed body) so failures are
// self-explanatory: 401 → auth header / key mismatch · 404 → wrong path · 5xx
// → upstream outage · transport error → network/DNS.
//
// Required environment variables (set in Vercel project settings):
//   MLC_API_KEY  — the Public API key (NEVER returned in the response)
//   MLC_API_URL  — base URL for the Public API (no trailing slash needed)
//
// Optional query-string overrides so the founder can probe variations without
// redeploying:
//   ?path=/works/search   — endpoint path appended to MLC_API_URL
//                            (default: /works/search)
//   ?q=Ed Sheeran         — search string (default: Ed Sheeran)
//   ?qparam=query         — name of the search query-string parameter
//                            (default: query)
//
// Example: /api/mlc-test?path=/works&qparam=q&q=James%20Blake

export default async function handler(req, res) {
  const apiKey = process.env.MLC_API_KEY;
  const apiUrl = process.env.MLC_API_URL;

  if (!apiKey || !apiUrl) {
    return res.status(500).json({
      ok: false,
      error: 'mlc_config_missing',
      have: { MLC_API_KEY: !!apiKey, MLC_API_URL: !!apiUrl },
    });
  }

  const path   = (req.query.path   || '/works/search').toString();
  const q      = (req.query.q      || 'Ed Sheeran').toString();
  const qparam = (req.query.qparam || 'query').toString();

  const sep = path.includes('?') ? '&' : '?';
  const target = `${apiUrl.replace(/\/+$/, '')}${path}${sep}${encodeURIComponent(qparam)}=${encodeURIComponent(q)}`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'Royalte/1.0 (mlc-test)',
      },
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
  try { body = JSON.parse(text); } catch { /* keep as text */ }

  return res.status(200).json({
    ok: upstream.ok,
    status: upstream.status,
    statusText: upstream.statusText,
    target,
    contentType: upstream.headers.get('content-type'),
    body,
  });
}
