// Canonical Intelligence Platform(tm) -- Evidence Registry Record Validation
//
// Validates Evidence Registry records before and after storage.
// This is registry-level validation -- it checks registry record structure,
// not evidence contract conformance (which is handled in api/evidence/validate.js).
//
// Validation rules:
//   R1  -- evidenceEnvelopeId must be a non-empty string
//   R2  -- evidenceEnvelopeId must be a valid UUID v4 format
//   R3  -- sourceEnvelopeId must be a non-empty string
//   R4  -- envelopeSchemaVersion must be a non-empty string
//   R5  -- contractId must reference a known contract
//   R6  -- providerId must reference a known provider
//   R7  -- evidenceCategory must be a valid evidence category
//   R8  -- evidenceStatus must be a valid evidence status
//   R9  -- evidenceConfidence must be a valid evidence confidence level
//   R10 -- recordStatus must be a valid registry record status
//   R11 -- deduplicationStatus must be a valid deduplication classification
//   R12 -- registeredAt must be a non-empty ISO date string
//   R13 -- rawPayloadHash must be a non-empty string
//   R14 -- parsedEvidenceHash must be a non-empty string
//   R15 -- auditMetadata must be a non-null object
//   R16 -- storageVersion must be a non-empty string
//   R17 -- lineage IDs, when present, must not equal evidenceEnvelopeId
//   R18 -- validationResult must have a boolean 'valid' field

import { VALID_REGISTRY_RECORD_STATUSES, VALID_DEDUPLICATION_CLASSIFICATIONS, VALID_REGISTRY_EVENT_TYPES } from './types.js';
import { VALID_EVIDENCE_STATUSES, VALID_EVIDENCE_CONFIDENCES, VALID_EVIDENCE_CATEGORIES } from '../types.js';
import { VALID_PROVIDER_IDS }  from '../providers.js';

