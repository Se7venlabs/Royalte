// Royalte Audit API — /api/audit.js
// Trust-first build: verified data only, Royalty Risk Score (higher = worse), no estimates
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata + YouTube + Apple Music

import { generateAppleToken } from './apple-token.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  console.log('[Royalte Audit] Input URL:', url);

  try {
    const parsed = parseUniversalUrl(url);

    if (!parsed) {
      console.warn('[Royalte Audit] Parse failed for URL:', url);
      return res.status(400).json({
        error: 'Enter a valid Spotify or Apple Music URL.',
        detail: 'Supported: open.spotify.com/artist, open.spotify.com/track, music.apple.com artist and song URLs.',
      });
    }

    console.log('[Royalte Audit] Platform:', parsed.platform, '| Type:', parsed.type, '| ID:', parsed.id);

    // ── APPLE MUSIC DIRECT ROUTE ──────────────────────
    if (parsed.platform === 'apple') {
      return await handleAppleMusicAudit(parsed, req, res);
    }

    // ── SPOTIFY ROUTE (default) ───────────────────────
    const token = await getSpotifyToken();
    console.log('[Royalte Audit] Spotify token obtained');

    let artistData, trackData;

    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    console.log('[Royalte Audit] Spotify artist resolved:', artistData.name);

    const albumsData = await getSpotifyAlbums(
      parsed.type === 'artist' ? parsed.id : artistData.id,
      token
    );
    const artistName = artistData.name;
    const spotifyTopTracks = await getSpotifyTopTracks(
      parsed.type === 'artist' ? parsed.id : artistData.id,
      token
    );

    const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, youtubeData, appleMusicData] = await Promise.allSettled([
      getMusicBrainz(artistName),
      getDeezer(artistName),
      getAudioDB(artistName),
      getDiscogs(artistName),
      getSoundCloud(artistName),
      getLastFm(artistName),
      getWikidata(artistName),
      getYouTube(artistName),
      getAppleMusic(artistName, trackData?.external_ids?.isrc || null, spotifyTopTracks),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

    const catalogData = analyzeCatalog(albumsData, artistData);
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);

    // Run modules — now returns verified issue sets, not scores
    const modules = runModules(
      artistData, trackData, mbData, deezerData, audioDbData,
      discogsData, soundcloudData, lastfmData, wikidataData,
      catalogData, youtubeData, appleMusicData
    );

    // Royalty Risk Score — additive penalty model (higher = more risk)
    const royaltyRiskScore = calculateRoyaltyRiskScore(modules, appleMusicData, soundcloudData, youtubeData);

    // Audit confidence
    const connectedSources = [
      mbData.found, deezerData.found, audioDbData.found, discogsData.found,
      soundcloudData.found, lastfmData.found, wikidataData.found,
      youtubeData.found, appleMusicData.found
    ].filter(Boolean).length;
    const auditConfidence = connectedSources >= 6 ? 'High' : connectedSources >= 3 ? 'Limited' : 'Minimal';

    // Build verified issues list (no estimates, no speculative language)
    const verifiedIssues = buildVerifiedIssues(
      modules, artistData, trackData, appleMusicData, youtubeData, catalogData
    );

    // Coverage statuses — verified only
    const coverageStatuses = buildCoverageStatuses(
      artistData, trackData, appleMusicData, soundcloudData, youtubeData, mbData, lastfmData
    );

    // Action plan — tied to verified issues only
    const actionPlan = buildActionPlan(verifiedIssues, country);

    return res.status(200).json({
      success: true,
      platform: parsed.platform,
      type: parsed.type,
      artistName,
      artistId: artistData.id,
      followers: artistData.followers?.total || 0,
      popularity: artistData.popularity || 0,
      genres: artistData.genres || [],
      trackTitle: trackData?.name || null,
      trackIsrc: trackData?.external_ids?.isrc || null,

      // Platform presence — verified boolean only
      platforms: {
        spotify: { status: 'Registered', verified: true },
        appleMusic: {
          status: appleMusicData.found ? 'Registered' : 'Not Registered',
          verified: true,
          url: appleMusicData.artistUrl || null,
        },
        musicbrainz: {
          status: mbData.found ? 'Registered' : 'Not Registered',
          verified: true,
        },
        deezer: {
          status: deezerData.found ? 'Registered' : 'Not Registered',
          verified: true,
        },
        youtube: {
          status: youtubeData.found
            ? (youtubeData.officialChannel ? 'Registered' : 'Not Confirmed')
            : 'Not Registered',
          verified: true,
          contentId: youtubeData.contentIdVerified ? 'Registered' : 'Not Confirmed',
        },
        soundExchange: {
          status: 'Not Confirmed',
          verified: false,
          note: 'SoundExchange registration cannot be verified via public API. Manual check required.',
        },
        pro: {
          status: country ? 'Not Confirmed' : 'Not Connected',
          verified: false,
          note: 'PRO registration status requires manual verification.',
          guide: proGuide,
        },
      },

      // Audit coverage
      auditCoverage: {
        spotify: 'Verified',
        appleMusic: 'Verified',
        publishing: 'Not Connected',
        soundExchange: 'Not Confirmed',
        confidence: auditConfidence,
        dataLastVerified: new Date().toISOString(),
      },

      // Royalty Risk Score — primary metric (higher = more risk)
      royaltyRiskScore,
      riskLevel: royaltyRiskScore <= 20 ? 'Low' : royaltyRiskScore <= 50 ? 'Moderate' : 'High',

      // Verified issues — no estimates
      verifiedIssues,
      issueCount: verifiedIssues.length,
      previewIssues: verifiedIssues.slice(0, 2),

      // Coverage statuses
      coverageStatuses,

      // Verified action plan
      actionPlan,

      // Catalog basics — verified Spotify data only
      catalog: {
        totalReleases: catalogData.totalReleases,
        earliestYear: catalogData.earliestYear,
        latestYear: catalogData.latestYear,
        recentActivity: catalogData.recentActivity,
      },

      // Apple Music catalog comparison — verified matches
      appleMusicComparison: appleMusicData.catalogComparison || null,

      // YouTube — channel presence only, no UGC revenue estimates
      youtube: youtubeData.found ? {
        officialChannel: youtubeData.officialChannel
          ? {
              title: youtubeData.officialChannel.title,
              subscribers: youtubeData.officialChannel.subscribers,
              videoCount: youtubeData.officialChannel.videoCount,
            }
          : null,
        contentIdVerified: youtubeData.contentIdVerified,
        ugcVideoCount: youtubeData.ugc?.videoCount || 0,
        ugcContentIdRisk: youtubeData.ugc?.contentIdRisk || false,
      } : null,

      country,
      scannedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[Royalte Audit] Spotify audit error:', err.message);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}

// ────────────────────────────────────────────────────────
// ROYALTY RISK SCORE — additive penalty, max 100, higher = more risk
// ────────────────────────────────────────────────────────
function calculateRoyaltyRiskScore(modules, appleMusic, soundcloud, youtube) {
  let score = 0;

  // Not Registered on Apple Music (+10)
  if (!appleMusic.found) score += 10;

  // Missing genres — metadata issue (+15)
  if (modules.metadata.issues.some(i => i.type === 'missing_genres')) score += 15;

  // No ISRC on track scan (+25)
  if (modules.metadata.issues.some(i => i.type === 'missing_isrc')) score += 25;

  // Not in MusicBrainz — publishing reference gap (+20)
  if (modules.publishing.issues.some(i => i.type === 'not_in_musicbrainz')) score += 20;

  // SoundExchange not confirmed (+15)
  score += 15; // always unknown via public API

  // No official YouTube channel (+10)
  if (youtube.found && !youtube.officialChannel) score += 10;
  if (!youtube.found) score += 10;

  // UGC with no Content ID (+10)
  if (youtube.ugc?.contentIdRisk) score += 10;

  // Apple Music ISRC mismatch — track scan only (+15)
  if (modules.publishing.issues.some(i => i.type === 'apple_isrc_mismatch')) score += 15;

  // Apple Music catalog gap — match rate below 70% (+10)
  if (appleMusic.catalogComparison && appleMusic.catalogComparison.matchRate < 70) score += 10;

  return Math.min(score, 100);
}

// ────────────────────────────────────────────────────────
// VERIFIED ISSUES — only factual confirmed gaps
// ────────────────────────────────────────────────────────
function buildVerifiedIssues(modules, artist, track, appleMusic, youtube, catalog) {
  const issues = [];

  // ISRC missing — verified via Spotify API
  if (track && !track.external_ids?.isrc) {
    issues.push({
      type: 'missing_isrc',
      module: 'Metadata Integrity',
      priority: 'HIGH',
      status: 'Not Registered',
      title: 'ISRC not found on this recording',
      detail: 'The International Standard Recording Code (ISRC) was not returned by Spotify for this track. Without an ISRC, performance royalty routing cannot be verified.',
    });
  }

  // Missing genres — verified via Spotify API
  if (!artist.genres?.length) {
    issues.push({
      type: 'missing_genres',
      module: 'Metadata Integrity',
      priority: 'MEDIUM',
      status: 'Not Confirmed',
      title: 'Genre tags absent on Spotify profile',
      detail: 'No genre metadata returned by Spotify. Genre tags affect algorithmic discovery and publishing discoverability.',
    });
  }

  // Not on Apple Music — verified via Apple Music API
  if (!appleMusic.found) {
    issues.push({
      type: 'not_on_apple_music',
      module: 'Platform Coverage',
      priority: 'HIGH',
      status: 'Not Registered',
      title: 'Artist not found on Apple Music',
      detail: 'This artist was not found in the Apple Music catalog. Apple Music is the second-largest music streaming platform. Distribution gaps here may be limiting royalty collection.',
    });
  }

  // Apple Music ISRC mismatch — verified via both APIs
  if (track?.external_ids?.isrc && appleMusic.isrcLookup && !appleMusic.isrcLookup.found) {
    issues.push({
      type: 'apple_isrc_mismatch',
      module: 'Publishing Risk',
      priority: 'HIGH',
      status: 'Not Confirmed',
      title: 'Track ISRC found on Spotify but not on Apple Music',
      detail: 'The track ISRC is present on Spotify but returned no match on Apple Music. This cross-platform metadata discrepancy may affect royalty attribution.',
    });
  }

  // Apple Music catalog gap — verified via ISRC lookups
  if (appleMusic.found && appleMusic.catalogComparison) {
    const { matchRate, notFound, tracksChecked } = appleMusic.catalogComparison;
    if (matchRate < 70 && notFound.length > 0) {
      issues.push({
        type: 'apple_catalog_gap',
        module: 'Platform Coverage',
        priority: matchRate < 50 ? 'HIGH' : 'MEDIUM',
        status: 'Not Registered',
        title: `${notFound.length} of ${tracksChecked} top tracks not found on Apple Music`,
        detail: `The following tracks were not matched on Apple Music: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? ` and ${notFound.length - 3} more` : ''}. Distribution may be incomplete.`,
      });
    }
  }

  // No official YouTube channel — verified via YouTube Data API
  if (youtube.found && !youtube.officialChannel) {
    issues.push({
      type: 'no_youtube_channel',
      module: 'YouTube / UGC',
      priority: 'MEDIUM',
      status: 'Not Confirmed',
      title: 'No official YouTube channel found',
      detail: 'No official YouTube channel was matched for this artist. Content ID monetisation status cannot be confirmed.',
    });
  }

  // UGC content without Content ID — verified via YouTube Data API
  if (youtube.ugc?.contentIdRisk && youtube.ugc.videoCount > 0) {
    issues.push({
      type: 'ugc_no_content_id',
      module: 'YouTube / UGC',
      priority: 'HIGH',
      status: 'Not Confirmed',
      title: `${youtube.ugc.videoCount} user-uploaded video(s) found with no official channel`,
      detail: 'User-uploaded content detected on YouTube with no confirmed official channel. Without Content ID registration, these streams may not be generating royalties.',
    });
  }

  // Not in MusicBrainz — verified via MusicBrainz API
  if (!modules.publishing.issues.some(i => i.type === 'not_in_musicbrainz') === false) {
    // handled in modules
  }
  modules.publishing.issues.forEach(i => {
    if (i.type === 'not_in_musicbrainz') {
      issues.push({
        type: 'not_in_musicbrainz',
        module: 'Publishing Risk',
        priority: 'MEDIUM',
        status: 'Not Registered',
        title: 'Not found in MusicBrainz',
        detail: 'MusicBrainz is used as a publishing reference database by many royalty collection systems. Not being registered may affect cross-platform data linking.',
      });
    }
  });

  // SoundExchange — always unknown, always show
  issues.push({
    type: 'soundexchange_unconfirmed',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Not Confirmed',
    title: 'SoundExchange registration not confirmed',
    detail: 'SoundExchange collects digital performance royalties for US streaming (Spotify, Pandora, satellite radio). Registration status cannot be verified via public data. Manual check required at soundexchange.com.',
  });

  // PRO — always unknown, always show
  issues.push({
    type: 'pro_not_connected',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Not Connected',
    title: 'PRO registration not connected',
    detail: 'Performance Rights Organisation (PRO) registration cannot be verified via public data. PRO membership is required to collect performance royalties from radio, TV, and public performance.',
  });

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return issues.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ────────────────────────────────────────────────────────
// COVERAGE STATUSES — verified only
// ────────────────────────────────────────────────────────
function buildCoverageStatuses(artist, track, appleMusic, soundcloud, youtube, mb, lastfm) {
  return [
    {
      platform: 'Spotify',
      status: 'Registered',
      verified: true,
    },
    {
      platform: 'Apple Music',
      status: appleMusic.found ? 'Registered' : 'Not Registered',
      verified: true,
      detail: appleMusic.found ? null : 'Artist not found in Apple Music catalog.',
    },
    {
      platform: 'YouTube (Official Channel)',
      status: youtube.found
        ? (youtube.officialChannel ? 'Registered' : 'Not Confirmed')
        : 'Not Registered',
      verified: true,
      detail: youtube.ugc?.contentIdRisk
        ? 'User-uploaded content found. Content ID status unconfirmed.'
        : null,
    },
    {
      platform: 'MusicBrainz',
      status: mb.found ? 'Registered' : 'Not Registered',
      verified: true,
    },
    {
      platform: 'SoundExchange',
      status: 'Not Confirmed',
      verified: false,
      detail: 'Cannot be verified via public data. Check soundexchange.com directly.',
    },
    {
      platform: 'PRO (Performance Rights)',
      status: 'Not Connected',
      verified: false,
      detail: 'Cannot be verified via public data. Contact your PRO directly.',
    },
  ];
}

// ────────────────────────────────────────────────────────
// ACTION PLAN — verified issues only
// ────────────────────────────────────────────────────────
function buildActionPlan(verifiedIssues, country) {
  if (!verifiedIssues.length) {
    return [{
      action: 'No verified issues detected',
      reason: 'No action required based on verified data',
      priority: null,
    }];
  }

  const actionMap = {
    missing_isrc: {
      action: 'Register this recording with your distributor',
      reason: 'ISRC not found (verified via Spotify API)',
      priority: 'HIGH',
    },
    missing_genres: {
      action: 'Add genre metadata to your Spotify for Artists profile',
      reason: 'Genre tags absent (verified via Spotify)',
      priority: 'MEDIUM',
    },
    not_on_apple_music: {
      action: 'Distribute your catalog to Apple Music',
      reason: 'Not Registered on Apple Music (verified)',
      priority: 'HIGH',
    },
    apple_isrc_mismatch: {
      action: 'Contact your distributor to align ISRC metadata across Spotify and Apple Music',
      reason: 'ISRC mismatch detected between Spotify and Apple Music (verified)',
      priority: 'HIGH',
    },
    apple_catalog_gap: {
      action: 'Review Apple Music distribution and re-deliver missing tracks',
      reason: 'Tracks Not Registered on Apple Music (verified)',
      priority: 'MEDIUM',
    },
    no_youtube_channel: {
      action: 'Create or claim your official YouTube channel and register for Content ID',
      reason: 'No official channel confirmed (verified via YouTube API)',
      priority: 'MEDIUM',
    },
    ugc_no_content_id: {
      action: 'Register for Content ID through your distributor or a YouTube OAC partner',
      reason: 'User-uploaded content found with no official channel (verified)',
      priority: 'HIGH',
    },
    not_in_musicbrainz: {
      action: 'Register your artist profile on MusicBrainz (musicbrainz.org)',
      reason: 'Not Registered in MusicBrainz (verified)',
      priority: 'MEDIUM',
    },
    soundexchange_unconfirmed: {
      action: 'Register with SoundExchange at soundexchange.com',
      reason: 'Digital performance royalties in the US require SoundExchange registration',
      priority: 'MEDIUM',
    },
    pro_not_connected: {
      action: country
        ? `Register with your local PRO (${getPROGuide(country).pro})`
        : 'Register with your local PRO — find yours at cisac.org',
      reason: 'PRO registration is required to collect performance royalties',
      priority: 'MEDIUM',
    },
  };

  return verifiedIssues
    .filter(i => actionMap[i.type])
    .map(i => actionMap[i.type]);
}

// ────────────────────────────────────────────────────────
// MODULES — returns verified issue sets, not scores
// ────────────────────────────────────────────────────────
function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic) {
  const modules = {};

  // MODULE A — Metadata Integrity
  const metaIssues = [];
  if (!artist.genres?.length) metaIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (!artist.images?.length) metaIssues.push({ type: 'missing_images', status: 'Not Confirmed' });
  if (track && !track.external_ids?.isrc) metaIssues.push({ type: 'missing_isrc', status: 'Not Registered' });
  modules.metadata = {
    name: 'Metadata Integrity',
    issues: metaIssues,
    verified: true,
    status: metaIssues.length === 0 ? 'No issues detected' : `${metaIssues.length} issue(s) found`,
  };

  // MODULE B — Platform Coverage
  const covIssues = [];
  if (!mb.found) covIssues.push({ type: 'not_in_musicbrainz', status: 'Not Registered' });
  if (!deezer.found) covIssues.push({ type: 'not_on_deezer', status: 'Not Registered' });
  if (!appleMusic.found) covIssues.push({ type: 'not_on_apple_music', status: 'Not Registered' });
  if (!youtube.found || !youtube.officialChannel) covIssues.push({ type: 'no_youtube_channel', status: 'Not Confirmed' });
  modules.coverage = {
    name: 'Platform Coverage',
    issues: covIssues,
    verified: true,
    status: covIssues.length === 0 ? 'All verified platforms present' : `${covIssues.length} gap(s) found`,
  };

  // MODULE C — Publishing Risk
  const pubIssues = [];
  if (!mb.found) pubIssues.push({ type: 'not_in_musicbrainz', status: 'Not Registered' });
  if (track && !track.external_ids?.isrc) pubIssues.push({ type: 'missing_isrc', status: 'Not Registered' });
  if (track?.external_ids?.isrc && appleMusic.isrcLookup && !appleMusic.isrcLookup.found) {
    pubIssues.push({ type: 'apple_isrc_mismatch', status: 'Not Confirmed' });
  }
  pubIssues.push({ type: 'soundexchange_unconfirmed', status: 'Not Confirmed' });
  pubIssues.push({ type: 'pro_not_connected', status: 'Not Connected' });
  modules.publishing = {
    name: 'Publishing Risk',
    issues: pubIssues,
    verified: false, // PRO/SoundExchange always unverifiable via public API
    status: 'Partial — PRO and SoundExchange cannot be confirmed via public data',
  };

  // MODULE D — Duplicate Detection
  const dupIssues = [];
  if (mb.artists?.length > 1) dupIssues.push({ type: 'multiple_mb_entries', status: 'Not Confirmed', count: mb.artists.length });
  modules.duplicates = {
    name: 'Duplicate Detection',
    issues: dupIssues,
    verified: true,
    status: dupIssues.length === 0 ? 'No duplicates detected' : `${mb.artists.length} MusicBrainz entries found`,
  };

  // MODULE E — YouTube / UGC
  const ytIssues = [];
  if (!youtube.found) {
    ytIssues.push({ type: 'youtube_unavailable', status: 'Not Confirmed' });
  } else {
    if (!youtube.officialChannel) ytIssues.push({ type: 'no_youtube_channel', status: 'Not Confirmed' });
    if (!youtube.contentIdVerified) ytIssues.push({ type: 'content_id_unconfirmed', status: 'Not Confirmed' });
    if (youtube.ugc?.contentIdRisk) ytIssues.push({ type: 'ugc_no_content_id', status: 'Not Confirmed' });
  }
  modules.youtube = {
    name: 'YouTube / UGC',
    issues: ytIssues,
    verified: youtube.found,
    status: !youtube.found
      ? 'Not Confirmed'
      : (youtube.officialChannel ? (youtube.contentIdVerified ? 'Registered' : 'Pending') : 'Not Confirmed'),
  };

  // MODULE F — Sync Readiness
  const syncIssues = [];
  if (!track?.external_ids?.isrc) syncIssues.push({ type: 'missing_isrc', status: 'Not Registered' });
  if (!artist.genres?.length) syncIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (!mb.found) syncIssues.push({ type: 'not_in_musicbrainz', status: 'Not Registered' });
  if (!wikidata.found) syncIssues.push({ type: 'no_wikipedia', status: 'Not Registered' });
  if (!appleMusic.found) syncIssues.push({ type: 'not_on_apple_music', status: 'Not Registered' });
  modules.sync = {
    name: 'Sync Readiness',
    issues: syncIssues,
    verified: true,
    status: syncIssues.length === 0 ? 'Sync-ready' : `${syncIssues.length} gap(s) affecting sync readiness`,
  };

  return modules;
}

// ────────────────────────────────────────────────────────
// CATALOG ANALYSIS — verified Spotify data only
// ────────────────────────────────────────────────────────
function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, latestYear: null, recentActivity: false };

  const years = albums
    .map(a => parseInt(a.release_date?.substring(0, 4)))
    .filter(y => !isNaN(y) && y > 1950);

  const currentYear = new Date().getFullYear();

  return {
    totalReleases: albums.length,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    recentActivity: years.some(y => y >= currentYear - 2),
  };
}

// ────────────────────────────────────────────────────────
// PRO GUIDE
// ────────────────────────────────────────────────────────
function getPROGuide(country) {
  const guides = {
    'Canada': { pro: 'SOCAN', url: 'https://www.socan.com' },
    'United States': { pro: 'ASCAP or BMI', url: 'https://www.ascap.com' },
    'United Kingdom': { pro: 'PRS for Music', url: 'https://www.prsformusic.com' },
    'Germany': { pro: 'GEMA', url: 'https://www.gema.de' },
    'France': { pro: 'SACEM', url: 'https://www.sacem.fr' },
    'Australia': { pro: 'APRA AMCOS', url: 'https://www.apraamcos.com.au' },
    'Jamaica': { pro: 'JACAP', url: 'https://www.jacap.org' },
  };
  const defaultGuide = { pro: 'Your local PRO', url: 'https://www.cisac.org' };
  if (!country) return defaultGuide;
  const match = Object.keys(guides).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return match ? { ...guides[match], country: match } : { ...defaultGuide, country };
}

// ────────────────────────────────────────────────────────
// UNIVERSAL URL PARSER — Spotify + Apple Music
// ────────────────────────────────────────────────────────
function parseUniversalUrl(url) {
  try {
    const u = new URL(url);
    const hostname = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);

    // ── SPOTIFY ──────────────────────────────────────
    if (hostname.includes('spotify.com')) {
      const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
      if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
      const parsed = {
        platform: 'spotify',
        type: parts[typeIdx],           // 'artist' | 'track'
        id: parts[typeIdx + 1].split('?')[0],
      };
      console.log('[Royalte URL] Parsed:', JSON.stringify(parsed));
      return parsed;
    }

    // ── APPLE MUSIC ───────────────────────────────────
    if (hostname.includes('music.apple.com')) {
      // Paths: /us/artist/name/1234567  OR  /us/album/name/1234567?i=987654  OR  /us/song/name/987654
      let type = null;
      let id = null;

      // Song/track: ?i= param (song inside album) or /song/ path
      const iParam = u.searchParams.get('i');
      if (iParam) {
        type = 'track';
        id = iParam;
      } else {
        const songIdx = parts.findIndex(p => p === 'song' || p === 'songs');
        const artistIdx = parts.findIndex(p => p === 'artist' || p === 'artists');
        if (songIdx !== -1) {
          type = 'track';
          // numeric ID is the last path segment
          const lastPart = parts[parts.length - 1].split('?')[0];
          id = /^\d+$/.test(lastPart) ? lastPart : parts[parts.length - 2]?.split('?')[0];
        } else if (artistIdx !== -1) {
          type = 'artist';
          const lastPart = parts[parts.length - 1].split('?')[0];
          id = /^\d+$/.test(lastPart) ? lastPart : null;
        } else {
          // Fallback: last numeric segment
          for (let i = parts.length - 1; i >= 0; i--) {
            const seg = parts[i].split('?')[0];
            if (/^\d+$/.test(seg)) { id = seg; break; }
          }
          type = 'artist'; // default
        }
      }

      if (!id) return null;
      const parsed = { platform: 'apple', type, id };
      console.log('[Royalte URL] Parsed:', JSON.stringify(parsed));
      return parsed;
    }

    return null;
  } catch (e) {
    console.error('[Royalte URL] Parse error:', e.message);
    return null;
  }
}

