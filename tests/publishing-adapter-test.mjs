// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing Intelligence Adapter™ — unit tests
// ─────────────────────────────────────────────────────────────────────
//
//  Fixtures use the actual MLC response format observed live on
//  2026-06-10 via api/mlc-test.js (?title=Shape of You&writers=ed):
//
//      {
//        mlcSongCode:  'EA082P',
//        workTitle:    'ED SHEERAN SHAPE OF YOU (LATIN REMIX)',
//        iswc:         null,
//        writers: [{
//          writerFirstName: null,
//          writerLastName:  'ED SHEERAN',
//          writerIPI:       '00583552527',
//          writerId:        '8315641',
//          writerRoleCode:  'Composer/Author'
//        }]
//      }
//
//  Convention: simple counter + throws on failure (matches
//  tests/pipeline-test.mjs). No test framework.
// ─────────────────────────────────────────────────────────────────────

import { strict as assert } from 'node:assert';
import {
  normalizeMlcWork,
  normalizeMlcWorks,
  validatePublishingWork,
} from '../lib/publishing/mlc-adapter.js';

// ─── Fixtures ────────────────────────────────────────────────────────

// Live data #1 — captured from prod /api/mlc-test
const RAW_SHAPE_OF_YOU_LATIN = Object.freeze({
  mlcSongCode: 'EA082P',
  workTitle:   'ED SHEERAN SHAPE OF YOU (LATIN REMIX)',
  iswc:        null,
  writers: [
    {
      writerFirstName: null,
      writerLastName:  'ED SHEERAN',
      writerIPI:       '00583552527',
      writerId:        '8315641',
      writerRoleCode:  'Composer/Author',
    },
  ],
});

// Live data #2 — second work returned in the same response
const RAW_SHAPE_OF_YOU_LIVE = Object.freeze({
  mlcSongCode: 'S831QA',
  workTitle:   'SHAPE OF YOU - LIVE',
  iswc:        null,
  writers: [
    {
      writerFirstName: null,
      writerLastName:  'ED SHEERAN',
      writerIPI:       '00583552527',
      writerId:        '8315641',
      writerRoleCode:  'Composer/Author',
    },
  ],
});

// Synthetic — full writer name + ISWC + IPI → HIGH confidence
const RAW_WITH_ISWC_AND_FULL_NAMES = Object.freeze({
  mlcSongCode: 'AB1234',
  workTitle:   '  Sample Work  ', // padded — trim() should strip the outer whitespace
  iswc:        'T-123456789-0',
  writers: [
    {
      writerFirstName: 'John',
      writerLastName:  'Doe',
      writerIPI:       '1234567',
      writerId:        'wid1',
      writerRoleCode:  'Composer',
    },
  ],
});

// Synthetic — missing writers (empty array)
const RAW_NO_WRITERS = Object.freeze({
  mlcSongCode: 'X1',
  workTitle:   'Test',
  iswc:        null,
  writers:     [],
});

// Synthetic — missing core identity (no mlcSongCode)
const RAW_NO_SONGCODE = Object.freeze({
  workTitle: 'Test',
  iswc: null,
  writers: [{ writerLastName: 'Doe' }],
});

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

// ─── 1. Valid single work normalization ──────────────────────────────

test('valid single work normalization (Shape of You · Latin Remix)', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  assert.ok(w, 'should return a non-null work');
  assert.equal(w.title,          'ED SHEERAN SHAPE OF YOU (LATIN REMIX)');
  assert.equal(w.canonicalTitle, 'ED SHEERAN SHAPE OF YOU (LATIN REMIX)');
  assert.equal(w.mlcSongCode,    'EA082P');
  assert.equal(w.iswc,           null);
  assert.equal(w.source,         'mlc');
  assert.ok(Array.isArray(w.writers));
  assert.equal(w.writers.length, 1);
  assert.equal(w.writers[0].firstName, null);
  assert.equal(w.writers[0].lastName,  'ED SHEERAN');
  assert.equal(w.writers[0].fullName,  'ED SHEERAN'); // derived from lastName only
  assert.equal(w.writers[0].writerIPI, '00583552527');
  assert.equal(w.writers[0].writerId,  '8315641');
  assert.equal(w.writers[0].role,      'Composer/Author');
  assert.ok(typeof w.lastUpdated === 'string');
  assert.match(w.lastUpdated, /^\d{4}-\d{2}-\d{2}T/, 'lastUpdated should be ISO');
  assert.ok(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].includes(w.confidence));
});

// ─── 2. Valid multi-work normalization ───────────────────────────────

test('valid multi-work normalization (both Shape of You records)', () => {
  const list = normalizeMlcWorks([RAW_SHAPE_OF_YOU_LATIN, RAW_SHAPE_OF_YOU_LIVE]);
  assert.equal(list.length, 2);
  assert.equal(list[0].mlcSongCode, 'EA082P');
  assert.equal(list[1].mlcSongCode, 'S831QA');
  assert.equal(list[1].title,       'SHAPE OF YOU - LIVE');
});

// ─── 3. Missing ISWC → null, not error ───────────────────────────────

test('missing ISWC surfaces as null (never an error)', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  assert.equal(w.iswc, null);
  // and validation still passes
  assert.equal(validatePublishingWork(w).valid, true);
});

// ─── 4. Missing writers → null work ──────────────────────────────────

test('missing writers (empty array) → normalizeMlcWork returns null', () => {
  const w = normalizeMlcWork(RAW_NO_WRITERS);
  assert.equal(w, null);
});

// ─── 5. Publishers array always present (empty) ──────────────────────

