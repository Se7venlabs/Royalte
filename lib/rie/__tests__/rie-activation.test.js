// RIE Activation — Phase 2.4 Certification Suite
//
// Run: node lib/rie/__tests__/rie-activation.test.js
// Exits 0 on all-green. Exits 1 on any failure.
//
// 20 Board certification criteria:
//
//   Group A — Validator (3)         criteria  1-3
//   Group B — EvidenceBridge (3)    criteria  4-6
//   Group C — CIM structure (4)     criteria  7-10
//   Group D — Intelligence (5)      criteria 11-15
//   Group E — Determinism (2)       criteria 16-17
//   Group F — Safety (3)            criteria 18-20
//
// Execution path: (mock) AppleMusicConnector → PAL → Evidence Contract → RIE → CIM
// No real network calls. No Apple credentials required.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { runRIE, assembleCIM }          from '../index.js';
import { validateEvidencePackage, validateEvidencePackages } from '../EvidenceValidator.js';
import { bridgeToCanonical, extractEvidenceLineage } from '../EvidenceBridge.js';
import { validateCIM, CIM_VERSION }     from '../../../api/schema/canonical-intelligence-model.js';
import { createEvidenceContract }       from '../../../provider-acquisition/evidence/EvidenceContract.js';
import { createHealthSignal }           from '../../../provider-acquisition/health/ProviderHealthSignal.js';
import { computePayloadChecksum, computeRawResponseHash } from '../../../provider-acquisition/evidence/integrity.js';
import { Capability }                   from '../../../provider-acquisition/capability/capabilityVocabulary.js';

// ── Test harness ──────────────────────────────────────────────────────────────

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

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ARTIST_PAYLOAD = {
  data: [{
    id: '178834',
    type: 'artists',
    attributes: {
      name: 'Taylor Swift',
      genreNames: ['Pop', 'Country'],
      artwork: {
        url: 'https://example.com/{w}x{h}.jpg',
        width: 1400,
        height: 1400,
      },
      url: 'https://music.apple.com/us/artist/taylor-swift/178834',
    },
  }],
};

const MOCK_ALBUMS_PAYLOAD = {
  data: [
    {
      id: 'album-001',
      type: 'albums',
      attributes: {
        name: 'Fearless',
        releaseDate: '2008-11-11',
        trackCount: 13,
        artwork: { url: 'https://example.com/{w}x{h}.jpg' },
        upc: '00050087396633',
        recordLabel: 'Big Machine Records',
      },
    },
    {
      id: 'album-002',
      type: 'albums',
      attributes: {
        name: 'Taylor Swift',
        releaseDate: '2006-10-24',
        trackCount: 11,
        artwork: { url: 'https://example.com/{w}x{h}.jpg' },
        recordLabel: 'Big Machine Records',
      },
    },
    {
      id: 'album-003',
      type: 'albums',
      attributes: {
        name: 'Safe & Sound',
        releaseDate: '2012-01-13',
        trackCount: 1,
        artwork: { url: 'https://example.com/{w}x{h}.jpg' },
      },
    },
  ],
};

const MOCK_TERRITORIES_PAYLOAD = {
  albumId: 'album-001',
  storefronts: {
    us: { data: [{ id: 'album-001', type: 'albums' }] },
    ca: { data: [{ id: 'album-001', type: 'albums' }] },
    gb: { data: [{ id: 'album-001', type: 'albums' }] },
    de: { data: [] },
    fr: { error: 'NOT_FOUND' },
    jp: { data: [{ id: 'album-001', type: 'albums' }] },
    au: { data: [{ id: 'album-001', type: 'albums' }] },
    br: { data: [] },
  },
};

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeContract({ payload, completeness = 'full', provider = 'apple_music' } = {}) {
  const rawText = payload !== null ? JSON.stringify(payload) : '';
  return createEvidenceContract({
    acquisitionId:        randomUUID(),
    correlationId:        randomUUID(),
    requestId:            randomUUID(),
    provider,
    providerVersion:      'v1',
    connectorVersion:     '1.0',
    providerTrust:        100,
    capabilityProfileRef: '1.0',
    acquiredAt:           new Date().toISOString(),
    health:               createHealthSignal({ state: 'AVAILABLE', provider }),
    completeness,
    payload,
    payloadChecksum:      computePayloadChecksum(payload),
    rawResponseHash:      computeRawResponseHash(rawText),
  });
}

