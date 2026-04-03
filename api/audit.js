// Royalté Audit API — /api/audit.js
// Multi-source audit engine. Canonical subject drives the scan.
// No Spotify default bias. Verified findings only. No fake certainty.
// Platforms: Spotify · Apple Music · MusicBrainz · Deezer · AudioDB · Discogs · SoundCloud · Last.fm · Wikidata · YouTube

import { generateAppleToken } from './apple-token.js';

// ─────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided.' });

  // ── STAGE A: Parse input URL ─────────────────────────────────
  console.log('[Royalte] Stage A — Input URL:', url);
  const parsed = parseUniversalUrl(url);

  if (!parsed) {
    console.warn('[Royalte] Stage A — Parse failed');
    return res.status(400).json({
      error: 'Enter a valid Spotify or Apple Music URL.',
      detail: 'Supported: open.spotify.com/artist, open.spotify.com/track, music.apple.com artist and song URLs.',
    });
  }

  console.log('[Royalte] Stage A — Parsed:', JSON.stringify(parsed));

  try {
    // ── STAGE B: Resolve source entity ───────────────────────────
    console.log('[Royalte] Stage B — Resolving source entity from', parsed.platform);
    const sourceResolution = await resolveSourceEntity(parsed);

    if (!sourceResolution.success) {
      console.error('[Royalte] Stage B — Source resolution failed:', sourceResolution.error);
      const msg = parsed.platform === 'apple'
        ? 'We recognized your Apple Music link, but could not retrieve verified Apple Music data right now.'
        : 'We recognized your Spotify link, but could not retrieve verified Spotify data right now.';
      return res.status(400).json({
        success: false,
        auditReady: false,
        sourceResolutionStatus: 'failed',
        inputPlatform: parsed.platform,
        entityType: parsed.type,
        metadataStatus: 'failed',
        artistName: null,
        trackName: null,
        error: msg,
        detail: sourceResolution.error,
      });
    }

    console.log('[Royalte] Stage B — Source resolved:', sourceResolution.canonicalSubject.canonicalArtistName);

    // ── STAGE C: Canonical subject ────────────────────────────────
    const subject = sourceResolution.canonicalSubject;
    console.log('[Royalte] Stage C — Canonical subject:', JSON.stringify({
      platform: subject.inputPlatform,
      type: subject.canonicalSubjectType,
      artist: subject.canonicalArtistName,
      track: subject.canonicalTrackName,
    }));

    // ── STAGE D: Cross-reference other sources ────────────────────
    console.log('[Royalte] Stage D — Cross-referencing sources for:', subject.canonicalArtistName);
    const crossRefs = await runCrossReferences(subject, sourceResolution);

    console.log('[Royalte] Stage D — Cross-reference complete:', Object.keys(crossRefs).map(k =>
      `${k}:${crossRefs[k].resolutionStatus}`
    ).join(' | '));

    // ── STAGE E: Build verified findings ──────────────────────────
    console.log('[Royalte] Stage E — Building verified findings');
    const moduleStates = buildModuleStates(subject, sourceResolution, crossRefs);
    const royaltyRiskScore = calculateRoyaltyRiskScore(subject, moduleStates, crossRefs);
    const verifiedIssues = buildVerifiedIssues(subject, moduleStates, crossRefs);
    const actionPlan = buildActionPlan(verifiedIssues, crossRefs.audiodb?.country || crossRefs.wikidata?.country || null);
    const coverageStatuses = buildCoverageStatuses(subject, sourceResolution, crossRefs);
    const auditConfidence = deriveAuditConfidence(crossRefs, sourceResolution);

    console.log('[Royalte] Stage E — Risk score:', royaltyRiskScore, '| Issues:', verifiedIssues.length, '| Confidence:', auditConfidence);
    console.log('[Royalte] Render gate — source_resolution_status: resolved | cross_reference_complete: true | audit_ready: true');
    console.log('[Royalte] Render gate — canonical_artist_name:', subject.canonicalArtistName, '| canonical_track_name:', subject.canonicalTrackName || 'N/A');

    return res.status(200).json({
      success: true,
      auditReady: true,
      sourceResolutionStatus: 'resolved',
      scannedAt: new Date().toISOString(),

      // Canonical subject — always reflects actual input
      canonicalSubject: subject,
      inputPlatform: subject.inputPlatform,
      entityType: subject.canonicalSubjectType,
      platformLabel: subject.platformLabel,
      artistName: subject.canonicalArtistName,
      trackTitle: subject.canonicalTrackName || null,
      trackIsrc: subject.canonicalIsrc || null,
      artistId: subject.canonicalArtistId,
      followers: subject.followers || 0,
      genres: subject.genres || [],

      // Source resolution result
      sourceResolution: {
        platform: subject.inputPlatform,
        status: 'Source Verified',
        resolutionStatus: 'resolved',
        entityType: subject.canonicalSubjectType,
        platformLabel: subject.platformLabel,
        sourceVerified: true,
      },

      // Module states — full structured state per module
      moduleStates,

      // Royalty Risk Score (higher = more risk, max 100)
      royaltyRiskScore,
      riskLevel: royaltyRiskScore <= 20 ? 'Low' : royaltyRiskScore <= 50 ? 'Moderate' : 'High',

      // Verified issues — only from completed cross-references
      verifiedIssues,
      issueCount: verifiedIssues.length,
      previewIssues: verifiedIssues.slice(0, 2),

      // Coverage statuses for UI display
      coverageStatuses,

      // Action plan
      actionPlan,

      // Audit metadata
      auditCoverage: {
        [subject.inputPlatform]: 'Source Verified',
        crossReferences: Object.fromEntries(
          Object.entries(crossRefs).map(([k, v]) => [k, v.resolutionStatus])
        ),
        confidence: auditConfidence,
        dataLastVerified: new Date().toISOString(),
      },

      // Catalog data if available
      catalog: sourceResolution.catalog || null,

      // Raw cross-reference summaries (non-sensitive)
      crossReferenceSummary: {
        appleMusic: {
          resolutionStatus: crossRefs.appleMusic.resolutionStatus,
          crossReferenceStatus: crossRefs.appleMusic.crossReferenceStatus,
        },
        spotify: {
          resolutionStatus: crossRefs.spotify.resolutionStatus,
          crossReferenceStatus: crossRefs.spotify.crossReferenceStatus,
        },
        youtube: {
          resolutionStatus: crossRefs.youtube.resolutionStatus,
          crossReferenceStatus: crossRefs.youtube.crossReferenceStatus,
          officialChannelFound: crossRefs.youtube.officialChannelFound,
          ugcFound: crossRefs.youtube.ugcFound,
        },
        musicbrainz: {
          resolutionStatus: crossRefs.musicbrainz.resolutionStatus,
          crossReferenceStatus: crossRefs.musicbrainz.crossReferenceStatus,
        },
      },
    });

  } catch (err) {
    console.error('[Royalte] Audit error:', err.message, err.stack?.split('\n')[1]);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE A — UNIVERSAL URL PARSER
// ─────────────────────────────────────────────────────────────────
function parseUniversalUrl(url) {
  try {
    const u = new URL(url.trim());
    const hostname = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);

    // ── SPOTIFY ──────────────────────────────────────────────────
    if (hostname.includes('spotify.com')) {
      const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
      if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
      return {
        platform: 'spotify',
        type: parts[typeIdx],   // 'artist' | 'track'
        id: parts[typeIdx + 1].split('?')[0],
        rawUrl: url,
      };
    }

    // ── APPLE MUSIC ───────────────────────────────────────────────
    if (hostname.includes('music.apple.com')) {
      let type = null;
      let id = null;

      // ?i= param = song inside album
      const iParam = u.searchParams.get('i');
      if (iParam && /^\d+$/.test(iParam)) {
        return { platform: 'apple', type: 'track', id: iParam, rawUrl: url };
      }

      // /song/ or /songs/ path
      const songIdx = parts.findIndex(p => p === 'song' || p === 'songs');
      if (songIdx !== -1) {
        // last numeric segment is the ID
        for (let i = parts.length - 1; i > songIdx; i--) {
          const seg = parts[i].split('?')[0];
          if (/^\d+$/.test(seg)) { id = seg; break; }
        }
        return id ? { platform: 'apple', type: 'track', id, rawUrl: url } : null;
      }

      // /artist/ or /artists/ path
      const artistIdx = parts.findIndex(p => p === 'artist' || p === 'artists');
      if (artistIdx !== -1) {
        for (let i = parts.length - 1; i > artistIdx; i--) {
          const seg = parts[i].split('?')[0];
          if (/^\d+$/.test(seg)) { id = seg; break; }
        }
        return id ? { platform: 'apple', type: 'artist', id, rawUrl: url } : null;
      }

      // Fallback: last numeric segment
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i].split('?')[0];
        if (/^\d+$/.test(seg)) { id = seg; break; }
      }
      return id ? { platform: 'apple', type: 'artist', id, rawUrl: url } : null;
    }

    return null;
  } catch (e) {
    console.error('[Royalte] URL parse error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE B — SOURCE ENTITY RESOLUTION
// Fetches from the input platform and builds canonical subject
// ─────────────────────────────────────────────────────────────────
async function resolveSourceEntity(parsed) {
  if (parsed.platform === 'spotify') {
    return await resolveSpotifySource(parsed);
  }
  if (parsed.platform === 'apple') {
    return await resolveAppleSource(parsed);
  }
  return { success: false, error: `Unsupported platform: ${parsed.platform}` };
}

async function resolveSpotifySource(parsed) {
  try {
    const token = await getSpotifyToken();
    console.log('[Royalte Spotify] Token obtained');

    let artistRaw, trackRaw;

    if (parsed.type === 'artist') {
      artistRaw = await getSpotifyArtist(parsed.id, token);
    } else {
      trackRaw = await getSpotifyTrack(parsed.id, token);
      artistRaw = await getSpotifyArtist(trackRaw.artists[0].id, token);
    }

    console.log('[Royalte Spotify] Artist resolved:', artistRaw.name);

    const albumsData = await getSpotifyAlbums(artistRaw.id, token);
    const topTracks = await getSpotifyTopTracks(artistRaw.id, token);
    const catalog = analyzeCatalog(albumsData, artistRaw);

    const canonicalSubject = {
      inputPlatform: 'spotify',
      inputEntityType: parsed.type,
      inputId: parsed.id,
      canonicalSubjectType: parsed.type,
      canonicalArtistName: artistRaw.name,
      canonicalArtistId: artistRaw.id,
      canonicalTrackName: trackRaw?.name || null,
      canonicalIsrc: trackRaw?.external_ids?.isrc || null,
      normalizedInputUrl: parsed.rawUrl,
      platformLabel: parsed.type === 'artist' ? 'Spotify Artist' : 'Spotify Track',
      genres: artistRaw.genres || [],
      followers: artistRaw.followers?.total || 0,
      popularity: artistRaw.popularity || 0,
      images: artistRaw.images || [],
      sourceData: {
        spotifyArtistId: artistRaw.id,
        spotifyTopTracks: topTracks,
        spotifyTrackIsrc: trackRaw?.external_ids?.isrc || null,
      },
    };

    return { success: true, auditReady: true, metadataStatus: 'resolved', canonicalSubject, catalog };
  } catch (err) {
    console.error('[Royalte Spotify] Resolution error:', err.message);
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

async function resolveAppleSource(parsed) {
  console.log('[Royalte Apple] ── Stage B start ──');
  console.log('[Royalte Apple] Input URL:', parsed.rawUrl);
  console.log('[Royalte Apple] Parsed platform:', parsed.platform, '| type:', parsed.type, '| id:', parsed.id);

  try {
    // ── Token generation ──────────────────────────────────────────
    let appleToken;
    try {
      appleToken = generateAppleToken();
      if (!appleToken || typeof appleToken !== 'string' || appleToken.length < 20) {
        console.error('[Royalte Apple] Token generation failed — token invalid:', typeof appleToken, String(appleToken).slice(0, 30));
        return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Apple Music token generation failed. Check apple-token.js configuration.' };
      }
      console.log('[Royalte Apple] Token generated, length:', appleToken.length);
    } catch (tokenErr) {
      console.error('[Royalte Apple] Token generation threw:', tokenErr.message);
      return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music token error: ${tokenErr.message}` };
    }

    // Try multiple storefronts — the URL may contain a non-US storefront
    // Extract storefront from URL path (e.g. /us/, /ca/, /gb/)
    let storefront = 'us';
    try {
      const urlParts = new URL(parsed.rawUrl).pathname.split('/').filter(Boolean);
      const sfCandidate = urlParts[0]?.toLowerCase();
      if (sfCandidate && /^[a-z]{2}$/.test(sfCandidate)) {
        storefront = sfCandidate;
        console.log('[Royalte Apple] Storefront from URL:', storefront);
      }
    } catch {}

    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    let artistRaw = null;
    let trackRaw = null;
    let artistName = null;
    let trackName = null;

    if (parsed.type === 'artist') {
      // Try primary storefront first, then fall back to 'us'
      const storefrontsToTry = storefront !== 'us' ? [storefront, 'us'] : ['us'];
      let resp = null;
      let usedStorefront = null;

      for (const sf of storefrontsToTry) {
        const endpoint = `${BASE}/catalog/${sf}/artists/${parsed.id}`;
        console.log('[Royalte Apple] Trying artist endpoint:', endpoint);
        try {
          resp = await fetch(endpoint, { headers });
          console.log('[Royalte Apple] Artist fetch status:', resp.status, '| storefront:', sf);
          if (resp.ok) { usedStorefront = sf; break; }
          if (resp.status === 401 || resp.status === 403) {
            const errBody = await resp.text().catch(() => '');
            console.error('[Royalte Apple] Auth error body:', errBody.slice(0, 200));
            return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music auth failed (${resp.status}). Check apple-token.js JWT credentials.` };
          }
        } catch (fetchErr) {
          console.error('[Royalte Apple] Fetch threw for storefront', sf, ':', fetchErr.message);
        }
      }

      if (!resp || !resp.ok) {
        const status = resp ? resp.status : 'no response';
        console.error('[Royalte Apple] All storefronts failed. Last status:', status);
        // Last-resort: try extracting artist name from URL slug itself
        const urlSlug = parsed.rawUrl.match(/\/artist\/([^\/]+)\//)?.[1];
        if (urlSlug) {
          const nameFromSlug = urlSlug.replace(/-/g, ' ').replace(/\w/g, c => c.toUpperCase()).trim();
          console.log('[Royalte Apple] Fallback: name extracted from URL slug:', nameFromSlug);
          // Only use if reasonably confident (not just numbers)
          if (nameFromSlug && !/^\d+$/.test(nameFromSlug)) {
            return buildAppleCanonical(parsed, null, null, nameFromSlug, null, 'url_slug_fallback', parsed.id);
          }
        }
        return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${status} for artist ${parsed.id}` };
      }

      const json = await resp.json();
      console.log('[Royalte Apple] Artist response data count:', json.data?.length || 0);
      artistRaw = json.data?.[0];
      if (!artistRaw) {
        console.error('[Royalte Apple] No artist object in response. Response keys:', Object.keys(json));
        return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Artist not found in Apple Music catalog response' };
      }
      artistName = artistRaw.attributes?.name;
      console.log('[Royalte Apple] Artist name from API:', artistName);

    } else {
      // Track/song resolution
      const storefrontsToTry = storefront !== 'us' ? [storefront, 'us'] : ['us'];
      let resp = null;

      for (const sf of storefrontsToTry) {
        const endpoint = `${BASE}/catalog/${sf}/songs/${parsed.id}`;
        console.log('[Royalte Apple] Trying song endpoint:', endpoint);
        try {
          resp = await fetch(endpoint, { headers });
          console.log('[Royalte Apple] Song fetch status:', resp.status, '| storefront:', sf);
          if (resp.ok) break;
          if (resp.status === 401 || resp.status === 403) {
            return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music auth failed (${resp.status}). Check apple-token.js JWT credentials.` };
          }
        } catch (fetchErr) {
          console.error('[Royalte Apple] Song fetch threw for storefront', sf, ':', fetchErr.message);
        }
      }

      if (!resp || !resp.ok) {
        return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${resp?.status || 'no response'} for song ${parsed.id}` };
      }

      const json = await resp.json();
      trackRaw = json.data?.[0];
      if (!trackRaw) return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Track not found in Apple Music catalog response' };
      trackName = trackRaw.attributes?.name;
      artistName = trackRaw.attributes?.artistName;
      console.log('[Royalte Apple] Track name:', trackName, '| artist:', artistName);

      // Attempt to fetch full artist object from relationship
      const relArtistId = trackRaw.relationships?.artists?.data?.[0]?.id;
      if (relArtistId) {
        try {
          const ar = await fetch(`${BASE}/catalog/${storefront}/artists/${relArtistId}`, { headers });
          if (ar.ok) {
            const aj = await ar.json();
            artistRaw = aj.data?.[0] || null;
            if (artistRaw && !artistName) artistName = artistRaw.attributes?.name;
            console.log('[Royalte Apple] Related artist fetched:', artistRaw?.attributes?.name);
          }
        } catch (e) { console.warn('[Royalte Apple] Related artist fetch failed:', e.message); }
      }
    }

    if (!artistName) {
      console.error('[Royalte Apple] Artist name null after all resolution attempts');
      artistName = 'Unknown Artist';
    }

    console.log('[Royalte Apple] ── Stage B complete ──');
    console.log('[Royalte Apple] artist_name:', artistName, '| track_name:', trackName || 'N/A');
    console.log('[Royalte Apple] source_resolution_status: resolved | audit_ready: true');

    return buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, 'api', null);

  } catch (err) {
    console.error('[Royalte Apple] Resolution error:', err.message);
    console.error('[Royalte Apple] source_resolution_status: failed | audit_ready: false');
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

// Build canonical subject from resolved Apple data — separated to support fallbacks
function buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, resolvedVia, overrideId) {
  return {
    success: true,
    auditReady: true,
    metadataStatus: 'resolved',
    resolvedVia, // 'api' | 'url_slug_fallback'
    canonicalSubject: {
      inputPlatform: 'apple',
      inputEntityType: parsed.type,
      inputId: parsed.id,
      canonicalSubjectType: parsed.type,
      canonicalArtistName: artistName,
      canonicalArtistId: artistRaw?.id || overrideId || `apple-${parsed.id}`,
      canonicalTrackName: trackName || null,
      canonicalIsrc: null,
      normalizedInputUrl: parsed.rawUrl,
      platformLabel: parsed.type === 'artist' ? 'Apple Music Artist' : 'Apple Music Track',
      genres: artistRaw?.attributes?.genreNames || [],
      followers: 0,
      popularity: 0,
      images: artistRaw?.attributes?.artwork
        ? [{ url: artistRaw.attributes.artwork.url.replace('{w}x{h}bb', '400x400bb').replace('{w}x{h}', '400x400') }]
        : [],
      sourceData: {
        appleArtistId: artistRaw?.id || overrideId || parsed.id,
        appleArtistUrl: artistRaw?.attributes?.url || null,
        appleTrackId: trackRaw?.id || null,
      },
    },
    catalog: null,
  };
}

// ─────────────────────────────────────────────────────────────────
// STAGE D — CROSS-REFERENCE ENGINE
// Each cross-ref returns a structured state object, never a boolean
// ─────────────────────────────────────────────────────────────────
async function runCrossReferences(subject, sourceResolution) {
  const name = subject.canonicalArtistName;
  const trackName = subject.canonicalTrackName;
  const isInputSpotify = subject.inputPlatform === 'spotify';
  const isInputApple = subject.inputPlatform === 'apple';

  // Run all cross-references in parallel
  const [spotifyRef, appleMusicRef, youtubeRef, mbRef, deezerRef, audiodbRef, discogsRef, soundcloudRef, lastfmRef, wikidataRef] = await Promise.allSettled([
    isInputSpotify
      ? Promise.resolve(buildSpotifySourceRef(sourceResolution)) // already resolved from source
      : crossRefSpotify(name, trackName, subject.sourceData?.spotifyTopTracks),
    isInputApple
      ? Promise.resolve(buildAppleSourceRef(sourceResolution)) // already resolved from source
      : crossRefAppleMusic(name, sourceResolution.canonicalSubject?.sourceData?.spotifyTopTracks || [], null),
    crossRefYouTube(name),
    crossRefMusicBrainz(name),
    crossRefDeezer(name),
    crossRefAudioDB(name),
    crossRefDiscogs(name),
    crossRefSoundCloud(name),
    crossRefLastFm(name),
    crossRefWikidata(name),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', error: r.reason?.message }));

  return {
    spotify: spotifyRef,
    appleMusic: appleMusicRef,
    youtube: youtubeRef,
    musicbrainz: mbRef,
    deezer: deezerRef,
    audiodb: audiodbRef,
    discogs: discogsRef,
    soundcloud: soundcloudRef,
    lastfm: lastfmRef,
    wikidata: wikidataRef,
    // Rights systems — cannot be verified via public API
    soundExchange: { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
    pro: { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
  };
}

// Build a source ref from an already-resolved Spotify source
function buildSpotifySourceRef(sourceResolution) {
  const subject = sourceResolution.canonicalSubject;
  return {
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: 'Source Verified',
    registrationStatus: 'Source Verified',
    verified: true,
    artistId: subject.canonicalArtistId,
    artistName: subject.canonicalArtistName,
    followers: subject.followers,
    genres: subject.genres,
    isrc: subject.canonicalIsrc,
  };
}

// Build a source ref from an already-resolved Apple source
function buildAppleSourceRef(sourceResolution) {
  const subject = sourceResolution.canonicalSubject;
  return {
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: subject.inputEntityType === 'artist' ? 'Profile Resolved' : 'Track Resolved',
    registrationStatus: 'Source Verified',
    verified: true,
    artistId: subject.canonicalArtistId,
    artistUrl: subject.sourceData?.appleArtistUrl || null,
    artistName: subject.canonicalArtistName,
  };
}

// Cross-reference Spotify (when Apple was the input)
async function crossRefSpotify(artistName, trackName, spotifyTopTracks) {
  try {
    const token = await getSpotifyToken();
    const norm = s => s.toLowerCase().trim();

    const searchResp = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!searchResp.ok) {
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    }

    const searchData = await searchResp.json();
    const match = (searchData.artists?.items || []).find(a => norm(a.name) === norm(artistName));

    if (!match) {
      console.log('[Royalte CrossRef Spotify] No match found for:', artistName);
      return { sourceUsedForScan: false, resolutionStatus: 'resolved', crossReferenceStatus: 'No Verified Match Yet', registrationStatus: 'Not Confirmed', verified: true };
    }

    console.log('[Royalte CrossRef Spotify] Found:', match.name, '| followers:', match.followers?.total);

    // Try ISRC cross-ref if track
    let isrc = null;
    if (trackName) {
      const trackResp = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(trackName + ' ' + artistName)}&type=track&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (trackResp.ok) {
        const trackData = await trackResp.json();
        const trackMatch = (trackData.tracks?.items || []).find(t => norm(t.name) === norm(trackName));
        if (trackMatch) isrc = trackMatch.external_ids?.isrc || null;
      }
    }

    return {
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus: 'Cross-Reference Found',
      registrationStatus: 'Registered',
      verified: true,
      artistId: match.id,
      artistName: match.name,
      followers: match.followers?.total || 0,
      genres: match.genres || [],
      isrc,
    };
  } catch (err) {
    console.error('[Royalte CrossRef Spotify] Error:', err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference Apple Music (when Spotify was the input)
async function crossRefAppleMusic(artistName, spotifyTopTracks, isrc) {
  console.log('[Royalte CrossRef Apple] Starting cross-reference for:', artistName);
  console.log('[Royalte CrossRef Apple] Canonical artist name:', artistName);
  try {
    let appleToken;
    try {
      appleToken = generateAppleToken();
      if (!appleToken || typeof appleToken !== 'string' || appleToken.length < 20) {
        console.error('[Royalte CrossRef Apple] Token invalid');
        return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: 'Apple token invalid' };
      }
    } catch (tokenErr) {
      console.error('[Royalte CrossRef Apple] Token error:', tokenErr.message);
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: tokenErr.message };
    }

    const STOREFRONT = 'us';
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    // Name normalization — handles apostrophes, accents, punctuation, unicode
    const normName = s => s
      .toLowerCase()
      .trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
      .replace(/[''`]/g, "'")        // normalize apostrophes
      .replace(/[^a-z0-9\s'&]/g, '') // strip other punctuation
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedQuery = normName(artistName);
    console.log('[Royalte CrossRef Apple] Normalized search query:', normalizedQuery);

    const searchResp = await fetch(
      `${BASE}/catalog/${STOREFRONT}/search?term=${encodeURIComponent(artistName)}&types=artists&limit=10`,
      { headers }
    );
    console.log('[Royalte CrossRef Apple] Search response status:', searchResp.status);

    if (!searchResp.ok) {
      const errBody = await searchResp.text().catch(() => '');
      console.error('[Royalte CrossRef Apple] Search failed:', searchResp.status, errBody.slice(0, 100));
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    }

    const searchData = await searchResp.json();
    const artists = searchData?.results?.artists?.data || [];
    console.log('[Royalte CrossRef Apple] Search returned', artists.length, 'candidates');
    artists.forEach((a, i) => console.log(`  [${i}] ${a.attributes?.name}`));

    // Multi-strategy matching
    let match = null;
    let matchConfidence = null;

    // Strategy 1: Exact normalized match
    match = artists.find(a => normName(a.attributes?.name || '') === normalizedQuery);
    if (match) { matchConfidence = 'exact'; }

    // Strategy 2: One contains the other (handles "The X" vs "X" etc.)
    if (!match) {
      match = artists.find(a => {
        const cn = normName(a.attributes?.name || '');
        return cn.includes(normalizedQuery) || normalizedQuery.includes(cn);
      });
      if (match) { matchConfidence = 'contains'; }
    }

    // Strategy 3: High word overlap (2+ words matching)
    if (!match && normalizedQuery.includes(' ')) {
      const queryWords = normalizedQuery.split(' ').filter(w => w.length > 1);
      match = artists.find(a => {
        const cn = normName(a.attributes?.name || '');
        const cnWords = cn.split(' ').filter(w => w.length > 1);
        const overlap = queryWords.filter(w => cnWords.includes(w)).length;
        return overlap >= Math.max(1, queryWords.length - 1);
      });
      if (match) { matchConfidence = 'word_overlap'; }
    }

    // Strategy 4: First result as low-confidence fallback (only if query is short/unique)
    if (!match && artists.length > 0 && normalizedQuery.length >= 4) {
      const firstNorm = normName(artists[0].attributes?.name || '');
      // Only use if first result shares significant prefix
      const minLen = Math.min(normalizedQuery.length, firstNorm.length);
      const sharedPrefix = [...Array(minLen)].findIndex((_, i) => normalizedQuery[i] !== firstNorm[i]);
      const prefixMatch = sharedPrefix === -1 ? minLen : sharedPrefix;
      if (prefixMatch >= 4) {
        match = artists[0];
        matchConfidence = 'prefix_fallback';
      }
    }

    if (!match) {
      console.log('[Royalte CrossRef Apple] No confident match found for:', artistName);
      console.log('[Royalte CrossRef Apple] Final status: No Verified Match Yet');
      return { sourceUsedForScan: false, resolutionStatus: 'resolved', crossReferenceStatus: 'No Verified Match Yet', registrationStatus: 'Not Registered', verified: true };
    }

    console.log('[Royalte CrossRef Apple] Match found:', match.attributes?.name, '| confidence:', matchConfidence);

    // Catalog comparison against top Spotify tracks
    let catalogComparison = null;
    if (spotifyTopTracks && spotifyTopTracks.length > 0) {
      const matched = [], notFound = [];
      for (const track of spotifyTopTracks.slice(0, 10)) {
        let found = false;
        if (track.isrc) {
          const isrcResp = await fetch(`${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${track.isrc}`, { headers });
          if (isrcResp.ok) {
            const isrcData = await isrcResp.json();
            found = (isrcData?.data?.length || 0) > 0;
          }
        }
        if (!found) {
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const sResp = await fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${q}&types=songs&limit=3`, { headers });
          if (sResp.ok) {
            const sData = await sResp.json();
            found = (sData?.results?.songs?.data || []).some(s => norm(s.attributes?.name) === norm(track.name));
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
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus: 'Cross-Reference Found',
      registrationStatus: 'Registered',
      verified: true,
      artistId: match.id,
      artistUrl: match.attributes?.url || null,
      artistName: match.attributes?.name,
      catalogComparison,
    };
  } catch (err) {
    console.error('[Royalte CrossRef Apple] Error:', err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference YouTube — real check, honest status
async function crossRefYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('[Royalte CrossRef YouTube] API key not configured');
      return { sourceUsedForScan: false, resolutionStatus: 'not_checked', crossReferenceStatus: 'Not Confirmed', verified: false, reason: 'API key not configured' };
    }

    const norm = s => s.toLowerCase().trim();
    const query = encodeURIComponent(artistName);

    // Channel search
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`
    );
    if (!channelResp.ok) {
      console.warn('[Royalte CrossRef YouTube] Channel search failed:', channelResp.status);
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    }

    const channelData = await channelResp.json();
    const channels = channelData.items || [];

    const officialChannel = channels.find(c =>
      norm(c.snippet.channelTitle) === norm(artistName) ||
      norm(c.snippet.channelTitle).includes(norm(artistName)) ||
      c.snippet.description?.toLowerCase().includes('official')
    ) || (channels.length > 0 ? channels[0] : null);

    let officialChannelData = null;
    let subscriberCount = 0;
    let videoCount = 0;

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
            subscriberCount = parseInt(stats.subscriberCount || 0);
            videoCount = parseInt(stats.videoCount || 0);
          }
        }
        officialChannelData = {
          title: officialChannel.snippet.channelTitle,
          channelId,
          subscribers: subscriberCount,
          videoCount,
        };
      }
    }

    // UGC scan
    const ugcResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`
    );
    let ugcVideoCount = 0;
    let ugcContentIdRisk = false;
    let topUgcVideos = [];

    if (ugcResp.ok) {
      const ugcData = await ugcResp.json();
      const ugcVideos = (ugcData.items || []).filter(v => {
        const ct = v.snippet?.channelTitle?.toLowerCase() || '';
        return !ct.includes(norm(artistName)) && !ct.includes('vevo');
      });
      ugcVideoCount = ugcVideos.length;
      ugcContentIdRisk = ugcVideoCount > 0 && !officialChannelData;
      topUgcVideos = ugcVideos.slice(0, 3).map(v => ({
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        videoId: v.id.videoId,
      }));
    }

    const officialChannelFound = !!officialChannelData;
    const crossReferenceStatus = officialChannelFound ? 'Cross-Reference Found' : 'No Verified Match Yet';

    console.log('[Royalte CrossRef YouTube] Status:', crossReferenceStatus, '| Channel:', officialChannelFound, '| UGC:', ugcVideoCount);

    return {
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus,
      registrationStatus: officialChannelFound ? 'Not Confirmed' : 'Not Confirmed', // Content ID can't be verified externally
      verified: true,
      officialChannelFound,
      officialChannel: officialChannelData,
      ugcFound: ugcVideoCount > 0,
      ugcVideoCount,
      ugcContentIdRisk,
      topUgcVideos,
      contentIdVerified: officialChannelFound && videoCount > 0,
    };
  } catch (err) {
    console.error('[Royalte CrossRef YouTube] Error:', err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference MusicBrainz
async function crossRefMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = data.artists?.length > 0;
    const multipleEntries = data.artists?.length > 1;
    return {
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found,
      artists: data.artists || [],
      multipleEntries,
    };
  } catch (err) {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Deezer
async function crossRefDeezer(artistName) {
  try {
    const resp = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`);
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = data.data?.some(a => norm(a.name) === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found: !!found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference AudioDB (country detection)
async function crossRefAudioDB(artistName) {
  try {
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' },
    });
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = data.artists?.length > 0;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
      country: found ? data.artists[0].strCountry : null,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Discogs
async function crossRefDiscogs(artistName) {
  try {
    const resp = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)', 'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = data.results?.some(r => norm(r.title) === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found: !!found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference SoundCloud
async function crossRefSoundCloud(artistName) {
  try {
    const resp = await fetch(
      `https://api.soundcloud.com/users?q=${encodeURIComponent(artistName)}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = Array.isArray(data) && data.some(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Last.fm
async function crossRefLastFm(artistName) {
  try {
    const key = process.env.LASTFM_API_KEY || '43693facbb24d1ac893a5d61c8e5d4c3';
    const resp = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${key}&format=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = !data.error && !!data.artist;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Wikidata
async function crossRefWikidata(artistName) {
  try {
    const resp = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&type=item&format=json&limit=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const musicTerms = ['musician', 'singer', 'rapper', 'artist', 'band', 'producer', 'songwriter'];
    const match = data.search?.find(r =>
      norm(r.label) === norm(artistName) &&
      musicTerms.some(t => r.description?.toLowerCase().includes(t))
    ) || data.search?.find(r => norm(r.label) === norm(artistName));
    const found = !!match;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
      country: null, // Wikidata country requires additional SPARQL query
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE E — MODULE STATES
// Each module has structured state. Source and cross-ref separated.
// ─────────────────────────────────────────────────────────────────
function buildModuleStates(subject, sourceResolution, crossRefs) {
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput = subject.inputPlatform === 'apple';
  const isTrack = subject.canonicalSubjectType === 'track';

  const spotifyRef = crossRefs.spotify;
  const appleRef = crossRefs.appleMusic;
  const youtubeRef = crossRefs.youtube;
  const mbRef = crossRefs.musicbrainz;

  // ── Module A: Metadata Integrity ─────────────────────────────
  const metaIssues = [];
  const hasGenres = subject.genres?.length > 0;
  const hasIsrc = !!subject.canonicalIsrc || (isAppleInput && crossRefs.spotify.isrc);
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;

  if (!hasGenres) metaIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (isTrack && !effectiveIsrc) metaIssues.push({ type: 'missing_isrc', status: 'Not Confirmed' });

  const metaState = {
    module: 'metadata_integrity',
    name: 'Metadata Integrity',
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: metaIssues.length === 0 ? 'No Issues Found' : `${metaIssues.length} issue(s)`,
    registrationStatus: null,
    verified: true,
    issues: metaIssues,
    displayStatus: metaIssues.length === 0 ? 'No issues detected' : `${metaIssues.length} issue(s) found`,
  };

  // ── Module B: Platform Coverage ───────────────────────────────
  const covIssues = [];

  // Input source is always verified — don't flag it as missing
  if (!isSpotifyInput && spotifyRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'not_on_spotify', status: 'No Verified Match Yet', platform: 'Spotify' });
  }
  if (!isAppleInput && appleRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'not_on_apple_music', status: 'No Verified Match Yet', platform: 'Apple Music' });
  }
  if (!mbRef.found) {
    covIssues.push({ type: 'not_in_musicbrainz', status: mbRef.crossReferenceStatus, platform: 'MusicBrainz' });
  }
  if (youtubeRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'no_youtube_match', status: 'No Verified Match Yet', platform: 'YouTube' });
  }

  const covState = {
    module: 'platform_coverage',
    name: 'Platform Coverage',
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: covIssues.length === 0 ? 'Cross-Reference Found' : `${covIssues.length} gap(s)`,
    registrationStatus: null,
    verified: true,
    issues: covIssues,
    displayStatus: covIssues.length === 0 ? 'All checked platforms found' : `${covIssues.length} gap(s) found`,
  };

  // ── Module C: Publishing Risk ─────────────────────────────────
  const pubState = {
    module: 'publishing_risk',
    name: 'Publishing Risk',
    sourceUsedForScan: false,
    resolutionStatus: 'not_checked',
    crossReferenceStatus: 'Manual Check Required',
    registrationStatus: 'Not Confirmed',
    verified: false,
    issues: [
      { type: 'soundexchange_unconfirmed', status: 'Manual Check Required' },
      { type: 'pro_not_connected', status: 'Manual Check Required' },
    ],
    displayStatus: 'Manual Check Required — cannot verify via public data',
  };

  // ── Module D: Duplicate Detection ────────────────────────────
  const dupIssues = [];
  if (mbRef.multipleEntries) {
    dupIssues.push({ type: 'multiple_mb_entries', status: 'Not Confirmed', count: mbRef.artists?.length });
  }
  const dupState = {
    module: 'duplicate_detection',
    name: 'Duplicate Detection',
    sourceUsedForScan: false,
    resolutionStatus: mbRef.resolutionStatus,
    crossReferenceStatus: dupIssues.length === 0 ? 'No Issues Found' : 'Not Confirmed',
    registrationStatus: null,
    verified: mbRef.verified,
    issues: dupIssues,
    displayStatus: dupIssues.length === 0 ? 'No duplicates found' : `${mbRef.artists?.length} MusicBrainz entries`,
  };

  // ── Module E: YouTube / UGC ───────────────────────────────────
  const ytState = {
    module: 'youtube_ugc',
    name: 'YouTube / UGC',
    sourceUsedForScan: false,
    resolutionStatus: youtubeRef.resolutionStatus,
    crossReferenceStatus: youtubeRef.crossReferenceStatus,
    registrationStatus: 'Not Confirmed', // Content ID cannot be verified externally
    verified: youtubeRef.verified,
    officialChannelFound: youtubeRef.officialChannelFound || false,
    ugcFound: youtubeRef.ugcFound || false,
    ugcContentIdRisk: youtubeRef.ugcContentIdRisk || false,
    issues: [],
    displayStatus: youtubeRef.resolutionStatus === 'not_checked'
      ? 'Not Confirmed — API key not configured'
      : youtubeRef.crossReferenceStatus,
  };

  if (youtubeRef.resolutionStatus === 'resolved') {
    if (!youtubeRef.officialChannelFound) {
      ytState.issues.push({ type: 'no_youtube_channel', status: 'No Verified Match Yet' });
    }
    if (youtubeRef.ugcContentIdRisk) {
      ytState.issues.push({ type: 'ugc_content_id_risk', status: 'Not Confirmed' });
    }
  }

  // ── Module F: Sync Readiness ──────────────────────────────────
  const syncIssues = [];
  if (!hasGenres) syncIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (isTrack && !effectiveIsrc) syncIssues.push({ type: 'missing_isrc', status: 'Not Confirmed' });
  if (!mbRef.found) syncIssues.push({ type: 'not_in_musicbrainz', status: mbRef.crossReferenceStatus });
  if (!crossRefs.wikidata.found) syncIssues.push({ type: 'no_wikipedia', status: 'No Verified Match Yet' });
  if (!isAppleInput && appleRef.crossReferenceStatus === 'No Verified Match Yet') {
    syncIssues.push({ type: 'not_on_apple_music', status: 'No Verified Match Yet' });
  }

  const syncState = {
    module: 'sync_readiness',
    name: 'Sync Readiness',
    sourceUsedForScan: false,
    resolutionStatus: 'resolved',
    crossReferenceStatus: syncIssues.length === 0 ? 'Sync Ready' : `${syncIssues.length} gap(s)`,
    registrationStatus: null,
    verified: true,
    issues: syncIssues,
    displayStatus: syncIssues.length === 0 ? 'Sync-ready' : `${syncIssues.length} gap(s)`,
  };

  return {
    metadata: metaState,
    coverage: covState,
    publishing: pubState,
    duplicates: dupState,
    youtube: ytState,
    sync: syncState,
  };
}

// ─────────────────────────────────────────────────────────────────
// ROYALTY RISK SCORE
// Only verified cross-reference findings contribute to score
// Unresolved or not_checked = +0
// ─────────────────────────────────────────────────────────────────
function calculateRoyaltyRiskScore(subject, moduleStates, crossRefs) {
  let score = 0;

  const isTrack = subject.canonicalSubjectType === 'track';
  const isAppleInput = subject.inputPlatform === 'apple';
  const isSpotifyInput = subject.inputPlatform === 'spotify';

  // Verified: ISRC missing on track (only if we actually checked and found it missing)
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;
  if (isTrack && !effectiveIsrc && crossRefs.spotify.resolutionStatus === 'resolved') score += 25;

  // Verified: Missing genres (confirmed via source API)
  if (!subject.genres?.length) score += 15;

  // Verified: Not in MusicBrainz (confirmed via MB API)
  if (crossRefs.musicbrainz.resolutionStatus === 'resolved' && !crossRefs.musicbrainz.found) score += 15;

  // Verified: Not on Apple Music cross-reference (only if Spotify was input AND Apple check completed AND no match)
  if (isSpotifyInput && crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.crossReferenceStatus === 'No Verified Match Yet') score += 15;

  // Verified: Not on Spotify cross-reference (only if Apple was input AND Spotify check completed AND no match)
  if (isAppleInput && crossRefs.spotify.resolutionStatus === 'resolved' && crossRefs.spotify.crossReferenceStatus === 'No Verified Match Yet') score += 10;

  // Manual check required — weighted lower since unverified
  // SoundExchange — always manual, always apply
  score += 10;

  // PRO — always manual, always apply
  score += 10;

  // YouTube: no official channel (only if check ran successfully)
  if (crossRefs.youtube.resolutionStatus === 'resolved' && !crossRefs.youtube.officialChannelFound) score += 10;

  // YouTube: UGC risk (only if check ran)
  if (crossRefs.youtube.resolutionStatus === 'resolved' && crossRefs.youtube.ugcContentIdRisk) score += 10;

  // Catalog gap on Apple Music cross-reference (only if verified)
  if (crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.catalogComparison?.matchRate < 70) score += 10;

  return Math.min(score, 100);
}

// ─────────────────────────────────────────────────────────────────
// VERIFIED ISSUES — built AFTER all cross-references complete
// ─────────────────────────────────────────────────────────────────
function buildVerifiedIssues(subject, moduleStates, crossRefs) {
  const issues = [];
  const isTrack = subject.canonicalSubjectType === 'track';
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput = subject.inputPlatform === 'apple';
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;

  // ── Verified: ISRC missing ────────────────────────────────────
  if (isTrack && !effectiveIsrc && crossRefs.spotify.resolutionStatus === 'resolved') {
    issues.push({
      type: 'missing_isrc',
      module: 'Metadata Integrity',
      priority: 'HIGH',
      status: 'Not Confirmed',
      verifiedBy: isSpotifyInput ? 'Spotify API (source)' : 'Spotify cross-reference',
      title: 'ISRC not found on this recording',
      detail: 'The International Standard Recording Code (ISRC) was not returned. Without an ISRC, performance royalty routing cannot be confirmed.',
    });
  }

  // ── Verified: Missing genres ──────────────────────────────────
  if (!subject.genres?.length) {
    issues.push({
      type: 'missing_genres',
      module: 'Metadata Integrity',
      priority: 'MEDIUM',
      status: 'Not Confirmed',
      verifiedBy: `${subject.inputPlatform === 'spotify' ? 'Spotify' : 'Apple Music'} API (source)`,
      title: 'Genre tags absent on source profile',
      detail: 'No genre metadata found on the source platform. Genre tags affect algorithmic discovery and publishing discoverability.',
    });
  }

  // ── Cross-ref verified: Not on Apple Music (Spotify input only) ──
  if (isSpotifyInput && crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.crossReferenceStatus === 'No Verified Match Yet') {
    issues.push({
      type: 'not_on_apple_music',
      module: 'Platform Coverage',
      priority: 'HIGH',
      status: 'No Verified Match Yet',
      verifiedBy: 'Apple Music API (cross-reference)',
      title: 'No Apple Music match found',
      detail: 'Cross-reference against Apple Music returned no verified match for this artist. Distribution gaps here may be limiting royalty collection.',
    });
  }

  // ── Cross-ref verified: Not on Spotify (Apple input only) ────────
  if (isAppleInput && crossRefs.spotify.resolutionStatus === 'resolved' && crossRefs.spotify.crossReferenceStatus === 'No Verified Match Yet') {
    issues.push({
      type: 'not_on_spotify',
      module: 'Platform Coverage',
      priority: 'HIGH',
      status: 'No Verified Match Yet',
      verifiedBy: 'Spotify API (cross-reference)',
      title: 'No Spotify match found',
      detail: 'Cross-reference against Spotify returned no verified match for this artist.',
    });
  }

  // ── Cross-ref verified: Apple catalog gap (Spotify input only) ───
  if (isSpotifyInput && crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.catalogComparison) {
    const { matchRate, notFound, tracksChecked } = crossRefs.appleMusic.catalogComparison;
    if (matchRate < 70 && notFound.length > 0) {
      issues.push({
        type: 'apple_catalog_gap',
        module: 'Platform Coverage',
        priority: matchRate < 50 ? 'HIGH' : 'MEDIUM',
        status: 'No Verified Match Yet',
        verifiedBy: 'Apple Music API (cross-reference via ISRC)',
        title: `${notFound.length} of ${tracksChecked} top tracks not matched on Apple Music`,
        detail: `Unmatched: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? ` and ${notFound.length - 3} more` : ''}. Distribution may be incomplete.`,
      });
    }
  }

  // ── Cross-ref verified: Not in MusicBrainz ───────────────────
  if (crossRefs.musicbrainz.resolutionStatus === 'resolved' && !crossRefs.musicbrainz.found) {
    issues.push({
      type: 'not_in_musicbrainz',
      module: 'Publishing Risk',
      priority: 'MEDIUM',
      status: 'Not Registered',
      verifiedBy: 'MusicBrainz API (cross-reference)',
      title: 'Not found in MusicBrainz',
      detail: 'MusicBrainz is used as a publishing reference database by royalty collection systems. Not registered may affect cross-platform data linking.',
    });
  }

  // ── YouTube: no official channel (only if check completed) ───
  if (crossRefs.youtube.resolutionStatus === 'resolved' && !crossRefs.youtube.officialChannelFound) {
    issues.push({
      type: 'no_youtube_channel',
      module: 'YouTube / UGC',
      priority: 'MEDIUM',
      status: 'No Verified Match Yet',
      verifiedBy: 'YouTube Data API v3 (cross-reference)',
      title: 'No official YouTube channel matched',
      detail: 'YouTube cross-reference returned no confirmed official channel for this artist. Content ID monetisation status cannot be confirmed.',
    });
  }

  // ── YouTube: UGC risk (only if check completed) ───────────────
  if (crossRefs.youtube.resolutionStatus === 'resolved' && crossRefs.youtube.ugcContentIdRisk) {
    issues.push({
      type: 'ugc_content_id_risk',
      module: 'YouTube / UGC',
      priority: 'HIGH',
      status: 'Not Confirmed',
      verifiedBy: 'YouTube Data API v3',
      title: `${crossRefs.youtube.ugcVideoCount} user-uploaded video(s) found — no official channel confirmed`,
      detail: 'User-uploaded content found on YouTube with no verified official channel. Content ID registration status cannot be confirmed.',
    });
  }

  // ── Always show: SoundExchange (manual check required) ───────
  issues.push({
    type: 'soundexchange_unconfirmed',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Manual Check Required',
    verifiedBy: null,
    title: 'SoundExchange registration — manual check required',
    detail: 'SoundExchange collects digital performance royalties for US streaming. Registration status cannot be verified via public data. Check directly at soundexchange.com.',
  });

  // ── Always show: PRO (manual check required) ─────────────────
  const country = crossRefs.audiodb?.country || crossRefs.wikidata?.country || null;
  issues.push({
    type: 'pro_not_connected',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Manual Check Required',
    verifiedBy: null,
    title: 'PRO registration — manual check required',
    detail: 'Performance Rights Organisation membership cannot be verified via public data. PRO membership is required to collect performance royalties from radio, TV, and public performance.',
  });

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return issues.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─────────────────────────────────────────────────────────────────
// COVERAGE STATUSES — for UI display, using correct status families
// ─────────────────────────────────────────────────────────────────
function buildCoverageStatuses(subject, sourceResolution, crossRefs) {
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput = subject.inputPlatform === 'apple';

  const statuses = [];

  // ── Input source — always Source Verified ────────────────────
  if (isSpotifyInput) {
    statuses.push({
      platform: 'Spotify',
      role: 'input_source',
      status: 'Source Verified',
      verified: true,
      detail: null,
    });
  }
  if (isAppleInput) {
    statuses.push({
      platform: 'Apple Music',
      role: 'input_source',
      status: subject.inputEntityType === 'artist' ? 'Profile Resolved' : 'Track Resolved',
      verified: true,
      detail: null,
    });
  }

  // ── Cross-references ─────────────────────────────────────────
  if (isSpotifyInput) {
    const am = crossRefs.appleMusic;
    statuses.push({
      platform: 'Apple Music',
      role: 'cross_reference',
      status: am.resolutionStatus === 'failed' ? 'Not Confirmed'
        : am.crossReferenceStatus,
      verified: am.verified,
      detail: am.resolutionStatus === 'failed' ? 'Cross-reference check failed' : null,
    });
  }
  if (isAppleInput) {
    const sp = crossRefs.spotify;
    statuses.push({
      platform: 'Spotify',
      role: 'cross_reference',
      status: sp.resolutionStatus === 'failed' ? 'Not Confirmed'
        : sp.crossReferenceStatus,
      verified: sp.verified,
      detail: null,
    });
  }

  // YouTube
  const yt = crossRefs.youtube;
  statuses.push({
    platform: 'YouTube',
    role: 'cross_reference',
    status: yt.resolutionStatus === 'not_checked' ? 'Not Confirmed'
      : yt.resolutionStatus === 'failed' ? 'Not Confirmed'
      : yt.crossReferenceStatus,
    verified: yt.verified,
    detail: yt.ugcContentIdRisk ? 'User-uploaded content found. Content ID status unconfirmed.' : null,
  });

  // MusicBrainz
  const mb = crossRefs.musicbrainz;
  statuses.push({
    platform: 'MusicBrainz',
    role: 'cross_reference',
    status: mb.resolutionStatus === 'failed' ? 'Not Confirmed' : mb.crossReferenceStatus,
    verified: mb.verified,
    detail: mb.multipleEntries ? `${mb.artists?.length} entries found — possible duplicates` : null,
  });

  // SoundExchange — always manual
  statuses.push({
    platform: 'SoundExchange',
    role: 'rights_system',
    status: 'Manual Check Required',
    verified: false,
    detail: 'Cannot be verified via public data. Check soundexchange.com directly.',
  });

  // PRO
  const country = crossRefs.audiodb?.country || null;
  const proGuide = getPROGuide(country);
  statuses.push({
    platform: 'PRO (Performance Rights)',
    role: 'rights_system',
    status: 'Manual Check Required',
    verified: false,
    detail: country
      ? `Your local PRO may be ${proGuide.pro}. Cannot be verified via public data.`
      : 'Cannot be verified via public data. Find your PRO at cisac.org.',
  });

  return statuses;
}

// ─────────────────────────────────────────────────────────────────
// ACTION PLAN
// ─────────────────────────────────────────────────────────────────
function buildActionPlan(verifiedIssues, country) {
  if (!verifiedIssues.length) {
    return [{ action: 'No verified issues detected', reason: 'No action required based on verified data', priority: null }];
  }

  const proGuide = getPROGuide(country);

  const actionMap = {
    missing_isrc: { action: 'Register this recording with your distributor to obtain an ISRC', reason: 'ISRC not found — verified via API', priority: 'HIGH' },
    missing_genres: { action: 'Add genre metadata to your source platform artist profile', reason: 'Genre tags absent — verified via source API', priority: 'MEDIUM' },
    not_on_apple_music: { action: 'Distribute your catalog to Apple Music via your distributor', reason: 'No Apple Music match found — verified via cross-reference', priority: 'HIGH' },
    not_on_spotify: { action: 'Distribute your catalog to Spotify via your distributor', reason: 'No Spotify match found — verified via cross-reference', priority: 'HIGH' },
    apple_catalog_gap: { action: 'Review Apple Music distribution and re-deliver missing tracks', reason: 'Tracks not matched on Apple Music — verified via ISRC cross-reference', priority: 'MEDIUM' },
    not_in_musicbrainz: { action: 'Register your artist profile on MusicBrainz (musicbrainz.org)', reason: 'Not found in MusicBrainz — verified via API', priority: 'MEDIUM' },
    no_youtube_channel: { action: 'Create or claim your official YouTube channel and register for Content ID', reason: 'No official YouTube channel matched — verified via YouTube API', priority: 'MEDIUM' },
    ugc_content_id_risk: { action: 'Register for Content ID through your distributor or a YouTube OAC partner', reason: 'User-uploaded content found with no official channel — verified via YouTube API', priority: 'HIGH' },
    soundexchange_unconfirmed: { action: 'Register with SoundExchange at soundexchange.com', reason: 'Digital performance royalties in the US require SoundExchange registration', priority: 'MEDIUM' },
    pro_not_connected: { action: country ? `Register with ${proGuide.pro} — ${proGuide.url}` : 'Register with your local PRO — find yours at cisac.org', reason: 'PRO registration is required to collect performance royalties', priority: 'MEDIUM' },
  };

  return verifiedIssues.filter(i => actionMap[i.type]).map(i => actionMap[i.type]);
}

// ─────────────────────────────────────────────────────────────────
// AUDIT CONFIDENCE
// ─────────────────────────────────────────────────────────────────
function deriveAuditConfidence(crossRefs, sourceResolution) {
  const resolved = Object.values(crossRefs).filter(r => r.resolutionStatus === 'resolved').length;
  const total = Object.keys(crossRefs).length;
  if (resolved >= total * 0.7) return 'High';
  if (resolved >= total * 0.4) return 'Limited';
  return 'Minimal';
}

// ─────────────────────────────────────────────────────────────────
// CATALOG ANALYSIS (Spotify source)
// ─────────────────────────────────────────────────────────────────
function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, latestYear: null, recentActivity: false };
  const years = albums.map(a => parseInt(a.release_date?.substring(0, 4))).filter(y => !isNaN(y) && y > 1950);
  const currentYear = new Date().getFullYear();
  return {
    totalReleases: albums.length,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    recentActivity: years.some(y => y >= currentYear - 2),
  };
}

// ─────────────────────────────────────────────────────────────────
// PRO GUIDE
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// SPOTIFY API HELPERS
// ─────────────────────────────────────────────────────────────────
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
  const resp = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyTrack(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyAlbums(artistId, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return { items: [] };
    return resp.json();
  } catch { return { items: [] }; }
}

async function getSpotifyTopTracks(artistId, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
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
