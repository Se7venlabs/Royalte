// Royalte Audit API — /api/audit.js
// Vercel serverless function
// Env vars: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, YOUTUBE_API_KEY
// MusicBrainz: no API key needed — free & open

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    const parsed = parseSpotifyUrl(url);
    if (!parsed) return res.status(400).json({ error: 'Invalid URL. Please paste a Spotify artist or track link.' });

    const token = await getSpotifyToken();
    let artistData, trackData;
    if (parsed.type === 'artist') {
      artistData = await getSpotifyArtist(parsed.id, token);
    } else {
      trackData  = await getSpotifyTrack(parsed.id, token);
      artistData = await getSpotifyArtist(trackData.artists[0].id, token);
    }

    const mbData        = await getMusicBrainz(artistData.name);
    const ytData        = await getYouTubeData(artistData.name, trackData?.name || null);
    const audioFeatures = trackData ? await getSpotifyAudioFeatures(trackData.id, token) : null;
    const modules       = runModules(artistData, trackData, mbData, ytData, audioFeatures);
    const overallScore  = Math.round(Object.values(modules).reduce((a,m)=>a+m.score,0)/Object.keys(modules).length);
    const flags         = buildFlags(modules, artistData, trackData);

    return res.status(200).json({
      success: true, platform: parsed.platform, type: parsed.type,
      artistName: artistData.name, artistId: artistData.id,
      followers: artistData.followers?.total || 0,
      popularity: artistData.popularity || 0,
      genres: artistData.genres || [],
      trackTitle: trackData?.name || null,
      trackIsrc: trackData?.external_ids?.isrc || null,
      overallScore, modules, flags,
      flagCount: flags.length,
      previewFlags: flags.slice(0,2),
      youtube: ytData,
      audioFeatures,
      pro: mbData.proData || null,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Audit error:', err);
    return res.status(500).json({ error: 'Audit failed. Please check the URL and try again.', detail: err.message });
  }
}

// ── URL PARSER ────────────────────────────────────────────────────────────────
function parseSpotifyUrl(url) {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('spotify.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
    if (typeIdx === -1 || !parts[typeIdx+1]) return null;
    return { platform:'spotify', type:parts[typeIdx], id:parts[typeIdx+1].split('?')[0] };
  } catch { return null; }
}

// ── SPOTIFY HELPERS ───────────────────────────────────────────────────────────
async function getSpotifyToken() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(id+':'+secret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get Spotify token');
  return data.access_token;
}

async function getSpotifyArtist(id, token) {
  const r = await fetch(`https://api.spotify.com/v1/artists/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Spotify artist fetch failed: ${r.status}`);
  return r.json();
}

async function getSpotifyTrack(id, token) {
  const r = await fetch(`https://api.spotify.com/v1/tracks/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Spotify track fetch failed: ${r.status}`);
  return r.json();
}

async function getSpotifyAudioFeatures(trackId, token) {
  try {
    const r = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    return {
      tempo: d.tempo, energy: d.energy, valence: d.valence,
      instrumentalness: d.instrumentalness, speechiness: d.speechiness,
      acousticness: d.acousticness, danceability: d.danceability,
      duration_ms: d.duration_ms, loudness: d.loudness,
      key: d.key, mode: d.mode, time_signature: d.time_signature,
    };
  } catch { return null; }
}

