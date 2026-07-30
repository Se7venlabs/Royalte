// ATHENA™ Phase 3B — Executive History™/Timeline™/Memory™/Comparison™/
// Trend Detection service test suite. Pure-logic unit tests against an
// in-memory mock Supabase query builder — no real database.

import { strict as assert } from 'node:assert';
import {
  getBriefById, getLatestBrief, listBriefs, getBriefsForComparison,
} from '../api/_lib/executive-brief-archive-reader.js';
import { compareExecutiveBriefs } from '../api/_lib/executive-comparison.js';
import { detectDomainTrends } from '../api/_lib/executive-trend-detection.js';
import { getExecutiveHistory } from '../api/_lib/executive-history.js';
import { buildExecutiveTimeline } from '../api/_lib/executive-timeline.js';
import { buildExecutiveMemory } from '../api/_lib/executive-memory.js';
import { getExecutiveHistorySummary } from '../api/_lib/executive-history-summary.js';

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

// ─── In-memory mock Supabase query builder ─────────────────────────────────

function makeMockSupabase(rows) {
  return {
    from(_table) {
      const filters = [];
      let orderCol = null;
      let orderAsc = true;
      let limitN = null;
      let countMode = false;

      const builder = {
        select(_cols, opts) {
          if (opts && opts.count === 'exact') countMode = true;
          return builder;
        },
        eq(col, val) { filters.push(r => r[col] === val); return builder; },
        in(col, vals) { filters.push(r => vals.includes(r[col])); return builder; },
        gte(col, val) { filters.push(r => r[col] >= val); return builder; },
        lte(col, val) { filters.push(r => r[col] <= val); return builder; },
        order(col, opts) { orderCol = col; orderAsc = !!(opts && opts.ascending); return builder; },
        limit(n) { limitN = n; return builder; },
        maybeSingle() {
          let result = rows.filter(r => filters.every(f => f(r)));
          if (orderCol) {
            result = [...result].sort((a, b) => {
              if (a[orderCol] === b[orderCol]) return 0;
              const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
              return orderAsc ? cmp : -cmp;
            });
          }
          return Promise.resolve({ data: result[0] || null, error: null });
        },
        then(resolve) {
          let result = rows.filter(r => filters.every(f => f(r)));
          if (countMode) {
            resolve({ data: null, count: result.length, error: null });
            return;
          }
          if (orderCol) {
            result = [...result].sort((a, b) => {
              if (a[orderCol] === b[orderCol]) return 0;
              const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
              return orderAsc ? cmp : -cmp;
            });
          }
          if (limitN != null) result = result.slice(0, limitN);
          resolve({ data: result, error: null });
        },
      };
      return builder;
    },
  };
}

function makeRow(overrides = {}) {
  const base = {
    id: 'row-' + Math.random().toString(36).slice(2),
    executive_brief_id: 'EB-2026-07-24-000001',
    artist_profile_id: 'artist-1',
    scan_id: 'scan-1',
    generated_at: '2026-07-24T10:00:00.000Z',
    critical_issue_count: 0,
    risk_count: 0,
    opportunity_count: 0,
    recommendation_count: 0,
    executive_intelligence_object: {
      executiveBriefing: { overallLevel: 'GOOD', riskLevel: 'LOW' },
      risks: [],
      opportunities: [],
      executiveMemorySummary: { historicalChanges: [] },
    },
  };
  return { ...base, ...overrides };
}

// ─── Reader ─────────────────────────────────────────────────────────────

console.log('\n§1 Archive reader');

await test('getBriefById returns only the matching, artist-owned row', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-A', artist_profile_id: 'artist-1' }),
    makeRow({ executive_brief_id: 'EB-B', artist_profile_id: 'artist-2' }),
  ];
  const supabase = makeMockSupabase(rows);
  const found = await getBriefById(supabase, 'artist-1', 'EB-A');
  assert.equal(found.executive_brief_id, 'EB-A');
  const notFound = await getBriefById(supabase, 'artist-1', 'EB-B'); // owned by artist-2
  assert.equal(notFound, null);
});

