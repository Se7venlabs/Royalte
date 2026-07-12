// Canonical Intelligence Platform(tm) -- Mission Control Data API Serialization(tm)
// Deterministic serialization of API responses.
// v1 supports JSON. Future formats: GraphQL-compatible, mobile, partner APIs.

import { SERIALIZATION_FORMATS, API_ERROR_CODES, VALID_FORMATS } from './types.js';

// Deterministic JSON: keys sorted recursively for stable output across runtimes.
function sortedReplacer(_key, value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    );
  }
  return value;
}

export function serializeToJson(response, { pretty = false } = {}) {
  if (response === undefined || response === null) {
    const err = new Error('Cannot serialize null or undefined response');
    err.code = API_ERROR_CODES.SERIALIZATION_FAILURE;
    throw err;
  }
  return pretty
    ? JSON.stringify(response, sortedReplacer, 2)
    : JSON.stringify(response, sortedReplacer);
}

export function deserializeFromJson(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    const err = new Error('deserializeFromJson requires a non-empty string');
    err.code = API_ERROR_CODES.SERIALIZATION_FAILURE;
    throw err;
  }
  try {
    return JSON.parse(jsonString);
  } catch (parseErr) {
    const err = new Error(`JSON parse failed: ${parseErr.message}`);
    err.code = API_ERROR_CODES.SERIALIZATION_FAILURE;
    throw err;
  }
}

export function serializeResponse(response, format = SERIALIZATION_FORMATS.JSON) {
  if (!VALID_FORMATS.has(format)) {
    const err = new Error(`Unknown serialization format: ${format}`);
    err.code = API_ERROR_CODES.UNKNOWN_FORMAT;
    throw err;
  }
  switch (format) {
    case SERIALIZATION_FORMATS.JSON:
      return serializeToJson(response);
    default:
      throw Object.assign(new Error(`Unsupported format: ${format}`), { code: API_ERROR_CODES.UNKNOWN_FORMAT });
  }
}

// Round-trip integrity check: serialize then parse and verify key presence.
export function verifySerializationIntegrity(response) {
  const serialized   = serializeToJson(response);
  const deserialized = deserializeFromJson(serialized);
  const originalKeys   = new Set(Object.keys(response));
  const deserializedKeys = new Set(Object.keys(deserialized));
  const missing = [...originalKeys].filter(k => !deserializedKeys.has(k));
  return Object.freeze({ valid: missing.length === 0, missingKeys: Object.freeze(missing), serialized });
}
