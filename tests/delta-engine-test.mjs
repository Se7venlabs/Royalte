// Delta-engine tests (Brief 002). Pure unit tests against mock snapshot
// objects + a stub Supabase client — no live DB calls.

import { computeDelta } from '../api/_lib/delta-engine.js';

// ── Mock Supabase ───────────────────────────────────────────────────────────
//
// Captures every `.from(table).insert(rows)` and
// `.from(table).update(payload).eq(col, val)` call so tests can assert on
// what the engine wrote.

function mockSupabase({ insertError = null, updateError = null } = {}) {
  const captured = { inserts: {}, updates: {} };
  return {
    _captured: captured,
    from(table) {
      return {
        insert(rows) {
          const list = Array.isArray(rows) ? rows : [rows];
          captured.inserts[table] = (captured.inserts[table] || []).concat(list);
          return Promise.resolve({ data: list, error: insertError });
        },
        update(payload) {
          return {
            eq(col, val) {
              captured.updates[table] = (captured.updates[table] || []).concat([
                { payload, where: { [col]: val } },
              ]);
              return Promise.resolve({ data: payload, error: updateError });
            },
          };
        },
      };
    },
  };
}

// ── Snapshot helpers ────────────────────────────────────────────────────────

const baseSnapshot = (id, canonical) => ({
  id,
  user_id: '11111111-2222-3333-4444-555555555555',
  artist_id: 'spotify-artist-xyz',
  artist_name: 'Test Artist',
  scan_number: 1,
  source: 'apple_music',
  canonical_data: canonical,
});

// ── Tiny assert harness ─────────────────────────────────────────────────────

let count = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error('✗ FAIL:', msg); process.exit(1); }
  console.log('✓', msg);
  count++;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1. Baseline (null previous) emits exactly one baseline_established alert
// ═══════════════════════════════════════════════════════════════════════════

