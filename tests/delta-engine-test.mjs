// Delta-engine tests (Brief 002). Pure unit tests against mock snapshot
// objects + a stub Supabase client — no live DB calls.

import { computeDelta, computeScores } from '../api/_lib/delta-engine.js';

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

  // Score: baseline emits an informational alert; severity delta is 0;
  // no breakdown deltas. Score stays at 100 with full buckets.
  const updates = sb._captured.updates.scan_snapshots || [];
  assert(updates.length === 1, 'baseline: scan_snapshots score updated exactly once');
  assert(updates[0].where.id === 'scan-001', 'baseline: score update targets currentSnapshot.id');
  assert(updates[0].payload.health_score === 100, 'baseline: health_score is 100 on a clean baseline');
  assert(updates[0].payload.score_breakdown.catalog_verification === 35, 'baseline: catalog_verification bucket at max');
  assert(updates[0].payload.score_breakdown.big6_coverage === 30, 'baseline: big6_coverage bucket at max');
  assert(updates[0].payload.score_breakdown.backend_health === 20, 'baseline: backend_health bucket at max');
  assert(updates[0].payload.score_breakdown.youtube_presence === 15, 'baseline: youtube_presence bucket at max');
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
// 8. Health score floor — never below 20
// ═══════════════════════════════════════════════════════════════════════════

{
  // 20 territory losses × -8 (action_needed severity) = -160. 100 - 160 = -60.
  // Floor must clamp to 20.
  const prevTerritories = Array.from({ length: 20 }, (_, i) => `T${String(i).padStart(2, '0')}`);
  const prev = baseSnapshot('scan-prev', { territories: prevTerritories });
  const curr = baseSnapshot('scan-curr', { territories: [] });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  assert(alerts.length === 20, 'floor: 20 territory_loss alerts emitted as expected');
  const update = sb._captured.updates.scan_snapshots[0];
  assert(update.payload.health_score === 20, 'floor: health_score clamped to 20 despite -160 deduction');
  assert(update.payload.score_breakdown.big6_coverage === 0, 'floor: big6_coverage bucket floored at 0 (would be -90)');
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Health score cap — never above 100
// ═══════════════════════════════════════════════════════════════════════════

{
  // 50 territory gains × +2 = +100. Score starts at 100. Cap must clamp to 100.
  const currTerritories = Array.from({ length: 50 }, (_, i) => `G${String(i).padStart(2, '0')}`);
  const prev = baseSnapshot('scan-prev', { territories: [] });
  const curr = baseSnapshot('scan-curr', { territories: currTerritories });
  const sb = mockSupabase();
  const alerts = await computeDelta(curr, prev, sb);

  assert(alerts.length === 50, 'cap: 50 territory_gain alerts emitted as expected');
  const update = sb._captured.updates.scan_snapshots[0];
  assert(update.payload.health_score === 100, 'cap: health_score clamped to 100 (no overflow from +100 of positives)');

  // Bucket cap sanity — youtube bucket should not exceed 15 even with many video_added.
  // Use computeScores directly with synthetic alerts for the bucket-cap proof.
  const synthetic = Array.from({ length: 10 }, () => ({
    severity: 'positive',
    change_type: 'video_added',
  }));
  const { score_breakdown } = computeScores(synthetic);
  assert(score_breakdown.youtube_presence === 15, 'cap: youtube_presence bucket capped at 15 despite +30 of video_added');
}

// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═════════════════════════════════════════════');
console.log('  DELTA ENGINE VERIFIED');
console.log('═════════════════════════════════════════════');
console.log(`Total: ${count} assertions passed`);
