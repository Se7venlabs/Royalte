// ─── Suite 10: The MLC PAL Production Migration™ ─────────────────────────────
//
// Phase 3.6 (The MLC) Board Certification — 2026-07-02
//
// Verifies the constitutional MLC PAL pipeline — Royaltē's first Publishing Authority:
//   A — Static contract: capabilities, provider name, connector version, trust
//   B — MLCConnector: initialize + authenticate behavior (with/without credentials)
//   C — EvidenceBridge: ISRC translation → platforms.mlc.recordings[]
//   D — EvidenceBridge: PUBLISHING translation → platforms.mlc.details.works[]
//   E — Constitutional hierarchy: Recording ≠ Musical Work (hierarchy preserved, not flattened)
//   F — Evidence preservation: publishers, writers, ISWC, AKAs all intact in raw works
//   G — Edge cases: null/empty/malformed input never throws; bridge never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }     from '../../../lib/rie/EvidenceBridge.js';
import { MLC_CAPABILITIES }       from '../../../provider-acquisition/connectors/mlc/mlc-capabilities.js';
import { Capability }             from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract } from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { PROVIDER_NAME, CONNECTOR_VERSION, MLCConnector }
  from '../../../provider-acquisition/connectors/mlc/MLCConnector.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-02T00:00:00.000Z';

function mlcContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-mlc',
    correlationId:        'test-corr-mlc',
    requestId:            'test-req-mlc',
    provider:             'mlc',
    providerVersion:      'v1',
    connectorVersion:     '1.0',
    providerTrust:        95,
    capabilityProfileRef: '1.0',
    acquiredAt:           NOW,
    health:               { state: 'AVAILABLE' },
    completeness:         payload ? 'full' : 'empty',
    payload,
    payloadChecksum:      'mock-checksum',
    rawResponseHash:      'mock-hash',
  });
}

