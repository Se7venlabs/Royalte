// Canonical Intelligence Platform(tm) -- Evidence Contracts Test Suite
// Sprint 2: Evidence Contracts(tm)

import {
  EVIDENCE_REGISTRY,
  getContract,
  listContracts,
  validateEvidence,
  validateEnvelope,
  createEnvelope,
} from '../api/evidence/index.js';

import { EVIDENCE_VERSION } from '../api/evidence/version.js';

import {
  EVIDENCE_STATUSES,
  EVIDENCE_CONFIDENCES,
  EVIDENCE_CATEGORIES,
  PROVIDER_CATEGORIES,
  EVIDENCE_DATA_TYPES,
  ENTITY_STATUSES,
  VALID_EVIDENCE_STATUSES,
  VALID_EVIDENCE_CONFIDENCES,
  VALID_EVIDENCE_CATEGORIES,
  VALID_EVIDENCE_DATA_TYPES,
} from '../api/evidence/types.js';

import {
  PROVIDERS,
  VALID_PROVIDER_IDS,
  PROVIDER_BY_ID,
} from '../api/evidence/providers.js';

import { BASE_CONTRACT_FIELDS, REQUIRED_BASE_FIELD_IDS } from '../api/evidence/contracts/base.js';

// -- Test harness -----------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

// A minimal valid evidence object for use across multiple tests.
function makeValidEvidence(overrides = {}) {
  return {
    contractId:      'ArtistIdentityEvidence',
    provider:        'apple-music',
    providerVersion: '1.0',
    connectorVersion: '1.0.0',
    retrievedAt:     '2026-07-11T00:00:00.000Z',
    scanId:          'scan_test_001',
    artistId:        'artist_test_001',
    confidence:      'HIGH',
    rawReference:    null,
    sourceUrl:       null,
    evidenceStatus:  'FOUND',
    contractVersion: '1.0.0',
    evidence: {
      artistName: 'Black Alternative',
      artistId:   '505490272',
    },
    ...overrides,
  };
}

// A minimal valid envelope params object.
function makeValidEnvelopeParams(overrides = {}) {
  const ev = makeValidEvidence();
  const validation = validateEvidence(ev);
  return {
    provider:        { id: 'apple-music', version: '1.0', displayName: 'Apple Music' },
    connector:       { id: 'apple-music-connector', version: '1.0.0', executionId: 'exec_001' },
    contractId:      'ArtistIdentityEvidence',
    contractVersion: '1.0.0',
    rawPayload:      { raw: true },
    parsedEvidence:  ev,
    validation,
    trace:           { scanId: 'scan_test_001', artistId: 'artist_test_001' },
    timestamps:      { requestedAt: '2026-07-11T00:00:00.000Z', envelopedAt: '2026-07-11T00:00:01.000Z' },
    ...overrides,
  };
}

// ==========================================================================
// 1. Type Definitions
// ==========================================================================
section('1. Type Definitions');

assert('EVIDENCE_STATUSES has 7 values',   Object.keys(EVIDENCE_STATUSES).length   === 7);
assert('EVIDENCE_CONFIDENCES has 5 values', Object.keys(EVIDENCE_CONFIDENCES).length === 5);
assert('EVIDENCE_CATEGORIES has 6 values', Object.keys(EVIDENCE_CATEGORIES).length  === 6);
assert('EVIDENCE_DATA_TYPES has 7 values', Object.keys(EVIDENCE_DATA_TYPES).length  === 7);

