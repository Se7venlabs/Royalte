// ─────────────────────────────────────────────────────────────────────────────
//  Executive Brief™ Engine — Test Suite (Sprint 11)
//  Tests: assembly pipeline, summary, metrics, timeline, recommendations,
//  sections (all 9), formatting, validation, constitutional boundaries,
//  documentation completeness, and API surface.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath }            from 'node:url';
import { dirname, join }            from 'node:path';

import {
  EXECUTIVE_BRIEF_ENGINE, createExecutiveBriefEngine,
  EXECUTIVE_BRIEF_ENGINE_VERSION,
  FORMAT_TYPES, FORMAT_STATUS, FORMAT_REGISTRY, VALID_FORMATS,
  formatBrief, getFormatRegistry,
  buildExecutiveMetrics,
  buildTimeline,
  buildExecutiveSummary,
  buildExecutiveRecommendations,
  SECTION_TYPES, SECTION_ORDER, SECTION_STATUS,
  buildIdentitySection, buildMusicRightsSection, buildCatalogSection,
  buildDistributionSection, buildMonitoringSection, buildSystemOperationsSection,
  buildAthenaSection, buildRecommendationsSection, buildAppendixSection,
  buildAllSections,
  assembleExecutiveBrief,
  validateBrief, validateSummary, validateSections,
  validateTimeline, validateRecommendationReferences, validateFormatting,
} from '../api/executive-brief/index.js';

import { ATHENA_ENGINE } from '../api/athena/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ─── Test helpers ─────────────────────────────────────────────────────────────
function makeResponse(endpoint, data, { status = 'SUCCESS', scanId = 'scan-001', artistId = 'a1' } = {}) {
  return Object.freeze({
    apiVersion: 'v1',
    endpoint,
    status,
    scanId,
    artistId,
    timestamp: new Date().toISOString(),
    data: status === 'SUCCESS' ? Object.freeze({ ...data }) : null,
  });
}

function makeFullResponses() {
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
  };
}

function makeRiskyResponses() {
  return {
    identity: makeResponse('identity', {
      artistId: 'a2', artistName: 'Risky Artist', verified: false,
      verification: { verified: false, coverage: 0.2, total: 5 },
    }),
    musicRights: makeResponse('music_rights', {}),
    catalog: makeResponse('catalog', { releases: [{ title: 'Track 1' }], isrcCoverage: 0.4 }),
    distribution: makeResponse('distribution', {}),
    monitoring: makeResponse('monitoring', {
      changeCount: 3,
      alerts: [
        { alertId: 'a1', severity: 'CRITICAL', title: 'Publisher removed', timestamp: '2026-07-12T10:00:00Z' },
        { alertId: 'a2', severity: 'HIGH',     title: 'New release',        timestamp: '2026-07-12T09:00:00Z' },
        { alertId: 'a3', severity: 'MEDIUM',   title: 'Minor metadata',     timestamp: '2026-07-12T08:00:00Z' },
      ],
      timeline: [
        { eventId: 'e1', field: 'publisher', severity: 'CRITICAL', timestamp: '2026-07-12T10:00:00Z' },
        { eventId: 'e2', field: 'release',   severity: 'LOW',      timestamp: '2026-07-11T08:00:00Z' },
      ],
    }),
    systemOperations: makeResponse('system_operations', { scanId: 'scan-002', scanStatus: 'COMPLETE' }),
  };
}

const fullResponses  = makeFullResponses();
const riskyResponses = makeRiskyResponses();
const fullAthena     = ATHENA_ENGINE.analyze(fullResponses);
const riskyAthena    = ATHENA_ENGINE.analyze(riskyResponses);

// ─── §1 Module Loader ─────────────────────────────────────────────────────────
section('§1 Module Loader');
assert(typeof EXECUTIVE_BRIEF_ENGINE       === 'object', 'EXECUTIVE_BRIEF_ENGINE singleton is defined');
assert(typeof createExecutiveBriefEngine   === 'function', 'createExecutiveBriefEngine factory is defined');

