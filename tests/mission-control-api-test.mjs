// Canonical Intelligence Platform(tm) -- Mission Control Data API Test Suite
// Sprint 9: Mission Control Data API(tm)
// Constitutional boundary: no direct imports from platform engines

import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. MODULE LOADER
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§1 Module Loader');

const {
  MISSION_CONTROL_API_VERSION,
  API_ENDPOINTS, API_VERSIONS, CURRENT_API_VERSION,
  ENDPOINT_STATUSES, RESPONSE_STATUSES, API_ERROR_CODES,
  CONSUMER_TYPES, SERIALIZATION_FORMATS,
  REQUIRED_ENDPOINT_FIELDS, REQUIRED_RESPONSE_FIELDS,
  VALID_API_ENDPOINTS, VALID_API_VERSIONS, VALID_ENDPOINT_STATUSES,
  VALID_RESPONSE_STATUSES, VALID_CONSUMER_TYPES, VALID_FORMATS,
  ENDPOINT_SCHEMAS, assertSchemaCoverage,
  createEndpointRegistry, buildDefaultRegistry, DEFAULT_ENDPOINT_DEFS,
  createApiResponse, createSuccessResponse, createErrorResponse, createNotFoundResponse,
  serializeToJson, deserializeFromJson, serializeResponse, verifySerializationIntegrity,
  validateEndpointRegistration, validateResponse, validateResponseSchema,
  validateVersionCompatibility, validateSerializationIntegrity,
  assertResponseValid, assertEndpointValid,
  getIdentity, getMusicRights, getCatalog, getDistribution,
  getMonitoring, getSystemOperations, getExecutiveOverview, dispatch,
  createMissionControlApi, MISSION_CONTROL_API,
} = await import('../api/mission-control-api/index.js');

test('all named exports are defined', () => {
  assert.ok(MISSION_CONTROL_API_VERSION);
  assert.ok(API_ENDPOINTS);
  assert.ok(MISSION_CONTROL_API);
  assert.ok(createMissionControlApi);
  assert.ok(dispatch);
});

