// ─────────────────────────────────────────────────────────────────────
//  Royaltē Identity Graph™ — Publishing Layer · unit tests (Phase 3)
// ─────────────────────────────────────────────────────────────────────
//
//  Board-ratified test surface (2026-06-10). 15 cases minimum; this file
//  ships 20 to lock the contract.
//
//  Determinism strategy: the graph is module-scoped in-memory state
//  (Board rule A). Tests use UNIQUE artist keys + UNIQUE mlcSongCodes
//  + UNIQUE writerIPIs + UNIQUE ISWCs + UNIQUE ISRCs per case so no
//  test depends on the residue of any other.
//
//  Convention matches tests/pipeline-test.mjs:
//    - counter + throw on failure
//    - `node tests/identity-graph-publishing-test.mjs` runs the suite
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { normalizeMlcWork } from '../lib/publishing/mlc-adapter.js';
import {
  addPublishingWork,
  getPublishingWorks,
  getCompositionByISWC,
  getCompositionByMLCSongCode,
  getWriterByIPI,
  linkRecordingToComposition,
  getCompositionsForRecording,
  getRecordingsForComposition,
  lookupYouTubeChannelId,
  getYouTubeChannelEntry,
} from '../api/_lib/identity-graph.js';

// ─── Fixture builders ────────────────────────────────────────────────

function rawMlcWork({ mlcSongCode, workTitle = 'Untitled', iswc = null, writers = [] }) {
  return {
    mlcSongCode,
    workTitle,
    iswc,
    writers,
  };
}

function rawWriter({
  writerFirstName = null,
  writerLastName  = 'Doe',
  writerIPI       = null,
  writerId        = null,
  writerRoleCode  = 'Composer',
} = {}) {
  return { writerFirstName, writerLastName, writerIPI, writerId, writerRoleCode };
}

// Helper to add a PublishingWork in one line — runs the Phase-2 adapter
// then hands the result to the graph.
function addOne(artistName, rawWork) {
  const pw = normalizeMlcWork(rawWork);
  return addPublishingWork(artistName, pw);
}

// ─── Test harness ────────────────────────────────────────────────────

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓  ${name}`);
  } catch (e) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${e?.message || e}`);
    process.exit(1);
  }
}

// ─── 1. addPublishingWork stores composition correctly ───────────────

test('1. addPublishingWork stores a CompositionNode with the Board-ratified shape', () => {
  const node = addOne('Test 1 Artist', rawMlcWork({
    mlcSongCode: 'T01CODE',
    workTitle:   'Test 1 Work',
    iswc:        'T-001000001-1',
    writers:     [rawWriter({ writerFirstName: 'A', writerLastName: 'One', writerIPI: 'IPI001' })],
  }));

  assert.ok(node, 'should return a non-null node');
  // providerIds
  assert.equal(node.providerIds.mlc,         'T01CODE');
  assert.equal(node.providerIds.socan,       null);
  assert.equal(node.providerIds.ascap,       null);
  assert.equal(node.providerIds.bmi,         null);
  assert.equal(node.providerIds.cisac,       null);
  assert.equal(node.providerIds.musicbrainz, null);
  // canonical fields
  assert.equal(node.iswc,           'T-001000001-1');
  assert.equal(node.title,          'Test 1 Work');
  assert.equal(node.canonicalTitle, 'Test 1 Work');
  // writers
  assert.equal(node.writers.length, 1);
  assert.equal(node.writers[0].writerIPI, 'IPI001');
  assert.equal(node.writers[0].fullName,  'A One');
  assert.equal(node.writers[0].role,      'Composer');
  assert.ok(typeof node.writers[0].providerConfidence === 'string');
  // publishers / recordings
  assert.deepStrictEqual(node.publishers, []);
  assert.deepStrictEqual(node.recordings, []);
  // sources
  assert.equal(node.sources.length, 1);
  assert.equal(node.sources[0].provider, 'mlc');
  assert.ok(typeof node.sources[0].observedAt === 'string');
  // Board-ratified: graph confidence is always UNKNOWN
  assert.equal(node.confidence, 'UNKNOWN');
  // timestamps
  assert.match(node.addedAt,        /^\d{4}-\d{2}-\d{2}T/);
  assert.match(node.lastObservedAt, /^\d{4}-\d{2}-\d{2}T/);
});

// ─── 2. Duplicate composition (same mlc ID) merges ───────────────────

