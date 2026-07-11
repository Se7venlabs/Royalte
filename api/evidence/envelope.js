// Canonical Intelligence Platform(tm) -- Evidence Envelope(tm)
//
// The standard transport object passed between every layer of the
// Canonical Intelligence Platform pipeline:
//
//   Connector -> Evidence Registry -> Normalization -> Resolution -> Canonical Registry
//
// The Envelope retains the complete provider payload while carrying validated,
// standardized evidence. The Evidence Contract governs parsedEvidence only.
// The raw provider response is preserved untouched in rawPayload.
//
// Envelope shape:
//   envelopeId       -- globally unique identifier for this envelope instance
//   metadata         -- envelope versioning and provenance
//   provider         -- which provider this evidence came from
//   connector        -- which connector produced this envelope
//   contractId       -- the Evidence Contract parsedEvidence satisfies
//   contractVersion  -- the contract version used
//   rawPayload       -- the unmodified provider response (null if not stored)
//   parsedEvidence   -- the validated evidence object conforming to the contract
//   validation       -- validation result attached at creation time
//   trace            -- scan/request tracing identifiers
//   timestamps       -- full lifecycle timestamp record
//
// createEnvelope(params) is the sole factory for Evidence Envelopes.
// No connector may construct an envelope object literal directly.

import { VALID_PROVIDER_IDS }           from './providers.js';
import { VALID_EVIDENCE_STATUSES, VALID_EVIDENCE_CONFIDENCES } from './types.js';

// Required top-level envelope properties for validation.
const REQUIRED_ENVELOPE_PROPS = [
  'envelopeId',
  'metadata',
  'provider',
  'connector',
  'contractId',
  'contractVersion',
  'parsedEvidence',
  'validation',
  'trace',
  'timestamps',
];

const REQUIRED_METADATA_PROPS  = ['envelopeVersion', 'createdAt'];
const REQUIRED_PROVIDER_PROPS  = ['id', 'version'];
const REQUIRED_CONNECTOR_PROPS = ['id', 'version'];
const REQUIRED_TRACE_PROPS     = ['scanId', 'artistId'];
const REQUIRED_TIMESTAMP_PROPS = ['requestedAt', 'envelopedAt'];

// Generates a simple unique ID. Not cryptographic -- for trace correlation only.
function generateEnvelopeId() {
  const ts  = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `env_${ts}_${rnd}`;
}

// Factory -- the sole way to construct an Evidence Envelope.
//
// params:
//   provider        {id, version, displayName?}
//   connector       {id, version, executionId?}
//   contractId      string
//   contractVersion string
//   rawPayload      any -- the unmodified provider response; may be null
//   parsedEvidence  object -- the evidence object conforming to the contract
//   validation      {valid, errors, warnings, validatedAt}
//   trace           {scanId, artistId, requestId?, correlationId?}
//   timestamps      {requestedAt, receivedAt?, parsedAt?, envelopedAt}
//
export function createEnvelope(params) {
  const now = new Date().toISOString();

  return Object.freeze({
    envelopeId: generateEnvelopeId(),

    metadata: Object.freeze({
      envelopeVersion: '1.0.0',
      createdAt: now,
      ...(params.metadata ?? {}),
    }),

    provider: Object.freeze({
      id:          params.provider?.id          ?? null,
      version:     params.provider?.version     ?? null,
      displayName: params.provider?.displayName ?? null,
    }),

    connector: Object.freeze({
      id:          params.connector?.id          ?? null,
      version:     params.connector?.version     ?? null,
      executionId: params.connector?.executionId ?? null,
    }),

    contractId:      params.contractId      ?? null,
    contractVersion: params.contractVersion ?? null,

    rawPayload: params.rawPayload ?? null,

    parsedEvidence: params.parsedEvidence
      ? Object.freeze({ ...params.parsedEvidence })
      : null,

    validation: Object.freeze({
      valid:       params.validation?.valid       ?? false,
      errors:      Object.freeze([...(params.validation?.errors   ?? [])]),
      warnings:    Object.freeze([...(params.validation?.warnings ?? [])]),
      validatedAt: params.validation?.validatedAt ?? now,
    }),

    trace: Object.freeze({
      scanId:        params.trace?.scanId        ?? null,
      artistId:      params.trace?.artistId      ?? null,
      requestId:     params.trace?.requestId     ?? null,
      correlationId: params.trace?.correlationId ?? null,
    }),

    timestamps: Object.freeze({
      requestedAt: params.timestamps?.requestedAt ?? null,
      receivedAt:  params.timestamps?.receivedAt  ?? null,
      parsedAt:    params.timestamps?.parsedAt    ?? null,
      envelopedAt: params.timestamps?.envelopedAt ?? now,
    }),
  });
}

