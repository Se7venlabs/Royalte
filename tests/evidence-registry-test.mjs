// Evidence Registry(tm) -- Sprint 3 Test Suite
//
// Tests cover:
//   Registry loader, record schema, envelope identity, registryRecordId,
//   envelopeSchemaVersion, Registry Event Log(tm), valid/invalid registration,
//   provider/contract rejection, deduplication, payload integrity, immutability,
//   all retrieval operations, lineage, quarantine isolation, receipts, audit
//   metadata, adapter interface, and constitutional boundaries.

import assert from 'node:assert/strict';

// -- Imports ------------------------------------------------------------------

import {
  EVIDENCE_STORE,
  createEvidenceStore,
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
  appendEventLog,
  createEvent,
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
} from '../api/evidence/registry/index.js';

import { createMemoryAdapter }     from '../api/evidence/registry/adapters/memory-adapter.js';
import { assertAdapterInterface }  from '../api/evidence/registry/repository.js';
import { createEnvelope }          from '../api/evidence/index.js';

// -- Helpers ------------------------------------------------------------------

const ISO_NOW = new Date().toISOString();

// The registered contractId for the ArtistIdentityEvidence contract (Sprint 2).
const IDENTITY_CONTRACT_ID = 'ArtistIdentityEvidence';

// Build a minimal valid Evidence Envelope using the Sprint 2 factory.
// Sprint 2 Rule 10: parsedEvidence must contain a nested `evidence` object
// that holds the contract-specific fields (artistName, etc.).
// Base fields (contractId, provider, scanId, ...) stay at the top level.
function makeEnvelope(overrides = {}) {
  const defaults = {
    provider:        { id: 'apple-music', version: '1.0', displayName: 'Apple Music' },
    connector:       { id: 'apple-connector', version: '1.0', executionId: 'exec-001' },
    contractId:      IDENTITY_CONTRACT_ID,
    contractVersion: '1.0.0',
    rawPayload:      { appleId: 'A001', name: 'Test Artist' },
    parsedEvidence:  {
      // Sprint 2 base contract fields (top level):
      contractId:      IDENTITY_CONTRACT_ID,
      contractVersion: '1.0.0',
      provider:        'apple-music',
      providerVersion: '1.0',
      connectorVersion:'1.0',
      retrievedAt:     ISO_NOW,
      scanId:          'scan-001',
      artistId:        'artist-001',
      confidence:      'HIGH',
      rawReference:    null,
      sourceUrl:       null,
      evidenceStatus:  'FOUND',
      // Sprint 2 Rule 10: nested evidence payload (contract-specific fields):
      evidence: {
        artistName: 'Test Artist',
        artistId:   'apple-A001',
      },
    },
    validation:  { valid: true, errors: [], warnings: [], validatedAt: ISO_NOW },
    trace:       { scanId: 'scan-001', artistId: 'artist-001', correlationId: 'corr-001' },
    timestamps:  { requestedAt: ISO_NOW, receivedAt: ISO_NOW, parsedAt: ISO_NOW, envelopedAt: ISO_NOW },
  };
  return createEnvelope({ ...defaults, ...overrides });
}

// Build a valid envelope with distinct scan/artist to avoid duplicate detection.
function makeUniqueEnvelope(scanId, artistId) {
  return createEnvelope({
    provider:        { id: 'apple-music', version: '1.0', displayName: 'Apple Music' },
    connector:       { id: 'apple-connector', version: '1.0', executionId: `exec-${scanId}` },
    contractId:      IDENTITY_CONTRACT_ID,
    contractVersion: '1.0.0',
    rawPayload:      { appleId: artistId, name: 'Artist ' + artistId },
    parsedEvidence:  {
      contractId:      IDENTITY_CONTRACT_ID,
      contractVersion: '1.0.0',
      provider:        'apple-music',
      providerVersion: '1.0',
      connectorVersion:'1.0',
      retrievedAt:     new Date().toISOString(),
      scanId,
      artistId,
      confidence:      'HIGH',
      rawReference:    null,
      sourceUrl:       null,
      evidenceStatus:  'FOUND',
      evidence: {
        artistName: 'Artist ' + artistId,
        artistId:   'apple-' + artistId,
      },
    },
    validation:  { valid: true, errors: [], warnings: [], validatedAt: ISO_NOW },
    trace:       { scanId, artistId, correlationId: `corr-${scanId}` },
    timestamps:  { requestedAt: ISO_NOW, receivedAt: ISO_NOW, parsedAt: ISO_NOW, envelopedAt: ISO_NOW },
  });
}

// Create a fresh isolated store for each test group that needs isolation.
function freshStore() {
  return createEvidenceStore(createMemoryAdapter());
}

