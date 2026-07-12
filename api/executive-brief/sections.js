// Canonical Intelligence Platform™ -- Executive Brief™ Sections
// Immutable section builders. Each section surfaces one intelligence domain.
// Status: COMPLETE (data present) | UNAVAILABLE (no SUCCESS response).

import { randomUUID } from 'node:crypto';

export const SECTION_TYPES = Object.freeze({
  IDENTITY_INTELLIGENCE: 'identity_intelligence',
  MUSIC_RIGHTS:          'music_rights',
  CATALOG:               'catalog',
  DISTRIBUTION:          'distribution',
  MONITORING:            'monitoring',
  SYSTEM_OPERATIONS:     'system_operations',
  ATHENA:                'athena',
  RECOMMENDATIONS:       'recommendations',
  APPENDIX:              'appendix',
});

export const SECTION_ORDER = Object.freeze([
  'identity_intelligence',
  'music_rights',
  'catalog',
  'distribution',
  'monitoring',
  'system_operations',
  'athena',
  'recommendations',
  'appendix',
]);

export const SECTION_STATUS = Object.freeze({
  COMPLETE:    'COMPLETE',
  PARTIAL:     'PARTIAL',
  UNAVAILABLE: 'UNAVAILABLE',
});

function extractData(response) {
  return (response?.status === 'SUCCESS' && response?.data) ? response.data : null;
}

function makeSection(type, title, data, status = SECTION_STATUS.COMPLETE) {
  return Object.freeze({
    sectionId:   randomUUID(),
    type,
    title,
    status,
    generatedAt: new Date().toISOString(),
    data:        Object.freeze(data || {}),
  });
}

export function buildIdentitySection(apiResponses = {}) {
  const data = extractData(apiResponses.identity);
  if (!data) return makeSection(SECTION_TYPES.IDENTITY_INTELLIGENCE, 'Identity Intelligence™', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.IDENTITY_INTELLIGENCE, 'Identity Intelligence™', {
    artistId:     data.artistId      ?? null,
    artistName:   data.artistName    ?? null,
    verified:     data.verified      ?? false,
    verification: data.verification  ?? {},
    ipi:          data.ipi           ?? null,
    isni:         data.isni          ?? null,
    providers:    data.providers     ?? [],
  });
}

export function buildMusicRightsSection(apiResponses = {}) {
  const data = extractData(apiResponses.musicRights);
  if (!data) return makeSection(SECTION_TYPES.MUSIC_RIGHTS, 'Music Rights™', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.MUSIC_RIGHTS, 'Music Rights™', {
    publisher:    data.publisher    ?? null,
    pro:          data.pro          ?? null,
    iswc:         data.iswc         ?? null,
    compositions: data.compositions ?? [],
    hasRightsData: !!(data.publisher || data.pro),
  });
}

export function buildCatalogSection(apiResponses = {}) {
  const data = extractData(apiResponses.catalog);
  if (!data) return makeSection(SECTION_TYPES.CATALOG, 'Catalog™', {}, SECTION_STATUS.UNAVAILABLE);
  const releases = Array.isArray(data.releases) ? data.releases : [];
  return makeSection(SECTION_TYPES.CATALOG, 'Catalog™', {
    releases,
    releaseCount: releases.length,
    isrcCoverage: data.isrcCoverage ?? null,
    label:        data.label        ?? null,
    hasCatalog:   releases.length > 0,
  });
}

export function buildDistributionSection(apiResponses = {}) {
  const data = extractData(apiResponses.distribution);
  if (!data) return makeSection(SECTION_TYPES.DISTRIBUTION, 'Distribution™', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.DISTRIBUTION, 'Distribution™', {
    distributor:     data.distributor  ?? null,
    dspCoverage:     data.dspCoverage  ?? null,
    platforms:       data.platforms    ?? [],
    hasDistribution: !!(data.distributor),
  });
}