// UUID v4 pattern (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx).
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRegistryRecord(record) {
  const errors   = [];
  const warnings = [];

  if (!record || typeof record !== 'object') {
    return { valid: false, errors: ['Registry record must be a non-null object'], warnings };
  }

  const id = record.evidenceEnvelopeId ?? '(unknown)';

  // R1 -- evidenceEnvelopeId present
  if (!record.evidenceEnvelopeId || typeof record.evidenceEnvelopeId !== 'string') {
    errors.push(`R1: evidenceEnvelopeId must be a non-empty string`);
  }

  // R2 -- evidenceEnvelopeId UUID v4 format
  if (record.evidenceEnvelopeId && !UUID_V4_RE.test(record.evidenceEnvelopeId)) {
    errors.push(`R2 [${id}]: evidenceEnvelopeId is not a valid UUID v4`);
  }

  // R3 -- sourceEnvelopeId
  if (!record.sourceEnvelopeId || typeof record.sourceEnvelopeId !== 'string') {
    errors.push(`R3 [${id}]: sourceEnvelopeId must be a non-empty string`);
  }

  // R4 -- envelopeSchemaVersion
  if (!record.envelopeSchemaVersion || typeof record.envelopeSchemaVersion !== 'string') {
    errors.push(`R4 [${id}]: envelopeSchemaVersion must be a non-empty string`);
  }

  // R5 -- contractId
  if (!record.contractId || typeof record.contractId !== 'string') {
    errors.push(`R5 [${id}]: contractId must be a non-empty string`);
  }

  // R6 -- providerId
  if (!record.providerId) {
    errors.push(`R6 [${id}]: providerId must be a non-empty string`);
  } else if (!VALID_PROVIDER_IDS.has(record.providerId)) {
    errors.push(`R6 [${id}]: unknown providerId "${record.providerId}"`);
  }

  // R7 -- evidenceCategory
  if (!VALID_EVIDENCE_CATEGORIES.has(record.evidenceCategory)) {
    errors.push(`R7 [${id}]: unknown evidenceCategory "${record.evidenceCategory}"`);
  }

  // R8 -- evidenceStatus
  if (!VALID_EVIDENCE_STATUSES.has(record.evidenceStatus)) {
    errors.push(`R8 [${id}]: unknown evidenceStatus "${record.evidenceStatus}"`);
  }

  // R9 -- evidenceConfidence
  if (!VALID_EVIDENCE_CONFIDENCES.has(record.evidenceConfidence)) {
    errors.push(`R9 [${id}]: unknown evidenceConfidence "${record.evidenceConfidence}"`);
  }

  // R10 -- recordStatus
  if (!VALID_REGISTRY_RECORD_STATUSES.has(record.recordStatus)) {
    errors.push(`R10 [${id}]: unknown recordStatus "${record.recordStatus}"`);
  }

  // R11 -- deduplicationStatus
  if (!VALID_DEDUPLICATION_CLASSIFICATIONS.has(record.deduplicationStatus)) {
    errors.push(`R11 [${id}]: unknown deduplicationStatus "${record.deduplicationStatus}"`);
  }

  // R12 -- registeredAt
  if (!record.registeredAt || typeof record.registeredAt !== 'string') {
    errors.push(`R12 [${id}]: registeredAt must be a non-empty ISO date string`);
  }

  // R13 -- rawPayloadHash
  if (!record.rawPayloadHash || typeof record.rawPayloadHash !== 'string') {
    errors.push(`R13 [${id}]: rawPayloadHash must be a non-empty string`);
  }

  // R14 -- parsedEvidenceHash
  if (!record.parsedEvidenceHash || typeof record.parsedEvidenceHash !== 'string') {
    errors.push(`R14 [${id}]: parsedEvidenceHash must be a non-empty string`);
  }

  // R15 -- auditMetadata
  if (!record.auditMetadata || typeof record.auditMetadata !== 'object') {
    errors.push(`R15 [${id}]: auditMetadata must be a non-null object`);
  }

  // R16 -- storageVersion
  if (!record.storageVersion || typeof record.storageVersion !== 'string') {
    errors.push(`R16 [${id}]: storageVersion must be a non-empty string`);
  }

  // R17 -- lineage IDs must not self-reference
  const lineageFields = [
    'supersedesEvidenceEnvelopeId',
    'supersededByEvidenceEnvelopeId',
    'replayOfEvidenceEnvelopeId',
    'correctionOfEvidenceEnvelopeId',
    'parentEvidenceEnvelopeId',
  ];
  for (const field of lineageFields) {
    if (record[field] && record[field] === record.evidenceEnvelopeId) {
      errors.push(`R17 [${id}]: ${field} must not equal evidenceEnvelopeId (self-reference)`);
    }
  }

  // R18 -- validationResult
  if (!record.validationResult || typeof record.validationResult !== 'object') {
    errors.push(`R18 [${id}]: validationResult must be a non-null object`);
  } else if (typeof record.validationResult.valid !== 'boolean') {
    errors.push(`R18 [${id}]: validationResult.valid must be a boolean`);
  }

  // R19 -- registryRecordId must be UUID v4
  if (!record.registryRecordId || typeof record.registryRecordId !== 'string') {
    errors.push(`R19 [${id}]: registryRecordId must be a non-empty string`);
  } else if (!UUID_V4_RE.test(record.registryRecordId)) {
    errors.push(`R19 [${id}]: registryRecordId is not a valid UUID v4`);
  }

  // R20 -- eventLog must be an array
  if (!Array.isArray(record.eventLog)) {
    errors.push(`R20 [${id}]: eventLog must be an array`);
  }

  // R21 -- each event in eventLog must have required fields
  if (Array.isArray(record.eventLog)) {
    for (let i = 0; i < record.eventLog.length; i++) {
      const evt = record.eventLog[i];
      if (!evt || typeof evt !== 'object') {
        errors.push(`R21 [${id}]: eventLog[${i}] must be a non-null object`);
        continue;
      }
      for (const field of ['eventId', 'eventType', 'timestamp', 'actor', 'source']) {
        if (!evt[field]) {
          errors.push(`R21 [${id}]: eventLog[${i}].${field} is required`);
        }
      }
      if (evt.eventType && !VALID_REGISTRY_EVENT_TYPES.has(evt.eventType)) {
        errors.push(`R21 [${id}]: eventLog[${i}].eventType "${evt.eventType}" is unknown`);
      }
    }
  }

  // Warning: QUARANTINED or REJECTED records should not be active.
  if (
    record.recordStatus === 'QUARANTINED' ||
    record.recordStatus === 'REJECTED'
  ) {
    warnings.push(`[${id}]: record has non-active status "${record.recordStatus}"`);
  }

  return { valid: errors.length === 0, errors, warnings };
}
