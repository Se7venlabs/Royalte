// Deezer Capability Profile declaration — Phase 3.6 Provider Expansion 07
// Declares only capabilities the Deezer Public API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const DEEZER_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist name, Deezer ID, profile URL, fan count
  Capability.ALBUMS,           // artist discography (albums, singles, EPs)
  Capability.TRACKS,           // artist top 50 tracks with ISRC where available
  Capability.ISRC,             // ISRC fields present in top-tracks response
  Capability.ARTWORK,          // artist picture URLs at multiple sizes
  Capability.GENRES,           // genres derived from album genre tags
]);
