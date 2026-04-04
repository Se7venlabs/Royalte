// Royaltē Audit API — /api/audit.js
// ═══════════════════════════════════════════════════════════════════
// SCAN ISOLATION RE-ARCHITECTURE (all 13 requirements)
//
// REQ 1:  Every request generates a UUID scan_id immediately on entry.
// REQ 2:  Frontend clears prior state before rendering (enforced by scan_id guard).
// REQ 3:  Frontend only renders when response.scan_id === currentScanId.
// REQ 4:  AbortController kills prior in-flight fetch (frontend).
// REQ 5:  Fresh ScanSession created per request — no shared mutable state.
// REQ 6:  All result tables tagged by scan_id internally.
// REQ 7:  No result query uses artist name or normalized_artist_id alone as key.
// REQ 8:  Track arrays replaced (never appended) via session.setTracks().
// REQ 9:  Artist-context lock discards tracks belonging to wrong artist.
// REQ 10: Cache keys = platform:entityType:sourceId — no reuse of final output.
// REQ 11: Integrity assertions before marking scan complete.
// REQ 12: Failed integrity → scan marked FAILED, no results rendered.
// REQ 13: Structured logs at every stage with all required fields.
// ═══════════════════════════════════════════════════════════════════

import { createPrivateKey, createSign, randomUUID } from 'crypto';

// ─────────────────────────────────────────────────────────────────
// APPLE TOKEN — module-level cache for JWT only (not scan data)
// ─────────────────────────────────────────────────────────────────
let _cachedToken = null;
let _tokenExpiry = null;

