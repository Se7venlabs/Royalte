// MusicBrainz Capability Profile declaration — Phase 3.8
// Declares only capabilities the MusicBrainz API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const MB_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist search/detail with aliases and tags
  Capability.TRACKS,           // recordings with ISRCs and relationships
  Capability.RELEASES,         // release groups (albums, singles, EPs, compilations)
  Capability.ISRC,             // ISRC → recording lookup
  Capability.PUBLISHING,       // works (compositions) by artist, incl. ISWC + PRO/CMO registration IDs
  Capability.SONGWRITERS,      // work relationships — writer/composer/lyricist credits
  Capability.CONTRIBUTORS,     // recording relationships — performer/producer/engineer credits
  Capability.LABELS,           // release detail — labels, catalog number, barcode, country, status
  Capability.SOCIAL_LINKS,     // artist relationships — band members, URL/social/streaming links
]);
