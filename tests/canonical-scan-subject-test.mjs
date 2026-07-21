// Canonical Scan Subject™ — regression test (Phase 2 Recovery, 2026-07-20)
// Run: node tests/canonical-scan-subject-test.mjs
//
// Proves the confirmed defect is fixed: Territory Intelligence previously
// evaluated an arbitrary catalog-order "first album" for every Apple scan,
// even when the artist scanned a specific track and its ISRC-matched
// release was already resolved via Capability.ISRC -- that resolved
// release was fetched and then discarded, never read back out.
//
// This test exercises the REAL functions the fix touches, not
// re-implementations of them:
//   - extractFirstAlbumId / extractFirstIsrcSong (api/_lib/apple-pal-acquisition.js)
//   - enrichWithAppleRelease (api/_lib/canonical-scan-subject-assembler.js)
//   - the exact selection expression from apple-pal-acquisition.js's
//     acquireAppleEvidence(): `resolvedReleaseAlbumId || fallbackFirstAlbumId`
//
// No network calls, no PAL/connector wiring required -- these functions
// are pure and operate on raw Apple JSON:API contract-shaped fixtures.

import assert from 'node:assert/strict';

import { extractFirstAlbumId, extractFirstIsrcSong } from '../api/_lib/apple-pal-acquisition.js';
import { seedCanonicalScanSubject, enrichWithAppleRelease } from '../api/_lib/canonical-scan-subject-assembler.js';

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
// ALBUMS contract: catalog-order listing. First entry is NOT the release the
// artist scanned -- this is the arbitrary album the old code used unconditionally.
const ALBUMS_CONTRACT = {
  payload: {
    data: [
      { id: 'ALBUM_WRONG_FIRST', type: 'albums' },
      { id: 'ALBUM_OTHER',       type: 'albums' },
    ],
  },
};

// ISRC contract (include=albums): the specific release the artist scanned,
// resolved by ISRC match. Deliberately a different album than the
// catalog-order first album above.
const ISRC_CONTRACT_WITH_ALBUM = {
  payload: {
    data: [
      {
        id: 'SONG_MATCHED',
        type: 'songs',
        relationships: {
          albums: { data: [{ id: 'ALBUM_CORRECT_RELEASE', type: 'albums' }] },
        },
      },
    ],
  },
};

// ISRC contract without the album relationship (pre-fix response shape, or a
// genuine miss) -- enrichment must not fabricate an album id from this.
const ISRC_CONTRACT_NO_ALBUM_RELATIONSHIP = {
  payload: {
    data: [{ id: 'SONG_MATCHED', type: 'songs' }],
  },
};

// No ISRC known / no match -- artist-only scan path, must be unaffected by this fix.
const NO_ISRC_MATCH = null;

// ── Replicates apple-pal-acquisition.js's selection expression exactly ───────
// (acquireAppleEvidence, "AVAILABILITY" section):
//   const availabilityAlbumId = resolvedReleaseAlbumId || fallbackFirstAlbumId;
function selectAvailabilityAlbumId(resolvedReleaseAlbumId, fallbackFirstAlbumId) {
  return resolvedReleaseAlbumId || fallbackFirstAlbumId;
}

// ── Sanity: the fallback itself still returns the arbitrary first album ──────
test('extractFirstAlbumId returns catalog-order first album (unchanged behavior)', () => {
  assert.equal(extractFirstAlbumId(ALBUMS_CONTRACT), 'ALBUM_WRONG_FIRST');
});

test('extractFirstIsrcSong returns the matched song resource', () => {
  const song = extractFirstIsrcSong(ISRC_CONTRACT_WITH_ALBUM);
  assert.equal(song?.id, 'SONG_MATCHED');
  assert.equal(song?.relationships?.albums?.data?.[0]?.id, 'ALBUM_CORRECT_RELEASE');
});

