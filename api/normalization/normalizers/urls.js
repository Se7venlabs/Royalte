// Canonical Intelligence Platform(tm) -- URL Normalization Rules

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import { normalizeUrl } from '../transformers.js';

export const URL_RULES = [
  {
    ruleId:        'URL-001',
    ruleName:      'Normalize URL',
    inputType:     NORMALIZER_INPUT_TYPES.URL,
    outputType:    NORMALIZER_INPUT_TYPES.URL,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.URLS,
    description:   'Lowercase URL scheme and host. Remove trailing slashes from bare paths.',
    example:       { input: 'HTTPS://Music.Apple.com/Artist/', output: 'https://music.apple.com/Artist' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/url/i, /uri/i, /link/i, /website/i, /image/i, /artwork/i, /thumbnail/i],
    normalize:     normalizeUrl,
  },
];
