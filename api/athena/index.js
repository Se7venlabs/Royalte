// Canonical Intelligence Platform(tm) -- ATHENA(tm) Intelligence Engine
// Executive Intelligence Layer. Consumes only through the Mission Control Data API(tm).
// Never determines, modifies, or replaces canonical truth.
//
// CONSTITUTIONAL CONSTRAINT: All platform intelligence must arrive through
// Mission Control Data API(tm) response envelopes (Sprint 9). ATHENA must
// never import from api/monitoring, api/resolution, api/normalization,
// api/orchestrator, api/registry, or api/evidence directly.

import { randomUUID }                    from 'node:crypto';
import { ATHENA_ENGINE_VERSION }          from './version.js';
import { generateExecutiveAnalysis, buildBusinessContext, buildHealthSummary } from './analysis.js';
import { generateRiskAnalysis }           from './risk-analysis.js';
import { generateOpportunityAnalysis }    from './opportunities.js';
import { generateRecommendations, prioritizeRecommendations } from './recommendations.js';
import { createConversationContext, updateContext, extractExecutivePriorities, buildExecutiveContext } from './prompts.js';
import { validateAthenaInput, assertInputValid, assertOutputValid } from './validate.js';
import { computeConfidence, computeDomainDataCompleteness } from './confidence.js';
import { generateDomainInsights }         from './insights.js';

export function createAthenaEngine({ missionControlApi } = {}) {
  function analyze(apiResponses = {}) {
    const riskAnalysis        = generateRiskAnalysis(apiResponses);
    const opportunityAnalysis = generateOpportunityAnalysis(apiResponses);
    const executiveAnalysis   = generateExecutiveAnalysis(apiResponses, riskAnalysis, opportunityAnalysis);
    const recommendations     = generateRecommendations(riskAnalysis, opportunityAnalysis);
    const context             = buildExecutiveContext(riskAnalysis, opportunityAnalysis, recommendations, apiResponses);

    return Object.freeze({
      athenaReportId:    randomUUID(),
      timestamp:         new Date().toISOString(),
      executiveAnalysis,
      riskAnalysis,
      opportunityAnalysis,
      recommendations,
      context,
      engineVersion:     ATHENA_ENGINE_VERSION,
    });
  }

  return Object.freeze({
    // Full pipeline
    analyze,
    // Individual pipeline stages (injectable for testing)
    generateExecutiveAnalysis: (responses, riskA, oppA) => generateExecutiveAnalysis(responses, riskA, oppA),
    generateRiskAnalysis:      (responses) => generateRiskAnalysis(responses),
    generateOpportunityAnalysis: (responses) => generateOpportunityAnalysis(responses),
    generateRecommendations:   (riskA, oppA) => generateRecommendations(riskA, oppA),
    // Context management
    createContext:             (opts) => createConversationContext(opts),
    updateContext:             (ctx, updates) => updateContext(ctx, updates),
    extractPriorities:         (recs) => extractExecutivePriorities(recs),
    // Validation
    validate:                  (responses) => validateAthenaInput(responses),
    // Confidence
    computeConfidence:         (opts) => computeConfidence(opts),
    // Metadata
    engineVersion:             ATHENA_ENGINE_VERSION,
  });
}

export const ATHENA_ENGINE = createAthenaEngine();

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { ATHENA_ENGINE_VERSION }                                        from './version.js';
export {
  ANALYSIS_TYPES, RISK_LEVELS, RISK_CATEGORIES, OPPORTUNITY_TYPES,
  RECOMMENDATION_PRIORITIES, CONFIDENCE_LEVELS, CONTEXT_TYPES, ATHENA_ERROR_CODES,
  VALID_RISK_LEVELS, VALID_RISK_CATEGORIES, VALID_OPPORTUNITY_TYPES,
  VALID_RECOMMENDATION_PRIORITIES, VALID_CONFIDENCE_LEVELS,
  REQUIRED_RISK_FIELDS, REQUIRED_OPPORTUNITY_FIELDS, REQUIRED_RECOMMENDATION_FIELDS,
  REQUIRED_CONFIDENCE_FIELDS, REQUIRED_CONTEXT_FIELDS,
}                                                                       from './types.js';
export { computeConfidence, computeDomainDataCompleteness }             from './confidence.js';
export {
  generateDomainInsights,
  buildIdentityInsights, buildRightsInsights,
  buildCatalogInsights,  buildDistributionInsights, buildMonitoringInsights,
}                                                                       from './insights.js';
export {
  generateRiskAnalysis,
  identifyBusinessRisks, identifyRightsRisks, identifyCatalogRisks,
  identifyDistributionRisks, identifyMonitoringRisks, identifyOperationalRisks,
}                                                                       from './risk-analysis.js';
export {
  generateOpportunityAnalysis,
  identifyRegistrationOpportunities, identifyMetadataOpportunities,
  identifyDistributionOpportunities, identifyCatalogOpportunities,
  identifyVerificationOpportunities, identifyGrowthOpportunities,
}                                                                       from './opportunities.js';
export {
  generateRecommendations, recommendationFromRisk,
  recommendationFromOpportunity, prioritizeRecommendations,
}                                                                       from './recommendations.js';
export { generateExecutiveAnalysis, buildBusinessContext, buildHealthSummary } from './analysis.js';
export {
  createConversationContext, updateContext,
  extractExecutivePriorities, buildExecutiveContext,
}                                                                       from './prompts.js';
export {
  validateAthenaInput, validateAnalysisOutput, validateRisk,
  validateOpportunity, validateRecommendation, validateConfidence,
  validateContext, validatePromptSafety, assertInputValid, assertOutputValid,
}                                                                       from './validate.js';
