// Canonical Intelligence Platform(tm) -- Normalization Engine Type Definitions

// Normalization categories mirror Evidence Contract categories plus cross-cutting concerns.
export const NORMALIZATION_CATEGORIES = Object.freeze({
  IDENTITY:     'IDENTITY',
  RIGHTS:       'RIGHTS',
  CATALOG:      'CATALOG',
  DISTRIBUTION: 'DISTRIBUTION',
  MONITORING:   'MONITORING',
  OPERATIONS:   'OPERATIONS',
  TEXT:         'TEXT',
  IDENTIFIERS:  'IDENTIFIERS',
  URLS:         'URLS',
  DATES:        'DATES',
  NUMERIC:      'NUMERIC',
  BOOLEAN:      'BOOLEAN',
  LOCATION:     'LOCATION',
});

export const RULE_STATUSES = Object.freeze({
  ACTIVE:     'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  RESERVED:   'RESERVED',
});

// Describes what value type a rule targets.
export const NORMALIZER_INPUT_TYPES = Object.freeze({
  STRING:        'STRING',        // any non-null string
  NUMBER:        'NUMBER',        // any number
  BOOLEAN:       'BOOLEAN',       // boolean or boolean-like string
  DATE_STRING:   'DATE_STRING',   // string that represents a date or datetime
  URL:           'URL',           // string that looks like a URL
  ISRC:          'ISRC',          // string that represents an ISRC
  UPC:           'UPC',           // string that represents a UPC/EAN
  COUNTRY_CODE:  'COUNTRY_CODE',  // string representing a country code
  LANGUAGE_CODE: 'LANGUAGE_CODE', // string representing a language code
  NULLABLE:      'NULLABLE',      // any value that may be null or undefined
  ANY:           'ANY',           // applies regardless of value type
});

export const NORMALIZATION_ERROR_CODES = Object.freeze({
  INVALID_INPUT:          'INVALID_INPUT',
  UNKNOWN_RULE:           'UNKNOWN_RULE',
  UNKNOWN_CATEGORY:       'UNKNOWN_CATEGORY',
  INVALID_TRANSFORMER:    'INVALID_TRANSFORMER',
  CIRCULAR_TRANSFORM:     'CIRCULAR_TRANSFORM',
  VALIDATION_FAILED:      'VALIDATION_FAILED',
  RULE_EXECUTION_ERROR:   'RULE_EXECUTION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
});

// Required fields on every registered normalization rule.
export const RULE_REQUIRED_FIELDS = Object.freeze([
  'ruleId',
  'ruleName',
  'inputType',
  'outputType',
  'version',
  'category',
  'description',
  'status',
  'normalize',
]);

// -- O(1) validation sets ----------------------------------------------------

export const VALID_NORMALIZATION_CATEGORIES  = new Set(Object.values(NORMALIZATION_CATEGORIES));
export const VALID_RULE_STATUSES             = new Set(Object.values(RULE_STATUSES));
export const VALID_NORMALIZER_INPUT_TYPES    = new Set(Object.values(NORMALIZER_INPUT_TYPES));
export const VALID_NORMALIZATION_ERROR_CODES = new Set(Object.values(NORMALIZATION_ERROR_CODES));
