// Canonical Intelligence Platform(tm) -- Resolution Engine Type Constants

export const RESOLUTION_CATEGORIES = Object.freeze({
  IDENTITY:     'IDENTITY',
  CATALOG:      'CATALOG',
  IDENTIFIERS:  'IDENTIFIERS',
  RIGHTS:       'RIGHTS',
  DISTRIBUTION: 'DISTRIBUTION',
  MONITORING:   'MONITORING',
  OPERATIONS:   'OPERATIONS',
  URLS:         'URLS',
  DATES:        'DATES',
  NUMERIC:      'NUMERIC',
  BOOLEAN:      'BOOLEAN',
  LOCATION:     'LOCATION',
  DEFAULT:      'DEFAULT',
});

export const RESOLUTION_RULES = Object.freeze({
  POLICY_PRIORITY: 'POLICY_PRIORITY',
  CONSENSUS:       'CONSENSUS',
  FIRST_AVAILABLE: 'FIRST_AVAILABLE',
});

export const CONFLICT_TYPES = Object.freeze({
  ALL_AGREE:        'ALL_AGREE',
  PARTIAL_AGREEMENT:'PARTIAL_AGREEMENT',
  CONFLICT:         'CONFLICT',
  SINGLE_SOURCE:    'SINGLE_SOURCE',
  NO_DATA:          'NO_DATA',
});

export const CONFIDENCE_LEVELS = Object.freeze({
  HIGH:      'HIGH',
  MEDIUM:    'MEDIUM',
  LOW:       'LOW',
  UNCERTAIN: 'UNCERTAIN',
});

export const CONFIDENCE_THRESHOLDS = Object.freeze({
  HIGH:      0.85,
  MEDIUM:    0.65,
  LOW:       0.40,
});

export const POLICY_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

export const RESOLUTION_ERROR_CODES = Object.freeze({
  NO_POLICY_FOUND:       'NO_POLICY_FOUND',
  NO_RECORDS_PROVIDED:   'NO_RECORDS_PROVIDED',
  INVALID_RECORD_SHAPE:  'INVALID_RECORD_SHAPE',
  PIPELINE_FAILURE:      'PIPELINE_FAILURE',
  INVALID_FIELD_NAME:    'INVALID_FIELD_NAME',
  REGISTRY_STARTUP_FAIL: 'REGISTRY_STARTUP_FAIL',
});

export const POLICY_REQUIRED_FIELDS = Object.freeze([
  'policyId',
  'policyName',
  'field',
  'providerOrder',
  'version',
  'category',
  'status',
  'resolutionRule',
]);

export const VALID_RESOLUTION_CATEGORIES = new Set(Object.values(RESOLUTION_CATEGORIES));
export const VALID_POLICY_STATUSES       = new Set(Object.values(POLICY_STATUSES));
export const VALID_RESOLUTION_RULES      = new Set(Object.values(RESOLUTION_RULES));