assert('EVIDENCE_STATUSES.UNKNOWN is "UNKNOWN"',               EVIDENCE_STATUSES.UNKNOWN         === 'UNKNOWN');
assert('EVIDENCE_STATUSES.FOUND is "FOUND"',                   EVIDENCE_STATUSES.FOUND           === 'FOUND');
assert('EVIDENCE_STATUSES.NOT_FOUND is "NOT_FOUND"',           EVIDENCE_STATUSES.NOT_FOUND       === 'NOT_FOUND');
assert('EVIDENCE_STATUSES.UNVERIFIED is "UNVERIFIED"',         EVIDENCE_STATUSES.UNVERIFIED      === 'UNVERIFIED');
assert('EVIDENCE_STATUSES.CONFLICT is "CONFLICT"',             EVIDENCE_STATUSES.CONFLICT        === 'CONFLICT');
assert('EVIDENCE_STATUSES.ERROR is "ERROR"',                   EVIDENCE_STATUSES.ERROR           === 'ERROR');
assert('EVIDENCE_STATUSES.MANUAL_OVERRIDE is "MANUAL_OVERRIDE"', EVIDENCE_STATUSES.MANUAL_OVERRIDE === 'MANUAL_OVERRIDE');

assert('EVIDENCE_CONFIDENCES.UNKNOWN is "UNKNOWN"',   EVIDENCE_CONFIDENCES.UNKNOWN   === 'UNKNOWN');
assert('EVIDENCE_CONFIDENCES.LOW is "LOW"',           EVIDENCE_CONFIDENCES.LOW       === 'LOW');
assert('EVIDENCE_CONFIDENCES.MEDIUM is "MEDIUM"',     EVIDENCE_CONFIDENCES.MEDIUM    === 'MEDIUM');
assert('EVIDENCE_CONFIDENCES.HIGH is "HIGH"',         EVIDENCE_CONFIDENCES.HIGH      === 'HIGH');
assert('EVIDENCE_CONFIDENCES.VERIFIED is "VERIFIED"', EVIDENCE_CONFIDENCES.VERIFIED  === 'VERIFIED');

assert('EVIDENCE_CATEGORIES.IDENTITY is "Identity"',         EVIDENCE_CATEGORIES.IDENTITY     === 'Identity');
assert('EVIDENCE_CATEGORIES.RIGHTS is "Rights"',             EVIDENCE_CATEGORIES.RIGHTS       === 'Rights');
assert('EVIDENCE_CATEGORIES.CATALOG is "Catalog"',           EVIDENCE_CATEGORIES.CATALOG      === 'Catalog');
assert('EVIDENCE_CATEGORIES.DISTRIBUTION is "Distribution"', EVIDENCE_CATEGORIES.DISTRIBUTION === 'Distribution');
assert('EVIDENCE_CATEGORIES.MONITORING is "Monitoring"',     EVIDENCE_CATEGORIES.MONITORING   === 'Monitoring');
assert('EVIDENCE_CATEGORIES.OPERATIONS is "Operations"',     EVIDENCE_CATEGORIES.OPERATIONS   === 'Operations');

assert('VALID_EVIDENCE_STATUSES set has correct size',    VALID_EVIDENCE_STATUSES.size   === 7);
assert('VALID_EVIDENCE_CONFIDENCES set has correct size', VALID_EVIDENCE_CONFIDENCES.size === 5);
assert('VALID_EVIDENCE_CATEGORIES set has correct size',  VALID_EVIDENCE_CATEGORIES.size  === 6);
assert('VALID_EVIDENCE_DATA_TYPES set has correct size',  VALID_EVIDENCE_DATA_TYPES.size  === 7);

// ==========================================================================
// 2. Provider Registry
// ==========================================================================
section('2. Provider Registry');

assert('PROVIDERS is a non-empty array',      Array.isArray(PROVIDERS) && PROVIDERS.length > 0);
assert('PROVIDERS has at least 16 entries',   PROVIDERS.length >= 16);
assert('All providers have required fields', PROVIDERS.every(
  (p) => p.id && p.displayName && p.category && p.version && p.status && Array.isArray(p.capabilities)
));
assert('All provider IDs are unique', (() => {
  const ids = PROVIDERS.map((p) => p.id);
  return new Set(ids).size === ids.length;
})());
assert('All provider capabilities are valid evidence categories', PROVIDERS.every(
  (p) => p.capabilities.every((c) => VALID_EVIDENCE_CATEGORIES.has(c))
));