test('2. duplicate mlcSongCode → merges into the same node (no duplicate created)', () => {
  const code = 'T02CODE';
  const first = addOne('Test 2 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 2 Work',
    writers: [rawWriter({ writerIPI: 'IPI002' })],
  }));
  const second = addOne('Test 2 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 2 Work',
    writers: [rawWriter({ writerIPI: 'IPI002' })],
  }));
  assert.strictEqual(first, second, 'merge should return the same node reference');
  const list = getPublishingWorks('Test 2 Artist');
  assert.equal(list.length, 1);
  assert.equal(list[0].providerIds.mlc, code);
});

// ─── 3. Duplicate writer (same writerIPI) merges ─────────────────────

test('3. duplicate writerIPI on the same composition → single writer entry', () => {
  const code = 'T03CODE';
  addOne('Test 3 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 3 Work',
    writers: [rawWriter({ writerIPI: 'IPI003', writerLastName: 'Original' })],
  }));
  const node = addOne('Test 3 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 3 Work',
    writers: [rawWriter({ writerIPI: 'IPI003', writerLastName: 'AlsoSeen' })],
  }));
  assert.equal(node.writers.length, 1);
  assert.equal(node.writers[0].writerIPI, 'IPI003');
  // First-observed name is preserved (never destroyed)
  assert.equal(node.writers[0].lastName, 'Original');
});

// ─── 4. Writer with no IPI — stored, not merged blindly ──────────────

test('4. writers with no IPI are appended — never merged by name alone', () => {
  const code = 'T04CODE';
  addOne('Test 4 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 4 Work',
    writers: [rawWriter({ writerLastName: 'Same Name', writerIPI: null })],
  }));
  const node = addOne('Test 4 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 4 Work',
    writers: [rawWriter({ writerLastName: 'Same Name', writerIPI: null })],
  }));
  // Both writers appended — never merged by name (Board: duplicate intelligence > incorrect intelligence)
  assert.equal(node.writers.length, 2);
});

// ─── 5. null ISWC — stored safely, no crash ──────────────────────────

test('5. null ISWC is stored safely and lookup by ISWC misses cleanly', () => {
  const node = addOne('Test 5 Artist', rawMlcWork({
    mlcSongCode: 'T05CODE', workTitle: 'Test 5 Work', iswc: null,
    writers: [rawWriter({ writerIPI: 'IPI005' })],
  }));
  assert.equal(node.iswc, null);
  assert.equal(getCompositionByISWC(null), null);
});

// ─── 6. null publishers — empty array present ────────────────────────

test('6. publishers array is always present and empty (MLC has no publisher data)', () => {
  const node = addOne('Test 6 Artist', rawMlcWork({
    mlcSongCode: 'T06CODE', workTitle: 'Test 6 Work',
    writers: [rawWriter({ writerIPI: 'IPI006' })],
  }));
  assert.ok(Array.isArray(node.publishers));
  assert.equal(node.publishers.length, 0);
});

// ─── 7. Multiple recordings → one composition ────────────────────────

test('7. one ISWC can have many ISRCs (covers, remixes, live versions)', () => {
  const iswc = 'T-007000007-7';
  linkRecordingToComposition('ISRC-7-A', iswc);
  linkRecordingToComposition('ISRC-7-B', iswc);
  linkRecordingToComposition('ISRC-7-C', iswc);
  const recordings = getRecordingsForComposition(iswc);
  assert.equal(recordings.length, 3);
  assert.ok(recordings.includes('ISRC-7-A'));
  assert.ok(recordings.includes('ISRC-7-B'));
  assert.ok(recordings.includes('ISRC-7-C'));
});

// ─── 8. One composition → multiple recordings (inverse: one ISRC → many ISWC) ──

test('8. one ISRC can belong to many ISWCs (mashups, medleys) — never assume 1:1', () => {
  const isrc = 'ISRC-8-MASHUP';
  linkRecordingToComposition(isrc, 'T-008000001-X');
  linkRecordingToComposition(isrc, 'T-008000002-X');
  const comps = getCompositionsForRecording(isrc);
  assert.equal(comps.length, 2);
  assert.ok(comps.includes('T-008000001-X'));
  assert.ok(comps.includes('T-008000002-X'));
});

// ─── 9. getPublishingWorks unknown artist → [] ───────────────────────

test('9. getPublishingWorks returns [] for an unknown artist (never throws)', () => {
  const list = getPublishingWorks('No Such Artist In The Graph 9');
  assert.deepStrictEqual(list, []);
  // and null/empty inputs
  assert.deepStrictEqual(getPublishingWorks(null),      []);
  assert.deepStrictEqual(getPublishingWorks(undefined), []);
  assert.deepStrictEqual(getPublishingWorks(''),        []);
});

