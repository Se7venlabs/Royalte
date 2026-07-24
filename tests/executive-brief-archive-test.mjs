// Executive Brief Archive™ Test Suite — ATHENA™ Phase 3A
// Pure-logic unit tests against a mocked Supabase client — no real database.
// See governance/ATHENA_PHASE3A_EXECUTIVE_BRIEF_ARCHIVE_ARCHITECTURE.md §9.

import { strict as assert } from 'node:assert';
import {
  archiveExecutiveBrief, computeIntegrityHash, isUniqueViolation, buildRow,
} from '../api/_lib/executive-brief-archive.js';

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

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeEio(overrides = {}) {
  return {
    eioId: 'eio-1',
    eioVersion: '1.0.0',
    generatedAt: '2026-07-24T12:00:00.000Z',
    artistId: 'artist-1',
    scanId: 'scan-1',
    executiveBriefId: 'EB-2026-07-24-000018',
    executiveBriefing: { criticalIssues: 2 },
    risks: [{ riskId: 'r1' }],
    opportunities: [{ opportunityId: 'o1' }, { opportunityId: 'o2' }],
    recommendations: [{ recommendationId: 'rec1' }],
    confidence: { level: 'HIGH', score: 0.8 },
    metadata: {
      schemaVersion: '1.0.0', executiveVersion: '2.0', pipelineVersion: '1.0.0',
      adapterVersion: '1.0.0', athenaVersion: '1.0.0', runtimeContextVersion: '1.1',
    },
    ...overrides,
  };
}

function pgUniqueViolation(constraintName) {
  return { code: '23505', message: `duplicate key value violates unique constraint "${constraintName}"`, details: `Key already exists.` };
}

function makeMockSupabase({ insertResponses = [], existingRow = null } = {}) {
  const insertCalls = [];
  let insertCallIndex = 0;
  return {
    insertCalls,
    from(_table) {
      return {
        insert(row) {
          insertCalls.push(row);
          const resp = insertResponses[insertCallIndex] !== undefined ? insertResponses[insertCallIndex] : { error: null };
          insertCallIndex++;
          return Promise.resolve(resp);
        },
        select() {
          const chain = {
            eq() { return chain; },
            maybeSingle() { return Promise.resolve({ data: existingRow, error: null }); },
          };
          return chain;
        },
      };
    },
  };
}

// ─── computeIntegrityHash ────────────────────────────────────────────────

console.log('\n§1 Archive Integrity™ hash');

await test('computeIntegrityHash is deterministic for the same EIO', () => {
  const eio = makeEio();
  assert.equal(computeIntegrityHash(eio), computeIntegrityHash(eio));
});

await test('computeIntegrityHash is a 64-char lowercase hex SHA-256 digest', () => {
  const hash = computeIntegrityHash(makeEio());
  assert.match(hash, /^[a-f0-9]{64}$/);
});

await test('computeIntegrityHash differs when EIO content differs', () => {
  const h1 = computeIntegrityHash(makeEio());
  const h2 = computeIntegrityHash(makeEio({ executiveBriefId: 'EB-2026-07-24-999999' }));
  assert.notEqual(h1, h2);
});

await test('computeIntegrityHash is canonical -- identical content in a different key order hashes the same (Board Validation 1)', () => {
  const a = { z: 1, a: { nested: true, first: 1 }, m: [3, 1, { y: 2, x: 1 }] };
  const b = { a: { first: 1, nested: true }, m: [3, 1, { x: 1, y: 2 }], z: 1 };
  assert.equal(computeIntegrityHash(a), computeIntegrityHash(b));
});

await test('computeIntegrityHash is stable across a JSON.parse(JSON.stringify()) round-trip regardless of key order', () => {
  const original = makeEio();
  // Simulate a jsonb round-trip where key order is not preserved --
  // reconstruct with deliberately different key insertion order.
  const roundTripped = JSON.parse(JSON.stringify({ metadata: original.metadata, ...original }));
  assert.equal(computeIntegrityHash(original), computeIntegrityHash(roundTripped));
});

// ─── buildRow ────────────────────────────────────────────────────────────

console.log('\n§2 Row construction');

await test('buildRow maps EIO fields to the correct structured columns', () => {
  const eio = makeEio();
  const row = buildRow(eio, 'artist-xyz', eio.executiveBriefId, 'somehash');
  assert.equal(row.executive_brief_id, 'EB-2026-07-24-000018');
  assert.equal(row.artist_profile_id, 'artist-xyz');
  assert.equal(row.scan_id, 'scan-1');
  assert.equal(row.confidence_level, 'HIGH');
  assert.equal(row.critical_issue_count, 2);
  assert.equal(row.risk_count, 1);
  assert.equal(row.opportunity_count, 2);
  assert.equal(row.recommendation_count, 1);
  assert.equal(row.archive_integrity_hash, 'somehash');
  assert.deepEqual(row.executive_intelligence_object, eio);
  assert.ok(!('comparison_group_id' in row), 'comparison_group_id must be omitted (always NULL in Phase 3A)');
});

// ─── isUniqueViolation ───────────────────────────────────────────────────

console.log('\n§3 Constraint detection');

await test('isUniqueViolation matches the correct constraint by name', () => {
  const err = pgUniqueViolation('uq_executive_brief_archive_artist_scan');
  assert.equal(isUniqueViolation(err, 'uq_executive_brief_archive_artist_scan'), true);
  assert.equal(isUniqueViolation(err, 'uq_executive_brief_archive_brief_id'), false);
});