const expectedProviderIds = [
  'apple-music', 'spotify', 'deezer', 'tidal', 'youtube',
  'musicbrainz', 'discogs', 'the-audio-db', 'lastfm',
  'mlc', 'socan', 'ascap', 'bmi', 'sound-exchange',
  'artist-verified-profile', 'manual-override',
];
for (const id of expectedProviderIds) {
  assert(`Provider "${id}" is registered`, VALID_PROVIDER_IDS.has(id));
}

assert('PROVIDER_BY_ID map size matches PROVIDERS array', PROVIDER_BY_ID.size === PROVIDERS.length);
assert('PROVIDER_BY_ID.get("spotify") returns correct provider', (() => {
  const p = PROVIDER_BY_ID.get('spotify');
  return p && p.displayName === 'Spotify' && p.capabilities.includes('Identity');
})());

assert('manual-override has all 6 capabilities', (() => {
  const p = PROVIDER_BY_ID.get('manual-override');
  return p && p.capabilities.length === 6;
})());

assert('apple-music has Identity, Catalog, Distribution', (() => {
  const p = PROVIDER_BY_ID.get('apple-music');
  return p &&
    p.capabilities.includes('Identity') &&
    p.capabilities.includes('Catalog') &&
    p.capabilities.includes('Distribution');
})());

assert('mlc has only Rights capability', (() => {
  const p = PROVIDER_BY_ID.get('mlc');
  return p && p.capabilities.length === 1 && p.capabilities[0] === 'Rights';
})());

// ==========================================================================
// 3. Base Evidence Contract
// ==========================================================================
section('3. Base Evidence Contract');

assert('BASE_CONTRACT_FIELDS is a non-empty array',       Array.isArray(BASE_CONTRACT_FIELDS) && BASE_CONTRACT_FIELDS.length > 0);
assert('BASE_CONTRACT_FIELDS has 12 fields',              BASE_CONTRACT_FIELDS.length === 12);
assert('REQUIRED_BASE_FIELD_IDS is a Set',                REQUIRED_BASE_FIELD_IDS instanceof Set);
assert('All required base fields are in REQUIRED_BASE_FIELD_IDS', BASE_CONTRACT_FIELDS
  .filter((f) => f.required)
  .every((f) => REQUIRED_BASE_FIELD_IDS.has(f.id))
);
assert('All base fields have id, displayName, dataType, required, description', BASE_CONTRACT_FIELDS.every(
  (f) => f.id && f.displayName && f.dataType && typeof f.required === 'boolean' && f.description
));

const expectedBaseFields = [
  'contractId', 'provider', 'providerVersion', 'connectorVersion',
  'retrievedAt', 'scanId', 'artistId', 'confidence',
  'rawReference', 'sourceUrl', 'evidenceStatus', 'contractVersion',
];
for (const id of expectedBaseFields) {
  assert(`Base field "${id}" is defined`, BASE_CONTRACT_FIELDS.some((f) => f.id === id));
}

// ==========================================================================
// 4. Evidence Contract Registry -- loader
// ==========================================================================
section('4. Evidence Contract Registry -- loader');

assert('EVIDENCE_REGISTRY exports without throwing',          EVIDENCE_REGISTRY !== null && typeof EVIDENCE_REGISTRY === 'object');
assert('EVIDENCE_REGISTRY.contracts is non-empty array',     Array.isArray(EVIDENCE_REGISTRY.contracts) && EVIDENCE_REGISTRY.contracts.length > 0);
assert('EVIDENCE_REGISTRY.providers is non-empty array',     Array.isArray(EVIDENCE_REGISTRY.providers) && EVIDENCE_REGISTRY.providers.length > 0);
assert('EVIDENCE_REGISTRY.categories is non-empty array',    Array.isArray(EVIDENCE_REGISTRY.categories) && EVIDENCE_REGISTRY.categories.length > 0);
assert('EVIDENCE_REGISTRY.version is present',               typeof EVIDENCE_REGISTRY.version === 'object');
assert('EVIDENCE_REGISTRY has exactly 6 contracts',          EVIDENCE_REGISTRY.contracts.length === 6);
assert('EVIDENCE_REGISTRY.version === EVIDENCE_VERSION',     EVIDENCE_REGISTRY.version === EVIDENCE_VERSION);

