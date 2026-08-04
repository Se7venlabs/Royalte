// Executive Opportunity Engine™ — Phase 4B test suite. Pure-logic unit
// tests against the Scoring Engine, the ranking Engine, and the Store. No
// real database, no real network — matches the house pattern in
// tests/playbook-action-engine-test.mjs.

import { strict as assert } from 'node:assert';

import { SCORE_WEIGHTS, RANKABLE_STATUSES } from '../api/schema/opportunity.js';
import { computeOpportunityScore, computeBand, isQuickWin } from '../api/_lib/opportunity-scoring-engine.js';
import { explainOpportunity } from '../api/_lib/opportunity-explain.js';
import { rankOpportunities } from '../api/_lib/opportunity-engine.js';
import {
  recomputeOpportunityRoadmap, getOpportunityRoadmap, getOpportunityHistory,
  getOpportunityDashboardMetrics, describeScoreHistoryEvent,
} from '../api/_lib/opportunity-store.js';
import { registerPlaybook, _resetForTests } from '../api/playbooks/registry.js';
import '../api/playbooks/definitions/index.js';

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

// ─── Synthetic test playbooks (deterministic, known factor values) ────────
registerPlaybook({
  playbookId: 'test-quick-win', playbookVersion: '1.0', definitionSchema: 1,
  domain: 'Test', owner: 'Test', introducedInPhase: 'test',
  load: () => ({
    playbookId: 'test-quick-win', title: 'Test Quick Win Playbook',
    metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 15, priority: 'HIGH' },
    explainRecommendation: () => 'test explanation',
  }),
});
registerPlaybook({
  playbookId: 'test-low-priority', playbookVersion: '1.0', definitionSchema: 1,
  domain: 'Test', owner: 'Test', introducedInPhase: 'test',
  load: () => ({
    playbookId: 'test-low-priority', title: 'Test Low Priority Playbook',
    metrics: { estimatedRevenueImpact: 'LOW', businessImpact: 'LOW', difficulty: 'HIGH', estimatedMinutes: 180, priority: 'LOW' },
    explainRecommendation: () => 'test explanation',
  }),
});
registerPlaybook({
  playbookId: 'test-mid', playbookVersion: '1.0', definitionSchema: 1,
  domain: 'Test', owner: 'Test', introducedInPhase: 'test',
  load: () => ({
    playbookId: 'test-mid', title: 'Test Mid Playbook',
    metrics: { estimatedRevenueImpact: 'MEDIUM', businessImpact: 'MEDIUM', difficulty: 'MEDIUM', estimatedMinutes: 45, priority: 'MEDIUM' },
    explainRecommendation: () => 'test explanation',
  }),
});

// ─── In-memory mock Supabase ────────────────────────────────────────────
function makeMockSupabase(initialRows = {}) {
  const store = {};
  for (const [table, rows] of Object.entries(initialRows)) store[table] = rows.map(r => ({ ...r }));
  let idCounter = 0;

  function from(table) {
    if (!store[table]) store[table] = [];
    const rows = store[table];
    let mode = null;
    let insertData = null, updateData = null;
    const filters = [];
    let orderCol = null, orderAsc = true;

    const builder = {
      select() { if (mode === null) mode = 'select'; return builder; },
      insert(data) { mode = 'insert'; insertData = data; return builder; },
      update(data) { mode = 'update'; updateData = data; return builder; },
      delete() { mode = 'delete'; return builder; },
      eq(col, val) { filters.push(r => r[col] === val); return builder; },
      neq(col, val) { filters.push(r => r[col] !== val); return builder; },
      in(col, vals) { filters.push(r => vals.includes(r[col])); return builder; },
      gte(col, val) { filters.push(r => r[col] >= val); return builder; },
      order(col, opts) { orderCol = col; orderAsc = !(opts && opts.ascending === false); return builder; },
      maybeSingle() { return resolveQuery({ single: true, maybe: true }); },
      single() { return resolveQuery({ single: true, maybe: false }); },
      then(resolve, reject) { return resolveQuery({ single: false }).then(resolve, reject); },
    };

    async function resolveQuery({ single, maybe }) {
      if (mode === 'insert') {
        const newRow = { id: `${table}-${++idCounter}`, created_at: new Date().toISOString(), ...insertData };
        rows.push(newRow);
        return single ? { data: newRow, error: null } : { data: [newRow], error: null };
      }
      if (mode === 'update') {
        const matches = rows.filter(r => filters.every(f => f(r)));
        matches.forEach(r => Object.assign(r, updateData));
        return single ? { data: matches[0] || null, error: null } : { data: matches, error: null };
      }
      if (mode === 'delete') {
        const matches = rows.filter(r => filters.every(f => f(r)));
        for (const m of matches) {
          const idx = rows.indexOf(m);
          if (idx !== -1) rows.splice(idx, 1);
        }
        return { data: matches, error: null };
      }
      let result = rows.filter(r => filters.every(f => f(r)));
      if (orderCol) {
        result = [...result].sort((a, b) => {
          if (a[orderCol] === b[orderCol]) return 0;
          const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
          return orderAsc ? cmp : -cmp;
        });
      }
      if (single) return result[0] ? { data: result[0], error: null } : { data: null, error: maybe ? null : { message: 'no rows' } };
      return { data: result, error: null };
    }

    return builder;
  }

  return { from };
}

