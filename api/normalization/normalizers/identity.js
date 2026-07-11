// Canonical Intelligence Platform(tm) -- Identity Normalization Rules
//
// IDENTITY category rules apply to artist names, platform artist IDs,
// and other identity-tier fields.
//
// IMPORTANT: These rules standardize representation only.
// They do NOT choose which provider's value is canonical.
// Choosing the canonical artist name belongs to the Resolution Engine.

import { NORMALIZATION_CATEGORIES, RULE_STATUSES, NORMALIZER_INPUT_TYPES } from '../types.js';
import {
  trimWhitespace,
  collapseSpaces,
  normalizeUnicodeNfc,
  normalizeStraightQuotes,
  normalizeApostrophe,
} from '../transformers.js';

// Artist name normalization: trim + collapse + unicode NFC + normalize quotes/apostrophes.
// The order of operations matches the TEXT pipeline but is composed here as a single rule
// for identity fields so the report clearly attributes these changes to IDENTITY.
function normalizeArtistName(value) {
  if (typeof value !== 'string') return value;
  return normalizeApostrophe(
    normalizeStraightQuotes(
      normalizeUnicodeNfc(
        collapseSpaces(
          trimWhitespace(value)
        )
      )
    )
  );
}

function normalizePlatformArtistId(value) {
  if (typeof value !== 'string') return value;
  return trimWhitespace(value);
}

export const IDENTITY_RULES = [
  {
    ruleId:        'IDENT-001',
    ruleName:      'Normalize Artist Name',
    inputType:     NORMALIZER_INPUT_TYPES.STRING,
    outputType:    NORMALIZER_INPUT_TYPES.STRING,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.IDENTITY,
    description:   'Standardize artist name representation: trim whitespace, collapse internal spaces, NFC unicode, normalize quotes and apostrophes. Does NOT alter case — case normalization would lose provider-specific casing that may be evidence.',
    example:       { input: '  The Weeknd  ', output: 'The Weeknd' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/artistname/i, /artisttitle/i, /artistlabel/i, /bandname/i, /creatorname/i],
    normalize:     normalizeArtistName,
  },
  {
    ruleId:        'IDENT-002',
    ruleName:      'Normalize Platform Artist ID',
    inputType:     NORMALIZER_INPUT_TYPES.STRING,
    outputType:    NORMALIZER_INPUT_TYPES.STRING,
    version:       '1.0.0',
    category:      NORMALIZATION_CATEGORIES.IDENTITY,
    description:   'Trim whitespace from platform-issued artist identifiers.',
    example:       { input: '  apple-A001  ', output: 'apple-A001' },
    status:        RULE_STATUSES.ACTIVE,
    fieldPatterns: [/artistid/i, /platformid/i, /providerid/i, /externalid/i],
    normalize:     normalizePlatformArtistId,
  },
];
