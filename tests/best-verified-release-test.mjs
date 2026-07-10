// ─────────────────────────────────────────────────────────────────────
//  Best Verified Release™ Selection Engine — unit tests
// ─────────────────────────────────────────────────────────────────────

import {
  selectBestVerifiedRelease,
  BVR_VERIFICATION_WEIGHTS,
  BVR_RELEASE_TYPE_WEIGHTS,
  BVR_ARTWORK_WEIGHT,
  BVR_STREAMING_WEIGHT,
  BVR_RECENCY_WEIGHTS,
  BVR_METADATA_WEIGHT_PER_FIELD,
} from '../api/_lib/best-verified-release.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  }
}

const CURRENT_YEAR = new Date().getFullYear();

// ── Fixtures ──────────────────────────────────────────────────────────

const FULL_ALBUM = Object.freeze({
  id: 'apple-123',
  name: 'Midnight Protocols',
  trackCount: 12,
  releaseDate: `${CURRENT_YEAR - 1}-03-15`,
  url: 'https://music.apple.com/album/midnight-protocols',
  artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/midnight.jpg/300x300bb.jpg',
});

const RECENT_EP = Object.freeze({
  id: 'apple-456',
  name: 'Summer Waves',
  trackCount: 4,
  releaseDate: `${CURRENT_YEAR - 1}-07-01`,
  url: 'https://music.apple.com/album/summer-waves',
  artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/summer.jpg/300x300bb.jpg',
});

const OLD_ALBUM_NO_ARTWORK = Object.freeze({
  id: 'apple-789',
  name: 'Debut',
  trackCount: 10,
  releaseDate: '2010-01-01',
  url: 'https://music.apple.com/album/debut',
  artwork: null,
});

const SINGLE = Object.freeze({
  id: 'apple-001',
  name: 'First Light',
  trackCount: 1,
  releaseDate: `${CURRENT_YEAR}-01-01`,
  url: 'https://music.apple.com/album/first-light',
  artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/first-light.jpg/300x300bb.jpg',
});

const NO_NAME_ALBUM = Object.freeze({
  id: 'apple-002',
  name: '',
  trackCount: 8,
  releaseDate: `${CURRENT_YEAR - 1}-06-01`,
  url: 'https://music.apple.com/album/untitled',
  artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/untitled.jpg/300x300bb.jpg',
});

const ARTIST_NAME = 'GENTLEMEN X';

// ── Guard: edge cases ────────────────────────────────────────────────

console.log('\n── Null / empty inputs ──');

assert(selectBestVerifiedRelease(null, ARTIST_NAME) === null,
  'null albums → null');
assert(selectBestVerifiedRelease(undefined, ARTIST_NAME) === null,
  'undefined albums → null');
assert(selectBestVerifiedRelease([], ARTIST_NAME) === null,
  'empty albums → null');
assert(selectBestVerifiedRelease([NO_NAME_ALBUM], ARTIST_NAME) === null,
  'album with no name → not eligible → null');
assert(selectBestVerifiedRelease([{ trackCount: 5 }], ARTIST_NAME) === null,
  'album with no name field → not eligible → null');

// ── Single candidate ─────────────────────────────────────────────────

console.log('\n── Single candidate ──');

{
  const result = selectBestVerifiedRelease([FULL_ALBUM], ARTIST_NAME);
  assert(result !== null, 'single candidate → returns result');
  assertEqual(result.releaseTitle, 'Midnight Protocols', 'single: releaseTitle correct');
  assertEqual(result.releaseType,  'Album',              'single: releaseType Album');
  assertEqual(result.artistName,   ARTIST_NAME,          'single: artistName passed through');
  assertEqual(result.artwork, FULL_ALBUM.artwork,        'single: artwork from album');
  assert(typeof result.selectionScore === 'number',      'single: selectionScore is number');
  assert(typeof result.verificationScore === 'number',   'single: verificationScore is number');
  assert(typeof result.reasonSelected === 'string' && result.reasonSelected.length > 0,
    'single: reasonSelected non-empty');
  assert(result.reasonSelected.includes('only eligible release'),
    'single candidate: reason mentions only eligible release');
  // Output is frozen
  assert(Object.isFrozen(result), 'output is frozen');
}

// ── Score calculation validation ─────────────────────────────────────

console.log('\n── Score calculation ──');

{
  // FULL_ALBUM: fully verified recent album with artwork
  // Verification: 40, Metadata: 20 (all 4 fields), Artwork: 10, Album: 15, Streaming: 10, Recency: 5 (1 year old)
  const expected = BVR_VERIFICATION_WEIGHTS.FULL +
                   (4 * BVR_METADATA_WEIGHT_PER_FIELD) +
                   BVR_ARTWORK_WEIGHT +
                   BVR_RELEASE_TYPE_WEIGHTS.ALBUM +
                   BVR_STREAMING_WEIGHT +
                   BVR_RECENCY_WEIGHTS.RECENT;
  const result = selectBestVerifiedRelease([FULL_ALBUM], ARTIST_NAME);
  assertEqual(result.selectionScore, expected, `full album score = ${expected}`);
  assertEqual(result.verificationScore, BVR_VERIFICATION_WEIGHTS.FULL, 'full album: verification = 40');
}

