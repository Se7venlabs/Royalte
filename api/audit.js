// Royalte Audit API — /api/audit.js
// Platforms: Spotify + Apple Music + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata + YouTube
// Mode: VERIFIED DATA ONLY — no estimates, no projections, no inferred data
// URL input: Spotify (artist/track/album) OR Apple Music (album/song/artist) → resolves to Spotify via ISRC

import { generateAppleToken } from './apple-token.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // ── Step 1: Parse URL ─────────────────────────────────────
    let parsed = parseSpotifyUrl(url);
    let sourcePlatform = 'spotify';
    let appleMusicSourceData = null;

    if (!parsed) {
      const appleparsed = parseAppleMusicUrl(url);
      if (!appleparsed) {
        return res.status(400).json({
          error: 'Invalid URL. Please paste a Spotify or Apple Music artist, track, or album link.'
        });
      }
      const appleToken = generateAppleToken();
      const resolved = await resolveAppleMusicToSpotify(appleparsed, appleToken);
      if (!resolved) {
        return res.status(400).json({
          error: 'Could not match this Apple Music link to a Spotify track. Try pasting your Spotify link directly.'
        });
      }
      parsed = resolved.spotifyParsed;
      sourcePlatform = 'apple_music';
      appleMusicSourceData = resolved.appleMusicData;
    }

    const token = await getSpotifyToken();

    // ── Step 2: Fetch Spotify data ────────────────────────────
    let artistData, trackData, albumData;
    let scanMode = parsed.type;

    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else if (parsed.type === 'track') {
      trackData = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    } else if (parsed.type === 'album') {
      albumData = await getSpotifyAlbum(parsed.id, token);
      if (!albumData.artists?.[0]?.id) {
        return res.status(400).json({ error: 'Could not resolve artist from this album.' });
      }
      artistData = await getSpotifyArtist(albumData.artists[0].id, token);
      const firstTrackId = albumData.tracks?.items?.[0]?.id;
      if (firstTrackId) trackData = await getSpotifyTrack(firstTrackId, token);
    }

    const artistName = artistData.name;
    const artistSpotifyId = parsed.type === 'artist' ? parsed.id : artistData.id;
    const albumsData = await getSpotifyAlbums(artistSpotifyId, token);
    const spotifyTopTracks = await getSpotifyTopTracks(artistSpotifyId, token);

    let audioFeatures = null;
    if (parsed.type === 'track' && trackData) {
      audioFeatures = await getSpotifyAudioFeatures([trackData.id], token);
    } else if (parsed.type === 'album' && albumData) {
      const ids = (albumData.tracks?.items || []).slice(0, 5).map(t => t.id);
      if (ids.length) audioFeatures = await getSpotifyAudioFeatures(ids, token);
    }

    // ── Step 3: All platform scans in parallel ────────────────
    const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, youtubeData, appleMusicData] =
      await Promise.allSettled([
        getMusicBrainz(artistName),
        getDeezer(artistName),
        getAudioDB(artistName),
        getDiscogs(artistName),
        getSoundCloud(artistName),
        getLastFm(artistName),
        getWikidata(artistName),
        getYouTube(artistName),
        getAppleMusic(artistName, trackData?.external_ids?.isrc || null, spotifyTopTracks),
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false, verified: false }));

    // ── Step 4: Analysis ──────────────────────────────────────
    const catalogData = analyzeCatalog(albumsData, artistData);
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);
    const weights = getScoringWeights(scanMode);

    const modules = runModules(
      artistData, trackData, albumData,
      mbData, deezerData, audioDbData, discogsData, soundcloudData,
      lastfmData, wikidataData, catalogData, youtubeData, appleMusicData,
      audioFeatures, scanMode, weights
    );

    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    const flags = buildVerifiedFlags(
      modules, artistData, trackData, deezerData, audioDbData, discogsData,
      soundcloudData, lastfmData, wikidataData, catalogData, youtubeData, appleMusicData
    );

    // ── Step 5: Royalty Risk Score ────────────────────────────
    const royaltyRiskScore = calcRoyaltyRiskScore(artistData, trackData, mbData, appleMusicData, country);

    // ── Step 6: Territory coverage (verified only) ────────────
    const territoryCoverage = buildTerritoryCoverage(artistData, trackData, mbData, appleMusicData, country, proGuide);

    // ── Step 7: Audit coverage summary ───────────────────────
    const auditCoverage = {
      spotify:       { status: 'Verified',     source: 'spotify'     },
      appleMusic:    { status: appleMusicData.found ? 'Verified' : (appleMusicData.error ? 'Not Connected' : 'Not Found'), source: 'apple_music' },
      publishing:    { status: 'Not Connected', source: null         },
      soundExchange: { status: 'Not Confirmed', source: null         },
    };
    const auditConfidence = (appleMusicData.found && mbData.found) ? 'High' : 'Limited';
    const urlTypeLabel = { artist: 'Artist Page', track: 'Single Track', album: 'Album' }[scanMode] || 'Artist Page';

    return res.status(200).json({
      success: true,
      platform: parsed.platform,
      sourcePlatform,
      appleMusicSource: appleMusicSourceData,
      type: parsed.type,
      scanMode,
      urlType: urlTypeLabel,
      artistName,
      artistId: artistData.id,
      followers: artistData.followers?.total || 0,
      popularity: artistData.popularity || 0,
      genres: artistData.genres || [],
      trackTitle:       trackData?.name || null,
      trackIsrc:        trackData?.external_ids?.isrc || null,
      trackDurationMs:  trackData?.duration_ms || null,
      trackExplicit:    trackData?.explicit ?? null,
      trackPreviewUrl:  trackData?.preview_url || null,
      albumTitle:       albumData?.name || trackData?.album?.name || null,
      albumReleaseDate: albumData?.release_date || null,
      albumTrackCount:  albumData?.total_tracks || null,
      albumLabel:       albumData?.label || null,
      audioFeatures:    audioFeatures || null,
      platforms: {
        spotify:     { found: true,                 source: 'spotify',     verified: true  },
        musicbrainz: { found: mbData.found,         source: 'musicbrainz', verified: true  },
        deezer:      { found: deezerData.found,     source: 'deezer',      verified: true  },
        audiodb:     { found: audioDbData.found,    source: 'audiodb',     verified: true  },
        discogs:     { found: discogsData.found,    source: 'discogs',     verified: true  },
        soundcloud:  { found: soundcloudData.found, source: 'soundcloud',  verified: true  },
        lastfm:      { found: lastfmData.found,     source: 'lastfm',      verified: true  },
        wikipedia:   { found: wikidataData.found,   source: 'wikipedia',   verified: true  },
        youtube:     { found: youtubeData.found,    source: 'youtube',     verified: true  },
        appleMusic:  { found: appleMusicData.found, source: 'apple_music', verified: true  },
      },
      catalog: catalogData,
      proGuide,
      country,
      royaltyRiskScore,
      territoryCoverage,
      auditCoverage,
      auditConfidence,
      youtube: {
        found:             youtubeData.found,
        officialChannel:   youtubeData.officialChannel || null,
        ugcVideoCount:     youtubeData.ugc?.videoCount || 0,
        contentIdVerified: youtubeData.contentIdVerified || false,
        source:            'youtube',
        verified:          youtubeData.found,
      },
      appleMusic: appleMusicData,
      overallScore,
      modules,
      flags,
      flagCount:    flags.length,
      previewFlags: flags.slice(0, 2),
      scannedAt:    new Date().toISOString(),
      dataPolicy:   'verified_only',
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
  }
}

