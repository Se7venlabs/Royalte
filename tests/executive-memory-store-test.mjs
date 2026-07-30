// ATHENA™ Phase 3C — Executive Memory™ Store test suite. Pure-logic unit
// tests against an in-memory mock Supabase query builder (supporting
// insert/update/select chains) — no real database. Matches the house
// pattern in tests/executive-phase3b-services-test.mjs.

import { strict as assert } from 'node:assert';
import {
  createMemoryItem, confirmMemoryItem, correctMemoryItem,
  supersedeMemoryItem, expireMemoryItem,
} from '../api/_lib/executive-memory-store.js';
import { buildExecutiveMemory } from '../api/_lib/executive-memory.js';
import { subscribe, _resetForTests } from '../api/athena/bus/executive-intelligence-bus.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  })();
}

// ─── In-memory mock Supabase supporting insert/update/select chains ───────
//
// Table-aware: buildExecutiveMemory() reads both executive_memory_items
// (this phase) and executive_brief_archive (Phase 3B, via listBriefs) --
// a single shared row array would let one table's fixtures leak into the
// other's queries. `initialRows` may be a plain array (assumed to be
// executive_memory_items, matching every store-level test above) or a
// { tableName: rows[] } map for tests that need both tables populated.

function makeMockSupabase(initialRows = []) {
  const byTable = Array.isArray(initialRows)
    ? { executive_memory_items: initialRows }
    : initialRows;
  const store = {};
  for (const [table, tableRows] of Object.entries(byTable)) {
    store[table] = tableRows.map(r => ({ ...r }));
  }
  let idCounter = (store.executive_memory_items || []).length;

  function from(table) {
    if (!store[table]) store[table] = [];
    const rows = store[table];
    let mode = null; // 'select' | 'insert' | 'update'
    let insertData = null;
    let updateData = null;
    let limitN = null;
    const filters = [];
    let orderCol = null, orderAsc = true;

    const builder = {
      select() { if (mode === null) mode = 'select'; return builder; },
      insert(data) { mode = 'insert'; insertData = data; return builder; },
      update(data) { mode = 'update'; updateData = data; return builder; },
      eq(col, val) { filters.push(r => r[col] === val); return builder; },
      order(col, opts) { orderCol = col; orderAsc = !(opts && opts.ascending === false); return builder; },
      limit(n) { limitN = n; return builder; },
      maybeSingle() { return resolveQuery({ single: true, maybe: true }); },
      single() { return resolveQuery({ single: true, maybe: false }); },
      then(resolve, reject) { return resolveQuery({ single: false }).then(resolve, reject); },
    };

    async function resolveQuery({ single, maybe }) {
      if (mode === 'insert') {
        const newRow = {
          id: 'mem-' + (++idCounter),
          created_at: new Date().toISOString(),
          last_confirmed_at: null,
          superseded_by: null,
          status: 'active',
          confidence: 'MEDIUM',
          evidence_reference: null,
          ...insertData,
        };
        rows.push(newRow);
        return single ? { data: newRow, error: null } : { data: [newRow], error: null };
      }
      if (mode === 'update') {
        const matches = rows.filter(r => filters.every(f => f(r)));
        if (matches.length === 0) {
          return single ? { data: null, error: maybe ? null : { message: 'no rows' } } : { data: [], error: null };
        }
        matches.forEach(r => Object.assign(r, updateData));
        return single ? { data: matches[0], error: null } : { data: matches, error: null };
      }
      // select
      let result = rows.filter(r => filters.every(f => f(r)));
      if (orderCol) {
        result = [...result].sort((a, b) => {
          if (a[orderCol] === b[orderCol]) return 0;
          const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
          return orderAsc ? cmp : -cmp;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);
      if (single) {
        if (result[0]) return { data: result[0], error: null };
        return { data: null, error: maybe ? null : { message: 'no rows' } };
      }
      return { data: result, error: null };
    }

    return builder;
  }

  return { from, _rows: (table = 'executive_memory_items') => store[table] || [] };
}

// ─── Lifecycle: create ──────────────────────────────────────────────────

console.log('\n§1 createMemoryItem');

await test('creates a valid memory item and returns it', async () => {
  const supabase = makeMockSupabase();
  const result = await createMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryType: 'goal',
    source: 'User Confirmed', statement: 'Release EP by Q4',
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.statement, 'Release EP by Q4');
  assert.equal(result.item.status, 'active');
});

await test('rejects an invalid source', async () => {
  const supabase = makeMockSupabase();
  const result = await createMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryType: 'goal',
    source: 'Not A Real Source', statement: 'x',
  });
  assert.equal(result.ok, false);
});