function makePackage(evidenceType, payload, completeness = 'full') {
  return { evidenceType, contract: makeContract({ payload, completeness }) };
}

// Full suite of Evidence Packages covering all three Apple Music evidence types.
function makeFullPackages() {
  return [
    makePackage(Capability.ARTIST_IDENTITY, MOCK_ARTIST_PAYLOAD),
    makePackage(Capability.ALBUMS,          MOCK_ALBUMS_PAYLOAD),
    makePackage(Capability.TERRITORIES,     MOCK_TERRITORIES_PAYLOAD),
  ];
}

// ────────────────────────────────────────────────────────────────────────────────
// GROUP A — EvidenceValidator  (criteria 1-3)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group A: EvidenceValidator ──────────────────────────────────────');

test('1. validateEvidencePackages rejects non-array input', () => {
  const { valid, errors } = validateEvidencePackages(null);
  assert.equal(valid, false);
  assert.ok(errors.length > 0);
});

test('2. validateEvidencePackages rejects package with missing evidenceType', () => {
  const pkg = { contract: makeContract({ payload: {} }) }; // no evidenceType
  const { valid, errors } = validateEvidencePackages([pkg]);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes('evidenceType')));
});

test('3. validateEvidencePackages rejects contract missing required field', () => {
  // Manually build a contract without evidenceId to trigger field check
  const badContract = { ...makeContract({ payload: {} }) };
  // Frozen object — test the validator itself by passing a plain object missing a field
  const pkg = { evidenceType: Capability.ARTIST_IDENTITY, contract: { acquisitionId: 'x' } };
  const { valid, errors } = validateEvidencePackages([pkg]);
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes('missing required fields')));
});

// ────────────────────────────────────────────────────────────────────────────────
// GROUP B — EvidenceBridge  (criteria 4-6)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group B: EvidenceBridge ─────────────────────────────────────────');

