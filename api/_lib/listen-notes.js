// ─────────────────────────────────────────────────────────────────────────
// Listen Notes API client — Podcast Intelligence (Brief 015o Phase 1).
//
// Server-side only. The API key (LISTEN_NOTES_API_KEY) lives in Vercel
// env vars and never leaves the server. Public/free scan paths must
// NOT import this module — Podcast Intelligence is a monitoring-plan
// capability per the founder spec.
//
// External consumers (api/_lib/podcast-intelligence.js) translate the
// returned shape into Royaltē outcome events. The Listen Notes brand
// name must never appear in any artist-facing surface (Mission Control,
// alerts, PDF reports). See [[project-royalte-mc-freeze]] memory rule
// "do not expose source platform names."
// ─────────────────────────────────────────────────────────────────────────

const LISTEN_NOTES_BASE = 'https://listen-api.listennotes.com/api/v2';

/**
 * Search Listen Notes for episodes that mention the artist by name.
 * Returns a normalized shape that downstream code can persist directly.
 *
 * Availability values mirror the canonical AUDIT_RESPONSE pattern
 * (api/schema/auditResponse.js): VERIFIED / NOT_FOUND / AUTH_UNAVAILABLE
 * / ERROR — so the caller can distinguish "key missing" (operational
 * issue) from "no results" (genuine empty) without misclassifying
 * the artist's coverage.
 *
 * @param {string} artistName
 * @returns {Promise<{availability: string, episodes: Array, error?: string}>}
 */
export async function searchEpisodesByArtist(artistName) {
  const apiKey = process.env.LISTEN_NOTES_API_KEY;
  if (!apiKey) {
    console.warn('[listen-notes] LISTEN_NOTES_API_KEY not set — skipping podcast search');
    return { availability: 'AUTH_UNAVAILABLE', episodes: [] };
  }
  if (!artistName || typeof artistName !== 'string') {
    return { availability: 'NOT_FOUND', episodes: [] };
  }

  try {
    const q = encodeURIComponent(artistName.trim());
    const url = `${LISTEN_NOTES_BASE}/search?q=${q}&type=episode&safe_mode=0&sort_by_date=1`;
    const res = await fetch(url, {
      headers: { 'X-ListenAPI-Key': apiKey },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[listen-notes] search failed ${res.status}: ${text.slice(0, 200)}`);
      return { availability: 'ERROR', episodes: [], error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    // Normalize. We intentionally drop fields we don't need (Listen
    // Notes returns listen_score, explicit_content, audio length, etc.)
    // — Royaltē does not surface them, so storing them would be both
    // wasteful and a leak surface.
    const episodes = results.map((r) => ({
      episodeId:          r.id || null,
      podcastId:          r.podcast?.id || null,
      episodeTitle:       _clean(r.title_original || r.title_highlighted || r.title || ''),
      episodeUrl:         r.link || r.audio || null,
      podcastName:        _clean(r.podcast?.title_original || r.podcast?.title_highlighted || r.podcast?.title || ''),
      podcastUrl:         r.podcast?.listennotes_url || null,
      publishDate:        r.pub_date_ms ? new Date(r.pub_date_ms).toISOString() : null,
      descriptionSnippet: _clean(r.description_original || r.description_highlighted || r.description || '').slice(0, 500),
    })).filter((e) => !!e.episodeId);

    return { availability: 'VERIFIED', episodes };
  } catch (err) {
    console.error('[listen-notes] error:', err.message);
    return { availability: 'ERROR', episodes: [], error: err.message };
  }
}

// Listen Notes returns descriptions with HTML tags + `<em class="ln-search-highlight">`
// wrappers around matched terms. Strip both so what we persist is plain text.
function _clean(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
