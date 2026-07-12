// Canonical Intelligence Platform(tm) -- API Endpoint Registry(tm)
// Sole registrar of all Mission Control Data API public endpoints.
// Every endpoint is registered here before it can be called.

import {
  REQUIRED_ENDPOINT_FIELDS,
  API_ERROR_CODES,
  VALID_API_VERSIONS,
  VALID_ENDPOINT_STATUSES,
  ENDPOINT_STATUSES,
} from './types.js';
import { ENDPOINT_SCHEMAS } from './schemas.js';

function assertEndpointInterface(endpoint) {
  for (const field of REQUIRED_ENDPOINT_FIELDS) {
    if (endpoint[field] === undefined || endpoint[field] === null) {
      const err = new Error(`Endpoint registration missing required field: ${field}`);
      err.code = API_ERROR_CODES.VALIDATION_FAILED;
      throw err;
    }
  }
  if (!VALID_API_VERSIONS.has(endpoint.version)) {
    const err = new Error(`Unknown API version: ${endpoint.version}`);
    err.code = API_ERROR_CODES.VERSION_MISMATCH;
    throw err;
  }
  if (!VALID_ENDPOINT_STATUSES.has(endpoint.status)) {
    const err = new Error(`Unknown endpoint status: ${endpoint.status}`);
    err.code = API_ERROR_CODES.VALIDATION_FAILED;
    throw err;
  }
}

export function createEndpointRegistry() {
  const endpoints = new Map();

  function registerEndpoint({
    endpointId,
    version,
    consumer,
    responseSchema,
    status,
    description,
  }) {
    const record = { endpointId, version, consumer, responseSchema, status, description: description || '' };
    assertEndpointInterface(record);
    if (endpoints.has(endpointId)) {
      const err = new Error(`Duplicate endpointId: ${endpointId}`);
      err.code = API_ERROR_CODES.DUPLICATE_ENDPOINT;
      throw err;
    }
    endpoints.set(endpointId, Object.freeze(record));
    return Object.freeze(record);
  }

  function getEndpoint(endpointId) {
    return endpoints.get(endpointId) || null;
  }

  function listEndpoints() {
    return Object.freeze([...endpoints.values()]);
  }

  function listByConsumer(consumer) {
    return Object.freeze([...endpoints.values()].filter(e => e.consumer === consumer));
  }

  function listByStatus(status) {
    return Object.freeze([...endpoints.values()].filter(e => e.status === status));
  }

  function isRegistered(endpointId) {
    return endpoints.has(endpointId);
  }

  function size() {
    return endpoints.size;
  }

  return Object.freeze({
    registerEndpoint,
    getEndpoint,
    listEndpoints,
    listByConsumer,
    listByStatus,
    isRegistered,
    size,
  });
}

const DEFAULT_ENDPOINT_DEFS = Object.freeze([
  {
    endpointId:     'identity',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.identity,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Canonical artist identity intelligence',
  },
  {
    endpointId:     'music_rights',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.music_rights,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Music rights and publishing intelligence',
  },
  {
    endpointId:     'catalog',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.catalog,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Catalog intelligence',
  },
  {
    endpointId:     'distribution',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.distribution,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Distribution availability intelligence',
  },
  {
    endpointId:     'monitoring',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.monitoring,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Monitoring and change detection intelligence',
  },
  {
    endpointId:     'system_operations',
    version:        'v1',
    consumer:       'mission_control',
    responseSchema: ENDPOINT_SCHEMAS.system_operations,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'System operations intelligence',
  },
  {
    endpointId:     'executive_overview',
    version:        'v1',
    consumer:       'executive_intelligence',
    responseSchema: ENDPOINT_SCHEMAS.executive_overview,
    status:         ENDPOINT_STATUSES.ACTIVE,
    description:    'Aggregated executive overview across all Canonical Intelligence Domains',
  },
]);

export function buildDefaultRegistry() {
  const registry = createEndpointRegistry();
  for (const def of DEFAULT_ENDPOINT_DEFS) registry.registerEndpoint(def);
  return registry;
}

export { DEFAULT_ENDPOINT_DEFS };