test('publishers array is always present (empty placeholder)', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  assert.ok(Array.isArray(w.publishers));
  assert.equal(w.publishers.length, 0);
});

// ─── 6. rawMlcResponse preserved exactly ─────────────────────────────

test('rawMlcResponse preserves the original input by reference', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  // Same reference — the raw object is not cloned or mutated
  assert.strictEqual(w.rawMlcResponse, RAW_SHAPE_OF_YOU_LATIN);
  // Deep-equality holds (sanity)
  assert.deepStrictEqual(w.rawMlcResponse, RAW_SHAPE_OF_YOU_LATIN);
});

// ─── 7. validatePublishingWork passes for valid work ─────────────────

test('validatePublishingWork returns { valid: true, errors: [] } for a normalized work', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  const result = validatePublishingWork(w);
  assert.equal(result.valid,  true);
  assert.deepStrictEqual(result.errors, []);
});

// ─── 8. validatePublishingWork fails for missing title ───────────────

test('validatePublishingWork returns { valid: false } when title is missing', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  const broken = { ...w, title: null };
  const result = validatePublishingWork(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('missing_title'), `expected 'missing_title' in errors, got ${JSON.stringify(result.errors)}`);
});

// ─── Additional sanity coverage ──────────────────────────────────────

test('whitespace trim on workTitle (outer padding stripped)', () => {
  const w = normalizeMlcWork(RAW_WITH_ISWC_AND_FULL_NAMES);
  assert.equal(w.title,          'Sample Work');
  assert.equal(w.canonicalTitle, 'Sample Work');
});

test('fullName derived correctly when both firstName + lastName present', () => {
  const w = normalizeMlcWork(RAW_WITH_ISWC_AND_FULL_NAMES);
  assert.equal(w.writers[0].firstName, 'John');
  assert.equal(w.writers[0].lastName,  'Doe');
  assert.equal(w.writers[0].fullName,  'John Doe');
});

test('confidence = HIGH when ISWC AND writer IPI both present', () => {
  const w = normalizeMlcWork(RAW_WITH_ISWC_AND_FULL_NAMES);
  assert.equal(w.confidence, 'HIGH');
});

test('confidence = MEDIUM when only writer IPI present (no ISWC)', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  assert.equal(w.confidence, 'MEDIUM');
});

test('confidence = LOW when writers present but neither ISWC nor any IPI', () => {
  const raw = {
    mlcSongCode: 'NOIPI',
    workTitle:   'No Identifiers',
    iswc:        null,
    writers: [{ writerFirstName: 'Jane', writerLastName: 'Roe', writerRoleCode: 'Composer' }],
  };
  const w = normalizeMlcWork(raw);
  assert.equal(w.confidence, 'LOW');
});

test('missing mlcSongCode → null work', () => {
  const w = normalizeMlcWork(RAW_NO_SONGCODE);
  assert.equal(w, null);
});

test('normalizeMlcWork never throws on invalid input', () => {
  assert.equal(normalizeMlcWork(null),           null);
  assert.equal(normalizeMlcWork(undefined),      null);
  assert.equal(normalizeMlcWork(42),             null);
  assert.equal(normalizeMlcWork('string'),       null);
  assert.equal(normalizeMlcWork({}),             null);
  assert.equal(normalizeMlcWork([]),             null);
  assert.equal(normalizeMlcWork({ workTitle: 'x' }), null); // missing songCode
});

test('normalizeMlcWorks filters nulls and tolerates garbage', () => {
  const mixed = [RAW_SHAPE_OF_YOU_LATIN, null, undefined, 42, 'x', { invalid: true }, RAW_SHAPE_OF_YOU_LIVE];
  const list  = normalizeMlcWorks(mixed);
  assert.equal(list.length, 2);
  assert.equal(list[0].mlcSongCode, 'EA082P');
  assert.equal(list[1].mlcSongCode, 'S831QA');
});

test('normalizeMlcWorks returns [] for non-array input', () => {
  assert.deepStrictEqual(normalizeMlcWorks(null),      []);
  assert.deepStrictEqual(normalizeMlcWorks(undefined), []);
  assert.deepStrictEqual(normalizeMlcWorks({}),        []);
  assert.deepStrictEqual(normalizeMlcWorks(42),        []);
});

test('validatePublishingWork rejects non-object input', () => {
  assert.equal(validatePublishingWork(null).valid,      false);
  assert.equal(validatePublishingWork(undefined).valid, false);
  assert.equal(validatePublishingWork(42).valid,        false);
  assert.equal(validatePublishingWork([]).valid,        false);
});

test('validatePublishingWork catches multiple missing fields at once', () => {
  const broken = { source: 'mlc', writers: [], publishers: [] };
  const result = validatePublishingWork(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('missing_title'));
  assert.ok(result.errors.includes('missing_mlcSongCode'));
  assert.ok(result.errors.includes('writers_array_empty'));
});

test('source field is locked to "mlc"', () => {
  const w = normalizeMlcWork(RAW_SHAPE_OF_YOU_LATIN);
  assert.equal(w.source, 'mlc');
  const tampered = { ...w, source: 'other' };
  assert.equal(validatePublishingWork(tampered).valid, false);
  assert.ok(validatePublishingWork(tampered).errors.includes('source_mismatch'));
});

// ─── Summary ─────────────────────────────────────────────────────────

console.log('');
console.log('═════════════════════════════════════════════');
console.log(`  PUBLISHING ADAPTER VERIFIED: ${passed} assertions passed`);
console.log('═════════════════════════════════════════════');