assert('EVIDENCE_VERSION has required fields', (() => {
  return EVIDENCE_VERSION.version && EVIDENCE_VERSION.sprint && EVIDENCE_VERSION.createdAt;
})());

// ==========================================================================
// 5. Contract accessor functions
// ==========================================================================
section('5. Contract accessor functions');

const contractIds = [
  'ArtistIdentityEvidence',
  'MusicRightsEvidence',
  'CatalogEvidence',
  'DistributionEvidence',
  'MonitoringEvidence',
  'SystemOperationsEvidence',
];

for (const id of contractIds) {
  assert(`getContract("${id}") returns a contract`, getContract(id) !== undefined);
}

assert('getContract("NonexistentContract") returns undefined', getContract('NonexistentContract') === undefined);

assert('listContracts() returns all 6 contracts', listContracts().length === 6);
assert('listContracts() output matches EVIDENCE_REGISTRY.contracts', listContracts() === EVIDENCE_REGISTRY.contracts);

// ==========================================================================
// 6. Individual Contract Definitions
// ==========================================================================
section('6. Individual Contract Definitions');

for (const id of contractIds) {
  const c = getContract(id);
  assert(`${id}: has contractId`,     c.contractId === id);
  assert(`${id}: has displayName`,    typeof c.displayName === 'string' && c.displayName.length > 0);
  assert(`${id}: has valid category`, VALID_EVIDENCE_CATEGORIES.has(c.category));
  assert(`${id}: has version`,        typeof c.version === 'string');
  assert(`${id}: has status`,         c.status === 'ACTIVE');
  assert(`${id}: has evidenceFields`, Array.isArray(c.evidenceFields) && c.evidenceFields.length > 0);
  assert(`${id}: all fields have id, dataType, required, description`,
    c.evidenceFields.every((f) => f.id && f.dataType && typeof f.required === 'boolean' && f.description)
  );
  assert(`${id}: all field dataTypes are valid`,
    c.evidenceFields.every((f) => VALID_EVIDENCE_DATA_TYPES.has(f.dataType))
  );
}

assert('ArtistIdentityEvidence category is Identity',    getContract('ArtistIdentityEvidence').category    === 'Identity');
assert('MusicRightsEvidence category is Rights',         getContract('MusicRightsEvidence').category       === 'Rights');
assert('CatalogEvidence category is Catalog',            getContract('CatalogEvidence').category           === 'Catalog');
assert('DistributionEvidence category is Distribution',  getContract('DistributionEvidence').category      === 'Distribution');
assert('MonitoringEvidence category is Monitoring',      getContract('MonitoringEvidence').category        === 'Monitoring');
assert('SystemOperationsEvidence category is Operations', getContract('SystemOperationsEvidence').category  === 'Operations');

assert('ArtistIdentityEvidence has artistName field',  (() => {
  const c = getContract('ArtistIdentityEvidence');
  return c.evidenceFields.some((f) => f.id === 'artistName' && f.required === true);
})());
assert('MonitoringEvidence has scanTimestamp field (required)', (() => {
  const c = getContract('MonitoringEvidence');
  return c.evidenceFields.some((f) => f.id === 'scanTimestamp' && f.required === true);
})());
assert('No duplicate field IDs within any contract', contractIds.every((id) => {
  const c = getContract(id);
  const ids = c.evidenceFields.map((f) => f.id);
  return new Set(ids).size === ids.length;
}));

// ==========================================================================
// 7. Evidence Validation -- valid evidence passes
// ==========================================================================
section('7. Evidence Validation -- valid evidence passes');

