// Canonical Intelligence Platform(tm) -- Normalization Rule Registry
//
// Central register for all normalization rules.
// Every rule that the engine may apply must be registered here before use.
//
// Rules are immutable once registered. The registry is append-only
// per-instance: re-registering the same ruleId throws.

import { RULE_REQUIRED_FIELDS, VALID_NORMALIZATION_CATEGORIES, VALID_RULE_STATUSES,
         VALID_NORMALIZER_INPUT_TYPES } from './types.js';

// Validate a rule object before registration.
export function assertRuleInterface(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new Error('[normalization-registry] Rule must be a non-null object');
  }
  for (const field of RULE_REQUIRED_FIELDS) {
    if (rule[field] === undefined || rule[field] === null) {
      throw new Error(`[normalization-registry] Rule "${rule.ruleId ?? '(unknown)'}" is missing required field: ${field}`);
    }
  }
  if (typeof rule.normalize !== 'function') {
    throw new Error(`[normalization-registry] Rule "${rule.ruleId}".normalize must be a function`);
  }
  if (!VALID_NORMALIZATION_CATEGORIES.has(rule.category)) {
    throw new Error(`[normalization-registry] Rule "${rule.ruleId}": unknown category "${rule.category}"`);
  }
  if (!VALID_RULE_STATUSES.has(rule.status)) {
    throw new Error(`[normalization-registry] Rule "${rule.ruleId}": unknown status "${rule.status}"`);
  }
  if (!VALID_NORMALIZER_INPUT_TYPES.has(rule.inputType)) {
    throw new Error(`[normalization-registry] Rule "${rule.ruleId}": unknown inputType "${rule.inputType}"`);
  }
  if (!VALID_NORMALIZER_INPUT_TYPES.has(rule.outputType)) {
    throw new Error(`[normalization-registry] Rule "${rule.ruleId}": unknown outputType "${rule.outputType}"`);
  }
  // Idempotency check using example input (no circular transformation).
  if (rule.example?.input !== undefined) {
    try {
      const once  = rule.normalize(rule.example.input);
      const twice = rule.normalize(once);
      if (JSON.stringify(once) !== JSON.stringify(twice)) {
        throw new Error(`[normalization-registry] Rule "${rule.ruleId}" is not idempotent (circular transformation detected)`);
      }
    } catch (err) {
      if (err.message.includes('circular transformation')) throw err;
      // normalize() threw on example — surface as validation error
      throw new Error(`[normalization-registry] Rule "${rule.ruleId}" normalize() threw on example input: ${err.message}`);
    }
  }
}

// Create a new Normalization Registry instance.
export function createNormalizationRegistry() {
  const _rules         = new Map();   // ruleId → frozen rule
  const _byCategory    = new Map();   // category → frozen rule[]
  const _byInputType   = new Map();   // inputType → frozen rule[]

  function _index(rule) {
    if (!_byCategory.has(rule.category))  _byCategory.set(rule.category, []);
    if (!_byInputType.has(rule.inputType)) _byInputType.set(rule.inputType, []);
    _byCategory.get(rule.category).push(rule);
    _byInputType.get(rule.inputType).push(rule);
  }

  return {
    register(rule) {
      assertRuleInterface(rule);
      if (_rules.has(rule.ruleId)) {
        throw new Error(`[normalization-registry] Rule already registered: ${rule.ruleId}`);
      }
      const frozen = Object.freeze({ ...rule });
      _rules.set(rule.ruleId, frozen);
      _index(frozen);
      return frozen;
    },

    getRule(ruleId) {
      return _rules.get(ruleId) ?? null;
    },

    getRulesByCategory(category) {
      return [...(_byCategory.get(category) ?? [])];
    },

    getRulesByInputType(inputType) {
      return [...(_byInputType.get(inputType) ?? [])];
    },

    listRules() {
      return [..._rules.values()];
    },

    listActiveRules() {
      return [..._rules.values()].filter(r => r.status === 'ACTIVE');
    },

    has(ruleId) {
      return _rules.has(ruleId);
    },

    size() {
      return _rules.size;
    },
  };
}
