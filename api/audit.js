// Royalte Audit API — /api/audit.js
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata + YouTube + Apple Music + Tidal
// Features: Royalty gap estimate, catalog age analysis, country PRO guide, real YouTube UGC detection, Apple Music catalog comparison,
//           Ownership & Publishing Verification (ASCAP/BMI Songview guidance)
// URL Resolution: Accepts artist, track, and album URLs — resolves to artist-level scan automatically
//
// ── CANONICAL OUTPUT CONTRACT ──
// runAudit() returns a payload conforming to AUDIT_RESPONSE_SCHEMA (api/schema/auditResponse.js).
// The raw engine output is transformed by normalizeAuditResponse() and validated before return.
// All renderers (web preview, brand PDF, print PDF) consume THIS SHAPE ONLY.

import { generateAppleToken } from './apple-token.js';
import { getTidalAccessToken } from './tidal-token.js';
import { extractIp, checkBlocked, checkRateLimit, recordViolation } from './_lib/rate-limit.js';
import {
  evaluateOwnership,
  evaluateOwnershipBatch,
  renderOwnershipSection,
} from '../ownership-verification.js';
import { normalizeAuditResponse } from './lib/normalizeAuditResponse.js';
import { validateAuditResponse, AuditSchemaError } from './schema/auditResponse.js';

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUDIT FUNCTION — reusable, no HTTP coupling.
// Returns: { ok: true, payload: CanonicalAuditResponse } on success
//          { ok: false, status: 400|500, error, detail? } on failure
// Used by: this file's HTTP handler, AND api/process-audit.js
// ─────────────────────────────────────────────────────────────────────────────
export async function runAudit(url, urlTypeHint) {
  if (!url) {
    return { ok: false, status: 400, error: 'No URL provided' };
  }

  try {
    // ── STEP 1: Parse and resolve URL to artist-level ──
    const resolved = await resolveUrl(url, urlTypeHint);
    if (!resolved) {
      return { ok: false, status: 400, error: 'Invalid URL. Paste a Spotify or Apple Music artist, song, or album link.' };
    }

    const token = await getSpotifyToken();
    let artistData, trackData;
    let appleMusicSource = null; // populated only when URL was Apple Music

    if (resolved.platform === 'apple') {
      const appleArtistName = resolved.artistName;
      if (!appleArtistName) {
        return { ok: false, status: 400, error: 'Could not resolve Apple Music link. Try a Spotify link instead.' };
      }

      const norm = s => (s || '').toLowerCase().trim();
      let spotifyMatchArtist = null;
      let spotifyMatchTrack = null;
      let spotifyLookupTier = null;

      // Tier 1 — Apple ISRC → Spotify track
      if (resolved.isrc) {
        try {
          const isrcResp = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent('isrc:' + resolved.isrc)}&type=track&limit=1`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (isrcResp.ok) {
            const isrcData = await isrcResp.json();
            const hit = isrcData.tracks?.items?.[0];
            if (hit?.artists?.[0]?.id) {
              spotifyMatchTrack = hit;
              spotifyMatchArtist = await getSpotifyArtist(hit.artists[0].id, token);
              spotifyLookupTier = 'isrc';
            }
          }
        } catch (e) {
          console.warn('[audit] Apple→Spotify ISRC lookup failed (falling back):', e.message);
        }
      }

      // Tier 2 — fallback: artist-name search
      if (!spotifyMatchArtist) {
        const searchResp = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(appleArtistName)}&type=artist&limit=5`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!searchResp.ok) throw new Error('Spotify search failed: ' + searchResp.status);
        const searchData = await searchResp.json();
        const stubMatch = searchData.artists?.items?.find(a => norm(a.name) === norm(appleArtistName)) || searchData.artists?.items?.[0];
        if (!stubMatch) {
          return { ok: false, status: 400, error: `Could not find "${appleArtistName}" on Spotify. Try pasting their Spotify link directly.` };
        }
        spotifyMatchArtist = stubMatch;
        spotifyLookupTier = 'artist_name';
      }

      artistData = spotifyMatchArtist;
      trackData = spotifyMatchTrack;
      appleMusicSource = {
        albumName: resolved.albumName || null,
        trackName: resolved.trackName || null,
        artistName: appleArtistName,
        originalType: resolved.originalType,
        isrc: resolved.isrc || null,
        durationMs: resolved.durationMs || null,
        spotifyLookupTier,
      };
    } else {
      artistData = await getSpotifyArtist(resolved.artistId, token);
      trackData = resolved.trackData || null;
    }

    // ── DIAGNOSTIC LOG (temporary — remove after zeros-for-followers bug is fixed) ──
    console.log('[audit:diag] artistData keys:', Object.keys(artistData || {}));
    console.log('[audit:diag] artistData sample:', JSON.stringify({
      id: artistData?.id,
      name: artistData?.name,
      followers: artistData?.followers,
      popularity: artistData?.popularity,
      genres: artistData?.genres,
      hasImages: Array.isArray(artistData?.images) ? artistData.images.length : 'n/a',
      type: artistData?.type,
    }));

    const artistId = artistData.id;
    const artistName = artistData.name;

    const albumsData = await getSpotifyAlbums(artistId, token);
    const spotifyTopTracks = await getSpotifyTopTracks(artistId, token);

    // ── ISRC HOIST ──
    if (!trackData && spotifyTopTracks && spotifyTopTracks.length > 0) {
      const topWithIsrc = spotifyTopTracks.find(t => t.isrc) || spotifyTopTracks[0];
      if (topWithIsrc && topWithIsrc.isrc) {
        trackData = {
          name: topWithIsrc.name,
          external_ids: { isrc: topWithIsrc.isrc },
          duration_ms: topWithIsrc.durationMs || null,
          artists: [{ name: topWithIsrc.artistName || artistName }],
          _source: 'top_tracks_hoist',
        };
      }
    }

    // ── LAYERED ISRC FALLBACK ──
    if (trackData && !trackData.external_ids?.isrc) {
      const wantedName = (trackData.name || appleMusicSource?.trackName || '').toLowerCase().trim();

      if (wantedName && spotifyTopTracks && spotifyTopTracks.length > 0) {
        const nameMatch = spotifyTopTracks.find(t => (t.name || '').toLowerCase().trim() === wantedName && t.isrc);
        if (nameMatch) {
          trackData.external_ids = { ...(trackData.external_ids || {}), isrc: nameMatch.isrc };
          trackData._isrcFallback = 'spotify_top_tracks_name_match';
        }
      }

      if (!trackData.external_ids?.isrc && resolved.platform === 'apple' && wantedName) {
        try {
          const q = encodeURIComponent(`track:"${trackData.name || appleMusicSource?.trackName}" artist:"${artistName}"`);
          const srchResp = await fetch(
            `https://api.spotify.com/v1/search?q=${q}&type=track&limit=5`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          );
          if (srchResp.ok) {
            const srchData = await srchResp.json();
            const hits = srchData.tracks?.items || [];
            const norm = s => (s || '').toLowerCase().trim();
            const hit = hits.find(h => norm(h.name) === wantedName && h.external_ids?.isrc);
            if (hit) {
              trackData.external_ids = { ...(trackData.external_ids || {}), isrc: hit.external_ids.isrc };
              trackData.duration_ms = trackData.duration_ms || hit.duration_ms || null;
              trackData._isrcFallback = 'spotify_direct_search_apple_origin';
            }
          }
        } catch (e) {
          console.warn('[audit] Spotify direct-search fallback failed:', e.message);
        }
      }
    }

    // All platforms in parallel
    const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, youtubeData, appleMusicData, tidalData] = await Promise.allSettled([
      getMusicBrainz(artistName),
      getDeezer(artistName),
      getAudioDB(artistName),
      getDiscogs(artistName),
      getSoundCloud(artistName),
      getLastFm(artistName),
      getWikidata(artistName),
      getYouTube(artistName),
      getAppleMusic(artistName, trackData?.external_ids?.isrc || null, spotifyTopTracks, resolved.storefront || 'us'),
      getTidal(artistName),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

    const catalogData = analyzeCatalog(albumsData, artistData);
    const royaltyGap = estimateRoyaltyGap(artistData, catalogData, lastfmData, youtubeData);
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);

    const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData, tidalData);

    // ── AUDIT COVERAGE ──
    let appleVerification;
    if (trackData?.external_ids?.isrc || trackData?.name) {
      appleVerification = await verifyAppleMusicMatch({
        isrc: trackData?.external_ids?.isrc || null,
        trackName: trackData?.name || null,
        artistName,
        durationMs: trackData?.duration_ms || null,
        storefront: resolved.storefront || 'us',
      });
    } else if (spotifyTopTracks && spotifyTopTracks.length > 0) {
      const top = spotifyTopTracks[0];
      appleVerification = await verifyAppleMusicMatch({
        isrc: top.isrc,
        trackName: top.name,
        artistName: top.artistName || artistName,
        durationMs: top.durationMs,
        storefront: resolved.storefront || 'us',
      });
    } else {
      appleVerification = appleMusicData?.error
        ? { status: 'Not Confirmed', tier: 'artist_api_fail' }
        : (appleMusicData?.found ? { status: 'Verified', tier: 'artist_search' } : { status: 'Not Connected', tier: 'no_artist_match' });
    }

    const spotifyStatus = 'Verified';
    const appleStatus = appleVerification.status;

    // ── OWNERSHIP & PUBLISHING VERIFICATION ──
    const statusToConfidence = (s) => {
      if (s === 'Verified') return 'HIGH';
      if (s === 'Not Confirmed') return 'AUTH_UNAVAILABLE';
      return 'LOW';
    };
    const spotifyConfidence = statusToConfidence(spotifyStatus);
    const appleConfidence   = statusToConfidence(appleStatus);

    let ownershipVerification;
    if (resolved.originalType === 'artist' && spotifyTopTracks && spotifyTopTracks.length > 0) {
      ownershipVerification = evaluateOwnershipBatch(
        spotifyTopTracks.slice(0, 5).map(t => ({
          artist_name: t.artistName || artistName,
          track_name: t.name,
          isrc: t.isrc || null,
          spotify_confidence: spotifyConfidence,
          apple_confidence: appleConfidence,
          ownership_data: null,
        })),
        artistName
      );
    } else {
      ownershipVerification = evaluateOwnership({
        artist_name: artistName,
        track_name: trackData?.name || appleMusicSource?.trackName || artistName,
        album_name: appleMusicSource?.albumName || null,
        isrc: trackData?.external_ids?.isrc || null,
        spotify_confidence: spotifyConfidence,
        apple_confidence: appleConfidence,
        ownership_data: null,
      });
    }
    const ownershipVerificationRender = renderOwnershipSection(ownershipVerification);

    // Overall score (computed here, then normalizer may refine)
    const moduleAvg = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );
    const overallScore = Math.max(0, Math.min(100, moduleAvg + (ownershipVerification.score_impact || 0)));

    const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData, tidalData, ownershipVerification);

    const auditCoverage = {
      spotify:       { status: spotifyStatus,   tier: null },
      appleMusic:    { status: appleStatus,     tier: appleVerification.tier || null },
      publishing:    { status: 'Not Confirmed', tier: null },
      soundExchange: { status: 'Not Confirmed', tier: null },
    };

    const isrcPresent = !!(trackData?.external_ids?.isrc);
    const isrcSource = !trackData ? 'none'
      : !isrcPresent ? 'none'
      : trackData._isrcFallback ? trackData._isrcFallback
      : trackData._source === 'top_tracks_hoist' ? 'top_tracks_hoist'
      : resolved.platform === 'apple' && trackData.external_ids?.isrc ? 'apple_native'
      : resolved.originalType === 'album' ? 'album_first_track'
      : 'track_direct';

    // ── RAW ENGINE OUTPUT — fed into normalizer, NOT returned directly ──
    const rawEngineOutput = {
      _originalUrl: url,
      _storefront: resolved.storefront || null,
      platform: resolved.platform,
      sourcePlatform: resolved.platform === 'apple' ? 'apple_music' : 'spotify',
      type: resolved.originalType,
      resolvedFrom: resolved.resolvedFrom || null,
      artistName,
      artistId: artistData.id,
      followers: artistData.followers?.total || 0,
      popularity: artistData.popularity || 0,
      genres: artistData.genres || [],
      trackTitle: trackData?.name || null,
      trackIsrc: trackData?.external_ids?.isrc || null,
      trackIsrcSource: isrcPresent ? isrcSource : null,
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
        tidal: tidalData.found,
      },
      catalog: catalogData,
      royaltyGap,
      proGuide,
      country,
      lastfmPlays: lastfmData.playcount || 0,
      lastfmListeners: lastfmData.listeners || 0,
      wikipediaUrl: wikidataData.wikipediaUrl || null,
      deezerFans: deezerData.fans || 0,
      tidalPopularity: tidalData.popularity || 0,
      discogsReleases: discogsData.releases || 0,
      youtube: youtubeData,
      appleMusic: appleMusicData,
      appleMusicSource,
      overallScore,
      modules,
      flags,
      scannedAt: new Date().toISOString(),
      auditCoverage,
      ownershipVerification,
      ownershipVerificationRender,
    };

    // ── NORMALIZE → VALIDATE → RETURN ──
    // Any schema drift will throw AuditSchemaError here, BEFORE the payload
    // leaves the engine. Renderers never see a malformed response.
    let canonical;
    try {
      canonical = normalizeAuditResponse(rawEngineOutput);
      validateAuditResponse(canonical);
    } catch (e) {
      if (e instanceof AuditSchemaError) {
        console.error('[runAudit] Canonical schema validation failed:', e.message);
        return { ok: false, status: 500, error: 'Audit output failed internal validation', detail: e.message };
      }
      console.error('[runAudit] Normalization error:', e);
      return { ok: false, status: 500, error: 'Audit normalization failed', detail: e.message };
    }

    return { ok: true, payload: canonical };

  } catch (err) {
    console.error('[runAudit] error:', err);
    return { ok: false, status: 500, error: 'Audit failed. Please check the link and try again.', detail: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLER — thin wrapper around runAudit(). Preserves API contract.
// ─────────────────────────────────────────────────────────────────────────────
const AUDIT_RATE_LIMITS = {
  burst: { max: 3 },
  hour:  { max: 20 },
  day:   { max: 100 },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ip = extractIp(req);

  const blockStatus = await checkBlocked(ip);
  if (blockStatus.blocked) {
    const retryAfter = Math.max(1, Math.ceil((new Date(blockStatus.expiresAt).getTime() - Date.now()) / 1000));
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  }

  const rl = await checkRateLimit(ip, 'audit', AUDIT_RATE_LIMITS);
  if (!rl.allowed) {
    res.setHeader('Retry-After', rl.retryAfter || 60);
    recordViolation(ip, 'audit', rl.reason).catch(() => {});
    return res.status(429).json({ error: 'Too many requests', retryAfter: rl.retryAfter || 60 });
  }

  const { url, type: urlTypeHint } = req.query;
  const result = await runAudit(url, urlTypeHint);

  if (result.ok) return res.status(200).json(result.payload);

  const body = { error: result.error };
  if (result.detail) body.detail = result.detail;
  return res.status(result.status || 500).json(body);
}

// ═════════════════════════════════════════════════════════════════════════════
// BELOW THIS LINE: UNCHANGED FROM PREVIOUS VERSION
// (URL resolvers, platform fetchers, module scorers, flag builder, PRO guide)
// ═════════════════════════════════════════════════════════════════════════════

async function resolveUrl(url, typeHint) {
  try {
    const u = new URL(url);

    if (u.hostname.includes('spotify.com')) {
      const parts = u.pathname.split('/').filter(Boolean);
      const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track' || p === 'album');
      if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
      const type = parts[typeIdx];
      const id = parts[typeIdx + 1].split('?')[0];
      if (type === 'artist') {
        return { platform: 'spotify', originalType: 'artist', artistId: id, resolvedFrom: 'artist' };
      }
      const token = await getSpotifyToken();
      if (type === 'track') return await retryOnce(() => resolveSpotifyTrack(id, token));
      if (type === 'album') return await retryOnce(() => resolveSpotifyAlbum(id, token));
      return null;
    }

    if (u.hostname.includes('music.apple.com')) {
      const appleToken = generateAppleToken();
      const parsed = parseAppleMusicUrl(url);
      const storefront = parseAppleStorefront(url);

      if (parsed.type === 'artist') {
        const artistName = await retryOnce(() => resolveAppleMusicArtist(parsed.artistId, appleToken, storefront));
        return { platform: 'apple', originalType: 'artist', artistName, resolvedFrom: 'artist', storefront };
      }
      if (parsed.type === 'track') {
        const meta = await retryOnce(() => resolveAppleMusicSong(parsed.trackId, appleToken, storefront));
        return { platform: 'apple', originalType: 'track', ...meta, resolvedFrom: 'track', storefront };
      }
      if (parsed.type === 'album') {
        const meta = await retryOnce(() => resolveAppleMusicAlbumToArtist(parsed.albumId, appleToken, storefront));
        return { platform: 'apple', originalType: 'album', ...meta, resolvedFrom: 'album', storefront };
      }
      return null;
    }

    return null;
  } catch (err) {
    console.error('[resolveUrl] Error:', err.message);
    return null;
  }
}

async function resolveSpotifyTrack(trackId, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  const track = await resp.json();
  const artist = track.artists?.[0];
  if (!artist?.id) throw new Error('Could not extract artist from track');
  return { platform: 'spotify', originalType: 'track', artistId: artist.id, trackData: track, resolvedFrom: 'track' };
}

async function resolveSpotifyAlbum(albumId, token) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${albumId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify album fetch failed: ${resp.status}`);
  const album = await resp.json();
  const artist = album.artists?.[0];
  if (!artist?.id) throw new Error('Could not extract artist from album');
  let trackData = null;
  const firstTrack = album.tracks?.items?.[0];
  if (firstTrack?.id) {
    try {
      const tResp = await fetch(`https://api.spotify.com/v1/tracks/${firstTrack.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (tResp.ok) trackData = await tResp.json();
    } catch (e) { console.warn('[audit] album first-track ISRC fetch failed:', e.message); }
  }
  return { platform: 'spotify', originalType: 'album', artistId: artist.id, trackData, resolvedFrom: 'album' };
}