test('index exports a factory and a singleton', () => {
  assert.equal(typeof createMissionControlApi, 'function');
  assert.equal(typeof MISSION_CONTROL_API, 'object');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERSION
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§2 Version');

test('version is frozen', () => {
  assert.ok(Object.isFrozen(MISSION_CONTROL_API_VERSION));
});

test('version.version is semver string', () => {
  assert.match(MISSION_CONTROL_API_VERSION.version, /^\d+\.\d+\.\d+$/);
});

test('version.apiVersion is v1', () => {
  assert.equal(MISSION_CONTROL_API_VERSION.apiVersion, 'v1');
});

test('version.engineId is mission-control-api-v1', () => {
  assert.equal(MISSION_CONTROL_API_VERSION.engineId, 'mission-control-api-v1');
});

test('version.sprint names Sprint 9', () => {
  assert.ok(MISSION_CONTROL_API_VERSION.sprint.includes('Sprint 9'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TYPE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§3 Type Constants');

test('API_ENDPOINTS has 7 entries', () => {
  assert.equal(Object.keys(API_ENDPOINTS).length, 7);
});

test('API_ENDPOINTS contains all 7 identifiers', () => {
  assert.equal(API_ENDPOINTS.IDENTITY,           'identity');
  assert.equal(API_ENDPOINTS.MUSIC_RIGHTS,       'music_rights');
  assert.equal(API_ENDPOINTS.CATALOG,            'catalog');
  assert.equal(API_ENDPOINTS.DISTRIBUTION,       'distribution');
  assert.equal(API_ENDPOINTS.MONITORING,         'monitoring');
  assert.equal(API_ENDPOINTS.SYSTEM_OPERATIONS,  'system_operations');
  assert.equal(API_ENDPOINTS.EXECUTIVE_OVERVIEW, 'executive_overview');
});

test('API_ENDPOINTS is frozen', () => {
  assert.ok(Object.isFrozen(API_ENDPOINTS));
});

test('CURRENT_API_VERSION is v1', () => {
  assert.equal(CURRENT_API_VERSION, 'v1');
});

test('ENDPOINT_STATUSES has ACTIVE DEPRECATED RESERVED', () => {
  assert.equal(ENDPOINT_STATUSES.ACTIVE,     'ACTIVE');
  assert.equal(ENDPOINT_STATUSES.DEPRECATED, 'DEPRECATED');
  assert.equal(ENDPOINT_STATUSES.RESERVED,   'RESERVED');
});

test('RESPONSE_STATUSES has SUCCESS NOT_FOUND ERROR UNAVAILABLE', () => {
  assert.equal(RESPONSE_STATUSES.SUCCESS,     'SUCCESS');
  assert.equal(RESPONSE_STATUSES.NOT_FOUND,   'NOT_FOUND');
  assert.equal(RESPONSE_STATUSES.ERROR,       'ERROR');
  assert.equal(RESPONSE_STATUSES.UNAVAILABLE, 'UNAVAILABLE');
});

test('API_ERROR_CODES has 8 codes', () => {
  assert.equal(Object.keys(API_ERROR_CODES).length, 8);
});

test('CONSUMER_TYPES has 7 entries', () => {
  assert.equal(Object.keys(CONSUMER_TYPES).length, 7);
});

test('SERIALIZATION_FORMATS.JSON is json', () => {
  assert.equal(SERIALIZATION_FORMATS.JSON, 'json');
});

test('REQUIRED_ENDPOINT_FIELDS has 5 fields', () => {
  assert.equal(REQUIRED_ENDPOINT_FIELDS.length, 5);
  assert.ok(REQUIRED_ENDPOINT_FIELDS.includes('endpointId'));
  assert.ok(REQUIRED_ENDPOINT_FIELDS.includes('version'));
  assert.ok(REQUIRED_ENDPOINT_FIELDS.includes('consumer'));
  assert.ok(REQUIRED_ENDPOINT_FIELDS.includes('responseSchema'));
  assert.ok(REQUIRED_ENDPOINT_FIELDS.includes('status'));
});

test('REQUIRED_RESPONSE_FIELDS has 6 fields', () => {
  assert.equal(REQUIRED_RESPONSE_FIELDS.length, 6);
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('apiVersion'));
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('generatedAt'));
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('endpoint'));
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('status'));
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('data'));
  assert.ok(REQUIRED_RESPONSE_FIELDS.includes('metadata'));
});

test('VALID_API_ENDPOINTS is a Set with 7 values', () => {
  assert.ok(VALID_API_ENDPOINTS instanceof Set);
  assert.equal(VALID_API_ENDPOINTS.size, 7);
});

test('VALID_FORMATS contains json', () => {
  assert.ok(VALID_FORMATS.has('json'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SCHEMA COVERAGE
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§4 Schema Coverage');

test('assertSchemaCoverage does not throw', () => {
  assert.doesNotThrow(() => assertSchemaCoverage());
});

test('ENDPOINT_SCHEMAS has a schema for all 7 endpoints', () => {
  for (const ep of Object.values(API_ENDPOINTS)) {
    assert.ok(ENDPOINT_SCHEMAS[ep], `missing schema for ${ep}`);
  }
});

test('each schema has required and optional arrays', () => {
  for (const [ep, schema] of Object.entries(ENDPOINT_SCHEMAS)) {
    assert.ok(Array.isArray(schema.required), `${ep} missing required[]`);
    assert.ok(Array.isArray(schema.optional), `${ep} missing optional[]`);
  }
});

test('identity schema requires artistId', () => {
  assert.ok(ENDPOINT_SCHEMAS.identity.required.includes('artistId'));
});

test('executive_overview schema requires artistId', () => {
  assert.ok(ENDPOINT_SCHEMAS.executive_overview.required.includes('artistId'));
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ENDPOINT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§5 Endpoint Registry');

const makeMinimalEndpoint = (overrides = {}) => ({
  endpointId:     'test_ep',
  version:        'v1',
  consumer:       'mission_control',
  responseSchema: { required: [], optional: [] },
  status:         'ACTIVE',
  ...overrides,
});

test('createEndpointRegistry returns a frozen registry object', () => {
  const r = createEndpointRegistry();
  assert.ok(Object.isFrozen(r));
  assert.equal(typeof r.registerEndpoint, 'function');
  assert.equal(typeof r.getEndpoint,      'function');
  assert.equal(typeof r.listEndpoints,    'function');
  assert.equal(typeof r.isRegistered,     'function');
  assert.equal(typeof r.size,             'function');
});

test('registerEndpoint adds endpoint and returns it', () => {
  const r = createEndpointRegistry();
  const def = makeMinimalEndpoint();
  const ep  = r.registerEndpoint(def);
  assert.equal(ep.endpointId, 'test_ep');
  assert.equal(r.size(), 1);
});

test('registered endpoint is frozen', () => {
  const r  = createEndpointRegistry();
  const ep = r.registerEndpoint(makeMinimalEndpoint());
  assert.ok(Object.isFrozen(ep));
});

test('isRegistered returns true after registration', () => {
  const r = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint());
  assert.equal(r.isRegistered('test_ep'), true);
});

test('isRegistered returns false for unknown endpointId', () => {
  const r = createEndpointRegistry();
  assert.equal(r.isRegistered('no_such'), false);
});

test('getEndpoint returns registered endpoint', () => {
  const r  = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint());
  const ep = r.getEndpoint('test_ep');
  assert.ok(ep);
  assert.equal(ep.endpointId, 'test_ep');
});

test('getEndpoint returns null for unregistered id', () => {
  const r = createEndpointRegistry();
  assert.equal(r.getEndpoint('not_here'), null);
});

test('listEndpoints returns frozen array', () => {
  const r = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'a' }));
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'b' }));
  const list = r.listEndpoints();
  assert.ok(Array.isArray(list));
  assert.ok(Object.isFrozen(list));
  assert.equal(list.length, 2);
});

