// ----------------------------------------------------
//
// Royaltē Rule Library™
//
// The Rule Library owns business knowledge.
//
// Rules are declarative.
//
// Rules never execute themselves.
//
// The Intelligence Engine evaluates rules.
//
// Consumers never bypass the Rule Library.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  This file is the public face of the Rule Library. It re-exports the
//  per-category rule arrays, aggregates them into `ALL_RULES`, ships
//  the locked enumeration constants (`RULE_CATEGORIES`, `SEVERITY`,
//  `CONFIDENCE`), and provides two pure helpers:
//
//    validateRule(rule)           — structural validation; returns
//                                   { valid, errors[] }, never throws
//    getRulesByCategory(category) — filtered slice of ALL_RULES
//
//  Rule files use string literals for `category` (`'IDENTITY'`,
//  `'PUBLISHING'`, …) rather than importing `RULE_CATEGORIES` from
//  this module — that would create a circular import that breaks
//  module-load-time array construction. The `RULE_CATEGORIES`
//  constants here are for external consumers (the Intelligence Engine
//  in a later phase, downstream tests, future tooling).
//
//  Reserved categories (`MONITORING`, `REVENUE`, `GENERAL`) carry
//  empty rule arrays today. When a Board brief authorises rules in
//  those domains, the file lands here without any change to this
//  index module — `getRulesByCategory('GENERAL')` will start returning
//  results automatically.

import { identityRules }    from './identity-rules.js';
import { publishingRules }  from './publishing-rules.js';
import { catalogRules }     from './catalog-rules.js';
import { metadataRules }    from './metadata-rules.js';

// ─── Board-locked enumerations ──────────────────────────────────────

export const RULE_CATEGORIES = Object.freeze({
  IDENTITY:   'IDENTITY',
  PUBLISHING: 'PUBLISHING',
  CATALOG:    'CATALOG',
  METADATA:   'METADATA',
  MONITORING: 'MONITORING',  // reserved — no rules in Phase 5
  REVENUE:    'REVENUE',     // reserved — no rules in Phase 5
  GENERAL:    'GENERAL',     // reserved — no rules in Phase 5
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

// Set-form accessors for membership checks (sealed against mutation).
const VALID_CATEGORIES = new Set(Object.values(RULE_CATEGORIES));
const VALID_SEVERITY   = new Set(Object.values(SEVERITY));
const VALID_CONFIDENCE = new Set(Object.values(CONFIDENCE));

// ─── Reserved-category rule arrays (empty for Phase 5) ──────────────

export const monitoringRules = Object.freeze([]);
export const revenueRules    = Object.freeze([]);
export const generalRules    = Object.freeze([]);

// ─── Re-export per-category arrays + aggregate ──────────────────────

export { identityRules, publishingRules, catalogRules, metadataRules };

export const ALL_RULES = Object.freeze([
  ...identityRules,
  ...publishingRules,
  ...catalogRules,
  ...metadataRules,
  ...monitoringRules,
  ...revenueRules,
  ...generalRules,
]);

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Structural validation of a single rule object.
 *
 * Never throws. Returns { valid: boolean, errors: string[] } with
 * stable machine-readable error codes:
 *   not_an_object · missing_id · missing_category · invalid_category ·
 *   missing_title · missing_severity · invalid_severity ·
 *   missing_confidence · invalid_confidence · missing_condition ·
 *   condition_not_a_function · missing_recommendation ·
 *   providerSources_not_an_array · missing_description
 */
export function validateRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return { valid: false, errors: ['not_an_object'] };
  }
  if (typeof rule.id           !== 'string' || rule.id           === '') errors.push('missing_id');
  if (typeof rule.title        !== 'string' || rule.title        === '') errors.push('missing_title');
  if (typeof rule.description  !== 'string' || rule.description  === '') errors.push('missing_description');
  if (typeof rule.recommendation !== 'string' || rule.recommendation === '') errors.push('missing_recommendation');

  if (typeof rule.category     !== 'string' || rule.category     === '') errors.push('missing_category');
  else if (!VALID_CATEGORIES.has(rule.category))                          errors.push('invalid_category');

  if (typeof rule.severity     !== 'string' || rule.severity     === '') errors.push('missing_severity');
  else if (!VALID_SEVERITY.has(rule.severity))                            errors.push('invalid_severity');

  if (typeof rule.confidence   !== 'string' || rule.confidence   === '') errors.push('missing_confidence');
  else if (!VALID_CONFIDENCE.has(rule.confidence))                        errors.push('invalid_confidence');

  if (rule.condition === undefined || rule.condition === null) errors.push('missing_condition');
  else if (typeof rule.condition !== 'function')               errors.push('condition_not_a_function');

  if (!Array.isArray(rule.providerSources)) errors.push('providerSources_not_an_array');

  return { valid: errors.length === 0, errors };
}

/**
 * Return all rules in the given category. Never throws; unknown
 * categories return [].
 */
export function getRulesByCategory(category) {
  if (typeof category !== 'string' || category === '') return [];
  return ALL_RULES.filter((r) => r.category === category);
}
