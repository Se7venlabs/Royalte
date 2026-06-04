// Royaltē scan engine — pure scan logic, no HTTP / rate-limit / persistence.
//
// Extracted from api/audit.js (Block D) so the scan pipeline can be called
// from BOTH the user-facing /api/audit handler AND the monitoring cron.
//
// runScan(url) resolves any Spotify / Apple Music input to a canonical artist,
// fans out across ~10 platforms, builds the raw audit response, and returns
// it. It performs NO rate-limiting, NO persistence, and NO res.status() calls
// — callers own those concerns.
//
// On a fatal scan error runScan throws. Thrown errors carry a `scanErrorKind`
// tag ('unknown_input' | 'unresolved' | 'spotify_token' | 'resolve') alongside
// the original message, so callers can reproduce the exact HTTP classification
// the inline handler used before this extraction.

import { generateAppleToken } from '../apple-token.js';
import { lookupByISRC, checkStorefrontAvailability } from '../apple-music.js';

// ── Revenue Exposure estimation constants ───────────────────────────────────
// Last.fm playcount is the primary stream-volume signal (Spotify demoted —
// Development Mode no longer returns followers/popularity). Every value below
// is an INITIAL estimate — recalibrate post-launch against real beta data.
const LASTFM_SAMPLING_MULTIPLIER = 10;    // Last.fm scrobbles ≈ 10% of total streaming activity
const PER_STREAM_RATE            = 0.003; // USD per stream — industry-average premium-tier rate
const LOW_GAP_RATIO              = 0.05;  // minimum realistic share of royalties left unclaimed
const HIGH_GAP_RATIO             = 0.30;  // maximum realistic share of royalties left unclaimed

// ─────────────────────────────────────────────────────────────────────────────
// runScan — the scan orchestrator.
//
// Returns { rawResponse, urlType, warnings }:
//   - rawResponse — the raw legacy-shape audit payload
//   - urlType     — detectInputType(url), or 'apple' for the Apple-only
//                   degraded path (matches the pre-refactor persist args)
//   - warnings    — non-fatal degradation notices (empty on the happy path)
// ─────────────────────────────────────────────────────────────────────────────
export async function runScan(url) {
  // Top-level input guard (was an inline 400 in the handler).
  const inputType = detectInputType(url);
  if (inputType === 'unknown') {
    const e = new Error('Invalid URL. Please paste a Spotify or Apple Music link.');
    e.scanErrorKind = 'unknown_input';
    throw e;
  }

  // ── SPOTIFY TOKEN ───────────────────────────────────────
  let token;
  try {
    token = await getSpotifyToken();
  } catch (tokenErr) {
    tokenErr.scanErrorKind = 'spotify_token';
    throw tokenErr;
  }

  // ── ARTIST RESOLUTION ───────────────────────────────────
  // ALL inputs (artist / track / album / apple) normalize to a single
  // canonical artist before the scan runs.
  let resolved;
  try {
    resolved = await resolveToArtist(url, token);
  } catch (resErr) {
    if (!resErr.scanErrorKind) resErr.scanErrorKind = 'resolve';
    throw resErr;
  }
  if (!resolved) {
    const e = new Error('Could not resolve this link to an artist. Please try a different link.');
    e.scanErrorKind = 'unresolved';
    throw e;
  }

  // ── DEGRADED PATH: Apple input with no Spotify match ────
  // Per spec: DO NOT fail the scan. Return a success payload with artistName
  // from Apple and followers = -1 so the UI shows "Fans on streaming
  // platforms" instead of an error.
  if (!resolved.artistId) {
    const rawResponse = {
      success: true,
      platform: 'apple',
      type: 'artist',
      artistName: resolved.artistName,
      artistId: null,
      followers: -1,
      popularity: 0,
      genres: [],
      trackTitle: resolved.trackTitle ?? null,
      trackIsrc: resolved.trackIsrc ?? null,
      resolvedFrom:       resolved.resolvedFrom,
      resolvedFromType:   resolved.resolvedFromType,
      resolvedFromTitle:  resolved.resolvedFromTitle,
      canonicalTarget:    'artist',
      spotifyMatched:     false,
      artistUrl:          null,
      imageUrl:           resolved.artistImage || resolved.appleArtworkUrl || null,
      artistImageUrl:     resolved.artistImage || resolved.appleArtworkUrl || null,
      albumImageUrl:      null,
      appleArtworkUrl:    resolved.appleArtworkUrl || null,
      platforms: {
        spotify: false, musicbrainz: false, deezer: false, audiodb: false,
        discogs: false, soundcloud: false, lastfm: false, wikipedia: false,
        youtube: false, appleMusic: true,
      },
      catalog: { totalReleases: 0, earliestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0 },
      royaltyGap: null,
      proGuide: getPROGuide(null),
      country: null,
      lastfmPlays: 0,
      lastfmListeners: 0,
      wikipediaUrl: null,
      deezerFans: 0,
      discogsReleases: 0,
      youtube: { found: false },
      appleMusic: { found: false, artistId: resolved.appleArtistId || null },
      overallScore: 0,
      modules: {},
      flags: [],
      flagCount: 0,
      previewFlags: [],
      scannedAt: new Date().toISOString(),
    };
    return { rawResponse, urlType: 'apple', warnings: [] };
  }

  const artistId = resolved.artistId;

  // ── DEGRADABLE: full artist fetch ───────────────────────
  // If the full artist fetch hits a transient Spotify hiccup or 404, degrade
  // rather than hard-fail: synthesize a stub from `resolved` and continue.
  const warnings = [];
  let artistData;
  try {
    artistData = await getSpotifyArtist(artistId, token);
  } catch (artistErr) {
    console.warn('[run-scan] getSpotifyArtist failed — degrading to partial data:', artistErr.message);
    const detailSuffix = artistErr.message.replace(/^Spotify artist fetch failed:\s*/i, '');
    warnings.push({
      platform: 'spotify',
      stage: 'artist_fetch',
      reason: `Spotify artist fetch failed for ID ${artistId}: ${detailSuffix}`,
    });
    artistData = {
      id: resolved.artistId,
      name: resolved.artistName,
      followers: { total: -1 },
      popularity: 0,
      genres: [],
      images: resolved.artistImage ? [{ url: resolved.artistImage }] : [],
      external_urls: resolved.artistUrl ? { spotify: resolved.artistUrl } : {},
    };
  }

  // For track inputs we still want trackData populated for the existing
  // ISRC / Apple cross-reference logic.
  let trackData = null;
  if (resolved.resolvedFromType === 'track' && resolved.spotifyTrackId) {
    try { trackData = await getSpotifyTrack(resolved.spotifyTrackId, token); }
    catch { trackData = null; }
  }

  const albumsData = await getSpotifyAlbums(artistId, token);
  const artistName = artistData.name;
  const spotifyTopTracks = await getSpotifyTopTracks(artistId, token);

  // All platforms in parallel — includes YouTube + Apple Music.
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

  const catalogData = analyzeCatalog(albumsData);
  const royaltyGap = estimateRoyaltyGap(catalogData, lastfmData, youtubeData);
  // Single source of truth — catalog and royalty figures share one estimate.
  catalogData.estimatedAnnualStreams = royaltyGap.estAnnualStreams;
  const country = audioDbData.country || wikidataData.country || null;
  const proGuide = getPROGuide(country);

  const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);

  const overallScore = Math.round(
    Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
  );

  const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);

  const gapBasedExposure = computeGapBasedExposure({
    catalog: catalogData, track: trackData, youtube: youtubeData,
    appleMusic: appleMusicData, mb: mbData, flags,
  });

  const rawResponse = {
    success: true,
    platform: 'spotify',
    type: 'artist',
    artistName,
    artistId: artistData.id,
    followers: artistData.followers?.total || 0,
    popularity: artistData.popularity || 0,
    genres: artistData.genres || [],
    trackTitle: trackData?.name || null,
    trackIsrc: trackData?.external_ids?.isrc || null,
    resolvedFrom:       resolved.resolvedFrom,
    resolvedFromType:   resolved.resolvedFromType,
    resolvedFromTitle:  resolved.resolvedFromTitle,
    canonicalTarget:    'artist',
    spotifyMatched:     resolved.spotifyMatched !== false,
    artistUrl:          resolved.artistUrl || artistData.external_urls?.spotify || null,
    imageUrl:           artistData.images?.[0]?.url || resolved.artistImage || trackData?.album?.images?.[0]?.url || null,
    artistImageUrl:     artistData.images?.[0]?.url || resolved.artistImage || null,
    albumImageUrl:      trackData?.album?.images?.[0]?.url || null,
    appleArtworkUrl:    resolved.appleArtworkUrl || null,
    platforms: {
      spotify: true,
      musicbrainz: mbData.found,
      deezer: deezerData.found,
      audiodb: audioDbData.found,
      discogs: discogsData.found,
      soundcloud: soundcloudData.found,
      lastfm: lastfmData.found,
      wikipedia: wikidataData.found,
      youtube: youtubeData.found,
      appleMusic: appleMusicData.found,
    },
    catalog: catalogData,
    royaltyGap,
    gapBasedExposure,
    proGuide,
    country,
    lastfmPlays: lastfmData.playcount || 0,
    lastfmListeners: lastfmData.listeners || 0,
    wikipediaUrl: wikidataData.wikipediaUrl || null,
    deezerFans: deezerData.fans || 0,
    discogsReleases: discogsData.releases || 0,
    youtube: youtubeData,
    appleMusic: appleMusicData,
    overallScore,
    modules,
    flags,
    flagCount: flags.length,
    previewFlags: flags.slice(0, 2),
    scannedAt: new Date().toISOString(),
  };

  return { rawResponse, urlType: inputType, warnings };
}

