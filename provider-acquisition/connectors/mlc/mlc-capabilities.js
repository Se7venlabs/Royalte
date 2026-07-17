// MLC capability declaration — Phase 3.6 (The MLC)
//
// Declares only evidence types officially supported by The MLC Public Search API.
// https://public-api.themlc.com/api/doc
//
// ISRC       — POST /search/recordings: recording search by artist/ISRC.
//              Returns recordings with linked mlcSongCodes. No auth required.
// PUBLISHING — POST /works: full work details by mlcSongCode.
//              Returns publishers, writers, ISWC, AKAs, artist links. Auth required.
//
// Capabilities are immutable. Changes require Board authorization.

import { Capability } from '../../capability/capabilityVocabulary.js';

export const MLC_CAPABILITIES = Object.freeze([
  Capability.ISRC,        // recording search — cross-reference recordings to MLC works
  Capability.PUBLISHING,  // work lookup — full publishing data (publishers, writers, ISWC);
                          // also routes single-ID lookups (GET /work/id/{id})
  Capability.SONGWRITERS, // song-code search by title + writers (POST /search/songcode)
]);
