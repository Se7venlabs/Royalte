// Canonical Intelligence Platform(tm) -- Normalization Engine Test Suite
// Sprint 4

import assert from 'node:assert/strict';

import * as _normModuleRef from '../api/normalization/index.js';

import {
  NORMALIZATION_ENGINE,
  NORMALIZATION_ENGINE_VERSION,
  createNormalizedRecord,
  computeNormalizationFingerprint,
  createNormalizationManifest,
  NORMALIZATION_CATEGORIES,
  RULE_STATUSES,
  NORMALIZER_INPUT_TYPES,
  VALID_NORMALIZATION_CATEGORIES,
  VALID_RULE_STATUSES,
  VALID_NORMALIZER_INPUT_TYPES,
  RULE_REQUIRED_FIELDS,
  ALL_RULES,
  TEXT_RULES,
  IDENTITY_RULES,
  IDENTIFIER_RULES,
  URL_RULES,
  DATE_RULES,
  LOCATION_RULES,
  BOOLEAN_RULES,
  NUMERIC_RULES,
  createNormalizationRegistry,
  assertRuleInterface,
  validateRule,
  validateReport,
  normalizeRegistryRecord,
  normalizeEnvelope,
  normalizeParsedEvidence,
  normalizeMany,
} from '../api/normalization/index.js';

// Transformers (direct unit tests on pure functions)
import {
  trimWhitespace, collapseSpaces, normalizeUnicodeNfc,
  normalizeStraightQuotes, normalizeApostrophe, normalizeEmptyString, normalizeUndefined,
  formatIsrc, formatUpc, normalizeUrl, normalizeIsoDate,
  normalizeCountryCode, normalizeLanguageCode, normalizeBoolean,
  normalizeInteger, normalizePositiveInteger,
} from '../api/normalization/transformers.js';

// ============================================================
// Helpers
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  pass  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
    failures.push({ name, message: err.message });
  }
}

const ISO_NOW = new Date().toISOString();

// A minimal valid parsedEvidence object (Sprint 2 shape)
function makeParsedEvidence(overrides = {}) {
  return {
    contractId:       'ArtistIdentityEvidence',
    contractVersion:  '1.0.0',
    provider:         'apple-music',
    providerVersion:  '1.0',
    connectorVersion: '1.0',
    retrievedAt:      ISO_NOW,
    scanId:           'scan-001',
    artistId:         'artist-001',
    confidence:       'HIGH',
    rawReference:     null,
    sourceUrl:        null,
    evidenceStatus:   'FOUND',
    evidence:         {
      artistName: 'Test Artist',
      artistId:   'apple-A001',
    },
    ...overrides,
  };
}

// A minimal valid Sprint 3 registry record
function makeRegistryRecord(parsedEvidenceOverrides = {}) {
  return {
    registryRecordId:   'rec-uuid-001',
    evidenceEnvelopeId: 'env-uuid-001',
    sourceEnvelopeId:   'src-uuid-001',
    envelopeSchemaVersion: '1.0.0',
    contractId:         'ArtistIdentityEvidence',
    contractVersion:    '1.0.0',
    providerId:         'apple-music',
    providerVersion:    '1.0',
    connectorId:        'apple-connector',
    connectorVersion:   '1.0',
    scanId:             'scan-001',
    artistId:           'artist-001',
    evidenceCategory:   'IDENTITY',
    evidenceStatus:     'FOUND',
    evidenceConfidence: 'HIGH',
    retrievedAt:        ISO_NOW,
    envelopedAt:        ISO_NOW,
    registeredAt:       ISO_NOW,
    rawPayload:         { appleId: 'A001', name: 'Test Artist' },
    parsedEvidence:     makeParsedEvidence(parsedEvidenceOverrides),
    validationResult:   { valid: true, errors: [], warnings: [] },
    auditMetadata:      { registeredAt: ISO_NOW, registeredBy: 'royalte-system' },
    recordStatus:       'ACTIVE',
    deduplicationStatus:'UNIQUE',
    rawPayloadHash:     'abc123',
    parsedEvidenceHash: 'def456',
    storageVersion:     '1.0.0',
    eventLog:           [],
  };
}

// ============================================================
// 1. Engine Loader
// ============================================================
console.log('\n-- 1. Engine Loader');

test('NORMALIZATION_ENGINE is exported and frozen', () => {
  assert.ok(NORMALIZATION_ENGINE, 'NORMALIZATION_ENGINE must be exported');
  assert.ok(Object.isFrozen(NORMALIZATION_ENGINE), 'NORMALIZATION_ENGINE must be frozen');
});

test('NORMALIZATION_ENGINE_VERSION contains required fields', () => {
  assert.ok(NORMALIZATION_ENGINE_VERSION.version,       'version required');
  assert.ok(NORMALIZATION_ENGINE_VERSION.name,          'name required');
  assert.ok(NORMALIZATION_ENGINE_VERSION.engineId,      'engineId required');
  assert.ok(NORMALIZATION_ENGINE_VERSION.effectiveDate, 'effectiveDate required');
  assert.equal(NORMALIZATION_ENGINE_VERSION.version, '1.0.0', 'Sprint 4 version is 1.0.0');
});

