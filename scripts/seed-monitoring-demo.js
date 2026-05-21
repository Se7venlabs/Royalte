#!/usr/bin/env node
// scripts/seed-monitoring-demo.js
//
// One-time seed for visual QA of the Backend Protection panel (Brief 005).
// Seeds a monitoring_subscriptions row + 3 monitoring_alerts rows for the
// Black Alternative founder account, anchored to the user's most recent
// scan_snapshots row.
//
// Idempotent — deletes any existing seed rows for this (user, artist)
// before inserting, so the script is safe to re-run.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (service-role key bypasses RLS to write the rows).
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-monitoring-demo.js

import { createClient } from '@supabase/supabase-js';

const USER_ID     = '4375a85b-52bf-4a28-9d61-09ccce43ca30';
const ARTIST_ID   = '1lnM3VZrD6SG9vxBsE9654';
const ARTIST_NAME = 'Black Alternative';

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Find the most recent scan_snapshots.id for this (user, artist).
  const { data: scan, error: scanErr } = await supabase
    .from('scan_snapshots')
    .select('id, scanned_at')
    .eq('user_id', USER_ID)
    .eq('artist_id', ARTIST_ID)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single();
  if (scanErr || !scan) {
    console.error('Could not find a scan_snapshots row for the seed target:', scanErr);
    process.exit(1);
  }
  console.log(`Anchoring alerts to scan_id ${scan.id} (scanned_at ${scan.scanned_at})`);

  // 2. Idempotency — clear any prior seed rows for this (user, artist).
  const { error: delAlertsErr } = await supabase
    .from('monitoring_alerts')
    .delete()
    .eq('user_id', USER_ID)
    .eq('artist_id', ARTIST_ID);
  if (delAlertsErr) console.warn('monitoring_alerts delete warning:', delAlertsErr.message);

  const { error: delSubErr } = await supabase
    .from('monitoring_subscriptions')
    .delete()
    .eq('user_id', USER_ID)
    .eq('artist_id', ARTIST_ID);
  if (delSubErr) console.warn('monitoring_subscriptions delete warning:', delSubErr.message);

  // 3. Insert subscription.
  const now = new Date();
  const nextScan = new Date(now);
  nextScan.setDate(nextScan.getDate() + 7);

  const { error: subErr } = await supabase
    .from('monitoring_subscriptions')
    .insert({
      user_id:         USER_ID,
      artist_id:       ARTIST_ID,
      artist_name:     ARTIST_NAME,
      scan_frequency:  'weekly',
      last_scanned_at: now.toISOString(),
      next_scan_at:    nextScan.toISOString(),
      active:          true,
    });
  if (subErr) {
    console.error('monitoring_subscriptions insert failed:', subErr);
    process.exit(1);
  }
  console.log('Inserted monitoring_subscriptions row.');

  // 4. Insert three alerts.
  const baseRow = {
    user_id:     USER_ID,
    artist_id:   ARTIST_ID,
    artist_name: ARTIST_NAME,
    scan_id:     scan.id,
    resolved:    false,
  };
  const alerts = [
    {
      ...baseRow,
      change_type: 'territory_loss',
      severity:    'action_needed',
      title:       '"Circles" unavailable in Japan',
      detail:      'Previously available in JP storefront · no longer found on Apple Music · contact distributor to restore',
      territory:   'JP',
      platform:    'apple_music',
    },
    {
      ...baseRow,
      change_type: 'isrc_dropped',
      severity:    'action_needed',
      title:       'ISRC dropped from "Higher Ground"',
      detail:      'ISRC US-UA1-24-00041 no longer present on Apple Music · royalty routing at risk · verify with distributor',
      track_name:  'Higher Ground',
      isrc:        'US-UA1-24-00041',
      platform:    'apple_music',
    },
    {
      ...baseRow,
      change_type: 'territory_gain',
      severity:    'positive',
      title:       '"Colours" confirmed on 4 new storefronts',
      detail:      'Now available in AU, NZ, SE, NO · distribution expanded since last scan',
      territory:   'AU,NZ,SE,NO',
      platform:    'apple_music',
    },
  ];

  const { error: alertsErr } = await supabase.from('monitoring_alerts').insert(alerts);
  if (alertsErr) {
    console.error('monitoring_alerts insert failed:', alertsErr);
    process.exit(1);
  }
  console.log(`Inserted ${alerts.length} monitoring_alerts rows.`);

  // 5. Verify counts.
  const { count: subCount } = await supabase
    .from('monitoring_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('artist_id', ARTIST_ID);
  const { count: alertCount } = await supabase
    .from('monitoring_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .eq('artist_id', ARTIST_ID);

  console.log(`Verification — subscriptions=${subCount}, alerts=${alertCount}`);
  if (subCount !== 1 || alertCount !== 3) {
    console.error('Seed verification failed.');
    process.exit(1);
  }
  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