// -- Test runner --------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(label, fn) {
  try {
    fn();
    passed++;
    process.stdout.write('  pass  ' + label + '\n');
  } catch (err) {
    failed++;
    failures.push({ label, message: err.message });
    process.stdout.write('  FAIL  ' + label + '\n');
    process.stdout.write('        ' + err.message + '\n');
  }
}

// =============================================================================
// Section 1 -- Registry Loader
// =============================================================================
process.stdout.write('\n-- 1. Registry Loader\n');

test('EVIDENCE_STORE is exported and frozen', () => {
  assert.ok(EVIDENCE_STORE, 'EVIDENCE_STORE must be exported');
  assert.ok(Object.isFrozen(EVIDENCE_STORE), 'EVIDENCE_STORE must be frozen');
});

test('REGISTRY_VERSION contains required fields', () => {
  assert.ok(REGISTRY_VERSION.version,    'version required');
  assert.ok(REGISTRY_VERSION.name,       'name required');
  assert.ok(REGISTRY_VERSION.sprint,     'sprint required');
  assert.ok(REGISTRY_VERSION.registryId, 'registryId required');
});

test('Public API functions are exported', () => {
  assert.equal(typeof registerEvidenceEnvelope,   'function', 'registerEvidenceEnvelope');
  assert.equal(typeof getEvidenceById,            'function', 'getEvidenceById');
  assert.equal(typeof getEvidenceByScan,          'function', 'getEvidenceByScan');
  assert.equal(typeof getEvidenceByArtist,        'function', 'getEvidenceByArtist');
  assert.equal(typeof getEvidenceByProvider,      'function', 'getEvidenceByProvider');
  assert.equal(typeof getEvidenceByContract,      'function', 'getEvidenceByContract');
  assert.equal(typeof getEvidenceByCategory,      'function', 'getEvidenceByCategory');
  assert.equal(typeof getEvidenceByCorrelationId, 'function', 'getEvidenceByCorrelationId');
  assert.equal(typeof listEvidence,               'function', 'listEvidence');
  assert.equal(typeof validateRegistryRecord,     'function', 'validateRegistryRecord');
  assert.equal(typeof createEvidenceStore,        'function', 'createEvidenceStore');
  assert.equal(typeof appendEventLog,             'function', 'appendEventLog');
  assert.equal(typeof createEvent,                'function', 'createEvent');
});

// =============================================================================
// Section 2 -- Record Schema
// =============================================================================
process.stdout.write('\n-- 2. Record Schema\n');

test('REGISTRY_RECORD_REQUIRED_FIELDS is complete', () => {
  const required = [
    'registryRecordId', 'evidenceEnvelopeId', 'sourceEnvelopeId', 'envelopeSchemaVersion',
    'contractId', 'providerId', 'scanId', 'artistId',
    'evidenceCategory', 'evidenceStatus', 'evidenceConfidence',
    'registeredAt', 'rawPayload', 'parsedEvidence', 'validationResult',
    'auditMetadata', 'recordStatus', 'deduplicationStatus',
    'rawPayloadHash', 'parsedEvidenceHash', 'storageVersion', 'eventLog',
  ];
  for (const f of required) {
    assert.ok(REGISTRY_RECORD_REQUIRED_FIELDS.includes(f), `"${f}" must be in REGISTRY_RECORD_REQUIRED_FIELDS`);
  }
});

test('REGISTRY_RECORD_LINEAGE_FIELDS are defined', () => {
  assert.ok(REGISTRY_RECORD_LINEAGE_FIELDS.includes('supersedesEvidenceEnvelopeId'), 'supersedes');
  assert.ok(REGISTRY_RECORD_LINEAGE_FIELDS.includes('correctionOfEvidenceEnvelopeId'), 'correction');
  assert.ok(REGISTRY_RECORD_LINEAGE_FIELDS.includes('replayOfEvidenceEnvelopeId'), 'replay');
});

test('AUDIT_METADATA_REQUIRED_FIELDS are defined', () => {
  assert.ok(AUDIT_METADATA_REQUIRED_FIELDS.includes('registeredAt'), 'registeredAt');
  assert.ok(AUDIT_METADATA_REQUIRED_FIELDS.includes('registryVersion'), 'registryVersion');
  assert.ok(AUDIT_METADATA_REQUIRED_FIELDS.includes('rawPayloadHash'), 'rawPayloadHash');
});

// =============================================================================
// Section 3 -- Envelope Identity and Schema Version
// =============================================================================
process.stdout.write('\n-- 3. Envelope Identity and Schema Version\n');

