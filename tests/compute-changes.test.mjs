// Unit tests for computeChanges() — Block D scan-diff computation.
// No test framework (repo convention): plain assertions, throws on failure.
// Run: node tests/compute-changes.test.mjs

import { computeChanges } from '../api/_lib/compute-changes.js';

let passed = 0;

function assert(cond, label) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed++;
  console.log(`✓ ${label}`);
}

// Minimal canonical-shaped payload — computeChanges only reads issues,
// score.overall, score.riskLevel, and platforms[key].availability.
function payload({ issues = [], overall = 50, riskLevel = 'MODERATE', platforms = {} } = {}) {
  return { issues, score: { overall, riskLevel }, platforms };
}

const issueA = { id: 'a', title: 'Missing ISRC', severity: 'HIGH' };
const issueB = { id: 'b', title: 'No publishing link', severity: 'MEDIUM' };
const issueC = { id: 'c', title: 'YouTube gap', severity: 'LOW' };

// ── 1. Identical payloads → no changes ──────────────────────────────────────
{
  const p = payload({ issues: [issueA, issueB], overall: 60, riskLevel: 'MODERATE' });
  const changes = computeChanges(p, payload({ issues: [issueA, issueB], overall: 60, riskLevel: 'MODERATE' }));
  assert(changes.length === 0, 'identical payloads produce zero changes');
}

// ── 2. New issue → one issue_new record ─────────────────────────────────────
{
  const prev = payload({ issues: [issueA] });
  const next = payload({ issues: [issueA, issueB] });
  const changes = computeChanges(prev, next);
  assert(changes.length === 1, 'new issue → exactly one change');
  assert(changes[0].change_type === 'issue_new', 'new issue → change_type issue_new');
  assert(changes[0].payload.issue_id === 'b', 'new issue → correct issue_id');
  assert(changes[0].payload.severity === 'MEDIUM', 'new issue → carries severity');
}

// ── 3. Resolved issue → one issue_resolved record ───────────────────────────
{
  const prev = payload({ issues: [issueA, issueB] });
  const next = payload({ issues: [issueA] });
  const changes = computeChanges(prev, next);
  assert(changes.length === 1, 'resolved issue → exactly one change');
  assert(changes[0].change_type === 'issue_resolved', 'resolved issue → change_type issue_resolved');
  assert(changes[0].payload.issue_id === 'b', 'resolved issue → correct issue_id');
}

// ── 4. Score change → score_change with correct delta ───────────────────────
{
  const prev = payload({ overall: 60 });
  const next = payload({ overall: 72 });
  const changes = computeChanges(prev, next);
  assert(changes.length === 1, 'score change → exactly one change');
  assert(changes[0].change_type === 'score_change', 'score change → change_type score_change');
  assert(changes[0].payload.from === 60 && changes[0].payload.to === 72, 'score change → from/to correct');
  assert(changes[0].payload.delta === 12, 'score change → delta correct (72 - 60 = 12)');
}

// ── 5. Revenue-risk tier change → revenue_risk_change ───────────────────────
{
  const prev = payload({ riskLevel: 'HIGH' });
  const next = payload({ riskLevel: 'MODERATE' });
  const changes = computeChanges(prev, next);
  assert(changes.length === 1, 'risk change → exactly one change');
  assert(changes[0].change_type === 'revenue_risk_change', 'risk change → change_type revenue_risk_change');
  assert(changes[0].payload.from === 'HIGH' && changes[0].payload.to === 'MODERATE', 'risk change → from/to correct');
}

// ── 6. Platform connectivity change → platform_change ───────────────────────
{
  const prev = payload({ platforms: { spotify: { availability: 'VERIFIED' }, youtube: { availability: 'NOT_FOUND' } } });
  const next = payload({ platforms: { spotify: { availability: 'VERIFIED' }, youtube: { availability: 'VERIFIED' } } });
  const changes = computeChanges(prev, next);
  assert(changes.length === 1, 'platform change → exactly one change');
  assert(changes[0].change_type === 'platform_change', 'platform change → change_type platform_change');
  assert(changes[0].payload.platform === 'youtube', 'platform change → correct platform');
  assert(changes[0].payload.from === 'disconnected' && changes[0].payload.to === 'connected', 'platform change → from/to correct');
}

// ── 6b. AUTH_UNAVAILABLE ↔ NOT_FOUND among non-connected platforms = no noise ─
{
  const prev = payload({ platforms: { tidal: { availability: 'NOT_FOUND' } } });
  const next = payload({ platforms: { tidal: { availability: 'AUTH_UNAVAILABLE' } } });
  const changes = computeChanges(prev, next);
  assert(changes.length === 0, 'non-connected availability shuffle → no spurious platform_change');
}

// ── 7. Multiple simultaneous changes → all detected ─────────────────────────
{
  const prev = payload({
    issues: [issueA, issueB],
    overall: 50,
    riskLevel: 'HIGH',
    platforms: { spotify: { availability: 'VERIFIED' }, deezer: { availability: 'VERIFIED' } },
  });
  const next = payload({
    issues: [issueB, issueC],
    overall: 65,
    riskLevel: 'MODERATE',
    platforms: { spotify: { availability: 'VERIFIED' }, deezer: { availability: 'NOT_FOUND' } },
  });
  const changes = computeChanges(prev, next);
  const types = changes.map(c => c.change_type).sort();
  assert(changes.length === 5, 'multiple changes → all five detected');
  assert(types.join(',') === 'issue_new,issue_resolved,platform_change,revenue_risk_change,score_change',
    'multiple changes → issue_new + issue_resolved + score + risk + platform');
}

console.log(`\n═══════════════════════════════════════`);
console.log(`  computeChanges VERIFIED — ${passed} assertions passed`);
console.log(`═══════════════════════════════════════`);
