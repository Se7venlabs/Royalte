// Standardized capability vocabulary — PAL Technical Design v3 §2.12
// 22 Board-ratified capabilities. Connectors declare from this enumeration only.
// Adding a new capability = extend this file + bump VOCABULARY_VERSION. No other change needed.

export const VOCABULARY_VERSION = '1.0';

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
});

export const ALL_CAPABILITIES = Object.freeze(new Set(Object.values(Capability)));
