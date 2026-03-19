// Royalte Audit API — /api/audit.js
// Vercel serverless function — drop this in your /api folder
// Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Vercel environment variables

export default async function handler(req, res) {
  // CORS headers — allow calls from your domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // ── STEP 1: Parse the URL ──────────────────────────────────
    const parsed = parseSpotifyUrl(url);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid URL. Please paste a Spotify artist or track link.'
      });
    }

    // ── STEP 2: Get Spotify access token ──────────────────────
    const token = await getSpotifyToken();

    // ── STEP 3: Pull real data from Spotify ───────────────────
    let artistData, trackData;
    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData  = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    // ── STEP 4: Cross-reference MusicBrainz ───────────────────
    const mbData = await getMusicBrainz(artistData.name);

    // ── STEP 5: Run detection modules ─────────────────────────
    const modules = runModules(artistData, trackData, mbData);

    // ── STEP 6: Calculate overall score ───────────────────────
    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    // ── STEP 7: Build flags list ───────────────────────────────
    const flags = buildFlags(modules, artistData, trackData);

    // ── STEP 8: Return response ────────────────────────────────
    return res.status(200).json({
      success:      true,
      platform:     parsed.platform,
      type:         parsed.type,
      artistName:   artistData.name,
      artistId:     artistData.id,
      followers:    artistData.followers?.total || 0,
      popularity:   artistData.popularity || 0,
      genres:       artistData.genres || [],
      trackTitle:   trackData?.name || null,
      trackIsrc:    trackData?.external_ids?.isrc || null,
      overallScore,
      modules,
      flags,
      flagCount:    flags.length,
      previewFlags: flags.slice(0, 2),    // Free preview shows only 2
      scannedAt:    new Date().toISOString(),
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({
      error: 'Audit failed. Please check the URL and try again.',
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
    // /artist/:id or /track/:id
    const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
    if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
    return {
      platform: 'spotify',
      type:     parts[typeIdx],             // 'artist' or 'track'
      id:       parts[typeIdx + 1].split('?')[0]
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────
// SPOTIFY API HELPERS
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
// MUSICBRAINZ CROSS-REFERENCE
// ────────────────────────────────────────────────────────
async function getMusicBrainz(artistName) {
  try {
    const query  = encodeURIComponent(`artist:"${artistName}"`);
    const resp   = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (info@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, artists: [] };
    const data = await resp.json();
    return {
      found:   data.artists && data.artists.length > 0,
      artists: data.artists || [],
      topMatch: data.artists?.[0] || null,
      score:   data.artists?.[0]?.score || 0
    };
  } catch {
    return { found: false, artists: [] };
  }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES
// ────────────────────────────────────────────────────────
function runModules(artist, track, mb) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres || artist.genres.length === 0) {
    metaScore -= 30; metaFlags.push('No genre tags found');
  }
  if (!artist.images || artist.images.length === 0) {
    metaScore -= 20; metaFlags.push('No artist images found');
  }
  if (track && !track.external_ids?.isrc) {
    metaScore -= 35; metaFlags.push('No ISRC on this track');
  }
  if (track && track.explicit === null) {
    metaScore -= 10; metaFlags.push('Explicit flag missing');
  }
  modules.metadata = {
    name:  'Metadata Integrity',
    score: Math.max(metaScore, 10),
    flags: metaFlags
  };

  // MODULE B — Platform Coverage
  let covScore = 40; // Spotify confirmed = base 40
  const covFlags = [];
  if (mb.found && mb.score > 80) {
    covScore += 35; // MusicBrainz confirmed
  } else {
    covFlags.push('Not confirmed in MusicBrainz');
  }
  if (artist.followers?.total > 100) covScore += 15;
  else covFlags.push('Very low follower count — possible profile fragmentation');
  modules.coverage = {
    name:  'Platform Coverage',
    score: Math.min(covScore, 100),
    flags: covFlags
  };

  // MODULE C — Publishing Risk
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) {
    pubScore -= 40; pubFlags.push('Missing ISRC — performance royalties may not route correctly');
  }
  if (!artist.genres || artist.genres.length === 0) {
    pubScore -= 20; pubFlags.push('No genre metadata — sync and publishing discoverability reduced');
  }
  if (!mb.found) {
    pubScore -= 25; pubFlags.push('Not found in MusicBrainz — publishing data unverifiable');
  }
  modules.publishing = {
    name:  'Publishing Risk',
    score: Math.max(pubScore, 10),
    flags: pubFlags
  };

  // MODULE D — Duplicate Detection
  let dupScore = 80;
  const dupFlags = [];
  // Low followers + streams suggests possible fragmentation
  if (artist.followers?.total < 500 && artist.popularity > 20) {
    dupScore -= 30;
    dupFlags.push('Popularity vs follower ratio suggests possible catalog fragmentation');
  }
  if (mb.artists && mb.artists.length > 1) {
    dupScore -= 20;
    dupFlags.push(`${mb.artists.length} MusicBrainz entries found — possible duplicate artist profiles`);
  }
  modules.duplicates = {
    name:  'Duplicate Detection',
    score: Math.max(dupScore, 10),
    flags: dupFlags
  };

  // MODULE E — YouTube / UGC (inferred — no YouTube API key needed for basic check)
  let ytScore = 30; // Default low without YouTube API
  const ytFlags = ['YouTube presence unverified — no YouTube API key configured'];
  modules.youtube = {
    name:  'YouTube / UGC',
    score: ytScore,
    flags: ytFlags
  };

  // MODULE F — Sync Readiness
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc)          syncScore += 25; else syncFlags.push('No ISRC detected');
  if (artist.images?.length > 0)           syncScore += 20;
  if (artist.genres?.length > 0)           syncScore += 20; else syncFlags.push('No genre tags');
  if (mb.found)                            syncScore += 20; else syncFlags.push('Not in MusicBrainz database');
  if (artist.followers?.total > 1000)      syncScore += 15;
  modules.sync = {
    name:  'Sync Readiness',
    score: Math.min(syncScore, 100),
    flags: syncFlags
  };

  return modules;
}

// ────────────────────────────────────────────────────────
// BUILD FLAGS — sorted by severity
// ────────────────────────────────────────────────────────
function buildFlags(modules, artist, track) {
  const flags = [];
  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40) severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });
  // Sort: high first
  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