// ────────────────────────────────────────────────────────
// INPUT TYPE DETECTION
// ────────────────────────────────────────────────────────
function detectInputType(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('spotify.com/artist')) return 'spotify_artist';
  if (u.includes('spotify.com/track'))  return 'spotify_track';
  if (u.includes('spotify.com/album'))  return 'spotify_album';
  if (u.includes('music.apple.com'))    return 'apple';
  return 'unknown';
}

// ────────────────────────────────────────────────────────
// ARTIST RESOLUTION — every input normalizes here.
// Returns: { artistId, artistName, artistImage, artistUrl,
//           spotifyMatched, resolvedFrom, resolvedFromType,
//           resolvedFromTitle, canonicalTarget: 'artist',
//           spotifyTrackId? }
// ────────────────────────────────────────────────────────
async function resolveToArtist(inputUrl, token) {
  const inputType = detectInputType(inputUrl);

  // ─── SPOTIFY ARTIST ────────────────────────────
  if (inputType === 'spotify_artist') {
    const id = extractSpotifyId(inputUrl, 'artist');
    if (!id) throw new Error('Could not parse Spotify artist URL');
    const artist = await getSpotifyArtist(id, token);
    return {
      artistId:          artist.id,
      artistName:        artist.name,
      artistImage:       artist.images?.[0]?.url || null,
      artistUrl:         artist.external_urls?.spotify || null,
      spotifyMatched:    true,
      resolvedFrom:      'artist',
      resolvedFromType:  'direct',
      resolvedFromTitle: artist.name,
      canonicalTarget:   'artist',
    };
  }

  // ─── SPOTIFY TRACK ─────────────────────────────
  if (inputType === 'spotify_track') {
    const trackId = extractSpotifyId(inputUrl, 'track');
    if (!trackId) throw new Error('Could not parse Spotify track URL');
    const track = await getSpotifyTrack(trackId, token);
    const artistRef = track.artists?.[0];
    if (!artistRef?.id) throw new Error('Track has no associated artist');
    const artist = await getSpotifyArtist(artistRef.id, token);
    return {
      artistId:          artist.id,
      artistName:        artist.name,
      artistImage:       artist.images?.[0]?.url || null,
      artistUrl:         artist.external_urls?.spotify || null,
      spotifyMatched:    true,
      resolvedFrom:      'track',
      resolvedFromType:  'track',
      resolvedFromTitle: track.name,
      canonicalTarget:   'artist',
      spotifyTrackId:    trackId,
    };
  }

  // ─── SPOTIFY ALBUM ─────────────────────────────
  // Per spec: do NOT fetch tracks, do NOT use ISRC, do NOT add extra calls.
  if (inputType === 'spotify_album') {
    const albumId = extractSpotifyId(inputUrl, 'album');
    if (!albumId) throw new Error('Could not parse Spotify album URL');
    const album = await getSpotifyAlbum(albumId, token);
    const artistRef = album.artists?.[0];
    if (!artistRef?.id) throw new Error('Album has no associated artist');
    const artist = await getSpotifyArtist(artistRef.id, token);
    return {
      artistId:          artist.id,
      artistName:        artist.name,
      artistImage:       artist.images?.[0]?.url || null,
      artistUrl:         artist.external_urls?.spotify || null,
      spotifyMatched:    true,
      resolvedFrom:      'album',
      resolvedFromType:  'album',
      resolvedFromTitle: album.name,
      canonicalTarget:   'artist',
    };
  }

  // ─── APPLE MUSIC ───────────────────────────────
  // Apple URL → resolve artist name on Apple → search Spotify for that name.
  // If no Spotify match, return spotifyMatched: false but DO NOT fail.
  if (inputType === 'apple') {
    // Resolve Apple artist + artwork in one shot
    const appleResolved = await resolveAppleArtist(inputUrl);
    const appleArtistName = appleResolved?.name;
    const appleArtwork    = appleResolved?.artworkUrl || null;
    const appleArtistId   = appleResolved?.appleArtistId || null;
    const appleTrackTitle = appleResolved?.trackTitle ?? null;
    const appleTrackIsrc  = appleResolved?.trackIsrc ?? null;
    if (!appleArtistName) {
      throw new Error('Could not resolve artist from Apple Music link');
    }
    // First attempt: search Spotify with the raw Apple name.
    let spotifyArtist = await searchSpotifyArtistByName(appleArtistName, token);
    // Conservative retry: strip parentheticals + collapse whitespace, keep case
    // and stylized punctuation (P!nk, BØRNS, etc.).
    if (!spotifyArtist) {
      const cleaned = cleanArtistName(appleArtistName);
      if (cleaned && cleaned !== appleArtistName) {
        spotifyArtist = await searchSpotifyArtistByName(cleaned, token);
      }
    }
    if (spotifyArtist) {
      return {
        artistId:          spotifyArtist.id,
        artistName:        spotifyArtist.name,
        artistImage:       spotifyArtist.images?.[0]?.url || appleArtwork || null,
        artistUrl:         spotifyArtist.external_urls?.spotify || null,
        spotifyMatched:    true,
        resolvedFrom:      'apple',
        resolvedFromType:  'external',
        resolvedFromTitle: appleArtistName,
        canonicalTarget:   'artist',
        appleArtworkUrl:   appleArtwork,
        appleArtistId,
      };
    }
    // No Spotify match after retry. Per spec: DO NOT fail the scan.
    // Return a degraded record with followers: -1 sentinel so the handler
    // can ship a success response even though Spotify-dependent fields
    // will be empty. Apple artwork still serves as the image.
    return {
      artistId:          null,
      artistName:        appleArtistName,
      artistImage:       appleArtwork || null,
      artistUrl:         null,
      spotifyMatched:    false,
      followers:         -1,
      resolvedFrom:      'apple',
      resolvedFromType:  'external',
      resolvedFromTitle: appleArtistName,
      canonicalTarget:   'artist',
      appleArtworkUrl:   appleArtwork,
      appleArtistId,
      trackTitle:        appleTrackTitle,
      trackIsrc:         appleTrackIsrc,
    };
  }

  throw new Error('Unsupported input type');
}