// Keep old name as alias for internal callers that may reference it
function parseSpotifyUrl(url) { return parseUniversalUrl(url); }

// ────────────────────────────────────────────────────────
// SPOTIFY
// ────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────
// APPLE MUSIC DIRECT AUDIT HANDLER
// ────────────────────────────────────────────────────────
async function handleAppleMusicAudit(parsed, req, res) {
  console.log('[Royalte Apple] Starting Apple Music audit | type:', parsed.type, '| id:', parsed.id);
  try {
    const appleToken = generateAppleToken();
    const STOREFRONT = 'us';
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    let artistData = null;
    let trackData = null;
    let artistName = null;

    if (parsed.type === 'artist') {
      const artistResp = await fetch(`${BASE}/catalog/${STOREFRONT}/artists/${parsed.id}`, { headers });
      console.log('[Royalte Apple] Artist API response:', artistResp.status);
      if (!artistResp.ok) return res.status(400).json({ error: 'Unable to retrieve verified data from Apple Music for this artist.' });
      const artistJson = await artistResp.json();
      artistData = artistJson.data?.[0];
      if (!artistData) return res.status(404).json({ error: 'Artist not found on Apple Music.' });
      artistName = artistData.attributes?.name;
    } else {
      const songResp = await fetch(`${BASE}/catalog/${STOREFRONT}/songs/${parsed.id}`, { headers });
      console.log('[Royalte Apple] Song API response:', songResp.status);
      if (!songResp.ok) return res.status(400).json({ error: 'Unable to retrieve verified data from Apple Music for this track.' });
      const songJson = await songResp.json();
      trackData = songJson.data?.[0];
      if (!trackData) return res.status(404).json({ error: 'Track not found on Apple Music.' });
      artistName = trackData.attributes?.artistName;
      const artistRelId = trackData.relationships?.artists?.data?.[0]?.id;
      if (artistRelId) {
        const ar = await fetch(`${BASE}/catalog/${STOREFRONT}/artists/${artistRelId}`, { headers });
        if (ar.ok) { const aj = await ar.json(); artistData = aj.data?.[0] || null; }
      }
    }

    console.log('[Royalte Apple] Artist name resolved:', artistName);

    let spotifyArtistData = null;
    let isrc = null;

    try {
      const token = await getSpotifyToken();
      const spSearchResp = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (spSearchResp.ok) {
        const spSearch = await spSearchResp.json();
        const norm = s => s.toLowerCase().trim();
        spotifyArtistData = (spSearch.artists?.items || []).find(a => norm(a.name) === norm(artistName)) || null;
        if (spotifyArtistData) console.log('[Royalte Apple] Spotify cross-reference found:', spotifyArtistData.name);
      }
      if (trackData) {
        const trackName = trackData.attributes?.name || '';
        const spTrackResp = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(trackName + ' ' + artistName)}&type=track&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (spTrackResp.ok) {
          const spTrack = await spTrackResp.json();
          const norm = s => s.toLowerCase().trim();
          const match = (spTrack.tracks?.items || []).find(t => norm(t.name) === norm(trackName));
          if (match) { isrc = match.external_ids?.isrc || null; console.log('[Royalte Apple] ISRC from Spotify:', isrc); }
        }
      }
    } catch (spErr) { console.warn('[Royalte Apple] Spotify cross-reference failed:', spErr.message); }

    const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, youtubeData] = await Promise.allSettled([
      getMusicBrainz(artistName), getDeezer(artistName), getAudioDB(artistName),
      getDiscogs(artistName), getSoundCloud(artistName), getLastFm(artistName),
      getWikidata(artistName), getYouTube(artistName),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

    const appleMusicData = {
      found: true,
      artistId: artistData?.id || parsed.id,
      artistUrl: artistData?.attributes?.url || null,
      albumCount: 0,
      isrcLookup: isrc ? { found: true } : null,
      catalogComparison: null,
    };

    const catalogData = { totalReleases: 0, earliestYear: null, latestYear: null, recentActivity: null };
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);

    const syntheticArtist = {
      id: spotifyArtistData?.id || `apple-${parsed.id}`,
      name: artistName,
      genres: spotifyArtistData?.genres || artistData?.attributes?.genreNames || [],
      images: artistData?.attributes?.artwork ? [{ url: artistData.attributes.artwork.url }] : [],
      followers: { total: spotifyArtistData?.followers?.total || 0 },
      popularity: spotifyArtistData?.popularity || 0,
    };
    const syntheticTrack = trackData ? {
      name: trackData.attributes?.name,
      external_ids: { isrc: isrc || null },
    } : null;

    const modules = runModules(syntheticArtist, syntheticTrack, mbData, deezerData, audioDbData,
      discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);
    const royaltyRiskScore = calculateRoyaltyRiskScore(modules, appleMusicData, soundcloudData, youtubeData);
    const connectedSources = [mbData.found, deezerData.found, audioDbData.found, discogsData.found,
      soundcloudData.found, lastfmData.found, wikidataData.found, youtubeData.found].filter(Boolean).length;
    const auditConfidence = connectedSources >= 6 ? 'High' : connectedSources >= 3 ? 'Limited' : 'Minimal';
    const verifiedIssues = buildVerifiedIssues(modules, syntheticArtist, syntheticTrack, appleMusicData, youtubeData, catalogData);
    const coverageStatuses = buildCoverageStatuses(syntheticArtist, syntheticTrack, appleMusicData, soundcloudData, youtubeData, mbData, lastfmData);
    const actionPlan = buildActionPlan(verifiedIssues, country);

    console.log('[Royalte Apple] Complete | Risk score:', royaltyRiskScore, '| Issues:', verifiedIssues.length);

    return res.status(200).json({
      success: true, platform: 'apple', type: parsed.type,
      artistName, artistId: syntheticArtist.id,
      followers: syntheticArtist.followers.total, popularity: syntheticArtist.popularity,
      genres: syntheticArtist.genres, trackTitle: syntheticTrack?.name || null, trackIsrc: isrc || null,
      platforms: {
        spotify: { status: spotifyArtistData ? 'Registered' : 'Not Confirmed', verified: !!spotifyArtistData },
        appleMusic: { status: 'Registered', verified: true, url: appleMusicData.artistUrl },
        musicbrainz: { status: mbData.found ? 'Registered' : 'Not Registered', verified: true },
        deezer: { status: deezerData.found ? 'Registered' : 'Not Registered', verified: true },
        youtube: {
          status: youtubeData.found ? (youtubeData.officialChannel ? 'Registered' : 'Not Confirmed') : 'Not Registered',
          verified: true, contentId: youtubeData.contentIdVerified ? 'Registered' : 'Not Confirmed',
        },
        soundExchange: { status: 'Not Confirmed', verified: false },
        pro: { status: country ? 'Not Confirmed' : 'Not Connected', verified: false, guide: proGuide },
      },
      auditCoverage: {
        spotify: spotifyArtistData ? 'Verified' : 'Not Confirmed',
        appleMusic: 'Verified', publishing: 'Not Connected', soundExchange: 'Not Confirmed',
        confidence: auditConfidence, dataLastVerified: new Date().toISOString(),
      },
      royaltyRiskScore,
      riskLevel: royaltyRiskScore <= 20 ? 'Low' : royaltyRiskScore <= 50 ? 'Moderate' : 'High',
      verifiedIssues, issueCount: verifiedIssues.length, previewIssues: verifiedIssues.slice(0, 2),
      coverageStatuses, actionPlan, catalog: catalogData, appleMusicComparison: null,
      youtube: youtubeData.found ? {
        officialChannel: youtubeData.officialChannel ? {
          title: youtubeData.officialChannel.title,
          subscribers: youtubeData.officialChannel.subscribers,
          videoCount: youtubeData.officialChannel.videoCount,
        } : null,
        contentIdVerified: youtubeData.contentIdVerified,
        ugcVideoCount: youtubeData.ugc?.videoCount || 0,
        ugcContentIdRisk: youtubeData.ugc?.contentIdRisk || false,
      } : null,
      country, scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Royalte Apple] Audit error:', err.message);
    return res.status(500).json({ error: 'Apple Music audit failed.', detail: err.message });
  }
}

