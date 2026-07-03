// MusicBrainz Capability Profile declaration — Phase 3.8
// Declares only capabilities the MusicBrainz API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const MB_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist search/detail with aliases and tags
  Capability.TRACKS,           // recordings with ISRCs and relationships
  Capability.RELEASES,         // release groups (albums, singles, EPs, compilations)
  Capability.ISRC,             // ISRC → recording lookup
]);
