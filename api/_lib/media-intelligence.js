// ─────────────────────────────────────────────────────────────────────
//  Royaltē Media Intelligence™ — Assembler (Media Intelligence v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Board directive (2026-07-22, Media Intelligence™ KPI Discovery /
//  Implementation authorization). Computes exactly the 8 Board-approved
//  launch cards from api/_lib/media-evidence.js's real, wired evidence —
//  no more, no fewer. Every field this module produces traces to a
//  specific, confirmed-real source in governance/
//  MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md; every card's Primary Executive
//  Business Question and Executive Decision Enabled are recorded in
//  governance/MEDIA_INTELLIGENCE_KPI_DISCOVERY.md, per the Executive
//  Question Framework™ / Executive Decision Framework™ (Constitution
//  §4.21).
//
//  Explicitly NOT built here (per the Board's own KPI Discovery
//  rejections): Official Channel verification, Monetization Readiness,
//  video-type classification (Lyric/Behind-the-Scenes/etc.), any
//  growth/delta metric. No historical snapshot mechanism exists for any
//  provider — every value below is a single-scan, point-in-time fact.
//
//  Purity invariants (same shape as every other RIE domain assembler):
//    - Pure function of mediaEvidence (api/_lib/media-evidence.js).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
// ─────────────────────────────────────────────────────────────────────

export const MEDIA_INTELLIGENCE_VERSION = '1.0.0';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

// Content Activity Status™ thresholds — an editorial bucketing choice
// (documented, board-set, not evidence itself), same precedent as
// Market Priority™'s tier ruleset in Global Music Footprint™.
const ACTIVITY_THRESHOLDS_DAYS = Object.freeze({ ACTIVE: 30, SLOWING: 90 });

function daysSince(isoString, now) {
  const t = Date.parse(isoString);
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86400000);
}

// 1. Media Platform Coverage™ — "Where is my public media presence incomplete?"
function computeMediaPlatformCoverage(ev) {
  const platforms = [
    { key: 'youtube', label: 'YouTube', present: !!ev.youtube.present },
    { key: 'appleMusic', label: 'Apple Music', present: !!ev.appleMusic.present },
    { key: 'audiodb', label: 'TheAudioDB', present: !!ev.audiodb.present },
  ];
  const coveredCount = platforms.filter(p => p.present).length;
  return {
    platforms,
    coveredCount,
    totalPlatforms: platforms.length,
    coveragePercent: Math.round((coveredCount / platforms.length) * 100),
  };
}

// 2. Media Asset Completeness™ + 8. Missing Media Assets™ —
// "Is my public brand presentation complete?" / "What media assets should I create next?"
function computeAssetCompleteness(ev) {
  const slots = [
    { provider: 'YouTube', label: 'Channel Thumbnail', present: !!ev.youtube.thumbnails },
    { provider: 'YouTube', label: 'Channel Banner', present: !!ev.youtube.bannerImageUrl },
    { provider: 'Apple Music', label: 'Artist Artwork', present: !!ev.appleMusic.artworkUrl },
    { provider: 'TheAudioDB', label: 'Thumbnail', present: !!(ev.audiodb.media.thumbnails?.thumb) },
    { provider: 'TheAudioDB', label: 'Logo', present: !!(ev.audiodb.media.logos?.logo) },
    { provider: 'TheAudioDB', label: 'Clearart', present: !!(ev.audiodb.media.logos?.clearart) },
    { provider: 'TheAudioDB', label: 'Banner', present: !!(ev.audiodb.media.banners?.banner) },
    { provider: 'TheAudioDB', label: 'Fan Art', present: !!(ev.audiodb.media.fanArt?.fanart) },
  ];
  const presentCount = slots.filter(s => s.present).length;
  const missing = slots.filter(s => !s.present).map(s => ({ provider: s.provider, asset: s.label }));
  return {
    slots,
    presentCount,
    totalSlots: slots.length,
    completenessPercent: Math.round((presentCount / slots.length) * 100),
    missingAssets: missing,
  };
}

// 3. Content Activity Status™ — "Is my content strategy active or dormant?"
function computeContentActivity(ev, now) {
  const timestamps = [];
  for (const v of ev.youtube.videos) {
    if (v.publishedAt) timestamps.push(v.publishedAt);
  }
  for (const v of ev.appleMusic.videos) {
    if (v.releaseDate) timestamps.push(v.releaseDate);
  }
  if (timestamps.length === 0) {
    return { status: 'Unknown', latestUploadAt: null, daysSinceLastUpload: null,
      reason: 'No real upload timestamps found from any reviewed platform for this scan.' };
  }
  const latest = timestamps.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a));
  const days = daysSince(latest, now);
  let status = 'Unknown';
  if (days !== null) {
    if (days <= ACTIVITY_THRESHOLDS_DAYS.ACTIVE) status = 'Active';
    else if (days <= ACTIVITY_THRESHOLDS_DAYS.SLOWING) status = 'Slowing';
    else status = 'Dormant';
  }
  return { status, latestUploadAt: latest, daysSinceLastUpload: days,
    reason: days === null ? 'Latest upload date could not be parsed.' : `Last real upload was ${days} day${days === 1 ? '' : 's'} ago.` };
}