// ── MUSICBRAINZ — FULL PRO & TERRITORY LOOKUP ────────────────────────────────
const PRO_MAP = {
  CA: { performance: 'SOCAN',         mechanical: 'CMRRA',            region: 'Canada'         },
  US: { performance: 'ASCAP / BMI',   mechanical: 'The MLC',          region: 'United States'  },
  GB: { performance: 'PRS for Music', mechanical: 'MCPS',             region: 'United Kingdom' },
  AU: { performance: 'APRA AMCOS',    mechanical: 'AMCOS',            region: 'Australia'      },
  NZ: { performance: 'APRA AMCOS',    mechanical: 'Recorded Music NZ',region: 'New Zealand'    },
  DE: { performance: 'GEMA',          mechanical: 'GEMA',             region: 'Germany'        },
  FR: { performance: 'SACEM',         mechanical: 'SCPP',             region: 'France'         },
  SE: { performance: 'STIM',          mechanical: 'SAMI',             region: 'Sweden'         },
  NO: { performance: 'TONO',          mechanical: 'Gramo',            region: 'Norway'         },
  JP: { performance: 'JASRAC',        mechanical: 'NexTone',          region: 'Japan'          },
  BR: { performance: 'ECAD',          mechanical: 'UBC',              region: 'Brazil'         },
  NG: { performance: 'COSON',         mechanical: 'MCSN',             region: 'Nigeria'        },
  ZA: { performance: 'SAMRO',         mechanical: 'RISA',             region: 'South Africa'   },
  KR: { performance: 'KOMCA',         mechanical: 'KMCA',             region: 'South Korea'    },
  MX: { performance: 'SACM',          mechanical: 'SACM',             region: 'Mexico'         },
  IT: { performance: 'SIAE',          mechanical: 'SIAE',             region: 'Italy'          },
  ES: { performance: 'SGAE',          mechanical: 'SGAE',             region: 'Spain'          },
  NL: { performance: 'BUMA/STEMRA',   mechanical: 'STEMRA',           region: 'Netherlands'    },
};

const TERR_CODES = ['CA','US','GB','AU','DE','FR','JP'];

async function getMusicBrainz(artistName) {
  const UA = 'RoyalteAudit/1.0 (info@royalte.ai)';
  try {
    const q = encodeURIComponent(`artist:"${artistName}"`);
    const sr = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${q}&limit=3&fmt=json`, {
      headers: { 'User-Agent': UA }
    });
    if (!sr.ok) return buildEmptyMB();
    const sd = await sr.json();
    if (!sd.artists?.length) return buildEmptyMB();

    const top = sd.artists[0];

    // Respect MusicBrainz 1 req/sec rate limit
    await new Promise(r => setTimeout(r, 1100));

    const dr = await fetch(`https://musicbrainz.org/ws/2/artist/${top.id}?inc=aliases+tags&fmt=json`, {
      headers: { 'User-Agent': UA }
    });
    const d = dr.ok ? await dr.json() : top;

    const country    = d.country || null;
    const ipis       = d.ipis   || [];
    const isnis      = d.isnis  || [];
    const aliases    = (d.aliases || []).filter(a => a.name !== d.name);
    const legalName  = aliases.find(a => a.type === 'Legal name')?.name || null;
    const otherNames = aliases.filter(a => a.type !== 'Legal name').map(a => a.name);
    const homePRO    = country ? (PRO_MAP[country] || null) : null;
    const hasIPI     = ipis.length > 0;
    const hasISNI    = isnis.length > 0;

    const territories = TERR_CODES.map(code => ({
      territory:        `${code} ${PRO_MAP[code].region}`,
      performancePRO:   PRO_MAP[code].performance,
      mechanicalRights: PRO_MAP[code].mechanical,
      status:           country === code ? 'confirmed' : hasIPI ? 'likely' : 'unverified',
      isHome:           country === code,
    }));

    const proFlags = [];
    if (!hasIPI)          proFlags.push({ severity: 'high',   description: `No IPI number found for ${artistName} — PRO registration cannot be globally verified.` });
    if (!hasISNI)         proFlags.push({ severity: 'medium', description: `No ISNI detected — international identity unconfirmed across rights databases.` });
    if (!country)         proFlags.push({ severity: 'medium', description: `Country of origin not found — home PRO cannot be auto-determined.` });
    if (!legalName)       proFlags.push({ severity: 'medium', description: `Legal name not on record — PRO registrations should always use legal name to prevent misrouting.` });
    if (aliases.length>4) proFlags.push({ severity: 'medium', description: `${aliases.length} name variants detected — audit each alias for missing PRO registrations.` });

    let ts = 10;
    if (d.id)    ts += 10;
    if (hasIPI)  ts += 35;
    if (hasISNI) ts += 20;
    if (country) ts += 15;
    if (legalName) ts += 10;
    ts = Math.min(ts, 100);

    return {
      found: true, artists: sd.artists, topMatch: top, score: top.score,
      proData: {
        found: true, matchScore: top.score, mbid: d.id, name: d.name,
        legalName, aliases: otherNames.slice(0,8),
        country, countryName: homePRO?.region || country || null,
        homePRO, ipi: ipis, isni: isnis, hasIPI, hasISNI,
        type: d.type || null, gender: d.gender || null,
        bornIn: d['begin-area']?.name || null,
        territories, flags: proFlags, territoryScore: ts,
        source: 'MusicBrainz Open Music Encyclopedia',
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('[MusicBrainz] Lookup failed:', err.message);
    return buildEmptyMB();
  }
}

