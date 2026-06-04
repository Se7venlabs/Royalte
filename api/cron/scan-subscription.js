// api/cron/scan-subscription.js
// ─────────────────────────────────────────────────────────────────────────────
// Royaltē OS — Brief 010: pg_cron → pg_net → this endpoint per-subscription
// scan handler. Receives { subscription_id } from the SECURITY DEFINER
// trigger_due_v2_scans() function in Postgres, runs a fresh scan via
// runScan + persistCanonicalScan + persistOSScanSnapshot, which in turn
// fires computeDelta (Brief 002) and upserts the subscription's
// next_scan_at to now()+7d (Brief 003).
//
// Auth: Authorization: Bearer <CRON_SECRET>. The secret is mirrored in
// public.cron_config (Brief 010, B2) so pg_cron can read it server-side.
// This endpoint is NOT meant to be called by browser clients — anonymous
// or user-authenticated requests will fail the bearer check.
//
// Sibling of /api/cron/rescan (V1 daily Vercel-Cron). Not a replacement —
// the V1 path uses profiles.next_rescan_at + scan_changes (untouched per
// Brief 010 decision C1). This handler uses monitoring_subscriptions +
// monitoring_alerts (V2).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { runScan } from '../_lib/run-scan.js';
import { persistCanonicalScan } from '../audit.js';
import { persistOSScanSnapshot } from '../_lib/persist-os-scan.js';
import { runPodcastDiscovery } from '../_lib/podcast-intelligence.js';
import { randomUUID } from 'node:crypto';

export default async function handler(req, res) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || req.headers['authorization'] !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // ── Supabase service-role client (bypasses RLS for cron writes) ──────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'supabase_not_configured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Resolve subscription_id (POST body — pg_net sends JSON) ──────────
  const body = (req.body && typeof req.body === 'object') ? req.body : {};
  const subscriptionId = body.subscription_id;
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    return res.status(400).json({ error: 'missing_subscription_id' });
  }

  // ── Fetch the subscription ───────────────────────────────────────────
  const { data: sub, error: subErr } = await supabase
    .from('monitoring_subscriptions')
    .select('id, user_id, artist_id, artist_name, active')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (subErr) {
    console.error('[pg-cron scan-subscription] subscription lookup failed:', subErr.message);
    return res.status(500).json({ error: 'subscription_lookup_failed', detail: subErr.message });
  }
  if (!sub) {
    return res.status(404).json({ error: 'subscription_not_found' });
  }
  if (!sub.active) {
    return res.status(200).json({ ok: true, skipped: 'subscription_inactive' });
  }

  // Build the artist URL — monitoring_subscriptions.artist_id is the
  // Spotify artist ID (per Brief 003's persist path which seeded it
  // from canonical.subject.artistId).
  const artistUrl = `https://open.spotify.com/artist/${encodeURIComponent(sub.artist_id)}`;
  const scanId    = randomUUID();

  // ── Run scan ─────────────────────────────────────────────────────────
  let runResult;
  try {
    runResult = await runScan(artistUrl);
  } catch (scanErr) {
    console.error('[pg-cron scan-subscription] runScan failed:', scanErr.message);
    return res.status(502).json({
      error: 'scan_failed',
      subscription_id: sub.id,
      detail: scanErr.message,
    });
  }

  // Mirror /api/audit's "degraded scan" handling. A degraded result still
  // persists — the schema treats it as a real (but incomplete) scan.
  const degraded = (runResult.warnings && runResult.warnings.length > 0)
                || runResult.rawResponse?.degraded === true;

  // ── Persist canonical (audit_scans + validation gate) ────────────────
  let canonical;
  try {
    const persisted = await persistCanonicalScan(
      runResult.rawResponse, artistUrl, runResult.urlType, scanId, null
    );
    canonical = persisted.canonical;
  } catch (persistErr) {
    console.error('[pg-cron scan-subscription] persistCanonicalScan failed:', persistErr.message);
    return res.status(500).json({
      error: 'persist_canonical_failed',
      subscription_id: sub.id,
      detail: persistErr.message,
    });
  }

  // ── V2 OS write path — scan_snapshots + delta engine + subscription upsert ─
  let osResult = null;
  try {
    osResult = await persistOSScanSnapshot({
      canonical,
      urlType:  runResult.urlType,
      userId:   sub.user_id,
      supabase,
      warnings: runResult.warnings,
    });
  } catch (osErr) {
    // Non-blocking — the audit_scans row landed; the V2 write failure is
    // logged and the response indicates partial success.
    console.error('[pg-cron scan-subscription] persistOSScanSnapshot failed:', osErr.message);
    return res.status(200).json({
      ok: false,
      subscription_id: sub.id,
      scan_id: scanId,
      degraded,
      os_error: osErr.message,
    });
  }

  // ── Podcast Intelligence (Brief 015o Phase 2) ────────────────────────
  // Run on the same 7-day cadence as the scan itself. The orchestrator
  // gates on (a) monitoring-subscriber status from profiles and (b) its
  // own 7-day interval guard against profiles.podcast_intelligence_last_run.
  // Failures are non-blocking — the scan succeeded; podcast discovery is
  // additive intelligence layered on top.
  let podcastResult = { ran: false, reason: 'not_attempted' };
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, founding_artist, tier, podcast_intelligence_last_run')
      .eq('id', sub.user_id)
      .maybeSingle();

    podcastResult = await runPodcastDiscovery(supabase, {
      profile,
      userId: sub.user_id,
      artistId: sub.artist_id,
      artistName: sub.artist_name,
      scanId,
    });
  } catch (podErr) {
    console.error('[pg-cron scan-subscription] podcast discovery failed:', podErr.message);
    podcastResult = { ran: false, reason: 'exception', error: podErr.message };
  }

  return res.status(200).json({
    ok: true,
    subscription_id: sub.id,
    scan_id: scanId,
    snapshot_id: osResult?.snapshotId || null,
    scan_number: osResult?.scanNumber || null,
    alerts: osResult?.alertCount || 0,
    degraded,
    podcast: podcastResult,
  });
}
