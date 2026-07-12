// Canonical Intelligence Platform(tm) -- Resolution Policy Registry

import {
  POLICY_REQUIRED_FIELDS,
  VALID_RESOLUTION_CATEGORIES,
  VALID_POLICY_STATUSES,
  VALID_RESOLUTION_RULES,
  RESOLUTION_ERROR_CODES,
  POLICY_STATUSES,
} from './types.js';

export function assertPolicyInterface(policy) {
  if (!policy || typeof policy !== 'object') {
    throw new Error('[resolution-registry] Policy must be a non-null object');
  }
  for (const field of POLICY_REQUIRED_FIELDS) {
    if (policy[field] === undefined || policy[field] === null) {
      throw new Error(`[resolution-registry] Policy "${policy.policyId ?? '?'}" is missing required field: ${field}`);
    }
  }
  if (!VALID_RESOLUTION_CATEGORIES.has(policy.category)) {
    throw new Error(`[resolution-registry] Policy "${policy.policyId}" has invalid category: ${policy.category}`);
  }
  if (!VALID_POLICY_STATUSES.has(policy.status)) {
    throw new Error(`[resolution-registry] Policy "${policy.policyId}" has invalid status: ${policy.status}`);
  }
  if (!VALID_RESOLUTION_RULES.has(policy.resolutionRule)) {
    throw new Error(`[resolution-registry] Policy "${policy.policyId}" has invalid resolutionRule: ${policy.resolutionRule}`);
  }
  if (!Array.isArray(policy.providerOrder) || policy.providerOrder.length === 0) {
    throw new Error(`[resolution-registry] Policy "${policy.policyId}" providerOrder must be a non-empty array`);
  }
  if (typeof policy.field !== 'string' || !policy.field.trim()) {
    throw new Error(`[resolution-registry] Policy "${policy.policyId}" field must be a non-empty string`);
  }
}

export function createResolutionRegistry() {
  const _policies    = new Map();
  const _byCategory  = new Map();
  let   _defaultPolicy = null;

  function registerPolicy(policy) {
    assertPolicyInterface(policy);
    if (_policies.has(policy.policyId)) {
      throw new Error(`[resolution-registry] Policy "${policy.policyId}" is already registered`);
    }
    _policies.set(policy.policyId, Object.freeze({ ...policy, providerOrder: Object.freeze([...policy.providerOrder]) }));
    if (!_byCategory.has(policy.category)) _byCategory.set(policy.category, []);
    _byCategory.get(policy.category).push(policy.policyId);
    if (policy.field === 'DEFAULT') _defaultPolicy = policy.policyId;
  }

  function getPolicyForField(fieldName) {
    for (const [, policy] of _policies) {
      if (policy.status !== POLICY_STATUSES.ACTIVE) continue;
      if (policy.field === fieldName) return policy;
    }
    if (_defaultPolicy) return _policies.get(_defaultPolicy);
    return null;
  }

  function getPolicyById(policyId) {
    return _policies.get(policyId) ?? null;
  }

  function listPolicies() {
    return Array.from(_policies.values());
  }

  function listPoliciesByCategory(category) {
    const ids = _byCategory.get(category) ?? [];
    return ids.map(id => _policies.get(id)).filter(Boolean);
  }

  function size() {
    return _policies.size;
  }

  return Object.freeze({ registerPolicy, getPolicyForField, getPolicyById, listPolicies, listPoliciesByCategory, size });
}