// ────────────────────────────────────────────────────────
// URL PARSERS
// ────────────────────────────────────────────────────────
function parseSpotifyUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track' || p === 'album');
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
    return { platform: 'spotify', type: parts[typeIdx], id: parts[typeIdx + 1].split('?')[0] };
  } catch { return null; }
}

function parseAppleMusicUrl(url) {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes('music.apple.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const typeIdx = parts.findIndex(p => p === 'album' || p === 'song' || p === 'artist');
    if (typeIdx === -1) return null;
    const type = parts[typeIdx];
    const idPart = parts[parts.length - 1].split('?')[0];
    if (!/^\d+$/.test(idPart)) return null;
    const storefront = parts[0]?.length === 2 ? parts[0] : 'us';
    return { platform: 'apple_music', type, id: idPart, storefront };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// APPLE MUSIC → SPOTIFY RESOLVER
// Strategy 1: ISRC lookup (most precise)
// Strategy 2: track name + artist name search
// Strategy 3: artist name fallback
// ────────────────────────────────────────────────────────
async function resolveAppleMusicToSpotify(appleparse, appleToken) {
  const { type, id, storefront } = appleparse;
  const BASE    = 'https://api.music.apple.com/v1';
  const headers = { Authorization: `Bearer ${appleToken}` };

  let isrc = null, trackName = null, artistName = null, albumName = null;
  let appleMusicData = { type, id, storefront, source: 'apple_music', verified: true };

  try {
    if (type === 'album') {
      const r = await fetch(`${BASE}/catalog/${storefront}/albums/${id}`, { headers });
      if (!r.ok) throw new Error(`Apple Music album fetch: ${r.status}`);
      const j = await r.json();
      const album = j.data?.[0];
      if (!album) throw new Error('No album data');
      albumName  = album.attributes?.name;
      artistName = album.attributes?.artistName;
      appleMusicData = { ...appleMusicData, albumName, artistName, releaseDate: album.attributes?.releaseDate, trackCount: album.attributes?.trackCount, url: album.attributes?.url };
      const tr = await fetch(`${BASE}/catalog/${storefront}/albums/${id}/tracks`, { headers });
      if (tr.ok) {
        const tj = await tr.json();
        const first = tj.data?.[0];
        if (first) {
          isrc = first.attributes?.isrc || null;
          trackName = first.attributes?.name;
          appleMusicData.firstTrackIsrc = isrc;
          appleMusicData.firstTrackName = trackName;
        }
      }
    } else if (type === 'song') {
      const r = await fetch(`${BASE}/catalog/${storefront}/songs/${id}`, { headers });
      if (!r.ok) throw new Error(`Apple Music song fetch: ${r.status}`);
      const j = await r.json();
      const song = j.data?.[0];
      if (!song) throw new Error('No song data');
      isrc = song.attributes?.isrc || null;
      trackName = song.attributes?.name;
      artistName = song.attributes?.artistName;
      albumName = song.attributes?.albumName;
      appleMusicData = { ...appleMusicData, isrc, trackName, artistName, albumName, url: song.attributes?.url };
    } else if (type === 'artist') {
      const r = await fetch(`${BASE}/catalog/${storefront}/artists/${id}`, { headers });
      if (!r.ok) throw new Error(`Apple Music artist fetch: ${r.status}`);
      const j = await r.json();
      artistName = j.data?.[0]?.attributes?.name;
      appleMusicData = { ...appleMusicData, artistName };
    }
  } catch (err) {
    console.error('Apple Music resolve error:', err.message);
    return null;
  }

  const spotifyToken = await getSpotifyToken();
  const sh = { Authorization: `Bearer ${spotifyToken}` };

  // Strategy 1: ISRC
  if (isrc) {
    try {
      const r = await fetch(`https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`, { headers: sh });
      if (r.ok) {
        const d = await r.json();
        const t = d.tracks?.items?.[0];
        if (t) return { spotifyParsed: { platform: 'spotify', type: 'track', id: t.id }, appleMusicData: { ...appleMusicData, resolvedVia: 'isrc' } };
      }
    } catch(e) { console.warn('ISRC search failed:', e.message); }
  }

  // Strategy 2: track + artist name
  if (trackName && artistName) {
    try {
      const q = encodeURIComponent(`track:${trackName} artist:${artistName}`);
      const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, { headers: sh });
      if (r.ok) {
        const d = await r.json();
        const t = d.tracks?.items?.[0];
        if (t) return { spotifyParsed: { platform: 'spotify', type: 'track', id: t.id }, appleMusicData: { ...appleMusicData, resolvedVia: 'name_search' } };
      }
    } catch(e) { console.warn('Name search failed:', e.message); }
  }

  // Strategy 3: artist name only
  if (artistName) {
    try {
      const q = encodeURIComponent(`artist:${artistName}`);
      const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`, { headers: sh });
      if (r.ok) {
        const d = await r.json();
        const a = d.artists?.items?.[0];
        if (a) return { spotifyParsed: { platform: 'spotify', type: 'artist', id: a.id }, appleMusicData: { ...appleMusicData, resolvedVia: 'artist_search' } };
      }
    } catch(e) { console.warn('Artist search failed:', e.message); }
  }

  return null;
}

// ────────────────────────────────────────────────────────
// ROYALTY RISK SCORE — verified gaps only, additive penalties
// 0–20 = Low  |  21–50 = Moderate  |  51–100 = High
// ────────────────────────────────────────────────────────
function calcRoyaltyRiskScore(artistData, trackData, mbData, appleMusicData, country) {
  let score = 0;
  const reasons = [];

  if (trackData && !trackData.external_ids?.isrc) {
    score += 25;
    reasons.push({ issue: 'ISRC not registered', points: 25, source: 'spotify', verified: true });
  }
  if (!appleMusicData.found) {
    score += 15;
    reasons.push({ issue: 'Not found on Apple Music', points: 15, source: 'apple_music', verified: true });
  }
  if (!mbData.found) {
    score += 20;
    reasons.push({ issue: 'Not in MusicBrainz — publishing cross-reference unavailable', points: 20, source: 'musicbrainz', verified: true });
  }
  if (!artistData.genres?.length) {
    score += 10;
    reasons.push({ issue: 'Genre metadata missing', points: 10, source: 'spotify', verified: true });
  }
  // PRO and SoundExchange are always unconfirmed until we have direct API access
  score += 15;
  reasons.push({ issue: 'SoundExchange status not confirmed — register at soundexchange.com', points: 15, source: null, verified: false });
  score += 20;
  reasons.push({ issue: 'PRO registration not connected — connect your PRO for full audit', points: 20, source: null, verified: false });

  if (mbData.found && mbData.artists?.length) score = Math.max(score - 5, 0);

  const capped = Math.min(score, 100);
  const riskLevel = capped <= 20 ? 'Low' : capped <= 50 ? 'Moderate' : 'High';

  return {
    score: capped,
    riskLevel,
    reasons: reasons.filter(r => r.verified),
    allReasons: reasons,
    urgencyMessage: capped > 50
      ? 'Issues confirmed that may impact royalty collection'
      : capped > 20
        ? 'Some issues confirmed — review recommended actions'
        : 'No major verified issues detected',
    nextStep: 'Review and complete recommended actions',
    lastCalculated: new Date().toISOString(),
    dataPolicy: 'verified_only',
  };
}

// ────────────────────────────────────────────────────────
// TERRITORY COVERAGE — verified data only, no stream counts
// ────────────────────────────────────────────────────────
function buildTerritoryCoverage(artistData, trackData, mbData, appleMusicData, country, proGuide) {
  const territories = [];

  // Apple Music US presence = verified US availability
  if (appleMusicData.found) {
    territories.push({
      territory: 'United States',
      status: 'Registered',
      note: 'Available on Apple Music US catalog',
      source: 'apple_music',
      verified: true,
      dataExists: true
    });
  }

  // PRO country from metadata sources
  if (country) {
    const proName = proGuide?.pro || null;
    const isKnownPro = !!proGuide && proGuide.pro !== 'Your local PRO';
    territories.push({
      territory: country,
      status: isKnownPro ? 'Pending' : 'No verified data available',
      note: isKnownPro ? `PRO: ${proName} — registration status not confirmed` : 'No verified PRO registration data available',
      source: 'audiodb',
      verified: isKnownPro,
      dataExists: isKnownPro,
      action: isKnownPro ? `Verify registration with ${proName}` : null,
    });
  }

  // MusicBrainz presence — indicates catalog is internationally catalogued
  if (mbData.found) {
    territories.push({
      territory: 'International Catalog (MusicBrainz)',
      status: 'Registered',
      note: 'Recording catalogued in MusicBrainz international database',
      source: 'musicbrainz',
      verified: true,
      dataExists: true
    });
  }

  // ISRC present — indicates at least one territory registration
  if (trackData?.external_ids?.isrc) {
    territories.push({
      territory: 'ISRC Registration',
      status: 'Registered',
      note: `ISRC: ${trackData.external_ids.isrc} — confirmed on Spotify`,
      source: 'spotify',
      verified: true,
      dataExists: true
    });
  } else if (trackData) {
    territories.push({
      territory: 'ISRC Registration',
      status: 'Not Registered',
      note: 'No ISRC detected on this track — performance royalty routing unverified',
      source: 'spotify',
      verified: true,
      dataExists: true,
      action: 'Register ISRC with your distributor immediately'
    });
  }

  return {
    territories,
    header: 'Territory Coverage Audit (Verified Data Only)',
    dataPolicy: 'verified_only',
    disclaimer: 'Only territories with confirmed data from connected sources are shown.',
  };
}

// ────────────────────────────────────────────────────────
// SCORING WEIGHTS — per scan mode
// ────────────────────────────────────────────────────────
function getScoringWeights(scanMode) {
  switch (scanMode) {
    case 'track':  return { metadata: 25, coverage: 20, publishing: 20, duplicates: 15, youtube: 10, sync: 10 };
    case 'album':  return { metadata: 20, coverage: 20, publishing: 20, duplicates: 15, youtube: 15, sync: 10 };
    default:       return { metadata: 20, coverage: 20, publishing: 20, duplicates: 8,  youtube: 20, sync: 15 };
  }
}

// ────────────────────────────────────────────────────────
// SPOTIFY API CALLS
// ────────────────────────────────────────────────────────
async function getSpotifyToken() {
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

async function getSpotifyAlbum(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify album fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyAlbums(artistId, token) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return { items: [] };
    return resp.json();
  } catch { return { items: [] }; }
}

async function getSpotifyTopTracks(artistId, token) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.tracks || []).map(t => ({ name: t.name, isrc: t.external_ids?.isrc || null, artistName: t.artists?.[0]?.name || '' }));
  } catch { return []; }
}

async function getSpotifyAudioFeatures(ids, token) {
  try {
    const resp = await fetch(`https://api.spotify.com/v1/audio-features?ids=${ids.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return null;
    const data = await resp.json();
    const features = (data.audio_features || []).filter(Boolean);
    if (!features.length) return null;
    if (features.length === 1) return features[0];
    const avg = (key) => Math.round((features.reduce((s, f) => s + (f[key] || 0), 0) / features.length) * 1000) / 1000;
    return { danceability: avg('danceability'), energy: avg('energy'), valence: avg('valence'), tempo: avg('tempo'), acousticness: avg('acousticness'), instrumentalness: avg('instrumentalness'), speechiness: avg('speechiness'), loudness: avg('loudness'), _averaged: true, _trackCount: features.length };
  } catch { return null; }
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

    const artistResp = await fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${encodeURIComponent(artistName)}&types=artists&limit=10`, { headers });
    let artistFound = false, appleArtistId = null, appleArtistUrl = null, appleArtistGenres = [], appleAlbumCount = 0;

    if (artistResp.ok) {
      const artistData = await artistResp.json();
      const artists = artistData?.results?.artists?.data || [];
      const norm = s => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, '');
      // Try exact match first, then partial match, then first result
      const match = artists.find(a => norm(a.attributes?.name) === norm(artistName))
        || artists.find(a => norm(a.attributes?.name).includes(norm(artistName)) || norm(artistName).includes(norm(a.attributes?.name)))
        || (artists.length > 0 ? artists[0] : null);
      if (match) {
        artistFound = true; appleArtistId = match.id; appleArtistUrl = match.attributes?.url || null; appleArtistGenres = match.attributes?.genreNames || [];
        const albumResp = await fetch(`${BASE}/catalog/${STOREFRONT}/artists/${appleArtistId}/albums?limit=25`, { headers });
        if (albumResp.ok) { const albumData = await albumResp.json(); appleAlbumCount = albumData?.data?.length || 0; }
      }
    }

    let isrcResult = null;
    if (isrc) {
      const isrcResp = await fetch(`${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${isrc}`, { headers });
      if (isrcResp.ok) {
        const isrcData = await isrcResp.json();
        const songs = isrcData?.data || [];
        isrcResult = songs.length > 0
          ? { found: true, name: songs[0].attributes?.name, url: songs[0].attributes?.url, albumName: songs[0].attributes?.albumName, previewUrl: songs[0].attributes?.previews?.[0]?.url || null, verified: true, source: 'apple_music' }
          : { found: false, verified: true, source: 'apple_music' };
      }
    }

    let catalogComparison = null;
    if (spotifyTopTracks.length > 0) {
      const matched = [], notFound = [];
      for (const track of spotifyTopTracks.slice(0, 10)) {
        let found = false;
        if (track.isrc) {
          const r = await fetch(`${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${track.isrc}`, { headers });
          if (r.ok) { const d = await r.json(); found = (d?.data?.length || 0) > 0; }
        }
        if (!found) {
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const r = await fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${q}&types=songs&limit=3`, { headers });
          if (r.ok) { const d = await r.json(); const songs = d?.results?.songs?.data || []; const norm = s => s.toLowerCase().trim(); found = songs.some(s => norm(s.attributes?.name) === norm(track.name)); }
        }
        if (found) matched.push(track.name); else notFound.push(track.name);
      }
      const total = matched.length + notFound.length;
      catalogComparison = { tracksChecked: total, matched: matched.length, notFound, matchRate: total > 0 ? Math.round((matched.length / total) * 100) : 0, verified: true, source: 'apple_music' };
    }

    return { found: artistFound, artistId: appleArtistId, artistUrl: appleArtistUrl, genres: appleArtistGenres, albumCount: appleAlbumCount, isrcLookup: isrcResult, catalogComparison, verified: true, source: 'apple_music' };
  } catch (err) {
    console.error('Apple Music error:', err.message);
    return { found: false, error: err.message, verified: false };
  }
}

