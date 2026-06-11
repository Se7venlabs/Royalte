// ─────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Engine™ — Schema definitions (Phase 5)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No reasoning. No I/O. No mutation of
//  external state. The engine lives at api/_lib/intelligence-engine.js.
//
//  Constants (Board-locked enumerations):
//    OBSERVATION_TYPES   the seven domains the engine reasons over
//    SEVERITY            the five severity tiers
//    CONFIDENCE          the four confidence tiers
//    ENGINE_VERSION      semantic version of the engine output shape
//
//  Empty factories (unfrozen shells the engine populates and freezes):
//    emptyObservation()   blank observation; engine fills via makeObs
//    emptyEngineOutput()  blank engine result; engine populates each list
// ─────────────────────────────────────────────────────────────────────

export const OBSERVATION_TYPES = Object.freeze({
  IDENTITY:   'IDENTITY',
  PUBLISHING: 'PUBLISHING',
  METADATA:   'METADATA',
  CATALOG:    'CATALOG',
  MONITORING: 'MONITORING',
  REVENUE:    'REVENUE',
  GENERAL:    'GENERAL',
});

export const SEVERITY = Object.freeze({
  INFO:     'INFO',
  LOW:      'LOW',
  MEDIUM:   'MEDIUM',
  HIGH:     'HIGH',
  CRITICAL: 'CRITICAL',
});

export const CONFIDENCE = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  LOW:     'LOW',
  MEDIUM:  'MEDIUM',
  HIGH:    'HIGH',
});

export const ENGINE_VERSION = '1.0.0';

// emptyObservation: blank observation shell. The engine fills `id`,
// `type`, `severity`, `confidence`, `title`, `description`,
// `recommendation`, `evidence[]`, and `providerSources[]` per rule.
export function emptyObservation() {
  return {
    id:              '',
    type:            '',
    severity:        SEVERITY.INFO,
    confidence:      CONFIDENCE.UNKNOWN,
    title:           '',
    description:     '',
    recommendation:  '',
    evidence:        [],
    providerSources: [],
  };
}

// emptyEngineOutput: blank engine result shell. The engine populates
// the observation lists and the per-CIO-section coverage list, then
// deep-freezes the result so consumers receive an immutable output.
export function emptyEngineOutput() {
  return {
    observations:    [],
    recommendations: [],
    risks:           [],
    strengths:       [],
    opportunities:   [],
    coverage:        [],
    engineVersion:   ENGINE_VERSION,
    generatedAt:     new Date().toISOString(),
  };
}