await test('getLatestBrief returns the most recent by generated_at', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-old', generated_at: '2026-07-01T00:00:00.000Z' }),
    makeRow({ executive_brief_id: 'EB-new', generated_at: '2026-07-24T00:00:00.000Z' }),
  ];
  const supabase = makeMockSupabase(rows);
  const latest = await getLatestBrief(supabase, 'artist-1');
  assert.equal(latest.executive_brief_id, 'EB-new');
});

await test('listBriefs respects date range and limit', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z' }),
    makeRow({ executive_brief_id: 'EB-2', generated_at: '2026-07-10T00:00:00.000Z' }),
    makeRow({ executive_brief_id: 'EB-3', generated_at: '2026-07-20T00:00:00.000Z' }),
  ];
  const supabase = makeMockSupabase(rows);
  const result = await listBriefs(supabase, 'artist-1', { from: '2026-07-05', to: '2026-07-25', limit: 10 });
  assert.deepEqual(result.map(r => r.executive_brief_id), ['EB-3', 'EB-2']); // newest-first default, EB-1 excluded by range
});

await test('listBriefs order:"asc" returns chronological order', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-2', generated_at: '2026-07-10T00:00:00.000Z' }),
    makeRow({ executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z' }),
  ];
  const supabase = makeMockSupabase(rows);
  const result = await listBriefs(supabase, 'artist-1', { order: 'asc' });
  assert.deepEqual(result.map(r => r.executive_brief_id), ['EB-1', 'EB-2']);
});

await test('getBriefsForComparison returns exactly two, in requested order, or null', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-A' }),
    makeRow({ executive_brief_id: 'EB-B' }),
  ];
  const supabase = makeMockSupabase(rows);
  const [a, b] = await getBriefsForComparison(supabase, 'artist-1', ['EB-B', 'EB-A']);
  assert.equal(a.executive_brief_id, 'EB-B');
  assert.equal(b.executive_brief_id, 'EB-A');

  const missing = await getBriefsForComparison(supabase, 'artist-1', ['EB-A', 'EB-nonexistent']);
  assert.equal(missing, null);
});

// ─── Executive Comparison™ ─────────────────────────────────────────────

console.log('\n§2 Executive Comparison™');

await test('compareExecutiveBriefs computes real field deltas, never a synthetic health score', () => {
  const before = makeRow({
    executive_brief_id: 'EB-before', generated_at: '2026-07-01T00:00:00.000Z',
    critical_issue_count: 3, risk_count: 4, opportunity_count: 1,
    executive_intelligence_object: {
      executiveBriefing: { overallLevel: 'WEAK', riskLevel: 'HIGH' },
      risks: [{ affectedDomain: 'rights', title: 'No PRO' }, { affectedDomain: 'catalog', title: 'Low ISRC' }],
      opportunities: [{ affectedDomain: 'catalog', title: 'Assign ISRCs' }],
    },
  });
  const after = makeRow({
    executive_brief_id: 'EB-after', generated_at: '2026-07-20T00:00:00.000Z',
    critical_issue_count: 1, risk_count: 1, opportunity_count: 2,
    executive_intelligence_object: {
      executiveBriefing: { overallLevel: 'GOOD', riskLevel: 'LOW' },
      risks: [{ affectedDomain: 'rights', title: 'No PRO' }],
      opportunities: [{ affectedDomain: 'catalog', title: 'Assign ISRCs' }, { affectedDomain: 'distribution', title: 'Expand DSPs' }],
    },
  });

  const cmp = compareExecutiveBriefs(before, after);
  assert.equal(cmp.criticalIssueDelta, -2);
  assert.equal(cmp.riskCountDelta, -3);
  assert.equal(cmp.opportunityCountDelta, 1);
  assert.equal(cmp.overallLevelBefore, 'WEAK');
  assert.equal(cmp.overallLevelAfter, 'GOOD');
  assert.ok(!('executiveHealthDelta' in cmp), 'must never invent a synthetic composite health score');

  const catalogDomain = cmp.domains.find(d => d.domain === 'catalog');
  assert.equal(catalogDomain.riskDelta, -1); // 1 -> 0
  const distDomain = cmp.domains.find(d => d.domain === 'distribution');
  assert.equal(distDomain.opportunityDelta, 1); // 0 -> 1 (emerged)
});