test('Public API functions are exported', () => {
  assert.equal(typeof normalizeRegistryRecord,  'function');
  assert.equal(typeof normalizeEnvelope,         'function');
  assert.equal(typeof normalizeParsedEvidence,   'function');
  assert.equal(typeof normalizeMany,             'function');
  assert.equal(typeof createNormalizationRegistry, 'function');
});

// ============================================================
// 2. Type Constants
// ============================================================
console.log('\n-- 2. Type Constants');

test('NORMALIZATION_CATEGORIES contains expected values', () => {
  const expected = ['IDENTITY','RIGHTS','CATALOG','DISTRIBUTION','MONITORING',
                    'OPERATIONS','TEXT','IDENTIFIERS','URLS','DATES','NUMERIC','BOOLEAN','LOCATION'];
  for (const cat of expected) {
    assert.equal(NORMALIZATION_CATEGORIES[cat], cat, `${cat} must be present`);
  }
});

test('RULE_STATUSES contains ACTIVE, DEPRECATED, RESERVED', () => {
  assert.equal(RULE_STATUSES.ACTIVE,     'ACTIVE');
  assert.equal(RULE_STATUSES.DEPRECATED, 'DEPRECATED');
  assert.equal(RULE_STATUSES.RESERVED,   'RESERVED');
});

test('Validation sets are populated', () => {
  assert.ok(VALID_NORMALIZATION_CATEGORIES.size > 0, 'VALID_NORMALIZATION_CATEGORIES non-empty');
  assert.ok(VALID_RULE_STATUSES.size > 0,            'VALID_RULE_STATUSES non-empty');
  assert.ok(VALID_NORMALIZER_INPUT_TYPES.size > 0,   'VALID_NORMALIZER_INPUT_TYPES non-empty');
});

test('RULE_REQUIRED_FIELDS is complete', () => {
  for (const f of ['ruleId','ruleName','inputType','outputType','version','category','description','status','normalize']) {
    assert.ok(RULE_REQUIRED_FIELDS.includes(f), `${f} must be in RULE_REQUIRED_FIELDS`);
  }
});

// ============================================================
// 3. Normalization Registry
// ============================================================
console.log('\n-- 3. Normalization Registry');

test('ALL_RULES has at least 15 registered rules', () => {
  assert.ok(ALL_RULES.length >= 15, `Expected >= 15 rules, got ${ALL_RULES.length}`);
});

test('Default registry has all rules registered', () => {
  const reg = NORMALIZATION_ENGINE.registry;
  assert.ok(reg.size() >= ALL_RULES.length, 'Registry size must match ALL_RULES count');
});

test('createNormalizationRegistry produces an empty registry', () => {
  const reg = createNormalizationRegistry();
  assert.equal(reg.size(), 0);
});

test('Registry.register + getRule round-trip works', () => {
  const reg = createNormalizationRegistry();
  const rule = {
    ruleId:      'TEST-001',
    ruleName:    'Test Rule',
    inputType:   NORMALIZER_INPUT_TYPES.STRING,
    outputType:  NORMALIZER_INPUT_TYPES.STRING,
    version:     '1.0.0',
    category:    NORMALIZATION_CATEGORIES.TEXT,
    description: 'Test rule',
    example:     { input: 'hello', output: 'hello' },
    status:      RULE_STATUSES.ACTIVE,
    normalize:   (v) => v,
  };
  reg.register(rule);
  const retrieved = reg.getRule('TEST-001');
  assert.equal(retrieved.ruleId, 'TEST-001');
  assert.ok(Object.isFrozen(retrieved), 'Registered rule must be frozen');
});

test('Re-registering the same ruleId throws', () => {
  const reg = createNormalizationRegistry();
  const rule = {
    ruleId: 'DUP-001', ruleName: 'Dup', inputType: NORMALIZER_INPUT_TYPES.STRING,
    outputType: NORMALIZER_INPUT_TYPES.STRING, version: '1.0.0',
    category: NORMALIZATION_CATEGORIES.TEXT, description: 'dup',
    status: RULE_STATUSES.ACTIVE, normalize: (v) => v,
  };
  reg.register(rule);
  assert.throws(() => reg.register(rule), /already registered/);
});

test('getRulesByCategory returns only rules in that category', () => {
  const rules = NORMALIZATION_ENGINE.registry.getRulesByCategory(NORMALIZATION_CATEGORIES.TEXT);
  assert.ok(rules.length > 0, 'TEXT category must have rules');
  for (const r of rules) {
    assert.equal(r.category, NORMALIZATION_CATEGORIES.TEXT);
  }
});

test('listActiveRules returns only ACTIVE rules', () => {
  const reg = NORMALIZATION_ENGINE.registry;
  const active = reg.listActiveRules();
  for (const r of active) {
    assert.equal(r.status, RULE_STATUSES.ACTIVE);
  }
});

// ============================================================
// 4. Rule Validation
// ============================================================
console.log('\n-- 4. Rule Validation');

