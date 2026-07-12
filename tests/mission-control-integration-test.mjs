// ─────────────────────────────────────────────────────────────────────────────
//  Mission Control™ Integration Layer — Test Suite (Sprint 12)
//  Tests: workspace registry, endpoint mappings, all 10 workspace bindings,
//  graceful degradation, full integration pipeline, validation,
//  constitutional boundaries, documentation completeness, API surface.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath }            from 'node:url';
import { dirname, join }            from 'node:path';

import {
  MC_INTEGRATION, createMcIntegrationLayer,
  MC_INTEGRATION_VERSION,
  WORKSPACE_IDS, WORKSPACE_STATUS, WORKSPACE_REGISTRY, VALID_WORKSPACE_IDS,
  ENDPOINT_ID_TO_RESPONSE_KEY, RESPONSE_KEY_TO_ENDPOINT_ID,
  bindWorkspace, bindAllWorkspaces,
  computeWorkspaceStatus, isResponseAvailable, makeUnavailableWorkspace, makeWorkspaceBound,
  transformIdentity, transformMusicRights, transformCatalog,
  transformDistribution, transformMonitoring,
  transformBackend, transformHealth, transformOverview,
  transformAthena, transformExecutiveBrief,
  validateWorkspaceBinding, validateAllBindings,
  assertWorkspacePopulated, validateNoDirectPlatformImports,
} from '../api/mission-control-integration/index.js';

import { ATHENA_ENGINE }            from '../api/athena/index.js';
import { assembleExecutiveBrief }   from '../api/executive-brief/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else           { console.error(`  ✗ ${label}`); failed++; }
}

function section(title) { console.log(`\n${title}`); }

// ─── Test helpers ─────────────────────────────────────────────────────────────
function makeResponse(endpoint, data, { status = 'SUCCESS' } = {}) {
  return Object.freeze({
    apiVersion: 'v1',
    endpoint,
    status,
    scanId:    'scan-001',
    artistId:  'a1',
    timestamp: new Date().toISOString(),
    data: status === 'SUCCESS' ? Object.freeze({ ...data }) : null,
  });
}

function makeFullApiResponses() {
  return {
    identity: makeResponse('identity', {
      artistId: 'a1', artistName: 'Test Artist', verified: true,
      verification: { verified: true, coverage: 0.9, total: 5 },
      ipi: '00123456789', isni: '0000000000000001',
      providers: [{ name: 'apple', verified: true }],
    }),
    musicRights: makeResponse('music_rights', {
      publisher: 'Test Publishing', pro: 'ASCAP', iswc: 'T-123456789-0', compositions: [],
    }),
    catalog: makeResponse('catalog', {
      releases: [{ title: 'Album One' }, { title: 'Album Two' }],
      isrcCoverage: 0.95, label: 'Test Label',
    }),
    distribution: makeResponse('distribution', {
      distributor: 'Test Distributor', dspCoverage: 0.8,
      platforms: ['spotify', 'apple-music'],
    }),
    monitoring: makeResponse('monitoring', { changeCount: 0, alerts: [], timeline: [] }),
    systemOperations: makeResponse('system_operations', { scanId: 'scan-001', scanStatus: 'COMPLETE' }),
    executiveOverview: makeResponse('executive_overview', {
      overallHealth: 'GOOD', intelligenceSummary: 'Platform healthy',
    }),
  };
}

function makeRiskyApiResponses() {
  return {
    identity:         makeResponse('identity', { artistId: 'a2', artistName: 'Risky', verified: false }),
    musicRights:      makeResponse('music_rights', {}),
    catalog:          makeResponse('catalog', { releases: [], isrcCoverage: 0.2 }),
    distribution:     makeResponse('distribution', {}),
    monitoring:       makeResponse('monitoring', {
      changeCount: 2,
      alerts:   [{ alertId: 'x', severity: 'CRITICAL', title: 'Publisher removed' }],
      timeline: [{ eventId: 'e1', field: 'publisher', severity: 'CRITICAL', timestamp: '2026-07-12T10:00:00Z' }],
    }),
    systemOperations: makeResponse('system_operations', { scanId: 'scan-002', scanStatus: 'COMPLETE' }),
    executiveOverview: makeResponse('executive_overview', { overallHealth: 'WEAK' }),
  };
}

