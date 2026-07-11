// Canonical Intelligence Platform(tm) -- Evidence Registry Hash Utilities
//
// Deterministic hashing for raw payload and parsed evidence integrity.
// Hashes allow future verification that stored evidence has not changed.
//
// Uses SHA-256 via Node.js built-in crypto module.
// canonicalStringify() sorts object keys so hash output is independent
// of key insertion order (important for cross-version comparisons).

import { createHash } from 'node:crypto';

// Recursively stringify with sorted keys for deterministic output.
function canonicalStringify(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k])).join(',') + '}';
}

// Compute a deterministic SHA-256 hash of any value.
// Returns a 64-character hex string.
export function computeHash(value) {
  const str = (value === null || value === undefined)
    ? 'null'
    : (typeof value === 'object')
    ? canonicalStringify(value)
    : String(value);
  return createHash('sha256').update(str, 'utf8').digest('hex');
}

// Compute the rawPayloadHash for a registry record.
// Returns a sentinel string if rawPayload is null (null is valid -- provider
// may not persist the raw response).
export function computeRawPayloadHash(rawPayload) {
  if (rawPayload === null || rawPayload === undefined) {
    return 'null-payload';
  }
  return computeHash(rawPayload);
}

// Compute the parsedEvidenceHash for a registry record.
// Returns a sentinel string if parsedEvidence is null.
export function computeParsedEvidenceHash(parsedEvidence) {
  if (parsedEvidence === null || parsedEvidence === undefined) {
    return 'null-evidence';
  }
  return computeHash(parsedEvidence);
}
