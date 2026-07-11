// Canonical Intelligence Platform(tm) -- Evidence Registry Type Definitions
//
// Registry-level enums and constants.
//
// IMPORTANT: Registry record statuses are separate from Evidence Statuses
// defined in api/evidence/types.js. Do not conflate the two.
//
//   Evidence Status  -- what happened when the connector queried a provider
//                       (FOUND, NOT_FOUND, ERROR, etc.)
//   Registry Status  -- what the registry knows about this stored record
//                       (ACTIVE, SUPERSEDED, QUARANTINED, etc.)

// Registry-level record statuses.
export const REGISTRY_RECORD_STATUSES = Object.freeze({
  ACTIVE:      'ACTIVE',       // record is the current authoritative record for this evidence
  SUPERSEDED:  'SUPERSEDED',   // replaced by a newer record; original preserved
  CORRECTED:   'CORRECTED',    // a correction record exists; original preserved
  REPLAY:      'REPLAY',       // a replay of a prior evidence record
  REJECTED:    'REJECTED',     // failed validation; never entered active registry
  QUARANTINED: 'QUARANTINED',  // invalid; stored for audit only; excluded from active queries
  ARCHIVED:    'ARCHIVED',     // intentionally retired; preserved for historical audit
});

// Deduplication classifications assigned during registration.
export const DEDUPLICATION_CLASSIFICATIONS = Object.freeze({
  UNIQUE:              'UNIQUE',              // no prior record matches this fingerprint
  EXACT_DUPLICATE:     'EXACT_DUPLICATE',     // identical fingerprint already active
  POTENTIAL_DUPLICATE: 'POTENTIAL_DUPLICATE', // partial match -- flagged for review
  REPLAY:              'REPLAY',              // explicitly authorized replay of prior evidence
  CORRECTION:          'CORRECTION',          // explicitly authorized correction of prior evidence
  SUPERSEDING_RECORD:  'SUPERSEDING_RECORD',  // explicitly authorized replacement record
});

// Error codes used in rejection receipts.
export const REGISTRY_ERROR_CODES = Object.freeze({
  INVALID_ENVELOPE:       'INVALID_ENVELOPE',
  INVALID_EVIDENCE:       'INVALID_EVIDENCE',
  UNKNOWN_PROVIDER:       'UNKNOWN_PROVIDER',
  UNKNOWN_CONTRACT:       'UNKNOWN_CONTRACT',
  DUPLICATE_ENVELOPE_ID:  'DUPLICATE_ENVELOPE_ID',
  EXACT_DUPLICATE:        'EXACT_DUPLICATE',
  VALIDATION_FAILED:      'VALIDATION_FAILED',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  IMMUTABILITY_VIOLATION: 'IMMUTABILITY_VIOLATION',
  INTERNAL_ERROR:         'INTERNAL_ERROR',
});

// Registry Event Log(tm) event types.
// Each event represents one step in the lifecycle of a registry record.
// The Event Log is independent from Evidence Status and Registry Status.
export const REGISTRY_EVENT_TYPES = Object.freeze({
  REGISTERED:  'REGISTERED',   // record accepted and stored
  VALIDATED:   'VALIDATED',    // validation result attached
  QUARANTINED: 'QUARANTINED',  // record moved to quarantine
  REPLAYED:    'REPLAYED',     // record submitted for replay processing
  CORRECTED:   'CORRECTED',    // a correction record was created referencing this one
  SUPERSEDED:  'SUPERSEDED',   // a superseding record was created; this one retired
  ARCHIVED:    'ARCHIVED',     // intentionally retired; preserved for audit
  // Reserved for future sprints -- no implementation logic in Sprint 3.
  READ:        'READ',         // reserved: governance / administrative access logging
  RESTORED:    'RESTORED',     // reserved: archived or quarantined record explicitly restored
});

// -- O(1) validation sets ----------------------------------------------------

export const VALID_REGISTRY_RECORD_STATUSES      = new Set(Object.values(REGISTRY_RECORD_STATUSES));
export const VALID_DEDUPLICATION_CLASSIFICATIONS  = new Set(Object.values(DEDUPLICATION_CLASSIFICATIONS));
export const VALID_REGISTRY_ERROR_CODES           = new Set(Object.values(REGISTRY_ERROR_CODES));
export const VALID_REGISTRY_EVENT_TYPES           = new Set(Object.values(REGISTRY_EVENT_TYPES));
