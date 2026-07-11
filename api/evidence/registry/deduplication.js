// Canonical Intelligence Platform(tm) -- Evidence Registry Deduplication
//
// Determines whether an incoming Evidence Envelope is a unique, duplicate,
// potential duplicate, replay, correction, or superseding record.
//
// Deduplication does NOT resolve evidence conflicts.
// It prevents the same physical evidence from being registered twice
// without explicit authorization.
//
// Fingerprint inputs:
//   providerId + contractId + scanId + artistId + rawPayloadHash +
//   connectorVersion + retrievedAt
//
// Two envelopes with identical fingerprints represent the same provider
// response from the same connector run. Storing them twice would corrupt
// the historical record.

import { DEDUPLICATION_CLASSIFICATIONS } from './types.js';
import { computeHash } from './hash.js';

const {
  UNIQUE,
  EXACT_DUPLICATE,
  POTENTIAL_DUPLICATE,
  REPLAY,
  CORRECTION,
  SUPERSEDING_RECORD,
} = DEDUPLICATION_CLASSIFICATIONS;

// Compute a deterministic deduplication fingerprint for an incoming envelope.
// The fingerprint combines the inputs that uniquely identify a connector run.
// rawPayloadHash must be pre-computed before calling this function.
export function computeFingerprint(envelope, rawPayloadHash) {
  const parts = [
    envelope.provider?.id         ?? '',
    envelope.contractId           ?? '',
    envelope.trace?.scanId        ?? '',
    envelope.trace?.artistId      ?? '',
    rawPayloadHash                 ?? '',
    envelope.connector?.version   ?? '',
    envelope.timestamps?.requestedAt ?? '',
  ];
  return computeHash(parts.join(':'));
}

// Partial fingerprint omits rawPayloadHash and connectorVersion.
// Used to detect potential duplicates where the payload changed but the
// scan, artist, provider, and contract are the same.
function computePartialFingerprint(envelope) {
  const parts = [
    envelope.provider?.id        ?? '',
    envelope.contractId          ?? '',
    envelope.trace?.scanId       ?? '',
    envelope.trace?.artistId     ?? '',
  ];
  return computeHash(parts.join(':partial:'));
}

// Classify the deduplication status of an incoming envelope.
//
// params:
//   envelope        -- the incoming Evidence Envelope
//   rawPayloadHash  -- pre-computed hash of envelope.rawPayload
//   existingFingerprints  -- Map<fingerprint, evidenceEnvelopeId> from adapter
//   existingPartials      -- Map<partialFingerprint, evidenceEnvelopeId[]> from adapter
//   registrationOptions   -- { intent: 'replay' | 'correction' | 'superseding' | null }
//
// Returns:
//   { classification, fingerprint, partialFingerprint, matchedEvidenceEnvelopeId }
export function classifyDeduplication(envelope, rawPayloadHash, existingFingerprints, existingPartials, registrationOptions = {}) {
  const fingerprint        = computeFingerprint(envelope, rawPayloadHash);
  const partialFingerprint = computePartialFingerprint(envelope);

  // Explicitly authorized special-case registrations take priority.
  const intent = registrationOptions.intent ?? null;
  if (intent === 'replay') {
    return { classification: REPLAY, fingerprint, partialFingerprint, matchedEvidenceEnvelopeId: null };
  }
  if (intent === 'correction') {
    return { classification: CORRECTION, fingerprint, partialFingerprint, matchedEvidenceEnvelopeId: null };
  }
  if (intent === 'superseding') {
    return { classification: SUPERSEDING_RECORD, fingerprint, partialFingerprint, matchedEvidenceEnvelopeId: null };
  }

  // Exact duplicate: full fingerprint already registered.
  if (existingFingerprints.has(fingerprint)) {
    return {
      classification:            EXACT_DUPLICATE,
      fingerprint,
      partialFingerprint,
      matchedEvidenceEnvelopeId: existingFingerprints.get(fingerprint),
    };
  }

  // Potential duplicate: same provider+contract+scan+artist but different payload.
  if (existingPartials.has(partialFingerprint)) {
    const matches = existingPartials.get(partialFingerprint);
    return {
      classification:            POTENTIAL_DUPLICATE,
      fingerprint,
      partialFingerprint,
      matchedEvidenceEnvelopeId: matches[0] ?? null,
    };
  }

  return { classification: UNIQUE, fingerprint, partialFingerprint, matchedEvidenceEnvelopeId: null };
}