// ─── §2 Version ───────────────────────────────────────────────────────────────
section('§2 Version');
assert(Object.isFrozen(EXECUTIVE_BRIEF_ENGINE_VERSION),            'EXECUTIVE_BRIEF_ENGINE_VERSION is frozen');
assert(EXECUTIVE_BRIEF_ENGINE_VERSION.version === '1.0.0',         'version is 1.0.0');
assert(EXECUTIVE_BRIEF_ENGINE_VERSION.engineId === 'executive-brief-engine-v1', 'engineId matches');
assert(EXECUTIVE_BRIEF_ENGINE_VERSION.sprint.includes('Sprint 11'), 'sprint references Sprint 11');
assert(EXECUTIVE_BRIEF_ENGINE_VERSION.name === 'Executive Brief™ Engine', 'name matches');

// ─── §3 Format Types and Registry ─────────────────────────────────────────────
section('§3 Format Types and Registry');
assert(Object.keys(FORMAT_TYPES).length === 5,                      'FORMAT_TYPES has 5 entries');
assert(VALID_FORMATS instanceof Set,                                 'VALID_FORMATS is a Set');
assert(VALID_FORMATS.size === 5,                                     'VALID_FORMATS has 5 entries');
assert(FORMAT_REGISTRY.json.implemented === true,                    'json format is implemented');
assert(FORMAT_REGISTRY.pdf.status  === FORMAT_STATUS.FUTURE,         'pdf is FUTURE status');
assert(FORMAT_REGISTRY.html.status === FORMAT_STATUS.FUTURE,         'html is FUTURE status');
assert(typeof getFormatRegistry() === 'object',                      'getFormatRegistry returns object');

// ─── §4 Formatting Engine — JSON ──────────────────────────────────────────────
section('§4 Formatting Engine — JSON');
const testBrief = assembleExecutiveBrief(fullResponses, fullAthena);
const jsonOut   = formatBrief(testBrief, FORMAT_TYPES.JSON);
assert(Object.isFrozen(jsonOut),                         'formatBrief result is frozen');
assert(jsonOut.format    === 'json',                     'format field is json');
assert(jsonOut.status    === 'COMPLETE',                 'status is COMPLETE');
assert(typeof jsonOut.content === 'string',              'content is a string');
assert(jsonOut.content.length > 100,                     'content has substantial length');
assert(typeof jsonOut.characterCount === 'number',       'characterCount is a number');
assert(jsonOut.briefId === testBrief.briefId,            'briefId preserved in formatted output');

// ─── §5 Formatting Engine — Future Formats ────────────────────────────────────
section('§5 Formatting Engine — Future Formats');
['pdf', 'html', 'email', 'api'].forEach(fmt => {
  const result = formatBrief(testBrief, fmt);
  assert(result.status === 'FUTURE_FORMAT', `${fmt} returns FUTURE_FORMAT status`);
});
assert(formatBrief(testBrief, 'unknown').status === 'ERROR', 'unknown format returns ERROR');

// ─── §6 Executive Metrics ─────────────────────────────────────────────────────
section('§6 Executive Metrics');
const metrics     = buildExecutiveMetrics(fullResponses,  fullAthena);
const riskyMetrics = buildExecutiveMetrics(riskyResponses, riskyAthena);
assert(Object.isFrozen(metrics),                                    'metrics object is frozen');
assert(Object.isFrozen(metrics.identity),                           'metrics.identity is frozen');
assert(metrics.identity.hasIpi  === true,                           'full artist hasIpi true');
assert(metrics.identity.hasIsni === true,                           'full artist hasIsni true');
assert(metrics.rights.publisherKnown === true,                      'full artist publisherKnown');
assert(metrics.catalog.releaseCount  === 2,                         'full artist has 2 releases');
assert(metrics.distribution.hasDistributor === true,                'full artist has distributor');
assert(metrics.monitoring.totalAlerts === 0,                        'full artist has no alerts');
assert(riskyMetrics.rights.publisherKnown === false,                'risky artist publisherKnown false');
assert(riskyMetrics.monitoring.criticalAlerts === 1,                'risky artist has 1 critical alert');
assert(riskyMetrics.executive.executiveScore != null,               'executiveScore is present');
assert(riskyMetrics.executive.executiveScore === 100 - riskyMetrics.executive.riskScore, 'executiveScore = 100 - riskScore');

