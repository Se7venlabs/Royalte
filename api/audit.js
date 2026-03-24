// Royalte Audit API — /api/audit.js
// Platforms: Spotify + MusicBrainz + Deezer + AudioDB + Discogs + SoundCloud + Last.fm + Wikidata
// Features: Royalty gap estimate, catalog age analysis, country PRO guide

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    const parsed = parseSpotifyUrl(url);
    if (!parsed) return res.status(400).json({ error: 'Invalid URL. Please paste your Spotify artist link.' });

    const token = await getSpotifyToken();

    let artistData, trackData;
    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData  = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    // Get albums for catalog age
    const albumsData = await getSpotifyAlbums(parsed.type === 'artist' ? parsed.id : artistData.id, token);

    const artistName = artistData.name;

    // All platforms in parallel
    const [mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData] =
      await Promise.allSettled([
        getMusicBrainz(artistName),
        getDeezer(artistName),
        getAudioDB(artistName),
        getDiscogs(artistName),
        getSoundCloud(artistName),
        getLastFm(artistName),
        getWikidata(artistName),
      ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { found: false }));

    // Catalog analysis
    const catalogData = analyzeCatalog(albumsData, artistData);

    // Royalty gap estimate
    const royaltyGap = estimateRoyaltyGap(artistData, catalogData, lastfmData);

    // PRO guide based on detected country
    const country = audioDbData.country || wikidataData.country || null;
    const proGuide = getPROGuide(country);

    const modules = runModules(artistData, trackData, mbData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData);

    const overallScore = Math.round(
      Object.values(modules).reduce((a, m) => a + m.score, 0) / Object.keys(modules).length
    );

    const flags = buildFlags(modules, artistData, trackData, deezerData, audioDbData, discogsData, soundcloudData, lastfmData, wikidataData, catalogData);

    return res.status(200).json({
      success:       true,
      platform:      parsed.platform,
      type:          parsed.type,
      artistName,
      artistId:      artistData.id,
      followers:     artistData.followers?.total || 0,
      popularity:    artistData.popularity || 0,
      genres:        artistData.genres || [],
      trackTitle:    trackData?.name || null,
      trackIsrc:     trackData?.external_ids?.isrc || null,
      platforms: {
        spotify:     true,
        musicbrainz: mbData.found,
        deezer:      deezerData.found,
        audiodb:     audioDbData.found,
        discogs:     discogsData.found,
        soundcloud:  soundcloudData.found,
        lastfm:      lastfmData.found,
        wikipedia:   wikidataData.found,
      },
      catalog:       catalogData,
      royaltyGap,
      proGuide,
      country,
      lastfmPlays:   lastfmData.playcount || 0,
      lastfmListeners: lastfmData.listeners || 0,
      wikipediaUrl:  wikidataData.wikipediaUrl || null,
      deezerFans:    deezerData.fans || 0,
      discogsReleases: discogsData.releases || 0,
      overallScore,
      modules,
      flags,
      flagCount:     flags.length,
      previewFlags:  flags.slice(0, 2),
      scannedAt:     new Date().toISOString(),
    });

  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the link and try again.', detail: err.message });
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
    return { platform: 'spotify', type: parts[typeIdx], id: parts[typeIdx + 1].split('?')[0] };
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
  const resp = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify artist fetch failed: ${resp.status}`);
  return resp.json();
}

async function getSpotifyTrack(id, token) {
  const resp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Spotify track fetch failed: ${resp.status}`);
  return resp.json();
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
  const currentYear  = new Date().getFullYear();
  const catalogAgeYears = earliestYear ? currentYear - earliestYear : 0;

  // Estimate annual streams from popularity and followers
  const followers  = artist.followers?.total || 0;
  const popularity = artist.popularity || 0;
  const estAnnualStreams = Math.round((followers * 12) + (popularity * 1000));

  return {
    totalReleases:       albums.length,
    earliestYear,
    latestYear:          years.length ? Math.max(...years) : null,
    catalogAgeYears,
    estimatedAnnualStreams: estAnnualStreams,
    recentActivity:      years.some(y => y >= currentYear - 2),
  };
}

