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
import { compareDomain, DOMAIN_FINGERPRINTS, COMPARISON_STATES } from './canonical-domain-fingerprints.js';

// Phase 3D — Cross-Scan Intelligence™. Extends the risk/opportunity-count
// diff above with real per-field domain comparisons, sourced from the two
// scans' own audit_scans.payload rows (never from the archive's jsonb
// snapshot, which only records each domain's request status -- see
// canonical-domain-fingerprints.js's header for why). AI Insights™ and
// Executive Overview™ are not in DOMAIN_FINGERPRINTS -- they compare
// ATHENA's own overallLevel/riskLevel/counts, already computed below from
// the archive rows themselves.
function compareAiInsightsAndOverview(before, after) {
  const eioBefore = before.executive_intelligence_object || {};
  const eioAfter  = after.executive_intelligence_object  || {};
  const briefingBefore = eioBefore.executiveBriefing || {};
  const briefingAfter  = eioAfter.executiveBriefing  || {};

  function levelState(beforeLevel, afterLevel, order) {
    if (!beforeLevel || !afterLevel) return COMPARISON_STATES.INSUFFICIENT_EVIDENCE;
    if (beforeLevel === afterLevel) return COMPARISON_STATES.UNCHANGED;
    const bi = order.indexOf(beforeLevel), ai = order.indexOf(afterLevel);
    if (bi === -1 || ai === -1) return COMPARISON_STATES.UNKNOWN;
    // order is worst-first (index 0 = most severe); moving to a HIGHER
    // index means less severe, i.e. improved.
    return ai > bi ? COMPARISON_STATES.IMPROVED : COMPARISON_STATES.DECLINED;
  }
  // Worst-to-best per api/athena/types.js RISK_LEVELS / overall level vocabulary.
  const RISK_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
  const OVERALL_ORDER = ['CRITICAL', 'AT_RISK', 'NEEDS_ATTENTION', 'STABLE', 'STRONG'];

  return {
    aiInsights: {
      domain: 'aiInsights',
      state: levelState(briefingBefore.riskLevel, briefingAfter.riskLevel, RISK_ORDER),
      delta: after.risk_count - before.risk_count,
      detail: `ATHENA risk level ${briefingBefore.riskLevel || 'Unknown'} -> ${briefingAfter.riskLevel || 'Unknown'}; ${before.risk_count} -> ${after.risk_count} total risks.`,
    },
    executiveOverview: {
      domain: 'executiveOverview',
      state: levelState(briefingBefore.overallLevel, briefingAfter.overallLevel, OVERALL_ORDER),
      delta: after.opportunity_count - before.opportunity_count,
      detail: `Overall business level ${briefingBefore.overallLevel || 'Unknown'} -> ${briefingAfter.overallLevel || 'Unknown'}.`,
    },
  };
}

function countByDomain(items) {
  const counts = {};
  for (const item of items || []) {
    const d = item.affectedDomain;
    if (!d) continue;
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

// compareExecutiveBriefs(before, after, options) -- before/after are FULL
// archive rows (executive_intelligence_object populated), ordered by the
// caller so `before` is chronologically earlier than `after`.
//
// options.scanPayloads: optional { before: {payload, schemaVersion}, after: {payload, schemaVersion} }
// -- the two real audit_scans rows for these briefs' scan_id. When present,
// adds Phase 3D's canonicalDomains: real per-field comparisons across all 10
// canonical domains (Identity/Publishing/Catalog/Health/Backend/Media/Global
// Music Footprint/Monitoring/AI Insights/Executive Overview), the Board's
// 8-state vocabulary (canonical-domain-fingerprints.js). When absent, this
// function's original risk/opportunity-count `domains` output is unchanged
// -- backward compatible with every existing caller.
export function compareExecutiveBriefs(before, after, options = {}) {
  if (!before || !after) {
    throw new Error('compareExecutiveBriefs requires two brief rows');
  }
  const { scanPayloads } = options;
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
    canonicalDomains: buildCanonicalDomains(before, after, scanPayloads),
  };
}

// Phase 3D — builds the 10-domain canonicalDomains array. Returns null
// (not an empty array) when scanPayloads wasn't supplied, so callers can
// distinguish "not requested" from "requested but genuinely no domains
// available" -- never silently substitute one meaning for the other.
function buildCanonicalDomains(before, after, scanPayloads) {
  if (!scanPayloads || !scanPayloads.before || !scanPayloads.after) return null;

  const schemaCompatible = !!(scanPayloads.before.schemaVersion) &&
    scanPayloads.before.schemaVersion === scanPayloads.after.schemaVersion;

  const fingerprinted = Object.keys(DOMAIN_FINGERPRINTS).map(domainKey =>
    compareDomain(domainKey, scanPayloads.before.payload, scanPayloads.after.payload, { schemaCompatible })
  );

  const { aiInsights, executiveOverview } = compareAiInsightsAndOverview(before, after);

  return [...fingerprinted, aiInsights, executiveOverview].map(entry => ({
    ...entry,
    label: domainLabel(entry.domain) !== entry.domain ? domainLabel(entry.domain) : CANONICAL_DOMAIN_LABELS[entry.domain] || entry.domain,
  }));
}

const CANONICAL_DOMAIN_LABELS = Object.freeze({
  identity: 'Identity Intelligence™',
  publishing: 'Publishing Intelligence™',
  catalog: 'Catalog Intelligence™',
  health: 'Health Intelligence™',
  backend: 'Backend Intelligence™',
  media: 'Media Intelligence™',
  footprint: 'Global Music Footprint™',
  monitoring: 'Monitoring™',
  aiInsights: 'AI Insights™',
  executiveOverview: 'Executive Overview™',
});