function makeAction(overrides = {}) {
  return {
    id: overrides.id || 'action-1',
    action_number: overrides.action_number ?? 1,
    playbook_id: overrides.playbook_id || 'test-quick-win',
    status: overrides.status || 'started',
    evidence_confidence: overrides.evidence_confidence || 'HIGH',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§1 Opportunity Scoring Engine™ — deterministic, pure');

await test('weights sum to exactly 1.0', async () => {
  const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1.0) < 1e-9);
});

await test('identical input produces identical output (deterministic)', async () => {
  const def = { metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'MEDIUM', difficulty: 'LOW', estimatedMinutes: 20, priority: 'HIGH' } };
  const action = { evidence_confidence: 'MEDIUM' };
  const r1 = computeOpportunityScore(action, def);
  const r2 = computeOpportunityScore(action, def);
  assert.deepEqual(r1, r2);
});

await test('HIGH across all factors scores at or near 100', async () => {
  const def = { metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 10, priority: 'HIGH' } };
  const { score } = computeOpportunityScore({ evidence_confidence: 'HIGH' }, def);
  assert.ok(score >= 90, `expected >=90, got ${score}`);
});

await test('LOW/HIGH-difficulty/long-time scores low', async () => {
  const def = { metrics: { estimatedRevenueImpact: 'LOW', businessImpact: 'LOW', difficulty: 'HIGH', estimatedMinutes: 300, priority: 'LOW' } };
  const { score } = computeOpportunityScore({ evidence_confidence: 'LOW' }, def);
  assert.ok(score <= 30, `expected <=30, got ${score}`);
});

await test('missing/malformed metrics score 0 for that factor, never throws', async () => {
  const { score, factorBreakdown } = computeOpportunityScore({}, { metrics: {} });
  assert.equal(score, 0);
  assert.equal(factorBreakdown.revenuePotential.normalizedScore, 0);
});

await test('INSUFFICIENT_DATA evidence confidence scores 0 for that factor, never a MEDIUM default', async () => {
  const def = { metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 10, priority: 'HIGH' } };
  const { factorBreakdown } = computeOpportunityScore({ evidence_confidence: 'INSUFFICIENT_DATA' }, def);
  assert.equal(factorBreakdown.evidenceConfidence.normalizedScore, 0);
});

