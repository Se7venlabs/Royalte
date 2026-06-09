// ─────────────────────────────────────────────────────────────────────────
// ROYALTÉ ENGINEERING PRINCIPLE (Constitutional)
// Royaltē verifies intelligence.
// Royaltē does not estimate intelligence.
// If a provider cannot be verified: UNVERIFIED.
// Every number must be traceable and defensible.
// ─────────────────────────────────────────────────────────────────────────
//
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
import { lookupByISRC, checkStorefrontAvailability, getArtistAlbums, getArtistSongs } from '../apple-music.js';

// ── Revenue Exposure estimation constants ───────────────────────────────────
// Last.fm playcount is the primary stream-volume signal (Spotify demoted —
// Development Mode no longer returns followers/popularity). Every value below
// is an INITIAL estimate — recalibrate post-launch against real beta data.
const LASTFM_SAMPLING_MULTIPLIER = 10;    // Last.fm scrobbles ≈ 10% of total streaming activity
const PER_STREAM_RATE            = 0.003; // USD per stream — industry-average premium-tier rate
const LOW_GAP_RATIO              = 0.05;  // minimum realistic share of royalties left unclaimed
const HIGH_GAP_RATIO             = 0.30;  // maximum realistic share of royalties left unclaimed

// ── Constitutional verification gates ───────────────────────────────────────
// Named constants here are the constitutional rule's residence. Every gate
// site (estimateRoyaltyGap, computeGapBasedExposure, future surfaces)
// references the constant by name — never inline. Toggle the constant to
// false ONLY through a formal Constitutional Board Review.
const YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL = true;

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

  // 2026-06-06 scan-engine-converge — single divergence fix.
  //
  // The Apple-input degraded path below was the entire architectural
  // divergence between Apple URL and Spotify URL scans. It fires when
  // resolveToArtist couldn't find a Spotify match for the Apple-resolved
  // artist name (strict exact-match from PR #103), causing the entire
  // universal enrichment pipeline to be skipped.
  //
  // Fix: before the short-circuit, attempt ISRC-based Spotify discovery.
  // ISRC is a globally-unique track identifier; every Apple song URL
  // carries one. Querying Spotify with q=isrc:XYZ returns the exact
  // corresponding Spotify track, whose artists[0].id is the same artist
  // with bit-perfect cross-platform identity guarantee.
  //
  // For artists like "Black Alternative" whose Spotify search ranking
  // doesn't surface them in top-5 for a generic-sounding query, ISRC
  // lookup succeeds where name search fails. Path A (full enrichment)
  // then runs identically to the Spotify URL pipeline.
  //
  // For genuinely Apple-only artists (no Spotify entry → ISRC search
  // returns no track), discovery returns null, the short-circuit fires
  // exactly as today, and PR #104/#105's Apple-only path stands.
  //
  // NO existing code path changes. The minimum-surface intervention is
  // populating resolved.artistId when cross-discovery succeeds.
  if (!resolved.artistId && resolved.trackIsrc) {
    const discovered = await discoverSpotifyByIsrc(resolved.trackIsrc, token);
    if (discovered) {
      // Name-verification gate — closes the featured-artist /
      // collaboration-order / duplicate-ISRC edge cases where
      // track.artists[0] from the ISRC lookup could be a co-credit
      // rather than the artist Apple resolved. Preserves PR #103's
      // "wrong artist never allowed" rule along this new pathway:
      // require the discovered Spotify artist's name to normalize-match
      // Apple's canonical. On mismatch (or any error fetching the
      // verification artist), fall through to the existing degraded
      // path with Apple identity preserved.
      try {
        const verifyArtist = await getSpotifyArtist(discovered, token);
        const norm = s => (s || '').toLowerCase().trim();
        if (verifyArtist && norm(verifyArtist.name) === norm(resolved.artistName)) {
          resolved.artistId = discovered;
        } else {
          console.log(`[scan] ISRC discovery name verification FAILED — Apple="${resolved.artistName}" vs Spotify="${verifyArtist?.name || '?'}". Falling through to degraded path.`);
        }
      } catch (verifyErr) {
        console.warn(`[scan] ISRC discovery verification fetch threw: ${verifyErr.message}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // 2026-06-07 LOCKED ARCHITECTURE: ONE PIPELINE, INDEPENDENT PROVIDERS
  // ─────────────────────────────────────────────────────────────────────
  // Apple is the canonical identity source. Spotify is optional enrichment.
  // After identity resolution, every non-Spotify provider runs unconditionally.
  // Spotify-specific calls remain conditional on having a Spotify ID; when
  // absent (Apple URL whose artist isn't on Spotify OR whose ISRC bridge
  // failed), a stub takes their place so the existing runModules / buildFlags
  // shape is preserved. Modules, score, flags reflect whatever ran.
  // ─────────────────────────────────────────────────────────────────────
  const warnings = [];

  // ── Spotify-specific fetches (conditional on Spotify ID) ──
  let artistData = null;
  let trackData = null;
  let albumsData = { items: [] };
  let spotifyTopTracks = [];

  if (resolved.artistId) {
    try {
      artistData = await getSpotifyArtist(resolved.artistId, token);
    } catch (artistErr) {
      console.warn('[run-scan] getSpotifyArtist failed — synthesizing stub:', artistErr.message);
      warnings.push({
        platform: 'spotify',
        stage: 'artist_fetch',
        reason: `Spotify artist fetch failed for ID ${resolved.artistId}: ${artistErr.message.replace(/^Spotify artist fetch failed:\s*/i, '')}`,
      });
    }
    if (resolved.resolvedFromType === 'track' && resolved.spotifyTrackId) {
      try { trackData = await getSpotifyTrack(resolved.spotifyTrackId, token); }
      catch { trackData = null; }
    }
    try { albumsData       = await getSpotifyAlbums(resolved.artistId, token); }    catch { albumsData = { items: [] }; }
    try { spotifyTopTracks = await getSpotifyTopTracks(resolved.artistId, token); } catch { spotifyTopTracks = []; }
  }
  // Stub when Spotify ID absent OR Spotify artist fetch failed. Same shape
  // getSpotifyArtist returns so runModules / buildFlags / rawResponse fields
  // see a uniform interface. followers=-1 is the existing "Spotify absent"
  // sentinel.
  if (!artistData) {
    artistData = {
      id: resolved.artistId || null,
      name: resolved.artistName,
      followers: { total: -1 },
      popularity: 0,
      genres: [],
      images: resolved.artistImage ? [{ url: resolved.artistImage }] : [],
      external_urls: resolved.artistUrl ? { spotify: resolved.artistUrl } : {},
    };
  }

  // Apple-locked canonical name (PR #103). Used as the query string for
  // every name-search-based enrichment source below.
  const artistName = resolved.artistName;

  // ── Universal enrichment fan-out (always runs, independent per source) ──
  // Apple Music uses ID-direct when appleArtistId known (Apple URL inputs)
  // — avoids strict name-search failure for the same artist whose URL we
  // just resolved. Other 8 providers name-search per PR #103 strict semantics.
  const appleIsrc = resolved.trackIsrc || trackData?.external_ids?.isrc || null;
  const appleMusicCall = resolved.appleArtistId
    ? getAppleMusic(artistName, appleIsrc, spotifyTopTracks, {
        appleArtistId: resolved.appleArtistId,
        storefront:    resolved.appleStorefront || 'us',
      })
    : getAppleMusic(artistName, appleIsrc, spotifyTopTracks);

  const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, youtubeData, appleMusicData] = await Promise.allSettled([
    getMusicBrainz(artistName),
    getDeezer(artistName),
    getAudioDB(artistName),
    getDiscogs(artistName),
    getSoundCloud(artistName),
    getLastFm(artistName),
    getWikidata(artistName),
    getYouTube(artistName),
    appleMusicCall,
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

  // ── Catalog: Spotify when available, Apple fallback ──
  // Same field shape in both cases so analyzeCatalog and downstream
  // consumers see one contract.
  let catalogData;
  if (albumsData.items && albumsData.items.length) {
    catalogData = analyzeCatalog(albumsData);
  } else {
    const appleAlbums = Array.isArray(appleMusicData.albums) ? appleMusicData.albums : [];
    const years = appleAlbums.map(a => parseInt(String(a.releaseDate || '').slice(0, 4), 10)).filter(y => !isNaN(y) && y > 1950);
    const earliestYear = years.length ? Math.min(...years) : null;
    const currentYear  = new Date().getUTCFullYear();
    catalogData = {
      totalReleases: appleAlbums.length,
      totalTracks:   appleAlbums.reduce((n, a) => n + (typeof a.trackCount === 'number' ? a.trackCount : 0), 0),
      earliestYear,
      latestYear:    years.length ? Math.max(...years) : null,
      catalogAgeYears: earliestYear ? (currentYear - earliestYear) : 0,
      estimatedAnnualStreams: 0,
      recentActivity: years.some(y => y >= currentYear - 2),
    };
  }
  const royaltyGap = estimateRoyaltyGap(catalogData, lastfmData, youtubeData);
  catalogData.estimatedAnnualStreams = royaltyGap.estAnnualStreams;
  const country = audioDbData.country || wikidataData.country || null;
  const proGuide = getPROGuide(country);

  // ── Modules / score / flags (run from whatever providers populated) ──
  const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);
  const moduleScores = Object.values(modules).filter(m => typeof m.score === 'number');
  const overallScore = moduleScores.length
    ? Math.round(moduleScores.reduce((a, m) => a + m.score, 0) / moduleScores.length)
    : 0;
  const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);
  const gapBasedExposure = computeGapBasedExposure({
    catalog: catalogData, track: trackData, youtube: youtubeData,
    appleMusic: appleMusicData, mb: mbData, flags,
  });

  // ── Single normalized rawResponse — same shape for Apple and Spotify URLs ──
  const rawResponse = {
    success: true,
    platform: inputType === 'apple' ? 'apple' : 'spotify',
    type: 'artist',
    artistName,
    artistId:           resolved.artistId || null,
    followers:          artistData.followers?.total ?? -1,
    popularity:         artistData.popularity || 0,
    genres:             artistData.genres || [],
    trackTitle:         trackData?.name || resolved.trackTitle || null,
    trackIsrc:          trackData?.external_ids?.isrc || resolved.trackIsrc || null,
    resolvedFrom:       resolved.resolvedFrom,
    resolvedFromType:   resolved.resolvedFromType,
    resolvedFromTitle:  resolved.resolvedFromTitle,
    canonicalTarget:    'artist',
    spotifyMatched:     !!resolved.artistId,
    artistUrl:          resolved.artistUrl || artistData.external_urls?.spotify || null,
    imageUrl:           resolved.artistImage || artistData.images?.[0]?.url || resolved.appleArtworkUrl || trackData?.album?.images?.[0]?.url || null,
    artistImageUrl:     resolved.artistImage || artistData.images?.[0]?.url || resolved.appleArtworkUrl || null,
    albumImageUrl:      trackData?.album?.images?.[0]?.url || null,
    appleArtworkUrl:    resolved.appleArtworkUrl || null,
    platforms: {
      spotify:     !!resolved.artistId,
      musicbrainz: !!mbData.found,
      deezer:      !!deezerData.found,
      audiodb:     !!audioDbData.found,
      discogs:     !!discogsData.found,
      soundcloud:  !!soundcloudData.found,
      lastfm:      !!lastfmData.found,
      wikipedia:   !!wikidataData.found,
      youtube:     !!youtubeData.found,
      appleMusic:  !!appleMusicData.found,
    },
    catalog: catalogData,
    royaltyGap,
    gapBasedExposure,
    proGuide,
    country,
    lastfmPlays:     lastfmData.playcount || 0,
    lastfmListeners: lastfmData.listeners || 0,
    wikipediaUrl:    wikidataData.wikipediaUrl || null,
    deezerFans:      deezerData.fans || 0,
    discogsReleases: discogsData.releases || 0,
    youtube:         youtubeData,
    appleMusic:      appleMusicData,
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
    const appleStorefront = appleResolved?.storefront || 'us';
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
    // 2026-06-09 ISRC-bridge fallback for Apple ARTIST URLs.
    // Spotify search ranks by popularity-weighted relevance — artists with
    // common-noun names ("Black Alternative") are buried below higher-ranked
    // results and never surface in the top-5 the strict matcher inspects.
    // Apple song URLs already cover this via resolved.trackIsrc + the bridge
    // at the top of resolveToArtist; ARTIST URLs have no trackIsrc, so we
    // pull the artist's full song list from Apple and walk every ISRC until
    // one resolves to a Spotify track whose artist name verifies against
    // the Apple canonical. Strict-exact-match-or-null preserved end-to-end.
    if (!spotifyArtist && appleArtistId) {
      try {
        const songs = await getArtistSongs(appleArtistId, appleStorefront, 25);
        const norm  = (s) => (s || '').toLowerCase().trim();
        for (const song of songs) {
          const candidateSpotifyId = await discoverSpotifyByIsrc(song.isrc, token);
          if (!candidateSpotifyId) continue;
          try {
            const verifyArtist = await getSpotifyArtist(candidateSpotifyId, token);
            if (verifyArtist && norm(verifyArtist.name) === norm(appleArtistName)) {
              spotifyArtist = verifyArtist;
              console.log(`[scan] Apple→Spotify ISRC bridge resolved "${appleArtistName}" via ISRC ${song.isrc}`);
              break;
            }
          } catch {
            continue;
          }
        }
        if (!spotifyArtist) {
          console.log(`[scan] Apple→Spotify ISRC bridge exhausted ${songs.length} ISRC candidates without verified match for "${appleArtistName}"`);
        }
      } catch (bridgeErr) {
        console.warn(`[scan] Apple→Spotify ISRC bridge threw: ${bridgeErr.message}`);
      }
    }
    if (spotifyArtist) {
      // 2026-06-05 identity-lock — when input is Apple, Apple's artistName
      // is authoritative for display + canonical identity. Spotify's ID is
      // captured for catalog enrichment (top tracks, full artist profile)
      // but Spotify's name does NOT overwrite Apple's. Under strict exact
      // matching above, the two names normalize to the same value, but
      // display casing/punctuation can differ — Apple wins.
      return {
        artistId:          spotifyArtist.id,
        artistName:        appleArtistName,
        artistImage:       appleArtwork || spotifyArtist.images?.[0]?.url || null,
        artistUrl:         spotifyArtist.external_urls?.spotify || null,
        spotifyMatched:    true,
        resolvedFrom:      'apple',
        resolvedFromType:  'external',
        resolvedFromTitle: appleArtistName,
        canonicalTarget:   'artist',
        appleArtworkUrl:   appleArtwork,
        appleArtistId,
        appleStorefront,
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
      appleStorefront,
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

// 2026-06-06 scan-engine-converge — cross-platform identifier discovery
// via ISRC. ISRC is a globally unique track identifier; every Apple Music
// song URL carries one. Querying Spotify with q=isrc:XYZ returns the
// exact corresponding Spotify track → track.artists[0].id is the artist
// on Spotify with bit-perfect cross-platform identity guarantee. This is
// the reliable bridge that succeeds where strict name search fails for
// artists whose Spotify search ranking doesn't surface them in top-5.
// Returns null on any failure — caller falls through to the existing
// Apple-only degraded path, no behavior change for true Apple-only artists.
async function discoverSpotifyByIsrc(isrc, token) {
  if (!isrc) return null;
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const track = data?.tracks?.items?.[0];
    const artistId = track?.artists?.[0]?.id || null;
    if (artistId) {
      console.log(`[scan] discovered Spotify artist ${artistId} via ISRC ${isrc} (track: "${track.name}")`);
    }
    return artistId;
  } catch (e) {
    console.warn(`[scan] discoverSpotifyByIsrc threw for ${isrc}: ${e.message}`);
    return null;
  }
}

// 2026-06-05 identity-lock — strict exact match only. If no Spotify artist
// is named EXACTLY the queried name (case-insensitive, trimmed), return null.
// The Apple-input degraded path at line 379 then takes over and preserves the
// Apple identity. The prior `|| items[0]` fallback silently substituted
// whichever artist Spotify ranked first for the query — the root cause of the
// "Black Alternative → ALT BLK ERA" production contamination.
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
    const match = items.find(a => norm(a.name) === norm(name)) || null;
    if (!match) {
      console.log(`[identity] Spotify returned ${items.length} candidates for "${name}" but no exact match — caller will fall through to degraded path`);
    }
    return match;
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
      return { name: attrs.name, artworkUrl, appleArtistId: meta.id, storefront: sf };
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
      return { name: attrs.artistName, artworkUrl, appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null, storefront: sf };
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
            return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId, trackTitle: attrs.name ?? null, trackIsrc: attrs.isrc ?? null, storefront: sf };
          }
        }
      }
      const r = await fetch(`${BASE}/catalog/${sf}/albums/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      const appleArtistId = data?.data?.[0]?.relationships?.artists?.data?.[0]?.id || null;
      return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork), appleArtistId, storefront: sf };
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
// 2026-06-07 scan-engine-converge Phase 2 — options.appleArtistId lets
// the unified pipeline call this with an Apple ID known from the URL
// (Apple URL inputs always have one from resolveAppleArtist). Skipping
// the name-search step removes the strict-exact-match failure mode for
// the same artist whose URL we just resolved. Spotify-URL callers (no
// known Apple ID) keep the existing name-search behavior.
async function getAppleMusic(artistName, isrc, spotifyTopTracks = [], options = {}) {
  try {
    const appleToken = generateAppleToken();
    const STOREFRONT = options.storefront || 'us';
    const BASE = 'https://api.music.apple.com/v1';

    const headers = { Authorization: `Bearer ${appleToken}` };

    let artistFound = false;
    let appleArtistId = null;
    let appleArtistUrl = null;
    let appleArtistGenres = [];
    let appleAlbumCount = 0;
    let appleAlbums = [];

    if (options.appleArtistId) {
      // ID-direct path: fetch artist record for url/genres, then drop
      // into the existing album-list fetch below.
      appleArtistId = options.appleArtistId;
      artistFound = true;
      try {
        const ar = await fetch(`${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}`, { headers });
        if (ar.ok) {
          const ad = await ar.json();
          const attrs = ad?.data?.[0]?.attributes;
          appleArtistUrl    = attrs?.url || null;
          appleArtistGenres = attrs?.genreNames || [];
        }
      } catch (e) {
        console.warn(`[apple-id] artist record fetch failed for ${appleArtistId}: ${e.message}`);
      }
    } else {
      // Name-search path (Spotify URL inputs without a known Apple ID).
      const artistQuery = encodeURIComponent(artistName);
      const artistResp = await fetch(
        `${BASE}/catalog/${STOREFRONT}/search?term=${artistQuery}&types=artists&limit=5`,
        { headers }
      );

      if (artistResp.ok) {
        const artistData = await artistResp.json();
        const artists = artistData?.results?.artists?.data || [];
        const norm = s => s.toLowerCase().trim();
        const match = artists.find(a => norm(a.attributes?.name) === norm(artistName)) || null;
        if (!match && artists.length) {
          console.log(`[identity] Apple returned ${artists.length} candidates for "${artistName}" but no exact match — skipping Apple Music enrichment`);
        }
        if (match) {
          artistFound = true;
          appleArtistId = match.id;
          appleArtistUrl = match.attributes?.url || null;
          appleArtistGenres = match.attributes?.genreNames || [];
        }
      }
    }

    if (artistFound && appleArtistId) {
      {

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
            // 2026-06-05 identity-lock — require BOTH track name AND artist
            // name to match. Previously the name-only check let a same-titled
            // track from a different artist count as a match, inflating the
            // catalog-comparison match rate.
            found = songs.some(s =>
              norm(s.attributes?.name) === norm(track.name) &&
              norm(s.attributes?.artistName || '') === norm(track.artistName || '')
            );
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
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=10&key=${apiKey}`
    );
    if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}` };
    const channelData = await channelResp.json();
    const channels = channelData.items || [];

    // ────────────────────────────────────────────────────────────────────
    // YOUTUBE CHANNEL MATCHING — Constitutional Rule
    // Current: strict exact channel name match only
    // Future: Verified Alias Table (curated per artist)
    // Future: Royaltē Alias Registry
    // Future: ContentID API integration
    // Until those exist: UNVERIFIED is correct behavior
    // Never guess. Silence > wrong data.
    // ────────────────────────────────────────────────────────────────────
    const norm = (s) => (s || '').toLowerCase().trim();
    const officialChannel = channels.find(
      (c) => norm(c.snippet.channelTitle) === norm(artistName)
    ) || null;

    if (!officialChannel) {
      return {
        found: false,
        availability: 'UNVERIFIED',
        reason: 'no_canonical_channel_match',
      };
    }

    const channelId = officialChannel.snippet.channelId || officialChannel.id?.channelId;
    if (!channelId) {
      return {
        found: false,
        availability: 'UNVERIFIED',
        reason: 'no_canonical_channel_id',
      };
    }

    // Verified channel — fetch stats. Free-text UGC keyword search removed
    // (would contaminate estimatedViews with unrelated keyword-matched
    // content; see PR #103 contamination class). UGC reintroduction
    // requires Verified Alias Table or ContentID API per Constitutional Rule.
    const statsResp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`
    );
    let subscriberCount = 0, officialViewCount = 0, officialVideoCount = 0;
    if (statsResp.ok) {
      const stats = (await statsResp.json()).items?.[0]?.statistics;
      if (stats) {
        subscriberCount    = parseInt(stats.subscriberCount || 0);
        officialViewCount  = parseInt(stats.viewCount       || 0);
        officialVideoCount = parseInt(stats.videoCount      || 0);
      }
    }

    return {
      found: true,
      availability: 'VERIFIED',
      officialChannel: {
        title:       officialChannel.snippet.channelTitle,
        channelId,
        subscribers: subscriberCount,
        totalViews:  officialViewCount,
        videoCount:  officialVideoCount,
      },
      contentIdVerified:  officialViewCount > 0,
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

  // Constitutional gate (YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL).
  // UGC dollar/view metrics are emittable only from a VERIFIED YouTube
  // channel. Otherwise: 0. With UGC discovery removed from getYouTube,
  // even verified channels produce 0 today — these fields will only
  // populate once a Verified Alias / ContentID pathway lands.
  const youtubeVerified = !!(youtube && youtube.found === true && youtube.availability === 'VERIFIED');
  const ugcViews = (YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL && !youtubeVerified)
    ? 0
    : (youtube?.ugc?.estimatedViews || 0);
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

  // Indicator 2 — Content ID gap: unmonetized UGC views.
  // Constitutional gate (YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL):
  // requires VERIFIED youtube channel AND the engine's own contentIdRisk
  // flag. UNVERIFIED youtube → indicator never fires. With UGC discovery
  // removed from getYouTube, this never fires today; it will only fire
  // once a Verified Alias / ContentID pathway repopulates the ugc block.
  const youtubeVerifiedExp = !!(youtube && youtube.found === true && youtube.availability === 'VERIFIED');
  const ugcRisk  = youtubeVerifiedExp && !!(youtube.ugc && youtube.ugc.contentIdRisk);
  const ugcViews = youtubeVerifiedExp
    ? Math.max(0, Math.round(Number(youtube?.ugc?.estimatedViews) || 0))
    : 0;
  if (YOUTUBE_REVENUE_REQUIRES_VERIFIED_CHANNEL && ugcRisk && ugcViews > 100) {
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
    const arr = data.artists || [];
    // 2026-06-05 identity-lock — require exact-name match for topMatch.
    // Prior `artists?.[0]` would surface MusicBrainz's top-scored candidate
    // regardless of whether the name matched.
    const norm = s => (s || '').toLowerCase().trim();
    const topMatch = arr.find(a => norm(a.name) === norm(artistName)) || null;
    if (!topMatch && arr.length) {
      console.log(`[identity] MusicBrainz returned ${arr.length} candidates for "${artistName}" but no exact match — skipping enrichment`);
    }
    return { found: !!topMatch, artists: arr, topMatch, score: topMatch?.score || 0 };
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
    // 2026-06-05 identity-lock — strict exact match only.
    const artist = data.data.find(a => norm(a.name) === norm(artistName)) || null;
    if (!artist) {
      console.log(`[identity] Deezer returned ${data.data.length} candidates for "${artistName}" but no exact match — skipping enrichment`);
      return { found: false, fans: 0 };
    }
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
    // 2026-06-05 identity-lock — AudioDB previously took data.artists[0]
    // with NO name check at all. Require exact match.
    const norm = s => (s || '').toLowerCase().trim();
    const a = data.artists.find(x => norm(x.strArtist) === norm(artistName)) || null;
    if (!a) {
      console.log(`[identity] AudioDB returned ${data.artists.length} candidates for "${artistName}" but no exact match — skipping enrichment`);
      return { found: false };
    }
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
    // 2026-06-05 identity-lock — strict exact match only.
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || null;
    if (!artist) {
      console.log(`[identity] Discogs returned ${data.results.length} candidates for "${artistName}" but no exact match — skipping enrichment`);
      return { found: false, releases: 0 };
    }
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
    // 2026-06-05 identity-lock — strict exact match (username OR full_name).
    const user = data.find(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)) || null;
    if (!user) {
      console.log(`[identity] SoundCloud returned ${data.length} candidates for "${artistName}" but no exact match — skipping enrichment`);
      return { found: false, followers: 0 };
    }
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
    // 2026-06-05 identity-lock — strict exact name match AND music-role
    // descriptor required. Prior fallback `data.search.find(label-only)`
    // would surface ANY Wikidata entity matching the label (footballer,
    // place name, etc.) when no musician matched.
    const match = data.search.find(r =>
      norm(r.label) === norm(artistName) &&
      (r.description?.toLowerCase().includes('musician') || r.description?.toLowerCase().includes('singer') ||
       r.description?.toLowerCase().includes('rapper') || r.description?.toLowerCase().includes('artist') ||
       r.description?.toLowerCase().includes('band') || r.description?.toLowerCase().includes('producer'))
    ) || null;
    if (!match) {
      console.log(`[identity] Wikidata returned ${data.search.length} candidates for "${artistName}" but no exact musician match — skipping enrichment`);
      return { found: false };
    }
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
