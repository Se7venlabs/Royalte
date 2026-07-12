// Canonical Intelligence Platform(tm) -- ATHENA(tm) Risk Analysis(tm)
// Identifies and classifies business, rights, catalog, distribution, monitoring,
// and operational risks from canonical domain intelligence.
// ATHENA classifies and explains risks; it does not determine canonical facts.

import { randomUUID }         from 'node:crypto';
import { RISK_LEVELS, RISK_CATEGORIES, ANALYSIS_TYPES } from './types.js';
import { computeConfidence, computeDomainDataCompleteness } from './confidence.js';
import { ATHENA_ENGINE_VERSION } from './version.js';

function extractData(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status !== 'SUCCESS') return {};
  return response.data || {};
}

function makeRisk(category, level, title, description, affectedDomain, supportingEvidence, domains, completeness, recommendedAction) {
  return Object.freeze({
    riskId:           randomUUID(),
    category,
    level,
    title,
    description,
    affectedDomain,
    supportingEvidence: Object.freeze([...supportingEvidence]),
    confidence: computeConfidence({ supportingDomains: domains, dataCompleteness: completeness }),
    recommendedAction,
  });
}

// Risk score: weighted sum capped at 100.
const RISK_WEIGHTS = Object.freeze({
  CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFORMATIONAL: 1,
});

function computeRiskScore(risks) {
  return Math.min(
    risks.reduce((sum, r) => sum + (RISK_WEIGHTS[r.level] || 0), 0),
    100
  );
}

function scoreToRiskLevel(score) {
  if (score >= 75) return RISK_LEVELS.CRITICAL;
  if (score >= 50) return RISK_LEVELS.HIGH;
  if (score >= 25) return RISK_LEVELS.MEDIUM;
  if (score >= 10) return RISK_LEVELS.LOW;
  return RISK_LEVELS.INFORMATIONAL;
}

const RISK_LEVEL_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };

export function identifyBusinessRisks(identityResponse) {
  const data        = extractData(identityResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];

  if (!data.artistId) {
    risks.push(makeRisk(
      RISK_CATEGORIES.BUSINESS, RISK_LEVELS.CRITICAL,
      'Artist Identity Not Established',
      'No canonical artist identity could be determined. This blocks all downstream intelligence.',
      'identity', ['No artistId in canonical identity response'], ['identity'], completeness,
      'Establish a canonical artist identity by connecting at least one verified provider.'
    ));
  }

  if (data.artistId && data.verified === false) {
    risks.push(makeRisk(
      RISK_CATEGORIES.BUSINESS, RISK_LEVELS.HIGH,
      'Identity Not Verified',
      'Artist identity has not been verified across canonical providers. Intelligence reliability is reduced.',
      'identity', ['verified: false in canonical identity response'], ['identity'], completeness,
      'Complete identity verification across Apple Music and Spotify.'
    ));
  }

  return risks;
}

export function identifyRightsRisks(musicRightsResponse) {
  const data        = extractData(musicRightsResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];

  if (!data.publisher) {
    risks.push(makeRisk(
      RISK_CATEGORIES.RIGHTS, RISK_LEVELS.CRITICAL,
      'No Publisher on Record',
      'No publishing entity could be determined from reviewed sources. Mechanical and publishing royalties may not be collected.',
      'rights', ['publisher not found in canonical music rights'], ['rights'], completeness,
      'Register with a publishing administrator or establish a self-publishing entity.'
    ));
  }

  if (!data.pro) {
    risks.push(makeRisk(
      RISK_CATEGORIES.RIGHTS, RISK_LEVELS.CRITICAL,
      'No PRO Affiliation',
      'Performing Rights Organization affiliation could not be determined from reviewed sources. Performance royalties may not be collected.',
      'rights', ['pro affiliation not found in canonical music rights'], ['rights'], completeness,
      'Register with ASCAP, BMI, SESAC, or an equivalent international PRO.'
    ));
  }

  if (!data.iswc && (data.publisher || data.writer)) {
    risks.push(makeRisk(
      RISK_CATEGORIES.RIGHTS, RISK_LEVELS.HIGH,
      'ISWC Not Registered',
      'No ISWC identifier found. This can complicate international royalty collection and work tracking.',
      'rights', ['iswc not found in canonical music rights'], ['rights'], completeness,
      'Register all compositions with your PRO to obtain ISWC identifiers.'
    ));
  }

  return risks;
}

export function identifyCatalogRisks(catalogResponse) {
  const data        = extractData(catalogResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];

  if (data.isrcCoverage !== undefined && data.isrcCoverage < 0.8) {
    risks.push(makeRisk(
      RISK_CATEGORIES.CATALOG, RISK_LEVELS.HIGH,
      'ISRC Coverage Below Threshold',
      `ISRC coverage is ${Math.round((data.isrcCoverage || 0) * 100)}%. Releases without ISRCs cannot be tracked for streaming royalties.`,
      'catalog', [`isrcCoverage: ${data.isrcCoverage}`], ['catalog'], completeness,
      'Assign ISRCs to all catalog releases that lack them.'
    ));
  }

  if (!data.label && !data.distributor) {
    risks.push(makeRisk(
      RISK_CATEGORIES.CATALOG, RISK_LEVELS.MEDIUM,
      'No Label or Distributor in Catalog',
      'No label or distributor could be determined from reviewed catalog data.',
      'catalog', ['label and distributor not found in canonical catalog'], ['catalog'], completeness,
      'Establish a distribution relationship for catalog releases.'
    ));
  }

  return risks;
}

