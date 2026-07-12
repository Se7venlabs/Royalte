// Canonical Intelligence Platform(tm) -- Resolution Manifest(tm)
// Permanent constitutional audit companion to every Resolution Record.

import { randomUUID } from 'crypto';
import { RESOLUTION_ENGINE_VERSION } from './version.js';

export function createResolutionManifest({
  manifestId,
  resolvedField,
  inputNormalizedRecordIds,
  policyId,
  policyName,
  resolutionRule,
  conflictRecord,
  confidenceCalculation,
  outputResolutionRecordId,
  outputProvenanceId,
  processingTime,
  warnings,
  errors,
  engineVersion,
  createdAt,
} = {}) {
  return Object.freeze({
    manifestId:               manifestId               ?? randomUUID(),
    resolvedField:            resolvedField             ?? null,
    inputNormalizedRecordIds: Object.freeze([...(inputNormalizedRecordIds ?? [])]),
    policyId:                 policyId                  ?? null,
    policyName:               policyName                ?? null,
    resolutionRule:           resolutionRule             ?? null,
    conflictRecord:           conflictRecord             ?? null,
    confidenceCalculation:    confidenceCalculation      ?? null,
    outputResolutionRecordId: outputResolutionRecordId  ?? null,
    outputProvenanceId:       outputProvenanceId         ?? null,
    processingTime:           typeof processingTime === 'number' ? processingTime : null,
    warnings:                 Object.freeze([...(warnings ?? [])]),
    errors:                   Object.freeze([...(errors   ?? [])]),
    engineVersion:            engineVersion              ?? RESOLUTION_ENGINE_VERSION.version,
    createdAt:                createdAt                  ?? new Date().toISOString(),
  });
}
