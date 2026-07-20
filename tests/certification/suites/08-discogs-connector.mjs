// ─── Suite 08: Discogs PAL Production Migration™ ─────────────────────────────
//
// Phase 3.6 (Discogs) Board Certification — 2026-07-03
//
// Verifies the constitutional Discogs PAL pipeline:
//   A — Static contract: capabilities, provider name, connector version
//   B — DiscogsConnector: initialize + authenticate with/without credentials
//   C — EvidenceBridge: ARTIST_IDENTITY translation (search + direct lookup shapes)
//   D — EvidenceBridge: RELEASES translation → platforms.discogs.details.releases[]
//   E — synthesizeDiscogsCompat: legacy compat shape output
//   F — Catalog Intelligence: physicalReleaseCount + year range from Discogs
//   G — Edge cases: null/empty/malformed input never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { bridgeToCanonical }         from '../../../lib/rie/EvidenceBridge.js';
import { assembleCatalogIntelligence } from '../../../api/_lib/catalog-intelligence.js';
import { assembleCatalogEvidence }    from '../../../api/_lib/catalog-evidence.js';
import { DISCOGS_CAPABILITIES }       from '../../../provider-acquisition/connectors/discogs/discogs-capabilities.js';
import { Capability }                 from '../../../provider-acquisition/capability/capabilityVocabulary.js';
import { createEvidenceContract }     from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { synthesizeDiscogsCompat }    from '../../../api/_lib/discogs-pal-acquisition.js';
import { CATALOG_EVIDENCE_POLICY }    from '../../../api/_lib/catalog-evidence-policy.js';
import { PROVIDER_NAME, CONNECTOR_VERSION }
  from '../../../provider-acquisition/connectors/discogs/DiscogsConnector.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-03T00:00:00.000Z';

