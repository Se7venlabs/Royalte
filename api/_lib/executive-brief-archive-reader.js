// Executive Brief Archive™ Reader — ATHENA™ Phase 3B
//
// The one canonical data-access layer over public.executive_brief_archive.
// Extracted from api/executive-brief-archive.js (Phase 3A) so every Phase 3B
// service (Executive History™, Timeline™, Memory™, Comparison™, Trend
// Detection) reads through these same functions rather than each writing its
// own Supabase query — per the Board's explicit "one canonical history and
// comparison service" instruction.
//
// Every function requires an already-resolved artistProfileId (the caller's
// own auth.uid(), resolved from a verified Bearer token) and scopes its query
// to it explicitly — this module never trusts or accepts an artist id from
// request input. RLS (owner-only SELECT) is defense-in-depth underneath this;
// this explicit scoping is the primary control, matching the Phase 3A
// architecture note's stated model.
//
// Pure data access. No presentation formatting, no interpretation (trend
// classification, diffing, narrative) — that belongs to the service layer
// that calls these functions (executive-history.js, executive-comparison.js,
// executive-trend-detection.js, executive-timeline.js, executive-memory.js).

const TABLE = 'executive_brief_archive';

const SUMMARY_COLUMNS =
  'id, executive_brief_id, artist_profile_id, scan_id, generated_at, ' +
  'executive_version, schema_version, pipeline_version, athena_version, runtime_context_version, ' +
  'confidence_level, critical_issue_count, risk_count, opportunity_count, recommendation_count, ' +
  'archive_status, archive_integrity_hash, comparison_group_id, created_at';
const FULL_COLUMNS = SUMMARY_COLUMNS + ', executive_intelligence_object';

export async function getBriefById(supabase, artistProfileId, executiveBriefId, { full = false } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(full ? FULL_COLUMNS : SUMMARY_COLUMNS)
    .eq('artist_profile_id', artistProfileId)
    .eq('executive_brief_id', String(executiveBriefId))
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getLatestBrief(supabase, artistProfileId, { full = false } = {}) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(full ? FULL_COLUMNS : SUMMARY_COLUMNS)
    .eq('artist_profile_id', artistProfileId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

// List mode. `order` defaults to newest-first (matches every other list
// surface in this codebase); pass 'asc' for chronological (Timeline™ wants
// oldest-first for its narrative sequence).
export async function listBriefs(supabase, artistProfileId, { from, to, limit = 20, full = false, order = 'desc' } = {}) {
  let query = supabase
    .from(TABLE)
    .select(full ? FULL_COLUMNS : SUMMARY_COLUMNS)
    .eq('artist_profile_id', artistProfileId)
    .order('generated_at', { ascending: order === 'asc' });
  if (from) query = query.gte('generated_at', String(from));
  if (to)   query = query.lte('generated_at', String(to));
  query = query.limit(Math.min(parseInt(limit, 10) || 20, 100));

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Exactly two briefs, always full (comparison needs the EIO content, not
// just summary columns). Returns null if either is missing/not owned by the
// caller — the service layer decides how to surface that (404, etc.), this
// function just refuses to silently return a partial comparison.
export async function getBriefsForComparison(supabase, artistProfileId, ids) {
  if (!Array.isArray(ids) || ids.length !== 2) {
    throw new Error('getBriefsForComparison requires exactly two ids');
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(FULL_COLUMNS)
    .eq('artist_profile_id', artistProfileId)
    .in('executive_brief_id', ids);
  if (error) throw error;
  if (!data || data.length !== 2) return null;
  // Preserve caller-requested order (ids[0], ids[1]) rather than whatever
  // order Postgres returned them in.
  const byId = Object.fromEntries(data.map(row => [row.executive_brief_id, row]));
  return [byId[ids[0]], byId[ids[1]]];
}