function buildEmptyMB() {
  return { found: false, artists: [], topMatch: null, score: 0, proData: null };
}

// ── YOUTUBE DATA API v3 ───────────────────────────────────────────────────────
async function getYouTubeData(artistName, trackName) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { configured: false, channelFound: false, officialChannel: null, ugcVideos: [], ugcCount: 0, totalUgcViews: 0, hasContentId: false, flags: ['YouTube API not configured — UGC detection unavailable'] };
  }
  try {
    const ytF = []; const res = {};
    const cs = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(artistName+' official')}&type=channel&maxResults=3&key=${apiKey}`);
    const cd = await cs.json(); const tc = cd.items?.[0] || null;
    if (tc) {
      res.officialChannel = { channelId: tc.id?.channelId, title: tc.snippet?.title, description: tc.snippet?.description, thumbnail: tc.snippet?.thumbnails?.default?.url };
      if (res.officialChannel.channelId) {
        const sr = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,brandingSettings&id=${res.officialChannel.channelId}&key=${apiKey}`);
        const sd = await sr.json(); const st = sd.items?.[0]?.statistics;
        if (st) { res.officialChannel.subscriberCount = parseInt(st.subscriberCount||0); res.officialChannel.viewCount = parseInt(st.viewCount||0); res.officialChannel.videoCount = parseInt(st.videoCount||0); }
      }
    } else { ytF.push('No official YouTube channel found for this artist'); }
    const uq = trackName ? `${artistName} ${trackName}` : `${artistName} music`;
    const us = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(uq)}&type=video&maxResults=10&key=${apiKey}`);
    const ud = await us.json(); const oci = res.officialChannel?.channelId;
    const uv = (ud.items||[]).filter(v => v.id?.videoId && v.snippet?.channelId !== oci);
    res.ugcVideos = uv.map(v => ({ videoId: v.id.videoId, title: v.snippet.title, channelName: v.snippet.channelTitle, publishedAt: v.snippet.publishedAt }));
    res.ugcCount = uv.length;
    let tuv = 0;
    if (uv.length > 0) {
      const vi = uv.map(v => v.id.videoId).join(',');
      const sr = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${vi}&key=${apiKey}`);
      const sd = await sr.json();
      (sd.items||[]).forEach((v,i) => { const vw = parseInt(v.statistics?.viewCount||0); tuv += vw; if (res.ugcVideos[i]) res.ugcVideos[i].viewCount = vw; });
    }
    res.totalUgcViews = tuv;
    if (uv.length>0) ytF.push(`${uv.length} unofficial upload${uv.length>1?'s':''} detected — ${tuv.toLocaleString()} unmonetised views at risk`);
    if (!tc) ytF.push('No verified official channel — consider creating or claiming one');
    if (uv.length>3) ytF.push('High UGC volume — Content ID registration strongly recommended');
    if (tuv>5000) ytF.push(`${tuv.toLocaleString()} views on unofficial uploads — register with Content ID via DistroKid, TuneCore, or Identifyy`);
    return { configured: true, channelFound: !!tc, officialChannel: res.officialChannel||null, ugcVideos: res.ugcVideos||[], ugcCount: res.ugcCount||0, totalUgcViews: res.totalUgcViews||0, hasContentId: false, flags: ytF };
  } catch (err) {
    console.error('YouTube API error:', err.message);
    return { configured: true, channelFound: false, error: err.message, flags: ['YouTube data fetch failed — '+err.message] };
  }
}

