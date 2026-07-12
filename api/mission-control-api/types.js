// Canonical Intelligence Platform(tm) -- Mission Control Data API Type Constants

// Public endpoint identifiers — each maps to one Canonical Intelligence Domain or aggregate.
export const API_ENDPOINTS = Object.freeze({
  IDENTITY:           'identity',
  MUSIC_RIGHTS:       'music_rights',
  CATALOG:            'catalog',
  DISTRIBUTION:       'distribution',
  MONITORING:         'monitoring',
  SYSTEM_OPERATIONS:  'system_operations',
  EXECUTIVE_OVERVIEW: 'executive_overview',
});

export const API_VERSIONS = Object.freeze({
  V1: 'v1',
});

export const CURRENT_API_VERSION = 'v1';

export const ENDPOINT_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

export const RESPONSE_STATUSES = Object.freeze({
  SUCCESS:     'SUCCESS',
  NOT_FOUND:   'NOT_FOUND',
  ERROR:       'ERROR',
  UNAVAILABLE: 'UNAVAILABLE',
});

export const API_ERROR_CODES = Object.freeze({
  ENDPOINT_NOT_FOUND:    'ENDPOINT_NOT_FOUND',
  INVALID_REQUEST:       'INVALID_REQUEST',
  SCHEMA_VIOLATION:      'SCHEMA_VIOLATION',
  SERIALIZATION_FAILURE: 'SERIALIZATION_FAILURE',
  VERSION_MISMATCH:      'VERSION_MISMATCH',
  VALIDATION_FAILED:     'VALIDATION_FAILED',
  DUPLICATE_ENDPOINT:    'DUPLICATE_ENDPOINT',
  UNKNOWN_FORMAT:        'UNKNOWN_FORMAT',
});

// Consumers permitted to call the API.
export const CONSUMER_TYPES = Object.freeze({
  MISSION_CONTROL:        'mission_control',
  EXECUTIVE_INTELLIGENCE: 'executive_intelligence',
  ATHENA:                 'athena',
  EXECUTIVE_BRIEF:        'executive_brief',
  MOBILE:                 'mobile',
  PARTNER:                'partner',
  INTERNAL:               'internal',
});

export const SERIALIZATION_FORMATS = Object.freeze({
  JSON: 'json',
});

// Fields required on every registered endpoint definition.
export const REQUIRED_ENDPOINT_FIELDS = Object.freeze([
  'endpointId',
  'version',
  'consumer',
  'responseSchema',
  'status',
]);

// Fields required on every API response envelope.
export const REQUIRED_RESPONSE_FIELDS = Object.freeze([
  'apiVersion',
  'generatedAt',
  'endpoint',
  'status',
  'data',
  'metadata',
]);

export const VALID_API_ENDPOINTS    = new Set(Object.values(API_ENDPOINTS));
export const VALID_API_VERSIONS     = new Set(Object.values(API_VERSIONS));
export const VALID_ENDPOINT_STATUSES = new Set(Object.values(ENDPOINT_STATUSES));
export const VALID_RESPONSE_STATUSES = new Set(Object.values(RESPONSE_STATUSES));
export const VALID_CONSUMER_TYPES   = new Set(Object.values(CONSUMER_TYPES));
export const VALID_FORMATS          = new Set(Object.values(SERIALIZATION_FORMATS));
