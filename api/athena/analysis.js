// Canonical Intelligence Platform(tm) -- ATHENA(tm) Executive Analysis(tm)
// Assembles the top-level executive view from domain intelligence and pre-computed
// risk and opportunity analyses. Never invokes platform engines directly.

import { randomUUID }         from 'node:crypto';
import { ANALYSIS_TYPES }     from './types.js';
import { ATHENA_ENGINE_VERSION } from './version.js';
import { generateDomainInsights } from './insights.js';
import { computeConfidence, computeDomainDataCompleteness } from './confidence.js';

function extractData(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status !== 'SUCCESS') return {};
  return response.data || {};
}

const RISK_LEVEL_ORDER = Object.freeze(
  { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 }
);

function domainStatus(risks, domain) {
  const domainRisks = (risks || []).filter(r => r.affectedDomain === domain);
  if (domainRisks.some(r => r.level === 'CRITICAL'))    return 'CRITICAL';
  if (domainRisks.some(r => r.level === 'HIGH'))         return 'RISK';
  if (domainRisks.some(r => r.level === 'MEDIUM'))       return 'MODERATE';
  if (domainRisks.length > 0)                            return 'LOW_RISK';
  return 'HEALTHY';
}

export function buildBusinessContext(apiResponses = {}) {
  const identityData  = extractData(apiResponses.identity);
  const rightsData    = extractData(apiResponses.musicRights);
  const catalogData   = extractData(apiResponses.catalog);

  const providerCount = identityData.providers
    ? Object.keys(identityData.providers).length
    : 0;

  const coverageSummary = (identityData.coverage !== undefined && identityData.coverage !== null)
    ? `${Math.round(identityData.coverage * 100)}% identity coverage`
    : 'coverage not available from reviewed sources';

  return Object.freeze({
    artistId:       identityData.artistId    || null,
    artistName:     identityData.artistName  || null,
    verified:       identityData.verified    === true,
    providerCount,
    coverageSummary,
    publisherKnown: !!rightsData.publisher,
    proAffiliated:  !!rightsData.pro,
    releaseCount:   catalogData.releaseCount || 0,
  });
}

export function buildHealthSummary(riskAnalysis, opportunityAnalysis) {
  const risks            = riskAnalysis?.risks || [];
  const criticalIssues   = risks.filter(r => r.level === 'CRITICAL').length;
  const highIssues       = risks.filter(r => r.level === 'HIGH').length;
  const totalOpportunities = opportunityAnalysis?.totalOpportunities || 0;

  let overallLevel;
  if (criticalIssues === 0 && highIssues === 0)     overallLevel = 'STRONG';
  else if (criticalIssues === 0 && highIssues <= 2) overallLevel = 'GOOD';
  else if (criticalIssues === 0)                    overallLevel = 'MODERATE';
  else if (criticalIssues <= 2)                     overallLevel = 'WEAK';
  else                                              overallLevel = 'CRITICAL';

  return Object.freeze({
    overallLevel,
    riskScore:    riskAnalysis?.riskScore  || 0,
    riskLevel:    riskAnalysis?.riskLevel  || 'INFORMATIONAL',
    domainStatuses: Object.freeze({
      identity:         domainStatus(risks, 'identity'),
      rights:           domainStatus(risks, 'rights'),
      catalog:          domainStatus(risks, 'catalog'),
      distribution:     domainStatus(risks, 'distribution'),
      monitoring:       domainStatus(risks, 'monitoring'),
      systemOperations: domainStatus(risks, 'system_operations'),
    }),
    criticalIssues,
    highIssues,
    totalOpportunities,
  });
}

export function generateExecutiveAnalysis(apiResponses = {}, riskAnalysis, opportunityAnalysis) {
  const domainInsights  = generateDomainInsights(apiResponses);
  const businessContext = buildBusinessContext(apiResponses);
  const healthSummary   = buildHealthSummary(riskAnalysis, opportunityAnalysis);

  return Object.freeze({
    analysisId:     randomUUID(),
    analysisType:   ANALYSIS_TYPES.EXECUTIVE_ANALYSIS,
    artistId:       businessContext.artistId,
    scanId:         apiResponses.identity?.scanId || null,
    timestamp:      new Date().toISOString(),
    businessContext,
    healthSummary,
    domainInsights: Object.freeze(domainInsights),
    engineVersion:  ATHENA_ENGINE_VERSION,
  });
}