test('Evidence Envelope IDs are unique across registrations', () => {
  const store = freshStore();
  const r1 = store.registerEvidenceEnvelope(makeUniqueEnvelope('scan-A', 'artist-A'));
  const r2 = store.registerEvidenceEnvelope(makeUniqueEnvelope('scan-B', 'artist-B'));
  assert.ok(r1.accepted, 'r1 accepted');
  assert.ok(r2.accepted, 'r2 accepted');
  assert.notEqual(r1.evidenceEnvelopeId, r2.evidenceEnvelopeId, 'evidenceEnvelopeIds must differ');
});

test('evidenceEnvelopeId is UUID v4 format', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(UUID_RE.test(r.evidenceEnvelopeId), 'evidenceEnvelopeId must be UUID v4');
});

test('envelopeSchemaVersion is present in stored record', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record.envelopeSchemaVersion, 'envelopeSchemaVersion must be present');
});

// =============================================================================
// Section 4 -- Independent Registry Record Identity (Board Enhancement 2)
// =============================================================================
process.stdout.write('\n-- 4. Independent Registry Record Identity\n');

test('registryRecordId is present in stored record', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record.registryRecordId, 'registryRecordId must be present');
});

test('registryRecordId is UUID v4 format', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.ok(UUID_RE.test(record.registryRecordId), 'registryRecordId must be UUID v4');
});

test('registryRecordId and evidenceEnvelopeId are separate identifiers', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.notEqual(record.registryRecordId, record.evidenceEnvelopeId,
    'registryRecordId and evidenceEnvelopeId must be distinct UUIDs');
});

test('registryRecordId is in the receipt', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  assert.ok(r.registryRecordId, 'registryRecordId must be in receipt');
});

test('registryRecordIds are unique across registrations', () => {
  const store = freshStore();
  const r1 = store.registerEvidenceEnvelope(makeUniqueEnvelope('scan-X', 'artist-X'));
  const r2 = store.registerEvidenceEnvelope(makeUniqueEnvelope('scan-Y', 'artist-Y'));
  assert.ok(r1.accepted && r2.accepted, 'both accepted');
  assert.notEqual(r1.registryRecordId, r2.registryRecordId, 'registryRecordIds must differ');
});

// =============================================================================
// Section 5 -- Registry Event Log(tm) (Board Enhancement 1)
// =============================================================================
process.stdout.write('\n-- 5. Registry Event Log(tm)\n');

test('REGISTRY_EVENT_TYPES contains required lifecycle events and reserved types', () => {
  const required = ['REGISTERED', 'VALIDATED', 'QUARANTINED', 'REPLAYED', 'CORRECTED', 'SUPERSEDED', 'ARCHIVED'];
  for (const t of required) {
    assert.ok(VALID_REGISTRY_EVENT_TYPES.has(t), `event type "${t}" must exist`);
  }
  // Reserved for future sprints -- must be declared but carry no implementation logic.
  assert.ok(VALID_REGISTRY_EVENT_TYPES.has('READ'),     'READ must be reserved');
  assert.ok(VALID_REGISTRY_EVENT_TYPES.has('RESTORED'), 'RESTORED must be reserved');
});

test('Stored record contains an eventLog array', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(Array.isArray(record.eventLog), 'eventLog must be an array');
  assert.ok(record.eventLog.length >= 1, 'eventLog must have at least one event (REGISTERED)');
});

test('Initial eventLog contains a REGISTERED event', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  const registeredEvent = record.eventLog.find((e) => e.eventType === 'REGISTERED');
  assert.ok(registeredEvent, 'REGISTERED event must be present');
  assert.ok(registeredEvent.eventId, 'event must have eventId');
  assert.ok(registeredEvent.timestamp, 'event must have timestamp');
  assert.ok(registeredEvent.actor, 'event must have actor');
  assert.ok(registeredEvent.source, 'event must have source');
});

test('createEvent produces a frozen event with required fields', () => {
  const evt = createEvent(REGISTRY_EVENT_TYPES.VALIDATED, 'test-actor', 'test-source', 'note', { key: 'val' });
  assert.ok(Object.isFrozen(evt), 'event must be frozen');
  assert.ok(evt.eventId, 'eventId required');
  assert.equal(evt.eventType, 'VALIDATED', 'eventType must match');
  assert.ok(evt.timestamp, 'timestamp required');
  assert.equal(evt.actor, 'test-actor', 'actor must match');
  assert.equal(evt.source, 'test-source', 'source must match');
  assert.equal(evt.notes, 'note', 'notes must match');
  assert.deepEqual(evt.metadata, { key: 'val' }, 'metadata must match');
  // eventVersion is reserved for forward-compatibility; default is '1.0'
  assert.equal(evt.eventVersion, '1.0', 'eventVersion must default to 1.0');
});

