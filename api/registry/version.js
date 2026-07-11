// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Version
// ─────────────────────────────────────────────────────────────────────────────
//
// Single versioning record for the entire registry.
//
// Bump rules:
//   version        — increment on every Board-authorized registry change
//   schemaVersion  — increment only when the field-schema contract changes
//                    (property names, required properties, type constraints)
//   modifiedAt     — update to the merge date of every change PR
//
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_VERSION = Object.freeze({
  version:       '1.0.0',
  schemaVersion: '1.0.0',
  createdAt:     '2026-07-11',
  modifiedAt:    '2026-07-11',
  author:        'Royaltē Engineering',
});
