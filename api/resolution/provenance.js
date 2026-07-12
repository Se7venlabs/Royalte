// Canonical Intelligence Platform(tm) -- Field Provenance(tm)
// Permanent record of how every canonical value was selected.

import { randomUUID } from 'crypto';
import { RESOLUTION_ENGINE_VERSION } from './version.js';

export function createFieldProvenance({
  provenanceId,
  resolvedField,
  canonicalValue,
  selectedProvider,
  supportingProviders,
  conflictingProviders,
  resolutionRule,
  resolutionPolicyId,
  confidence,
  confidenceLevel,
  normalizedRecordIds,
  conflictType,
  timestamp,
  engineVersion,
} = {}) {
  return Object.freeze({
    provenanceId:         provenanceId         ?? randomUUID(),
    resolvedField:        resolvedField         ?? null,
    canonicalValue:       canonicalValue        ?? null,
    selectedProvider:     selectedProvider      ?? null,
    supportingProviders:  Object.freeze([...(supportingProviders  ?? [])]),
    conflictingProviders: Object.freeze([...(conflictingProviders ?? [])]),
    resolutionRule:       resolutionRule        ?? null,
    resolutionPolicyId:   resolutionPolicyId    ?? null,
    confidence:           confidence            ?? 0,
    confidenceLevel:      confidenceLevel       ?? 'UNCERTAIN',
    normalizedRecordIds:  Object.freeze([...(normalizedRecordIds  ?? [])]),
    conflictType:         conflictType          ?? null,
    timestamp:            timestamp             ?? new Date().toISOString(),
    engineVersion:        engineVersion         ?? RESOLUTION_ENGINE_VERSION.version,
  });
}
