// Canonical Intelligence Platform(tm) -- Normalization Validation
//
// Validates normalization inputs and outputs.
// Also provides rule-level validation helpers.

import { VALID_NORMALIZATION_CATEGORIES, VALID_RULE_STATUSES, VALID_NORMALIZER_INPUT_TYPES,
         RULE_REQUIRED_FIELDS } from './types.js';

// Validate a normalization rule object (without the idempotency check in registry.js).
export function validateRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule must be a non-null object'] };
  }
  for (const field of RULE_REQUIRED_FIELDS) {
    if (rule[field] === undefined || rule[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  if (rule.category && !VALID_NORMALIZATION_CATEGORIES.has(rule.category)) {
    errors.push(`Unknown category: "${rule.category}"`);
  }
  if (rule.status && !VALID_RULE_STATUSES.has(rule.status)) {
    errors.push(`Unknown status: "${rule.status}"`);
  }
  if (rule.inputType && !VALID_NORMALIZER_INPUT_TYPES.has(rule.inputType)) {
    errors.push(`Unknown inputType: "${rule.inputType}"`);
  }
  if (rule.outputType && !VALID_NORMALIZER_INPUT_TYPES.has(rule.outputType)) {
    errors.push(`Unknown outputType: "${rule.outputType}"`);
  }
  if (rule.normalize !== undefined && typeof rule.normalize !== 'function') {
    errors.push('normalize must be a function');
  }
  if (rule.fieldPatterns !== undefined) {
    if (!Array.isArray(rule.fieldPatterns)) {
      errors.push('fieldPatterns must be an array');
    } else {
      rule.fieldPatterns.forEach((p, i) => {
        if (!(p instanceof RegExp)) errors.push(`fieldPatterns[${i}] must be a RegExp`);
      });
    }
  }
  return { valid: errors.length === 0, errors };
}

// Validate normalized output: must be a non-null object.
export function validateNormalizedOutput(output) {
  const errors = [];
  if (output === null || output === undefined) {
    errors.push('Normalized output must not be null or undefined');
  } else if (typeof output !== 'object') {
    errors.push('Normalized output must be an object');
  }
  return { valid: errors.length === 0, errors };
}

// Validate a Normalization Report structure.
export function validateReport(report) {
  const errors = [];
  if (!report || typeof report !== 'object') {
    return { valid: false, errors: ['Report must be a non-null object'] };
  }
  for (const field of ['reportId', 'normalizedAt', 'engineVersion', 'rulesApplied', 'rulesSkipped', 'warnings', 'errors', 'success']) {
    if (report[field] === undefined) errors.push(`Report missing required field: ${field}`);
  }
  if (report.rulesApplied !== undefined && !Array.isArray(report.rulesApplied)) {
    errors.push('Report.rulesApplied must be an array');
  }
  if (report.rulesSkipped !== undefined && !Array.isArray(report.rulesSkipped)) {
    errors.push('Report.rulesSkipped must be an array');
  }
  if (report.success !== undefined && typeof report.success !== 'boolean') {
    errors.push('Report.success must be a boolean');
  }
  return { valid: errors.length === 0, errors };
}
