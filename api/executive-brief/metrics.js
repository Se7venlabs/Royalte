// Canonical Intelligence Platform™ -- Executive Brief™ Metrics
// Assembles executive metrics from Mission Control Data API™ response envelopes
// and the ATHENA™ report. Never sources data from platform engines directly.

import { randomUUID } from 'node:crypto';

function extractData(response) {
  return (response?.status === 'SUCCESS' && response?.data) ? response.data : {};
}

export function buildExecutiveMetrics(apiResponses = {}, athenaReport = null) {
  const identity   = extractData(apiResponses.identity);
  const rights     = extractData(apiResponses.musicRights);
  const catalog    = extractData(apiResponses.catalog);
  const dist       = extractData(apiResponses.distribution);
  const monitoring = extractData(apiResponses.monitoring);

  const alerts          = Array.isArray(monitoring.alerts)   ? monitoring.alerts   : [];
  const recommendations = Array.isArray(athenaReport?.recommendations) ? athenaReport.recommendations : [];

  return Object.freeze({
    metricsId:   randomUUID(),
    generatedAt: new Date().toISOString(),
    identity: Object.freeze({
      verificationCoverage: identity.verification?.coverage  ?? null,
      providerCount:        identity.verification?.total     ?? null,
      verifiedProviders:    identity.verification?.verified  ?? null,
      hasIpi:               !!(identity.ipi),
      hasIsni:              !!(identity.isni),
    }),
    rights: Object.freeze({
      publisherKnown: !!(rights.publisher),
      proAffiliated:  !!(rights.pro),
      iswcRegistered: !!(rights.iswc),
    }),
    catalog: Object.freeze({
      releaseCount: Array.isArray(catalog.releases) ? catalog.releases.length : 0,
      isrcCoverage: catalog.isrcCoverage ?? null,
      hasLabel:     !!(catalog.label),
    }),
    distribution: Object.freeze({
      hasDistributor: !!(dist.distributor),
      dspCoverage:    dist.dspCoverage ?? null,
      activeStore:    dist.distributor ?? null,
    }),
    monitoring: Object.freeze({
      totalChanges:   monitoring.changeCount ?? 0,
      criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
      highAlerts:     alerts.filter(a => a.severity === 'HIGH').length,
      totalAlerts:    alerts.length,
    }),
    executive: Object.freeze({
      riskScore:             athenaReport?.riskAnalysis?.riskScore                          ?? null,
      riskLevel:             athenaReport?.riskAnalysis?.riskLevel                          ?? null,
      overallHealth:         athenaReport?.executiveAnalysis?.healthSummary?.overallLevel   ?? null,
      executiveScore:        athenaReport?.riskAnalysis?.riskScore != null
                               ? 100 - athenaReport.riskAnalysis.riskScore
                               : null,
      totalRecommendations:  recommendations.length,
      urgentRecommendations: recommendations.filter(r => r.priority === 'URGENT').length,
      highRecommendations:   recommendations.filter(r => r.priority === 'HIGH').length,
    }),
  });
}
