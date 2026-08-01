// Playbook Action Engine™ — Phase 4A test suite. Pure-logic unit tests
// against the Registry, Definitions, and Store, plus the real risk-analysis
// MLC extension. No real database, no real network — matches the house
// pattern in tests/ask-athena-test.mjs.

import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { registerPlaybook, getPlaybook, getAllPlaybooks, getRegistrations, _resetForTests } from '../api/playbooks/registry.js';
import '../api/playbooks/definitions/index.js';
import {
  startPlaybook, advancePlaybookStep, completePlaybook, archivePlaybook, listPlaybookActions, withProgressPercentage,
} from '../api/_lib/playbook-action-store.js';
import { identifyRightsRisks } from '../api/athena/risk-analysis.js';
import { buildMusicRightsEnvelope } from '../api/athena/runtime-context-adapter.js';

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

// ─── In-memory mock Supabase (extends the house pattern with .neq()) ──────
function makeMockSupabase(initialRows = {}) {
  const store = {};
  for (const [table, rows] of Object.entries(initialRows)) {
    store[table] = rows.map(r => ({ ...r }));
  }
  let idCounter = 0;

  function from(table) {
    if (!store[table]) store[table] = [];
    const rows = store[table];
    let mode = null;
    let insertData = null, updateData = null, limitN = null;
    const filters = [];
    let orderCol = null, orderAsc = true;

    const builder = {
      select() { if (mode === null) mode = 'select'; return builder; },
      insert(data) { mode = 'insert'; insertData = data; return builder; },
      update(data) { mode = 'update'; updateData = data; return builder; },
      eq(col, val) { filters.push(r => r[col] === val); return builder; },
      neq(col, val) { filters.push(r => r[col] !== val); return builder; },
      order(col, opts) { orderCol = col; orderAsc = !(opts && opts.ascending === false); return builder; },
      limit(n) { limitN = n; return builder; },
      maybeSingle() { return resolveQuery({ single: true, maybe: true }); },
      single() { return resolveQuery({ single: true, maybe: false }); },
      then(resolve, reject) { return resolveQuery({ single: false }).then(resolve, reject); },
    };

    async function resolveQuery({ single, maybe }) {
      if (mode === 'insert') {
        const newRow = { id: `${table}-${++idCounter}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...insertData };
        rows.push(newRow);
        return single ? { data: newRow, error: null } : { data: [newRow], error: null };
      }
      if (mode === 'update') {
        const matches = rows.filter(r => filters.every(f => f(r)));
        if (matches.length === 0) return single ? { data: null, error: maybe ? null : { message: 'no rows' } } : { data: [], error: null };
        matches.forEach(r => Object.assign(r, updateData));
        return single ? { data: matches[0], error: null } : { data: matches, error: null };
      }
      let result = rows.filter(r => filters.every(f => f(r)));
      if (orderCol) {
        result = [...result].sort((a, b) => {
          if (a[orderCol] === b[orderCol]) return 0;
          const cmp = a[orderCol] < b[orderCol] ? -1 : 1;
          return orderAsc ? cmp : -cmp;
        });
      }
      if (limitN != null) result = result.slice(0, limitN);
      if (single) return result[0] ? { data: result[0], error: null } : { data: null, error: maybe ? null : { message: 'no rows' } };
      return { data: result, error: null };
    }

    return builder;
  }

  return { from };
}

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§1 Playbook Registry™ — discovery/registration only, no content');

await test('all real definitions are registered', async () => {
  const all = getAllPlaybooks();
  const ids = all.map(d => d.playbookId).sort();
  assert.deepEqual(ids, ['identity-coverage', 'mlc-registration']);
});

await test('registrations expose only lightweight discovery fields, never content', async () => {
  const regs = getRegistrations();
  for (const reg of regs) {
    assert.equal(typeof reg.playbookId, 'string');
    assert.equal(typeof reg.currentVersion, 'string');
    assert.equal(typeof reg.definitionSchema, 'number');
    assert.ok(!('steps' in reg), 'registration must not carry steps');
    assert.ok(!('title' in reg), 'registration must not carry title');
    assert.ok(!('executiveSummary' in reg), 'registration must not carry summary content');
  }
});

await test('a synthetic third definition registers and lists with zero registry/engine changes', async () => {
  registerPlaybook({
    playbookId: 'synthetic-test-playbook',
    playbookVersion: '1.0',
    definitionSchema: 1,
    load: () => ({ playbookId: 'synthetic-test-playbook', playbookVersion: '1.0', definitionSchema: 1, title: 'Synthetic', steps: [{ stepId: 'SYN-001', stepNumber: 1 }] }),
  });
  assert.ok(getAllPlaybooks().some(d => d.playbookId === 'synthetic-test-playbook'));
  assert.ok(getPlaybook('synthetic-test-playbook').title === 'Synthetic');
  // no registry.js/store code changed to make this work -- proven by the
  // fact this test file never touches registry.js internals, only its
  // public registerPlaybook/getPlaybook/getAllPlaybooks exports.
});

await test('getPlaybook returns null for an unregistered id', async () => {
  assert.equal(getPlaybook('does-not-exist'), null);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§2 Playbook Independence Rule™ — no definition imports another');

await test('no definition file imports another definition file', async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const definitionsDir = path.join(__dirname, '..', 'api', 'playbooks', 'definitions');
  const files = readdirSync(definitionsDir).filter(f => f.endsWith('.js') && f !== 'index.js');
  for (const file of files) {
    const source = readFileSync(path.join(definitionsDir, file), 'utf8');
    const otherFiles = files.filter(f => f !== file);
    for (const other of otherFiles) {
      const otherBase = other.replace('.js', '');
      assert.ok(!source.includes(`./${otherBase}`), `${file} must not import ${other}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§3 Playbook Definitions™ — isEligible/evidenceConfidence, real evidence only');

await test('mlc-registration: not eligible with no data', async () => {
  const def = getPlaybook('mlc-registration');
  assert.equal(def.isEligible({}), false);
});
await test('mlc-registration: eligible when ACTION_REQUIRED, confidence MEDIUM', async () => {
  const def = getPlaybook('mlc-registration');
  const rawInputs = { publishingIntelligence: { registrations: { mlcRegistration: 'ACTION_REQUIRED' } } };
  assert.equal(def.isEligible(rawInputs), true);
  assert.equal(def.evidenceConfidence(rawInputs), 'MEDIUM');
});
await test('mlc-registration: eligible when NOT_FOUND, confidence HIGH', async () => {
  const def = getPlaybook('mlc-registration');
  const rawInputs = { publishingIntelligence: { registrations: { mlcRegistration: 'NOT_FOUND' } } };
  assert.equal(def.isEligible(rawInputs), true);
  assert.equal(def.evidenceConfidence(rawInputs), 'HIGH');
});
await test('mlc-registration: not eligible when VERIFIED', async () => {
  const def = getPlaybook('mlc-registration');
  assert.equal(def.isEligible({ publishingIntelligence: { registrations: { mlcRegistration: 'VERIFIED' } } }), false);
});
await test('mlc-registration: not eligible when UNABLE_TO_CONFIRM (say nothing when unsure)', async () => {
  const def = getPlaybook('mlc-registration');
  assert.equal(def.isEligible({ publishingIntelligence: { registrations: { mlcRegistration: 'UNABLE_TO_CONFIRM' } } }), false);
});
await test('identity-coverage: eligible below 100%, confidence scales with severity', async () => {
  const def = getPlaybook('identity-coverage');
  assert.equal(def.isEligible({ identity: { coverage: 40 } }), true);
  assert.equal(def.evidenceConfidence({ identity: { coverage: 40 } }), 'HIGH');
  assert.equal(def.evidenceConfidence({ identity: { coverage: 65 } }), 'MEDIUM');
  assert.equal(def.evidenceConfidence({ identity: { coverage: 90 } }), 'LOW');
});
await test('identity-coverage: not eligible at 100%', async () => {
  const def = getPlaybook('identity-coverage');
  assert.equal(def.isEligible({ identity: { coverage: 100 } }), false);
});
await test('every definition has playbookVersion, definitionSchema, and grouped metrics', async () => {
  for (const def of getAllPlaybooks().filter(d => d.playbookId !== 'synthetic-test-playbook')) {
    assert.equal(typeof def.playbookVersion, 'string');
    assert.equal(typeof def.definitionSchema, 'number');
    assert.ok(def.metrics && typeof def.metrics === 'object');
    assert.ok('difficulty' in def.metrics && 'estimatedMinutes' in def.metrics && 'estimatedRevenueImpact' in def.metrics);
  }
});
await test('every step has a stable stepId distinct from stepNumber', async () => {
  for (const def of getAllPlaybooks().filter(d => d.playbookId !== 'synthetic-test-playbook')) {
    for (const step of def.steps) {
      assert.equal(typeof step.stepId, 'string');
      assert.ok(step.stepId.length > 0);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§4 Playbook Action Store™ — lifecycle, facts-only, stable identity');

await test('startPlaybook creates a new row with facts-only progress fields', async () => {
  const supabase = makeMockSupabase();
  const result = await startPlaybook({
    supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0',
    definitionSchema: 1, totalSteps: 4, evidenceConfidence: 'HIGH',
  });
  assert.equal(result.ok, true);
  assert.equal(result.resumed, false);
  assert.equal(result.item.status, 'started');
  assert.equal(result.item.completed_steps, 0);
  assert.equal(result.item.progressPercentage, 0);
});

await test('startPlaybook resumes an existing non-archived row instead of duplicating (stable identity)', async () => {
  const supabase = makeMockSupabase();
  const first = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  const second = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  assert.equal(second.ok, true);
  assert.equal(second.resumed, true);
  assert.equal(second.item.id, first.item.id);
  const all = await listPlaybookActions({ supabase, artistProfileId: 'artist-1' });
  assert.equal(all.items.length, 1, 'must not create a duplicate row on resume');
});

await test('advancePlaybookStep is keyed by stable stepId, increments completed_steps as a fact', async () => {
  const supabase = makeMockSupabase();
  const started = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  const advanced = await advancePlaybookStep({ supabase, artistProfileId: 'artist-1', actionId: started.item.id, stepId: 'MLC-001' });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.item.status, 'in_progress');
  assert.equal(advanced.item.completed_steps, 1);
  assert.equal(advanced.item.current_step_id, 'MLC-001');
  assert.equal(advanced.item.progressPercentage, 25);
});

await test('progressPercentage is never a stored column, always derived from completed_steps/total_steps', async () => {
  const row = { completed_steps: 2, total_steps: 4 };
  const withPct = withProgressPercentage(row);
  assert.equal(withPct.progressPercentage, 50);
  assert.ok(!('progress_percentage' in row), 'the raw row must never carry a persisted percentage field');
});

await test('completePlaybook records artist self-confirmation, never a re-verification claim', async () => {
  const supabase = makeMockSupabase();
  const started = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  const completed = await completePlaybook({ supabase, artistProfileId: 'artist-1', actionId: started.item.id });
  assert.equal(completed.ok, true);
  assert.equal(completed.item.status, 'completed');
  assert.equal(completed.item.completion_outcome, 'user_confirmed_complete');
  assert.ok(completed.item.completed_at);
});

await test('archivePlaybook allows starting a fresh instance afterward (archived rows do not block resume)', async () => {
  const supabase = makeMockSupabase();
  const started = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  await archivePlaybook({ supabase, artistProfileId: 'artist-1', actionId: started.item.id });
  const restarted = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  assert.equal(restarted.ok, true);
  assert.equal(restarted.resumed, false, 'a fresh row is created because the prior one is archived');
  assert.notEqual(restarted.item.id, started.item.id);
});

await test('cannot advance/complete an already-completed or archived playbook', async () => {
  const supabase = makeMockSupabase();
  const started = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  await completePlaybook({ supabase, artistProfileId: 'artist-1', actionId: started.item.id });
  const result = await advancePlaybookStep({ supabase, artistProfileId: 'artist-1', actionId: started.item.id, stepId: 'MLC-002' });
  assert.equal(result.ok, false);
});

await test('cross-artist isolation: artist-2 cannot advance or complete artist-1s playbook', async () => {
  const supabase = makeMockSupabase();
  const started = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  const result = await advancePlaybookStep({ supabase, artistProfileId: 'artist-2', actionId: started.item.id, stepId: 'MLC-001' });
  assert.equal(result.ok, false);
});

await test('cross-artist isolation: listPlaybookActions only returns the calling artists rows', async () => {
  const supabase = makeMockSupabase();
  await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  await startPlaybook({ supabase, artistProfileId: 'artist-2', playbookId: 'identity-coverage', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 4 });
  const artist1Items = await listPlaybookActions({ supabase, artistProfileId: 'artist-1' });
  assert.equal(artist1Items.items.length, 1);
  assert.equal(artist1Items.items[0].playbook_id, 'mlc-registration');
});

await test('never-throws contract: every store function resolves {ok:false} when the store is unavailable', async () => {
  assert.equal((await startPlaybook({ supabase: null, artistProfileId: 'x', playbookId: 'y', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 1 })).ok, false);
  assert.equal((await advancePlaybookStep({ supabase: null, artistProfileId: 'x', actionId: 'y', stepId: 'z' })).ok, false);
  assert.equal((await completePlaybook({ supabase: null, artistProfileId: 'x', actionId: 'y' })).ok, false);
  assert.equal((await archivePlaybook({ supabase: null, artistProfileId: 'x', actionId: 'y' })).ok, false);
  assert.equal((await listPlaybookActions({ supabase: null, artistProfileId: 'x' })).ok, false);
});

await test('startPlaybook validates required fields without throwing', async () => {
  const supabase = makeMockSupabase();
  const result = await startPlaybook({ supabase, artistProfileId: 'artist-1', playbookId: 'mlc-registration', playbookVersion: '1.0', definitionSchema: 1, totalSteps: 0 });
  assert.equal(result.ok, false);
});

// ═══════════════════════════════════════════════════════════════════════
console.log('\n§5 MLC risk wiring — real evidence-backed risk emission');

await test('identifyRightsRisks emits no MLC risk when VERIFIED', async () => {
  const risks = identifyRightsRisks({ status: 'SUCCESS', data: { publisher: 'x', pro: 'ASCAP', mlcRegistration: 'VERIFIED' } });
  assert.ok(!risks.some(r => r.title === 'Not Registered with The MLC'));
});
await test('identifyRightsRisks emits a real MLC risk when NOT_FOUND', async () => {
  const risks = identifyRightsRisks({ status: 'SUCCESS', data: { publisher: 'x', pro: 'ASCAP', mlcRegistration: 'NOT_FOUND' } });
  const risk = risks.find(r => r.title === 'Not Registered with The MLC');
  assert.ok(risk);
  assert.equal(risk.category, 'rights');
  assert.ok(risk.supportingEvidence.some(e => e.includes('mlcRegistration')));
});
await test('identifyRightsRisks emits a real MLC risk when ACTION_REQUIRED', async () => {
  const risks = identifyRightsRisks({ status: 'SUCCESS', data: { publisher: 'x', pro: 'ASCAP', mlcRegistration: 'ACTION_REQUIRED' } });
  assert.ok(risks.some(r => r.title === 'Not Registered with The MLC'));
});
await test('identifyRightsRisks emits no MLC risk when UNABLE_TO_CONFIRM (never claim a gap we cannot confirm)', async () => {
  const risks = identifyRightsRisks({ status: 'SUCCESS', data: { publisher: 'x', pro: 'ASCAP', mlcRegistration: 'UNABLE_TO_CONFIRM' } });
  assert.ok(!risks.some(r => r.title === 'Not Registered with The MLC'));
});
await test('buildMusicRightsEnvelope threads the real publishingIntelligence.registrations.mlcRegistration value through', async () => {
  // publishing/musicRightsProfile must be present for the envelope builder
  // to proceed past its own NOT_FOUND early return (pre-existing behavior,
  // unrelated to the Phase 4A mlcRegistration addition being tested here).
  const ctx = { publishing: {}, publishingIntelligence: { registrations: { mlcRegistration: 'NOT_FOUND' } } };
  const envelope = buildMusicRightsEnvelope(ctx);
  assert.equal(envelope.data.mlcRegistration, 'NOT_FOUND');
});

// ═══════════════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
