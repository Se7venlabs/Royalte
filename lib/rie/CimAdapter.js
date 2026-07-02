// RIE Layer 2 — CIM Adapter
// MIGRATION INFRASTRUCTURE — REMOVE AFTER PRODUCT MIGRATION
//
// Constitutional authority: Royaltē Master Constitution v1.3 §8
// Board Authorization: Phase 3.1 (2026-07-01)
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
// Intelligence source of truth after Phase 3.1:
//
//   canonical.cim                    — the authoritative CIM (Phase 3.2+ reads from here)
//   canonical.identityIntelligence   === cim.identity
//   canonical.publishingIntelligence === cim.publishing
//   canonical.catalogIntelligence    === cim.catalog
//   canonical.globalMusicFootprint   === cim.globalFootprint
//   canonical.backendIntelligence    === cim.verification
//   canonical.royalteAI              === cim.aiInsight
//   canonical.healthScore            derived from cim.health
//   canonical.healthReport           === cim.health.report
//   canonical.executiveBrief         === cim.brief
//   canonical.healthIntelligence     derived from cim.health
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

  const health = cim.health ?? null;

  // Legacy split-shape derived from the unified CIM health object.
  // healthScore: the authoritative numeric score + grade + category breakdown.
  const healthScore = health ? {
    overallScore:   health.score          ?? null,
    overallGrade:   health.grade          ?? null,
    categoryScores: health.categoryScores ?? null,
  } : null;

  // healthIntelligence: the interpretation layer over the score.
  const healthIntelligence = health ? {
    score:   health.score   ?? null,
    status:  health.status  ?? null,
    grade:   health.grade   ?? null,
    drivers: health.drivers ?? null,
  } : null;

  return {
    ...baseCanonical,
    // ── Intelligence fields sourced from CIM (one source, no duplication) ──
    identityIntelligence:   cim.identity        ?? null,
    publishingIntelligence: cim.publishing       ?? null,
    catalogIntelligence:    cim.catalog          ?? null,
    globalMusicFootprint:   cim.globalFootprint  ?? null,
    backendIntelligence:    cim.verification     ?? null,
    royalteAI:              cim.aiInsight        ?? null,
    // ── Health objects reconstructed from unified cim.health ──
    healthScore,
    healthReport:      health?.report ?? null,
    healthIntelligence,
    // ── Executive Brief — full brief object (cim.brief, see assembleCIM) ──
    executiveBrief:    cim.brief ?? null,
    // ── CIM itself — authoritative source for Phase 3.2+ consumers ──
    cim,
  };
}