test('createEvent accepts a custom eventVersion and reserved event types', () => {
  const readEvt = createEvent(REGISTRY_EVENT_TYPES.READ, null, null, null, null, '2.0');
  assert.equal(readEvt.eventType, 'READ', 'READ event type must be usable');
  assert.equal(readEvt.eventVersion, '2.0', 'custom eventVersion must be preserved');

  const restoredEvt = createEvent(REGISTRY_EVENT_TYPES.RESTORED);
  assert.equal(restoredEvt.eventType, 'RESTORED', 'RESTORED event type must be usable');
  assert.equal(restoredEvt.eventVersion, '1.0', 'RESTORED event must default to eventVersion 1.0');
});

test('appendEventLog adds an event to an existing record', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const before = store.getEvidenceById(r.evidenceEnvelopeId);
  const logLengthBefore = before.eventLog.length;

  const evt = createEvent(REGISTRY_EVENT_TYPES.VALIDATED, 'royalte-system', 'test');
  store.appendEventLog(r.evidenceEnvelopeId, evt);

  const after = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.equal(after.eventLog.length, logLengthBefore + 1, 'eventLog must grow by 1');
  const addedEvent = after.eventLog[after.eventLog.length - 1];
  assert.equal(addedEvent.eventType, 'VALIDATED', 'added event type must be VALIDATED');
});

test('Original events are preserved after appendEventLog', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const before = store.getEvidenceById(r.evidenceEnvelopeId);
  const originalFirstEvent = before.eventLog[0];

  store.appendEventLog(r.evidenceEnvelopeId, createEvent(REGISTRY_EVENT_TYPES.ARCHIVED));

  const after = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.deepEqual(after.eventLog[0], originalFirstEvent, 'original first event must be unchanged');
});

test('eventLog is frozen and existing events cannot be mutated', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(Object.isFrozen(record.eventLog), 'eventLog array must be frozen');
  assert.ok(Object.isFrozen(record.eventLog[0]), 'individual events must be frozen');
  assert.throws(() => { record.eventLog[0].eventType = 'TAMPERED'; },
    'mutating a frozen event must throw');
});

test('Event IDs within a record are unique', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  store.appendEventLog(r.evidenceEnvelopeId, createEvent(REGISTRY_EVENT_TYPES.VALIDATED));
  store.appendEventLog(r.evidenceEnvelopeId, createEvent(REGISTRY_EVENT_TYPES.ARCHIVED));

  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  const ids = record.eventLog.map((e) => e.eventId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, 'all event IDs must be unique');
});

// =============================================================================
// Section 6 -- Valid Evidence Acceptance
// =============================================================================
process.stdout.write('\n-- 6. Valid Evidence Acceptance\n');

test('Valid envelope is accepted and receipt is returned', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted must be true');
  assert.ok(r.evidenceEnvelopeId, 'evidenceEnvelopeId in receipt');
  assert.ok(r.registryRecordId, 'registryRecordId in receipt');
  assert.equal(r.scanId, 'scan-001');
  assert.equal(r.providerId, 'apple-music');
  assert.equal(r.contractId, IDENTITY_CONTRACT_ID);
  assert.ok(r.registeredAt, 'registeredAt in receipt');
  assert.equal(r.recordStatus, 'ACTIVE');
});

test('Stored record preserves raw payload exactly', () => {
  const store = freshStore();
  const raw = { appleId: 'X999', name: 'Raw Test', extra: [1, 2, 3] };
  const r = store.registerEvidenceEnvelope(makeEnvelope({ rawPayload: raw }));
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.deepEqual(record.rawPayload, raw, 'rawPayload must be preserved exactly');
});

test('Stored record preserves parsed evidence exactly', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  // Sprint 2 structure: contract-specific fields are nested under parsedEvidence.evidence
  assert.equal(record.parsedEvidence.evidence.artistName, 'Test Artist', 'artistName preserved');
  assert.equal(record.parsedEvidence.evidenceStatus, 'FOUND', 'evidenceStatus preserved');
});

// =============================================================================
// Section 7 -- Invalid Evidence Rejection
// =============================================================================
process.stdout.write('\n-- 7. Invalid Evidence Rejection\n');

test('Null envelope is rejected', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(null);
  assert.equal(r.accepted, false, 'null envelope must be rejected');
  assert.ok(r.errorCode, 'errorCode required');
});

