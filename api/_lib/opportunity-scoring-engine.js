// ----------------------------------------------------
//
// Royaltē Opportunity Scoring Engine™ — Phase 4B
//
// The sole constitutional authority for computing an
// Executive Opportunity Score™.
//
// It reasons ONLY over a Playbook Definition's metrics
// and a Playbook Action's real evidence_confidence.
//
// It never calls providers. It never performs I/O.
// It never mutates its inputs. It never creates facts.
//
// Identical input → identical output. Always.
//
// ----------------------------------------------------
//
// IMPLEMENTATION NOTES (not part of the constitutional header above)
//
// Mirrors api/_lib/health-engine.js's own discipline exactly: pure
// function, no I/O, single computation path, output is a plain frozen
// object. Canonical Ownership™: this file owns the scoring FORMULA only.
// Band assignment (DO_NOW/DO_NEXT/DO_LATER) and Quick Win™ detection are
// separate pure functions here too (same file, since they're small and
// operate on this function's own output) but are logically distinct
// steps — see computeBand()/isQuickWin() below. Ranking multiple actions
// against each other (sorting, tie-breaking) is NOT this file's job —
// that's api/_lib/opportunity-engine.js's orchestration responsibility,
// consuming this file's per-action output.

import {
  SCORE_WEIGHTS,
  QUALITATIVE_BAND_SCORES,
  DIFFICULTY_BAND_SCORES,
  EVIDENCE_CONFIDENCE_BAND_SCORES,
  ESTIMATED_TIME_BUCKETS,
  BAND_THRESHOLDS,
  QUICK_WIN_CRITERIA,
} from '../schema/opportunity.js';

function qualitativeScore(value) {
  return QUALITATIVE_BAND_SCORES[value] ?? 0;
}

function difficultyScore(value) {
  return DIFFICULTY_BAND_SCORES[value] ?? 0;
}

function evidenceConfidenceScore(value) {
  return EVIDENCE_CONFIDENCE_BAND_SCORES[value] ?? 0;
}

function estimatedTimeScore(minutes) {
  if (typeof minutes !== 'number' || minutes < 0) return 0;
  for (const bucket of ESTIMATED_TIME_BUCKETS) {
    if (minutes <= bucket.maxMinutes) return bucket.score;
  }
  return 0;
}

// computeOpportunityScore(action, definition) -> {score, factorBreakdown}
//
// `action` is a real playbook_actions row (needs only evidence_confidence).
// `definition` is a real Playbook Definition (needs only .metrics).
// Never throws -- missing/malformed metrics score that factor as 0, the
// same "honest degradation" discipline as evidenceConfidence()/isEligible()
// throughout the Playbook Action Engine.
export function computeOpportunityScore(action, definition) {
  const metrics = (definition && definition.metrics) || {};
  const evidenceConfidence = (action && action.evidence_confidence) || null;

  const factors = {
    revenuePotential:   qualitativeScore(metrics.estimatedRevenueImpact),
    businessImpact:     qualitativeScore(metrics.businessImpact),
    evidenceConfidence: evidenceConfidenceScore(evidenceConfidence),
    difficulty:         difficultyScore(metrics.difficulty),
    estimatedTime:       estimatedTimeScore(metrics.estimatedMinutes),
    priorityWeight:      qualitativeScore(metrics.priority),
  };

  let weightedSum = 0;
  const factorBreakdown = {};
  for (const [factor, weight] of Object.entries(SCORE_WEIGHTS)) {
    const factorScore = factors[factor] ?? 0;
    const contribution = factorScore * weight;
    weightedSum += contribution;
    factorBreakdown[factor] = {
      rawValue: factorInputValue(factor, metrics, evidenceConfidence),
      normalizedScore: factorScore,
      weight,
      contribution: Math.round(contribution * 100),
    };
  }

  const score = Math.round(weightedSum * 100);
  return { score: Math.max(0, Math.min(100, score)), factorBreakdown };
}

function factorInputValue(factor, metrics, evidenceConfidence) {
  switch (factor) {
    case 'revenuePotential':   return metrics.estimatedRevenueImpact ?? null;
    case 'businessImpact':     return metrics.businessImpact ?? null;
    case 'evidenceConfidence': return evidenceConfidence;
    case 'difficulty':         return metrics.difficulty ?? null;
    case 'estimatedTime':      return metrics.estimatedMinutes ?? null;
    case 'priorityWeight':     return metrics.priority ?? null;
    default:                   return null;
  }
}

// computeBand(score) -> 'DO_NOW' | 'DO_NEXT' | 'DO_LATER'
export function computeBand(score) {
  for (const t of BAND_THRESHOLDS) {
    if (score >= t.min && score <= t.max) return t.band;
  }
  return 'DO_LATER';
}

// isQuickWin(definition, action) -> boolean
//
// Strict AND-filter, independent of the composite score. Never mutates
// the score -- only the caller (opportunity-engine.js) uses this to
// override the assigned band to DO_NOW.
export function isQuickWin(definition, action) {
  const metrics = (definition && definition.metrics) || {};
  const evidenceConfidence = (action && action.evidence_confidence) || null;

  const revenueOk = metrics.estimatedRevenueImpact === QUICK_WIN_CRITERIA.minRevenueImpact;
  const confidenceOk = evidenceConfidence === QUICK_WIN_CRITERIA.minConfidence;
  const difficultyOk = metrics.difficulty === QUICK_WIN_CRITERIA.maxDifficulty;
  const timeOk = typeof metrics.estimatedMinutes === 'number'
    && metrics.estimatedMinutes <= QUICK_WIN_CRITERIA.maxEstimatedMinutes;

  return revenueOk && confidenceOk && difficultyOk && timeOk;
}