// ────────────────────────────────────────────────────────
// CONSERVATIVE NAME CLEANING — strips parentheticals + whitespace only.
// Keeps case, apostrophes, and stylized symbols intact so names like
// "P!nk", "BØRNS", "Tyler, The Creator" still match where possible.
// ────────────────────────────────────────────────────────
function cleanArtistName(name) {
  if (!name) return '';
  return String(name)
    .replace(/\([^)]*\)/g, '')   // strip "(feat. X)", "(Deluxe)", etc.
    .replace(/\[[^\]]*\]/g, '')  // strip "[Bonus Track]" style brackets too
    .replace(/\s+/g, ' ')         // collapse whitespace
    .trim();
}

// ────────────────────────────────────────────────────────
// HELPERS — Spotify URL ID extraction (artist|track|album)
// ────────────────────────────────────────────────────────
function extractSpotifyId(url, kind) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === kind);
    if (idx === -1 || !parts[idx + 1]) return null;
    return parts[idx + 1].split('?')[0];
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// LEGACY URL PARSER — kept for any caller that still references it
// ────────────────────────────────────────────────────────
function parseSpotifyUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
    return { platform: 'spotify', type: parts[typeIdx], id: parts[typeIdx + 1].split('?')[0] };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// SPOTIFY
// ────────────────────────────────────────────────────────
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Spotify token');
  return data.access_token;
}

async function getSpotifyArtist(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/artists/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyTrack(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  return resp.json();
}

// Album fetcher — does NOT expand tracks. Only used to read album.artists[0].
async function getSpotifyAlbum(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!resp.ok) throw new Error(`Spotify album fetch failed: ${resp.status}`);
  return resp.json();
}

async function searchSpotifyArtistByName(name, token) {
  try {
    const q = encodeURIComponent(name);
    const resp = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=5`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const items = data?.artists?.items || [];
    if (!items.length) return null;
    const norm = s => s.toLowerCase().trim();
    return items.find(a => norm(a.name) === norm(name)) || items[0];
  } catch { return null; }
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
// APPLE MUSIC RESOLUTION (input → artist name)
// Separate responsibility from getAppleMusic() which is cross-platform
// enrichment AFTER artist is known.
// Supports artist / song / album URLs from music.apple.com.
// ────────────────────────────────────────────────────────
async function resolveAppleArtist(appleUrl) {
  try {
    const meta = parseAppleMusicUrl(appleUrl);
    if (!meta) return null;

    const appleToken = generateAppleToken();
    const headers = { Authorization: `Bearer ${appleToken}` };
    const BASE = 'https://api.music.apple.com/v1';
    const sf = meta.storefront || 'us';

    const formatArtwork = (artwork) => {
      if (!artwork || !artwork.url) return null;
      // Apple's url is a template like https://....{w}x{h}bb.jpg
      // Substitute 600x600 for a high-quality square image.
      return artwork.url.replace('{w}', '600').replace('{h}', '600');
    };

    if (meta.kind === 'artist') {
      const r = await fetch(`${BASE}/catalog/${sf}/artists/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs) return null;
      // Artist endpoint sometimes lacks artwork — fall back to artist search
      let artworkUrl = formatArtwork(attrs.artwork);
      if (!artworkUrl) {
        const sresp = await fetch(`${BASE}/catalog/${sf}/search?term=${encodeURIComponent(attrs.name)}&types=artists&limit=3`, { headers });
        if (sresp.ok) {
          const sdata = await sresp.json();
          const match = sdata?.results?.artists?.data?.[0];
          artworkUrl = formatArtwork(match?.attributes?.artwork);
        }
      }
      return { name: attrs.name, artworkUrl, appleArtistId: meta.id };
    }

    if (meta.kind === 'song') {
      const r = await fetch(`${BASE}/catalog/${sf}/songs/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      // Songs always have artwork (album cover) — use as fallback
      const artworkUrl = formatArtwork(attrs.artwork);
      const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
      return { name: attrs.artistName, artworkUrl, appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null };
    }

    if (meta.kind === 'album') {
      // If the URL contains ?i=<songId> Apple treats it as a song — try song first
      if (meta.songId) {
        const rs = await fetch(`${BASE}/catalog/${sf}/songs/${meta.songId}`, { headers });
        if (rs.ok) {
          const data = await rs.json();
          const attrs = data?.data?.[0]?.attributes;
          if (attrs?.artistName) {
            const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
            return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null };
          }
        }
      }
      const r = await fetch(`${BASE}/catalog/${sf}/albums/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
      return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId };
    }

    return null;
  } catch (err) {
    console.error('Apple resolution error:', err.message);
    return null;
  }
}

// Backwards-compat alias — keep the old function name in case anything else calls it
async function resolveAppleArtistName(appleUrl) {
  const r = await resolveAppleArtist(appleUrl);
  return r ? r.name : null;
}

function parseAppleMusicUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('music.apple.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // Expected shape: /<storefront>/<kind>/<slug>/<id>
    // kind ∈ { artist, song, album }
    const storefront = parts[0] || 'us';
    const kindIdx = parts.findIndex(p => p === 'artist' || p === 'song' || p === 'album');
    if (kindIdx === -1) return null;
    const kind = parts[kindIdx];
    const id = parts[parts.length - 1]; // last segment is the numeric id
    if (!id) return null;
    const songId = u.searchParams.get('i') || null;
    return { storefront, kind, id, songId };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// APPLE MUSIC — artist search, ISRC lookup, catalog comparison
// (existing cross-platform enrichment — runs AFTER artist is known)
// ────────────────────────────────────────────────────────
async function getAppleMusic(artistName, isrc, spotifyTopTracks = []) {
  try {
    const appleToken = generateAppleToken();
    const STOREFRONT = 'us';
    const BASE = 'https://api.music.apple.com/v1';

    const headers = { Authorization: `Bearer ${appleToken}` };

    // 1. Search for artist on Apple Music
    const artistQuery = encodeURIComponent(artistName);
    const artistResp = await fetch(
      `${BASE}/catalog/${STOREFRONT}/search?term=${artistQuery}&types=artists&limit=5`,
      { headers }
    );

    let artistFound = false;
    let appleArtistId = null;
    let appleArtistUrl = null;
    let appleArtistGenres = [];
    let appleAlbumCount = 0;
    let appleAlbums = [];

    if (artistResp.ok) {
      const artistData = await artistResp.json();
      const artists = artistData?.results?.artists?.data || [];
      const norm = s => s.toLowerCase().trim();
      const match = artists.find(a => norm(a.attributes?.name) === norm(artistName)) || artists[0];

      if (match) {
        artistFound = true;
        appleArtistId = match.id;
        appleArtistUrl = match.attributes?.url || null;
        appleArtistGenres = match.attributes?.genreNames || [];

        // Get album list (up to 25). We previously surfaced only the count;
        // the full list is the source for V2 releases[] / EPs / Singles /
        // Tracks (Brief 008). attributes.trackCount lets the consumer side
        // classify each release: 1 → Single · 2–6 → EP · 7+ → Album.
        const albumResp = await fetch(
          `${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}/albums?limit=25`,
          { headers }
        );
        if (albumResp.ok) {
          const albumData = await albumResp.json();
          const rows = albumData?.data || [];
          appleAlbumCount = rows.length;
          appleAlbums = rows.map((a) => ({
            id:          a.id || null,
            name:        a.attributes?.name || null,
            releaseDate: a.attributes?.releaseDate || null,
            trackCount:  (typeof a.attributes?.trackCount === 'number') ? a.attributes.trackCount : null,
            url:         a.attributes?.url || null,
            // Brief 015k Fix #1 — persist cover artwork so Mission Control's
            // Intelligence Feed can render real release art instead of the
            // music-icon fallback. Apple Music returns a URL template with
            // {w}x{h} placeholders; we substitute 300×300 here so the
            // stored URL is immediately usable by any consumer (dashboard
            // displays at 56×56 — 300×300 is ~retina-5×, slightly heavy
            // bandwidth but matches the pattern already used in
            // api/apple-music.js:79-81 / 117-119). Pre-existing scans
            // won't have this field until they re-scan.
            artwork:     a.attributes?.artwork?.url
              ? a.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
              : null,
          }));
        }
      }
    }

    // Brief 011 — BIG 6 storefront availability. Reuses the same JWT
    // (single shared `headers` object) for 7 parallel `/catalog/{sf}/
    // albums?ids=...` calls. Failure on any one storefront is isolated
    // to that storefront's entry; others continue. Skipped entirely on
    // an artist with no Apple Music albums.
    let storefrontAvailability = null;
    if (appleAlbums.length > 0) {
      const albumIds = appleAlbums.map((a) => a.id).filter(Boolean);
      if (albumIds.length > 0) {
        try {
          storefrontAvailability = await checkStorefrontAvailability(albumIds, headers);
        } catch (sfErr) {
          // checkStorefrontAvailability already isolates per-storefront
          // errors; a top-level throw here means the whole Promise.all
          // failed (e.g. headers / network catastrophe). Leave the field
          // null so the dashboard renders the "—" empty state.
          console.error('Apple Music storefront availability failed:', sfErr.message);
        }
      }
    }

    // 2. ISRC lookup for the specific track (if track scan)
    let isrcResult = null;
    if (isrc) {
      const r = await lookupByISRC(isrc);
      // Preserve original semantics: only surface definitive results.
      // Helper errors (r.error present) stay invisible so the
      // "ISRC found on Spotify but not on Apple Music" flag at
      // audit.js:1253 doesn't fire on transient Apple API failures.
      if (!r.error) isrcResult = r;
    }

    // 3. Compare Spotify top tracks against Apple Music catalog
    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [];
      const notFound = [];

      for (const track of spotifyTopTracks.slice(0, 10)) { // limit to 10 to avoid rate limits
        let found = false;

        if (track.isrc) {
          found = (await lookupByISRC(track.isrc)).found;
        }

        if (!found) {
          // Fallback: search by name
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

        if (found) {
          matched.push(track.name);
        } else {
          notFound.push(track.name);
        }
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
      genres: appleArtistGenres,
      albumCount: appleAlbumCount,
      albums: appleAlbums,
      storefrontAvailability,
      isrcLookup: isrcResult,
      catalogComparison,
    };

  } catch (err) {
    console.error('Apple Music error:', err.message);
    return { found: false, error: err.message };
  }
}

// ────────────────────────────────────────────────────────
// YOUTUBE DATA API v3 — real channel + UGC detection
// ────────────────────────────────────────────────────────
async function getYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('YOUTUBE_API_KEY not set — skipping YouTube scan');
      return { found: false, reason: 'API key not configured' };
    }

    const query = encodeURIComponent(artistName);

    // Search for official channel
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`
    );
    if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}` };
    const channelData = await channelResp.json();

    // Find best channel match
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
            channelStats = stats;
            officialVideoCount = parseInt(stats.videoCount || 0);
            officialViewCount = parseInt(stats.viewCount || 0);
            subscriberCount = parseInt(stats.subscriberCount || 0);
          }
        }
      }
    }

    // Search for UGC / user-uploaded content (not from official channel)
    const ugcResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`
    );
    let ugcVideoCount = 0;
    let ugcEstimatedViews = 0;
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

      if (ugcVideos.length > 0) {
        const videoIds = ugcVideos.map(v => v.id.videoId).filter(Boolean).join(',');
        if (videoIds) {
          const videoStatsResp = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
          );
          if (videoStatsResp.ok) {
            const videoStatsData = await videoStatsResp.json();
            ugcEstimatedViews = (videoStatsData.items || []).reduce((sum, v) => {
              return sum + parseInt(v.statistics?.viewCount || 0);
            }, 0);
          }
        }
      }
    }

    const hasOfficialChannel = !!officialChannel;
    const hasUgcRisk = ugcVideoCount > 0;
    const contentIdRisk = hasUgcRisk && !hasOfficialChannel;

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
        estimatedViews: ugcEstimatedViews,
        topVideos: topUgcVideos,
        contentIdRisk,
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
// CATALOG AGE ANALYSIS
// ────────────────────────────────────────────────────────
function analyzeCatalog(albumsData) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0 };

  const years = albums
    .map(a => parseInt(a.release_date?.substring(0, 4)))
    .filter(y => !isNaN(y) && y > 1950);

  const earliestYear = years.length ? Math.min(...years) : null;
  const currentYear = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;

  return {
    totalReleases: albums.length,
    earliestYear,
    latestYear: years.length ? Math.max(...years) : null,
    catalogAgeYears,
    // Placeholder — runScan overwrites this with royaltyGap.estAnnualStreams so
    // the catalog and royalty figures share one Last.fm-derived source of truth.
    estimatedAnnualStreams: 0,
    recentActivity: years.some(y => y >= currentYear - 2),
  };
}

// ────────────────────────────────────────────────────────
// ROYALTY GAP ESTIMATE — includes YouTube UGC data
// ────────────────────────────────────────────────────────
// Revenue Exposure estimate. Last.fm playcount is the primary stream-volume
// signal (Spotify followers/popularity removed — Development Mode zeroes them).
// royaltyGap output shape is a payload contract — field names/types preserved;
// only the computation changed.
function estimateRoyaltyGap(catalog, lastfm, youtube) {
  // Edge C — guard a 0 / negative catalog age against divide-by-zero.
  const catalogYears = catalog.catalogAgeYears > 0 ? catalog.catalogAgeYears : 1;

  const lastfmPlays = (lastfm && lastfm.found && lastfm.playcount > 0) ? lastfm.playcount : 0;

  const estLifetimeStreams = Math.round(lastfmPlays * LASTFM_SAMPLING_MULTIPLIER);
  const estAnnualStreams   = Math.round(estLifetimeStreams / catalogYears);
  const estTotalRoyalties  = Math.round(estAnnualStreams * PER_STREAM_RATE);

  // estSpotifyRoyalties / estPROEarnings retained for payload-shape stability
  // (royaltyGap field names are a contract). Split ~5:1, summing to total —
  // neither is Spotify-derived any longer; the field name is legacy.
  const estPROEarnings      = Math.round(estTotalRoyalties / 6);
  const estSpotifyRoyalties = estTotalRoyalties - estPROEarnings;

  // Edge A — lastfmPlays 0 ⇒ estTotalRoyalties 0 ⇒ both bounds 0 (honest).
  const potentialGapLow  = Math.round(estTotalRoyalties * LOW_GAP_RATIO);
  const potentialGapHigh = Math.round(estTotalRoyalties * HIGH_GAP_RATIO);

  const ugcViews = youtube?.ugc?.estimatedViews || 0;
  const ugcUnmonetisedEst = Math.round(ugcViews * 0.0015);

  return {
    estAnnualStreams,
    estLifetimeStreams,
    estSpotifyRoyalties,
    estPROEarnings,
    estTotalRoyalties,
    potentialGapLow,
    potentialGapHigh,
    catalogYears,
    ugcUnmonetisedViews: ugcViews,
    ugcPotentialRevenue: ugcUnmonetisedEst,
    disclaimer: 'Estimates only. Based on streaming activity and platform coverage. Verify with your distributor and PRO.'
  };
}

// ────────────────────────────────────────────────────────
// GAP-BASED EXPOSURE
// Revenue exposure derived per detected backend gap — NOT from audience
// estimation (that is the deprecated royaltyGap model). Each indicator
// carries its own dollar band; the aggregate sums the quantified ones.
// Indicators with no defensible dollar math return null bounds and render
// as "Exposure pending validation". Descriptions are authored source-
// agnostic; the dashboard re-runs them through rewordObservation only as a
// safety pass. Per-incident ranges are INITIAL — see
// docs/gap-based-exposure-methodology.md, recalibrate post-beta.
function severityRank(s) {
  return s === 'HIGH' ? 0 : s === 'MED' ? 1 : 2;
}

function computeGapBasedExposure({ catalog, track, youtube, appleMusic, mb, flags }) {
  const indicators = [];
  const c  = catalog || {};
  const am = appleMusic || {};

  // Indicator 1 — Performance royalty routing: ISRC missing. Track-input
  // scans only — the engine has no per-release ISRC list for artist scans.
  if (track && !(track.external_ids && track.external_ids.isrc)) {
    indicators.push({
      id: 'isrc-missing', severity: 'HIGH',
      title: 'Performance royalty routing unverified',
      description: 'Release identifier missing on 1 release.',
      exposureLow: 50, exposureHigh: 300,
      methodology: 'PRO unmatched-performance recovery rate × release count',
    });
  }

  // Indicator 2 — Content ID gap: unmonetized UGC views. Gated on the engine's
  // own UGC-risk flag (youtube.ugc.contentIdRisk), which is true only when UGC
  // exists AND no official channel claims it. When an official channel is
  // present the content is already treated as covered — and getYouTube's raw
  // keyword search is unreliable for generic-name artists (name-collision view
  // inflation), so a raw view sum must not drive this indicator on its own.
  const ugcRisk  = !!(youtube && youtube.ugc && youtube.ugc.contentIdRisk);
  const ugcViews = Math.max(0, Math.round(Number(youtube && youtube.ugc && youtube.ugc.estimatedViews) || 0));
  if (ugcRisk && ugcViews > 100) {
    indicators.push({
      id: 'content-id-gap', severity: 'HIGH',
      title: 'Unmonetized content activity detected',
      description: `${ugcViews.toLocaleString('en-US')} user-generated views found with no verified channel claim.`,
      exposureLow:  Math.round((ugcViews / 1000) * 5),
      exposureHigh: Math.round((ugcViews / 1000) * 50),
      methodology: 'Video-network payout rate × UGC view volume / 1000',
    });
  }

  // Indicator 3 — Cross-network distribution gap.
  const matchRate = am.catalogComparison ? Number(am.catalogComparison.matchRate) : NaN;
  if (am.found === false) {
    indicators.push({
      id: 'distribution-gap', severity: 'MED',
      title: 'Cross-network distribution gap',
      description: 'Catalog not detected on a primary catalog network.',
      exposureLow: 200, exposureHigh: 500,
      methodology: 'Primary-network reach-loss band — catalog absent',
    });
  } else if (Number.isFinite(matchRate) && matchRate < 100) {
    const factor = Math.min(1, Math.max(0, (100 - matchRate) / 100));
    indicators.push({
      id: 'distribution-gap', severity: 'MED',
      title: 'Cross-network distribution gap',
      description: 'Catalog presence varies across primary catalog networks.',
      exposureLow:  Math.round(200 * factor),
      exposureHigh: Math.round(500 * factor),
      methodology: 'Primary-network reach-loss band × (1 − match rate)',
    });
  }

  // Indicator 4 — Publishing cross-reference gap.
  if (mb && mb.found === false) {
    indicators.push({
      id: 'publishing-xref-gap', severity: 'MED',
      title: 'Publishing cross-reference unavailable',
      description: 'Industry metadata registry not linked.',
      exposureLow: 50, exposureHigh: 250,
      methodology: 'Publishing match-rate degradation band — registry absent',
    });
  }

  // Indicator 5 — Catalog age: extended royalty verification.
  const ageYears     = Math.max(0, Number(c.catalogAgeYears) || 0);
  const releaseCount = Math.max(1, Number(c.totalReleases) || 0);
  if (ageYears > 5) {
    const units = ageYears * releaseCount;
    indicators.push({
      id: 'catalog-age', severity: 'MED',
      title: 'Extended royalty verification recommended',
      description: `Catalog active for ${ageYears} years across ${releaseCount} release${releaseCount === 1 ? '' : 's'}.`,
      exposureLow:  Math.round(3 * units),
      exposureHigh: Math.round(18 * units),
      methodology: 'Unaudited-activity accrual × (catalog age × release count)',
    });
  }

  // Pending-validation indicators — revenue-relevant, no defensible dollar
  // math. Derived from already-detected engine flags; null bounds.
  const flagText = (Array.isArray(flags) ? flags : [])
    .map(f => String((f && f.description) || '')).join(' | ').toLowerCase();
  if (/sync discoverability|wikipedia|editorial/.test(flagText)) {
    indicators.push({
      id: 'sync-discoverability', severity: 'LOW',
      title: 'Sync licensing discoverability limited',
      description: 'Editorial reference signals partial.',
      exposureLow: null, exposureHigh: null,
      methodology: 'Exposure pending validation',
    });
  }
  if (/genre/.test(flagText)) {
    indicators.push({
      id: 'genre-metadata-gap', severity: 'LOW',
      title: 'Genre metadata gap',
      description: 'Genre metadata incomplete across catalog networks.',
      exposureLow: null, exposureHigh: null,
      methodology: 'Exposure pending validation',
    });
  }

  indicators.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const displayed  = indicators.slice(0, 5);
  const quantified = displayed.filter(i => i.exposureLow !== null);

  return {
    indicators: displayed,
    aggregateLow:  quantified.length ? quantified.reduce((s, i) => s + i.exposureLow, 0)  : null,
    aggregateHigh: quantified.length ? quantified.reduce((s, i) => s + i.exposureHigh, 0) : null,
    pendingValidationCount: displayed.length - quantified.length,
    hasAnyGaps: displayed.length > 0,
  };
}

// ────────────────────────────────────────────────────────
// PRO GUIDE — country specific
// ────────────────────────────────────────────────────────
function getPROGuide(country) {
  const guides = {
    'Canada': {
      pro: 'SOCAN', url: 'https://www.socan.com',
      steps: ['Go to socan.com and click Join', 'Register as a songwriter and composer', 'Register all your works in the SOCAN repertoire', 'Submit cue sheets for any TV or film placements'],
      note: 'SOCAN collects performance royalties for streaming, radio, TV, and live performances across Canada and internationally through reciprocal agreements with GEMA, PRS, ASCAP and others.'
    },
    'United States': {
      pro: 'ASCAP or BMI', url: 'https://www.ascap.com',
      steps: ['Choose ASCAP (ascap.com) or BMI (bmi.com) — you can only join one', 'Register as a songwriter and publisher', 'Register all your works', 'Submit your Spotify artist URL when registering works'],
      note: 'ASCAP and BMI both collect performance royalties for US streaming, radio, TV and live performances. SESAC is invite-only.'
    },
    'United Kingdom': {
      pro: 'PRS for Music', url: 'https://www.prsformusic.com',
      steps: ['Go to prsformusic.com and click Join PRS', 'Register as a writer member', 'Register all your works in the PRS repertoire', 'Link your Spotify artist profile in your PRS account'],
      note: 'PRS for Music collects performance and mechanical royalties across the UK and internationally through reciprocal agreements.'
    },
    'Germany': {
      pro: 'GEMA', url: 'https://www.gema.de',
      steps: ['Go to gema.de and register as a member', 'Register as a composer and lyricist', 'Register all your works in the GEMA database', 'Submit documentation of any live performances or broadcast placements'],
      note: 'GEMA collects performance royalties across Germany and is one of the highest-paying PROs in the world.'
    },
    'France': {
      pro: 'SACEM', url: 'https://www.sacem.fr',
      steps: ['Go to sacem.fr and click Adhérer', 'Register as a composer, author or publisher', 'Register all your works', 'Submit any broadcast documentation'],
      note: 'SACEM collects performance royalties across France and has reciprocal agreements with most global PROs.'
    },
    'Australia': {
      pro: 'APRA AMCOS', url: 'https://www.apraamcos.com.au',
      steps: ['Go to apraamcos.com.au and click Join', 'Register as a songwriter', 'Register all your works', 'Link your streaming profiles'],
      note: 'APRA AMCOS collects performance and mechanical royalties across Australia and New Zealand.'
    },
    'Jamaica': {
      pro: 'JACAP', url: 'https://www.jacap.org',
      steps: ['Go to jacap.org and register as a member', 'Register as a composer or author', 'Register all your works in the JACAP database'],
      note: 'JACAP collects performance royalties across Jamaica and has reciprocal agreements with international PROs.'
    },
  };

  const defaultGuide = {
    pro: 'Your local PRO', url: 'https://www.cisac.org',
    steps: ["Find your country's PRO at cisac.org/find-a-society", 'Register as a songwriter and composer', 'Register all your works in the PRO database', 'Verify reciprocal agreements with SOCAN, ASCAP, GEMA and PRS'],
    note: 'CISAC is the international confederation of PROs. Their directory lists every PRO worldwide.'
  };

  if (!country) return defaultGuide;
  const match = Object.keys(guides).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return match ? { ...guides[match], country: match } : { ...defaultGuide, country };
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
    return { found: data.artists?.length > 0, artists: data.artists || [], topMatch: data.artists?.[0] || null, score: data.artists?.[0]?.score || 0 };
  } catch { return { found: false, artists: [] }; }
}

// ────────────────────────────────────────────────────────
// DEEZER
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://api.deezer.com/search/artist?q=${query}&limit=5`);
    if (!resp.ok) return { found: false, fans: 0 };
    const data = await resp.json();
    if (!data.data?.length) return { found: false, fans: 0 };
    const norm = s => s.toLowerCase().trim();
    const artist = data.data.find(a => norm(a.name) === norm(artistName)) || data.data[0];
    const detail = await fetch(`https://api.deezer.com/artist/${artist.id}`).then(r => r.ok ? r.json() : artist);
    return { found: true, fans: detail.nb_fan || 0, artistId: artist.id, name: artist.name, albums: detail.nb_album || 0 };
  } catch { return { found: false, fans: 0 }; }
}