test('validateRule accepts a valid rule', () => {
  const rule = {
    ruleId: 'V-001', ruleName: 'V', inputType: NORMALIZER_INPUT_TYPES.STRING,
    outputType: NORMALIZER_INPUT_TYPES.STRING, version: '1.0.0',
    category: NORMALIZATION_CATEGORIES.TEXT, description: 'v',
    status: RULE_STATUSES.ACTIVE, normalize: (v) => v,
  };
  const result = validateRule(rule);
  assert.ok(result.valid, `Expected valid, got errors: ${result.errors.join(', ')}`);
});

test('validateRule rejects unknown category', () => {
  const rule = {
    ruleId: 'V-002', ruleName: 'V', inputType: NORMALIZER_INPUT_TYPES.STRING,
    outputType: NORMALIZER_INPUT_TYPES.STRING, version: '1.0.0',
    category: 'UNKNOWN_CATEGORY', description: 'v',
    status: RULE_STATUSES.ACTIVE, normalize: (v) => v,
  };
  const result = validateRule(rule);
  assert.ok(!result.valid);
  assert.ok(result.errors.some(e => e.includes('category')));
});

test('assertRuleInterface detects circular transformation', () => {
  const rule = {
    ruleId: 'CIRC-001', ruleName: 'Circular', inputType: NORMALIZER_INPUT_TYPES.STRING,
    outputType: NORMALIZER_INPUT_TYPES.STRING, version: '1.0.0',
    category: NORMALIZATION_CATEGORIES.TEXT, description: 'circular',
    status: RULE_STATUSES.ACTIVE,
    example: { input: 'x', output: 'xz' },
    // Appends 'z' each time — not idempotent
    normalize: (v) => typeof v === 'string' ? v + 'z' : v,
  };
  assert.throws(() => assertRuleInterface(rule), /circular/i);
});

test('All ALL_RULES pass assertRuleInterface', () => {
  for (const rule of ALL_RULES) {
    assert.doesNotThrow(() => assertRuleInterface(rule), `Rule ${rule.ruleId} failed assertRuleInterface`);
  }
});

// ============================================================
// 5. Text Normalizers (transformer unit tests)
// ============================================================
console.log('\n-- 5. Text Normalizers');

test('trimWhitespace removes leading and trailing spaces', () => {
  assert.equal(trimWhitespace('  hello  '), 'hello');
  assert.equal(trimWhitespace('hello'),     'hello');
  assert.equal(trimWhitespace(42),          42);          // non-string pass-through
});

test('collapseSpaces collapses internal whitespace runs', () => {
  assert.equal(collapseSpaces('The  Weeknd'),   'The Weeknd');
  assert.equal(collapseSpaces('a\t\nb'),        'a b');
  assert.equal(collapseSpaces('single'),        'single');
});

test('normalizeUnicodeNfc normalizes to NFC form', () => {
  // U+00E9 (precomposed é) vs U+0065 + U+0301 (decomposed e + combining accent)
  const decomposed = 'é';
  const composed   = 'é';
  assert.equal(decomposed.length, 2);
  assert.equal(normalizeUnicodeNfc(decomposed).length, 1);
  assert.equal(normalizeUnicodeNfc(decomposed), composed);
});

test('normalizeStraightQuotes replaces curly quotes', () => {
  assert.equal(normalizeStraightQuotes('“Hello”'), '"Hello"');
  assert.equal(normalizeStraightQuotes('‘World’'), "'World'");
});

test('normalizeApostrophe replaces typographic apostrophes', () => {
  assert.equal(normalizeApostrophe("it’s"), "it's");
});

test('normalizeEmptyString converts blank strings to null', () => {
  assert.equal(normalizeEmptyString('   '), null);
  assert.equal(normalizeEmptyString(''),    null);
  assert.equal(normalizeEmptyString('hi'),  'hi');
  assert.equal(normalizeEmptyString(null),  null);
});

test('normalizeUndefined converts undefined to null', () => {
  assert.equal(normalizeUndefined(undefined), null);
  assert.equal(normalizeUndefined(null),       null);
  assert.equal(normalizeUndefined('hello'),    'hello');
  assert.equal(normalizeUndefined(0),          0);
});

// ============================================================
// 6. Identifier Normalizers
// ============================================================
console.log('\n-- 6. Identifier Normalizers');

test('formatIsrc formats ISRC with hyphens', () => {
  assert.equal(formatIsrc('USRC17607839'), 'US-RC1-76-07839');
  assert.equal(formatIsrc('US-RC1-76-07839'), 'US-RC1-76-07839'); // already formatted
});

test('formatIsrc returns original for invalid ISRC', () => {
  assert.equal(formatIsrc('TOOSHORT'), 'TOOSHORT');
  assert.equal(formatIsrc(42), 42);
});

test('formatUpc pads 12-digit UPC to 13 digits', () => {
  assert.equal(formatUpc('012345678901'), '0012345678901');
  assert.equal(formatUpc('0012345678901'), '0012345678901'); // already 13
});

