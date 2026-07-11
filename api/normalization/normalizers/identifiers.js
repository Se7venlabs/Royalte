// Canonical Intelligence Platform(tm) -- Identifier Normalization Rules
//
// IDENTIFIERS category rules standardize music industry identifiers.
// Rules use fieldPatterns to limit application to relevant fields.
// The normalize function is safe to call on non-matching values (pass-through).

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { formatIsrc, formatUpc } from '../transformers.js';

export const IDENTIFIER_RULES = [
  {
    ruleId:        'ID-001',
    ruleName:      'Normalize ISRC Format',
    inputType:     NORMALIZER_INPUT_TYPES.ISRC,
    outputType:    NORMALIZER_INPUT_TYPES.ISRC,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.IDENTIFIERS,
    description:   'Normalize ISRC to canonical hyphenated format CC-XXX-YY-NNNNN (ISO 3901). Strips spaces, adds hyphens, uppercases.',
    example:       { input: 'USRC17607839', output: 'US-RC1-76-07839' },
    status:        RULE_STATUSES.ACTIVE,
    // fieldPatterns limits this rule to fields whose path contains 'isrc'
    fieldPatterns: [/isrc/i],
    normalize:     formatIsrc,
  },
  {
    ruleId:        'ID-002',
    ruleName:      'Normalize UPC Format',
    inputType:     NORMALIZER_INPUT_TYPES.UPC,
    outputType:    NORMALIZER_INPUT_TYPES.UPC,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.IDENTIFIERS,
    description:   'Normalize UPC/EAN to 13-digit EAN-13 format. Left-pads 12-digit UPC-A to 13 digits.',
    example:       { input: '012345678901', output: '0012345678901' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/upc/i, /ean/i, /barcode/i],
    normalize:     formatUpc,
  },
];