const fullResponses  = makeFullApiResponses();
const riskyResponses = makeRiskyApiResponses();
const fullAthena     = ATHENA_ENGINE.analyze(fullResponses);
const riskyAthena    = ATHENA_ENGINE.analyze(riskyResponses);
const fullBrief      = assembleExecutiveBrief(fullResponses, fullAthena);

// ─── §1 Module Loader ─────────────────────────────────────────────────────────
section('§1 Module Loader');
assert(typeof MC_INTEGRATION === 'object',              'MC_INTEGRATION singleton is defined');
assert(typeof createMcIntegrationLayer === 'function',  'createMcIntegrationLayer factory is defined');

// ─── §2 Version ───────────────────────────────────────────────────────────────
section('§2 Version');
assert(Object.isFrozen(MC_INTEGRATION_VERSION),                         'MC_INTEGRATION_VERSION is frozen');
assert(MC_INTEGRATION_VERSION.version === '1.0.0',                      'version is 1.0.0');
assert(MC_INTEGRATION_VERSION.engineId === 'mc-integration-v1',         'engineId matches');
assert(MC_INTEGRATION_VERSION.sprint.includes('Sprint 12'),             'sprint references Sprint 12');
assert(MC_INTEGRATION_VERSION.name === 'Mission Control™ Integration Layer', 'name matches');

// ─── §3 Workspace Registry ────────────────────────────────────────────────────
section('§3 Workspace Registry');
assert(Object.keys(WORKSPACE_REGISTRY).length === 10,                   'registry has 10 workspaces');
assert(VALID_WORKSPACE_IDS instanceof Set,                               'VALID_WORKSPACE_IDS is a Set');
assert(VALID_WORKSPACE_IDS.size === 10,                                  'VALID_WORKSPACE_IDS has 10 entries');
assert(VALID_WORKSPACE_IDS.has('identity'),                              'registry includes identity');
assert(VALID_WORKSPACE_IDS.has('backend'),                               'registry includes backend');
assert(VALID_WORKSPACE_IDS.has('health'),                                'registry includes health');
assert(VALID_WORKSPACE_IDS.has('athena'),                                'registry includes athena');
assert(VALID_WORKSPACE_IDS.has('executive_brief'),                       'registry includes executive_brief');
assert(Object.values(WORKSPACE_REGISTRY).every(w => w.workspaceId),     'every workspace has workspaceId');
assert(Object.values(WORKSPACE_REGISTRY).every(w => w.name),            'every workspace has name');
assert(Object.values(WORKSPACE_REGISTRY).every(w => w.dataSource),      'every workspace has dataSource');

// ─── §4 Endpoint Key Mapping ──────────────────────────────────────────────────
section('§4 Endpoint Key Mapping');
assert(ENDPOINT_ID_TO_RESPONSE_KEY.music_rights === 'musicRights',      'music_rights → musicRights');
assert(ENDPOINT_ID_TO_RESPONSE_KEY.system_operations === 'systemOperations', 'system_operations → systemOperations');
assert(ENDPOINT_ID_TO_RESPONSE_KEY.executive_overview === 'executiveOverview', 'executive_overview → executiveOverview');
assert(RESPONSE_KEY_TO_ENDPOINT_ID.musicRights === 'music_rights',      'musicRights → music_rights');
assert(RESPONSE_KEY_TO_ENDPOINT_ID.systemOperations === 'system_operations', 'systemOperations → system_operations');
assert(Object.keys(ENDPOINT_ID_TO_RESPONSE_KEY).length === 7,           'ENDPOINT_ID_TO_RESPONSE_KEY has 7 entries');