function discogsContract(evidenceType, payload) {
  return createEvidenceContract({
    acquisitionId:        'test-acq-discogs',
    correlationId:        'test-corr-discogs',
    requestId:            'test-req-discogs',
    provider:             'discogs',
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

function discogsPkg(evidenceType, payload) {
  return { evidenceType, contract: discogsContract(evidenceType, payload) };
}

// ── Mock payloads ─────────────────────────────────────────────────────────────

const SEARCH_PAYLOAD = {
  results: [
    {
      id:           1289696,
      type:         'artist',
      title:        'David Bowie',
      thumb:        'https://i.discogs.com/thumb.jpg',
      uri:          '/artist/1289696-David-Bowie',
      resource_url: 'https://api.discogs.com/artists/1289696',
    },
  ],
  pagination: { per_page: 5, items: 1, page: 1, pages: 1 },
};

const DIRECT_PAYLOAD = {
  id:            1289696,
  name:          'David Bowie',
  profile:       'David Robert Jones (8 January 1947 – 10 January 2016)...',
  resource_url:  'https://api.discogs.com/artists/1289696',
  uri:           'https://www.discogs.com/artist/1289696-David-Bowie',
  data_quality:  'Correct',
  urls:          ['https://www.davidbowie.com'],
  images: [
    { type: 'primary', uri: 'https://i.discogs.com/full.jpg', width: 600, height: 600 },
  ],
  aliases:         [{ id: 1234, name: 'Ziggy Stardust', resource_url: '' }],
  namevariations:  ['Dave Bowie', 'D. Bowie'],
  members:         [],
  groups:          [],
};

const RELEASES_PAYLOAD = {
  releases: [
    { id: 1234, type: 'master', main_release: 5678, title: 'Space Oddity',   year: 1969,
      artist: 'David Bowie', role: 'Main', label: 'Philips',      format: 'Vinyl', catno: 'SBL 7912' },
    { id: 2345, type: 'master', main_release: 6789, title: 'Ziggy Stardust', year: 1972,
      artist: 'David Bowie', role: 'Main', label: 'RCA Victor',   format: 'Vinyl', catno: 'SF 8287' },
    { id: 3456, type: 'release', main_release: null, title: 'Heroes',        year: 1977,
      artist: 'David Bowie', role: 'Main', label: 'RCA',          format: 'CD',    catno: 'PL 12522' },
  ],
  pagination: { per_page: 100, items: 147, page: 1, pages: 2 },
};

// ── Group A — Static contract ──────────────────────────────────────────────────

function groupA() {
  const assertions = [];

  assertions.push(check('PROVIDER_NAME is "discogs"',
    PROVIDER_NAME === 'discogs'));

  assertions.push(check('CONNECTOR_VERSION is "1.0"',
    CONNECTOR_VERSION === '1.0'));

  assertions.push(check('DISCOGS_CAPABILITIES is frozen',
    Object.isFrozen(DISCOGS_CAPABILITIES)));

  assertions.push(check('DISCOGS_CAPABILITIES is an array',
    Array.isArray(DISCOGS_CAPABILITIES)));

  assertions.push(check('DISCOGS_CAPABILITIES includes ARTIST_IDENTITY',
    DISCOGS_CAPABILITIES.includes(Capability.ARTIST_IDENTITY)));

  assertions.push(check('DISCOGS_CAPABILITIES includes RELEASES',
    DISCOGS_CAPABILITIES.includes(Capability.RELEASES)));

  assertions.push(check('DISCOGS_CAPABILITIES has exactly 2 capabilities',
    DISCOGS_CAPABILITIES.length === 2, `got ${DISCOGS_CAPABILITIES.length}`));

  return { label: 'A — Static Contract', assertions };
}

// ── Group B — DiscogsConnector auth behavior ──────────────────────────────────

async function groupB() {
  const assertions = [];

  const { DiscogsConnector }  = await import('../../../provider-acquisition/connectors/discogs/DiscogsConnector.js');
  const { HealthState }       = await import('../../../provider-acquisition/health/healthStates.js');

  // initialize without credentials → authenticate returns AUTH_FAILED
  const c1 = new DiscogsConnector();
  await c1.initialize({});
  const auth1 = await c1.authenticate();
  assertions.push(check('authenticate without credentials returns AUTH_FAILED',
    auth1.health.state === HealthState.AUTH_FAILED));

  // acquire without credentials → empty contract
  const c2 = new DiscogsConnector();
  await c2.initialize({});
  const { createEvidenceRequest } = await import('../../../provider-acquisition/evidence/EvidenceRequest.js');
  const contract = await c2.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'David Bowie' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assertions.push(check('acquire without credentials returns empty contract',
    contract.completeness === 'empty'));

  // initialize with credentials → authenticate returns AVAILABLE
  const c3 = new DiscogsConnector();
  await c3.initialize({ consumerKey: 'testkey', consumerSecret: 'testsecret' });
  const auth3 = await c3.authenticate();
  assertions.push(check('authenticate with credentials returns AVAILABLE',
    auth3.health.state === HealthState.AVAILABLE));
  assertions.push(check('credentials stored (consumerKey in result)',
    auth3.credentials?.consumerKey === 'testkey'));

  // shutdown clears config → subsequent acquire returns empty
  await c3.shutdown();
  const contract2 = await c3.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'David Bowie' },
    evidenceType: Capability.ARTIST_IDENTITY,
  }));
  assertions.push(check('after shutdown acquire returns empty contract',
    contract2.completeness === 'empty'));

  // unsupported capability returns empty contract
  const c4 = new DiscogsConnector();
  await c4.initialize({ consumerKey: 'testkey', consumerSecret: 'testsecret' });
  const contract3 = await c4.acquire(createEvidenceRequest({
    subjectRef:   { artistName: 'David Bowie' },
    evidenceType: Capability.PUBLISHING,
  }));
  assertions.push(check('unsupported capability returns empty contract',
    contract3.completeness === 'empty'));
  assertions.push(check('unsupported capability contract has correct provider',
    contract3.provider === PROVIDER_NAME));
  await c4.shutdown();

  return { label: 'B — DiscogsConnector Auth Behavior', assertions };
}

// ── Group C — EvidenceBridge: ARTIST_IDENTITY translation ─────────────────────