// Validates an Evidence Envelope structure.
// Checks shape and required fields only -- does not re-run evidence validation.
// Returns { valid: boolean, errors: string[], warnings: string[] }.
export function validateEnvelope(envelope) {
  const errors   = [];
  const warnings = [];

  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, errors: ['Envelope must be a non-null object'], warnings };
  }

  const eid = envelope.envelopeId ?? '(unknown)';

  // Top-level required properties
  for (const prop of REQUIRED_ENVELOPE_PROPS) {
    if (envelope[prop] === undefined || envelope[prop] === null) {
      errors.push(`Envelope "${eid}": missing required property "${prop}"`);
    }
  }

  // metadata sub-object
  if (envelope.metadata && typeof envelope.metadata === 'object') {
    for (const prop of REQUIRED_METADATA_PROPS) {
      if (!envelope.metadata[prop]) {
        errors.push(`Envelope "${eid}": missing metadata.${prop}`);
      }
    }
  }

  // provider sub-object
  if (envelope.provider && typeof envelope.provider === 'object') {
    for (const prop of REQUIRED_PROVIDER_PROPS) {
      if (!envelope.provider[prop]) {
        errors.push(`Envelope "${eid}": missing provider.${prop}`);
      }
    }
    if (envelope.provider.id && !VALID_PROVIDER_IDS.has(envelope.provider.id)) {
      errors.push(`Envelope "${eid}": unknown provider.id "${envelope.provider.id}"`);
    }
  }

  // connector sub-object
  if (envelope.connector && typeof envelope.connector === 'object') {
    for (const prop of REQUIRED_CONNECTOR_PROPS) {
      if (!envelope.connector[prop]) {
        errors.push(`Envelope "${eid}": missing connector.${prop}`);
      }
    }
  }

  // trace sub-object
  if (envelope.trace && typeof envelope.trace === 'object') {
    for (const prop of REQUIRED_TRACE_PROPS) {
      if (!envelope.trace[prop]) {
        errors.push(`Envelope "${eid}": missing trace.${prop}`);
      }
    }
  }

  // timestamps sub-object
  if (envelope.timestamps && typeof envelope.timestamps === 'object') {
    for (const prop of REQUIRED_TIMESTAMP_PROPS) {
      if (!envelope.timestamps[prop]) {
        errors.push(`Envelope "${eid}": missing timestamps.${prop}`);
      }
    }
  }

  // contractId must be a string
  if (envelope.contractId !== null && typeof envelope.contractId !== 'string') {
    errors.push(`Envelope "${eid}": contractId must be a string`);
  }

  // parsedEvidence must be a non-array object when present
  if (envelope.parsedEvidence !== null && envelope.parsedEvidence !== undefined) {
    if (typeof envelope.parsedEvidence !== 'object' || Array.isArray(envelope.parsedEvidence)) {
      errors.push(`Envelope "${eid}": parsedEvidence must be a non-array object`);
    }
  }

  // validation.valid must be a boolean
  if (envelope.validation && typeof envelope.validation.valid !== 'boolean') {
    errors.push(`Envelope "${eid}": validation.valid must be a boolean`);
  }

  // Warn if validation failed but envelope is being passed downstream
  if (envelope.validation && envelope.validation.valid === false) {
    warnings.push(
      `Envelope "${eid}": parsedEvidence failed validation -- downstream consumers should reject this envelope`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}