// ─── 10. getCompositionByISWC — found + not found ────────────────────

test('10. getCompositionByISWC — found and not-found paths', () => {
  const iswc = 'T-010000010-0';
  addOne('Test 10 Artist', rawMlcWork({
    mlcSongCode: 'T10CODE', workTitle: 'Test 10', iswc,
    writers: [rawWriter({ writerIPI: 'IPI010' })],
  }));
  const found = getCompositionByISWC(iswc);
  assert.ok(found);
  assert.equal(found.iswc, iswc);
  const notFound = getCompositionByISWC('T-NEVER-ADDED-0');
  assert.equal(notFound, null);
});

// ─── 11. getCompositionByMLCSongCode — found + not found ─────────────

test('11. getCompositionByMLCSongCode — found and not-found paths', () => {
  const code = 'T11CODE';
  addOne('Test 11 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 11',
    writers: [rawWriter({ writerIPI: 'IPI011' })],
  }));
  const found = getCompositionByMLCSongCode(code);
  assert.ok(found);
  assert.equal(found.providerIds.mlc, code);
  const notFound = getCompositionByMLCSongCode('T_NEVER_ADDED');
  assert.equal(notFound, null);
});

// ─── 12. getWriterByIPI — found + not found ──────────────────────────

test('12. getWriterByIPI — found and not-found paths', () => {
  addOne('Test 12 Artist', rawMlcWork({
    mlcSongCode: 'T12CODE', workTitle: 'Test 12',
    writers: [rawWriter({ writerFirstName: 'Twelve', writerLastName: 'Writer', writerIPI: 'IPI012' })],
  }));
  const found = getWriterByIPI('IPI012');
  assert.ok(found);
  assert.equal(found.writerIPI, 'IPI012');
  assert.equal(found.lastName,  'Writer');
  const notFound = getWriterByIPI('IPI-NEVER-ADDED');
  assert.equal(notFound, null);
});

// ─── 13. sources[] is append-only ────────────────────────────────────

test('13. two observations of the same work → sources.length === 2 (append-only)', () => {
  const code = 'T13CODE';
  addOne('Test 13 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 13',
    writers: [rawWriter({ writerIPI: 'IPI013' })],
  }));
  const node = addOne('Test 13 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 13',
    writers: [rawWriter({ writerIPI: 'IPI013' })],
  }));
  assert.equal(node.sources.length, 2);
  // Every source preserves the provider value dynamically
  assert.equal(node.sources[0].provider, 'mlc');
  assert.equal(node.sources[1].provider, 'mlc');
  // Graph confidence stays UNKNOWN even across multiple observations
  assert.equal(node.confidence, 'UNKNOWN');
});

// ─── 14. Backward compatibility — YouTube exports untouched ──────────

test('14. existing lookupYouTubeChannelId still resolves the seeded entry', () => {
  // The seeded artist key from the original graph (Black Alternative)
  const channelId = lookupYouTubeChannelId('Black Alternative');
  assert.equal(channelId, 'UCOIO07KGdBFp9Ej40iaZRGQ');
  // Full-entry helper still works
  const entry = getYouTubeChannelEntry('Black Alternative');
  assert.ok(entry);
  assert.equal(entry.addedBy, 'founder');
});

// ─── 15. Provider-agnostic — socan source works exactly like mlc ─────

test('15. provider-agnostic — socan-sourced PublishingWork produces sources[0].provider === "socan"', () => {
  // Build a PublishingWork-shaped object as if a future socan-adapter
  // had produced it. Bypasses the MLC adapter — same shape.
  const socanWork = {
    title:          'Test 15 SOCAN Work',
    canonicalTitle: 'Test 15 SOCAN Work',
    mlcSongCode:    'T15SOCAN',  // sugar field accepted by the graph layer
    iswc:           'T-015000015-5',
    writers: [{
      writerIPI: 'IPI015',
      firstName: 'Soc',
      lastName:  'Writer',
      fullName:  'Soc Writer',
      role:      'Composer',
    }],
    publishers:     [],
    source:         'socan',
    rawMlcResponse: { provider: 'socan', body: 'opaque' },
    lastUpdated:    new Date().toISOString(),
    confidence:     'MEDIUM',
  };
  const node = addPublishingWork('Test 15 Artist', socanWork);
  assert.ok(node);
  assert.equal(node.sources[0].provider, 'socan');
  // providerIds.socan slot received the value (mlc slot stays null)
  assert.equal(node.providerIds.socan, 'T15SOCAN');
  assert.equal(node.providerIds.mlc,   null);
});