// ─── §7 Timeline ──────────────────────────────────────────────────────────────
section('§7 Timeline');
const emptyTimeline = buildTimeline(fullResponses,  fullAthena);
const riskyTimeline = buildTimeline(riskyResponses, riskyAthena);
assert(Object.isFrozen(emptyTimeline),                              'timeline is frozen');
assert(Array.isArray(emptyTimeline.events),                         'events is an array');
assert(emptyTimeline.totalEvents  === 0,                            'full artist has 0 events');
assert(emptyTimeline.totalAlerts  === 0,                            'full artist has 0 alerts');
assert(riskyTimeline.totalEvents  === 2,                            'risky artist has 2 events');
assert(riskyTimeline.totalAlerts  === 3,                            'risky artist has 3 alerts');
assert(riskyTimeline.criticalAlerts === 1,                          'risky artist has 1 critical alert');
// Verify events newest-first
assert(
  riskyTimeline.events[0].timestamp >= riskyTimeline.events[1].timestamp,
  'events sorted newest-first'
);
// Verify alerts sorted by severity (CRITICAL first)
assert(riskyTimeline.alerts[0].severity === 'CRITICAL',             'first alert is CRITICAL');
assert(riskyTimeline.alerts[1].severity === 'HIGH',                 'second alert is HIGH');
assert(riskyTimeline.latestAlert !== null,                          'latestAlert is set');

// ─── §8 Executive Summary ─────────────────────────────────────────────────────
section('§8 Executive Summary');
const fullSummary  = buildExecutiveSummary(fullResponses,  fullAthena);
const riskySummary = buildExecutiveSummary(riskyResponses, riskyAthena);
assert(Object.isFrozen(fullSummary),                                'summary is frozen');
assert(fullSummary.artistName === 'Test Artist',                    'artistName extracted');
assert(fullSummary.overallHealth !== 'UNKNOWN',                     'overallHealth is set');
assert(['STRONG','GOOD','MODERATE','WEAK','CRITICAL'].includes(fullSummary.overallHealth), 'overallHealth is valid');
assert(fullSummary.executiveScore != null,                          'executiveScore is present');
assert(fullSummary.executiveScore === 100 - fullSummary.riskScore,  'executiveScore inverse of riskScore');
assert(Array.isArray(fullSummary.topPriorities),                    'topPriorities is an array');
assert(Array.isArray(fullSummary.highestRisks),                     'highestRisks is an array');
assert(Array.isArray(fullSummary.biggestOpportunities),             'biggestOpportunities is an array');
assert(riskySummary.criticalRisks > 0,                              'risky artist has critical risks');
assert(riskySummary.urgentRecommendations > 0,                      'risky artist has urgent recommendations');

// ─── §9 Recommendations Assembly ──────────────────────────────────────────────
section('§9 Recommendations Assembly');
const fullRecs  = buildExecutiveRecommendations(fullAthena);
const riskyRecs = buildExecutiveRecommendations(riskyAthena);
assert(Object.isFrozen(fullRecs),                                   'recommendations object is frozen');
assert(Object.isFrozen(fullRecs.all),                               'recommendations.all is frozen');
assert(typeof fullRecs.totalCount === 'number',                     'totalCount is a number');
assert(fullRecs.totalCount === fullRecs.all.length,                 'totalCount matches all.length');
assert(typeof fullRecs.byPriority === 'object',                     'byPriority is an object');
assert(Array.isArray(fullRecs.byPriority.urgent),                   'byPriority.urgent is an array');
assert(riskyRecs.urgentCount > 0,                                   'risky artist has urgent recommendations');
assert(Array.isArray(riskyRecs.topActions),                         'topActions is an array');
assert(riskyRecs.topActions.length <= 5,                            'topActions capped at 5');

// ─── §10 Sections — Identity and Music Rights ─────────────────────────────────
section('§10 Sections — Identity and Music Rights');
const idSection    = buildIdentitySection(fullResponses);
const noIdSection  = buildIdentitySection({});
const rightsSection = buildMusicRightsSection(fullResponses);
assert(idSection.type    === SECTION_TYPES.IDENTITY_INTELLIGENCE,   'identity section type correct');
assert(idSection.status  === SECTION_STATUS.COMPLETE,               'identity section status COMPLETE');
assert(idSection.data.artistName === 'Test Artist',                 'identity section data has artistName');
assert(noIdSection.status === SECTION_STATUS.UNAVAILABLE,           'missing identity → UNAVAILABLE');
assert(rightsSection.data.publisher === 'Test Publishing',          'rights section has publisher');

