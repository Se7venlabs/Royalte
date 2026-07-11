// Canonical Intelligence Platform(tm) -- Evidence Registry Memory Adapter
//
// In-memory implementation of the Evidence Repository interface.
// Used in tests and local development.
//
// All records are stored in Maps. Secondary indexes provide O(1) lookups
// by scanId, artistId, providerId, contractId, category, correlationId,
// and recordStatus.
//
// This adapter is the reference implementation. Any production adapter
// must satisfy the same interface contract (see repository.js).

import { REGISTRY_RECORD_STATUSES } from '../types.js';

const ACTIVE = REGISTRY_RECORD_STATUSES.ACTIVE;

export function createMemoryAdapter() {
  // Primary store: evidenceEnvelopeId -> record
  const records = new Map();

  // Quarantine: evidenceEnvelopeId -> { record, validationResult }
  const quarantineStore = new Map();

  // Deduplication indexes
  const fingerprintIndex        = new Map(); // fingerprint -> evidenceEnvelopeId (ACTIVE only)
  const partialFingerprintIndex = new Map(); // partialFingerprint -> evidenceEnvelopeId[]

  // Secondary indexes (ACTIVE records only)
  const sourceEnvelopeIdIndex = new Map(); // sourceEnvelopeId -> evidenceEnvelopeId
  const byScanId              = new Map(); // scanId -> Set<evidenceEnvelopeId>
  const byArtistId            = new Map(); // artistId -> Set<evidenceEnvelopeId>
  const byProviderId          = new Map(); // providerId -> Set<evidenceEnvelopeId>
  const byContractId          = new Map(); // contractId -> Set<evidenceEnvelopeId>
  const byCategory            = new Map(); // category -> Set<evidenceEnvelopeId>
  const byCorrelationId       = new Map(); // correlationId -> Set<evidenceEnvelopeId>
  const byStatus              = new Map(); // status -> Set<evidenceEnvelopeId>

  function addToSetIndex(index, key, id) {
    if (key == null) return;
    if (!index.has(key)) index.set(key, new Set());
    index.get(key).add(id);
  }

  function indexRecord(record) {
    const id = record.evidenceEnvelopeId;
    addToSetIndex(byScanId,        record.scanId,            id);
    addToSetIndex(byArtistId,      record.artistId,          id);
    addToSetIndex(byProviderId,    record.providerId,        id);
    addToSetIndex(byContractId,    record.contractId,        id);
    addToSetIndex(byCategory,      record.evidenceCategory,  id);
    addToSetIndex(byCorrelationId, record.correlationId,     id);
    addToSetIndex(byStatus,        record.recordStatus,      id);
    if (record.sourceEnvelopeId) {
      sourceEnvelopeIdIndex.set(record.sourceEnvelopeId, id);
    }
  }

  function matchesQuery(record, query) {
    if (query.artistId       && record.artistId         !== query.artistId)       return false;
    if (query.scanId         && record.scanId           !== query.scanId)         return false;
    if (query.providerId     && record.providerId       !== query.providerId)     return false;
    if (query.contractId     && record.contractId       !== query.contractId)     return false;
    if (query.category       && record.evidenceCategory !== query.category)       return false;
    if (query.evidenceStatus && record.evidenceStatus   !== query.evidenceStatus) return false;
    if (query.correlationId  && record.correlationId    !== query.correlationId)  return false;
    if (query.connectorVersion && record.connectorVersion !== query.connectorVersion) return false;
    if (query.contractVersion  && record.contractVersion  !== query.contractVersion)  return false;
    if (query.fromDate) {
      const from = new Date(query.fromDate).getTime();
      const reg  = new Date(record.registeredAt).getTime();
      if (isNaN(from) || reg < from) return false;
    }
    if (query.toDate) {
      const to  = new Date(query.toDate).getTime();
      const reg = new Date(record.registeredAt).getTime();
      if (isNaN(to) || reg > to) return false;
    }
    return true;
  }

  return {
    insert(record) {
      if (records.has(record.evidenceEnvelopeId)) {
        throw new Error(
          `[memory-adapter] Immutability violation: record "${record.evidenceEnvelopeId}" already exists`
        );
      }
      records.set(record.evidenceEnvelopeId, record);
      indexRecord(record);

      if (record.deduplicationFingerprint) {
        fingerprintIndex.set(record.deduplicationFingerprint, record.evidenceEnvelopeId);
      }
      if (record.deduplicationPartialFingerprint) {
        const pf = record.deduplicationPartialFingerprint;
        if (!partialFingerprintIndex.has(pf)) partialFingerprintIndex.set(pf, []);
        partialFingerprintIndex.get(pf).push(record.evidenceEnvelopeId);
      }

      return record;
    },

    findById(evidenceEnvelopeId) {
      const record = records.get(evidenceEnvelopeId);
      if (!record) return null;
      // Never return quarantined or rejected records through active queries.
      if (
        record.recordStatus === REGISTRY_RECORD_STATUSES.QUARANTINED ||
        record.recordStatus === REGISTRY_RECORD_STATUSES.REJECTED
      ) {
        return null;
      }
      return record;
    },

    findBySourceEnvelopeId(sourceEnvelopeId) {
      const id = sourceEnvelopeIdIndex.get(sourceEnvelopeId);
      if (!id) return null;
      return this.findById(id);
    },

    findMany(query = {}) {
      const results = [];
      for (const record of records.values()) {
        if (
          record.recordStatus === REGISTRY_RECORD_STATUSES.QUARANTINED ||
          record.recordStatus === REGISTRY_RECORD_STATUSES.REJECTED
        ) {
          continue;
        }
        if (matchesQuery(record, query)) {
          results.push(record);
        }
      }
      return results;
    },

    exists(evidenceEnvelopeId) {
      return records.has(evidenceEnvelopeId) || quarantineStore.has(evidenceEnvelopeId);
    },

    sourceEnvelopeIdExists(sourceEnvelopeId) {
      return sourceEnvelopeIdIndex.has(sourceEnvelopeId);
    },

    fingerprintExists(fingerprint) {
      return fingerprintIndex.has(fingerprint);
    },

    getActiveFingerprints() {
      return new Map(fingerprintIndex);
    },

    getActivePartialFingerprints() {
      return new Map(partialFingerprintIndex);
    },

    quarantine(record, validationResult) {
      quarantineStore.set(record.evidenceEnvelopeId, { record, validationResult, quarantinedAt: new Date().toISOString() });
    },

    findQuarantined(evidenceEnvelopeId) {
      return quarantineStore.get(evidenceEnvelopeId) ?? null;
    },

    appendEventLog(evidenceEnvelopeId, event) {
      const record = records.get(evidenceEnvelopeId);
      if (!record) {
        throw new Error(`[memory-adapter] appendEventLog: record "${evidenceEnvelopeId}" not found`);
      }
      const frozenEvent = Object.isFrozen(event) ? event : Object.freeze({ ...event });
      const newLog = Object.freeze([...(record.eventLog ?? []), frozenEvent]);
      const updated = Object.freeze({ ...record, eventLog: newLog });
      records.set(evidenceEnvelopeId, updated);
      return updated;
    },

    updateLineage(evidenceEnvelopeId, lineageUpdates) {
      const record = records.get(evidenceEnvelopeId);
      if (!record) {
        throw new Error(`[memory-adapter] updateLineage: record "${evidenceEnvelopeId}" not found`);
      }
      // Create a new frozen record with the lineage fields applied.
      // Content fields (rawPayload, parsedEvidence, validationResult) are untouched.
      const LINEAGE_KEYS = new Set([
        'supersedesEvidenceEnvelopeId',
        'supersededByEvidenceEnvelopeId',
        'replayOfEvidenceEnvelopeId',
        'correctionOfEvidenceEnvelopeId',
        'parentEvidenceEnvelopeId',
        'recordStatus',
      ]);
      const safeUpdates = {};
      for (const [k, v] of Object.entries(lineageUpdates)) {
        if (LINEAGE_KEYS.has(k)) safeUpdates[k] = v;
      }
      const updated = Object.freeze({ ...record, ...safeUpdates });
      records.set(evidenceEnvelopeId, updated);

      // Re-index status if it changed.
      if (safeUpdates.recordStatus && safeUpdates.recordStatus !== record.recordStatus) {
        const statusSet = byStatus.get(record.recordStatus);
        if (statusSet) statusSet.delete(evidenceEnvelopeId);
        addToSetIndex(byStatus, safeUpdates.recordStatus, evidenceEnvelopeId);
      }

      return updated;
    },

    // Expose internal store sizes for testing.
    _size()                   { return records.size; },
    _quarantineSize()         { return quarantineStore.size; },
    _getFingerprintIndex()    { return fingerprintIndex; },
    _getPartialFingerprintIndex() { return partialFingerprintIndex; },
  };
}
