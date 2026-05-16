// Royaltē — Block D: monitoring rescan cron.
//
// Invoked daily by Vercel Cron (vercel.json `crons`, 06:00 UTC). For each
// profile due a rescan, it re-runs the scan, stores a new snapshot, computes
// diffs into scan_changes, and advances the monitoring state:
//   - grace_period (Free) → one rescan, then monitoring_status='inactive'
//   - active (Pro)        → rescan, next_rescan_at = now + 7 days
//
// Auth: only Vercel Cron may call this — CRON_SECRET bearer token.
// All DB work uses the service-role key (bypasses RLS).

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { runScan } from '../_lib/run-scan.js';
import { computeChanges } from '../_lib/compute-changes.js';
import { normalizeAuditResponse } from '../lib/normalizeAuditResponse.js';

// Batch size — keeps a single cron invocation bounded. NOTE: at scale, 50
// full scans cannot complete within one function's maxDuration; revisit
// (smaller batches / multiple daily runs) once the monitored-user count grows.
const RESCAN_BATCH = 50;
const RESCAN_INTERVAL_DAYS = 7;

// The rescan target is reconstructed from the prior snapshot's canonical
// payload — subject.artistId is the Spotify artist id. runScan accepts a
// Spotify artist URL.
function artistUrlFromPayload(payload) {
  const artistId = payload?.subject?.artistId;
  return artistId ? `https://open.spotify.com/artist/${artistId}` : null;
}

export default async function handler(req, res) {
  // ── Auth — only Vercel Cron, via CRON_SECRET ──
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || req.headers['authorization'] !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'supabase_not_configured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Users due for a rescan ──
  const { data: due, error: dueErr } = await supabase
    .from('profiles')
    .select('id, email, monitoring_status')
    .lte('next_rescan_at', new Date().toISOString())
    .in('monitoring_status', ['active', 'grace_period'])
    .limit(RESCAN_BATCH);

  if (dueErr) {
    return res.status(500).json({ error: 'due_query_failed', detail: dueErr.message });
  }

  let processed = 0;
  const skipped = [];
  const errors = [];

  for (const profile of (due || [])) {
    try {
      // Latest snapshot — both the rescan target and the diff baseline.
      const { data: lastSnapshot, error: snapErr } = await supabase
        .from('scan_snapshots')
        .select('id, payload, sequence_number')
        .eq('user_id', profile.id)
        .order('sequence_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (snapErr) { errors.push({ user_id: profile.id, error: snapErr.message }); continue; }
      if (!lastSnapshot) { skipped.push({ user_id: profile.id, reason: 'no_prior_snapshot' }); continue; }

      const artistUrl = artistUrlFromPayload(lastSnapshot.payload);
      if (!artistUrl) { skipped.push({ user_id: profile.id, reason: 'no_artist_url' }); continue; }

      // ── Rescan ──
      const { rawResponse, warnings } = await runScan(artistUrl);

      // Degraded rescan — skip the snapshot + diff entirely. A degraded scan
      // is not a real state change; next_rescan_at is left unchanged so the
      // next cron cycle retries (no backoff counter for V1).
      const degraded = (warnings && warnings.length > 0) || rawResponse.degraded === true;
      if (degraded) {
        skipped.push({ user_id: profile.id, reason: 'degraded_scan' });
        continue;
      }

      // Normalize raw → canonical so scan_snapshots.payload stays consistent
      // with the backfilled signup_scan snapshots and the dashboard mapper.
      let canonical;
      try {
        canonical = normalizeAuditResponse({ ...rawResponse, scanId: randomUUID(), _originalUrl: artistUrl });
      } catch (normErr) {
        errors.push({ user_id: profile.id, error: `normalize_failed: ${normErr.message}` });
        continue;
      }

      // ── Store the new snapshot ──
      // UNIQUE (user_id, sequence_number) guards against two cron runs racing
      // on the same user: the loser hits a 23505 unique violation, treated
      // here as "already rescanned this cycle" and skipped silently.
      const source = profile.monitoring_status === 'grace_period' ? 'grace_rescan' : 'scheduled_rescan';
      const { data: newSnap, error: insErr } = await supabase
        .from('scan_snapshots')
        .insert({
          user_id: profile.id,
          sequence_number: lastSnapshot.sequence_number + 1,
          payload: canonical,
          source,
        })
        .select('id')
        .single();

      if (insErr) {
        if (insErr.code === '23505') {
          skipped.push({ user_id: profile.id, reason: 'concurrent_rescan' });
        } else {
          errors.push({ user_id: profile.id, error: insErr.message });
        }
        continue;
      }

      // ── Compute + store diffs ──
      const changes = computeChanges(lastSnapshot.payload, canonical);
      if (changes.length > 0) {
        const { error: chErr } = await supabase
          .from('scan_changes')
          .insert(changes.map(c => ({ ...c, user_id: profile.id, snapshot_id: newSnap.id })));
        if (chErr) errors.push({ user_id: profile.id, error: `changes_insert: ${chErr.message}` });
      }

      // ── Advance monitoring state ──
      if (profile.monitoring_status === 'grace_period') {
        // Grace period spent — Free users go inactive (no further rescans).
        await supabase
          .from('profiles')
          .update({ monitoring_status: 'inactive', next_rescan_at: null })
          .eq('id', profile.id);
      } else {
        // Active (Pro) — schedule the next weekly rescan.
        const next = new Date();
        next.setDate(next.getDate() + RESCAN_INTERVAL_DAYS);
        await supabase
          .from('profiles')
          .update({ next_rescan_at: next.toISOString() })
          .eq('id', profile.id);
      }

      processed++;
    } catch (err) {
      errors.push({ user_id: profile.id, error: err.message });
    }
  }

  return res.status(200).json({ processed, skipped, errors });
}
