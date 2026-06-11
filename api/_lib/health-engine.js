// ----------------------------------------------------
//
// Royaltē Health Engine™
//
// The Health Engine™ is the sole constitutional
// authority for computing Royaltē Health Scores™.
//
// It reasons ONLY over Royaltē Intelligence Reports™.
//
// It never calls providers.
//
// It never mutates intelligence.
//
// It never creates facts.
//
// It scores existing intelligence.
//
// Identical input → identical output. Always.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Phase 7 sole purpose: deterministic projection of a Royaltē
//  Intelligence Report (Phase 6 engine output) into a Royaltē Health
//  Report. Pure function. No I/O. No clock except `intelligenceReport.
//  generatedAt` (inherited verbatim). Output is deep-frozen.
//
//  Constitutional separation:
//    - Knowledge belongs in the Rule Library (Phase 5).
//    - Execution belongs in the Intelligence Engine (Phase 6).
//    - Scoring of executed intelligence belongs HERE (Phase 7).
//    - Presentation belongs in consumers.
//
//  The engine NEVER:
//    - throws on any input (single try/catch wraps the entire body;
//      garbage input returns a structurally-valid empty report).
//    - mutates the input intelligenceReport.
//    - performs I/O. No fetch, no fs, no DB.
//    - contains provider-specific knowledge.
//    - generates new facts. Every score is derived from observations
//      and coverage that the Intelligence Engine already produced.

import {
  HEALTH_VERSION,
  CATEGORY_WEIGHTS,
  GRADE_THRESHOLDS,
  emptyHealthReport,
} from '../schema/health.js';

// ─── Board-locked deduction table (severity → penalty) ─────────────

const SEVERITY_DEDUCTION = Object.freeze({
  CRITICAL: 30,
  HIGH:     20,
  MEDIUM:   10,
  LOW:      5,
  INFO:     2,
});

// ─── Internal helpers ──────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// clampInt — clamp to integer in [0, 100]. Non-numbers become 0.
function clampInt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const x = Math.round(n);
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
}

function safeArray(x) { return Array.isArray(x) ? x : []; }

// Look up a grade band for a 0-100 score. GRADE_THRESHOLDS is ordered
// best→worst; first match wins. Falls back to F only if the score is
// out of range (clampInt ensures this never happens in practice).
function lookupGrade(score) {
  for (const t of GRADE_THRESHOLDS) {
    if (score >= t.min && score <= t.max) return { grade: t.grade, label: t.label };
  }
  return { grade: 'F', label: 'Critical' };
}

// Summary string keyed by grade. Strings are locked verbatim from the
// brief; do not edit without Board direction.
function summaryForGrade(grade) {
  if (grade === 'A+' || grade === 'A') return 'Your music backend is in excellent health.';
  if (grade === 'B')                    return 'Your music backend is in strong shape.';
  if (grade === 'C')                    return 'Your music backend is in good shape with some areas for improvement.';
  if (grade === 'D')                    return 'Your music backend needs attention in several areas.';
  return 'Your music backend requires immediate action.';
}

// Per-category score: start at 100, deduct per observation in category
// by severity, floor at 0.
function categoryScoreFor(observations, categoryName) {
  let score = 100;
  for (const obs of observations) {
    if (!obs || obs.category !== categoryName) continue;
    const ded = SEVERITY_DEDUCTION[obs.severity];
    if (typeof ded === 'number') score -= ded;
  }
  return clampInt(score);
}

// Coverage score: % of coverage entries with status 'POPULATED' × 100.
// Empty coverage array → 50 (neutral) per brief. RESERVED counts in
// the denominator per the literal brief reading ("% of sections" with
// no exclusion clause).
function coverageScoreFor(coverage) {
  if (!Array.isArray(coverage) || coverage.length === 0) return 50;
  let populated = 0;
  let total = 0;
  for (const c of coverage) {
    if (!c || typeof c !== 'object') continue;
    total += 1;
    if (c.status === 'POPULATED') populated += 1;
  }
  if (total === 0) return 50;
  return clampInt((populated / total) * 100);
}

// Confidence score: start at 50, +10 per HIGH-confidence obs (cap 100),
// -5 per UNKNOWN-confidence obs (floor 0).
function confidenceScoreFor(observations) {
  let score = 50;
  for (const obs of observations) {
    if (!obs) continue;
    if (obs.confidence === 'HIGH')    score += 10;
    if (obs.confidence === 'UNKNOWN') score -= 5;
  }
  return clampInt(score);
}

