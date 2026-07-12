// Canonical Intelligence Platform(tm) -- Sprint 5 Default Resolution Policies
// Provider priority order reflects constitutional trust hierarchy.
// No provider ordering may exist outside this policy registry.

import { RESOLUTION_CATEGORIES, POLICY_STATUSES, RESOLUTION_RULES } from './types.js';

const { ACTIVE } = POLICY_STATUSES;
const { POLICY_PRIORITY } = RESOLUTION_RULES;

export const DEFAULT_POLICIES = Object.freeze([

  // IDENTITY
  {
    policyId:       'ARTIST_NAME_POLICY',
    policyName:     'Artist Name Resolution Policy',
    field:          'artistName',
    providerOrder:  ['apple-music', 'spotify', 'tidal', 'musicbrainz', 'discogs', 'deezer'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.IDENTITY,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Canonical artist name: Apple Music is primary; all major platforms supplement.',
  },
  {
    policyId:       'ARTIST_ID_POLICY',
    policyName:     'Platform Artist ID Resolution Policy',
    field:          'artistId',
    providerOrder:  ['apple-music', 'spotify', 'musicbrainz', 'tidal', 'deezer'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.IDENTITY,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Platform-specific artist ID: resolved per provider priority.',
  },

  // CATALOG
  {
    policyId:       'RECORD_LABEL_POLICY',
    policyName:     'Record Label Resolution Policy',
    field:          'recordLabel',
    providerOrder:  ['musicbrainz', 'discogs', 'apple-music', 'spotify', 'tidal'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.CATALOG,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Record label: MusicBrainz + Discogs are primary catalog authorities.',
  },
  {
    policyId:       'GENRE_POLICY',
    policyName:     'Genre Resolution Policy',
    field:          'genre',
    providerOrder:  ['apple-music', 'spotify', 'musicbrainz', 'discogs'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.CATALOG,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Primary genre: Apple Music editorial taxonomy is authoritative.',
  },
  {
    policyId:       'RELEASE_DATE_POLICY',
    policyName:     'Release Date Resolution Policy',
    field:          'releaseDate',
    providerOrder:  ['musicbrainz', 'apple-music', 'spotify', 'discogs', 'tidal'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.CATALOG,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Release date: MusicBrainz carries the most historically accurate release metadata.',
  },
  {
    policyId:       'TRACK_COUNT_POLICY',
    policyName:     'Track Count Resolution Policy',
    field:          'trackCount',
    providerOrder:  ['apple-music', 'spotify', 'musicbrainz'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.CATALOG,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Track count per album: streaming catalogs are authoritative.',
  },

  // IDENTIFIERS
  {
    policyId:       'ISRC_POLICY',
    policyName:     'ISRC Resolution Policy',
    field:          'isrc',
    providerOrder:  ['apple-music', 'spotify', 'musicbrainz', 'tidal'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.IDENTIFIERS,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'ISRC: Apple Music and Spotify carry the most reliable ISRC data.',
  },
  {
    policyId:       'UPC_POLICY',
    policyName:     'UPC Resolution Policy',
    field:          'upc',
    providerOrder:  ['apple-music', 'spotify', 'musicbrainz'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.IDENTIFIERS,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'UPC/EAN barcode: distribution-grade metadata from primary streaming sources.',
  },

  // URLS
  {
    policyId:       'SOURCE_URL_POLICY',
    policyName:     'Source URL Resolution Policy',
    field:          'sourceUrl',
    providerOrder:  ['apple-music', 'spotify', 'tidal', 'deezer', 'musicbrainz'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.URLS,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Canonical source URL: primary streaming platform preferred.',
  },

  // DEFAULT — fallback for any field not explicitly covered above
  {
    policyId:       'DEFAULT_POLICY',
    policyName:     'Default Resolution Policy',
    field:          'DEFAULT',
    providerOrder:  ['apple-music', 'spotify', 'tidal', 'musicbrainz', 'discogs', 'deezer'],
    version:        '1.0.0',
    category:       RESOLUTION_CATEGORIES.DEFAULT,
    status:         ACTIVE,
    resolutionRule: POLICY_PRIORITY,
    description:    'Default fallback policy: constitutional provider priority order.',
  },
]);
