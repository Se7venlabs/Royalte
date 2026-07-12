// Canonical Intelligence Platform(tm) -- API Response Models(tm)
// Every Mission Control Data API response is an immutable envelope.
// No internal engine objects may leak into responses.

import {
  REQUIRED_RESPONSE_FIELDS,
  RESPONSE_STATUSES,
  API_ERROR_CODES,
  CURRENT_API_VERSION,
} from './types.js';
import { MISSION_CONTROL_API_VERSION } from './version.js';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) deepFreeze(val);
  }
  return obj;
}

export function createApiResponse({
  apiVersion,
  generatedAt,
  endpoint,
  scanId,
  artistId,
  domain,
  data,
  metadata,
  status,
}) {
  const payload = { apiVersion, generatedAt, endpoint, status, data, metadata };
  for (const f of REQUIRED_RESPONSE_FIELDS) {
    if (payload[f] === undefined || payload[f] === null) {
      const err = new Error(`ApiResponse missing required field: ${f}`);
      err.code = API_ERROR_CODES.SCHEMA_VIOLATION;
      throw err;
    }
  }

  return deepFreeze({
    apiVersion:   apiVersion  || CURRENT_API_VERSION,
    generatedAt:  generatedAt || new Date().toISOString(),
    endpoint,
    status,
    scanId:       scanId  || null,
    artistId:     artistId || null,
    domain:       domain  || endpoint,
    data:         data    || {},
    metadata:     metadata || {},
  });
}

export function createSuccessResponse(endpoint, data, {
  scanId,
  artistId,
  domain,
  metadata,
  apiVersion,
} = {}) {
  return createApiResponse({
    apiVersion:  apiVersion  || CURRENT_API_VERSION,
    generatedAt: new Date().toISOString(),
    endpoint,
    scanId,
    artistId,
    domain:      domain || endpoint,
    data:        data   || {},
    metadata:    metadata || { engineVersion: MISSION_CONTROL_API_VERSION.version },
    status:      RESPONSE_STATUSES.SUCCESS,
  });
}

export function createErrorResponse(endpoint, errorCode, message, {
  scanId,
  artistId,
  apiVersion,
} = {}) {
  return createApiResponse({
    apiVersion:  apiVersion || CURRENT_API_VERSION,
    generatedAt: new Date().toISOString(),
    endpoint:    endpoint   || 'unknown',
    scanId,
    artistId,
    domain:      endpoint   || 'unknown',
    data:        {},
    metadata:    {
      errorCode: errorCode || API_ERROR_CODES.INVALID_REQUEST,
      message:   message   || 'An error occurred',
      engineVersion: MISSION_CONTROL_API_VERSION.version,
    },
    status:      RESPONSE_STATUSES.ERROR,
  });
}

export function createNotFoundResponse(endpoint, { scanId, artistId, apiVersion } = {}) {
  return createApiResponse({
    apiVersion:  apiVersion || CURRENT_API_VERSION,
    generatedAt: new Date().toISOString(),
    endpoint:    endpoint  || 'unknown',
    scanId,
    artistId,
    domain:      endpoint  || 'unknown',
    data:        {},
    metadata:    {
      errorCode:    API_ERROR_CODES.ENDPOINT_NOT_FOUND,
      message:      `Endpoint not found: ${endpoint}`,
      engineVersion: MISSION_CONTROL_API_VERSION.version,
    },
    status: RESPONSE_STATUSES.NOT_FOUND,
  });
}
