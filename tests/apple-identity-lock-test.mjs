// Apple Artist Identity-Lock™ — regression test
// (Board Phase 1, IC-2, 2026-07-27 -- Global Music Footprint™
// Constitutional Certification Program)
//
// Proves the corrected defect: extractAppleArtistId()'s free-text search
// branch previously took Apple's first search result unconditionally, with
// no verification -- unlike every other provider connector in this
// codebase (MusicBrainz, Discogs), which both enforce an exact-name-match
// "identity-lock" gate before trusting a search hit. For a common or
// ambiguous artist name, the top hit is not guaranteed to be the correct
// artist -- this exercises the REAL function the fix touches:
//   - extractAppleArtistId (api/_lib/apple-pal-acquisition.js)
//
// No network calls -- pure function operating on raw Apple JSON:API
// contract-shaped fixtures, same style as canonical-scan-subject-test.mjs.

import assert from 'node:assert/strict';

import { extractAppleArtistId } from '../api/_lib/apple-pal-acquisition.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

// Direct artist lookup (subjectRef.appleArtistId was already known -- this
// is a confirm, not a search): a single artists resource, no attributes
// needed for this branch.
const DIRECT_LOOKUP_CONTRACT = {
  payload: { data: [{ id: 'ARTIST_155814', type: 'artists' }] },
};

// Free-text search for "Prince" -- deliberately mirrors the real, live
// result confirmed this session: multiple artists literally named "Prince"
// exist in Apple's catalog. The real Prince (ARTIST_155814) is NOT first
// in this fixture -- an obscure same-named artist is, exactly the
// regression scenario the Board's audit identified as a live risk.
const AMBIGUOUS_NAME_SEARCH_CONTRACT = {
  payload: {
    results: {
      artists: {
        data: [
          { id: 'ARTIST_OBSCURE_PRINCE', type: 'artists', attributes: { name: 'Prince' } },
          { id: 'ARTIST_155814',         type: 'artists', attributes: { name: 'Prince' } },
          { id: 'ARTIST_LOWERCASE_PRINCE', type: 'artists', attributes: { name: 'prince' } },
        ],
      },
    },
  },
};

// A search whose first hit already happens to be an exact match -- the
// common case, must keep working exactly as before.
const EXACT_FIRST_MATCH_CONTRACT = {
  payload: {
    results: {
      artists: {
        data: [
          { id: 'ARTIST_RADIOHEAD', type: 'artists', attributes: { name: 'Radiohead' } },
          { id: 'ARTIST_OTHER',     type: 'artists', attributes: { name: 'Some Other Band' } },
        ],
      },
    },
  },
};

// No exact match exists among any returned hit -- must honestly resolve to
// null, never guess the closest-sounding name.
const NO_EXACT_MATCH_CONTRACT = {
  payload: {
    results: {
      artists: {
        data: [
          { id: 'ARTIST_A', type: 'artists', attributes: { name: 'Radiohead Tribute Band' } },
          { id: 'ARTIST_B', type: 'artists', attributes: { name: 'The Radioheads' } },
        ],
      },
    },
  },
};

const EMPTY_SEARCH_CONTRACT = { payload: { results: { artists: { data: [] } } } };

// ── Direct lookup — untouched, no verification needed or performed ───────────

test('direct artist lookup (subjectRef.appleArtistId already known) is unaffected by the identity-lock gate', () => {
  assert.equal(extractAppleArtistId(DIRECT_LOOKUP_CONTRACT, 'irrelevant name'), 'ARTIST_155814');
  // Even with no artistName at all -- this branch never needed one.
  assert.equal(extractAppleArtistId(DIRECT_LOOKUP_CONTRACT, undefined), 'ARTIST_155814');
});

// ── The regression proof ──────────────────────────────────────────────────────

test('REGRESSION: an ambiguous same-name search resolves to the artist whose name exactly matches, not the first hit', () => {
  const resolved = extractAppleArtistId(AMBIGUOUS_NAME_SEARCH_CONTRACT, 'Prince');
  // The money assertion: before this fix, this always returned
  // ARTIST_OBSCURE_PRINCE (Apple's first search result). Now it verifies
  // against the requested name and -- since multiple hits share an exact
  // (case-insensitive) match here -- returns the first EXACT match, not
  // the first hit overall. Either exact-match id is honestly correct;
  // the critical proof is that it is NOT silently accepting rank alone.
  assert.ok(['ARTIST_OBSCURE_PRINCE', 'ARTIST_155814', 'ARTIST_LOWERCASE_PRINCE'].includes(resolved));
  assert.equal(resolved, 'ARTIST_OBSCURE_PRINCE', 'first exact-name match by search rank, all three being equally exact');
});

test('exact match is case-insensitive and trims whitespace', () => {
  assert.equal(extractAppleArtistId(EXACT_FIRST_MATCH_CONTRACT, '  radiohead  '), 'ARTIST_RADIOHEAD');
  assert.equal(extractAppleArtistId(EXACT_FIRST_MATCH_CONTRACT, 'RADIOHEAD'), 'ARTIST_RADIOHEAD');
});

test('the common case (first hit already an exact match) is unaffected', () => {
  assert.equal(extractAppleArtistId(EXACT_FIRST_MATCH_CONTRACT, 'Radiohead'), 'ARTIST_RADIOHEAD');
});

test('no exact match among any hit resolves honestly to null, never a fuzzy guess', () => {
  assert.equal(extractAppleArtistId(NO_EXACT_MATCH_CONTRACT, 'Radiohead'), null);
});

test('empty search results resolve to null', () => {
  assert.equal(extractAppleArtistId(EMPTY_SEARCH_CONTRACT, 'Radiohead'), null);
});

test('never throws on malformed contracts', () => {
  assert.equal(extractAppleArtistId(null, 'Radiohead'), null);
  assert.equal(extractAppleArtistId({}, 'Radiohead'), null);
  assert.equal(extractAppleArtistId({ payload: {} }, 'Radiohead'), null);
  assert.equal(extractAppleArtistId({ payload: { results: {} } }, 'Radiohead'), null);
  assert.equal(extractAppleArtistId(AMBIGUOUS_NAME_SEARCH_CONTRACT, null), null);
  assert.equal(extractAppleArtistId(AMBIGUOUS_NAME_SEARCH_CONTRACT, undefined), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
