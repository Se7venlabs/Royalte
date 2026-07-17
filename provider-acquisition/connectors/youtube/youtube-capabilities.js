// YouTube capability declaration — Phase 3.6 (YouTube)
//
// Declares only evidence types that YouTube Data API v3 actually provides.
// Statistics, branding, topic details, and content details are all available
// through channels.list — they flow through COLLECTION_DATA.
//
// Capabilities are immutable. Changes require Board authorization.

import { Capability } from '../../capability/capabilityVocabulary.js';

export const YOUTUBE_CAPABILITIES = Object.freeze([
  Capability.ARTIST_IDENTITY,   // search.list — Official Artist Channel identification
  Capability.COLLECTION_DATA,   // channels.list — statistics, topics, branding, content details
  Capability.VIDEOS,            // playlistItems.list (uploads playlist) -> videos.list full detail
]);
