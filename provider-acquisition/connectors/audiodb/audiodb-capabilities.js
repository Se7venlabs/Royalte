// TheAudioDB Capability Profile declaration — Phase 3.6 Provider Expansion 08
// Declares only capabilities TheAudioDB API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const AUDIODB_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // name, country, years active, record label, biography
  Capability.ARTWORK,          // logos, clear art, fan art, banners, thumbnails, wide thumb
  Capability.GENRES,           // genre, style, mood
  Capability.SOCIAL_LINKS,     // website, YouTube, Facebook, Twitter, Instagram
  Capability.COLLECTION_DATA,  // artist discography (albums + release years)
  Capability.VIDEOS,           // official music video metadata
]);