// 4. Digital Presence™ — "Can fans easily discover and connect with me?"
function computeDigitalPresence(ev) {
  const links = [
    { platform: 'Website', present: !!ev.audiodb.website, url: ev.audiodb.website || null },
    { platform: 'Facebook', present: !!ev.audiodb.facebook, url: ev.audiodb.facebook || null },
  ];
  const presentCount = links.filter(l => l.present).length;
  return { links, presentCount, totalLinks: links.length };
}

// 5. Catalog Media Support™ + 7. Unsupported Releases™ —
// "Which releases are under-supported by media?" / "Which releases require media investment first?"
//
// Exact-match only (releaseDate coincidence between a real Apple album
// and a real Apple video, same artist by construction of the scan) —
// deliberately excludes YouTube title-text matching, flagged in the
// audit as heuristic/lower-confidence and not used here for integrity.
function computeCatalogMediaSupport(ev) {
  const videoDates = new Set(ev.appleMusic.videos.map(v => v.releaseDate).filter(Boolean));
  const releases = ev.appleMusic.albums.map(a => ({
    id: a.id ?? null,
    name: a.name ?? null,
    releaseDate: a.releaseDate ?? null,
    supported: !!(a.releaseDate && videoDates.has(a.releaseDate)),
  }));
  const supportedCount = releases.filter(r => r.supported).length;
  const unsupported = releases.filter(r => !r.supported);
  return {
    releases,
    supportedCount,
    totalReleases: releases.length,
    unsupportedReleases: unsupported,
  };
}

// 6. Audience Reach™ — "Where is my audience today?" (deliberately no growth dimension)
function computeAudienceReach(ev) {
  const platforms = [
    { platform: 'YouTube', metric: 'Subscribers', value: ev.youtube.subscriberCount },
    { platform: 'YouTube', metric: 'Views', value: ev.youtube.viewCount },
    { platform: 'Spotify', metric: 'Followers', value: ev.audienceSecondary.spotify.followers },
    { platform: 'Deezer', metric: 'Fans', value: ev.audienceSecondary.deezer.fans },
    { platform: 'Last.fm', metric: 'Listeners', value: ev.audienceSecondary.lastfm.listeners },
  ].filter(p => p.value !== null);
  return { platforms };
}

export function assembleMediaIntelligence(mediaEvidence, now = Date.now()) {
  try {
    const ev = (mediaEvidence && typeof mediaEvidence === 'object') ? mediaEvidence : null;
    if (!ev) {
      return deepFreeze({ _version: MEDIA_INTELLIGENCE_VERSION, generatedAt: new Date(now).toISOString(), available: false });
    }

    // Defensively shaped one level deeper than just the top-level provider
    // keys -- every array/sub-object every compute* function below reads
    // is guaranteed present here, so a caller passing a partially-shaped
    // evidence object (anything other than assembleMediaEvidence()'s own
    // always-fully-shaped output) degrades to computing whatever real data
    // IS present, rather than aborting the entire computation on one
    // missing nested field.
    const youtube = ev.youtube ?? {};
    const appleMusic = ev.appleMusic ?? {};
    const audiodb = ev.audiodb ?? {};
    const audienceSecondary = ev.audienceSecondary ?? {};
    const safeEv = {
      youtube: { ...youtube, videos: Array.isArray(youtube.videos) ? youtube.videos : [] },
      appleMusic: { ...appleMusic, albums: Array.isArray(appleMusic.albums) ? appleMusic.albums : [], videos: Array.isArray(appleMusic.videos) ? appleMusic.videos : [] },
      audiodb: { ...audiodb, media: audiodb.media ?? {} },
      audienceSecondary: {
        spotify: audienceSecondary.spotify ?? {},
        deezer: audienceSecondary.deezer ?? {},
        lastfm: audienceSecondary.lastfm ?? {},
      },
    };

    const platformCoverage = computeMediaPlatformCoverage(safeEv);
    const assetCompleteness = computeAssetCompleteness(safeEv);
    const contentActivity = computeContentActivity(safeEv, now);
    const digitalPresence = computeDigitalPresence(safeEv);
    const catalogMediaSupport = computeCatalogMediaSupport(safeEv);
    const audienceReach = computeAudienceReach(safeEv);

    return deepFreeze({
      _version: MEDIA_INTELLIGENCE_VERSION,
      generatedAt: new Date(now).toISOString(),
      available: true,
      // Card 1
      platformCoverage,
      // Card 2 + supporting card 8
      assetCompleteness,
      // Card 3
      contentActivity,
      // Card 4
      digitalPresence,
      // Card 5 + supporting card 7
      catalogMediaSupport,
      // Card 6
      audienceReach,
    });
  } catch (err) {
    console.error('[media-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({ _version: MEDIA_INTELLIGENCE_VERSION, generatedAt: new Date().toISOString(), available: false });
  }
}