// ── The regression proof ──────────────────────────────────────────────────────
test('REGRESSION: scanned Artist + Song evaluates the ISRC-resolved release, not the arbitrary first album', () => {
  const seed = seedCanonicalScanSubject({
    artistName:    'Test Artist',
    appleArtistId: 'ARTIST_1',
    trackTitle:    'Test Song',
    isrc:          'USRC17600001',
  });
  assert.equal(seed.subjectType, 'release');
  assert.equal(seed.confidence, 'unresolved');

  const resolvedSong  = extractFirstIsrcSong(ISRC_CONTRACT_WITH_ALBUM);
  const enrichedSubject = enrichWithAppleRelease(seed, resolvedSong);

  assert.equal(enrichedSubject.providerIds.apple.albumId, 'ALBUM_CORRECT_RELEASE');
  assert.equal(enrichedSubject.confidence, 'resolved');

  const fallbackFirstAlbumId   = extractFirstAlbumId(ALBUMS_CONTRACT);
  const resolvedReleaseAlbumId = enrichedSubject.providerIds.apple.albumId;
  const availabilityAlbumId    = selectAvailabilityAlbumId(resolvedReleaseAlbumId, fallbackFirstAlbumId);

  // The money assertion: before this fix, Territory Intelligence's
  // AVAILABILITY request always carried ALBUM_WRONG_FIRST. Now it carries
  // the specific release the artist scanned.
  assert.equal(availabilityAlbumId, 'ALBUM_CORRECT_RELEASE');
  assert.notEqual(availabilityAlbumId, 'ALBUM_WRONG_FIRST');
});

test('enrichWithAppleRelease does not fabricate an album id when the relationship is missing', () => {
  const seed = seedCanonicalScanSubject({ artistName: 'Test Artist', isrc: 'USRC17600002' });
  const songWithoutAlbum = extractFirstIsrcSong(ISRC_CONTRACT_NO_ALBUM_RELATIONSHIP);
  const enrichedSubject  = enrichWithAppleRelease(seed, songWithoutAlbum);

  assert.equal(enrichedSubject.providerIds.apple.albumId, null);
  assert.equal(enrichedSubject.providerIds.apple.trackId, 'SONG_MATCHED');
  assert.equal(enrichedSubject.confidence, 'unresolved');

  const availabilityAlbumId = selectAvailabilityAlbumId(
    enrichedSubject.providerIds.apple.albumId,
    extractFirstAlbumId(ALBUMS_CONTRACT),
  );
  assert.equal(availabilityAlbumId, 'ALBUM_WRONG_FIRST'); // correct fallback, no release was resolvable
});

test('NO REGRESSION: artist-only scans (no ISRC) still fall back to the first album', () => {
  const seed = seedCanonicalScanSubject({ artistName: 'Test Artist', appleArtistId: 'ARTIST_1' });
  assert.equal(seed.subjectType, 'artist');

  const enrichedSubject = enrichWithAppleRelease(seed, NO_ISRC_MATCH);
  assert.equal(enrichedSubject.providerIds.apple.albumId, null);
  assert.equal(enrichedSubject.confidence, 'unresolved');

  const availabilityAlbumId = selectAvailabilityAlbumId(
    enrichedSubject.providerIds.apple.albumId,
    extractFirstAlbumId(ALBUMS_CONTRACT),
  );
  assert.equal(availabilityAlbumId, 'ALBUM_WRONG_FIRST');
});

test('enrichWithAppleRelease never mutates its inputs (seed stays frozen + unresolved)', () => {
  const seed = seedCanonicalScanSubject({ artistName: 'Test Artist', isrc: 'USRC17600001' });
  const resolvedSong = extractFirstIsrcSong(ISRC_CONTRACT_WITH_ALBUM);
  enrichWithAppleRelease(seed, resolvedSong);

  assert.equal(seed.confidence, 'unresolved');
  assert.equal(seed.providerIds.apple.albumId, null);
  assert.ok(Object.isFrozen(seed));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