function groupC() {
  const assertions = [];

  // Search result shape
  const searchPkg  = [discogsPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD)];
  const canonical1 = bridgeToCanonical(searchPkg);

  assertions.push(check('ARTIST_IDENTITY (search): platforms.discogs present',
    canonical1?.platforms?.discogs != null));

  assertions.push(check('ARTIST_IDENTITY (search): availability = VERIFIED',
    canonical1?.platforms?.discogs?.availability === 'VERIFIED'));

  assertions.push(check('ARTIST_IDENTITY (search): artistId extracted',
    canonical1?.platforms?.discogs?.artistId === 1289696));

  assertions.push(check('ARTIST_IDENTITY (search): artistName extracted',
    canonical1?.platforms?.discogs?.artistName === 'David Bowie'));

  assertions.push(check('ARTIST_IDENTITY (search): details.artistId set',
    canonical1?.platforms?.discogs?.details?.artistId === 1289696));

  // Direct lookup shape
  const directPkg  = [discogsPkg(Capability.ARTIST_IDENTITY, DIRECT_PAYLOAD)];
  const canonical2 = bridgeToCanonical(directPkg);

  assertions.push(check('ARTIST_IDENTITY (direct): availability = VERIFIED',
    canonical2?.platforms?.discogs?.availability === 'VERIFIED'));

  assertions.push(check('ARTIST_IDENTITY (direct): artistId extracted',
    canonical2?.platforms?.discogs?.artistId === 1289696));

  assertions.push(check('ARTIST_IDENTITY (direct): artistName extracted',
    canonical2?.platforms?.discogs?.artistName === 'David Bowie'));

  assertions.push(check('ARTIST_IDENTITY (direct): profile preserved',
    typeof canonical2?.platforms?.discogs?.profile === 'string' &&
    canonical2.platforms.discogs.profile.length > 0));

  assertions.push(check('ARTIST_IDENTITY (direct): urls is array',
    Array.isArray(canonical2?.platforms?.discogs?.urls)));

  assertions.push(check('ARTIST_IDENTITY (direct): images is array',
    Array.isArray(canonical2?.platforms?.discogs?.images)));

  assertions.push(check('ARTIST_IDENTITY (direct): aliases is array',
    Array.isArray(canonical2?.platforms?.discogs?.aliases)));

  assertions.push(check('ARTIST_IDENTITY (direct): namevariations is array',
    Array.isArray(canonical2?.platforms?.discogs?.namevariations)));

  assertions.push(check('ARTIST_IDENTITY (direct): namevariations count correct',
    canonical2?.platforms?.discogs?.namevariations?.length === 2));

  assertions.push(check('ARTIST_IDENTITY (direct): dataQuality preserved',
    canonical2?.platforms?.discogs?.dataQuality === 'Correct'));

  return { label: 'C — EvidenceBridge: ARTIST_IDENTITY Translation', assertions };
}

// ── Group D — EvidenceBridge: RELEASES translation ────────────────────────────

function groupD() {
  const assertions = [];

  const releasesPkg = [discogsPkg(Capability.RELEASES, RELEASES_PAYLOAD)];
  const canonical   = bridgeToCanonical(releasesPkg);

  assertions.push(check('RELEASES: platforms.discogs.details.releases present',
    Array.isArray(canonical?.platforms?.discogs?.details?.releases)));

  assertions.push(check('RELEASES: correct release count',
    canonical?.platforms?.discogs?.details?.releases?.length === 3,
    `got ${canonical?.platforms?.discogs?.details?.releases?.length}`));

  const r0 = canonical?.platforms?.discogs?.details?.releases?.[0];
  assertions.push(check('RELEASES: first release has id',
    r0?.id === 1234));

  assertions.push(check('RELEASES: first release has title',
    r0?.title === 'Space Oddity'));

  assertions.push(check('RELEASES: first release has year',
    r0?.year === 1969));

  assertions.push(check('RELEASES: first release has label',
    r0?.label === 'Philips'));

  assertions.push(check('RELEASES: first release has format',
    r0?.format === 'Vinyl'));

  assertions.push(check('RELEASES: first release has catno',
    r0?.catno === 'SBL 7912'));

  assertions.push(check('RELEASES: first release type is "master"',
    r0?.type === 'master'));

  assertions.push(check('RELEASES: first release mainRelease preserved',
    r0?.mainRelease === 5678));

  assertions.push(check('RELEASES: totalReleases from pagination',
    canonical?.platforms?.discogs?.details?.totalReleases === 147));

  assertions.push(check('RELEASES: releasesPage preserved',
    canonical?.platforms?.discogs?.details?.releasesPage === 1));

  assertions.push(check('RELEASES: releasesPages preserved',
    canonical?.platforms?.discogs?.details?.releasesPages === 2));

  const r2 = canonical?.platforms?.discogs?.details?.releases?.[2];
  assertions.push(check('RELEASES: CD release has format "CD"',
    r2?.format === 'CD'));

  return { label: 'D — EvidenceBridge: RELEASES Translation', assertions };
}

