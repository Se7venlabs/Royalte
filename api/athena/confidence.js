// Canonical Intelligence Platform(tm) -- ATHENA(tm) Confidence Model(tm)
// ATHENA confidence is separate from Canonical confidence.
// It measures how well canonical data supports a given ATHENA conclusion.

import { CONFIDENCE_LEVELS } from './types.js';

function scoreToLevel(score) {
  if (score >= 0.75) return CONFIDENCE_LEVELS.HIGH;
  if (score >= 0.50) return CONFIDENCE_LEVELS.MEDIUM;
  if (score >= 0.25) return CONFIDENCE_LEVELS.LOW;
  return CONFIDENCE_LEVELS.INSUFFICIENT_DATA;
}

function buildReasoning(supportingDomains, monitoringEvents, dataCompleteness) {
  const parts = [];
  if (supportingDomains.length > 0) {
    parts.push(`${supportingDomains.length} canonical domain(s) support this conclusion`);
  }
  if (monitoringEvents > 0) {
    parts.push(`${monitoringEvents} monitoring event(s) corroborate`);
  }
  if (dataCompleteness >= 0.8) {
    parts.push('high data completeness');
  } else if (dataCompleteness < 0.4) {
    parts.push('limited data available from reviewed sources');
  }
  return parts.length > 0 ? parts.join('; ') : 'based on available canonical intelligence';
}

// Primary confidence computation.
// Weights: domains 50%, completeness 30%, monitoring 10%, metrics 10%.
export function computeConfidence({
  supportingDomains  = [],
  monitoringEvents   = 0,
  executiveMetrics   = [],
  dataCompleteness   = 0,
} = {}) {
  const domainScore    = Math.min(supportingDomains.length / 4, 1.0) * 0.50;
  const completeness   = Math.min(Math.max(dataCompleteness, 0), 1.0) * 0.30;
  const monitoringBonus = monitoringEvents > 0 ? 0.10 : 0;
  const metricsBonus   = executiveMetrics.length > 0 ? 0.10 : 0;
  const score = Math.min(domainScore + completeness + monitoringBonus + metricsBonus, 1.0);

  return Object.freeze({
    level:             scoreToLevel(score),
    score:             Math.round(score * 100) / 100,
    supportingDomains: Object.freeze([...supportingDomains]),
    monitoringEvents,
    executiveMetrics:  Object.freeze([...executiveMetrics]),
    reasoning:         buildReasoning(supportingDomains, monitoringEvents, dataCompleteness),
  });
}

// Proportion of non-empty values in a data object (0.0–1.0).
export function computeDomainDataCompleteness(data = {}) {
  if (!data || typeof data !== 'object') return 0;
  const values = Object.values(data);
  if (values.length === 0) return 0;
  const present = values.filter(v =>
    v !== null && v !== undefined && v !== '' &&
    !(Array.isArray(v) && v.length === 0) &&
    !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0)
  ).length;
  return Math.round((present / values.length) * 100) / 100;
}