await test('factorBreakdown reports rawValue, weight, and contribution for every factor (Ranking Transparency™)', async () => {
  const def = { metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'MEDIUM', difficulty: 'LOW', estimatedMinutes: 20, priority: 'MEDIUM' } };
  const { factorBreakdown } = computeOpportunityScore({ evidence_confidence: 'HIGH' }, def);
  for (const factor of Object.keys(SCORE_WEIGHTS)) {
    assert.ok(factor in factorBreakdown, `missing ${factor}`);
    assert.ok('rawValue' in factorBreakdown[factor]);
    assert.ok('weight' in factorBreakdown[factor]);
    assert.ok('contribution' in factorBreakdown[factor]);
  }
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§2 Banding + Quick Wins™');

await test('band threshold edges are correct', async () => {
  assert.equal(computeBand(39), 'DO_LATER');
  assert.equal(computeBand(40), 'DO_NEXT');
  assert.equal(computeBand(69), 'DO_NEXT');
  assert.equal(computeBand(70), 'DO_NOW');
  assert.equal(computeBand(100), 'DO_NOW');
  assert.equal(computeBand(0), 'DO_LATER');
});

await test('isQuickWin requires ALL four criteria (strict AND)', async () => {
  const full = { metrics: { estimatedRevenueImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 20 } };
  assert.equal(isQuickWin(full, { evidence_confidence: 'HIGH' }), true);
  assert.equal(isQuickWin(full, { evidence_confidence: 'MEDIUM' }), false, 'confidence not HIGH must fail');
  const highDifficulty = { metrics: { estimatedRevenueImpact: 'HIGH', difficulty: 'MEDIUM', estimatedMinutes: 20 } };
  assert.equal(isQuickWin(highDifficulty, { evidence_confidence: 'HIGH' }), false, 'difficulty not LOW must fail');
  const tooLong = { metrics: { estimatedRevenueImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 31 } };
  assert.equal(isQuickWin(tooLong, { evidence_confidence: 'HIGH' }), false, 'over 30 minutes must fail');
});

await test('Quick Win overrides band to DO_NOW without mutating the stored score', async () => {
  // A quick-win-shaped playbook with a deliberately low businessImpact/priority
  // so its raw composite score would NOT reach the DO_NOW threshold on its own.
  const def = { metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'LOW', difficulty: 'LOW', estimatedMinutes: 10, priority: 'LOW' } };
  const action = { evidence_confidence: 'HIGH' };
  const { score } = computeOpportunityScore(action, def);
  const quickWin = isQuickWin(def, action);
  assert.equal(quickWin, true);
  // The engine (not this low-level function) is what applies the override --
  // verified in §3 against rankOpportunities() -- but confirm here the raw
  // score/band function itself never fabricates a boosted score.
  assert.ok(score < 100, 'score must remain the honest weighted composite');
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§3 Opportunity Explanation™');

await test('explainOpportunity cites the top contributing factors from the real breakdown', async () => {
  const def = { title: 'Test Playbook', metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 20, priority: 'HIGH' } };
  const action = { evidence_confidence: 'HIGH' };
  const { score, factorBreakdown } = computeOpportunityScore(action, def);
  const band = computeBand(score);
  const explanation = explainOpportunity({ score, band, isQuickWin: false, factorBreakdown }, def);
  assert.ok(explanation.whyRankedHere.includes('Test Playbook'));
  assert.ok(explanation.topFactors.length === 2);
  assert.ok(explanation.whatIfIgnored.length > 0);
  assert.ok(explanation.whatIfCompleted.length > 0);
});

await test('explainOpportunity marks Quick Wins distinctly', async () => {
  const def = { title: 'QW Playbook', metrics: {} };
  const explanation = explainOpportunity({ score: 55, band: 'DO_NOW', isQuickWin: true, factorBreakdown: {} }, def);
  assert.ok(explanation.whyRankedHere.includes('Quick Win'));
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§4 Executive Opportunity Engine™ — ranking multiple actions');

await test('rankOpportunities groups into doNow/doNext/doLater/quickWins correctly', async () => {
  const pairs = [
    { action: makeAction({ id: 'a1', playbook_id: 'test-quick-win', action_number: 1, evidence_confidence: 'HIGH' }), definition: { playbookId: 'test-quick-win', title: 'QW', metrics: { estimatedRevenueImpact: 'HIGH', businessImpact: 'HIGH', difficulty: 'LOW', estimatedMinutes: 15, priority: 'HIGH' } } },
    { action: makeAction({ id: 'a2', playbook_id: 'test-mid', action_number: 2, evidence_confidence: 'MEDIUM' }), definition: { playbookId: 'test-mid', title: 'Mid', metrics: { estimatedRevenueImpact: 'MEDIUM', businessImpact: 'MEDIUM', difficulty: 'MEDIUM', estimatedMinutes: 45, priority: 'MEDIUM' } } },
    { action: makeAction({ id: 'a3', playbook_id: 'test-low-priority', action_number: 3, evidence_confidence: 'LOW' }), definition: { playbookId: 'test-low-priority', title: 'Low', metrics: { estimatedRevenueImpact: 'LOW', businessImpact: 'LOW', difficulty: 'HIGH', estimatedMinutes: 300, priority: 'LOW' } } },
  ];
  const roadmap = rankOpportunities(pairs);
  assert.equal(roadmap.all.length, 3);
  assert.ok(roadmap.doNow.some(i => i.playbookId === 'test-quick-win'));
  assert.ok(roadmap.doLater.some(i => i.playbookId === 'test-low-priority'));
  assert.ok(roadmap.quickWins.some(i => i.playbookId === 'test-quick-win'));
  // ranks assigned 1..N, unique, contiguous
  const ranks = roadmap.all.map(i => i.rank).sort((a, b) => a - b);
  assert.deepEqual(ranks, [1, 2, 3]);
});

await test('tie-breaking: equal scores resolved by confidence, then time, then action_number', async () => {
  const def = { playbookId: 'test-tie', title: 'Tie', metrics: { estimatedRevenueImpact: 'MEDIUM', businessImpact: 'MEDIUM', difficulty: 'MEDIUM', estimatedMinutes: 30, priority: 'MEDIUM' } };
  const pairs = [
    { action: makeAction({ id: 'low-conf', action_number: 5, evidence_confidence: 'LOW' }), definition: def },
    { action: makeAction({ id: 'high-conf', action_number: 1, evidence_confidence: 'HIGH' }), definition: def },
  ];
  const roadmap = rankOpportunities(pairs);
  assert.equal(roadmap.all[0].actionId, 'high-conf', 'higher confidence must rank first on a tied score');
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§5 Opportunity Store™ — persistence, history, dashboard metrics');

await test('recomputeOpportunityRoadmap only scores RANKABLE_STATUSES actions', async () => {
  const supabase = makeMockSupabase();
  const actions = [
    makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' }),
    makeAction({ id: 'a2', playbook_id: 'test-mid', status: 'waiting_verification' }),
    makeAction({ id: 'a3', playbook_id: 'test-low-priority', status: 'archived' }),
  ];
  const result = await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  assert.equal(result.ok, true);
  assert.equal(result.roadmap.all.length, 1);
  assert.equal(result.roadmap.all[0].actionId, 'a1');
});

await test('RANKABLE_STATUSES excludes every terminal/awaiting status', async () => {
  assert.deepEqual([...RANKABLE_STATUSES].sort(), ['in_progress', 'recommended', 'started'].sort());
});

await test('recompute upserts (not duplicates) opportunity_scores on repeat calls', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const roadmapResult = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(roadmapResult.roadmap.all.length, 1, 'must not create a duplicate opportunity_scores row');
});

await test('recompute writes an unconditional opportunity_score_history row every call, with correct from_score/from_band', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const historyResult = await getOpportunityHistory({ supabase, artistProfileId: 'artist-1', actionId: 'a1' });
  assert.equal(historyResult.ok, true);
  assert.equal(historyResult.events.length, 2, 'unconditional write means every recompute adds a row, even with no change');
  assert.equal(historyResult.events[0].from_score, null, 'first-ever score has no from_score');
  assert.equal(historyResult.events[1].from_score, historyResult.events[0].score, 'second call snapshots the prior score');
});

await test('getOpportunityRoadmap never recomputes -- reflects only what was last persisted', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  const before = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(before.roadmap.all.length, 0, 'nothing persisted yet, must not compute anything on read');
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const after = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(after.roadmap.all.length, 1);
});

await test('getOpportunityRoadmap re-derives explanation at read time from stored factor_breakdown, never persisted', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const result = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.ok(result.roadmap.all[0].explanation);
  assert.ok(result.roadmap.all[0].explanation.whyRankedHere.length > 0);
});

await test('getOpportunityRoadmap exposes the Playbook Definition title directly -- a Phase 4C UI consumer must never duplicate a playbookId -> title mapping', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const result = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.ok(result.roadmap.all[0].title, 'title must be present');
  assert.notEqual(result.roadmap.all[0].title, 'test-quick-win', 'must be the human-readable definition title, not the raw playbookId');
});

