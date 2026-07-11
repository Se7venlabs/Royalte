// Canonical Intelligence Platform(tm) -- Evidence Registry Write Service
//
// The single constitutional write path for Evidence Registry operations.
// No connector or downstream service may write directly to storage.
//
// registerEvidenceEnvelope(envelope, adapter, options) is the sole entry point.
//
// Write path:
//   1. Confirm the envelope exists and is an object
//   2. Validate the envelope structure (Sprint 2 validateEnvelope)
//   3. Validate the contained parsedEvidence (Sprint 2 validateEvidence)
//   4. Confirm the provider is registered
//   5. Confirm the contract is registered
//   6. Confirm the sourceEnvelopeId is unique (not already registered)
//   7. Apply deduplication policy
//   8. Compute payload hashes
//   9. Create the immutable registry record
//  10. Validate the registry record
//  11. Persist the record
//  12. Return a registry receipt

import { randomUUID } from 'node:crypto';

import { validateEvidence, validateEnvelope, getContract } from '../index.js';
import { VALID_PROVIDER_IDS }           from '../providers.js';
import { EVIDENCE_VERSION }             from '../version.js';
import { REGISTRY_VERSION, ENVELOPE_SCHEMA_VERSION, STORAGE_VERSION } from './version.js';
import { REGISTRY_RECORD_STATUSES, REGISTRY_ERROR_CODES, DEDUPLICATION_CLASSIFICATIONS } from './types.js';
import { computeRawPayloadHash, computeParsedEvidenceHash } from './hash.js';
import { computeFingerprint, classifyDeduplication }        from './deduplication.js';
import { createAuditMetadata, createEvent }                  from './audit.js';
import { REGISTRY_EVENT_TYPES }                              from './types.js';
import { validateRegistryRecord }                            from './validate.js';

const { ACTIVE, REJECTED, QUARANTINED } = REGISTRY_RECORD_STATUSES;
const { EXACT_DUPLICATE, UNIQUE, POTENTIAL_DUPLICATE } = DEDUPLICATION_CLASSIFICATIONS;

// Build a rejection receipt (safe -- never includes raw provider payloads).
function buildRejectionReceipt(code, message, validationErrors, evidenceEnvelopeId) {
  return Object.freeze({
    accepted:           false,
    evidenceEnvelopeId: evidenceEnvelopeId ?? null,
    errorCode:          code,
    errorMessage:       message,
    validationErrors:   Object.freeze([...(validationErrors ?? [])]),
    rejectedAt:         new Date().toISOString(),
  });
}

// Build a success receipt.
function buildReceipt(record, deduplicationStatus) {
  return Object.freeze({
    accepted:             true,
    registryRecordId:     record.registryRecordId,
    evidenceEnvelopeId:   record.evidenceEnvelopeId,
    sourceEnvelopeId:     record.sourceEnvelopeId,
    scanId:               record.scanId,
    artistId:             record.artistId,
    providerId:           record.providerId,
    contractId:           record.contractId,
    registeredAt:         record.registeredAt,
    validationStatus:     record.validationResult?.valid ? 'PASSED' : 'WARNED',
    deduplicationStatus:  deduplicationStatus,
    recordStatus:         record.recordStatus,
    storageVersion:       record.storageVersion,
  });
}

