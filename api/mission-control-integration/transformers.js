// Canonical Intelligence Platform™ -- Mission Control™ Workspace Transformers
// Pure functions that extract workspace-specific data from API response envelopes.
// Every transformer is nil-safe: returns an empty structure if data is absent.

function extractData(response) {
  return (response?.status === 'SUCCESS' && response?.data) ? response.data : null;
}

// ─── Single-domain transformers ───────────────────────────────────────────────

export function transformIdentity(apiResponses = {}) {
  const d = extractData(apiResponses.identity);
  if (!d) return null;
  return Object.freeze({
    artistId:     d.artistId      ?? null,
    artistName:   d.artistName    ?? null,
    verified:     d.verified      ?? false,
    verification: d.verification  ?? {},
    ipi:          d.ipi           ?? null,
    isni:         d.isni          ?? null,
    providers:    d.providers     ?? [],
  });
}

export function transformMusicRights(apiResponses = {}) {
  const d = extractData(apiResponses.musicRights);
  if (!d) return null;
  return Object.freeze({
    publisher:     d.publisher    ?? null,
    pro:           d.pro          ?? null,
    iswc:          d.iswc         ?? null,
    compositions:  d.compositions ?? [],
    hasRightsData: !!(d.publisher || d.pro),
  });
}

export function transformCatalog(apiResponses = {}) {
  const d = extractData(apiResponses.catalog);
  if (!d) return null;
  const releases = Array.isArray(d.releases) ? d.releases : [];
  return Object.freeze({
    releases,
    releaseCount: releases.length,
    isrcCoverage: d.isrcCoverage  ?? null,
    label:        d.label         ?? null,
    hasCatalog:   releases.length > 0,
  });
}

export function transformDistribution(apiResponses = {}) {
  const d = extractData(apiResponses.distribution);
  if (!d) return null;
  return Object.freeze({
    distributor:     d.distributor  ?? null,
    dspCoverage:     d.dspCoverage  ?? null,
    platforms:       d.platforms    ?? [],
    hasDistribution: !!(d.distributor),
  });
}

export function transformMonitoring(apiResponses = {}) {
  const d = extractData(apiResponses.monitoring);
  if (!d) return null;
  const alerts   = Array.isArray(d.alerts)   ? d.alerts   : [];
  const timeline = Array.isArray(d.timeline) ? d.timeline : [];
  return Object.freeze({
    changeCount:    d.changeCount ?? 0,
    alerts,
    timeline,
    hasAlerts:      alerts.length > 0,
    criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
    highAlerts:     alerts.filter(a => a.severity === 'HIGH').length,
  });
}

// ─── Multi-domain transformers ─────────────────────────────────────────────────

export function transformBackend(apiResponses = {}) {
  const keys = ['identity', 'musicRights', 'catalog', 'distribution', 'monitoring', 'systemOperations'];
  const statuses = Object.fromEntries(
    keys.map(k => [k, {
      endpointKey: k,
      status:      apiResponses[k]?.status ?? 'NOT_PROVIDED',
      available:   apiResponses[k]?.status === 'SUCCESS',
    }])
  );
  const available = keys.filter(k => statuses[k].available).length;

  const sysOps   = extractData(apiResponses.systemOperations);
  const identity = extractData(apiResponses.identity);
  const mon      = extractData(apiResponses.monitoring);
  const alerts   = Array.isArray(mon?.alerts) ? mon.alerts : [];

  return Object.freeze({
    evidenceCompleteness: Object.freeze(statuses),
    connectorHealth: Object.freeze({
      activeConnectors:  available,
      totalConnectors:   keys.length,
      healthPercentage:  Math.round((available / keys.length) * 100),
    }),
    registryHealth: Object.freeze({
      scanId:     sysOps?.scanId     ?? null,
      scanStatus: sysOps?.scanStatus ?? null,
      complete:   sysOps?.scanStatus === 'COMPLETE',
    }),
    providerAvailability: Object.freeze({
      verified:         identity?.verified          ?? null,
      providerCount:    identity?.verification?.total    ?? null,
      verifiedProviders: identity?.verification?.verified ?? null,
    }),
    monitoringHealth: Object.freeze({
      totalChanges:   mon?.changeCount ?? 0,
      totalAlerts:    alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'CRITICAL').length,
      hasAlerts:      alerts.length > 0,
    }),
    overallStatus: available === keys.length
      ? 'HEALTHY'
      : available > 0 ? 'DEGRADED' : 'UNAVAILABLE',
  });
}

