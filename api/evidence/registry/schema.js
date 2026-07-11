// Canonical Intelligence Platform(tm) -- Evidence Registry Record Schema
//
// Defines the constitutional shape of an Evidence Registry record.
// Every accepted Evidence Envelope is stored as exactly one registry record.
//
// The registry record wraps the original Evidence Envelope and adds:
//   - Permanent registry identity (evidenceEnvelopeId)
//   - Registry-level status
//   - Deduplication classification
//   - Audit metadata
//   - Payload integrity hashes
//   - Lineage references
//   - Storage metadata
//
// Records are immutable after registration. Corrections and superseding
// records create new records and reference the prior record via lineage fields.

// Fields that must be present in every active registry record.
export const REGISTRY_RECORD_REQUIRED_FIELDS = Object.freeze([
  'registryRecordId',      // independent registry record identity; UUID v4; separate from evidenceEnvelopeId
  'evidenceEnvelopeId',    // registry-assigned UUID; permanent identity of the Evidence Envelope; never reused
  'sourceEnvelopeId',      // original envelope.envelopeId from the Evidence Envelope
  'envelopeSchemaVersion', // Evidence Envelope schema version
  'contractId',            // from envelope.contractId
  'contractVersion',       // from envelope.contractVersion
  'providerId',            // from envelope.provider.id
  'providerVersion',       // from envelope.provider.version
  'connectorId',           // from envelope.connector.id
  'connectorVersion',      // from envelope.connector.version
  'scanId',                // from envelope.trace.scanId
  'artistId',              // from envelope.trace.artistId
  'evidenceCategory',      // from contract.category
  'evidenceStatus',        // from envelope.parsedEvidence.evidenceStatus
  'evidenceConfidence',    // from envelope.parsedEvidence.confidence
  'retrievedAt',           // from envelope.timestamps.requestedAt (when connector called provider)
  'envelopedAt',           // from envelope.timestamps.envelopedAt
  'registeredAt',          // set by registry at registration time
  'rawPayload',            // preserved exactly from envelope.rawPayload (may be null)
  'parsedEvidence',        // preserved exactly from envelope.parsedEvidence
  'validationResult',      // from envelope.validation
  'auditMetadata',         // registry-generated audit record
  'recordStatus',          // REGISTRY_RECORD_STATUSES value
  'deduplicationStatus',   // DEDUPLICATION_CLASSIFICATIONS value
  'rawPayloadHash',        // sha256 of rawPayload; 'null-payload' if rawPayload is null
  'parsedEvidenceHash',    // sha256 of parsedEvidence; 'null-evidence' if parsedEvidence is null
  'storageVersion',        // storage format version from STORAGE_VERSION
  'eventLog',              // append-only Registry Event Log(tm); array of frozen event objects
]);

// Optional fields present in all records but may be null.
export const REGISTRY_RECORD_NULLABLE_FIELDS = Object.freeze([
  'correlationId',   // from envelope.trace.correlationId
  'receivedAt',      // from envelope.timestamps.receivedAt
  'parsedAt',        // from envelope.timestamps.parsedAt
]);

// Lineage fields -- null unless this record corrects, supersedes, or replays a prior record.
export const REGISTRY_RECORD_LINEAGE_FIELDS = Object.freeze([
  'supersedesEvidenceEnvelopeId',   // evidenceEnvelopeId of the record this supersedes
  'supersededByEvidenceEnvelopeId', // evidenceEnvelopeId of the record that supersedes this
  'replayOfEvidenceEnvelopeId',     // evidenceEnvelopeId of the original record being replayed
  'correctionOfEvidenceEnvelopeId', // evidenceEnvelopeId of the record this corrects
  'parentEvidenceEnvelopeId',       // evidenceEnvelopeId of the logical parent record
]);

// Audit metadata fields required inside record.auditMetadata.
export const AUDIT_METADATA_REQUIRED_FIELDS = Object.freeze([
  'registeredAt',
  'registeredBy',
  'registrationSource',
  'registryVersion',
  'storageAdapter',
  'envelopeSchemaVersion',
  'contractVersion',
  'providerVersion',
  'connectorVersion',
  'validationFrameworkVersion',
  'rawPayloadHash',
]);
