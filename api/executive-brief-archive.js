// GET /api/executive-brief-archive
//
// Executive Brief Archive™ read endpoint — ATHENA™ Phase 3A, refactored in
// Phase 3B to be a thin HTTP wrapper over api/_lib/executive-brief-archive-reader.js,
// the shared data-access layer every Phase 3B service (History™, Timeline™,
// Memory™, Comparison™, Trend Detection) also reads through directly
// server-side — "one canonical history and comparison service," not five.
//
// Always Bearer-authenticated. Every query is scoped to the caller's own
// auth.uid() server-side — this endpoint never accepts an artist/profile id
// from the client. Deliberately a separate file from api/executive-intelligence.js
// (the unauthenticated compute endpoint) so that endpoint can never become
// an unauthenticated archive reader, per explicit Board instruction.
//
// Modes (query params):
//   ?executiveBriefId=EB-...        -- get one brief by its business id
//   ?ids=EB-...,EB-...              -- get exactly two briefs (comparison)
//   ?latest=1                       -- most recent brief
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  -- list within a date range (default mode)
//   ?limit=N                        -- list mode only, default 20, max 100
//   ?full=1                         -- include the full executive_intelligence_object
//                                       (omitted by default to keep list responses cheap)
//
// Read-only. No POST/PATCH/DELETE.

import { createClient } from '@supabase/supabase-js';
import { getBriefById, getLatestBrief, listBriefs, getBriefsForComparison } from './_lib/executive-brief-archive-reader.js';

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = (req.headers['authorization'] || req.headers['Authorization'] || '').trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const q = req.query || {};
  const full = q.full === '1';

  try {
    if (q.executiveBriefId) {
      const brief = await getBriefById(supabase, user.id, q.executiveBriefId, { full });
      if (!brief) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ brief });
    }

    if (q.ids) {
      const ids = String(q.ids).split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length !== 2) {
        return res.status(400).json({ error: 'ids must contain exactly two Executive Brief IDs' });
      }
      const briefs = await getBriefsForComparison(supabase, user.id, ids);
      if (!briefs) return res.status(404).json({ error: 'One or both briefs not found' });
      return res.status(200).json({ briefs });
    }

    if (q.latest === '1') {
      const brief = await getLatestBrief(supabase, user.id, { full });
      if (!brief) return res.status(404).json({ error: 'No archived briefs found' });
      return res.status(200).json({ brief });
    }

    const briefs = await listBriefs(supabase, user.id, { from: q.from, to: q.to, limit: q.limit, full });
    return res.status(200).json({ briefs });
  } catch (err) {
    console.error('[executive-brief-archive] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
