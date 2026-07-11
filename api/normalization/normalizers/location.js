// Canonical Intelligence Platform(tm) -- Location Normalization Rules

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { normalizeCountryCode, normalizeLanguageCode } from '../transformers.js';

export const LOCATION_RULES = [
  {
    ruleId:        'LOC-001',
    ruleName:      'Normalize Country Code',
    inputType:     NORMALIZER_INPUT_TYPES.COUNTRY_CODE,
    outputType:    NORMALIZER_INPUT_TYPES.COUNTRY_CODE,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.LOCATION,
    description:   'Normalize country codes to ISO 3166-1 alpha-2 uppercase format (e.g. "us" → "US").',
    example:       { input: 'us', output: 'US' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/country/i, /territory/i, /region/i, /countrycode/i, /territorycode/i],
    normalize:     normalizeCountryCode,
  },
  {
    ruleId:        'LOC-002',
    ruleName:      'Normalize Language Code',
    inputType:     NORMALIZER_INPUT_TYPES.LANGUAGE_CODE,
    outputType:    NORMALIZER_INPUT_TYPES.LANGUAGE_CODE,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.LOCATION,
    description:   'Normalize language codes to ISO 639-1 lowercase format (e.g. "EN" → "en").',
    example:       { input: 'EN', output: 'en' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/language/i, /locale/i, /lang/i, /languagecode/i],
    normalize:     normalizeLanguageCode,
  },
];