// Register a validated Evidence Envelope in the registry.
//
// options:
//   storageAdapterId   -- string identifier of the adapter (default: 'memory')
//   registeredBy       -- identity of the registrant (default: 'royalte-system')
//   registrationSource -- source of the call (default: 'evidence-registry-v1')
//   intent             -- 'replay' | 'correction' | 'superseding' | null
//   quarantineOnInvalid -- if true, invalid evidence is quarantined rather than rejected
//   supersedesEvidenceEnvelopeId  -- for superseding records
//   correctionOfEvidenceEnvelopeId -- for correction records
//   replayOfEvidenceEnvelopeId    -- for replay records
//   parentEvidenceEnvelopeId      -- for lineage records
export function registerEvidenceEnvelope(envelope, adapter, options = {}) {
  const now = new Date().toISOString();

  // Step 1 -- envelope must be a non-null object
  if (!envelope || typeof envelope !== 'object') {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.INVALID_ENVELOPE,
      'Evidence envelope must be a non-null object',
      [],
      null
    );
  }

  // Step 2 -- validate envelope structure
  const envelopeValidation = validateEnvelope(envelope);
  if (!envelopeValidation.valid) {
    const receipt = buildRejectionReceipt(
      REGISTRY_ERROR_CODES.INVALID_ENVELOPE,
      'Evidence envelope failed structural validation',
      envelopeValidation.errors,
      null
    );
    if (options.quarantineOnInvalid) {
      const rejRecord = _buildRawRecord(envelope, REJECTED, UNIQUE, '', '', null, null, null, options, now);
      adapter.quarantine(rejRecord, envelopeValidation);
    }
    return receipt;
  }

  // Step 3 -- validate parsedEvidence
  if (envelope.parsedEvidence !== null) {
    const evidenceValidation = validateEvidence(envelope.parsedEvidence);
    if (!evidenceValidation.valid) {
      const receipt = buildRejectionReceipt(
        REGISTRY_ERROR_CODES.INVALID_EVIDENCE,
        'Parsed evidence failed contract validation',
        evidenceValidation.errors,
        null
      );
      if (options.quarantineOnInvalid) {
        const rejRecord = _buildRawRecord(envelope, QUARANTINED, UNIQUE, '', '', null, null, null, options, now);
        adapter.quarantine(rejRecord, evidenceValidation);
      }
      return receipt;
    }
  }

  // Step 4 -- confirm provider is registered
  if (!VALID_PROVIDER_IDS.has(envelope.provider?.id)) {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.UNKNOWN_PROVIDER,
      `Provider "${envelope.provider?.id}" is not registered`,
      [],
      null
    );
  }

  // Step 5 -- confirm contract is registered
  const contract = getContract(envelope.contractId);
  if (!contract) {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.UNKNOWN_CONTRACT,
      `Contract "${envelope.contractId}" is not registered`,
      [],
      null
    );
  }

  // Step 6 -- sourceEnvelopeId must be unique
  const sourceEnvelopeId = envelope.envelopeId ?? null;
  if (sourceEnvelopeId && adapter.sourceEnvelopeIdExists(sourceEnvelopeId)) {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.DUPLICATE_ENVELOPE_ID,
      `Envelope "${sourceEnvelopeId}" has already been registered`,
      [],
      null
    );
  }

  // Step 7 -- deduplication policy
  const rawPayloadHash       = computeRawPayloadHash(envelope.rawPayload);
  const parsedEvidenceHash   = computeParsedEvidenceHash(envelope.parsedEvidence);
  const existingFingerprints = adapter.getActiveFingerprints();
  const existingPartials     = adapter.getActivePartialFingerprints();

  const dedupResult = classifyDeduplication(
    envelope,
    rawPayloadHash,
    existingFingerprints,
    existingPartials,
    { intent: options.intent ?? null }
  );

  // Reject exact duplicates unless explicitly authorized as replay/correction.
  if (dedupResult.classification === EXACT_DUPLICATE) {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.EXACT_DUPLICATE,
      `Exact duplicate of evidence "${dedupResult.matchedEvidenceEnvelopeId}"`,
      [],
      null
    );
  }

  // Step 8 -- hashes already computed above

  // Steps 9-10 -- create and validate the registry record
  const evidenceEnvelopeId = randomUUID();
  const registryRecordId   = randomUUID();
  const registeredAt       = now;
  const adapterId          = options.storageAdapterId ?? 'memory';

  const auditMetadata = createAuditMetadata(
    envelope,
    rawPayloadHash,
    parsedEvidenceHash,
    adapterId,
    options.registeredBy,
    options.registrationSource
  );

  const registeredEvent = createEvent(
    REGISTRY_EVENT_TYPES.REGISTERED,
    options.registeredBy       ?? 'royalte-system',
    options.registrationSource ?? 'evidence-registry-v1',
    null,
    { deduplicationStatus: dedupResult.classification }
  );

  const record = Object.freeze({
    registryRecordId,
    evidenceEnvelopeId,
    sourceEnvelopeId,
    envelopeSchemaVersion:    envelope.metadata?.envelopeVersion ?? ENVELOPE_SCHEMA_VERSION,
    contractId:               envelope.contractId        ?? null,
    contractVersion:          envelope.contractVersion   ?? null,
    providerId:               envelope.provider?.id      ?? null,
    providerVersion:          envelope.provider?.version ?? null,
    connectorId:              envelope.connector?.id     ?? null,
    connectorVersion:         envelope.connector?.version ?? null,
    scanId:                   envelope.trace?.scanId     ?? null,
    artistId:                 envelope.trace?.artistId   ?? null,
    correlationId:            envelope.trace?.correlationId ?? null,
    evidenceCategory:         contract.category,
    evidenceStatus:           envelope.parsedEvidence?.evidenceStatus ?? 'UNKNOWN',
    evidenceConfidence:       envelope.parsedEvidence?.confidence     ?? 'UNKNOWN',
    retrievedAt:              envelope.timestamps?.requestedAt  ?? null,
    receivedAt:               envelope.timestamps?.receivedAt   ?? null,
    parsedAt:                 envelope.timestamps?.parsedAt     ?? null,
    envelopedAt:              envelope.timestamps?.envelopedAt  ?? null,
    registeredAt,
    rawPayload:               envelope.rawPayload      ?? null,
    parsedEvidence:           envelope.parsedEvidence  ? Object.freeze({ ...envelope.parsedEvidence }) : null,
    validationResult:         Object.freeze({ ...envelope.validation }),
    auditMetadata,
    recordStatus:             ACTIVE,
    deduplicationStatus:      dedupResult.classification,
    deduplicationFingerprint:        dedupResult.fingerprint,
    deduplicationPartialFingerprint: dedupResult.partialFingerprint,
    rawPayloadHash,
    parsedEvidenceHash,
    storageVersion:           STORAGE_VERSION,
    // Lineage fields
    supersedesEvidenceEnvelopeId:   options.supersedesEvidenceEnvelopeId   ?? null,
    supersededByEvidenceEnvelopeId: null,
    replayOfEvidenceEnvelopeId:     options.replayOfEvidenceEnvelopeId     ?? null,
    correctionOfEvidenceEnvelopeId: options.correctionOfEvidenceEnvelopeId ?? null,
    parentEvidenceEnvelopeId:       options.parentEvidenceEnvelopeId       ?? null,
    eventLog:                       Object.freeze([registeredEvent]),
  });

  const recordValidation = validateRegistryRecord(record);
  if (!recordValidation.valid) {
    return buildRejectionReceipt(
      REGISTRY_ERROR_CODES.VALIDATION_FAILED,
      'Registry record failed internal validation',
      recordValidation.errors,
      evidenceEnvelopeId
    );
  }

  // Step 11 -- persist
  adapter.insert(record);

  // If this supersedes a prior record, update its lineage.
  if (options.supersedesEvidenceEnvelopeId) {
    try {
      adapter.updateLineage(options.supersedesEvidenceEnvelopeId, {
        supersededByEvidenceEnvelopeId: evidenceEnvelopeId,
        recordStatus:                   REGISTRY_RECORD_STATUSES.SUPERSEDED,
      });
    } catch (_err) {
      // Prior record may not exist in this adapter instance; non-fatal.
    }
  }

  // Step 12 -- receipt
  return buildReceipt(record, dedupResult.classification);
}

