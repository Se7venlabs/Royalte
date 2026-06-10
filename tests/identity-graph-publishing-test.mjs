// ─────────────────────────────────────────────────────────────────────
//  Royaltē Identity Graph™ — Publishing Layer · unit tests (Phase 3)
// ─────────────────────────────────────────────────────────────────────
//
//  Board-ratified test surface (2026-06-10) + Phase 3 cleanup pass.
//  Exactly 23 deterministic assertions:
//    1–15 : original Phase 3 brief tests (test 11 modernised to use
//           getCompositionByProviderId, tests 1 and 15 updated to use
//           externalIds and to assert the new royalteId field)
//    16–23: Phase 3 cleanup brief — getCompositionByProviderId across
//           providers, royalteId lifecycle, externalIds field presence,
//           multi-provider merge preserving royalteId
//
//  Determinism strategy: the graph is module-scoped in-memory state
//  (Board rule A). Tests use UNIQUE artist keys + UNIQUE external IDs
//  + UNIQUE writerIPIs + UNIQUE ISWCs + UNIQUE ISRCs per case so no
//  test depends on the residue of any other.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import { normalizeMlcWork } from '../lib/publishing/mlc-adapter.js';
import {
  addPublishingWork,
  getPublishingWorks,
  getCompositionByISWC,
  getCompositionByProviderId,
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

function addOne(artistName, rawWork) {
  const pw = normalizeMlcWork(rawWork);
  return addPublishingWork(artistName, pw);
}

// Provider-agnostic PublishingWork-shaped object — used to simulate
// future SOCAN / ASCAP / BMI / etc. adapters in tests 15, 18, 19, 23.
function pwLike({ source, externalId, title, iswc = null, writerIPI, role = 'Composer' }) {
  return {
    title,
    canonicalTitle: title,
    mlcSongCode:    externalId,   // Phase-2 schema carries the provider's work ID in this slot
    iswc,
    writers: [{
      writerIPI,
      firstName: 'Sim',
      lastName:  'Writer',
      fullName:  'Sim Writer',
      role,
    }],
    publishers:     [],
    source,
    rawMlcResponse: { provider: source, body: 'opaque' },
    lastUpdated:    new Date().toISOString(),
    confidence:     'MEDIUM',
  };
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

// ═════════════════════════════════════════════════════════════════════
//  Tests 1–15 — Phase 3 original brief (with cleanup-pass updates)
// ═════════════════════════════════════════════════════════════════════

test('1. addPublishingWork stores a CompositionNode with the Board-ratified shape', () => {
  const node = addOne('Test 1 Artist', rawMlcWork({
    mlcSongCode: 'T01CODE',
    workTitle:   'Test 1 Work',
    iswc:        'T-001000001-1',
    writers:     [rawWriter({ writerFirstName: 'A', writerLastName: 'One', writerIPI: 'IPI001' })],
  }));

  assert.ok(node, 'should return a non-null node');
  // royalteId
  assert.ok(typeof node.royalteId === 'string' && node.royalteId.startsWith('rc_'));
  // externalIds (renamed from providerIds)
  assert.equal(node.externalIds.mlc,         'T01CODE');
  assert.equal(node.externalIds.socan,       null);
  assert.equal(node.externalIds.ascap,       null);
  assert.equal(node.externalIds.bmi,         null);
  assert.equal(node.externalIds.cisac,       null);
  assert.equal(node.externalIds.musicbrainz, null);
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
  // graph confidence
  assert.equal(node.confidence, 'UNKNOWN');
  // timestamps
  assert.match(node.addedAt,        /^\d{4}-\d{2}-\d{2}T/);
  assert.match(node.lastObservedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('2. duplicate mlc external ID → merges into the same node (no duplicate created)', () => {
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
  assert.equal(list[0].externalIds.mlc, code);
});

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
  assert.equal(node.writers[0].lastName, 'Original'); // never destroyed
});

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
  assert.equal(node.writers.length, 2);
});

test('5. null ISWC is stored safely and lookup by ISWC misses cleanly', () => {
  const node = addOne('Test 5 Artist', rawMlcWork({
    mlcSongCode: 'T05CODE', workTitle: 'Test 5 Work', iswc: null,
    writers: [rawWriter({ writerIPI: 'IPI005' })],
  }));
  assert.equal(node.iswc, null);
  assert.equal(getCompositionByISWC(null), null);
});

test('6. publishers array is always present and empty (MLC has no publisher data)', () => {
  const node = addOne('Test 6 Artist', rawMlcWork({
    mlcSongCode: 'T06CODE', workTitle: 'Test 6 Work',
    writers: [rawWriter({ writerIPI: 'IPI006' })],
  }));
  assert.ok(Array.isArray(node.publishers));
  assert.equal(node.publishers.length, 0);
});

test('7. one ISWC can have many ISRCs (covers, remixes, live versions)', () => {
  const iswc = 'T-007000007-7';
  linkRecordingToComposition('ISRC-7-A', iswc);
  linkRecordingToComposition('ISRC-7-B', iswc);
  linkRecordingToComposition('ISRC-7-C', iswc);
  const recordings = getRecordingsForComposition(iswc);
  assert.equal(recordings.length, 3);
});

test('8. one ISRC can belong to many ISWCs (mashups, medleys) — never assume 1:1', () => {
  const isrc = 'ISRC-8-MASHUP';
  linkRecordingToComposition(isrc, 'T-008000001-X');
  linkRecordingToComposition(isrc, 'T-008000002-X');
  const comps = getCompositionsForRecording(isrc);
  assert.equal(comps.length, 2);
});

test('9. getPublishingWorks returns [] for an unknown artist (never throws)', () => {
  assert.deepStrictEqual(getPublishingWorks('No Such Artist 9'), []);
  assert.deepStrictEqual(getPublishingWorks(null),               []);
  assert.deepStrictEqual(getPublishingWorks(undefined),          []);
  assert.deepStrictEqual(getPublishingWorks(''),                 []);
});

test('10. getCompositionByISWC — found and not-found paths', () => {
  const iswc = 'T-010000010-0';
  addOne('Test 10 Artist', rawMlcWork({
    mlcSongCode: 'T10CODE', workTitle: 'Test 10', iswc,
    writers: [rawWriter({ writerIPI: 'IPI010' })],
  }));
  assert.ok(getCompositionByISWC(iswc));
  assert.equal(getCompositionByISWC('T-NEVER-ADDED-0'), null);
});

test('11. getCompositionByProviderId resolves a stored composition (provider-neutral)', () => {
  // Replacement for the prior getCompositionByMLCSongCode test — same
  // coverage via the new provider-neutral API.
  const code = 'T11CODE';
  addOne('Test 11 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 11',
    writers: [rawWriter({ writerIPI: 'IPI011' })],
  }));
  const found = getCompositionByProviderId('mlc', code);
  assert.ok(found);
  assert.equal(found.externalIds.mlc, code);
});

