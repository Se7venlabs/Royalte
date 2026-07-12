// Canonical Intelligence Platform(tm) -- Normalized Record™
//
// The Normalized Record is the constitutional output artifact of the
// Normalization Engine. It is the unit consumed by the Resolution Engine.
//
// Every successful normalization operation produces exactly one Normalized Record.
//
// The Normalized Record is:
//   - Immutable (Object.freeze)
//   - Uniquely identified (normalizedRecordId)
//   - Linked to its source Registry Record (registryRecordId)
//   - Linked to its companion Manifest (normalizationManifestId)
//   - Independently verifiable via deterministic fingerprint
//
// Chain of custody:
//   Evidence Registry Record
//     → Normalized Record™
//       → Resolution Record (Sprint 5)
//         → Canonical Record

import { randomUUID } from 'node:crypto';
import { NORMALIZATION_ENGINE_VERSION } from './version.js';
import { computeHash } from '../evidence/registry/hash.js';

// Compute a deterministic SHA-256 fingerprint of normalized evidence content.
// Uses the same canonicalStringify approach as the Evidence Registry (key-order independent).
export function computeNormalizationFingerprint(normalizedEvidence) {
  if (!normalizedEvidence || typeof normalizedEvidence !== 'object') {
    return 'null-evidence';
  }
  return computeHash(normalizedEvidence);
}

// Create an immutable Normalized Record™.
//
// params:
//   normalizedRecordId       -- UUID v4 for this record (required)
//   sourceEvidenceEnvelopeId -- Sprint 2 Evidence Envelope ID (may be null)
//   registryRecordId         -- Sprint 3 Registry Record ID (may be null)
//   normalizationManifestId  -- companion Manifest ID
//   normalizedEvidence       -- the normalized parsedEvidence object
//   engineVersion            -- from NORMALIZATION_ENGINE_VERSION.version
//   ruleVersions             -- { [ruleId]: version } for rules that made changes
//   createdAt                -- ISO timestamp
export function createNormalizedRecord({
  normalizedRecordId,
  sourceEvidenceEnvelopeId,
  registryRecordId,
  normalizationManifestId,
  normalizedEvidence,
  engineVersion,
  ruleVersions,
  createdAt,
}) {
  const fingerprint = computeNormalizationFingerprint(normalizedEvidence ?? {});

  return Object.freeze({
    normalizedRecordId:       normalizedRecordId       ?? randomUUID(),
    sourceEvidenceEnvelopeId: sourceEvidenceEnvelopeId ?? null,
    registryRecordId:         registryRecordId         ?? null,
    normalizationManifestId:  normalizationManifestId  ?? null,
    normalizedEvidence:       normalizedEvidence,
    normalizationFingerprint: fingerprint,
    engineVersion:            engineVersion ?? NORMALIZATION_ENGINE_VERSION.version,
    ruleVersions:             Object.freeze({ ...(ruleVersions ?? {}) }),
    createdAt:                createdAt ?? new Date().toISOString(),
  });
}
