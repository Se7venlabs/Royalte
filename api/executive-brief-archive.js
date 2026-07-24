// GET /api/executive-brief-archive
//
// Executive Brief Archive™ read endpoint — ATHENA™ Phase 3A. The one
// canonical history/comparison service Phase 3B's Executive Timeline™,
// Executive Memory™, Cross-Scan Trend Intelligence™, and Executive
// Comparison™ are all meant to read through, rather than each inventing
// their own archive-access logic (governance/ATHENA_PHASE3A_EXECUTIVE_BRIEF_ARCHIVE_ARCHITECTURE.md §4/§10).
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
// Read-only in Phase 3A. No POST/PATCH/DELETE.

import { createClient } from '@supabase/supabase-js';

const SUMMARY_COLUMNS =
  'id, executive_brief_id, artist_profile_id, scan_id, generated_at, ' +
  'executive_version, schema_version, pipeline_version, athena_version, runtime_context_version, ' +
  'confidence_level, critical_issue_count, risk_count, opportunity_count, recommendation_count, ' +
  'archive_status, archive_integrity_hash, comparison_group_id, created_at';
const FULL_COLUMNS = SUMMARY_COLUMNS + ', executive_intelligence_object';

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
  const columns = q.full === '1' ? FULL_COLUMNS : SUMMARY_COLUMNS;

  try {
    if (q.executiveBriefId) {
      const { data, error } = await supabase
        .from('executive_brief_archive')
        .select(columns)
        .eq('artist_profile_id', user.id)
        .eq('executive_brief_id', String(q.executiveBriefId))
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ brief: data });
    }

    if (q.ids) {
      const ids = String(q.ids).split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length !== 2) {
        return res.status(400).json({ error: 'ids must contain exactly two Executive Brief IDs' });
      }
      const { data, error } = await supabase
        .from('executive_brief_archive')
        .select(columns)
        .eq('artist_profile_id', user.id)
        .in('executive_brief_id', ids);
      if (error) throw error;
      if (!data || data.length !== 2) {
        return res.status(404).json({ error: 'One or both briefs not found' });
      }
      return res.status(200).json({ briefs: data });
    }

    if (q.latest === '1') {
      const { data, error } = await supabase
        .from('executive_brief_archive')
        .select(columns)
        .eq('artist_profile_id', user.id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'No archived briefs found' });
      return res.status(200).json({ brief: data });
    }

    // Default: list mode, optionally bounded by a date range.
    let query = supabase
      .from('executive_brief_archive')
      .select(columns)
      .eq('artist_profile_id', user.id)
      .order('generated_at', { ascending: false });
    if (q.from) query = query.gte('generated_at', String(q.from));
    if (q.to)   query = query.lte('generated_at', String(q.to));
    const limit = Math.min(parseInt(q.limit, 10) || 20, 100);
    query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return res.status(200).json({ briefs: data || [] });
  } catch (err) {
    console.error('[executive-brief-archive] read failed:', err?.message || err);
    return res.status(500).json({ error: 'Internal error' });
  }
}