function countObservationsInCategory(observations, categoryName) {
  let n = 0;
  for (const obs of observations) if (obs && obs.category === categoryName) n += 1;
  return n;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * computeHealthScore — score a Royaltē Intelligence Report.
 *
 * Always returns a deeply-frozen, structurally-valid health report.
 * Never throws. Pure: no I/O, no LLM, no randomness, no wall clock.
 * `generatedAt` is inherited verbatim from intelligenceReport when
 * present, so identical input produces identical output.
 */
export function computeHealthScore(intelligenceReport) {
  const report = emptyHealthReport();

  try {
    // Garbage-input guard. null / undefined / non-object / array →
    // return the empty report (already a structurally-valid shape).
    if (intelligenceReport === null
        || intelligenceReport === undefined
        || typeof intelligenceReport !== 'object'
        || Array.isArray(intelligenceReport)) {
      return deepFreeze(report);
    }

    const observations    = safeArray(intelligenceReport.observations);
    const recommendations = safeArray(intelligenceReport.recommendations);
    const risks           = safeArray(intelligenceReport.risks);
    const strengths       = safeArray(intelligenceReport.strengths);
    const opportunities   = safeArray(intelligenceReport.opportunities);
    const coverage        = safeArray(intelligenceReport.coverage);

    report.generatedAt = (typeof intelligenceReport.generatedAt === 'string')
      ? intelligenceReport.generatedAt
      : '';

    // Category scores (deductive)
    const identityScore   = categoryScoreFor(observations, 'IDENTITY');
    const publishingScore = categoryScoreFor(observations, 'PUBLISHING');
    const catalogScore    = categoryScoreFor(observations, 'CATALOG');
    const metadataScore   = categoryScoreFor(observations, 'METADATA');
    const coverageScore   = coverageScoreFor(coverage);
    const confidenceScore = confidenceScoreFor(observations);

    report.identityScore   = identityScore;
    report.publishingScore = publishingScore;
    report.catalogScore    = catalogScore;
    report.metadataScore   = metadataScore;
    report.coverageScore   = coverageScore;
    report.confidenceScore = confidenceScore;

    // Overall weighted score
    const weighted =
        identityScore   * CATEGORY_WEIGHTS.identity
      + publishingScore * CATEGORY_WEIGHTS.publishing
      + catalogScore    * CATEGORY_WEIGHTS.catalog
      + metadataScore   * CATEGORY_WEIGHTS.metadata
      + coverageScore   * CATEGORY_WEIGHTS.coverage
      + confidenceScore * CATEGORY_WEIGHTS.confidence;

    report.overallScore = clampInt(weighted);
    const { grade } = lookupGrade(report.overallScore);
    report.overallGrade = grade;
    report.summary = summaryForGrade(grade);

    // Counts (mirror the intelligence report's derived collections)
    report.strengthCount       = strengths.length;
    report.riskCount           = risks.length;
    report.opportunityCount    = opportunities.length;
    report.recommendationCount = recommendations.length;

    // Per-category breakdown: one row per CATEGORY_WEIGHTS key.
    // Weights sum to 1.0 by construction (asserted in tests).
    report.categoryBreakdown = [
      {
        category:         'identity',
        score:            identityScore,
        weight:           CATEGORY_WEIGHTS.identity,
        observationCount: countObservationsInCategory(observations, 'IDENTITY'),
        grade:            lookupGrade(identityScore).grade,
      },
      {
        category:         'publishing',
        score:            publishingScore,
        weight:           CATEGORY_WEIGHTS.publishing,
        observationCount: countObservationsInCategory(observations, 'PUBLISHING'),
        grade:            lookupGrade(publishingScore).grade,
      },
      {
        category:         'catalog',
        score:            catalogScore,
        weight:           CATEGORY_WEIGHTS.catalog,
        observationCount: countObservationsInCategory(observations, 'CATALOG'),
        grade:            lookupGrade(catalogScore).grade,
      },
      {
        category:         'metadata',
        score:            metadataScore,
        weight:           CATEGORY_WEIGHTS.metadata,
        observationCount: countObservationsInCategory(observations, 'METADATA'),
        grade:            lookupGrade(metadataScore).grade,
      },
      {
        category:         'coverage',
        score:            coverageScore,
        weight:           CATEGORY_WEIGHTS.coverage,
        observationCount: 0,
        grade:            lookupGrade(coverageScore).grade,
      },
      {
        category:         'confidence',
        score:            confidenceScore,
        weight:           CATEGORY_WEIGHTS.confidence,
        observationCount: 0,
        grade:            lookupGrade(confidenceScore).grade,
      },
    ];

    // Reserved sections remain null until future phases populate them.
    // Already set by emptyHealthReport(); no mutation here.
  } catch (_e) {
    // Engine-level failure: return whatever partial state we managed
    // to assemble. The engine never throws to the caller.
  }

  return deepFreeze(report);
}

// Re-export schema constants for consumer convenience.
export { HEALTH_VERSION, CATEGORY_WEIGHTS, GRADE_THRESHOLDS, emptyHealthReport };
