// Royaltē OS — V2 scan-write path (Brief 003).
//
// Called from api/audit.js after persistCanonicalScan succeeds, ONLY when
// the request is authenticated (user_id resolved from a Bearer token). For
// anonymous scans this helper is not invoked.
//
// Three concerns, all best-effort relative to the user's scan response:
//   1. Insert a scan_snapshots row populated with the V2 fields
//      (artist_id, artist_name, scan_number, scanned_at, canonical_data,
//      status) plus the legacy V1 fields (sequence_number, payload,
//      source) that the existing dashboard + cron paths still read.
//   2. Run the delta engine against the prior snapshot for the same
//      (user_id, artist_id). Failures here are logged and swallowed —
//      per Brief 003, the scan response must never depend on delta success.
//   3. Upsert into monitoring_subscriptions (user, artist) so this artist
//      is now actively monitored with a weekly cadence.
//
// The whole helper throws only on the scan_snapshots insert itself; the
// caller wraps THAT in a try/catch so even a snapshot-write failure
// degrades the user response from "V2 monitoring activated" to "scan
// returned without monitoring", never to a 5xx.

import { computeDelta } from './delta-engine.js';

const RESCAN_INTERVAL_DAYS = 7;

// Map url_type from /api/audit to the V2 source enum on scan_snapshots.
// The OS schema-foundation migration expanded the source check to allow both
// V1 event-types and V2 platform sources.
function sourceFromUrlType(urlType) {
  if (urlType === 'apple_music') return 'apple_music';
  // Spotify artist / track / album all live under the single 'spotify' source.
  return 'spotify';
}

// ─── V2 canonical-array extractors (Brief 006) ─────────────────────────────
//
// The V1 audit engine writes a canonical payload (subject / platforms /
// catalog / etc.) but does NOT emit the per-item diff lists the V2 delta
// engine reads. These extractors build those four lists from whatever
// real data the current canonical exposes, returning [] when there is no
// honest signal — Brief 002 + 006 both authorise the empty case.
//
// They are V2-native-aware: if and when the audit engine starts emitting
// `territoryCoverage.available[]` or `youtube.details.confirmedMatches[]`,
// the extractors pick them up automatically without code changes here.

export function extractTerritories(canonical) {
  if (!canonical) return [];
  const tc = canonical.territoryCoverage;
  if (Array.isArray(tc)) {
    return tc.filter((x) => typeof x === 'string');
  }
  if (tc && Array.isArray(tc.available)) {
    return tc.available.filter((x) => typeof x === 'string');
  }
  if (tc && Array.isArray(tc.territories)) {
    return tc.territories.filter((x) => typeof x === 'string');
  }
  return [];
}

export function extractTracks(canonical) {
  if (!canonical) return [];
  const out = [];
  const subj = canonical.subject || {};

  // Track from the input URL (when the scan was a track URL — artist scans
  // leave both fields null on the subject).
  if (subj.trackTitle) {
    out.push({ name: subj.trackTitle, isrc: subj.trackIsrc || null });
  }

  // Apple Music's per-track ISRC lookup — richer track view when the input
  // resolved against Apple. Single-track object today (not an array).
  const lookup = canonical.platforms
    && canonical.platforms.appleMusic
    && canonical.platforms.appleMusic.details
    && canonical.platforms.appleMusic.details.isrcLookup;
  if (lookup && lookup.found && (lookup.name || lookup.isrc)) {
    out.push({
      name: lookup.name || subj.trackTitle || null,
      isrc: lookup.isrc || null,
    });
  }

  // De-dup: ISRC is the unique key when present (same ISRC + slightly
  // different names — e.g. subject vs. isrcLookup — collapse to one).
  // Fall back to name when ISRC is missing.
  const seen = new Set();
  const dedup = [];
  for (const t of out) {
    if (!t.name && !t.isrc) continue;
    const key = t.isrc || t.name;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(t);
  }
  return dedup;
}

// Apple Music doesn't tag releases as Single / EP / Album in a single field,
// so we classify by track count using the industry-standard convention.
// 1 track → single · 2–6 tracks → EP · 7+ → album. Unknown trackCount
// defaults to 'album' (most common case in the wild).
export function classifyRelease(trackCount) {
  if (typeof trackCount !== 'number' || trackCount <= 0) return 'album';
  if (trackCount === 1) return 'single';
  if (trackCount <= 6)  return 'ep';
  return                       'album';
}