test('12. getWriterByIPI — found and not-found paths', () => {
  addOne('Test 12 Artist', rawMlcWork({
    mlcSongCode: 'T12CODE', workTitle: 'Test 12',
    writers: [rawWriter({ writerFirstName: 'Twelve', writerLastName: 'Writer', writerIPI: 'IPI012' })],
  }));
  const found = getWriterByIPI('IPI012');
  assert.ok(found);
  assert.equal(found.writerIPI, 'IPI012');
  assert.equal(found.lastName,  'Writer');
  assert.equal(getWriterByIPI('IPI-NEVER-ADDED'), null);
});

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
  assert.equal(node.sources[0].provider, 'mlc');
  assert.equal(node.sources[1].provider, 'mlc');
  assert.equal(node.confidence, 'UNKNOWN');
});

test('14. existing lookupYouTubeChannelId still resolves the seeded entry (backward compat)', () => {
  assert.equal(lookupYouTubeChannelId('Black Alternative'), 'UCOIO07KGdBFp9Ej40iaZRGQ');
  const entry = getYouTubeChannelEntry('Black Alternative');
  assert.ok(entry);
  assert.equal(entry.addedBy, 'founder');
});

test('15. provider-agnostic — socan-sourced PublishingWork populates externalIds.socan', () => {
  const node = addPublishingWork('Test 15 Artist', pwLike({
    source:     'socan',
    externalId: 'T15SOCAN',
    title:      'Test 15 SOCAN Work',
    iswc:       'T-015000015-5',
    writerIPI:  'IPI015',
  }));
  assert.ok(node);
  assert.equal(node.sources[0].provider, 'socan');
  assert.equal(node.externalIds.socan,   'T15SOCAN');
  assert.equal(node.externalIds.mlc,     null);
});

// ═════════════════════════════════════════════════════════════════════
//  Tests 16–23 — Phase 3 cleanup brief
// ═════════════════════════════════════════════════════════════════════

test('16. getCompositionByProviderId("mlc", code) — found', () => {
  const code = 'T16CODE';
  addOne('Test 16 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 16',
    writers: [rawWriter({ writerIPI: 'IPI016' })],
  }));
  const found = getCompositionByProviderId('mlc', code);
  assert.ok(found);
  assert.equal(found.externalIds.mlc, code);
});

test('17. getCompositionByProviderId("mlc", code) — not found returns null', () => {
  const result = getCompositionByProviderId('mlc', 'T_NEVER_EXISTED_17');
  assert.equal(result, null);
});