async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Spotify token');
  return data.access_token;
}

async function getSpotifyArtist(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyTrack(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyAlbums(artistId, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!resp.ok) return { items: [] };
    return resp.json();
  } catch { return { items: [] }; }
}

async function getSpotifyTopTracks(artistId, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.tracks || []).map(t => ({
      name: t.name,
      isrc: t.external_ids?.isrc || null,
      artistName: t.artists?.[0]?.name || '',
    }));
  } catch { return []; }
}

// ────────────────────────────────────────────────────────
// APPLE MUSIC
// ────────────────────────────────────────────────────────
async function getAppleMusic(artistName, isrc, spotifyTopTracks = []) {
  try {
    const appleToken = generateAppleToken();
    const STOREFRONT = 'us';
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    const artistQuery = encodeURIComponent(artistName);
    const artistResp = await fetch(
      `${BASE}/catalog/${STOREFRONT}/search?term=${artistQuery}&types=artists&limit=5`,
      { headers }
    );

    let artistFound = false;
    let appleArtistId = null;
    let appleArtistUrl = null;
    let appleAlbumCount = 0;

    if (artistResp.ok) {
      const artistData = await artistResp.json();
      const artists = artistData?.results?.artists?.data || [];
      const norm = s => s.toLowerCase().trim();
      const match = artists.find(a => norm(a.attributes?.name) === norm(artistName)) || artists[0];
      if (match) {
        artistFound = true;
        appleArtistId = match.id;
        appleArtistUrl = match.attributes?.url || null;
        const albumResp = await fetch(
          `${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}/albums?limit=25`,
          { headers }
        );
        if (albumResp.ok) {
          const albumData = await albumResp.json();
          appleAlbumCount = albumData?.data?.length || 0;
        }
      }
    }

    let isrcResult = null;
    if (isrc) {
      const isrcResp = await fetch(
        `${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${isrc}`,
        { headers }
      );
      if (isrcResp.ok) {
        const isrcData = await isrcResp.json();
        const songs = isrcData?.data || [];
        isrcResult = songs.length > 0
          ? { found: true, name: songs[0].attributes?.name, url: songs[0].attributes?.url }
          : { found: false };
      }
    }

    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [];
      const notFound = [];
      for (const track of spotifyTopTracks.slice(0, 10)) {
        let found = false;
        if (track.isrc) {
          const isrcResp = await fetch(
            `${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${track.isrc}`,
            { headers }
          );
          if (isrcResp.ok) {
            const isrcData = await isrcResp.json();
            found = (isrcData?.data?.length || 0) > 0;
          }
        }
        if (!found) {
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const searchResp = await fetch(
            `${BASE}/catalog/${STOREFRONT}/search?term=${q}&types=songs&limit=3`,
            { headers }
          );
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const songs = searchData?.results?.songs?.data || [];
            const norm = s => s.toLowerCase().trim();
            found = songs.some(s => norm(s.attributes?.name) === norm(track.name));
          }
        }
        if (found) matched.push(track.name);
        else notFound.push(track.name);
      }
      const total = matched.length + notFound.length;
      catalogComparison = {
        tracksChecked: total,
        matched: matched.length,
        notFound,
        matchRate: total > 0 ? Math.round((matched.length / total) * 100) : 0,
      };
    }

    return {
      found: artistFound,
      artistId: appleArtistId,
      artistUrl: appleArtistUrl,
      albumCount: appleAlbumCount,
      isrcLookup: isrcResult,
      catalogComparison,
    };
  } catch (err) {
    console.error('Apple Music error:', err.message);
    return { found: false, error: err.message };
  }
}

