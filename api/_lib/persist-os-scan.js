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

  // ── Insert the snapshot ────────────────────────────────────────────────
  const insertRow = {
    user_id:         userId,
    artist_id:       artistId,
    artist_name:     artistName,
    scan_number:     scanNumber,
    sequence_number: sequenceNumber,
    scanned_at:      new Date().toISOString(),
    canonical_data:  canonical,
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