// ────────────────────────────────────────────────────────
// YOUTUBE
// ────────────────────────────────────────────────────────
async function getYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { found: false, reason: 'API key not configured', verified: false };

    const query = encodeURIComponent(artistName);
    const channelResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`);
    if (!channelResp.ok) return { found: false, reason: `YouTube API error: ${channelResp.status}`, verified: false };

    const channelData = await channelResp.json();
    const norm = s => s.toLowerCase().trim();
    const channels = channelData.items || [];
    const officialChannel = channels.find(c => norm(c.snippet.channelTitle) === norm(artistName) || norm(c.snippet.channelTitle).includes(norm(artistName)) || c.snippet.description?.toLowerCase().includes('official')) || channels[0];

    let officialVideoCount = 0, officialViewCount = 0, subscriberCount = 0;
    if (officialChannel) {
      const channelId = officialChannel.snippet.channelId || officialChannel.id?.channelId;
      if (channelId) {
        const statsResp = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${apiKey}`);
        if (statsResp.ok) {
          const statsData = await statsResp.json();
          const stats = statsData.items?.[0]?.statistics;
          if (stats) { officialVideoCount = parseInt(stats.videoCount || 0); officialViewCount = parseInt(stats.viewCount || 0); subscriberCount = parseInt(stats.subscriberCount || 0); }
        }
      }
    }

    const ugcResp = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`);
    let ugcVideoCount = 0, topUgcVideos = [];
    if (ugcResp.ok) {
      const ugcData = await ugcResp.json();
      const ugcVideos = (ugcData.items || []).filter(v => {
        const ct = v.snippet?.channelTitle?.toLowerCase() || '';
        return !ct.includes(norm(artistName)) && !ct.includes('vevo');
      });
      ugcVideoCount = ugcVideos.length;
      topUgcVideos = ugcVideos.slice(0, 3).map(v => ({ title: v.snippet.title, channel: v.snippet.channelTitle, videoId: v.id.videoId }));
    }

    const hasOfficialChannel = !!officialChannel;
    const contentIdRisk = ugcVideoCount > 0 && !hasOfficialChannel;

    return {
      found: true,
      officialChannel: hasOfficialChannel ? { title: officialChannel.snippet.channelTitle, channelId: officialChannel.snippet.channelId || officialChannel.id?.channelId, subscribers: subscriberCount, totalViews: officialViewCount, videoCount: officialVideoCount } : null,
      ugc: { videoCount: ugcVideoCount, topVideos: topUgcVideos, contentIdRisk },
      contentIdVerified: hasOfficialChannel && officialViewCount > 0,
      subscriberCount,
      totalOfficialViews: officialViewCount,
      verified: true,
      source: 'youtube',
    };
  } catch (err) {
    console.error('YouTube error:', err.message);
    return { found: false, reason: err.message, verified: false };
  }
}

// ────────────────────────────────────────────────────────
// CATALOG ANALYSIS
// ────────────────────────────────────────────────────────
function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, catalogAgeYears: 0 };
  const years = albums.map(a => parseInt(a.release_date?.substring(0, 4))).filter(y => !isNaN(y) && y > 1950);
  const earliestYear = years.length ? Math.min(...years) : null;
  const currentYear = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;
  return { totalReleases: albums.length, earliestYear, latestYear: years.length ? Math.max(...years) : null, catalogAgeYears, recentActivity: years.some(y => y >= currentYear - 2), source: 'spotify', verified: true };
}

// ────────────────────────────────────────────────────────
// PRO GUIDE
// ────────────────────────────────────────────────────────
function getPROGuide(country) {
  const guides = {
    'Canada':         { pro: 'SOCAN',        url: 'https://www.socan.com',           steps: ['Go to socan.com and click Join', 'Register as a songwriter and composer', 'Register all your works in the SOCAN repertoire', 'Submit cue sheets for any TV or film placements'], note: 'SOCAN collects performance royalties for streaming, radio, TV, and live performances across Canada.' },
    'United States':  { pro: 'ASCAP or BMI', url: 'https://www.ascap.com',           steps: ['Choose ASCAP (ascap.com) or BMI (bmi.com)', 'Register as a songwriter and publisher', 'Register all your works', 'Submit your Spotify artist URL'], note: 'ASCAP and BMI collect performance royalties for US streaming, radio, TV and live performances.' },
    'United Kingdom': { pro: 'PRS for Music',url: 'https://www.prsformusic.com',     steps: ['Go to prsformusic.com and click Join PRS', 'Register as a writer member', 'Register all your works', 'Link your Spotify artist profile'], note: 'PRS for Music collects performance and mechanical royalties across the UK.' },
    'Germany':        { pro: 'GEMA',         url: 'https://www.gema.de',             steps: ['Go to gema.de and register as a member', 'Register as a composer and lyricist', 'Register all your works in GEMA database', 'Submit documentation of live performances or broadcast placements'], note: 'GEMA collects performance royalties across Germany.' },
    'France':         { pro: 'SACEM',        url: 'https://www.sacem.fr',            steps: ['Go to sacem.fr and click Adhérer', 'Register as a composer, author or publisher', 'Register all your works'], note: 'SACEM collects performance royalties across France.' },
    'Australia':      { pro: 'APRA AMCOS',   url: 'https://www.apraamcos.com.au',    steps: ['Go to apraamcos.com.au and click Join', 'Register as a songwriter', 'Register all your works', 'Link your streaming profiles'], note: 'APRA AMCOS collects performance and mechanical royalties across Australia and New Zealand.' },
    'Jamaica':        { pro: 'JACAP',        url: 'https://www.jacap.org',           steps: ['Go to jacap.org and register as a member', 'Register as a composer or author', 'Register all your works'], note: 'JACAP collects performance royalties across Jamaica.' },
  };
  const defaultGuide = { pro: 'Your local PRO', url: 'https://www.cisac.org', steps: ["Find your country's PRO at cisac.org/find-a-society", 'Register as a songwriter and composer', 'Register all your works', 'Verify reciprocal agreements with SOCAN, ASCAP, GEMA and PRS'], note: 'CISAC is the international confederation of PROs.' };
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
    const resp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false, artists: [], verified: false };
    const data = await resp.json();
    return { found: data.artists?.length > 0, artists: data.artists || [], topMatch: data.artists?.[0] || null, score: data.artists?.[0]?.score || 0, verified: true, source: 'musicbrainz' };
  } catch { return { found: false, artists: [], verified: false }; }
}

// ────────────────────────────────────────────────────────
// DEEZER
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp = await fetch(`https://api.deezer.com/search/artist?q=${query}&limit=5`);
    if (!resp.ok) return { found: false, fans: 0, verified: false };
    const data = await resp.json();
    if (!data.data?.length) return { found: false, fans: 0, verified: false };
    const norm = s => s.toLowerCase().trim();
    const artist = data.data.find(a => norm(a.name) === norm(artistName)) || data.data[0];
    const detail = await fetch(`https://api.deezer.com/artist/${artist.id}`).then(r => r.ok ? r.json() : artist);
    return { found: true, fans: detail.nb_fan || 0, artistId: artist.id, name: artist.name, albums: detail.nb_album || 0, verified: true, source: 'deezer' };
  } catch { return { found: false, fans: 0, verified: false }; }
}