test('18. getCompositionByProviderId("socan", id) — simulated SOCAN lookup', () => {
  const id = 'T18-SOCAN-FAKE-ID';
  addPublishingWork('Test 18 Artist', pwLike({
    source:     'socan',
    externalId: id,
    title:      'Test 18 SOCAN Work',
    iswc:       'T-018000018-8',
    writerIPI:  'IPI018',
  }));
  const found = getCompositionByProviderId('socan', id);
  assert.ok(found);
  assert.equal(found.externalIds.socan, id);
  assert.equal(getCompositionByProviderId('socan', 'NEVER-EXISTED-18'), null);
});

test('19. getCompositionByProviderId("ascap", id) — simulated ASCAP lookup', () => {
  const id = 'T19-ASCAP-FAKE-ID';
  addPublishingWork('Test 19 Artist', pwLike({
    source:     'ascap',
    externalId: id,
    title:      'Test 19 ASCAP Work',
    iswc:       'T-019000019-A',
    writerIPI:  'IPI019',
  }));
  const found = getCompositionByProviderId('ascap', id);
  assert.ok(found);
  assert.equal(found.externalIds.ascap, id);
  assert.equal(getCompositionByProviderId('ascap', 'NEVER-EXISTED-19'), null);
});

test('20. royalteId generated on creation — starts "rc_"', () => {
  const node = addOne('Test 20 Artist', rawMlcWork({
    mlcSongCode: 'T20CODE', workTitle: 'Test 20',
    writers: [rawWriter({ writerIPI: 'IPI020' })],
  }));
  assert.ok(node);
  assert.equal(typeof node.royalteId, 'string');
  assert.ok(node.royalteId.startsWith('rc_'));
  // 'rc_' + 36-char UUID v4 = 39 chars total
  assert.equal(node.royalteId.length, 39);
});

test('21. royalteId preserved during merge — never changes', () => {
  const code = 'T21CODE';
  const first = addOne('Test 21 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 21',
    writers: [rawWriter({ writerIPI: 'IPI021' })],
  }));
  const idAtCreation = first.royalteId;
  const second = addOne('Test 21 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 21',
    writers: [rawWriter({ writerIPI: 'IPI021' })],
  }));
  assert.strictEqual(first, second);
  assert.equal(second.royalteId, idAtCreation);
  // And after a third merge — still the same
  const third = addOne('Test 21 Artist', rawMlcWork({
    mlcSongCode: code, workTitle: 'Test 21',
    writers: [rawWriter({ writerIPI: 'IPI021' })],
  }));
  assert.equal(third.royalteId, idAtCreation);
});

test('22. externalIds field present on every node with all 6 provider slots', () => {
  const node = addOne('Test 22 Artist', rawMlcWork({
    mlcSongCode: 'T22CODE', workTitle: 'Test 22',
    writers: [rawWriter({ writerIPI: 'IPI022' })],
  }));
  assert.ok(node.externalIds);
  assert.equal(typeof node.externalIds, 'object');
  assert.ok('mlc'         in node.externalIds);
  assert.ok('socan'       in node.externalIds);
  assert.ok('ascap'       in node.externalIds);
  assert.ok('bmi'         in node.externalIds);
  assert.ok('cisac'       in node.externalIds);
  assert.ok('musicbrainz' in node.externalIds);
  // Old name is gone
  assert.equal(node.providerIds, undefined);
});

test('23. two providers, same composition (shared ISWC) — externalIds contains both; royalteId unchanged', () => {
  const iswc = 'T-023000023-X';
  // First observation — MLC
  const fromMlc = addOne('Test 23 Artist', rawMlcWork({
    mlcSongCode: 'T23-MLC-ID', workTitle: 'Test 23 Composition', iswc,
    writers: [rawWriter({ writerIPI: 'IPI023' })],
  }));
  const idBefore = fromMlc.royalteId;
  // Second observation — SOCAN (different provider, same ISWC)
  const fromSocan = addPublishingWork('Test 23 Artist', pwLike({
    source:     'socan',
    externalId: 'T23-SOCAN-ID',
    title:      'Test 23 Composition',
    iswc,
    writerIPI:  'IPI023',
  }));
  // Same node reference (merged by ISWC)
  assert.strictEqual(fromMlc, fromSocan);
  // Both external IDs present
  assert.equal(fromSocan.externalIds.mlc,   'T23-MLC-ID');
  assert.equal(fromSocan.externalIds.socan, 'T23-SOCAN-ID');
  // royalteId unchanged across the multi-provider merge
  assert.equal(fromSocan.royalteId, idBefore);
  // Both reverse-lookups land on the same node
  assert.strictEqual(getCompositionByProviderId('mlc',   'T23-MLC-ID'),   fromMlc);
  assert.strictEqual(getCompositionByProviderId('socan', 'T23-SOCAN-ID'), fromMlc);
  // Two source entries — append-only history preserved
  assert.equal(fromSocan.sources.length, 2);
  assert.equal(fromSocan.sources[0].provider, 'mlc');
  assert.equal(fromSocan.sources[1].provider, 'socan');
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  IDENTITY GRAPH PUBLISHING VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