export function transformHealth(apiResponses = {}, athenaReport = null) {
  const identity = extractData(apiResponses.identity);
  const rights   = extractData(apiResponses.musicRights);
  const catalog  = extractData(apiResponses.catalog);
  const dist     = extractData(apiResponses.distribution);
  const mon      = extractData(apiResponses.monitoring);
  const sysOps   = extractData(apiResponses.systemOperations);

  const healthSummary   = athenaReport?.executiveAnalysis?.healthSummary;
  const riskAnalysis    = athenaReport?.riskAnalysis;
  const recommendations = Array.isArray(athenaReport?.recommendations) ? athenaReport.recommendations : [];

  // Domain availability status — from raw API presence
  const domainAvailability = Object.freeze({
    identity:         !!(identity),
    musicRights:      !!(rights),
    catalog:          !!(catalog),
    distribution:     !!(dist),
    monitoring:       !!(mon),
    systemOperations: !!(sysOps),
  });

  return Object.freeze({
    overallHealth:        healthSummary?.overallLevel                       ?? 'UNKNOWN',
    executiveScore:       riskAnalysis?.riskScore != null
                            ? 100 - riskAnalysis.riskScore
                            : null,
    riskScore:            riskAnalysis?.riskScore                           ?? null,
    riskLevel:            riskAnalysis?.riskLevel                           ?? null,
    domainStatuses:       healthSummary?.domainStatuses                     ?? Object.freeze({}),
    domainAvailability,
    criticalRisks:        (riskAnalysis?.risks || []).filter(r => r.level === 'CRITICAL').length,
    highRisks:            (riskAnalysis?.risks || []).filter(r => r.level === 'HIGH').length,
    totalRisks:           riskAnalysis?.risks?.length                       ?? 0,
    urgentRecommendations: recommendations.filter(r => r.priority === 'URGENT').length,
    totalRecommendations: recommendations.length,
    athenaAvailable:      !!(athenaReport),
  });
}

export function transformOverview(apiResponses = {}, athenaReport = null) {
  const overview = extractData(apiResponses.executiveOverview);
  const identity = extractData(apiResponses.identity);
  const healthSummary = athenaReport?.executiveAnalysis?.healthSummary;

  return Object.freeze({
    artistId:          identity?.artistId          ?? overview?.artistId   ?? null,
    artistName:        identity?.artistName        ?? overview?.artistName ?? null,
    overallHealth:     healthSummary?.overallLevel ?? overview?.overallHealth ?? 'UNKNOWN',
    executiveScore:    athenaReport?.riskAnalysis?.riskScore != null
                         ? 100 - athenaReport.riskAnalysis.riskScore
                         : null,
    topPriorities:     athenaReport?.recommendations
                         ?.filter(r => r.priority === 'URGENT' || r.priority === 'HIGH')
                         ?.slice(0, 3)
                         ?.map(r => r.recommendedAction)           ?? [],
    intelligenceSummary: overview?.intelligenceSummary ?? null,
    rawOverview:         overview ?? null,
  });
}

export function transformAthena(athenaReport = null) {
  if (!athenaReport) return null;
  const recs   = Array.isArray(athenaReport.recommendations) ? athenaReport.recommendations : [];
  const risks  = athenaReport.riskAnalysis?.risks             || [];
  const opps   = athenaReport.opportunityAnalysis?.opportunities || [];
  return Object.freeze({
    athenaReportId:      athenaReport.athenaReportId                          ?? null,
    healthSummary:       athenaReport.executiveAnalysis?.healthSummary        ?? null,
    riskScore:           athenaReport.riskAnalysis?.riskScore                 ?? null,
    riskLevel:           athenaReport.riskAnalysis?.riskLevel                 ?? null,
    criticalRisks:       risks.filter(r => r.level === 'CRITICAL'),
    highRisks:           risks.filter(r => r.level === 'HIGH'),
    totalRisks:          risks.length,
    opportunities:       opps,
    totalOpportunities:  opps.length,
    recommendations:     recs,
    urgentCount:         recs.filter(r => r.priority === 'URGENT').length,
    highCount:           recs.filter(r => r.priority === 'HIGH').length,
    totalRecommendations: recs.length,
    confidence:          athenaReport.executiveAnalysis?.engineVersion         ?? null,
    context:             athenaReport.context                                  ?? null,
    engineVersion:       athenaReport.engineVersion                            ?? null,
  });
}

export function transformExecutiveBrief(executiveBrief = null) {
  if (!executiveBrief) return null;
  return Object.freeze({
    briefId:         executiveBrief.briefId         ?? null,
    version:         executiveBrief.version         ?? null,
    generatedAt:     executiveBrief.generatedAt     ?? null,
    summary:         executiveBrief.summary         ?? null,
    sections:        executiveBrief.sections        ?? [],
    sectionCount:    Array.isArray(executiveBrief.sections) ? executiveBrief.sections.length : 0,
    recommendations: executiveBrief.recommendations ?? null,
    metrics:         executiveBrief.metrics         ?? null,
    timeline:        executiveBrief.timeline        ?? null,
    engineVersion:   executiveBrief.engineVersion   ?? null,
  });
}