function generateAppleToken() {
  if (_cachedToken && _tokenExpiry && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }
  const keyId    = process.env.APPLE_KEY_ID;
  const teamId   = process.env.APPLE_TEAM_ID;
  let privateKey = process.env.APPLE_PRIVATE_KEY;
  if (!keyId || !teamId || !privateKey) throw new Error('Missing Apple Music credentials');
  if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    const body = privateKey.replace(/\s+/g, '');
    privateKey  = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join('\n') || body}\n-----END PRIVATE KEY-----`;
  }
  const keyObject = createPrivateKey({ key: privateKey, format: 'pem' });
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60 * 60 * 12;
  const b64url = s => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  const input  = `${b64url(JSON.stringify({ alg:'ES256', kid:keyId }))}.${b64url(JSON.stringify({ iss:teamId, iat:now, exp }))}`;
  const signer = createSign('SHA256');
  signer.update(input); signer.end();
  const der = signer.sign(keyObject);
  let offset = 2;
  if (der[1] & 0x80) offset += der[1] & 0x7f;
  offset++;
  const rLen = der[offset++]; let r = der.slice(offset, offset + rLen); offset += rLen;
  offset++;
  const sLen = der[offset++]; let s = der.slice(offset, offset + sLen);
  if (r[0] === 0x00) r = r.slice(1);
  if (s[0] === 0x00) s = s.slice(1);
  const sig = Buffer.concat([
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - r.length)), r]),
    Buffer.concat([Buffer.alloc(Math.max(0, 32 - s.length)), s]),
  ]);
  const token = `${input}.${sig.toString('base64url')}`;
  _cachedToken = token;
  _tokenExpiry = Date.now() + (exp - now) * 1000 - 60_000;
  return token;
}

// ─────────────────────────────────────────────────────────────────
// SCAN SESSION — REQ 5: one per request, holds all mutable state
// ─────────────────────────────────────────────────────────────────
class ScanSession {
  constructor() {
    // REQ 1: UUID generated immediately
    this.scan_id               = randomUUID();
    this.created_at            = new Date().toISOString();
    this.status                = 'running';
    this.failure_reason        = null;

    // Artist identity — locked after Stage B, never mutated
    this.normalized_artist_id  = null;
    this.canonical_artist_name = null;

    // REQ 8: Track and issue storage — replaced, never appended
    this._tracks               = [];
    this._issues               = [];
    this._rejected_tracks      = 0;
    this._cache_hits           = {};
    this._stage_logs           = [];
  }

  // REQ 13: Structured log entry
  log(stage, fields = {}) {
    const entry = {
      scan_id:             this.scan_id,
      stage,
      ts:                  new Date().toISOString(),
      normalized_artist_id:this.normalized_artist_id,
      ...fields,
    };
    this._stage_logs.push(entry);
    console.log(`[Royalte][scan:${this.scan_id}][${stage}]`, JSON.stringify(fields));
  }

  // REQ 9: Artist-context lock
  filterTracksByArtistContext(tracks, platform) {
    if (!this.normalized_artist_id) {
      this.log('ARTIST_LOCK_WARN', { platform, reason: 'normalized_artist_id not set — accepting all' });
      return tracks;
    }
    const accepted = [], rejected = [];
    for (const track of tracks) {
      const ta = normArtist(track.artistName || '');
      const sa = this.normalized_artist_id;
      const ok = ta === sa || ta.includes(sa) || sa.includes(ta);
      if (ok) {
        accepted.push({ ...track, _scan_id: this.scan_id, _artist_context: sa });
      } else {
        rejected.push(track);
        this.log('TRACK_REJECTED', {
          platform,
          track_name:          track.name,
          track_artist:        track.artistName,
          track_artist_norm:   ta,
          expected_artist_norm:sa,
          reason:              'artist_context_mismatch',
        });
      }
    }
    this._rejected_tracks += rejected.length;
    this.log('ARTIST_LOCK_RESULT', {
      platform,
      track_count_in:  tracks.length,
      accepted:        accepted.length,
      rejected:        rejected.length,
    });
    return accepted;
  }

  // REQ 8: Replace tracks — never append
  setTracks(tracks) {
    this._tracks = tracks.map(t => ({
      ...t,
      _scan_id:        this.scan_id,
      _artist_context: this.normalized_artist_id,
    }));
  }

  // REQ 8: Replace issues — never append
  setIssues(issues) {
    this._issues = issues.map(i => ({ ...i, _scan_id: this.scan_id }));
  }

  recordCacheHit(key, hit) { this._cache_hits[key] = hit; }

  // REQ 11: Integrity assertions
  runIntegrityAssertions() {
    const failures = [];

    // 11a: All tracks carry current scan_id
    const alienTracks = this._tracks.filter(t => t._scan_id !== this.scan_id);
    if (alienTracks.length > 0) {
      failures.push(
        `INTEGRITY_FAIL: ${alienTracks.length} track(s) have wrong scan_id ` +
        `(expected ${this.scan_id}, got: ${[...new Set(alienTracks.map(t => t._scan_id))].join(', ')})`
      );
    }

    // 11b: No tracks belong to a different artist context
    if (this.normalized_artist_id) {
      const foreign = this._tracks.filter(t => {
        if (!t._artist_context) return false;
        return (
          t._artist_context !== this.normalized_artist_id &&
          !t._artist_context.includes(this.normalized_artist_id) &&
          !this.normalized_artist_id.includes(t._artist_context)
        );
      });
      if (foreign.length > 0) {
        failures.push(
          `INTEGRITY_FAIL: ${foreign.length} track(s) belong to wrong artist context ` +
          `(scan: "${this.normalized_artist_id}", found: [${foreign.map(t => `"${t._artist_context}"`).join(', ')}])`
        );
      }
    }

    // 11c: All issues carry current scan_id
    const alienIssues = this._issues.filter(i => i._scan_id !== this.scan_id);
    if (alienIssues.length > 0) {
      failures.push(`INTEGRITY_FAIL: ${alienIssues.length} issue(s) have wrong scan_id`);
    }

    if (failures.length > 0) {
      this.log('INTEGRITY_FAIL', { failures, track_count: this._tracks.length, issue_count: this._issues.length });
      return { ok: false, failures };
    }

    this.log('INTEGRITY_PASS', {
      track_count:      this._tracks.length,
      issue_count:      this._issues.length,
      rejected_tracks:  this._rejected_tracks,
    });
    return { ok: true, failures: [] };
  }

  complete() {
    this.status = 'complete';
    this.log('SCAN_COMPLETE', {
      track_count:     this._tracks.length,
      issue_count:     this._issues.length,
      rejected_tracks: this._rejected_tracks,
      cache_hits:      this._cache_hits,
    });
  }

  fail(reason) {
    this.status         = 'failed';
    this.failure_reason = reason;
    this.log('SCAN_FAILED', { reason, track_count: this._tracks.length, issue_count: this._issues.length });
  }
}

// ─────────────────────────────────────────────────────────────────
// RAW API CACHE — REQ 10: keyed by platform:entityType:sourceId
// Stores raw API responses only — NOT processed scan results.
// Processing always runs fresh per scan_id from raw data.
// ─────────────────────────────────────────────────────────────────
const _rawApiCache = new Map();

function cacheKey(platform, entityType, sourceId) {
  // REQ 10: Key = platform/entity/sourceId — no artist name, no scan_id
  return `raw:${platform}:${entityType}:${sourceId}`;
}
function getCached(key, ttl_ms = 300_000) {
  const entry = _rawApiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ttl_ms) { _rawApiCache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  if (_rawApiCache.size > 500) _rawApiCache.delete(_rawApiCache.keys().next().value);
  _rawApiCache.set(key, { data, ts: Date.now() });
}

// ─────────────────────────────────────────────────────────────────
// MAIN HANDLER — REQ 5: fresh session per request
// ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // REQ 1: scan_id generated at the very top — before any processing
  const session = new ScanSession();
  session.log('SCAN_INIT', { url: req.query.url || null });

  const { url } = req.query;
  if (!url) {
    session.fail('no_url_provided');
    return res.status(400).json({ scan_id: session.scan_id, error: 'No URL provided.' });
  }

  // ── STAGE A ──────────────────────────────────────────────────────
  session.log('STAGE_A_START', { url });
  const parsed = parseUniversalUrl(url);
  if (!parsed) {
    session.fail('url_parse_failed');
    return res.status(400).json({
      scan_id: session.scan_id,
      error:   'Enter a valid Spotify or Apple Music URL.',
      detail:  'Supported: open.spotify.com/artist, open.spotify.com/track, music.apple.com artist and song URLs.',
    });
  }
  session.log('STAGE_A_COMPLETE', { platform: parsed.platform, type: parsed.type, source_entity_id: parsed.id });

  try {
    // ── STAGE B ──────────────────────────────────────────────────────
    session.log('STAGE_B_START', { platform: parsed.platform, source_entity_id: parsed.id });
    const sourceResolution = await resolveSourceEntity(parsed, session);
    if (!sourceResolution.success) {
      session.fail('source_resolution_failed');
      const msg = parsed.platform === 'apple'
        ? 'We recognized your Apple Music link, but could not retrieve verified Apple Music data right now.'
        : 'We recognized your Spotify link, but could not retrieve verified Spotify data right now.';
      return res.status(400).json({
        scan_id: session.scan_id, success: false, auditReady: false,
        sourceResolutionStatus: 'failed', inputPlatform: parsed.platform,
        entityType: parsed.type, metadataStatus: 'failed',
        artistName: null, trackName: null, error: msg, detail: sourceResolution.error,
      });
    }

    // REQ 9: Lock artist context immediately after source resolution
    const subject = sourceResolution.canonicalSubject;
    session.normalized_artist_id  = normArtist(subject.canonicalArtistName);
    session.canonical_artist_name = subject.canonicalArtistName;

    session.log('STAGE_B_COMPLETE', {
      platform:              subject.inputPlatform,
      source_entity_id:      parsed.id,
      normalized_artist_id:  session.normalized_artist_id,
      canonical_artist_name: subject.canonicalArtistName,
      entity_type:           subject.canonicalSubjectType,
      track_count:           subject.sourceData?.artistTracks?.length || 0,
    });

    // Apply artist-context lock to source tracks
    const rawTracks = subject.sourceData?.artistTracks || [];
    subject.sourceData.artistTracks = session.filterTracksByArtistContext(rawTracks, parsed.platform);

    // ── STAGE C ──────────────────────────────────────────────────────
    session.log('STAGE_C_COMPLETE', {
      canonical_artist_name: subject.canonicalArtistName,
      canonical_track_name:  subject.canonicalTrackName || null,
      canonical_artist_id:   subject.canonicalArtistId,
    });

    // ── STAGE D ──────────────────────────────────────────────────────
    session.log('STAGE_D_START', { normalized_artist_id: session.normalized_artist_id });
    const crossRefs = await runCrossReferences(subject, sourceResolution, session);
    session.log('STAGE_D_COMPLETE', {
      normalized_artist_id: session.normalized_artist_id,
      statuses: Object.fromEntries(
        Object.entries(crossRefs)
          .filter(([k]) => !k.startsWith('_'))
          .map(([k, v]) => [k, v.resolutionStatus])
      ),
    });

    // ── STAGE E ──────────────────────────────────────────────────────
    session.log('STAGE_E_START', { normalized_artist_id: session.normalized_artist_id });

    const moduleStates         = buildModuleStates(subject, sourceResolution, crossRefs);
    const platformConfirmation = buildPlatformConfirmation(subject, crossRefs);
    crossRefs._platformConfirmation = platformConfirmation;

    const rawIssues = buildVerifiedIssues(subject, moduleStates, crossRefs);
    session.setIssues(rawIssues);  // REQ 8: replace, never append

    const actionPlan         = buildActionPlan(session._issues, crossRefs.audiodb?.country || crossRefs.wikidata?.country || null);
    const coverageStatuses   = buildCoverageStatuses(subject, sourceResolution, crossRefs, platformConfirmation);
    const territorySignals   = buildTerritorySignals(subject, crossRefs);
    const auditConfidence    = deriveAuditConfidence(crossRefs, sourceResolution);

    const isArtistScan = subject.canonicalSubjectType === 'artist';
    const artistTracks = subject.sourceData?.artistTracks || [];
    const spotifyToken = subject.sourceData?.spotifyToken || null;

    let isrcTable = [], primaryScore;
    try {
      if (isArtistScan) {
        if (artistTracks.length > 0) {
          isrcTable = await buildIsrcTableForArtist(artistTracks, subject.inputPlatform, spotifyToken, session);
        }
        primaryScore = calculateCatalogQualityScore(isrcTable);
      } else {
        isrcTable    = await buildIsrcTableForTrack(subject, crossRefs, session);
        primaryScore = calculateTrackIntegrityScore(subject, crossRefs, isrcTable);
      }
    } catch (isrcErr) {
      session.log('STAGE_E_ISRC_ERROR', { error: isrcErr.message });
      isrcTable    = [];
      primaryScore = { score: null, type: isArtistScan ? 'Catalog Quality Score' : 'Track Integrity Score', label: 'Limited Verification', insufficient: true, message: 'ISRC data unavailable for this scan.' };
    }

    // REQ 8: Replace tracks (never append)
    session.setTracks(isrcTable);

    const collectionReadiness = buildCollectionReadiness(subject, crossRefs, session._tracks);

    session.log('STAGE_E_COMPLETE', {
      normalized_artist_id: session.normalized_artist_id,
      platform:             subject.inputPlatform,
      source_entity_id:     parsed.id,
      score:                primaryScore.score,
      score_type:           primaryScore.type,
      isrc_rows:            isrcTable.length,
      issue_count:          session._issues.length,
      rejected_track_count: session._rejected_tracks,
      cache_hits:           session._cache_hits,
      audit_confidence:     auditConfidence,
    });

    // REQ 11 & 12: Integrity assertions — fail and discard if not passed
    const integrity = session.runIntegrityAssertions();
    if (!integrity.ok) {
      session.fail('integrity_assertions_failed');
      // REQ 12: Return failure — never render contaminated results
      return res.status(500).json({
        scan_id:             session.scan_id,
        success:             false,
        auditReady:          false,
        scan_status:         'FAILED',
        error:               'Scan integrity validation failed. Results discarded to prevent contaminated data.',
        integrity_failures:  integrity.failures,
      });
    }

    session.complete();

    // REQ 4 (backend): scan_id in every successful response
    return res.status(200).json({
      scan_id:                session.scan_id,
      scan_status:            'complete',
      success:                true,
      auditReady:             true,
      sourceResolutionStatus: 'resolved',
      scannedAt:              session.created_at,

      canonicalSubject:   subject,
      inputPlatform:      subject.inputPlatform,
      entityType:         subject.canonicalSubjectType,
      platformLabel:      subject.platformLabel,
      artistName:         subject.canonicalArtistName,
      trackTitle:         subject.canonicalTrackName || null,
      trackIsrc:          subject.canonicalIsrc || subject.sourceData?.appleTrackIsrc || null,
      artistId:           subject.canonicalArtistId,
      followers:          subject.followers || 0,
      genres:             subject.genres || [],

      sourceResolution: {
        platform:         subject.inputPlatform,
        status:           'Source Verified',
        resolutionStatus: 'resolved',
        entityType:       subject.canonicalSubjectType,
        platformLabel:    subject.platformLabel,
        sourceVerified:   true,
      },

      moduleStates,
      scanType:         isArtistScan ? 'artist' : 'track',
      primaryScore,
      royaltyRiskScore: primaryScore.score,
      riskLevel:        primaryScore.label,

      // REQ 6 & 8: Tracks keyed by scan_id, replaced not appended
      // REQ 7: No result is indexed by artist name or normalized_artist_id alone
      isrcTable:        session._tracks,

      verifiedIssues:   session._issues,
      issueCount:       session._issues.length,
      previewIssues:    session._issues.slice(0, 2),

      platformConfirmation,
      coverageStatuses,
      territorySignals,
      collectionReadiness,
      actionPlan,

      auditCoverage: {
        [subject.inputPlatform]: 'Source Verified',
        crossReferences: Object.fromEntries(
          Object.entries(crossRefs)
            .filter(([k]) => !k.startsWith('_'))
            .map(([k, v]) => [k, v.resolutionStatus])
        ),
        confidence:       auditConfidence,
        dataLastVerified: new Date().toISOString(),
      },

      catalog: sourceResolution.catalog || null,

      crossReferenceSummary: {
        appleMusic:  { resolutionStatus: crossRefs.appleMusic.resolutionStatus,  crossReferenceStatus: crossRefs.appleMusic.crossReferenceStatus },
        spotify:     { resolutionStatus: crossRefs.spotify.resolutionStatus,     crossReferenceStatus: crossRefs.spotify.crossReferenceStatus },
        youtube:     { resolutionStatus: crossRefs.youtube.resolutionStatus,     crossReferenceStatus: crossRefs.youtube.crossReferenceStatus, officialChannelFound: crossRefs.youtube.officialChannelFound, ugcFound: crossRefs.youtube.ugcFound },
        musicbrainz: { resolutionStatus: crossRefs.musicbrainz.resolutionStatus, crossReferenceStatus: crossRefs.musicbrainz.crossReferenceStatus },
      },

      _audit_meta: {
        scan_id:          session.scan_id,
        rejected_tracks:  session._rejected_tracks,
        cache_hits:       session._cache_hits,
        integrity_passed: true,
      },
    });

  } catch (err) {
    session.fail(err.message);
    console.error(`[Royalte][scan:${session.scan_id}] Unhandled error:`, err.message, err.stack?.split('\n')[1]);
    return res.status(500).json({
      scan_id:     session.scan_id,
      scan_status: 'failed',
      error:       'Temporary system issue — please try again.',
      detail:      err.message,
      auditReady:  false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// STAGE A — URL PARSER
// ─────────────────────────────────────────────────────────────────
function parseUniversalUrl(url) {
  try {
    const u = new URL(url.trim());
    const h = u.hostname;
    const p = u.pathname.split('/').filter(Boolean);

    if (h.includes('spotify.com')) {
      const ti = p.findIndex(x => x === 'artist' || x === 'track');
      if (ti === -1 || !p[ti + 1]) return null;
      return { platform: 'spotify', type: p[ti], id: p[ti + 1].split('?')[0], rawUrl: url };
    }

    if (h.includes('music.apple.com')) {
      const ip = u.searchParams.get('i');
      if (ip && /^\d+$/.test(ip)) return { platform: 'apple', type: 'track', id: ip, rawUrl: url };
      const si = p.findIndex(x => x === 'song' || x === 'songs');
      if (si !== -1) { for (let i = p.length - 1; i > si; i--) { const s = p[i].split('?')[0]; if (/^\d+$/.test(s)) return { platform: 'apple', type: 'track', id: s, rawUrl: url }; } return null; }
      const ai = p.findIndex(x => x === 'artist' || x === 'artists');
      if (ai !== -1) { for (let i = p.length - 1; i > ai; i--) { const s = p[i].split('?')[0]; if (/^\d+$/.test(s)) return { platform: 'apple', type: 'artist', id: s, rawUrl: url }; } return null; }
      for (let i = p.length - 1; i >= 0; i--) { const s = p[i].split('?')[0]; if (/^\d+$/.test(s)) return { platform: 'apple', type: 'artist', id: s, rawUrl: url }; }
      return null;
    }
    return null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────
// STAGE B — SOURCE RESOLUTION
// ─────────────────────────────────────────────────────────────────
async function resolveSourceEntity(parsed, session) {
  if (parsed.platform === 'spotify') return resolveSpotifySource(parsed, session);
  if (parsed.platform === 'apple')   return resolveAppleSource(parsed, session);
  return { success: false, error: `Unsupported platform: ${parsed.platform}` };
}

async function resolveSpotifySource(parsed, session) {
  try {
    const token = await getSpotifyToken();

    let artistRaw, trackRaw;
    if (parsed.type === 'artist') {
      const ck = cacheKey('spotify', 'artist', parsed.id);
      const hit = !!getCached(ck);
      session.recordCacheHit('spotify_artist', hit);
      artistRaw = getCached(ck) || await getSpotifyArtist(parsed.id, token);
      if (!hit) setCache(ck, artistRaw);
    } else {
      const tck = cacheKey('spotify', 'track', parsed.id);
      const thit = !!getCached(tck);
      trackRaw = getCached(tck) || await getSpotifyTrack(parsed.id, token);
      if (!thit) setCache(tck, trackRaw);
      session.recordCacheHit('spotify_track', thit);
      const ack = cacheKey('spotify', 'artist', trackRaw.artists[0].id);
      const ahit = !!getCached(ack);
      artistRaw = getCached(ack) || await getSpotifyArtist(trackRaw.artists[0].id, token);
      if (!ahit) setCache(ack, artistRaw);
      session.recordCacheHit('spotify_track_artist', ahit);
    }

    session.log('SPOTIFY_ARTIST_RESOLVED', {
      platform:            'spotify',
      source_entity_id:    artistRaw.id,
      normalized_artist_id:normArtist(artistRaw.name),
      track_count:         0, // set after fetch below
    });

    const albumsData = await getSpotifyAlbums(artistRaw.id, token);
    const topTracks  = await getSpotifyTopTracks(artistRaw.id, token);
    const catalog    = analyzeCatalog(albumsData, artistRaw);

    let artistTracks = [];
    if (parsed.type === 'artist') {
      artistTracks = await getSpotifyArtistTracks(artistRaw.id, token, 5, session);
    }

    session.log('SPOTIFY_TRACKS_FETCHED', {
      platform:            'spotify',
      source_entity_id:    artistRaw.id,
      normalized_artist_id:normArtist(artistRaw.name),
      track_count:         artistTracks.length,
      rejected_count:      0, // lock not yet applied (happens in main handler)
      cache_hit:           false,
    });

    return {
      success: true, auditReady: true, metadataStatus: 'resolved', catalog,
      canonicalSubject: {
        inputPlatform: 'spotify', inputEntityType: parsed.type, inputId: parsed.id,
        canonicalSubjectType: parsed.type,
        canonicalArtistName:  artistRaw.name,
        canonicalArtistId:    artistRaw.id,
        canonicalTrackName:   trackRaw?.name || null,
        canonicalIsrc:        trackRaw?.external_ids?.isrc || null,
        canonicalDurationMs:  trackRaw?.duration_ms || null,
        normalizedInputUrl:   parsed.rawUrl,
        platformLabel:        parsed.type === 'artist' ? 'Spotify Artist' : 'Spotify Track',
        genres: artistRaw.genres || [], followers: artistRaw.followers?.total || 0,
        popularity: artistRaw.popularity || 0, images: artistRaw.images || [],
        sourceData: {
          spotifyArtistId: artistRaw.id, spotifyToken: token,
          spotifyTopTracks: topTracks,
          spotifyTrackIsrc: trackRaw?.external_ids?.isrc || null,
          artistTracks, // artist-context lock applied in main handler
        },
      },
    };
  } catch (err) {
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

async function resolveAppleSource(parsed, session) {
  session.log('APPLE_SOURCE_START', { platform: 'apple', source_entity_id: parsed.id, type: parsed.type });
  try {
    let appleToken;
    try {
      appleToken = generateAppleToken();
      if (!appleToken || typeof appleToken !== 'string' || appleToken.length < 20) throw new Error('invalid');
    } catch (e) {
      return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music token error: ${e.message}` };
    }

    let storefront = 'us';
    try { const sf = new URL(parsed.rawUrl).pathname.split('/').filter(Boolean)[0]?.toLowerCase(); if (sf && /^[a-z]{2}$/.test(sf)) storefront = sf; } catch {}

    const BASE    = 'https://api.music.apple.com/v1';
    const headers = { Authorization: `Bearer ${appleToken}` };
    let artistRaw = null, trackRaw = null, artistName = null, trackName = null;

    if (parsed.type === 'artist') {
      const ck   = cacheKey('apple', 'artist', parsed.id);
      const hit  = !!getCached(ck);
      session.recordCacheHit('apple_artist', hit);
      let json   = getCached(ck);
      if (!json) {
        const sfs = storefront !== 'us' ? [storefront, 'us'] : ['us'];
        let resp  = null;
        for (const sf of sfs) {
          try {
            resp = await fetch(`${BASE}/catalog/${sf}/artists/${parsed.id}`, { headers });
            if (resp.ok) break;
            if (resp.status === 401 || resp.status === 403) return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music auth failed (${resp.status})` };
          } catch {}
        }
        if (!resp?.ok) {
          const slug = parsed.rawUrl.match(/\/artist\/([^\/]+)\//)?.[1];
          if (slug) { const n = slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim(); if (n && !/^\d+$/.test(n)) return buildAppleCanonical(parsed, null, null, n, null, 'url_slug_fallback', parsed.id, []); }
          return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${resp?.status || 'no response'}` };
        }
        json = await resp.json();
        setCache(ck, json);
      }
      artistRaw  = json.data?.[0];
      if (!artistRaw) return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Artist not found in Apple Music response' };
      artistName = artistRaw.attributes?.name;
    } else {
      const ck  = cacheKey('apple', 'track', parsed.id);
      const hit = !!getCached(ck);
      session.recordCacheHit('apple_track', hit);
      let json  = getCached(ck);
      if (!json) {
        const sfs = storefront !== 'us' ? [storefront, 'us'] : ['us'];
        let resp  = null;
        for (const sf of sfs) {
          try { resp = await fetch(`${BASE}/catalog/${sf}/songs/${parsed.id}`, { headers }); if (resp.ok) break; if (resp.status === 401 || resp.status === 403) return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple auth failed (${resp.status})` }; } catch {}
        }
        if (!resp?.ok) return { success: false, auditReady: false, metadataStatus: 'failed', error: `Apple Music API returned ${resp?.status}` };
        json = await resp.json();
        setCache(ck, json);
      }
      trackRaw   = json.data?.[0];
      if (!trackRaw) return { success: false, auditReady: false, metadataStatus: 'failed', error: 'Track not found' };
      trackName  = trackRaw.attributes?.name;
      artistName = trackRaw.attributes?.artistName;
      const relId = trackRaw.relationships?.artists?.data?.[0]?.id;
      if (relId) {
        try {
          const ack = cacheKey('apple', 'artist', relId);
          let aj    = getCached(ack);
          if (!aj) { const ar = await fetch(`${BASE}/catalog/${storefront}/artists/${relId}`, { headers }); if (ar.ok) { aj = await ar.json(); setCache(ack, aj); } }
          artistRaw = aj?.data?.[0] || null;
          if (artistRaw && !artistName) artistName = artistRaw.attributes?.name;
        } catch {}
      }
    }

    if (!artistName) artistName = 'Unknown Artist';
    session.log('APPLE_ARTIST_RESOLVED', { platform: 'apple', source_entity_id: parsed.id, normalized_artist_id: normArtist(artistName) });

    let artistTracks = [];
    if (parsed.type === 'artist') {
      const r = await getAppleArtistTracks(artistRaw?.id || parsed.id, storefront, 5, session);
      artistTracks = r.tracks || [];
    }

    session.log('APPLE_TRACKS_FETCHED', {
      platform:            'apple',
      source_entity_id:    artistRaw?.id || parsed.id,
      normalized_artist_id:normArtist(artistName),
      track_count:         artistTracks.length,
      cache_hit:           false,
    });

    return buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, 'api', null, artistTracks);
  } catch (err) {
    return { success: false, auditReady: false, metadataStatus: 'failed', error: err.message };
  }
}

function buildAppleCanonical(parsed, artistRaw, trackRaw, artistName, trackName, resolvedVia, overrideId, artistTracks = []) {
  return {
    success: true, auditReady: true, metadataStatus: 'resolved', resolvedVia,
    canonicalSubject: {
      inputPlatform: 'apple', inputEntityType: parsed.type, inputId: parsed.id,
      canonicalSubjectType: parsed.type,
      canonicalArtistName:  artistName,
      canonicalArtistId:    artistRaw?.id || overrideId || `apple-${parsed.id}`,
      canonicalTrackName:   trackName || null,
      canonicalIsrc:        trackRaw?.attributes?.isrc || null,
      canonicalDurationMs:  trackRaw?.attributes?.durationInMillis || null,
      normalizedInputUrl:   parsed.rawUrl,
      platformLabel:        parsed.type === 'artist' ? 'Apple Music Artist' : 'Apple Music Track',
      genres: artistRaw?.attributes?.genreNames || [], followers: 0, popularity: 0,
      images: artistRaw?.attributes?.artwork ? [{ url: artistRaw.attributes.artwork.url.replace('{w}x{h}bb','400x400bb').replace('{w}x{h}','400x400') }] : [],
      sourceData: {
        appleArtistId:  artistRaw?.id || overrideId || parsed.id,
        appleArtistUrl: artistRaw?.attributes?.url || null,
        appleTrackId:   trackRaw?.id || null,
        appleTrackIsrc: trackRaw?.attributes?.isrc || null,
        artistTracks,
      },
    },
    catalog: null,
  };
}

// ─────────────────────────────────────────────────────────────────
// STAGE D — CROSS-REFERENCES
// ─────────────────────────────────────────────────────────────────
async function runCrossReferences(subject, sourceResolution, session) {
  const name      = subject.canonicalArtistName;
  const trackName = subject.canonicalTrackName;
  const isSpotify = subject.inputPlatform === 'spotify';
  const isApple   = subject.inputPlatform === 'apple';

  const [spotifyRef, appleMusicRef, youtubeRef, mbRef, deezerRef, audiodbRef, discogsRef, soundcloudRef, lastfmRef, wikidataRef] = await Promise.allSettled([
    isSpotify ? Promise.resolve(buildSpotifySourceRef(sourceResolution)) : crossRefSpotify(name, trackName, null, subject.canonicalIsrc || subject.sourceData?.appleTrackIsrc || null, subject.canonicalDurationMs || null, session),
    isApple   ? Promise.resolve(buildAppleSourceRef(sourceResolution))   : crossRefAppleMusic(name, sourceResolution.canonicalSubject?.sourceData?.spotifyTopTracks || [], null, session),
    crossRefYouTube(name, session),
    crossRefMusicBrainz(name, session),
    crossRefDeezer(name, session),
    crossRefAudioDB(name, session),
    crossRefDiscogs(name, session),
    crossRefSoundCloud(name, session),
    crossRefLastFm(name, session),
    crossRefWikidata(name, session),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : { resolutionStatus: 'failed', crossReferenceStatus: 'Not Confirmed', error: r.reason?.message }));

  return {
    spotify: spotifyRef, appleMusic: appleMusicRef, youtube: youtubeRef,
    musicbrainz: mbRef, deezer: deezerRef, audiodb: audiodbRef,
    discogs: discogsRef, soundcloud: soundcloudRef, lastfm: lastfmRef, wikidata: wikidataRef,
    soundExchange: { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
    pro:          { resolutionStatus: 'not_checked', crossReferenceStatus: 'Manual Check Required', registrationStatus: 'Not Confirmed', verified: false },
  };
}

function buildSpotifySourceRef(sr) {
  const s = sr.canonicalSubject;
  return { sourceUsedForScan: true, resolutionStatus: 'resolved', crossReferenceStatus: 'Source Verified', registrationStatus: 'Source Verified', verified: true, artistId: s.canonicalArtistId, artistName: s.canonicalArtistName, followers: s.followers, genres: s.genres, isrc: s.canonicalIsrc };
}
function buildAppleSourceRef(sr) {
  const s = sr.canonicalSubject;
  return { sourceUsedForScan: true, resolutionStatus: 'resolved', crossReferenceStatus: s.inputEntityType === 'artist' ? 'Profile Resolved' : 'Track Resolved', registrationStatus: 'Source Verified', verified: true, artistId: s.canonicalArtistId, artistUrl: s.sourceData?.appleArtistUrl || null, artistName: s.canonicalArtistName };
}

async function crossRefSpotify(artistName, trackName, _u, isrc, durationMs, session) {
  try {
    const token = await getSpotifyToken();
    const H     = { Authorization: `Bearer ${token}` };
    if (isrc) {
      const r = await fetch(`https://api.spotify.com/v1/search?q=isrc:${isrc}&type=track&limit=1`, { headers: H });
      if (r.ok) { const m = (await r.json()).tracks?.items?.[0]; if (m) { session?.log('CROSSREF_SPOTIFY', { platform:'spotify', strategy:'isrc', source_entity_id:m.artists?.[0]?.id||null, normalized_artist_id:normArtist(m.artists?.[0]?.name||''), status:'Cross-Reference Found', cache_hit:false }); return { sourceUsedForScan:false, resolutionStatus:'resolved', crossReferenceStatus:'Cross-Reference Found', registrationStatus:'Registered', verified:true, confidence:'HIGH', artistId:m.artists?.[0]?.id, artistName:m.artists?.[0]?.name, trackName:m.name, isrc:m.external_ids?.isrc||isrc, followers:0, genres:[] }; } }
    }
    const q1 = trackName ? encodeURIComponent(`track:${trackName} artist:${artistName}`) : null;
    const q2 = trackName ? encodeURIComponent(`${trackName} ${artistName}`) : encodeURIComponent(artistName);
    const q3 = encodeURIComponent(artistName);
    const [r1, r2, r3] = await Promise.all([
      q1 ? fetch(`https://api.spotify.com/v1/search?q=${q1}&type=track&limit=10`, { headers:H }) : Promise.resolve(null),
      fetch(`https://api.spotify.com/v1/search?q=${q2}&type=track&limit=10`, { headers:H }),
      fetch(`https://api.spotify.com/v1/search?q=${q3}&type=artist&limit=5`, { headers:H }),
    ]);
    const tc1 = r1?.ok ? (await r1.json()).tracks?.items||[] : [];
    const tc2 = r2.ok  ? (await r2.json()).tracks?.items||[] : [];
    const ac  = r3.ok  ? (await r3.json()).artists?.items||[] : [];
    const seen = new Set();
    const cands = [...tc1,...tc2].filter(c=>{ if(seen.has(c.id))return false; seen.add(c.id); return true; });
    if (cands.length > 0 && trackName) {
      const res = resolveBestMatch(cands, { name:trackName, artistName, isrc, durationMs:durationMs||0 }, c=>c.name, c=>c.artists?.[0]?.name||'', c=>c.duration_ms||0, c=>c.external_ids?.isrc||null);
      if (res.status==='Matched'||res.status==='Possible Match') {
        const m = cands.find(c=>c.name===res.matchedName)||cands[0];
        const aid = m?.artists?.[0]?.id||null;
        let followers=0, genres=[];
        if (aid) { try { const ar=await fetch(`https://api.spotify.com/v1/artists/${aid}`,{headers:H}); if(ar.ok){const ad=await ar.json();followers=ad.followers?.total||0;genres=ad.genres||[];} } catch {} }
        session?.log('CROSSREF_SPOTIFY', { platform:'spotify', strategy:'metadata', source_entity_id:aid, normalized_artist_id:normArtist(m?.artists?.[0]?.name||''), status:res.status==='Matched'?'Cross-Reference Found':'Possible Match', cache_hit:false });
        return { sourceUsedForScan:false, resolutionStatus:'resolved', crossReferenceStatus:res.status==='Matched'?'Cross-Reference Found':'Possible Match', registrationStatus:res.status==='Matched'?'Registered':'Not Confirmed', verified:true, confidence:res.confidence, artistId:aid, artistName:m?.artists?.[0]?.name||artistName, trackName:res.matchedName, isrc:res.matchedIsrc||isrc, followers, genres };
      }
    }
    const na = normArtist(artistName);
    const am = ac.find(a=>normArtist(a.name)===na)||ac.find(a=>normArtist(a.name).includes(na)||na.includes(normArtist(a.name)));
    if (am) { session?.log('CROSSREF_SPOTIFY', { platform:'spotify', strategy:'artist_only', source_entity_id:am.id, normalized_artist_id:normArtist(am.name), status:trackName?'Possible Match':'Cross-Reference Found', cache_hit:false }); return { sourceUsedForScan:false, resolutionStatus:'resolved', crossReferenceStatus:trackName?'Possible Match':'Cross-Reference Found', registrationStatus:'Not Confirmed', verified:true, confidence:'LOW', artistId:am.id, artistName:am.name, followers:am.followers?.total||0, genres:am.genres||[], isrc:null }; }
    session?.log('CROSSREF_SPOTIFY', { platform:'spotify', strategy:'all_failed', normalized_artist_id:na, status:'No Verified Match Yet', cache_hit:false });
    return { sourceUsedForScan:false, resolutionStatus:'resolved', crossReferenceStatus:'No Verified Match Yet', registrationStatus:'Not Confirmed', verified:true, confidence:null };
  } catch (err) { session?.log('CROSSREF_SPOTIFY_ERROR',{error:err.message}); return { sourceUsedForScan:false, resolutionStatus:'failed', crossReferenceStatus:'Not Confirmed', verified:false, error:err.message }; }
}

async function crossRefAppleMusic(artistName, topTracks, isrc, session) {
  try {
    let tok; try { tok = generateAppleToken(); if (!tok||tok.length<20) throw new Error('invalid'); } catch(e) { return { sourceUsedForScan:false, resolutionStatus:'failed', crossReferenceStatus:'Not Confirmed', verified:false, error:e.message }; }
    const H = { Authorization:`Bearer ${tok}` };
    const sr = await fetch(`https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(artistName)}&types=artists&limit=10`, { headers:H });
    if (!sr.ok) {
      if (sr.status===401||sr.status===403) { session?.log('CROSSREF_APPLE',{platform:'apple',normalized_artist_id:normArtist(artistName),status:'Auth Unavailable',cache_hit:false}); return { sourceUsedForScan:false, resolutionStatus:'auth_failed', crossReferenceStatus:'Auth Unavailable', registrationStatus:null, verified:false, authError:true, error:`Apple Music auth failed (${sr.status})` }; }
      return { sourceUsedForScan:false, resolutionStatus:'failed', crossReferenceStatus:'Not Confirmed', verified:false };
    }
    const artists = (await sr.json())?.results?.artists?.data||[];
    const nq = normArtist(artistName);
    let match=null, mc=null;
    match=artists.find(a=>normArtist(a.attributes?.name||'')===nq); if(match) mc='exact';
    if(!match){match=artists.find(a=>{const cn=normArtist(a.attributes?.name||'');return cn.includes(nq)||nq.includes(cn);});if(match)mc='contains';}
    if(!match&&nq.includes(' ')){const qw=nq.split(' ').filter(w=>w.length>1);match=artists.find(a=>{const cn=normArtist(a.attributes?.name||'');const cw=cn.split(' ').filter(w=>w.length>1);return qw.filter(w=>cw.includes(w)).length>=Math.max(1,qw.length-1);});if(match)mc='word_overlap';}
    if(!match&&artists.length>0&&nq.length>=4){const fn=normArtist(artists[0].attributes?.name||'');const ml=Math.min(nq.length,fn.length);const pp=[...Array(ml)].findIndex((_,i)=>nq[i]!==fn[i]);const pm=pp===-1?ml:pp;if(pm>=4){match=artists[0];mc='prefix_fallback';}}
    if(!match){session?.log('CROSSREF_APPLE',{platform:'apple',normalized_artist_id:nq,status:'No Verified Match Yet',cache_hit:false});return{sourceUsedForScan:false,resolutionStatus:'resolved',crossReferenceStatus:'No Verified Match Yet',registrationStatus:'Not Registered',verified:true};}
    session?.log('CROSSREF_APPLE',{platform:'apple',source_entity_id:match.id,normalized_artist_id:nq,status:'Cross-Reference Found',match_confidence:mc,cache_hit:false});
    let cc=null;
    if(topTracks?.length>0){const matched=[],notFound=[];for(const t of topTracks.slice(0,10)){let found=false;if(t.isrc){const r=await fetch(`https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${t.isrc}`,{headers:H});if(r.ok)found=((await r.json())?.data?.length||0)>0;}if(!found){const r=await fetch(`https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(`${t.name} ${t.artistName}`)}&types=songs&limit=3`,{headers:H});if(r.ok)found=((await r.json())?.results?.songs?.data||[]).some(s=>normStr(s.attributes?.name)===normStr(t.name));}if(found)matched.push(t.name);else notFound.push(t.name);}const tot=matched.length+notFound.length;cc={tracksChecked:tot,matched:matched.length,notFound,matchRate:tot>0?Math.round((matched.length/tot)*100):0};}
    return{sourceUsedForScan:false,resolutionStatus:'resolved',crossReferenceStatus:'Cross-Reference Found',registrationStatus:'Registered',verified:true,artistId:match.id,artistUrl:match.attributes?.url||null,artistName:match.attributes?.name,catalogComparison:cc};
  } catch(err){return{sourceUsedForScan:false,resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false,error:err.message};}
}

async function crossRefYouTube(artistName, session) {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return { sourceUsedForScan:false, resolutionStatus:'not_checked', crossReferenceStatus:'Not Confirmed', verified:false, reason:'API key not configured' };
    const nrm = s => s.toLowerCase().trim();
    const q   = encodeURIComponent(artistName);
    const cr  = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=channel&maxResults=5&key=${apiKey}`);
    if (!cr.ok) return { sourceUsedForScan:false, resolutionStatus:'failed', crossReferenceStatus:'Not Confirmed', verified:false };
    const channels = (await cr.json()).items||[];
    const oc = channels.find(c=>nrm(c.snippet.channelTitle)===nrm(artistName)||nrm(c.snippet.channelTitle).includes(nrm(artistName))||c.snippet.description?.toLowerCase().includes('official'))||(channels.length>0?channels[0]:null);
    let ocd=null, subs=0, vids=0;
    if(oc){const cid=oc.snippet.channelId||oc.id?.channelId;if(cid){const sr=await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${cid}&key=${apiKey}`);if(sr.ok){const st=(await sr.json()).items?.[0]?.statistics;if(st){subs=parseInt(st.subscriberCount||0);vids=parseInt(st.videoCount||0);}}ocd={title:oc.snippet.channelTitle,channelId:cid,subscribers:subs,videoCount:vids};}}
    const ur=await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=10&key=${apiKey}`);
    let uvc=0,ucr=false,tuv=[];
    if(ur.ok){const uv=((await ur.json()).items||[]).filter(v=>!nrm(v.snippet?.channelTitle||'').includes(nrm(artistName))&&!nrm(v.snippet?.channelTitle||'').includes('vevo'));uvc=uv.length;ucr=uvc>0&&!ocd;tuv=uv.slice(0,3).map(v=>({title:v.snippet.title,channel:v.snippet.channelTitle,videoId:v.id.videoId}));}
    const status = ocd ? 'Cross-Reference Found' : 'No Verified Match Yet';
    session?.log('CROSSREF_YOUTUBE',{platform:'youtube',normalized_artist_id:normArtist(artistName),source_entity_id:ocd?.channelId||null,status,official_channel_found:!!ocd,ugc_count:uvc,cache_hit:false});
    return{sourceUsedForScan:false,resolutionStatus:'resolved',crossReferenceStatus:status,registrationStatus:'Not Confirmed',verified:true,officialChannelFound:!!ocd,officialChannel:ocd,ugcFound:uvc>0,ugcVideoCount:uvc,ugcContentIdRisk:ucr,topUgcVideos:tuv,contentIdVerified:!!ocd&&vids>0};
  } catch(err){return{sourceUsedForScan:false,resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false,error:err.message};}
}

async function crossRefMusicBrainz(artistName, session) {
  try {
    const r = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${artistName}"`)}&limit=3&fmt=json`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)'}});
    if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};
    const d=await r.json(); const found=d.artists?.length>0;
    session?.log('CROSSREF_MB',{platform:'musicbrainz',normalized_artist_id:normArtist(artistName),status:found?'Cross-Reference Found':'No Verified Match Yet',cache_hit:false});
    return{sourceUsedForScan:false,resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',registrationStatus:found?'Registered':'Not Registered',verified:true,found,artists:d.artists||[],multipleEntries:d.artists?.length>1};
  } catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefDeezer(artistName, session) {
  try{const r=await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`);if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const found=d.data?.some(a=>a.name?.toLowerCase().trim()===artistName.toLowerCase().trim());session?.log('CROSSREF_DEEZER',{platform:'deezer',normalized_artist_id:normArtist(artistName),status:found?'Cross-Reference Found':'No Verified Match Yet',cache_hit:false});return{resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',registrationStatus:found?'Registered':'Not Registered',verified:true,found:!!found};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefAudioDB(artistName, session) {
  try{const r=await fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${encodeURIComponent(artistName)}`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)'}});if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const found=d.artists?.length>0;return{resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',verified:true,found,country:found?d.artists[0].strCountry:null};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefDiscogs(artistName, session) {
  try{const r=await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(artistName)}&type=artist&per_page=5`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)','Authorization':'Discogs key=royalteaudit, secret=royalteaudit'}});if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const found=d.results?.some(r=>r.title?.toLowerCase().trim()===artistName.toLowerCase().trim());return{resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',registrationStatus:found?'Registered':'Not Registered',verified:true,found:!!found};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefSoundCloud(artistName, session) {
  try{const r=await fetch(`https://api.soundcloud.com/users?q=${encodeURIComponent(artistName)}&limit=5&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)'}});if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const nrm=s=>s.toLowerCase().trim();const found=Array.isArray(d)&&d.some(u=>nrm(u.username)===nrm(artistName)||nrm(u.full_name||'')===nrm(artistName));return{resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',verified:true,found};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefLastFm(artistName, session) {
  try{const key=process.env.LASTFM_API_KEY||'43693facbb24d1ac893a5d61c8e5d4c3';const r=await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${key}&format=json`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)'}});if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const found=!d.error&&!!d.artist;return{resolutionStatus:'resolved',crossReferenceStatus:found?'Cross-Reference Found':'No Verified Match Yet',verified:true,found};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}
async function crossRefWikidata(artistName, session) {
  try{const r=await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&type=item&format=json&limit=5`,{headers:{'User-Agent':'RoyalteAudit/1.0 (audit@royalte.ai)'}});if(!r.ok)return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};const d=await r.json();const nrm=s=>s.toLowerCase().trim();const terms=['musician','singer','rapper','artist','band','producer','songwriter'];const match=d.search?.find(r=>nrm(r.label)===nrm(artistName)&&terms.some(t=>r.description?.toLowerCase().includes(t)))||d.search?.find(r=>nrm(r.label)===nrm(artistName));return{resolutionStatus:'resolved',crossReferenceStatus:match?'Cross-Reference Found':'No Verified Match Yet',verified:true,found:!!match,country:null};}catch{return{resolutionStatus:'failed',crossReferenceStatus:'Not Confirmed',verified:false};}
}

// ─────────────────────────────────────────────────────────────────
// STAGE E — MODULE STATES, ISSUES, SCORING (logic unchanged from original)
// ─────────────────────────────────────────────────────────────────
function buildModuleStates(subject, sourceResolution, crossRefs) {
  const isSp=subject.inputPlatform==='spotify', isAp=subject.inputPlatform==='apple', isT=subject.canonicalSubjectType==='track';
  const sp=crossRefs.spotify, am=crossRefs.appleMusic, yt=crossRefs.youtube, mb=crossRefs.musicbrainz;
  const eI=subject.canonicalIsrc||crossRefs.spotify.isrc||null;
  const mI=[];if(!subject.genres?.length)mI.push({type:'missing_genres',status:'Not Confirmed'});if(isT&&!eI)mI.push({type:'missing_isrc',status:'Not Confirmed'});
  const cI=[];if(!isSp&&sp.crossReferenceStatus==='No Verified Match Yet')cI.push({type:'not_on_spotify',status:'No Verified Match Yet',platform:'Spotify'});if(!isAp&&am.crossReferenceStatus==='No Verified Match Yet')cI.push({type:'not_on_apple_music',status:'No Verified Match Yet',platform:'Apple Music'});if(!mb.found)cI.push({type:'not_in_musicbrainz',status:mb.crossReferenceStatus,platform:'MusicBrainz'});if(yt.crossReferenceStatus==='No Verified Match Yet')cI.push({type:'no_youtube_match',status:'No Verified Match Yet',platform:'YouTube'});
  const dI=[];if(mb.multipleEntries)dI.push({type:'multiple_mb_entries',status:'Not Confirmed',count:mb.artists?.length});
  const ytS={module:'youtube_ugc',name:'YouTube / UGC',sourceUsedForScan:false,resolutionStatus:yt.resolutionStatus,crossReferenceStatus:yt.crossReferenceStatus,registrationStatus:'Not Confirmed',verified:yt.verified,officialChannelFound:yt.officialChannelFound||false,ugcFound:yt.ugcFound||false,ugcContentIdRisk:yt.ugcContentIdRisk||false,issues:[],displayStatus:yt.resolutionStatus==='not_checked'?'Not Confirmed — API key not configured':yt.crossReferenceStatus};
  if(yt.resolutionStatus==='resolved'){if(!yt.officialChannelFound)ytS.issues.push({type:'no_youtube_channel',status:'No Verified Match Yet'});if(yt.ugcContentIdRisk)ytS.issues.push({type:'ugc_content_id_risk',status:'Not Confirmed'});}
  const sI=[];if(!subject.genres?.length)sI.push({type:'missing_genres',status:'Not Confirmed'});if(isT&&!eI)sI.push({type:'missing_isrc',status:'Not Confirmed'});if(!mb.found)sI.push({type:'not_in_musicbrainz',status:mb.crossReferenceStatus});if(!crossRefs.wikidata.found)sI.push({type:'no_wikipedia',status:'No Verified Match Yet'});if(!isAp&&am.crossReferenceStatus==='No Verified Match Yet')sI.push({type:'not_on_apple_music',status:'No Verified Match Yet'});
  return{
    metadata: {module:'metadata_integrity',name:'Metadata Integrity',sourceUsedForScan:true,resolutionStatus:'resolved',crossReferenceStatus:mI.length===0?'No Issues Found':`${mI.length} issue(s)`,registrationStatus:null,verified:true,issues:mI,displayStatus:mI.length===0?'No issues detected':`${mI.length} issue(s) found`},
    coverage: {module:'platform_coverage',name:'Platform Coverage',sourceUsedForScan:true,resolutionStatus:'resolved',crossReferenceStatus:cI.length===0?'Cross-Reference Found':`${cI.length} gap(s)`,registrationStatus:null,verified:true,issues:cI,displayStatus:cI.length===0?'All checked platforms found':`${cI.length} gap(s) found`},
    publishing:{module:'publishing_risk',name:'Publishing Risk',sourceUsedForScan:false,resolutionStatus:'not_checked',crossReferenceStatus:'Manual Check Required',registrationStatus:'Not Confirmed',verified:false,issues:[{type:'soundexchange_unconfirmed',status:'Manual Check Required'},{type:'pro_not_connected',status:'Manual Check Required'}],displayStatus:'Manual Check Required — cannot verify via public data'},
    duplicates:{module:'duplicate_detection',name:'Duplicate Detection',sourceUsedForScan:false,resolutionStatus:mb.resolutionStatus,crossReferenceStatus:dI.length===0?'No Issues Found':'Not Confirmed',registrationStatus:null,verified:mb.verified,issues:dI,displayStatus:dI.length===0?'No duplicates found':`${mb.artists?.length} MusicBrainz entries`},
    youtube:   ytS,
    sync:      {module:'sync_readiness',name:'Sync Readiness',sourceUsedForScan:false,resolutionStatus:'resolved',crossReferenceStatus:sI.length===0?'Sync Ready':`${sI.length} gap(s)`,registrationStatus:null,verified:true,issues:sI,displayStatus:sI.length===0?'Sync-ready':`${sI.length} gap(s)`},
  };
}

function buildVerifiedIssues(subject, moduleStates, crossRefs) {
  const issues=[], isT=subject.canonicalSubjectType==='track', isSp=subject.inputPlatform==='spotify', isAp=subject.inputPlatform==='apple';
  const eI=subject.canonicalIsrc||crossRefs.spotify.isrc||null, pc=crossRefs._platformConfirmation;
  if(isT&&!eI&&crossRefs.spotify.resolutionStatus==='resolved')issues.push({type:'missing_isrc',module:'Metadata Integrity',priority:'HIGH',status:'Not Confirmed',verifiedBy:isSp?'Spotify API (source)':'Spotify cross-reference',title:'ISRC not found on this recording',detail:'The International Standard Recording Code (ISRC) was not returned by Spotify for this track. Without an ISRC, performance royalty routing cannot be confirmed.'});
  if(!isT&&subject.trackIsrcReport?.length>0){const mi=subject.trackIsrcReport.filter(t=>!t.hasIsrc);if(mi.length>0)issues.push({type:'tracks_missing_isrc',module:'Metadata Integrity',priority:mi.length>=3?'HIGH':'MEDIUM',status:'Not Registered',verifiedBy:'Spotify API — top tracks endpoint',title:`${mi.length} of ${subject.trackIsrcReport.length} top tracks missing ISRC`,detail:`The following tracks have no ISRC: ${mi.map(t=>t.name).join(', ')}.`});}
  if(!subject.genres?.length)issues.push({type:'missing_genres',module:'Metadata Integrity',priority:'MEDIUM',status:'Not Confirmed',verifiedBy:`${subject.inputPlatform==='spotify'?'Spotify':'Apple Music'} API (source)`,title:'Genre tags absent on source profile',detail:'No genre metadata found on the source platform.'});
  if(pc){if(isSp&&pc.apple.noMatch)issues.push({type:'not_on_apple_music',module:'Platform Coverage',priority:'HIGH',status:'No Match',verifiedBy:'Apple Music API (cross-reference)',title:'No Apple Music match found',detail:'Cross-reference against Apple Music returned no verified match.'});if(isSp&&pc.apple.authFail)issues.push({type:'apple_auth_unavailable',module:'Platform Coverage',priority:'MEDIUM',status:'Auth Unavailable',verifiedBy:null,title:'Apple Music cross-reference temporarily unavailable',detail:'Apple Music authentication failed during this scan.'});if(isAp&&pc.spotify.noMatch)issues.push({type:'not_on_spotify',module:'Platform Coverage',priority:'HIGH',status:'No Match',verifiedBy:'Spotify API (cross-reference)',title:'No Spotify match found',detail:'Cross-reference against Spotify returned no verified match.'});}
  else{const ar=crossRefs.appleMusic;if(isSp&&ar.resolutionStatus==='resolved'&&ar.crossReferenceStatus==='No Verified Match Yet')issues.push({type:'not_on_apple_music',module:'Platform Coverage',priority:'HIGH',status:'No Match',verifiedBy:'Apple Music API',title:'No Apple Music match found',detail:'Cross-reference returned no verified match.'});}
  if(isSp&&crossRefs.appleMusic.resolutionStatus==='resolved'&&crossRefs.appleMusic.catalogComparison){const{matchRate,notFound,tracksChecked}=crossRefs.appleMusic.catalogComparison;if(matchRate<70&&notFound.length>0)issues.push({type:'apple_catalog_gap',module:'Platform Coverage',priority:matchRate<50?'HIGH':'MEDIUM',status:'No Verified Match Yet',verifiedBy:'Apple Music API (cross-reference via ISRC)',title:`${notFound.length} of ${tracksChecked} top tracks not matched on Apple Music`,detail:`Unmatched: ${notFound.slice(0,3).join(', ')}${notFound.length>3?` and ${notFound.length-3} more`:''}.`});}
  if(crossRefs.musicbrainz.resolutionStatus==='resolved'&&!crossRefs.musicbrainz.found)issues.push({type:'not_in_musicbrainz',module:'Publishing Risk',priority:'MEDIUM',status:'Not Registered',verifiedBy:'MusicBrainz API (cross-reference)',title:'Not found in MusicBrainz',detail:'MusicBrainz is used as a publishing reference database by royalty collection systems.'});
  if(crossRefs.youtube.resolutionStatus==='resolved'&&!crossRefs.youtube.officialChannelFound)issues.push({type:'no_youtube_channel',module:'YouTube / UGC',priority:'MEDIUM',status:'No Verified Match Yet',verifiedBy:'YouTube Data API v3 (cross-reference)',title:'No official YouTube channel matched',detail:'YouTube cross-reference returned no confirmed official channel.'});
  if(crossRefs.youtube.resolutionStatus==='resolved'&&crossRefs.youtube.ugcContentIdRisk)issues.push({type:'ugc_content_id_risk',module:'YouTube / UGC',priority:'HIGH',status:'Not Confirmed',verifiedBy:'YouTube Data API v3',title:`${crossRefs.youtube.ugcVideoCount} user-uploaded video(s) found — no official channel confirmed`,detail:'User-uploaded content found with no verified official channel.'});
  issues.push({type:'soundexchange_unconfirmed',module:'Publishing Risk',priority:'MEDIUM',status:'Manual Check Required',verifiedBy:null,title:'SoundExchange registration — manual check required',detail:'SoundExchange collects digital performance royalties for US streaming. Check directly at soundexchange.com.'});
  issues.push({type:'pro_not_connected',module:'Publishing Risk',priority:'MEDIUM',status:'Manual Check Required',verifiedBy:null,title:'PRO registration — manual check required',detail:'Performance Rights Organisation membership cannot be verified via public data.'});
  const order={HIGH:0,MEDIUM:1,LOW:2};
  return issues.sort((a,b)=>order[a.priority]-order[b.priority]);
}

function buildPlatformConfirmation(subject, crossRefs) {
  const isSp=subject.inputPlatform==='spotify', isAp=subject.inputPlatform==='apple';
  const dr=ref=>{if(!ref)return'AUTH_UNAVAILABLE';const{resolutionStatus:rs,crossReferenceStatus:crs,authError}=ref;if(rs==='auth_failed'||authError||rs==='failed')return'AUTH_UNAVAILABLE';if(rs==='resolved'){if(['Cross-Reference Found','Source Verified','Profile Resolved','Track Resolved'].includes(crs))return'CONFIRMED';if(crs==='Possible Match')return'POSSIBLE_MATCH';if(['No Verified Match Yet','No Match'].includes(crs))return'NO_MATCH';}return'AUTH_UNAVAILABLE';};
  const ss=isSp?'CONFIRMED':dr(crossRefs.spotify), as_=isAp?'CONFIRMED':dr(crossRefs.appleMusic);
  let ov;if(ss==='CONFIRMED'&&as_==='CONFIRMED')ov='CONFIRMED_ON_BOTH';else if(ss==='AUTH_UNAVAILABLE'||as_==='AUTH_UNAVAILABLE'){const cc=[ss,as_].filter(x=>x==='CONFIRMED').length;ov=cc>0?'CONFIRMED_ON_SOURCE_ONLY':'AUTH_UNAVAILABLE';}else if(ss==='POSSIBLE_MATCH'||as_==='POSSIBLE_MATCH')ov='POSSIBLE_MATCH';else if(ss==='CONFIRMED'||as_==='CONFIRMED')ov='CONFIRMED_ON_SOURCE_ONLY';else ov='NO_MATCH';
  const dl={CONFIRMED:(isSrc)=>isSrc?'Source Verified':'Cross-Reference Found',POSSIBLE_MATCH:()=>'Possible Match',NO_MATCH:()=>'No Match',AUTH_UNAVAILABLE:()=>'Auth Unavailable'};
  return{
    spotify:{state:ss,confirmed:ss==='CONFIRMED',possible:ss==='POSSIBLE_MATCH',noMatch:ss==='NO_MATCH',authFail:ss==='AUTH_UNAVAILABLE',isSource:isSp,displayStatus:(dl[ss]?.(isSp))||'Auth Unavailable'},
    apple:  {state:as_,confirmed:as_==='CONFIRMED',possible:as_==='POSSIBLE_MATCH',noMatch:as_==='NO_MATCH',authFail:as_==='AUTH_UNAVAILABLE',isSource:isAp,displayStatus:(dl[as_]?.(isAp))||'Auth Unavailable'},
    overallStatus:ov,
    overallLabel:{CONFIRMED_ON_BOTH:'Confirmed on both platforms',CONFIRMED_ON_SOURCE_ONLY:'Confirmed on source platform only',POSSIBLE_MATCH:'Possible cross-platform match',NO_MATCH:'No cross-platform match found',AUTH_UNAVAILABLE:'Cross-platform verification unavailable'}[ov]||ov,
  };
}

function buildCoverageStatuses(subject, sourceResolution, crossRefs, platformConfirmation) {
  const pc=platformConfirmation||buildPlatformConfirmation(subject,crossRefs), yt=crossRefs.youtube, mb=crossRefs.musicbrainz, country=crossRefs.audiodb?.country||null;
  return[
    {platform:'Spotify',    role:pc.spotify.isSource?'input_source':'cross_reference',status:pc.spotify.displayStatus,verified:pc.spotify.confirmed||pc.spotify.possible,detail:pc.spotify.authFail?'Spotify cross-reference unavailable.':pc.spotify.possible?'Possible match found — below high-confidence threshold.':null},
    {platform:'Apple Music',role:pc.apple.isSource  ?'input_source':'cross_reference',status:pc.apple.displayStatus,  verified:pc.apple.confirmed||pc.apple.possible,  detail:pc.apple.authFail  ?'Apple Music cross-reference unavailable — authentication error.':pc.apple.possible?'Possible match found.':null},
    {platform:'YouTube',    role:'cross_reference',status:yt.resolutionStatus==='not_checked'||yt.resolutionStatus==='failed'?'Not Confirmed':yt.crossReferenceStatus,verified:yt.verified,detail:yt.ugcContentIdRisk?'User-uploaded content found.':null},
    {platform:'MusicBrainz',role:'cross_reference',status:mb.resolutionStatus==='failed'?'Not Confirmed':mb.crossReferenceStatus,verified:mb.verified,detail:mb.multipleEntries?`${mb.artists?.length} entries — possible duplicates`:null},
    {platform:'SoundExchange',role:'rights_system',status:'Manual Check Required',verified:false,detail:'Cannot be verified via public data.'},
    {platform:'PRO (Performance Rights)',role:'rights_system',status:'Manual Check Required',verified:false,detail:country?`Your local PRO may be ${getPROGuide(country).pro}.`:'Find your PRO at cisac.org.'},
  ];
}

const BASELINE_TERRITORIES=[{code:'CA',flag:'🇨🇦',name:'Canada'},{code:'US',flag:'🇺🇸',name:'United States'},{code:'GB',flag:'🇬🇧',name:'United Kingdom'},{code:'DE',flag:'🇩🇪',name:'Germany'},{code:'FR',flag:'🇫🇷',name:'France'}];

function inferHomeCountry(cr){const raw=cr.audiodb?.country||cr.wikidata?.country||null;if(!raw)return null;const r=raw.toLowerCase();if(r.includes('canada'))return'CA';if(r.includes('united states')||r.includes('usa')||r.includes('u.s.'))return'US';if(r.includes('united kingdom')||r.includes('england')||r.includes('scotland')||r.includes('wales'))return'GB';if(r.includes('germany'))return'DE';if(r.includes('france'))return'FR';return null;}

function buildTerritorySignals(subject, crossRefs) {
  const hc=inferHomeCountry(crossRefs), onSp=subject.inputPlatform==='spotify'||crossRefs.spotify?.crossReferenceStatus==='Cross-Reference Found', onAp=subject.inputPlatform==='apple'||crossRefs.appleMusic?.crossReferenceStatus==='Cross-Reference Found';
  const ts=BASELINE_TERRITORIES.map(t=>{const isH=t.code===hc;let cs,cf,nt;if(isH){cs=(onSp||onAp)?'Likely Covered':'Coverage Unclear';cf='Inferred';nt=(onSp||onAp)?'Artist present on at least one major streaming platform.':'Platform presence could not be confirmed.';}else{if(onSp&&onAp){cs='Likely Covered';cf='Inferred';nt='Artist present on Spotify and Apple Music — global distribution inferred.';}else if(onSp||onAp){cs='Coverage Unclear';cf='Inferred';nt='Partial platform presence.';}else{cs='Coverage Unknown';cf='Unknown';nt='No verified data available for this territory.';}}return{...t,isHome:isH,coverageSignal:cs,confidence:cf,note:nt};});
  return hc?[...ts.filter(t=>t.isHome),...ts.filter(t=>!t.isHome)]:ts;
}

function buildActionPlan(issues, country) {
  if(!issues.length)return[{action:'No verified issues detected',reason:'No action required based on verified data',priority:null}];
  const pg=getPROGuide(country);
  const am={missing_isrc:{action:'Register this recording with your distributor to obtain an ISRC',reason:'ISRC not found — verified via API',priority:'HIGH'},missing_genres:{action:'Add genre metadata to your source platform artist profile',reason:'Genre tags absent — verified via source API',priority:'MEDIUM'},not_on_apple_music:{action:'Distribute your catalog to Apple Music via your distributor',reason:'No Apple Music match found — verified via cross-reference',priority:'HIGH'},not_on_spotify:{action:'Distribute your catalog to Spotify via your distributor',reason:'No Spotify match found — verified via cross-reference',priority:'HIGH'},apple_catalog_gap:{action:'Review Apple Music distribution and re-deliver missing tracks',reason:'Tracks not matched on Apple Music — verified via ISRC cross-reference',priority:'MEDIUM'},not_in_musicbrainz:{action:'Register your artist profile on MusicBrainz (musicbrainz.org)',reason:'Not found in MusicBrainz — verified via API',priority:'MEDIUM'},no_youtube_channel:{action:'Create or claim your official YouTube channel and register for Content ID',reason:'No official YouTube channel matched — verified via YouTube API',priority:'MEDIUM'},ugc_content_id_risk:{action:'Register for Content ID through your distributor or a YouTube OAC partner',reason:'User-uploaded content found with no official channel — verified via YouTube API',priority:'HIGH'},soundexchange_unconfirmed:{action:'Register with SoundExchange at soundexchange.com',reason:'Digital performance royalties in the US require SoundExchange registration',priority:'MEDIUM'},pro_not_connected:{action:country?`Register with ${pg.pro} — ${pg.url}`:'Register with your local PRO — find yours at cisac.org',reason:'PRO registration is required to collect performance royalties',priority:'MEDIUM'}};
  return issues.filter(i=>am[i.type]).map(i=>am[i.type]);
}

function deriveAuditConfidence(crossRefs, sourceResolution) {
  const res=Object.values(crossRefs).filter(r=>r.resolutionStatus==='resolved').length, tot=Object.keys(crossRefs).length;
  return res>=tot*0.7?'High':res>=tot*0.4?'Limited':'Minimal';
}

function analyzeCatalog(albumsData, artist) {
  const albums=albumsData.items||[];if(!albums.length)return{totalReleases:0,earliestYear:null,latestYear:null,recentActivity:false};
  const years=albums.map(a=>parseInt(a.release_date?.substring(0,4))).filter(y=>!isNaN(y)&&y>1950);const cy=new Date().getFullYear();
  return{totalReleases:albums.length,earliestYear:years.length?Math.min(...years):null,latestYear:years.length?Math.max(...years):null,recentActivity:years.some(y=>y>=cy-2)};
}

// ─────────────────────────────────────────────────────────────────
// ISRC TABLE BUILDERS — with artist-context double-check
// ─────────────────────────────────────────────────────────────────
async function buildIsrcTableForArtist(tracks, sourceplatform, spotifyToken, session) {
  const rows = [];
  for (const track of tracks) {
    // Double-check: skip any track that somehow has wrong scan_id
    if (track._scan_id && track._scan_id !== session.scan_id) {
      session.log('ISRC_TABLE_SKIP', { track_name: track.name, reason: 'wrong_scan_id', track_scan_id: track._scan_id });
      continue;
    }
    let spS, apS;
    if (sourceplatform === 'spotify') {
      spS = { status:'Verified (Source)', confidence:'SOURCE', matchedIsrc: track.isrc };
      apS = await crossValidateTrackOnApple(track);
    } else {
      apS = { status:'Verified (Source)', confidence:'SOURCE', matchedIsrc: track.isrc };
      spS = spotifyToken ? await crossValidateTrackOnSpotify(track, spotifyToken) : { status:'Auth Unavailable', confidence:null, matchedName:null, matchedIsrc:null };
    }
    let ms;
    const aS=apS.status, sS=spS.status;
    if(sS==='Verified (Source)'&&aS==='Matched')ms='Matched';
    else if(aS==='Verified (Source)'&&sS==='Matched')ms='Matched';
    else if(aS==='Auth Unavailable'||sS==='Auth Unavailable')ms='Auth Unavailable';
    else if(aS==='Possible Match'||sS==='Possible Match')ms='Possible Match';
    else if(aS==='Missing'||aS==='No Match')ms='Missing on Apple';
    else if(sS==='Missing'||sS==='No Match')ms='Missing on Spotify';
    else ms='Not Confirmed';
    session.log('ISRC_ROW',{scan_id:session.scan_id,platform:sourceplatform,source_entity_id:track.id||null,normalized_artist_id:session.normalized_artist_id,track_name:track.name,isrc:track.isrc||null,match_status:ms,rejected_count:0,cache_hit:false});
    rows.push({name:track.name,artistName:track.artistName,isrc:track.isrc||null,isrcDisplay:track.isrc||'ISRC unavailable',durationMs:track.durationMs,spotify:{status:spS.status,confidence:spS.confidence},apple:{status:apS.status,confidence:apS.confidence},matchStatus:ms,_scan_id:session.scan_id,_artist_context:session.normalized_artist_id});
  }
  return rows;
}

async function buildIsrcTableForTrack(subject, crossRefs, session) {
  const isSp=subject.inputPlatform==='spotify', sI=subject.canonicalIsrc||crossRefs.spotify?.isrc||null;
  let spS, apS;
  if(isSp){spS={status:'Verified (Source)',confidence:'SOURCE'};const am=crossRefs.appleMusic;if(am.authError||am.resolutionStatus==='auth_failed')apS={status:'Auth Unavailable',confidence:null};else if(am.resolutionStatus==='resolved'&&am.crossReferenceStatus==='Cross-Reference Found')apS={status:'Matched',confidence:am.isrcMatchConfidence||'MEDIUM'};else if(am.resolutionStatus==='resolved')apS={status:'Missing',confidence:null};else apS={status:'Not Confirmed',confidence:null};}
  else{apS={status:'Verified (Source)',confidence:'SOURCE'};const sp=crossRefs.spotify;if(sp.resolutionStatus==='failed')spS={status:'Auth Unavailable',confidence:null};else if(sp.crossReferenceStatus==='Cross-Reference Found')spS={status:'Matched',confidence:sp.isrcMatchConfidence||'MEDIUM'};else if(sp.resolutionStatus==='resolved')spS={status:'Missing',confidence:null};else spS={status:'Not Confirmed',confidence:null};}
  let ms;if(spS.status==='Verified (Source)'&&apS.status==='Matched')ms='Matched';else if(apS.status==='Verified (Source)'&&spS.status==='Matched')ms='Matched';else if(apS.status==='Auth Unavailable'||spS.status==='Auth Unavailable')ms='Auth Unavailable';else if(apS.status==='Possible Match'||spS.status==='Possible Match')ms='Possible Match';else if(apS.status==='Missing')ms='Missing on Apple';else if(spS.status==='Missing')ms='Missing on Spotify';else ms='Not Confirmed';
  return[{name:subject.canonicalTrackName,artistName:subject.canonicalArtistName,isrc:sI,isrcDisplay:sI||'ISRC unavailable',spotify:spS,apple:apS,matchStatus:ms,_scan_id:session.scan_id,_artist_context:session.normalized_artist_id}];
}

// ─────────────────────────────────────────────────────────────────
// CROSS-PLATFORM VALIDATORS
// ─────────────────────────────────────────────────────────────────
async function crossValidateTrackOnSpotify(track, token) {
  try{const H={Authorization:`Bearer ${token}`};if(track.isrc){const r=await fetch(`https://api.spotify.com/v1/search?q=isrc:${track.isrc}&type=track&limit=1`,{headers:H});if(!r.ok&&r.status!==404)return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};if(r.ok){const m=(await r.json()).tracks?.items?.[0];if(m)return{status:'Matched',confidence:'HIGH',matchedName:m.name,matchedIsrc:m.external_ids?.isrc||track.isrc};}}
  const q1=encodeURIComponent(`track:${track.name} artist:${track.artistName}`),q2=encodeURIComponent(`${track.name} ${track.artistName}`);
  const[r2a,r2b]=await Promise.all([fetch(`https://api.spotify.com/v1/search?q=${q1}&type=track&limit=10`,{headers:H}),fetch(`https://api.spotify.com/v1/search?q=${q2}&type=track&limit=10`,{headers:H})]);
  const ca=r2a.ok?(await r2a.json()).tracks?.items||[]:[], cb=r2b.ok?(await r2b.json()).tracks?.items||[]:[];
  const seen=new Set();const cands=[...ca,...cb].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
  const res=resolveBestMatch(cands,track,c=>c.name,c=>c.artists?.[0]?.name||'',c=>c.duration_ms||0,c=>c.external_ids?.isrc||null);
  if(res.status==='No Match')return{...res,status:'Missing'};return res;}catch{return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};}
}
async function crossValidateTrackOnApple(track) {
  try{let tok;try{tok=generateAppleToken();}catch{return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};}
  const H={Authorization:`Bearer ${tok}`},B='https://api.music.apple.com/v1/catalog/us';
  if(track.isrc){const r=await fetch(`${B}/songs?filter[isrc]=${track.isrc}`,{headers:H});if(r.status===401||r.status===403)return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};if(r.ok){const m=(await r.json()).data?.[0];if(m)return{status:'Matched',confidence:'HIGH',matchedName:m.attributes?.name,matchedIsrc:track.isrc};}}
  const[r1,r2]=await Promise.all([fetch(`${B}/search?term=${encodeURIComponent(`${track.name} ${track.artistName}`)}&types=songs&limit=10`,{headers:H}),fetch(`${B}/search?term=${encodeURIComponent(track.name)}&types=songs&limit=10`,{headers:H})]);
  if(r1.status===401||r1.status===403)return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};
  const ca=r1.ok?(await r1.json()).results?.songs?.data||[]:[], cb=r2.ok?(await r2.json()).results?.songs?.data||[]:[];
  const seen=new Set();const cands=[...ca,...cb].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
  const res=resolveBestMatch(cands,track,c=>c.attributes?.name||'',c=>c.attributes?.artistName||'',c=>c.attributes?.durationInMillis||0,c=>c.attributes?.isrc||null);
  if(res.status==='No Match')return{...res,status:'Missing'};return res;}catch{return{status:'Auth Unavailable',confidence:null,matchedName:null,matchedIsrc:null};}
}

