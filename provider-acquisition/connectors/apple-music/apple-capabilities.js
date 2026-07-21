// Apple Music Capability Profile declaration — Phase 2.2
// Declares only capabilities Apple Music's catalog API actually supplies.
// Declared against the shared Board-ratified vocabulary (capabilityVocabulary.js).

import { Capability } from '../../capability/capabilityVocabulary.js';

export const APPLE_MUSIC_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,  // artist name, Apple ID, URL
  Capability.RELEASES,         // artist release list (albums endpoint)
  Capability.ALBUMS,           // album attributes, artwork, track counts
  Capability.TRACKS,           // song attributes, ISRCs, preview URLs
  Capability.ISRC,             // ISRC filter lookup on songs endpoint
  Capability.UPC,              // UPC on album attributes
  Capability.ARTWORK,          // artist and album artwork URLs
  Capability.GENRES,           // genre arrays on artist and song resources
  Capability.AVAILABILITY,     // global (167-storefront) availability -- the only one
                                // actually requested in production acquisition
  Capability.TERRITORIES,      // BIG6-only storefront availability -- declared/dispatch-wired
                                // but never called by the live acquisition flow
  Capability.LABELS,           // record label on album attributes
  // Added Media PAL Expansion™ — artist music-videos relationship view
  // (/catalog/{storefront}/artists/{id}/music-videos). Reuses the shared
  // Capability.VIDEOS entry already ratified for YouTube/TheAudioDB — no
  // vocabulary change required, only this connector's own declaration.
  Capability.VIDEOS,
]);