// ─── Cross-Scan Trend Intelligence™ ─────────────────────────────────────

console.log('\n§3 Cross-Scan Trend Intelligence™');

await test('detectDomainTrends is unavailable with fewer than 2 briefs', () => {
  const result = detectDomainTrends([makeRow()]);
  assert.equal(result.available, false);
});

await test('detectDomainTrends classifies emerging, resolved, improving, declining, stable correctly', () => {
  const first = makeRow({
    generated_at: '2026-07-01T00:00:00.000Z',
    executive_intelligence_object: {
      risks: [
        { affectedDomain: 'rights', title: 'r1' }, { affectedDomain: 'rights', title: 'r2' }, // rights: 2 risks (will improve to 1)
        { affectedDomain: 'catalog', title: 'c1' }, // catalog: 1 risk (will resolve to 0)
        { affectedDomain: 'identity', title: 'i1' }, // identity: 1 risk (stable, still 1)
      ],
    },
  });
  const last = makeRow({
    generated_at: '2026-07-20T00:00:00.000Z',
    executive_intelligence_object: {
      risks: [
        { affectedDomain: 'rights', title: 'r1' }, // rights: 1 risk (2->1, improving)
        { affectedDomain: 'identity', title: 'i1' }, // identity: 1 risk (1->1, stable)
        { affectedDomain: 'distribution', title: 'd1' }, // distribution: 0->1, emerging
      ],
    },
  });
  const result = detectDomainTrends([first, last]);
  assert.equal(result.available, true);
  const byDomain = Object.fromEntries(result.domains.map(d => [d.domain, d.classification]));
  assert.equal(byDomain.rights, 'improving');
  assert.equal(byDomain.catalog, 'resolved');
  assert.equal(byDomain.identity, 'stable');
  assert.equal(byDomain.distribution, 'emerging');
});

// ─── Executive Intelligence History™ ─────────────────────────────────────

console.log('\n§4 Executive Intelligence History™');

await test('getExecutiveHistory wraps listBriefs and reports availability honestly', async () => {
  const supabase = makeMockSupabase([makeRow(), makeRow({ executive_brief_id: 'EB-2' })]);
  const history = await getExecutiveHistory(supabase, 'artist-1', {});
  assert.equal(history.available, true);
  assert.equal(history.count, 2);

  const emptySupabase = makeMockSupabase([]);
  const emptyHistory = await getExecutiveHistory(emptySupabase, 'artist-1', {});
  assert.equal(emptyHistory.available, false);
  assert.equal(emptyHistory.count, 0);
});

// ─── Executive Timeline™ ─────────────────────────────────────────────────

console.log('\n§5 Executive Timeline™');

await test('buildExecutiveTimeline is unavailable with no archived briefs', async () => {
  const supabase = makeMockSupabase([]);
  const timeline = await buildExecutiveTimeline(supabase, 'artist-1', {});
  assert.equal(timeline.available, false);
  assert.deepEqual(timeline.events, []);
});

await test('buildExecutiveTimeline surfaces real monitoring events plus one brief-generated event per scan, chronologically', async () => {
  const rows = [
    makeRow({
      executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z',
      executive_intelligence_object: {
        executiveBriefing: { overallLevel: 'MODERATE' },
        executiveMemorySummary: { historicalChanges: [{ title: 'Label changed', severity: 'action_needed' }] },
      },
    }),
    makeRow({
      executive_brief_id: 'EB-2', generated_at: '2026-07-15T00:00:00.000Z',
      executive_intelligence_object: {
        executiveBriefing: { overallLevel: 'GOOD' },
        executiveMemorySummary: { historicalChanges: [] },
      },
    }),
  ];
  const supabase = makeMockSupabase(rows);
  const timeline = await buildExecutiveTimeline(supabase, 'artist-1', {});
  assert.equal(timeline.available, true);
  // 1 monitoring event + 1 brief-generated event for EB-1, 1 brief-generated event for EB-2 = 3
  assert.equal(timeline.count, 3);
  assert.equal(timeline.events[0].type, 'monitoring_event');
  assert.equal(timeline.events[0].title, 'Label changed');
  const generatedEvents = timeline.events.filter(e => e.type === 'executive_brief_generated');
  assert.equal(generatedEvents.length, 2);
  // Chronological order
  for (let i = 1; i < timeline.events.length; i++) {
    assert.ok(new Date(timeline.events[i - 1].date) <= new Date(timeline.events[i].date));
  }
});