// ─── §11 Sections — Catalog and Distribution ──────────────────────────────────
section('§11 Sections — Catalog and Distribution');
const catalogSection   = buildCatalogSection(fullResponses);
const distSection      = buildDistributionSection(fullResponses);
const noDistSection    = buildDistributionSection(riskyResponses);
assert(catalogSection.data.releaseCount === 2,                      'catalog section has 2 releases');
assert(catalogSection.data.hasCatalog   === true,                   'catalog section hasCatalog true');
assert(distSection.data.hasDistribution === true,                   'distribution section hasDistribution true');
assert(noDistSection.data.hasDistribution === false,                'risky dist section hasDistribution false');

// ─── §12 Sections — Monitoring ────────────────────────────────────────────────
section('§12 Sections — Monitoring');
const cleanMonSection = buildMonitoringSection(fullResponses);
const riskyMonSection = buildMonitoringSection(riskyResponses);
const noMonSection    = buildMonitoringSection({});
assert(cleanMonSection.status === SECTION_STATUS.COMPLETE,          'clean monitoring → COMPLETE');
assert(riskyMonSection.status === SECTION_STATUS.PARTIAL,           'critical alerts → PARTIAL');
assert(riskyMonSection.data.criticalAlerts === 1,                   'monitoring section criticalAlerts count');
assert(noMonSection.status === SECTION_STATUS.UNAVAILABLE,          'missing monitoring → UNAVAILABLE');

// ─── §13 Sections — System Operations and ATHENA ─────────────────────────────
section('§13 Sections — System Operations and ATHENA');
const sysSection       = buildSystemOperationsSection(fullResponses);
const athenaSection    = buildAthenaSection(fullAthena);
const noAthenaSection  = buildAthenaSection(null);
assert(sysSection.data.scanStatus === 'COMPLETE',                   'sysOps section has scanStatus');
assert(sysSection.data.complete   === true,                         'sysOps section complete flag');
assert(athenaSection.type  === SECTION_TYPES.ATHENA,                'ATHENA section type correct');
assert(athenaSection.data.athenaReportId !== null,                  'ATHENA section has athenaReportId');
assert(noAthenaSection.status === SECTION_STATUS.UNAVAILABLE,       'null athenaReport → UNAVAILABLE');

// ─── §14 Sections — Recommendations and Appendix ─────────────────────────────
section('§14 Sections — Recommendations and Appendix');
const recsSection   = buildRecommendationsSection(fullRecs);
const appendSection = buildAppendixSection(fullResponses, fullAthena);
const noRecsSection = buildRecommendationsSection(null);
assert(recsSection.type   === SECTION_TYPES.RECOMMENDATIONS,        'recommendations section type correct');
assert(recsSection.data.totalCount === fullRecs.totalCount,         'recommendations section totalCount matches');
assert(noRecsSection.status === SECTION_STATUS.UNAVAILABLE,         'null recommendations → UNAVAILABLE');
assert(appendSection.data.scanId !== null,                          'appendix has scanId');
assert(Array.isArray(appendSection.data.providersQueried),          'appendix has providersQueried array');
assert(appendSection.data.providersQueried.length > 0,              'appendix providersQueried is non-empty');

// ─── §15 Section Ordering ─────────────────────────────────────────────────────
section('§15 Section Ordering');
const allSections = buildAllSections(fullResponses, fullAthena, fullRecs);
assert(Object.isFrozen(allSections),                                'allSections array is frozen');
assert(allSections.length === 9,                                    'allSections has 9 sections');
assert(allSections.every(s => Object.isFrozen(s)),                  'every section is frozen');
assert(allSections.map(s => s.type).join(',') === SECTION_ORDER.join(','), 'section order matches SECTION_ORDER');

