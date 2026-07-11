// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Evidence Contract Type Definitions
// ─────────────────────────────────────────────────────────────────────────────
//
// Constitutional enums for the Evidence Contract layer.
// These are evidence-level concepts. They are NOT canonical-level concepts.
//
// Canonical confidence and canonical domain resolution are computed later
// by the Resolution Engine using inputs from these evidence values.
//
// ─────────────────────────────────────────────────────────────────────────────

// Evidence lifecycle status — what happened when the connector queried a provider.
export const EVIDENCE_STATUSES = Object.freeze({
  UNKNOWN:         'UNKNOWN',          // not yet evaluated
  FOUND:           'FOUND',            // provider returned a match
  NOT_FOUND:       'NOT_FOUND',        // provider was queried; no match exists
  UNVERIFIED:      'UNVERIFIED',       // provider returned data but confidence is insufficient to confirm
  CONFLICT:        'CONFLICT',         // provider returned data that conflicts with another source
  ERROR:           'ERROR',            // connector encountered an error (network, auth, API failure)
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',  // a human manually supplied or corrected this evidence
});

// Evidence confidence — how much to trust this provider's evidence.
// These are per-evidence confidence levels; canonical confidence is derived
// later by the Resolution Engine from multiple evidence inputs.
export const EVIDENCE_CONFIDENCES = Object.freeze({
  UNKNOWN:  'UNKNOWN',   // not assessed
  LOW:      'LOW',       // source is weakly reliable or partially matching
  MEDIUM:   'MEDIUM',    // source is generally reliable; not ISRC-verified
  HIGH:     'HIGH',      // source is strongly reliable; provider trust ≥ 80
  VERIFIED: 'VERIFIED',  // cross-verified via ISRC or equivalent canonical identifier
});

// Evidence categories — aligns with the six Canonical Domains from Sprint 1.
// Each Evidence Contract belongs to exactly one category.
export const EVIDENCE_CATEGORIES = Object.freeze({
  IDENTITY:     'Identity',
  RIGHTS:       'Rights',
  CATALOG:      'Catalog',
  DISTRIBUTION: 'Distribution',
  MONITORING:   'Monitoring',
  OPERATIONS:   'Operations',
});

// Provider categories — the type of data a provider primarily contributes.
export const PROVIDER_CATEGORIES = Object.freeze({
  STREAMING:    'Streaming',      // DSPs: Apple Music, Spotify, Deezer, TIDAL, YouTube
  METADATA:     'Metadata',       // open-data: MusicBrainz, Discogs, TheAudioDB, Last.fm
  PUBLISHING:   'Publishing',     // rights/publishing orgs: MLC, SOCAN, ASCAP, BMI
  DISTRIBUTION: 'Distribution',  // distributors (future)
  RIGHTS:       'Rights',         // neighbouring rights orgs: SoundExchange
  INTERNAL:     'Internal',       // first-party Royaltē sources: Manual Override, Verified Profile
});

// Evidence field data types — used in contract field definitions.
export const EVIDENCE_DATA_TYPES = Object.freeze({
  STRING:  'string',
  NUMBER:  'number',
  BOOLEAN: 'boolean',
  URL:     'url',
  DATE:    'date',
  ARRAY:   'array',
  OBJECT:  'object',
});

// Contract and provider statuses.
export const ENTITY_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

// ── O(1) validation sets — built once at load time ───────────────────────────

export const VALID_EVIDENCE_STATUSES     = new Set(Object.values(EVIDENCE_STATUSES));
export const VALID_EVIDENCE_CONFIDENCES  = new Set(Object.values(EVIDENCE_CONFIDENCES));
export const VALID_EVIDENCE_CATEGORIES   = new Set(Object.values(EVIDENCE_CATEGORIES));
export const VALID_PROVIDER_CATEGORIES   = new Set(Object.values(PROVIDER_CATEGORIES));
export const VALID_EVIDENCE_DATA_TYPES   = new Set(Object.values(EVIDENCE_DATA_TYPES));
export const VALID_ENTITY_STATUSES       = new Set(Object.values(ENTITY_STATUSES));
