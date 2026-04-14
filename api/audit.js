// Royalté Audit API — /api/audit.js
// Multi-source audit engine. Canonical subject drives the scan.
// No Spotify default bias. Verified findings only. No fake certainty.
// Platforms: Spotify · Apple Music · MusicBrainz · Deezer · AudioDB · Discogs · SoundCloud · Last.fm · Wikidata · YouTube

// ── Apple token generation — inlined to avoid @vercel/node module bundling issues ──
import { createPrivateKey, createSign } from 'crypto';

let _cachedToken = null;
let _tokenExpiry = null;

function generateAppleToken() {
  if (_cachedToken && _tokenExpiry && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const keyId    = process.env.APPLE_KEY_ID;
  const teamId   = process.env.APPLE_TEAM_ID;
  let privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error('Missing Apple Music credentials: APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY');
  }

  // Fix Vercel literal \n encoding
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  // Ensure PEM headers
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    const body    = privateKey.replace(/\s+/g, '');
    const wrapped = body.match(/.{1,64}/g)?.join('\n') || body;
    privateKey    = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----`;
  }

  console.log('[AppleToken] Team:', teamId, '| Kid:', keyId, '| Key length:', privateKey.length);

  const keyObject = createPrivateKey({ key: privateKey, format: 'pem' });

  const now     = Math.floor(Date.now() / 1000);
  const exp     = now + 60 * 60 * 12;
  const header  = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now, exp };

  const b64url = s => Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;

  const signer = createSign('SHA256');
  signer.update(input);
  signer.end();
  const der = signer.sign(keyObject);

  // DER -> raw r||s for JWT
  let offset = 2;
  if (der[1] & 0x80) offset += der[1] & 0x7f;
  offset++;
  const rLen = der[offset++];
  let r = der.slice(offset, offset + rLen); offset += rLen;
  offset++;
  const sLen = der[offset++];
  let s = der.slice(offset, offset + sLen);
  if (r[0] === 0x00) r = r.slice(1);
  if (s[0] === 0x00) s = s.slice(1);
  const rPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r]);
  const sPad = Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s]);
  const sig = Buffer.concat([rPad, sPad]);

  const token = `${input}.${sig.toString('base64url')}`;
  console.log('[AppleToken] Generated. Length:', token.length, '| Exp:', new Date(exp * 1000).toISOString());

  _cachedToken = token;
  _tokenExpiry = Date.now() + (exp - now) * 1000 - 60_000;
  return token;
}

// ─────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided.' });

  // ── STAGE A: Parse input URL ─────────────────────────────────
  console.log('[Royalte] Stage A — Input URL:', url);
  const parsed = parseUniversalUrl(url);

  if (!parsed) {
    console.warn('[Royalte] Stage A — Parse failed');
    return res.status(400).json({
      error: 'Enter a valid Spotify or Apple Music URL.',
      detail: 'Supported: open.spotify.com/artist, open.spotify.com/track, music.apple.com artist and song URLs.',
    });
  }

  console.log('[Royalte] Stage A — Parsed:', JSON.stringify(parsed));

  try {
    // ── STAGE B: Resolve source entity ───────────────────────────
    console.log('[Royalte] Stage B — Resolving source entity from', parsed.platform);
    const sourceResolution = await resolveSourceEntity(parsed);

    if (!sourceResolution.success) {
      console.error('[Royalte] Stage B — Source resolution failed:', sourceResolution.error);
      const msg = parsed.platform === 'apple'
        ? 'We recognized your Apple Music link, but could not retrieve verified Apple Music data right now.'
        : 'We recognized your Spotify link, but could not retrieve verified Spotify data right now.';
      return res.status(400).json({
        success: false,
        auditReady: false,
        sourceResolutionStatus: 'failed',
        inputPlatform: parsed.platform,
        entityType: parsed.type,
        metadataStatus: 'failed',
        artistName: null,
        trackName: null,
        error: msg,
        detail: sourceResolution.error,
      });
    }

    console.log('[Royalte] Stage B — Source resolved:', sourceResolution.canonicalSubject.canonicalArtistName);

    // ── STAGE C: Canonical subject ────────────────────────────────
    const subject = sourceResolution.canonicalSubject;
    console.log('[Royalte] Stage C — Canonical subject:', JSON.stringify({
      platform: subject.inputPlatform,
      type: subject.canonicalSubjectType,
      artist: subject.canonicalArtistName,
      track: subject.canonicalTrackName,
    }));

    // ── STAGE D: Cross-reference other sources ────────────────────
    console.log('[Royalte] Stage D — Cross-referencing sources for:', subject.canonicalArtistName);
    const crossRefs = await runCrossReferences(subject, sourceResolution);

    console.log('[Royalte] Stage D — Cross-reference complete:', Object.keys(crossRefs).map(k =>
      `${k}:${crossRefs[k].resolutionStatus}`
    ).join(' | '));

    // ── STAGE E: Build verified findings + ISRC table + scores ─────
    console.log('[Royalte] Stage E — Building verified findings');
    const moduleStates = buildModuleStates(subject, sourceResolution, crossRefs);
    const verifiedIssues = buildVerifiedIssues(subject, moduleStates, crossRefs);
    const actionPlan = buildActionPlan(verifiedIssues, crossRefs.audiodb?.country || crossRefs.wikidata?.country || null);
    // Platform confirmation — single source of truth, computed before everything else
    const platformConfirmation = buildPlatformConfirmation(subject, crossRefs);
    // Attach to crossRefs so buildVerifiedIssues can access without signature change
    crossRefs._platformConfirmation = platformConfirmation;

    const coverageStatuses = buildCoverageStatuses(subject, sourceResolution, crossRefs, platformConfirmation);
    const territorySignals = buildTerritorySignals(subject, crossRefs);
    const auditConfidence = deriveAuditConfidence(crossRefs, sourceResolution);

    // Build ISRC table FIRST — must be declared before any function that uses it
    const isArtistScan = subject.canonicalSubjectType === 'artist';
    const artistTracks = subject.sourceData?.artistTracks || [];
    const spotifyToken = subject.sourceData?.spotifyToken || null;

    let isrcTable = [];
    let primaryScore;

    try {
      if (isArtistScan) {
        if (artistTracks.length > 0) {
          isrcTable = await buildIsrcTableForArtist(artistTracks, subject.inputPlatform, spotifyToken);
        }
        primaryScore = calculateCatalogQualityScore(isrcTable);
      } else {
        isrcTable = await buildIsrcTableForTrack(subject, crossRefs);
        primaryScore = calculateTrackIntegrityScore(subject, crossRefs, isrcTable);
      }
    } catch (isrcErr) {
      console.error('[Royalte] Stage E — ISRC table error (non-fatal):', isrcErr.message);
      isrcTable = [];
      primaryScore = {
        score: null,
        type: isArtistScan ? 'Catalog Quality Score' : 'Track Integrity Score',
        label: 'Limited Verification',
        insufficient: true,
        message: 'ISRC data unavailable for this scan. Other audit findings are still valid.',
      };
    }

    // collectionReadiness uses isrcTable — must come AFTER isrcTable is built
    const collectionReadiness = buildCollectionReadiness(subject, crossRefs, isrcTable);

    console.log('[Royalte] Stage E — Score:', primaryScore.score, primaryScore.type, '| ISRC rows:', isrcTable.length, '| Issues:', verifiedIssues.length, '| Confidence:', auditConfidence);
    console.log('[Royalte] Render gate — source_resolution_status: resolved | cross_reference_complete: true | audit_ready: true');
    console.log('[Royalte] Render gate — canonical_artist_name:', subject.canonicalArtistName, '| canonical_track_name:', subject.canonicalTrackName || 'N/A');

    return res.status(200).json({
      success: true,
      auditReady: true,
      sourceResolutionStatus: 'resolved',
      scannedAt: new Date().toISOString(),

      // Canonical subject — always reflects actual input
      canonicalSubject: subject,
      inputPlatform: subject.inputPlatform,
      entityType: subject.canonicalSubjectType,
      platformLabel: subject.platformLabel,
      artistName: subject.canonicalArtistName,
      trackTitle: subject.canonicalTrackName || null,
      trackIsrc: subject.canonicalIsrc || subject.sourceData?.appleTrackIsrc || null,
      artistId: subject.canonicalArtistId,
      followers: subject.followers || 0,
      genres: subject.genres || [],

      // Source resolution result
      sourceResolution: {
        platform: subject.inputPlatform,
        status: 'Source Verified',
        resolutionStatus: 'resolved',
        entityType: subject.canonicalSubjectType,
        platformLabel: subject.platformLabel,
        sourceVerified: true,
      },

      // Module states — full structured state per module
      moduleStates,

      // Primary score — type depends on scan type
      scanType: isArtistScan ? 'artist' : 'track',
      primaryScore, // { score, type, label, breakdown? }
      // Legacy field kept for backward compat
      royaltyRiskScore: primaryScore.score,
      riskLevel: primaryScore.label,

      // ISRC cross-platform table
      isrcTable,

      // Verified issues — only from completed cross-references
      verifiedIssues,
      issueCount: verifiedIssues.length,
      previewIssues: verifiedIssues.slice(0, 2),

      // Platform confirmation — single source of truth for platform presence
      platformConfirmation,

      // Coverage statuses for UI display
      coverageStatuses,

      // Territory signals — always 5 baseline territories
      territorySignals,

      // Global collection readiness
      collectionReadiness,

      // Action plan
      actionPlan,

      // Audit metadata
      auditCoverage: {
        [subject.inputPlatform]: 'Source Verified',
        crossReferences: Object.fromEntries(
          Object.entries(crossRefs).map(([k, v]) => [k, v.resolutionStatus])
        ),
        confidence: auditConfidence,
        dataLastVerified: new Date().toISOString(),
      },

      // Catalog data if available
      catalog: sourceResolution.catalog || null,

      // Raw cross-reference summaries (non-sensitive)
      crossReferenceSummary: {
        appleMusic: {
          resolutionStatus: crossRefs.appleMusic.resolutionStatus,
          crossReferenceStatus: crossRefs.appleMusic.crossReferenceStatus,
        },
        spotify: {
          resolutionStatus: crossRefs.spotify.resolutionStatus,
          crossReferenceStatus: crossRefs.spotify.crossReferenceStatus,
        },
        youtube: {
          resolutionStatus: crossRefs.youtube.resolutionStatus,
          crossReferenceStatus: crossRefs.youtube.crossReferenceStatus,
          officialChannelFound: crossRefs.youtube.officialChannelFound,
          ugcFound: crossRefs.youtube.ugcFound,
        },
        musicbrainz: {
          resolutionStatus: crossRefs.musicbrainz.resolutionStatus,
          crossReferenceStatus: crossRefs.musicbrainz.crossReferenceStatus,
        },
      },
    });

  } catch (err) {
    console.error('[Royalte] Audit error:', err.message, err.stack?.split('\n')[1]);
    return res.status(500).json({
      error: 'Temporary system issue — please try again.',
      detail: err.message,
      auditReady: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE A — UNIVERSAL URL PARSER
// ─────────────────────────────────────────────────────────────────
function parseUniversalUrl(url) {
  try {
    const u = new URL(url.trim());
    const hostname = u.hostname;
    const parts = u.pathname.split('/').filter(Boolean);

    // ── SPOTIFY ──────────────────────────────────────────────────
    if (hostname.includes('spotify.com')) {
      const typeIdx = parts.findIndex(p => p === 'artist' || p === 'track');
      if (typeIdx === -1 || !parts[typeIdx + 1]) return null;
      return {
        platform: 'spotify',
        type: parts[typeIdx],   // 'artist' | 'track'
        id: parts[typeIdx + 1].split('?')[0],
        rawUrl: url,
      };
    }

    // ── APPLE MUSIC ───────────────────────────────────────────────
    if (hostname.includes('music.apple.com')) {
      let type = null;
      let id = null;

      // ?i= param = song inside album
      const iParam = u.searchParams.get('i');
      if (iParam && /^\d+$/.test(iParam)) {
        return { platform: 'apple', type: 'track', id: iParam, rawUrl: url };
      }

      // /song/ or /songs/ path
      const songIdx = parts.findIndex(p => p === 'song' || p === 'songs');
      if (songIdx !== -1) {
        // last numeric segment is the ID
        for (let i = parts.length - 1; i > songIdx; i--) {
          const seg = parts[i].split('?')[0];
          if (/^\d+$/.test(seg)) { id = seg; break; }
        }
        return id ? { platform: 'apple', type: 'track', id, rawUrl: url } : null;
      }

      // /artist/ or /artists/ path
      const artistIdx = parts.findIndex(p => p === 'artist' || p === 'artists');
      if (artistIdx !== -1) {
        for (let i = parts.length - 1; i > artistIdx; i--) {
          const seg = parts[i].split('?')[0];
          if (/^\d+$/.test(seg)) { id = seg; break; }
        }
        return id ? { platform: 'apple', type: 'artist', id, rawUrl: url } : null;
      }

      // /album/ or /albums/ path — resolve artist from album
      const albumIdx = parts.findIndex(p => p === 'album' || p === 'albums');
      if (albumIdx !== -1) {
        for (let i = parts.length - 1; i > albumIdx; i--) {
          const seg = parts[i].split('?')[0];
          if (/^\d+$/.test(seg)) { id = seg; break; }
        }
        // albumId flags the resolver to look up the album and extract the artist
        return id ? { platform: 'apple', type: 'artist', id, rawUrl: url, albumId: id } : null;
      }

      // Fallback: last numeric segment
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i].split('?')[0];
        if (/^\d+$/.test(seg)) { id = seg; break; }
      }
      return id ? { platform: 'apple', type: 'artist', id, rawUrl: url } : null;
    }

    return null;
  } catch (e) {
    console.error('[Royalte] URL parse error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE B — SOURCE ENTITY RESOLUTION
// Fetches from the input platform and builds canonical subject
// ─────────────────────────────────────────────────────────────────
async function resolveSourceEntity(parsed) {
  if (parsed.platform === 'spotify') {
    return await resolveSpotifySource(parsed);
  }
  if (parsed.platform === 'apple') {
    return await resolveAppleSource(parsed);
  }
  return { success: false, error: `Unsupported platform: ${parsed.platform}` };
}

async function resolveSpotifySource(parsed) {
  try {
    const token = await getSpotifyToken();
    console.log('[Royalte Spotify] Token obtained');

    let artistRaw, trackRaw;

    if (parsed.type === 'artist') {
      artistRaw = await getSpotifyArtist(parsed.id, token);
    } else {
      trackRaw = await getSpotifyTrack(parsed.id, token);
      artistRaw = await getSpotifyArtist(trackRaw.artists[0].id, token);
    }

    console.log('[Royalte Spotify] Artist resolved:', artistRaw.name);

    const albumsData = await getSpotifyAlbums(artistRaw.id, token);
    const topTracks = await getSpotifyTopTracks(artistRaw.id, token);
    const catalog = analyzeCatalog(albumsData, artistRaw);

    // For artist scans: fetch 5 filtered original tracks for ISRC table
    let artistTracks = [];
    if (parsed.type === 'artist') {
      artistTracks = await getSpotifyArtistTracks(artistRaw.id, token, 5);
    }

    const canonicalSubject = {
      inputPlatform: 'spotify',
      inputEntityType: parsed.type,
      inputId: parsed.id,
      canonicalSubjectType: parsed.type,
      canonicalArtistName: artistRaw.name,
      canonicalArtistId: artistRaw.id,
      canonicalTrackName: trackRaw?.name || null,
      canonicalIsrc: trackRaw?.external_ids?.isrc || null,
      canonicalDurationMs: trackRaw?.duration_ms || null,
      normalizedInputUrl: parsed.rawUrl,
      platformLabel: parsed.type === 'artist' ? 'Spotify Artist' : 'Spotify Track',
      genres: artistRaw.genres || [],
      followers: artistRaw.followers?.total || 0,
      popularity: artistRaw.popularity || 0,
      images: artistRaw.images || [],
      sourceData: {
        spotifyArtistId: artistRaw.id,
        spotifyToken: token, // passed through for cross-validation
        spotifyTopTracks: topTracks,
        spotifyTrackIsrc: trackRaw?.external_ids?.isrc || null,
        artistTracks, // filtered catalog tracks for ISRC table
      },
    };

    return { success: true, auditReady: true, metadataStatus: 'resolved', canonicalSubject, catalog };
  } catch (err) {
    console.error('[Royalte Spotify] Resolution error:', err.message);
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

async function resolveAppleSource(parsed) {
  console.log('[Royalte Apple] ── Stage B start ──');
  console.log('[Royalte Apple] Input URL:', parsed.rawUrl);
  console.log('[Royalte Apple] Parsed platform:', parsed.platform, '| type:', parsed.type, '| id:', parsed.id);

  try {
    // ── Token generation ──────────────────────────────────────────
    let appleToken;
    try {
      appleToken = generateAppleToken();
      if (!appleToken || typeof appleToken !== 'string' || appleToken.length < 20) {
        console.error('[Royalte Apple] Token generation failed — token invalid:', typeof appleToken, String(appleToken).slice(0, 30));
        return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Apple Music token generation failed. Check apple-token.js configuration.' };
      }
      console.log('[Royalte Apple] Token generated, length:', appleToken.length);
    } catch (tokenErr) {
      console.error('[Royalte Apple] Token generation threw:', tokenErr.message);
      return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music token error: ${tokenErr.message}` };
    }

    // Try multiple storefronts — the URL may contain a non-US storefront
    // Extract storefront from URL path (e.g. /us/, /ca/, /gb/)
    let storefront = 'us';
    try {
      const urlParts = new URL(parsed.rawUrl).pathname.split('/').filter(Boolean);
      const sfCandidate = urlParts[0]?.toLowerCase();
      if (sfCandidate && /^[a-z]{2}$/.test(sfCandidate)) {
        storefront = sfCandidate;
        console.log('[Royalte Apple] Storefront from URL:', storefront);
      }
    } catch {}

    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    let artistRaw = null;
    let trackRaw = null;
    let artistName = null;
    let trackName = null;

    // ── Album URL resolution — fetch album, extract artist ID ─────
    // When an album URL is pasted, parsed.albumId is set.
    // We fetch the album to get the real artist ID, then proceed as artist scan.
    if (parsed.albumId) {
      try {
        const albumEndpoint = `${BASE}/catalog/${storefront}/albums/${parsed.albumId}`;
        console.log('[Royalte Apple] Album URL detected — fetching album:', albumEndpoint);
        const albumResp = await fetch(albumEndpoint, { headers });
        console.log('[Royalte Apple] Album fetch status:', albumResp.status);
        if (albumResp.ok) {
          const albumData = await albumResp.json();
          const album = albumData.data?.[0];
          const relArtistId = album?.relationships?.artists?.data?.[0]?.id;
          if (relArtistId) {
            console.log('[Royalte Apple] Extracted artist ID from album:', relArtistId);
            // Replace parsed.id with the real artist ID and continue
            parsed = { ...parsed, id: relArtistId, albumId: null };
          } else {
            // Try artist from album attributes
            const artistName2 = album?.attributes?.artistName;
            console.log('[Royalte Apple] No artist relationship — artist name from album:', artistName2);
            if (artistName2) {
              return buildAppleCanonical(parsed, null, null, artistName2, null, 'url_slug_fallback', null);
            }
          }
        } else if (albumResp.status === 401 || albumResp.status === 403) {
          return { success: false, auditReady: false, metadataStatus: 'failed',
            error: `Apple Music auth failed (${albumResp.status}). Check apple-token.js JWT credentials.`,
            inputPlatform: 'apple', entityType: 'artist',
            detail: `Apple Music auth failed (${albumResp.status}) — cross-reference unavailable` };
        }
        // else fall through to normal artist resolution with original id
      } catch (albumErr) {
        console.warn('[Royalte Apple] Album fetch failed (non-fatal):', albumErr.message);
        // Continue with original ID as fallback
      }
    }

    if (parsed.type === 'artist') {
      // Try primary storefront first, then fall back to 'us'
      const storefrontsToTry = storefront !== 'us' ? [storefront, 'us'] : ['us'];
      let resp = null;
      let usedStorefront = null;

      for (const sf of storefrontsToTry) {
        const endpoint = `${BASE}/catalog/${sf}/artists/${parsed.id}`;
        console.log('[Royalte Apple] Trying artist endpoint:', endpoint);
        try {
          resp = await fetch(endpoint, { headers });
          console.log('[Royalte Apple] Artist fetch status:', resp.status, '| storefront:', sf);
          if (resp.ok) { usedStorefront = sf; break; }
          if (resp.status === 401 || resp.status === 403) {
            const errBody = await resp.text().catch(() => '');
            console.error('[Royalte Apple] Auth error body:', errBody.slice(0, 200));
            return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music auth failed (${resp.status}). Check apple-token.js JWT credentials.` };
          }
        } catch (fetchErr) {
          console.error('[Royalte Apple] Fetch threw for storefront', sf, ':', fetchErr.message);
        }
      }

      if (!resp || !resp.ok) {
        const status = resp ? resp.status : 'no response';
        console.error('[Royalte Apple] All storefronts failed. Last status:', status);
        // Last-resort: try extracting artist name from URL slug itself
        const urlSlug = parsed.rawUrl.match(/\/artist\/([^\/]+)\//)?.[1];
        if (urlSlug) {
          const nameFromSlug = urlSlug.replace(/-/g, ' ').replace(/\w/g, c => c.toUpperCase()).trim();
          console.log('[Royalte Apple] Fallback: name extracted from URL slug:', nameFromSlug);
          // Only use if reasonably confident (not just numbers)
          if (nameFromSlug && !/^\d+$/.test(nameFromSlug)) {
            return buildAppleCanonical(parsed, null, null, nameFromSlug, null, 'url_slug_fallback', parsed.id);
          }
        }
        return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${status} for artist ${parsed.id}` };
      }

      const json = await resp.json();
      console.log('[Royalte Apple] Artist response data count:', json.data?.length || 0);
      artistRaw = json.data?.[0];
      if (!artistRaw) {
        console.error('[Royalte Apple] No artist object in response. Response keys:', Object.keys(json));
        return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Artist not found in Apple Music catalog response' };
      }
      artistName = artistRaw.attributes?.name;
      console.log('[Royalte Apple] Artist name from API:', artistName);

    } else {
      // Track/song resolution
      const storefrontsToTry = storefront !== 'us' ? [storefront, 'us'] : ['us'];
      let resp = null;

      for (const sf of storefrontsToTry) {
        const endpoint = `${BASE}/catalog/${sf}/songs/${parsed.id}`;
        console.log('[Royalte Apple] Trying song endpoint:', endpoint);
        try {
          resp = await fetch(endpoint, { headers });
          console.log('[Royalte Apple] Song fetch status:', resp.status, '| storefront:', sf);
          if (resp.ok) break;
          if (resp.status === 401 || resp.status === 403) {
            return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music auth failed (${resp.status}). Check apple-token.js JWT credentials.` };
          }
        } catch (fetchErr) {
          console.error('[Royalte Apple] Song fetch threw for storefront', sf, ':', fetchErr.message);
        }
      }

      if (!resp || !resp.ok) {
        return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${resp?.status || 'no response'} for song ${parsed.id}` };
      }

      const json = await resp.json();
      trackRaw = json.data?.[0];
      if (!trackRaw) return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Track not found in Apple Music catalog response' };
      trackName = trackRaw.attributes?.name;
      artistName = trackRaw.attributes?.artistName;
      console.log('[Royalte Apple] Track name:', trackName, '| artist:', artistName);

      // Attempt to fetch full artist object from relationship
      const relArtistId = trackRaw.relationships?.artists?.data?.[0]?.id;
      if (relArtistId) {
        try {
          const ar = await fetch(`${BASE}/catalog/${storefront}/artists/${relArtistId}`, { headers });
          if (ar.ok) {
            const aj = await ar.json();
            artistRaw = aj.data?.[0] || null;
            if (artistRaw && !artistName) artistName = artistRaw.attributes?.name;
            console.log('[Royalte Apple] Related artist fetched:', artistRaw?.attributes?.name);
          }
        } catch (e) { console.warn('[Royalte Apple] Related artist fetch failed:', e.message); }
      }
    }

    if (!artistName) {
      console.error('[Royalte Apple] Artist name null after all resolution attempts');
      artistName = 'Unknown Artist';
    }

    console.log('[Royalte Apple] ── Stage B complete ──');
    console.log('[Royalte Apple] artist_name:', artistName, '| track_name:', trackName || 'N/A');
    console.log('[Royalte Apple] source_resolution_status: resolved | audit_ready: true');

    // For artist scans: fetch 5 filtered original tracks for ISRC table
    let artistTracks = [];
    let appleArtistId = artistRaw?.id || parsed.id;
    if (parsed.type === 'artist' && appleArtistId) {
      const trackResult = await getAppleArtistTracks(appleArtistId, storefront, 5);
      artistTracks = trackResult.tracks || [];
    }

    return buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, 'api', null, artistTracks);

  } catch (err) {
    console.error('[Royalte Apple] Resolution error:', err.message);
    console.error('[Royalte Apple] source_resolution_status: failed | audit_ready: false');
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

// Build canonical subject from resolved Apple data — separated to support fallbacks
function buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, resolvedVia, overrideId, artistTracks = []) {
  return {
    success: true,
    auditReady: true,
    metadataStatus: 'resolved',
    resolvedVia, // 'api' | 'url_slug_fallback'
    canonicalSubject: {
      inputPlatform: 'apple',
      inputEntityType: parsed.type,
      inputId: parsed.id,
      canonicalSubjectType: parsed.type,
      canonicalArtistName: artistName,
      canonicalArtistId: artistRaw?.id || overrideId || `apple-${parsed.id}`,
      canonicalTrackName: trackName || null,
      canonicalIsrc: trackRaw?.attributes?.isrc || null,
      canonicalDurationMs: trackRaw?.attributes?.durationInMillis || null,
      normalizedInputUrl: parsed.rawUrl,
      platformLabel: parsed.type === 'artist' ? 'Apple Music Artist' : 'Apple Music Track',
      genres: artistRaw?.attributes?.genreNames || [],
      followers: 0,
      popularity: 0,
      images: artistRaw?.attributes?.artwork
        ? [{ url: artistRaw.attributes.artwork.url.replace('{w}x{h}bb', '400x400bb').replace('{w}x{h}', '400x400') }]
        : [],
      sourceData: {
        appleArtistId: artistRaw?.id || overrideId || parsed.id,
        appleArtistUrl: artistRaw?.attributes?.url || null,
        appleTrackId: trackRaw?.id || null,
        appleTrackIsrc: trackRaw?.attributes?.isrc || null,
        artistTracks, // filtered catalog tracks for ISRC table
      },
    },
    catalog: null,
  };
}

