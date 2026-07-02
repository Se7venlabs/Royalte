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

// [RETIRED CANDIDATE] generateAppleToken — no longer called directly in run-scan.js.
// Kept in identity/apple.js for resolveAppleArtist. Remove when that module migrates to PAL.
// import { generateAppleToken } from '../apple-token.js';
// [RETIRED CANDIDATE] lookupByISRC, checkStorefrontAvailability, getArtistAlbums — no longer
// called in run-scan.js body. Transitively used by identity/apple.js only.
import { getArtistSongs } from '../apple-music.js';
import { lookupYouTubeChannelId } from './identity-graph.js';
// Phase 1, Stage 1 — Apple identity resolution extracted to a named adapter.
// Phase 3.3 — getAppleMusic() retired; acquisition now routes through PAL.
import {
  resolveAppleArtist,
  resolveAppleArtistName,
  // [RETIRED CANDIDATE] getAppleMusic — replaced by PAL acquisition below.
  // Remove after PAL migration verified + Board approval.
} from './identity/apple.js';
// Phase 3.3 (Apple Production Migration) — PAL Apple acquisition
import { acquireAppleEvidence, synthesizeAppleMusicCompat } from './apple-pal-acquisition.js';

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
// Returns { rawResponse, urlType, warnings, evidencePackages }:
//   - rawResponse      — raw legacy-shape audit payload (appleMusic = PAL-synthesized)
//   - urlType          — detectInputType(url), or 'apple' for degraded path
//   - warnings         — non-fatal degradation notices (empty on the happy path)
//   - evidencePackages — Apple EvidencePackages from PAL (for runRIE hybrid merge)
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

  // ── Universal enrichment fan-out ────────────────────────────────────────
  // Phase 3.3: Apple acquisition routes through PAL (parallel with all other providers).
  // PAL evidence flows into runRIE via the hybrid merge path; appleMusicData below
  // is a backward-compat synthesis for the V1 module system only.
  const appleIsrc = resolved.trackIsrc || trackData?.external_ids?.isrc || null;

  const [palSettled, mbSettled, deezerSettled, audioDbSettled, discogsSettled, soundcloudSettled, lastfmSettled, wikidataSettled, youtubeSettled] = await Promise.allSettled([
    acquireAppleEvidence({
      appleArtistId: resolved.appleArtistId ?? null,
      artistName,
      isrc: appleIsrc,
    }),
    getMusicBrainz(artistName),
    getDeezer(artistName),
    getAudioDB(artistName),
    getDiscogs(artistName),
    getSoundCloud(artistName),
    getLastFm(artistName),
    getWikidata(artistName),
    getYouTube(artistName),
  ]);

  const { evidencePackages = [], elapsedMs: palElapsedMs = 0 } =
    palSettled.status === 'fulfilled' ? palSettled.value : {};

  // [TRANSITIONAL] Legacy compat shape for V1 module system (runModules / buildFlags).
  // Retires when those consumers migrate to RIE Rule Library.
  const appleMusicData = synthesizeAppleMusicCompat(evidencePackages);

  const mbData         = mbSettled.status         === 'fulfilled' ? mbSettled.value         : { found: false };
  const deezerData     = deezerSettled.status     === 'fulfilled' ? deezerSettled.value     : { found: false };
  const audioDbData    = audioDbSettled.status    === 'fulfilled' ? audioDbSettled.value    : { found: false };
  const discogsData    = discogsSettled.status    === 'fulfilled' ? discogsSettled.value    : { found: false };
  const soundcloudData = soundcloudSettled.status === 'fulfilled' ? soundcloudSettled.value : { found: false };
  const lastfmData     = lastfmSettled.status     === 'fulfilled' ? lastfmSettled.value     : { found: false };
  const wikidataData   = wikidataSettled.status   === 'fulfilled' ? wikidataSettled.value   : { found: false };
  const youtubeData    = youtubeSettled.status    === 'fulfilled' ? youtubeSettled.value    : { found: false };

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
    let appleSingles = 0, appleEps = 0, appleAlbumCount = 0, appleTotalTracks = 0;
    for (const a of appleAlbums) {
      const tc = typeof a.trackCount === 'number' ? a.trackCount : 7;
      appleTotalTracks += tc;
      if (tc === 1) appleSingles++;
      else if (tc <= 6) appleEps++;
      else appleAlbumCount++;
    }
    catalogData = {
      totalReleases:   appleAlbums.length,
      singlesCount:    appleSingles,
      epsCount:        appleEps,
      albumsCount:     appleAlbumCount,
      featuresCount:   0,    // Apple Music doesn't surface appears_on
      totalTracks:     appleTotalTracks,
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
    // Phase 3.3: PAL-synthesized artwork fills the gap for Spotify-URL inputs
    // (resolveAppleArtist not called, so resolved.appleArtworkUrl is null).
    appleArtworkUrl:    resolved.appleArtworkUrl || appleMusicData.artwork || null,
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
    deezer:          deezerData,
    youtube:         youtubeData,
    appleMusic:      appleMusicData,
    overallScore,
    modules,
    flags,
    flagCount: flags.length,
    previewFlags: flags.slice(0, 2),
    scannedAt: new Date().toISOString(),
  };

  return { rawResponse, urlType: inputType, warnings, evidencePackages };
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
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single,appears_on`,
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

// Apple resolution + cross-platform enrichment now live in
// api/_lib/identity/apple.js (imported at the top of this file). The
// functions extracted: resolveAppleArtist, resolveAppleArtistName,
// parseAppleMusicUrl, getAppleMusic — byte-identical bodies, same
// dependencies (generateAppleToken, lookupByISRC,
// checkStorefrontAvailability), same return shapes. See Phase 1
// Stage 1 brief for the rationale.

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

    const norm = (s) => (s || '').toLowerCase().trim();

    // ────────────────────────────────────────────────────────────────────
    // YOUTUBE CHANNEL MATCHING — Constitutional Rule
    // Identity resolution is delegated to api/_lib/identity-graph.js
    // (Royaltē Identity Graph™). The engine reads from the Graph; the
    // engine never owns artist-specific records. Adding a verified
    // artist is a pure Identity Graph change — no engine code change.
    //   Step 1: Royaltē Identity Graph™ lookup (read-only).
    //   Step 2: Strict exact channel-title match (fallback for artists
    //           not in the Graph whose channel title verbatim equals
    //           their canonical name).
    // No substring, no description heuristic, no `|| channels[0]`.
    // Unknown identity + no exact match → UNVERIFIED. Silence > wrong data.
    // Future: ContentID API integration for UGC monetization signals.
    // ────────────────────────────────────────────────────────────────────

    // (1) Royaltē Identity Graph™ read.
    let channelId     = lookupYouTubeChannelId(artistName);
    let channelTitle  = null;
    let channelSource = channelId ? 'royalte_identity_graph' : null;

    // (2) Fallback — strict exact channel-title match via YouTube search.
    if (!channelId) {
      const query = encodeURIComponent(artistName);
      const channelResp = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=10&key=${apiKey}`
      );
      if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}` };
      const channelData = await channelResp.json();
      const channels = channelData.items || [];
      const officialChannel = channels.find(
        (c) => norm(c.snippet.channelTitle) === norm(artistName)
      ) || null;
      if (!officialChannel) {
        return { found: false, availability: 'UNVERIFIED', reason: 'no_canonical_channel_match' };
      }
      channelId     = officialChannel.snippet.channelId || officialChannel.id?.channelId;
      channelTitle  = officialChannel.snippet.channelTitle;
      channelSource = 'strict_name_match';
    }
    if (!channelId) {
      return { found: false, availability: 'UNVERIFIED', reason: 'no_canonical_channel_id' };
    }

    // (3) Channel stats fetch — by channelId, identical for both paths.
    // Free-text UGC keyword search remains removed (contamination class
    // banned by PR #103). UGC reintroduction requires ContentID API per
    // Constitutional Rule.
    const statsResp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`
    );
    let subscriberCount = 0, officialViewCount = 0, officialVideoCount = 0;
    if (statsResp.ok) {
      const data = await statsResp.json();
      const item = data.items?.[0];
      const stats = item?.statistics;
      if (stats) {
        subscriberCount    = parseInt(stats.subscriberCount || 0);
        officialViewCount  = parseInt(stats.viewCount       || 0);
        officialVideoCount = parseInt(stats.videoCount      || 0);
      }
      // Identity-Graph path doesn't know the title until we ask YouTube
      // — fetched authoritatively here so the Graph never stores a name
      // that can rot when YouTube renames the channel.
      if (!channelTitle && item?.snippet?.title) channelTitle = item.snippet.title;
    }

    return {
      found: true,
      availability: 'VERIFIED',
      officialChannel: {
        title:       channelTitle,
        channelId,
        subscribers: subscriberCount,
        totalViews:  officialViewCount,
        videoCount:  officialVideoCount,
        verifiedVia: channelSource,
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
  if (!albums.length) return { totalReleases: 0, singlesCount: 0, epsCount: 0, albumsCount: 0, featuresCount: 0, totalTracks: 0, earliestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0 };

  // Separate owned releases from appearances (appears_on).
  // album_group is the artist-relative classification; album_type is the
  // release's inherent type. Use album_group as the primary signal since
  // it distinguishes "artist's own album" from "featured on".
  let singlesCount = 0, epsCount = 0, albumsCount = 0, featuresCount = 0, totalTracks = 0;
  const ownedAlbums = [];
  for (const a of albums) {
    const group = (a.album_group || '').toLowerCase();
    if (group === 'appears_on') { featuresCount++; continue; }
    ownedAlbums.push(a);
    const tc = typeof a.total_tracks === 'number' ? a.total_tracks : 1;
    totalTracks += tc;
    if (tc === 1) singlesCount++;
    else if (tc <= 6) epsCount++;
    else albumsCount++;
  }

  const years = ownedAlbums
    .map(a => parseInt(a.release_date?.substring(0, 4)))
    .filter(y => !isNaN(y) && y > 1950);

  const earliestYear = years.length ? Math.min(...years) : null;
  const currentYear = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;

  return {
    totalReleases: ownedAlbums.length,
    singlesCount,
    epsCount,
    albumsCount,
    featuresCount,
    totalTracks,
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
// Board Directive 2026-06-24: full enrichment — artist detail,
// complete album list, top tracks (ISRCs + previews), all artwork.
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

    // Fetch artist detail, full album list, and top tracks in parallel.
    const [detailRes, albumsRes, topRes] = await Promise.allSettled([
      fetch(`https://api.deezer.com/artist/${artist.id}`),
      fetch(`https://api.deezer.com/artist/${artist.id}/albums?limit=50`),
      fetch(`https://api.deezer.com/artist/${artist.id}/top?limit=50`),
    ]);

    const detail = detailRes.status === 'fulfilled' && detailRes.value.ok
      ? await detailRes.value.json().catch(() => artist)
      : artist;

    const albumsBody = albumsRes.status === 'fulfilled' && albumsRes.value.ok
      ? await albumsRes.value.json().catch(() => null)
      : null;

    const topBody = topRes.status === 'fulfilled' && topRes.value.ok
      ? await topRes.value.json().catch(() => null)
      : null;

    const albums    = Array.isArray(albumsBody?.data) ? albumsBody.data : [];
    const topTracks = Array.isArray(topBody?.data)    ? topBody.data    : [];

    // Collect unique genres from album genre tags.
    const genreSet = new Set();
    for (const album of albums) {
      if (Array.isArray(album.genres?.data)) {
        for (const g of album.genres.data) { if (g.name) genreSet.add(g.name); }
      }
    }

    return {
      found: true,
      // Identity
      artistId:       detail.id       ?? artist.id,
      name:           detail.name     ?? artist.name,
      link:           detail.link     ?? null,
      share:          detail.share    ?? null,
      // Artwork — all sizes Deezer exposes
      picture:        detail.picture        ?? null,
      picture_small:  detail.picture_small  ?? null,
      picture_medium: detail.picture_medium ?? null,
      picture_big:    detail.picture_big    ?? null,
      picture_xl:     detail.picture_xl     ?? null,
      // Metrics
      fans:      detail.nb_fan   ?? artist.nb_fan   ?? 0,
      nb_album:  detail.nb_album ?? artist.nb_album ?? 0,
      radio:     !!detail.radio,
      tracklist: detail.tracklist ?? null,
      type:      detail.type     ?? 'artist',
      // Enriched catalog
      albums,
      topTracks,
      genres: [...genreSet],
    };
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