// ─── Executive Memory™ (foundation) ─────────────────────────────────────

console.log('\n§6 Executive Memory™ (foundation)');

// Superseded by Phase 3C (supabase/migrations/20260730000000_executive_memory_items.sql,
// api/_lib/executive-memory-store.js): goals/dismissedActions/milestones are
// no longer permanently unavailable -- a real writable store now exists.
// `available: true` reflects the capability existing; an empty `items`
// array (as here, against a mock with no rows) means no items yet, not "no
// store exists". Full Phase 3C lifecycle coverage lives in
// tests/executive-memory-store-test.mjs; this assertion just confirms the
// shape here in the Phase 3B suite didn't silently regress.
await test('buildExecutiveMemory reports goals/dismissedActions/milestones as available (Phase 3C store), empty when no items exist', async () => {
  const supabase = makeMockSupabase([]);
  const memory = await buildExecutiveMemory(supabase, 'artist-1', {});
  assert.equal(memory.goals.available, true);
  assert.deepEqual(memory.goals.items, []);
  assert.equal(memory.dismissedActions.available, true);
  assert.equal(memory.milestones.available, true);
});

await test('buildExecutiveMemory classifies recurring vs. resolved issues correctly from real archive history', async () => {
  const rows = [
    makeRow({
      executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z',
      executive_intelligence_object: {
        risks: [
          { affectedDomain: 'rights', title: 'No PRO' },      // will recur (still present in latest)
          { affectedDomain: 'catalog', title: 'Low ISRC' },   // will be resolved (absent from latest)
        ],
      },
    }),
    makeRow({
      executive_brief_id: 'EB-2', generated_at: '2026-07-20T00:00:00.000Z',
      executive_intelligence_object: {
        risks: [
          { affectedDomain: 'rights', title: 'No PRO' },
        ],
      },
    }),
  ];
  const supabase = makeMockSupabase(rows);
  const memory = await buildExecutiveMemory(supabase, 'artist-1', {});
  assert.equal(memory.available, true);
  assert.equal(memory.scope, 'derived_from_archive_history');
  assert.equal(memory.recurringIssues.length, 1);
  assert.equal(memory.recurringIssues[0].title, 'No PRO');
  assert.equal(memory.resolvedIssues.length, 1);
  assert.equal(memory.resolvedIssues[0].title, 'Low ISRC');
});

// ─── Executive History Summary™ (Amendment 2) ───────────────────────────

console.log('\n§7 Executive History Summary™');

await test('getExecutiveHistorySummary is honestly unavailable with an empty archive', async () => {
  const supabase = makeMockSupabase([]);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  assert.equal(summary.available, false);
  assert.equal(summary.archivedBriefCount, 0);
});

await test('getExecutiveHistorySummary handles a single archived brief (no improvement/volatility to report)', async () => {
  const rows = [makeRow({
    executive_brief_id: 'EB-1', generated_at: '2026-07-01T00:00:00.000Z', risk_count: 5,
    executive_intelligence_object: { risks: [{ affectedDomain: 'rights', title: 'r1' }] },
  })];
  const supabase = makeMockSupabase(rows);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  assert.equal(summary.available, true);
  assert.equal(summary.archivedBriefCount, 1);
  assert.equal(summary.analyzedBriefCount, 1);
  assert.equal(summary.highestRecordedRiskCount, 5);
  assert.equal(summary.lowestRecordedRiskCount, 5);
  assert.equal(summary.mostImprovedDomain, null);
  assert.equal(summary.mostVolatileDomain, null);
});

