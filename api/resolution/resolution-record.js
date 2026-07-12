// Canonical Intelligence Platform(tm) -- Resolution Record(tm)
// Immutable constitutional output artifact; consumed by Canonical Record layer.

import { randomUUID } from 'crypto';
import { RESOLUTION_ENGINE_VERSION } from './version.js';

export function createResolutionRecord({
  resolutionRecordId,
  normalizedRecordIds,
  resolvedField,
  canonicalValue,
  confidence,
  confidenceLevel,
  selectedProvider,
  selectedRule,
  resolutionPolicyId,
  provenanceId,
  resolutionManifestId,
  conflictType,
  engineVersion,
  createdAt,
} = {}) {
  return Object.freeze({
    resolutionRecordId:   resolutionRecordId   ?? randomUUID(),
    normalizedRecordIds:  Object.freeze([...(normalizedRecordIds  ?? [])]),
    resolvedField:        resolvedField         ?? null,
    canonicalValue:       canonicalValue        ?? null,
    confidence:           confidence            ?? 0,
    confidenceLevel:      confidenceLevel       ?? 'UNCERTAIN',
    selectedProvider:     selectedProvider      ?? null,
    selectedRule:         selectedRule          ?? null,
    resolutionPolicyId:   resolutionPolicyId    ?? null,
    provenanceId:         provenanceId          ?? null,
    resolutionManifestId: resolutionManifestId  ?? null,
    conflictType:         conflictType          ?? null,
    engineVersion:        engineVersion         ?? RESOLUTION_ENGINE_VERSION.version,
    createdAt:            createdAt             ?? new Date().toISOString(),
  });
}
