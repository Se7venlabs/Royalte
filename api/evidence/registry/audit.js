// Canonical Intelligence Platform(tm) -- Evidence Registry Audit Metadata
//
// Creates the audit metadata block attached to every registry record.
// Audit metadata explains:
//   - When the evidence entered Royaltee
//   - Which connector produced it
//   - Which contract validated it
//   - Which code versions were involved
//   - Whether validation passed
//   - Whether the record was a duplicate, replay, or correction
//
// This block is immutable once created. It is not updated if the record
// is later superseded -- the audit trail of what was known at registration
// time must be preserved exactly.

import { randomUUID } from 'node:crypto';

import { REGISTRY_VERSION, ENVELOPE_SCHEMA_VERSION, STORAGE_VERSION } from './version.js';
import { REGISTRY_EVENT_TYPES } from './types.js';
import { EVIDENCE_VERSION } from '../version.js';

// Create the audit metadata object for a new registry record.
//
// params:
//   envelope              -- the Evidence Envelope being registered
//   rawPayloadHash        -- pre-computed hash of envelope.rawPayload
//   parsedEvidenceHash    -- pre-computed hash of envelope.parsedEvidence
//   storageAdapterId      -- identifier of the storage adapter in use
//   registeredBy          -- identity of the registrant (default: 'royalte-system')
//   registrationSource    -- source of the registration call (default: 'evidence-registry-v1')
// Create a single Registry Event Log(tm) entry.
// Events are append-only -- once created, an event must never be modified or deleted.
//
// params:
//   eventType    -- REGISTRY_EVENT_TYPES value
//   actor        -- who triggered this event (default: 'royalte-system')
//   source       -- which component produced this event (default: 'evidence-registry-v1')
//   notes        -- optional human-readable description
//   metadata     -- optional structured data for the event
//   eventVersion -- optional event schema version (default: '1.0')
//                   allows the event schema to evolve independently of historical records
export function createEvent(eventType, actor, source, notes, metadata, eventVersion) {
  return Object.freeze({
    eventId:      randomUUID(),
    eventType:    eventType,
    eventVersion: eventVersion ?? '1.0',
    timestamp:    new Date().toISOString(),
    actor:        actor    ?? 'royalte-system',
    source:       source   ?? 'evidence-registry-v1',
    notes:        notes    ?? null,
    metadata:     metadata ? Object.freeze({ ...metadata }) : null,
  });
}

export function createAuditMetadata(envelope, rawPayloadHash, parsedEvidenceHash, storageAdapterId, registeredBy, registrationSource) {
  const now = new Date().toISOString();

  return Object.freeze({
    registeredAt:             now,
    registeredBy:             registeredBy    ?? 'royalte-system',
    registrationSource:       registrationSource ?? 'evidence-registry-v1',
    registryVersion:          REGISTRY_VERSION.version,
    storageAdapter:           storageAdapterId ?? 'unknown',
    envelopeSchemaVersion:    envelope.metadata?.envelopeVersion ?? ENVELOPE_SCHEMA_VERSION,
    contractVersion:          envelope.contractVersion ?? null,
    providerVersion:          envelope.provider?.version ?? null,
    connectorVersion:         envelope.connector?.version ?? null,
    validationFrameworkVersion: EVIDENCE_VERSION.version,
    storageVersion:           STORAGE_VERSION,
    rawPayloadHash:           rawPayloadHash,
    parsedEvidenceHash:       parsedEvidenceHash,
    validationPassed:         envelope.validation?.valid ?? false,
    validationErrorCount:     (envelope.validation?.errors ?? []).length,
  });
}
