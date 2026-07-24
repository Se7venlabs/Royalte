// Shared domain-label mapping — ATHENA™ Phase 3B.
//
// Same mapping used client-side in public/workspaces/ai-insights.html's
// Executive Source Attribution™ (Phase 2). Centralized here so Comparison™,
// Trend Detection, and Timeline™ don't each maintain their own copy —
// "no layer duplicates another."
//
// Keys are ATHENA risk/opportunity `affectedDomain` values (api/athena/risk-analysis.js,
// opportunities.js): identity, rights, catalog, distribution, monitoring, system_operations.

export const DOMAIN_LABELS = Object.freeze({
  identity: 'Identity Intelligence™',
  rights: 'Publishing Intelligence™',
  catalog: 'Catalog Intelligence™',
  distribution: 'Global Music Footprint™',
  monitoring: 'Monitoring Intelligence™',
  system_operations: 'Platform Operations',
});

export function domainLabel(domain) {
  return DOMAIN_LABELS[domain] || domain;
}
