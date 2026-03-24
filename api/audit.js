// Royalte Audit API — /api/audit.js
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud
// Deezer, MusicBrainz, AudioDB, Discogs — no API key needed
// SoundCloud — no API key needed for basic search

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

    const artistName = artistData.name;

    // ── STEP 4: Cross-reference all platforms in parallel ─────
    const [mbData, deezerData, audioDbData, discogsData, soundcloudData] = await Promise.allSettled([
      getMusicBrainz(artistName),
      getDeezer(artistName),
      getAudioDB(artistName),
      getDiscogs(artistName),
      getSoundCloud(artistName),
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

    // ── STEP 5: Run detection modules ────────────────────────
    const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData);

    // ── STEP 6: Overall score ─────────────────────────────────
    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    // ── STEP 7: Build flags ───────────────────────────────────
    const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData);

    // ── STEP 8: Return ────────────────────────────────────────
    return res.status(200).json({
      success:          true,
      platform:         parsed.platform,
      type:             parsed.type,
      artistName,
      artistId:         artistData.id,
      followers:        artistData.followers?.total || 0,
      popularity:       artistData.popularity || 0,
      genres:           artistData.genres || [],
      trackTitle:       trackData?.name || null,
      trackIsrc:        trackData?.external_ids?.isrc || null,
      // Platform presence summary
      platforms: {
        spotify:    true,
        musicbrainz: mbData.found,
        deezer:     deezerData.found,
        audiodb:    audioDbData.found,
        discogs:    discogsData.found,
        soundcloud: soundcloudData.found,
      },
      deezerFans:       deezerData.fans || 0,
      audioDbBiography: audioDbData.biography || null,
      audioDbGenre:     audioDbData.genre || null,
      audioDbCountry:   audioDbData.country || null,
      discogsReleases:  discogsData.releases || 0,
      soundcloudFollowers: soundcloudData.followers || 0,
      overallScore,
      modules,
      flags,
      flagCount:        flags.length,
      previewFlags:     flags.slice(0, 2),
      scannedAt:        new Date().toISOString(),
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
    method: 'POST',
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
      found:    data.artists?.length > 0,
      artists:  data.artists || [],
      topMatch: data.artists?.[0] || null,
      score:    data.artists?.[0]?.score || 0
    };
  } catch { return { found: false, artists: [] }; }
}

// ────────────────────────────────────────────────────────
// DEEZER — no API key needed
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(`https://api.deezer.com/search/artist?q=${query}&limit=5`);
    if (!resp.ok) return { found: false, fans: 0 };
    const data = await resp.json();
    if (!data.data?.length) return { found: false, fans: 0 };

    const normalise = s => s.toLowerCase().trim();
    const exact = data.data.find(a => normalise(a.name) === normalise(artistName));
    const artist = exact || data.data[0];

    const detailResp = await fetch(`https://api.deezer.com/artist/${artist.id}`);
    const detail = detailResp.ok ? await detailResp.json() : artist;

    return {
      found:    true,
      fans:     detail.nb_fan || 0,
      artistId: artist.id,
      name:     artist.name,
      albums:   detail.nb_album || 0,
      link:     `https://www.deezer.com/artist/${artist.id}`,
    };
  } catch { return { found: false, fans: 0 }; }
}

// ────────────────────────────────────────────────────────
// AUDIODB — no API key needed for basic lookups
// Returns: biography, genre, country, mood, social links
// ────────────────────────────────────────────────────────
async function getAudioDB(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://www.theaudiodb.com/api/v1/json/2/search.php?s=${query}`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };

    const artist = data.artists[0];
    return {
      found:      true,
      name:       artist.strArtist,
      genre:      artist.strGenre || null,
      style:      artist.strStyle || null,
      mood:       artist.strMood || null,
      country:    artist.strCountry || null,
      biography:  artist.strBiographyEN ? artist.strBiographyEN.substring(0, 300) : null,
      formed:     artist.intFormedYear || null,
      website:    artist.strWebsite || null,
      facebook:   artist.strFacebook || null,
      twitter:    artist.strTwitter || null,
      instagram:  artist.strInstagram || null,
      youtube:    artist.strYoutube || null,
      logo:       artist.strArtistLogo || null,
    };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DISCOGS — no API key needed for basic search
// Returns: release count, labels, catalog numbers
// ────────────────────────────────────────────────────────
async function getDiscogs(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`,
      { headers: {
        'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)',
        'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit'
      }}
    );
    if (!resp.ok) return { found: false, releases: 0 };
    const data = await resp.json();
    if (!data.results?.length) return { found: false, releases: 0 };

    const normalise = s => s.toLowerCase().trim();
    const exact = data.results.find(r => normalise(r.title) === normalise(artistName));
    const artist = exact || data.results[0];

    // Get release count
    const releaseResp = await fetch(
      `https://api.discogs.com/artists/${artist.id}/releases?per_page=1`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    const releaseData = releaseResp.ok ? await releaseResp.json() : {};

    return {
      found:    true,
      artistId: artist.id,
      name:     artist.title,
      releases: releaseData.pagination?.items || 0,
      thumb:    artist.thumb || null,
      link:     `https://www.discogs.com/artist/${artist.id}`,
    };
  } catch { return { found: false, releases: 0 }; }
}