// ────────────────────────────────────────────────────────
// ROYALTY GAP ESTIMATE
// ────────────────────────────────────────────────────────
function estimateRoyaltyGap(artist, catalog, lastfm) {
  const followers    = artist.followers?.total || 0;
  const popularity   = artist.popularity || 0;
  const catalogYears = catalog.catalogAgeYears || 1;

  // Spotify avg rate: ~$0.004 per stream
  // Performance royalty (PRO): ~$0.0008 per stream
  // Estimated streams from followers + popularity signal
  const estMonthlyStreams  = Math.round((followers * 1.2) + (popularity * 800));
  const estAnnualStreams   = estMonthlyStreams * 12;
  const estLifetimeStreams = estAnnualStreams * Math.min(catalogYears, 10);

  // Last.fm boosts estimate if available
  const lastfmBoost = lastfm.found && lastfm.playcount > 0
    ? Math.min(lastfm.playcount * 0.3, estLifetimeStreams * 2)
    : 0;

  const totalEstStreams = estLifetimeStreams + lastfmBoost;

  const spotifyEst     = Math.round(totalEstStreams * 0.004);
  const proEst         = Math.round(totalEstStreams * 0.0008);
  const totalEst       = spotifyEst + proEst;
  const potentialGap   = Math.round(proEst * 0.6); // Conservative — 60% of PRO may be uncollected

  return {
    estAnnualStreams,
    estLifetimeStreams:   Math.round(totalEstStreams),
    estSpotifyRoyalties: spotifyEst,
    estPROEarnings:      proEst,
    estTotalRoyalties:   totalEst,
    potentialGapLow:     Math.round(potentialGap * 0.5),
    potentialGapHigh:    potentialGap,
    catalogYears,
    disclaimer: 'Estimates only. Based on public follower and popularity signals. Verify with your distributor and PRO.'
  };
}

// ────────────────────────────────────────────────────────
// PRO GUIDE — country specific
// ────────────────────────────────────────────────────────
function getPROGuide(country) {
  const guides = {
    'Canada': {
      pro: 'SOCAN',
      url: 'https://www.socan.com',
      steps: ['Go to socan.com and click Join', 'Register as a songwriter and composer', 'Register all your works in the SOCAN repertoire', 'Submit cue sheets for any TV or film placements'],
      note: 'SOCAN collects performance royalties for streaming, radio, TV, and live performances across Canada and internationally through reciprocal agreements with GEMA, PRS, ASCAP and others.'
    },
    'United States': {
      pro: 'ASCAP or BMI',
      url: 'https://www.ascap.com',
      steps: ['Choose ASCAP (ascap.com) or BMI (bmi.com) — you can only join one', 'Register as a songwriter and publisher', 'Register all your works', 'Submit your Spotify artist URL when registering works'],
      note: 'ASCAP and BMI both collect performance royalties for US streaming, radio, TV and live performances. SESAC is invite-only.'
    },
    'United Kingdom': {
      pro: 'PRS for Music',
      url: 'https://www.prsformusic.com',
      steps: ['Go to prsformusic.com and click Join PRS', 'Register as a writer member', 'Register all your works in the PRS repertoire', 'Link your Spotify artist profile in your PRS account'],
      note: 'PRS for Music collects performance and mechanical royalties across the UK and internationally through reciprocal agreements.'
    },
    'Germany': {
      pro: 'GEMA',
      url: 'https://www.gema.de',
      steps: ['Go to gema.de and register as a member', 'Register as a composer and lyricist', 'Register all your works in the GEMA database', 'Submit documentation of any live performances or broadcast placements'],
      note: 'GEMA collects performance royalties across Germany and is one of the highest-paying PROs in the world. If you are already registered with SOCAN or ASCAP, check your reciprocal agreement status with GEMA.'
    },
    'France': {
      pro: 'SACEM',
      url: 'https://www.sacem.fr',
      steps: ['Go to sacem.fr and click Adhérer', 'Register as a composer, author or publisher', 'Register all your works', 'Submit any broadcast documentation'],
      note: 'SACEM collects performance royalties across France and has reciprocal agreements with most global PROs.'
    },
    'Australia': {
      pro: 'APRA AMCOS',
      url: 'https://www.apraamcos.com.au',
      steps: ['Go to apraamcos.com.au and click Join', 'Register as a songwriter', 'Register all your works', 'Link your streaming profiles'],
      note: 'APRA AMCOS collects performance and mechanical royalties across Australia and New Zealand.'
    },
    'Jamaica': {
      pro: 'JACAP',
      url: 'https://www.jacap.org',
      steps: ['Go to jacap.org and register as a member', 'Register as a composer or author', 'Register all your works in the JACAP database'],
      note: 'JACAP collects performance royalties across Jamaica and has reciprocal agreements with international PROs.'
    },
  };

  // Default guide if country not found
  const defaultGuide = {
    pro: 'Your local PRO',
    url: 'https://www.cisac.org',
    steps: [
      'Find your country\'s PRO at cisac.org/find-a-society',
      'Register as a songwriter and composer',
      'Register all your works in the PRO database',
      'Verify reciprocal agreements with SOCAN, ASCAP, GEMA and PRS'
    ],
    note: 'CISAC is the international confederation of PROs. Their directory lists every PRO worldwide.'
  };

  if (!country) return defaultGuide;

  // Match country string
  const match = Object.keys(guides).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return match ? { ...guides[match], country: match } : { ...defaultGuide, country };
}

