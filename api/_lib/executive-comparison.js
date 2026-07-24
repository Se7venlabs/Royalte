// Executive Comparison™ — ATHENA™ Phase 3B
//
// Diffs two archived Executive Intelligence Objects field-by-field. Reads
// exclusively through api/_lib/executive-brief-archive-reader.js — never
// queries the archive table directly (consumer, not a second persistence
// layer).
//
// Honesty note: there is no single numeric "Executive Health" score anywhere
// in the Executive Intelligence Object to diff as a composite delta. Health
// scoring belongs exclusively to the real Health Engine™ (a different layer
// entirely — see governance/CANONICAL_EXECUTIVE_ARCHITECTURE.md's Evidence /
// Canonical Intelligence / Executive Intelligence / Presentation separation).
// Inventing a synthetic composite score here would be a second, competing
// scoring formula — exactly what "no layer duplicates another" forbids. This
// comparison reports every real field delta (counts, categorical levels,
// per-domain risk/opportunity movement) instead.

import { domainLabel } from './executive-domain-labels.js';

function countByDomain(items) {
  const counts = {};
  for (const item of items || []) {
    const d = item.affectedDomain;
    if (!d) continue;
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

// compareExecutiveBriefs(before, after) -- both are FULL archive rows
// (executive_intelligence_object populated), ordered by the caller so
// `before` is chronologically earlier than `after`.
export function compareExecutiveBriefs(before, after) {
  if (!before || !after) {
    throw new Error('compareExecutiveBriefs requires two brief rows');
  }
  const eioBefore = before.executive_intelligence_object || {};
  const eioAfter  = after.executive_intelligence_object  || {};

  const riskCountsBefore = countByDomain(eioBefore.risks);
  const riskCountsAfter  = countByDomain(eioAfter.risks);
  const oppCountsBefore  = countByDomain(eioBefore.opportunities);
  const oppCountsAfter   = countByDomain(eioAfter.opportunities);

  const allDomains = new Set([
    ...Object.keys(riskCountsBefore), ...Object.keys(riskCountsAfter),
    ...Object.keys(oppCountsBefore), ...Object.keys(oppCountsAfter),
  ]);

  const domains = [...allDomains].sort().map(domain => ({
    domain,
    label: domainLabel(domain),
    riskCountBefore: riskCountsBefore[domain] || 0,
    riskCountAfter: riskCountsAfter[domain] || 0,
    riskDelta: (riskCountsAfter[domain] || 0) - (riskCountsBefore[domain] || 0),
    opportunityCountBefore: oppCountsBefore[domain] || 0,
    opportunityCountAfter: oppCountsAfter[domain] || 0,
    opportunityDelta: (oppCountsAfter[domain] || 0) - (oppCountsBefore[domain] || 0),
  }));

  return {
    executiveBriefIdBefore: before.executive_brief_id,
    executiveBriefIdAfter: after.executive_brief_id,
    generatedAtBefore: before.generated_at,
    generatedAtAfter: after.generated_at,
    overallLevelBefore: (eioBefore.executiveBriefing && eioBefore.executiveBriefing.overallLevel) || null,
    overallLevelAfter: (eioAfter.executiveBriefing && eioAfter.executiveBriefing.overallLevel) || null,
    riskLevelBefore: (eioBefore.executiveBriefing && eioBefore.executiveBriefing.riskLevel) || null,
    riskLevelAfter: (eioAfter.executiveBriefing && eioAfter.executiveBriefing.riskLevel) || null,
    criticalIssueCountBefore: before.critical_issue_count,
    criticalIssueCountAfter: after.critical_issue_count,
    criticalIssueDelta: after.critical_issue_count - before.critical_issue_count,
    riskCountBefore: before.risk_count,
    riskCountAfter: after.risk_count,
    riskCountDelta: after.risk_count - before.risk_count,
    opportunityCountBefore: before.opportunity_count,
    opportunityCountAfter: after.opportunity_count,
    opportunityCountDelta: after.opportunity_count - before.opportunity_count,
    domains,
  };
}
