// Royaltē — /api/identify
//
// Fast artist identification endpoint. Runs ONLY the artist resolution phase —
// no intelligence, no enrichment, no DB writes. Returns in ~1-4s for most inputs.
//
// Fired in parallel with /api/audit by the homepage scan. When this resolves
// the frontend shows "Music Ecosystem Verified" immediately, while the full
// audit continues building intelligence in the background.
//
// Response:
//   { verified: true,  artistName, spotifyArtistId, appleArtistId, spotifyMatched }
//   { verified: false, error }   — on resolution failure (not an HTTP error)
//
// Rate limit: separate budget (higher than /api/audit — one identify + one audit per scan).

import { extractIp, checkBlocked, checkRateLimit } from './_lib/rate-limit.js';
import { resolveAppleArtist } from './_lib/identity/apple.js';
import { getArtistSongs }     from './apple-music.js';

// ── Input type detection (mirrors run-scan.js) ────────────────────────────
function detectInputType(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('spotify.com/artist')) return 'spotify_artist';
  if (u.includes('spotify.com/track'))  return 'spotify_track';
  if (u.includes('spotify.com/album'))  return 'spotify_album';
  if (u.includes('music.apple.com'))    return 'apple';
  return 'unknown';
}

// ── Spotify helpers (minimal subset of run-scan.js) ──────────────────────
function extractSpotifyId(url, kind) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === kind);
    return (idx !== -1 && parts[idx + 1]) ? parts[idx + 1].split('?')[0] : null;
  } catch { return null; }
}

function cleanArtistName(name) {
  return String(name || '').replace(/\([^)]*\)/g,'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim();
}

async function getSpotifyToken() {
  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
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
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyTrack(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyAlbum(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Spotify album fetch failed: ${resp.status}`);
  return resp.json();
}

async function searchSpotifyArtistByName(name, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return null;
    const data  = await resp.json();
    const items = data?.artists?.items || [];
    const norm  = s => s.toLowerCase().trim();
    return items.find(a => norm(a.name) === norm(name)) || null;
  } catch { return null; }
}

async function discoverSpotifyByIsrc(isrc, token) {
  if (!isrc) return null;
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/search?q=isrc:${encodeURIComponent(isrc)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.tracks?.items?.[0]?.artists?.[0]?.id || null;
  } catch { return null; }
}

// ── Core resolution — mirrors resolveToArtist in run-scan.js ────────────
// Returns { artistName, artistId, appleArtistId, spotifyMatched } or throws.
// Omits image resolution (not needed for early verification).
async function resolveArtist(url, inputType, token) {
  if (inputType === 'spotify_artist') {
    const id = extractSpotifyId(url, 'artist');
    if (!id) throw new Error('Could not parse Spotify artist URL');
    const artist = await getSpotifyArtist(id, token);
    return { artistName: artist.name, artistId: artist.id, appleArtistId: null, spotifyMatched: true };
  }

  if (inputType === 'spotify_track') {
    const trackId = extractSpotifyId(url, 'track');
    if (!trackId) throw new Error('Could not parse Spotify track URL');
    const track     = await getSpotifyTrack(trackId, token);
    const artistRef = track.artists?.[0];
    if (!artistRef?.id) throw new Error('Track has no associated artist');
    const artist = await getSpotifyArtist(artistRef.id, token);
    return { artistName: artist.name, artistId: artist.id, appleArtistId: null, spotifyMatched: true };
  }

  if (inputType === 'spotify_album') {
    const albumId = extractSpotifyId(url, 'album');
    if (!albumId) throw new Error('Could not parse Spotify album URL');
    const album     = await getSpotifyAlbum(albumId, token);
    const artistRef = album.artists?.[0];
    if (!artistRef?.id) throw new Error('Album has no associated artist');
    const artist = await getSpotifyArtist(artistRef.id, token);
    return { artistName: artist.name, artistId: artist.id, appleArtistId: null, spotifyMatched: true };
  }

  if (inputType === 'apple') {
    const appleResolved = await resolveAppleArtist(url);
    if (!appleResolved?.name) throw new Error('Could not resolve artist from Apple Music link');

    const appleArtistName = appleResolved.name;
    const appleArtistId   = appleResolved.appleArtistId || null;
    const appleStorefront = appleResolved.storefront || 'us';

    // Spotify name search
    let spotifyArtist = await searchSpotifyArtistByName(appleArtistName, token);
    if (!spotifyArtist) {
      const cleaned = cleanArtistName(appleArtistName);
      if (cleaned && cleaned !== appleArtistName) {
        spotifyArtist = await searchSpotifyArtistByName(cleaned, token);
      }
    }

    // ISRC bridge — cap at 8 songs to keep identify fast
    if (!spotifyArtist && appleArtistId) {
      try {
        const songs = await getArtistSongs(appleArtistId, appleStorefront, 8);
        const norm  = s => (s || '').toLowerCase().trim();
        for (const song of songs) {
          const candidateId = await discoverSpotifyByIsrc(song.isrc, token);
          if (!candidateId) continue;
          try {
            const verifyArtist = await getSpotifyArtist(candidateId, token);
            if (verifyArtist && norm(verifyArtist.name) === norm(appleArtistName)) {
              spotifyArtist = verifyArtist;
              break;
            }
          } catch { continue; }
        }
      } catch { /* non-blocking */ }
    }

    return {
      artistName:     appleArtistName,
      artistId:       spotifyArtist?.id || null,
      appleArtistId,
      spotifyMatched: !!spotifyArtist,
    };
  }

  throw new Error('Unknown input type');
}

// ── Handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ verified: false, error: 'No URL provided' });

  const inputType = detectInputType(url);
  if (inputType === 'unknown') {
    return res.status(400).json({ verified: false, error: 'Invalid URL' });
  }

  // Fail-open rate limit — a DB error must not block the identify fast path.
  try {
    const ip      = extractIp(req);
    const blocked = await checkBlocked(ip);
    if (blocked.blocked) return res.status(429).json({ verified: false, error: 'rate_limited' });
    const limit = await checkRateLimit(ip, 'identify', {
      burst: { max: 5 },
      hour:  { max: 60 },
      day:   { max: 200 },
    });
    if (!limit.allowed) return res.status(429).json({ verified: false, error: 'rate_limited' });
  } catch { /* fail-open */ }

  try {
    const token    = await getSpotifyToken();
    const resolved = await resolveArtist(url, inputType, token);
    return res.status(200).json({
      verified:        true,
      artistName:      resolved.artistName,
      spotifyArtistId: resolved.artistId || null,
      appleArtistId:   resolved.appleArtistId || null,
      spotifyMatched:  resolved.spotifyMatched,
    });
  } catch (err) {
    console.error('[identify] resolution failed:', err.message);
    return res.status(200).json({ verified: false, error: err.message });
  }
}