// ────────────────────────────────────────────────────────
// AUDIODB
// ────────────────────────────────────────────────────────
async function getAudioDB(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${query}`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' }
    });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };
    const a = data.artists[0];
    return {
      found: true, name: a.strArtist, genre: a.strGenre || null, style: a.strStyle || null,
      mood: a.strMood || null, country: a.strCountry || null,
      biography: a.strBiographyEN ? a.strBiographyEN.substring(0, 400) : null,
      formed: a.intFormedYear || null, website: a.strWebsite || null, youtube: a.strYoutube || null,
      facebook: a.strFacebook || null, twitter: a.strTwitter || null, instagram: a.strInstagram || null,
    };
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
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)', 'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit' } }
    );
    if (!resp.ok) return { found: false, releases: 0 };
    const data = await resp.json();
    if (!data.results?.length) return { found: false, releases: 0 };
    const norm = s => s.toLowerCase().trim();
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || data.results[0];
    const relResp = await fetch(`https://api.discogs.com/artists/${artist.id}/releases?per_page=1`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' }
    });
    const relData = relResp.ok ? await relResp.json() : {};
    return { found: true, artistId: artist.id, name: artist.title, releases: relData.pagination?.items || 0, link: `https://www.discogs.com/artist/${artist.id}` };
  } catch { return { found: false, releases: 0 }; }
}

