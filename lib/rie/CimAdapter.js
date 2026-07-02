// RIE Layer 2 — CIM Adapter
// MIGRATION INFRASTRUCTURE — REMOVE AFTER PRODUCT MIGRATION
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board Authorization: Phase 3.1 (2026-07-01)
// Board Directive: One Health Engine (2026-07-02)
//
// ─────────────────────────────────────────────────────────────────────────────
// BOARD DIRECTIVE (Phase 3.1):
//
//   CimAdapter is MIGRATION INFRASTRUCTURE — REMOVE AFTER PRODUCT MIGRATION.
//   It is NOT part of the permanent Royaltē Operating System.
//
//   It MUST NOT:
//     • compute intelligence
//     • normalize intelligence
//     • reconcile providers
//     • re-interpret CIM fields
//     • become business logic
//     • become a permanent dependency
//
//   It performs BACKWARD-COMPATIBILITY MAPPING ONLY:
//     Certified Canonical Intelligence Model (CIM)
//       → canonical AuditResponse enrichment fields
//         (for consumers that have not yet migrated to CIM-native reads)
//
//   As future phases migrate consumers to read from the CIM directly,
//   CimAdapter shall be reduced and ultimately removed.
//   No future intelligence functionality may depend upon CimAdapter.
//
// ─────────────────────────────────────────────────────────────────────────────
//
// Intelligence source of truth after One Health Engine directive:
//
//   canonical.cim                    — the authoritative CIM (Phase 3.2+ reads from here)
//   canonical.health                 — OVERWRITTEN from cim.health (V2 retired; CIM authoritative)
//   canonical.identityIntelligence   === cim.identity
//   canonical.publishingIntelligence === cim.publishing
//   canonical.catalogIntelligence    === cim.catalog
//   canonical.globalMusicFootprint   === cim.globalFootprint
//   canonical.backendIntelligence    === cim.verification
//   canonical.royalteAI              === cim.aiInsight
//   canonical.healthScore            derived from cim.health (backward-compat for PDF renderer)
//   canonical.healthReport           === cim.health.report
//   canonical.healthIntelligence     derived from cim.health (backward-compat for MC)
//   canonical.executiveBrief         === cim.brief
//
// Migration target: Phase 3.2 (Mission Control) reads from cim directly.

/**
 * Map a Certified Canonical Intelligence Model to the canonical AuditResponse
 * enrichment fields for backward-compatible consumers.
 *
 * STRUCTURAL MAPPING ONLY. No intelligence computed here.
 * Never throws — invalid or null CIM produces a safe baseline enrichment.
 *
 * @param {object} cim  — frozen, certified CIM from runRIE()
 * @param {object} baseCanonical — canonical AuditResponse (from normalizeAuditResponse)
 * @returns {object} baseCanonical enriched with CIM-sourced intelligence fields + cim itself
 */
export function buildCimEnrichment(cim, baseCanonical) {
  if (!cim || typeof cim !== 'object') {
    return { ...baseCanonical };
  }

  const h = cim.health ?? null;

  // ── canonical.health — OVERWRITTEN from cim.health (V2 health engine retired) ──
  // grade uses the status vocabulary ('Excellent'/'Strong'/'Moderate'/'Needs Review')
  // for schema + GRADE_TO_CLASS backward compatibility. Letter grade is in cim.health.grade.
  // drivers sourced from the health report (rule-based risk/strength titles).
  const canonicalHealth = h ? {
    score:   h.score  ?? null,
    grade:   h.status ?? null,   // status vocab as grade label (schema compat)
    status:  h.status ?? null,
    drivers: h.report?.drivers ?? [],
  } : null;

  // ── healthScore — backward-compat for render-audit-pdf.js ──
  // Reconstructs the Phase 7 health report shape expected by the PDF renderer.
  // categoryBreakdown → individual category scores via lookup.
  const breakdown = Array.isArray(h?.categoryBreakdown) ? h.categoryBreakdown : [];
  const catScore  = (cat) => breakdown.find((b) => b.category === cat)?.score ?? 0;
  const healthScore = h ? {
    overallScore:    h.score          ?? null,
    overallGrade:    h.grade          ?? null,   // letter grade (A+/A/B/C/D/F)
    summary:         h.summary        ?? '',
    generatedAt:     h.report?.generatedAt ?? '',
    identityScore:   catScore('identity'),
    publishingScore: catScore('publishing'),
    catalogScore:    catScore('catalog'),
    metadataScore:   catScore('metadata'),
    coverageScore:   catScore('coverage'),
    confidenceScore: catScore('confidence'),
    categoryBreakdown: breakdown,
  } : null;

  // ── healthIntelligence — backward-compat for Mission Control ──
  // Carries full domain display scores, concerns, and strengths for MC health card.
  const healthIntelligence = h ? {
    score:          h.score          ?? null,
    status:         h.status         ?? null,
    grade:          h.grade          ?? null,
    confidence:     h.confidence     ?? null,
    concerns:       h.concerns       ?? [],
    strengths:      h.strengths      ?? [],
    identityScore:  h.identityScore  ?? null,
    publishingScore:h.publishingScore ?? null,
    catalogScore:   h.catalogScore   ?? null,
    footprintScore: h.footprintScore ?? null,
    backendScore:   h.backendScore   ?? null,
    monitoringScore:h.monitoringScore ?? null,
  } : null;

  return {
    ...baseCanonical,
    // ── constitutional health: CIM-authoritative, V2 retired ──────────────
    health: canonicalHealth,
    // ── Intelligence fields sourced from CIM (one source, no duplication) ──
    identityIntelligence:   cim.identity       ?? null,
    publishingIntelligence: cim.publishing      ?? null,
    catalogIntelligence:    cim.catalog         ?? null,
    globalMusicFootprint:   cim.globalFootprint ?? null,
    backendIntelligence:    cim.verification    ?? null,
    royalteAI:              cim.aiInsight       ?? null,
    // ── Health objects derived from cim.health ────────────────────────────
    healthScore,
    healthReport:      h?.report ?? null,
    healthIntelligence,
    // ── Executive Brief — full brief object (cim.brief, see assembleCIM) ──
    executiveBrief:    cim.brief ?? null,
    // ── CIM itself — authoritative source for Phase 3.2+ consumers ────────
    cim,
  };
}