export function buildMonitoringSection(apiResponses = {}) {
  const data = extractData(apiResponses.monitoring);
  if (!data) return makeSection(SECTION_TYPES.MONITORING, 'Monitoring™', {}, SECTION_STATUS.UNAVAILABLE);
  const alerts   = Array.isArray(data.alerts)   ? data.alerts   : [];
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const hasCritical = alerts.some(a => a.severity === 'CRITICAL');
  return makeSection(SECTION_TYPES.MONITORING, 'Monitoring™', {
    changeCount:    data.changeCount ?? 0,
    alerts,
    timeline,
    hasAlerts:      alerts.length > 0,
    criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
  }, hasCritical ? SECTION_STATUS.PARTIAL : SECTION_STATUS.COMPLETE);
}

export function buildSystemOperationsSection(apiResponses = {}) {
  const data = extractData(apiResponses.systemOperations);
  if (!data) return makeSection(SECTION_TYPES.SYSTEM_OPERATIONS, 'System Operations™', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.SYSTEM_OPERATIONS, 'System Operations™', {
    scanId:     data.scanId     ?? null,
    scanStatus: data.scanStatus ?? null,
    complete:   data.scanStatus === 'COMPLETE',
  });
}

export function buildAthenaSection(athenaReport = null) {
  if (!athenaReport) return makeSection(SECTION_TYPES.ATHENA, 'ATHENA™ Intelligence', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.ATHENA, 'ATHENA™ Intelligence', {
    executiveAnalysis:    athenaReport.executiveAnalysis    ?? null,
    riskAnalysis:         athenaReport.riskAnalysis         ?? null,
    opportunityAnalysis:  athenaReport.opportunityAnalysis  ?? null,
    context:              athenaReport.context              ?? null,
    athenaReportId:       athenaReport.athenaReportId       ?? null,
    engineVersion:        athenaReport.engineVersion        ?? null,
  });
}

export function buildRecommendationsSection(executiveRecommendations = null) {
  if (!executiveRecommendations) return makeSection(SECTION_TYPES.RECOMMENDATIONS, 'Executive Recommendations™', {}, SECTION_STATUS.UNAVAILABLE);
  return makeSection(SECTION_TYPES.RECOMMENDATIONS, 'Executive Recommendations™', {
    urgentCount: executiveRecommendations.urgentCount ?? 0,
    highCount:   executiveRecommendations.highCount   ?? 0,
    totalCount:  executiveRecommendations.totalCount  ?? 0,
    topActions:  executiveRecommendations.topActions  ?? [],
    byPriority:  executiveRecommendations.byPriority  ?? {},
  });
}

export function buildAppendixSection(apiResponses = {}, athenaReport = null) {
  const identity = extractData(apiResponses.identity);
  const sysOps   = extractData(apiResponses.systemOperations);
  const providersQueried = Object.keys(apiResponses)
    .filter(k => apiResponses[k]?.status === 'SUCCESS');
  return makeSection(SECTION_TYPES.APPENDIX, 'Appendix™', {
    scanId:           sysOps?.scanId   ?? identity?.scanId   ?? null,
    artistId:         identity?.artistId                     ?? null,
    generatedAt:      new Date().toISOString(),
    athenaVersion:    athenaReport?.engineVersion?.version   ?? null,
    providersQueried: Object.freeze(providersQueried),
    totalProviders:   Object.keys(apiResponses).length,
  });
}

export function buildAllSections(apiResponses = {}, athenaReport = null, executiveRecommendations = null) {
  return Object.freeze([
    buildIdentitySection(apiResponses),
    buildMusicRightsSection(apiResponses),
    buildCatalogSection(apiResponses),
    buildDistributionSection(apiResponses),
    buildMonitoringSection(apiResponses),
    buildSystemOperationsSection(apiResponses),
    buildAthenaSection(athenaReport),
    buildRecommendationsSection(executiveRecommendations),
    buildAppendixSection(apiResponses, athenaReport),
  ]);
}