// ── Group E — synthesizeDiscogsCompat ─────────────────────────────────────────

function groupE() {
  const assertions = [];

  // Empty → found: false
  const empty = synthesizeDiscogsCompat([], 'David Bowie');
  assertions.push(check('synthesizeDiscogsCompat([]) returns found: false',  empty.found === false));
  assertions.push(check('synthesizeDiscogsCompat([]) releases = 0',          empty.releases === 0));
  assertions.push(check('synthesizeDiscogsCompat([]) artistId = null',       empty.artistId === null));
  assertions.push(check('synthesizeDiscogsCompat([]) link = null',           empty.link === null));

  // Empty contract → found: false
  const emptyPkg = [discogsPkg(Capability.ARTIST_IDENTITY, null)];
  assertions.push(check('synthesizeDiscogsCompat(empty contract) returns found: false',
    synthesizeDiscogsCompat(emptyPkg, 'David Bowie').found === false));

  // Search payload + releases payload → found: true
  const fullPkgs = [
    discogsPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD),
    discogsPkg(Capability.RELEASES, RELEASES_PAYLOAD),
  ];
  const full = synthesizeDiscogsCompat(fullPkgs, 'David Bowie');
  assertions.push(check('synthesizeDiscogsCompat(full): found = true',
    full.found === true));
  assertions.push(check('synthesizeDiscogsCompat(full): artistId = 1289696',
    full.artistId === 1289696));
  assertions.push(check('synthesizeDiscogsCompat(full): name = "David Bowie"',
    full.name === 'David Bowie'));
  assertions.push(check('synthesizeDiscogsCompat(full): releases = 147 (pagination.items)',
    full.releases === 147));
  assertions.push(check('synthesizeDiscogsCompat(full): link contains artistId',
    full.link?.includes('1289696')));

  // Direct payload → found: true
  const directPkgs = [discogsPkg(Capability.ARTIST_IDENTITY, DIRECT_PAYLOAD)];
  const direct = synthesizeDiscogsCompat(directPkgs, 'David Bowie');
  assertions.push(check('synthesizeDiscogsCompat(direct): found = true',
    direct.found === true));
  assertions.push(check('synthesizeDiscogsCompat(direct): artistId correct',
    direct.artistId === 1289696));

  // No name match in search → found: false
  const wrongName = synthesizeDiscogsCompat(
    [discogsPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD)],
    'Taylor Swift'
  );
  assertions.push(check('synthesizeDiscogsCompat: non-matching name returns found: false',
    wrongName.found === false));

  // Case-insensitive name match
  const lcMatch = synthesizeDiscogsCompat(
    [discogsPkg(Capability.ARTIST_IDENTITY, SEARCH_PAYLOAD)],
    'david bowie'
  );
  assertions.push(check('synthesizeDiscogsCompat: case-insensitive match works',
    lcMatch.found === true));

  // null input does not throw
  let threw = false;
  try { synthesizeDiscogsCompat(null); } catch { threw = true; }
  assertions.push(check('synthesizeDiscogsCompat(null) does not throw', !threw));

  return { label: 'E — synthesizeDiscogsCompat Legacy Shape', assertions };
}