// ─────────────────────────────────────────────────────────────────
// STAGE D — CROSS-REFERENCE ENGINE
// Each cross-ref returns a structured state object, never a boolean
// ─────────────────────────────────────────────────────────────────
async function runCrossReferences(subject, sourceResolution) {
  const name = subject.canonicalArtistName;
  const trackName = subject.canonicalTrackName;
  const isInputSpotify = subject.inputPlatform === 'spotify';
  const isInputApple = subject.inputPlatform === 'apple';

  // Run all cross-references in parallel
  const [spotifyRef, appleMusicRef, youtubeRef, mbRef, deezerRef, audiodbRef, discogsRef, soundcloudRef, lastfmRef, wikidataRef] = await Promise.allSettled([
    isInputSpotify
      ? Promise.resolve(buildSpotifySourceRef(sourceResolution)) // already resolved from source
      : crossRefSpotify(
          name, trackName,
          null, // _unused (was spotifyTopTracks)
          subject.canonicalIsrc || subject.sourceData?.appleTrackIsrc || null, // ISRC from Apple source
          subject.canonicalDurationMs || null, // duration from Apple source
        ),
    isInputApple
      ? Promise.resolve(buildAppleSourceRef(sourceResolution)) // already resolved from source
      : crossRefAppleMusic(name, sourceResolution.canonicalSubject?.sourceData?.spotifyTopTracks || [], null),
    crossRefYouTube(name),
    crossRefMusicBrainz(name),
    crossRefDeezer(name),
    crossRefAudioDB(name),
    crossRefDiscogs(name),
    crossRefSoundCloud(name),
    crossRefLastFm(name),
    crossRefWikidata(name),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', error: r.reason?.message }));

  return {
    spotify: spotifyRef,
    appleMusic: appleMusicRef,
    youtube: youtubeRef,
    musicbrainz: mbRef,
    deezer: deezerRef,
    audiodb: audiodbRef,
    discogs: discogsRef,
    soundcloud: soundcloudRef,
    lastfm: lastfmRef,
    wikidata: wikidataRef,
    // Rights systems — cannot be verified via public API
    soundExchange: { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
    pro: { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
  };
}

// Build a source ref from an already-resolved Spotify source
function buildSpotifySourceRef(sourceResolution) {
  const subject = sourceResolution.canonicalSubject;
  return {
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: 'Source Verified',
    registrationStatus: 'Source Verified',
    verified: true,
    artistId: subject.canonicalArtistId,
    artistName: subject.canonicalArtistName,
    followers: subject.followers,
    genres: subject.genres,
    isrc: subject.canonicalIsrc,
  };
}

// Build a source ref from an already-resolved Apple source
function buildAppleSourceRef(sourceResolution) {
  const subject = sourceResolution.canonicalSubject;
  return {
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: subject.inputEntityType === 'artist' ? 'Profile Resolved' : 'Track Resolved',
    registrationStatus: 'Source Verified',
    verified: true,
    artistId: subject.canonicalArtistId,
    artistUrl: subject.sourceData?.appleArtistUrl || null,
    artistName: subject.canonicalArtistName,
  };
}

// Cross-reference Spotify (when Apple was the input)
// Uses ISRC-first, then multi-strategy metadata matching.
// Only returns No Match if all strategies fail with full candidate evaluation.
async function crossRefSpotify(artistName, trackName, _unused, isrc, durationMs) {
  const LOG = '[Royalte CrossRef Spotify]';
  console.log(`${LOG} Starting — artist: "${artistName}" | track: "${trackName}" | isrc: ${isrc || 'none'} | duration: ${durationMs || 'unknown'}`);
  try {
    const token = await getSpotifyToken();
    const headers = { Authorization: `Bearer ${token}` };

    // ── Strategy A: ISRC direct lookup (highest confidence) ─────────
    if (isrc) {
      console.log(`${LOG} Strategy A — ISRC lookup: ${isrc}`);
      const isrcResp = await fetch(
        `https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`,
        { headers }
      );
      if (isrcResp.ok) {
        const isrcData = await isrcResp.json();
        const isrcMatch = isrcData.tracks?.items?.[0];
        if (isrcMatch) {
          console.log(`${LOG} Strategy A HIT — "${isrcMatch.name}" by ${isrcMatch.artists?.[0]?.name}`);
          return {
            sourceUsedForScan: false, resolutionStatus: 'resolved',
            crossReferenceStatus: 'Cross-Reference Found', registrationStatus: 'Registered',
            verified: true, confidence: 'HIGH',
            artistId: isrcMatch.artists?.[0]?.id, artistName: isrcMatch.artists?.[0]?.name,
            trackName: isrcMatch.name, isrc: isrcMatch.external_ids?.isrc || isrc,
            followers: 0, genres: [],
          };
        }
        console.log(`${LOG} Strategy A — no ISRC hit on Spotify`);
      }
    }

    // ── Gather candidates for metadata matching ──────────────────────
    // Run three searches in parallel: structured, plain, artist-only
    const q1 = trackName ? encodeURIComponent(`track:${trackName} artist:${artistName}`) : null;
    const q2 = trackName ? encodeURIComponent(`${trackName} ${artistName}`) : encodeURIComponent(artistName);
    const q3 = encodeURIComponent(artistName);

    const fetches = [
      q1 ? fetch(`https://api.spotify.com/v1/search?q=${q1}&type=track&limit=10`, { headers }) : Promise.resolve(null),
      fetch(`https://api.spotify.com/v1/search?q=${q2}&type=track&limit=10`, { headers }),
      fetch(`https://api.spotify.com/v1/search?q=${q3}&type=artist&limit=5`, { headers }),
    ];
    const [r1, r2, r3] = await Promise.all(fetches);

    const trackCands1 = (r1 && r1.ok) ? (await r1.json()).tracks?.items || [] : [];
    const trackCands2 = r2.ok ? (await r2.json()).tracks?.items || [] : [];
    const artistCands = r3.ok ? (await r3.json()).artists?.items || [] : [];

    // Deduplicate track candidates
    const seenIds = new Set();
    const trackCandidates = [...trackCands1, ...trackCands2].filter(c => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id); return true;
    });

    console.log(`${LOG} Candidates — track: ${trackCandidates.length} | artist: ${artistCands.length}`);
    trackCandidates.slice(0, 5).forEach((c, i) =>
      console.log(`  [${i}] "${c.name}" by ${c.artists?.[0]?.name} | dur: ${c.duration_ms}ms | isrc: ${c.external_ids?.isrc || 'none'}`)
    );

    // ── Strategy B–E: Metadata matching on track candidates ─────────
    if (trackCandidates.length > 0 && trackName) {
      const result = resolveBestMatch(
        trackCandidates, { name: trackName, artistName, isrc, durationMs: durationMs || 0 },
        c => c.name,
        c => c.artists?.[0]?.name || '',
        c => c.duration_ms || 0,
        c => c.external_ids?.isrc || null,
      );

      console.log(`${LOG} Metadata match result: ${result.status} (${result.confidence || 'n/a'}) | matched: "${result.matchedName}"`);

      if (result.status === 'Matched' || result.status === 'Possible Match') {
        // Also try to get artist info for the matched track
        const matchedTrack = trackCandidates.find(c => c.name === result.matchedName) || trackCandidates[0];
        const artistId = matchedTrack?.artists?.[0]?.id || null;
        let followers = 0, genres = [];
        if (artistId) {
          try {
            const ar = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, { headers });
            if (ar.ok) { const ad = await ar.json(); followers = ad.followers?.total || 0; genres = ad.genres || []; }
          } catch {}
        }
        return {
          sourceUsedForScan: false, resolutionStatus: 'resolved',
          crossReferenceStatus: result.status === 'Matched' ? 'Cross-Reference Found' : 'Possible Match',
          registrationStatus: result.status === 'Matched' ? 'Registered' : 'Not Confirmed',
          verified: true, confidence: result.confidence,
          artistId, artistName: matchedTrack?.artists?.[0]?.name || artistName,
          trackName: result.matchedName, isrc: result.matchedIsrc || isrc,
          followers, genres,
        };
      }
    }

    // ── Strategy F: Artist-only fallback ────────────────────────────
    // If we can confirm the artist is on Spotify, that's still useful
    const na = normArtist(artistName);
    const artistMatch = artistCands.find(a => normArtist(a.name) === na)
      || artistCands.find(a => normArtist(a.name).includes(na) || na.includes(normArtist(a.name)));

    if (artistMatch) {
      console.log(`${LOG} Strategy F — artist found: "${artistMatch.name}" | track match failed`);
      // Artist confirmed but track not found — return artist confirmed with track note
      return {
        sourceUsedForScan: false, resolutionStatus: 'resolved',
        crossReferenceStatus: trackName ? 'Possible Match' : 'Cross-Reference Found',
        registrationStatus: 'Not Confirmed', verified: true, confidence: 'LOW',
        artistId: artistMatch.id, artistName: artistMatch.name,
        followers: artistMatch.followers?.total || 0, genres: artistMatch.genres || [],
        isrc: null,
        note: trackName ? 'Artist confirmed on Spotify, specific track not matched' : null,
      };
    }

    console.log(`${LOG} All strategies failed — NO MATCH for "${artistName}" / "${trackName}"`);
    return {
      sourceUsedForScan: false, resolutionStatus: 'resolved',
      crossReferenceStatus: 'No Verified Match Yet', registrationStatus: 'Not Confirmed',
      verified: true, confidence: null,
    };
  } catch (err) {
    console.error(`${LOG} Error:`, err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference Apple Music (when Spotify was the input)
async function crossRefAppleMusic(artistName, spotifyTopTracks, isrc) {
  console.log('[Royalte CrossRef Apple] Starting cross-reference for:', artistName);
  console.log('[Royalte CrossRef Apple] Canonical artist name:', artistName);
  try {
    let appleToken;
    try {
      appleToken = generateAppleToken();
      if (!appleToken || typeof appleToken !== 'string' || appleToken.length < 20) {
        console.error('[Royalte CrossRef Apple] Token invalid');
        return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: 'Apple token invalid' };
      }
    } catch (tokenErr) {
      console.error('[Royalte CrossRef Apple] Token error:', tokenErr.message);
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: tokenErr.message };
    }

    const STOREFRONT = 'us';
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    // Use shared normStr + normArtist from the matching engine
    const normName = normStr;
    const normalizedQuery = normArtist(artistName);
    console.log('[Royalte CrossRef Apple] Normalized search query:', normalizedQuery);

    const searchResp = await fetch(
      `${BASE}/catalog/${STOREFRONT}/search?term=${encodeURIComponent(artistName)}&types=artists&limit=10`,
      { headers }
    );
    console.log('[Royalte CrossRef Apple] Search response status:', searchResp.status);

    if (!searchResp.ok) {
      const errBody = await searchResp.text().catch(() => '');
      console.error('[Royalte CrossRef Apple] Search failed:', searchResp.status, errBody.slice(0, 100));
      if (searchResp.status === 401 || searchResp.status === 403) {
        return {
          sourceUsedForScan: false,
          resolutionStatus: 'auth_failed',
          crossReferenceStatus: 'Auth Unavailable',
          registrationStatus: null, // cannot make any registration claim
          verified: false,
          authError: true,
          error: `Apple Music auth failed (${searchResp.status}) — cross-reference unavailable`,
        };
      }
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    }

    const searchData = await searchResp.json();
    const artists = searchData?.results?.artists?.data || [];
    console.log('[Royalte CrossRef Apple] Search returned', artists.length, 'candidates');
    artists.forEach((a, i) => console.log(`  [${i}] ${a.attributes?.name}`));

    // Multi-strategy matching
    let match = null;
    let matchConfidence = null;

    // Strategy 1: Exact normalized match (using normArtist for consistent stripping)
    const nq = normArtist(artistName);
    match = artists.find(a => normArtist(a.attributes?.name || '') === nq);
    if (match) { matchConfidence = 'exact'; }

    // Strategy 2: One name contains the other
    if (!match) {
      match = artists.find(a => {
        const cn = normArtist(a.attributes?.name || '');
        return cn.includes(nq) || nq.includes(cn);
      });
      if (match) { matchConfidence = 'contains'; }
    }

    // Strategy 3: High word overlap
    if (!match && nq.includes(' ')) {
      const queryWords = nq.split(' ').filter(w => w.length > 1);
      match = artists.find(a => {
        const cn = normArtist(a.attributes?.name || '');
        const cnWords = cn.split(' ').filter(w => w.length > 1);
        const overlap = queryWords.filter(w => cnWords.includes(w)).length;
        return overlap >= Math.max(1, queryWords.length - 1);
      });
      if (match) { matchConfidence = 'word_overlap'; }
    }

    // Strategy 4: Prefix fallback
    if (!match && artists.length > 0 && nq.length >= 4) {
      const firstNorm = normArtist(artists[0].attributes?.name || '');
      const minLen = Math.min(nq.length, firstNorm.length);
      const sharedPrefix = [...Array(minLen)].findIndex((_, i) => nq[i] !== firstNorm[i]);
      const prefixMatch = sharedPrefix === -1 ? minLen : sharedPrefix;
      if (prefixMatch >= 4) {
        match = artists[0];
        matchConfidence = 'prefix_fallback';
      }
    }

    if (!match) {
      console.log('[Royalte CrossRef Apple] No confident match found for:', artistName);
      console.log('[Royalte CrossRef Apple] Final status: No Verified Match Yet');
      return { sourceUsedForScan: false, resolutionStatus: 'resolved', crossReferenceStatus: 'No Verified Match Yet', registrationStatus: 'Not Registered', verified: true };
    }

    console.log('[Royalte CrossRef Apple] Match found:', match.attributes?.name, '| confidence:', matchConfidence);

    // Catalog comparison against top Spotify tracks
    let catalogComparison = null;
    if (spotifyTopTracks && spotifyTopTracks.length > 0) {
      const matched = [], notFound = [];
      for (const track of spotifyTopTracks.slice(0, 10)) {
        let found = false;
        if (track.isrc) {
          const isrcResp = await fetch(`${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${track.isrc}`, { headers });
          if (isrcResp.ok) {
            const isrcData = await isrcResp.json();
            found = (isrcData?.data?.length || 0) > 0;
          }
        }
        if (!found) {
          const q = encodeURIComponent(`${track.name} ${track.artistName}`);
          const sResp = await fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${q}&types=songs&limit=3`, { headers });
          if (sResp.ok) {
            const sData = await sResp.json();
            found = (sData?.results?.songs?.data || []).some(s => norm(s.attributes?.name) === norm(track.name));
          }
        }
        if (found) matched.push(track.name);
        else notFound.push(track.name);
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
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus: 'Cross-Reference Found',
      registrationStatus: 'Registered',
      verified: true,
      artistId: match.id,
      artistUrl: match.attributes?.url || null,
      artistName: match.attributes?.name,
      catalogComparison,
    };
  } catch (err) {
    console.error('[Royalte CrossRef Apple] Error:', err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference YouTube — real check, honest status
async function crossRefYouTube(artistName) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.warn('[Royalte CrossRef YouTube] API key not configured');
      return { sourceUsedForScan: false, resolutionStatus: 'not_checked', crossReferenceStatus: 'Not Confirmed', verified: false, reason: 'API key not configured' };
    }

    const norm = s => s.toLowerCase().trim();
    const query = encodeURIComponent(artistName);

    // Channel search
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=channel&maxResults=5&key=${apiKey}`
    );
    if (!channelResp.ok) {
      console.warn('[Royalte CrossRef YouTube] Channel search failed:', channelResp.status);
      return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    }

    const channelData = await channelResp.json();
    const channels = channelData.items || [];

    const officialChannel = channels.find(c =>
      norm(c.snippet.channelTitle) === norm(artistName) ||
      norm(c.snippet.channelTitle).includes(norm(artistName)) ||
      c.snippet.description?.toLowerCase().includes('official')
    ) || (channels.length > 0 ? channels[0] : null);

    let officialChannelData = null;
    let subscriberCount = 0;
    let videoCount = 0;

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
            subscriberCount = parseInt(stats.subscriberCount || 0);
            videoCount = parseInt(stats.videoCount || 0);
          }
        }
        officialChannelData = {
          title: officialChannel.snippet.channelTitle,
          channelId,
          subscribers: subscriberCount,
          videoCount,
        };
      }
    }

    // UGC scan
    const ugcResp = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10&key=${apiKey}`
    );
    let ugcVideoCount = 0;
    let ugcContentIdRisk = false;
    let topUgcVideos = [];

    if (ugcResp.ok) {
      const ugcData = await ugcResp.json();
      const ugcVideos = (ugcData.items || []).filter(v => {
        const ct = v.snippet?.channelTitle?.toLowerCase() || '';
        return !ct.includes(norm(artistName)) && !ct.includes('vevo');
      });
      ugcVideoCount = ugcVideos.length;
      ugcContentIdRisk = ugcVideoCount > 0 && !officialChannelData;
      topUgcVideos = ugcVideos.slice(0, 3).map(v => ({
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        videoId: v.id.videoId,
      }));
    }

    const officialChannelFound = !!officialChannelData;
    const crossReferenceStatus = officialChannelFound ? 'Cross-Reference Found' : 'No Verified Match Yet';

    console.log('[Royalte CrossRef YouTube] Status:', crossReferenceStatus, '| Channel:', officialChannelFound, '| UGC:', ugcVideoCount);

    return {
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus,
      registrationStatus: officialChannelFound ? 'Not Confirmed' : 'Not Confirmed', // Content ID can't be verified externally
      verified: true,
      officialChannelFound,
      officialChannel: officialChannelData,
      ugcFound: ugcVideoCount > 0,
      ugcVideoCount,
      ugcContentIdRisk,
      topUgcVideos,
      contentIdVerified: officialChannelFound && videoCount > 0,
    };
  } catch (err) {
    console.error('[Royalte CrossRef YouTube] Error:', err.message);
    return { sourceUsedForScan: false, resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false, error: err.message };
  }
}

// Cross-reference MusicBrainz
async function crossRefMusicBrainz(artistName) {
  try {
    const query = encodeURIComponent(`artist:"${artistName}"`);
    const resp = await fetch(
      `https://musicbrainz.org/ws/2/artist/?query=${query}&limit=3&fmt=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = data.artists?.length > 0;
    const multipleEntries = data.artists?.length > 1;
    return {
      sourceUsedForScan: false,
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found,
      artists: data.artists || [],
      multipleEntries,
    };
  } catch (err) {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Deezer
async function crossRefDeezer(artistName) {
  try {
    const resp = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`);
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = data.data?.some(a => norm(a.name) === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found: !!found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference AudioDB (country detection)
async function crossRefAudioDB(artistName) {
  try {
    const resp = await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`, {
      headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' },
    });
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = data.artists?.length > 0;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
      country: found ? data.artists[0].strCountry : null,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Discogs
async function crossRefDiscogs(artistName) {
  try {
    const resp = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)', 'Authorization': 'Discogs key=royalteaudit, secret=royalteaudit' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = data.results?.some(r => norm(r.title) === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      registrationStatus: found ? 'Registered' : 'Not Registered',
      verified: true,
      found: !!found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference SoundCloud
async function crossRefSoundCloud(artistName) {
  try {
    const resp = await fetch(
      `https://api.soundcloud.com/users?q=${encodeURIComponent(artistName)}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const found = Array.isArray(data) && data.some(u => norm(u.username) === norm(artistName) || norm(u.full_name || '') === norm(artistName));
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Last.fm
async function crossRefLastFm(artistName) {
  try {
    const key = process.env.LASTFM_API_KEY || '43693facbb24d1ac893a5d61c8e5d4c3';
    const resp = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${key}&format=json`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const found = !data.error && !!data.artist;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// Cross-reference Wikidata
async function crossRefWikidata(artistName) {
  try {
    const resp = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&type=item&format=json&limit=5`,
      { headers: { 'User-Agent': 'RoyalteAudit/1.0 (audit@royalte.ai)' } }
    );
    if (!resp.ok) return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
    const data = await resp.json();
    const norm = s => s.toLowerCase().trim();
    const musicTerms = ['musician', 'singer', 'rapper', 'artist', 'band', 'producer', 'songwriter'];
    const match = data.search?.find(r =>
      norm(r.label) === norm(artistName) &&
      musicTerms.some(t => r.description?.toLowerCase().includes(t))
    ) || data.search?.find(r => norm(r.label) === norm(artistName));
    const found = !!match;
    return {
      resolutionStatus: 'resolved',
      crossReferenceStatus: found ? 'Cross-Reference Found' : 'No Verified Match Yet',
      verified: true,
      found,
      country: null, // Wikidata country requires additional SPARQL query
    };
  } catch {
    return { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', verified: false };
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE E — MODULE STATES
// Each module has structured state. Source and cross-ref separated.
// ─────────────────────────────────────────────────────────────────
function buildModuleStates(subject, sourceResolution, crossRefs) {
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput = subject.inputPlatform === 'apple';
  const isTrack = subject.canonicalSubjectType === 'track';

  const spotifyRef = crossRefs.spotify;
  const appleRef = crossRefs.appleMusic;
  const youtubeRef = crossRefs.youtube;
  const mbRef = crossRefs.musicbrainz;

  // ── Module A: Metadata Integrity ─────────────────────────────
  const metaIssues = [];
  const hasGenres = subject.genres?.length > 0;
  const hasIsrc = !!subject.canonicalIsrc || (isAppleInput && crossRefs.spotify.isrc);
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;

  if (!hasGenres) metaIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (isTrack && !effectiveIsrc) metaIssues.push({ type: 'missing_isrc', status: 'Not Confirmed' });

  const metaState = {
    module: 'metadata_integrity',
    name: 'Metadata Integrity',
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: metaIssues.length === 0 ? 'No Issues Found' : `${metaIssues.length} issue(s)`,
    registrationStatus: null,
    verified: true,
    issues: metaIssues,
    displayStatus: metaIssues.length === 0 ? 'No issues detected' : `${metaIssues.length} issue(s) found`,
  };

  // ── Module B: Platform Coverage ───────────────────────────────
  const covIssues = [];

  // Input source is always verified — don't flag it as missing
  if (!isSpotifyInput && spotifyRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'not_on_spotify', status: 'No Verified Match Yet', platform: 'Spotify' });
  }
  if (!isAppleInput && appleRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'not_on_apple_music', status: 'No Verified Match Yet', platform: 'Apple Music' });
  }
  if (!mbRef.found) {
    covIssues.push({ type: 'not_in_musicbrainz', status: mbRef.crossReferenceStatus, platform: 'MusicBrainz' });
  }
  if (youtubeRef.crossReferenceStatus === 'No Verified Match Yet') {
    covIssues.push({ type: 'no_youtube_match', status: 'No Verified Match Yet', platform: 'YouTube' });
  }

  const covState = {
    module: 'platform_coverage',
    name: 'Platform Coverage',
    sourceUsedForScan: true,
    resolutionStatus: 'resolved',
    crossReferenceStatus: covIssues.length === 0 ? 'Cross-Reference Found' : `${covIssues.length} gap(s)`,
    registrationStatus: null,
    verified: true,
    issues: covIssues,
    displayStatus: covIssues.length === 0 ? 'All checked platforms found' : `${covIssues.length} gap(s) found`,
  };

  // ── Module C: Publishing Risk ─────────────────────────────────
  const pubState = {
    module: 'publishing_risk',
    name: 'Publishing Risk',
    sourceUsedForScan: false,
    resolutionStatus: 'not_checked',
    crossReferenceStatus: 'Manual Check Required',
    registrationStatus: 'Not Confirmed',
    verified: false,
    issues: [
      { type: 'soundexchange_unconfirmed', status: 'Manual Check Required' },
      { type: 'pro_not_connected', status: 'Manual Check Required' },
    ],
    displayStatus: 'Manual Check Required — cannot verify via public data',
  };

  // ── Module D: Duplicate Detection ────────────────────────────
  const dupIssues = [];
  if (mbRef.multipleEntries) {
    dupIssues.push({ type: 'multiple_mb_entries', status: 'Not Confirmed', count: mbRef.artists?.length });
  }
  const dupState = {
    module: 'duplicate_detection',
    name: 'Duplicate Detection',
    sourceUsedForScan: false,
    resolutionStatus: mbRef.resolutionStatus,
    crossReferenceStatus: dupIssues.length === 0 ? 'No Issues Found' : 'Not Confirmed',
    registrationStatus: null,
    verified: mbRef.verified,
    issues: dupIssues,
    displayStatus: dupIssues.length === 0 ? 'No duplicates found' : `${mbRef.artists?.length} MusicBrainz entries`,
  };

  // ── Module E: YouTube / UGC ───────────────────────────────────
  const ytState = {
    module: 'youtube_ugc',
    name: 'YouTube / UGC',
    sourceUsedForScan: false,
    resolutionStatus: youtubeRef.resolutionStatus,
    crossReferenceStatus: youtubeRef.crossReferenceStatus,
    registrationStatus: 'Not Confirmed', // Content ID cannot be verified externally
    verified: youtubeRef.verified,
    officialChannelFound: youtubeRef.officialChannelFound || false,
    ugcFound: youtubeRef.ugcFound || false,
    ugcContentIdRisk: youtubeRef.ugcContentIdRisk || false,
    issues: [],
    displayStatus: youtubeRef.resolutionStatus === 'not_checked'
      ? 'Not Confirmed — API key not configured'
      : youtubeRef.crossReferenceStatus,
  };

  if (youtubeRef.resolutionStatus === 'resolved') {
    if (!youtubeRef.officialChannelFound) {
      ytState.issues.push({ type: 'no_youtube_channel', status: 'No Verified Match Yet' });
    }
    if (youtubeRef.ugcContentIdRisk) {
      ytState.issues.push({ type: 'ugc_content_id_risk', status: 'Not Confirmed' });
    }
  }

  // ── Module F: Sync Readiness ──────────────────────────────────
  const syncIssues = [];
  if (!hasGenres) syncIssues.push({ type: 'missing_genres', status: 'Not Confirmed' });
  if (isTrack && !effectiveIsrc) syncIssues.push({ type: 'missing_isrc', status: 'Not Confirmed' });
  if (!mbRef.found) syncIssues.push({ type: 'not_in_musicbrainz', status: mbRef.crossReferenceStatus });
  if (!crossRefs.wikidata.found) syncIssues.push({ type: 'no_wikipedia', status: 'No Verified Match Yet' });
  if (!isAppleInput && appleRef.crossReferenceStatus === 'No Verified Match Yet') {
    syncIssues.push({ type: 'not_on_apple_music', status: 'No Verified Match Yet' });
  }

  const syncState = {
    module: 'sync_readiness',
    name: 'Sync Readiness',
    sourceUsedForScan: false,
    resolutionStatus: 'resolved',
    crossReferenceStatus: syncIssues.length === 0 ? 'Sync Ready' : `${syncIssues.length} gap(s)`,
    registrationStatus: null,
    verified: true,
    issues: syncIssues,
    displayStatus: syncIssues.length === 0 ? 'Sync-ready' : `${syncIssues.length} gap(s)`,
  };

  return {
    metadata: metaState,
    coverage: covState,
    publishing: pubState,
    duplicates: dupState,
    youtube: ytState,
    sync: syncState,
  };
}

// ─────────────────────────────────────────────────────────────────
// ROYALTY RISK SCORE
// Only verified cross-reference findings contribute to score
// Unresolved or not_checked = +0
// ─────────────────────────────────────────────────────────────────
function calculateRoyaltyRiskScore(subject, moduleStates, crossRefs) {
  let score = 0;

  const isTrack = subject.canonicalSubjectType === 'track';
  const isAppleInput = subject.inputPlatform === 'apple';
  const isSpotifyInput = subject.inputPlatform === 'spotify';

  // Verified: ISRC missing on track (only if we actually checked and found it missing)
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;
  if (isTrack && !effectiveIsrc && crossRefs.spotify.resolutionStatus === 'resolved') score += 25;

  // Verified: Missing genres (confirmed via source API)
  if (!subject.genres?.length) score += 15;

  // Verified: Not in MusicBrainz (confirmed via MB API)
  if (crossRefs.musicbrainz.resolutionStatus === 'resolved' && !crossRefs.musicbrainz.found) score += 15;

  // Verified: Not on Apple Music cross-reference (only if Spotify was input AND Apple check actually completed AND no match)
  // auth_failed = +0 (cannot make a registration claim from a failed auth)
  if (isSpotifyInput && crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.crossReferenceStatus === 'No Verified Match Yet') score += 15;

  // Verified: Not on Spotify cross-reference (only if Apple was input AND Spotify check completed AND no match)
  if (isAppleInput && crossRefs.spotify.resolutionStatus === 'resolved' && crossRefs.spotify.crossReferenceStatus === 'No Verified Match Yet') score += 10;

  // Manual check required — weighted lower since unverified
  // SoundExchange — always manual, always apply
  score += 10;

  // PRO — always manual, always apply
  score += 10;

  // YouTube: no official channel (only if check ran successfully)
  if (crossRefs.youtube.resolutionStatus === 'resolved' && !crossRefs.youtube.officialChannelFound) score += 10;

  // YouTube: UGC risk (only if check ran)
  if (crossRefs.youtube.resolutionStatus === 'resolved' && crossRefs.youtube.ugcContentIdRisk) score += 10;

  // Catalog gap on Apple Music cross-reference (only if verified)
  if (crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.catalogComparison?.matchRate < 70) score += 10;

  return Math.min(score, 100);
}

// ─────────────────────────────────────────────────────────────────
// VERIFIED ISSUES — built AFTER all cross-references complete
// ─────────────────────────────────────────────────────────────────
function buildVerifiedIssues(subject, moduleStates, crossRefs) {
  const issues = [];
  const isTrack = subject.canonicalSubjectType === 'track';
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput = subject.inputPlatform === 'apple';
  const effectiveIsrc = subject.canonicalIsrc || crossRefs.spotify.isrc || null;

  // ── Verified: ISRC missing on track scan ────────────────────
  if (isTrack && !effectiveIsrc && crossRefs.spotify.resolutionStatus === 'resolved') {
    issues.push({
      type: 'missing_isrc',
      module: 'Metadata Integrity',
      priority: 'HIGH',
      status: 'Not Confirmed',
      verifiedBy: isSpotifyInput ? 'Spotify API (source)' : 'Spotify cross-reference',
      title: 'ISRC not found on this recording',
      detail: 'The International Standard Recording Code (ISRC) was not returned by Spotify for this track. Without an ISRC, performance royalty routing cannot be confirmed.',
    });
  }

  // ── Verified: ISRC gaps on artist scan — track-by-track check ──
  // Only fires when we have actual track data to check against.
  // Never fires on artist scans without track data (no false positives).
  if (!isTrack && subject.trackIsrcReport && subject.trackIsrcReport.length > 0) {
    const missingIsrc = subject.trackIsrcReport.filter(t => !t.hasIsrc);
    if (missingIsrc.length > 0) {
      issues.push({
        type: 'tracks_missing_isrc',
        module: 'Metadata Integrity',
        priority: missingIsrc.length >= 3 ? 'HIGH' : 'MEDIUM',
        status: 'Not Registered',
        verifiedBy: 'Spotify API — top tracks endpoint',
        title: `${missingIsrc.length} of ${subject.trackIsrcReport.length} top tracks missing ISRC`,
        detail: `The following tracks have no ISRC: ${missingIsrc.map(t => t.name).join(', ')}. Without an ISRC, performance royalty routing cannot be confirmed for these recordings.`,
      });
    }
  }

  // ── Verified: Missing genres ──────────────────────────────────
  if (!subject.genres?.length) {
    issues.push({
      type: 'missing_genres',
      module: 'Metadata Integrity',
      priority: 'MEDIUM',
      status: 'Not Confirmed',
      verifiedBy: `${subject.inputPlatform === 'spotify' ? 'Spotify' : 'Apple Music'} API (source)`,
      title: 'Genre tags absent on source profile',
      detail: 'No genre metadata found on the source platform. Genre tags affect algorithmic discovery and publishing discoverability.',
    });
  }

  // ── Platform presence issues — read from platformConfirmation (single source of truth) ──
  // platformConfirmation is stored on crossRefs for access here without changing signature
  const pc = crossRefs._platformConfirmation;

  if (pc) {
    // Apple Music — only fire if pc says NO_MATCH (not auth failure, not possible match)
    if (isSpotifyInput && pc.apple.noMatch) {
      issues.push({
        type: 'not_on_apple_music',
        module: 'Platform Coverage',
        priority: 'HIGH',
        status: 'No Match',
        verifiedBy: 'Apple Music API (cross-reference)',
        title: 'No Apple Music match found',
        detail: 'Cross-reference against Apple Music returned no verified match for this artist. Distribution gaps here may be limiting royalty collection.',
      });
    }
    if (isSpotifyInput && pc.apple.authFail) {
      issues.push({
        type: 'apple_auth_unavailable',
        module: 'Platform Coverage',
        priority: 'MEDIUM',
        status: 'Auth Unavailable',
        verifiedBy: null,
        title: 'Apple Music cross-reference temporarily unavailable',
        detail: 'Apple Music authentication failed during this scan. This does not indicate the artist is unregistered on Apple Music.',
      });
    }
    // Spotify — only fire if pc says NO_MATCH
    if (isAppleInput && pc.spotify.noMatch) {
      issues.push({
        type: 'not_on_spotify',
        module: 'Platform Coverage',
        priority: 'HIGH',
        status: 'No Match',
        verifiedBy: 'Spotify API (cross-reference)',
        title: 'No Spotify match found',
        detail: 'Cross-reference against Spotify returned no verified match for this artist.',
      });
    }
  } else {
    // Fallback — no platformConfirmation available, use raw cross-ref (safe defaults)
    const appleRef = crossRefs.appleMusic;
    if (isSpotifyInput && appleRef.resolutionStatus === 'resolved' && appleRef.crossReferenceStatus === 'No Verified Match Yet') {
      issues.push({ type: 'not_on_apple_music', module: 'Platform Coverage', priority: 'HIGH', status: 'No Match', verifiedBy: 'Apple Music API', title: 'No Apple Music match found', detail: 'Cross-reference against Apple Music returned no verified match.' });
    }
  }

  // ── Cross-ref verified: Apple catalog gap (Spotify input only) ───
  if (isSpotifyInput && crossRefs.appleMusic.resolutionStatus === 'resolved' && crossRefs.appleMusic.catalogComparison) {
    const { matchRate, notFound, tracksChecked } = crossRefs.appleMusic.catalogComparison;
    if (matchRate < 70 && notFound.length > 0) {
      issues.push({
        type: 'apple_catalog_gap',
        module: 'Platform Coverage',
        priority: matchRate < 50 ? 'HIGH' : 'MEDIUM',
        status: 'No Verified Match Yet',
        verifiedBy: 'Apple Music API (cross-reference via ISRC)',
        title: `${notFound.length} of ${tracksChecked} top tracks not matched on Apple Music`,
        detail: `Unmatched: ${notFound.slice(0, 3).join(', ')}${notFound.length > 3 ? ` and ${notFound.length - 3} more` : ''}. Distribution may be incomplete.`,
      });
    }
  }

  // ── Cross-ref verified: Not in MusicBrainz ───────────────────
  if (crossRefs.musicbrainz.resolutionStatus === 'resolved' && !crossRefs.musicbrainz.found) {
    issues.push({
      type: 'not_in_musicbrainz',
      module: 'Publishing Risk',
      priority: 'MEDIUM',
      status: 'Not Registered',
      verifiedBy: 'MusicBrainz API (cross-reference)',
      title: 'Not found in MusicBrainz',
      detail: 'MusicBrainz is used as a publishing reference database by royalty collection systems. Not registered may affect cross-platform data linking.',
    });
  }

  // ── YouTube: no official channel (only if check completed) ───
  if (crossRefs.youtube.resolutionStatus === 'resolved' && !crossRefs.youtube.officialChannelFound) {
    issues.push({
      type: 'no_youtube_channel',
      module: 'YouTube / UGC',
      priority: 'MEDIUM',
      status: 'No Verified Match Yet',
      verifiedBy: 'YouTube Data API v3 (cross-reference)',
      title: 'No official YouTube channel matched',
      detail: 'YouTube cross-reference returned no confirmed official channel for this artist. Content ID monetisation status cannot be confirmed.',
    });
  }

  // ── YouTube: UGC risk (only if check completed) ───────────────
  if (crossRefs.youtube.resolutionStatus === 'resolved' && crossRefs.youtube.ugcContentIdRisk) {
    issues.push({
      type: 'ugc_content_id_risk',
      module: 'YouTube / UGC',
      priority: 'HIGH',
      status: 'Not Confirmed',
      verifiedBy: 'YouTube Data API v3',
      title: `${crossRefs.youtube.ugcVideoCount} user-uploaded video(s) found — no official channel confirmed`,
      detail: 'User-uploaded content found on YouTube with no verified official channel. Content ID registration status cannot be confirmed.',
    });
  }

  // ── Always show: SoundExchange (manual check required) ───────
  issues.push({
    type: 'soundexchange_unconfirmed',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Manual Check Required',
    verifiedBy: null,
    title: 'SoundExchange — verify your ISRC registration',
    detail: 'Being registered with SoundExchange is not enough — each recording's ISRC must be individually linked to your account. Unlinked ISRCs mean uncollected digital performance royalties.',
    steps: [
      'Log into your SoundExchange portal at soundexchange.com',
      'Go to My Catalog and search for each of your track titles',
      'If a track is missing — get its ISRC from your distributor dashboard',
      'Use Register a Sound Recording to add the ISRC manually',
      'Confirm your artist name matches exactly how it appears on each recording',
      'Ask your distributor to confirm they auto-report your ISRCs to SoundExchange on every release',
    ],
  });

  // ── Always show: PRO (manual check required) ─────────────────
  const country = crossRefs.audiodb?.country || crossRefs.wikidata?.country || null;
  issues.push({
    type: 'pro_not_connected',
    module: 'Publishing Risk',
    priority: 'MEDIUM',
    status: 'Manual Check Required',
    verifiedBy: null,
    title: 'PRO registration — manual check required',
    detail: 'Performance Rights Organisation membership cannot be verified via public data. PRO membership is required to collect performance royalties from radio, TV, and public performance.',
  });

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return issues.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─────────────────────────────────────────────────────────────────
// COVERAGE STATUSES — for UI display, using correct status families
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// TERRITORY SIGNALS
// Always returns the 5 baseline territories.
// Uses honest Coverage Signal / Confidence — never Registered/Not Registered.
// ─────────────────────────────────────────────────────────────────

const BASELINE_TERRITORIES = [
  { code: 'CA', flag: '🇨🇦', name: 'Canada' },
  { code: 'US', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: 'FR', flag: '🇫🇷', name: 'France' },
];

// Infer home country from AudioDB, Wikidata, or genre signals
function inferHomeCountry(crossRefs, genres = []) {
  const raw = crossRefs.audiodb?.country || crossRefs.wikidata?.country || null;
  if (!raw) return null;
  const r = raw.toLowerCase();
  if (r.includes('canada')) return 'CA';
  if (r.includes('united states') || r.includes('usa') || r.includes('u.s.')) return 'US';
  if (r.includes('united kingdom') || r.includes('england') || r.includes('scotland') || r.includes('wales')) return 'GB';
  if (r.includes('germany')) return 'DE';
  if (r.includes('france')) return 'FR';
  return null;
}

function buildTerritorySignals(subject, crossRefs) {
  const homeCountry = inferHomeCountry(crossRefs, subject.genres);
  const isOnSpotify = subject.inputPlatform === 'spotify' || crossRefs.spotify?.crossReferenceStatus === 'Cross-Reference Found';
  const isOnApple = subject.inputPlatform === 'apple' || crossRefs.appleMusic?.crossReferenceStatus === 'Cross-Reference Found';
  const appleAuthFailed = crossRefs.appleMusic?.authError || crossRefs.appleMusic?.resolutionStatus === 'auth_failed';
  const spotifyFailed = crossRefs.spotify?.resolutionStatus === 'failed';

  // Build signal per territory
  const territories = BASELINE_TERRITORIES.map(t => {
    let coverageSignal, confidence, note;

    const isHome = t.code === homeCountry;

    // Coverage Signal logic
    if (isHome) {
      // Home territory — higher confidence from source platform
      if (isOnSpotify && isOnApple) {
        coverageSignal = 'Likely Covered';
        confidence = 'Inferred';
        note = 'Artist present on both Spotify and Apple Music in this market.';
      } else if (isOnSpotify || isOnApple) {
        coverageSignal = 'Likely Covered';
        confidence = 'Inferred';
        note = 'Artist present on at least one major streaming platform in this market.';
      } else {
        coverageSignal = 'Coverage Unclear';
        confidence = 'Unknown';
        note = 'Platform presence could not be confirmed in this market.';
      }
    } else {
      // Non-home territory
      if (isOnSpotify && isOnApple) {
        coverageSignal = 'Likely Covered';
        confidence = 'Inferred';
        note = 'Artist present on Spotify and Apple Music — global distribution inferred.';
      } else if (isOnSpotify || isOnApple) {
        coverageSignal = 'Coverage Unclear';
        confidence = 'Inferred';
        note = 'Partial platform presence. Territory-specific availability not confirmed.';
      } else if (appleAuthFailed || spotifyFailed) {
        coverageSignal = 'Coverage Unknown';
        confidence = 'Unknown';
        note = 'Cross-reference check unavailable — cannot confirm coverage.';
      } else {
        coverageSignal = 'Coverage Unknown';
        confidence = 'Unknown';
        note = 'No verified data available for this territory.';
      }
    }

    return {
      ...t,
      isHome,
      coverageSignal,   // 'Likely Covered' | 'Coverage Unclear' | 'Coverage Unknown'
      confidence,       // 'Verified' | 'Inferred' | 'Unknown'
      note,
    };
  });

  // Pin home territory to top
  const sorted = homeCountry
    ? [
        ...territories.filter(t => t.isHome),
        ...territories.filter(t => !t.isHome),
      ]
    : territories;

  return sorted;
}


// ─────────────────────────────────────────────────────────────────
// PLATFORM CONFIRMATION — SINGLE SOURCE OF TRUTH
// Must be computed immediately after cross-references.
// All downstream sections read from this, never from independent logic.
// ─────────────────────────────────────────────────────────────────

function buildPlatformConfirmation(subject, crossRefs) {
  const isSpotify = subject.inputPlatform === 'spotify';
  const isApple   = subject.inputPlatform === 'apple';

  // ── Source platform — always confirmed (we resolved it) ──────
  const sourceStatus = 'CONFIRMED';

  // ── Opposite platform — derive from cross-ref result ─────────
  function derivePlatformState(ref) {
    if (!ref) return 'AUTH_UNAVAILABLE';
    const rs  = ref.resolutionStatus;
    const crs = ref.crossReferenceStatus;
    // Auth failures — must never become NO_MATCH
    if (rs === 'auth_failed' || ref.authError)  return 'AUTH_UNAVAILABLE';
    if (rs === 'failed')                         return 'AUTH_UNAVAILABLE';
    // Resolved states
    if (rs === 'resolved') {
      if (crs === 'Cross-Reference Found' || crs === 'Source Verified' ||
          crs === 'Profile Resolved'      || crs === 'Track Resolved')    return 'CONFIRMED';
      if (crs === 'Possible Match')                                        return 'POSSIBLE_MATCH';
      if (crs === 'No Verified Match Yet' || crs === 'No Match')           return 'NO_MATCH';
    }
    return 'AUTH_UNAVAILABLE';
  }

  const spotifyState = isSpotify ? 'CONFIRMED' : derivePlatformState(crossRefs.spotify);
  const appleState   = isApple   ? 'CONFIRMED' : derivePlatformState(crossRefs.appleMusic);

  // ── Overall confirmation label ────────────────────────────────
  let overallStatus;
  if (spotifyState === 'CONFIRMED' && appleState === 'CONFIRMED') {
    overallStatus = 'CONFIRMED_ON_BOTH';
  } else if (spotifyState === 'AUTH_UNAVAILABLE' || appleState === 'AUTH_UNAVAILABLE') {
    const confirmedCount = [spotifyState, appleState].filter(s => s === 'CONFIRMED').length;
    overallStatus = confirmedCount > 0 ? 'CONFIRMED_ON_SOURCE_ONLY' : 'AUTH_UNAVAILABLE';
  } else if (spotifyState === 'POSSIBLE_MATCH' || appleState === 'POSSIBLE_MATCH') {
    overallStatus = 'POSSIBLE_MATCH';
  } else if (spotifyState === 'CONFIRMED' || appleState === 'CONFIRMED') {
    overallStatus = 'CONFIRMED_ON_SOURCE_ONLY';
  } else {
    overallStatus = 'NO_MATCH';
  }

  // ── Human-readable labels ─────────────────────────────────────
  const displayLabels = {
    CONFIRMED_ON_BOTH:     'Confirmed on both platforms',
    CONFIRMED_ON_SOURCE_ONLY: 'Confirmed on source platform only',
    POSSIBLE_MATCH:        'Possible cross-platform match',
    NO_MATCH:              'No cross-platform match found',
    AUTH_UNAVAILABLE:      'Cross-platform verification unavailable',
  };

  const result = {
    spotify: {
      state:      spotifyState,
      confirmed:  spotifyState === 'CONFIRMED',
      possible:   spotifyState === 'POSSIBLE_MATCH',
      noMatch:    spotifyState === 'NO_MATCH',
      authFail:   spotifyState === 'AUTH_UNAVAILABLE',
      isSource:   isSpotify,
      displayStatus: spotifyState === 'CONFIRMED'
        ? (isSpotify ? 'Source Verified' : 'Cross-Reference Found')
        : spotifyState === 'POSSIBLE_MATCH' ? 'Possible Match'
        : spotifyState === 'NO_MATCH'       ? 'No Match'
        : 'Auth Unavailable',
    },
    apple: {
      state:      appleState,
      confirmed:  appleState === 'CONFIRMED',
      possible:   appleState === 'POSSIBLE_MATCH',
      noMatch:    appleState === 'NO_MATCH',
      authFail:   appleState === 'AUTH_UNAVAILABLE',
      isSource:   isApple,
      displayStatus: appleState === 'CONFIRMED'
        ? (isApple ? 'Source Verified' : 'Cross-Reference Found')
        : appleState === 'POSSIBLE_MATCH' ? 'Possible Match'
        : appleState === 'NO_MATCH'       ? 'No Match'
        : 'Auth Unavailable',
    },
    overallStatus,
    overallLabel: displayLabels[overallStatus] || overallStatus,
  };

  console.log('[Royalte PlatformConfirmation] Spotify:', result.spotify.state,
    '| Apple:', result.apple.state, '| Overall:', overallStatus);

  return result;
}

// buildCoverageStatuses now accepts platformConfirmation as the single source of truth.
// All platform presence states come from platformConfirmation — no independent logic.
function buildCoverageStatuses(subject, sourceResolution, crossRefs, platformConfirmation) {
  const isSpotifyInput = subject.inputPlatform === 'spotify';
  const isAppleInput   = subject.inputPlatform === 'apple';

  // Fallback if called without platformConfirmation (defensive)
  const pc = platformConfirmation || buildPlatformConfirmation(subject, crossRefs);

  const statuses = [];

  // ── Spotify ── read from platformConfirmation, never from raw crossRef ──
  statuses.push({
    platform: 'Spotify',
    role: pc.spotify.isSource ? 'input_source' : 'cross_reference',
    status: pc.spotify.displayStatus,
    verified: pc.spotify.confirmed || pc.spotify.possible,
    detail: pc.spotify.authFail
      ? 'Spotify cross-reference unavailable — API authentication issue. This does not confirm the artist is absent.'
      : pc.spotify.possible
      ? 'Possible match found — metadata similarity is below high-confidence threshold.'
      : null,
  });

  // ── Apple Music ── read from platformConfirmation ───────────────────────
  statuses.push({
    platform: 'Apple Music',
    role: pc.apple.isSource ? 'input_source' : 'cross_reference',
    status: pc.apple.displayStatus,
    verified: pc.apple.confirmed || pc.apple.possible,
    detail: pc.apple.authFail
      ? 'Apple Music cross-reference unavailable — Apple authentication error. This does not indicate the artist is unregistered.'
      : pc.apple.possible
      ? 'Possible match found — metadata similarity is below high-confidence threshold.'
      : null,
  });

  // YouTube
  const yt = crossRefs.youtube;
  statuses.push({
    platform: 'YouTube',
    role: 'cross_reference',
    status: yt.resolutionStatus === 'not_checked' ? 'Not Confirmed'
      : yt.resolutionStatus === 'failed' ? 'Not Confirmed'
      : yt.crossReferenceStatus,
    verified: yt.verified,
    detail: yt.ugcContentIdRisk ? 'User-uploaded content found. Content ID status unconfirmed.' : null,
  });

  // MusicBrainz
  const mb = crossRefs.musicbrainz;
  statuses.push({
    platform: 'MusicBrainz',
    role: 'cross_reference',
    status: mb.resolutionStatus === 'failed' ? 'Not Confirmed' : mb.crossReferenceStatus,
    verified: mb.verified,
    detail: mb.multipleEntries ? `${mb.artists?.length} entries found — possible duplicates` : null,
  });

  // SoundExchange — always manual
  statuses.push({
    platform: 'SoundExchange',
    role: 'rights_system',
    status: 'Manual Check Required',
    verified: false,
    detail: 'Cannot be verified via public data. Check soundexchange.com directly.',
  });

  // PRO
  const country = crossRefs.audiodb?.country || null;
  const proGuide = getPROGuide(country);
  statuses.push({
    platform: 'PRO (Performance Rights)',
    role: 'rights_system',
    status: 'Manual Check Required',
    verified: false,
    detail: country
      ? `Your local PRO may be ${proGuide.pro}. Cannot be verified via public data.`
      : 'Cannot be verified via public data. Find your PRO at cisac.org.',
  });

  return statuses;
}

// ─────────────────────────────────────────────────────────────────
// ACTION PLAN
// ─────────────────────────────────────────────────────────────────
function buildActionPlan(verifiedIssues, country) {
  if (!verifiedIssues.length) {
    return [{ action: 'No verified issues detected', reason: 'No action required based on verified data', priority: null }];
  }

  const proGuide = getPROGuide(country);

  const actionMap = {
    missing_isrc: { action: 'Register this recording with your distributor to obtain an ISRC', reason: 'ISRC not found — verified via API', priority: 'HIGH' },
    missing_genres: { action: 'Add genre metadata to your source platform artist profile', reason: 'Genre tags absent — verified via source API', priority: 'MEDIUM' },
    not_on_apple_music: { action: 'Distribute your catalog to Apple Music via your distributor', reason: 'No Apple Music match found — verified via cross-reference', priority: 'HIGH' },
    not_on_spotify: { action: 'Distribute your catalog to Spotify via your distributor', reason: 'No Spotify match found — verified via cross-reference', priority: 'HIGH' },
    apple_catalog_gap: { action: 'Review Apple Music distribution and re-deliver missing tracks', reason: 'Tracks not matched on Apple Music — verified via ISRC cross-reference', priority: 'MEDIUM' },
    not_in_musicbrainz: { action: 'Register your artist profile on MusicBrainz (musicbrainz.org)', reason: 'Not found in MusicBrainz — verified via API', priority: 'MEDIUM' },
    no_youtube_channel: { action: 'Create or claim your official YouTube channel and register for Content ID', reason: 'No official YouTube channel matched — verified via YouTube API', priority: 'MEDIUM' },
    ugc_content_id_risk: { action: 'Register for Content ID through your distributor or a YouTube OAC partner', reason: 'User-uploaded content found with no official channel — verified via YouTube API', priority: 'HIGH' },
    soundexchange_unconfirmed: {
      action: 'Verify your SoundExchange ISRC registration',
      reason: 'You may be registered with SoundExchange as a performer, but each individual recording needs its ISRC linked to your account to collect digital performance royalties. Unclaimed ISRCs mean uncollected money.',
      priority: 'MEDIUM',
      steps: [
        'Log into your SoundExchange portal at soundexchange.com',
        'Go to My Catalog and search for each of your track titles',
        'If a track is missing — get its ISRC from your distributor dashboard (DistroKid, TuneCore, CD Baby, etc.)',
        'Use Register a Sound Recording inside the portal to add the ISRC manually',
        'Check that your artist name is credited exactly as it appears on the recording — name mismatches (e.g. "Black Alternative" vs "Black Alternative feat. Chuck Ice") can cause royalties to go unclaimed',
        'Contact your distributor and confirm they are automatically reporting your ISRCs to SoundExchange on each release',
      ],
    },
    pro_not_connected: { action: country ? `Register with ${proGuide.pro} — ${proGuide.url}` : 'Register with your local PRO — find yours at cisac.org', reason: 'PRO registration is required to collect performance royalties', priority: 'MEDIUM' },
  };

  return verifiedIssues.filter(i => actionMap[i.type]).map(i => actionMap[i.type]);
}

// ─────────────────────────────────────────────────────────────────
// AUDIT CONFIDENCE
// ─────────────────────────────────────────────────────────────────
function deriveAuditConfidence(crossRefs, sourceResolution) {
  const resolved = Object.values(crossRefs).filter(r => r.resolutionStatus === 'resolved').length;
  const total = Object.keys(crossRefs).length;
  if (resolved >= total * 0.7) return 'High';
  if (resolved >= total * 0.4) return 'Limited';
  return 'Minimal';
}

// ─────────────────────────────────────────────────────────────────
// CATALOG ANALYSIS (Spotify source)
// ─────────────────────────────────────────────────────────────────
function analyzeCatalog(albumsData, artist) {
  const albums = albumsData.items || [];
  if (!albums.length) return { totalReleases: 0, earliestYear: null, latestYear: null, recentActivity: false };
  const years = albums.map(a => parseInt(a.release_date?.substring(0, 4))).filter(y => !isNaN(y) && y > 1950);
  const currentYear = new Date().getFullYear();
  return {
    totalReleases: albums.length,
    earliestYear: years.length ? Math.min(...years) : null,
    latestYear: years.length ? Math.max(...years) : null,
    recentActivity: years.some(y => y >= currentYear - 2),
  };
}


// ─────────────────────────────────────────────────────────────────
// CROSS-PLATFORM TRACK VALIDATION
// Primary: ISRC match. Fallback: name+artist+duration. Low: name only.
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// METADATA NORMALIZATION ENGINE
// Strips features, versions, brackets, accents before comparison.
// ─────────────────────────────────────────────────────────────────

function normStr(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents (safe unicode escape)
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Deep normalization for track title matching:
// Removes feat/ft/featuring, brackets, version/remix/edit suffixes, apostrophes
function normTrack(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')          // remove apostrophes
    .replace(/\([^)]*\)/g, ' ')               // remove (parenthetical content)
    .replace(/\[[^\]]*\]/g, ' ')             // remove [bracketed content]
    .replace(/\{[^}]*\}/g, ' ')               // remove {braced content}
    .replace(/\b(feat|ft|featuring|with|x)\b.*$/i, '') // remove feat. and everything after
    .replace(/\b(remix|radio edit|radio mix|acoustic|instrumental|live|version|edit|remaster|remastered|cover|reprise|demo|mix|extended|stripped|vevo|official)\b.*$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ').trim();
}

// Primary artist normalization: lowercase, strip features, punctuation
function normArtist(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/\b(feat|ft|featuring|with|x|and|&)\b.*$/i, '') // stop at first feat/and
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Word overlap similarity — returns 0–1 (1 = identical words)
function wordSimilarity(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = new Set(b.split(' ').filter(w => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  return intersection / Math.max(wa.size, wb.size);
}

// Resolve a match result from a list of candidates (Spotify or Apple)
// Returns the highest-confidence result across all 4 strategies
function resolveBestMatch(candidates, track, getNameFn, getArtistFn, getDurationFn, getIsrcFn) {
  const nt = normTrack(track.name);
  const na = normArtist(track.artistName);
  const td = track.durationMs || 0;

  // Strategy A: ISRC match (highest confidence)
  if (track.isrc) {
    const isrcMatch = candidates.find(c => getIsrcFn(c) === track.isrc);
    if (isrcMatch) return { status: 'Matched', confidence: 'HIGH', matchedName: getNameFn(isrcMatch), matchedIsrc: getIsrcFn(isrcMatch) };
  }

  // Strategy B: Exact normalized title + artist + duration ±3s
  const exactDuration = candidates.find(c => {
    const cd = getDurationFn(c) || 0;
    return normTrack(getNameFn(c)) === nt &&
           normArtist(getArtistFn(c)) === na &&
           (td === 0 || cd === 0 || Math.abs(cd - td) <= 3000);
  });
  if (exactDuration) return { status: 'Matched', confidence: 'MEDIUM', matchedName: getNameFn(exactDuration), matchedIsrc: getIsrcFn(exactDuration) };

  // Strategy C: Exact normalized title + artist (no duration)
  const exactMeta = candidates.find(c =>
    normTrack(getNameFn(c)) === nt && normArtist(getArtistFn(c)) === na
  );
  if (exactMeta) return { status: 'Matched', confidence: 'MEDIUM', matchedName: getNameFn(exactMeta), matchedIsrc: getIsrcFn(exactMeta) };

  // Strategy D: Exact normalized title only (artist may differ slightly)
  const titleOnly = candidates.find(c => normTrack(getNameFn(c)) === nt);
  if (titleOnly) return { status: 'Possible Match', confidence: 'LOW', matchedName: getNameFn(titleOnly), matchedIsrc: getIsrcFn(titleOnly) };

  // Strategy E: High word overlap on title (fuzzy — catches minor variations)
  const fuzzy = candidates
    .map(c => ({ c, sim: wordSimilarity(normTrack(getNameFn(c)), nt) }))
    .filter(x => x.sim >= 0.75)
    .sort((a, b) => b.sim - a.sim)[0];
  if (fuzzy) return { status: 'Possible Match', confidence: 'LOW', matchedName: getNameFn(fuzzy.c), matchedIsrc: getIsrcFn(fuzzy.c) };

  return { status: 'No Match', confidence: null, matchedName: null, matchedIsrc: null };
}

// ─────────────────────────────────────────────────────────────────
// CROSS-PLATFORM VALIDATORS
// ─────────────────────────────────────────────────────────────────

async function crossValidateTrackOnSpotify(track, token) {
  try {
    // Strategy 1: ISRC direct lookup (most reliable)
    if (track.isrc) {
      const resp = await fetch(
        `https://api.spotify.com/v1/search?q=isrc:${track.isrc}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok && resp.status !== 404) {
        return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
      }
      if (resp.ok) {
        const data = await resp.json();
        const match = data.tracks?.items?.[0];
        if (match) {
          console.log('[CrossValidate Spotify] ISRC match:', match.name);
          return { status: 'Matched', confidence: 'HIGH', matchedName: match.name, matchedIsrc: match.external_ids?.isrc || track.isrc };
        }
      }
    }

    // Strategy 2a: Structured search with field qualifiers
    const q1 = encodeURIComponent(`track:${track.name} artist:${track.artistName}`);
    const resp2a = await fetch(
      `https://api.spotify.com/v1/search?q=${q1}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // Strategy 2b: Plain text search (more forgiving for special chars / variants)
    const q2 = encodeURIComponent(`${track.name} ${track.artistName}`);
    const resp2b = await fetch(
      `https://api.spotify.com/v1/search?q=${q2}&type=track&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const candidates2a = resp2a.ok ? (await resp2a.json()).tracks?.items || [] : [];
    const candidates2b = resp2b.ok ? (await resp2b.json()).tracks?.items || [] : [];

    // Deduplicate and merge candidates
    const seenIds = new Set();
    const candidates = [...candidates2a, ...candidates2b].filter(c => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    console.log('[CrossValidate Spotify] Candidates:', candidates.length, 'for track:', track.name);

    const result = resolveBestMatch(
      candidates, track,
      c => c.name,
      c => c.artists?.[0]?.name || '',
      c => c.duration_ms || 0,
      c => c.external_ids?.isrc || null,
    );

    console.log('[CrossValidate Spotify] Result:', result.status, result.confidence, '| matched:', result.matchedName);
    return result;

  } catch (err) {
    console.error('[CrossValidate Spotify] Error:', err.message);
    return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
  }
}

async function crossValidateTrackOnApple(track) {
  try {
    let appleToken;
    try { appleToken = generateAppleToken(); }
    catch (e) { return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null }; }

    const BASE = 'https://api.music.apple.com/v1';
    const STOREFRONT = 'us';
    const headers = { Authorization: `Bearer ${appleToken}` };

    // Strategy 1: ISRC direct lookup
    if (track.isrc) {
      const resp = await fetch(
        `${BASE}/catalog/${STOREFRONT}/songs?filter[isrc]=${track.isrc}`,
        { headers }
      );
      if (resp.status === 401 || resp.status === 403) {
        return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
      }
      if (resp.ok) {
        const data = await resp.json();
        const match = data.data?.[0];
        if (match) {
          console.log('[CrossValidate Apple] ISRC match:', match.attributes?.name);
          return { status: 'Matched', confidence: 'HIGH', matchedName: match.attributes?.name, matchedIsrc: track.isrc };
        }
      }
    }

    // Strategy 2: Search — try track name alone for broader results
    const q1 = encodeURIComponent(`${track.name} ${track.artistName}`);
    const q2 = encodeURIComponent(track.name); // name-only fallback
    const [resp2a, resp2b] = await Promise.all([
      fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${q1}&types=songs&limit=10`, { headers }),
      fetch(`${BASE}/catalog/${STOREFRONT}/search?term=${q2}&types=songs&limit=10`, { headers }),
    ]);

    if ((resp2a.status === 401 || resp2a.status === 403)) {
      return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
    }

    const candidates2a = resp2a.ok ? (await resp2a.json()).results?.songs?.data || [] : [];
    const candidates2b = resp2b.ok ? (await resp2b.json()).results?.songs?.data || [] : [];

    const seenIds = new Set();
    const candidates = [...candidates2a, ...candidates2b].filter(c => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    console.log('[CrossValidate Apple] Candidates:', candidates.length, 'for track:', track.name);

    const result = resolveBestMatch(
      candidates, track,
      c => c.attributes?.name || '',
      c => c.attributes?.artistName || '',
      c => c.attributes?.durationInMillis || 0,
      c => c.attributes?.isrc || null,
    );

    console.log('[CrossValidate Apple] Result:', result.status, result.confidence, '| matched:', result.matchedName);

    // Remap 'No Match' to 'Missing' for backward compat with ISRC table status logic
    if (result.status === 'No Match') return { ...result, status: 'Missing' };
    return result;

  } catch (err) {
    console.error('[CrossValidate Apple] Error:', err.message);
    return { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
  }
}

// Build ISRC table for artist scan — 5 tracks with cross-platform validation
async function buildIsrcTableForArtist(tracks, sourceplatform, spotifyToken) {
  const rows = [];
  for (const track of tracks) {
    let spotifyStatus, appleStatus;
    if (sourceplatform === 'spotify') {
      spotifyStatus = { status: 'Verified (Source)', confidence: 'SOURCE', matchedIsrc: track.isrc };
      appleStatus = await crossValidateTrackOnApple(track);
    } else {
      appleStatus = { status: 'Verified (Source)', confidence: 'SOURCE', matchedIsrc: track.isrc };
      spotifyStatus = spotifyToken
        ? await crossValidateTrackOnSpotify(track, spotifyToken)
        : { status: 'Auth Unavailable', confidence: null, matchedName: null, matchedIsrc: null };
    }

    // Overall match status — collapse No Match and Missing to platform-specific label
    let matchStatus;
    const appleS = appleStatus.status;
    const spotifyS = spotifyStatus.status;
    if (spotifyS === 'Verified (Source)' && appleS === 'Matched') matchStatus = 'Matched';
    else if (appleS === 'Verified (Source)' && spotifyS === 'Matched') matchStatus = 'Matched';
    else if (appleS === 'Auth Unavailable' || spotifyS === 'Auth Unavailable') matchStatus = 'Auth Unavailable';
    else if (appleS === 'Possible Match' || spotifyS === 'Possible Match') matchStatus = 'Possible Match';
    else if (appleS === 'Missing' || appleS === 'No Match') matchStatus = 'Missing on Apple';
    else if (spotifyS === 'Missing' || spotifyS === 'No Match') matchStatus = 'Missing on Spotify';
    else matchStatus = 'Not Confirmed';

    rows.push({
      name: track.name,
      artistName: track.artistName,
      isrc: track.isrc || null,
      isrcDisplay: track.isrc || 'ISRC unavailable',
      durationMs: track.durationMs,
      spotify: { status: spotifyStatus.status, confidence: spotifyStatus.confidence },
      apple: { status: appleStatus.status, confidence: appleStatus.confidence },
      matchStatus,
    });
  }
  return rows;
}

// Build ISRC table for track scan — single track cross-platform
async function buildIsrcTableForTrack(subject, crossRefs) {
  const isSpotify = subject.inputPlatform === 'spotify';
  const spotifyIsrc = subject.canonicalIsrc || crossRefs.spotify?.isrc || null;

  // Get opposite platform match status
  let spotifyStatus, appleStatus;
  if (isSpotify) {
    spotifyStatus = { status: 'Verified (Source)', confidence: 'SOURCE' };
    // Check if Apple cross-ref found a match
    const am = crossRefs.appleMusic;
    if (am.authError || am.resolutionStatus === 'auth_failed') {
      appleStatus = { status: 'Auth Unavailable', confidence: null };
    } else if (am.resolutionStatus === 'resolved' && am.crossReferenceStatus === 'Cross-Reference Found') {
      appleStatus = { status: 'Matched', confidence: am.isrcMatchConfidence || 'MEDIUM' };
    } else if (am.resolutionStatus === 'resolved') {
      appleStatus = { status: 'Missing', confidence: null };
    } else {
      appleStatus = { status: 'Not Confirmed', confidence: null };
    }
  } else {
    appleStatus = { status: 'Verified (Source)', confidence: 'SOURCE' };
    const sp = crossRefs.spotify;
    if (sp.resolutionStatus === 'failed') {
      spotifyStatus = { status: 'Auth Unavailable', confidence: null };
    } else if (sp.crossReferenceStatus === 'Cross-Reference Found') {
      spotifyStatus = { status: 'Matched', confidence: sp.isrcMatchConfidence || 'MEDIUM' };
    } else if (sp.resolutionStatus === 'resolved') {
      spotifyStatus = { status: 'Missing', confidence: null };
    } else {
      spotifyStatus = { status: 'Not Confirmed', confidence: null };
    }
  }

  let matchStatus;
  if (spotifyStatus.status === 'Verified (Source)' && appleStatus.status === 'Matched') matchStatus = 'Matched';
  else if (appleStatus.status === 'Verified (Source)' && spotifyStatus.status === 'Matched') matchStatus = 'Matched';
  else if (appleStatus.status === 'Auth Unavailable' || spotifyStatus.status === 'Auth Unavailable') matchStatus = 'Auth Unavailable';
  else if (appleStatus.status === 'Possible Match' || spotifyStatus.status === 'Possible Match') matchStatus = 'Possible Match';
  else if (appleStatus.status === 'Missing') matchStatus = 'Missing on Apple';
  else if (spotifyStatus.status === 'Missing') matchStatus = 'Missing on Spotify';
  else matchStatus = 'Not Confirmed';

  return [{
    name: subject.canonicalTrackName,
    artistName: subject.canonicalArtistName,
    isrc: spotifyIsrc,
    isrcDisplay: spotifyIsrc || 'ISRC unavailable',
    spotify: spotifyStatus,
    apple: appleStatus,
    matchStatus,
  }];
}

// ─────────────────────────────────────────────────────────────────
// SCORING — Track Integrity Score and Catalog Quality Score
// ─────────────────────────────────────────────────────────────────

function calculateTrackIntegrityScore(subject, crossRefs, isrcTable) {
  let score = 100;
  const isrc = subject.canonicalIsrc || crossRefs.spotify?.isrc || null;
  const row = isrcTable?.[0];

  if (!isrc) score -= 25;
  if (row?.matchStatus === 'Missing on Apple' || row?.matchStatus === 'Missing on Spotify') score -= 25;
  if (row?.matchStatus === 'Possible Match') score -= 10;
  if (row?.matchStatus === 'Auth Unavailable') { /* no penalty — auth failure not artist's fault */ }
  if (!subject.genres?.length) score -= 10;
  if (crossRefs.musicbrainz?.resolutionStatus === 'resolved' && !crossRefs.musicbrainz?.found) score -= 10;

  return { score: Math.max(score, 0), type: 'Track Integrity Score', label: trackIntegrityLabel(score) };
}

function trackIntegrityLabel(score) {
  if (score >= 85) return 'Strong';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Fair';
  return 'Needs Attention';
}

// Limited verification sentinel — used throughout to signal no score
const INSUFFICIENT = {
  score: null,
  type: 'Catalog Quality Score',
  label: 'Limited Verification',
  insufficient: true,
  message: 'Your catalog is active across platforms, but key royalty systems are not fully verified. This may impact your ability to collect all available revenue.',
};

function calculateCatalogQualityScore(isrcTable) {
  // ── Threshold gate — must pass before any score is generated ───
  if (!isrcTable || isrcTable.length === 0) return INSUFFICIENT;

  const total = isrcTable.length;
  const authUnavail  = isrcTable.filter(t => t.matchStatus === 'Auth Unavailable').length;
  const resolved     = isrcTable.filter(t => t.matchStatus !== 'Auth Unavailable').length;
  const hasIsrc      = isrcTable.filter(t => !!t.isrc).length;
  const matched      = isrcTable.filter(t => t.matchStatus === 'Matched').length;
  const missingIsrc  = isrcTable.filter(t => !t.isrc).length;
  const missingApple = isrcTable.filter(t => t.matchStatus === 'Missing on Apple').length;
  const missingSpot  = isrcTable.filter(t => t.matchStatus === 'Missing on Spotify').length;
  const possibleOnly = isrcTable.filter(t => t.matchStatus === 'Possible Match').length;

  // Minimum thresholds — per spec
  const enoughResolvedTracks   = resolved >= 3;                  // at least 3 of 5 resolved
  const enoughIsrc             = hasIsrc >= 2;                   // ISRC on at least 2 tracks
  const notBlockedByAuth       = authUnavail < Math.ceil(total / 2); // auth failures not majority

  console.log('[Royalte Score] Catalog threshold check — resolved:', resolved, '/ isrc:', hasIsrc, '/ authFail:', authUnavail,
    '| pass:', enoughResolvedTracks && enoughIsrc && notBlockedByAuth);

  if (!enoughResolvedTracks || !enoughIsrc || !notBlockedByAuth) {
    return {
      ...INSUFFICIENT,
      breakdown: { total, resolved, hasIsrc, authUnavail, matched, missingIsrc, missingApple, missingSpot, possibleOnly },
    };
  }

  // ── Score calculation — only runs when threshold is met ─────────
  // Base against resolved tracks only (exclude auth-unavailable from denominator)
  const base = resolved;
  let score = 100;
  score -= (missingIsrc  / base) * 30;
  score -= (missingApple / base) * 25;
  score -= (missingSpot  / base) * 25;
  score -= (possibleOnly / base) * 10;

  const finalScore = Math.round(Math.max(score, 0));

  return {
    score: finalScore,
    type: 'Catalog Quality Score',
    label: catalogQualityLabel(finalScore),
    insufficient: false,
    breakdown: { total, resolved, matched, missingIsrc, missingApple, missingSpot, possibleOnly, authUnavail },
  };
}

function catalogQualityLabel(score) {
  if (score >= 85) return 'Strong';
  if (score >= 65) return 'Good';
  if (score >= 45) return 'Fair';
  return 'Needs Attention';
}


// ─────────────────────────────────────────────────────────────────
// GLOBAL COLLECTION READINESS
// Evaluates: ISRC presence, distribution coverage, metadata,
// cross-platform presence. No country data. Only verifiable signals.
// ─────────────────────────────────────────────────────────────────
function buildCollectionReadiness(subject, crossRefs, isrcTable) {
  const items = [];

  // ── ISRC presence ───────────────────────────────────────────────
  const isArtist = subject.canonicalSubjectType === 'artist';
  let isrcStatus, isrcNote;
  if (isArtist && isrcTable?.length > 0) {
    const withIsrc = isrcTable.filter(t => t.isrc).length;
    const total = isrcTable.length;
    if (withIsrc === total) {
      isrcStatus = 'READY';
      isrcNote = `ISRC confirmed on all ${total} verified tracks.`;
    } else if (withIsrc >= Math.ceil(total / 2)) {
      isrcStatus = 'PARTIAL';
      isrcNote = `ISRC confirmed on ${withIsrc} of ${total} tracks. Missing ISRCs may affect royalty routing.`;
    } else {
      isrcStatus = 'AT RISK';
      isrcNote = `ISRC missing on ${total - withIsrc} of ${total} tracks. Performance royalty routing cannot be confirmed.`;
    }
  } else if (!isArtist) {
    const hasIsrc = !!(subject.canonicalIsrc);
    isrcStatus = hasIsrc ? 'READY' : 'AT RISK';
    isrcNote = hasIsrc
      ? 'ISRC confirmed on this recording.'
      : 'ISRC not found. Performance royalty routing cannot be confirmed for this track.';
  } else {
    isrcStatus = 'PARTIAL';
    isrcNote = 'ISRC data unavailable for this scan.';
  }
  items.push({ label: 'ISRC Registration', status: isrcStatus, note: isrcNote });

  // ── Distribution coverage ───────────────────────────────────────
  const onSpotify = subject.inputPlatform === 'spotify' || crossRefs.spotify?.crossReferenceStatus === 'Cross-Reference Found';
  const onApple   = subject.inputPlatform === 'apple'   || crossRefs.appleMusic?.crossReferenceStatus === 'Cross-Reference Found';
  const appleAuth = crossRefs.appleMusic?.authError || crossRefs.appleMusic?.resolutionStatus === 'auth_failed';

  let distStatus, distNote;
  if (onSpotify && onApple) {
    distStatus = 'READY';
    distNote = 'Catalog confirmed on Spotify and Apple Music.';
  } else if (onSpotify && appleAuth) {
    distStatus = 'PARTIAL';
    distNote = 'Spotify confirmed. Apple Music verification unavailable due to authentication issue.';
  } else if (onSpotify || onApple) {
    distStatus = 'PARTIAL';
    distNote = 'Catalog confirmed on one major platform. Cross-platform distribution not fully verified.';
  } else {
    distStatus = 'AT RISK';
    distNote = 'Distribution coverage could not be confirmed on major streaming platforms.';
  }
  items.push({ label: 'Distribution Coverage', status: distStatus, note: distNote });

  // ── Metadata consistency ────────────────────────────────────────
  const hasGenres = subject.genres?.length > 0;
  let metaStatus, metaNote;
  if (isArtist && isrcTable?.length > 0) {
    const consistent = isrcTable.filter(t => t.matchStatus === 'Matched').length;
    const total = isrcTable.length;
    if (consistent === total) {
      metaStatus = 'READY';
      metaNote = 'Track metadata consistent across platforms.';
    } else if (consistent >= 1) {
      metaStatus = 'PARTIAL';
      metaNote = `Metadata matched on ${consistent} of ${total} tracks. Inconsistencies may affect royalty attribution.`;
    } else {
      metaStatus = 'AT RISK';
      metaNote = 'Track metadata could not be confirmed consistent across platforms.';
    }
  } else {
    metaStatus = hasGenres ? 'READY' : 'PARTIAL';
    metaNote = hasGenres
      ? 'Genre metadata present on source platform.'
      : 'Genre metadata absent on source platform. May affect discoverability and publishing.';
  }
  items.push({ label: 'Metadata Consistency', status: metaStatus, note: metaNote });

  // ── Cross-platform presence ─────────────────────────────────────
  let crossStatus, crossNote;
  if (onSpotify && onApple) {
    crossStatus = 'READY';
    crossNote = 'Cross-platform presence verified on both major DSPs.';
  } else if (appleAuth) {
    crossStatus = 'PARTIAL';
    crossNote = 'Cross-platform check incomplete — Apple Music authentication unavailable.';
  } else if (onSpotify || onApple) {
    crossStatus = 'PARTIAL';
    crossNote = 'Present on one major platform. Full cross-platform presence not confirmed.';
  } else {
    crossStatus = 'AT RISK';
    crossNote = 'Cross-platform presence could not be verified.';
  }
  items.push({ label: 'Cross-Platform Presence', status: crossStatus, note: crossNote });

  // Overall status
  const atRisk  = items.filter(i => i.status === 'AT RISK').length;
  const partial = items.filter(i => i.status === 'PARTIAL').length;
  const overall = atRisk > 0 ? 'AT RISK' : partial > 0 ? 'PARTIAL' : 'READY';

  return { overall, items };
}

// ─────────────────────────────────────────────────────────────────
// PRO GUIDE
// ─────────────────────────────────────────────────────────────────
function getPROGuide(country) {
  const guides = {
    'Canada': { pro: 'SOCAN', url: 'https://www.socan.com' },
    'United States': { pro: 'ASCAP or BMI', url: 'https://www.ascap.com' },
    'United Kingdom': { pro: 'PRS for Music', url: 'https://www.prsformusic.com' },
    'Germany': { pro: 'GEMA', url: 'https://www.gema.de' },
    'France': { pro: 'SACEM', url: 'https://www.sacem.fr' },
    'Australia': { pro: 'APRA AMCOS', url: 'https://www.apraamcos.com.au' },
    'Jamaica': { pro: 'JACAP', url: 'https://www.jacap.org' },
  };
  const defaultGuide = { pro: 'Your local PRO', url: 'https://www.cisac.org' };
  if (!country) return defaultGuide;
  const match = Object.keys(guides).find(k => country.toLowerCase().includes(k.toLowerCase()));
  return match ? { ...guides[match], country: match } : { ...defaultGuide, country };
}

// ─────────────────────────────────────────────────────────────────
// SPOTIFY API HELPERS
// ─────────────────────────────────────────────────────────────────
async function getSpotifyToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
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

async function getSpotifyAlbums(artistId, token) {
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return { items: [] };
    return resp.json();
  } catch { return { items: [] }; }
}

async function getSpotifyTopTracks(artistId, token) {
  // Legacy — kept for Apple cross-ref catalog comparison
  try {
    const resp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
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

// Fetch up to 5 clean original tracks from artist catalog for ISRC table
async function getSpotifyArtistTracks(artistId, token, limit = 5) {
  try {
    // Fetch albums + singles across catalog
    const albumsResp = await fetch(
      `https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single&market=US`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!albumsResp.ok) return [];
    const albumsData = await albumsResp.json();
    const albums = albumsData.items || [];

    const EXCLUDE_PATTERNS = /\b(remix|remixed|live|acoustic|instrumental|karaoke|clean|explicit|version|edit|cover|remaster|remastered|stripped|demo|radio|mix|reprise|interlude|skit|intro|outro)\b/i;
    const seenTitles = new Set();
    const seenIsrc = new Set();
    const tracks = [];

    for (const album of albums) {
      if (tracks.length >= limit) break;
      try {
        const tracksResp = await fetch(
          `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!tracksResp.ok) continue;
        const tracksData = await tracksResp.json();

        for (const t of (tracksData.items || [])) {
          if (tracks.length >= limit) break;

          const name = t.name || '';
          const normName = name.toLowerCase().trim();

          // Filter out non-original tracks
          if (EXCLUDE_PATTERNS.test(name)) continue;

          // Deduplicate by normalized title
          if (seenTitles.has(normName)) continue;

          // Fetch full track to get ISRC and duration
          let isrc = null;
          let durationMs = t.duration_ms || 0;
          try {
            const fullResp = await fetch(
              `https://api.spotify.com/v1/tracks/${t.id}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (fullResp.ok) {
              const full = await fullResp.json();
              isrc = full.external_ids?.isrc || null;
              durationMs = full.duration_ms || durationMs;
            }
          } catch {}

          // Deduplicate by ISRC
          if (isrc && seenIsrc.has(isrc)) continue;

          seenTitles.add(normName);
          if (isrc) seenIsrc.add(isrc);

          tracks.push({
            id: t.id,
            name,
            artistName: t.artists?.[0]?.name || '',
            isrc,
            durationMs,
            albumName: album.name,
            albumId: album.id,
          });
        }
      } catch { continue; }
    }

    console.log('[Royalte Spotify] Artist tracks fetched:', tracks.length, '/ requested:', limit);
    return tracks;
  } catch (err) {
    console.error('[Royalte Spotify] getSpotifyArtistTracks error:', err.message);
    return [];
  }
}

// Fetch 5 clean original tracks from Apple Music artist catalog
async function getAppleArtistTracks(appleArtistId, storefront = 'us', limit = 5) {
  try {
    const appleToken = generateAppleToken();
    const BASE = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };

    // Fetch artist albums
    const albumsResp = await fetch(
      `${BASE}/catalog/${storefront}/artists/${appleArtistId}/albums?limit=25`,
      { headers }
    );
    if (!albumsResp.ok) {
      console.warn('[Royalte Apple] Artist albums fetch failed:', albumsResp.status);
      return { tracks: [], authFailed: albumsResp.status === 401 || albumsResp.status === 403 };
    }
    const albumsData = await albumsResp.json();
    const albums = albumsData.data || [];

    const EXCLUDE_PATTERNS = /\b(remix|remixed|live|acoustic|instrumental|karaoke|clean|explicit|version|edit|cover|remaster|remastered|stripped|demo|radio|mix|reprise|interlude|skit|intro|outro)\b/i;
    const seenTitles = new Set();
    const seenIsrc = new Set();
    const tracks = [];

    for (const album of albums) {
      if (tracks.length >= limit) break;
      try {
        const tracksResp = await fetch(
          `${BASE}/catalog/${storefront}/albums/${album.id}/tracks`,
          { headers }
        );
        if (!tracksResp.ok) continue;
        const tracksData = await tracksResp.json();

        for (const t of (tracksData.data || [])) {
          if (tracks.length >= limit) break;
          const name = t.attributes?.name || '';
          const normName = name.toLowerCase().trim();
          if (EXCLUDE_PATTERNS.test(name)) continue;
          if (seenTitles.has(normName)) continue;

          const isrc = t.attributes?.isrc || null;
          if (isrc && seenIsrc.has(isrc)) continue;

          seenTitles.add(normName);
          if (isrc) seenIsrc.add(isrc);

          tracks.push({
            id: t.id,
            name,
            artistName: t.attributes?.artistName || '',
            isrc,
            durationMs: (t.attributes?.durationInMillis) || 0,
            albumName: album.attributes?.name || '',
            albumId: album.id,
          });
        }
      } catch { continue; }
    }

    console.log('[Royalte Apple] Artist tracks fetched:', tracks.length, '/ requested:', limit);
    return { tracks, authFailed: false };
  } catch (err) {
    console.error('[Royalte Apple] getAppleArtistTracks error:', err.message);
    return { tracks: [], authFailed: false, error: err.message };
  }
}
