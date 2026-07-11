// Canonical Intelligence Platform(tm) -- Evidence Registry Public Loader
//
// THE ONLY supported import path for Evidence Registry operations.
// No service or connector may import internal adapter or service modules directly.
//
// Public API:
//
//   EVIDENCE_STORE
//     Singleton Evidence Registry backed by the in-memory adapter.
//     Used in tests and local development.
//     Replace with a production adapter for live deployments.
//
//   registerEvidenceEnvelope(envelope, options?)
//     Write path. Returns a registry receipt.
//     options: { storageAdapterId, registeredBy, registrationSource, intent,
//                quarantineOnInvalid, supersedesEvidenceEnvelopeId,
//                correctionOfEvidenceEnvelopeId, replayOfEvidenceEnvelopeId,
//                parentEvidenceEnvelopeId }
//
//   getEvidenceById(evidenceEnvelopeId)
//   getEvidenceByScan(scanId)
//   getEvidenceByArtist(artistId)
//   getEvidenceByProvider(providerId)
//   getEvidenceByContract(contractId)
//   getEvidenceByCategory(category)
//   getEvidenceByCorrelationId(correlationId)
//   listEvidence(query)
//     Read path. All functions return records from the default EVIDENCE_STORE.
//
//   validateRegistryRecord(record)
//     Validate a registry record structure.
//     Returns { valid, errors, warnings }.
//
//   createEvidenceStore(adapter)
//     Create a named Evidence Store backed by a custom adapter.
//     Use this when a test or service needs an isolated registry instance.
//
// Startup contract:
//   This module runs an internal consistency check at import time.
//   A broken registry dependency = startup failure.

import { REGISTRY_VERSION, STORAGE_VERSION } from './version.js';
import { REGISTRY_RECORD_STATUSES, DEDUPLICATION_CLASSIFICATIONS, REGISTRY_ERROR_CODES,
         VALID_REGISTRY_RECORD_STATUSES, VALID_DEDUPLICATION_CLASSIFICATIONS,
         REGISTRY_EVENT_TYPES, VALID_REGISTRY_EVENT_TYPES } from './types.js';
import { REGISTRY_RECORD_REQUIRED_FIELDS, REGISTRY_RECORD_LINEAGE_FIELDS,
         AUDIT_METADATA_REQUIRED_FIELDS } from './schema.js';
import { assertAdapterInterface }    from './repository.js';
import { createMemoryAdapter }       from './adapters/memory-adapter.js';
import { registerEvidenceEnvelope as _register } from './write-service.js';
import {
  getEvidenceById        as _getById,
  getEvidenceByScan      as _getByScan,
  getEvidenceByArtist    as _getByArtist,
  getEvidenceByProvider  as _getByProvider,
  getEvidenceByContract  as _getByContract,
  getEvidenceByCategory  as _getByCategory,
  getEvidenceByCorrelationId as _getByCorrelationId,
  listEvidence           as _listEvidence,
} from './read-service.js';
import { validateRegistryRecord as _validateRecord } from './validate.js';
import { createEvent as _createEvent }              from './audit.js';
import { computeRawPayloadHash, computeParsedEvidenceHash, computeHash } from './hash.js';

// Startup integrity check -- fail fast if required dependencies are broken.
(function assertRegistryDependencies() {
  if (!REGISTRY_VERSION?.version) {
    throw new Error('[evidence-registry] FATAL: REGISTRY_VERSION is missing');
  }
  if (REGISTRY_RECORD_REQUIRED_FIELDS.length === 0) {
    throw new Error('[evidence-registry] FATAL: REGISTRY_RECORD_REQUIRED_FIELDS is empty');
  }
  if (VALID_REGISTRY_RECORD_STATUSES.size === 0) {
    throw new Error('[evidence-registry] FATAL: VALID_REGISTRY_RECORD_STATUSES is empty');
  }
})();

