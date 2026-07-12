// Canonical Intelligence Platform™ -- Mission Control™ Integration Validation
// Validates workspace binding contracts: completeness, status integrity,
// source attribution, and constitutional compliance.

import { WORKSPACE_REGISTRY, WORKSPACE_STATUS, VALID_WORKSPACE_IDS } from './workspaces.js';

const REQUIRED_BINDING_FIELDS = ['workspaceId', 'status', 'data', 'generatedAt'];

function checkFields(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      errors.push(`${label} missing required field: ${f}`);
    }
  }
  return errors;
}

export function validateWorkspaceBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    return { valid: false, errors: ['binding must be a non-null object'] };
  }
  const errors = checkFields(binding, REQUIRED_BINDING_FIELDS, 'binding');
  if (binding.workspaceId && !VALID_WORKSPACE_IDS.has(binding.workspaceId)) {
    errors.push(`Unknown workspaceId: ${binding.workspaceId}`);
  }
  if (binding.status && !Object.values(WORKSPACE_STATUS).includes(binding.status)) {
    errors.push(`Unknown workspace status: ${binding.status}`);
  }
  if (binding.data !== undefined && typeof binding.data !== 'object') {
    errors.push('binding.data must be an object');
  }
  return { valid: errors.length === 0, errors };
}

export function validateAllBindings(bindings) {
  if (!bindings || typeof bindings !== 'object') {
    return { valid: false, errors: ['bindings must be a non-null object'] };
  }
  const errors = [];
  for (const [wsId, binding] of Object.entries(bindings)) {
    const { valid, errors: bindingErrors } = validateWorkspaceBinding(binding);
    if (!valid) {
      errors.push(...bindingErrors.map(e => `[${wsId}] ${e}`));
    }
  }
  const missingWorkspaces = Object.keys(WORKSPACE_REGISTRY).filter(wsId => !(wsId in bindings));
  if (missingWorkspaces.length > 0) {
    errors.push(`Missing workspace bindings: ${missingWorkspaces.join(', ')}`);
  }
  return { valid: errors.length === 0, errors };
}

// Checks that a workspace binding is POPULATED (not UNAVAILABLE or PARTIAL).
export function assertWorkspacePopulated(binding) {
  const { valid, errors } = validateWorkspaceBinding(binding);
  if (!valid) {
    const err = new Error(`Invalid workspace binding: ${errors.join('; ')}`);
    err.code = 'INVALID_BINDING';
    throw err;
  }
  if (binding.status !== WORKSPACE_STATUS.POPULATED) {
    const err = new Error(`Workspace "${binding.workspaceId}" is ${binding.status}, expected POPULATED`);
    err.code = 'WORKSPACE_NOT_POPULATED';
    throw err;
  }
}

// Verifies that a source file has no direct imports from forbidden platform layers.
export function validateNoDirectPlatformImports(sourceCode, fileName = 'unknown') {
  const FORBIDDEN_PATTERNS = [
    /from\s+['"].*api\/evidence/,
    /from\s+['"].*api\/registry/,
    /from\s+['"].*api\/normalization/,
    /from\s+['"].*api\/resolution/,
    /from\s+['"].*api\/orchestrator/,
    /from\s+['"].*api\/monitoring/,
    /from\s+['"].*api\/athena(?!-)/,
  ];
  const violations = FORBIDDEN_PATTERNS
    .filter(p => p.test(sourceCode))
    .map(p => `Forbidden import pattern: ${p}`);
  return {
    valid:     violations.length === 0,
    fileName,
    violations,
  };
}
