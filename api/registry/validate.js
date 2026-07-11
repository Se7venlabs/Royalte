// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Validation
// ─────────────────────────────────────────────────────────────────────────────
//
// Pure validation function. Called by the Registry Loader at startup.
// A non-empty errors array means the registry is broken and the loader throws.
//
// Rules enforced:
//   1. Duplicate field IDs
//   2. Duplicate canonical names within the same parent object
//   3. Duplicate ownership — same (parentObject, canonicalName) pair
//   4. Missing validation rules (warning, not error — logged only)
//   5. Missing consumers (warning, not error)
//   6. Invalid data types
//   7. Unknown parent objects
//   8. Unknown domains (null domain is allowed only for PROVISIONAL fields)
//   9. Consumer workspaces may never own fields (constitutional rule)
//  10. Object objectClass must be a known value
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
// Never throws; never imports field data (pure function over passed-in data).
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  VALID_DOMAINS,
  VALID_CONSUMER_WORKSPACES,
  VALID_OBJECT_CLASSES,
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

const REQUIRED_OBJECT_PROPS = ['id', 'objectClass', 'description', 'version', 'status'];

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

    // Rule 10 — objectClass must be a known value
    if (obj.objectClass && !VALID_OBJECT_CLASSES.has(obj.objectClass)) {
      errors.push(`Object "${obj.id}": unknown objectClass "${obj.objectClass}"`);
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
  const seenIds               = new Set();   // rule 1: unique field IDs
  const seenOwnership         = new Set();   // rule 3: unique (parentObject, canonicalName)
  const seenCanonicalByParent = new Map();   // rule 2: unique canonicalName within parentObject

  for (const field of fields) {
    const fid        = field.id ?? '(unknown)';
    const isProvision = field.status === 'PROVISIONAL';

    // Required properties present
    for (const prop of REQUIRED_FIELD_PROPS) {
      // PROVISIONAL fields are allowed to have null domain
      if (prop === 'domain' && isProvision) continue;
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

    // Rule 8 — unknown domain (null domain allowed for PROVISIONAL)
    if (!isProvision && field.domain && !VALID_DOMAINS.has(field.domain)) {
      errors.push(`Field "${fid}": unknown domain "${field.domain}"`);
    }

    // Rule 9 — consumer workspaces may never own fields (constitutional)
    if (field.domain && VALID_CONSUMER_WORKSPACES.has(field.domain)) {
      errors.push(
        `Field "${fid}": domain is "${field.domain}" — consumer workspaces never own fields (constitutional rule)`
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

// ─────────────────────────────────────────────────────────────────────────────
// Provisional Field Validation
// ─────────────────────────────────────────────────────────────────────────────
//
// Governs DERIVED_FIELDS (executive.*) which are excluded from ALL_FIELDS.
// Rules:
//   P1. All provisional field IDs are unique within the provisional set
//   P2. All provisional canonical names are unique within the provisional set
//   P3. All provisional parent objects are known canonical objects
//   P4. All provisional data types are valid
//   P5. All provisional fields have status === 'PROVISIONAL'
//   P6. All provisional fields have domain === null (no permanent domain assigned)
//   P7. All provisional fields have at least one consumer
//   P8. No provisional field ID collides with any canonical field ID
//
// Returns { valid: boolean, errors: string[], warnings: string[] }.
//
export function validateProvisionalFields(provisionalFields, canonicalFields) {
  const errors   = [];
  const warnings = [];

  const canonicalIds = new Set((canonicalFields ?? []).map((f) => f.id));
  const seenIds      = new Set();
  const seenNames    = new Set();

  for (const field of provisionalFields) {
    const fid = field.id ?? '(unknown)';

    // P1 — unique provisional IDs
    if (field.id) {
      if (seenIds.has(field.id)) {
        errors.push(`Provisional duplicate field ID: "${field.id}"`);
      }
      seenIds.add(field.id);
    }

    // P2 — unique canonical names within provisional set
    if (field.canonicalName) {
      if (seenNames.has(field.canonicalName)) {
        errors.push(`Provisional duplicate canonical name: "${field.canonicalName}"`);
      }
      seenNames.add(field.canonicalName);
    }

    // P3 — known parent object
    if (field.parentObject && !VALID_OBJECT_IDS.has(field.parentObject)) {
      errors.push(`Provisional field "${fid}": unknown parentObject "${field.parentObject}"`);
    }

    // P4 — valid data type
    if (field.dataType && !VALID_DATA_TYPES.has(field.dataType)) {
      errors.push(`Provisional field "${fid}": unknown dataType "${field.dataType}"`);
    }

    // P5 — status must be PROVISIONAL
    if (field.status !== 'PROVISIONAL') {
      errors.push(`Provisional field "${fid}": status must be "PROVISIONAL", got "${field.status}"`);
    }

    // P6 — domain must be null (no permanent domain)
    if (field.domain !== null && field.domain !== undefined) {
      errors.push(`Provisional field "${fid}": domain must be null (no permanent domain assigned), got "${field.domain}"`);
    }

    // P7 — at least one consumer
    if (!Array.isArray(field.consumers) || field.consumers.length === 0) {
      warnings.push(`Provisional field "${fid}": no consumers declared`);
    }

    // P8 — no ID collision with canonical fields
    if (field.id && canonicalIds.has(field.id)) {
      errors.push(`Provisional field "${fid}": ID collides with a canonical field ID`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
