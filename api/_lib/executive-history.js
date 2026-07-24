// Executive Intelligence History™ — ATHENA™ Phase 3B
//
// The named service the Board's Phase 3B priority list puts first. Reads
// exclusively through api/_lib/executive-brief-archive-reader.js's
// listBriefs() -- this module adds no new data access, only a stable,
// named entrypoint other Phase 3B services and the authenticated History
// API build on, so "which function reads the archive for a history view"
// has exactly one answer.

import { listBriefs } from './executive-brief-archive-reader.js';

export async function getExecutiveHistory(supabase, artistProfileId, { from, to, limit, full = false, order = 'desc' } = {}) {
  const briefs = await listBriefs(supabase, artistProfileId, { from, to, limit, full, order });
  return {
    available: briefs.length > 0,
    count: briefs.length,
    briefs,
  };
}