// Create an Evidence Store -- a named registry instance backed by an adapter.
// The adapter must satisfy the repository interface (assertAdapterInterface checks this).
export function createEvidenceStore(adapter) {
  assertAdapterInterface(adapter);

  return Object.freeze({
    appendEventLog(evidenceEnvelopeId, event) {
      return adapter.appendEventLog(evidenceEnvelopeId, event);
    },
    registerEvidenceEnvelope(envelope, options) {
      return _register(envelope, adapter, options);
    },
    getEvidenceById(evidenceEnvelopeId) {
      return _getById(evidenceEnvelopeId, adapter);
    },
    getEvidenceByScan(scanId) {
      return _getByScan(scanId, adapter);
    },
    getEvidenceByArtist(artistId) {
      return _getByArtist(artistId, adapter);
    },
    getEvidenceByProvider(providerId) {
      return _getByProvider(providerId, adapter);
    },
    getEvidenceByContract(contractId) {
      return _getByContract(contractId, adapter);
    },
    getEvidenceByCategory(category) {
      return _getByCategory(category, adapter);
    },
    getEvidenceByCorrelationId(correlationId) {
      return _getByCorrelationId(correlationId, adapter);
    },
    listEvidence(query) {
      return _listEvidence(query, adapter);
    },
    validateRegistryRecord(record) {
      return _validateRecord(record);
    },
    _adapter: adapter,
  });
}

// Default singleton store backed by the in-memory adapter.
const _defaultAdapter = createMemoryAdapter();
export const EVIDENCE_STORE = createEvidenceStore(_defaultAdapter);

// Top-level convenience functions bound to the default store.
export function registerEvidenceEnvelope(envelope, options) {
  return EVIDENCE_STORE.registerEvidenceEnvelope(envelope, options);
}
export function getEvidenceById(evidenceEnvelopeId) {
  return EVIDENCE_STORE.getEvidenceById(evidenceEnvelopeId);
}
export function getEvidenceByScan(scanId) {
  return EVIDENCE_STORE.getEvidenceByScan(scanId);
}
export function getEvidenceByArtist(artistId) {
  return EVIDENCE_STORE.getEvidenceByArtist(artistId);
}
export function getEvidenceByProvider(providerId) {
  return EVIDENCE_STORE.getEvidenceByProvider(providerId);
}
export function getEvidenceByContract(contractId) {
  return EVIDENCE_STORE.getEvidenceByContract(contractId);
}
export function getEvidenceByCategory(category) {
  return EVIDENCE_STORE.getEvidenceByCategory(category);
}
export function getEvidenceByCorrelationId(correlationId) {
  return EVIDENCE_STORE.getEvidenceByCorrelationId(correlationId);
}
export function listEvidence(query) {
  return EVIDENCE_STORE.listEvidence(query);
}
export function validateRegistryRecord(record) {
  return EVIDENCE_STORE.validateRegistryRecord(record);
}
export function appendEventLog(evidenceEnvelopeId, event) {
  return EVIDENCE_STORE.appendEventLog(evidenceEnvelopeId, event);
}
export function createEvent(eventType, actor, source, notes, metadata, eventVersion) {
  return _createEvent(eventType, actor, source, notes, metadata, eventVersion);
}

// Re-export types and constants for consumer convenience.
export {
  REGISTRY_VERSION,
  STORAGE_VERSION,
  REGISTRY_RECORD_STATUSES,
  DEDUPLICATION_CLASSIFICATIONS,
  REGISTRY_ERROR_CODES,
  REGISTRY_EVENT_TYPES,
  VALID_REGISTRY_RECORD_STATUSES,
  VALID_DEDUPLICATION_CLASSIFICATIONS,
  VALID_REGISTRY_EVENT_TYPES,
  REGISTRY_RECORD_REQUIRED_FIELDS,
  REGISTRY_RECORD_LINEAGE_FIELDS,
  AUDIT_METADATA_REQUIRED_FIELDS,
  computeRawPayloadHash,
  computeParsedEvidenceHash,
  computeHash,
};
