// Canonical Intelligence Platform(tm) -- Boolean Normalization Rules

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { normalizeBoolean } from '../transformers.js';

export const BOOLEAN_RULES = [
  {
    ruleId:        'BOOL-001',
    ruleName:      'Normalize Boolean String',
    inputType:     NORMALIZER_INPUT_TYPES.BOOLEAN,
    outputType:    NORMALIZER_INPUT_TYPES.BOOLEAN,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.BOOLEAN,
    description:   'Convert string representations of boolean values ("true"/"false"/"yes"/"no"/"1"/"0") to native JavaScript booleans. Passes through actual booleans unchanged.',
    example:       { input: 'true', output: true },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/verified/i, /available/i, /active/i, /enabled/i, /published/i, /explicit/i],
    normalize:     normalizeBoolean,
  },
];
