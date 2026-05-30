// Royaltē — Founding Artist count endpoint (Brief 012a follow-up).
//
// GET /api/founding-artist-count
//
// Public read of the founding_artist_status view (Brief 003 / Block A Chunk 3,
// already GRANT SELECT TO anon). Used by the homepage Section 5 conversion
// card to show "{N} of 1,000 spots claimed".
//
// - No auth.
// - Cached at the edge for 60 s (Cache-Control: public, s-maxage=60).
// - Rate-limited per IP via api/_lib/rate-limit.js — modest caps; the cache
//   layer absorbs repeat reads.
// - Reads the existing atomic counter (profiles.founding_artist, set by the
//   handle_new_user() trigger under pg_advisory_xact_lock). No parallel
//   tracking table — the view is the single source of truth.

import { createClient } from '@supabase/supabase-js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    // ── Anti-abuse: blocked-IP check + per-IP rate limit ──
    const clientIp = extractIp(req);
    const blocked = await checkBlocked(clientIp);
    if (blocked.blocked) {
      const retryAfter = Math.max(1, Math.ceil((new Date(blocked.expiresAt).getTime() - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: 'blocked', retryAfter });
    }
    const limit = await checkRateLimit(clientIp, 'founding-artist-count', {
      burst: { max: 5 },
      hour:  { max: 60 },
      day:   { max: 300 },
    });
    if (!limit.allowed) {
      await recordViolation(clientIp, 'founding-artist-count', limit.reason);
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: limit.reason, retryAfter: limit.retryAfter });
    }

    // ── Read the public.founding_artist_status view ──
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[founding-artist-count] Supabase env not configured');
      return res.status(500).json({ error: 'supabase_not_configured' });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase
      .from('founding_artist_status')
      .select('claimed, cap, spots_available')
      .single();
    if (error) {
      console.error('[founding-artist-count] view query failed:', error.message);
      return res.status(500).json({ error: 'count_query_failed' });
    }

    const count  = typeof data?.claimed === 'number' ? data.claimed : 0;
    const cap    = typeof data?.cap === 'number' ? data.cap : 1000;
    const closed = data ? !data.spots_available : false;

    // 60 s edge cache — the underlying count rarely changes within a minute,
    // and homepage refreshes shouldn't hammer the DB.
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    return res.status(200).json({ count, cap, closed });
  } catch (err) {
    console.error('[founding-artist-count] unexpected error:', err);
    return res.status(500).json({ error: 'unexpected' });
  }
}
