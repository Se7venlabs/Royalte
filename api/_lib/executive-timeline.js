// Executive Timeline™ — ATHENA™ Phase 3B
//
// Produces a chronological, dated list of real events for an artist: the
// monitoring events already captured inside each archived brief's own
// executiveMemorySummary.historicalChanges (Phase 1/2 -- real data, never
// re-derived here), plus one "brief generated" milestone event per archived
// scan. No invented narrative text ("Apple Artist profile corrected" style
// copy is not fabricated) -- only what the archive actually recorded.
//
// Reads exclusively through api/_lib/executive-brief-archive-reader.js.

import { listBriefs } from './executive-brief-archive-reader.js';

export async function buildExecutiveTimeline(supabase, artistProfileId, { from, to, limit = 20 } = {}) {
  const briefs = await listBriefs(supabase, artistProfileId, { from, to, limit, full: true, order: 'asc' });

  if (briefs.length === 0) {
    return { available: false, reason: 'No archived Executive Briefs yet.', events: [] };
  }

  const events = [];

  briefs.forEach((brief) => {
    const eio = brief.executive_intelligence_object || {};
    const changes = (eio.executiveMemorySummary && eio.executiveMemorySummary.historicalChanges) || [];

    changes.forEach((ev) => {
      events.push({
        date: brief.generated_at,
        executiveBriefId: brief.executive_brief_id,
        type: 'monitoring_event',
        severity: ev.severity || 'informational',
        title: ev.title || ev.changeType || 'Change detected',
      });
    });

    events.push({
      date: brief.generated_at,
      executiveBriefId: brief.executive_brief_id,
      type: 'executive_brief_generated',
      overallLevel: (eio.executiveBriefing && eio.executiveBriefing.overallLevel) || null,
      criticalIssueCount: brief.critical_issue_count,
      riskCount: brief.risk_count,
      opportunityCount: brief.opportunity_count,
    });
  });

  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  return { available: true, count: events.length, events };
}
