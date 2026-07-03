// ─── Suite 13: Last.fm Community Intelligence Authority™ ─────────────────────
//
// Phase 3.6 Provider Expansion 09 — Board Certification — 2026-07-03
//
// Verifies the constitutional Last.fm PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version
//   B — LastFmConnector: authenticate — AUTH_UNAVAILABLE when key absent; AVAILABLE when key present
//   C — EvidenceBridge: ARTIST_IDENTITY → platforms.lastfm.profile + community + biography + media
//   D — EvidenceBridge: TRACKS → platforms.lastfm.topTracks[], trackCount
//   E — EvidenceBridge: ALBUMS → platforms.lastfm.topAlbums[], albumCount
//   F — synthesizeLastFmCompat: legacy shape matches retired getLastFm() contract
//       (bio HTML-stripped, truncated to 300; found/name/playcount/listeners/tags/url)
//   G — Edge cases: null/empty/malformed input never throws; bridge never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }     from '../../../lib/rie/EvidenceBridge.js';
import { LASTFM_CAPABILITIES }    from '../../../provider-acquisition/connectors/lastfm/lastfm-capabilities.js';
import { Capability }             from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract } from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { PROVIDER_NAME, CONNECTOR_VERSION, LastFmConnector }
  from '../../../provider-acquisition/connectors/lastfm/LastFmConnector.js';
import { synthesizeLastFmCompat } from '../../../api/_lib/lastfm-pal-acquisition.js';
import { loadTrustConfig, resetTrustConfig } from '../../../provider-acquisition/trust/trustConfig.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-03T00:00:00.000Z';

function lastfmContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-lastfm',
    correlationId:        'test-corr-lastfm',
    requestId:            'test-req-lastfm',
    provider:             'lastfm',
    providerVersion:      'v2',
    connectorVersion:     '1.0',
    providerTrust:        75,
    capabilityProfileRef: '1.0',
    acquiredAt:           NOW,
    health:               { state: 'AVAILABLE' },
    completeness:         payload ? 'full' : 'empty',
    payload,
    payloadChecksum:      'mock-checksum',
    rawResponseHash:      'mock-hash',
  });
}