// ────────────────────────────────────────────────────────
// SOUNDCLOUD
// ────────────────────────────────────────────────────────
async function getSoundCloud(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://api.soundcloud.com/users?q=${query}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' }
    });
    if (!resp.ok) return { found: false, followers: 0 };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false, followers: 0 };
    const norm = s => s.toLowerCase().trim();
    const user = data.find(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)) || data[0];
    return { found: true, username: user.username, followers: user.followers_count || 0, tracks: user.track_count || 0, permalink: user.permalink_url || null };
  } catch { return { found: false, followers: 0 }; }
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
    const a = data.artist;
    return {
      found: true, name: a.name,
      playcount: parseInt(a.stats?.playcount || 0),
      listeners: parseInt(a.stats?.listeners || 0),
      tags: a.tags?.tag?.map(t => t.name) || [],
      bio: a.bio?.summary ? a.bio.summary.replace(/<[^>]+>/g, '').substring(0, 300) : null,
      url: a.url || null,
    };
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
      (r.description?.toLowerCase().includes('musician') || r.description?.toLowerCase().includes('singer') ||
       r.description?.toLowerCase().includes('rapper') || r.description?.toLowerCase().includes('artist') ||
       r.description?.toLowerCase().includes('band') || r.description?.toLowerCase().includes('producer'))
    ) || data.search.find(r => norm(r.label) === norm(artistName));
    if (!match) return { found: false };
    const wpResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    const wpData = wpResp.ok ? await wpResp.json() : null;
    return {
      found: true, wikidataId: match.id, description: match.description || null,
      wikipediaUrl: wpData?.content_urls?.desktop?.page || null,
      wikipediaFound: wpResp.ok && !wpData?.type?.includes('disambiguation'),
      extract: wpData?.extract?.substring(0, 300) || null,
    };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES — includes Apple Music module