// ─── §5 Workspace Endpoint Requirements ──────────────────────────────────────
section('§5 Workspace Endpoint Requirements');
assert(WORKSPACE_REGISTRY.backend.requiredResponseKeys.length === 6,    'backend requires 6 response keys');
assert(WORKSPACE_REGISTRY.health.requiredResponseKeys.length === 6,     'health requires 6 response keys');
assert(WORKSPACE_REGISTRY.athena.requiredResponseKeys.length === 0,     'athena has 0 required keys (direct param)');
assert(WORKSPACE_REGISTRY.executive_brief.requiredResponseKeys.length === 0, 'brief has 0 required keys (direct param)');
assert(WORKSPACE_REGISTRY.identity.requiredResponseKeys[0] === 'identity', 'identity requires identity key');
assert(WORKSPACE_REGISTRY.music_rights.requiredResponseKeys[0] === 'musicRights', 'music_rights requires musicRights key');

// ─── §6 Identity Workspace ────────────────────────────────────────────────────
section('§6 Identity Workspace');
const idBinding    = bindWorkspace('identity', fullResponses);
const noIdBinding  = bindWorkspace('identity', {});
assert(Object.isFrozen(idBinding),                                       'identity binding is frozen');
assert(idBinding.workspaceId === 'identity',                             'identity binding workspaceId correct');
assert(idBinding.status === WORKSPACE_STATUS.POPULATED,                  'identity status POPULATED');
assert(idBinding.data.artistName === 'Test Artist',                      'identity data has artistName');
assert(idBinding.data.verified   === true,                               'identity data has verified flag');
assert(noIdBinding.status === WORKSPACE_STATUS.UNAVAILABLE,              'missing identity → UNAVAILABLE');

// ─── §7 Music Rights Workspace ────────────────────────────────────────────────
section('§7 Music Rights Workspace');
const rightsBinding = bindWorkspace('music_rights', fullResponses);
const noRightsBinding = bindWorkspace('music_rights', {});
assert(rightsBinding.status === WORKSPACE_STATUS.POPULATED,              'music_rights status POPULATED');
assert(rightsBinding.data.publisher === 'Test Publishing',               'music_rights data has publisher');
assert(rightsBinding.data.hasRightsData === true,                        'music_rights data hasRightsData');
assert(noRightsBinding.status === WORKSPACE_STATUS.UNAVAILABLE,          'missing music_rights → UNAVAILABLE');

// ─── §8 Catalog Workspace ─────────────────────────────────────────────────────
section('§8 Catalog Workspace');
const catalogBinding = bindWorkspace('catalog', fullResponses);
const noCatalogBinding = bindWorkspace('catalog', {});
assert(catalogBinding.status === WORKSPACE_STATUS.POPULATED,             'catalog status POPULATED');
assert(catalogBinding.data.releaseCount === 2,                           'catalog data has 2 releases');
assert(catalogBinding.data.hasCatalog   === true,                        'catalog data hasCatalog true');
assert(noCatalogBinding.status === WORKSPACE_STATUS.UNAVAILABLE,         'missing catalog → UNAVAILABLE');

// ─── §9 Distribution Workspace ───────────────────────────────────────────────
section('§9 Distribution Workspace');
const distBinding   = bindWorkspace('distribution', fullResponses);
const riskyDistBinding = bindWorkspace('distribution', riskyResponses);
assert(distBinding.status === WORKSPACE_STATUS.POPULATED,                'distribution status POPULATED');
assert(distBinding.data.hasDistribution === true,                        'distribution data hasDistribution true');
assert(riskyDistBinding.data.hasDistribution === false,                  'risky distribution hasDistribution false');

// ─── §10 Monitoring Workspace ─────────────────────────────────────────────────
section('§10 Monitoring Workspace');
const cleanMonBinding = bindWorkspace('monitoring', fullResponses);
const riskyMonBinding = bindWorkspace('monitoring', riskyResponses);
const noMonBinding    = bindWorkspace('monitoring', {});
assert(cleanMonBinding.status === WORKSPACE_STATUS.POPULATED,            'clean monitoring POPULATED');
assert(cleanMonBinding.data.totalAlerts ?? cleanMonBinding.data.hasAlerts === false, 'clean monitoring no alerts');
assert(riskyMonBinding.data.criticalAlerts === 1,                        'risky monitoring has 1 critical alert');
assert(noMonBinding.status === WORKSPACE_STATUS.UNAVAILABLE,             'missing monitoring → UNAVAILABLE');