export function extractReleases(canonical) {
  if (!canonical) return [];
  const out = [];

  // 1. Primary source (Brief 008): the per-artist albums list surfaced by
  //    run-scan.js → normalize. Each item has { id, name, releaseDate,
  //    trackCount, url }. Read both shapes (raw flat / canonical nested).
  const am = canonical.platforms && canonical.platforms.appleMusic
           && canonical.platforms.appleMusic.details
           ? canonical.platforms.appleMusic.details
           : canonical.appleMusic || {};
  const albumList = Array.isArray(am.albums) ? am.albums : [];
  for (const a of albumList) {
    const title = a && a.name;
    if (title) out.push({ title, type: classifyRelease(a.trackCount) });
  }

  // 2. Secondary sources — single-track scan paths. Subject.albumName +
  //    isrcLookup.albumName cover the case where the input was a track URL
  //    (an artist scan won't have these). Default type=album for these
  //    fallback paths since we don't have trackCount.
  const subj = canonical.subject || {};
  if (subj.albumName) {
    out.push({ title: subj.albumName, type: 'album' });
  }
  if (am.isrcLookup && am.isrcLookup.albumName) {
    out.push({ title: am.isrcLookup.albumName, type: 'album' });
  }

  // De-dup by title (first occurrence wins — preserves the rich albums[]
  // entry over the fallback subject/isrcLookup duplicate).
  const seen = new Set();
  const dedup = [];
  for (const r of out) {
    if (!r.title) continue;
    if (seen.has(r.title)) continue;
    seen.add(r.title);
    dedup.push(r);
  }
  return dedup;
}

export function extractYoutubeMatches(canonical) {
  if (!canonical) return [];
  // The V1 engine does not yet emit per-video confirmed-matches data.
  // ugc.topVideos[] is name-collision-prone search output (Brief 002
  // documents this in detail) and explicitly cannot be treated as
  // confirmed. The officialChannel sub-object is a single channel-level
  // summary, not per-video.
  //
  // V2-native path: when the engine adds
  // canonical.platforms.youtube.details.confirmedMatches[], we read it
  // here. Until then, return [].
  const yt = canonical.platforms
    && canonical.platforms.youtube
    && canonical.platforms.youtube.details;
  if (yt && Array.isArray(yt.confirmedMatches)) {
    return yt.confirmedMatches
      .filter((v) => v && v.title && v.videoId)
      .map((v) => ({
        title:   v.title,
        videoId: v.videoId,
        views:   typeof v.views === 'number' ? v.views : 0,
      }));
  }
  return [];
}

// Merge the four V2 arrays into a copy of the canonical payload. The
// existing V1 shape is preserved untouched; the new arrays live alongside.
export function buildCanonicalDataV2(canonical) {
  return {
    ...canonical,
    territories:    extractTerritories(canonical),
    tracks:         extractTracks(canonical),
    releases:       extractReleases(canonical),
    youtubeMatches: extractYoutubeMatches(canonical),
  };
}