// ─── §16 Full Assembly Pipeline ───────────────────────────────────────────────
section('§16 Full Assembly Pipeline');
const fullBrief  = assembleExecutiveBrief(fullResponses,  fullAthena);
const riskyBrief = assembleExecutiveBrief(riskyResponses, riskyAthena);
const brief2     = assembleExecutiveBrief(fullResponses,  fullAthena);
assert(Object.isFrozen(fullBrief),                                  'assembled brief is frozen');
assert(typeof fullBrief.briefId === 'string',                       'briefId is a string');
assert(fullBrief.briefId.length === 36,                             'briefId is UUID format');
assert(fullBrief.briefId !== brief2.briefId,                        'each call produces unique briefId');
assert(fullBrief.version  === '1.0.0',                              'version is 1.0.0');
assert(fullBrief.sections.length === 9,                             'brief has 9 sections');
assert(fullBrief.summary  != null,                                  'brief has summary');
assert(fullBrief.metrics  != null,                                  'brief has metrics');
assert(fullBrief.timeline != null,                                  'brief has timeline');
assert(fullBrief.recommendations != null,                           'brief has recommendations');
assert(['STRONG','GOOD'].includes(fullBrief.summary.overallHealth), 'healthy artist has STRONG/GOOD health');
assert(riskyBrief.recommendations.urgentCount > 0,                  'risky artist brief has urgent recs');

// ─── §17 Non-throwing on empty/null inputs ────────────────────────────────────
section('§17 Non-throwing on empty/null inputs');
let emptyBrief;
try { emptyBrief = assembleExecutiveBrief({}, null); } catch(e) { emptyBrief = null; }
assert(emptyBrief !== null,                                         'assembleExecutiveBrief({}, null) does not throw');
assert(emptyBrief?.summary?.overallHealth === 'UNKNOWN',            'empty brief overallHealth is UNKNOWN');
assert(emptyBrief?.sections?.length === 9,                          'empty brief still produces 9 sections');

// ─── §18 Validation ───────────────────────────────────────────────────────────
section('§18 Validation');
const vBrief   = validateBrief(fullBrief);
const vNull    = validateBrief(null);
assert(vBrief.valid   === true,                                     'validateBrief valid for complete brief');
assert(vBrief.errors.length === 0,                                  'validateBrief no errors for complete brief');
assert(vNull.valid    === false,                                     'validateBrief invalid for null');
const vSummary = validateSummary(fullBrief.summary);
const vBadSumm = validateSummary(null);
assert(vSummary.valid === true,                                     'validateSummary valid for complete summary');
assert(vBadSumm.valid === false,                                     'validateSummary invalid for null');
const vSections = validateSections(fullBrief.sections);
const vBadSects = validateSections('not an array');
assert(vSections.valid === true,                                    'validateSections valid for complete sections');
assert(vBadSects.valid === false,                                    'validateSections invalid for non-array');
const vTimeline = validateTimeline(fullBrief.timeline);
assert(vTimeline.valid === true,                                     'validateTimeline valid for complete timeline');
const vRiskyTimeline = validateTimeline(riskyBrief.timeline);
assert(vRiskyTimeline.valid === true,                               'validateTimeline valid for risky timeline');
const vRefsFull  = validateRecommendationReferences(fullBrief);
assert(vRefsFull.valid  === true,                                   'validateRecommendationReferences valid for full brief');
const vFmtJson = validateFormatting(jsonOut);
const vFmtBad  = validateFormatting(null);
assert(vFmtJson.valid === true,                                      'validateFormatting valid for JSON output');
assert(vFmtBad.valid  === false,                                     'validateFormatting invalid for null');

// ─── §19 EXECUTIVE_BRIEF_ENGINE factory ──────────────────────────────────────
section('§19 EXECUTIVE_BRIEF_ENGINE factory');
const engine = createExecutiveBriefEngine();
assert(Object.isFrozen(engine),                                     'factory returns frozen engine');
assert(typeof engine.assemble  === 'function',                      'engine has assemble method');
assert(typeof engine.format    === 'function',                      'engine has format method');
assert(typeof engine.validate  === 'function',                      'engine has validate method');
assert(Object.isFrozen(EXECUTIVE_BRIEF_ENGINE),                     'EXECUTIVE_BRIEF_ENGINE singleton is frozen');
assert(EXECUTIVE_BRIEF_ENGINE.engineVersion === EXECUTIVE_BRIEF_ENGINE_VERSION, 'singleton engineVersion matches');

