// Media Intelligence™ — Validation Suite
//
// Run: node lib/rie/__tests__/media-intelligence.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// Board directive (2026-07-22, Media Intelligence™ Final Validation &
// Merge Authorization). Promotes the ad hoc functional verification run
// during implementation into a permanent, repeatable test asset, matching
// this repo's existing certification-suite convention.
//
//   Group A — EvidenceBridge video translators (4)
//   Group B — media-evidence.js (5)
//   Group C — media-intelligence.js card computation (9)
//   Group D — Purity invariants (3)
//   Group E — CIM integration (2)

import assert from 'node:assert/strict';

import { bridgeToCanonical } from '../EvidenceBridge.js';
import { assembleMediaEvidence, MEDIA_EVIDENCE_VERSION } from '../../../api/_lib/media-evidence.js';
import { assembleMediaIntelligence, MEDIA_INTELLIGENCE_VERSION } from '../../../api/_lib/media-intelligence.js';
import { CIM_OBJECTS, emptyCIM } from '../../../api/schema/canonical-intelligence-model.js';

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

const YOUTUBE_VIDEOS_PACKAGE = {
  evidenceType: 'Videos',
  contract: {
    provider: 'youtube',
    completeness: 'full',
    payload: {
      items: [
        { id: 'v1', snippet: { title: 'Freedom', publishedAt: '2026-06-10T00:00:00Z' },
          contentDetails: { duration: 'PT3M21S' }, statistics: { viewCount: '1000' }, status: { privacyStatus: 'public' } },
        { id: 'v2', snippet: { title: 'Older', publishedAt: '2026-01-01T00:00:00Z' },
          contentDetails: { duration: 'PT2M' }, statistics: {}, status: { privacyStatus: 'unlisted' } },
      ],
    },
  },
};

const APPLE_VIDEOS_PACKAGE = {
  evidenceType: 'Videos',
  contract: {
    provider: 'apple_music',
    completeness: 'full',
    payload: {
      results: { 'music-videos': { data: [
        { id: 'amv1', type: 'music-videos', attributes: { name: 'Freedom (Official Video)', artistName: 'Test Artist', releaseDate: '2026-06-10', durationInMillis: 201000, isrc: 'US1234567890' } },
      ] } },
    },
  },
};

const FULL_CANONICAL = {
  platforms: {
    youtube: {
      channelId: 'UC123',
      details: {
        subscriberCount: 125400, viewCount: 3200000, videoCount: 48,
        thumbnails: { default: { url: 'x' } }, bannerImageUrl: 'https://banner',
        videos: [
          { id: 'v1', publishedAt: '2026-06-10T00:00:00Z' },
          { id: 'v2', publishedAt: '2026-01-01T00:00:00Z' },
        ],
      },
    },
    appleMusic: {
      artistId: '471744', artworkUrl: 'https://artwork',
      details: {
        albums: [
          { id: 'a1', name: 'Freedom', releaseDate: '2026-06-10' },
          { id: 'a2', name: 'Take It All', releaseDate: '2026-03-01' },
        ],
        videos: [{ id: 'amv1', name: 'Freedom (Video)', releaseDate: '2026-06-10' }],
      },
    },
    audiodb: {
      artistId: '111239',
      media: {
        thumbnails: { thumb: 'x' }, logos: { logo: 'x', clearart: null },
        banners: { banner: null }, fanArt: { fanart: 'x' },
        social: { website: 'https://artist.com', facebook: 'https://fb.com/artist' },
      },
      discography: [{ strAlbum: 'Freedom' }],
    },
    spotify: { artistId: 's1', details: { followers: 45000 } },
    deezer: { artistId: 'd1', fans: 12000 },
    lastfm: { name: 'Test Artist', community: { listeners: 8000 } },
  },
};

const NOW = Date.parse('2026-07-22T00:00:00Z');

// ── Group A — EvidenceBridge video translators ─────────────────────────────

test('A1. translateYouTubeVideos extracts all raw fields, no interpretation', () => {
  const canonical = bridgeToCanonical([YOUTUBE_VIDEOS_PACKAGE]);
  const videos = canonical.platforms.youtube.details.videos;
  assert.equal(videos.length, 2);
  assert.equal(videos[0].id, 'v1');
  assert.equal(videos[0].title, 'Freedom');
  assert.equal(videos[0].duration, 'PT3M21S');
  assert.equal(videos[0].viewCount, '1000');
});

