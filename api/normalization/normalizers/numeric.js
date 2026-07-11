// Canonical Intelligence Platform(tm) -- Numeric Normalization Rules

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { normalizeInteger, normalizePositiveInteger } from '../transformers.js';

export const NUMERIC_RULES = [
  {
    ruleId:        'NUM-001',
    ruleName:      'Normalize Integer String',
    inputType:     NORMALIZER_INPUT_TYPES.NUMBER,
    outputType:    NORMALIZER_INPUT_TYPES.NUMBER,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.NUMERIC,
    description:   'Convert digit-only strings to native JavaScript integers. Already-numeric values pass through unchanged.',
    example:       { input: '42', output: 42 },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/count/i, /total/i, /rank/i, /popularity/i, /tracks/i],
    normalize:     normalizeInteger,
  },
  {
    ruleId:        'NUM-002',
    ruleName:      'Normalize Positive Integer',
    inputType:     NORMALIZER_INPUT_TYPES.NUMBER,
    outputType:    NORMALIZER_INPUT_TYPES.NULLABLE,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.NUMERIC,
    description:   'Coerce negative integer values to null. Platforms use negative sentinels (e.g. -1) to signal unavailable counts; null is the canonical absent-value representation.',
    example:       { input: -1, output: null },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/followers/i, /listeners/i, /streams/i, /plays/i, /views/i],
    normalize:     normalizePositiveInteger,
  },
];