export function identifyDistributionRisks(distributionResponse) {
  const data        = extractData(distributionResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];

  if (!data.distributor) {
    risks.push(makeRisk(
      RISK_CATEGORIES.DISTRIBUTION, RISK_LEVELS.CRITICAL,
      'No Active Distributor',
      'No distribution entity could be determined from reviewed sources. Music may not be available on all platforms.',
      'distribution', ['distributor not found in canonical distribution data'], ['distribution'], completeness,
      'Establish a distribution deal with a digital music distributor.'
    ));
  } else if (data.dspCoverage !== undefined && data.dspCoverage < 0.5) {
    risks.push(makeRisk(
      RISK_CATEGORIES.DISTRIBUTION, RISK_LEVELS.HIGH,
      'Low DSP Platform Coverage',
      `Distribution coverage is ${Math.round((data.dspCoverage || 0) * 100)}% of tracked DSPs. Listeners on uncovered platforms cannot access this music.`,
      'distribution', [`dspCoverage: ${data.dspCoverage}`], ['distribution'], completeness,
      'Review distribution agreement to expand coverage to all major DSPs.'
    ));
  }

  return risks;
}

export function identifyMonitoringRisks(monitoringResponse) {
  const data        = extractData(monitoringResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];
  const alerts      = data.alerts || [];

  const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
  const highAlerts     = alerts.filter(a => a.level === 'HIGH');

  if (criticalAlerts.length > 0) {
    risks.push(makeRisk(
      RISK_CATEGORIES.MONITORING, RISK_LEVELS.CRITICAL,
      `${criticalAlerts.length} Critical Canonical Change(s) Detected`,
      `${criticalAlerts.length} critical canonical change(s) were detected since the last snapshot. Immediate review is required.`,
      'monitoring',
      criticalAlerts.map(a => a.title || 'critical alert'),
      ['monitoring'], completeness,
      'Review and verify all critical canonical changes immediately.'
    ));
  }

  if (highAlerts.length > 0) {
    risks.push(makeRisk(
      RISK_CATEGORIES.MONITORING, RISK_LEVELS.HIGH,
      `${highAlerts.length} High-Severity Change(s) Detected`,
      `${highAlerts.length} high-severity canonical change(s) were detected since the last snapshot.`,
      'monitoring',
      highAlerts.map(a => a.title || 'high alert'),
      ['monitoring'], completeness,
      'Review high-severity canonical changes and update records as needed.'
    ));
  }

  return risks;
}

export function identifyOperationalRisks(systemOperationsResponse) {
  const data        = extractData(systemOperationsResponse);
  const completeness = computeDomainDataCompleteness(data);
  const risks       = [];

  if (data.scanStatus && data.scanStatus !== 'complete') {
    risks.push(makeRisk(
      RISK_CATEGORIES.OPERATIONAL, RISK_LEVELS.MEDIUM,
      'Scan Not Complete',
      `System scan status is "${data.scanStatus}". Intelligence may be based on incomplete data.`,
      'system_operations', [`scanStatus: ${data.scanStatus}`], ['system_operations'], completeness,
      'Allow the scan to complete before making decisions based on this intelligence.'
    ));
  }

  return risks;
}

export function generateRiskAnalysis(apiResponses = {}) {
  const allRisks = [
    ...identifyBusinessRisks(apiResponses.identity),
    ...identifyRightsRisks(apiResponses.musicRights),
    ...identifyCatalogRisks(apiResponses.catalog),
    ...identifyDistributionRisks(apiResponses.distribution),
    ...identifyMonitoringRisks(apiResponses.monitoring),
    ...identifyOperationalRisks(apiResponses.systemOperations),
  ];

  const sorted = [...allRisks].sort(
    (a, b) => (RISK_LEVEL_ORDER[a.level] ?? 4) - (RISK_LEVEL_ORDER[b.level] ?? 4)
  );

  const riskScore       = computeRiskScore(sorted);
  const affectedDomains = [...new Set(sorted.map(r => r.affectedDomain))];

  return Object.freeze({
    riskAnalysisId: randomUUID(),
    analysisType:   ANALYSIS_TYPES.RISK_ANALYSIS,
    artistId:       apiResponses.identity?.artistId || null,
    scanId:         apiResponses.identity?.scanId   || null,
    timestamp:      new Date().toISOString(),
    risks:          Object.freeze(sorted),
    riskScore,
    riskLevel:      scoreToRiskLevel(riskScore),
    affectedDomains: Object.freeze(affectedDomains),
    engineVersion:  ATHENA_ENGINE_VERSION.engineId,
  });
}
