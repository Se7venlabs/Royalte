// Last.fm Capability Profile declaration — Phase 3.6 Provider Expansion 09
// Declares only capabilities the Last.fm API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const LASTFM_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,   // name, URL, bio (from artist.getinfo)
  Capability.PERFORMANCE_DATA,  // listener count, play count, similar artists (from artist.getinfo stats)
  Capability.GENRES,            // community tags — genre/descriptor labels assigned by the community
  Capability.ARTWORK,           // artist images at multiple sizes (from artist.getinfo image[])
  Capability.TRACKS,            // top tracks with per-track play counts (artist.gettoptracks)
  Capability.ALBUMS,            // top albums with per-album play counts (artist.gettopalbums)
]);
