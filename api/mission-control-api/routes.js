// Canonical Intelligence Platform(tm) -- Mission Control Data API Endpoint Layer(tm)
// Read-only public methods. Each method extracts one domain slice from canonicalDomains
// and wraps it in an immutable, versioned API response.
// No application may bypass this layer to access platform engines directly.

import { API_ENDPOINTS, API_ERROR_CODES, RESPONSE_STATUSES } from './types.js';
import { createSuccessResponse, createErrorResponse, createNotFoundResponse } from './responses.js';

// Extract a named sub-object from canonicalDomains safely.
function extractDomain(canonicalDomains, key) {
  if (!canonicalDomains || typeof canonicalDomains !== 'object') return {};
  return canonicalDomains[key] || {};
}

export function getIdentity({ canonicalDomains, scanId, artistId } = {}) {
  const data = extractDomain(canonicalDomains, 'identity');
  return createSuccessResponse(API_ENDPOINTS.IDENTITY, data, { scanId, artistId });
}

export function getMusicRights({ canonicalDomains, scanId, artistId } = {}) {
  const data = {
    ...extractDomain(canonicalDomains, 'publishing'),
    ...extractDomain(canonicalDomains, 'music_rights'),
  };
  return createSuccessResponse(API_ENDPOINTS.MUSIC_RIGHTS, data, { scanId, artistId });
}

export function getCatalog({ canonicalDomains, scanId, artistId } = {}) {
  const data = extractDomain(canonicalDomains, 'catalog');
  return createSuccessResponse(API_ENDPOINTS.CATALOG, data, { scanId, artistId });
}

export function getDistribution({ canonicalDomains, scanId, artistId } = {}) {
  const data = extractDomain(canonicalDomains, 'distribution');
  return createSuccessResponse(API_ENDPOINTS.DISTRIBUTION, data, { scanId, artistId });
}

export function getMonitoring({ timeline, alerts, latestChanges, snapshotId, scanId, artistId } = {}) {
  const data = {
    timeline:       timeline      || [],
    alerts:         alerts        || [],
    latestChanges:  latestChanges || null,
    snapshotId:     snapshotId    || null,
    changeCount:    Array.isArray(timeline) ? timeline.length : 0,
  };
  return createSuccessResponse(API_ENDPOINTS.MONITORING, data, { scanId, artistId });
}

export function getSystemOperations({ canonicalDomains, scanId, artistId } = {}) {
  const data = extractDomain(canonicalDomains, 'system_operations');
  return createSuccessResponse(API_ENDPOINTS.SYSTEM_OPERATIONS, data, { scanId, artistId });
}

export function getExecutiveOverview({
  canonicalDomains,
  timeline,
  alerts,
  scanId,
  artistId,
} = {}) {
  const data = {
    artistId:         artistId || null,
    identity:         extractDomain(canonicalDomains, 'identity'),
    musicRights:      {
      ...extractDomain(canonicalDomains, 'publishing'),
      ...extractDomain(canonicalDomains, 'music_rights'),
    },
    catalog:          extractDomain(canonicalDomains, 'catalog'),
    distribution:     extractDomain(canonicalDomains, 'distribution'),
    monitoring: {
      timeline:    timeline    || [],
      alerts:      alerts      || [],
      changeCount: Array.isArray(timeline) ? timeline.length : 0,
    },
    systemOperations: extractDomain(canonicalDomains, 'system_operations'),
  };
  return createSuccessResponse(API_ENDPOINTS.EXECUTIVE_OVERVIEW, data, { scanId, artistId });
}

// Dispatch routes an endpointId to the correct handler.
export function dispatch(endpointId, params = {}) {
  switch (endpointId) {
    case API_ENDPOINTS.IDENTITY:           return getIdentity(params);
    case API_ENDPOINTS.MUSIC_RIGHTS:       return getMusicRights(params);
    case API_ENDPOINTS.CATALOG:            return getCatalog(params);
    case API_ENDPOINTS.DISTRIBUTION:       return getDistribution(params);
    case API_ENDPOINTS.MONITORING:         return getMonitoring(params);
    case API_ENDPOINTS.SYSTEM_OPERATIONS:  return getSystemOperations(params);
    case API_ENDPOINTS.EXECUTIVE_OVERVIEW: return getExecutiveOverview(params);
    default:
      return createNotFoundResponse(endpointId, params);
  }
}
