// Canonical Intelligence Platform(tm) -- Resolution Engine(tm) Test Suite
// Sprint 5: Evidence Resolution Engine(tm)

import { randomUUID } from 'crypto';
import * as _resModuleRef from '../api/resolution/index.js';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n── ${title}`);
}

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeNormRecord(provider, evidenceFields = {}, overrides = {}) {
  return {
    normalizedRecordId:       overrides.normalizedRecordId ?? randomUUID(),
    sourceEvidenceEnvelopeId: null,
    registryRecordId:         null,
    normalizationManifestId:  randomUUID(),
    normalizedEvidence: {
      contractId: 'ArtistIdentityEvidence',
      provider,
      evidence: { ...evidenceFields },
      sourceUrl: overrides.sourceUrl ?? null,
      retrievedAt: new Date().toISOString(),
    },
    normalizationFingerprint: 'abc123',
    engineVersion: '1.0.0',
    ruleVersions: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── 1. Engine Loader ─────────────────────────────────────────────────────────

section('1. Engine Loader');

assert(typeof _resModuleRef.RESOLUTION_ENGINE === 'object', 'RESOLUTION_ENGINE singleton exists');
assert(typeof _resModuleRef.RESOLUTION_ENGINE.resolveField === 'function', 'RESOLUTION_ENGINE.resolveField is a function');
assert(typeof _resModuleRef.createResolutionEngine === 'function', 'createResolutionEngine factory exported');
assert(typeof _resModuleRef.createResolutionRegistry === 'function', 'createResolutionRegistry exported');

// ─── 2. Version ──────────────────────────────────────────────────────────────

section('2. Version');

const { RESOLUTION_ENGINE_VERSION } = _resModuleRef;
assert(RESOLUTION_ENGINE_VERSION.version === '1.0.0', 'version is 1.0.0');
assert(RESOLUTION_ENGINE_VERSION.engineId === 'resolution-engine-v1', 'engineId correct');
assert(typeof RESOLUTION_ENGINE_VERSION.effectiveDate === 'string', 'effectiveDate present');
assert(Object.isFrozen(RESOLUTION_ENGINE_VERSION), 'version object is frozen');

// ─── 3. Type Constants ───────────────────────────────────────────────────────

section('3. Type Constants');

const { RESOLUTION_CATEGORIES, RESOLUTION_RULES, CONFLICT_TYPES, CONFIDENCE_LEVELS, POLICY_STATUSES } = _resModuleRef;
assert(RESOLUTION_CATEGORIES.IDENTITY === 'IDENTITY', 'RESOLUTION_CATEGORIES.IDENTITY');
assert(RESOLUTION_CATEGORIES.DEFAULT  === 'DEFAULT',  'RESOLUTION_CATEGORIES.DEFAULT');
assert(RESOLUTION_RULES.POLICY_PRIORITY === 'POLICY_PRIORITY', 'RESOLUTION_RULES.POLICY_PRIORITY');
assert(RESOLUTION_RULES.CONSENSUS       === 'CONSENSUS',       'RESOLUTION_RULES.CONSENSUS');
assert(CONFLICT_TYPES.ALL_AGREE         === 'ALL_AGREE',       'CONFLICT_TYPES.ALL_AGREE');
assert(CONFLICT_TYPES.NO_DATA           === 'NO_DATA',         'CONFLICT_TYPES.NO_DATA');
assert(CONFIDENCE_LEVELS.HIGH           === 'HIGH',            'CONFIDENCE_LEVELS.HIGH');
assert(POLICY_STATUSES.ACTIVE           === 'ACTIVE',          'POLICY_STATUSES.ACTIVE');

// ─── 4. Resolution Policy Registry ───────────────────────────────────────────

section('4. Resolution Policy Registry');

const { createResolutionRegistry } = _resModuleRef;
const testRegistry = createResolutionRegistry();

const samplePolicy = {
  policyId:       'TEST_ARTIST_POLICY',
  policyName:     'Test Artist Policy',
  field:          'testArtistName',
  providerOrder:  ['apple-music', 'spotify'],
  version:        '1.0.0',
  category:       RESOLUTION_CATEGORIES.IDENTITY,
  status:         POLICY_STATUSES.ACTIVE,
  resolutionRule: RESOLUTION_RULES.POLICY_PRIORITY,
  description:    'Test policy',
};

testRegistry.registerPolicy(samplePolicy);
assert(testRegistry.size() === 1, 'Registry size is 1 after registration');

const retrieved = testRegistry.getPolicyForField('testArtistName');
assert(retrieved?.policyId === 'TEST_ARTIST_POLICY', 'getPolicyForField returns correct policy');
assert(Object.isFrozen(retrieved?.providerOrder), 'providerOrder is frozen on retrieved policy');

const defaultPol = {
  policyId: 'TEST_DEFAULT', policyName: 'Default', field: 'DEFAULT',
  providerOrder: ['apple-music'], version: '1.0.0',
  category: RESOLUTION_CATEGORIES.DEFAULT, status: POLICY_STATUSES.ACTIVE,
  resolutionRule: RESOLUTION_RULES.POLICY_PRIORITY,
};
testRegistry.registerPolicy(defaultPol);
const fallback = testRegistry.getPolicyForField('unknownFieldXyz');
assert(fallback?.policyId === 'TEST_DEFAULT', 'Falls back to DEFAULT policy for unknown fields');

let registryDupError = false;
try { testRegistry.registerPolicy(samplePolicy); } catch { registryDupError = true; }
assert(registryDupError, 'Duplicate policy registration throws');

// ─── 5. Policy Validation ─────────────────────────────────────────────────────

section('5. Policy Validation');

const { validatePolicy } = _resModuleRef;
assert(validatePolicy(samplePolicy).length === 0, 'Valid policy returns no errors');

const missingField = { ...samplePolicy, policyId: undefined };
assert(validatePolicy(missingField).length > 0, 'Missing policyId returns validation error');

const badCategory = { ...samplePolicy, policyId: 'X2', category: 'NOT_A_CATEGORY' };
assert(validatePolicy(badCategory).length > 0, 'Invalid category returns validation error');

const emptyProviders = { ...samplePolicy, policyId: 'X3', providerOrder: [] };
let epError = false;
try { const r2 = createResolutionRegistry(); r2.registerPolicy(emptyProviders); } catch { epError = true; }
assert(epError, 'Empty providerOrder throws on registration');

// ─── 6. Default Policies ─────────────────────────────────────────────────────

section('6. Default Policies');

const { DEFAULT_POLICIES, RESOLUTION_ENGINE } = _resModuleRef;
assert(Array.isArray(DEFAULT_POLICIES), 'DEFAULT_POLICIES is an array');
assert(DEFAULT_POLICIES.length >= 9, 'At least 9 default policies registered');
assert(DEFAULT_POLICIES.some(p => p.field === 'DEFAULT'), 'DEFAULT fallback policy exists');
assert(DEFAULT_POLICIES.some(p => p.field === 'artistName'), 'artistName policy registered');
assert(DEFAULT_POLICIES.some(p => p.field === 'isrc'), 'isrc policy registered');
assert(DEFAULT_POLICIES.some(p => p.field === 'recordLabel'), 'recordLabel policy registered');

const artistPolicy = RESOLUTION_ENGINE.getPolicyForField('artistName');
assert(artistPolicy?.providerOrder[0] === 'apple-music', 'artistName policy: apple-music is rank 0');

// ─── 7. Conflict Detection™ ───────────────────────────────────────────────────

section('7. Conflict Detection™');

const { detectConflict } = _resModuleRef;

const allAgree = detectConflict({ 'apple-music': 'The Weeknd', 'spotify': 'The Weeknd', 'tidal': 'The Weeknd' });
assert(allAgree.conflictType === 'ALL_AGREE', 'All-agree → ALL_AGREE');
assert(allAgree.isConflicting === false, 'ALL_AGREE is not conflicting');

const partial = detectConflict({ 'apple-music': 'The Weeknd', 'spotify': 'THE WEEKND', 'tidal': 'The Weeknd' });
assert(partial.conflictType === 'PARTIAL_AGREEMENT', 'Two agree, one differs → PARTIAL_AGREEMENT');
assert(partial.isConflicting === true, 'PARTIAL_AGREEMENT is conflicting');

const fullConflict = detectConflict({ 'apple-music': 'Abel', 'spotify': 'Weeknd', 'tidal': 'The Weeknd' });
assert(fullConflict.conflictType === 'CONFLICT', 'All differ → CONFLICT');
assert(fullConflict.conflictingPairs.length > 0, 'Conflicting pairs populated');

const single = detectConflict({ 'apple-music': 'The Weeknd' });
assert(single.conflictType === 'SINGLE_SOURCE', 'One provider → SINGLE_SOURCE');

const noData = detectConflict({ 'apple-music': null, 'spotify': null });
assert(noData.conflictType === 'NO_DATA', 'All null → NO_DATA');

const frozen = detectConflict({ 'apple-music': 'A', 'spotify': 'B' });
assert(Object.isFrozen(frozen), 'Conflict result is frozen');

// ─── 8. Confidence Engine™ ───────────────────────────────────────────────────

section('8. Confidence Engine™');

const { computeConfidence, confidenceLevel, CONFIDENCE_THRESHOLDS } = _resModuleRef;

const c1 = computeConfidence({ selectedProviderRank: 0, conflictType: 'ALL_AGREE', hasValue: true });
assert(c1 === 1.00, 'Rank 0 + ALL_AGREE + value → 1.0');

const c2 = computeConfidence({ selectedProviderRank: 0, conflictType: 'CONFLICT', hasValue: true });
assert(c2 === 0.80, 'Rank 0 + CONFLICT + value → 0.80');

const c3 = computeConfidence({ selectedProviderRank: 0, conflictType: 'NO_DATA', hasValue: false });
assert(c3 === 0.00, 'hasValue=false → 0.0');

const c4 = computeConfidence({ selectedProviderRank: 1, conflictType: 'ALL_AGREE', hasValue: true });
assert(c4 === 0.92, 'Rank 1 + ALL_AGREE → 0.92');

assert(confidenceLevel(0.95) === 'HIGH',      'confidence 0.95 → HIGH');
assert(confidenceLevel(0.70) === 'MEDIUM',    'confidence 0.70 → MEDIUM');
assert(confidenceLevel(0.50) === 'LOW',       'confidence 0.50 → LOW');
assert(confidenceLevel(0.20) === 'UNCERTAIN', 'confidence 0.20 → UNCERTAIN');

// ─── 9. Field Provenance™ ────────────────────────────────────────────────────

section('9. Field Provenance™');

const { createFieldProvenance } = _resModuleRef;

const prov = createFieldProvenance({
  resolvedField: 'artistName', canonicalValue: 'The Weeknd',
  selectedProvider: 'apple-music', supportingProviders: ['tidal'],
  conflictingProviders: ['spotify'], resolutionRule: 'POLICY_PRIORITY',
  confidence: 0.90, confidenceLevel: 'HIGH',
  normalizedRecordIds: ['r1', 'r2'], conflictType: 'PARTIAL_AGREEMENT',
});

assert(Object.isFrozen(prov), 'Field Provenance is frozen');
assert(prov.resolvedField === 'artistName', 'resolvedField correct');
assert(prov.selectedProvider === 'apple-music', 'selectedProvider correct');
assert(Array.isArray(prov.supportingProviders), 'supportingProviders is array');
assert(prov.conflictingProviders.includes('spotify'), 'conflictingProviders populated');
assert(typeof prov.provenanceId === 'string', 'provenanceId auto-generated');

// ─── 10. Resolution Record™ ───────────────────────────────────────────────────

section('10. Resolution Record™');

const { createResolutionRecord } = _resModuleRef;

const rec = createResolutionRecord({
  normalizedRecordIds: ['r1', 'r2'], resolvedField: 'artistName',
  canonicalValue: 'The Weeknd', confidence: 0.92, confidenceLevel: 'HIGH',
  selectedProvider: 'apple-music', selectedRule: 'POLICY_PRIORITY',
  resolutionPolicyId: 'ARTIST_NAME_POLICY', conflictType: 'ALL_AGREE',
});

assert(Object.isFrozen(rec), 'Resolution Record is frozen');
assert(typeof rec.resolutionRecordId === 'string', 'resolutionRecordId auto-generated');
assert(rec.canonicalValue === 'The Weeknd', 'canonicalValue correct');
assert(rec.confidence === 0.92, 'confidence correct');
assert(rec.confidenceLevel === 'HIGH', 'confidenceLevel correct');
assert(Object.isFrozen(rec.normalizedRecordIds), 'normalizedRecordIds frozen');
assert(rec.engineVersion === '1.0.0', 'engineVersion correct');

// ─── 11. Resolution Manifest™ ────────────────────────────────────────────────

section('11. Resolution Manifest™');

const { createResolutionManifest } = _resModuleRef;

const manifest = createResolutionManifest({
  resolvedField: 'artistName',
  inputNormalizedRecordIds: ['r1', 'r2'],
  policyId: 'ARTIST_NAME_POLICY',
  policyName: 'Artist Name Resolution Policy',
  resolutionRule: 'POLICY_PRIORITY',
  outputResolutionRecordId: 'res-001',
  outputProvenanceId: 'prov-001',
  processingTime: 3,
  warnings: [], errors: [],
});

assert(Object.isFrozen(manifest), 'Resolution Manifest is frozen');
assert(typeof manifest.manifestId === 'string', 'manifestId auto-generated');
assert(manifest.resolvedField === 'artistName', 'resolvedField correct');
assert(manifest.processingTime === 3, 'processingTime recorded');
assert(Array.isArray(manifest.warnings), 'warnings is array');
assert(manifest.outputResolutionRecordId === 'res-001', 'outputResolutionRecordId cross-linked');

// ─── 12. Pipeline — All Providers Agree ───────────────────────────────────────

section('12. Pipeline — All Providers Agree');

const records_agree = [
  makeNormRecord('apple-music', { artistName: 'The Weeknd' }),
  makeNormRecord('spotify',     { artistName: 'The Weeknd' }),
  makeNormRecord('tidal',       { artistName: 'The Weeknd' }),
];

const result_agree = RESOLUTION_ENGINE.resolveField(records_agree, 'artistName');
assert(result_agree.success === true, 'Success when all agree');
assert(result_agree.resolutionRecord.canonicalValue === 'The Weeknd', 'Canonical value = The Weeknd');
assert(result_agree.resolutionRecord.selectedProvider === 'apple-music', 'apple-music selected (rank 0)');
assert(result_agree.resolutionRecord.conflictType === 'ALL_AGREE', 'conflictType = ALL_AGREE');
assert(result_agree.resolutionRecord.confidence === 1.00, 'Confidence = 1.0 (rank 0 + all agree)');
assert(result_agree.resolutionRecord.confidenceLevel === 'HIGH', 'confidenceLevel = HIGH');

// ─── 13. Pipeline — Provider Disagreement ─────────────────────────────────────

section('13. Pipeline — Provider Disagreement');

const records_conflict = [
  makeNormRecord('apple-music', { artistName: 'The Weeknd' }),
  makeNormRecord('spotify',     { artistName: 'THE WEEKND' }),
  makeNormRecord('tidal',       { artistName: 'The Weeknd' }),
];

const result_conflict = RESOLUTION_ENGINE.resolveField(records_conflict, 'artistName');
assert(result_conflict.success === true, 'Success even with conflict');
assert(result_conflict.resolutionRecord.canonicalValue === 'The Weeknd', 'Highest-priority provider (apple) wins');
assert(result_conflict.resolutionRecord.conflictType === 'PARTIAL_AGREEMENT', 'conflictType = PARTIAL_AGREEMENT');
assert(result_conflict.resolutionRecord.confidence < 1.0, 'Confidence reduced by conflict');
assert(result_conflict.provenance.conflictingProviders.includes('spotify'), 'Spotify recorded as conflicting');
assert(result_conflict.provenance.supportingProviders.includes('tidal'), 'Tidal recorded as supporting');

// ─── 14. Pipeline — Single Provider ───────────────────────────────────────────

section('14. Pipeline — Single Provider');

const records_single = [
  makeNormRecord('apple-music', { artistName: 'Sza' }),
];

const result_single = RESOLUTION_ENGINE.resolveField(records_single, 'artistName');
assert(result_single.success === true, 'Success with single provider');
assert(result_single.resolutionRecord.canonicalValue === 'Sza', 'Canonical value from single source');
assert(result_single.resolutionRecord.conflictType === 'SINGLE_SOURCE', 'conflictType = SINGLE_SOURCE');
assert(result_single.resolutionRecord.confidence > 0, 'Non-zero confidence for single source');
assert(result_single.resolutionRecord.selectedProvider === 'apple-music', 'Provider is apple-music');

// ─── 15. Pipeline — No Data ───────────────────────────────────────────────────

section('15. Pipeline — No Data');

const records_nodata = [
  makeNormRecord('apple-music', { genre: null }),
  makeNormRecord('spotify',     { genre: null }),
];

const result_nodata = RESOLUTION_ENGINE.resolveField(records_nodata, 'genre');
assert(result_nodata.success === true, 'Success even with no data');
assert(result_nodata.resolutionRecord.canonicalValue === null, 'Canonical value is null');
assert(result_nodata.resolutionRecord.confidence === 0, 'Confidence is 0 for no-data');
assert(result_nodata.resolutionRecord.conflictType === 'NO_DATA', 'conflictType = NO_DATA');

// ─── 16. Pipeline — Policy Fallback to DEFAULT ────────────────────────────────

section('16. Pipeline — Policy Fallback to DEFAULT');

const records_default = [
  makeNormRecord('spotify',     { someObscureField: 'value-s' }),
  makeNormRecord('apple-music', { someObscureField: 'value-a' }),
];

const result_default = RESOLUTION_ENGINE.resolveField(records_default, 'someObscureField');
assert(result_default.success === true, 'Success with DEFAULT fallback policy');
assert(result_default.resolutionRecord.canonicalValue === 'value-a', 'apple-music wins in DEFAULT policy (rank 0)');
assert(result_default.resolutionRecord.resolutionPolicyId === 'DEFAULT_POLICY', 'DEFAULT_POLICY used');

// ─── 17. Pipeline — Error: No Policy (custom registry without DEFAULT) ─────────

section('17. Pipeline — No Policy Found');

const emptyReg = createResolutionRegistry();
emptyReg.registerPolicy({
  policyId: 'ONLY_ONE', policyName: 'Only One', field: 'onlyField',
  providerOrder: ['apple-music'], version: '1.0.0',
  category: RESOLUTION_CATEGORIES.IDENTITY, status: POLICY_STATUSES.ACTIVE,
  resolutionRule: RESOLUTION_RULES.POLICY_PRIORITY,
});
const emptyEngine = _resModuleRef.createResolutionEngine(emptyReg);
const result_nopolicy = emptyEngine.resolveField(records_agree, 'artistName');
assert(result_nopolicy.success === false, 'Failure when no matching policy');
assert(result_nopolicy.error === 'NO_POLICY_FOUND', 'Error code NO_POLICY_FOUND');
assert(result_nopolicy.resolutionRecord === null, 'No record produced on error');
assert(result_nopolicy.manifest !== null, 'Manifest still produced on error');

// ─── 18. Pipeline — Immutability ──────────────────────────────────────────────

section('18. Pipeline — Immutability');

const result_imm = RESOLUTION_ENGINE.resolveField(records_agree, 'artistName');
assert(Object.isFrozen(result_imm.resolutionRecord), 'Resolution Record is frozen');
assert(Object.isFrozen(result_imm.manifest), 'Resolution Manifest is frozen');
assert(Object.isFrozen(result_imm.provenance), 'Field Provenance is frozen');
assert(Object.isFrozen(result_imm.resolutionRecord.normalizedRecordIds), 'normalizedRecordIds frozen');

// Inputs not mutated
const inputRecord = makeNormRecord('apple-music', { artistName: 'Test Artist' });
const inputCopy   = JSON.parse(JSON.stringify(inputRecord));
RESOLUTION_ENGINE.resolveField([inputRecord], 'artistName');
assert(
  JSON.stringify(inputRecord.normalizedEvidence) === JSON.stringify(inputCopy.normalizedEvidence),
  'Input Normalized Records not mutated'
);

// ─── 19. Pipeline — Determinism & Replay ──────────────────────────────────────

section('19. Pipeline — Determinism & Replay');

const stable_records = [
  makeNormRecord('apple-music', { artistName: 'Kendrick Lamar' }),
  makeNormRecord('spotify',     { artistName: 'KENDRICK LAMAR' }),
  makeNormRecord('tidal',       { artistName: 'Kendrick Lamar' }),
];

const r_run1 = RESOLUTION_ENGINE.resolveField(stable_records, 'artistName');
const r_run2 = RESOLUTION_ENGINE.resolveField(stable_records, 'artistName');

assert(r_run1.resolutionRecord.canonicalValue === r_run2.resolutionRecord.canonicalValue, 'Canonical value is deterministic');
assert(r_run1.resolutionRecord.selectedProvider === r_run2.resolutionRecord.selectedProvider, 'Selected provider is deterministic');
assert(r_run1.resolutionRecord.confidence === r_run2.resolutionRecord.confidence, 'Confidence is deterministic');
assert(r_run1.resolutionRecord.conflictType === r_run2.resolutionRecord.conflictType, 'Conflict type is deterministic');

// ─── 20. resolveManyFields ────────────────────────────────────────────────────

section('20. resolveManyFields');

const multi_records = [
  makeNormRecord('apple-music', { artistName: 'Drake', genre: 'Hip-Hop', isrc: 'US-S1Z-19-00001' }),
  makeNormRecord('spotify',     { artistName: 'Drake', genre: 'Rap',    isrc: 'US-S1Z-19-00001' }),
];

const multi_result = RESOLUTION_ENGINE.resolveManyFields(multi_records, ['artistName', 'genre', 'isrc']);
assert(Array.isArray(multi_result.results), 'results is an array');
assert(multi_result.results.length === 3, '3 field results returned');
assert(multi_result.results.every(r => r.fieldName !== undefined), 'Each result has fieldName');
assert(multi_result.results.every(r => r.success !== undefined), 'Each result has success flag');

const artistResult = multi_result.results.find(r => r.fieldName === 'artistName');
assert(artistResult?.resolutionRecord?.canonicalValue === 'Drake', 'artistName resolved correctly in batch');

// ─── 21. resolveAllFields ─────────────────────────────────────────────────────

section('21. resolveAllFields');

const all_records = [
  makeNormRecord('apple-music', { artistName: 'Frank Ocean', genre: 'R&B', releaseDate: '2016-08-20' }),
  makeNormRecord('musicbrainz', { artistName: 'Frank Ocean', genre: 'Soul', releaseDate: '2016-08-20' }),
];

const all_result = RESOLUTION_ENGINE.resolveAllFields(all_records);
assert(Array.isArray(all_result.results), 'resolveAllFields returns results array');
assert(all_result.results.length >= 3, 'All distinct evidence fields resolved');
const fields = all_result.results.map(r => r.fieldName);
assert(fields.includes('artistName'), 'artistName included in resolveAllFields');
assert(fields.includes('genre'), 'genre included in resolveAllFields');

// ─── 22. Cross-linking: Record ↔ Manifest ────────────────────────────────────

section('22. Cross-linking: Record ↔ Manifest');

const cross_result = RESOLUTION_ENGINE.resolveField(records_agree, 'artistName');
assert(
  cross_result.resolutionRecord.resolutionManifestId === cross_result.manifest.manifestId,
  'Record.resolutionManifestId === Manifest.manifestId'
);
assert(
  cross_result.manifest.outputResolutionRecordId === cross_result.resolutionRecord.resolutionRecordId,
  'Manifest.outputResolutionRecordId === Record.resolutionRecordId'
);
assert(
  cross_result.resolutionRecord.provenanceId === cross_result.provenance.provenanceId,
  'Record.provenanceId === Provenance.provenanceId'
);
assert(
  cross_result.manifest.outputProvenanceId === cross_result.provenance.provenanceId,
  'Manifest.outputProvenanceId === Provenance.provenanceId'
);

// ─── 23. Validation Functions ─────────────────────────────────────────────────

section('23. Validation Functions');

const { validateResolutionRecord, validateResolutionManifest, validateNormalizedRecords } = _resModuleRef;

assert(validateResolutionRecord(cross_result.resolutionRecord).length === 0, 'Valid Resolution Record passes validation');
assert(validateResolutionManifest(cross_result.manifest).length === 0, 'Valid Resolution Manifest passes validation');
assert(validateNormalizedRecords(records_agree).length === 0, 'Valid Normalized Records pass validation');
assert(validateNormalizedRecords([]).length > 0, 'Empty array fails normalized records validation');
assert(validateNormalizedRecords(null).length > 0, 'Null fails normalized records validation');

// ─── 24. Constitutional Boundaries ────────────────────────────────────────────

section('24. Constitutional Boundaries');

// Engine never mutates its registry
const policyCountBefore = RESOLUTION_ENGINE.listPolicies().length;
RESOLUTION_ENGINE.resolveField(records_agree, 'artistName');
const policyCountAfter  = RESOLUTION_ENGINE.listPolicies().length;
assert(policyCountBefore === policyCountAfter, 'Registry not mutated by resolution');

// Field with lower-priority provider wins only because higher is absent
const priority_test = [
  makeNormRecord('spotify',     { recordLabel: 'OVO Sound' }),
  makeNormRecord('discogs',     { recordLabel: 'OVO Sound' }),
];
const label_result = RESOLUTION_ENGINE.resolveField(priority_test, 'recordLabel');
// recordLabel policy: musicbrainz → discogs → apple-music → spotify → tidal
// musicbrainz absent, discogs is rank 1 in policy
assert(label_result.resolutionRecord.selectedProvider === 'discogs', 'discogs wins for recordLabel (higher rank than spotify)');

// providerOrder is not shared/mutated
const policy1 = RESOLUTION_ENGINE.getPolicyForField('artistName');
const policy2 = RESOLUTION_ENGINE.getPolicyForField('artistName');
assert(policy1 === policy2, 'Same frozen policy object returned from registry');

// ─── 25. Consensus Rule ───────────────────────────────────────────────────────

section('25. Consensus Rule');

const consensusRegistry = createResolutionRegistry();
consensusRegistry.registerPolicy({
  policyId: 'CONSENSUS_POLICY', policyName: 'Consensus Policy',
  field: 'labelName',
  providerOrder: ['apple-music', 'spotify', 'musicbrainz'],
  version: '1.0.0', category: RESOLUTION_CATEGORIES.CATALOG,
  status: POLICY_STATUSES.ACTIVE, resolutionRule: RESOLUTION_RULES.CONSENSUS,
});
consensusRegistry.registerPolicy({
  policyId: 'CONS_DEFAULT', policyName: 'Default', field: 'DEFAULT',
  providerOrder: ['apple-music', 'spotify'], version: '1.0.0',
  category: RESOLUTION_CATEGORIES.DEFAULT, status: POLICY_STATUSES.ACTIVE,
  resolutionRule: RESOLUTION_RULES.POLICY_PRIORITY,
});
const consensusEngine = _resModuleRef.createResolutionEngine(consensusRegistry);

const consensus_agree = [
  makeNormRecord('apple-music', { labelName: 'Def Jam' }),
  makeNormRecord('spotify',     { labelName: 'Def Jam' }),
];
const cres_agree = consensusEngine.resolveField(consensus_agree, 'labelName');
assert(cres_agree.success === true, 'Consensus resolves when providers agree');
assert(cres_agree.resolutionRecord.canonicalValue === 'Def Jam', 'Consensus value correct');

const consensus_conflict = [
  makeNormRecord('apple-music', { labelName: 'Def Jam' }),
  makeNormRecord('spotify',     { labelName: 'Columbia' }),
];
const cres_conflict = consensusEngine.resolveField(consensus_conflict, 'labelName');
assert(cres_conflict.success === true, 'Consensus returns success with null when conflict exists');
assert(cres_conflict.resolutionRecord.canonicalValue === null, 'Consensus returns null on conflict');
assert(cres_conflict.manifest.warnings.length > 0, 'Conflict warning recorded in manifest');

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`Resolution Engine Test Suite — Sprint 5`);
console.log(`${'─'.repeat(60)}`);
console.log(`  Total:  ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`${'═'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
