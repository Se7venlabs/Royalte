// Canonical Intelligence Platform(tm) -- Evidence Registry Repository Interface
//
// Defines the storage-agnostic repository contract that all persistence
// adapters must satisfy. Domain services (write-service, read-service) depend
// only on this interface, never on a specific database or storage technology.
//
// Adapters:
//   adapters/memory-adapter.js     -- in-memory; used in tests and local dev
//   adapters/persistence-adapter.js -- interface stub for future production storage
//
// Interface contract:
//
//   insert(record)
//     Store an immutable evidence record. Returns the stored record.
//     Throws if a record with the same evidenceEnvelopeId already exists.
//
//   findById(evidenceEnvelopeId)
//     Return the active record for the given ID, or null if not found.
//     Must not return QUARANTINED or REJECTED records.
//
//   findBySourceEnvelopeId(sourceEnvelopeId)
//     Return the active record whose sourceEnvelopeId matches, or null.
//
//   findMany(query)
//     Return an array of active records matching the query object.
//     Query fields: artistId, scanId, providerId, contractId, category,
//       evidenceStatus, correlationId, fromDate, toDate,
//       connectorVersion, contractVersion
//     Never returns QUARANTINED or REJECTED records.
//
//   exists(evidenceEnvelopeId)
//     Return true if a record with this ID exists (any status including quarantine).
//
//   sourceEnvelopeIdExists(sourceEnvelopeId)
//     Return true if a record with this sourceEnvelopeId exists (any status).
//
//   fingerprintExists(fingerprint)
//     Return true if a record with this deduplication fingerprint is ACTIVE.
//
//   getActiveFingerprints()
//     Return a Map<fingerprint, evidenceEnvelopeId> for all ACTIVE records.
//
//   getActivePartialFingerprints()
//     Return a Map<partialFingerprint, evidenceEnvelopeId[]> for all ACTIVE records.
//
//   quarantine(record, validationResult)
//     Store a failed record in isolated quarantine.
//     Must not be returned by findById or findMany.
//
//   findQuarantined(evidenceEnvelopeId)
//     Return a quarantined record by its evidenceEnvelopeId, or null.
//
//   updateLineage(evidenceEnvelopeId, lineageUpdates)
//     Apply lineage field updates (e.g. supersededByEvidenceEnvelopeId) to
//     an existing record. The only permitted mutation path -- adds provenance
//     without changing content fields.
//
//   appendEventLog(evidenceEnvelopeId, event)
//     Append a single frozen event object to the record's Registry Event Log(tm).
//     The event log is append-only: existing events are never modified or deleted.
//     Creates a new frozen record with the updated log and replaces the stored record.

// Validates that an adapter implements the repository interface.
// Throws if any required method is missing.
export function assertAdapterInterface(adapter) {
  const required = [
    'insert',
    'findById',
    'findBySourceEnvelopeId',
    'findMany',
    'exists',
    'sourceEnvelopeIdExists',
    'fingerprintExists',
    'getActiveFingerprints',
    'getActivePartialFingerprints',
    'quarantine',
    'findQuarantined',
    'updateLineage',
    'appendEventLog',
  ];

  for (const method of required) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(
        `[evidence-registry] FATAL: Adapter missing required method "${method}"`
      );
    }
  }
}