export async function persistOSScanSnapshot({
  canonical,
  urlType,
  userId,
  supabase,
  warnings = [],
}) {
  if (!userId)                           return { written: false, reason: 'no_user_id' };
  if (!canonical)                        return { written: false, reason: 'no_canonical' };
  if (!supabase)                         return { written: false, reason: 'no_supabase' };

  const artistId   = canonical.subject?.artistId   || null;
  const artistName = canonical.subject?.artistName || null;
  if (!artistId || !artistName) {
    return { written: false, reason: 'no_artist_subject' };
  }

  // ── scan_number — per (user_id, artist_id), starts at 1 ─────────────────
  const { count: priorScanCount, error: countErr } = await supabase
    .from('scan_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('artist_id', artistId);
  if (countErr) {
    throw new Error(`scan_number count failed: ${countErr.message}`);
  }
  const scanNumber = (priorScanCount || 0) + 1;

  // ── sequence_number — per-user (legacy V1 field, still NOT NULL on the
  //    table; the cron rescan path orders by it). Max+1. ─────────────────
  const { data: seqRow, error: seqErr } = await supabase
    .from('scan_snapshots')
    .select('sequence_number')
    .eq('user_id', userId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (seqErr) {
    throw new Error(`sequence_number lookup failed: ${seqErr.message}`);
  }
  const sequenceNumber = (seqRow?.sequence_number || 0) + 1;

  // ── Build V2 canonical (with diff-list arrays) ─────────────────────────
  // canonical_data carries the V2-augmented payload (V1 fields untouched +
  // four diff arrays the delta engine reads). payload keeps the pure V1
  // shape so the V1 dashboard continues to see exactly what it has always
  // seen — no V1 read-path change.
  const canonicalDataV2 = buildCanonicalDataV2(canonical);

  // ── Insert the snapshot ────────────────────────────────────────────────
  const insertRow = {
    user_id:         userId,
    artist_id:       artistId,
    artist_name:     artistName,
    scan_number:     scanNumber,
    sequence_number: sequenceNumber,
    scanned_at:      new Date().toISOString(),
    canonical_data:  canonicalDataV2,
    payload:         canonical,
    source:          sourceFromUrlType(urlType),
    status:          warnings && warnings.length > 0 ? 'partial' : 'complete',
    // health_score + score_breakdown — populated by computeDelta below.
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('scan_snapshots')
    .insert(insertRow)
    .select('*')
    .single();
  if (insertErr) {
    throw new Error(`scan_snapshots insert failed: ${insertErr.message}`);
  }

  // ── Fetch the prior snapshot (the delta baseline) ──────────────────────
  // scan_number === 1 means there is no prior — baseline. Otherwise pull
  // the most-recent prior row for the same (user, artist).
  let previousSnapshot = null;
  if (scanNumber > 1) {
    const { data: prev, error: prevErr } = await supabase
      .from('scan_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('artist_id', artistId)
      .neq('id', inserted.id)
      .order('scanned_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevErr) {
      console.error('[os-scan] previous snapshot lookup failed:', prevErr.message);
    } else {
      previousSnapshot = prev || null;
    }
  }

  // ── Delta engine — non-blocking per Brief 003 ──────────────────────────
  let alertCount = 0;
  try {
    const alerts = await computeDelta(inserted, previousSnapshot, supabase);
    alertCount = Array.isArray(alerts) ? alerts.length : 0;
    console.log(`[delta] ${alertCount} alerts emitted for ${artistName}`);
  } catch (deltaErr) {
    console.error('[delta] computeDelta failed (non-blocking):', deltaErr.message);
  }

  // ── monitoring_subscriptions upsert — also non-blocking. Failure here
  //    means the user got their scan + alerts but the next-rescan schedule
  //    didn't update; the cron's own bookkeeping will catch up next pass.
  try {
    const now = new Date();
    const nextScan = new Date(now);
    nextScan.setDate(nextScan.getDate() + RESCAN_INTERVAL_DAYS);
    const { error: subErr } = await supabase
      .from('monitoring_subscriptions')
      .upsert(
        {
          user_id:         userId,
          artist_id:       artistId,
          artist_name:     artistName,
          scan_frequency:  'weekly',
          last_scanned_at: now.toISOString(),
          next_scan_at:    nextScan.toISOString(),
          active:          true,
        },
        { onConflict: 'user_id,artist_id' },
      );
    if (subErr) {
      console.error('[monitoring] subscription upsert failed (non-blocking):', subErr.message);
    }
  } catch (subThrown) {
    console.error('[monitoring] subscription upsert threw (non-blocking):', subThrown.message);
  }

  return {
    written:    true,
    snapshotId: inserted.id,
    scanNumber,
    alertCount,
  };
}

// Resolve a user_id from the request's Authorization: Bearer header. Returns
// null when no token, an invalid token, or auth lookup fails. The caller
// treats null as "anonymous scan, no V2 write".
export async function resolveUserIdFromAuthHeader(req, supabase) {
  const header = req.headers && (req.headers['authorization'] || req.headers['Authorization']);
  if (!header || typeof header !== 'string') return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.warn('[os-scan] auth.getUser error:', error.message);
      return null;
    }
    return (data && data.user && data.user.id) || null;
  } catch (e) {
    console.warn('[os-scan] auth.getUser threw:', e.message);
    return null;
  }
}