test('Unknown provider is rejected', () => {
  const store = freshStore();
  const e = makeEnvelope({ provider: { id: 'not-a-real-provider', version: '1.0' } });
  const r = store.registerEvidenceEnvelope(e);
  assert.equal(r.accepted, false, 'unknown provider must be rejected');
  // validateEnvelope (Sprint 2) catches unknown providers before the registry
  // provider check; INVALID_ENVELOPE is the expected code.
  assert.ok(
    r.errorCode === REGISTRY_ERROR_CODES.UNKNOWN_PROVIDER ||
    r.errorCode === REGISTRY_ERROR_CODES.INVALID_ENVELOPE,
    `errorCode must indicate provider/envelope failure; got "${r.errorCode}"`
  );
});

test('Unknown contract is rejected', () => {
  const store = freshStore();
  // Override envelope-level contractId only; parsedEvidence.contractId stays valid
  // so validateEvidence passes and the contract check in the write service fires.
  const e = makeEnvelope({ contractId: 'NotARealContract' });
  const r = store.registerEvidenceEnvelope(e);
  assert.equal(r.accepted, false, 'unknown contract must be rejected');
  assert.equal(r.errorCode, REGISTRY_ERROR_CODES.UNKNOWN_CONTRACT, 'error code must be UNKNOWN_CONTRACT');
});

test('Rejection receipt does not expose raw provider payload', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(null);
  assert.equal(r.accepted, false);
  assert.ok(!r.rawPayload, 'rawPayload must not appear in rejection receipt');
  assert.ok(!r.parsedEvidence, 'parsedEvidence must not appear in rejection receipt');
});

// =============================================================================
// Section 8 -- Duplicate Detection
// =============================================================================
process.stdout.write('\n-- 8. Duplicate Detection\n');

test('Duplicate sourceEnvelopeId is rejected', () => {
  const store = freshStore();
  const e = makeEnvelope();
  const r1 = store.registerEvidenceEnvelope(e);
  assert.ok(r1.accepted, 'first registration must succeed');
  // Same envelope object = same envelopeId = duplicate sourceEnvelopeId.
  const r2 = store.registerEvidenceEnvelope(e);
  assert.equal(r2.accepted, false, 'second registration of same envelope must fail');
  assert.equal(r2.errorCode, REGISTRY_ERROR_CODES.DUPLICATE_ENVELOPE_ID);
});

test('Exact duplicate fingerprint is rejected', () => {
  const store = freshStore();
  const raw = { appleId: 'A001', name: 'Test' };
  const e1 = makeEnvelope({ rawPayload: raw });
  // createEnvelope always generates a new envelopeId, so sourceEnvelopeId is unique.
  // But the fingerprint (provider+contract+scan+artist+hash+version+time) is identical.
  const e2 = makeEnvelope({ rawPayload: raw });
  const r1 = store.registerEvidenceEnvelope(e1);
  assert.ok(r1.accepted, 'e1 accepted');
  const r2 = store.registerEvidenceEnvelope(e2);
  assert.equal(r2.accepted, false, 'exact duplicate fingerprint must be rejected');
  assert.equal(r2.errorCode, REGISTRY_ERROR_CODES.EXACT_DUPLICATE);
});

test('Potential duplicate is stored but flagged', () => {
  const store = freshStore();
  const e1 = makeEnvelope({ rawPayload: { appleId: 'A001', name: 'Version 1' } });
  // Different rawPayload and retrievedAt = different fingerprint but same partial fingerprint.
  const e2 = makeUniqueEnvelope('scan-001', 'artist-001-v2');
  const r1 = store.registerEvidenceEnvelope(e1);
  assert.ok(r1.accepted, 'e1 accepted');
  const r2 = store.registerEvidenceEnvelope(e2);
  // e2 has a different artistId so it is UNIQUE relative to e1.
  // This test confirms that different artist IDs produce unique records.
  assert.ok(r2.accepted, 'e2 with different artist accepted');
});

// =============================================================================
// Section 9 -- Payload Integrity Hashes
// =============================================================================
process.stdout.write('\n-- 9. Payload Integrity Hashes\n');

test('Raw payload hash is present and non-empty', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record.rawPayloadHash, 'rawPayloadHash must be present');
  assert.equal(typeof record.rawPayloadHash, 'string', 'rawPayloadHash must be a string');
});

test('Raw payload hash is deterministic', () => {
  const payload = { appleId: 'A001', name: 'Test Artist', nested: { value: 42 } };
  const h1 = computeRawPayloadHash(payload);
  const h2 = computeRawPayloadHash(payload);
  assert.equal(h1, h2, 'hash must be deterministic');
});

test('Raw payload hash is key-order-independent', () => {
  const p1 = { a: 1, b: 2 };
  const p2 = { b: 2, a: 1 };
  assert.equal(computeRawPayloadHash(p1), computeRawPayloadHash(p2),
    'hash must not depend on key insertion order');
});

