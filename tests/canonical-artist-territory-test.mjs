// Canonical Artist Presence™ — regression test
// (Global Music Footprint™ Artist-Level Territory Intelligence, Board
// Decree 2026-07-27 -- supersedes the 2026-07-25 Best Verified Release™-
// ranked sample entirely.)
//
// Proves the corrected defect: artist-only scans previously evaluated a
// ranked SAMPLE of the artist's catalog (or, before that, one arbitrary
// catalog-order album) as if it represented the whole artist. This
// exercises the REAL functions the fix touches:
//   - extractAlbumCandidates (api/_lib/apple-pal-acquisition.js)
//   - acquireFullAlbumCatalog (api/_lib/apple-pal-acquisition.js) --
//     paginates the artist's full catalog via a mocked pal.acquire(),
//     dedupes, and reports honest completeness -- no network required
//   - assembleTerritoryIntelligence (api/_lib/territory-intelligence.js) --
//     the REAL Engine, proving it needs zero changes and correctly
//     OR-aggregates a merged multi-album evidence package exactly as it
//     already did before this decree
//
// No network calls -- pure functions and a mocked pal.acquire(), same
// style as canonical-scan-subject-test.mjs.

import assert from 'node:assert/strict';

import { extractAlbumCandidates, acquireFullAlbumCatalog, MAX_CATALOG_PAGES } from '../api/_lib/apple-pal-acquisition.js';
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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function albumNode(id, name, next = false) {
  return { id, type: 'albums', attributes: { name, trackCount: 8 } };
}

// Page 1: 25 albums (Apple's per-page default), including the sparse
// catalog-order-first album a prior implementation would have wrongly
// treated as the whole artist. `next` present -- more pages exist.
const PAGE_1 = {
  payload: {
    data: [
      albumNode('ALBUM_COMPILATION_SPARSE', 'Rarities Vol. 3'),
      ...Array.from({ length: 24 }, (_, i) => albumNode(`ALBUM_P1_${i}`, `Page 1 Release ${i}`)),
    ],
    next: '/v1/catalog/us/artists/155814/albums?offset=25',
  },
};

// Page 2: 5 more albums, including the well-verified flagship release that
// a top-5-by-score sample would have found, but a top-5-by-CATALOG-ORDER
// (or any fixed small N) sample could easily miss depending on ranking.
// No `next` -- this is genuinely the last page.
const PAGE_2 = {
  payload: {
    data: [
      albumNode('ALBUM_FLAGSHIP', 'Purple Rain'),
      albumNode('ALBUM_SECOND_FLAGSHIP', '1999'),
      albumNode('ALBUM_P2_2', 'Page 2 Release 2'),
      albumNode('ALBUM_P2_3', 'Page 2 Release 3'),
      { id: 'NOT_AN_ALBUM', type: 'songs', attributes: { name: 'stray song resource' } },
    ],
    next: null,
  },
};

function mockPal(pages) {
  let call = 0;
  return {
    acquire: async () => {
      const contract = pages[call];
      call += 1;
      if (!contract) return { contract: { payload: {} } };
      return { contract };
    },
  };
}

// ── extractAlbumCandidates ────────────────────────────────────────────────────

test('extractAlbumCandidates flattens only type:albums entries, drops non-album resources', () => {
  const candidates = extractAlbumCandidates(PAGE_2);
  assert.equal(candidates.length, 4);
  assert.ok(candidates.every(c => c.id !== 'NOT_AN_ALBUM'));
});

test('extractAlbumCandidates never throws on malformed contracts', () => {
  assert.deepEqual(extractAlbumCandidates(null), []);
  assert.deepEqual(extractAlbumCandidates({}), []);
  assert.deepEqual(extractAlbumCandidates({ payload: {} }), []);
  assert.deepEqual(extractAlbumCandidates({ payload: { data: 'not-an-array' } }), []);
});

// ── acquireFullAlbumCatalog — the regression proof ────────────────────────────

