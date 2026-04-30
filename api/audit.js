// Royalte Audit API — /api/audit.js
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata + YouTube + Apple Music
// Features: Royalty gap estimate, catalog age analysis, country PRO guide, real YouTube UGC detection, Apple Music catalog comparison

import { generateAppleToken } from './apple-token.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // Quick top-level guard so unknown inputs are rejected early.
    const inputType = detectInputType(url);
    if (inputType === 'unknown') {
      return res.status(400).json({ error: 'Invalid URL. Please paste a Spotify or Apple Music link.' });
    }

    const token = await getSpotifyToken();

    // ── ARTIST RESOLUTION ───────────────────────────────────
    // ALL inputs (artist / track / album / apple) normalize to a single
    // canonical artist before the scan runs. The scan ALWAYS runs on the
    // artist — never on track or album.
    const resolved = await resolveToArtist(url, token);
    if (!resolved) {
      return res.status(400).json({ error: 'Could not resolve this link to an artist. Please try a different link.' });
    }

    // ── DEGRADED PATH: Apple input with no Spotify match ────
    // Per spec: DO NOT fail the scan. Return a success response with
    // artistName from Apple and followers = -1 so the UI can show
    // "Fans on streaming platforms" instead of an error.
    if (!resolved.artistId) {
      return res.status(200).json({
        success: true,
        platform: 'apple',
        type: 'artist',
        artistName: resolved.artistName,
        artistId: null,
        followers: -1,
        popularity: 0,
        genres: [],
        trackTitle: null,
        trackIsrc: null,
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
          youtube: false, appleMusic: false,
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
        appleMusic: { found: false },
        overallScore: 0,
        modules: {},
        flags: [],
        flagCount: 0,
        previewFlags: [],
        scannedAt: new Date().toISOString(),
      });
    }

    const artistId = resolved.artistId;
    const artistData = await getSpotifyArtist(artistId, token);

    // For track inputs we still want trackData populated for the existing
    // ISRC / Apple cross-reference logic — it does not change the audit
    // target, only enriches the existing scan.
    let trackData = null;
    if (resolved.resolvedFromType === 'track' && resolved.spotifyTrackId) {
      try { trackData = await getSpotifyTrack(resolved.spotifyTrackId, token); }
      catch { trackData = null; }
    }

    // Get albums for catalog age
    const albumsData = await getSpotifyAlbums(artistId, token);
    const artistName = artistData.name;

    // Get Spotify tracks for Apple Music comparison (top tracks)
    const spotifyTopTracks = await getSpotifyTopTracks(artistId, token);

    // All platforms in parallel — includes YouTube + Apple Music
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

    // Catalog analysis
    const catalogData = analyzeCatalog(albumsData, artistData);

    // Royalty gap estimate
    const royaltyGap = estimateRoyaltyGap(artistData, catalogData, lastfmData, youtubeData);

    // PRO guide based on detected country
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);

    const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);

    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData);

    return res.status(200).json({
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
      // ── ARTIST RESOLUTION FIELDS (additive, no existing fields removed) ──
      resolvedFrom:       resolved.resolvedFrom,
      resolvedFromType:   resolved.resolvedFromType,
      resolvedFromTitle:  resolved.resolvedFromTitle,
      canonicalTarget:    'artist',
      spotifyMatched:     resolved.spotifyMatched !== false,
      artistUrl:          resolved.artistUrl || artistData.external_urls?.spotify || null,
      // ── ARTIST IMAGE FIELDS (additive) ──
      // Priority: Spotify artist image → resolved.artistImage (may be Apple artwork) → track album image → null
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
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
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
      return { name: attrs.name, artworkUrl };
    }

    if (meta.kind === 'song') {
      const r = await fetch(`${BASE}/catalog/${sf}/songs/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      // Songs always have artwork (album cover) — use as fallback
      const artworkUrl = formatArtwork(attrs.artwork);
      return { name: attrs.artistName, artworkUrl };
    }

    if (meta.kind === 'album') {
      // If the URL contains ?i=<songId> Apple treats it as a song — try song first
      if (meta.songId) {
        const rs = await fetch(`${BASE}/catalog/${sf}/songs/${meta.songId}`, { headers });
        if (rs.ok) {
          const data = await rs.json();
          const attrs = data?.data?.[0]?.attributes;
          if (attrs?.artistName) {
            return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork) };
          }
        }
      }
      const r = await fetch(`${BASE}/catalog/${sf}/albums/${meta.id}`, { headers });
      if (!r.ok) return null;
      const data = await r.json();
      const attrs = data?.data?.[0]?.attributes;
      if (!attrs?.artistName) return null;
      return { name: attrs.artistName, artworkUrl: formatArtwork(attrs.artwork) };
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

        // Get album count
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

    // 2. ISRC lookup for the specific track (if track scan)
    let isrcResult = null;
    if (isrc) {
      const isrcResp = await fetch(
        `${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${isrc}`,
        { headers }
      );
      if (isrcResp.ok) {
        const isrcData = await isrcResp.json();
        const songs = isrcData?.data || [];
        if (songs.length > 0) {
          const song = songs[0];
          isrcResult = {
            found: true,
            name: song.attributes?.name,
            url: song.attributes?.url,
            albumName: song.attributes?.albumName,
            previewUrl: song.attributes?.previews?.[0]?.url || null,
          };
        } else {
          isrcResult = { found: false };
        }
      }
    }

    // 3. Compare Spotify top tracks against Apple Music catalog
    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [];
      const notFound = [];

      for (const track of spotifyTopTracks.slice(0, 10)) { // limit to 10 to avoid rate limits
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
function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, catalogAgeYears: 0, estimatedAnnualStreams: 0 };

  const years = albums
    .map(a => parseInt(a.release_date?.substring(0, 4)))
    .filter(y => !isNaN(y) && y > 1950);

  const earliestYear = years.length ? Math.min(...years) : null;
  const currentYear = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;

  const followers = artist.followers?.total || 0;
  const popularity = artist.popularity || 0;
  const estAnnualStreams = Math.round((followers * 12) + (popularity * 1000));

  return {
    totalReleases: albums.length,
    earliestYear,
    latestYear: years.length ? Math.max(...years) : null,
    catalogAgeYears,
    estimatedAnnualStreams: estAnnualStreams,
    recentActivity: years.some(y => y >= currentYear - 2),
  };
}

// ────────────────────────────────────────────────────────
// ROYALTY GAP ESTIMATE — includes YouTube UGC data
// ────────────────────────────────────────────────────────
function estimateRoyaltyGap(artist, catalog, lastfm, youtube) {
  const followers = artist.followers?.total || 0;
  const popularity = artist.popularity || 0;
  const catalogYears = catalog.catalogAgeYears || 1;

  const estMonthlyStreams = Math.round((followers * 1.2) + (popularity * 800));
  const estAnnualStreams = estMonthlyStreams * 12;
  const estLifetimeStreams = estAnnualStreams * Math.min(catalogYears, 10);

  const lastfmBoost = lastfm.found && lastfm.playcount > 0
    ? Math.min(lastfm.playcount * 0.3, estLifetimeStreams * 2)
    : 0;

  const totalEstStreams = estLifetimeStreams + lastfmBoost;
  const spotifyEst = Math.round(totalEstStreams * 0.004);
  const proEst = Math.round(totalEstStreams * 0.0008);
  const totalEst = spotifyEst + proEst;
  const potentialGap = Math.round(proEst * 0.6);

  const ugcViews = youtube?.ugc?.estimatedViews || 0;
  const ugcUnmonetisedEst = Math.round(ugcViews * 0.0015);

  return {
    estAnnualStreams,
    estLifetimeStreams: Math.round(totalEstStreams),
    estSpotifyRoyalties: spotifyEst,
    estPROEarnings: proEst,
    estTotalRoyalties: totalEst,
    potentialGapLow: Math.round(potentialGap * 0.5),
    potentialGapHigh: potentialGap,
    catalogYears,
    ugcUnmonetisedViews: ugcViews,
    ugcPotentialRevenue: ugcUnmonetisedEst,
    disclaimer: 'Estimates only. Based on public follower, popularity, and YouTube signals. Verify with your distributor and PRO.'
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
function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres?.length) { metaScore -= 20; metaFlags.push('Genre tags not detected on Spotify profile'); }
  if (!artist.images?.length) { metaScore -= 15; metaFlags.push('No artist images found on Spotify'); }
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
  if (artist.followers?.total > 100) covScore += 10;
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  // MODULE C — Publishing Risk
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) { pubScore -= 35; pubFlags.push('ISRC not detected — performance royalty routing unverified'); }
  if (!artist.genres?.length) { pubScore -= 15; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk'); }
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
  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) { dupScore -= 25; dupFlags.push('Popularity vs follower ratio — possible catalog fragmentation signal'); }
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
    if (youtube.ugc?.estimatedViews > 100000) {
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
  if (track?.external_ids?.isrc) { syncScore += 20; } else syncFlags.push('ISRC signal not detected');
  if (artist.genres?.length) { syncScore += 15; } else syncFlags.push('Genre tags absent');
  if (mb.found) { syncScore += 10; } else syncFlags.push('Not in MusicBrainz catalog');
  if (wikidata.found) { syncScore += 15; } else syncFlags.push('No Wikipedia presence — sync discoverability risk');
  if (deezer.found) syncScore += 8;
  if (discogs.found) syncScore += 8;
  if (lastfm.found && lastfm.listeners > 500) syncScore += 10;
  if (audiodb.found && audiodb.genre) syncScore += 8;
  if (artist.followers?.total > 1000) syncScore += 6;
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

  // YouTube UGC high-value flag
  if (youtube.found && youtube.ugc?.estimatedViews > 50000) {
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

  // Wikipedia flag
  if (!wikidata.found) {
    flags.push({ module: 'Sync Readiness', severity: 'medium', description: 'No Wikipedia presence detected — sync licensing teams often research artists on Wikipedia before licensing' });
  }

  // Positive signals
  if (discogs.found && discogs.releases > 5) {
    flags.push({ module: 'Duplicate Detection', severity: 'low', description: `${discogs.releases} releases found on Discogs — physical catalog confirmed` });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
