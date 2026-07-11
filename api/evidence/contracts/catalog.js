// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — CatalogEvidence Contract
// ─────────────────────────────────────────────────────────────────────────────
//
// Defines the evidence shape every connector must produce when contributing
// to catalog intelligence. This contract covers what an artist has released.
//
// Evidence fields describe raw provider-contributed catalog data.
// Canonical catalog resolution (ISRC matching, release deduplication)
// is not performed at this layer.
//
// ─────────────────────────────────────────────────────────────────────────────

export const CATALOG_CONTRACT = Object.freeze({
  contractId:   'CatalogEvidence',
  displayName:  'Catalog Evidence',
  category:     'Catalog',
  version:      '1.0.0',
  status:       'ACTIVE',
  description:  'Evidence describing what an artist has released: albums, EPs, singles, tracks, and ISRC coverage.',

  evidenceFields: Object.freeze([
    {
      id:          'releaseCount',
      displayName: 'Release Count',
      dataType:    'number',
      required:    false,
      description: 'Total number of releases found for this artist by this provider.',
    },
    {
      id:          'trackCount',
      displayName: 'Track Count',
      dataType:    'number',
      required:    false,
      description: 'Total number of individual tracks found across all releases.',
    },
    {
      id:          'albumCount',
      displayName: 'Album Count',
      dataType:    'number',
      required:    false,
      description: 'Number of full-length albums found for this artist.',
    },
    {
      id:          'epCount',
      displayName: 'EP Count',
      dataType:    'number',
      required:    false,
      description: 'Number of EPs found for this artist.',
    },
    {
      id:          'singleCount',
      displayName: 'Single Count',
      dataType:    'number',
      required:    false,
      description: 'Number of singles found for this artist.',
    },
    {
      id:          'releases',
      displayName: 'Releases',
      dataType:    'array',
      required:    false,
      description: 'Raw list of release objects returned by this provider.',
    },
    {
      id:          'tracks',
      displayName: 'Tracks',
      dataType:    'array',
      required:    false,
      description: 'Raw list of track objects returned by this provider.',
    },
    {
      id:          'isrcs',
      displayName: 'ISRCs',
      dataType:    'array',
      required:    false,
      description: 'International Standard Recording Codes found across the artist\'s catalog by this provider.',
    },
    {
      id:          'primaryRelease',
      displayName: 'Primary Release',
      dataType:    'object',
      required:    false,
      description: 'The provider\'s best-available or most prominent release for this artist.',
    },
    {
      id:          'latestRelease',
      displayName: 'Latest Release',
      dataType:    'object',
      required:    false,
      description: 'The most recently released work found for this artist by this provider.',
    },
  ]),
});