// ─── §20 Constitutional Boundaries ───────────────────────────────────────────
section('§20 Constitutional Boundaries');
const indexSrc = readFileSync(join(__dirname, '../api/executive-brief/index.js'), 'utf8');
const assemblerSrc = readFileSync(join(__dirname, '../api/executive-brief/assembler.js'), 'utf8');
const FORBIDDEN = ['api/evidence', 'api/registry', 'api/normalization', 'api/resolution', 'api/orchestrator', 'api/monitoring', 'api/athena'];
const indexViolations = FORBIDDEN.filter(f => {
  const importPattern = new RegExp(`from.*['"].*${f.replace('/', '\\/')}`, 'i');
  return importPattern.test(indexSrc);
});
const assemblerViolations = FORBIDDEN.filter(f => {
  const importPattern = new RegExp(`from.*['"].*${f.replace('/', '\\/')}`, 'i');
  return importPattern.test(assemblerSrc);
});
assert(indexViolations.length   === 0,                              'index.js has no forbidden platform imports');
assert(assemblerViolations.length === 0,                            'assembler.js has no forbidden platform imports');
assert(Object.isFrozen(fullBrief.summary),                         'brief.summary is deep-frozen');
assert(Object.isFrozen(fullBrief.sections[0]),                     'sections[0] is frozen');

// ─── §21 Documentation Completeness ──────────────────────────────────────────
section('§21 Documentation Completeness');
const docPath = join(__dirname, '../api/executive-brief/EXECUTIVE_BRIEF_ENGINE.md');
assert(existsSync(docPath),                                         'EXECUTIVE_BRIEF_ENGINE.md exists');
const doc = readFileSync(docPath, 'utf8');
assert(doc.includes('Constitutional Mission'),                      'doc has Constitutional Mission section');
assert(doc.includes('Architecture'),                                'doc has Architecture section');
assert(doc.includes('Inputs'),                                      'doc has Inputs section');
assert(doc.includes('Outputs'),                                     'doc has Outputs section');
assert(doc.includes('Assembly Pipeline'),                           'doc has Assembly Pipeline section');
assert(doc.includes('Executive Summary'),                           'doc has Executive Summary section');
assert(doc.includes('Sections'),                                    'doc has Sections section');
assert(doc.includes('Formatting Engine'),                           'doc has Formatting Engine section');
assert(doc.includes('Versioning'),                                  'doc has Versioning section');
assert(doc.includes('Future Export Strategy'),                      'doc has Future Export Strategy section');
assert(doc.includes('Consumers'),                                   'doc has Consumers section');
assert(doc.includes('File Map'),                                    'doc has File Map section');
const sourceFiles = ['version.js','formatting.js','metrics.js','timeline.js','summary.js','recommendations.js','sections.js','assembler.js','validate.js','index.js'];
sourceFiles.forEach(f => assert(doc.includes(f), `doc references ${f}`));

// ─── §22 API Surface Completeness ────────────────────────────────────────────
section('§22 API Surface Completeness');
const expectedFiles = ['version.js','formatting.js','metrics.js','timeline.js','summary.js','recommendations.js','sections.js','assembler.js','validate.js','index.js','EXECUTIVE_BRIEF_ENGINE.md'];
expectedFiles.forEach(f => {
  assert(existsSync(join(__dirname, '../api/executive-brief', f)), `${f} exists`);
});
assert(Object.isFrozen(EXECUTIVE_BRIEF_ENGINE),                    'EXECUTIVE_BRIEF_ENGINE is frozen');
assert(EXECUTIVE_BRIEF_ENGINE.assemble(fullResponses, fullAthena).briefId !==
       EXECUTIVE_BRIEF_ENGINE.assemble(fullResponses, fullAthena).briefId, 'assemble() returns new brief each call');

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`
────────────────────────────────────────────────────────────
Executive Brief™ Engine Test Suite
Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}
────────────────────────────────────────────────────────────`);

if (failed > 0) process.exit(1);
