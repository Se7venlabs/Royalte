// Canonical Intelligence Platform(tm) -- Evidence Registry Version
//
// Single source of truth for Evidence Registry versioning.
// Registry version is independent from:
//   Evidence Contract framework version (api/evidence/version.js)
//   Provider versions
//   Connector versions
//   Contract versions

export const REGISTRY_VERSION = Object.freeze({
  version:       '1.0.0',
  name:          'Evidence Registry',
  sprint:        'Sprint 3 -- Evidence Registry(tm)',
  registryId:    'evidence-registry-v1',
  effectiveDate: '2026-07-11',
});

// The version of the Evidence Envelope transport schema structure.
// Tracks the envelope shape itself, not the contract or provider version.
export const ENVELOPE_SCHEMA_VERSION = '1.0.0';

// The storage format version for registry records.
// Bump when the on-disk/in-memory record structure changes.
export const STORAGE_VERSION = '1.0.0';
