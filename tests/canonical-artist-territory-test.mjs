// Canonical Artist Territory Intelligence™ — regression test
// (Global Music Footprint™ Artist-Level Territory Intelligence, Board
// Decree 2026-07-25)
//
// Proves the corrected defect: artist-only scans previously evaluated one
// arbitrary catalog-order album (extractFirstAlbumId()) as if it
// represented the whole artist. This exercises the REAL functions the fix
// touches:
//   - extractAlbumCandidates (api/_lib/apple-pal-acquisition.js)
//   - selectTopVerifiedReleases (api/_lib/best-verified-release.js)
//   - assembleTerritoryIntelligence (api/_lib/territory-intelligence.js) --
//     the REAL Engine, proving it needs zero changes and correctly
//     OR-aggregates a merged multi-album evidence package exactly as it
//     already did for a single album.
//
// No network calls -- pure functions operating on raw Apple JSON:API
// contract-shaped fixtures, same style as canonical-scan-subject-test.mjs.

import assert from 'node:assert/strict';

import { extractAlbumCandidates } from '../api/_lib/apple-pal-acquisition.js';
import { selectTopVerifiedReleases } from '../api/_lib/best-verified-release.js';
import { assembleTerritoryIntelligence, TerritoryState } from '../api/_lib/territory-intelligence.js';
import { Capability } from '../provider-acquisition/capability/capabilityVocabulary.js';

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

// Raw ALBUMS contract (JSON:API shape) -- deliberately catalog-order first
// album (PURPLE_COMPILATION) is a low-scoring, metadata-sparse release; a
// later album (PURPLE_FLAGSHIP) is the well-verified, high-scoring one.
// This mirrors the exact Prince-shaped scenario: "first in Apple's default
// order" is not "the artist's real footprint."
const ALBUMS_CONTRACT = {
  payload: {
    data: [
      {
        id: 'ALBUM_COMPILATION_SPARSE', type: 'albums',
        attributes: { name: 'Rarities Vol. 3', trackCount: 4 }, // no releaseDate/artwork/url -- low score
      },
      {
        id: 'ALBUM_FLAGSHIP', type: 'albums',
        attributes: {
          name: 'Purple Rain', trackCount: 9, releaseDate: '1984-06-25',
          artwork: { url: 'https://example.com/art/{w}x{h}bb.jpg' },
          url: 'https://music.apple.com/album/purple-rain',
        },
      },
      {
        id: 'ALBUM_SECOND_FLAGSHIP', type: 'albums',
        attributes: {
          name: '1999', trackCount: 11, releaseDate: '1982-10-27',
          artwork: { url: 'https://example.com/art2/{w}x{h}bb.jpg' },
          url: 'https://music.apple.com/album/1999',
        },
      },
      { id: 'NOT_AN_ALBUM', type: 'songs', attributes: { name: 'stray song resource' } },
    ],
  },
};

const ARTIST_NAME = 'Prince';

// ── extractAlbumCandidates ────────────────────────────────────────────────────

test('extractAlbumCandidates flattens only type:albums entries, drops non-album resources', () => {
  const candidates = extractAlbumCandidates(ALBUMS_CONTRACT);
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every(c => c.id !== 'NOT_AN_ALBUM'));
});

test('extractAlbumCandidates maps the flat shape selectTopVerifiedReleases expects', () => {
  const [first] = extractAlbumCandidates(ALBUMS_CONTRACT);
  assert.equal(first.id, 'ALBUM_COMPILATION_SPARSE');
  assert.equal(first.name, 'Rarities Vol. 3');
  assert.equal(first.trackCount, 4);
  assert.equal(first.releaseDate, null);
  assert.equal(first.artwork, null);
});

test('extractAlbumCandidates never throws on malformed contracts', () => {
  assert.deepEqual(extractAlbumCandidates(null), []);
  assert.deepEqual(extractAlbumCandidates({}), []);
  assert.deepEqual(extractAlbumCandidates({ payload: {} }), []);
  assert.deepEqual(extractAlbumCandidates({ payload: { data: 'not-an-array' } }), []);
});

