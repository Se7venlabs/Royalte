// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Validation
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure validation function. Called by the Registry Loader at startup.
// A non-empty errors array means the registry is broken and the loader throws.
//
// Rules enforced (per Sprint 1 brief):
//   1. Duplicate field IDs
//   2. Duplicate canonical names within the same parent object
//   3. Duplicate ownership — same (parentObject, canonicalName) pair
//   4. Missing validation rules (warning, not error — logged only)
//   5. Missing consumers (warning, not error)
//   6. Invalid data types
//   7. Unknown parent objects
//   8. Unknown domains
//   9. Executive Intelligence may never own fields (constitutional rule)
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
// Never throws; never imports field data (pure function over passed-in data).
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  DOMAINS,
  VALID_DOMAINS,
  VALID_DATA_TYPES,
  VALID_RESOLUTION_POLICIES,
  VALID_CONFIDENCE_POLICIES,
  VALID_FIELD_STATUSES,
  VALID_OBJECT_STATUSES,
} from './types.js';
import { VALID_OBJECT_IDS } from './objects.js';

const REQUIRED_FIELD_PROPS = [
  'id', 'canonicalName', 'displayName', 'parentObject', 'domain',
  'description', 'dataType', 'required', 'defaultValue',
  'resolutionPolicy', 'confidencePolicy', 'sourcePriority',
  'consumers', 'version', 'status',
];

const REQUIRED_OBJECT_PROPS = ['id', 'description', 'version', 'status'];

export function validateRegistry(objects, fields) {
  const errors   = [];
  const warnings = [];

  // ── Object validation ──────────────────────────────────────────────────────
  const seenObjectIds = new Set();
  for (const obj of objects) {
    for (const prop of REQUIRED_OBJECT_PROPS) {
      if (obj[prop] === undefined || obj[prop] === null || obj[prop] === '') {
        errors.push(`Object "${obj.id ?? '(unknown)'}": missing required property "${prop}"`);
      }
    }
    if (obj.status && !VALID_OBJECT_STATUSES.has(obj.status)) {
      errors.push(`Object "${obj.id}": unknown status "${obj.status}"`);
    }
    if (obj.id) {
      if (seenObjectIds.has(obj.id)) {
        errors.push(`Duplicate object ID: "${obj.id}"`);
      }
      seenObjectIds.add(obj.id);
    }
  }

  // ── Field validation ───────────────────────────────────────────────────────
  const seenIds          = new Set();   // rule 1: unique field IDs
  const seenOwnership    = new Set();   // rule 3: unique (parentObject, canonicalName)
  const seenCanonicalByParent = new Map(); // rule 2: unique canonicalName within parentObject

  for (const field of fields) {
    const fid = field.id ?? '(unknown)';

    // Required properties present
    for (const prop of REQUIRED_FIELD_PROPS) {
      if (field[prop] === undefined) {
        errors.push(`Field "${fid}": missing required property "${prop}"`);
      }
    }

    // Rule 1 — duplicate field IDs
    if (field.id) {
      if (seenIds.has(field.id)) {
        errors.push(`Duplicate field ID: "${field.id}"`);
      }
      seenIds.add(field.id);
    }

    // Rule 2 — duplicate canonical names within the same parent object
    if (field.parentObject && field.canonicalName) {
      const parentKey = `${field.parentObject}::${field.canonicalName}`;
      const existing  = seenCanonicalByParent.get(parentKey);
      if (existing) {
        errors.push(
          `Duplicate canonical name "${field.canonicalName}" on object "${field.parentObject}": ` +
          `fields "${existing}" and "${field.id}" both claim it`
        );
      } else {
        seenCanonicalByParent.set(parentKey, field.id);
      }
    }

    // Rule 3 — duplicate ownership: same (parentObject, canonicalName) pair
    if (field.parentObject && field.canonicalName) {
      const ownerKey = `${field.parentObject}::${field.canonicalName}`;
      if (seenOwnership.has(ownerKey)) {
        errors.push(
          `Duplicate ownership: "${field.parentObject}.${field.canonicalName}" is claimed by more than one field`
        );
      }
      seenOwnership.add(ownerKey);
    }

    // Rule 4 — missing validation rule (warning only)
    if (!field.validationRule && field.required) {
      warnings.push(`Field "${fid}": required field has no validationRule`);
    }

    // Rule 5 — missing consumers (warning only)
    if (!Array.isArray(field.consumers) || field.consumers.length === 0) {
      warnings.push(`Field "${fid}": no consumers declared`);
    }

    // Rule 6 — invalid data type
    if (field.dataType && !VALID_DATA_TYPES.has(field.dataType)) {
      errors.push(`Field "${fid}": unknown dataType "${field.dataType}"`);
    }

    // Rule 7 — unknown parent object
    if (field.parentObject && !VALID_OBJECT_IDS.has(field.parentObject)) {
      errors.push(`Field "${fid}": unknown parentObject "${field.parentObject}"`);
    }

    // Rule 8 — unknown domain
    if (field.domain && !VALID_DOMAINS.has(field.domain)) {
      errors.push(`Field "${fid}": unknown domain "${field.domain}"`);
    }

    // Rule 9 — Executive Intelligence may never own fields (constitutional)
    if (field.domain === DOMAINS.EXECUTIVE) {
      errors.push(
        `Field "${fid}": domain is "${DOMAINS.EXECUTIVE}" — Executive Intelligence never owns fields (constitutional rule)`
      );
    }

    // Additional: unknown resolution / confidence policies
    if (field.resolutionPolicy && !VALID_RESOLUTION_POLICIES.has(field.resolutionPolicy)) {
      errors.push(`Field "${fid}": unknown resolutionPolicy "${field.resolutionPolicy}"`);
    }
    if (field.confidencePolicy && !VALID_CONFIDENCE_POLICIES.has(field.confidencePolicy)) {
      errors.push(`Field "${fid}": unknown confidencePolicy "${field.confidencePolicy}"`);
    }

    // Additional: unknown field status
    if (field.status && !VALID_FIELD_STATUSES.has(field.status)) {
      errors.push(`Field "${fid}": unknown status "${field.status}"`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
