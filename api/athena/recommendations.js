// Canonical Intelligence Platform(tm) -- ATHENA(tm) Recommendation Engine(tm)
// Produces executive recommendations sourced strictly from Risk Analysis(tm)
// and Opportunity Analysis(tm). Every recommendation includes priority, reason,
// supporting evidence, affected domains, confidence, and recommended action.

import { randomUUID }                  from 'node:crypto';
import { RECOMMENDATION_PRIORITIES, RISK_LEVELS } from './types.js';

const RISK_LEVEL_TO_PRIORITY = Object.freeze({
  [RISK_LEVELS.CRITICAL]:      RECOMMENDATION_PRIORITIES.URGENT,
  [RISK_LEVELS.HIGH]:          RECOMMENDATION_PRIORITIES.HIGH,
  [RISK_LEVELS.MEDIUM]:        RECOMMENDATION_PRIORITIES.MEDIUM,
  [RISK_LEVELS.LOW]:           RECOMMENDATION_PRIORITIES.LOW,
  [RISK_LEVELS.INFORMATIONAL]: RECOMMENDATION_PRIORITIES.INFORMATIONAL,
});

const PRIORITY_ORDER = Object.freeze(
  { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 }
);

export function recommendationFromRisk(risk) {
  return Object.freeze({
    recommendationId: randomUUID(),
    priority:         RISK_LEVEL_TO_PRIORITY[risk.level] || RECOMMENDATION_PRIORITIES.INFORMATIONAL,
    reason:           risk.description,
    supportingEvidence: Object.freeze([...risk.supportingEvidence]),
    affectedDomains:  Object.freeze([risk.affectedDomain]),
    confidence:       risk.confidence,
    recommendedAction: risk.recommendedAction,
    sourceType:       'risk',
    sourceId:         risk.riskId,
  });
}

export function recommendationFromOpportunity(opportunity) {
  return Object.freeze({
    recommendationId: randomUUID(),
    priority:         opportunity.priority,
    reason:           opportunity.description,
    supportingEvidence: Object.freeze([opportunity.affectedDomain]),
    affectedDomains:  Object.freeze([opportunity.affectedDomain]),
    confidence:       opportunity.confidence,
    recommendedAction: opportunity.recommendedAction,
    sourceType:       'opportunity',
    sourceId:         opportunity.opportunityId,
  });
}

export function prioritizeRecommendations(recommendations) {
  return Object.freeze(
    [...recommendations].sort(
      (a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4)
    )
  );
}

export function generateRecommendations(riskAnalysis, opportunityAnalysis) {
  const fromRisks = (riskAnalysis?.risks        || []).map(recommendationFromRisk);
  const fromOpps  = (opportunityAnalysis?.opportunities || []).map(recommendationFromOpportunity);
  return prioritizeRecommendations([...fromRisks, ...fromOpps]);
}