test('formatUpc returns original for non-digit strings', () => {
  assert.equal(formatUpc('NOTAUPC'), 'NOTAUPC');
  assert.equal(formatUpc(42), 42);
});

// ============================================================
// 7. URL Normalizers
// ============================================================
console.log('\n-- 7. URL Normalizers');

test('normalizeUrl lowercases scheme and host', () => {
  assert.equal(
    normalizeUrl('HTTPS://Music.Apple.Com/Artist'),
    'https://music.apple.com/Artist'
  );
});

test('normalizeUrl strips trailing slash from bare path', () => {
  assert.equal(
    normalizeUrl('https://music.apple.com/'),
    'https://music.apple.com/'  // trailing slash on root is kept by URL parser
  );
  assert.equal(
    normalizeUrl('https://music.apple.com/artists/'),
    'https://music.apple.com/artists'
  );
});

test('normalizeUrl returns original for invalid URLs', () => {
  assert.equal(normalizeUrl('not-a-url'), 'not-a-url');
  assert.equal(normalizeUrl(null),        null);
});

// ============================================================
// 8. Date Normalizers
// ============================================================
console.log('\n-- 8. Date Normalizers');

test('normalizeIsoDate truncates full datetime to date', () => {
  assert.equal(normalizeIsoDate('2024-03-15T00:00:00.000Z'), '2024-03-15');
  assert.equal(normalizeIsoDate('2024-03-15'), '2024-03-15');
  assert.equal(normalizeIsoDate('2024'), '2024');
});

test('normalizeIsoDate returns original for unparseable strings', () => {
  assert.equal(normalizeIsoDate('not-a-date'), 'not-a-date');
  assert.equal(normalizeIsoDate(42), 42);
});

// ============================================================
// 9. Location Normalizers
// ============================================================
console.log('\n-- 9. Location Normalizers');

test('normalizeCountryCode uppercases valid 2-letter codes', () => {
  assert.equal(normalizeCountryCode('us'), 'US');
  assert.equal(normalizeCountryCode('gb'), 'GB');
  assert.equal(normalizeCountryCode('US'), 'US');
});

test('normalizeCountryCode returns original for invalid codes', () => {
  assert.equal(normalizeCountryCode('USA'),   'USA');   // 3 chars
  assert.equal(normalizeCountryCode('12'),    '12');    // digits
  assert.equal(normalizeCountryCode(null),    null);
});

test('normalizeLanguageCode lowercases valid 2-letter codes', () => {
  assert.equal(normalizeLanguageCode('EN'), 'en');
  assert.equal(normalizeLanguageCode('FR'), 'fr');
  assert.equal(normalizeLanguageCode('en'), 'en');
});

test('normalizeLanguageCode returns original for invalid codes', () => {
  assert.equal(normalizeLanguageCode('eng'), 'eng'); // 3 chars
  assert.equal(normalizeLanguageCode(null),  null);
});

// ============================================================
// 10. Boolean Normalizers
// ============================================================
console.log('\n-- 10. Boolean Normalizers');

test('normalizeBoolean converts string representations to booleans', () => {
  assert.equal(normalizeBoolean('true'),  true);
  assert.equal(normalizeBoolean('false'), false);
  assert.equal(normalizeBoolean('yes'),   true);
  assert.equal(normalizeBoolean('no'),    false);
  assert.equal(normalizeBoolean('1'),     true);
  assert.equal(normalizeBoolean('0'),     false);
  assert.equal(normalizeBoolean('TRUE'),  true);
});

test('normalizeBoolean passes through actual booleans', () => {
  assert.equal(normalizeBoolean(true),  true);
  assert.equal(normalizeBoolean(false), false);
});

test('normalizeBoolean returns original for unrecognized strings', () => {
  assert.equal(normalizeBoolean('maybe'), 'maybe');
  assert.equal(normalizeBoolean(null),    null);
});

// ============================================================
// 11. Numeric Normalizers
// ============================================================
console.log('\n-- 11. Numeric Normalizers');

test('normalizeInteger converts digit strings to numbers', () => {
  assert.equal(normalizeInteger('42'), 42);
  assert.equal(normalizeInteger(42),   42);
  assert.equal(normalizeInteger('0'),  0);
});

test('normalizeInteger returns original for non-digit strings', () => {
  assert.equal(normalizeInteger('abc'), 'abc');
  assert.equal(normalizeInteger('3.14'), '3.14');
});

test('normalizePositiveInteger converts negative to null', () => {
  assert.equal(normalizePositiveInteger(-1),  null);
  assert.equal(normalizePositiveInteger(0),   0);
  assert.equal(normalizePositiveInteger(100), 100);
});

// ============================================================
// 12. Normalization Report
// ============================================================
console.log('\n-- 12. Normalization Report');

test('normalizeRegistryRecord returns a report', () => {
  const result = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(result.report, 'report must be present');
  assert.ok(result.report.reportId, 'reportId required');
  assert.ok(result.report.normalizedAt, 'normalizedAt required');
  assert.equal(result.report.engineVersion, NORMALIZATION_ENGINE_VERSION.version);
});

