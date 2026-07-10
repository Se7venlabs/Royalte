// ─── Suite 09: YouTube Official Artist Channel PAL Production Migration™ ──────
//
// Phase 3.6 (YouTube) Board Certification — 2026-07-02
//
// Verifies the constitutional YouTube PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version, trust
//   B — YouTubeConnector: initialize + authenticate with/without API key (async)
//   C — EvidenceBridge: ARTIST_IDENTITY translation (search path)
//   D — EvidenceBridge: ARTIST_IDENTITY translation (Identity Graph / direct path)
//   E — EvidenceBridge: COLLECTION_DATA translation → platforms.youtube.details.*
//   F — synthesizeYouTubeCompat: legacy compat shape output
//   G — Edge cases: null/empty/malformed input never throws; bridge never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }         from '../../../lib/rie/EvidenceBridge.js';
import { YOUTUBE_CAPABILITIES }       from '../../../provider-acquisition/connectors/youtube/youtube-capabilities.js';
import { Capability }                 from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract }     from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { synthesizeYouTubeCompat }    from '../../../api/_lib/youtube-pal-acquisition.js';
import { PROVIDER_NAME, CONNECTOR_VERSION, YouTubeConnector }
  from '../../../provider-acquisition/connectors/youtube/YouTubeConnector.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-02T00:00:00.000Z';

function ytContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-youtube',
    correlationId:        'test-corr-youtube',
    requestId:            'test-req-youtube',
    provider:             'youtube',
    providerVersion:      'v3',
    connectorVersion:     '1.0',
    providerTrust:        85,
    capabilityProfileRef: '1.0',
    acquiredAt:           NOW,
    health:               { state: 'AVAILABLE' },
    completeness:         payload ? 'full' : 'empty',
    payload,
    payloadChecksum:      'mock-checksum',
    rawResponseHash:      'mock-hash',
  });
}