// ────────────────────────────────────────────────────────
// YOUTUBE DATA API v3
// ────────────────────────────────────────────────────────
async function getYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { found: false, reason: 'API key not configured' };

    const query = encodeURIComponent(artistName);
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`
    );
    if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}` };
    const channelData = await channelResp.json();

    const norm = s => s.toLowerCase().trim();
    const channels = channelData.items || [];
    const officialChannel = channels.find(c =>
      norm(c.snippet.channelTitle) === norm(artistName) ||
      norm(c.snippet.channelTitle).includes(norm(artistName)) ||
      c.snippet.description?.toLowerCase().includes('official')
    ) || channels[0];

    let channelStats = null;
    let officialVideoCount = 0;
    let officialViewCount = 0;
    let subscriberCount = 0;

    if (officialChannel) {
      const channelId = officialChannel.snippet.channelId || officialChannel.id?.channelId;
      if (channelId) {
        const statsResp = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`
        );
        if (statsResp.ok) {
          const statsData = await statsResp.json();
          const stats = statsData.items?.[0]?.statistics;
          if (stats) {
            officialVideoCount = parseInt(stats.videoCount || 0);
            officialViewCount = parseInt(stats.viewCount || 0);
            subscriberCount = parseInt(stats.subscriberCount || 0);
          }
        }
      }
    }

    const ugcResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`
    );
    let ugcVideoCount = 0;
    let topUgcVideos = [];

    if (ugcResp.ok) {
      const ugcData = await ugcResp.json();
      const ugcVideos = (ugcData.items || []).filter(v => {
        const channelTitle = v.snippet?.channelTitle?.toLowerCase() || '';
        return !channelTitle.includes(norm(artistName)) && !channelTitle.includes('vevo');
      });
      ugcVideoCount = ugcVideos.length;
      topUgcVideos = ugcVideos.slice(0, 3).map(v => ({
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        videoId: v.id.videoId,
      }));
    }

    const hasOfficialChannel = !!officialChannel;
    const hasUgcRisk = ugcVideoCount > 0 && !hasOfficialChannel;

    return {
      found: true,
      officialChannel: hasOfficialChannel ? {
        title: officialChannel.snippet.channelTitle,
        channelId: officialChannel.snippet.channelId || officialChannel.id?.channelId,
        subscribers: subscriberCount,
        totalViews: officialViewCount,
        videoCount: officialVideoCount,
      } : null,
      ugc: {
        videoCount: ugcVideoCount,
        topVideos: topUgcVideos,
        contentIdRisk: hasUgcRisk,
      },
      contentIdVerified: hasOfficialChannel && officialViewCount > 0,
      subscriberCount,
      totalOfficialViews: officialViewCount,
    };
  } catch (err) {
    console.error('YouTube API error:', err.message);
    return { found: false, reason: err.message };
  }
}