await test('getExecutiveHistorySummary computes counts, dates, and min/max across multiple briefs', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-1', generated_at: '2026-01-14T00:00:00.000Z', risk_count: 17, executive_intelligence_object: { risks: [] } }),
    makeRow({ executive_brief_id: 'EB-2', generated_at: '2026-04-01T00:00:00.000Z', risk_count: 10, executive_intelligence_object: { risks: [] } }),
    makeRow({ executive_brief_id: 'EB-3', generated_at: '2026-07-24T00:00:00.000Z', risk_count: 3, executive_intelligence_object: { risks: [] } }),
  ];
  const supabase = makeMockSupabase(rows);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  assert.equal(summary.archivedBriefCount, 3);
  assert.equal(summary.firstExecutiveScanAt, '2026-01-14T00:00:00.000Z');
  assert.equal(summary.latestExecutiveScanAt, '2026-07-24T00:00:00.000Z');
  assert.equal(summary.highestRecordedRiskCount, 17);
  assert.equal(summary.lowestRecordedRiskCount, 3);
  assert.equal(summary.windowLimited, false);
});

await test('getExecutiveHistorySummary identifies the Most Improved Domain by net first-to-last decrease', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-1', generated_at: '2026-01-01T00:00:00.000Z',
      executive_intelligence_object: { risks: [
        { affectedDomain: 'rights', title: 'r1' }, { affectedDomain: 'rights', title: 'r2' }, { affectedDomain: 'rights', title: 'r3' }, // rights: 3
        { affectedDomain: 'catalog', title: 'c1' }, // catalog: 1
      ] } }),
    makeRow({ executive_brief_id: 'EB-2', generated_at: '2026-07-01T00:00:00.000Z',
      executive_intelligence_object: { risks: [
        { affectedDomain: 'catalog', title: 'c1' }, // catalog: still 1 (no change)
      ] } }), // rights: 0 (improved by 3 -- the biggest mover)
  ];
  const supabase = makeMockSupabase(rows);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  assert.equal(summary.mostImprovedDomain.domain, 'rights');
  assert.equal(summary.mostImprovedDomain.netImprovement, 3);
});

await test('getExecutiveHistorySummary identifies the Most Volatile Domain by total variation, not just net change', async () => {
  const rows = [
    makeRow({ executive_brief_id: 'EB-1', generated_at: '2026-01-01T00:00:00.000Z',
      executive_intelligence_object: { risks: [{ affectedDomain: 'catalog', title: 'a' }] } }), // catalog: 1
    makeRow({ executive_brief_id: 'EB-2', generated_at: '2026-03-01T00:00:00.000Z',
      executive_intelligence_object: { risks: [
        { affectedDomain: 'catalog', title: 'a' }, { affectedDomain: 'catalog', title: 'b' }, { affectedDomain: 'catalog', title: 'c' }, { affectedDomain: 'catalog', title: 'd' },
      ] } }), // catalog: 4 (spiked)
    makeRow({ executive_brief_id: 'EB-3', generated_at: '2026-07-01T00:00:00.000Z',
      executive_intelligence_object: { risks: [{ affectedDomain: 'catalog', title: 'a' }] } }), // catalog: 1 (back down -- net change is 0, but real movement happened)
  ];
  const supabase = makeMockSupabase(rows);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  // Net improvement is 0 (started and ended at 1), so catalog must NOT be
  // reported as "most improved" -- but it swung 1->4->1, a real total
  // variation of 6, so it must be reported as volatile.
  assert.equal(summary.mostImprovedDomain, null);
  assert.equal(summary.mostVolatileDomain.domain, 'catalog');
  assert.equal(summary.mostVolatileDomain.totalVariation, 6);
});

await test('getExecutiveHistorySummary reports windowLimited honestly when true history exceeds the analysis window', async () => {
  const rows = [];
  for (let i = 0; i < 150; i++) {
    rows.push(makeRow({
      executive_brief_id: `EB-${i}`,
      generated_at: new Date(2026, 0, 1 + i).toISOString(),
      risk_count: 1,
      executive_intelligence_object: { risks: [] },
    }));
  }
  const supabase = makeMockSupabase(rows);
  const summary = await getExecutiveHistorySummary(supabase, 'artist-1');
  assert.equal(summary.archivedBriefCount, 150);
  assert.equal(summary.analyzedBriefCount, 100); // ANALYSIS_WINDOW_LIMIT
  assert.equal(summary.windowLimited, true);
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
