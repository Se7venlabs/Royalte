// ─────────────────────────────────────────────────────────────────────
//  Royaltē Media Evidence™ — sibling canonical object (Media Intelligence™)
// ─────────────────────────────────────────────────────────────────────
//
//  Board directive (2026-07-22, Media Intelligence™ KPI Discovery /
//  Implementation authorization).
//
//  Follows the current, corrected sibling-evidence-object pattern
//  established by the Phase 2 CIO-bypass recovery (Board Option 3, see
//  lib/rie/index.js's header comment and api/_lib/catalog-evidence.js /
//  api/_lib/global-footprint-evidence.js) rather than the pattern those
//  assemblers originally used (receiving canonicalForEnrichment
//  directly). assembleMediaEvidence() is a pure, additive extraction of
//  only the specific fields Media Intelligence™ needs from the
//  EvidenceBridge-produced canonical object -- no business logic, no
//  classification, no interpretation. assembleMediaIntelligence()
//  (media-intelligence.js) consumes this object, never
//  canonicalForEnrichment directly.
//
//  Purity invariants (same shape as every other evidence/assembler pair
//  in this codebase):
//    - Pure function of canonicalForEnrichment.
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//
//  Source of truth for what evidence is real: governance/
//  MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md. Only fields confirmed real and
//  wired there are extracted here -- no field this module reads was
//  invented for this pass.
// ─────────────────────────────────────────────────────────────────────

export const MEDIA_EVIDENCE_VERSION = '1.0.0';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

export function assembleMediaEvidence(canonicalForEnrichment) {
  try {
    const c = (canonicalForEnrichment && typeof canonicalForEnrichment === 'object') ? canonicalForEnrichment : {};
    const platforms = (c.platforms && typeof c.platforms === 'object') ? c.platforms : {};

    const yt = platforms.youtube ?? {};
    const ytDetails = yt.details ?? {};

    const apple = platforms.appleMusic ?? {};
    const appleDetails = apple.details ?? {};

    const audiodb = platforms.audiodb ?? {};
    const audiodbMedia = audiodb.media ?? {};
    const audiodbSocial = audiodbMedia.social ?? {};

    const spotify = platforms.spotify ?? {};
    const spotifyDetails = spotify.details ?? {};

    const deezer = platforms.deezer ?? {};

    const lastfm = platforms.lastfm ?? {};
    const lastfmCommunity = lastfm.community ?? {};

    return deepFreeze({
      _version: MEDIA_EVIDENCE_VERSION,

      youtube: {
        present: typeof yt.channelId === 'string',
        channelId: yt.channelId ?? null,
        subscriberCount: typeof ytDetails.subscriberCount === 'number' ? ytDetails.subscriberCount : null,
        viewCount: typeof ytDetails.viewCount === 'number' ? ytDetails.viewCount : null,
        videoCount: typeof ytDetails.videoCount === 'number' ? ytDetails.videoCount : null,
        thumbnails: ytDetails.thumbnails ?? null,
        bannerImageUrl: ytDetails.bannerImageUrl ?? null,
        videos: Array.isArray(ytDetails.videos) ? ytDetails.videos : [],
      },

      appleMusic: {
        present: typeof apple.artistId === 'string' || typeof apple.artistName === 'string',
        artworkUrl: apple.artworkUrl ?? null,
        albums: Array.isArray(appleDetails.albums) ? appleDetails.albums : [],
        videos: Array.isArray(appleDetails.videos) ? appleDetails.videos : [],
      },

      audiodb: {
        present: typeof audiodb.artistId === 'string',
        media: {
          thumbnails: audiodbMedia.thumbnails ?? null,
          logos: audiodbMedia.logos ?? null,
          banners: audiodbMedia.banners ?? null,
          fanArt: audiodbMedia.fanArt ?? null,
        },
        website: audiodbSocial.website || null,
        facebook: audiodbSocial.facebook || null,
        discography: Array.isArray(audiodb.discography) ? audiodb.discography : [],
        videos: Array.isArray(audiodbMedia.videos) ? audiodbMedia.videos : [],
      },

      // Secondary per-platform audience signals only -- each labeled by its
      // own platform, never summed (governance/MEDIA_INTELLIGENCE_KPI_DISCOVERY.md,
      // Audience Reach™: "never sum across incompatible platforms").
      // SoundCloud is confirmed real (governance/MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md
      // §1) but is a legacy, non-PAL-migrated provider whose data never
      // reaches canonicalForEnrichment via EvidenceBridge -- honestly
      // omitted here rather than fabricated or reached-around for.
      audienceSecondary: {
        spotify: {
          present: typeof spotify.artistId === 'string' || typeof spotify.artistName === 'string',
          followers: typeof spotifyDetails.followers === 'number' ? spotifyDetails.followers : null,
        },
        deezer: {
          present: typeof deezer.artistId === 'string',
          fans: typeof deezer.fans === 'number' ? deezer.fans : null,
        },
        lastfm: {
          present: typeof lastfm.name === 'string' || typeof lastfmCommunity.listeners === 'number',
          listeners: typeof lastfmCommunity.listeners === 'number' ? lastfmCommunity.listeners : null,
        },
      },
    });
  } catch (err) {
    console.error('[media-evidence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      _version: MEDIA_EVIDENCE_VERSION,
      youtube: { present: false, channelId: null, subscriberCount: null, viewCount: null, videoCount: null, thumbnails: null, bannerImageUrl: null, videos: [] },
      appleMusic: { present: false, artworkUrl: null, albums: [], videos: [] },
      audiodb: { present: false, media: { thumbnails: null, logos: null, banners: null, fanArt: null }, website: null, facebook: null, discography: [], videos: [] },
      audienceSecondary: {
        spotify: { present: false, followers: null },
        deezer: { present: false, fans: null },
        lastfm: { present: false, listeners: null },
      },
    });
  }
}
