// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Frozen constants shared by every module in api/registry/.
// All registry-level type strings originate here and nowhere else.
//
// Architecture (Sprint 1A Board corrections):
//
//   CANONICAL DOMAINS — own canonical fields; six domains
//   CONSUMER_WORKSPACES — never own fields; consume canonical intelligence only
//   OBJECT_CLASSES — classifies registry objects as Business / Platform / Derived
//
// Constitutional rule: no Consumer Workspace may own a canonical field.
// Validation in validate.js enforces this rule.
//
// ─────────────────────────────────────────────────────────────────────────────

// The six Canonical Intelligence Domains that own canonical fields.
// Executive Intelligence™ is a consumer workspace — it is NOT a domain here.
export const DOMAINS = Object.freeze({
  IDENTITY:      'Identity',
  RIGHTS:        'Music Rights',
  CATALOG:       'Catalog',
  DISTRIBUTION:  'Distribution Availability',
  MONITORING:    'Monitoring',
  SYSTEM_OPS:    'System Operations',
});

// Consumer Workspaces — read canonical fields, never own them.
// Included here for documentation and cross-reference in consumers[] arrays.
// These values must NEVER appear as the domain of any canonical field.
export const CONSUMER_WORKSPACES = Object.freeze({
  HEALTH:     'Health Intelligence',
  BACKEND:    'Backend Intelligence',
  ATHENA:     'ATHENA',
  OVERVIEW:   'Executive Overview',
  BRIEF:      'Executive Brief',
  AI:         'AI Insights',
});

// Registry object classification — distinguishes structural role of each object.
export const OBJECT_CLASSES = Object.freeze({
  BUSINESS:  'Business',   // core music-industry entities (Artist, Release, Work, etc.)
  PLATFORM:  'Platform',   // Royaltē platform infrastructure objects (Scan, EvidencePackage, etc.)
  DERIVED:   'Derived',    // computed or intelligence-generated objects (HealthIndicator, Alert, etc.)
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
  ACTIVE:      'ACTIVE',
  DEPRECATED:  'DEPRECATED',
  RESERVED:    'RESERVED',
  PROVISIONAL: 'PROVISIONAL',  // pending Board ratification; no permanent domain assigned
});

export const OBJECT_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

// O(1) sets for validation lookups — built once at load time.
export const VALID_DOMAINS              = new Set(Object.values(DOMAINS));
export const VALID_CONSUMER_WORKSPACES  = new Set(Object.values(CONSUMER_WORKSPACES));
export const VALID_OBJECT_CLASSES       = new Set(Object.values(OBJECT_CLASSES));
export const VALID_DATA_TYPES           = new Set(Object.values(DATA_TYPES));
export const VALID_RESOLUTION_POLICIES  = new Set(Object.values(RESOLUTION_POLICIES));
export const VALID_CONFIDENCE_POLICIES  = new Set(Object.values(CONFIDENCE_POLICIES));
export const VALID_FIELD_STATUSES       = new Set(Object.values(FIELD_STATUSES));
export const VALID_OBJECT_STATUSES      = new Set(Object.values(OBJECT_STATUSES));
