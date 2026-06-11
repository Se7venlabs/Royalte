// ─────────────────────────────────────────────────────────────────────
//  Royaltē Health Engine™ — Schema definitions (Phase 7)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No execution logic. No I/O. No mutation.
//  The engine lives at api/_lib/health-engine.js.
//
//  Exports:
//    HEALTH_VERSION       semantic version of the health report shape
//    CATEGORY_WEIGHTS     Board-locked weighting (sums to 1.0)
//    GRADE_THRESHOLDS     Board-locked grade bands
//    emptyHealthReport()  blank health report shell; the engine
//                         populates every field and deep-freezes
//                         before return
// ─────────────────────────────────────────────────────────────────────

export const HEALTH_VERSION = '1.0.0';

export const CATEGORY_WEIGHTS = Object.freeze({
  identity:   0.20,
  publishing: 0.25,
  catalog:    0.20,
  metadata:   0.15,
  coverage:   0.10,
  confidence: 0.10,
});

export const GRADE_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 98, max: 100, grade: 'A+', label: 'World Class' }),
  Object.freeze({ min: 95, max: 97,  grade: 'A',  label: 'Excellent' }),
  Object.freeze({ min: 90, max: 94,  grade: 'B',  label: 'Strong' }),
  Object.freeze({ min: 80, max: 89,  grade: 'C',  label: 'Good' }),
  Object.freeze({ min: 70, max: 79,  grade: 'D',  label: 'Needs Improvement' }),
  Object.freeze({ min: 0,  max: 69,  grade: 'F',  label: 'Critical' }),
]);

export function emptyHealthReport() {
  return {
    healthVersion:       HEALTH_VERSION,
    generatedAt:         '',
    overallScore:        0,
    overallGrade:        '',
    identityScore:       0,
    publishingScore:     0,
    catalogScore:        0,
    metadataScore:       0,
    coverageScore:       0,
    confidenceScore:     0,
    strengthCount:       0,
    riskCount:           0,
    opportunityCount:    0,
    recommendationCount: 0,
    categoryBreakdown:   [],
    summary:             '',
    reserved: {
      monitoring: null,
      revenue:    null,
    },
  };
}
