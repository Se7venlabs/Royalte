// Discogs capability declaration — Phase 3.6
//
// Declares only evidence types that Discogs actually provides via dedicated endpoints.
// Label, format, catalog-number, and genre data are embedded in the RELEASES payload —
// they do not constitute separate capabilities.
//
// Capabilities are immutable. Changes require Board authorization + VOCABULARY_VERSION bump.

import { Capability } from '../../capability/capabilityVocabulary.js';

export const DISCOGS_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,   // /database/search + /artists/{id}
  Capability.RELEASES,          // /artists/{id}/releases — includes labels, formats, catno, year
]);