// ────────────────────────────────────────────────────────
// MUSICBRAINZ
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
    return { found: data.artists?.length > 0, artists: data.artists || [], topMatch: data.artists?.[0] || null, score: data.artists?.[0]?.score || 0 };
  } catch { return { found: false, artists: [] }; }
}

// ────────────────────────────────────────────────────────
// DEEZER
// ────────────────────────────────────────────────────────
async function getDeezer(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(`https://api.deezer.com/search/artist?q=${query}&limit=5`);
    if (!resp.ok) return { found: false, fans: 0 };
    const data = await resp.json();
    if (!data.data?.length) return { found: false, fans: 0 };
    const norm   = s => s.toLowerCase().trim();
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
    const resp  = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${query}`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.artists?.length) return { found: false };
    const a = data.artists[0];
    return {
      found: true, name: a.strArtist, genre: a.strGenre || null, style: a.strStyle || null,
      mood: a.strMood || null, country: a.strCountry || null,
      biography: a.strBiographyEN ? a.strBiographyEN.substring(0, 400) : null,
      formed: a.intFormedYear || null, website: a.strWebsite || null,
      youtube: a.strYoutube || null, facebook: a.strFacebook || null,
      twitter: a.strTwitter || null, instagram: a.strInstagram || null,
    };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DISCOGS
// ────────────────────────────────────────────────────────
async function getDiscogs(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://api.discogs.com/database/search?q=${query}&type=artist&per_page=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)', 'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit' } }
    );
    if (!resp.ok) return { found: false, releases: 0 };
    const data = await resp.json();
    if (!data.results?.length) return { found: false, releases: 0 };
    const norm   = s => s.toLowerCase().trim();
    const artist = data.results.find(r => norm(r.title) === norm(artistName)) || data.results[0];
    const relResp = await fetch(`https://api.discogs.com/artists/${artist.id}/releases?per_page=1`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
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
    const resp  = await fetch(`https://api.soundcloud.com/users?q=${query}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`, { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } });
    if (!resp.ok) return { found: false, followers: 0 };
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return { found: false, followers: 0 };
    const norm = s => s.toLowerCase().trim();
    const user = data.find(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName)) || data[0];
    return { found: true, username: user.username, followers: user.followers_count || 0, tracks: user.track_count || 0, permalink: user.permalink_url || null };
  } catch { return { found: false, followers: 0 }; }
}

