#!/usr/bin/env node
// scripts/seed-mc-demo-alerts.js
//
// Brief 015e Priority 3 — seed a realistic alert mix for the Black
// Alternative founder account so Mission Control's Intelligence Feed
// renders every event-chip color variant (Verified / New Release /
// Discovery / Review / Action Required).
//
// What this inserts (5 NEW alerts, in chronological order):
//   1. baseline_established              (oldest)  · blue   · monitoring start
//   2. territory_gain (FR · spotify)              · blue   · regional discovery
//   3. isrc_added    ("Everything Is Over")       · green  · verified link
//   4. metadata_changed ("Nosferatu")             · green  · verified update
//   5. video_added   ("Knockin on Heavens Door")  · green  · YouTube match
//
// What this DOES NOT touch:
//   - The 4 existing release_added alerts (user wants them preserved).
//     Idempotence is scoped via a `[mc-demo]` marker prefix in `detail`
//     so re-running this script only removes rows it previously wrote.
//
// IDEMPOTENT — safe to re-run. Each run deletes only the rows with the
// `[mc-demo]` marker, then re-inserts the canonical set.
//
// DO NOT auto-run from CI / Vercel. Manual invocation only:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/seed-mc-demo-alerts.js

import { createClient } from '@supabase/supabase-js';

const USER_ID     = '4375a85b-52bf-4a28-9d61-09ccce43ca30';
const ARTIST_ID   = '1lnM3VZrD6SG9vxBsE9654';
const ARTIST_NAME = 'Black Alternative';

const SEED_MARKER = '[mc-demo]';

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

async function main() {
  // 1. Anchor to the user's most recent scan_snapshots row.
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

  // 2. Idempotency — remove ONLY prior mc-demo rows. The 4 release_added
  //    rows the user wants preserved have no marker, so they survive.
  const { error: delErr, count: delCount } = await supabase
    .from('monitoring_alerts')
    .delete({ count: 'exact' })
    .eq('user_id', USER_ID)
    .like('detail', `${SEED_MARKER}%`);
  if (delErr) {
    console.warn('Prior mc-demo delete warning:', delErr.message);
  } else {
    console.log(`Removed ${delCount || 0} prior mc-demo alerts.`);
  }

  // 3. Compose the 5 new alerts. Timestamps are explicit so the feed
  //    renders them in the intended order (baseline oldest, video newest).
  //    Baseline is placed 10 days back — well outside the 1-hour artifact
  //    window — so the existing release_added rows are NOT filtered out.
  const now = Date.now();
  const base = {
    user_id:     USER_ID,
    artist_id:   ARTIST_ID,
    artist_name: ARTIST_NAME,
    scan_id:     scan.id,
    resolved:    false,
  };

  const alerts = [
    {
      ...base,
      change_type:  'baseline_established',
      severity:     'informational',
      title:        'Monitoring baseline established',
      detail:       `${SEED_MARKER} Royaltē began monitoring this catalog`,
      detected_at:  new Date(now - 10 * DAY).toISOString(),
    },
    {
      ...base,
      change_type:  'territory_gain',
      severity:     'positive',
      title:        'New regional presence detected',
      detail:       `${SEED_MARKER} Now available in France via Spotify`,
      track_name:   'Nosferatu',
      territory:    'FR',
      platform:     'spotify',
      detected_at:  new Date(now - 2 * DAY).toISOString(),
    },
    {
      ...base,
      change_type:  'isrc_added',
      severity:     'positive',
      title:        'ISRC linked',
      detail:       `${SEED_MARKER} Apple Music verified ISRC for this track`,
      track_name:   'Everything Is Over',
      platform:     'apple_music',
      detected_at:  new Date(now - 36 * HOUR).toISOString(),
    },
    {
      ...base,
      change_type:  'metadata_changed',
      severity:     'informational',
      title:        'Metadata updated',
      detail:       `${SEED_MARKER} Track metadata verified`,
      track_name:   'Nosferatu',
      platform:     'apple_music',
      detected_at:  new Date(now - 18 * HOUR).toISOString(),
    },
    {
      ...base,
      change_type:  'video_added',
      severity:     'positive',
      title:        'YouTube match verified',
      detail:       `${SEED_MARKER} Confirmed YouTube match for this track`,
      track_name:   'Knockin on Heavens Door',
      platform:     'youtube',
      detected_at:  new Date(now - 6 * HOUR).toISOString(),
    },
  ];

  const { error: insertErr } = await supabase
    .from('monitoring_alerts')
    .insert(alerts);
  if (insertErr) {
    console.error('monitoring_alerts insert failed:', insertErr);
    process.exit(1);
  }
  console.log(`Inserted ${alerts.length} mc-demo alerts.`);

  // 4. Verify — count rows with the marker.
  const { count } = await supabase
    .from('monitoring_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .like('detail', `${SEED_MARKER}%`);
  if (count !== alerts.length) {
    console.error(`Verification failed — expected ${alerts.length}, got ${count}.`);
    process.exit(1);
  }
  console.log(`Verification OK — ${count} mc-demo alerts present.`);
  console.log('Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