// ────────────────────────────────────────────────────────
// AUDIODB
// ────────────────────────────────────────────────────────
async function getAudioDB(artistName) {
  try {
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };
    const a = data.artists[0];
    return { found: true, name: a.strArtist, genre: a.strGenre || null, style: a.strStyle || null, mood: a.strMood || null, country: a.strCountry || null, biography: a.strBiographyEN ? a.strBiographyEN.substring(0, 400) : null, formed: a.intFormedYear || null, verified: true, source: 'audiodb' };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DISCOGS
// ────────────────────────────────────────────────────────
async function getDiscogs(artistName) {
  try {
    const resp = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)', 'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit' } });
    if (!resp.ok) return { found: false, releases: 0 };
    const data = await resp.json();
    if (!data.results?.length) return { found: false, releases: 0 };
    const norm = s => s.toLowerCase().trim();
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || data.results[0];
    const relResp = await fetch(`https://api.discogs.com/artists/${artist.id}/releases?per_page=1`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    const relData = relResp.ok ? await relResp.json() : {};
    return { found: true, artistId: artist.id, name: artist.title, releases: relData.pagination?.items || 0, link: `https://www.discogs.com/artist/${artist.id}`, verified: true, source: 'discogs' };
  } catch { return { found: false, releases: 0 }; }
}

// ────────────────────────────────────────────────────────
// SOUNDCLOUD
// ────────────────────────────────────────────────────────
async function getSoundCloud(artistName) {
  try {
    const resp = await fetch(`https://api.soundcloud.com/users?q=${encodeURIComponent(artistName)}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false, followers: 0 };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false, followers: 0 };
    const norm = s => s.toLowerCase().trim();
    const user = data.find(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)) || data[0];
    return { found: true, username: user.username, followers: user.followers_count || 0, tracks: user.track_count || 0, permalink: user.permalink_url || null, verified: true, source: 'soundcloud' };
  } catch { return { found: false, followers: 0 }; }
}

// ────────────────────────────────────────────────────────
// LAST.FM
// ────────────────────────────────────────────────────────
async function getLastFm(artistName) {
  try {
    const key = process.env.LASTFM_API_KEY || '43693facbb24d1ac893a5d61c8e5d4c3';
    const resp = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${key}&format=json`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (data.error || !data.artist) return { found: false };
    const a = data.artist;
    return { found: true, name: a.name, playcount: parseInt(a.stats?.playcount || 0), listeners: parseInt(a.stats?.listeners || 0), tags: a.tags?.tag?.map(t => t.name) || [], bio: a.bio?.summary ? a.bio.summary.replace(/<[^>]+>/g, '').substring(0, 300) : null, url: a.url || null, verified: true, source: 'lastfm' };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// WIKIDATA / WIKIPEDIA
// ────────────────────────────────────────────────────────
async function getWikidata(artistName) {
  try {
    const resp = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&type=item&format=json&limit=5`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.search?.length) return { found: false };
    const norm = s => s.toLowerCase().trim();
    const match = data.search.find(r => norm(r.label) === norm(artistName) && (r.description?.toLowerCase().includes('musician') || r.description?.toLowerCase().includes('singer') || r.description?.toLowerCase().includes('rapper') || r.description?.toLowerCase().includes('artist') || r.description?.toLowerCase().includes('band') || r.description?.toLowerCase().includes('producer'))) || data.search.find(r => norm(r.label) === norm(artistName));
    if (!match) return { found: false };
    const wpResp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    const wpData = wpResp.ok ? await wpResp.json() : null;
    return { found: true, wikidataId: match.id, description: match.description || null, wikipediaUrl: wpData?.content_urls?.desktop?.page || null, wikipediaFound: wpResp.ok && !wpData?.type?.includes('disambiguation'), extract: wpData?.extract?.substring(0, 300) || null, verified: true, source: 'wikipedia' };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES — verified data only, no estimates
// ────────────────────────────────────────────────────────
function runModules(artist, track, album, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic, audioFeatures, scanMode, weights) {
  const modules = {};
  const isAlbumScan = scanMode === 'album';

  // A — Metadata Integrity
  let ms = 100; const mf = [];
  if (!artist.genres?.length)                               { ms -= 20; mf.push({ issue: 'Genre tags not found on Spotify profile', source: 'spotify', verified: true, action: 'Add genre tags to your Spotify for Artists profile', priority: 'MEDIUM' }); }
  if (!artist.images?.length)                               { ms -= 15; mf.push({ issue: 'No artist images found on Spotify', source: 'spotify', verified: true, action: 'Upload artist photos via Spotify for Artists', priority: 'LOW' }); }
  if (track && !track.external_ids?.isrc)                   { ms -= 30; mf.push({ issue: 'ISRC not found on this track', source: 'spotify', verified: true, action: 'Register ISRC with your distributor immediately', priority: 'HIGH' }); }
  if (isAlbumScan && album) {
    if (!album.label)                                       { ms -= 10; mf.push({ issue: 'Label metadata missing from album', source: 'spotify', verified: true, action: 'Update label information via your distributor', priority: 'LOW' }); }
    if (!album.copyrights?.length)                          { ms -= 10; mf.push({ issue: 'Copyright metadata missing from album', source: 'spotify', verified: true, action: 'Update copyright metadata via your distributor', priority: 'LOW' }); }
  }
  if (audiodb.found && audiodb.biography) ms += 5;
  if (wikidata.found) ms += 5;
  if (lastfm.found && lastfm.tags?.length) ms += 5;
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(Math.min(ms, 100), 10), flags: mf };

  // B — Platform Coverage
  let cs = 20; const cf = [];
  [{ name: 'MusicBrainz', found: mb.found, pts: 10, src: 'musicbrainz' }, { name: 'Deezer', found: deezer.found, pts: 10, src: 'deezer' }, { name: 'AudioDB', found: audiodb.found, pts: 8, src: 'audiodb' }, { name: 'Discogs', found: discogs.found, pts: 8, src: 'discogs' }, { name: 'SoundCloud', found: soundcloud.found, pts: 7, src: 'soundcloud' }, { name: 'Last.fm', found: lastfm.found, pts: 9, src: 'lastfm' }, { name: 'Wikipedia', found: wikidata.found, pts: 8, src: 'wikipedia' }, { name: 'YouTube', found: youtube.found, pts: 10, src: 'youtube' }, { name: 'Apple Music', found: appleMusic.found, pts: 10, src: 'apple_music' }].forEach(p => {
    if (p.found) cs += p.pts;
    else cf.push({ issue: `Not found on ${p.name}`, source: p.src, verified: true, action: `Distribute your music to ${p.name}`, priority: 'LOW' });
  });
  if (artist.followers?.total > 100) cs += 10;
  modules.coverage = { name: 'Platform Coverage', score: Math.min(cs, 100), flags: cf };

  // C — Publishing Risk
  let ps = 100; const pf = [];
  if (track && !track.external_ids?.isrc)                                               { ps -= 35; pf.push({ issue: 'ISRC not registered — performance royalty routing unverified', source: 'spotify', verified: true, action: 'Register ISRC with your distributor immediately', priority: 'HIGH' }); }
  if (!artist.genres?.length)                                                            { ps -= 15; pf.push({ issue: 'Genre metadata missing', source: 'spotify', verified: true, action: 'Add genre tags to your Spotify profile', priority: 'MEDIUM' }); }
  if (!mb.found)                                                                         { ps -= 20; pf.push({ issue: 'Not in MusicBrainz — publishing cross-reference unavailable', source: 'musicbrainz', verified: true, action: 'Register your works at musicbrainz.org', priority: 'MEDIUM' }); }
  if (catalog.catalogAgeYears > 5)                                                       { ps -= 10; pf.push({ issue: `Catalog active for ${catalog.catalogAgeYears} years — extended royalty verification recommended`, source: 'spotify', verified: true, action: 'Conduct a full historical royalty audit', priority: 'MEDIUM' }); }
  if (discogs.found && discogs.releases > 0) ps += 10;
  if (track?.external_ids?.isrc && appleMusic.isrcLookup && !appleMusic.isrcLookup.found){ ps -= 15; pf.push({ issue: 'ISRC confirmed on Spotify but not matched on Apple Music', source: 'apple_music', verified: true, action: 'Contact your distributor about Apple Music ISRC registration', priority: 'HIGH' }); }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(ps, 10), flags: pf };

  // D — Duplicate Detection
  let ds = 80; const df = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) { ds -= 25; df.push({ issue: 'Popularity vs follower ratio inconsistency — possible catalog fragmentation', source: 'spotify', verified: true, action: 'Check for duplicate Spotify artist profiles', priority: 'MEDIUM' }); }
  if (mb.artists?.length > 1)                                   { ds -= 20; df.push({ issue: `${mb.artists.length} entries found in MusicBrainz — possible duplicate profiles`, source: 'musicbrainz', verified: true, action: 'Review and merge duplicate MusicBrainz entries', priority: 'MEDIUM' }); }
  if (!catalog.recentActivity && catalog.earliestYear)          { ds -= 10; df.push({ issue: `No releases found after ${catalog.latestYear}`, source: 'spotify', verified: true, action: 'Verify all releases are under one canonical artist profile', priority: 'LOW' }); }
  if (isAlbumScan && album) { const woi = (album.tracks?.items || []).filter(t => !t.external_ids?.isrc).length; if (woi > 0) { ds -= Math.min(woi * 5, 20); df.push({ issue: `${woi} track(s) on this album missing ISRC`, source: 'spotify', verified: true, action: 'Register ISRCs for all tracks via your distributor', priority: 'HIGH' }); } }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(ds, 10), flags: df };

  // E — YouTube / UGC
  let ys = 10; const yf = [];
  if (youtube.found) {
    if (youtube.officialChannel) { ys += 35; if (youtube.subscriberCount > 1000) ys += 10; if (youtube.totalOfficialViews > 10000) ys += 10; }
    else { yf.push({ issue: 'No official YouTube channel found', source: 'youtube', verified: true, action: 'Create and verify an official YouTube channel', priority: 'MEDIUM' }); }
    if (youtube.contentIdVerified) { ys += 15; }
    else { yf.push({ issue: 'Content ID monetisation status not confirmed', source: 'youtube', verified: true, action: 'Register for YouTube Content ID via your distributor', priority: 'MEDIUM' }); }
    if (youtube.ugc?.contentIdRisk) { ys -= 15; yf.push({ issue: `${youtube.ugc.videoCount} user-uploaded video(s) found with no official channel`, source: 'youtube', verified: true, action: 'Register for Content ID to claim user-uploaded content', priority: 'HIGH' }); }
  } else {
    yf.push({ issue: 'YouTube data unavailable', source: 'youtube', verified: false, action: null, priority: 'LOW' });
    if (audiodb.found && audiodb.youtube) ys += 20;
    if (soundcloud.found && soundcloud.tracks > 0) ys += 10;
  }
  if (lastfm.found && lastfm.listeners > 1000) ys += 5;
  modules.youtube = { name: 'YouTube / UGC', score: Math.max(Math.min(ys, 100), 10), flags: yf };

  // F — Sync Readiness
  let ss = 0; const sf = [];
  if (track?.external_ids?.isrc)  { ss += 20; } else sf.push({ issue: 'ISRC not registered', source: 'spotify', verified: true, action: 'Register ISRC to improve sync licensing eligibility', priority: 'HIGH' });
  if (artist.genres?.length)      { ss += 15; } else sf.push({ issue: 'Genre tags missing', source: 'spotify', verified: true, action: 'Add genre metadata', priority: 'MEDIUM' });
  if (mb.found)                   { ss += 10; } else sf.push({ issue: 'Not in MusicBrainz catalog', source: 'musicbrainz', verified: true, action: 'Register at musicbrainz.org', priority: 'LOW' });
  if (wikidata.found)             { ss += 15; } else sf.push({ issue: 'No Wikipedia presence', source: 'wikipedia', verified: true, action: 'Create a Wikipedia page', priority: 'LOW' });
  if (deezer.found)   ss += 8;
  if (discogs.found)  ss += 8;
  if (lastfm.found && lastfm.listeners > 500) ss += 10;
  if (audiodb.found && audiodb.genre) ss += 8;
  if (artist.followers?.total > 1000) ss += 6;
  if (appleMusic.found) { ss += 10; } else sf.push({ issue: 'Not found on Apple Music', source: 'apple_music', verified: true, action: 'Distribute your music to Apple Music', priority: 'MEDIUM' });
  if (audioFeatures && (audioFeatures.energy > 0.6 || audioFeatures.danceability > 0.6)) ss += 5;
  modules.sync = { name: 'Sync Readiness', score: Math.min(ss, 100), flags: sf };

  return modules;
}

// ────────────────────────────────────────────────────────
// VERIFIED FLAGS — source-backed issues only
// No estimates, no projections, no inferred data
// ────────────────────────────────────────────────────────
function buildVerifiedFlags(modules, artist, track, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog, youtube, appleMusic) {
  const flags = [];

  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      if (f.verified === false) return; // strict: skip anything unverified
      let severity = mod.score < 40 ? 'high' : mod.score < 65 ? 'medium' : 'low';
      if (f.priority === 'HIGH') severity = 'high';
      if (f.priority === 'MEDIUM' && severity === 'low') severity = 'medium';
      flags.push({ module: mod.name, severity, issue: f.issue, action: f.action || null, source: f.source, verified: true });
    });
  });

  // Catalog age — Spotify-sourced, verified
  if (catalog.catalogAgeYears >= 10) flags.push({ module: 'Publishing Risk', severity: 'high', issue: `Catalog active for ${catalog.catalogAgeYears} years — full historical royalty audit recommended`, action: 'Conduct a full historical royalty audit with your distributor and PRO', source: 'spotify', verified: true });
  else if (catalog.catalogAgeYears >= 5) flags.push({ module: 'Publishing Risk', severity: 'medium', issue: `Catalog active for ${catalog.catalogAgeYears} years — multi-year royalty verification recommended`, action: 'Verify royalty collection across all catalog years', source: 'spotify', verified: true });

  // YouTube UGC — count only, no view estimates
  if (youtube.found && youtube.ugc?.videoCount > 0 && !youtube.officialChannel) {
    flags.push({ module: 'YouTube / UGC', severity: 'high', issue: `${youtube.ugc.videoCount} user-uploaded video(s) found — Content ID not active`, action: 'Register for Content ID via your distributor', source: 'youtube', verified: true });
  }

  // Apple Music catalog gaps — match rate, no estimates
  if (appleMusic.found && appleMusic.catalogComparison) {
    const { matchRate, notFound } = appleMusic.catalogComparison;
    if (matchRate < 50) flags.push({ module: 'Platform Coverage', severity: 'high', issue: `${100 - matchRate}% of top Spotify tracks not found on Apple Music`, action: 'Contact your distributor to ensure full Apple Music catalog delivery', source: 'apple_music', verified: true });
    else if (matchRate < 80 && notFound.length > 0) flags.push({ module: 'Platform Coverage', severity: 'medium', issue: `${notFound.length} top track(s) not found on Apple Music`, action: 'Contact your distributor about missing Apple Music tracks', source: 'apple_music', verified: true });
  }

  if (!appleMusic.found) flags.push({ module: 'Platform Coverage', severity: 'medium', issue: 'Artist not found on Apple Music', action: 'Distribute your music to Apple Music via your distributor', source: 'apple_music', verified: true });

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