// ────────────────────────────────────────────────────────
// Genre source of truth (Spotify demoted — Development Mode returns no genres).
// Spotify first so behaviour is preserved if Spotify access ever recovers, then
// Apple Music genreNames, then Last.fm tags — all already string arrays here.
// Empty only when every DSP genuinely lacks genre data (a real metadata gap).
function getEffectiveGenres(artist, appleMusic, lastfm) {
  if (artist?.genres?.length > 0) return artist.genres;
  if (appleMusic?.genres?.length > 0) return appleMusic.genres;
  if (lastfm?.tags?.length > 0) return lastfm.tags;
  return [];
}

// Audience-scale source of truth for the follower-threshold checks.
// Last.fm listeners, then Deezer fans, then Spotify followers.
function getEffectiveAudienceScale(lastfm, deezer, artist) {
  const lastfmListeners = Number(lastfm?.listeners) || 0;
  if (lastfmListeners > 0) return lastfmListeners;
  const deezerFans = Number(deezer?.fans) || 0;
  if (deezerFans > 0) return deezerFans;
  return Number(artist?.followers?.total) || 0;
}

function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!getEffectiveGenres(artist, appleMusic, lastfm).length) { metaScore -= 20; metaFlags.push('Genre metadata absent across major DSPs'); }
  if (!artist.images?.length) { metaScore -= 15; metaFlags.push('No artist images found across major DSPs'); }
  if (track && !track.external_ids?.isrc) { metaScore -= 30; metaFlags.push('ISRC signal not detected on this track'); }
  if (audiodb.found && audiodb.biography) metaScore += 5;
  if (wikidata.found) metaScore += 5;
  if (lastfm.found && lastfm.tags?.length) metaScore += 5;
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(Math.min(metaScore, 100), 10), flags: metaFlags };

  // MODULE B — Platform Coverage (now includes Apple Music)
  let covScore = 20;
  const covFlags = [];
  const checks = [
    { name: 'MusicBrainz', found: mb.found, pts: 10 },
    { name: 'Deezer', found: deezer.found, pts: 10 },
    { name: 'AudioDB', found: audiodb.found, pts: 8 },
    { name: 'Discogs', found: discogs.found, pts: 8 },
    { name: 'SoundCloud', found: soundcloud.found, pts: 7 },
    { name: 'Last.fm', found: lastfm.found, pts: 9 },
    { name: 'Wikipedia', found: wikidata.found, pts: 8 },
    { name: 'YouTube', found: youtube.found, pts: 10 },
    { name: 'Apple Music', found: appleMusic.found, pts: 10 },
  ];
  checks.forEach(p => {
    if (p.found) covScore += p.pts;
    else covFlags.push(`${p.name} presence not detected — coverage risk`);
  });
  if (getEffectiveAudienceScale(lastfm, deezer, artist) > 100) covScore += 10;
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  // MODULE C — Publishing Risk
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) { pubScore -= 35; pubFlags.push('ISRC not detected — performance royalty routing unverified'); }
  if (!getEffectiveGenres(artist, appleMusic, lastfm).length) { pubScore -= 15; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk'); }
  if (!mb.found) { pubScore -= 20; pubFlags.push('Not in MusicBrainz — publishing data cross-reference unavailable'); }
  if (catalog.catalogAgeYears > 5) { pubScore -= 10; pubFlags.push(`Catalog active for ${catalog.catalogAgeYears} years — extended royalty verification recommended`); }
  if (discogs.found && discogs.releases > 0) pubScore += 10;
  if (lastfm.found && lastfm.playcount > 10000) { pubScore -= 10; pubFlags.push('High Last.fm play count — significant streaming history detected, PRO verification critical'); }
  // Apple Music ISRC mismatch flag
  if (track?.external_ids?.isrc && appleMusic.isrcLookup && !appleMusic.isrcLookup.found) {
    pubScore -= 15;
    pubFlags.push('Track ISRC found on Spotify but not on Apple Music — cross-platform metadata discrepancy detected');
  }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  // MODULE D — Duplicate Detection
  // The Spotify popularity/followers ratio check was removed (Phase 3): it was
  // Spotify-only and dead under Development Mode degradation (popularity 0).
  let dupScore = 80;
  const dupFlags = [];
  if (mb.artists?.length > 1) { dupScore -= 20; dupFlags.push(`${mb.artists.length} MusicBrainz entries detected — possible duplicate profiles`); }
  if (!catalog.recentActivity && catalog.earliestYear) { dupScore -= 10; dupFlags.push(`No releases detected after ${catalog.latestYear} — catalog may be fragmented across accounts`); }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  // MODULE E — YouTube / UGC
  let ytScore = 10;
  const ytFlags = [];

  if (youtube.found) {
    if (youtube.officialChannel) {
      ytScore += 35;
      if (youtube.subscriberCount > 1000) ytScore += 10;
      if (youtube.totalOfficialViews > 10000) ytScore += 10;
    } else {
      ytFlags.push('No official YouTube channel detected — Content ID registration unverified');
    }
    if (youtube.contentIdVerified) {
      ytScore += 15;
    } else {
      ytFlags.push('Content ID monetisation status unverified');
    }
    if (youtube.ugc?.contentIdRisk) {
      ytScore -= 15;
      ytFlags.push(`${youtube.ugc.videoCount} user-uploaded video(s) detected with no official channel — potential unmonetised UGC exposure`);
    }
    // Gated on contentIdRisk: estimatedViews comes from getYouTube's free-text
    // keyword search, which name-collides for generic artist names. The flag
    // only fires when there is genuine UGC risk (no official channel).
    if (youtube.ugc?.contentIdRisk && youtube.ugc?.estimatedViews > 100000) {
      ytFlags.push(`~${youtube.ugc.estimatedViews.toLocaleString()} views detected on UGC videos — significant unmonetised revenue risk`);
    }
  } else {
    ytFlags.push('YouTube scan unavailable — API key not configured or search returned no results');
    if (audiodb.found && audiodb.youtube) ytScore += 20;
    if (soundcloud.found && soundcloud.tracks > 0) ytScore += 10;
  }

  if (lastfm.found && lastfm.listeners > 1000) ytScore += 5;
  modules.youtube = { name: 'YouTube / UGC', score: Math.max(Math.min(ytScore, 100), 10), flags: ytFlags };

  // MODULE F — Sync Readiness (now includes Apple Music signal)
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc) { syncScore += 20; }
  // Track-gated: only flag a missing ISRC when a track was actually scanned.
  // An artist-input scan has no track, so a missing track ISRC is not a gap.
  if (track && !track.external_ids?.isrc) { syncFlags.push('ISRC signal not detected'); }
  if (getEffectiveGenres(artist, appleMusic, lastfm).length) { syncScore += 15; } else syncFlags.push('Genre tags absent');
  if (mb.found) { syncScore += 10; } else syncFlags.push('Not in MusicBrainz catalog');
  if (wikidata.found) { syncScore += 15; } else syncFlags.push('No Wikipedia presence — sync discoverability risk');
  if (deezer.found) syncScore += 8;
  if (discogs.found) syncScore += 8;
  if (lastfm.found && lastfm.listeners > 500) syncScore += 10;
  if (audiodb.found && audiodb.genre) syncScore += 8;
  if (getEffectiveAudienceScale(lastfm, deezer, artist) > 1000) syncScore += 6;
  // Apple Music presence boosts sync score
  if (appleMusic.found) { syncScore += 10; } else syncFlags.push('Not found on Apple Music — cross-platform sync discoverability risk');
  if (appleMusic.catalogComparison?.matchRate < 70) {
    syncFlags.push(`Only ${appleMusic.catalogComparison.matchRate}% of top tracks matched on Apple Music — catalog gaps detected`);
  }
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