test('A2. translateYouTubeVideos computes publicVideoCount from real privacyStatus only', () => {
  const canonical = bridgeToCanonical([YOUTUBE_VIDEOS_PACKAGE]);
  assert.equal(canonical.platforms.youtube.details.publicVideoCount, 1); // v1 public, v2 unlisted
});

test('A3. translateAppleVideos extracts the search-response shape correctly', () => {
  const canonical = bridgeToCanonical([APPLE_VIDEOS_PACKAGE]);
  const videos = canonical.platforms.appleMusic.details.videos;
  assert.equal(videos.length, 1);
  assert.equal(videos[0].name, 'Freedom (Official Video)');
  assert.equal(videos[0].releaseDate, '2026-06-10');
  assert.equal(videos[0].isrc, 'US1234567890');
});

test('A4. Apple video translator is provider-scoped -- does not cross-contaminate with YouTube/AudioDB Videos packages', () => {
  const canonical = bridgeToCanonical([YOUTUBE_VIDEOS_PACKAGE, APPLE_VIDEOS_PACKAGE]);
  assert.equal(canonical.platforms.youtube.details.videos.length, 2);
  assert.equal(canonical.platforms.appleMusic.details.videos.length, 1);
});

// ── Group B — media-evidence.js ─────────────────────────────────────────────

test('B1. assembleMediaEvidence never throws on null/undefined/garbage', () => {
  assert.doesNotThrow(() => assembleMediaEvidence(null));
  assert.doesNotThrow(() => assembleMediaEvidence(undefined));
  assert.doesNotThrow(() => assembleMediaEvidence('not an object'));
  assert.doesNotThrow(() => assembleMediaEvidence(42));
});

test('B2. assembleMediaEvidence extracts YouTube fields correctly', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  assert.equal(ev.youtube.present, true);
  assert.equal(ev.youtube.subscriberCount, 125400);
  assert.equal(ev.youtube.videos.length, 2);
});

test('B3. assembleMediaEvidence extracts Apple + AudioDB + secondary audience fields correctly', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  assert.equal(ev.appleMusic.albums.length, 2);
  assert.equal(ev.audiodb.website, 'https://artist.com');
  assert.equal(ev.audienceSecondary.spotify.followers, 45000);
  assert.equal(ev.audienceSecondary.deezer.fans, 12000);
  assert.equal(ev.audienceSecondary.lastfm.listeners, 8000);
});

test('B4. assembleMediaEvidence output is deep-frozen', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  assert.ok(Object.isFrozen(ev));
  assert.ok(Object.isFrozen(ev.youtube));
});

test('B5. assembleMediaEvidence marks absent providers as not present, never fabricates', () => {
  const ev = assembleMediaEvidence({ platforms: {} });
  assert.equal(ev.youtube.present, false);
  assert.equal(ev.youtube.subscriberCount, null);
});

// ── Group C — media-intelligence.js card computation ────────────────────────

test('C1. assembleMediaIntelligence never throws on null/undefined/garbage', () => {
  assert.doesNotThrow(() => assembleMediaIntelligence(null));
  assert.doesNotThrow(() => assembleMediaIntelligence(undefined));
  assert.doesNotThrow(() => assembleMediaIntelligence('garbage'));
  assert.equal(assembleMediaIntelligence(null).available, false);
});

test('C2. Media Platform Coverage -- correct coveredCount/totalPlatforms/percent', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.equal(mi.platformCoverage.coveredCount, 3);
  assert.equal(mi.platformCoverage.totalPlatforms, 3);
  assert.equal(mi.platformCoverage.coveragePercent, 100);
});

test('C3. Media Asset Completeness -- correct present/missing slot accounting', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.equal(mi.assetCompleteness.presentCount, 6);
  assert.equal(mi.assetCompleteness.totalSlots, 8);
  assert.deepEqual(mi.assetCompleteness.missingAssets.map(a => a.asset).sort(), ['Banner', 'Clearart']);
});

