// Canonical Intelligence Platform(tm) -- Mission Control Data API(tm)
// The constitutional public gateway between the Canonical Intelligence Platform(tm)
// and every application built on top of it.
//
// One Platform. One API. Many Consumers.
//
// No application may communicate directly with Evidence Registry, Normalization,
// Resolution, Canonical Intelligence Domains, or Monitoring. All access routes
// through this module.

import { MISSION_CONTROL_API_VERSION } from './version.js';
import { buildDefaultRegistry } from './registry.js';
import {
  getIdentity,
  getMusicRights,
  getCatalog,
  getDistribution,
  getMonitoring,
  getSystemOperations,
  getExecutiveOverview,
  dispatch,
} from './routes.js';
import { serializeResponse, serializeToJson, deserializeFromJson, verifySerializationIntegrity } from './serialization.js';
import {
  validateEndpointRegistration,
  validateResponse,
  validateResponseSchema,
  validateVersionCompatibility,
  assertResponseValid,
} from './validation.js';
import { createNotFoundResponse } from './responses.js';

export function createMissionControlApi({ endpointRegistry } = {}) {
  const registry = endpointRegistry || buildDefaultRegistry();

  function call(endpointId, params = {}) {
    if (!registry.isRegistered(endpointId)) {
      return createNotFoundResponse(endpointId, params);
    }
    return dispatch(endpointId, params);
  }

  return Object.freeze({
    // Domain endpoints
    getIdentity:           (params) => getIdentity(params),
    getMusicRights:        (params) => getMusicRights(params),
    getCatalog:            (params) => getCatalog(params),
    getDistribution:       (params) => getDistribution(params),
    getMonitoring:         (params) => getMonitoring(params),
    getSystemOperations:   (params) => getSystemOperations(params),
    getExecutiveOverview:  (params) => getExecutiveOverview(params),
    // Generic dispatch
    call,
    dispatch:              (endpointId, params) => dispatch(endpointId, params),
    // Registry inspection
    getEndpoint:           (id) => registry.getEndpoint(id),
    listEndpoints:         ()  => registry.listEndpoints(),
    isRegistered:          (id) => registry.isRegistered(id),
    endpointCount:         ()  => registry.size(),
    // Serialization
    serialize:             (response, format) => serializeResponse(response, format),
    serializeToJson:       (response, opts)   => serializeToJson(response, opts),
    // Version
    apiVersion:            MISSION_CONTROL_API_VERSION,
  });
}

export const MISSION_CONTROL_API = createMissionControlApi();

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { MISSION_CONTROL_API_VERSION }                                     from './version.js';
export {
  API_ENDPOINTS,
  API_VERSIONS,
  CURRENT_API_VERSION,
  ENDPOINT_STATUSES,
  RESPONSE_STATUSES,
  API_ERROR_CODES,
  CONSUMER_TYPES,
  SERIALIZATION_FORMATS,
  REQUIRED_ENDPOINT_FIELDS,
  REQUIRED_RESPONSE_FIELDS,
  VALID_API_ENDPOINTS,
  VALID_API_VERSIONS,
  VALID_ENDPOINT_STATUSES,
  VALID_RESPONSE_STATUSES,
  VALID_CONSUMER_TYPES,
  VALID_FORMATS,
}                                                                           from './types.js';
export { ENDPOINT_SCHEMAS, assertSchemaCoverage }                           from './schemas.js';
export { createEndpointRegistry, buildDefaultRegistry, DEFAULT_ENDPOINT_DEFS } from './registry.js';
export {
  createApiResponse,
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
}                                                                           from './responses.js';
export {
  serializeToJson,
  deserializeFromJson,
  serializeResponse,
  verifySerializationIntegrity,
}                                                                           from './serialization.js';
export {
  validateEndpointRegistration,
  validateResponse,
  validateResponseSchema,
  validateVersionCompatibility,
  validateSerializationIntegrity,
  assertResponseValid,
  assertEndpointValid,
}                                                                           from './validation.js';
export {
  getIdentity,
  getMusicRights,
  getCatalog,
  getDistribution,
  getMonitoring,
  getSystemOperations,
  getExecutiveOverview,
  dispatch,
}                                                                           from './routes.js';