// ── Group F — Catalog Intelligence: Discogs integration ──────────────────────

function groupF() {
  const assertions = [];

  // With Discogs releases — physicalReleaseCount should be set
  const canonicalWithDiscogs = {
    platforms: {
      appleMusic: { availability: 'VERIFIED', details: { albums: [] } },
      discogs: {
        details: {
          totalReleases: 147,
          releases: RELEASES_PAYLOAD.releases.map(r => ({
            id: r.id, title: r.title, year: r.year, format: r.format,
            label: r.label, catno: r.catno, type: r.type,
          })),
        },
      },
    },
    catalog: { singlesCount: 0, epsCount: 0, albumsCount: 0, totalTracks: 0 },
  };

  let ci;
  let threw = false;
  // Phase 2 Recovery: assembleCatalogIntelligence now consumes the
  // Canonical Catalog Evidence object, not raw canonical, per Board
  // Option 3 (ADR-002). Route through assembleCatalogEvidence() first,
  // exercising the real Provider -> Normalization -> Evidence -> Intelligence
  // pipeline end-to-end.
  try { ci = assembleCatalogIntelligence(null, null, assembleCatalogEvidence(canonicalWithDiscogs)); }
  catch { threw = true; }

  assertions.push(check('assembleCatalogIntelligence with Discogs does not throw', !threw));
  assertions.push(check('physicalReleaseCount = 147', ci?.physicalReleaseCount === 147,
    `got ${ci?.physicalReleaseCount}`));

  // Without Apple albums, Discogs year range should be used as fallback
  assertions.push(check('firstReleaseYear from Discogs when Apple absent',
    ci?.firstReleaseYear === 1969, `got ${ci?.firstReleaseYear}`));
  assertions.push(check('latestReleaseYear from Discogs when Apple absent',
    ci?.latestReleaseYear === 1977, `got ${ci?.latestReleaseYear}`));

  // With Apple albums present, Apple year data wins
  const canonicalWithBoth = {
    ...canonicalWithDiscogs,
    platforms: {
      ...canonicalWithDiscogs.platforms,
      appleMusic: {
        availability: 'VERIFIED',
        details: {
          albums: [
            { id: 'ap1', name: 'Aladdin Sane', trackCount: 10, releaseDate: '1973-04-13' },
            { id: 'ap2', name: 'Scary Monsters', trackCount: 10, releaseDate: '1980-09-12' },
          ],
        },
      },
    },
  };

  let ci2;
  try { ci2 = assembleCatalogIntelligence(null, null, assembleCatalogEvidence(canonicalWithBoth)); } catch { ci2 = null; }

  assertions.push(check('firstReleaseYear = 1973 when Apple albums present (Apple wins)',
    ci2?.firstReleaseYear === 1973, `got ${ci2?.firstReleaseYear}`));
  assertions.push(check('physicalReleaseCount still set when Apple present',
    ci2?.physicalReleaseCount === 147));

  // Without Discogs → physicalReleaseCount = null
  const canonicalNoDiscogs = {
    platforms: { appleMusic: { availability: 'NOT_FOUND', details: {} } },
    catalog: {},
  };
  let ci3;
  try { ci3 = assembleCatalogIntelligence(null, null, assembleCatalogEvidence(canonicalNoDiscogs)); } catch { ci3 = null; }
  assertions.push(check('physicalReleaseCount = null when no Discogs evidence',
    ci3?.physicalReleaseCount === null));

  return { label: 'F — Catalog Intelligence: Discogs Integration', assertions };
}

// ── Group F2 — Catalog Evidence Policy ───────────────────────────────────────

