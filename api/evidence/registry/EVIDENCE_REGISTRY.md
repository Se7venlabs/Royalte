# Evidence Registry™

**Canonical Intelligence Platform™ — Sprint 3**

---

## Mission

The Evidence Registry™ is the permanent, immutable, auditable system of record for all provider evidence collected by Royaltē.

The Evidence Registry stores evidence.

It does not interpret evidence.
It does not normalize evidence.
It does not resolve conflicts.
It does not establish canonical truth.

---

## Architecture

```
Provider Connector
       |
  Evidence Contract
       |
  Evidence Envelope
       |
  Envelope Validation
       |
  Evidence Registration        <-- Evidence Registry boundary
       |
  Immutable Evidence Record
       |
  Future Normalization Read
       |
  Future Resolution Read
```

The Evidence Registry sits between the Evidence Envelope and the Normalization Engine. It is a vault, not an intelligence layer.

---

## Registry Boundaries

**Inputs (accepted):** Validated Evidence Envelopes produced by Royaltē connectors.

**Outputs (provided):** Immutable registry records retrieved by evidenceEnvelopeId, scanId, artistId, providerId, contractId, category, or correlationId.

**Never provided:** Normalized values, canonical selections, resolved fields, computed confidence, conflict resolution, workspace intelligence.

---

## Evidence Envelope Relationship

Every Evidence Envelope from Sprint 2 (`api/evidence/envelope.js`) is transportable by a connector. When a connector completes its run, it calls `registerEvidenceEnvelope(envelope)`. The registry:

1. Validates the envelope structure
2. Validates the parsedEvidence against its contract
3. Confirms the provider and contract are registered
4. Confirms the sourceEnvelopeId has not been registered before
5. Classifies the deduplication status
6. Assigns a permanent UUID (`evidenceEnvelopeId`)
7. Computes rawPayloadHash and parsedEvidenceHash
8. Creates an immutable registry record
9. Returns a registry receipt

The original `envelope.envelopeId` is preserved as `sourceEnvelopeId` in the record.

---

## Evidence Record Schema

Every accepted Evidence Envelope is stored as one registry record.

| Field | Type | Description |
|-------|------|-------------|
| `evidenceEnvelopeId` | UUID v4 | Registry-assigned permanent identity |
| `sourceEnvelopeId` | string | Original `envelope.envelopeId` |
| `envelopeSchemaVersion` | string | Envelope schema version (from `envelope.metadata.envelopeVersion`) |
| `contractId` | string | Evidence Contract ID |
| `contractVersion` | string | Contract version |
| `providerId` | string | Stable provider ID |
| `providerVersion` | string | Provider API version |
| `connectorId` | string | Connector ID |
| `connectorVersion` | string | Connector version |
| `scanId` | string | Scan ID from trace |
| `artistId` | string | Artist ID from trace |
| `correlationId` | string\|null | Correlation ID from trace |
| `evidenceCategory` | string | Evidence category (from contract) |
| `evidenceStatus` | string | FOUND / NOT_FOUND / ERROR / etc. |
| `evidenceConfidence` | string | UNKNOWN / LOW / MEDIUM / HIGH / VERIFIED |
| `retrievedAt` | ISO date | When the connector called the provider |
| `receivedAt` | ISO date\|null | When the connector received the response |
| `parsedAt` | ISO date\|null | When the connector parsed the response |
| `envelopedAt` | ISO date | When the envelope was created |
| `registeredAt` | ISO date | When the registry accepted this record |
| `rawPayload` | any\|null | Preserved exactly from envelope.rawPayload |
| `parsedEvidence` | object\|null | Preserved exactly from envelope.parsedEvidence |
| `validationResult` | object | Validation result from envelope |
| `auditMetadata` | object | Registry audit block (see Audit Metadata) |
| `recordStatus` | string | ACTIVE / SUPERSEDED / CORRECTED / REPLAY / QUARANTINED / ARCHIVED |
| `deduplicationStatus` | string | UNIQUE / EXACT_DUPLICATE / POTENTIAL_DUPLICATE / REPLAY / CORRECTION / SUPERSEDING_RECORD |
| `rawPayloadHash` | string | SHA-256 of rawPayload (deterministic) |
| `parsedEvidenceHash` | string | SHA-256 of parsedEvidence (deterministic) |
| `storageVersion` | string | Storage format version |

---

## Lineage Fields