test('Report contains required fields', () => {
  const { report } = normalizeRegistryRecord(makeRegistryRecord());
  const result = validateReport(report);
  assert.ok(result.valid, `Report validation failed: ${result.errors.join(', ')}`);
});

test('Report.rulesApplied records transformations', () => {
  const pe = makeParsedEvidence({ evidence: { artistName: '  The Weeknd  ' } });
  const { report } = normalizeParsedEvidence(pe);
  assert.ok(Array.isArray(report.rulesApplied), 'rulesApplied must be an array');
  // TXT-001 (trim) should have fired on artistName
  const trimEntry = report.rulesApplied.find(e => e.ruleId === 'TXT-001');
  assert.ok(trimEntry, 'TXT-001 trim rule should have applied to artistName');
  assert.equal(trimEntry.inputValue,  '  The Weeknd  ');
  assert.equal(trimEntry.outputValue, 'The Weeknd');
});

test('Report.success is true when no errors', () => {
  const { report } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(report.success, true);
  assert.equal(report.errors.length, 0);
});

test('Report is frozen', () => {
  const { report } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(Object.isFrozen(report), 'Report must be frozen');
  assert.ok(Object.isFrozen(report.rulesApplied), 'rulesApplied must be frozen');
});

// ============================================================
// 13. Pipeline — end-to-end normalization
// ============================================================
console.log('\n-- 13. Pipeline');

test('Valid registry record is normalized successfully', () => {
  const { success, normalizedEvidence } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(success, 'Normalization must succeed');
  assert.ok(normalizedEvidence, 'normalizedEvidence must be present');
});

test('Artist name whitespace is normalized in evidence sub-object', () => {
  const record = makeRegistryRecord({ evidence: { artistName: '  The Weeknd  ' } });
  const { normalizedEvidence } = normalizeRegistryRecord(record);
  assert.equal(normalizedEvidence.evidence.artistName, 'The Weeknd');
});

test('URL in sourceUrl is normalized', () => {
  const pe = makeParsedEvidence({ sourceUrl: 'HTTPS://Music.Apple.com/Artist/' });
  const { normalizedEvidence } = normalizeParsedEvidence(pe);
  assert.equal(normalizedEvidence.sourceUrl, 'https://music.apple.com/Artist');
});

test('Country code in evidence is uppercased', () => {
  const pe = makeParsedEvidence({ evidence: { country: 'us' } });
  const { normalizedEvidence } = normalizeParsedEvidence(pe);
  assert.equal(normalizedEvidence.evidence.country, 'US');
});

test('Language code in evidence is lowercased', () => {
  const pe = makeParsedEvidence({ evidence: { language: 'EN' } });
  const { normalizedEvidence } = normalizeParsedEvidence(pe);
  assert.equal(normalizedEvidence.evidence.language, 'en');
});

test('ISRC field is formatted with hyphens', () => {
  const pe = makeParsedEvidence({ evidence: { isrc: 'USRC17607839' } });
  const { normalizedEvidence } = normalizeParsedEvidence(pe);
  assert.equal(normalizedEvidence.evidence.isrc, 'US-RC1-76-07839');
});

test('Empty string in evidence is converted to null', () => {
  const pe = makeParsedEvidence({ evidence: { genre: '   ' } });
  const { normalizedEvidence } = normalizeParsedEvidence(pe);
  assert.equal(normalizedEvidence.evidence.genre, null);
});

test('Null envelope input returns failure result', () => {
  const result = normalizeRegistryRecord(null);
  assert.equal(result.success, false);
  assert.equal(result.normalizedEvidence, null);
  assert.ok(result.report.errors.length > 0);
});

test('normalizeEnvelope normalizes a Sprint 2 envelope', () => {
  const envelope = {
    envelopeId:     'env-001',
    parsedEvidence: makeParsedEvidence({ evidence: { artistName: '  Taylor  ' } }),
  };
  const { success, normalizedEvidence } = normalizeEnvelope(envelope);
  assert.ok(success);
  assert.equal(normalizedEvidence.evidence.artistName, 'Taylor');
});

test('normalizeMany normalizes an array of records', () => {
  const records = [makeRegistryRecord(), makeRegistryRecord()];
  const { results } = normalizeMany(records);
  assert.equal(results.length, 2);
  for (const r of results) {
    assert.ok(r.success);
    assert.ok(r.normalizedEvidence);
  }
});

// ============================================================
// 14. Immutability — registry records are never mutated
// ============================================================
console.log('\n-- 14. Immutability');

test('Input parsedEvidence is not mutated by the pipeline', () => {
  const pe = makeParsedEvidence({ evidence: { artistName: '  Original  ' } });
  const originalName = pe.evidence.artistName;
  normalizeParsedEvidence(pe);
  assert.equal(pe.evidence.artistName, originalName, 'parsedEvidence must not be mutated');
});

test('Input registry record is not mutated by the pipeline', () => {
  const record = makeRegistryRecord({ evidence: { artistName: '  Original  ' } });
  const originalName = record.parsedEvidence.evidence.artistName;
  normalizeRegistryRecord(record);
  assert.equal(record.parsedEvidence.evidence.artistName, originalName, 'Registry record must not be mutated');
});

