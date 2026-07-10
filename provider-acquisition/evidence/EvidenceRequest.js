// EvidenceRequest — shape passed to acquire() — PAL Technical Design v3 §1.1
// Provider-neutral subject reference + evidence type + context.
// Connectors translate this into the provider's own query form.

import { randomUUID } from 'node:crypto';

export function createEvidenceRequest({ subjectRef, evidenceType, context = {} } = {}) {
  if (!subjectRef)   throw new TypeError('EvidenceRequest: subjectRef is required');
  if (!evidenceType) throw new TypeError('EvidenceRequest: evidenceType is required');

  return Object.freeze({
    requestId:    randomUUID(),
    subjectRef,               // provider-neutral artist / entity reference
    evidenceType,             // from the capability vocabulary (Capability enum)
    context:      Object.freeze({ ...context }),
    createdAt:    new Date().toISOString(),
  });
}