{
  const curr = baseSnapshot('scan-001', {
    territories: ['US', 'JP', 'DE'],
    tracks: [
      { name: 'Song A', isrc: 'USRC17600001' },
      { name: 'Song B', isrc: 'USRC17600002' },
      { name: 'Song C' },
    ],
    releases: [{ title: 'Album One' }, { title: 'Album Two' }],
    youtubeMatches: [{ title: 'Song A (Official Video)' }],
  });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, null, sb);

  assert(alerts.length === 1, 'baseline: exactly one alert emitted');
  assert(alerts[0].change_type === 'baseline_established', 'baseline: change_type is baseline_established');
  assert(alerts[0].severity === 'informational', 'baseline: severity is informational');
  assert(alerts[0].title === 'Baseline established — monitoring now active', 'baseline: title is canonical string');
  assert(
    alerts[0].detail === '2 releases · 2 ISRCs · available in 3 territories · YouTube: 1 confirmed matches',
    'baseline: detail uses brief-specified format with correct counts',
  );
  assert(alerts[0].previous_scan_id === null, 'baseline: previous_scan_id is null');
  assert(alerts[0].scan_id === 'scan-001', 'baseline: scan_id matches current');
  assert(alerts[0].resolved === false, 'baseline: resolved defaults to false');

  // Brief 012a follow-up: delta engine no longer writes scan_snapshots —
  // score authority moved to persist-os-scan. Engine inserts alerts only.
  const updates = sb._captured.updates.scan_snapshots || [];
  assert(updates.length === 0, 'baseline: scan_snapshots no longer updated by delta engine');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Territory loss detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', { territories: ['US', 'JP', 'DE'] });
  const curr = baseSnapshot('scan-curr', { territories: ['US', 'DE'] });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const losses = alerts.filter((a) => a.change_type === 'territory_loss');
  assert(losses.length === 1, 'territory_loss: exactly one loss emitted');
  assert(losses[0].territory === 'JP', 'territory_loss: territory is JP');
  assert(losses[0].severity === 'action_needed', 'territory_loss: severity is action_needed');
  assert(losses[0].platform === 'apple_music', 'territory_loss: platform is apple_music');
  assert(losses[0].title.includes('JP'), 'territory_loss: title names the territory');
  assert(losses[0].previous_scan_id === 'scan-prev', 'territory_loss: previous_scan_id wired');
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Territory gain detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', { territories: ['US'] });
  const curr = baseSnapshot('scan-curr', { territories: ['US', 'BR'] });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const gains = alerts.filter((a) => a.change_type === 'territory_gain');
  assert(gains.length === 1, 'territory_gain: exactly one gain emitted');
  assert(gains[0].territory === 'BR', 'territory_gain: territory is BR');
  assert(gains[0].severity === 'positive', 'territory_gain: severity is positive');
  assert(gains[0].title.includes('BR'), 'territory_gain: title names the territory');
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. ISRC dropped detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', {
    tracks: [{ name: 'Lonely Highway', isrc: 'USRC17601234' }],
  });
  const curr = baseSnapshot('scan-curr', {
    tracks: [{ name: 'Lonely Highway' }],
  });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const drops = alerts.filter((a) => a.change_type === 'isrc_dropped');
  assert(drops.length === 1, 'isrc_dropped: exactly one drop emitted');
  assert(drops[0].track_name === 'Lonely Highway', 'isrc_dropped: track_name is set');
  assert(drops[0].isrc === 'USRC17601234', 'isrc_dropped: isrc holds the previous value');
  assert(drops[0].severity === 'action_needed', 'isrc_dropped: severity is action_needed');
  assert(drops[0].platform === 'apple_music', 'isrc_dropped: platform is apple_music');
  assert(drops[0].title.includes('Lonely Highway'), 'isrc_dropped: title names the track');
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. ISRC mismatch detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', {
    tracks: [{ name: 'Quiet Storm', isrc: 'USRC17600001' }],
  });
  const curr = baseSnapshot('scan-curr', {
    tracks: [{ name: 'Quiet Storm', isrc: 'GBAYE9300042' }],
  });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const mismatches = alerts.filter((a) => a.change_type === 'isrc_mismatch');
  assert(mismatches.length === 1, 'isrc_mismatch: exactly one mismatch emitted');
  assert(mismatches[0].track_name === 'Quiet Storm', 'isrc_mismatch: track_name is set');
  assert(mismatches[0].isrc === 'prev:USRC17600001 curr:GBAYE9300042', 'isrc_mismatch: isrc field uses prev/curr format');
  assert(mismatches[0].severity === 'monitor', 'isrc_mismatch: severity is monitor');
  assert(mismatches[0].title.includes('Quiet Storm'), 'isrc_mismatch: title names the track');
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Release removed detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', {
    releases: [{ title: 'Daylight EP' }, { title: 'Long Way Home' }],
  });
  const curr = baseSnapshot('scan-curr', {
    releases: [{ title: 'Long Way Home' }],
  });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const removed = alerts.filter((a) => a.change_type === 'release_removed');
  assert(removed.length === 1, 'release_removed: exactly one removal emitted');
  assert(removed[0].track_name === 'Daylight EP', 'release_removed: track_name holds the release title');
  assert(removed[0].severity === 'action_needed', 'release_removed: severity is action_needed');
  assert(removed[0].platform === 'apple_music', 'release_removed: platform is apple_music');
  assert(removed[0].title.includes('Daylight EP'), 'release_removed: title names the release');
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Video added detection
// ═══════════════════════════════════════════════════════════════════════════

{
  const prev = baseSnapshot('scan-prev', { youtubeMatches: [] });
  const curr = baseSnapshot('scan-curr', {
    youtubeMatches: [{ title: 'Quiet Storm (Official Video)' }],
  });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  const added = alerts.filter((a) => a.change_type === 'video_added');
  assert(added.length === 1, 'video_added: exactly one addition emitted');
  assert(added[0].track_name === 'Quiet Storm (Official Video)', 'video_added: track_name holds the video title');
  assert(added[0].platform === 'youtube', 'video_added: platform is youtube');
  assert(added[0].severity === 'positive', 'video_added: severity is positive');
}

// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═════════════════════════════════════════════');
console.log('  DELTA ENGINE VERIFIED');
console.log('═════════════════════════════════════════════');
console.log(`Total: ${count} assertions passed`);
