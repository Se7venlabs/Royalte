// Executive Brief Archive™ capability — ATHENA™ Phase 3E Capability Registry™
//
// Read-only consumer of the archive, passed in via rawInputs.latestBrief /
// rawInputs.briefCount (fetched by the caller through
// api/_lib/executive-brief-archive-reader.js -- this capability never
// queries Supabase directly, matching "one canonical data-access layer").

import { registerCapability } from './registry.js';

function buildContext(rawInputs) {
  const brief = rawInputs.latestBrief || null;
  if (!brief) {
    return { available: false, summary: 'No archived Executive Brief yet.', data: null };
  }
  const briefing = (brief.executive_intelligence_object && brief.executive_intelligence_object.executiveBriefing) || {};
  return {
    available: true,
    summary: `Latest Executive Brief (${brief.executive_brief_id}): overall level ${briefing.overallLevel || 'Unknown'}, risk level ${briefing.riskLevel || 'Unknown'}, ${brief.risk_count ?? 0} risk(s), ${brief.opportunity_count ?? 0} opportunity(ies).`,
    data: { brief, briefCount: rawInputs.briefCount || 0 },
  };
}

registerCapability({
  name: 'executiveBriefArchive',
  advertiseAvailability(rawInputs) { return buildContext(rawInputs).available; },
  buildContext,
  provideEvidence(rawInputs) {
    const ctx = buildContext(rawInputs);
    if (!ctx.available) return [];
    return [{ fact: ctx.summary, sourceType: 'Executive Brief', sourceId: rawInputs.latestBrief.executive_brief_id }];
  },
  provideConfidence(rawInputs) {
    return buildContext(rawInputs).available ? 'HIGH' : 'INSUFFICIENT_DATA';
  },
  provideCitations(rawInputs) {
    if (!buildContext(rawInputs).available) return [];
    return [{ label: 'Executive Brief™', workspace: '/workspaces/ai-insights.html' }];
  },
});