const validResult = validateEvidence(makeValidEvidence());
assert('Valid evidence returns { valid: true }',           validResult.valid === true);
assert('Valid evidence returns zero errors',               validResult.errors.length === 0, validResult.errors.join('; '));
assert('validateEvidence returns { valid, errors, warnings }',
  typeof validResult.valid === 'boolean' &&
  Array.isArray(validResult.errors) &&
  Array.isArray(validResult.warnings)
);

assert('Evidence with VERIFIED confidence passes', (() => {
  const r = validateEvidence(makeValidEvidence({ confidence: 'VERIFIED' }));
  return r.valid;
})());

assert('Evidence with NOT_FOUND status passes', (() => {
  const r = validateEvidence(makeValidEvidence({ evidenceStatus: 'NOT_FOUND', evidence: {} }));
  return r.valid;
})());

assert('Evidence with MANUAL_OVERRIDE status passes', (() => {
  const r = validateEvidence(makeValidEvidence({ evidenceStatus: 'MANUAL_OVERRIDE' }));
  return r.valid;
})());

// ==========================================================================
// 8. Evidence Validation -- catches broken inputs
// ==========================================================================
section('8. Evidence Validation -- catches broken inputs');

assert('Rule 1: missing required base field is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ contractId: undefined }));
  return errors.some((e) => e.includes('missing required base field'));
})());

assert('Rule 2: unknown contractId is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ contractId: 'NoSuchContract' }));
  return errors.some((e) => e.includes('unknown contractId'));
})());

assert('Rule 3: unknown provider is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ provider: 'made-up-provider' }));
  return errors.some((e) => e.includes('unknown provider'));
})());

assert('Rule 4: unknown evidenceStatus is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ evidenceStatus: 'INVALID_STATUS' }));
  return errors.some((e) => e.includes('unknown evidenceStatus'));
})());

assert('Rule 5: unknown confidence is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ confidence: 'SUPER_HIGH' }));
  return errors.some((e) => e.includes('unknown confidence'));
})());

assert('Rule 6: empty retrievedAt is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ retrievedAt: '' }));
  return errors.some((e) => e.includes('retrievedAt'));
})());

assert('Rule 7: empty scanId is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ scanId: '' }));
  return errors.some((e) => e.includes('scanId'));
})());

assert('Rule 8: empty artistId is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ artistId: '  ' }));
  return errors.some((e) => e.includes('artistId'));
})());

assert('Rule 10: missing evidence payload is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ evidence: null }));
  return errors.some((e) => e.includes('evidence'));
})());

assert('Rule 10: array evidence payload is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ evidence: [] }));
  return errors.some((e) => e.includes('"evidence" must be'));
})());

assert('Rule 11: missing required evidence field is caught (artistName)', (() => {
  const { errors } = validateEvidence(makeValidEvidence({ evidence: { artistId: '123' } }));
  return errors.some((e) => e.includes('missing required evidence field') && e.includes('artistName'));
})());

assert('Rule 12: wrong evidence field data type is caught', (() => {
  const { errors } = validateEvidence(makeValidEvidence({
    evidence: { artistName: 12345, artistId: '505490272' },
  }));
  return errors.some((e) => e.includes('artistName') && e.includes('expected string'));
})());

assert('Rule 13: provider/category capability mismatch produces a warning', (() => {
  // mlc is Rights-only; using it with ArtistIdentityEvidence (Identity) should warn
  const { warnings } = validateEvidence(makeValidEvidence({ provider: 'mlc' }));
  return warnings.some((w) => w.includes('does not list'));
})());

assert('Non-object evidence returns invalid immediately', (() => {
  const { valid } = validateEvidence('not-an-object');
  return !valid;
})());

// ==========================================================================
// 9. Evidence Envelope -- creation
// ==========================================================================
section('9. Evidence Envelope -- creation');

const envelope = createEnvelope(makeValidEnvelopeParams());