// ────────────────────────────────────────────────────────
// BUILD FLAGS — includes Apple Music flags
// ────────────────────────────────────────────────────────
function buildFlags(modules, artist, track, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic) {
  const flags = [];

  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40) severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });

  // Catalog age flag
  if (catalog.catalogAgeYears >= 10) {
    flags.push({ module: 'Publishing Risk', severity: 'high', description: `Catalog active for ${catalog.catalogAgeYears} years — extended period of potential royalty exposure detected` });
  } else if (catalog.catalogAgeYears >= 5) {
    flags.push({ module: 'Publishing Risk', severity: 'medium', description: `Catalog active for ${catalog.catalogAgeYears} years — multi-year royalty verification recommended` });
  }

  // YouTube UGC high-value flag — gated on contentIdRisk. estimatedViews is a
  // free-text keyword-search sum (name-collides for generic artist names), so
  // it only drives this flag when there is genuine UGC risk (no official
  // channel claiming the content).
  if (youtube.found && youtube.ugc?.contentIdRisk && youtube.ugc?.estimatedViews > 50000) {
    flags.push({
      module: 'YouTube / UGC',
      severity: 'high',
      description: `~${youtube.ugc.estimatedViews.toLocaleString()} unmonetised UGC views detected on YouTube — Content ID registration recommended immediately`
    });
  }

  // Apple Music catalog gap flag
  if (appleMusic.found && appleMusic.catalogComparison) {
    const { matchRate, notFound } = appleMusic.catalogComparison;
    if (matchRate < 50) {
      flags.push({
        module: 'Platform Coverage',
        severity: 'high',
        description: `${100 - matchRate}% of top Spotify tracks not found on Apple Music — significant catalog distribution gap detected`
      });
    } else if (matchRate < 80) {
      flags.push({
        module: 'Platform Coverage',
        severity: 'medium',
        description: `${notFound.length} top track(s) missing from Apple Music — distribution gaps may be limiting revenue`
      });
    }
  }

  // Apple Music not found flag
  if (!appleMusic.found) {
    flags.push({
      module: 'Platform Coverage',
      severity: 'medium',
      description: 'Artist not found on Apple Music — potential distribution gap across the second-largest music streaming platform'
    });
  }

  // Last.fm historical data flag
  if (lastfm.found && lastfm.playcount > 50000) {
    flags.push({ module: 'Platform Coverage', severity: 'high', description: `${lastfm.playcount.toLocaleString()} Last.fm plays detected — significant historical streaming activity warrants full PRO audit` });
  }

  // (No Wikipedia hand-built flag here — the Module F syncFlag
  // 'No Wikipedia presence — sync discoverability risk' is the canonical
  // source for this fact; a second hand-built flag was a visible duplicate.)

  // Positive signals
  if (discogs.found && discogs.releases > 5) {
    flags.push({ module: 'Duplicate Detection', severity: 'low', description: `${discogs.releases} releases found on Discogs — physical catalog confirmed` });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