await testAsync('REGRESSION: full-catalog acquisition includes releases a fixed small sample could miss, via real pagination', async () => {
  const pal = mockPal([PAGE_2]); // page 1 already acquired by the caller; mock supplies page 2 onward
  const result = await acquireFullAlbumCatalog(pal, {}, PAGE_1);

  // The money assertion: every release from BOTH pages is present --
  // not a ranked top-N subset, not just page 1.
  const ids = result.candidates.map(c => c.id);
  assert.ok(ids.includes('ALBUM_COMPILATION_SPARSE'), 'page 1 releases are included');
  assert.ok(ids.includes('ALBUM_FLAGSHIP'), 'page 2 releases are included -- pagination actually followed `next`');
  assert.ok(ids.includes('ALBUM_SECOND_FLAGSHIP'));
  assert.equal(result.candidates.length, 25 + 4, '25 from page 1 + 4 real albums from page 2 (stray song resource excluded)');
});

await testAsync('acquireFullAlbumCatalog reports isCompleteCatalogEvaluation: true when pagination reaches a page with no `next`', async () => {
  const pal = mockPal([PAGE_2]);
  const result = await acquireFullAlbumCatalog(pal, {}, PAGE_1);
  assert.equal(result.isCompleteCatalogEvaluation, true);
  assert.equal(result.catalogReleaseCount, result.candidates.length);
});

await testAsync('acquireFullAlbumCatalog stops at a single page when the first page already has no `next`', async () => {
  const pal = mockPal([]); // should never be called
  const singlePage = { payload: { data: [albumNode('ONLY_ALBUM', 'Solo Release')], next: null } };
  const result = await acquireFullAlbumCatalog(pal, {}, singlePage);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.isCompleteCatalogEvaluation, true);
});

await testAsync('acquireFullAlbumCatalog dedupes by album id across pages', async () => {
  const dupePage = { payload: { data: [albumNode('ALBUM_COMPILATION_SPARSE', 'Rarities Vol. 3 (dupe)')], next: null } };
  const pal = mockPal([dupePage]);
  const result = await acquireFullAlbumCatalog(pal, {}, PAGE_1);
  const occurrences = result.candidates.filter(c => c.id === 'ALBUM_COMPILATION_SPARSE').length;
  assert.equal(occurrences, 1, 'a duplicate id across pages is never double-counted');
});

await testAsync(`acquireFullAlbumCatalog honors MAX_CATALOG_PAGES (${MAX_CATALOG_PAGES}) as a bounded safety cap, never unbounded`, async () => {
  // Every page reports `next` truthy -- an artificial catalog that never
  // ends. Pagination must still terminate.
  const infinitePage = (n) => ({ payload: { data: [albumNode(`INF_${n}`, `Infinite ${n}`)], next: `offset=${n}` } });
  const pages = Array.from({ length: MAX_CATALOG_PAGES + 5 }, (_, i) => infinitePage(i + 1));
  const pal = mockPal(pages);
  const result = await acquireFullAlbumCatalog(pal, {}, infinitePage(0));
  assert.equal(result.candidates.length, MAX_CATALOG_PAGES, 'never exceeds the safety cap even when Apple keeps signaling more pages');
  assert.equal(result.isCompleteCatalogEvaluation, false, 'truncated by the safety cap, not a genuine end-of-catalog -- honestly reported as incomplete');
});

await testAsync('acquireFullAlbumCatalog degrades honestly (stops paginating, does not throw) if a later page acquisition fails', async () => {
  const pal = { acquire: async () => { throw new Error('simulated network failure'); } };
  const result = await acquireFullAlbumCatalog(pal, {}, PAGE_1);
  assert.equal(result.candidates.length, 25, 'evaluates what page 1 already provided rather than losing all evidence');
  assert.equal(result.isCompleteCatalogEvaluation, false, 'honestly incomplete -- pagination did not reach the true end');
});

// ── Territory Intelligence Engine™ — proves the REAL Engine needs zero changes ──