test('listByConsumer filters by consumer', () => {
  const r = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'ep1', consumer: 'mission_control' }));
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'ep2', consumer: 'executive_intelligence' }));
  assert.equal(r.listByConsumer('mission_control').length,        1);
  assert.equal(r.listByConsumer('executive_intelligence').length, 1);
  assert.equal(r.listByConsumer('athena').length,                 0);
});

test('listByStatus filters by status', () => {
  const r = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'ep1', status: 'ACTIVE' }));
  r.registerEndpoint(makeMinimalEndpoint({ endpointId: 'ep2', status: 'DEPRECATED' }));
  assert.equal(r.listByStatus('ACTIVE').length,     1);
  assert.equal(r.listByStatus('DEPRECATED').length, 1);
  assert.equal(r.listByStatus('RESERVED').length,   0);
});

test('duplicate registration throws DUPLICATE_ENDPOINT', () => {
  const r = createEndpointRegistry();
  r.registerEndpoint(makeMinimalEndpoint());
  assert.throws(() => r.registerEndpoint(makeMinimalEndpoint()), (err) => {
    assert.equal(err.code, 'DUPLICATE_ENDPOINT');
    return true;
  });
});

test('registration with invalid version throws VERSION_MISMATCH', () => {
  const r = createEndpointRegistry();
  assert.throws(
    () => r.registerEndpoint(makeMinimalEndpoint({ version: 'v99' })),
    (err) => { assert.equal(err.code, 'VERSION_MISMATCH'); return true; }
  );
});

