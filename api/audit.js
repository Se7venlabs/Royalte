// Royalte Audit API — /api/audit.js
// Vercel serverless function — drop this in your /api folder
// Environment variables required:
//   SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET
//   YOUTUBE_API_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    // ── STEP 1: Parse the URL ────────────────────────────────────────────
    const parsed = parseSpotifyUrl(url);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid URL. Please paste a Spotify artist or track link.' });
    }

    // ── STEP 2: Get Spotify access token ────────────────────────────────
    const token = await getSpotifyToken();

    // ── STEP 3: Pull real data from Spotify ─────────────────────────────
    let artistData, trackData;
    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData  = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    // ── STEP 4: Cross-reference MusicBrainz ─────────────────────────────
    const mbData = await getMusicBrainz(artistData.name);

    // ── STEP 5: YouTube search ───────────────────────────────────────────
    const ytData = await getYouTubeData(artistData.name, trackData?.name || null);

    // ── STEP 6: Run detection modules ───────────────────────────────────
    const modules = runModules(artistData, trackData, mbData, ytData);

    // ── STEP 7: Calculate overall score ─────────────────────────────────
    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) /
      Object.keys(modules).length
    );

    // ── STEP 8: Build flags list ─────────────────────────────────────────
    const flags = buildFlags(modules, artistData, trackData);

    // ── STEP 9: Return response ──────────────────────────────────────────
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
      overallScore,
      modules,
      flags,
      flagCount:     flags.length,
      previewFlags:  flags.slice(0, 2),
      youtube:       ytData,
      scannedAt:     new Date().toISOString(),
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({
      error:  'Audit failed. Please check the URL and try again.',
      detail: err.message
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// URL PARSER
// ─────────────────────────────────────────────────────────────────────────────
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
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SPOTIFY API HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// MUSICBRAINZ CROSS-REFERENCE
// ─────────────────────────────────────────────────────────────────────────────
async function getMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp  = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (info@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false, artists: [] };
    const data = await resp.json();
    return {
      found:    data.artists && data.artists.length > 0,
      artists:  data.artists || [],
      topMatch: data.artists?.[0] || null,
      score:    data.artists?.[0]?.score || 0
    };
  } catch {
    return { found: false, artists: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE DATA API v3
// ─────────────────────────────────────────────────────────────────────────────
async function getYouTubeData(artistName, trackName) {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // If no API key configured, return safe default
  if (!apiKey) {
    return {
      configured:      false,
      channelFound:    false,
      officialChannel: null,
      ugcVideos:       [],
      ugcCount:        0,
      totalUgcViews:   0,
      hasContentId:    false,
      flags:           ['YouTube API not configured — UGC detection unavailable']
    };
  }

  try {
    const ytFlags  = [];
    const results  = {};

    // ── 1. Search for the artist's official YouTube channel ──────────────
    const channelSearch = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(artistName + ' official')}&type=channel&maxResults=3&key=${apiKey}`
    );
    const channelData = await channelSearch.json();
    const topChannel  = channelData.items?.[0] || null;

    if (topChannel) {
      results.officialChannel = {
        channelId:    topChannel.id?.channelId,
        title:        topChannel.snippet?.title,
        description:  topChannel.snippet?.description,
        thumbnail:    topChannel.snippet?.thumbnails?.default?.url,
      };

      // ── 2. Get channel statistics (subscriber count, video count) ──────
      if (results.officialChannel.channelId) {
        const statsResp = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,brandingSettings&id=${results.officialChannel.channelId}&key=${apiKey}`
        );
        const statsData = await statsResp.json();
        const stats     = statsData.items?.[0]?.statistics;
        if (stats) {
          results.officialChannel.subscriberCount = parseInt(stats.subscriberCount || 0);
          results.officialChannel.viewCount        = parseInt(stats.viewCount || 0);
          results.officialChannel.videoCount       = parseInt(stats.videoCount || 0);
        }
      }
    } else {
      ytFlags.push('No official YouTube channel found for this artist');
    }

    // ── 3. Search for UGC — unofficial uploads of the artist's music ─────
    const ugcQuery  = trackName
      ? `${artistName} ${trackName}`
      : `${artistName} music`;

    const ugcSearch = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(ugcQuery)}&type=video&maxResults=10&key=${apiKey}`
    );
    const ugcData   = await ugcSearch.json();
    const allVideos = ugcData.items || [];

    // Separate official vs unofficial uploads
    const officialChannelId = results.officialChannel?.channelId;
    const ugcVideos = allVideos.filter(v =>
      v.id?.videoId &&
      v.snippet?.channelId !== officialChannelId
    );

    results.ugcVideos = ugcVideos.map(v => ({
      videoId:     v.id.videoId,
      title:       v.snippet.title,
      channelName: v.snippet.channelTitle,
      publishedAt: v.snippet.publishedAt,
    }));
    results.ugcCount = ugcVideos.length;

    // ── 4. Get view counts on UGC videos ─────────────────────────────────
    let totalUgcViews = 0;
    if (ugcVideos.length > 0) {
      const videoIds  = ugcVideos.map(v => v.id.videoId).join(',');
      const statsResp = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${apiKey}`
      );
      const statsData  = await statsResp.json();
      const videoStats = statsData.items || [];

      videoStats.forEach((v, i) => {
        const views = parseInt(v.statistics?.viewCount || 0);
        totalUgcViews += views;
        if (results.ugcVideos[i]) {
          results.ugcVideos[i].viewCount = views;
        }
      });
    }
    results.totalUgcViews = totalUgcViews;

    // ── 5. Flag UGC issues ────────────────────────────────────────────────
    if (ugcVideos.length > 0) {
      ytFlags.push(
        `${ugcVideos.length} unofficial upload${ugcVideos.length > 1 ? 's' : ''} detected — ` +
        `${totalUgcViews.toLocaleString()} unmonetised views at risk`
      );
    }
    if (!topChannel) {
      ytFlags.push('No verified official channel — consider creating or claiming one');
    }
    if (ugcVideos.length > 3) {
      ytFlags.push('High UGC volume — Content ID registration strongly recommended');
    }

    return {
      configured:      true,
      channelFound:    !!topChannel,
      officialChannel: results.officialChannel || null,
      ugcVideos:       results.ugcVideos || [],
      ugcCount:        results.ugcCount || 0,
      totalUgcViews:   results.totalUgcViews || 0,
      hasContentId:    false, // Content ID status requires YouTube partner API — flagged as unknown
      flags:           ytFlags
    };

  } catch (err) {
    console.error('YouTube API error:', err.message);
    return {
      configured:   true,
      channelFound: false,
      error:        err.message,
      flags:        ['YouTube data fetch failed — ' + err.message]
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECTION MODULES
// ─────────────────────────────────────────────────────────────────────────────
function runModules(artist, track, mb, yt) {

  const modules = {};

  // ── MODULE A — Metadata Integrity ───────────────────────────────────────
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres || artist.genres.length === 0) {
    metaScore -= 30;
    metaFlags.push('No genre tags found');
  }
  if (!artist.images || artist.images.length === 0) {
    metaScore -= 20;
    metaFlags.push('No artist images found');
  }
  if (track && !track.external_ids?.isrc) {
    metaScore -= 35;
    metaFlags.push('No ISRC on this track');
  }
  if (track && track.explicit === null) {
    metaScore -= 10;
    metaFlags.push('Explicit flag missing');
  }
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(metaScore, 10), flags: metaFlags };

  // ── MODULE B — Platform Coverage ────────────────────────────────────────
  let covScore = 40;
  const covFlags = [];
  if (mb.found && mb.score > 80) {
    covScore += 25;
  } else {
    covFlags.push('Not confirmed in MusicBrainz');
  }
  if (yt?.channelFound) {
    covScore += 20;
  } else {
    covFlags.push('No official YouTube channel detected');
  }
  if (artist.followers?.total > 100) covScore += 15;
  else covFlags.push('Very low follower count — possible profile fragmentation');
  modules.coverage = { name: 'Platform Coverage', score: Math.min(covScore, 100), flags: covFlags };

  // ── MODULE C — Publishing Risk ───────────────────────────────────────────
  let pubScore = 100;
  const pubFlags = [];
  if (track && !track.external_ids?.isrc) {
    pubScore -= 40;
    pubFlags.push('Missing ISRC — performance royalties may not route correctly');
  }
  if (!artist.genres || artist.genres.length === 0) {
    pubScore -= 20;
    pubFlags.push('No genre metadata — sync and publishing discoverability reduced');
  }
  if (!mb.found) {
    pubScore -= 25;
    pubFlags.push('Not found in MusicBrainz — publishing data unverifiable');
  }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  // ── MODULE D — Duplicate Detection ──────────────────────────────────────
  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) {
    dupScore -= 30;
    dupFlags.push('Popularity vs follower ratio suggests possible catalog fragmentation');
  }
  if (mb.artists && mb.artists.length > 1) {
    dupScore -= 20;
    dupFlags.push(`${mb.artists.length} MusicBrainz entries found — possible duplicate artist profiles`);
  }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  // ── MODULE E — YouTube / UGC (now powered by real YouTube Data API) ──────
  let ytScore = 30;
  const ytFlags = [];

  if (!yt?.configured) {
    // No API key — keep low score and flag it
    ytFlags.push('YouTube API not configured — UGC detection unavailable');
  } else {
    ytScore = 50; // Base: API is live

    if (yt.channelFound) {
      ytScore += 20; // Official channel exists
      const subs = yt.officialChannel?.subscriberCount || 0;
      if (subs > 1000) ytScore += 10;
    } else {
      ytFlags.push('No official YouTube channel found — revenue opportunity missed');
    }

    if (yt.ugcCount === 0) {
      ytScore += 20; // No unmonitored UGC found
    } else {
      // UGC found — score drops based on volume
      const ugcPenalty = Math.min(yt.ugcCount * 8, 40);
      ytScore -= ugcPenalty;
      yt.flags.forEach(f => ytFlags.push(f));

      // Add Content ID recommendation if UGC is significant
      if (yt.totalUgcViews > 5000) {
        ytFlags.push(
          `${yt.totalUgcViews.toLocaleString()} views on unofficial uploads — ` +
          'register with Content ID via DistroKid, TuneCore, or Identifyy'
        );
      }
    }
  }

  modules.youtube = {
    name:          'YouTube / UGC',
    score:         Math.max(Math.min(ytScore, 100), 10),
    flags:         ytFlags,
    ugcCount:      yt?.ugcCount || 0,
    totalUgcViews: yt?.totalUgcViews || 0,
    channelFound:  yt?.channelFound || false,
  };

  // ── MODULE F — Sync Readiness ────────────────────────────────────────────
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc) syncScore += 25;
  else syncFlags.push('No ISRC detected');
  if (artist.images?.length > 0) syncScore += 20;
  if (artist.genres?.length > 0) syncScore += 20;
  else syncFlags.push('No genre tags');
  if (mb.found) syncScore += 20;
  else syncFlags.push('Not in MusicBrainz database');
  if (artist.followers?.total > 1000) syncScore += 15;
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD FLAGS — sorted by severity
// ─────────────────────────────────────────────────────────────────────────────
function buildFlags(modules, artist, track) {
  const flags = [];
  Object.entries(modules).forEach(([key, mod]) => {
    mod.flags.forEach(f => {
      let severity = 'low';
      if (mod.score < 40)      severity = 'high';
      else if (mod.score < 65) severity = 'medium';
      flags.push({ module: mod.name, severity, description: f });
    });
  });
  const order = { high: 0, medium: 1, low: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