// ────────────────────────────────────────────────────────
// LAST.FM — free, no key needed for basic search
// ────────────────────────────────────────────────────────
async function getLastFm(artistName) {
  try {
    const key   = process.env.LASTFM_API_KEY || '43693facbb24d1ac893a5d61c8e5d4c3';
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${query}&api_key=${key}&format=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (data.error || !data.artist) return { found: false };
    const a = data.artist;
    return {
      found:      true,
      name:       a.name,
      playcount:  parseInt(a.stats?.playcount || 0),
      listeners:  parseInt(a.stats?.listeners || 0),
      tags:       a.tags?.tag?.map(t => t.name) || [],
      bio:        a.bio?.summary ? a.bio.summary.replace(/<[^>]+>/g, '').substring(0, 300) : null,
      url:        a.url || null,
    };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// WIKIDATA / WIKIPEDIA
// ────────────────────────────────────────────────────────
async function getWikidata(artistName) {
  try {
    const query = encodeURIComponent(artistName);
    const resp  = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${query}&language=en&type=item&format=json&limit=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { found: false };
    const data = await resp.json();
    if (!data.search?.length) return { found: false };

    // Look for musician-related result
    const norm   = s => s.toLowerCase().trim();
    const match  = data.search.find(r =>
      norm(r.label) === norm(artistName) &&
      (r.description?.toLowerCase().includes('musician') ||
       r.description?.toLowerCase().includes('singer') ||
       r.description?.toLowerCase().includes('rapper') ||
       r.description?.toLowerCase().includes('artist') ||
       r.description?.toLowerCase().includes('band') ||
       r.description?.toLowerCase().includes('producer'))
    ) || data.search.find(r => norm(r.label) === norm(artistName));

    if (!match) return { found: false };

    // Check for Wikipedia article
    const wpResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artistName)}`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    const wpData = wpResp.ok ? await wpResp.json() : null;

    return {
      found:        true,
      wikidataId:   match.id,
      description:  match.description || null,
      wikipediaUrl: wpData?.content_urls?.desktop?.page || null,
      wikipediaFound: wpResp.ok && !wpData?.type?.includes('disambiguation'),
      extract:      wpData?.extract?.substring(0, 300) || null,
    };
  } catch { return { found: false }; }
}

// ────────────────────────────────────────────────────────
// DETECTION MODULES
// ────────────────────────────────────────────────────────
function runModules(artist, track, mb, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog) {
  const modules = {};

  // MODULE A — Metadata Integrity
  let metaScore = 100;
  const metaFlags = [];
  if (!artist.genres?.length)          { metaScore -= 20; metaFlags.push('Genre tags not detected on Spotify profile'); }
  if (!artist.images?.length)          { metaScore -= 15; metaFlags.push('No artist images found on Spotify'); }
  if (track && !track.external_ids?.isrc) { metaScore -= 30; metaFlags.push('ISRC signal not detected on this track'); }
  if (audiodb.found && audiodb.biography) metaScore += 5;
  if (wikidata.found)                   metaScore += 5;
  if (lastfm.found && lastfm.tags?.length) metaScore += 5;
  modules.metadata = { name: 'Metadata Integrity', score: Math.max(Math.min(metaScore, 100), 10), flags: metaFlags };

  // MODULE B — Platform Coverage (8 platforms)
  let covScore = 20;
  const covFlags = [];
  const checks = [
    { name: 'MusicBrainz', found: mb.found,         pts: 12 },
    { name: 'Deezer',      found: deezer.found,      pts: 12 },
    { name: 'AudioDB',     found: audiodb.found,     pts: 10 },
    { name: 'Discogs',     found: discogs.found,     pts: 10 },
    { name: 'SoundCloud',  found: soundcloud.found,  pts: 8  },
    { name: 'Last.fm',     found: lastfm.found,      pts: 10 },
    { name: 'Wikipedia',   found: wikidata.found,    pts: 8  },
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
  if (!artist.genres?.length)             { pubScore -= 15; pubFlags.push('Genre metadata absent — sync and publishing discoverability risk'); }
  if (!mb.found)                           { pubScore -= 20; pubFlags.push('Not in MusicBrainz — publishing data cross-reference unavailable'); }
  if (catalog.catalogAgeYears > 5)         { pubScore -= 10; pubFlags.push(`Catalog active for ${catalog.catalogAgeYears} years — extended royalty verification recommended`); }
  if (discogs.found && discogs.releases > 0) pubScore += 10;
  if (lastfm.found && lastfm.playcount > 10000) { pubScore -= 10; pubFlags.push('High Last.fm play count — significant streaming history detected, PRO verification critical'); }
  modules.publishing = { name: 'Publishing Risk', score: Math.max(pubScore, 10), flags: pubFlags };

  // MODULE D — Duplicate Detection
  let dupScore = 80;
  const dupFlags = [];
  if (artist.followers?.total < 500 && artist.popularity > 20) { dupScore -= 25; dupFlags.push('Popularity vs follower ratio — possible catalog fragmentation signal'); }
  if (mb.artists?.length > 1)  { dupScore -= 20; dupFlags.push(`${mb.artists.length} MusicBrainz entries detected — possible duplicate profiles`); }
  if (!catalog.recentActivity && catalog.earliestYear) { dupScore -= 10; dupFlags.push(`No releases detected after ${catalog.latestYear} — catalog may be fragmented across accounts`); }
  modules.duplicates = { name: 'Duplicate Detection', score: Math.max(dupScore, 10), flags: dupFlags };

  // MODULE E — YouTube / UGC
  let ytScore = 20;
  const ytFlags = [];
  if (audiodb.found && audiodb.youtube)  { ytScore += 40; } else ytFlags.push('No YouTube channel detected in public data');
  if (soundcloud.found && soundcloud.tracks > 0) ytScore += 15;
  if (lastfm.found && lastfm.listeners > 1000)   ytScore += 10;
  ytFlags.push('Content ID registration status unverified');
  modules.youtube = { name: 'YouTube / UGC', score: Math.min(ytScore, 100), flags: ytFlags };

  // MODULE F — Sync Readiness
  let syncScore = 0;
  const syncFlags = [];
  if (track?.external_ids?.isrc)         { syncScore += 20; } else syncFlags.push('ISRC signal not detected');
  if (artist.genres?.length)              { syncScore += 15; } else syncFlags.push('Genre tags absent');
  if (mb.found)                            { syncScore += 10; } else syncFlags.push('Not in MusicBrainz catalog');
  if (wikidata.found)                      { syncScore += 15; } else syncFlags.push('No Wikipedia presence — sync discoverability risk');
  if (deezer.found)                        syncScore += 8;
  if (discogs.found)                       syncScore += 8;
  if (lastfm.found && lastfm.listeners > 500) syncScore += 10;
  if (audiodb.found && audiodb.genre)      syncScore += 8;
  if (artist.followers?.total > 1000)      syncScore += 6;
  modules.sync = { name: 'Sync Readiness', score: Math.min(syncScore, 100), flags: syncFlags };

  return modules;
}

// ────────────────────────────────────────────────────────
// BUILD FLAGS
// ────────────────────────────────────────────────────────
function buildFlags(modules, artist, track, deezer, audiodb, discogs, soundcloud, lastfm, wikidata, catalog) {
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
