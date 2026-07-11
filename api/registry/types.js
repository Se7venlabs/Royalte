// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Frozen constants shared by every module in api/registry/.
// All registry-level type strings originate here and nowhere else.
//
// Constitutional rule: Executive Intelligence never owns fields.
// Validation in validate.js enforces this against DOMAINS.EXECUTIVE.
//
// ─────────────────────────────────────────────────────────────────────────────

export const DOMAINS = Object.freeze({
  IDENTITY:     'Identity',
  RIGHTS:       'Music Rights',
  CATALOG:      'Catalog',
  DISTRIBUTION: 'Global Distribution',
  BACKEND:      'Backend Verification',
  MONITORING:   'Monitoring',
  EXECUTIVE:    'Executive Intelligence',   // consumer-only; no field may declare this as its owning domain
});

export const DATA_TYPES = Object.freeze({
  STRING:  'string',
  NUMBER:  'number',
  BOOLEAN: 'boolean',
  URL:     'url',
  DATE:    'date',
  ENUM:    'enum',
  ARRAY:   'array',
  OBJECT:  'object',
  PERCENT: 'percent',
});

// How conflicting values from multiple evidence sources are resolved.
export const RESOLUTION_POLICIES = Object.freeze({
  CANONICAL_SOURCE:   'CANONICAL_SOURCE',   // single authoritative source wins
  HIGHEST_CONFIDENCE: 'HIGHEST_CONFIDENCE', // highest-confidence value wins
  MOST_RECENT:        'MOST_RECENT',        // most recently updated value wins
  AGGREGATED:         'AGGREGATED',         // values combined from multiple sources
  DERIVED:            'DERIVED',            // value computed from other canonical fields
});

// How confidence is calculated for a resolved field value.
export const CONFIDENCE_POLICIES = Object.freeze({
  PROVIDER_TRUST:     'PROVIDER_TRUST',     // weighted by provider constitutional trust score
  VERIFICATION_COUNT: 'VERIFICATION_COUNT', // verified source count / total provider count
  ISRC_VERIFIED:      'ISRC_VERIFIED',      // confirmed via ISRC cross-reference
  STATIC:             'STATIC',             // fixed; no confidence calculation
});

export const FIELD_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

export const OBJECT_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

// O(1) sets for validation lookups — built once, never rebuilt.
export const VALID_DOMAINS              = new Set(Object.values(DOMAINS));
export const VALID_DATA_TYPES           = new Set(Object.values(DATA_TYPES));
export const VALID_RESOLUTION_POLICIES  = new Set(Object.values(RESOLUTION_POLICIES));
export const VALID_CONFIDENCE_POLICIES  = new Set(Object.values(CONFIDENCE_POLICIES));
export const VALID_FIELD_STATUSES       = new Set(Object.values(FIELD_STATUSES));
export const VALID_OBJECT_STATUSES      = new Set(Object.values(OBJECT_STATUSES));