function groupF2() {
  const assertions = [];
  const policy = CATALOG_EVIDENCE_POLICY;

  assertions.push(check('CATALOG_EVIDENCE_POLICY exports an object',
    typeof policy === 'object' && policy !== null));

  assertions.push(check('policy is frozen',
    Object.isFrozen(policy)));

  assertions.push(check('policy.releaseChronology is frozen',
    Object.isFrozen(policy?.releaseChronology)));

  assertions.push(check('policy.releaseChronology is an array',
    Array.isArray(policy?.releaseChronology)));

  assertions.push(check('policy.releaseChronology[0] = "apple" (canonical primary)',
    policy?.releaseChronology?.[0] === 'apple'));

  assertions.push(check('policy.releaseChronology[1] = "discogs" (catalog authority fallback)',
    policy?.releaseChronology?.[1] === 'discogs'));

  assertions.push(check('policy.releaseChronology has exactly 2 providers',
    policy?.releaseChronology?.length === 2,
    `got ${policy?.releaseChronology?.length}`));

  return { label: 'F2 — Catalog Evidence Policy (Board-ratified)', assertions };
}

// ── Group G — Edge cases ──────────────────────────────────────────────────────

function groupG() {
  const assertions = [];

  // bridgeToCanonical robustness
  let threw = false;
  try { bridgeToCanonical(null); } catch { threw = true; }
  assertions.push(check('bridgeToCanonical(null) does not throw', !threw));

  // Null Discogs ARTIST_IDENTITY payload — skip silently
  const nullPkg = [discogsPkg(Capability.ARTIST_IDENTITY, null)];
  let threw2 = false;
  try { bridgeToCanonical(nullPkg); } catch { threw2 = true; }
  assertions.push(check('bridgeToCanonical with null ARTIST_IDENTITY payload does not throw', !threw2));

  // Null RELEASES payload — skip silently
  const nullRelPkg = [discogsPkg(Capability.RELEASES, null)];
  let threw3 = false;
  try { bridgeToCanonical(nullRelPkg); } catch { threw3 = true; }
  assertions.push(check('bridgeToCanonical with null RELEASES payload does not throw', !threw3));

  // Empty releases array in RELEASES payload
  const emptyRelsPkg = [discogsPkg(Capability.RELEASES, { releases: [], pagination: { items: 0, page: 1, pages: 0 } })];
  let threw4 = false;
  let c4;
  try { c4 = bridgeToCanonical(emptyRelsPkg); } catch { threw4 = true; }
  assertions.push(check('bridgeToCanonical with empty releases array does not throw', !threw4));
  assertions.push(check('bridgeToCanonical with empty releases: det.releases = []',
    Array.isArray(c4?.platforms?.discogs?.details?.releases) &&
    c4.platforms.discogs.details.releases.length === 0));

  // Malformed ARTIST_IDENTITY payload (no id, no results)
  const badPkg = [discogsPkg(Capability.ARTIST_IDENTITY, { unrelated: 'data' })];
  let threw5 = false;
  try { bridgeToCanonical(badPkg); } catch { threw5 = true; }
  assertions.push(check('bridgeToCanonical with malformed payload does not throw', !threw5));

  // assembleCatalogIntelligence with null canonical — should not throw
  let threw6 = false;
  try { assembleCatalogIntelligence(null, null, null); } catch { threw6 = true; }
  assertions.push(check('assembleCatalogIntelligence(null,null,null) does not throw', !threw6));

  return { label: 'G — Edge Cases', assertions };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runDiscogsConnector() {
  const suite = { name: '08-discogs-connector', passed: 0, failed: 0, assertions: 0, details: [] };

  const groups = [
    groupA(),
    await groupB(),
    groupC(),
    groupD(),
    groupE(),
    groupF(),
    groupF2(),
    groupG(),
  ];

  for (const { label, assertions } of groups) {
    const pass = assertions.filter(a => a.pass).length;
    const fail = assertions.filter(a => !a.pass).length;
    suite.passed     += pass;
    suite.failed     += fail;
    suite.assertions += assertions.length;

    suite.details.push({
      label,
      status:     fail === 0 ? 'PASS' : 'FAIL',
      passed:     pass,
      failed:     fail,
      assertions: assertions.length,
      failures:   assertions.filter(a => !a.pass),
    });
  }

  return suite;
}