assert('createEnvelope returns a non-null object', envelope !== null && typeof envelope === 'object');
assert('Envelope has envelopeId',       typeof envelope.envelopeId === 'string' && envelope.envelopeId.length > 0);
assert('Envelope envelopeId is unique per call', envelope.envelopeId !== createEnvelope(makeValidEnvelopeParams()).envelopeId);
assert('Envelope has metadata',         typeof envelope.metadata === 'object');
assert('Envelope metadata.envelopeVersion is "1.0.0"', envelope.metadata.envelopeVersion === '1.0.0');
assert('Envelope metadata.createdAt is a string',       typeof envelope.metadata.createdAt === 'string');
assert('Envelope has provider',         typeof envelope.provider === 'object');
assert('Envelope provider.id is "apple-music"',         envelope.provider.id === 'apple-music');
assert('Envelope has connector',        typeof envelope.connector === 'object');
assert('Envelope connector.id is present',              typeof envelope.connector.id === 'string');
assert('Envelope has contractId',       envelope.contractId === 'ArtistIdentityEvidence');
assert('Envelope has contractVersion',  envelope.contractVersion === '1.0.0');
assert('Envelope has rawPayload',       envelope.rawPayload !== undefined);
assert('Envelope has parsedEvidence',   typeof envelope.parsedEvidence === 'object');
assert('Envelope has validation',       typeof envelope.validation === 'object');
assert('Envelope validation.valid is boolean', typeof envelope.validation.valid === 'boolean');
assert('Envelope has trace',            typeof envelope.trace === 'object');
assert('Envelope trace.scanId is correct',       envelope.trace.scanId   === 'scan_test_001');
assert('Envelope trace.artistId is correct',     envelope.trace.artistId === 'artist_test_001');
assert('Envelope has timestamps',       typeof envelope.timestamps === 'object');
assert('Envelope timestamps.envelopedAt is a string', typeof envelope.timestamps.envelopedAt === 'string');

assert('Envelope is deeply frozen', (() => {
  try {
    envelope.envelopeId = 'tampered';
    return envelope.envelopeId !== 'tampered';  // strict mode would throw; otherwise check unchanged
  } catch (_) {
    return true;  // threw -- correctly frozen
  }
})());

// ==========================================================================
// 10. Evidence Envelope -- validation
// ==========================================================================
section('10. Evidence Envelope -- validation');

const validEnvelopeResult = validateEnvelope(envelope);
assert('Valid envelope passes validation',          validEnvelopeResult.valid === true);
assert('Valid envelope produces zero errors',       validEnvelopeResult.errors.length === 0, validEnvelopeResult.errors.join('; '));

assert('Missing envelopeId is caught', (() => {
  const bad = { ...envelope, envelopeId: null };
  const { errors } = validateEnvelope(bad);
  return errors.some((e) => e.includes('envelopeId'));
})());

assert('Unknown provider.id in envelope is caught', (() => {
  const bad = createEnvelope(makeValidEnvelopeParams({
    provider: { id: 'made-up-provider', version: '1.0' },
  }));
  const { errors } = validateEnvelope(bad);
  return errors.some((e) => e.includes('unknown provider.id'));
})());

assert('Missing trace.scanId is caught', (() => {
  const bad = createEnvelope(makeValidEnvelopeParams({
    trace: { scanId: null, artistId: 'artist_001' },
  }));
  const { errors } = validateEnvelope(bad);
  return errors.some((e) => e.includes('trace.scanId'));
})());

assert('Failed validation in envelope produces a warning', (() => {
  const invalidValidation = { valid: false, errors: ['something failed'], warnings: [] };
  const env = createEnvelope(makeValidEnvelopeParams({ validation: invalidValidation }));
  const { warnings } = validateEnvelope(env);
  return warnings.some((w) => w.includes('failed validation'));
})());

assert('Non-object envelope returns invalid immediately', (() => {
  const { valid } = validateEnvelope('not-an-envelope');
  return !valid;
})());

// ==========================================================================
// 11. Provider / category separation
// ==========================================================================
section('11. Provider / Category Separation');