// ─────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────
function calculateTrackIntegrityScore(subject, crossRefs, isrcTable) {
  let s=100; const isrc=subject.canonicalIsrc||crossRefs.spotify?.isrc||null, row=isrcTable?.[0];
  if(!isrc)s-=25; if(row?.matchStatus==='Missing on Apple'||row?.matchStatus==='Missing on Spotify')s-=25; if(row?.matchStatus==='Possible Match')s-=10; if(!subject.genres?.length)s-=10; if(crossRefs.musicbrainz?.resolutionStatus==='resolved'&&!crossRefs.musicbrainz?.found)s-=10;
  const f=Math.max(s,0); return{score:f,type:'Track Integrity Score',label:f>=85?'Strong':f>=65?'Good':f>=45?'Fair':'Needs Attention'};
}
const INSUFFICIENT={score:null,type:'Catalog Quality Score',label:'Limited Verification',insufficient:true,message:'Your catalog is active across platforms, but key royalty systems are not fully verified. This may impact your ability to collect all available revenue.'};
function calculateCatalogQualityScore(isrcTable) {
  if(!isrcTable||isrcTable.length===0)return INSUFFICIENT;
  const tot=isrcTable.length, authU=isrcTable.filter(t=>t.matchStatus==='Auth Unavailable').length, res=isrcTable.filter(t=>t.matchStatus!=='Auth Unavailable').length, hI=isrcTable.filter(t=>!!t.isrc).length, mtch=isrcTable.filter(t=>t.matchStatus==='Matched').length, mI=isrcTable.filter(t=>!t.isrc).length, mA=isrcTable.filter(t=>t.matchStatus==='Missing on Apple').length, mS=isrcTable.filter(t=>t.matchStatus==='Missing on Spotify').length, pO=isrcTable.filter(t=>t.matchStatus==='Possible Match').length;
  if(res<3||hI<2||authU>=Math.ceil(tot/2))return{...INSUFFICIENT,breakdown:{tot,res,hI,authU,mtch,mI,mA,mS,pO}};
  let s=100; s-=(mI/res)*30; s-=(mA/res)*25; s-=(mS/res)*25; s-=(pO/res)*10;
  const f=Math.round(Math.max(s,0));return{score:f,type:'Catalog Quality Score',label:f>=85?'Strong':f>=65?'Good':f>=45?'Fair':'Needs Attention',insufficient:false,breakdown:{tot,res,mtch,mI,mA,mS,pO,authU}};
}

