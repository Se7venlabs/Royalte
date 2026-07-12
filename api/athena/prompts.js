// Canonical Intelligence Platform(tm) -- ATHENA(tm) Conversation Context(tm)
// Maintains structured executive context for ongoing AI advisory sessions.
// Context is immutable — updates produce a new frozen context object.

import { randomUUID }                       from 'node:crypto';
import { RECOMMENDATION_PRIORITIES }         from './types.js';

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) deepFreeze(val);
  }
  return obj;
}

export function createConversationContext({
  currentScan          = null,
  historicalChanges    = [],
  executivePriorities  = [],
  outstandingRisks     = [],
  openOpportunities    = [],
} = {}) {
  const now = new Date().toISOString();
  return deepFreeze({
    contextId:           randomUUID(),
    createdAt:           now,
    updatedAt:           now,
    currentScan:         currentScan || null,
    historicalChanges:   [...(historicalChanges  || [])],
    executivePriorities: [...(executivePriorities || [])],
    outstandingRisks:    [...(outstandingRisks    || [])],
    openOpportunities:   [...(openOpportunities   || [])],
  });
}

// Returns a new frozen context with updated fields. The original is never mutated.
export function updateContext(context, updates = {}) {
  return deepFreeze({
    ...context,
    updatedAt: new Date().toISOString(),
    ...updates,
  });
}

// Derive top executive priorities from the recommendation list.
export function extractExecutivePriorities(recommendations = []) {
  return recommendations
    .filter(r => r.priority === RECOMMENDATION_PRIORITIES.URGENT || r.priority === RECOMMENDATION_PRIORITIES.HIGH)
    .slice(0, 5)
    .map(r => r.recommendedAction);
}

// Build a full ConversationContext™ from the ATHENA analysis pipeline outputs.
export function buildExecutiveContext(riskAnalysis, opportunityAnalysis, recommendations, apiResponses = {}) {
  return createConversationContext({
    currentScan: {
      scanId:    apiResponses.identity?.scanId   || null,
      artistId:  apiResponses.identity?.artistId || null,
      timestamp: new Date().toISOString(),
    },
    historicalChanges:   Array.isArray(apiResponses.monitoring?.data?.timeline)
      ? apiResponses.monitoring.data.timeline
      : [],
    executivePriorities: extractExecutivePriorities(recommendations || []),
    outstandingRisks:    (riskAnalysis?.risks || []).filter(r => r.level === 'CRITICAL' || r.level === 'HIGH'),
    openOpportunities:   (opportunityAnalysis?.opportunities || []).slice(0, 5),
  });
}