function mlcPkg(evidenceType, payload) {
  return { evidenceType, contract: mlcContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────
//
// Constitutional hierarchy:
//   Recording (ISRC evidence) → mlcsongCode → Musical Work (PUBLISHING evidence)
//   Musical Work → publishers[], writers[], iswc, akas[]

// POST /search/recordings response — Recording[]
// Note: field uses mlcsongCode (lowercase 's')
const RECORDINGS_PAYLOAD = [
  {
    id:          'rec-001',
    title:       'Shape of You',
    artist:      'Ed Sheeran',
    isrc:        'GBAHS1600463',
    mlcsongCode: 'EA082P',
    labels:      ['Atlantic Records', 'Warner Music UK'],
  },
  {
    id:          'rec-002',
    title:       'Shape of You (Acoustic)',
    artist:      'Ed Sheeran',
    isrc:        'GBAHS1700001',
    mlcsongCode: 'EA082P',   // same work, different recording
    labels:      ['Atlantic Records'],
  },
  {
    id:          'rec-003',
    title:       'Castle on the Hill',
    artist:      'Ed Sheeran',
    isrc:        'GBAHS1600465',
    mlcsongCode: 'S831QA',
    labels:      ['Atlantic Records', 'Warner Music UK'],
  },
];

// POST /works response — Work[]
// Note: field uses mlcSongCode (uppercase 'S') and primaryTitle
const WORKS_PAYLOAD = [
  {
    primaryTitle:  'Shape of You',
    mlcSongCode:   'EA082P',
    membersSongId: 'MEM001',
    iswc:          'T-921.536.001-0',
    artists:       [{ name: 'Ed Sheeran' }],
    akas: [
      { akaTitle: 'Shape Of You', akaTitleTypeCode: 'AT', akaId: 'aka-001' },
    ],
    writers: [
      {
        writerFirstName: 'Edward',
        writerLastName:  'Sheeran',
        writerIPI:       '00553927870',
        writerId:        'wr-001',
        writerRoleCode:  'CA',
        chainId:         'chain-001',
        chainParentId:   null,
      },
      {
        writerFirstName: 'Johnny',
        writerLastName:  'McDaid',
        writerIPI:       '00581809437',
        writerId:        'wr-002',
        writerRoleCode:  'CA',
        chainId:         'chain-001',
        chainParentId:   null,
      },
    ],
    publishers: [
      {
        publisherName:       'Sony Music Publishing (US) LLC',
        publisherId:         'pub-001',
        publisherIpiNumber:  '00364281420',
        mlcPublisherNumber:  'MLC-PUB-001',
        publisherRoleCode:   'E',
        collectionShare:     33.33,
        chainId:             'chain-001',
        chainParentId:       null,
        administrators:      [],
        parentPublishers:    [],
      },
      {
        publisherName:       'Warner Chappell Music Ltd.',
        publisherId:         'pub-002',
        publisherIpiNumber:  '00141324237',
        mlcPublisherNumber:  'MLC-PUB-002',
        publisherRoleCode:   'E',
        collectionShare:     33.33,
        chainId:             'chain-001',
        chainParentId:       null,
        administrators:      [],
        parentPublishers:    [],
      },
    ],
  },
  {
    primaryTitle:  'Castle on the Hill',
    mlcSongCode:   'S831QA',
    membersSongId: 'MEM002',
    iswc:          'T-921.001.234-5',
    artists:       [{ name: 'Ed Sheeran' }],
    akas:          [],
    writers: [
      {
        writerFirstName: 'Edward',
        writerLastName:  'Sheeran',
        writerIPI:       '00553927870',
        writerId:        'wr-001',
        writerRoleCode:  'CA',
        chainId:         'chain-002',
        chainParentId:   null,
      },
    ],
    publishers: [
      {
        publisherName:       'Sony Music Publishing (US) LLC',
        publisherId:         'pub-001',
        publisherIpiNumber:  '00364281420',
        mlcPublisherNumber:  'MLC-PUB-001',
        publisherRoleCode:   'E',
        collectionShare:     100,
        chainId:             'chain-002',
        chainParentId:       null,
        administrators:      [],
        parentPublishers:    [],
      },
    ],
  },
];

// ── Group A: Static contract ──────────────────────────────────────────────────

function groupA() {
  const results = [];

  results.push(check('PROVIDER_NAME === "mlc"', PROVIDER_NAME === 'mlc'));
  results.push(check('CONNECTOR_VERSION === "1.0"', CONNECTOR_VERSION === '1.0'));
  results.push(check(
    'MLC_CAPABILITIES is frozen',
    Object.isFrozen(MLC_CAPABILITIES),
  ));
  results.push(check(
    'MLC_CAPABILITIES includes ISRC',
    MLC_CAPABILITIES.includes(Capability.ISRC),
  ));
  results.push(check(
    'MLC_CAPABILITIES includes PUBLISHING',
    MLC_CAPABILITIES.includes(Capability.PUBLISHING),
  ));
  results.push(check(
    'MLC_CAPABILITIES has exactly 2 entries',
    MLC_CAPABILITIES.length === 2,
  ));
  results.push(check(
    'MLCConnector is a class (function)',
    typeof MLCConnector === 'function',
  ));
  // Provider trust is governance-set at 95 — The MLC is the statutory US authority
  results.push(check(
    'getVersion() returns correct provider metadata',
    (() => {
      const c = new MLCConnector();
      const v = c.getVersion();
      return v.provider === 'mlc' && v.connectorVersion === '1.0' && v.providerApiVersion === 'v1';
    })(),
  ));

  return { name: 'A-static-contract', results };
}

// ── Group B: MLCConnector auth behavior ──────────────────────────────────────
//
// authenticate() makes a real network call for the MLC (username+password → JWT).
// In tests we mock fetch to control the response without hitting production API.

async function groupB() {
  const results = [];

  // No credentials → AUTH_FAILED without any network call
  const connectorNoAuth = new MLCConnector();
  await connectorNoAuth.initialize({});
  const authNoAuth = await connectorNoAuth.authenticate();
  results.push(check(
    'authenticate() with no credentials returns AUTH_FAILED',
    authNoAuth.health?.state === 'AUTH_FAILED',
    `got: ${authNoAuth.health?.state}`,
  ));
  results.push(check(
    'authenticate() with no credentials returns null credentials',
    authNoAuth.credentials === null,
  ));

  // With credentials + mock fetch that returns successful token
  const mockTokenFetch = async () => ({
    ok:   true,
    status: 200,
    text: async () => JSON.stringify({
      accessToken:  'mock-access-token',
      idToken:      'mock-id-token-jwt',
      refreshToken: 'mock-refresh-token',
      expiresIn:    3600,
      tokenType:    'Bearer',
      scope:        'openid',
    }),
  });

  const connectorWithAuth = new MLCConnector();
  await connectorWithAuth.initialize({ username: 'test@royalte.ai', password: 'test-pass', fetchFn: mockTokenFetch });
  const authWithCreds = await connectorWithAuth.authenticate();
  results.push(check(
    'authenticate() with valid credentials + mock token returns AVAILABLE',
    authWithCreds.health?.state === 'AVAILABLE',
    `got: ${authWithCreds.health?.state}`,
  ));
  results.push(check(
    'authenticate() with valid credentials returns redacted username in credentials',
    authWithCreds.credentials?.username === '[redacted]',
  ));

  // Token endpoint returns 401 → AUTH_FAILED
  const mock401Fetch = async () => ({
    ok:     false,
    status: 401,
    text:   async () => '{"message":"Invalid credentials"}',
  });
  const connectorBadPass = new MLCConnector();
  await connectorBadPass.initialize({ username: 'bad@royalte.ai', password: 'wrong', fetchFn: mock401Fetch });
  const authBadPass = await connectorBadPass.authenticate();
  results.push(check(
    'authenticate() with wrong password (401) returns AUTH_FAILED',
    authBadPass.health?.state === 'AUTH_FAILED',
    `got: ${authBadPass.health?.state}`,
  ));

  // Token response missing idToken field → AUTH_FAILED
  const mockBadTokenFetch = async () => ({
    ok:   true,
    status: 200,
    text: async () => JSON.stringify({ accessToken: 'token', tokenType: 'Bearer' }),
  });
  const connectorBadToken = new MLCConnector();
  await connectorBadToken.initialize({ username: 'test@royalte.ai', password: 'pass', fetchFn: mockBadTokenFetch });
  const authBadToken = await connectorBadToken.authenticate();
  results.push(check(
    'authenticate() when idToken absent in response returns AUTH_FAILED',
    authBadToken.health?.state === 'AUTH_FAILED',
    `got: ${authBadToken.health?.state}`,
  ));

  // discoverCapabilities() shape
  const profile = await connectorWithAuth.discoverCapabilities();
  results.push(check(
    'discoverCapabilities() returns an object',
    profile !== null && typeof profile === 'object',
  ));

  await connectorWithAuth.shutdown();

  return { name: 'B-auth-behavior', results };
}

// ── Group C: EvidenceBridge — ISRC (recordings) ──────────────────────────────

function groupC() {
  const results = [];

  const packages = [mlcPkg(Capability.ISRC, RECORDINGS_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  results.push(check(
    'bridgeToCanonical produces platforms.mlc',
    canonical.platforms?.mlc !== undefined,
  ));
  results.push(check(
    'platforms.mlc.recordings is the raw array',
    Array.isArray(canonical.platforms?.mlc?.recordings) &&
    canonical.platforms.mlc.recordings.length === 3,
    `got length: ${canonical.platforms?.mlc?.recordings?.length}`,
  ));
  results.push(check(
    'recordingCount equals recordings array length',
    canonical.platforms?.mlc?.recordingCount === 3,
    `got: ${canonical.platforms?.mlc?.recordingCount}`,
  ));
  results.push(check(
    'mlcSongCodes extracted from recordings (deduplicated)',
    Array.isArray(canonical.platforms?.mlc?.mlcSongCodes) &&
    canonical.platforms.mlc.mlcSongCodes.length === 2,   // EA082P + S831QA (EA082P deduplicated)
    `got: ${JSON.stringify(canonical.platforms?.mlc?.mlcSongCodes)}`,
  ));
  results.push(check(
    'mlcSongCodes contains EA082P',
    canonical.platforms?.mlc?.mlcSongCodes?.includes('EA082P'),
  ));
  results.push(check(
    'mlcSongCodes contains S831QA',
    canonical.platforms?.mlc?.mlcSongCodes?.includes('S831QA'),
  ));
  results.push(check(
    'first recording preserves isrc field',
    canonical.platforms?.mlc?.recordings?.[0]?.isrc === 'GBAHS1600463',
    `got: ${canonical.platforms?.mlc?.recordings?.[0]?.isrc}`,
  ));
  results.push(check(
    'first recording preserves labels array',
    Array.isArray(canonical.platforms?.mlc?.recordings?.[0]?.labels) &&
    canonical.platforms.mlc.recordings[0].labels.length === 2,
  ));
  results.push(check(
    'recordings preserved: mlcsongCode field intact (lowercase s)',
    canonical.platforms?.mlc?.recordings?.[0]?.mlcsongCode === 'EA082P',
    `got: ${canonical.platforms?.mlc?.recordings?.[0]?.mlcsongCode}`,
  ));

  return { name: 'C-isrc-recordings-bridge', results };
}

// ── Group D: EvidenceBridge — PUBLISHING (works) ─────────────────────────────

function groupD() {
  const results = [];

  const packages = [
    mlcPkg(Capability.ISRC,       RECORDINGS_PAYLOAD),
    mlcPkg(Capability.PUBLISHING,  WORKS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  const det = canonical.platforms?.mlc?.details;
  results.push(check(
    'platforms.mlc.details object created',
    det !== null && typeof det === 'object',
  ));
  results.push(check(
    'details.works is the raw Work array',
    Array.isArray(det?.works) && det.works.length === 2,
    `got length: ${det?.works?.length}`,
  ));
  results.push(check(
    'details.workCount equals works array length',
    det?.workCount === 2,
    `got: ${det?.workCount}`,
  ));
  results.push(check(
    'first work has primaryTitle (MLC /works response field)',
    det?.works?.[0]?.primaryTitle === 'Shape of You',
    `got: ${det?.works?.[0]?.primaryTitle}`,
  ));
  results.push(check(
    'first work has mlcSongCode (uppercase S in /works response)',
    det?.works?.[0]?.mlcSongCode === 'EA082P',
    `got: ${det?.works?.[0]?.mlcSongCode}`,
  ));
  results.push(check(
    'first work has iswc',
    det?.works?.[0]?.iswc === 'T-921.536.001-0',
    `got: ${det?.works?.[0]?.iswc}`,
  ));

  return { name: 'D-publishing-works-bridge', results };
}

// ── Group E: Constitutional hierarchy preserved, not flattened ────────────────
//
// Board Amendment (Phase 3.6-MLC): A Recording is not a Musical Work.
// The bridge must not collapse the hierarchy:
//   Recording → ISRC → mlcsongCode → Musical Work → publishers/writers/ISWC

function groupE() {
  const results = [];

  const packages = [
    mlcPkg(Capability.ISRC,       RECORDINGS_PAYLOAD),
    mlcPkg(Capability.PUBLISHING,  WORKS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  // Recordings and Works live in separate namespaces
  results.push(check(
    'recordings live at platforms.mlc.recordings (Recording entity)',
    Array.isArray(canonical.platforms?.mlc?.recordings),
  ));
  results.push(check(
    'works live at platforms.mlc.details.works (Musical Work entity)',
    Array.isArray(canonical.platforms?.mlc?.details?.works),
  ));
  results.push(check(
    'recordings and works are NOT merged into a single array',
    canonical.platforms?.mlc?.recordings !== canonical.platforms?.mlc?.details?.works,
  ));

  // Musical Work hierarchy preserved as nested structure
  const firstWork = canonical.platforms?.mlc?.details?.works?.[0];
  results.push(check(
    'publishers preserved as nested array on Work (not flattened to top level)',
    Array.isArray(firstWork?.publishers) && firstWork.publishers.length === 2,
    `got publishers length: ${firstWork?.publishers?.length}`,
  ));
  results.push(check(
    'writers preserved as nested array on Work (not flattened to top level)',
    Array.isArray(firstWork?.writers) && firstWork.writers.length === 2,
    `got writers length: ${firstWork?.writers?.length}`,
  ));
  results.push(check(
    'no flattened publisherNames array at details level',
    !Object.prototype.hasOwnProperty.call(canonical.platforms?.mlc?.details ?? {}, 'publisherNames'),
  ));
  results.push(check(
    'no flattened iswcs array at details level',
    !Object.prototype.hasOwnProperty.call(canonical.platforms?.mlc?.details ?? {}, 'iswcs'),
  ));

  // mlcSongCodes at recording level = the bridge between Recording and Musical Work
  results.push(check(
    'mlcSongCodes bridge exists at platforms.mlc (connecting Recording to Work)',
    Array.isArray(canonical.platforms?.mlc?.mlcSongCodes),
  ));

  return { name: 'E-hierarchy-preserved', results };
}

// ── Group F: Evidence preservation ───────────────────────────────────────────

function groupF() {
  const results = [];

  const packages = [
    mlcPkg(Capability.ISRC,       RECORDINGS_PAYLOAD),
    mlcPkg(Capability.PUBLISHING,  WORKS_PAYLOAD),
  ];
  const canonical = bridgeToCanonical(packages);

  const works = canonical.platforms?.mlc?.details?.works ?? [];
  const firstWork = works[0];

  // Publisher fields preserved in full
  const firstPub = firstWork?.publishers?.[0];
  results.push(check(
    'publisher publisherName preserved',
    firstPub?.publisherName === 'Sony Music Publishing (US) LLC',
    `got: ${firstPub?.publisherName}`,
  ));
  results.push(check(
    'publisher publisherIpiNumber preserved',
    firstPub?.publisherIpiNumber === '00364281420',
    `got: ${firstPub?.publisherIpiNumber}`,
  ));
  results.push(check(
    'publisher collectionShare preserved',
    firstPub?.collectionShare === 33.33,
    `got: ${firstPub?.collectionShare}`,
  ));
  results.push(check(
    'publisher publisherRoleCode preserved',
    firstPub?.publisherRoleCode === 'E',
    `got: ${firstPub?.publisherRoleCode}`,
  ));
  results.push(check(
    'publisher chainId preserved',
    firstPub?.chainId === 'chain-001',
    `got: ${firstPub?.chainId}`,
  ));

  // Writer fields preserved in full
  const firstWriter = firstWork?.writers?.[0];
  results.push(check(
    'writer writerIPI preserved',
    firstWriter?.writerIPI === '00553927870',
    `got: ${firstWriter?.writerIPI}`,
  ));
  results.push(check(
    'writer writerRoleCode preserved',
    firstWriter?.writerRoleCode === 'CA',
    `got: ${firstWriter?.writerRoleCode}`,
  ));
  results.push(check(
    'writer chainId preserved',
    firstWriter?.chainId === 'chain-001',
    `got: ${firstWriter?.chainId}`,
  ));

  // AKA fields preserved
  const firstAka = firstWork?.akas?.[0];
  results.push(check(
    'akas array preserved on Work',
    Array.isArray(firstWork?.akas) && firstWork.akas.length === 1,
    `got length: ${firstWork?.akas?.length}`,
  ));
  results.push(check(
    'aka akaTitle preserved',
    firstAka?.akaTitle === 'Shape Of You',
    `got: ${firstAka?.akaTitle}`,
  ));
  results.push(check(
    'aka akaTitleTypeCode preserved',
    firstAka?.akaTitleTypeCode === 'AT',
  ));

  // membersSongId and artists preserved
  results.push(check(
    'membersSongId preserved on Work',
    firstWork?.membersSongId === 'MEM001',
    `got: ${firstWork?.membersSongId}`,
  ));
  results.push(check(
    'artists array preserved on Work',
    Array.isArray(firstWork?.artists) && firstWork.artists.length === 1,
  ));

  // Recording evidence preserved
  const recordings = canonical.platforms?.mlc?.recordings ?? [];
  results.push(check(
    'all 3 recordings preserved (including duplicate song-code recordings)',
    recordings.length === 3,
    `got: ${recordings.length}`,
  ));
  results.push(check(
    'recording id field preserved',
    recordings[0]?.id === 'rec-001',
    `got: ${recordings[0]?.id}`,
  ));

  return { name: 'F-evidence-preservation', results };
}

// ── Group G: Edge cases ────────────────────────────────────────────────────────

function groupG() {
  const results = [];

  results.push(check('bridgeToCanonical([]) returns empty object', (() => {
    try { return typeof bridgeToCanonical([]) === 'object'; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical(null) does not throw', (() => {
    try { bridgeToCanonical(null); return true; } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with empty ISRC payload does not throw', (() => {
    try {
      bridgeToCanonical([mlcPkg(Capability.ISRC, [])]);
      return true;
    } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with null ISRC payload does not throw', (() => {
    try {
      bridgeToCanonical([mlcPkg(Capability.ISRC, null)]);
      return true;
    } catch { return false; }
  })()));
  results.push(check('bridgeToCanonical with empty PUBLISHING payload does not throw', (() => {
    try {
      bridgeToCanonical([mlcPkg(Capability.PUBLISHING, [])]);
      return true;
    } catch { return false; }
  })()));
  results.push(check('empty ISRC payload produces recordingCount 0', (() => {
    const c = bridgeToCanonical([mlcPkg(Capability.ISRC, [])]);
    return c.platforms?.mlc?.recordingCount === 0;
  })()));
  results.push(check('empty PUBLISHING payload produces workCount 0', (() => {
    const c = bridgeToCanonical([mlcPkg(Capability.PUBLISHING, [])]);
    return c.platforms?.mlc?.details?.workCount === 0;
  })()));
  results.push(check('recording with null mlcsongCode excluded from mlcSongCodes', (() => {
    const payload = [{ id: 'r1', title: 'Track', artist: 'Artist', isrc: 'USABC1234567', mlcsongCode: null }];
    const c = bridgeToCanonical([mlcPkg(Capability.ISRC, payload)]);
    return Array.isArray(c.platforms?.mlc?.mlcSongCodes) && c.platforms.mlc.mlcSongCodes.length === 0;
  })()));
  results.push(check('ISRC-only packages leave details undefined', (() => {
    const c = bridgeToCanonical([mlcPkg(Capability.ISRC, RECORDINGS_PAYLOAD)]);
    return c.platforms?.mlc?.details === undefined;
  })()));
  results.push(check('PUBLISHING-only packages leave recordings undefined', (() => {
    const c = bridgeToCanonical([mlcPkg(Capability.PUBLISHING, WORKS_PAYLOAD)]);
    return c.platforms?.mlc?.recordings === undefined;
  })()));

  return { name: 'G-edge-cases', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runMLCConnector() {
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
    name:       '10-mlc-connector',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