await test('Memory Promotion™: refuses to persist an ATHENA Recommendation without explicit user confirmation', async () => {
  const supabase = makeMockSupabase();
  const result = await createMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryType: 'recommendation',
    source: 'ATHENA Recommendation', statement: 'Register with ASCAP',
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /Memory Promotion/);
  assert.equal(supabase._rows().length, 0, 'no row must be written');
});

await test('Memory Promotion™: persists an ATHENA Recommendation once explicitly promoted by the user', async () => {
  const supabase = makeMockSupabase();
  const result = await createMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryType: 'recommendation',
    source: 'ATHENA Recommendation', statement: 'Register with ASCAP',
    promotedBy: 'user_confirmed',
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.source, 'ATHENA Recommendation');
});

// ─── Lifecycle: confirm ─────────────────────────────────────────────────

console.log('\n§2 confirmMemoryItem');

await test('sets last_confirmed_at on an owned, active item', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', last_confirmed_at: null, memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await confirmMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1' });
  assert.equal(result.ok, true);
  assert.ok(result.item.last_confirmed_at);
});

await test('fails when the item is not owned by the caller', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await confirmMemoryItem({ supabase, artistProfileId: 'artist-2', memoryItemId: 'mem-1' });
  assert.equal(result.ok, false);
});

await test('fails on a non-active (already superseded/expired) item', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'expired', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await confirmMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1' });
  assert.equal(result.ok, false);
});

// ─── Lifecycle: supersede / correct ─────────────────────────────────────

console.log('\n§3 supersedeMemoryItem / correctMemoryItem');

await test('supersede marks the old row superseded and creates a new active row', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'Derived Intelligence', statement: 'Old statement' }]);
  const result = await supersedeMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1',
    source: 'Canonical Evidence', statement: 'New statement, evidence-backed',
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.statement, 'New statement, evidence-backed');
  assert.equal(result.item.status, 'active');
  assert.equal(result.supersededItem.status, 'superseded');
  assert.equal(result.supersededItem.superseded_by, result.item.id);
});

await test('correctMemoryItem always writes the replacement as User Confirmed, regardless of the original source', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'ATHENA Recommendation', statement: 'Wrong statement' }]);
  const result = await correctMemoryItem({
    supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1', statement: 'Corrected by artist',
  });
  assert.equal(result.ok, true);
  assert.equal(result.item.source, 'User Confirmed');
  assert.equal(result.item.statement, 'Corrected by artist');
});

await test('supersede fails when the target item is not owned by the caller (cross-user isolation)', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await supersedeMemoryItem({
    supabase, artistProfileId: 'artist-2', memoryItemId: 'mem-1',
    source: 'User Confirmed', statement: 'attempted takeover',
  });
  assert.equal(result.ok, false);
  assert.equal(supabase._rows().length, 1, 'no new row must be written for an unowned target');
});

// ─── Lifecycle: expire ──────────────────────────────────────────────────

console.log('\n§4 expireMemoryItem');

await test('marks an owned, active item expired in place, no replacement row created', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await expireMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1' });
  assert.equal(result.ok, true);
  assert.equal(result.item.status, 'expired');
  assert.equal(supabase._rows().length, 1, 'expire must not create a new row');
});

await test('fails when the item is not owned by the caller', async () => {
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  const result = await expireMemoryItem({ supabase, artistProfileId: 'artist-2', memoryItemId: 'mem-1' });
  assert.equal(result.ok, false);
});

// ─── Executive Intelligence Bus™ integration ────────────────────────────

console.log('\n§5 Executive Intelligence Bus™ — publishing');