{
  // SINGLE: fully verified very recent single with artwork
  // Verification: 40, Metadata: 20, Artwork: 10, Single: 5, Streaming: 10, Recency: 5 (current year)
  const expected = BVR_VERIFICATION_WEIGHTS.FULL +
                   (4 * BVR_METADATA_WEIGHT_PER_FIELD) +
                   BVR_ARTWORK_WEIGHT +
                   BVR_RELEASE_TYPE_WEIGHTS.SINGLE +
                   BVR_STREAMING_WEIGHT +
                   BVR_RECENCY_WEIGHTS.RECENT;
  const result = selectBestVerifiedRelease([SINGLE], ARTIST_NAME);
  assertEqual(result.selectionScore, expected, `single score = ${expected}`);
  assertEqual(result.releaseType, 'Single', 'single track: type = Single');
}

{
  // OLD_ALBUM_NO_ARTWORK: no artwork
  // Verification: 40, Metadata: 15 (3 fields — no artwork), Artwork: 0, Album: 15, Streaming: 10, Recency: 0
  const expected = BVR_VERIFICATION_WEIGHTS.FULL +
                   (3 * BVR_METADATA_WEIGHT_PER_FIELD) +
                   0 + // no artwork
                   BVR_RELEASE_TYPE_WEIGHTS.ALBUM +
                   BVR_STREAMING_WEIGHT +
                   BVR_RECENCY_WEIGHTS.ESTABLISHED;
  const result = selectBestVerifiedRelease([OLD_ALBUM_NO_ARTWORK], ARTIST_NAME);
  assertEqual(result.selectionScore, expected, `old album no artwork score = ${expected}`);
  assertEqual(result.artwork, null, 'old album: artwork null when not present');
}

// ── Ranking — album wins over EP when fully verified ─────────────────

console.log('\n── Ranking ──');

{
  const result = selectBestVerifiedRelease([RECENT_EP, FULL_ALBUM], ARTIST_NAME);
  assertEqual(result.releaseTitle, 'Midnight Protocols', 'album beats EP of similar recency');
  assertEqual(result.releaseType,  'Album',              'album type wins');
}

{
  // Quality (EP with artwork) beats old album without artwork
  const result = selectBestVerifiedRelease([OLD_ALBUM_NO_ARTWORK, RECENT_EP], ARTIST_NAME);
  assertEqual(result.releaseTitle, 'Summer Waves', 'EP with artwork beats old album without artwork');
  assertEqual(result.releaseType,  'EP',           'EP type confirmed');
}

{
  // Album wins over single
  const result = selectBestVerifiedRelease([SINGLE, FULL_ALBUM], ARTIST_NAME);
  assertEqual(result.releaseTitle, 'Midnight Protocols', 'album beats single');
}

{
  // Single wins when it is the only option
  const result = selectBestVerifiedRelease([SINGLE], ARTIST_NAME);
  assertEqual(result.releaseTitle, 'First Light', 'single selected when only option');
  assertEqual(result.releaseType,  'Single',      'type = Single');
}

// ── EP classification ────────────────────────────────────────────────

console.log('\n── EP classification ──');

for (const tc of [2, 3, 4, 5, 6]) {
  const ep = { id: `ep-${tc}`, name: `EP ${tc}`, trackCount: tc,
               releaseDate: `${CURRENT_YEAR - 1}-01-01`,
               url: 'https://music.apple.com/ep', artwork: 'https://artwork.url' };
  const result = selectBestVerifiedRelease([ep], ARTIST_NAME);
  assertEqual(result.releaseType, 'EP', `trackCount=${tc} → EP`);
}

for (const tc of [7, 8, 10, 15, 25]) {
  const album = { id: `album-${tc}`, name: `Album ${tc}`, trackCount: tc,
                  releaseDate: `${CURRENT_YEAR - 1}-01-01`,
                  url: 'https://music.apple.com/album', artwork: 'https://artwork.url' };
  const result = selectBestVerifiedRelease([album], ARTIST_NAME);
  assertEqual(result.releaseType, 'Album', `trackCount=${tc} → Album`);
}

{
  const single = { id: 'sngl', name: 'Single Track', trackCount: 1,
                   releaseDate: `${CURRENT_YEAR - 1}-01-01`,
                   url: 'https://music.apple.com/single', artwork: 'https://artwork.url' };
  const result = selectBestVerifiedRelease([single], ARTIST_NAME);
  assertEqual(result.releaseType, 'Single', 'trackCount=1 → Single');
}

// ── Tiebreaker: same score → prefer album type ───────────────────────

console.log('\n── Tiebreakers ──');

