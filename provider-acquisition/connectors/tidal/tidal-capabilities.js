// TIDAL Capability Profile declaration — Phase 4.0 TIDAL Connector™
// Declares only capabilities TIDAL API v2 actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const TIDAL_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist name, TIDAL ID, URL, popularity
  Capability.ALBUMS,           // artist discography (all releases)
  Capability.RELEASES,         // alias of ALBUMS dispatch — same #fetchArtistAlbums()
  Capability.TRACKS,           // artist tracks (with ISRC where available)
  Capability.ISRC,             // alias of TRACKS dispatch — same #fetchArtistTracks()
  Capability.ARTWORK,          // artist image links (multiple resolutions)
]);