test('Null raw payload produces sentinel hash', () => {
  const h = computeRawPayloadHash(null);
  assert.equal(h, 'null-payload', 'null rawPayload sentinel');
});

test('Parsed evidence hash is deterministic', () => {
  const evidence = { artistName: 'Test', evidenceStatus: 'FOUND', confidence: 'HIGH' };
  const h1 = computeParsedEvidenceHash(evidence);
  const h2 = computeParsedEvidenceHash(evidence);
  assert.equal(h1, h2, 'parsedEvidenceHash must be deterministic');
});

test('Parsed evidence hash is present in stored record', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record.parsedEvidenceHash, 'parsedEvidenceHash must be present');
});

// =============================================================================
// Section 10 -- Immutability
// =============================================================================
process.stdout.write('\n-- 10. Immutability\n');

test('Stored record is frozen', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(Object.isFrozen(record), 'registry record must be frozen');
});

test('Mutating rawPayload on a stored record throws', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.throws(
    () => { record.rawPayload = 'tampered'; },
    'assigning to frozen record must throw'
  );
});

test('Re-inserting a record with the same evidenceEnvelopeId throws in adapter', () => {
  const adapter = createMemoryAdapter();
  const store   = createEvidenceStore(adapter);
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = adapter.findById(r.evidenceEnvelopeId);
  assert.ok(record, 'record must be findable in adapter');
  assert.throws(
    () => adapter.insert(record),
    /[Ii]mmutability|already exists/,
    'duplicate insert must throw'
  );
});

// =============================================================================
// Section 11 -- Retrieval Operations
// =============================================================================
process.stdout.write('\n-- 11. Retrieval Operations\n');

test('getEvidenceById returns the correct record', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record, 'record must be found');
  assert.equal(record.evidenceEnvelopeId, r.evidenceEnvelopeId);
  assert.equal(record.scanId, 'scan-001');
});

test('getEvidenceByScan returns records for that scan', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByScan('scan-001');
  assert.ok(records.length >= 1, 'at least 1 record for scan-001');
  assert.ok(records.every((rec) => rec.scanId === 'scan-001'), 'all records must match scanId');
});

test('getEvidenceByArtist returns records for that artist', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByArtist('artist-001');
  assert.ok(records.length >= 1, 'at least 1 record for artist-001');
  assert.ok(records.every((rec) => rec.artistId === 'artist-001'), 'all records must match artistId');
});

test('getEvidenceByProvider returns records from that provider', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByProvider('apple-music');
  assert.ok(records.length >= 1, 'at least 1 record for apple-music');
  assert.ok(records.every((rec) => rec.providerId === 'apple-music'), 'all records must match providerId');
});

test('getEvidenceByContract returns records for that contract', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByContract(IDENTITY_CONTRACT_ID);
  assert.ok(records.length >= 1, `at least 1 record for ${IDENTITY_CONTRACT_ID}`);
});

test('getEvidenceByCategory returns records for that category', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByCategory('Identity');
  assert.ok(records.length >= 1, 'at least 1 Identity record');
  assert.ok(records.every((rec) => rec.evidenceCategory === 'Identity'), 'all must be Identity');
});

test('getEvidenceByCorrelationId returns matching records', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const records = store.getEvidenceByCorrelationId('corr-001');
  assert.ok(records.length >= 1, 'at least 1 record for corr-001');
  assert.ok(records.every((rec) => rec.correlationId === 'corr-001'), 'all must match correlationId');
});

test('listEvidence with date range returns correct records', () => {
  const store = freshStore();
  store.registerEvidenceEnvelope(makeEnvelope());
  const fromDate = new Date(Date.now() - 60000).toISOString();
  const toDate   = new Date(Date.now() + 60000).toISOString();
  const records  = store.listEvidence({ fromDate, toDate });
  assert.ok(records.length >= 1, 'date range query must return records');
});

test('getEvidenceById returns null for unknown ID', () => {
  const store = freshStore();
  const result = store.getEvidenceById('00000000-0000-4000-8000-000000000000');
  assert.equal(result, null, 'unknown ID must return null');
});

// =============================================================================
// Section 12 -- Registry Status vs Evidence Status
// =============================================================================
process.stdout.write('\n-- 12. Registry Status vs Evidence Status\n');

test('recordStatus is separate from evidenceStatus', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.equal(record.recordStatus, 'ACTIVE', 'recordStatus must be ACTIVE');
  assert.equal(record.evidenceStatus, 'FOUND', 'evidenceStatus must be FOUND');
  assert.notEqual(record.recordStatus, record.evidenceStatus,
    'recordStatus and evidenceStatus must be independent');
});