// ────────────────────────────────────────────────────────
// SOUNDCLOUD — public search, no API key needed
// ────────────────────────────────────────────────────────
async function getSoundCloud(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://api.soundcloud.com/users?q=${query}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, followers: 0 };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false, followers: 0 };

    const normalise = s => s.toLowerCase().trim();
    const exact = data.find(u => normalise(u.username) === normalise(artistName) ||
                                  normalise(u.full_name || '') === normalise(artistName));
    const user = exact || data[0];

    return {
      found:       true,
      username:    user.username,
      followers:   user.followers_count || 0,
      tracks:      user.track_count || 0,
      permalink:   user.permalink_url || null,
    };
  } catch { return { found: false, followers: 0 }; }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES
// ────────────────────────────────────────────────────────
function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres?.length) {
    metaScore -= 20; metaFlags.push('Genre tags not detected on Spotify profile');
  }
  if (!artist.images?.length) {
    metaScore -= 15; metaFlags.push('No artist images found on Spotify');
  }
  if (track && !track.external_ids?.isrc) {
    metaScore -= 30; metaFlags.push('ISRC signal not detected on this track');
  }
  // AudioDB can fill metadata gaps
  if (audiodb.found) {
    if (audiodb.genre && !artist.genres?.length) metaScore += 10;
    if (audiodb.biography) metaScore += 5;
  }
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(Math.min(metaScore, 100), 10), flags: metaFlags };

  // MODULE B — Platform Coverage (now 6 platforms)
  let covScore = 25; // Spotify base
  const covFlags = [];
  const platforms = [
    { name: 'MusicBrainz', found: mb.found,         points: 15 },
    { name: 'Deezer',      found: deezer.found,      points: 15 },
    { name: 'AudioDB',     found: audiodb.found,     points: 10 },
    { name: 'Discogs',     found: discogs.found,     points: 10 },
    { name: 'SoundCloud',  found: soundcloud.found,  points: 10 },
  ];
  platforms.forEach(p => {
    if (p.found) covScore += p.points;
    else covFlags.push(`${p.name} presence not detected — coverage risk`);
  });
  if (artist.followers?.total > 100) covScore += 15;
  else covFlags.push('Low follower count — possible fragmentation signal');
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  // MODULE C — Publishing Risk
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) {
    pubScore -= 35; pubFlags.push('ISRC not detected — performance royalty routing unverified');
  }
  if (!artist.genres?.length) {
    pubScore -= 15; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk');
  }
  if (!mb.found) {
    pubScore -= 20; pubFlags.push('Not in MusicBrainz — publishing data cross-reference unavailable');
  }
  if (discogs.found && discogs.releases > 0) {
    pubScore += 10; // Physical releases suggest established publishing history
  }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  // MODULE D — Duplicate Detection
  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) {
    dupScore -= 25; dupFlags.push('Popularity vs follower ratio — possible catalog fragmentation signal');
  }
  if (mb.artists?.length > 1) {
    dupScore -= 20; dupFlags.push(`${mb.artists.length} MusicBrainz entries — possible duplicate profiles`);
  }
  if (deezer.found && soundcloud.found) {
    const deezerFans = deezer.fans || 0;
    const scFollowers = soundcloud.followers || 0;
    if (deezerFans > 0 && scFollowers > 0) {
      const ratio = Math.max(deezerFans, scFollowers) / Math.min(deezerFans, scFollowers);
      if (ratio > 20) {
        dupScore -= 15; dupFlags.push('Large gap between platform audiences — fragmentation signal');
      }
    }
  }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  // MODULE E — YouTube / UGC
  let ytScore = 30;
  const ytFlags = [];
  if (audiodb.found && audiodb.youtube) {
    ytScore = 55; // AudioDB found a YouTube channel
  } else {
    ytFlags.push('No YouTube channel detected in public data');
  }
  if (soundcloud.found && soundcloud.tracks > 0) {
    ytScore += 10; // SoundCloud presence suggests UGC awareness
  }
  ytFlags.push('Content ID registration status unverified');
  modules.youtube = { name: 'YouTube / UGC', score: Math.min(ytScore, 100), flags: ytFlags };

  // MODULE F — Sync Readiness
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc)     { syncScore += 20; } else syncFlags.push('ISRC signal not detected');
  if (artist.genres?.length)          { syncScore += 15; } else syncFlags.push('Genre tags absent');
  if (mb.found)                        { syncScore += 15; } else syncFlags.push('Not in MusicBrainz catalog');
  if (deezer.found)                    { syncScore += 10; }
  if (discogs.found)                   { syncScore += 10; } // Physical catalog = established artist
  if (audiodb.found && audiodb.genre)  { syncScore += 10; }
  if (soundcloud.found)                { syncScore += 5; }
  if (artist.followers?.total > 1000)  { syncScore += 15; }
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

// ────────────────────────────────────────────────────────
// BUILD FLAGS
// ────────────────────────────────────────────────────────
function buildFlags(modules, artist, track, deezer, audiodb, discogs, soundcloud) {
  const flags = [];

  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40) severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });

  // Bonus positive flags
  if (discogs.found && discogs.releases > 5) {
    flags.push({
      module: 'Duplicate Detection',
      severity: 'low',
      description: `${discogs.releases} releases found on Discogs — physical catalog confirmed`
    });
  }
  if (audiodb.found && audiodb.biography) {
    flags.push({
      module: 'Metadata Integrity',
      severity: 'low',
      description: 'Artist biography found in AudioDB — metadata partially verified'
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
