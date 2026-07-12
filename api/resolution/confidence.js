// Canonical Intelligence Platform(tm) -- Confidence Engine(tm)
// Deterministic confidence calculation; no randomness; no external state.

import { CONFIDENCE_LEVELS, CONFIDENCE_THRESHOLDS, CONFLICT_TYPES } from './types.js';

// Board-locked provider priority scores. Rank 0 = highest trust.
function providerPriorityScore(rank) {
  if (rank < 0)  return 0.40;  // not in policy
  if (rank === 0) return 1.00;
  if (rank === 1) return 0.92;
  if (rank === 2) return 0.84;
  if (rank === 3) return 0.76;
  if (rank === 4) return 0.68;
  return Math.max(0.50, 1.00 - (rank * 0.10));
}

// Board-locked agreement multipliers per conflict type.
function agreementMultiplier(conflictType) {
  switch (conflictType) {
    case CONFLICT_TYPES.ALL_AGREE:         return 1.00;
    case CONFLICT_TYPES.PARTIAL_AGREEMENT: return 0.90;
    case CONFLICT_TYPES.CONFLICT:          return 0.80;
    case CONFLICT_TYPES.SINGLE_SOURCE:     return 0.85;
    case CONFLICT_TYPES.NO_DATA:           return 0.00;
    default:                               return 0.80;
  }
}

export function computeConfidence({ selectedProviderRank, conflictType, hasValue }) {
  if (!hasValue || conflictType === CONFLICT_TYPES.NO_DATA) return 0.00;
  const score = providerPriorityScore(selectedProviderRank) * agreementMultiplier(conflictType);
  return Math.min(1.00, Math.max(0.00, Math.round(score * 1000) / 1000));
}

export function confidenceLevel(confidence) {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH)   return CONFIDENCE_LEVELS.HIGH;
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM)  return CONFIDENCE_LEVELS.MEDIUM;
  if (confidence >= CONFIDENCE_THRESHOLDS.LOW)     return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.UNCERTAIN;
}