test('registration with invalid status throws VALIDATION_FAILED', () => {
  const r = createEndpointRegistry();
  assert.throws(
    () => r.registerEndpoint(makeMinimalEndpoint({ status: 'BOGUS' })),
    (err) => { assert.equal(err.code, 'VALIDATION_FAILED'); return true; }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. DEFAULT REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§6 Default Registry');

const defaultReg = buildDefaultRegistry();

test('buildDefaultRegistry registers exactly 7 endpoints', () => {
  assert.equal(defaultReg.size(), 7);
});

test('all 7 endpoints are registered', () => {
  for (const ep of Object.values(API_ENDPOINTS)) {
    assert.ok(defaultReg.isRegistered(ep), `${ep} not registered`);
  }
});

test('all registered endpoints are ACTIVE', () => {
  const list = defaultReg.listByStatus('ACTIVE');
  assert.equal(list.length, 7);
});

test('executive_overview has executive_intelligence consumer', () => {
  const ep = defaultReg.getEndpoint('executive_overview');
  assert.equal(ep.consumer, 'executive_intelligence');
});

test('DEFAULT_ENDPOINT_DEFS is frozen with 7 entries', () => {
  assert.ok(Object.isFrozen(DEFAULT_ENDPOINT_DEFS));
  assert.equal(DEFAULT_ENDPOINT_DEFS.length, 7);
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. API RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§7 API Responses');

const minimalResponse = () => createApiResponse({
  apiVersion:  'v1',
  generatedAt: '2026-07-12T00:00:00.000Z',
  endpoint:    'identity',
  status:      'SUCCESS',
  data:        { test: true },
  metadata:    { engineVersion: '1.0.0' },
});

test('createApiResponse returns frozen object with required fields', () => {
  const r = minimalResponse();
  assert.ok(Object.isFrozen(r));
  assert.equal(r.apiVersion,  'v1');
  assert.equal(r.endpoint,    'identity');
  assert.equal(r.status,      'SUCCESS');
  assert.ok(r.generatedAt);
  assert.ok(r.data);
  assert.ok(r.metadata);
});

test('createApiResponse throws on missing required field', () => {
  assert.throws(() => createApiResponse({
    // missing apiVersion
    generatedAt: new Date().toISOString(),
    endpoint:    'identity',
    status:      'SUCCESS',
    data:        {},
    metadata:    {},
  }), (err) => { assert.equal(err.code, 'SCHEMA_VIOLATION'); return true; });
});

test('createSuccessResponse sets status SUCCESS', () => {
  const r = createSuccessResponse('identity', { artistId: 'a1' }, { scanId: 's1', artistId: 'a1' });
  assert.equal(r.status,   'SUCCESS');
  assert.equal(r.endpoint, 'identity');
  assert.equal(r.scanId,   's1');
  assert.equal(r.artistId, 'a1');
});

test('createSuccessResponse data is included', () => {
  const r = createSuccessResponse('catalog', { releaseCount: 5 });
  assert.equal(r.data.releaseCount, 5);
});

test('createErrorResponse sets status ERROR', () => {
  const r = createErrorResponse('identity', 'SCHEMA_VIOLATION', 'bad data');
  assert.equal(r.status, 'ERROR');
  assert.equal(r.metadata.errorCode, 'SCHEMA_VIOLATION');
  assert.equal(r.metadata.message,   'bad data');
});

test('createNotFoundResponse sets status NOT_FOUND', () => {
  const r = createNotFoundResponse('unknown_ep');
  assert.equal(r.status,           'NOT_FOUND');
  assert.equal(r.metadata.errorCode, 'ENDPOINT_NOT_FOUND');
  assert.ok(r.metadata.message.includes('unknown_ep'));
});

test('scanId and artistId default to null when not provided', () => {
  const r = createSuccessResponse('catalog', {});
  assert.equal(r.scanId,   null);
  assert.equal(r.artistId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RESPONSE IMMUTABILITY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§8 Response Immutability');

test('success response is deeply frozen', () => {
  const r = createSuccessResponse('identity', { artistId: 'a1', nested: { x: 1 } });
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.data));
  assert.ok(Object.isFrozen(r.metadata));
});

test('cannot mutate a response data field', () => {
  const r = createSuccessResponse('identity', { artistId: 'a1' });
  assert.throws(() => { 'use strict'; r.data.artistId = 'mutated'; });
});

test('error response is deeply frozen', () => {
  const r = createErrorResponse('identity', 'INVALID_REQUEST', 'oops');
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.metadata));
});

test('not-found response is deeply frozen', () => {
  const r = createNotFoundResponse('nope');
  assert.ok(Object.isFrozen(r));
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§9 Serialization');

test('serializeToJson produces valid JSON', () => {
  const r    = createSuccessResponse('catalog', { releaseCount: 3 });
  const json = serializeToJson(r);
  assert.equal(typeof json, 'string');
  const parsed = JSON.parse(json);
  assert.equal(parsed.status, 'SUCCESS');
});

test('serializeToJson pretty mode produces indented JSON', () => {
  const r    = createSuccessResponse('catalog', {});
  const json = serializeToJson(r, { pretty: true });
  assert.ok(json.includes('\n'));
});

test('serializeToJson throws on null', () => {
  assert.throws(
    () => serializeToJson(null),
    (err) => { assert.equal(err.code, 'SERIALIZATION_FAILURE'); return true; }
  );
});

test('deserializeFromJson reconstructs object', () => {
  const r      = createSuccessResponse('monitoring', { changeCount: 0 });
  const json   = serializeToJson(r);
  const parsed = deserializeFromJson(json);
  assert.equal(parsed.status,           'SUCCESS');
  assert.equal(parsed.data.changeCount, 0);
});

test('deserializeFromJson throws on empty string', () => {
  assert.throws(
    () => deserializeFromJson(''),
    (err) => { assert.equal(err.code, 'SERIALIZATION_FAILURE'); return true; }
  );
});

test('deserializeFromJson throws on invalid JSON', () => {
  assert.throws(
    () => deserializeFromJson('{bad json}'),
    (err) => { assert.equal(err.code, 'SERIALIZATION_FAILURE'); return true; }
  );
});

test('serializeResponse with json format succeeds', () => {
  const r = createSuccessResponse('identity', { artistId: 'a1' });
  const s = serializeResponse(r, 'json');
  assert.equal(typeof s, 'string');
});

test('serializeResponse with unknown format throws UNKNOWN_FORMAT', () => {
  const r = createSuccessResponse('identity', {});
  assert.throws(
    () => serializeResponse(r, 'graphql'),
    (err) => { assert.equal(err.code, 'UNKNOWN_FORMAT'); return true; }
  );
});

test('verifySerializationIntegrity returns valid=true for well-formed response', () => {
  const r      = createSuccessResponse('identity', { artistId: 'a1' });
  const result = verifySerializationIntegrity(r);
  assert.equal(result.valid, true);
  assert.equal(result.missingKeys.length, 0);
  assert.ok(result.serialized);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SERIALIZATION DETERMINISM
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§10 Serialization Determinism');

test('identical responses serialize to identical strings', () => {
  const data = { z: 3, a: 1, m: 2 };
  const r1   = createSuccessResponse('catalog', data, { scanId: 'scan-1', artistId: 'a1' });
  const r2   = createSuccessResponse('catalog', data, { scanId: 'scan-1', artistId: 'a1' });
  // generatedAt will differ; strip it and compare data+endpoint+status
  const p1   = deserializeFromJson(serializeToJson(r1));
  const p2   = deserializeFromJson(serializeToJson(r2));
  assert.equal(p1.status,  p2.status);
  assert.equal(p1.endpoint, p2.endpoint);
  // sorted keys: a < m < z
  const keys = Object.keys(p1.data);
  assert.equal(keys[0], 'a');
  assert.equal(keys[1], 'm');
  assert.equal(keys[2], 'z');
});

test('serializeToJson sorts keys recursively', () => {
  const r    = createSuccessResponse('identity', { z: 9, a: 1 });
  const json = serializeToJson(r);
  const idx_a = json.indexOf('"a"');
  const idx_z = json.indexOf('"z"');
  assert.ok(idx_a < idx_z, 'keys should be sorted: a before z');
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§11 Validation');

test('validateEndpointRegistration returns valid for a complete endpoint', () => {
  const result = validateEndpointRegistration(makeMinimalEndpoint());
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test('validateEndpointRegistration returns invalid for missing fields', () => {
  const result = validateEndpointRegistration({ endpointId: 'ep' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateEndpointRegistration returns invalid for bad version', () => {
  const result = validateEndpointRegistration(makeMinimalEndpoint({ version: 'v999' }));
  assert.equal(result.valid, false);
});

test('validateResponse returns valid for a well-formed response', () => {
  const r      = createSuccessResponse('identity', { artistId: 'a1' });
  const result = validateResponse(r);
  assert.equal(result.valid, true);
});

test('validateResponse returns invalid for null', () => {
  const result = validateResponse(null);
  assert.equal(result.valid, false);
});

test('validateResponse returns invalid for missing status', () => {
  const result = validateResponse({ apiVersion: 'v1', generatedAt: 'x', endpoint: 'y', data: {}, metadata: {} });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('status')));
});

test('validateResponseSchema returns valid when required fields present in data', () => {
  const r      = createSuccessResponse('identity', { artistId: 'a1' });
  const schema = ENDPOINT_SCHEMAS.identity;
  const result = validateResponseSchema(r, schema);
  assert.equal(result.valid, true);
});

test('validateResponseSchema returns invalid when required field missing', () => {
  const r      = createSuccessResponse('identity', {});         // no artistId
  const schema = ENDPOINT_SCHEMAS.identity;
  const result = validateResponseSchema(r, schema);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('artistId')));
});

test('validateVersionCompatibility compatible when versions match', () => {
  const result = validateVersionCompatibility('v1', 'v1');
  assert.equal(result.compatible, true);
  assert.equal(result.reason,     null);
});

test('validateVersionCompatibility incompatible when versions differ', () => {
  const result = validateVersionCompatibility('v1', 'v2');
  assert.equal(result.compatible, false);
  assert.ok(result.reason.includes('mismatch'));
});

test('assertResponseValid throws on invalid response', () => {
  assert.throws(
    () => assertResponseValid(null),
    (err) => { assert.equal(err.code, 'SCHEMA_VIOLATION'); return true; }
  );
});

test('assertResponseValid does not throw on valid response', () => {
  const r = createSuccessResponse('catalog', {});
  assert.doesNotThrow(() => assertResponseValid(r));
});

test('assertEndpointValid throws on invalid endpoint', () => {
  assert.throws(
    () => assertEndpointValid({ endpointId: 'bad' }),
    (err) => { assert.equal(err.code, 'VALIDATION_FAILED'); return true; }
  );
});

test('validateSerializationIntegrity checks required response fields', () => {
  const r          = createSuccessResponse('catalog', {});
  const json       = serializeToJson(r);
  const parsed     = deserializeFromJson(json);
  const result     = validateSerializationIntegrity(r, parsed);
  assert.equal(result.valid, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. ROUTES
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§12 Routes');

const makeDomains = (overrides = {}) => Object.freeze({
  identity:         { artistId: 'a1', artistName: 'Test Artist', verified: true },
  publishing:       { publisher: 'Royaltē Publishing', iswc: 'T-123' },
  music_rights:     { pro: 'ASCAP' },
  catalog:          { releaseCount: 12, genre: 'Pop' },
  distribution:     { distributor: 'DistroKid', dspCoverage: 0.95 },
  system_operations: { scanStatus: 'complete' },
  ...overrides,
});

test('getIdentity returns SUCCESS response with identity data', () => {
  const r = getIdentity({ canonicalDomains: makeDomains(), scanId: 's1', artistId: 'a1' });
  assert.equal(r.status,             'SUCCESS');
  assert.equal(r.endpoint,           'identity');
  assert.equal(r.data.artistName,    'Test Artist');
  assert.equal(r.scanId,             's1');
  assert.equal(r.artistId,           'a1');
});

test('getIdentity returns empty data when canonicalDomains is null', () => {
  const r = getIdentity({});
  assert.equal(r.status, 'SUCCESS');
  assert.deepEqual(r.data, {});
});

test('getMusicRights merges publishing and music_rights domains', () => {
  const r = getMusicRights({ canonicalDomains: makeDomains() });
  assert.equal(r.status,          'SUCCESS');
  assert.equal(r.endpoint,        'music_rights');
  assert.equal(r.data.publisher,  'Royaltē Publishing');
  assert.equal(r.data.iswc,       'T-123');
  assert.equal(r.data.pro,        'ASCAP');
});

test('getCatalog returns catalog data', () => {
  const r = getCatalog({ canonicalDomains: makeDomains() });
  assert.equal(r.status,            'SUCCESS');
  assert.equal(r.endpoint,          'catalog');
  assert.equal(r.data.releaseCount, 12);
  assert.equal(r.data.genre,        'Pop');
});

test('getDistribution returns distribution data', () => {
  const r = getDistribution({ canonicalDomains: makeDomains() });
  assert.equal(r.status,            'SUCCESS');
  assert.equal(r.endpoint,          'distribution');
  assert.equal(r.data.distributor,  'DistroKid');
  assert.equal(r.data.dspCoverage,  0.95);
});

test('getMonitoring returns monitoring envelope', () => {
  const timeline = [{ eventId: 'e1', domain: 'identity', field: 'artistName' }];
  const alerts   = [{ alertId: 'al1', level: 'LOW', domain: 'identity' }];
  const r = getMonitoring({
    timeline,
    alerts,
    latestChanges: { modified: 1 },
    snapshotId: 'snap-1',
    scanId: 's1',
    artistId: 'a1',
  });
  assert.equal(r.status,              'SUCCESS');
  assert.equal(r.endpoint,            'monitoring');
  assert.equal(r.data.changeCount,    1);
  assert.equal(r.data.snapshotId,     'snap-1');
  assert.ok(Array.isArray(r.data.timeline));
  assert.ok(Array.isArray(r.data.alerts));
});

test('getMonitoring changeCount reflects timeline length', () => {
  const r = getMonitoring({ timeline: [{}, {}, {}] });
  assert.equal(r.data.changeCount, 3);
});

test('getMonitoring defaults to empty arrays when params omitted', () => {
  const r = getMonitoring({});
  assert.equal(r.data.changeCount, 0);
  assert.deepEqual(r.data.timeline, []);
  assert.deepEqual(r.data.alerts,   []);
});

test('getSystemOperations returns system_operations data', () => {
  const r = getSystemOperations({ canonicalDomains: makeDomains() });
  assert.equal(r.status,              'SUCCESS');
  assert.equal(r.endpoint,            'system_operations');
  assert.equal(r.data.scanStatus,     'complete');
});

test('getExecutiveOverview aggregates all domains', () => {
  const r = getExecutiveOverview({
    canonicalDomains: makeDomains(),
    timeline:   [{ eventId: 'e1' }],
    alerts:     [],
    scanId:     's1',
    artistId:   'a1',
  });
  assert.equal(r.status,                     'SUCCESS');
  assert.equal(r.endpoint,                   'executive_overview');
  assert.equal(r.data.artistId,              'a1');
  assert.equal(r.data.identity.artistName,   'Test Artist');
  assert.equal(r.data.musicRights.publisher, 'Royaltē Publishing');
  assert.equal(r.data.catalog.releaseCount,  12);
  assert.equal(r.data.distribution.distributor, 'DistroKid');
  assert.equal(r.data.monitoring.changeCount, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§13 Dispatch');

const params = { canonicalDomains: makeDomains(), scanId: 's1', artistId: 'a1' };

test('dispatch routes identity', () => {
  const r = dispatch('identity', params);
  assert.equal(r.status,   'SUCCESS');
  assert.equal(r.endpoint, 'identity');
});

test('dispatch routes music_rights', () => {
  const r = dispatch('music_rights', params);
  assert.equal(r.endpoint, 'music_rights');
});

test('dispatch routes catalog', () => {
  const r = dispatch('catalog', params);
  assert.equal(r.endpoint, 'catalog');
});

test('dispatch routes distribution', () => {
  const r = dispatch('distribution', params);
  assert.equal(r.endpoint, 'distribution');
});

test('dispatch routes monitoring', () => {
  const r = dispatch('monitoring', { timeline: [], alerts: [], scanId: 's1' });
  assert.equal(r.endpoint, 'monitoring');
});

test('dispatch routes system_operations', () => {
  const r = dispatch('system_operations', params);
  assert.equal(r.endpoint, 'system_operations');
});

test('dispatch routes executive_overview', () => {
  const r = dispatch('executive_overview', params);
  assert.equal(r.endpoint, 'executive_overview');
});

test('dispatch returns NOT_FOUND for unknown endpointId', () => {
  const r = dispatch('does_not_exist', {});
  assert.equal(r.status, 'NOT_FOUND');
  assert.equal(r.metadata.errorCode, 'ENDPOINT_NOT_FOUND');
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. API FACTORY
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§14 API Factory');

const api = createMissionControlApi();

test('createMissionControlApi returns a frozen object', () => {
  assert.ok(Object.isFrozen(api));
});

test('factory exposes all 7 endpoint methods', () => {
  assert.equal(typeof api.getIdentity,          'function');
  assert.equal(typeof api.getMusicRights,       'function');
  assert.equal(typeof api.getCatalog,           'function');
  assert.equal(typeof api.getDistribution,      'function');
  assert.equal(typeof api.getMonitoring,        'function');
  assert.equal(typeof api.getSystemOperations,  'function');
  assert.equal(typeof api.getExecutiveOverview, 'function');
});

test('factory exposes call and dispatch', () => {
  assert.equal(typeof api.call,     'function');
  assert.equal(typeof api.dispatch, 'function');
});

test('factory exposes registry inspection methods', () => {
  assert.equal(typeof api.getEndpoint,    'function');
  assert.equal(typeof api.listEndpoints,  'function');
  assert.equal(typeof api.isRegistered,   'function');
  assert.equal(typeof api.endpointCount,  'function');
});

test('factory exposes serialization methods', () => {
  assert.equal(typeof api.serialize,       'function');
  assert.equal(typeof api.serializeToJson, 'function');
});

test('factory exposes apiVersion', () => {
  assert.ok(api.apiVersion);
  assert.equal(api.apiVersion.version, MISSION_CONTROL_API_VERSION.version);
});

test('MISSION_CONTROL_API singleton is frozen', () => {
  assert.ok(Object.isFrozen(MISSION_CONTROL_API));
});

test('factory accepts injected registry', () => {
  const customReg = createEndpointRegistry();
  customReg.registerEndpoint(makeMinimalEndpoint({ endpointId: 'custom_ep' }));
  const customApi = createMissionControlApi({ endpointRegistry: customReg });
  assert.equal(customApi.endpointCount(), 1);
  assert.equal(customApi.isRegistered('custom_ep'), true);
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. API CALL()
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§15 API call()');

test('call() routes registered identity endpoint', () => {
  const r = MISSION_CONTROL_API.call('identity', { canonicalDomains: makeDomains() });
  assert.equal(r.status,   'SUCCESS');
  assert.equal(r.endpoint, 'identity');
});

test('call() routes registered executive_overview endpoint', () => {
  const r = MISSION_CONTROL_API.call('executive_overview', { canonicalDomains: makeDomains() });
  assert.equal(r.status,   'SUCCESS');
  assert.equal(r.endpoint, 'executive_overview');
});

test('call() returns NOT_FOUND for unregistered endpoint', () => {
  const r = MISSION_CONTROL_API.call('not_a_real_endpoint', {});
  assert.equal(r.status,              'NOT_FOUND');
  assert.equal(r.metadata.errorCode,  'ENDPOINT_NOT_FOUND');
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. API REGISTRY INSPECTION
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§16 API Registry Inspection');

test('api.endpointCount() is 7 on default registry', () => {
  assert.equal(MISSION_CONTROL_API.endpointCount(), 7);
});

test('api.isRegistered() is true for all 7 endpoints', () => {
  for (const ep of Object.values(API_ENDPOINTS)) {
    assert.ok(MISSION_CONTROL_API.isRegistered(ep), `${ep} should be registered`);
  }
});

test('api.isRegistered() is false for unknown endpoint', () => {
  assert.equal(MISSION_CONTROL_API.isRegistered('ghost'), false);
});

test('api.listEndpoints() returns array of 7', () => {
  const list = MISSION_CONTROL_API.listEndpoints();
  assert.ok(Array.isArray(list));
  assert.equal(list.length, 7);
});

test('api.getEndpoint() returns endpoint definition', () => {
  const ep = MISSION_CONTROL_API.getEndpoint('catalog');
  assert.ok(ep);
  assert.equal(ep.endpointId, 'catalog');
  assert.equal(ep.version,    'v1');
  assert.equal(ep.status,     'ACTIVE');
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. API SERIALIZATION (via factory)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§17 API Serialization via Factory');

test('api.serializeToJson serializes a response', () => {
  const r    = MISSION_CONTROL_API.getCatalog({ canonicalDomains: makeDomains() });
  const json = MISSION_CONTROL_API.serializeToJson(r);
  assert.equal(typeof json, 'string');
  const parsed = JSON.parse(json);
  assert.equal(parsed.endpoint, 'catalog');
});

test('api.serialize with json format works', () => {
  const r    = MISSION_CONTROL_API.getIdentity({ canonicalDomains: makeDomains() });
  const json = MISSION_CONTROL_API.serialize(r, 'json');
  assert.equal(typeof json, 'string');
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. CONSTITUTIONAL BOUNDARIES
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§18 Constitutional Boundaries');

test('index.js does not import from api/monitoring directly', () => {
  const src = readFileSync(resolve(root, 'api/mission-control-api/index.js'), 'utf8');
  assert.ok(!src.includes("from '../monitoring/"), 'must not import monitoring internals');
  assert.ok(!src.includes("from '../resolution/"), 'must not import resolution internals');
  assert.ok(!src.includes("from '../normalization/"), 'must not import normalization internals');
});

test('routes.js does not import from platform engine modules', () => {
  const src = readFileSync(resolve(root, 'api/mission-control-api/routes.js'), 'utf8');
  assert.ok(!src.includes("from '../monitoring/"), 'routes must not import monitoring');
  assert.ok(!src.includes("from '../registry/"),   'routes must not import registry');
  assert.ok(!src.includes("from '../resolution/"), 'routes must not import resolution');
});

test('getMonitoring does not invoke the Monitoring Engine', () => {
  const src = readFileSync(resolve(root, 'api/mission-control-api/routes.js'), 'utf8');
  assert.ok(!src.includes('createMonitoringEngine'), 'must not instantiate Monitoring Engine');
  assert.ok(!src.includes('recordScan'),             'must not call recordScan');
});

test('responses carry apiVersion field on all status types', () => {
  const success  = createSuccessResponse('identity', { artistId: 'a1' });
  const error    = createErrorResponse('identity', 'INVALID_REQUEST', 'err');
  const notFound = createNotFoundResponse('ghost');
  assert.equal(success.apiVersion,  'v1');
  assert.equal(error.apiVersion,    'v1');
  assert.equal(notFound.apiVersion, 'v1');
});

// ─────────────────────────────────────────────────────────────────────────────
// 19. DOCUMENTATION COMPLETENESS
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§19 Documentation Completeness');

const docPath    = resolve(root, 'api/mission-control-api/MISSION_CONTROL_API.md');
const docExists  = existsSync(docPath);
const docContent = docExists ? readFileSync(docPath, 'utf8') : '';

test('MISSION_CONTROL_API.md exists', () => {
  assert.ok(docExists);
});

test('doc has Constitutional Mission section', () => {
  assert.ok(docContent.includes('Constitutional Mission'));
});

test('doc has Architecture section', () => {
  assert.ok(docContent.includes('Architecture'));
});

test('doc has Endpoint Registry section', () => {
  assert.ok(docContent.includes('Endpoint Registry'));
});

test('doc has Response Models section', () => {
  assert.ok(docContent.includes('Response Models'));
});

test('doc has Versioning Strategy section', () => {
  assert.ok(docContent.includes('Versioning Strategy'));
});

test('doc has Serialization section', () => {
  assert.ok(docContent.includes('Serialization'));
});

test('doc has Consumer Rules section', () => {
  assert.ok(docContent.includes('Consumer Rules'));
});

test('doc has Future Expansion section', () => {
  assert.ok(docContent.includes('Future Expansion'));
});

test('doc has File Map section', () => {
  assert.ok(docContent.includes('File Map'));
});

test('doc documents all 7 endpoints', () => {
  for (const ep of Object.values(API_ENDPOINTS)) {
    assert.ok(docContent.includes(ep), `doc must mention endpoint ${ep}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 20. API SURFACE COMPLETENESS
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n§20 API Surface Completeness');

test('all 9 source files exist', () => {
  const files = [
    'version.js', 'types.js', 'schemas.js', 'registry.js',
    'responses.js', 'serialization.js', 'validation.js', 'routes.js', 'index.js',
  ];
  for (const f of files) {
    assert.ok(
      existsSync(resolve(root, 'api/mission-control-api', f)),
      `${f} must exist`
    );
  }
});

test('index exports MISSION_CONTROL_API_VERSION with correct sprint', () => {
  assert.ok(MISSION_CONTROL_API_VERSION.sprint.includes('9'));
});

test('API_ENDPOINTS count matches DEFAULT_ENDPOINT_DEFS count', () => {
  assert.equal(Object.keys(API_ENDPOINTS).length, DEFAULT_ENDPOINT_DEFS.length);
});

test('all DEFAULT_ENDPOINT_DEFS have schemas in ENDPOINT_SCHEMAS', () => {
  for (const def of DEFAULT_ENDPOINT_DEFS) {
    assert.ok(ENDPOINT_SCHEMAS[def.endpointId], `no schema for ${def.endpointId}`);
  }
});

test('singleton and factory produce responses with same apiVersion', () => {
  const fromSingleton = MISSION_CONTROL_API.getIdentity({ canonicalDomains: makeDomains() });
  const fromFactory   = api.getIdentity({ canonicalDomains: makeDomains() });
  assert.equal(fromSingleton.apiVersion, fromFactory.apiVersion);
});

test('all routes return an object with the required response envelope fields', () => {
  const responses = [
    MISSION_CONTROL_API.getIdentity({ canonicalDomains: makeDomains() }),
    MISSION_CONTROL_API.getMusicRights({ canonicalDomains: makeDomains() }),
    MISSION_CONTROL_API.getCatalog({ canonicalDomains: makeDomains() }),
    MISSION_CONTROL_API.getDistribution({ canonicalDomains: makeDomains() }),
    MISSION_CONTROL_API.getMonitoring({ timeline: [], alerts: [] }),
    MISSION_CONTROL_API.getSystemOperations({ canonicalDomains: makeDomains() }),
    MISSION_CONTROL_API.getExecutiveOverview({ canonicalDomains: makeDomains() }),
  ];
  for (const r of responses) {
    for (const field of REQUIRED_RESPONSE_FIELDS) {
      assert.ok(r[field] !== undefined && r[field] !== null, `${r.endpoint} response missing ${field}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESULTS
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Mission Control Data API Test Suite`);
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);
console.log('─'.repeat(60));

if (failed > 0) process.exit(1);
