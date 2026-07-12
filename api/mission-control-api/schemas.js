// Canonical Intelligence Platform(tm) -- Mission Control Data API Response Schemas
// Each schema defines the contract for one endpoint's data payload.
// No internal engine objects may appear in response schemas.

import { API_ENDPOINTS } from './types.js';

// Field-level schema: { required: string[], optional: string[], description: string }
export const ENDPOINT_SCHEMAS = Object.freeze({

  [API_ENDPOINTS.IDENTITY]: Object.freeze({
    description: 'Canonical artist identity intelligence',
    required:    Object.freeze(['artistId']),
    optional:    Object.freeze(['artistName', 'verified', 'ipi', 'isni', 'rights', 'providers', 'coverage']),
  }),

  [API_ENDPOINTS.MUSIC_RIGHTS]: Object.freeze({
    description: 'Music rights and publishing intelligence',
    required:    Object.freeze([]),
    optional:    Object.freeze(['publisher', 'coPublisher', 'writer', 'iswc', 'pro', 'rights', 'split', 'ownership']),
  }),

  [API_ENDPOINTS.CATALOG]: Object.freeze({
    description: 'Catalog intelligence — releases, genre, label, distributor',
    required:    Object.freeze([]),
    optional:    Object.freeze(['releaseCount', 'genre', 'label', 'distributor', 'releaseDate', 'isrcCoverage']),
  }),

  [API_ENDPOINTS.DISTRIBUTION]: Object.freeze({
    description: 'Distribution availability and DSP coverage intelligence',
    required:    Object.freeze([]),
    optional:    Object.freeze(['label', 'distributor', 'dspCoverage', 'status', 'territories', 'platforms']),
  }),

  [API_ENDPOINTS.MONITORING]: Object.freeze({
    description: 'Monitoring and change detection intelligence',
    required:    Object.freeze([]),
    optional:    Object.freeze(['latestChanges', 'timeline', 'alerts', 'snapshotId', 'changeCount']),
  }),

  [API_ENDPOINTS.SYSTEM_OPERATIONS]: Object.freeze({
    description: 'System operations and platform health intelligence',
    required:    Object.freeze([]),
    optional:    Object.freeze(['scanStatus', 'lastScanAt', 'platformStatus', 'certificationStatus']),
  }),

  [API_ENDPOINTS.EXECUTIVE_OVERVIEW]: Object.freeze({
    description: 'Aggregated executive overview across all Canonical Intelligence Domains',
    required:    Object.freeze(['artistId']),
    optional:    Object.freeze(['identity', 'musicRights', 'catalog', 'distribution', 'monitoring', 'systemOperations']),
  }),

});

// Verify every registered endpoint has a schema at module load time.
export function assertSchemaCoverage() {
  const missing = [];
  for (const endpoint of Object.values(API_ENDPOINTS)) {
    if (!ENDPOINT_SCHEMAS[endpoint]) missing.push(endpoint);
  }
  if (missing.length) throw new Error(`Missing schemas for endpoints: ${missing.join(', ')}`);
}

assertSchemaCoverage();