// ─── §11 Backend Verification Workspace ──────────────────────────────────────
section('§11 Backend Verification Workspace');
const backendBinding      = bindWorkspace('backend', fullResponses);
const partialBackendBinding = bindWorkspace('backend', riskyResponses);
assert(backendBinding.status === WORKSPACE_STATUS.POPULATED,             'full backend status POPULATED');
assert(typeof backendBinding.data.evidenceCompleteness === 'object',     'backend has evidenceCompleteness');
assert(typeof backendBinding.data.connectorHealth === 'object',          'backend has connectorHealth');
assert(backendBinding.data.connectorHealth.activeConnectors === 6,       'full backend has 6 active connectors');
assert(backendBinding.data.overallStatus === 'HEALTHY',                  'full backend overallStatus HEALTHY');
assert(backendBinding.data.registryHealth.complete === true,             'full backend registryHealth complete');
assert(backendBinding.data.monitoringHealth.totalAlerts === 0,           'full backend no alerts');
assert(partialBackendBinding.data.monitoringHealth.criticalAlerts === 1, 'risky backend has 1 critical alert');

// ─── §12 Health Intelligence Workspace ───────────────────────────────────────
section('§12 Health Intelligence Workspace');
const healthBinding      = bindWorkspace('health', fullResponses,  fullAthena);
const riskyHealthBinding = bindWorkspace('health', riskyResponses, riskyAthena);
const noAthenaHealth     = bindWorkspace('health', fullResponses,  null);
assert(healthBinding.status === WORKSPACE_STATUS.POPULATED,              'health status POPULATED');
assert(healthBinding.data.overallHealth !== 'UNKNOWN',                   'health overallHealth set from ATHENA');
assert(healthBinding.data.executiveScore != null,                        'health executiveScore present');
assert(healthBinding.data.executiveScore === 100 - healthBinding.data.riskScore, 'executiveScore = 100 - riskScore');
assert(healthBinding.data.athenaAvailable === true,                      'health athenaAvailable true');
assert(riskyHealthBinding.data.criticalRisks > 0,                       'risky health has critical risks');
assert(noAthenaHealth.data.overallHealth === 'UNKNOWN',                  'no ATHENA → overallHealth UNKNOWN');
assert(noAthenaHealth.data.athenaAvailable === false,                    'no ATHENA → athenaAvailable false');

// ─── §13 Executive Overview Workspace ────────────────────────────────────────
section('§13 Executive Overview Workspace');
const overviewBinding   = bindWorkspace('overview', fullResponses, fullAthena);
const noOverviewBinding = bindWorkspace('overview', {});
assert(overviewBinding.status === WORKSPACE_STATUS.POPULATED,            'overview status POPULATED');
assert(overviewBinding.data.artistName === 'Test Artist',                'overview has artistName from identity');
assert(overviewBinding.data.overallHealth !== 'UNKNOWN',                 'overview overallHealth from ATHENA');
assert(Array.isArray(overviewBinding.data.topPriorities),                'overview has topPriorities array');
assert(noOverviewBinding.status === WORKSPACE_STATUS.UNAVAILABLE,        'no executiveOverview → UNAVAILABLE');

// ─── §14 ATHENA Workspace ─────────────────────────────────────────────────────
section('§14 ATHENA Workspace');
const athenaBinding   = bindWorkspace('athena', {}, fullAthena);
const noAthenaBinding = bindWorkspace('athena', {}, null);
const riskyAthenaBinding = bindWorkspace('athena', {}, riskyAthena);
assert(athenaBinding.status === WORKSPACE_STATUS.POPULATED,              'ATHENA workspace POPULATED');
assert(athenaBinding.dataSource === 'athena_engine_v1',                  'ATHENA dataSource is athena_engine_v1');
assert(athenaBinding.data.athenaReportId != null,                        'ATHENA workspace has athenaReportId');
assert(Array.isArray(athenaBinding.data.recommendations),                'ATHENA workspace has recommendations array');
assert(riskyAthenaBinding.data.criticalRisks.length > 0,                'risky ATHENA has critical risks');
assert(riskyAthenaBinding.data.urgentCount > 0,                          'risky ATHENA has urgent recommendations');
assert(noAthenaBinding.status === WORKSPACE_STATUS.UNAVAILABLE,          'null athena → UNAVAILABLE');