test('normalizedEvidence is frozen', () => {
  const { normalizedEvidence } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(Object.isFrozen(normalizedEvidence), 'normalizedEvidence must be frozen');
});

test('Frozen registry records can still be normalized without error', () => {
  const record = Object.freeze(makeRegistryRecord());
  const { success } = normalizeRegistryRecord(record);
  assert.ok(success, 'Frozen input must normalize without error');
});

// ============================================================
// 15. Determinism
// ============================================================
console.log('\n-- 15. Determinism');

test('Same input produces identical output on repeated calls', () => {
  const pe = makeParsedEvidence({ evidence: { artistName: '  The Weeknd  ' } });
  const r1 = normalizeParsedEvidence(pe);
  const r2 = normalizeParsedEvidence(pe);
  assert.equal(
    r1.normalizedEvidence.evidence.artistName,
    r2.normalizedEvidence.evidence.artistName,
    'Output must be identical across runs'
  );
  assert.equal(
    r1.report.rulesApplied.length,
    r2.report.rulesApplied.length,
    'Rule counts must be identical'
  );
});

test('Pipeline is stateless: two isolate engines produce same output', () => {
  const pe = makeParsedEvidence({ evidence: { artistName: '  test  ' } });
  const a = normalizeParsedEvidence(pe);
  const b = normalizeParsedEvidence(pe);
  assert.equal(a.normalizedEvidence.evidence.artistName, b.normalizedEvidence.evidence.artistName,
    'Repeated calls must produce identical output');
});

// ============================================================
// 16. Replay Compatibility
// ============================================================
console.log('\n-- 16. Replay Compatibility');

test('Normalizing the same record twice produces the same result', () => {
  const record = makeRegistryRecord({ evidence: { artistName: '  The Weeknd  ', isrc: 'USRC17607839' } });
  const run1 = normalizeRegistryRecord(record);
  const run2 = normalizeRegistryRecord(record);
  assert.deepEqual(
    run1.normalizedEvidence.evidence,
    run2.normalizedEvidence.evidence,
    'Repeated normalization must be idempotent'
  );
});

test('Normalizing already-normalized output is idempotent', () => {
  const pe = makeParsedEvidence({ evidence: { artistName: '  The Weeknd  ', country: 'us' } });
  const run1 = normalizeParsedEvidence(pe);
  // Feed the already-normalized evidence back in as a new parsedEvidence
  const pe2 = { ...run1.normalizedEvidence };
  const run2 = normalizeParsedEvidence(pe2);
  assert.equal(
    run2.normalizedEvidence.evidence.artistName,
    run1.normalizedEvidence.evidence.artistName,
    'Second pass must not alter already-normalized output'
  );
  assert.equal(
    run2.normalizedEvidence.evidence.country,
    run1.normalizedEvidence.evidence.country
  );
});

// ============================================================
// 17. Versioning
// ============================================================
console.log('\n-- 17. Versioning');

test('Every rule has a version field', () => {
  for (const rule of ALL_RULES) {
    assert.ok(rule.version, `Rule ${rule.ruleId} must have a version`);
    assert.match(rule.version, /^\d+\.\d+\.\d+$/, `Rule ${rule.ruleId} version must be semver`);
  }
});

test('Every normalizer set exports the expected rules', () => {
  assert.ok(TEXT_RULES.length >= 5,       'TEXT_RULES must have >= 5 rules');
  assert.ok(IDENTIFIER_RULES.length >= 2, 'IDENTIFIER_RULES must have >= 2 rules');
  assert.ok(URL_RULES.length >= 1,        'URL_RULES must have >= 1 rule');
  assert.ok(DATE_RULES.length >= 1,       'DATE_RULES must have >= 1 rule');
  assert.ok(LOCATION_RULES.length >= 2,   'LOCATION_RULES must have >= 2 rules');
  assert.ok(BOOLEAN_RULES.length >= 1,    'BOOLEAN_RULES must have >= 1 rule');
  assert.ok(NUMERIC_RULES.length >= 1,    'NUMERIC_RULES must have >= 1 rule');
  assert.ok(IDENTITY_RULES.length >= 1,   'IDENTITY_RULES must have >= 1 rule');
});

test('Engine version is in the report', () => {
  const { report } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(report.engineVersion, NORMALIZATION_ENGINE_VERSION.version);
});

// ============================================================
// 18. Constitutional Boundaries
// ============================================================
console.log('\n-- 18. Constitutional Boundaries');

test('No canonical field selection exported from normalization engine', () => {
  // Verify via the statically-imported module bindings at top of file.
  // These names must not exist as named exports.
  const prohibited = ['resolveCanonical','chooseProvider','selectBest','rankProviders',
                      'determineCanonical','pickWinner','resolveConflict','selectCanonical',
                      'rankByConfidence'];
  for (const name of prohibited) {
    // If the name had been exported and imported, it would be defined in scope.
    // Since we only import known names, we verify they are absent from the module
    // by checking the imported namespace directly.
    assert.equal(typeof _normModuleRef[name], 'undefined',
      `${name} must not be exported from normalization engine`);
  }
});