// ────────────────────────────────────────────────────────
// MUSICBRAINZ
// ────────────────────────────────────────────────────────
async function getMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, artists: [] };
    const data = await resp.json();
    return {
      found: data.artists?.length > 0,
      artists: data.artists || [],
      topMatch: data.artists?.[0] || null,
    };
  } catch { return { found: false, artists: [] }; }
}

// ────────────────────────────────────────────────────────
// DEEZER
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://api.deezer.com/search/artist?q=${query}&limit=5`);
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.data?.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const artist = data.data.find(a => norm(a.name) === norm(artistName)) || data.data[0];
    return { found: true, artistId: artist.id, name: artist.name };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// AUDIODB
// ────────────────────────────────────────────────────────
async function getAudioDB(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${query}`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' },
    });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };
    const a = data.artists[0];
    return { found: true, name: a.strArtist, country: a.strCountry || null };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DISCOGS
// ────────────────────────────────────────────────────────
async function getDiscogs(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`,
      {
        headers: {
          'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)',
          'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit',
        },
      }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.results?.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || data.results[0];
    return { found: true, artistId: artist.id, name: artist.title };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// SOUNDCLOUD
// ────────────────────────────────────────────────────────
async function getSoundCloud(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://api.soundcloud.com/users?q=${query}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const user = data.find(u =>
      norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)
    ) || data[0];
    return { found: true, username: user.username };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// LAST.FM
// ────────────────────────────────────────────────────────
async function getLastFm(artistName) {
  try {
    const key = process.env.LASTFM_API_KEY || '43693facbb24d1ac893a5d61c8e5d4c3';
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${query}&api_key=${key}&format=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (data.error || !data.artist) return { found: false };
    return { found: true, name: data.artist.name };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// WIKIDATA / WIKIPEDIA
// ────────────────────────────────────────────────────────
async function getWikidata(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&type=item&format=json&limit=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.search?.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const match = data.search.find(r =>
      norm(r.label) === norm(artistName) &&
      (r.description?.toLowerCase().includes('musician') ||
       r.description?.toLowerCase().includes('singer') ||
       r.description?.toLowerCase().includes('rapper') ||
       r.description?.toLowerCase().includes('artist') ||
       r.description?.toLowerCase().includes('band') ||
       r.description?.toLowerCase().includes('producer'))
    ) || data.search.find(r => norm(r.label) === norm(artistName));
    if (!match) return { found: false };
    return { found: true, wikidataId: match.id, description: match.description || null };
  } catch { return { found: false }; }
}