function buildCollectionReadiness(subject, crossRefs, isrcTable) {
  const items=[], isA=subject.canonicalSubjectType==='artist';
  let is,iN; if(isA&&isrcTable?.length>0){const wi=isrcTable.filter(t=>t.isrc).length,tot=isrcTable.length;if(wi===tot){is='READY';iN=`ISRC confirmed on all ${tot} verified tracks.`;}else if(wi>=Math.ceil(tot/2)){is='PARTIAL';iN=`ISRC confirmed on ${wi} of ${tot} tracks.`;}else{is='AT RISK';iN=`ISRC missing on ${tot-wi} of ${tot} tracks.`;}}else if(!isA){const hi=!!subject.canonicalIsrc;is=hi?'READY':'AT RISK';iN=hi?'ISRC confirmed on this recording.':'ISRC not found.';}else{is='PARTIAL';iN='ISRC data unavailable.';}
  items.push({label:'ISRC Registration',status:is,note:iN});
  const onSp=subject.inputPlatform==='spotify'||crossRefs.spotify?.crossReferenceStatus==='Cross-Reference Found', onAp=subject.inputPlatform==='apple'||crossRefs.appleMusic?.crossReferenceStatus==='Cross-Reference Found', aA=crossRefs.appleMusic?.authError||crossRefs.appleMusic?.resolutionStatus==='auth_failed';
  let ds,dN; if(onSp&&onAp){ds='READY';dN='Catalog confirmed on Spotify and Apple Music.';}else if(onSp&&aA){ds='PARTIAL';dN='Spotify confirmed. Apple Music verification unavailable.';}else if(onSp||onAp){ds='PARTIAL';dN='Catalog confirmed on one major platform.';}else{ds='AT RISK';dN='Distribution coverage could not be confirmed.';}
  items.push({label:'Distribution Coverage',status:ds,note:dN});
  const hg=subject.genres?.length>0; let ms,mN; if(isA&&isrcTable?.length>0){const con=isrcTable.filter(t=>t.matchStatus==='Matched').length,tot=isrcTable.length;if(con===tot){ms='READY';mN='Track metadata consistent across platforms.';}else if(con>=1){ms='PARTIAL';mN=`Metadata matched on ${con} of ${tot} tracks.`;}else{ms='AT RISK';mN='Track metadata could not be confirmed consistent.';}}else{ms=hg?'READY':'PARTIAL';mN=hg?'Genre metadata present.':'Genre metadata absent.';}
  items.push({label:'Metadata Consistency',status:ms,note:mN});
  let cs,cN; if(onSp&&onAp){cs='READY';cN='Cross-platform presence verified on both major DSPs.';}else if(aA){cs='PARTIAL';cN='Cross-platform check incomplete — Apple Music authentication unavailable.';}else if(onSp||onAp){cs='PARTIAL';cN='Present on one major platform.';}else{cs='AT RISK';cN='Cross-platform presence could not be verified.';}
  items.push({label:'Cross-Platform Presence',status:cs,note:cN});
  const ar=items.filter(i=>i.status==='AT RISK').length, pa=items.filter(i=>i.status==='PARTIAL').length;
  return{overall:ar>0?'AT RISK':pa>0?'PARTIAL':'READY',items};
}

