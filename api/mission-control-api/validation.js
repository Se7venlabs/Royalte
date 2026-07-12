// Canonical Intelligence Platform(tm) -- Mission Control Data API Validation

import {
  REQUIRED_ENDPOINT_FIELDS,
  REQUIRED_RESPONSE_FIELDS,
  API_ERROR_CODES,
  VALID_API_VERSIONS,
  VALID_ENDPOINT_STATUSES,
  VALID_RESPONSE_STATUSES,
} from './types.js';

function checkRequired(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) errors.push(`${label} missing required field: ${f}`);
  }
  return errors;
}

export function validateEndpointRegistration(endpoint) {
  if (!endpoint || typeof endpoint !== 'object') {
    return { valid: false, errors: ['endpoint must be a non-null object'] };
  }
  const errors = checkRequired(endpoint, REQUIRED_ENDPOINT_FIELDS, 'Endpoint');
  if (endpoint.version && !VALID_API_VERSIONS.has(endpoint.version)) {
    errors.push(`Unknown API version: ${endpoint.version}`);
  }
  if (endpoint.status && !VALID_ENDPOINT_STATUSES.has(endpoint.status)) {
    errors.push(`Unknown endpoint status: ${endpoint.status}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateResponse(response) {
  if (!response || typeof response !== 'object') {
    return { valid: false, errors: ['response must be a non-null object'] };
  }
  const errors = checkRequired(response, REQUIRED_RESPONSE_FIELDS, 'Response');
  if (response.status && !VALID_RESPONSE_STATUSES.has(response.status)) {
    errors.push(`Unknown response status: ${response.status}`);
  }
  if (response.apiVersion && !VALID_API_VERSIONS.has(response.apiVersion)) {
    errors.push(`Unknown apiVersion: ${response.apiVersion}`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateResponseSchema(response, schema) {
  if (!response || !schema) return { valid: false, errors: ['response and schema are required'] };
  const errors = [];
  for (const field of (schema.required || [])) {
    if (response.data[field] === undefined || response.data[field] === null) {
      errors.push(`Response data missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateVersionCompatibility(responseVersion, requestedVersion) {
  if (!responseVersion || !requestedVersion) {
    return { compatible: false, reason: 'Both versions required' };
  }
  const compatible = responseVersion === requestedVersion;
  return {
    compatible,
    reason: compatible ? null : `Version mismatch: response=${responseVersion}, requested=${requestedVersion}`,
  };
}

export function validateSerializationIntegrity(original, deserialized) {
  const errors = [];
  for (const key of REQUIRED_RESPONSE_FIELDS) {
    if (deserialized[key] === undefined) errors.push(`Deserialized response missing field: ${key}`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertResponseValid(response) {
  const { valid, errors } = validateResponse(response);
  if (!valid) {
    const err = new Error(`Response validation failed: ${errors.join('; ')}`);
    err.code = API_ERROR_CODES.SCHEMA_VIOLATION;
    throw err;
  }
}

export function assertEndpointValid(endpoint) {
  const { valid, errors } = validateEndpointRegistration(endpoint);
  if (!valid) {
    const err = new Error(`Endpoint validation failed: ${errors.join('; ')}`);
    err.code = API_ERROR_CODES.VALIDATION_FAILED;
    throw err;
  }
}
