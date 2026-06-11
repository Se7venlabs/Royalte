// ─────────────────────────────────────────────────────────────────────
//  Royaltē Intelligence Engine™ — Schema definitions (Phase 6)
// ─────────────────────────────────────────────────────────────────────
//
//  This file is SCHEMA ONLY. No execution logic. No I/O. No mutation.
//  The engine lives at api/_lib/intelligence-engine.js.
//
//  Constants (Board-locked enumerations):
//    CATEGORIES        seven domains observations can carry
//    SEVERITY          five severity tiers
//    CONFIDENCE        four confidence tiers
//    ENGINE_VERSION    semantic version of the engine output shape
//
//  Empty factories:
//    emptyObservation()   blank observation shell (engine fills via
//                         deterministic projection from a rule)
//    emptyEngineOutput()  blank engine result shell; engine populates
//                         observations / recommendations / risks /
//                         strengths / opportunities / coverage and
//                         deep-freezes before return
// ─────────────────────────────────────────────────────────────────────

export const CATEGORIES = Object.freeze({
  IDENTITY:   'IDENTITY',
  PUBLISHING: 'PUBLISHING',
  CATALOG:    'CATALOG',
  METADATA:   'METADATA',
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

// emptyObservation: blank observation shell. The engine fills every
// field per the rule that fired:
//   id              deterministic SHA-256 prefix of (ruleId + title)
//   ruleId          stable reference back to the rule that produced
//                   this observation (caller-supplied)
//   category, severity, confidence, title, description, recommendation
//                   carried verbatim from the rule
//   evidence        result of rule.evidence(cio), if any
//   providerSources result of rule.providerSources(cio), if any
export function emptyObservation() {
  return {
    id:              '',
    ruleId:          '',
    category:        '',
    severity:        '',
    confidence:      '',
    title:           '',
    description:     '',
    recommendation:  '',
    evidence:        [],
    providerSources: [],
  };
}

// emptyEngineOutput: blank engine result shell. The engine populates
// each list and the per-CIO-section coverage list, then deep-freezes
// the whole structure so consumers receive an immutable result.
export function emptyEngineOutput() {
  return {
    observations:    [],
    recommendations: [],
    risks:           [],
    strengths:       [],
    opportunities:   [],
    coverage:        [],
    engineVersion:   ENGINE_VERSION,
    generatedAt:     '',
  };
}