test('No conflict resolution logic exported from normalization engine', () => {
  assert.equal(typeof _normModuleRef.resolveConflict,  'undefined');
  assert.equal(typeof _normModuleRef.selectCanonical,  'undefined');
  assert.equal(typeof _normModuleRef.rankByConfidence, 'undefined');
});

test('normalizeRegistryRecord does not return a canonical provider selection', () => {
  const result = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(result.normalizedEvidence, 'normalizedEvidence must exist');
  // The output must contain the provider field unchanged — the engine does not pick a winner
  assert.equal(result.normalizedEvidence.provider, 'apple-music',
    'Provider field must be preserved, not resolved');
});

// ============================================================
// 19. Normalized Record™ — Enhancement 1
// ============================================================
console.log('\n-- 19. Normalized Record(tm)');

test('normalizeRegistryRecord returns a normalizedRecord', () => {
  const { normalizedRecord } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(normalizedRecord, 'normalizedRecord must be present');
  assert.ok(Object.isFrozen(normalizedRecord), 'normalizedRecord must be frozen');
});

test('Normalized Record has required fields', () => {
  const { normalizedRecord } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(normalizedRecord.normalizedRecordId,      'normalizedRecordId required');
  assert.ok(normalizedRecord.normalizationManifestId, 'normalizationManifestId required');
  assert.ok(normalizedRecord.normalizedEvidence,      'normalizedEvidence required');
  assert.ok(normalizedRecord.normalizationFingerprint,'normalizationFingerprint required');
  assert.ok(normalizedRecord.engineVersion,           'engineVersion required');
  assert.ok(normalizedRecord.ruleVersions,            'ruleVersions required');
  assert.ok(normalizedRecord.createdAt,               'createdAt required');
});

test('normalizedRecordId is a UUID v4', () => {
  const { normalizedRecord } = normalizeRegistryRecord(makeRegistryRecord());
  assert.match(
    normalizedRecord.normalizedRecordId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'normalizedRecordId must be UUID v4'
  );
});

test('Normalized Record links to its registryRecordId', () => {
  const record = makeRegistryRecord();
  const { normalizedRecord } = normalizeRegistryRecord(record);
  assert.equal(normalizedRecord.registryRecordId, record.registryRecordId);
});