function parseAppleMusicUrl(url) {
  const trackWithSlug = url.match(/\/album\/[^/]+\/(\d+)\?.*i=(\d+)/);
  if (trackWithSlug) return { type: 'track', albumId: trackWithSlug[1], trackId: trackWithSlug[2] };
  const trackNoSlug = url.match(/\/album\/(\d+)\?.*i=(\d+)/);
  if (trackNoSlug) return { type: 'track', albumId: trackNoSlug[1], trackId: trackNoSlug[2] };
  const songWithSlug = url.match(/\/song\/[^/]+\/(\d+)/);
  if (songWithSlug) return { type: 'track', albumId: null, trackId: songWithSlug[1] };
  const songNoSlug = url.match(/\/song\/(\d+)(?:[?/#]|$)/);
  if (songNoSlug) return { type: 'track', albumId: null, trackId: songNoSlug[1] };
  const albumWithSlug = url.match(/\/album\/[^/]+\/(\d+)(?:[?/#]|$)/);
  if (albumWithSlug) return { type: 'album', albumId: albumWithSlug[1] };
  const albumNoSlug = url.match(/\/album\/(\d+)(?:[?/#]|$)/);
  if (albumNoSlug) return { type: 'album', albumId: albumNoSlug[1] };
  const artistWithSlug = url.match(/\/artist\/[^/]+\/(\d+)(?:[?/#]|$)/);
  if (artistWithSlug) return { type: 'artist', artistId: artistWithSlug[1] };
  const artistNoSlug = url.match(/\/artist\/(\d+)(?:[?/#]|$)/);
  if (artistNoSlug) return { type: 'artist', artistId: artistNoSlug[1] };
  return { type: 'unknown' };
}

function parseAppleStorefront(url) {
  try {
    const u = new URL(url);
    const first = u.pathname.split('/').filter(Boolean)[0];
    if (first && /^[a-z]{2}$/.test(first)) return first;
  } catch (_) {}
  return 'us';
}

async function resolveAppleMusicArtist(artistId, appleToken, storefront = 'us') {
  const resp = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/artists/${artistId}`, { headers: { 'Authorization': `Bearer ${appleToken}` } });
  if (!resp.ok) throw new Error('Apple Music artist lookup failed: ' + resp.status);
  const data = await resp.json();
  const name = data.data?.[0]?.attributes?.name;
  if (!name) throw new Error('Could not extract artist name from Apple Music');
  return name;
}

async function resolveAppleMusicSong(songId, appleToken, storefront = 'us') {
  const resp = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/songs/${songId}`, { headers: { 'Authorization': `Bearer ${appleToken}` } });
  if (!resp.ok) throw new Error('Apple Music song lookup failed: ' + resp.status);
  const data = await resp.json();
  const attrs = data.data?.[0]?.attributes;
  if (!attrs?.artistName) throw new Error('Could not extract artist from Apple Music song');
  return { artistName: attrs.artistName, trackName: attrs.name || null, isrc: attrs.isrc || null, durationMs: attrs.durationInMillis || null };
}

async function resolveAppleMusicAlbumToArtist(albumId, appleToken, storefront = 'us') {
  const resp = await fetch(`https://api.music.apple.com/v1/catalog/${storefront}/albums/${albumId}?include=tracks`, { headers: { 'Authorization': `Bearer ${appleToken}` } });
  if (!resp.ok) throw new Error('Apple Music album lookup failed: ' + resp.status);
  const data = await resp.json();
  const albumAttrs = data.data?.[0]?.attributes;
  if (!albumAttrs?.artistName) throw new Error('Could not extract artist from Apple Music album');
  const firstTrack = data.data?.[0]?.relationships?.tracks?.data?.[0]?.attributes;
  return { artistName: albumAttrs.artistName, trackName: firstTrack?.name || null, isrc: firstTrack?.isrc || null, durationMs: firstTrack?.durationInMillis || null };
}

async function retryOnce(fn) {
  try { return await fn(); }
  catch (e1) { await new Promise(r => setTimeout(r, 1500)); return await fn(); }
}

let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken() {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64') },
    body: 'grant_type=client_credentials'
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Spotify token');
  _spotifyToken = data.access_token;
  _spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _spotifyToken;
}

async function getSpotifyArtist(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log('[audit:diag] getSpotifyArtist status:', resp.status, 'url:', resp.url);
  console.log('[audit:diag] getSpotifyArtist headers:', JSON.stringify({
    'content-type': resp.headers.get('content-type'),
    'cache-control': resp.headers.get('cache-control'),
    'x-ratelimit-remaining': resp.headers.get('x-ratelimit-remaining'),
  }));
  if (!resp.ok) {
    const errBody = await resp.text();
    console.log('[audit:diag] getSpotifyArtist ERROR body:', errBody.slice(0, 500));
    throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  }
  const rawText = await resp.text();
  console.log('[audit:diag] getSpotifyArtist raw body length:', rawText.length, 'preview:', rawText.slice(0, 300));
  try {
    return JSON.parse(rawText);
  } catch (e) {
    console.log('[audit:diag] getSpotifyArtist JSON parse failed:', e.message);
    throw new Error('Spotify artist response not valid JSON');
  }
}

async function getSpotifyAlbums(artistId, token) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) return { items: [] };
    return resp.json();
  } catch { return { items: [] }; }
}

async function getSpotifyTopTracks(artistId, token) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.tracks || []).map(t => ({ name: t.name, isrc: t.external_ids?.isrc || null, artistName: t.artists?.[0]?.name || '', durationMs: t.duration_ms || null }));
  } catch { return []; }
}

async function verifyAppleMusicMatch({ isrc, trackName, artistName, durationMs, storefront = 'us' }) {
  try {
    const appleToken = generateAppleToken();
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };
    if (isrc) {
      const isrcResp = await fetch(`${BASE}/catalog/${storefront}/songs?filter[isrc]=${encodeURIComponent(isrc)}`, { headers });
      if (!isrcResp.ok) return { status: 'Not Confirmed', tier: 'isrc_api_fail' };
      const isrcData = await isrcResp.json();
      if ((isrcData?.data?.length || 0) > 0) return { status: 'Verified', tier: 'isrc' };
    }
    if (trackName && artistName) {
      const q = encodeURIComponent(`${trackName} ${artistName}`);
      const searchResp = await fetch(`${BASE}/catalog/${storefront}/search?term=${q}&types=songs&limit=10`, { headers });
      if (!searchResp.ok) return { status: 'Not Confirmed', tier: 'search_api_fail' };
      const searchData = await searchResp.json();
      const songs = searchData?.results?.songs?.data || [];
      const norm = s => (s || '').toLowerCase().trim();
      const tName = norm(trackName);
      const aName = norm(artistName);
      const hit = songs.find(s => {
        const sn = norm(s.attributes?.name);
        const an = norm(s.attributes?.artistName);
        if (sn !== tName) return false;
        if (an !== aName && !an.includes(aName) && !aName.includes(an)) return false;
        if (durationMs && s.attributes?.durationInMillis) return Math.abs(s.attributes.durationInMillis - durationMs) <= 3000;
        return !durationMs;
      });
      if (hit) return { status: 'Verified', tier: 'name_artist_duration' };
    }
    return { status: 'Not Connected', tier: 'no_match' };
  } catch (err) {
    return { status: 'Not Confirmed', tier: 'exception', error: err.message };
  }
}

async function getAppleMusic(artistName, isrc, spotifyTopTracks = [], storefront = 'us') {
  try {
    const appleToken = generateAppleToken();
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };
    const artistQuery = encodeURIComponent(artistName);
    const artistResp = await fetch(`${BASE}/catalog/${storefront}/search?term=${artistQuery}&types=artists&limit=5`, { headers });
    let artistFound = false, appleArtistId = null, appleArtistUrl = null, appleArtistGenres = [], appleAlbumCount = 0;
    if (artistResp.ok) {
      const artistData = await artistResp.json();
      const artists = artistData?.results?.artists?.data || [];
      const norm = s => s.toLowerCase().trim();
      const match = artists.find(a => norm(a.attributes?.name) === norm(artistName)) || artists[0];
      if (match) {
        artistFound = true; appleArtistId = match.id;
        appleArtistUrl = match.attributes?.url || null;
        appleArtistGenres = match.attributes?.genreNames || [];
        const albumResp = await fetch(`${BASE}/catalog/${storefront}/artists/${appleArtistId}/albums?limit=25`, { headers });
        if (albumResp.ok) { const albumData = await albumResp.json(); appleAlbumCount = albumData?.data?.length || 0; }
      }
    }
    let isrcResult = null;
    if (isrc) {
      const isrcResp = await fetch(`${BASE}/catalog/${storefront}/songs?filter[isrc]=${isrc}`, { headers });
      if (isrcResp.ok) {
        const isrcData = await isrcResp.json();
        const songs = isrcData?.data || [];
        isrcResult = songs.length > 0 ? { found: true, name: songs[0].attributes?.name, url: songs[0].attributes?.url, albumName: songs[0].attributes?.albumName, previewUrl: songs[0].attributes?.previews?.[0]?.url || null } : { found: false };
      }
    }
    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [], notFound = [];
      for (const track of spotifyTopTracks.slice(0, 10)) {
        let found = false;
        if (track.isrc) {
          const isrcResp = await fetch(`${BASE}/catalog/${storefront}/songs?filter[isrc]=${track.isrc}`, { headers });
          if (isrcResp.ok) { const isrcData = await isrcResp.json(); found = (isrcData?.data?.length || 0) > 0; }
        }
        if (!found) {
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const searchResp = await fetch(`${BASE}/catalog/${storefront}/search?term=${q}&types=songs&limit=3`, { headers });
          if (searchResp.ok) { const searchData = await searchResp.json(); const songs = searchData?.results?.songs?.data || []; const norm = s => s.toLowerCase().trim(); found = songs.some(s => norm(s.attributes?.name) === norm(track.name)); }
        }
        if (found) matched.push(track.name); else notFound.push(track.name);
      }
      const total = matched.length + notFound.length;
      catalogComparison = { tracksChecked: total, matched: matched.length, notFound, matchRate: total > 0 ? Math.round((matched.length / total) * 100) : 0 };
    }
    return { found: artistFound, artistId: appleArtistId, artistUrl: appleArtistUrl, genres: appleArtistGenres, albumCount: appleAlbumCount, isrcLookup: isrcResult, catalogComparison };
  } catch (err) { return { found: false, error: err.message }; }
}

async function getYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { found: false, reason: 'API key not configured' };
    const query = encodeURIComponent(artistName);
    const channelResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`);
    if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}` };
    const channelData = await channelResp.json();
    const norm = s => s.toLowerCase().trim();
    const channels = channelData.items || [];
    const officialChannel = channels.find(c => norm(c.snippet.channelTitle) === norm(artistName) || norm(c.snippet.channelTitle).includes(norm(artistName)) || c.snippet.description?.toLowerCase().includes('official')) || channels[0];
    let officialVideoCount = 0, officialViewCount = 0, subscriberCount = 0;
    if (officialChannel) {
      const channelId = officialChannel.snippet.channelId || officialChannel.id?.channelId;
      if (channelId) {
        const statsResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`);
        if (statsResp.ok) { const statsData = await statsResp.json(); const stats = statsData.items?.[0]?.statistics; if (stats) { officialVideoCount = parseInt(stats.videoCount || 0); officialViewCount = parseInt(stats.viewCount || 0); subscriberCount = parseInt(stats.subscriberCount || 0); } }
      }
    }
    const ugcResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`);
    let ugcVideoCount = 0, ugcEstimatedViews = 0, topUgcVideos = [];
    if (ugcResp.ok) {
      const ugcData = await ugcResp.json();
      const ugcVideos = (ugcData.items || []).filter(v => { const ct = v.snippet?.channelTitle?.toLowerCase() || ''; return !ct.includes(norm(artistName)) && !ct.includes('vevo'); });
      ugcVideoCount = ugcVideos.length;
      topUgcVideos = ugcVideos.slice(0, 3).map(v => ({ title: v.snippet.title, channel: v.snippet.channelTitle, videoId: v.id.videoId }));
      if (ugcVideos.length > 0) {
        const videoIds = ugcVideos.map(v => v.id.videoId).filter(Boolean).join(',');
        if (videoIds) {
          const vr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`);
          if (vr.ok) { const vd = await vr.json(); ugcEstimatedViews = (vd.items || []).reduce((s, v) => s + parseInt(v.statistics?.viewCount || 0), 0); }
        }
      }
    }
    const hasOfficialChannel = !!officialChannel;
    const contentIdRisk = (ugcVideoCount > 0) && !hasOfficialChannel;
    return { found: true, officialChannel: hasOfficialChannel ? { title: officialChannel.snippet.channelTitle, channelId: officialChannel.snippet.channelId || officialChannel.id?.channelId, subscribers: subscriberCount, totalViews: officialViewCount, videoCount: officialVideoCount } : null, ugc: { videoCount: ugcVideoCount, estimatedViews: ugcEstimatedViews, topVideos: topUgcVideos, contentIdRisk }, contentIdVerified: hasOfficialChannel && officialViewCount > 0, subscriberCount, totalOfficialViews: officialViewCount };
  } catch (err) { return { found: false, reason: err.message }; }
}

function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, latestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0, recentActivity: false };
  const years = albums.map(a => parseInt(a.release_date?.substring(0, 4))).filter(y => !isNaN(y) && y > 1950);
  const earliestYear = years.length ? Math.min(...years) : null;
  const currentYear = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;
  const followers = artist.followers?.total || 0;
  const popularity = artist.popularity || 0;
  const estAnnualStreams = Math.round((followers * 12) + (popularity * 1000));
  return { totalReleases: albums.length, earliestYear, latestYear: years.length ? Math.max(...years) : null, catalogAgeYears, estimatedAnnualStreams: estAnnualStreams, recentActivity: years.some(y => y >= currentYear - 2) };
}

function estimateRoyaltyGap(artist, catalog, lastfm, youtube) {
  const followers = artist.followers?.total || 0;
  const popularity = artist.popularity || 0;
  const catalogYears = catalog.catalogAgeYears || 1;
  const estMonthlyStreams = Math.round((followers * 1.2) + (popularity * 800));
  const estAnnualStreams = estMonthlyStreams * 12;
  const estLifetimeStreams = estAnnualStreams * Math.min(catalogYears, 10);
  const lastfmBoost = lastfm.found && lastfm.playcount > 0 ? Math.min(lastfm.playcount * 0.3, estLifetimeStreams * 2) : 0;
  const totalEstStreams = estLifetimeStreams + lastfmBoost;
  const spotifyEst = Math.round(totalEstStreams * 0.004);
  const proEst = Math.round(totalEstStreams * 0.0008);
  const totalEst = spotifyEst + proEst;
  const potentialGap = Math.round(proEst * 0.6);
  const ugcViews = youtube?.ugc?.estimatedViews || 0;
  const ugcUnmonetisedEst = Math.round(ugcViews * 0.0015);
  return { estAnnualStreams, estLifetimeStreams: Math.round(totalEstStreams), estSpotifyRoyalties: spotifyEst, estPROEarnings: proEst, estTotalRoyalties: totalEst, potentialGapLow: Math.round(potentialGap * 0.5), potentialGapHigh: potentialGap, catalogYears, ugcUnmonetisedViews: ugcViews, ugcPotentialRevenue: ugcUnmonetisedEst, disclaimer: 'Estimates only. Based on public follower, popularity, and YouTube signals. Verify with your distributor and PRO.' };
}

function getPROGuide(country) {
  const guides = {
    'Canada': { pro: 'SOCAN', url: 'https://www.socan.com', steps: ['Go to socan.com and click Join', 'Register as a songwriter and composer', 'Register all your works in the SOCAN repertoire', 'Submit cue sheets for any TV or film placements'], note: 'SOCAN collects performance royalties for streaming, radio, TV, and live performances across Canada and internationally through reciprocal agreements with GEMA, PRS, ASCAP and others.' },
    'United States': { pro: 'ASCAP or BMI', url: 'https://www.ascap.com', steps: ['Choose ASCAP (ascap.com) or BMI (bmi.com) — you can only join one', 'Register as a songwriter and publisher', 'Register all your works', 'Submit your Spotify artist URL when registering works'], note: 'ASCAP and BMI both collect performance royalties for US streaming, radio, TV and live performances. SESAC is invite-only.' },
    'United Kingdom': { pro: 'PRS for Music', url: 'https://www.prsformusic.com', steps: ['Go to prsformusic.com and click Join PRS', 'Register as a writer member', 'Register all your works in the PRS repertoire', 'Link your Spotify artist profile in your PRS account'], note: 'PRS for Music collects performance and mechanical royalties across the UK and internationally through reciprocal agreements.' },
    'Germany': { pro: 'GEMA', url: 'https://www.gema.de', steps: ['Go to gema.de and register as a member', 'Register as a composer and lyricist', 'Register all your works in the GEMA database', 'Submit documentation of any live performances or broadcast placements'], note: 'GEMA collects performance royalties across Germany and is one of the highest-paying PROs in the world.' },
    'France': { pro: 'SACEM', url: 'https://www.sacem.fr', steps: ['Go to sacem.fr and click Adhérer', 'Register as a composer, author or publisher', 'Register all your works', 'Submit any broadcast documentation'], note: 'SACEM collects performance royalties across France and has reciprocal agreements with most global PROs.' },
    'Australia': { pro: 'APRA AMCOS', url: 'https://www.apraamcos.com.au', steps: ['Go to apraamcos.com.au and click Join', 'Register as a songwriter', 'Register all your works', 'Link your streaming profiles'], note: 'APRA AMCOS collects performance and mechanical royalties across Australia and New Zealand.' },
    'Jamaica': { pro: 'JACAP', url: 'https://www.jacap.org', steps: ['Go to jacap.org and register as a member', 'Register as a composer or author', 'Register all your works in the JACAP database'], note: 'JACAP collects performance royalties across Jamaica and has reciprocal agreements with international PROs.' },
  };
  const defaultGuide = { pro: 'Your local PRO', url: 'https://www.cisac.org', steps: ["Find your country's PRO at cisac.org/find-a-society", 'Register as a songwriter and composer', 'Register all your works in the PRO database', 'Verify reciprocal agreements with SOCAN, ASCAP, GEMA and PRS'], note: 'CISAC is the international confederation of PROs. Their directory lists every PRO worldwide.' };
  if (!country) return defaultGuide;
  const match = Object.keys(guides).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return match ? { ...guides[match], country: match } : { ...defaultGuide, country };
}

async function getMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false, artists: [] };
    const data = await resp.json();
    return { found: data.artists?.length > 0, artists: data.artists || [], topMatch: data.artists?.[0] || null, score: data.artists?.[0]?.score || 0 };
  } catch { return { found: false, artists: [] }; }
}

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

async function getTidal(artistName) {
  try {
    const token = await getTidalAccessToken();
    const query = encodeURIComponent(artistName);
    const url = `https://openapi.tidal.com/v2/searchresults/${query}?countryCode=US&include=artists`;
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'accept': 'application/vnd.tidal.v1+json', 'Content-Type': 'application/vnd.tidal.v1+json' } });
    if (!resp.ok) return { found: false, popularity: 0 };
    const data = await resp.json();
    const included = Array.isArray(data?.included) ? data.included : [];
    const artists = included.filter(i => i?.type === 'artists');
    if (artists.length === 0) return { found: false, popularity: 0 };
    const norm = s => (s || '').toLowerCase().trim();
    const target = norm(artistName);
    const best = artists.find(a => norm(a.attributes?.name) === target) || artists[0];
    const attrs = best?.attributes || {};
    return { found: true, artistId: best?.id || null, name: attrs.name || null, popularity: typeof attrs.popularity === 'number' ? attrs.popularity : 0, url: attrs.externalLinks?.[0]?.href || null, pictureUrl: attrs.imageLinks?.[0]?.href || null };
  } catch { return { found: false, popularity: 0 }; }
}

async function getAudioDB(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${query}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };
    const a = data.artists[0];
    return { found: true, name: a.strArtist, genre: a.strGenre || null, style: a.strStyle || null, mood: a.strMood || null, country: a.strCountry || null, biography: a.strBiographyEN ? a.strBiographyEN.substring(0, 400) : null, formed: a.intFormedYear || null, website: a.strWebsite || null, youtube: a.strYoutube || null, facebook: a.strFacebook || null, twitter: a.strTwitter || null, instagram: a.strInstagram || null };
  } catch { return { found: false }; }
}

async function getDiscogs(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const discogsKey = process.env.DISCOGS_KEY;
    const discogsSecret = process.env.DISCOGS_SECRET;
    const authHeaders = { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' };
    if (discogsKey && discogsSecret) authHeaders['Authorization'] = `Discogs key=${discogsKey}, secret=${discogsSecret}`;
    const resp = await fetch(`https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`, { headers: authHeaders });
    if (!resp.ok) return { found: false, releases: 0 };
    const data = await resp.json();
    if (!data.results?.length) return { found: false, releases: 0 };
    const norm = s => s.toLowerCase().trim();
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || data.results[0];
    const relResp = await fetch(`https://api.discogs.com/artists/${artist.id}/releases?per_page=1`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    const relData = relResp.ok ? await relResp.json() : {};
    return { found: true, artistId: artist.id, name: artist.title, releases: relData.pagination?.items || 0, link: `https://www.discogs.com/artist/${artist.id}` };
  } catch { return { found: false, releases: 0 }; }
}

async function getSoundCloud(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const scClientId = process.env.SOUNDCLOUD_CLIENT_ID;
    if (!scClientId) return { found: false, followers: 0 };
    const resp = await fetch(`https://api.soundcloud.com/users?q=${query}&limit=5&client_id=${scClientId}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false, followers: 0 };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false, followers: 0 };
    const norm = s => s.toLowerCase().trim();
    const user = data.find(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)) || data[0];
    return { found: true, username: user.username, followers: user.followers_count || 0, tracks: user.track_count || 0, permalink: user.permalink_url || null };
  } catch { return { found: false, followers: 0 }; }
}

async function getLastFm(artistName) {
  try {
    const key = process.env.LASTFM_API_KEY;
    if (!key) return { found: false };
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${query}&api_key=${key}&format=json`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (data.error || !data.artist) return { found: false };
    const a = data.artist;
    return { found: true, name: a.name, playcount: parseInt(a.stats?.playcount || 0), listeners: parseInt(a.stats?.listeners || 0), tags: a.tags?.tag?.map(t => t.name) || [], bio: a.bio?.summary ? a.bio.summary.replace(/<[^>]+>/g, '').substring(0, 300) : null, url: a.url || null };
  } catch { return { found: false }; }
}

async function getWikidata(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&type=item&format=json&limit=5`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.search?.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const match = data.search.find(r => norm(r.label) === norm(artistName) && (r.description?.toLowerCase().includes('musician') || r.description?.toLowerCase().includes('singer') || r.description?.toLowerCase().includes('rapper') || r.description?.toLowerCase().includes('artist') || r.description?.toLowerCase().includes('band') || r.description?.toLowerCase().includes('producer'))) || data.search.find(r => norm(r.label) === norm(artistName));
    if (!match) return { found: false };
    const wpResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    const wpData = wpResp.ok ? await wpResp.json() : null;
    return { found: true, wikidataId: match.id, description: match.description || null, wikipediaUrl: wpData?.content_urls?.desktop?.page || null, wikipediaFound: wpResp.ok && !wpData?.type?.includes('disambiguation'), extract: wpData?.extract?.substring(0, 300) || null };
  } catch { return { found: false }; }
}

function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic, tidal) {
  const modules = {};
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres?.length) { metaScore -= 20; metaFlags.push('Genre tags not detected on Spotify profile'); }
  if (!artist.images?.length) { metaScore -= 15; metaFlags.push('No artist images found on Spotify'); }
  if (track && !track.external_ids?.isrc) { metaScore -= 30; metaFlags.push('ISRC signal not detected on this track'); }
  if (audiodb.found && audiodb.biography) metaScore += 5;
  if (wikidata.found) metaScore += 5;
  if (lastfm.found && lastfm.tags?.length) metaScore += 5;
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(Math.min(metaScore, 100), 10), flags: metaFlags };

  let covScore = 20;
  const covFlags = [];
  const checks = [
    { name: 'MusicBrainz', found: mb.found, pts: 10 }, { name: 'Deezer', found: deezer.found, pts: 10 },
    { name: 'AudioDB', found: audiodb.found, pts: 8 }, { name: 'Discogs', found: discogs.found, pts: 8 },
    { name: 'SoundCloud', found: soundcloud.found, pts: 7 }, { name: 'Last.fm', found: lastfm.found, pts: 9 },
    { name: 'Wikipedia', found: wikidata.found, pts: 8 }, { name: 'YouTube', found: youtube.found, pts: 10 },
    { name: 'Apple Music', found: appleMusic.found, pts: 10 }, { name: 'Tidal', found: tidal?.found || false, pts: 10 },
  ];
  checks.forEach(p => { if (p.found) covScore += p.pts; else covFlags.push(`${p.name} presence not detected — coverage risk`); });
  if (artist.followers?.total > 100) covScore += 10;
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) { pubScore -= 35; pubFlags.push('ISRC not detected — performance royalty routing unverified'); }
  if (!artist.genres?.length) { pubScore -= 15; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk'); }
  if (!mb.found) { pubScore -= 20; pubFlags.push('Not in MusicBrainz — publishing data cross-reference unavailable'); }
  if (catalog.catalogAgeYears > 5) { pubScore -= 10; pubFlags.push(`Catalog active for ${catalog.catalogAgeYears} years — extended royalty verification recommended`); }
  if (discogs.found && discogs.releases > 0) pubScore += 10;
  if (lastfm.found && lastfm.playcount > 10000) { pubScore -= 10; pubFlags.push('High Last.fm play count — significant streaming history detected, PRO verification critical'); }
  if (track?.external_ids?.isrc && appleMusic.isrcLookup && !appleMusic.isrcLookup.found) { pubScore -= 15; pubFlags.push('Track ISRC found on Spotify but not on Apple Music — cross-platform metadata discrepancy detected'); }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) { dupScore -= 25; dupFlags.push('Popularity vs follower ratio — possible catalog fragmentation signal'); }
  if (mb.artists?.length > 1) { dupScore -= 20; dupFlags.push(`${mb.artists.length} MusicBrainz entries detected — possible duplicate profiles`); }
  if (!catalog.recentActivity && catalog.earliestYear) { dupScore -= 10; dupFlags.push(`No releases detected after ${catalog.latestYear} — catalog may be fragmented across accounts`); }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  let ytScore = 10;
  const ytFlags = [];
  if (youtube.found) {
    if (youtube.officialChannel) { ytScore += 35; if (youtube.subscriberCount > 1000) ytScore += 10; if (youtube.totalOfficialViews > 10000) ytScore += 10; }
    else ytFlags.push('No official YouTube channel detected — Content ID registration unverified');
    if (youtube.contentIdVerified) ytScore += 15; else ytFlags.push('Content ID monetisation status unverified');
    if (youtube.ugc?.contentIdRisk) { ytScore -= 15; ytFlags.push(`${youtube.ugc.videoCount} user-uploaded video(s) detected with no official channel — potential unmonetised UGC exposure`); }
    if (youtube.ugc?.estimatedViews > 100000) ytFlags.push(`~${youtube.ugc.estimatedViews.toLocaleString()} views detected on UGC videos — significant unmonetised revenue risk`);
  } else {
    ytFlags.push('YouTube scan unavailable — API key not configured or search returned no results');
    if (audiodb.found && audiodb.youtube) ytScore += 20;
    if (soundcloud.found && soundcloud.tracks > 0) ytScore += 10;
  }
  if (lastfm.found && lastfm.listeners > 1000) ytScore += 5;
  modules.youtube = { name: 'YouTube / UGC', score: Math.max(Math.min(ytScore, 100), 10), flags: ytFlags };

  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc) syncScore += 20; else syncFlags.push('ISRC signal not detected');
  if (artist.genres?.length) syncScore += 15; else syncFlags.push('Genre tags absent');
  if (mb.found) syncScore += 10; else syncFlags.push('Not in MusicBrainz catalog');
  if (wikidata.found) syncScore += 15; else syncFlags.push('No Wikipedia presence — sync discoverability risk');
  if (deezer.found) syncScore += 8;
  if (tidal?.found) syncScore += 6;
  if (discogs.found) syncScore += 8;
  if (lastfm.found && lastfm.listeners > 500) syncScore += 10;
  if (audiodb.found && audiodb.genre) syncScore += 8;
  if (artist.followers?.total > 1000) syncScore += 6;
  if (appleMusic.found) syncScore += 10; else syncFlags.push('Not found on Apple Music — cross-platform sync discoverability risk');
  if (appleMusic.catalogComparison?.matchRate < 70) syncFlags.push(`Only ${appleMusic.catalogComparison.matchRate}% of top tracks matched on Apple Music — catalog gaps detected`);
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

function buildFlags(modules, artist, track, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic, tidal, ownership) {
  const flags = [];
  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40) severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });
  if (catalog.catalogAgeYears >= 10) flags.push({ module: 'Publishing Risk', severity: 'high', description: `Catalog active for ${catalog.catalogAgeYears} years — extended period of potential royalty exposure detected` });
  else if (catalog.catalogAgeYears >= 5) flags.push({ module: 'Publishing Risk', severity: 'medium', description: `Catalog active for ${catalog.catalogAgeYears} years — multi-year royalty verification recommended` });
  if (youtube.found && youtube.ugc?.estimatedViews > 50000) flags.push({ module: 'YouTube / UGC', severity: 'high', description: `~${youtube.ugc.estimatedViews.toLocaleString()} unmonetised UGC views detected on YouTube — Content ID registration recommended immediately` });
  if (appleMusic.found && appleMusic.catalogComparison) {
    const { matchRate, notFound } = appleMusic.catalogComparison;
    if (matchRate < 50) flags.push({ module: 'Platform Coverage', severity: 'high', description: `${100 - matchRate}% of top Spotify tracks not found on Apple Music — significant catalog distribution gap detected` });
    else if (matchRate < 80) flags.push({ module: 'Platform Coverage', severity: 'medium', description: `${notFound.length} top track(s) missing from Apple Music — distribution gaps may be limiting revenue` });
  }
  if (!appleMusic.found) flags.push({ module: 'Platform Coverage', severity: 'medium', description: 'Artist not found on Apple Music — potential distribution gap across the second-largest music streaming platform' });
  if (lastfm.found && lastfm.playcount > 50000) flags.push({ module: 'Platform Coverage', severity: 'high', description: `${lastfm.playcount.toLocaleString()} Last.fm plays detected — significant historical streaming activity warrants full PRO audit` });
  if (!wikidata.found) flags.push({ module: 'Sync Readiness', severity: 'medium', description: 'No Wikipedia presence detected — sync licensing teams often research artists on Wikipedia before licensing' });
  if (discogs.found && discogs.releases > 5) flags.push({ module: 'Duplicate Detection', severity: 'low', description: `${discogs.releases} releases found on Discogs — physical catalog confirmed` });
  if (ownership) {
    if (ownership.ownership_status === 'at_risk') flags.push({ module: 'Ownership & Publishing', severity: 'high', description: 'Ownership at risk — songwriter/publisher registration cannot be verified from cross-platform signals. Confirm with ASCAP/BMI Songview.' });
    else if (ownership.ownership_status === 'unverified') flags.push({ module: 'Ownership & Publishing', severity: 'medium', description: 'Ownership data not confirmed via performing rights organizations — verify songwriter and publisher registration via ASCAP/BMI Songview.' });
  }
  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
