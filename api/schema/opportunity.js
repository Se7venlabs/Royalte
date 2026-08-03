// ─────────────────────────────────────────────────────────────────────
//  Royaltē Executive Opportunity Engine™ — Schema definitions (Phase 4B)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No execution logic. No I/O. No mutation.
//  The engine lives at api/_lib/opportunity-engine.js; the pure scoring
//  math lives at api/_lib/opportunity-scoring-engine.js. Same split as
//  api/schema/health.js -> api/_lib/health-engine.js.
//
//  SCORE_WEIGHTS sums to 1.0 (asserted by tests/opportunity-engine-test.mjs)
//  -- an Executive Opportunity Score™ is a weighted composite of six
//  factors read from a Playbook Definition's metrics object (Phase 4A
//  ECR5) plus the real, per-artist evidence_confidence on the
//  playbook_actions row. Deterministic: identical inputs -> identical
//  score, always.
//
//  BAND_THRESHOLDS assigns the Executive Roadmap™ section (Do Now / Do
//  Next / Do Later) from the composite score. QUICK_WIN_CRITERIA is a
//  separate, strict AND-filter that overrides the assigned band to
//  DO_NOW -- it never changes the stored score itself, so History/trend
//  data always reflects the honest weighted composite, never an inflated
//  value invented to justify the band.
//
//  RANKABLE_STATUSES is the complete non-terminal playbook_actions status
//  universe: 'available' is never a persisted status (only a virtual
//  fromStatus in history rows -- see playbook-action-store.js), and
//  waiting_verification/verified/completed/archived have nothing left to
//  prioritize.
// ─────────────────────────────────────────────────────────────────────

export const OPPORTUNITY_SCORING_VERSION = '1.0';

export const SCORE_WEIGHTS = Object.freeze({
  revenuePotential:   0.30,  // metrics.estimatedRevenueImpact
  businessImpact:     0.20,  // metrics.businessImpact
  evidenceConfidence: 0.20,  // playbook_actions.evidence_confidence (real, per-artist)
  difficulty:         0.15,  // metrics.difficulty, inverted -- LOW difficulty scores higher
  estimatedTime:      0.10,  // metrics.estimatedMinutes, bucketed + inverted -- faster scores higher
  priorityWeight:     0.05,  // metrics.priority, editorial nudge
});

// Ordered qualitative -> numeric bands shared by every HIGH/MEDIUM/LOW-style
// factor (revenuePotential, businessImpact, priorityWeight read this
// directly; difficulty/evidenceConfidence use their own inverted/extended
// maps below since their vocabularies differ).
export const QUALITATIVE_BAND_SCORES = Object.freeze({
  HIGH:   1.0,
  MEDIUM: 0.6,
  LOW:    0.3,
});

// Difficulty is inverted -- LOW difficulty (easy) contributes the most.
export const DIFFICULTY_BAND_SCORES = Object.freeze({
  LOW:    1.0,
  MEDIUM: 0.6,
  HIGH:   0.2,
});

// Evidence Confidence uses the Phase 4A Playbook Action Engine's own
// four-value vocabulary (VALID_CONFIDENCE in playbook-action-store.js),
// not the three-value HIGH/MEDIUM/LOW set -- INSUFFICIENT_DATA must score
// lowest, never fall back to a default MEDIUM.
export const EVIDENCE_CONFIDENCE_BAND_SCORES = Object.freeze({
  HIGH:               1.0,
  MEDIUM:             0.6,
  LOW:                0.3,
  INSUFFICIENT_DATA:  0.0,
});

// estimatedMinutes bucket boundaries -- inverted (shorter -> higher score).
export const ESTIMATED_TIME_BUCKETS = Object.freeze([
  Object.freeze({ maxMinutes: 15,  score: 1.0 }),
  Object.freeze({ maxMinutes: 30,  score: 0.8 }),
  Object.freeze({ maxMinutes: 60,  score: 0.5 }),
  Object.freeze({ maxMinutes: 120, score: 0.3 }),
  Object.freeze({ maxMinutes: Infinity, score: 0.1 }),
]);

export const BAND_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 70, max: 100, band: 'DO_NOW' }),
  Object.freeze({ min: 40, max: 69,  band: 'DO_NEXT' }),
  Object.freeze({ min: 0,  max: 39,  band: 'DO_LATER' }),
]);

export const VALID_BANDS = Object.freeze(['DO_NOW', 'DO_NEXT', 'DO_LATER']);

// Quick Wins™ (Objective 7) -- strict AND-filter, overrides band only.
export const QUICK_WIN_CRITERIA = Object.freeze({
  minRevenueImpact:    'HIGH',
  minConfidence:        'HIGH',
  maxDifficulty:        'LOW',
  maxEstimatedMinutes:  30,
});

// The complete rankable playbook_actions.status universe (see file header).
export const RANKABLE_STATUSES = Object.freeze(['recommended', 'started', 'in_progress']);

// Tie-break order for equal composite scores, applied in sequence.
export const EVIDENCE_CONFIDENCE_RANK = Object.freeze({
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  INSUFFICIENT_DATA: 0,
});