await test('create publishes executive_memory.created', async () => {
  _resetForTests();
  const events = [];
  subscribe('executive_memory.created', (payload) => events.push(payload));
  const supabase = makeMockSupabase();
  await createMemoryItem({ supabase, artistProfileId: 'artist-1', memoryType: 'goal', source: 'User Confirmed', statement: 'x' });
  assert.equal(events.length, 1);
  assert.equal(events[0].artistProfileId, 'artist-1');
});

await test('confirm publishes executive_memory.confirmed', async () => {
  _resetForTests();
  const events = [];
  subscribe('executive_memory.confirmed', (payload) => events.push(payload));
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  await confirmMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1' });
  assert.equal(events.length, 1);
});

await test('correct publishes both executive_memory.superseded and executive_memory.corrected -- both are true simultaneously', async () => {
  _resetForTests();
  const supersededEvents = [];
  const correctedEvents = [];
  subscribe('executive_memory.superseded', (p) => supersededEvents.push(p));
  subscribe('executive_memory.corrected', (p) => correctedEvents.push(p));
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'Derived Intelligence', statement: 'x' }]);
  await correctMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1', statement: 'y' });
  assert.equal(supersededEvents.length, 1);
  assert.equal(correctedEvents.length, 1);
});

await test('expire publishes executive_memory.expired', async () => {
  _resetForTests();
  const events = [];
  subscribe('executive_memory.expired', (p) => events.push(p));
  const supabase = makeMockSupabase([{ id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'x' }]);
  await expireMemoryItem({ supabase, artistProfileId: 'artist-1', memoryItemId: 'mem-1' });
  assert.equal(events.length, 1);
});

await test('a throwing subscriber never breaks the publisher -- the write already succeeded', async () => {
  _resetForTests();
  subscribe('executive_memory.created', () => { throw new Error('subscriber exploded'); });
  const supabase = makeMockSupabase();
  const result = await createMemoryItem({ supabase, artistProfileId: 'artist-1', memoryType: 'goal', source: 'User Confirmed', statement: 'x' });
  assert.equal(result.ok, true, 'the create must still succeed despite the broken subscriber');
});

// ─── buildExecutiveMemory integration (goals/dismissedActions/milestones now real) ──

console.log('\n§6 buildExecutiveMemory — real persisted items, not permanently unavailable');

await test('goals/dismissedActions/milestones are available:true even with zero items (capability exists, just empty)', async () => {
  const supabase = makeMockSupabase([]);
  const memory = await buildExecutiveMemory(supabase, 'artist-1', {});
  assert.equal(memory.goals.available, true);
  assert.deepEqual(memory.goals.items, []);
  assert.equal(memory.dismissedActions.available, true);
  assert.equal(memory.milestones.available, true);
});

await test('goals/dismissedActions/milestones surface real stored items, grouped by memory_type', async () => {
  const supabase = makeMockSupabase([
    { id: 'mem-1', artist_profile_id: 'artist-1', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'Release EP', created_at: '2026-07-01T00:00:00.000Z' },
    { id: 'mem-2', artist_profile_id: 'artist-1', status: 'active', memory_type: 'milestone', source: 'Canonical Evidence', statement: '10k streams', created_at: '2026-07-02T00:00:00.000Z' },
    { id: 'mem-3', artist_profile_id: 'artist-1', status: 'superseded', memory_type: 'goal', source: 'User Confirmed', statement: 'Old goal', created_at: '2026-06-01T00:00:00.000Z' },
    { id: 'mem-4', artist_profile_id: 'artist-2', status: 'active', memory_type: 'goal', source: 'User Confirmed', statement: 'Other artist goal', created_at: '2026-07-03T00:00:00.000Z' },
  ]);
  const memory = await buildExecutiveMemory(supabase, 'artist-1', {});
  assert.equal(memory.goals.items.length, 1, 'only artist-1\'s active goal, not the superseded one or another artist\'s');
  assert.equal(memory.goals.items[0].statement, 'Release EP');
  assert.equal(memory.milestones.items.length, 1);
  assert.equal(memory.allItems.length, 2, 'both active artist-1 items, cross-user and superseded excluded');
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
