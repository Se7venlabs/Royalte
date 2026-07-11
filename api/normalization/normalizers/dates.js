// Canonical Intelligence Platform(tm) -- Date Normalization Rules

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { normalizeIsoDate } from '../transformers.js';

export const DATE_RULES = [
  {
    ruleId:        'DAT-001',
    ruleName:      'Normalize ISO Date',
    inputType:     NORMALIZER_INPUT_TYPES.DATE_STRING,
    outputType:    NORMALIZER_INPUT_TYPES.DATE_STRING,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.DATES,
    description:   'Normalize date strings to ISO 8601 YYYY-MM-DD format. Full datetime strings are truncated to date only. Year-only strings (YYYY) are preserved.',
    example:       { input: '2024-03-15T00:00:00Z', output: '2024-03-15' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/date/i, /releasedate/i, /birthdate/i, /activefrom/i, /activeto/i, /year/i],
    normalize:     normalizeIsoDate,
  },
];