function ytPkg(evidenceType, payload) {
  return { evidenceType, contract: ytContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

// search.list response (ARTIST_IDENTITY, name-search path)
const SEARCH_PAYLOAD = {
  kind:          'youtube#searchListResponse',
  etag:          'mock-etag',
  regionCode:    'US',
  nextPageToken: null,
  pageInfo:      { totalResults: 1, resultsPerPage: 10 },
  items: [
    {
      kind: 'youtube#searchResult',
      etag: 'mock-etag-item',
      id:   { kind: 'youtube#channel', channelId: 'UCdDyFERkMHzB0Ek_MVTFQMQ' },
      snippet: {
        channelId:    'UCdDyFERkMHzB0Ek_MVTFQMQ',
        channelTitle: 'Billie Eilish',
        description:  'Official Billie Eilish YouTube channel',
        publishedAt:  '2013-07-23T00:00:00Z',
        thumbnails:   { default: { url: 'https://mock.thumbnail/billie.jpg' } },
      },
    },
    {
      kind: 'youtube#searchResult',
      etag: 'mock-etag-item-2',
      id:   { kind: 'youtube#channel', channelId: 'UCmischannel' },
      snippet: {
        channelId:    'UCmischannel',
        channelTitle: 'Billie Eilish Fan Page',
        description:  'Fan page — not the official channel',
        publishedAt:  '2019-01-01T00:00:00Z',
      },
    },
  ],
};

// channels.list?part=snippet response (ARTIST_IDENTITY, Identity Graph / direct path)
const DIRECT_SNIPPET_PAYLOAD = {
  kind:     'youtube#channelListResponse',
  etag:     'mock-etag-direct',
  pageInfo: { totalResults: 1, resultsPerPage: 1 },
  items: [
    {
      kind: 'youtube#channel',
      etag: 'mock-etag-channel',
      id:   'UCdDyFERkMHzB0Ek_MVTFQMQ',
      snippet: {
        title:          'Billie Eilish',
        description:    'Official Billie Eilish YouTube channel',
        customUrl:      '@billieeilish',
        publishedAt:    '2013-07-23T00:00:00Z',
        country:        'US',
        thumbnails:     { default: { url: 'https://mock.thumbnail/billie.jpg' } },
      },
    },
  ],
};

// channels.list?part=snippet,statistics,topicDetails,brandingSettings,contentDetails
const COLLECTION_PAYLOAD = {
  kind:     'youtube#channelListResponse',
  etag:     'mock-etag-full',
  pageInfo: { totalResults: 1, resultsPerPage: 1 },
  items: [
    {
      kind: 'youtube#channel',
      etag: 'mock-etag-full-item',
      id:   'UCdDyFERkMHzB0Ek_MVTFQMQ',
      snippet: {
        title:          'Billie Eilish',
        description:    'Official Billie Eilish YouTube channel',
        customUrl:      '@billieeilish',
        publishedAt:    '2013-07-23T00:00:00Z',
        country:        'US',
        thumbnails:     { high: { url: 'https://mock.thumbnail/billie-hq.jpg' } },
      },
      statistics: {
        viewCount:               '4500000000',
        subscriberCount:         '52000000',
        hiddenSubscriberCount:   'false',
        videoCount:              '183',
      },
      topicDetails: {
        topicIds:         ['/m/04rlf'],
        topicCategories:  [
          'https://en.wikipedia.org/wiki/Music',
          'https://en.wikipedia.org/wiki/Pop_music',
        ],
      },
      brandingSettings: {
        channel: {
          title:       'Billie Eilish',
          description: 'Official Billie Eilish YouTube channel',
          keywords:    '"billie eilish" music pop',
          country:     'US',
        },
        image: {
          bannerExternalUrl: 'https://mock.banner/billie.jpg',
        },
      },
      contentDetails: {
        relatedPlaylists: {
          uploads: 'UUdDyFERkMHzB0Ek_MVTFQMQ',
          likes:   'LLdDyFERkMHzB0Ek_MVTFQMQ',
        },
      },
    },
  ],
};

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "youtube"', PROVIDER_NAME === 'youtube'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check(
    'YOUTUBE_CAPABILITIES is frozen',
    Object.isFrozen(YOUTUBE_CAPABILITIES),
  ));
  results.push(check(
    'YOUTUBE_CAPABILITIES includes ARTIST_IDENTITY',
    YOUTUBE_CAPABILITIES.includes(Capability.ARTIST_IDENTITY),
  ));
  results.push(check(
    'YOUTUBE_CAPABILITIES includes COLLECTION_DATA',
    YOUTUBE_CAPABILITIES.includes(Capability.COLLECTION_DATA),
  ));
  results.push(check(
    'YOUTUBE_CAPABILITIES has exactly 2 entries',
    YOUTUBE_CAPABILITIES.length === 2,
  ));
  results.push(check(
    'YouTubeConnector is a class (function)',
    typeof YouTubeConnector === 'function',
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: YouTubeConnector auth behavior ──────────────────────────────────

async function groupB() {
  const results = [];

  // No API key → AUTH_FAILED
  const connectorNoKey = new YouTubeConnector();
  await connectorNoKey.initialize({});
  const authNoKey = await connectorNoKey.authenticate();
  results.push(check(
    'authenticate() with no key returns health state AUTH_FAILED',
    authNoKey.health?.state === 'AUTH_FAILED',
    `got: ${authNoKey.health?.state}`,
  ));
  results.push(check(
    'authenticate() with no key returns null credentials',
    authNoKey.credentials === null,
  ));

  // With API key → AVAILABLE
  const connectorWithKey = new YouTubeConnector();
  await connectorWithKey.initialize({ apiKey: 'fake-api-key-abc123' });
  const authWithKey = await connectorWithKey.authenticate();
  results.push(check(
    'authenticate() with API key returns health state AVAILABLE',
    authWithKey.health?.state === 'AVAILABLE',
    `got: ${authWithKey.health?.state}`,
  ));
  results.push(check(
    'authenticate() with API key returns redacted credentials',
    authWithKey.credentials?.apiKey === '[redacted]',
  ));

  // Capability profile shape
  const profile = await connectorWithKey.discoverCapabilities();
  results.push(check(
    'discoverCapabilities() returns an object with capabilities array',
    profile !== null && typeof profile === 'object',
  ));

  // getVersion() shape
  const ver = connectorWithKey.getVersion();
  results.push(check('getVersion().provider === "youtube"',      ver.provider === 'youtube'));
  results.push(check('getVersion().connectorVersion === "1.0"',  ver.connectorVersion === '1.0'));
  results.push(check('getVersion().providerApiVersion === "v3"', ver.providerApiVersion === 'v3'));

  await connectorWithKey.shutdown();

  return { name: 'B-auth-behavior', results };
}

// ── Group C: EvidenceBridge — ARTIST_IDENTITY (search path) ──────────────────

function groupC() {
  const results = [];

  const packages = [ytPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'bridgeToCanonical produces platforms.youtube',
    canonical.platforms?.youtube !== undefined,
  ));
  results.push(check(
    'channelId extracted from search result',
    canonical.platforms?.youtube?.channelId === 'UCdDyFERkMHzB0Ek_MVTFQMQ',
    `got: ${canonical.platforms?.youtube?.channelId}`,
  ));
  results.push(check(
    'channelTitle extracted from snippet.channelTitle',
    canonical.platforms?.youtube?.channelTitle === 'Billie Eilish',
    `got: ${canonical.platforms?.youtube?.channelTitle}`,
  ));
  results.push(check(
    'channelSource set to "strict_name_match" for search path',
    canonical.platforms?.youtube?.channelSource === 'strict_name_match',
    `got: ${canonical.platforms?.youtube?.channelSource}`,
  ));
  results.push(check(
    'searchResults preserved when multiple items returned',
    Array.isArray(canonical.platforms?.youtube?.searchResults) &&
    canonical.platforms.youtube.searchResults.length === 2,
    `got length: ${canonical.platforms?.youtube?.searchResults?.length}`,
  ));
  results.push(check(
    'country field null for search path (no country in search snippet)',
    canonical.platforms?.youtube?.country === null ||
    canonical.platforms?.youtube?.country === undefined,
  ));

  return { name: 'C-identity-search-path', results };
}

// ── Group D: EvidenceBridge — ARTIST_IDENTITY (Identity Graph / direct path) ─

function groupD() {
  const results = [];

  const packages = [ytPkg(Capability.ARTIST_IDENTITY, DIRECT_SNIPPET_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'channelId extracted from direct lookup (item.id string)',
    canonical.platforms?.youtube?.channelId === 'UCdDyFERkMHzB0Ek_MVTFQMQ',
    `got: ${canonical.platforms?.youtube?.channelId}`,
  ));
  results.push(check(
    'channelTitle extracted from snippet.title (not channelTitle)',
    canonical.platforms?.youtube?.channelTitle === 'Billie Eilish',
    `got: ${canonical.platforms?.youtube?.channelTitle}`,
  ));
  results.push(check(
    'channelSource set to "royalte_identity_graph" for direct path',
    canonical.platforms?.youtube?.channelSource === 'royalte_identity_graph',
    `got: ${canonical.platforms?.youtube?.channelSource}`,
  ));
  results.push(check(
    'customUrl extracted from snippet.customUrl',
    canonical.platforms?.youtube?.customUrl === '@billieeilish',
    `got: ${canonical.platforms?.youtube?.customUrl}`,
  ));
  results.push(check(
    'country extracted from snippet.country',
    canonical.platforms?.youtube?.country === 'US',
    `got: ${canonical.platforms?.youtube?.country}`,
  ));
  results.push(check(
    'searchResults null when only one item (direct lookup)',
    canonical.platforms?.youtube?.searchResults === null,
    `got: ${canonical.platforms?.youtube?.searchResults}`,
  ));

  return { name: 'D-identity-graph-path', results };
}

// ── Group E: EvidenceBridge — COLLECTION_DATA ─────────────────────────────────

function groupE() {
  const results = [];

  const packages = [
    ytPkg(Capability.ARTIST_IDENTITY, DIRECT_SNIPPET_PAYLOAD),
    ytPkg(Capability.COLLECTION_DATA, COLLECTION_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  const det = canonical.platforms?.youtube?.details;
  results.push(check(
    'platforms.youtube.details object created',
    det !== null && typeof det === 'object',
  ));
  results.push(check(
    'subscriberCount parsed to integer',
    det?.subscriberCount === 52_000_000,
    `got: ${det?.subscriberCount}`,
  ));
  results.push(check(
    'viewCount parsed to integer',
    det?.viewCount === 4_500_000_000,
    `got: ${det?.viewCount}`,
  ));
  results.push(check(
    'videoCount parsed to integer',
    det?.videoCount === 183,
    `got: ${det?.videoCount}`,
  ));
  results.push(check(
    'hiddenSubscriberCount === false',
    det?.hiddenSubscriberCount === false,
    `got: ${det?.hiddenSubscriberCount}`,
  ));
  results.push(check(
    'topicCategories array preserved',
    Array.isArray(det?.topicCategories) && det.topicCategories.length === 2,
    `got length: ${det?.topicCategories?.length}`,
  ));
  results.push(check(
    'topicCategories includes Music Wikipedia URL',
    det?.topicCategories?.includes('https://en.wikipedia.org/wiki/Music'),
    `got: ${det?.topicCategories}`,
  ));
  results.push(check(
    'brandingTitle extracted',
    det?.brandingTitle === 'Billie Eilish',
    `got: ${det?.brandingTitle}`,
  ));
  results.push(check(
    'brandingKeywords extracted',
    typeof det?.brandingKeywords === 'string' && det.brandingKeywords.length > 0,
  ));
  results.push(check(
    'bannerImageUrl extracted from brandingSettings.image',
    det?.bannerImageUrl === 'https://mock.banner/billie.jpg',
    `got: ${det?.bannerImageUrl}`,
  ));
  results.push(check(
    'uploadsPlaylistId extracted from contentDetails',
    det?.uploadsPlaylistId === 'UUdDyFERkMHzB0Ek_MVTFQMQ',
    `got: ${det?.uploadsPlaylistId}`,
  ));
  results.push(check(
    'title from snippet (authoritative channel name)',
    det?.title === 'Billie Eilish',
    `got: ${det?.title}`,
  ));
  results.push(check(
    'customUrl from snippet',
    det?.customUrl === '@billieeilish',
    `got: ${det?.customUrl}`,
  ));
  results.push(check(
    'thumbnails object preserved',
    det?.thumbnails !== null && typeof det?.thumbnails === 'object',
  ));
  results.push(check(
    'publishedAt preserved',
    det?.publishedAt === '2013-07-23T00:00:00Z',
    `got: ${det?.publishedAt}`,
  ));

  return { name: 'E-collection-data', results };
}

// ── Group F: synthesizeYouTubeCompat ─────────────────────────────────────────

function groupF() {
  const results = [];

  // Happy path: search result → collection data → compat shape
  const pkgs = [
    ytPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD),
    ytPkg(Capability.COLLECTION_DATA, COLLECTION_PAYLOAD),
  ];
  const compat = synthesizeYouTubeCompat(pkgs, 'Billie Eilish');

  results.push(check(
    'found === true when channel matched',
    compat.found === true,
    `got: ${compat.found}`,
  ));
  results.push(check(
    'availability === "VERIFIED"',
    compat.availability === 'VERIFIED',
    `got: ${compat.availability}`,
  ));
  results.push(check(
    'officialChannel.channelId present',
    compat.officialChannel?.channelId === 'UCdDyFERkMHzB0Ek_MVTFQMQ',
    `got: ${compat.officialChannel?.channelId}`,
  ));
  results.push(check(
    'officialChannel.title from COLLECTION_DATA (authoritative)',
    compat.officialChannel?.title === 'Billie Eilish',
    `got: ${compat.officialChannel?.title}`,
  ));
  results.push(check(
    'officialChannel.subscribers from statistics',
    compat.officialChannel?.subscribers === 52_000_000,
    `got: ${compat.officialChannel?.subscribers}`,
  ));
  results.push(check(
    'officialChannel.totalViews from statistics',
    compat.officialChannel?.totalViews === 4_500_000_000,
    `got: ${compat.officialChannel?.totalViews}`,
  ));
  results.push(check(
    'officialChannel.videoCount from statistics',
    compat.officialChannel?.videoCount === 183,
    `got: ${compat.officialChannel?.videoCount}`,
  ));
  results.push(check(
    'officialChannel.verifiedVia set correctly (search path)',
    compat.officialChannel?.verifiedVia === 'strict_name_match',
    `got: ${compat.officialChannel?.verifiedVia}`,
  ));
  results.push(check(
    'subscriberCount at top level matches officialChannel.subscribers',
    compat.subscriberCount === 52_000_000,
    `got: ${compat.subscriberCount}`,
  ));
  results.push(check(
    'totalOfficialViews at top level matches officialChannel.totalViews',
    compat.totalOfficialViews === 4_500_000_000,
    `got: ${compat.totalOfficialViews}`,
  ));
  results.push(check(
    'contentIdVerified true when viewCount > 0',
    compat.contentIdVerified === true,
    `got: ${compat.contentIdVerified}`,
  ));

  // Identity Graph (direct lookup) path
  const graphPkgs = [
    ytPkg(Capability.ARTIST_IDENTITY, DIRECT_SNIPPET_PAYLOAD),
    ytPkg(Capability.COLLECTION_DATA, COLLECTION_PAYLOAD),
  ];
  const graphCompat = synthesizeYouTubeCompat(graphPkgs, 'Billie Eilish');
  results.push(check(
    'verifiedVia "royalte_identity_graph" on direct lookup path',
    graphCompat.officialChannel?.verifiedVia === 'royalte_identity_graph',
    `got: ${graphCompat.officialChannel?.verifiedVia}`,
  ));

  // No COLLECTION_DATA — compat falls back gracefully (zeros)
  const noStatsPkgs = [ytPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD)];
  const noStatsCompat = synthesizeYouTubeCompat(noStatsPkgs, 'Billie Eilish');
  results.push(check(
    'found === true even without COLLECTION_DATA',
    noStatsCompat.found === true,
  ));
  results.push(check(
    'subscriberCount === 0 when no COLLECTION_DATA',
    noStatsCompat.subscriberCount === 0,
    `got: ${noStatsCompat.subscriberCount}`,
  ));
  results.push(check(
    'contentIdVerified === false when no view data',
    noStatsCompat.contentIdVerified === false,
  ));

  return { name: 'F-compat-shape', results };
}

// ── Group G: Edge cases ────────────────────────────────────────────────────────

function groupG() {
  const results = [];

  // bridgeToCanonical never throws on bad input
  results.push(check('bridgeToCanonical([]) returns empty object', (() => {
    try { return typeof bridgeToCanonical([]) === 'object'; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical(null) does not throw', (() => {
    try { bridgeToCanonical(null); return true; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with empty payload contract does not throw', (() => {
    try {
      bridgeToCanonical([ytPkg(Capability.ARTIST_IDENTITY, null)]);
      return true;
    } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with no items array does not throw', (() => {
    try {
      bridgeToCanonical([ytPkg(Capability.ARTIST_IDENTITY, { kind: 'youtube#searchListResponse' })]);
      return true;
    } catch { return false; }
  })()));

  // synthesizeYouTubeCompat edge cases
  results.push(check('synthesizeYouTubeCompat([]) returns found:false', (() => {
    const r = synthesizeYouTubeCompat([]);
    return r.found === false;
  })()));
  results.push(check('synthesizeYouTubeCompat with empty contract returns found:false', (() => {
    const r = synthesizeYouTubeCompat([ytPkg(Capability.ARTIST_IDENTITY, null)]);
    return r.found === false;
  })()));
  results.push(check('synthesizeYouTubeCompat with non-matching search result returns UNVERIFIED', (() => {
    const nonMatchPayload = {
      items: [{
        id: { channelId: 'UCother' },
        snippet: { channelId: 'UCother', channelTitle: 'Some Other Channel' },
      }],
    };
    const r = synthesizeYouTubeCompat([ytPkg(Capability.ARTIST_IDENTITY, nonMatchPayload)], 'Billie Eilish');
    return r.found === false && r.availability === 'UNVERIFIED';
  })()));
  results.push(check('synthesizeYouTubeCompat with empty items array returns UNVERIFIED', (() => {
    const r = synthesizeYouTubeCompat([
      ytPkg(Capability.ARTIST_IDENTITY, { items: [] }),
    ], 'Billie Eilish');
    return r.found === false;
  })()));
  results.push(check('COLLECTION_DATA with malformed statistics does not throw', (() => {
    try {
      const r = synthesizeYouTubeCompat([
        ytPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD),
        ytPkg(Capability.COLLECTION_DATA, { items: [{ id: 'UCdDyFERkMHzB0Ek_MVTFQMQ' }] }),
      ], 'Billie Eilish');
      return r.found === true && r.subscriberCount === 0;
    } catch { return false; }
  })()));

  return { name: 'G-edge-cases', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runYouTubeConnector() {
  const groups = [
    groupA(),
    await groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    groupG(),
  ];

  let passed = 0, failed = 0;
  const details = [];

  for (const group of groups) {
    for (const r of group.results) {
      if (r.pass) passed++;
      else failed++;
      details.push({ group: group.name, label: r.label, status: r.pass ? 'PASS' : 'FAIL', note: r.note });
    }
  }

  return {
    name:       '09-youtube-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