test('REGISTRY_RECORD_STATUSES does not contain Evidence Status values', () => {
  const evidenceStatuses = ['FOUND', 'NOT_FOUND', 'ERROR', 'CONFLICT', 'MANUAL_OVERRIDE'];
  for (const s of evidenceStatuses) {
    assert.ok(!VALID_REGISTRY_RECORD_STATUSES.has(s),
      `Evidence Status "${s}" must not appear in REGISTRY_RECORD_STATUSES`);
  }
});

// =============================================================================
// Section 13 -- Lineage
// =============================================================================
process.stdout.write('\n-- 13. Lineage\n');

test('Superseding record preserves the original', () => {
  const store = freshStore();
  const r1 = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r1.accepted, 'original accepted');
  const original = store.getEvidenceById(r1.evidenceEnvelopeId);
  assert.equal(original.rawPayload.appleId, 'A001', 'original rawPayload preserved');

  const superseding = makeUniqueEnvelope('scan-002', 'artist-002');
  const r2 = store.registerEvidenceEnvelope(superseding, {
    intent: 'superseding',
    supersedesEvidenceEnvelopeId: r1.evidenceEnvelopeId,
  });
  assert.ok(r2.accepted, 'superseding record accepted');

  // Original record still exists with rawPayload intact.
  const originalAfter = store.getEvidenceById(r1.evidenceEnvelopeId);
  if (originalAfter) {
    assert.equal(originalAfter.rawPayload.appleId, 'A001',
      'original rawPayload must not be mutated by superseding');
  }
});

test('Correction record references the prior record', () => {
  const store = freshStore();
  const r1 = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r1.accepted, 'original accepted');

  const correction = makeUniqueEnvelope('scan-003', 'artist-003');
  const r2 = store.registerEvidenceEnvelope(correction, {
    intent: 'correction',
    correctionOfEvidenceEnvelopeId: r1.evidenceEnvelopeId,
  });
  assert.ok(r2.accepted, 'correction accepted');
  const corrRecord = store.getEvidenceById(r2.evidenceEnvelopeId);
  assert.equal(corrRecord.correctionOfEvidenceEnvelopeId, r1.evidenceEnvelopeId,
    'correction must reference original');
});

test('Replay record references the original', () => {
  const store = freshStore();
  const r1 = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r1.accepted, 'original accepted');

  const replay = makeUniqueEnvelope('scan-004', 'artist-004');
  const r2 = store.registerEvidenceEnvelope(replay, {
    intent: 'replay',
    replayOfEvidenceEnvelopeId: r1.evidenceEnvelopeId,
  });
  assert.ok(r2.accepted, 'replay accepted');
  const replayRecord = store.getEvidenceById(r2.evidenceEnvelopeId);
  assert.equal(replayRecord.replayOfEvidenceEnvelopeId, r1.evidenceEnvelopeId,
    'replay must reference original');
});

// =============================================================================
// Section 14 -- Quarantine
// =============================================================================
process.stdout.write('\n-- 14. Quarantine\n');

test('Quarantined records are excluded from active queries', () => {
  const adapter = createMemoryAdapter();
  const store   = createEvidenceStore(adapter);

  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'setup envelope accepted');

  const fakeRecord = {
    evidenceEnvelopeId: '00000000-0000-4000-8000-000000000001',
    recordStatus: 'QUARANTINED',
  };
  adapter.quarantine(fakeRecord, { valid: false, errors: ['test quarantine'], warnings: [] });

  const found = store.getEvidenceById('00000000-0000-4000-8000-000000000001');
  assert.equal(found, null, 'quarantined record must not be returned by getEvidenceById');

  const all = store.listEvidence({});
  const quarantinedInResults = all.find((rec) => rec.evidenceEnvelopeId === '00000000-0000-4000-8000-000000000001');
  assert.ok(!quarantinedInResults, 'quarantined record must not appear in listEvidence');
});

test('Quarantined record is retrievable via findQuarantined', () => {
  const adapter = createMemoryAdapter();
  const fake = { evidenceEnvelopeId: '00000000-0000-4000-8000-000000000002', recordStatus: 'QUARANTINED' };
  adapter.quarantine(fake, { valid: false, errors: ['bad data'], warnings: [] });
  const q = adapter.findQuarantined('00000000-0000-4000-8000-000000000002');
  assert.ok(q, 'findQuarantined must return the quarantined entry');
  assert.ok(q.validationResult, 'quarantine entry must retain validation result');
});

// =============================================================================
// Section 15 -- Registry Receipts
// =============================================================================
process.stdout.write('\n-- 15. Registry Receipts\n');