// ── The regression proof: ranking, not catalog order, drives selection ───────

test('REGRESSION: the sparse catalog-order-first album is NOT the top-ranked candidate', () => {
  const candidates = extractAlbumCandidates(ALBUMS_CONTRACT);
  const ranked = selectTopVerifiedReleases(candidates, ARTIST_NAME, 5);

  assert.ok(ranked.length >= 2, 'both flagship albums are eligible and ranked');
  // The money assertion: before this fix, Territory Intelligence's
  // AVAILABILITY request always carried ALBUM_COMPILATION_SPARSE (first in
  // catalog order). Now the sample is led by well-verified releases.
  assert.notEqual(ranked[0].id, 'ALBUM_COMPILATION_SPARSE');
  assert.ok(['ALBUM_FLAGSHIP', 'ALBUM_SECOND_FLAGSHIP'].includes(ranked[0].id));
});

test('selectTopVerifiedReleases(n=5) on a 3-album pool returns all 3 real candidates as the sample', () => {
  const candidates = extractAlbumCandidates(ALBUMS_CONTRACT);
  const ranked = selectTopVerifiedReleases(candidates, ARTIST_NAME, 5);
  assert.equal(ranked.length, 3); // all 3 eligible albums (compilation still eligible, just lower-ranked)
  const ids = ranked.map(r => r.id);
  assert.ok(ids.includes('ALBUM_FLAGSHIP'));
  assert.ok(ids.includes('ALBUM_SECOND_FLAGSHIP'));
  assert.ok(ids.includes('ALBUM_COMPILATION_SPARSE'));
});

// ── Territory Intelligence Engine™ — proves the REAL Engine needs zero changes ──

test('Engine (real, unmodified): a storefront matching ANY sampled album reconciles to AVAILABLE', () => {
  // Simulates the merged evidence AppleMusicConnector#fetchGlobalStorefrontAvailability
  // now produces: 'us' carries ALBUM_FLAGSHIP (not the other two); 'jp' carries none.
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-25T00:00:00.000Z',
      health: { state: 'AVAILABLE' },
      payload: {
        albumIds: ['ALBUM_FLAGSHIP', 'ALBUM_SECOND_FLAGSHIP', 'ALBUM_COMPILATION_SPARSE'],
        storefronts: {
          us: { data: [{ id: 'ALBUM_FLAGSHIP', type: 'albums' }] },
          jp: { data: [] },
        },
      },
    },
  }];

  const report = assembleTerritoryIntelligence(evidencePackages);
  const us = report.territories.find(t => t.code === 'us');
  const jp = report.territories.find(t => t.code === 'jp');

  assert.equal(us.state, TerritoryState.AVAILABLE, 'US carries one of the three sampled albums -- AVAILABLE');
  assert.equal(jp.state, TerritoryState.UNAVAILABLE, 'JP carries none of the sample -- genuinely UNAVAILABLE, not fabricated');
});

test('Engine (real, unmodified): storefronts absent from the acquisition response reconcile to NOT_EVALUATED, never UNAVAILABLE', () => {
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-25T00:00:00.000Z',
      health: { state: 'AVAILABLE' },
      payload: {
        albumIds: ['ALBUM_FLAGSHIP'],
        storefronts: { us: { data: [{ id: 'ALBUM_FLAGSHIP', type: 'albums' }] } }, // only 'us' present in the response
      },
    },
  }];
  const report = assembleTerritoryIntelligence(evidencePackages);
  const gb = report.territories.find(t => t.code === 'gb'); // never appeared in the payload at all
  assert.equal(gb.state, TerritoryState.NOT_EVALUATED, 'a code absent from the response is honestly NOT_EVALUATED, not collapsed into Missing');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