// ─── §15 Executive Brief Workspace ───────────────────────────────────────────
section('§15 Executive Brief Workspace');
const briefBinding   = bindWorkspace('executive_brief', {}, null, fullBrief);
const noBriefBinding = bindWorkspace('executive_brief', {}, null, null);
assert(briefBinding.status === WORKSPACE_STATUS.POPULATED,               'brief workspace POPULATED');
assert(briefBinding.dataSource === 'executive_brief_engine_v1',          'brief dataSource is executive_brief_engine_v1');
assert(briefBinding.data.briefId != null,                                'brief workspace has briefId');
assert(briefBinding.data.sectionCount === 9,                             'brief workspace has 9 sections');
assert(briefBinding.data.summary != null,                                'brief workspace has summary');
assert(noBriefBinding.status === WORKSPACE_STATUS.UNAVAILABLE,           'null brief → UNAVAILABLE');

// ─── §16 Graceful Degradation ─────────────────────────────────────────────────
section('§16 Graceful Degradation');
const unavailable = makeUnavailableWorkspace('identity', 'Test reason');
assert(Object.isFrozen(unavailable),                                     'makeUnavailableWorkspace returns frozen object');
assert(unavailable.status === WORKSPACE_STATUS.UNAVAILABLE,              'unavailable status is UNAVAILABLE');
assert(unavailable.workspaceId === 'identity',                           'unavailable workspaceId preserved');
assert(unavailable.reason === 'Test reason',                             'unavailable reason preserved');
const bound = makeWorkspaceBound('catalog', { releaseCount: 2 });
assert(bound.status === WORKSPACE_STATUS.POPULATED,                      'makeWorkspaceBound defaults to POPULATED');
assert(bound.data.releaseCount === 2,                                    'makeWorkspaceBound data preserved');
const unknown = bindWorkspace('unknown_workspace', fullResponses);
assert(unknown.status === WORKSPACE_STATUS.UNAVAILABLE,                  'unknown workspace → UNAVAILABLE');

// ─── §17 bindAllWorkspaces ────────────────────────────────────────────────────
section('§17 bindAllWorkspaces');
const allBindings = bindAllWorkspaces(fullResponses, fullAthena, fullBrief);
assert(Object.isFrozen(allBindings),                                     'bindAllWorkspaces result is frozen');
assert(Object.keys(allBindings).length === 10,                           'bindAllWorkspaces returns 10 workspaces');
assert(Object.values(allBindings).every(b => Object.isFrozen(b)),        'every binding is frozen');
assert(allBindings.identity.status === WORKSPACE_STATUS.POPULATED,       'identity populated in allBindings');
assert(allBindings.athena.status   === WORKSPACE_STATUS.POPULATED,       'athena populated in allBindings');
assert(allBindings.executive_brief.status === WORKSPACE_STATUS.POPULATED, 'brief populated in allBindings');
const emptyBindings = bindAllWorkspaces({}, null, null);
assert(Object.keys(emptyBindings).length === 10,                         'empty bindAllWorkspaces still has 10 workspaces');
assert(emptyBindings.identity.status === WORKSPACE_STATUS.UNAVAILABLE,   'identity UNAVAILABLE with empty responses');

// ─── §18 Validation ───────────────────────────────────────────────────────────
section('§18 Validation');
const vBound   = validateWorkspaceBinding(briefBinding);
const vNull    = validateWorkspaceBinding(null);
assert(vBound.valid  === true,                                           'validateWorkspaceBinding valid for complete binding');
assert(vBound.errors.length === 0,                                       'validateWorkspaceBinding no errors');
assert(vNull.valid   === false,                                          'validateWorkspaceBinding invalid for null');
const vAll      = validateAllBindings(allBindings);
const vBadAll   = validateAllBindings(null);
assert(vAll.valid    === true,                                           'validateAllBindings valid for all 10 bindings');
assert(vBadAll.valid === false,                                          'validateAllBindings invalid for null');
const vMissing = validateAllBindings({ identity: allBindings.identity });
assert(vMissing.valid === false,                                         'validateAllBindings fails when workspaces missing');
let threw = false;
try { assertWorkspacePopulated(unavailable); } catch (e) { threw = e.code === 'WORKSPACE_NOT_POPULATED'; }
assert(threw,                                                            'assertWorkspacePopulated throws for UNAVAILABLE');