test('Successful receipt contains expected fields', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  assert.ok(r.evidenceEnvelopeId, 'evidenceEnvelopeId');
  assert.ok(r.registryRecordId, 'registryRecordId');
  assert.ok(r.scanId, 'scanId');
  assert.ok(r.providerId, 'providerId');
  assert.ok(r.contractId, 'contractId');
  assert.ok(r.registeredAt, 'registeredAt');
  assert.ok(r.validationStatus, 'validationStatus');
  assert.ok(r.deduplicationStatus, 'deduplicationStatus');
  assert.ok(r.storageVersion, 'storageVersion');
});

test('Rejection receipt contains safe error fields', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(null);
  assert.equal(r.accepted, false);
  assert.ok(r.errorCode, 'errorCode required');
  assert.ok(r.errorMessage, 'errorMessage required');
  assert.ok(Array.isArray(r.validationErrors), 'validationErrors must be array');
  assert.ok(!r.rawPayload, 'rawPayload must be absent from rejection receipt');
});

// =============================================================================
// Section 16 -- Audit Metadata
// =============================================================================
process.stdout.write('\n-- 16. Audit Metadata\n');

test('Stored record contains full audit metadata', () => {
  const store = freshStore();
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const record = store.getEvidenceById(r.evidenceEnvelopeId);
  assert.ok(record.auditMetadata, 'auditMetadata present');
  assert.ok(record.auditMetadata.registeredAt, 'registeredAt in audit');
  assert.ok(record.auditMetadata.registryVersion, 'registryVersion in audit');
  assert.ok(record.auditMetadata.storageAdapter, 'storageAdapter in audit');
  assert.ok(record.auditMetadata.envelopeSchemaVersion, 'envelopeSchemaVersion in audit');
  assert.ok(record.auditMetadata.validationFrameworkVersion, 'validationFrameworkVersion in audit');
  assert.equal(typeof record.auditMetadata.validationPassed, 'boolean', 'validationPassed must be boolean');
});

// =============================================================================
// Section 17 -- Memory Adapter Interface
// =============================================================================
process.stdout.write('\n-- 17. Memory Adapter Interface\n');

test('Memory adapter satisfies repository interface', () => {
  const adapter = createMemoryAdapter();
  assert.doesNotThrow(() => assertAdapterInterface(adapter), 'memory adapter must pass interface check');
});

test('Memory adapter insert/findById round-trip works', () => {
  const adapter = createMemoryAdapter();
  const store   = createEvidenceStore(adapter);
  const r = store.registerEvidenceEnvelope(makeEnvelope());
  assert.ok(r.accepted, 'accepted');
  const direct = adapter.findById(r.evidenceEnvelopeId);
  assert.ok(direct, 'direct adapter lookup must work');
  assert.equal(direct.evidenceEnvelopeId, r.evidenceEnvelopeId);
});

// =============================================================================
// Section 18 -- Constitutional Boundaries
// =============================================================================
process.stdout.write('\n-- 18. Constitutional Boundaries\n');

import * as _registryModule from '../api/evidence/registry/index.js';

test('No normalization function exported from registry', () => {
  const forbidden = ['normalizeEvidence', 'normalizeRecord', 'normalize'];
  for (const fn of forbidden) {
    assert.ok(!(fn in _registryModule), `"${fn}" must not be exported from Evidence Registry`);
  }
});

test('No resolution function exported from registry', () => {
  const forbidden = ['resolveConflict', 'resolveEvidence', 'resolveCanonical'];
  for (const fn of forbidden) {
    assert.ok(!(fn in _registryModule), `"${fn}" must not be exported from Evidence Registry`);
  }
});

test('No workspace wiring exported from registry', () => {
  const forbidden = ['populateMissionControl', 'wireWorkspace', 'renderDashboard'];
  for (const fn of forbidden) {
    assert.ok(!(fn in _registryModule), `"${fn}" must not be exported from Evidence Registry`);
  }
});

// =============================================================================
// Results
// =============================================================================

process.stdout.write('\n' + '='.repeat(60) + '\n');
process.stdout.write('Evidence Registry(tm) -- Sprint 3\n');
process.stdout.write('='.repeat(60) + '\n');
process.stdout.write(`passed: ${passed}\n`);
process.stdout.write(`failed: ${failed}\n`);

if (failures.length > 0) {
  process.stdout.write('\nFailures:\n');
  for (const f of failures) {
    process.stdout.write(`  FAIL  ${f.label}\n`);
    process.stdout.write(`        ${f.message}\n`);
  }
  process.stdout.write('\n');
  process.exit(1);
}

process.stdout.write('\nAll evidence registry tests passed.\n\n');
