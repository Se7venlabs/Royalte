// Canonical Intelligence Platform(tm) -- ATHENA(tm) Intelligence Engine Type Constants

export const ANALYSIS_TYPES = Object.freeze({
  EXECUTIVE_ANALYSIS:   'executive_analysis',
  RISK_ANALYSIS:        'risk_analysis',
  OPPORTUNITY_ANALYSIS: 'opportunity_analysis',
  RECOMMENDATION:       'recommendation',
});

export const RISK_LEVELS = Object.freeze({
  CRITICAL:      'CRITICAL',
  HIGH:          'HIGH',
  MEDIUM:        'MEDIUM',
  LOW:           'LOW',
  INFORMATIONAL: 'INFORMATIONAL',
});

export const RISK_CATEGORIES = Object.freeze({
  BUSINESS:     'business',
  RIGHTS:       'rights',
  CATALOG:      'catalog',
  DISTRIBUTION: 'distribution',
  MONITORING:   'monitoring',
  OPERATIONAL:  'operational',
});

export const OPPORTUNITY_TYPES = Object.freeze({
  MISSING_REGISTRATION:     'missing_registration',
  METADATA_IMPROVEMENT:     'metadata_improvement',
  DISTRIBUTION_OPPORTUNITY: 'distribution_opportunity',
  CATALOG_ENHANCEMENT:      'catalog_enhancement',
  VERIFICATION_OPPORTUNITY: 'verification_opportunity',
  GROWTH_OPPORTUNITY:       'growth_opportunity',
});

export const RECOMMENDATION_PRIORITIES = Object.freeze({
  URGENT:        'URGENT',
  HIGH:          'HIGH',
  MEDIUM:        'MEDIUM',
  LOW:           'LOW',
  INFORMATIONAL: 'INFORMATIONAL',
});

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH:             'HIGH',
  MEDIUM:           'MEDIUM',
  LOW:              'LOW',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

export const CONTEXT_TYPES = Object.freeze({
  CURRENT_SCAN:         'current_scan',
  HISTORICAL_CHANGES:   'historical_changes',
  EXECUTIVE_PRIORITIES: 'executive_priorities',
  OUTSTANDING_RISKS:    'outstanding_risks',
  OPEN_OPPORTUNITIES:   'open_opportunities',
});

export const ATHENA_ERROR_CODES = Object.freeze({
  INVALID_INPUT:           'INVALID_INPUT',
  SCHEMA_VIOLATION:        'SCHEMA_VIOLATION',
  CONFIDENCE_INSUFFICIENT: 'CONFIDENCE_INSUFFICIENT',
  CONTEXT_MISSING:         'CONTEXT_MISSING',
  VALIDATION_FAILED:       'VALIDATION_FAILED',
  PROMPT_SAFETY_VIOLATION: 'PROMPT_SAFETY_VIOLATION',
});

// Valid sets for runtime checks
export const VALID_RISK_LEVELS          = new Set(Object.values(RISK_LEVELS));
export const VALID_RISK_CATEGORIES      = new Set(Object.values(RISK_CATEGORIES));
export const VALID_OPPORTUNITY_TYPES    = new Set(Object.values(OPPORTUNITY_TYPES));
export const VALID_RECOMMENDATION_PRIORITIES = new Set(Object.values(RECOMMENDATION_PRIORITIES));
export const VALID_CONFIDENCE_LEVELS    = new Set(Object.values(CONFIDENCE_LEVELS));

// Required fields for output objects
export const REQUIRED_RISK_FIELDS = Object.freeze([
  'riskId', 'category', 'level', 'title', 'description',
  'affectedDomain', 'supportingEvidence', 'confidence', 'recommendedAction',
]);

export const REQUIRED_OPPORTUNITY_FIELDS = Object.freeze([
  'opportunityId', 'type', 'title', 'description',
  'affectedDomain', 'potentialImpact', 'confidence', 'recommendedAction', 'priority',
]);

export const REQUIRED_RECOMMENDATION_FIELDS = Object.freeze([
  'recommendationId', 'priority', 'reason', 'supportingEvidence',
  'affectedDomains', 'confidence', 'recommendedAction', 'sourceType',
]);

export const REQUIRED_CONFIDENCE_FIELDS = Object.freeze([
  'level', 'score', 'supportingDomains', 'monitoringEvents', 'executiveMetrics', 'reasoning',
]);

export const REQUIRED_CONTEXT_FIELDS = Object.freeze([
  'contextId', 'createdAt', 'updatedAt',
  'executivePriorities', 'outstandingRisks', 'openOpportunities',
]);
