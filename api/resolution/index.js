// Canonical Intelligence Platform(tm) -- Evidence Resolution Engine(tm) Public API
// Sole public entrypoint. Validates registry at startup; broken registry = startup failure.

import { RESOLUTION_ENGINE_VERSION } from './version.js';
import { createResolutionRegistry, assertPolicyInterface } from './registry.js';
import { DEFAULT_POLICIES } from './policies.js';
import { resolveField, resolveManyFields, resolveAllFields } from './pipeline.js';
import { detectConflict } from './conflicts.js';
import { computeConfidence, confidenceLevel } from './confidence.js';
import { createFieldProvenance } from './provenance.js';
import { createResolutionRecord } from './resolution-record.js';
import { createResolutionManifest } from './manifest.js';
import { validatePolicy, validateResolutionRecord, validateResolutionManifest, validateNormalizedRecords } from './validate.js';
import {
  RESOLUTION_CATEGORIES, RESOLUTION_RULES, CONFLICT_TYPES,
  CONFIDENCE_LEVELS, CONFIDENCE_THRESHOLDS, POLICY_STATUSES,
  RESOLUTION_ERROR_CODES, POLICY_REQUIRED_FIELDS,
  VALID_RESOLUTION_CATEGORIES, VALID_POLICY_STATUSES, VALID_RESOLUTION_RULES,
} from './types.js';

export function createResolutionEngine(registry) {
  return Object.freeze({
    resolveField:     (records, field, options)        => resolveField(records, field, registry, options),
    resolveManyFields:(records, fields, options)        => resolveManyFields(records, fields, registry, options),
    resolveAllFields: (records, options)                => resolveAllFields(records, registry, options),
    getPolicyForField:(fieldName)                       => registry.getPolicyForField(fieldName),
    listPolicies:     ()                                => registry.listPolicies(),
    registry,
    engineVersion: RESOLUTION_ENGINE_VERSION.version,
  });
}

// Startup integrity check — builds and validates the default registry
function buildDefaultRegistry() {
  const registry = createResolutionRegistry();
  for (const policy of DEFAULT_POLICIES) {
    assertPolicyInterface(policy);
    registry.registerPolicy(policy);
  }
  return registry;
}

const _defaultRegistry = buildDefaultRegistry();

export const RESOLUTION_ENGINE = createResolutionEngine(_defaultRegistry);

// Re-export everything callers need
export {
  resolveField,
  resolveManyFields,
  resolveAllFields,
  createResolutionRegistry,
  assertPolicyInterface,
  detectConflict,
  computeConfidence,
  confidenceLevel,
  createFieldProvenance,
  createResolutionRecord,
  createResolutionManifest,
  validatePolicy,
  validateResolutionRecord,
  validateResolutionManifest,
  validateNormalizedRecords,
  RESOLUTION_ENGINE_VERSION,
  DEFAULT_POLICIES,
  RESOLUTION_CATEGORIES,
  RESOLUTION_RULES,
  CONFLICT_TYPES,
  CONFIDENCE_LEVELS,
  CONFIDENCE_THRESHOLDS,
  POLICY_STATUSES,
  RESOLUTION_ERROR_CODES,
  POLICY_REQUIRED_FIELDS,
  VALID_RESOLUTION_CATEGORIES,
  VALID_POLICY_STATUSES,
  VALID_RESOLUTION_RULES,
};
