// Canonical Intelligence Platform(tm) -- Normalization Engine Public Loader
//
// THE ONLY supported import path for Normalization Engine operations.
// No consumer may import internal pipeline, registry, or normalizer modules directly.
//
// Public API:
//
//   NORMALIZATION_ENGINE
//     Singleton engine backed by the default rule registry.
//     Contains all Sprint 4 rules pre-registered.
//
//   normalizeRegistryRecord(record, options?)
//     Normalize a Sprint 3 Evidence Registry record.
//     Returns { success, normalizedEvidence, report }.
//
//   normalizeEnvelope(envelope, options?)
//     Normalize a Sprint 2 Evidence Envelope directly.
//     Returns { success, normalizedEvidence, report }.
//
//   normalizeMany(records, options?)
//     Normalize an array of Registry records.
//     Returns { results: [{ success, normalizedEvidence, report }] }.
//
//   normalizeParsedEvidence(parsedEvidence, options?)
//     Low-level: normalize a parsedEvidence object directly.
//
//   createNormalizationEngine(registry)
//     Factory: create a named engine backed by a custom rule registry.
//
// Startup contract:
//   This module runs a self-check at import time.
//   A broken rule definition = startup failure.

import { NORMALIZATION_ENGINE_VERSION } from './version.js';
import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES,
         NORMALIZATION_ERROR_CODES, VALID_NORMALIZATION_CATEGORIES, VALID_RULE_STATUSES,
         VALID_NORMALIZER_INPUT_TYPES, VALID_NORMALIZATION_ERROR_CODES,
         RULE_REQUIRED_FIELDS } from './types.js';
import { createNormalizationRegistry, assertRuleInterface } from './registry.js';
import { normalizeParsedEvidence as _normParsed,
         normalizeRegistryRecord  as _normRecord,
         normalizeEnvelope         as _normEnvelope,
         normalizeMany             as _normMany } from './pipeline.js';
import { validateRule, validateNormalizedOutput, validateReport } from './validate.js';
import { createNormalizationReport } from './report.js';

import { TEXT_RULES }       from './normalizers/text.js';
import { IDENTIFIER_RULES } from './normalizers/identifiers.js';
import { URL_RULES }        from './normalizers/urls.js';
import { DATE_RULES }       from './normalizers/dates.js';
import { LOCATION_RULES }   from './normalizers/location.js';
import { BOOLEAN_RULES }    from './normalizers/booleans.js';
import { NUMERIC_RULES }    from './normalizers/numeric.js';
import { IDENTITY_RULES }   from './normalizers/identity.js';

// All Sprint 4 rules in pipeline order (TEXT first, then type-specific).
const ALL_RULES = [
  ...TEXT_RULES,
  ...IDENTITY_RULES,
  ...IDENTIFIER_RULES,
  ...URL_RULES,
  ...DATE_RULES,
  ...LOCATION_RULES,
  ...BOOLEAN_RULES,
  ...NUMERIC_RULES,
];

// Create a Normalization Engine backed by a rule registry.
export function createNormalizationEngine(registry) {
  return Object.freeze({
    normalizeRegistryRecord(record, options)   { return _normRecord(record, registry, options); },
    normalizeEnvelope(envelope, options)        { return _normEnvelope(envelope, registry, options); },
    normalizeMany(records, options)             { return _normMany(records, registry, options); },
    normalizeParsedEvidence(pe, context)        { return _normParsed(pe, registry, context); },
    registry,
  });
}

// Build the default singleton registry with all Sprint 4 rules.
function buildDefaultRegistry() {
  const registry = createNormalizationRegistry();
  for (const rule of ALL_RULES) {
    registry.register(rule);
  }
  return registry;
}

// Startup integrity check — fail fast if any rule definition is broken.
(function assertNormalizationDependencies() {
  if (!NORMALIZATION_ENGINE_VERSION?.version) {
    throw new Error('[normalization-engine] FATAL: NORMALIZATION_ENGINE_VERSION is missing');
  }
  for (const rule of ALL_RULES) {
    const result = validateRule(rule);
    if (!result.valid) {
      throw new Error(`[normalization-engine] FATAL: rule "${rule.ruleId}" failed validation: ${result.errors.join('; ')}`);
    }
  }
})();

const _defaultRegistry = buildDefaultRegistry();

// Default singleton engine.
export const NORMALIZATION_ENGINE = createNormalizationEngine(_defaultRegistry);

// Top-level convenience functions bound to the default engine.
export function normalizeRegistryRecord(record, options) {
  return NORMALIZATION_ENGINE.normalizeRegistryRecord(record, options);
}

export function normalizeEnvelope(envelope, options) {
  return NORMALIZATION_ENGINE.normalizeEnvelope(envelope, options);
}

export function normalizeMany(records, options) {
  return NORMALIZATION_ENGINE.normalizeMany(records, options);
}

export function normalizeParsedEvidence(parsedEvidence, context) {
  return NORMALIZATION_ENGINE.normalizeParsedEvidence(parsedEvidence, context);
}

// Re-export types and constants for consumer convenience.
export {
  NORMALIZATION_ENGINE_VERSION,
  NORMALIZATION_CATEGORIES,
  RULE_STATUSES,
  NORMALIZER_INPUT_TYPES,
  NORMALIZATION_ERROR_CODES,
  VALID_NORMALIZATION_CATEGORIES,
  VALID_RULE_STATUSES,
  VALID_NORMALIZER_INPUT_TYPES,
  VALID_NORMALIZATION_ERROR_CODES,
  RULE_REQUIRED_FIELDS,
  createNormalizationRegistry,
  assertRuleInterface,
  validateRule,
  validateNormalizedOutput,
  validateReport,
  createNormalizationReport,
  // Rule sets
  TEXT_RULES,
  IDENTITY_RULES,
  IDENTIFIER_RULES,
  URL_RULES,
  DATE_RULES,
  LOCATION_RULES,
  BOOLEAN_RULES,
  NUMERIC_RULES,
  ALL_RULES,
};