test('Normalized Record links to its Manifest via normalizationManifestId', () => {
  const { normalizedRecord, manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(normalizedRecord.normalizationManifestId, manifest.manifestId,
    'normalizationManifestId must match companion manifest');
});

test('normalizedEvidence on the Normalized Record matches backward-compat normalizedEvidence', () => {
  const result = normalizeRegistryRecord(makeRegistryRecord());
  assert.strictEqual(
    result.normalizedRecord.normalizedEvidence,
    result.normalizedEvidence,
    'normalizedRecord.normalizedEvidence must === backward-compat normalizedEvidence'
  );
});

test('ruleVersions on Normalized Record contains versions of applied rules', () => {
  const record = makeRegistryRecord({ evidence: { artistName: '  The Weeknd  ' } });
  const { normalizedRecord } = normalizeRegistryRecord(record);
  // TXT-001 (trim) should have fired; its version must appear in ruleVersions
  assert.ok('TXT-001' in normalizedRecord.ruleVersions, 'TXT-001 must be in ruleVersions');
  assert.match(normalizedRecord.ruleVersions['TXT-001'], /^\d+\.\d+\.\d+$/,
    'ruleVersions value must be semver');
});

test('createNormalizedRecord factory produces a frozen record', () => {
  const record = createNormalizedRecord({
    normalizedRecordId:       'rec-test-001',
    normalizationManifestId:  'mfst-test-001',
    normalizedEvidence:       { evidence: { artistName: 'Test' } },
    engineVersion:            '1.0.0',
    ruleVersions:             { 'TXT-001': '1.0.0' },
  });
  assert.ok(Object.isFrozen(record));
  assert.ok(Object.isFrozen(record.ruleVersions));
  assert.ok(record.normalizationFingerprint, 'fingerprint must be computed');
});

// ============================================================
// 20. Normalization Manifest™ — Enhancement 2
// ============================================================
console.log('\n-- 20. Normalization Manifest(tm)');

test('normalizeRegistryRecord returns a manifest', () => {
  const { manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(manifest, 'manifest must be present');
  assert.ok(Object.isFrozen(manifest), 'manifest must be frozen');
});

test('Manifest has required fields', () => {
  const { manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(manifest.manifestId,               'manifestId required');
  assert.ok(manifest.outputNormalizedRecordId, 'outputNormalizedRecordId required');
  assert.ok(manifest.engineVersion,            'engineVersion required');
  assert.ok(Array.isArray(manifest.rulesApplied), 'rulesApplied must be array');
  assert.ok(Array.isArray(manifest.rulesSkipped), 'rulesSkipped must be array');
  assert.ok(manifest.ruleVersions,             'ruleVersions required');
  assert.equal(typeof manifest.processingTime, 'number', 'processingTime must be a number');
  assert.ok(manifest.createdAt,                'createdAt required');
  assert.equal(typeof manifest.success, 'boolean', 'success must be boolean');
});

test('Manifest links forward to Normalized Record via outputNormalizedRecordId', () => {
  const { normalizedRecord, manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(manifest.outputNormalizedRecordId, normalizedRecord.normalizedRecordId,
    'outputNormalizedRecordId must match companion Normalized Record');
});

test('Manifest links backward to input Registry Record via inputRegistryRecordId', () => {
  const record = makeRegistryRecord();
  const { manifest } = normalizeRegistryRecord(record);
  assert.equal(manifest.inputRegistryRecordId, record.registryRecordId);
});

test('Manifest backward-compat: reportId === manifestId', () => {
  const { manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(manifest.reportId, manifest.manifestId,
    'reportId must equal manifestId for backward compatibility');
});

test('Manifest backward-compat: normalizedAt === createdAt', () => {
  const { manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.equal(manifest.normalizedAt, manifest.createdAt,
    'normalizedAt must equal createdAt for backward compatibility');
});

test('manifest === report (backward-compat alias)', () => {
  const result = normalizeRegistryRecord(makeRegistryRecord());
  assert.strictEqual(result.manifest, result.report,
    'manifest and report must be the same object');
});

test('Manifest processingTime is a non-negative number', () => {
  const { manifest } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(manifest.processingTime >= 0, 'processingTime must be >= 0');
});

test('createNormalizationManifest factory produces a frozen manifest', () => {
  const mfst = createNormalizationManifest({
    manifestId:               'mfst-test-001',
    outputNormalizedRecordId: 'rec-test-001',
    rulesApplied:             [],
    ruleVersions:             {},
    engineVersion:            '1.0.0',
    processingTime:           5,
  });
  assert.ok(Object.isFrozen(mfst));
  assert.equal(mfst.manifestId, 'mfst-test-001');
  assert.equal(mfst.reportId,   'mfst-test-001');
});

// ============================================================
// 21. Normalization Fingerprint — Enhancement 3
// ============================================================
console.log('\n-- 21. Normalization Fingerprint');

test('Normalized Record has a normalizationFingerprint', () => {
  const { normalizedRecord } = normalizeRegistryRecord(makeRegistryRecord());
  assert.ok(normalizedRecord.normalizationFingerprint, 'fingerprint must be present');
  assert.equal(typeof normalizedRecord.normalizationFingerprint, 'string');
});

test('Fingerprint is a SHA-256 hex string (64 chars)', () => {
  const { normalizedRecord } = normalizeRegistryRecord(makeRegistryRecord());
  assert.match(normalizedRecord.normalizationFingerprint, /^[0-9a-f]{64}$/,
    'fingerprint must be a 64-char hex string');
});

test('Fingerprint is deterministic: same input produces same fingerprint', () => {
  const record = makeRegistryRecord();
  const r1 = normalizeRegistryRecord(record);
  const r2 = normalizeRegistryRecord(record);
  assert.equal(
    r1.normalizedRecord.normalizationFingerprint,
    r2.normalizedRecord.normalizationFingerprint,
    'Fingerprint must be identical across runs for identical input'
  );
});

test('Fingerprint is key-order-independent', () => {
  // Same content, different key order in evidence
  const pe1 = makeParsedEvidence({ evidence: { artistName: 'Test', artistId: 'A001' } });
  const pe2 = makeParsedEvidence({ evidence: { artistId: 'A001', artistName: 'Test' } });
  const fp1 = computeNormalizationFingerprint(pe1.evidence);
  const fp2 = computeNormalizationFingerprint(pe2.evidence);
  assert.equal(fp1, fp2, 'Fingerprint must be identical regardless of key order');
});

test('Different normalized evidence produces different fingerprints', () => {
  const record1 = makeRegistryRecord({ evidence: { artistName: 'Artist A' } });
  const record2 = makeRegistryRecord({ evidence: { artistName: 'Artist B' } });
  const { normalizedRecord: nr1 } = normalizeRegistryRecord(record1);
  const { normalizedRecord: nr2 } = normalizeRegistryRecord(record2);
  assert.notEqual(
    nr1.normalizationFingerprint,
    nr2.normalizationFingerprint,
    'Different evidence must produce different fingerprints'
  );
});

test('computeNormalizationFingerprint returns sentinel for null input', () => {
  const fp = computeNormalizationFingerprint(null);
  assert.equal(fp, 'null-evidence');
});

// ============================================================
// Summary
// ============================================================
console.log('\n============================================================');
console.log('Normalization Engine(tm) -- Sprint 4');
console.log('============================================================');
console.log(`passed: ${passed}`);
console.log(`failed: ${failed}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  FAIL  ${f.name}`);
    console.log(`        ${f.message}`);
  }
  process.exit(1);
} else {
  console.log('\nAll normalization engine tests passed.');
}