test('4. bridgeToCanonical maps ARTIST_IDENTITY to subject + platforms.appleMusic', () => {
  const packages = [makePackage(Capability.ARTIST_IDENTITY, MOCK_ARTIST_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  assert.equal(canonical.subject?.artistName, 'Taylor Swift');
  assert.equal(canonical.subject?.artistId, '178834');
  assert.equal(canonical.source?.platform, 'apple_music');
  assert.equal(canonical.platforms?.appleMusic?.artistName, 'Taylor Swift');
  assert.equal(canonical.platforms?.appleMusic?.artistId, '178834');
  assert.deepEqual(canonical.platforms?.appleMusic?.genres, ['Pop', 'Country']);
  assert.equal(canonical.platforms?.appleMusic?.availability, 'VERIFIED');
  assert.equal(canonical.platforms?.appleMusic?.details?.artistId, '178834');
  assert.ok(canonical.platforms?.appleMusic?.details?.artistUrl?.includes('178834'));
});

test('5. bridgeToCanonical maps ALBUMS to platforms.appleMusic.details.albums[]', () => {
  const packages = [makePackage(Capability.ALBUMS, MOCK_ALBUMS_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  const albums = canonical.platforms?.appleMusic?.details?.albums;
  assert.ok(Array.isArray(albums), 'albums should be an array');
  assert.equal(albums.length, 3);
  assert.equal(albums[0].name, 'Fearless');
  assert.equal(albums[0].trackCount, 13);
  assert.equal(albums[2].trackCount, 1); // Safe & Sound — single
});

test('6. bridgeToCanonical maps TERRITORIES to globalStorefrontAvailability', () => {
  const packages = [makePackage(Capability.TERRITORIES, MOCK_TERRITORIES_PAYLOAD)];
  const canonical = bridgeToCanonical(packages);

  const gsa = canonical.platforms?.appleMusic?.details?.globalStorefrontAvailability;
  assert.ok(gsa, 'globalStorefrontAvailability should be present');
  assert.ok(Array.isArray(gsa.available), 'available should be an array');
  assert.ok(Array.isArray(gsa.unavailable), 'unavailable should be an array');
  // us, ca, gb, jp, au = 5 available; de, fr, br = 3 unavailable
  assert.equal(gsa.available.length, 5, `expected 5 available, got ${gsa.available.length}`);
  assert.equal(gsa.unavailable.length, 3, `expected 3 unavailable, got ${gsa.unavailable.length}`);
  assert.equal(gsa.total, 8);
});

// ────────────────────────────────────────────────────────────────────────────────
// GROUP C — CIM structure  (criteria 7-10)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group C: CIM Structure ──────────────────────────────────────────');

await testAsync('7. CIM output passes validateCIM — all 12 §8.2 keys present', async () => {
  const cim = await runRIE({ evidencePackages: makeFullPackages() });
  const { valid, missing } = validateCIM(cim);
  assert.ok(valid, `CIM missing keys: ${missing.join(', ')}`);
});

await testAsync('8. CIM output is deep-frozen', async () => {
  const cim = await runRIE({ evidencePackages: makeFullPackages() });
  assert.ok(Object.isFrozen(cim), 'CIM top level should be frozen');
  assert.ok(Object.isFrozen(cim.scanAuthority), 'scanAuthority should be frozen');
});

await testAsync('9. CIM carries _certified, _cimVersion, and _certifiedAt', async () => {
  const cim = await runRIE({ evidencePackages: makeFullPackages() });
  assert.equal(cim._certified, true);
  assert.equal(cim._cimVersion, CIM_VERSION);
  assert.ok(typeof cim._certifiedAt === 'string' && cim._certifiedAt.length > 0, '_certifiedAt should be a string');
  // Must be parseable ISO 8601
  assert.ok(!isNaN(Date.parse(cim._certifiedAt)), '_certifiedAt should be a valid ISO timestamp');
});

await testAsync('10. scanAuthority carries Board-mandated evidence lineage fields', async () => {
  const packages = makeFullPackages();
  const cim = await runRIE({ evidencePackages: packages });
  const sa  = cim.scanAuthority;

  assert.ok(sa, 'scanAuthority should be present');
  assert.equal(sa.schemaVersion, '1.0', 'schemaVersion should be present');
  assert.ok(typeof sa.intelligenceEngineVersion === 'string', 'intelligenceEngineVersion should be a string');
  assert.ok(Array.isArray(sa.sourceProviders), 'sourceProviders should be an array');
  assert.ok(sa.sourceProviders.includes('apple_music'), 'sourceProviders should include apple_music');
  assert.ok(Array.isArray(sa.evidenceIds), 'evidenceIds should be an array');
  assert.equal(sa.evidenceIds.length, packages.length, 'evidenceIds count should match package count');
  assert.ok(typeof sa.certificationId === 'string' && sa.certificationId.length > 0, 'certificationId should be a UUID');
  assert.ok(typeof sa.generatedAt === 'string', 'generatedAt should be a string');
});

// ────────────────────────────────────────────────────────────────────────────────
// GROUP D — Intelligence Assembly  (criteria 11-15)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group D: Intelligence Assembly ──────────────────────────────────');

await testAsync('11. ARTIST_IDENTITY evidence produces non-null identity intelligence', async () => {
  const cim = await runRIE({
    evidencePackages: [makePackage(Capability.ARTIST_IDENTITY, MOCK_ARTIST_PAYLOAD)],
  });
  // identity is populated by assembleIdentityIntelligence which reads cio.observations.providers
  // After bridging, platforms.appleMusic.availability = 'VERIFIED', so apple state = VERIFIED.
  assert.ok(cim.identity !== null, 'identity should be non-null when ARTIST_IDENTITY evidence provided');
  assert.ok(typeof cim.identity === 'object', 'identity should be an object');
});

await testAsync('12. ALBUMS evidence populates catalog intelligence', async () => {
  const cim = await runRIE({
    evidencePackages: [
      makePackage(Capability.ARTIST_IDENTITY, MOCK_ARTIST_PAYLOAD),
      makePackage(Capability.ALBUMS, MOCK_ALBUMS_PAYLOAD),
    ],
  });
  // assembleCatalogIntelligence reads platforms.appleMusic.details.albums
  // 2 albums (13 tracks, 11 tracks) + 1 single (1 track) → albums=2, singles=1
  assert.ok(cim.catalog !== null, 'catalog should be non-null when ALBUMS evidence provided');
  assert.ok(typeof cim.catalog === 'object', 'catalog should be an object');
  assert.ok(typeof cim.catalog.albums === 'number', 'catalog.albums should be a number');
  assert.equal(cim.catalog.albums, 2, 'should classify 2 albums (trackCount ≥ 7)');
  assert.equal(cim.catalog.singles, 1, 'should classify 1 single (trackCount === 1)');
});

await testAsync('13. TERRITORIES evidence populates globalFootprint intelligence', async () => {
  const cim = await runRIE({
    evidencePackages: [
      makePackage(Capability.ARTIST_IDENTITY, MOCK_ARTIST_PAYLOAD),
      makePackage(Capability.TERRITORIES, MOCK_TERRITORIES_PAYLOAD),
    ],
  });
  // assembleGlobalMusicFootprint reads platforms.appleMusic.details.globalStorefrontAvailability
  assert.ok(cim.globalFootprint !== null, 'globalFootprint should be non-null when TERRITORIES evidence provided');
  assert.ok(typeof cim.globalFootprint === 'object', 'globalFootprint should be an object');
  // 5 available of 8 → 62.5% → 'Regional'
  assert.ok(
    ['Global', 'Strong', 'Regional', 'Limited'].includes(cim.globalFootprint.status),
    `unexpected status: ${cim.globalFootprint.status}`,
  );
  assert.equal(cim.globalFootprint.territoriesAvailable, 5, 'should show 5 territories available');
});

await testAsync('14. scanAuthority.sourceProviders always contains the provider name', async () => {
  const cim = await runRIE({ evidencePackages: makeFullPackages() });
  assert.ok(cim.scanAuthority.sourceProviders.includes('apple_music'));
});

await testAsync('15. scanAuthority.evidenceIds match input contract evidenceIds', async () => {
  const packages = makeFullPackages();
  const expectedIds = packages.map(p => p.contract.evidenceId);
  const cim = await runRIE({ evidencePackages: packages });
  for (const id of expectedIds) {
    assert.ok(
      cim.scanAuthority.evidenceIds.includes(id),
      `evidenceId ${id} should appear in scanAuthority.evidenceIds`,
    );
  }
});

// ────────────────────────────────────────────────────────────────────────────────
// GROUP E — Determinism  (criteria 16-17)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group E: Determinism ────────────────────────────────────────────');

await testAsync('16. Same Evidence Contract produces identical intelligence (only metadata differs)', async () => {
  const packages = makeFullPackages();
  const FIXED_TIME = '2026-07-01T12:00:00.000Z';
  const opts = { now: () => FIXED_TIME };

  const cim1 = await runRIE({ evidencePackages: packages }, opts);
  const cim2 = await runRIE({ evidencePackages: packages }, opts);

  // Intelligence objects must be identical
  assert.deepEqual(cim1.catalog,         cim2.catalog);
  assert.deepEqual(cim1.globalFootprint, cim2.globalFootprint);

  // generatedAt must match the injected clock
  assert.equal(cim1.scanAuthority.generatedAt, FIXED_TIME);
  assert.equal(cim2.scanAuthority.generatedAt, FIXED_TIME);

  // certificationId may differ (per-run UUID) — confirm both are present and UUIDs
  assert.ok(typeof cim1.scanAuthority.certificationId === 'string');
  assert.ok(typeof cim2.scanAuthority.certificationId === 'string');
});

await testAsync('17. Injectable now() produces deterministic _certifiedAt', async () => {
  const FIXED_TIME = '2026-07-01T00:00:00.000Z';
  const cim = await runRIE(
    { evidencePackages: makeFullPackages() },
    { now: () => FIXED_TIME },
  );
  assert.equal(cim._certifiedAt, FIXED_TIME);
  assert.equal(cim.scanAuthority.generatedAt, FIXED_TIME);
});

// ────────────────────────────────────────────────────────────────────────────────
// GROUP F — Safety  (criteria 18-20)
// ────────────────────────────────────────────────────────────────────────────────

console.log('\n── Group F: Safety ─────────────────────────────────────────────────');

await testAsync('18. runRIE never throws on null input — returns valid frozen CIM', async () => {
  let cim;
  // Must not throw
  cim = await runRIE({ evidencePackages: null });
  // Falls back to Phase 1 path with missing canonicalForEnrichment → empty CIM
  const { valid } = validateCIM(cim);
  assert.ok(valid, 'empty-evidence CIM should still pass validateCIM');
  assert.ok(Object.isFrozen(cim), 'returned CIM should be frozen even on bad input');

  // Fully null evidence object
  cim = await runRIE({});
  assert.ok(Object.isFrozen(cim));
});

await testAsync('19. Empty completeness contracts produce null intelligence (no fabrication)', async () => {
  const packages = [
    makePackage(Capability.ARTIST_IDENTITY, null, 'empty'),
    makePackage(Capability.ALBUMS,          null, 'empty'),
    makePackage(Capability.TERRITORIES,     null, 'empty'),
  ];
  const cim = await runRIE({ evidencePackages: packages });

  // When all contracts have completeness:'empty' and payload:null,
  // the bridge produces an empty canonical → assemblers return empty shells.
  // identity: assembleIdentityIntelligence always returns an object (never null),
  // but providers.apple should be NOT_FOUND (no availability set).
  // catalog: assembleCatalogIntelligence returns a frozen empty shell.
  // globalFootprint: assembleGlobalMusicFootprint returns Limited / Unable to Confirm.

  // The key assertion: no values should be fabricated from null payloads.
  // If catalog.albums > 0 despite empty ALBUMS contract, that's fabrication.
  if (cim.catalog) {
    assert.equal(cim.catalog.albums, 0, 'catalog.albums should be 0 with empty evidence');
    assert.equal(cim.catalog.singles, 0, 'catalog.singles should be 0 with empty evidence');
  }
  if (cim.globalFootprint) {
    assert.equal(cim.globalFootprint.territoriesAvailable, 0, 'no territories available with empty evidence');
  }

  // CIM must still be structurally valid and frozen
  const { valid } = validateCIM(cim);
  assert.ok(valid, 'CIM should be structurally valid even with empty evidence');
  assert.ok(Object.isFrozen(cim));
});

await testAsync('20. End-to-end: PAL (mock AppleMusicConnector) → RIE → certified CIM', async () => {
  // Full constitutional pipeline using the real PAL and a mock connector.
  const { ProviderAcquisitionLayer } = await import('../../../provider-acquisition/pal/ProviderAcquisitionLayer.js');
  const { AppleMusicConnector }       = await import('../../../provider-acquisition/connectors/apple-music/AppleMusicConnector.js');
  const { createEvidenceRequest }     = await import('../../../provider-acquisition/evidence/EvidenceRequest.js');
  const { loadTrustConfig, resetTrustConfig } = await import('../../../provider-acquisition/trust/trustConfig.js');

  resetTrustConfig();
  loadTrustConfig({ apple_music: 100 });

  const MOCK_TOKEN = 'test-jwt-for-e2e';

  // Mock fetch: return a valid Apple Music artist response for identity requests.
  const mockFetch = async (url) => {
    const body = JSON.stringify(MOCK_ARTIST_PAYLOAD);
    return {
      ok: true,
      status: 200,
      text: async () => body,
      json: async () => MOCK_ARTIST_PAYLOAD,
    };
  };

  const connectorConfig = {
    tokenGenerator: () => MOCK_TOKEN,
    fetchFn: mockFetch,
    timeoutMs: 5000,
    maxRetries: 0,
  };

  const pal = new ProviderAcquisitionLayer();
  await pal.activateConnector(new AppleMusicConnector(), connectorConfig);

  const evidenceRequest = createEvidenceRequest({
    evidenceType: Capability.ARTIST_IDENTITY,
    subjectRef:   { appleArtistId: '178834', artistName: 'Taylor Swift' },
    requestId:    randomUUID(),
  });

  const report = await pal.acquire('apple_music', evidenceRequest);
  assert.ok(report.acquired, 'PAL should report acquired: true');

  // Wrap in EvidencePackage and feed to RIE
  const evidencePackages = [{
    evidenceType: Capability.ARTIST_IDENTITY,
    contract:     report.contract,
  }];

  const cim = await runRIE({ evidencePackages });

  // CIM must be certified and structurally valid
  assert.equal(cim._certified, true);
  const { valid, missing } = validateCIM(cim);
  assert.ok(valid, `End-to-end CIM missing keys: ${missing.join(', ')}`);

  // scanAuthority must carry evidence lineage
  assert.ok(cim.scanAuthority.sourceProviders.includes('apple_music'));
  assert.ok(cim.scanAuthority.evidenceIds.includes(report.contract.evidenceId));
  assert.ok(Object.isFrozen(cim));

  await pal.shutdown();
  resetTrustConfig();
});

// ── Results ───────────────────────────────────────────────────────────────────

console.log(`\n── Results ─────────────────────────────────────────────────────────`);
console.log(`   ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`);

if (failed > 0) {
  console.error(`\n✗ Phase 2.4 certification FAILED — ${failed} criterion/criteria not met.\n`);
  process.exit(1);
}
console.log(`\n✓ Phase 2.4 certification COMPLETE — all ${passed} criteria passed.\n`);
