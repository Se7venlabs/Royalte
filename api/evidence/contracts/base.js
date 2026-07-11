// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Base Evidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the required metadata every evidence package must carry,
// regardless of provider or category.
//
// Every canonical Evidence Contract inherits these base fields.
// A connector that cannot populate a required base field must return
// evidenceStatus: 'ERROR' rather than omitting the field.
//
// Base field shape:
//   id            — stable field identifier used by the validation engine
//   displayName   — human-readable label
//   dataType      — evidence data type (see EVIDENCE_DATA_TYPES in types.js)
//   required      — if true, omission is a validation error
//   description   — what this field represents
//
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_CONTRACT_FIELDS = Object.freeze([
  {
    id:          'contractId',
    displayName: 'Contract ID',
    dataType:    'string',
    required:    true,
    description: 'Stable identifier of the Evidence Contract this package satisfies.',
  },
  {
    id:          'provider',
    displayName: 'Provider',
    dataType:    'string',
    required:    true,
    description: 'Stable provider ID from the Provider Registry (e.g. "apple-music", "spotify").',
  },
  {
    id:          'providerVersion',
    displayName: 'Provider Version',
    dataType:    'string',
    required:    true,
    description: 'Version of the provider API targeted by the connector that produced this evidence.',
  },
  {
    id:          'connectorVersion',
    displayName: 'Connector Version',
    dataType:    'string',
    required:    true,
    description: 'Semver version of the Royaltē connector that produced this evidence package.',
  },
  {
    id:          'retrievedAt',
    displayName: 'Retrieved At',
    dataType:    'date',
    required:    true,
    description: 'ISO 8601 timestamp of when this evidence was retrieved from the provider.',
  },
  {
    id:          'scanId',
    displayName: 'Scan ID',
    dataType:    'string',
    required:    true,
    description: 'The Royaltē Scan ID that triggered this evidence retrieval.',
  },
  {
    id:          'artistId',
    displayName: 'Artist ID',
    dataType:    'string',
    required:    true,
    description: 'The Royaltē artist identifier for the artist this evidence describes.',
  },
  {
    id:          'confidence',
    displayName: 'Confidence',
    dataType:    'string',
    required:    true,
    description: 'Evidence confidence level: UNKNOWN | LOW | MEDIUM | HIGH | VERIFIED.',
  },
  {
    id:          'rawReference',
    displayName: 'Raw Reference',
    dataType:    'string',
    required:    true,
    description: 'A reference to the raw provider response (e.g. internal storage key). May be null if not stored.',
  },
  {
    id:          'sourceUrl',
    displayName: 'Source URL',
    dataType:    'url',
    required:    true,
    description: 'The URL queried to retrieve this evidence. May be null if evidence came from an internal source.',
  },
  {
    id:          'evidenceStatus',
    displayName: 'Evidence Status',
    dataType:    'string',
    required:    true,
    description: 'Evidence lifecycle status: UNKNOWN | FOUND | NOT_FOUND | UNVERIFIED | CONFLICT | ERROR | MANUAL_OVERRIDE.',
  },
  {
    id:          'contractVersion',
    displayName: 'Contract Version',
    dataType:    'string',
    required:    true,
    description: 'Semver version of the Evidence Contract definition this package was built against.',
  },
]);

// The set of required base field IDs for O(1) validation.
export const REQUIRED_BASE_FIELD_IDS = new Set(
  BASE_CONTRACT_FIELDS.filter((f) => f.required).map((f) => f.id)
);
