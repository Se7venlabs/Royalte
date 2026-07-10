// Spotify Capability Profile declaration — Phase 3.6
// Declares only capabilities Spotify's Web API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const SPOTIFY_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist name, Spotify ID, URL, popularity
  Capability.ALBUMS,           // artist discography (albums, singles, appears_on)
  Capability.TRACKS,           // top tracks with ISRCs, preview URLs
  Capability.ISRC,             // ISRC filter lookup via search endpoint
  Capability.ARTWORK,          // artist and album image arrays
  Capability.GENRES,           // genre arrays on artist response
]);