| Field | Description |
|-------|-------------|
| `supersedesEvidenceEnvelopeId` | ID of the record this record supersedes |
| `supersededByEvidenceEnvelopeId` | ID of the record that supersedes this one |
| `replayOfEvidenceEnvelopeId` | ID of the original record being replayed |
| `correctionOfEvidenceEnvelopeId` | ID of the record this corrects |
| `parentEvidenceEnvelopeId` | ID of the logical parent record |

All lineage fields are null by default. They are set only when registering a correction, superseding, or replay record.

---

## Immutability Rules

Evidence records are immutable after registration.

**Allowed operations:**
- Insert a new record
- Read an existing record
- Mark a record as superseded via `updateLineage` (lineage + status fields only)
- Register a correction record that references the prior record

**Forbidden operations:**
- Mutating rawPayload
- Mutating parsedEvidence
- Replacing provider metadata in place
- Rewriting validation history
- Silently deleting evidence
- Overwriting an existing evidenceEnvelopeId

Corrections must create a new record and reference the prior record via `correctionOfEvidenceEnvelopeId`.

---

## Write Path

`registerEvidenceEnvelope(envelope, options?)` is the sole write entry point.

Steps:
1. Confirm envelope is a non-null object
2. Validate envelope structure (Sprint 2 `validateEnvelope`)
3. Validate parsedEvidence (Sprint 2 `validateEvidence`)
4. Confirm provider is registered
5. Confirm contract is registered
6. Confirm sourceEnvelopeId is unique
7. Apply deduplication policy
8. Compute payload hashes
9. Create immutable registry record
10. Validate registry record
11. Persist via adapter
12. Return registry receipt

---

## Read Path

All read operations return raw stored records. No interpretation.

| Function | Description |
|----------|-------------|
| `getEvidenceById(id)` | Single record by evidenceEnvelopeId |
| `getEvidenceByScan(scanId)` | All records for a scan |
| `getEvidenceByArtist(artistId)` | All records for an artist |
| `getEvidenceByProvider(providerId)` | All records from a provider |
| `getEvidenceByContract(contractId)` | All records for a contract |
| `getEvidenceByCategory(category)` | All records by evidence category |
| `getEvidenceByCorrelationId(id)` | All records with a correlation ID |
| `listEvidence(query)` | Records matching a compound query |

Query fields: `artistId`, `scanId`, `providerId`, `contractId`, `category`, `evidenceStatus`, `correlationId`, `fromDate`, `toDate`, `connectorVersion`, `contractVersion`.

---

## Deduplication Policy

| Classification | Meaning |
|----------------|---------|
| `UNIQUE` | No prior record matches this fingerprint |
| `EXACT_DUPLICATE` | Full fingerprint already in active registry — rejected unless authorized |
| `POTENTIAL_DUPLICATE` | Same provider+contract+scan+artist but different payload — flagged, stored |
| `REPLAY` | Explicitly authorized replay of prior evidence |
| `CORRECTION` | Explicitly authorized correction of prior evidence |
| `SUPERSEDING_RECORD` | Explicitly authorized replacement record |

Fingerprint inputs: `providerId + contractId + scanId + artistId + rawPayloadHash + connectorVersion + retrievedAt`

---

## Record Statuses

| Status | Meaning |
|--------|---------|
| `ACTIVE` | Current authoritative record |
| `SUPERSEDED` | Replaced by a newer record; original preserved |
| `CORRECTED` | A correction record exists; original preserved |
| `REPLAY` | A replay of a prior evidence record |
| `REJECTED` | Failed validation; never entered active registry |
| `QUARANTINED` | Invalid; stored for audit only; excluded from active queries |
| `ARCHIVED` | Intentionally retired; preserved for historical audit |

---

## Quarantine Policy

Invalid evidence that fails envelope or evidence validation may be quarantined rather than simply rejected (via `options.quarantineOnInvalid = true`).

Quarantined records:
- Are stored in a separate quarantine location
- Are never returned by `findById` or `findMany`
- Retain validation errors
- Must not be consumed by future Normalization or Resolution engines
- Promotion from quarantine requires explicit revalidation

---

## Audit Metadata

Every record includes an `auditMetadata` block:

| Field | Description |
|-------|-------------|
| `registeredAt` | ISO timestamp of registration |
| `registeredBy` | Identity of registrant (default: `royalte-system`) |
| `registrationSource` | Source of registration call |
| `registryVersion` | Evidence Registry version |
| `storageAdapter` | Adapter identifier |
| `envelopeSchemaVersion` | Envelope schema version |
| `contractVersion` | Contract version |
| `providerVersion` | Provider API version |
| `connectorVersion` | Connector version |
| `validationFrameworkVersion` | Sprint 2 evidence framework version |
| `storageVersion` | Storage format version |
| `rawPayloadHash` | Hash of rawPayload |
| `parsedEvidenceHash` | Hash of parsedEvidence |
| `validationPassed` | Boolean |
| `validationErrorCount` | Count of validation errors |

---

## Payload Hashing

Raw payloads and parsed evidence are hashed using SHA-256 with deterministic (key-sorted) JSON serialization.

This allows future verification that stored evidence has not changed since registration.

Null payloads produce sentinel strings:
- `rawPayload: null` → `rawPayloadHash: 'null-payload'`
- `parsedEvidence: null` → `parsedEvidenceHash: 'null-evidence'`

---

## Replay Readiness

The registry preserves all information needed to replay evidence through a future parser or normalization version:

- Original raw payload
- Original parsed evidence
- Original contract version
- Original envelope schema version
- Original provider version
- Original connector version
- Validation result
- Trace metadata
- Timestamps

A future replay service reads a record and submits its raw payload to a newer version without mutating the original record.

---

## Adapter Interface

The repository interface (`repository.js`) is storage-agnostic. Adapters implement:

| Method | Description |
|--------|-------------|
| `insert(record)` | Store an immutable record |
| `findById(id)` | Return record by evidenceEnvelopeId (active only) |
| `findBySourceEnvelopeId(id)` | Return record by sourceEnvelopeId |
| `findMany(query)` | Return records matching query |
| `exists(id)` | True if record exists (any status) |
| `sourceEnvelopeIdExists(id)` | True if sourceEnvelopeId is registered |
| `fingerprintExists(fp)` | True if fingerprint is in active registry |
| `getActiveFingerprints()` | Map of all active fingerprints |
| `getActivePartialFingerprints()` | Map of all partial fingerprints |
| `quarantine(record, result)` | Store invalid record in quarantine |
| `findQuarantined(id)` | Return quarantined record |
| `updateLineage(id, updates)` | Apply lineage-only updates |

Current adapters:
- `adapters/memory-adapter.js` — in-memory; tests and local dev
- `adapters/persistence-adapter.js` — stub; replace for production

---

## Future Normalization Integration

The Normalization Engine (future sprint) will:
1. Call `getEvidenceByScan(scanId)` to retrieve all envelopes for a scan
2. Read `parsedEvidence` from each record
3. Pass evidence to domain-specific normalizers
4. Never write back to the Evidence Registry

The registry is read-only from the Normalization Engine's perspective.

---

## Future Resolution Integration

The Evidence Resolution Engine (future sprint) will:
1. Call `getEvidenceByArtist(artistId)` to retrieve historical evidence
2. Analyze `evidenceStatus`, `evidenceConfidence`, and `parsedEvidence`
3. Produce canonical field values
4. Store results in the Canonical Registry (separate from Evidence Registry)

The Evidence Registry is never modified by the Resolution Engine.

---

## Public API

```js
import {
  EVIDENCE_STORE,
  registerEvidenceEnvelope,
  getEvidenceById,
  getEvidenceByScan,
  getEvidenceByArtist,
  getEvidenceByProvider,
  getEvidenceByContract,
  getEvidenceByCategory,
  getEvidenceByCorrelationId,
  listEvidence,
  validateRegistryRecord,
  createEvidenceStore,
  REGISTRY_VERSION,
  REGISTRY_RECORD_STATUSES,
  DEDUPLICATION_CLASSIFICATIONS,
  REGISTRY_ERROR_CODES,
} from './api/evidence/registry/index.js';

// Register an envelope
const receipt = registerEvidenceEnvelope(envelope);
// { accepted: true, evidenceEnvelopeId, scanId, providerId, ... }

// Read by ID
const record = getEvidenceById(receipt.evidenceEnvelopeId);

// Read by scan
const scanRecords = getEvidenceByScan('scan-001');

// Compound query
const records = listEvidence({
  artistId: 'artist-001',
  providerId: 'apple-music',
  fromDate: '2026-07-01',
});
```