test('C4. Content Activity Status -- correct day-threshold bucketing (Slowing at 42 days)', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.equal(mi.contentActivity.status, 'Slowing');
  assert.equal(mi.contentActivity.daysSinceLastUpload, 42);
  assert.equal(mi.contentActivity.latestUploadAt, '2026-06-10T00:00:00Z');
});

test('C5. Content Activity Status -- Active/Dormant/Unknown boundaries', () => {
  const activeEv = { youtube: { videos: [{ publishedAt: new Date(NOW - 5 * 86400000).toISOString() }] }, appleMusic: { videos: [] } };
  assert.equal(assembleMediaIntelligence(activeEv, NOW).contentActivity.status, 'Active');

  const dormantEv = { youtube: { videos: [{ publishedAt: new Date(NOW - 200 * 86400000).toISOString() }] }, appleMusic: { videos: [] } };
  assert.equal(assembleMediaIntelligence(dormantEv, NOW).contentActivity.status, 'Dormant');

  const unknownEv = { youtube: { videos: [] }, appleMusic: { videos: [] } };
  assert.equal(assembleMediaIntelligence(unknownEv, NOW).contentActivity.status, 'Unknown');
});

test('C6. Digital Presence -- correct link presence accounting', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.equal(mi.digitalPresence.presentCount, 2);
  assert.equal(mi.digitalPresence.totalLinks, 2);
});

test('C7. Catalog Media Support -- exact releaseDate match only, no fuzzy/text matching', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.equal(mi.catalogMediaSupport.supportedCount, 1); // "Freedom" matches
  assert.equal(mi.catalogMediaSupport.unsupportedReleases.length, 1);
  assert.equal(mi.catalogMediaSupport.unsupportedReleases[0].name, 'Take It All');
});

test('C8. Audience Reach -- per-platform values, never summed into a combined total', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  const platforms = mi.audienceReach.platforms;
  assert.equal(platforms.length, 5); // YouTube subs+views, Spotify, Deezer, Last.fm
  assert.ok(!('total' in mi.audienceReach));
  const spotifyEntry = platforms.find(p => p.platform === 'Spotify');
  assert.equal(spotifyEntry.value, 45000);
});

test('C9. No fabricated fields present anywhere in output -- confirms scope discipline', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  const json = JSON.stringify(mi);
  assert.ok(!/officialArtistChannel/i.test(json));
  assert.ok(!/monetization/i.test(json));
  assert.ok(!/DeltaPct/i.test(json));
});

// ── Group D — Purity invariants ─────────────────────────────────────────────

test('D1. assembleMediaIntelligence output is deep-frozen', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const mi = assembleMediaIntelligence(ev, NOW);
  assert.ok(Object.isFrozen(mi));
  assert.ok(Object.isFrozen(mi.platformCoverage));
  assert.ok(Object.isFrozen(mi.catalogMediaSupport.releases));
});

test('D2. assembleMediaIntelligence never mutates its input', () => {
  const ev = assembleMediaEvidence(FULL_CANONICAL);
  const evJsonBefore = JSON.stringify(ev);
  assembleMediaIntelligence(ev, NOW);
  assert.equal(JSON.stringify(ev), evJsonBefore);
});

test('D3. Version stamps present and correctly typed', () => {
  assert.equal(typeof MEDIA_EVIDENCE_VERSION, 'string');
  assert.equal(typeof MEDIA_INTELLIGENCE_VERSION, 'string');
});

// ── Group E — CIM integration ────────────────────────────────────────────────

test('E1. CIM_OBJECTS includes "media" (§8.2.14)', () => {
  assert.ok(CIM_OBJECTS.includes('media'));
  assert.equal(CIM_OBJECTS.length, 14);
});

test('E2. emptyCIM() includes media: null', () => {
  const cim = emptyCIM();
  assert.ok('media' in cim);
  assert.equal(cim.media, null);
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────────────────`);
console.log(`   ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`);

if (failed > 0) {
  console.error(`\n✗ Media Intelligence™ validation FAILED — ${failed} criterion/criteria not met.\n`);
  process.exit(1);
}
console.log(`\n✓ Media Intelligence™ validation COMPLETE — all ${passed} criteria passed.\n`);