// ─── §19 MC_INTEGRATION factory ───────────────────────────────────────────────
section('§19 MC_INTEGRATION factory');
const layer = createMcIntegrationLayer();
assert(Object.isFrozen(layer),                                           'factory returns frozen layer');
assert(typeof layer.bindWorkspace     === 'function',                    'layer has bindWorkspace');
assert(typeof layer.bindAllWorkspaces === 'function',                    'layer has bindAllWorkspaces');
assert(typeof layer.validate          === 'function',                    'layer has validate');
assert(Object.isFrozen(MC_INTEGRATION),                                  'MC_INTEGRATION singleton is frozen');
assert(MC_INTEGRATION.version === MC_INTEGRATION_VERSION,                'singleton version matches');

// ─── §20 Constitutional Boundaries ───────────────────────────────────────────
section('§20 Constitutional Boundaries');
const indexSrc    = readFileSync(join(__dirname, '../api/mission-control-integration/index.js'), 'utf8');
const bindingSrc  = readFileSync(join(__dirname, '../api/mission-control-integration/binding.js'), 'utf8');
const { valid: indexOk }   = validateNoDirectPlatformImports(indexSrc,   'index.js');
const { valid: bindingOk } = validateNoDirectPlatformImports(bindingSrc, 'binding.js');
assert(indexOk,                                                          'index.js has no forbidden platform imports');
assert(bindingOk,                                                        'binding.js has no forbidden platform imports');
assert(Object.isFrozen(allBindings.identity.data),                      'identity binding data is frozen');
assert(Object.isFrozen(allBindings.backend.data),                       'backend binding data is frozen');

// ─── §21 Documentation Completeness ──────────────────────────────────────────
section('§21 Documentation Completeness');
const docPath = join(__dirname, '../api/mission-control-integration/MISSION_CONTROL_INTEGRATION.md');
assert(existsSync(docPath),                                              'MISSION_CONTROL_INTEGRATION.md exists');
const doc = readFileSync(docPath, 'utf8');
assert(doc.includes('Constitutional Mission'),                           'doc has Constitutional Mission');
assert(doc.includes('Architecture'),                                     'doc has Architecture section');
assert(doc.includes('Workspace Mapping'),                                'doc has Workspace Mapping');
assert(doc.includes('API Dependencies'),                                 'doc has API Dependencies');
assert(doc.includes('Consumer Responsibilities'),                        'doc has Consumer Responsibilities');
assert(doc.includes('Endpoint Key Mapping'),                             'doc has Endpoint Key Mapping');
assert(doc.includes('Integration Architecture'),                         'doc has Integration Architecture');
assert(doc.includes('Validation'),                                       'doc has Validation section');
assert(doc.includes('Future Expansion'),                                 'doc has Future Expansion');
assert(doc.includes('File Map'),                                         'doc has File Map');
['version.js','workspaces.js','graceful.js','transformers.js','binding.js','validate.js','index.js'].forEach(f =>
  assert(doc.includes(f), `doc references ${f}`)
);

// ─── §22 API Surface Completeness ────────────────────────────────────────────
section('§22 API Surface Completeness');
const expectedFiles = ['version.js','workspaces.js','graceful.js','transformers.js','binding.js','validate.js','index.js','MISSION_CONTROL_INTEGRATION.md'];
expectedFiles.forEach(f =>
  assert(existsSync(join(__dirname, '../api/mission-control-integration', f)), `${f} exists`)
);
assert(Object.isFrozen(MC_INTEGRATION),                                  'MC_INTEGRATION singleton is frozen');
assert(
  MC_INTEGRATION.bindAllWorkspaces(fullResponses, fullAthena, fullBrief).identity.workspaceId === 'identity',
  'MC_INTEGRATION.bindAllWorkspaces() works end-to-end'
);

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`
────────────────────────────────────────────────────────────
Mission Control™ Integration Layer Test Suite
Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}
────────────────────────────────────────────────────────────`);

if (failed > 0) process.exit(1);
