// Canonical Intelligence Platform(tm) -- ATHENA(tm) Domain Insights
// Generates executive observations from canonical domain data.
// Never modifies canonical truth; observations are interpretive only.

import { randomUUID }                       from 'node:crypto';
import { computeConfidence, computeDomainDataCompleteness } from './confidence.js';

function extractData(response) {
  if (!response || typeof response !== 'object') return {};
  if (response.status !== 'SUCCESS') return {};
  return response.data || {};
}

function makeInsight(domain, type, title, description, severity, supportingDomains, dataCompleteness) {
  return Object.freeze({
    insightId:      randomUUID(),
    domain,
    type,
    title,
    description,
    severity,
    confidence:     computeConfidence({ supportingDomains, dataCompleteness }),
    supportingData: Object.freeze([...supportingDomains]),
  });
}

export function buildIdentityInsights(identityResponse) {
  const data        = extractData(identityResponse);
  const completeness = computeDomainDataCompleteness(data);
  const domains     = ['identity'];
  const insights    = [];

  if (data.verified === true) {
    insights.push(makeInsight('identity', 'positive',
      'Artist Identity Verified',
      'Artist identity is verified across canonical providers.',
      'LOW', domains, completeness));
  } else {
    insights.push(makeInsight('identity', 'gap',
      'Identity Verification Incomplete',
      'Artist identity has not been fully verified across canonical providers.',
      'HIGH', domains, completeness));
  }

  if (!data.ipi) {
    insights.push(makeInsight('identity', 'gap',
      'IPI Number Not Found',
      'IPI number could not be determined from reviewed sources. This may affect rights tracking.',
      'MEDIUM', domains, completeness));
  }

  if (!data.isni) {
    insights.push(makeInsight('identity', 'gap',
      'ISNI Not Found',
      'ISNI could not be determined from reviewed sources.',
      'LOW', domains, completeness));
  }

  return insights;
}

export function buildRightsInsights(musicRightsResponse) {
  const data        = extractData(musicRightsResponse);
  const completeness = computeDomainDataCompleteness(data);
  const domains     = ['rights'];
  const insights    = [];

  if (!data.publisher) {
    insights.push(makeInsight('rights', 'gap',
      'Publisher Not Registered',
      'No publishing entity could be determined from reviewed sources.',
      'CRITICAL', domains, completeness));
  }

  if (!data.pro) {
    insights.push(makeInsight('rights', 'gap',
      'PRO Affiliation Not Found',
      'Performing Rights Organization affiliation could not be determined from reviewed sources.',
      'CRITICAL', domains, completeness));
  }

  if (!data.iswc) {
    insights.push(makeInsight('rights', 'gap',
      'ISWC Not Found',
      'No ISWC identifier could be determined from reviewed sources.',
      'HIGH', domains, completeness));
  }

  if (data.publisher && data.pro) {
    insights.push(makeInsight('rights', 'positive',
      'Rights Infrastructure Present',
      'Publisher and PRO affiliation are established.',
      'LOW', domains, completeness));
  }

  return insights;
}

export function buildCatalogInsights(catalogResponse) {
  const data        = extractData(catalogResponse);
  const completeness = computeDomainDataCompleteness(data);
  const domains     = ['catalog'];
  const insights    = [];

  if (!data.releaseCount || data.releaseCount === 0) {
    insights.push(makeInsight('catalog', 'gap',
      'No Releases Found',
      'No releases could be determined from reviewed sources.',
      'HIGH', domains, completeness));
  } else {
    insights.push(makeInsight('catalog', 'positive',
      `${data.releaseCount} Release(s) in Catalog`,
      `${data.releaseCount} release(s) detected in the canonical catalog.`,
      'LOW', domains, completeness));
  }

  if (data.isrcCoverage !== undefined && data.isrcCoverage < 0.8) {
    insights.push(makeInsight('catalog', 'gap',
      'ISRC Coverage Below Threshold',
      `ISRC coverage is ${Math.round((data.isrcCoverage || 0) * 100)}%, below the 80% threshold.`,
      'HIGH', domains, completeness));
  }

  return insights;
}

export function buildDistributionInsights(distributionResponse) {
  const data        = extractData(distributionResponse);
  const completeness = computeDomainDataCompleteness(data);
  const domains     = ['distribution'];
  const insights    = [];

  if (!data.distributor) {
    insights.push(makeInsight('distribution', 'gap',
      'Distributor Not Found',
      'Distribution entity could not be determined from reviewed sources.',
      'HIGH', domains, completeness));
  }

  if (data.dspCoverage !== undefined && data.dspCoverage < 0.5) {
    insights.push(makeInsight('distribution', 'gap',
      'Low DSP Coverage',
      `DSP coverage is ${Math.round((data.dspCoverage || 0) * 100)}%, indicating limited distribution reach.`,
      'MEDIUM', domains, completeness));
  }

  if (data.distributor && (data.dspCoverage === undefined || data.dspCoverage >= 0.5)) {
    insights.push(makeInsight('distribution', 'positive',
      'Distribution Active',
      'Distribution is active with acceptable DSP coverage.',
      'LOW', domains, completeness));
  }

  return insights;
}

export function buildMonitoringInsights(monitoringResponse) {
  const data        = extractData(monitoringResponse);
  const completeness = computeDomainDataCompleteness(data);
  const domains     = ['monitoring'];
  const insights    = [];
  const alerts      = data.alerts  || [];
  const timeline    = data.timeline || [];

  const criticalAlerts = alerts.filter(a => a.level === 'CRITICAL');
  const highAlerts     = alerts.filter(a => a.level === 'HIGH');

  if (criticalAlerts.length > 0) {
    insights.push(makeInsight('monitoring', 'alert',
      `${criticalAlerts.length} Critical Change(s) Detected`,
      `${criticalAlerts.length} critical change(s) detected in the monitoring timeline.`,
      'CRITICAL', domains, completeness));
  }

  if (highAlerts.length > 0) {
    insights.push(makeInsight('monitoring', 'alert',
      `${highAlerts.length} High-Severity Change(s) Detected`,
      `${highAlerts.length} high-severity change(s) detected in the monitoring timeline.`,
      'HIGH', domains, completeness));
  }

  if (data.changeCount === 0) {
    insights.push(makeInsight('monitoring', 'positive',
      'No Changes Detected',
      'No changes detected since the last canonical snapshot.',
      'LOW', domains, completeness));
  }

  if (timeline.length > 0 && criticalAlerts.length === 0 && highAlerts.length === 0) {
    insights.push(makeInsight('monitoring', 'positive',
      'Changes Within Normal Range',
      `${timeline.length} event(s) detected, all within normal severity range.`,
      'LOW', domains, completeness));
  }

  return insights;
}

export function generateDomainInsights(apiResponses = {}) {
  const all = [
    ...buildIdentityInsights(apiResponses.identity),
    ...buildRightsInsights(apiResponses.musicRights),
    ...buildCatalogInsights(apiResponses.catalog),
    ...buildDistributionInsights(apiResponses.distribution),
    ...buildMonitoringInsights(apiResponses.monitoring),
  ];
  return Object.freeze(all);
}
