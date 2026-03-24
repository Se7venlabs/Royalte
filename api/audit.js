// Royalte Audit API — /api/audit.js
// Vercel serverless function
// Platforms: Spotify + MusicBrainz + Deezer (no API key needed for Deezer)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // ── STEP 1: Parse URL ─────────────────────────────────────
    const parsed = parseSpotifyUrl(url);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid URL. Please paste your Spotify artist link.'
      });
    }

    // ── STEP 2: Spotify token ─────────────────────────────────
    const token = await getSpotifyToken();

    // ── STEP 3: Spotify data ──────────────────────────────────
    let artistData, trackData;
    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData  = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    // ── STEP 4: MusicBrainz cross-reference ──────────────────
    const mbData = await getMusicBrainz(artistData.name);

    // ── STEP 5: Deezer cross-reference (no API key needed) ───
    const deezerData = await getDeezer(artistData.name);

    // ── STEP 6: Run detection modules ────────────────────────
    const modules = runModules(artistData, trackData, mbData, deezerData);

    // ── STEP 7: Overall score ─────────────────────────────────
    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    // ── STEP 8: Build flags ───────────────────────────────────
    const flags = buildFlags(modules, artistData, trackData, deezerData);

    // ── STEP 9: Return ────────────────────────────────────────
    return res.status(200).json({
      success:       true,
      platform:      parsed.platform,
      type:          parsed.type,
      artistName:    artistData.name,
      artistId:      artistData.id,
      followers:     artistData.followers?.total || 0,
      popularity:    artistData.popularity || 0,
      genres:        artistData.genres || [],
      trackTitle:    trackData?.name || null,
      trackIsrc:     trackData?.external_ids?.isrc || null,
      deezerFound:   deezerData.found,
      deezerFans:    deezerData.fans || 0,
      mbFound:       mbData.found,
      overallScore,
      modules,
      flags,
      flagCount:     flags.length,
      previewFlags:  flags.slice(0, 2),
      scannedAt:     new Date().toISOString(),
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({
      error: 'Audit failed. Please check the link and try again.',
      detail: err.message
    });
  }
}

// ────────────────────────────────────────────────────────
// URL PARSER
// ────────────────────────────────────────────────────────
function parseSpotifyUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
    return {
      platform: 'spotify',
      type:     parts[typeIdx],
      id:       parts[typeIdx + 1].split('?')[0]
    };
  } catch { return null; }
}

// ────────────────────────────────────────────────────────
// SPOTIFY
// ────────────────────────────────────────────────────────
async function getSpotifyToken() {
  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
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

// ────────────────────────────────────────────────────────
// MUSICBRAINZ — no API key needed
// ────────────────────────────────────────────────────────
async function getMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp  = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, artists: [] };
    const data = await resp.json();
    return {
      found:    data.artists && data.artists.length > 0,
      artists:  data.artists || [],
      topMatch: data.artists?.[0] || null,
      score:    data.artists?.[0]?.score || 0
    };
  } catch { return { found: false, artists: [] }; }
}

// ────────────────────────────────────────────────────────
// DEEZER — no API key needed, completely free
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://api.deezer.com/search/artist?q=${query}&limit=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, fans: 0, artistId: null };
    const data = await resp.json();

    if (!data.data || data.data.length === 0) {
      return { found: false, fans: 0, artistId: null };
    }

    // Find closest name match
    const normalise = s => s.toLowerCase().trim();
    const exact = data.data.find(a => normalise(a.name) === normalise(artistName));
    const artist = exact || data.data[0];

    // Get full artist details including fan count
    const detailResp = await fetch(`https://api.deezer.com/artist/${artist.id}`);
    const detail = detailResp.ok ? await detailResp.json() : artist;

    return {
      found:    true,
      fans:     detail.nb_fan || 0,
      artistId: artist.id,
      name:     artist.name,
      albums:   detail.nb_album || 0,
      link:     artist.link || `https://www.deezer.com/artist/${artist.id}`,
    };
  } catch { return { found: false, fans: 0, artistId: null }; }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES
// ────────────────────────────────────────────────────────
function runModules(artist, track, mb, deezer) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres || artist.genres.length === 0) {
    metaScore -= 25; metaFlags.push('Genre tags not detected on Spotify profile');
  }
  if (!artist.images || artist.images.length === 0) {
    metaScore -= 20; metaFlags.push('No artist images found');
  }
  if (track && !track.external_ids?.isrc) {
    metaScore -= 35; metaFlags.push('ISRC signal not detected on this track');
  }
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(metaScore, 10), flags: metaFlags };

  // MODULE B — Platform Coverage (now includes Deezer)
  let covScore = 40; // Spotify confirmed = base 40
  const covFlags = [];
  if (mb.found && mb.score > 80) {
    covScore += 20;
  } else {
    covFlags.push('MusicBrainz listing not detected');
  }
  if (deezer.found) {
    covScore += 25;
  } else {
    covFlags.push('Deezer presence not detected — coverage risk');
  }
  if (artist.followers?.total > 100) covScore += 15;
  else covFlags.push('Low follower count — possible fragmentation signal');
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  // MODULE C — Publishing Risk
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) {
    pubScore -= 40; pubFlags.push('ISRC not detected — performance royalty routing unverified');
  }
  if (!artist.genres || artist.genres.length === 0) {
    pubScore -= 20; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk');
  }
  if (!mb.found) {
    pubScore -= 25; pubFlags.push('Not in MusicBrainz — publishing data cross-reference unavailable');
  }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  // MODULE D — Duplicate Detection
  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) {
    dupScore -= 30; dupFlags.push('Popularity vs follower ratio — possible catalog fragmentation signal');
  }
  if (mb.artists && mb.artists.length > 1) {
    dupScore -= 20; dupFlags.push(`${mb.artists.length} MusicBrainz entries detected — possible duplicate profiles`);
  }
  // Deezer fan count vs Spotify followers — fragmentation signal
  if (deezer.found && deezer.fans > 0 && artist.followers?.total > 0) {
    const ratio = deezer.fans / artist.followers.total;
    if (ratio > 10 || ratio < 0.1) {
      dupScore -= 15; dupFlags.push('Significant gap between Deezer fans and Spotify followers — fragmentation signal');
    }
  }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  // MODULE E — YouTube / UGC
  modules.youtube = {
    name:  'YouTube / UGC',
    score: 30,
    flags: ['YouTube presence unverified — no YouTube API key configured']
  };

  // MODULE F — Sync Readiness
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc)     syncScore += 25; else syncFlags.push('ISRC signal not detected');
  if (artist.images?.length > 0)      syncScore += 15;
  if (artist.genres?.length > 0)      syncScore += 20; else syncFlags.push('Genre tags absent');
  if (mb.found)                        syncScore += 20; else syncFlags.push('Not in MusicBrainz catalog');
  if (deezer.found)                    syncScore += 10;
  if (artist.followers?.total > 1000) syncScore += 10;
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

// ────────────────────────────────────────────────────────
// BUILD FLAGS
// ────────────────────────────────────────────────────────
function buildFlags(modules, artist, track, deezer) {
  const flags = [];

  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40) severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });

  // Extra Deezer-specific flag
  if (!deezer.found) {
    flags.push({
      module: 'Platform Coverage',
      severity: 'medium',
      description: 'Artist not detected on Deezer — potential revenue surface area unconfirmed on this platform'
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