assert('Each contract category appears in at least one provider capability', (() => {
  const contractCategories = new Set(EVIDENCE_REGISTRY.contracts.map((c) => c.category));
  return [...contractCategories].every((cat) =>
    PROVIDERS.some((p) => p.capabilities.includes(cat))
  );
})());

assert('No two contracts share the same contractId', (() => {
  const ids = EVIDENCE_REGISTRY.contracts.map((c) => c.contractId);
  return new Set(ids).size === ids.length;
})());

assert('No two contracts share the same category', (() => {
  const cats = EVIDENCE_REGISTRY.contracts.map((c) => c.category);
  return new Set(cats).size === cats.length;
})());

// ==========================================================================
// 12. End-to-end: connector -> envelope -> validate
// ==========================================================================
section('12. End-to-end: connector -> envelope -> validate');

// Simulate a connector producing and wrapping identity evidence.
const rawProviderData = {
  id: '505490272',
  attributes: { name: 'Black Alternative', genreNames: ['Hip-Hop/Rap'] },
  type: 'artists',
};

const parsedEvidence = {
  contractId:      'ArtistIdentityEvidence',
  provider:        'apple-music',
  providerVersion: '1.0',
  connectorVersion: '1.0.0',
  retrievedAt:     '2026-07-11T12:00:00.000Z',
  scanId:          'scan_e2e_001',
  artistId:        'artist_ba_001',
  confidence:      'VERIFIED',
  rawReference:    null,
  sourceUrl:       null,
  evidenceStatus:  'FOUND',
  contractVersion: '1.0.0',
  evidence: {
    artistName: 'Black Alternative',
    artistId:   '505490272',
    genres:     ['Hip-Hop/Rap'],
    isVerified: true,
  },
};

const evValidation = validateEvidence(parsedEvidence);
assert('E2E: evidence validates successfully', evValidation.valid === true, evValidation.errors.join('; '));

const e2eEnvelope = createEnvelope({
  provider:        { id: 'apple-music', version: '1.0', displayName: 'Apple Music' },
  connector:       { id: 'apple-music-connector', version: '1.0.0' },
  contractId:      'ArtistIdentityEvidence',
  contractVersion: '1.0.0',
  rawPayload:      rawProviderData,
  parsedEvidence,
  validation:      evValidation,
  trace:           { scanId: 'scan_e2e_001', artistId: 'artist_ba_001' },
  timestamps: {
    requestedAt: '2026-07-11T12:00:00.000Z',
    receivedAt:  '2026-07-11T12:00:00.150Z',
    parsedAt:    '2026-07-11T12:00:00.160Z',
    envelopedAt: '2026-07-11T12:00:00.165Z',
  },
});

const envValidation = validateEnvelope(e2eEnvelope);
assert('E2E: envelope validates successfully',          envValidation.valid === true, envValidation.errors.join('; '));
assert('E2E: rawPayload is preserved',                  e2eEnvelope.rawPayload === rawProviderData);
assert('E2E: parsedEvidence is not rawPayload',         e2eEnvelope.parsedEvidence !== rawProviderData);
assert('E2E: envelope validation.valid matches',        e2eEnvelope.validation.valid === true);
assert('E2E: trace.scanId is correct',                  e2eEnvelope.trace.scanId === 'scan_e2e_001');
assert('E2E: timestamps.receivedAt is preserved',       e2eEnvelope.timestamps.receivedAt === '2026-07-11T12:00:00.150Z');
assert('E2E: all 6 contracts accessible from registry', listContracts().length === 6);

// ==========================================================================
// Results
// ==========================================================================

console.log(`\n${'='.repeat(60)}`);
if (failed === 0) {
  console.log(`  EVIDENCE CONTRACTS VERIFIED: ${passed} assertions passed`);
} else {
  console.log(`  FAILED: ${failed} assertion(s) failed, ${passed} passed`);
}
console.log('='.repeat(60));

if (failed > 0) process.exit(1);