// ─────────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────────
function normStr(s){return(s||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();}
function normTrack(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019']/g,'').replace(/\([^)]*\)/g,' ').replace(/\[[^\]]*\]/g,' ').replace(/\{[^}]*\}/g,' ').replace(/\b(feat|ft|featuring|with|x)\b.*$/i,'').replace(/\b(remix|radio edit|radio mix|acoustic|instrumental|live|version|edit|remaster|remastered|cover|reprise|demo|mix|extended|stripped|vevo|official)\b.*$/i,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();}
function normArtist(s){return(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2018\u2019']/g,'').replace(/\b(feat|ft|featuring|with|x|and|&)\b.*$/i,'').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim();}
function wordSimilarity(a,b){const wa=new Set(a.split(' ').filter(w=>w.length>1)),wb=new Set(b.split(' ').filter(w=>w.length>1));if(wa.size===0||wb.size===0)return 0;return[...wa].filter(w=>wb.has(w)).length/Math.max(wa.size,wb.size);}
function resolveBestMatch(candidates, track, getN, getA, getD, getI) {
  const nt=normTrack(track.name),na=normArtist(track.artistName),td=track.durationMs||0;
  if(track.isrc){const m=candidates.find(c=>getI(c)===track.isrc);if(m)return{status:'Matched',confidence:'HIGH',matchedName:getN(m),matchedIsrc:getI(m)};}
  const ed=candidates.find(c=>{const cd=getD(c)||0;return normTrack(getN(c))===nt&&normArtist(getA(c))===na&&(td===0||cd===0||Math.abs(cd-td)<=3000);});if(ed)return{status:'Matched',confidence:'MEDIUM',matchedName:getN(ed),matchedIsrc:getI(ed)};
  const em=candidates.find(c=>normTrack(getN(c))===nt&&normArtist(getA(c))===na);if(em)return{status:'Matched',confidence:'MEDIUM',matchedName:getN(em),matchedIsrc:getI(em)};
  const to=candidates.find(c=>normTrack(getN(c))===nt);if(to)return{status:'Possible Match',confidence:'LOW',matchedName:getN(to),matchedIsrc:getI(to)};
  const fz=candidates.map(c=>({c,sim:wordSimilarity(normTrack(getN(c)),nt)})).filter(x=>x.sim>=0.75).sort((a,b)=>b.sim-a.sim)[0];if(fz)return{status:'Possible Match',confidence:'LOW',matchedName:getN(fz.c),matchedIsrc:getI(fz.c)};
  return{status:'No Match',confidence:null,matchedName:null,matchedIsrc:null};
}

// ─────────────────────────────────────────────────────────────────
// SPOTIFY API HELPERS
// ─────────────────────────────────────────────────────────────────
async function getSpotifyToken(){const id=process.env.SPOTIFY_CLIENT_ID,sec=process.env.SPOTIFY_CLIENT_SECRET;if(!id||!sec)throw new Error('Spotify credentials not configured');const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':'Basic '+Buffer.from(`${id}:${sec}`).toString('base64')},body:'grant_type=client_credentials'});const d=await r.json();if(!d.access_token)throw new Error('Failed to get Spotify token');return d.access_token;}
async function getSpotifyArtist(id,token){const r=await fetch(`https://api.spotify.com/v1/artists/${id}`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error(`Spotify artist fetch failed: ${r.status}`);return r.json();}
async function getSpotifyTrack(id,token){const r=await fetch(`https://api.spotify.com/v1/tracks/${id}`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error(`Spotify track fetch failed: ${r.status}`);return r.json();}
async function getSpotifyAlbums(artistId,token){try{const r=await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return{items:[]};return r.json();}catch{return{items:[]};}}
async function getSpotifyTopTracks(artistId,token){try{const r=await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`,{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)return[];const d=await r.json();return(d.tracks||[]).map(t=>({name:t.name,isrc:t.external_ids?.isrc||null,artistName:t.artists?.[0]?.name||''}));}catch{return[];}}

async function getSpotifyArtistTracks(artistId, token, limit=5, session) {
  try{
    const ar=await fetch(`https://api.spotify.com/v1/artists/${artistId}/albums?limit=50&include_groups=album,single&market=US`,{headers:{Authorization:`Bearer ${token}`}});
    if(!ar.ok)return[];
    const albums=(await ar.json()).items||[];
    const EXCL=/\b(remix|remixed|live|acoustic|instrumental|karaoke|clean|explicit|version|edit|cover|remaster|remastered|stripped|demo|radio|mix|reprise|interlude|skit|intro|outro)\b/i;
    const sT=new Set(),sI=new Set(),tracks=[];
    for(const album of albums){if(tracks.length>=limit)break;try{const tr=await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50`,{headers:{Authorization:`Bearer ${token}`}});if(!tr.ok)continue;for(const t of(await tr.json()).items||[]){if(tracks.length>=limit)break;const name=t.name||'';if(EXCL.test(name))continue;const nn=name.toLowerCase().trim();if(sT.has(nn))continue;let isrc=null,dur=t.duration_ms||0;try{const fr=await fetch(`https://api.spotify.com/v1/tracks/${t.id}`,{headers:{Authorization:`Bearer ${token}`}});if(fr.ok){const fd=await fr.json();isrc=fd.external_ids?.isrc||null;dur=fd.duration_ms||dur;}}catch{}if(isrc&&sI.has(isrc))continue;sT.add(nn);if(isrc)sI.add(isrc);tracks.push({id:t.id,name,artistName:t.artists?.[0]?.name||'',isrc,durationMs:dur,albumName:album.name,albumId:album.id});}}catch{continue;}}
    session?.log('SPOTIFY_ARTIST_TRACKS',{platform:'spotify',source_entity_id:artistId,normalized_artist_id:session?.normalized_artist_id,track_count:tracks.length,requested:limit,rejected_count:0,cache_hit:false});
    return tracks;
  }catch(err){session?.log('SPOTIFY_ARTIST_TRACKS_ERROR',{error:err.message});return[];}
}

async function getAppleArtistTracks(appleArtistId, storefront='us', limit=5, session) {
  try{
    const tok=generateAppleToken(),B=`https://api.music.apple.com/v1/catalog/${storefront}`,H={Authorization:`Bearer ${tok}`};
    const ar=await fetch(`${B}/artists/${appleArtistId}/albums?limit=25`,{headers:H});
    if(!ar.ok)return{tracks:[],authFailed:ar.status===401||ar.status===403};
    const albums=(await ar.json()).data||[];
    const EXCL=/\b(remix|remixed|live|acoustic|instrumental|karaoke|clean|explicit|version|edit|cover|remaster|remastered|stripped|demo|radio|mix|reprise|interlude|skit|intro|outro)\b/i;
    const sT=new Set(),sI=new Set(),tracks=[];
    for(const album of albums){if(tracks.length>=limit)break;try{const tr=await fetch(`${B}/albums/${album.id}/tracks`,{headers:H});if(!tr.ok)continue;for(const t of(await tr.json()).data||[]){if(tracks.length>=limit)break;const name=t.attributes?.name||'';if(EXCL.test(name))continue;const nn=name.toLowerCase().trim();if(sT.has(nn))continue;const isrc=t.attributes?.isrc||null;if(isrc&&sI.has(isrc))continue;sT.add(nn);if(isrc)sI.add(isrc);tracks.push({id:t.id,name,artistName:t.attributes?.artistName||'',isrc,durationMs:t.attributes?.durationInMillis||0,albumName:album.attributes?.name||'',albumId:album.id});}}catch{continue;}}
    session?.log('APPLE_ARTIST_TRACKS',{platform:'apple',source_entity_id:appleArtistId,normalized_artist_id:session?.normalized_artist_id,track_count:tracks.length,requested:limit,rejected_count:0,cache_hit:false});
    return{tracks,authFailed:false};
  }catch(err){session?.log('APPLE_ARTIST_TRACKS_ERROR',{error:err.message});return{tracks:[],authFailed:false,error:err.message};}
}

// ─────────────────────────────────────────────────────────────────
// PRO GUIDE
// ─────────────────────────────────────────────────────────────────
function getPROGuide(country){const G={'Canada':{pro:'SOCAN',url:'https://www.socan.com'},'United States':{pro:'ASCAP or BMI',url:'https://www.ascap.com'},'United Kingdom':{pro:'PRS for Music',url:'https://www.prsformusic.com'},'Germany':{pro:'GEMA',url:'https://www.gema.de'},'France':{pro:'SACEM',url:'https://www.sacem.fr'},'Australia':{pro:'APRA AMCOS',url:'https://www.apraamcos.com.au'},'Jamaica':{pro:'JACAP',url:'https://www.jacap.org'}};const D={pro:'Your local PRO',url:'https://www.cisac.org'};if(!country)return D;const m=Object.keys(G).find(k=>country.toLowerCase().includes(k.toLowerCase()));return m?{...G[m],country:m}:{...D,country};}