{
  // Build two albums with the same score by giving the same fields
  const albumA = { id: 'a1', name: 'Album A', trackCount: 10,
                   releaseDate: `${CURRENT_YEAR - 2}-06-01`,
                   url: 'https://music.apple.com/a', artwork: 'https://art.url/a' };
  const albumB = { id: 'a2', name: 'Album B', trackCount: 11,
                   releaseDate: `${CURRENT_YEAR - 2}-06-01`,
                   url: 'https://music.apple.com/b', artwork: 'https://art.url/b' };
  // Both should have the same score. Tiebreak by name order won't apply;
  // we just verify one of them is returned (not null).
  const result = selectBestVerifiedRelease([albumA, albumB], ARTIST_NAME);
  assert(result !== null, 'tiebreak: one result returned when two equal albums');
  assertEqual(result.releaseType, 'Album', 'tiebreak: both are albums → album selected');
}

{
  // EP vs Single with same overall score is impossible (different type scores),
  // but verify EP beats single in type-score ordering.
  const ep = { id: 'ep1', name: 'My EP', trackCount: 4,
               releaseDate: `${CURRENT_YEAR - 3}-01-01`,
               url: 'https://music.apple.com/ep1', artwork: 'https://art.url/ep' };
  const single = { id: 'sng1', name: 'My Single', trackCount: 1,
                   releaseDate: `${CURRENT_YEAR - 1}-01-01`,
                   url: 'https://music.apple.com/sng1', artwork: 'https://art.url/sng' };
  // Single is more recent (+5 recency vs +0) but EP has higher type score (+10 vs +5).
  // Net: EP score = 40+20+10+10+10+0 = 90; Single = 40+20+10+5+10+5 = 90 — exact tie!
  // Tiebreaker 4: EP beats Single on type order.
  const result = selectBestVerifiedRelease([ep, single], ARTIST_NAME);
  assertEqual(result.releaseType, 'EP', 'tiebreak: EP beats Single at same total score');
}

// ── Artist name passthrough ──────────────────────────────────────────

console.log('\n── Artist name ──');

{
  const result = selectBestVerifiedRelease([FULL_ALBUM], 'The Weeknd');
  assertEqual(result.artistName, 'The Weeknd', 'artistName passed through');
}
{
  const result = selectBestVerifiedRelease([FULL_ALBUM], '');
  assertEqual(result.artistName, '', 'empty artistName stays empty');
}
{
  const result = selectBestVerifiedRelease([FULL_ALBUM], null);
  assertEqual(result.artistName, '', 'null artistName → empty string');
}

// ── Graceful degradation ─────────────────────────────────────────────

console.log('\n── Graceful degradation ──');

{
  // Missing optional fields still produce a result
  const minimal = { id: 'min', name: 'Minimal Album', trackCount: 8 };
  const result = selectBestVerifiedRelease([minimal], ARTIST_NAME);
  assert(result !== null, 'missing releaseDate/url/artwork → still eligible');
  assertEqual(result.releaseTitle, 'Minimal Album', 'minimal album: title correct');
  assertEqual(result.artwork, null, 'minimal album: artwork null');
  assertEqual(result.releaseDate, null, 'minimal album: releaseDate null');
}

{
  // Non-array items inside albums array are skipped
  const mixed = [null, undefined, 'string', FULL_ALBUM, { notAnAlbum: true }];
  const result = selectBestVerifiedRelease(mixed, ARTIST_NAME);
  assert(result !== null, 'mixed array: eligible album selected');
  assertEqual(result.releaseTitle, 'Midnight Protocols', 'mixed array: only valid album wins');
}

// ── Output contract ──────────────────────────────────────────────────

console.log('\n── Output contract ──');

{
  const result = selectBestVerifiedRelease([FULL_ALBUM, RECENT_EP, OLD_ALBUM_NO_ARTWORK, SINGLE], ARTIST_NAME);
  assert(result !== null, 'multi-candidate: returns result');
  assert('artwork'            in result, 'output has artwork');
  assert('artistName'         in result, 'output has artistName');
  assert('releaseTitle'       in result, 'output has releaseTitle');
  assert('releaseType'        in result, 'output has releaseType');
  assert('releaseDate'        in result, 'output has releaseDate');
  assert('verificationScore'  in result, 'output has verificationScore');
  assert('selectionScore'     in result, 'output has selectionScore');
  assert('reasonSelected'     in result, 'output has reasonSelected');
  assert(result.selectionScore >= 0 && result.selectionScore <= 100, 'selectionScore 0–100');
  assert(result.verificationScore >= 0 && result.verificationScore <= 40, 'verificationScore 0–40');
  assert(['Album', 'EP', 'Single'].includes(result.releaseType), 'releaseType is valid enum');
  assert(Object.isFrozen(result), 'output is deeply frozen');
}

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n═════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  BEST VERIFIED RELEASE™ ENGINE: ${passed} assertions passed`);
} else {
  console.log(`  FAILED: ${failed} assertion(s) failed, ${passed} passed`);
}
console.log('═════════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