test('Engine (real, unmodified): a storefront matching ANY acquired release reconciles to AVAILABLE', () => {
  // Simulates the merged evidence AppleMusicConnector#fetchGlobalStorefrontAvailability
  // now produces from a full-catalog acquisition: 'us' carries one release
  // out of many requested; 'jp' carries none.
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-27T00:00:00.000Z',
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

  assert.equal(us.state, TerritoryState.AVAILABLE, 'US carries one of the acquired releases -- AVAILABLE (canonical artist presence confirmed)');
  assert.equal(jp.state, TerritoryState.UNAVAILABLE, 'JP carries none of the acquired catalog -- genuinely UNAVAILABLE, not fabricated');
});

test('Engine (real, unmodified): storefronts absent from the acquisition response reconcile to NOT_EVALUATED, never UNAVAILABLE', () => {
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-27T00:00:00.000Z',
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

// ── Territory Evaluation Methodology™ — Canonical Artist Presence™ values ────

test('Engine surfaces evaluationMethodology verbatim from the AVAILABILITY package (artist_full_catalog)', () => {
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-27T00:00:00.000Z',
      health: { state: 'AVAILABLE' },
      payload: {
        albumIds: ['ALBUM_FLAGSHIP'],
        storefronts: { us: { data: [{ id: 'ALBUM_FLAGSHIP', type: 'albums' }] } },
        territoryMethodology: {
          evaluationScope: 'artist_full_catalog',
          sampleSize: 80,
          catalogReleaseCount: 80,
          selectionMethod: 'full_catalog_acquisition',
          isCompleteCatalogEvaluation: true,
        },
      },
    },
  }];
  const report = assembleTerritoryIntelligence(evidencePackages);
  assert.deepEqual(report.evaluationMethodology, {
    evaluationScope: 'artist_full_catalog',
    sampleSize: 80,
    catalogReleaseCount: 80,
    selectionMethod: 'full_catalog_acquisition',
    isCompleteCatalogEvaluation: true,
  });
  // Acceptance criteria (Board Decree, 2026-07-27): the methodology must
  // never describe itself using release-ranking language.
  assert.notEqual(report.evaluationMethodology.selectionMethod, 'best_verified_release');
});

test('Engine reports evaluationMethodology as null when the evidence package predates this field', () => {
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-27T00:00:00.000Z',
      health: { state: 'AVAILABLE' },
      payload: { albumIds: ['ALBUM_FLAGSHIP'], storefronts: {} }, // no territoryMethodology key
    },
  }];
  const report = assembleTerritoryIntelligence(evidencePackages);
  assert.equal(report.evaluationMethodology, null);
});

test('Engine reports evaluationMethodology as null when no AVAILABILITY package exists at all', () => {
  const report = assembleTerritoryIntelligence([]);
  assert.equal(report.evaluationMethodology, null);
});

// ── Failure-State Validation ───────────────────────────────────────────────────

test('Engine (real, unmodified): a rate-limited storefront reconciles to ERROR, never fabricated into UNAVAILABLE', () => {
  // Mirrors exactly what AppleMusicConnector#fetchGlobalStorefrontAvailability
  // writes for a storefront whose request exhausted retries against a 429 --
  // byStorefront[sf] = { error: healthState } (healthState: 'RATE_LIMITED').
  const evidencePackages = [{
    evidenceType: Capability.AVAILABILITY,
    contract: {
      acquiredAt: '2026-07-27T00:00:00.000Z',
      health: { state: 'AVAILABLE' },
      payload: {
        albumIds: ['ALBUM_FLAGSHIP'],
        storefronts: {
          us: { data: [{ id: 'ALBUM_FLAGSHIP', type: 'albums' }] },
          br: { error: 'RATE_LIMITED' },
        },
      },
    },
  }];
  const report = assembleTerritoryIntelligence(evidencePackages);
  const br = report.territories.find(t => t.code === 'br');
  assert.equal(br.state, TerritoryState.ERROR, 'a rate-limited storefront is an honest ERROR, not a fabricated UNAVAILABLE');
  assert.notEqual(br.state, TerritoryState.UNAVAILABLE);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