function lastfmPkg(evidenceType, payload) {
  return { evidenceType, contract: lastfmContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

// artist.getinfo — full artist object
const ARTIST_PAYLOAD = {
  name:   'Ed Sheeran',
  mbid:   'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6',
  url:    'https://www.last.fm/music/Ed+Sheeran',
  image: [
    { '#text': 'https://lastfm.freetls.fastly.net/i/u/34s/ed-sheeran.jpg',         size: 'small' },
    { '#text': 'https://lastfm.freetls.fastly.net/i/u/64s/ed-sheeran.jpg',         size: 'medium' },
    { '#text': 'https://lastfm.freetls.fastly.net/i/u/174s/ed-sheeran.jpg',        size: 'large' },
    { '#text': 'https://lastfm.freetls.fastly.net/i/u/300x300/ed-sheeran.jpg',     size: 'extralarge' },
    { '#text': 'https://lastfm.freetls.fastly.net/i/u/mega/ed-sheeran.jpg',        size: 'mega' },
  ],
  streamable: '0',
  ontour:     '0',
  stats: {
    listeners: '8312456',
    playcount:  '125847293',
  },
  similar: {
    artist: [
      { name: 'James Arthur',  url: 'https://www.last.fm/music/James+Arthur',  image: [] },
      { name: 'Sam Smith',     url: 'https://www.last.fm/music/Sam+Smith',     image: [] },
      { name: 'Charlie Puth',  url: 'https://www.last.fm/music/Charlie+Puth',  image: [] },
    ],
  },
  tags: {
    tag: [
      { name: 'pop',    url: 'https://www.last.fm/tag/pop' },
      { name: 'singer-songwriter', url: 'https://www.last.fm/tag/singer-songwriter' },
      { name: 'acoustic', url: 'https://www.last.fm/tag/acoustic' },
      { name: 'british', url: 'https://www.last.fm/tag/british' },
      { name: 'folk pop', url: 'https://www.last.fm/tag/folk+pop' },
    ],
  },
  bio: {
    links: { link: { '#text': '', rel: 'original', href: 'https://last.fm/music/ed+sheeran/+wiki' } },
    published: 'Thu, 02 Feb 2012 19:56:01 +0000',
    summary: '<a href="https://www.last.fm/music/Ed+Sheeran">Ed Sheeran</a> (born 17 February 1991) is an English singer, songwriter, musician, record producer, and actor. <a href="https://www.last.fm/music/Ed+Sheeran">Read more on Last.fm</a>',
    content: '<a href="https://www.last.fm/music/Ed+Sheeran">Ed Sheeran</a> (born 17 February 1991) is an English singer, songwriter, musician, record producer, and actor. He is one of the best-selling music artists of all time, with estimated sales of over 150 million records worldwide. Full biography here with much more detail about his career and discography spanning multiple paragraphs of rich content.',
  },
};

// artist.gettoptracks — toptracks wrapper
const TOPTRACKS_PAYLOAD = {
  track: [
    { name: 'Shape of You', playcount: '52341234', listeners: '3241234', rank: '1',
      url: 'https://www.last.fm/music/Ed+Sheeran/_/Shape+of+You',
      artist: { name: 'Ed Sheeran', mbid: 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6' },
      image: [] },
    { name: 'Thinking Out Loud', playcount: '31234567', listeners: '2123456', rank: '2',
      url: 'https://www.last.fm/music/Ed+Sheeran/_/Thinking+Out+Loud',
      artist: { name: 'Ed Sheeran', mbid: 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6' },
      image: [] },
    { name: 'Perfect', playcount: '28765432', listeners: '1987654', rank: '3',
      url: 'https://www.last.fm/music/Ed+Sheeran/_/Perfect',
      artist: { name: 'Ed Sheeran', mbid: 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6' },
      image: [] },
  ],
  '@attr': { artist: 'Ed Sheeran', page: '1', perPage: '10', totalPages: '1', total: '3' },
};

// artist.gettopalbums — topalbums wrapper
const TOPALBUMS_PAYLOAD = {
  album: [
    { name: '÷ (Divide)', playcount: '45123456', rank: '1',
      url: 'https://www.last.fm/music/Ed+Sheeran/÷+(Divide)',
      artist: { name: 'Ed Sheeran', mbid: 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6' },
      image: [] },
    { name: 'x (Multiply)', playcount: '32876543', rank: '2',
      url: 'https://www.last.fm/music/Ed+Sheeran/x+(Multiply)',
      artist: { name: 'Ed Sheeran', mbid: 'b8a7c51f-362c-4dcb-a259-bc6e0095f0a6' },
      image: [] },
  ],
  '@attr': { artist: 'Ed Sheeran', page: '1', perPage: '10', totalPages: '1', total: '2' },
};

// ── Group A: Static contract assertions ───────────────────────────────────────

function groupA() {
  const assertions = [];

  assertions.push(check('LASTFM_CAPABILITIES is a frozen array',
    Object.isFrozen(LASTFM_CAPABILITIES) && Array.isArray(LASTFM_CAPABILITIES)));

  assertions.push(check('declares ARTIST_IDENTITY capability',
    LASTFM_CAPABILITIES.includes(Capability.ARTIST_IDENTITY)));
  assertions.push(check('declares PERFORMANCE_DATA capability',
    LASTFM_CAPABILITIES.includes(Capability.PERFORMANCE_DATA)));
  assertions.push(check('declares GENRES capability',
    LASTFM_CAPABILITIES.includes(Capability.GENRES)));
  assertions.push(check('declares ARTWORK capability',
    LASTFM_CAPABILITIES.includes(Capability.ARTWORK)));
  assertions.push(check('declares TRACKS capability',
    LASTFM_CAPABILITIES.includes(Capability.TRACKS)));
  assertions.push(check('declares ALBUMS capability',
    LASTFM_CAPABILITIES.includes(Capability.ALBUMS)));
  assertions.push(check('declares exactly 6 capabilities',
    LASTFM_CAPABILITIES.length === 6,
    `expected 6, got ${LASTFM_CAPABILITIES.length}`));

  assertions.push(check('PROVIDER_NAME is "lastfm"',     PROVIDER_NAME     === 'lastfm'));
  assertions.push(check('CONNECTOR_VERSION is "1.0"',    CONNECTOR_VERSION === '1.0'));

  return assertions;
}

// ── Group B: Connector authentication ────────────────────────────────────────

async function groupB() {
  const assertions = [];

  // Without initialization → AUTH_FAILED
  const uninit = new LastFmConnector();
  const uninitResult = await uninit.authenticate();
  assertions.push(check('uninitialized connector → AUTH_FAILED',
    uninitResult.health?.state === 'AUTH_FAILED',
    `got: ${uninitResult.health?.state}`));

  // Initialized without API key → AUTH_FAILED (missing key, not a coverage gap)
  const noKey = new LastFmConnector();
  await noKey.initialize({});
  const noKeyResult = await noKey.authenticate();
  assertions.push(check('initialize() without apiKey → AUTH_FAILED',
    noKeyResult.health?.state === 'AUTH_FAILED',
    `got: ${noKeyResult.health?.state}`));
  assertions.push(check('missing-key AUTH_FAILED credentials.apiKey is null',
    noKeyResult.credentials?.apiKey === null));

  // Initialized with API key → AVAILABLE (no network call)
  loadTrustConfig({ providers: { lastfm: 75 } });
  const withKey = new LastFmConnector();
  await withKey.initialize({ apiKey: 'test-api-key-12345' });
  const withKeyResult = await withKey.authenticate();
  assertions.push(check('initialize() with apiKey → AVAILABLE',
    withKeyResult.health?.state === 'AVAILABLE',
    `got: ${withKeyResult.health?.state}`));
  assertions.push(check('AVAILABLE credentials.apiKey is "[configured]"',
    withKeyResult.credentials?.apiKey === '[configured]'));

  // discoverCapabilities returns all declared capabilities
  const profile = await withKey.discoverCapabilities();
  assertions.push(check('discoverCapabilities returns capabilities array',
    Array.isArray(profile?.capabilities)));
  assertions.push(check('discoverCapabilities includes ARTIST_IDENTITY',
    profile?.capabilities?.includes(Capability.ARTIST_IDENTITY)));
  assertions.push(check('discoverCapabilities includes TRACKS',
    profile?.capabilities?.includes(Capability.TRACKS)));
  assertions.push(check('discoverCapabilities includes ALBUMS',
    profile?.capabilities?.includes(Capability.ALBUMS)));

  // getVersion
  const version = withKey.getVersion();
  assertions.push(check('getVersion().provider is "lastfm"',
    version?.provider === 'lastfm'));
  assertions.push(check('getVersion().connectorVersion is "1.0"',
    version?.connectorVersion === '1.0'));
  assertions.push(check('getVersion().providerApiVersion is "v2"',
    version?.providerApiVersion === 'v2'));

  resetTrustConfig();
  return assertions;
}

// ── Group C: EvidenceBridge ARTIST_IDENTITY → platforms.lastfm ───────────────

function groupC() {
  const assertions = [];

  const packages = [lastfmPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);
  const lastfm    = canonical?.platforms?.lastfm;

  assertions.push(check('bridge creates platforms.lastfm namespace',
    lastfm !== null && lastfm !== undefined && typeof lastfm === 'object'));

  // Top-level identity fields
  assertions.push(check('lastfm.name is set at top level',
    lastfm?.name === 'Ed Sheeran'));
  assertions.push(check('lastfm.url is set at top level',
    lastfm?.url === ARTIST_PAYLOAD.url));

  // Profile sub-namespace
  assertions.push(check('lastfm.profile is an object',
    typeof lastfm?.profile === 'object'));
  assertions.push(check('lastfm.profile.name is set',
    lastfm?.profile?.name === 'Ed Sheeran'));
  assertions.push(check('lastfm.profile.url is set',
    lastfm?.profile?.url === ARTIST_PAYLOAD.url));
  assertions.push(check('lastfm.profile.mbid is set',
    lastfm?.profile?.mbid === ARTIST_PAYLOAD.mbid));

  // Community sub-namespace — constitutionally distinct from streaming counts
  assertions.push(check('lastfm.community is an object',
    typeof lastfm?.community === 'object'));
  assertions.push(check('lastfm.community.listeners is a number',
    typeof lastfm?.community?.listeners === 'number'));
  assertions.push(check('lastfm.community.listeners === 8312456',
    lastfm?.community?.listeners === 8312456,
    `got: ${lastfm?.community?.listeners}`));
  assertions.push(check('lastfm.community.playcount === 125847293',
    lastfm?.community?.playcount === 125847293,
    `got: ${lastfm?.community?.playcount}`));

  // Community tags
  assertions.push(check('lastfm.community.tags is an array',
    Array.isArray(lastfm?.community?.tags)));
  assertions.push(check('lastfm.community.tags has 5 entries',
    lastfm?.community?.tags?.length === 5,
    `got: ${lastfm?.community?.tags?.length}`));
  assertions.push(check('lastfm.community.tags[0].name is "pop"',
    lastfm?.community?.tags?.[0]?.name === 'pop'));
  assertions.push(check('community tags include url field',
    typeof lastfm?.community?.tags?.[0]?.url === 'string'));

  // Similar artists (community behavior — not provider cross-reference)
  assertions.push(check('lastfm.community.similarArtists is an array',
    Array.isArray(lastfm?.community?.similarArtists)));
  assertions.push(check('lastfm.community.similarArtists has 3 entries',
    lastfm?.community?.similarArtists?.length === 3,
    `got: ${lastfm?.community?.similarArtists?.length}`));
  assertions.push(check('similarArtists[0].name is "James Arthur"',
    lastfm?.community?.similarArtists?.[0]?.name === 'James Arthur'));
  assertions.push(check('similarArtists[0].url is set',
    typeof lastfm?.community?.similarArtists?.[0]?.url === 'string'));

  // Biography sub-namespace — raw HTML preserved in bridge
  assertions.push(check('lastfm.biography is an object',
    typeof lastfm?.biography === 'object'));
  assertions.push(check('lastfm.biography.summary contains HTML (raw preserved)',
    typeof lastfm?.biography?.summary === 'string' && lastfm.biography.summary.includes('<a href=')));
  assertions.push(check('lastfm.biography.content is set',
    typeof lastfm?.biography?.content === 'string' && lastfm.biography.content.length > 0));
  assertions.push(check('lastfm.biography.published is set',
    typeof lastfm?.biography?.published === 'string'));

  // Media sub-namespace — artist images
  assertions.push(check('lastfm.media is an object',
    typeof lastfm?.media === 'object'));
  assertions.push(check('lastfm.media.images is an array',
    Array.isArray(lastfm?.media?.images)));
  assertions.push(check('lastfm.media.images has 5 entries (all sizes)',
    lastfm?.media?.images?.length === 5,
    `got: ${lastfm?.media?.images?.length}`));
  assertions.push(check('images[0]["#text"] is set (Last.fm image shape preserved)',
    typeof lastfm?.media?.images?.[0]?.['#text'] === 'string'));

  // Empty catalog placeholders
  assertions.push(check('lastfm.topTracks is initialized as empty array',
    Array.isArray(lastfm?.topTracks) && lastfm.topTracks.length === 0));
  assertions.push(check('lastfm.topAlbums is initialized as empty array',
    Array.isArray(lastfm?.topAlbums) && lastfm.topAlbums.length === 0));

  return assertions;
}

// ── Group D: EvidenceBridge TRACKS → platforms.lastfm.topTracks ──────────────

function groupD() {
  const assertions = [];

  const packages = [
    lastfmPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    lastfmPkg(Capability.TRACKS, TOPTRACKS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);
  const lastfm    = canonical?.platforms?.lastfm;

  assertions.push(check('topTracks is populated after TRACKS package',
    Array.isArray(lastfm?.topTracks)));
  assertions.push(check('topTracks has 3 entries',
    lastfm?.topTracks?.length === 3,
    `got: ${lastfm?.topTracks?.length}`));
  assertions.push(check('topTracks[0].name is "Shape of You"',
    lastfm?.topTracks?.[0]?.name === 'Shape of You'));
  assertions.push(check('topTracks[0].playcount is set',
    lastfm?.topTracks?.[0]?.playcount !== undefined));
  assertions.push(check('trackCount is set to 3',
    lastfm?.trackCount === 3,
    `got: ${lastfm?.trackCount}`));

  // TRACKS-only (no ARTIST_IDENTITY) — still populates namespace
  const tracksOnly = bridgeToCanonical([lastfmPkg(Capability.TRACKS, TOPTRACKS_PAYLOAD)]);
  assertions.push(check('TRACKS-only package still creates platforms.lastfm',
    tracksOnly?.platforms?.lastfm !== undefined));
  assertions.push(check('TRACKS-only populates topTracks',
    Array.isArray(tracksOnly?.platforms?.lastfm?.topTracks) &&
    tracksOnly.platforms.lastfm.topTracks.length === 3));

  return assertions;
}

// ── Group E: EvidenceBridge ALBUMS → platforms.lastfm.topAlbums ──────────────

function groupE() {
  const assertions = [];

  const packages = [
    lastfmPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD),
    lastfmPkg(Capability.ALBUMS, TOPALBUMS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);
  const lastfm    = canonical?.platforms?.lastfm;

  assertions.push(check('topAlbums is populated after ALBUMS package',
    Array.isArray(lastfm?.topAlbums)));
  assertions.push(check('topAlbums has 2 entries',
    lastfm?.topAlbums?.length === 2,
    `got: ${lastfm?.topAlbums?.length}`));
  assertions.push(check('topAlbums[0].name is "÷ (Divide)"',
    lastfm?.topAlbums?.[0]?.name === '÷ (Divide)'));
  assertions.push(check('topAlbums[0].playcount is set',
    lastfm?.topAlbums?.[0]?.playcount !== undefined));
  assertions.push(check('albumCount is set to 2',
    lastfm?.albumCount === 2,
    `got: ${lastfm?.albumCount}`));

  // ALBUMS-only (no ARTIST_IDENTITY) — still populates namespace
  const albumsOnly = bridgeToCanonical([lastfmPkg(Capability.ALBUMS, TOPALBUMS_PAYLOAD)]);
  assertions.push(check('ALBUMS-only package still creates platforms.lastfm',
    albumsOnly?.platforms?.lastfm !== undefined));
  assertions.push(check('ALBUMS-only populates topAlbums',
    Array.isArray(albumsOnly?.platforms?.lastfm?.topAlbums) &&
    albumsOnly.platforms.lastfm.topAlbums.length === 2));

  return assertions;
}

// ── Group F: synthesizeLastFmCompat legacy shape ──────────────────────────────

function groupF() {
  const assertions = [];

  const packages = [lastfmPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD)];
  const compat   = synthesizeLastFmCompat(packages, 'Ed Sheeran');

  assertions.push(check('compat.found is true',    compat.found === true));
  assertions.push(check('compat.name is "Ed Sheeran"', compat.name === 'Ed Sheeran'));
  assertions.push(check('compat.playcount is a number and > 0',
    typeof compat.playcount === 'number' && compat.playcount > 0));
  assertions.push(check('compat.playcount === 125847293',
    compat.playcount === 125847293,
    `got: ${compat.playcount}`));
  assertions.push(check('compat.listeners === 8312456',
    compat.listeners === 8312456,
    `got: ${compat.listeners}`));

  // tags: array of tag name strings (not objects)
  assertions.push(check('compat.tags is a string[]',
    Array.isArray(compat.tags) && compat.tags.every(t => typeof t === 'string')));
  assertions.push(check('compat.tags[0] is "pop"',
    compat.tags?.[0] === 'pop'));
  assertions.push(check('compat.tags has 5 entries',
    compat.tags?.length === 5,
    `got: ${compat.tags?.length}`));

  // bio: HTML-stripped, truncated to 300 chars
  assertions.push(check('compat.bio is a string',
    typeof compat.bio === 'string'));
  assertions.push(check('compat.bio has no HTML tags (stripped)',
    !/<[^>]+>/.test(compat.bio)));
  assertions.push(check('compat.bio length ≤ 300',
    compat.bio.length <= 300,
    `got length: ${compat.bio.length}`));
  assertions.push(check('compat.bio starts with non-whitespace text',
    compat.bio.trim().length > 0));

  // url
  assertions.push(check('compat.url matches ARTIST_PAYLOAD.url',
    compat.url === ARTIST_PAYLOAD.url));

  return assertions;
}

// ── Group G: Edge cases / never-throw guarantees ──────────────────────────────

async function groupG() {
  const assertions = [];

  // Empty packages
  let result;
  try {
    result = synthesizeLastFmCompat([], 'Ed Sheeran');
    assertions.push(check('synthesizeLastFmCompat([]) returns { found: false }',
      result.found === false));
  } catch (e) {
    assertions.push(check('synthesizeLastFmCompat([]) does not throw', false, e.message));
  }

  // Null packages
  try {
    result = synthesizeLastFmCompat(null, 'Ed Sheeran');
    assertions.push(check('synthesizeLastFmCompat(null) returns { found: false }',
      result.found === false));
  } catch (e) {
    assertions.push(check('synthesizeLastFmCompat(null) does not throw', false, e.message));
  }

  // Package with null payload
  try {
    const pkg = lastfmPkg(Capability.ARTIST_IDENTITY, null);
    result = synthesizeLastFmCompat([pkg], 'Ed Sheeran');
    assertions.push(check('null ARTIST_IDENTITY payload → { found: false }',
      result.found === false));
  } catch (e) {
    assertions.push(check('null ARTIST_IDENTITY payload does not throw', false, e.message));
  }

  // Bridge with empty packages
  try {
    const canonical = bridgeToCanonical([]);
    assertions.push(check('bridgeToCanonical([]) does not throw and returns object',
      typeof canonical === 'object' && canonical !== null));
    assertions.push(check('bridgeToCanonical([]) has no platforms.lastfm',
      canonical?.platforms?.lastfm === undefined));
  } catch (e) {
    assertions.push(check('bridgeToCanonical([]) does not throw', false, e.message));
  }

  // Bridge with malformed ARTIST_IDENTITY payload (missing name)
  try {
    const pkg  = lastfmPkg(Capability.ARTIST_IDENTITY, { url: 'https://last.fm/music/X' });
    const canonical = bridgeToCanonical([pkg]);
    assertions.push(check('malformed ARTIST_IDENTITY (missing name) → bridge does not throw',
      true));
    assertions.push(check('malformed ARTIST_IDENTITY → platforms.lastfm not created (or empty)',
      canonical?.platforms?.lastfm === undefined || canonical?.platforms?.lastfm?.name === undefined));
  } catch (e) {
    assertions.push(check('malformed ARTIST_IDENTITY does not throw', false, e.message));
  }

  // Bridge with malformed TRACKS payload (track key missing)
  try {
    const pkg  = lastfmPkg(Capability.TRACKS, { '@attr': {} });
    const canonical = bridgeToCanonical([pkg]);
    assertions.push(check('malformed TRACKS payload (no track[]) → bridge does not throw', true));
    assertions.push(check('malformed TRACKS payload → topTracks is empty array',
      Array.isArray(canonical?.platforms?.lastfm?.topTracks) &&
      canonical.platforms.lastfm.topTracks.length === 0));
  } catch (e) {
    assertions.push(check('malformed TRACKS payload does not throw', false, e.message));
  }

  // Bridge with null ALBUMS payload
  try {
    const pkg  = lastfmPkg(Capability.ALBUMS, null);
    const canonical = bridgeToCanonical([pkg]);
    assertions.push(check('null ALBUMS payload → bridge does not throw', true));
  } catch (e) {
    assertions.push(check('null ALBUMS payload does not throw', false, e.message));
  }

  // Community evidence independence: community.listeners ≠ Spotify followers
  // (structural check — community namespace must not cross-contaminate other platforms)
  try {
    const packages  = [lastfmPkg(Capability.ARTIST_IDENTITY, ARTIST_PAYLOAD)];
    const canonical = bridgeToCanonical(packages);
    const spotify   = canonical?.platforms?.spotify;
    assertions.push(check('Last.fm listeners do not appear in platforms.spotify',
      !(spotify?.stats?.monthlyListeners === 8312456)));
  } catch (e) {
    assertions.push(check('community independence check does not throw', false, e.message));
  }

  return assertions;
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runLastFmConnector() {
  const suiteName = '13-lastfm';
  const groups = [
    { name: 'A – Static contract',                  fn: groupA },
    { name: 'B – Connector auth',                   fn: groupB },
    { name: 'C – ARTIST_IDENTITY bridge',            fn: groupC },
    { name: 'D – TRACKS bridge',                     fn: groupD },
    { name: 'E – ALBUMS bridge',                     fn: groupE },
    { name: 'F – synthesizeLastFmCompat legacy',    fn: groupF },
    { name: 'G – Edge cases / never-throw',          fn: groupG },
  ];

  let passed = 0;
  let failed = 0;
  const details = [];

  for (const group of groups) {
    let results;
    try {
      results = await group.fn();
    } catch (err) {
      results = [{ label: `${group.name} (group threw)`, pass: false, note: err.message }];
    }
    for (const r of results) {
      if (r.pass) passed++; else failed++;
      details.push({ group: group.name, ...r });
    }
  }

  return {
    name:       suiteName,
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
