// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Loader
// ─────────────────────────────────────────────────────────────────────────────
//
// THE ONLY mechanism for loading canonical registry definitions.
// Every future service retrieves definitions from this module.
// No duplicate registry definitions should exist anywhere else.
//
// Public API:
//
//   REGISTRY
//     .version       — REGISTRY_VERSION metadata object
//     .objects       — frozen array of all Canonical Objects
//     .fields        — frozen array of all Canonical Fields (all domains)
//     .fieldsByDomain — Map<domain string → field[]>
//     .fieldsByObject — Map<parentObject string → field[]>
//
//   getField(id)
//     Returns the canonical field for a given stable field ID.
//     Returns undefined if not found.
//
//   getFieldsByDomain(domain)
//     Returns all fields for the given domain string.
//     Returns [] for an unknown domain.
//
//   getFieldsByObject(parentObject)
//     Returns all fields for the given canonical object ID.
//     Returns [] for an unknown object.
//
// Startup contract:
//   If the registry fails validation, this module throws at import time.
//   A broken registry is a broken platform — nothing should run.
//
// ─────────────────────────────────────────────────────────────────────────────

import { REGISTRY_VERSION }    from './version.js';
import { CANONICAL_OBJECTS }   from './objects.js';
import { IDENTITY_FIELDS }     from './fields/identity.js';
import { RIGHTS_FIELDS }       from './fields/rights.js';
import { CATALOG_FIELDS }      from './fields/catalog.js';
import { DISTRIBUTION_FIELDS } from './fields/distribution.js';
import { BACKEND_FIELDS }      from './fields/backend.js';
import { MONITORING_FIELDS }   from './fields/monitoring.js';
import { validateRegistry }    from './validate.js';

// ── Aggregate all fields in stable domain order ────────────────────────────
const ALL_FIELDS = Object.freeze([
  ...IDENTITY_FIELDS,
  ...RIGHTS_FIELDS,
  ...CATALOG_FIELDS,
  ...DISTRIBUTION_FIELDS,
  ...BACKEND_FIELDS,
  ...MONITORING_FIELDS,
]);

// ── Run validation at load time — broken registry = startup failure ─────────
const { valid, errors, warnings } = validateRegistry(CANONICAL_OBJECTS, ALL_FIELDS);

if (warnings.length > 0) {
  for (const w of warnings) {
    console.warn(`[registry] WARNING: ${w}`);
  }
}

if (!valid) {
  const message = [
    '[registry] FATAL: Canonical Registry validation failed — platform cannot start.',
    ...errors.map((e) => `  • ${e}`),
  ].join('\n');
  throw new Error(message);
}

// ── Build lookup indexes ───────────────────────────────────────────────────

const fieldById = new Map(ALL_FIELDS.map((f) => [f.id, f]));

const fieldsByDomain = new Map();
for (const field of ALL_FIELDS) {
  if (!fieldsByDomain.has(field.domain)) fieldsByDomain.set(field.domain, []);
  fieldsByDomain.get(field.domain).push(field);
}

const fieldsByObject = new Map();
for (const field of ALL_FIELDS) {
  if (!fieldsByObject.has(field.parentObject)) fieldsByObject.set(field.parentObject, []);
  fieldsByObject.get(field.parentObject).push(field);
}

// ── Public accessor functions ──────────────────────────────────────────────

export function getField(id) {
  return fieldById.get(id);
}

export function getFieldsByDomain(domain) {
  return fieldsByDomain.get(domain) ?? [];
}

export function getFieldsByObject(parentObject) {
  return fieldsByObject.get(parentObject) ?? [];
}

// ── Exported REGISTRY — the canonical read-only interface ─────────────────

export const REGISTRY = Object.freeze({
  version:        REGISTRY_VERSION,
  objects:        CANONICAL_OBJECTS,
  fields:         ALL_FIELDS,
  fieldsByDomain: Object.freeze(Object.fromEntries(fieldsByDomain)),
  fieldsByObject: Object.freeze(Object.fromEntries(fieldsByObject)),
});
