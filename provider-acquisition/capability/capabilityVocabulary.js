// Standardized capability vocabulary — PAL Technical Design v3 §2.12
// 23 Board-ratified capabilities. Connectors declare from this enumeration only.
// Adding a new capability = extend this file + bump VOCABULARY_VERSION. No other change needed.

export const VOCABULARY_VERSION = '1.1';

export const Capability = Object.freeze({
  ARTIST_IDENTITY:  'Artist Identity',
  RELEASES:         'Releases',
  TRACKS:           'Tracks',
  ALBUMS:           'Albums',
  ISRC:             'ISRC',
  ISWC:             'ISWC',
  UPC:              'UPC',
  PUBLISHING:       'Publishing',
  SONGWRITERS:      'Songwriters',
  CONTRIBUTORS:     'Contributors',
  TERRITORIES:      'Territories',
  AVAILABILITY:     'Availability',
  GENRES:           'Genres',
  LABELS:           'Labels',
  AUDIO_FEATURES:   'Audio Features',
  ARTWORK:          'Artwork',
  SOCIAL_LINKS:     'Social Links',
  RIGHTS_DATA:      'Rights Data',
  PERFORMANCE_DATA: 'Performance Data',
  COLLECTION_DATA:  'Collection Data',
  PODCASTS:         'Podcasts',
  VIDEOS:           'Videos',
  // Added Phase 3.9 (ACRCloud) — Board-ratified 2026-07-17 after Discovery Report review.
  // Acoustic-identity evidence: matches a recording from a raw audio sample or a
  // precomputed fingerprint, distinct from every capability above (those match by
  // text/ID). EXTERNAL_IDS and CONFIDENCE were considered and deferred — see
  // provider-acquisition/connectors/acrcloud/README.md for the rejected alternatives.
  AUDIO_RECOGNITION: 'Audio Recognition',
});

export const ALL_CAPABILITIES = Object.freeze(new Set(Object.values(Capability)));