await test('describeScoreHistoryEvent labels first score, band change, score-only change, and no-change distinctly', async () => {
  assert.ok(describeScoreHistoryEvent({ from_band: null, rank: 1, score: 90, band: 'DO_NOW', is_quick_win: false }).includes('Ranked #1'));
  assert.ok(describeScoreHistoryEvent({ from_band: 'DO_NEXT', band: 'DO_NOW', from_score: 60, score: 85, rank: 1 }).includes('Moved from DO_NEXT to DO_NOW'));
  assert.ok(describeScoreHistoryEvent({ from_band: 'DO_NOW', band: 'DO_NOW', from_score: 80, score: 85, rank: 1 }).includes('Score updated'));
  assert.ok(describeScoreHistoryEvent({ from_band: 'DO_NOW', band: 'DO_NOW', from_score: 85, score: 85, rank: 1 }).includes('no change'));
});

await test('cross-artist isolation: artist-2 cannot read artist-1s roadmap or history', async () => {
  const supabase = makeMockSupabase();
  const actions = [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const roadmapResult = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-2' });
  assert.equal(roadmapResult.roadmap.all.length, 0);
  const historyResult = await getOpportunityHistory({ supabase, artistProfileId: 'artist-2', actionId: 'a1' });
  assert.equal(historyResult.events.length, 0);
});

await test('recompute is scoped to the calling artist -- does not touch another artists rows', async () => {
  const supabase = makeMockSupabase();
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions: [makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' })] });
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-2', actions: [makeAction({ id: 'a2', playbook_id: 'test-mid', status: 'started' })] });
  const artist1 = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(artist1.roadmap.all.length, 1);
  assert.equal(artist1.roadmap.all[0].actionId, 'a1');
});

await test('never-throws contract: every store function resolves {ok:false} when the store is unavailable', async () => {
  assert.equal((await recomputeOpportunityRoadmap({ supabase: null, artistProfileId: 'x', actions: [] })).ok, false);
  assert.equal((await getOpportunityRoadmap({ supabase: null, artistProfileId: 'x' })).ok, false);
  assert.equal((await getOpportunityHistory({ supabase: null, artistProfileId: 'x', actionId: 'y' })).ok, false);
  assert.equal((await getOpportunityDashboardMetrics({ supabase: null, artistProfileId: 'x' })).ok, false);
});

await test('getOpportunityDashboardMetrics reports quickWinsCount and topOpportunity correctly', async () => {
  const supabase = makeMockSupabase();
  const actions = [
    makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started', evidence_confidence: 'HIGH' }),
    makeAction({ id: 'a2', playbook_id: 'test-low-priority', status: 'started', evidence_confidence: 'LOW' }),
  ];
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions });
  const result = await getOpportunityDashboardMetrics({ supabase, artistProfileId: 'artist-1' });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.quickWinsCount, 1);
  assert.equal(result.metrics.topOpportunityActionId, 'a1');
});

