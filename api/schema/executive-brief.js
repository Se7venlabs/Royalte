// ─────────────────────────────────────────────────────────────────────
//  Royaltē Executive Brief Engine™ — Schema definitions (Phase 8)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No execution logic. No I/O. No mutation.
//  The engine lives at api/_lib/executive-brief-engine.js.
//
//  Exports:
//    BRIEF_VERSION             semantic version of the brief shape
//    HEALTH_HEADLINES          Board-locked grade → headline strings
//    RECOMMENDED_NEXT_STEPS    Board-locked category → next-step strings
//    emptyBrief()              blank brief shell; the engine populates
//                              every field and deep-freezes before return
// ─────────────────────────────────────────────────────────────────────

export const BRIEF_VERSION = '1.0.0';

export const HEALTH_HEADLINES = Object.freeze({
  'A+': 'World-Class Backend Infrastructure',
  'A':  'Excellent Backend Infrastructure',
  'B':  'Strong Foundation with Minor Gaps',
  'C':  'Infrastructure Requires Attention',
  'D':  'Significant Infrastructure Gaps',
  'F':  'Critical Infrastructure Deficiencies',
});

export const RECOMMENDED_NEXT_STEPS = Object.freeze({
  publishing: 'Complete Publishing Registration',
  identity:   'Resolve Duplicate Artist Profiles',
  apple:      'Claim Apple Music Artist Profile',
  monitoring: 'Expand Catalog Monitoring',
  metadata:   'Improve Metadata Completeness',
  catalog:    'Audit Catalog Delivery',
  default:    'Schedule Full Backend Review',
});

export function emptyBrief() {
  return {
    briefVersion:        BRIEF_VERSION,
    generatedAt:         '',
    executiveSummary:    '',
    healthHeadline:      '',
    executiveNarrative:  '',
    topStrengths:        [],
    topRisks:            [],
    topOpportunities:    [],
    priorityActions:     [],
    confidenceStatement: '',
    recommendedNextStep: '',
    aiExecutiveInsight:  '',
    reserved: {
      monitoring: null,
      revenue:    null,
    },
  };
}
