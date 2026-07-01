// EvidenceContract — common evidence envelope — PAL Technical Design v3 §3.2 / §6
// Provider-agnostic. Validates envelope well-formedness only.
// payload and providerFields are opaque containers — their internal shape is never
// defined or parsed here. That would be provider-specific logic, forbidden in the PAL.

import { randomUUID } from 'node:crypto';

export const SCHEMA_VERSION = '1.0';

const VALID_COMPLETENESS = new Set(['full', 'partial', 'empty']);

export function createEvidenceContract({
  acquisitionId,
  correlationId,
  requestId,
  provider,
  providerVersion,
  connectorVersion,
  providerTrust,
  capabilityProfileRef,
  acquiredAt,
  providerReportedAt = null,
  health,
  completeness,
  payload,
  providerFields = {},
  payloadChecksum,
  rawResponseHash,
} = {}) {
  const missing = [];
  if (!acquisitionId)        missing.push('acquisitionId');
  if (!correlationId)        missing.push('correlationId');
  if (!requestId)            missing.push('requestId');
  if (!provider)             missing.push('provider');
  if (!providerVersion)      missing.push('providerVersion');
  if (!connectorVersion)     missing.push('connectorVersion');
  if (providerTrust == null) missing.push('providerTrust');
  if (!capabilityProfileRef) missing.push('capabilityProfileRef');
  if (!acquiredAt)           missing.push('acquiredAt');
  if (!health)               missing.push('health');
  if (!completeness)         missing.push('completeness');
  if (payload === undefined) missing.push('payload');
  if (!payloadChecksum)      missing.push('payloadChecksum');
  if (!rawResponseHash)      missing.push('rawResponseHash');

  if (missing.length > 0) {
    throw new Error(`EvidenceContract: missing required envelope fields: ${missing.join(', ')}`);
  }
  if (!VALID_COMPLETENESS.has(completeness)) {
    throw new Error(`EvidenceContract: invalid completeness "${completeness}". Must be: full | partial | empty`);
  }

  return Object.freeze({
    evidenceId:          randomUUID(),
    schemaVersion:       SCHEMA_VERSION,
    acquisitionId,
    correlationId,
    requestId,
    provider,
    providerVersion,
    connectorVersion,
    providerTrust,
    capabilityProfileRef,
    acquiredAt,
    providerReportedAt,
    health,
    completeness,
    payload,                               // opaque — framework never reads inside
    providerFields: Object.freeze({ ...providerFields }),
    payloadChecksum,
    rawResponseHash,
  });
}