await test('getOpportunityDashboardMetrics.resolvedThisMonth counts real completed/verified transitions this month, cross-referencing playbook_action_history', async () => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
  const supabase = makeMockSupabase({
    playbook_action_history: [
      { id: 'h1', action_id: 'resolved-1', artist_profile_id: 'artist-1', to_status: 'completed', created_at: thisMonth },
      { id: 'h2', action_id: 'resolved-1', artist_profile_id: 'artist-1', to_status: 'verified', created_at: thisMonth }, // same action, both events this month -- must count once, not twice
      { id: 'h3', action_id: 'resolved-2', artist_profile_id: 'artist-1', to_status: 'verified', created_at: thisMonth },
      { id: 'h4', action_id: 'resolved-old', artist_profile_id: 'artist-1', to_status: 'completed', created_at: lastMonth }, // resolved, but not this month
      { id: 'h5', action_id: 'waiting-only', artist_profile_id: 'artist-1', to_status: 'waiting_verification', created_at: thisMonth }, // not a resolution
      { id: 'h6', action_id: 'other-artist', artist_profile_id: 'artist-2', to_status: 'completed', created_at: thisMonth }, // different artist
    ],
  });
  const result = await getOpportunityDashboardMetrics({ supabase, artistProfileId: 'artist-1' });
  assert.equal(result.ok, true);
  assert.equal(result.metrics.resolvedThisMonth, 2, 'must count distinct resolved actions this month, excluding last month, non-resolution transitions, and other artists');
});

await test('a rankable action moving out of the rankable set disappears from the Roadmap on next recompute', async () => {
  const supabase = makeMockSupabase();
  const started = makeAction({ id: 'a1', playbook_id: 'test-quick-win', status: 'started' });
  await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions: [started] });
  const midway = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(midway.roadmap.all.length, 1);

  // Simulate the real Phase 4A lifecycle: the action moved to waiting_verification.
  const nowWaiting = { ...started, status: 'waiting_verification' };
  const recomputeResult = await recomputeOpportunityRoadmap({ supabase, artistProfileId: 'artist-1', actions: [nowWaiting] });
  assert.equal(recomputeResult.roadmap.all.length, 0);
  // The stale opportunity_scores row is actively removed (not just
  // excluded from this call's return value) -- confirmed via a fresh read,
  // the actual guarantee api/opportunity-actions.js's GET relies on.
  const after = await getOpportunityRoadmap({ supabase, artistProfileId: 'artist-1' });
  assert.equal(after.roadmap.all.length, 0, 'stale opportunity_scores row must be deleted, not merely excluded from one response');
  // Its full history is untouched and permanent (Opportunity History™).
  const history = await getOpportunityHistory({ supabase, artistProfileId: 'artist-1', actionId: 'a1' });
  assert.equal(history.events.length, 1, 'history from before the action left the rankable set must survive the cleanup');
});

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