// Internal helper -- builds a raw (possibly invalid) record for quarantine.
function _buildRawRecord(envelope, status, dedup, fingerprint, partialFingerprint, rawHash, parsedHash, auditMeta, options, now) {
  return {
    evidenceEnvelopeId:              randomUUID(),
    sourceEnvelopeId:                envelope.envelopeId ?? null,
    envelopeSchemaVersion:           ENVELOPE_SCHEMA_VERSION,
    contractId:                      envelope.contractId        ?? null,
    contractVersion:                 envelope.contractVersion   ?? null,
    providerId:                      envelope.provider?.id      ?? null,
    providerVersion:                 envelope.provider?.version ?? null,
    connectorId:                     envelope.connector?.id     ?? null,
    connectorVersion:                envelope.connector?.version ?? null,
    scanId:                          envelope.trace?.scanId     ?? null,
    artistId:                        envelope.trace?.artistId   ?? null,
    correlationId:                   envelope.trace?.correlationId ?? null,
    evidenceCategory:                null,
    evidenceStatus:                  envelope.parsedEvidence?.evidenceStatus ?? 'UNKNOWN',
    evidenceConfidence:              envelope.parsedEvidence?.confidence     ?? 'UNKNOWN',
    retrievedAt:                     envelope.timestamps?.requestedAt  ?? null,
    receivedAt:                      envelope.timestamps?.receivedAt   ?? null,
    parsedAt:                        envelope.timestamps?.parsedAt     ?? null,
    envelopedAt:                     envelope.timestamps?.envelopedAt  ?? null,
    registeredAt:                    now,
    rawPayload:                      null,
    parsedEvidence:                  null,
    validationResult:                null,
    auditMetadata:                   auditMeta,
    recordStatus:                    status,
    deduplicationStatus:             dedup,
    deduplicationFingerprint:        fingerprint,
    deduplicationPartialFingerprint: partialFingerprint,
    rawPayloadHash:                  rawHash   ?? 'null-payload',
    parsedEvidenceHash:              parsedHash ?? 'null-evidence',
    storageVersion:                  STORAGE_VERSION,
    supersedesEvidenceEnvelopeId:    null,
    supersededByEvidenceEnvelopeId:  null,
    replayOfEvidenceEnvelopeId:      null,
    correctionOfEvidenceEnvelopeId:  null,
    parentEvidenceEnvelopeId:        null,
  };
}