// ─── 16. (extra) addPublishingWork rejects invalid input → null, no graph mutation ──

test('16. invalid PublishingWork → addPublishingWork returns null, graph untouched', () => {
  const before = getPublishingWorks('Test 16 Artist').length;
  // missing required fields
  const r1 = addPublishingWork('Test 16 Artist', { mlcSongCode: '', writers: [] });
  const r2 = addPublishingWork('Test 16 Artist', null);
  const r3 = addPublishingWork('Test 16 Artist', undefined);
  const r4 = addPublishingWork('', { /* shape */ });
  assert.equal(r1, null);
  assert.equal(r2, null);
  assert.equal(r3, null);
  assert.equal(r4, null);
  const after = getPublishingWorks('Test 16 Artist').length;
  assert.equal(before, after);
});

// ─── 17. (extra) merge by ISWC, not by title (different mlc codes, same ISWC) ──

test('17. two works with the same ISWC merge into one node — even when mlcSongCodes differ', () => {
  const iswc = 'T-017000017-7';
  const n1 = addOne('Test 17 Artist', rawMlcWork({
    mlcSongCode: 'T17CODE_A', workTitle: 'Different Title A', iswc,
    writers: [rawWriter({ writerIPI: 'IPI017' })],
  }));
  const n2 = addOne('Test 17 Artist', rawMlcWork({
    mlcSongCode: 'T17CODE_B', workTitle: 'Different Title B', iswc,
    writers: [rawWriter({ writerIPI: 'IPI017' })],
  }));
  assert.strictEqual(n1, n2);
  // First-observed title preserved (Board: never destroy evidence)
  assert.equal(n2.title, 'Different Title A');
  // Both MLC codes resolve to the same node
  assert.strictEqual(getCompositionByMLCSongCode('T17CODE_A'), n2);
  assert.strictEqual(getCompositionByMLCSongCode('T17CODE_B'), n2);
});

// ─── 18. (extra) lookup helpers never throw on garbage ──────────────

test('18. lookup helpers return null on null/undefined/non-string input', () => {
  assert.equal(getCompositionByISWC(null),         null);
  assert.equal(getCompositionByISWC(undefined),    null);
  assert.equal(getCompositionByISWC(42),           null);
  assert.equal(getCompositionByMLCSongCode(null),  null);
  assert.equal(getCompositionByMLCSongCode(42),    null);
  assert.equal(getWriterByIPI(null),               null);
  assert.equal(getWriterByIPI(42),                 null);
  assert.deepStrictEqual(getCompositionsForRecording(null),     []);
  assert.deepStrictEqual(getRecordingsForComposition(undefined),[]);
});

// ─── 19. (extra) linkRecordingToComposition is idempotent ────────────

test('19. linking the same (ISRC, ISWC) pair twice keeps the set size at 1', () => {
  const isrc = 'ISRC-19-IDEM';
  const iswc = 'T-019000019-9';
  linkRecordingToComposition(isrc, iswc);
  linkRecordingToComposition(isrc, iswc);
  linkRecordingToComposition(isrc, iswc);
  assert.equal(getRecordingsForComposition(iswc).length, 1);
  assert.equal(getCompositionsForRecording(isrc).length, 1);
});

// ─── 20. (extra) linkRecordingToComposition syncs CompositionNode.recordings[] ──

test('20. linkRecordingToComposition populates CompositionNode.recordings[] when the node exists', () => {
  const iswc = 'T-020000020-0';
  const node = addOne('Test 20 Artist', rawMlcWork({
    mlcSongCode: 'T20CODE', workTitle: 'Test 20', iswc,
    writers: [rawWriter({ writerIPI: 'IPI020' })],
  }));
  // Before linking
  assert.deepStrictEqual(node.recordings, []);
  linkRecordingToComposition('ISRC-20-FIRST',  iswc);
  linkRecordingToComposition('ISRC-20-SECOND', iswc);
  // After linking, the node's recordings[] is in sync
  assert.equal(node.recordings.length, 2);
  assert.ok(node.recordings.includes('ISRC-20-FIRST'));
  assert.ok(node.recordings.includes('ISRC-20-SECOND'));
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  IDENTITY GRAPH PUBLISHING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