await test('isUniqueViolation is false for non-unique-violation errors', () => {
  assert.equal(isUniqueViolation({ code: '42501', message: 'permission denied' }, 'uq_executive_brief_archive_brief_id'), false);
});

// ─── archiveExecutiveBrief — happy path ─────────────────────────────────

console.log('\n§4 Successful archive');

await test('archives successfully on a clean insert', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({ insertResponses: [{ error: null }] });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, true);
  assert.equal(result.executiveBriefId, eio.executiveBriefId);
  assert.match(result.archiveIntegrityHash, /^[a-f0-9]{64}$/);
  assert.equal(supabase.insertCalls.length, 1);
});

// ─── archiveExecutiveBrief — anonymous / missing scanId ─────────────────

console.log('\n§5 Anonymous scans and missing scanId');

await test('anonymous scans (no artistProfileId) are never archived, and never attempt an insert', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({ insertResponses: [{ error: null }] });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: null, supabase });
  assert.equal(result.archived, false);
  assert.equal(result.archiveError, 'anonymous scan — not archived');
  assert.equal(supabase.insertCalls.length, 0);
});

await test('an EIO with no scanId is refused (idempotency anchor requirement), never attempts an insert', async () => {
  const eio = makeEio({ scanId: null });
  const supabase = makeMockSupabase({ insertResponses: [{ error: null }] });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, false);
  assert.equal(supabase.insertCalls.length, 0);
});

// ─── archiveExecutiveBrief — idempotent replay ──────────────────────────

console.log('\n§6 Idempotent replay on (artist, scan) conflict');

await test('on an artist/scan unique violation, returns the EXISTING row\'s id, never a new insert', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({
    insertResponses: [{ error: pgUniqueViolation('uq_executive_brief_archive_artist_scan') }],
    existingRow: { executive_brief_id: 'EB-2026-07-24-000001', archive_integrity_hash: 'existinghash' },
  });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, true);
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.executiveBriefId, 'EB-2026-07-24-000001');
  assert.notEqual(result.executiveBriefId, eio.executiveBriefId);
  assert.equal(supabase.insertCalls.length, 1, 'must not attempt a second insert on idempotent replay');
});

// ─── archiveExecutiveBrief — brief_id collision, regenerate and retry ───

console.log('\n§7 Brief ID collision — regenerate and retry');

await test('on a brief_id unique violation, regenerates a new id and retries once successfully', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({
    insertResponses: [
      { error: pgUniqueViolation('uq_executive_brief_archive_brief_id') },
      { error: null },
    ],
  });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, true);
  assert.notEqual(result.executiveBriefId, eio.executiveBriefId, 'must mint a replacement id, not reuse the colliding one');
  assert.equal(supabase.insertCalls.length, 2);
});

await test('on a regenerated id, the column, the stored JSON, and the hash all reference the same final id (Board Validation 3)', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({
    insertResponses: [
      { error: pgUniqueViolation('uq_executive_brief_archive_brief_id') },
      { error: null },
    ],
  });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  const insertedRow = supabase.insertCalls[1]; // the successful second attempt
  assert.equal(insertedRow.executive_brief_id, result.executiveBriefId);
  assert.equal(insertedRow.executive_intelligence_object.executiveBriefId, result.executiveBriefId,
    'the stored JSON snapshot must carry the SAME regenerated id as the structured column');
  assert.equal(insertedRow.archive_integrity_hash, computeIntegrityHash(insertedRow.executive_intelligence_object),
    'the hash must be computed from the exact object stored, not the stale original');
});

await test('bounded to 3 attempts — a 4th consecutive brief_id collision surfaces as a failure', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({
    insertResponses: [
      { error: pgUniqueViolation('uq_executive_brief_archive_brief_id') },
      { error: pgUniqueViolation('uq_executive_brief_archive_brief_id') },
      { error: pgUniqueViolation('uq_executive_brief_archive_brief_id') },
    ],
  });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, false);
  assert.equal(supabase.insertCalls.length, 3, 'must not exceed the bounded retry count');
});

// ─── archiveExecutiveBrief — generic failure, never throws ──────────────

console.log('\n§8 Generic failure and never-throws contract');

await test('a generic (non-unique-violation) DB error surfaces as a failure with no retry', async () => {
  const eio = makeEio();
  const supabase = makeMockSupabase({ insertResponses: [{ error: { code: '08006', message: 'connection failure' } }] });
  const result = await archiveExecutiveBrief({ eio, artistProfileId: 'artist-1', supabase });
  assert.equal(result.archived, false);
  assert.equal(result.archiveError, 'archive write failed');
  assert.equal(supabase.insertCalls.length, 1);
});

await test('never throws, even given a malformed EIO', async () => {
  const supabase = makeMockSupabase({ insertResponses: [{ error: null }] });
  await assert.doesNotReject(() => archiveExecutiveBrief({ eio: { scanId: 'scan-1' }, artistProfileId: 'artist-1', supabase }));
});

await test('never throws when supabase itself is missing', async () => {
  await assert.doesNotReject(() => archiveExecutiveBrief({ eio: makeEio(), artistProfileId: 'artist-1', supabase: null }));
});

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