// ── DETECTION MODULES ─────────────────────────────────────────────────────────
function runModules(artist, track, mb, yt, audio) {
  const m = {};

  // A — Metadata Integrity
  let ms=100; const mf=[];
  if (!artist.genres?.length)             { ms-=30; mf.push('No genre tags found'); }
  if (!artist.images?.length)             { ms-=20; mf.push('No artist images found'); }
  if (track && !track.external_ids?.isrc) { ms-=35; mf.push('No ISRC on this track'); }
  if (track && track.explicit===null)     { ms-=10; mf.push('Explicit flag missing'); }
  m.metadata = { name: 'Metadata Integrity', score: Math.max(ms,10), flags: mf };

  // B — Platform Coverage
  let cs=40; const cf=[];
  if (mb.found && mb.score>80) { cs+=25; } else cf.push('Not confirmed in MusicBrainz');
  if (yt?.channelFound)        { cs+=20; } else cf.push('No official YouTube channel detected');
  if (artist.followers?.total>100) cs+=15; else cf.push('Very low follower count — possible profile fragmentation');
  m.coverage = { name: 'Platform Coverage', score: Math.min(cs,100), flags: cf };

  // C — Publishing Risk
  let ps=100; const pf=[];
  if (track && !track.external_ids?.isrc) { ps-=40; pf.push('Missing ISRC — performance royalties may not route correctly'); }
  if (!artist.genres?.length)             { ps-=20; pf.push('No genre metadata — sync and publishing discoverability reduced'); }
  if (!mb.found)                          { ps-=25; pf.push('Not found in MusicBrainz — publishing data unverifiable'); }
  m.publishing = { name: 'Publishing Risk', score: Math.max(ps,10), flags: pf };

  // D — Duplicate Detection
  let ds=80; const df=[];
  if (artist.followers?.total<500 && artist.popularity>20) { ds-=30; df.push('Popularity vs follower ratio suggests possible catalog fragmentation'); }
  if (mb.artists?.length>1) { ds-=20; df.push(`${mb.artists.length} MusicBrainz entries found — possible duplicate artist profiles`); }
  m.duplicates = { name: 'Duplicate Detection', score: Math.max(ds,10), flags: df };

  // E — YouTube / UGC
  let ys=30; const yf=[];
  if (!yt?.configured) { yf.push('YouTube API not configured — UGC detection unavailable'); }
  else {
    ys=50;
    if (yt.channelFound) { ys+=20; if((yt.officialChannel?.subscriberCount||0)>1000) ys+=10; } else yf.push('No official YouTube channel found — revenue opportunity missed');
    if (yt.ugcCount===0) { ys+=20; } else { ys-=Math.min(yt.ugcCount*8,40); yt.flags.forEach(f=>yf.push(f)); if(yt.totalUgcViews>5000) yf.push(`${yt.totalUgcViews.toLocaleString()} views on unofficial uploads — register with Content ID via DistroKid, TuneCore, or Identifyy`); }
  }
  m.youtube = { name: 'YouTube / UGC', score: Math.max(Math.min(ys,100),10), flags: yf, ugcCount: yt?.ugcCount||0, totalUgcViews: yt?.totalUgcViews||0, channelFound: yt?.channelFound||false };

  // F — Sync Readiness
  let ss=0; const sf=[],sig=[],sp=[];
  if (track?.external_ids?.isrc) { ss+=20; sig.push('ISRC present — track is licensable'); } else sf.push('No ISRC — track cannot be licensed until one is registered');
  if (artist.images?.length>0) ss+=8; else sf.push('No artist images — sync supervisor profiles require visuals');
  if (artist.genres?.length>0) { ss+=10; } else sf.push('No genre tags — reduces discoverability in sync catalogues');
  if (mb.found) { ss+=10; sig.push('Registered in MusicBrainz — metadata verifiable'); } else sf.push('Not in MusicBrainz — publishing data unverifiable by supervisors');
  if (audio) {
    const dur=(audio.duration_ms||0)/1000;
    if(dur>=90&&dur<=240){ss+=10;sig.push(`Good track length (${Math.round(dur)}s)`);}
    else if(dur>240) sf.push(`Track length ${Math.round(dur)}s — consider edit under 3 minutes`);
    else sf.push(`Track length ${Math.round(dur)}s — very short`);
    if(audio.instrumentalness>=0.5){ss+=12;sig.push('High instrumentalness — places easily');}
    else if(audio.instrumentalness>=0.2) ss+=6;
    if(audio.speechiness<0.1){ss+=8;sig.push('Low speechiness — clean audio');}
    else if(audio.speechiness>0.4) sf.push('High speechiness — may limit placements');
    if(audio.energy>=0.35&&audio.energy<=0.85){ss+=8;sig.push(`Energy ${Math.round(audio.energy*100)}%`);}
    else if(audio.energy>0.85) sf.push('Very high energy — best for action/sports');
    else sf.push('Low energy — limited to ambient briefs');
    if(audio.tempo>=80&&audio.tempo<=140){ss+=7;sig.push(`Tempo ${Math.round(audio.tempo)} BPM`);}
    else if(audio.tempo>140) sf.push(`Fast tempo ${Math.round(audio.tempo)} BPM`);
    else sf.push(`Slow tempo ${Math.round(audio.tempo)} BPM`);
    if(audio.loudness>=-14&&audio.loudness<=-5) ss+=5;
    else if(audio.loudness>-5) sf.push('Over-compressed — mixing headroom limited');
    const g=(artist.genres||[]).join(' ').toLowerCase();
    if(audio.instrumentalness>=0.5) sp.push('Musicbed','Artlist','Epidemic Sound');
    if(g.includes('hip')||g.includes('rap')||g.includes('trap')) sp.push('Musicstore','Songtradr');
    if(g.includes('electronic')||g.includes('ambient')||g.includes('chill')) sp.push('Artlist','Musicbed','Pond5');
    if(g.includes('rock')||g.includes('indie')||g.includes('alternative')) sp.push('Musicbed','Marmoset');
    if(g.includes('r&b')||g.includes('soul')||g.includes('funk')) sp.push('Musicstore','Songtradr','Musicbed');
    const u=[...new Set(sp)].slice(0,3);
    sig.push(`Recommended sync platforms: ${u.length?u.join(', '):'Musicbed, Songtradr, Artlist'}`);
  } else { sf.push('Submit a track URL for full sync analysis including audio features'); ss+=5; }
  m.sync = { name: 'Sync Readiness', score: Math.min(ss,100), flags: sf, signals: sig, platforms: [...new Set(sp)].slice(0,3), audioProfile: audio ? { tempo: Math.round(audio.tempo||0), energy: Math.round((audio.energy||0)*100), instrumentalness: Math.round((audio.instrumentalness||0)*100), valence: Math.round((audio.valence||0)*100), durationSec: Math.round((audio.duration_ms||0)/1000) } : null };

  // G — Territory & PRO Registration (LIVE — powered by full MusicBrainz lookup)
  const pd = mb.proData;
  m.territory = {
    name:        'Territory & PRO Registration',
    score:       pd?.territoryScore || 0,
    flags:       pd?.flags?.map(f=>f.description) || ['MusicBrainz PRO data unavailable'],
    ipi:         pd?.ipi         || [],
    isni:        pd?.isni        || [],
    hasIPI:      pd?.hasIPI      || false,
    hasISNI:     pd?.hasISNI     || false,
    homePRO:     pd?.homePRO     || null,
    country:     pd?.country     || null,
    legalName:   pd?.legalName   || null,
    territories: pd?.territories || [],
  };

  return m;
}

// ── BUILD FLAGS ───────────────────────────────────────────────────────────────
function buildFlags(modules, artist, track) {
  const flags = [];
  Object.entries(modules).forEach(([k,mod]) => {
    mod.flags.forEach(f => {
      let sev = 'low';
      if (mod.score < 40) sev = 'high';
      else if (mod.score < 65) sev = 'medium';
      flags.push({ module: mod.name, severity: sev, description: f });
    });
  });
  const order = { high:0, medium:1, low:2 };
  return flags.sort((a,b) => order[a.severity]-order[b.severity]);
}
