// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Test Suite
// Sprint 1: Canonical Registry Foundation
// ─────────────────────────────────────────────────────────────────────────────

import { REGISTRY, getField, getFieldsByDomain, getFieldsByObject } from '../api/registry/index.js';
import { REGISTRY_VERSION }    from '../api/registry/version.js';
import { CANONICAL_OBJECTS, VALID_OBJECT_IDS }  from '../api/registry/objects.js';
import { validateRegistry }    from '../api/registry/validate.js';
import {
  DOMAINS, DATA_TYPES, RESOLUTION_POLICIES, CONFIDENCE_POLICIES,
  FIELD_STATUSES, OBJECT_STATUSES,
  VALID_DOMAINS, VALID_DATA_TYPES, VALID_RESOLUTION_POLICIES,
  VALID_CONFIDENCE_POLICIES, VALID_OBJECT_STATUSES, VALID_FIELD_STATUSES,
} from '../api/registry/types.js';
import { IDENTITY_FIELDS }     from '../api/registry/fields/identity.js';
import { RIGHTS_FIELDS }       from '../api/registry/fields/rights.js';
import { CATALOG_FIELDS }      from '../api/registry/fields/catalog.js';
import { DISTRIBUTION_FIELDS } from '../api/registry/fields/distribution.js';
import { BACKEND_FIELDS }      from '../api/registry/fields/backend.js';
import { MONITORING_FIELDS }   from '../api/registry/fields/monitoring.js';

// ── Test harness ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Registry Loader
// ─────────────────────────────────────────────────────────────────────────────
section('1. Registry Loader');

assert('REGISTRY exports without throwing', REGISTRY !== null && typeof REGISTRY === 'object');
assert('REGISTRY.objects is non-empty frozen array', Array.isArray(REGISTRY.objects) && REGISTRY.objects.length > 0);
assert('REGISTRY.fields is non-empty frozen array',  Array.isArray(REGISTRY.fields)  && REGISTRY.fields.length > 0);
assert('REGISTRY.version is present', typeof REGISTRY.version === 'object');
assert('REGISTRY.fieldsByDomain is present', typeof REGISTRY.fieldsByDomain === 'object');
assert('REGISTRY.fieldsByObject is present', typeof REGISTRY.fieldsByObject === 'object');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Registry Versioning
// ─────────────────────────────────────────────────────────────────────────────
section('2. Registry Versioning');

assert('REGISTRY_VERSION has version string',       typeof REGISTRY_VERSION.version === 'string');
assert('REGISTRY_VERSION has schemaVersion string', typeof REGISTRY_VERSION.schemaVersion === 'string');
assert('REGISTRY_VERSION has createdAt string',     typeof REGISTRY_VERSION.createdAt === 'string');
assert('REGISTRY_VERSION has modifiedAt string',    typeof REGISTRY_VERSION.modifiedAt === 'string');
assert('REGISTRY_VERSION has author string',        typeof REGISTRY_VERSION.author === 'string');
assert('version follows semver pattern', /^\d+\.\d+\.\d+$/.test(REGISTRY_VERSION.version));
assert('REGISTRY.version === REGISTRY_VERSION (same object)', REGISTRY.version === REGISTRY_VERSION);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Canonical Object Registry
// ─────────────────────────────────────────────────────────────────────────────
section('3. Canonical Object Registry');

assert('CANONICAL_OBJECTS has at least 20 objects', CANONICAL_OBJECTS.length >= 20);

const expectedObjects = [
  'Artist', 'Release', 'Track', 'Recording', 'Work', 'Contributor',
  'Organization', 'Publisher', 'PublishingAdministrator', 'Distributor',
  'RecordLabel', 'PRO', 'RightsOrganization', 'Platform', 'Country',
  'Territory', 'EvidenceSource', 'EvidencePackage', 'Scan', 'CanonicalField',
  'ChangeEvent', 'Alert', 'MonitoringEvent', 'ExecutiveInsight',
  'BusinessRisk', 'HealthIndicator',
];
for (const id of expectedObjects) {
  assert(`Object "${id}" is present`, VALID_OBJECT_IDS.has(id));
}

assert('All objects have id, description, version, status', CANONICAL_OBJECTS.every(
  (o) => o.id && o.description && o.version && o.status
));
assert('All object IDs are unique', (() => {
  const ids = CANONICAL_OBJECTS.map((o) => o.id);
  return new Set(ids).size === ids.length;
})());
assert('All object statuses are valid', CANONICAL_OBJECTS.every((o) => VALID_OBJECT_STATUSES.has(o.status)));

// ─────────────────────────────────────────────────────────────────────────────
// 4. Canonical Field Registry — structural completeness
// ─────────────────────────────────────────────────────────────────────────────
section('4. Canonical Field Registry — structure');

const allFields = REGISTRY.fields;
const REQUIRED_PROPS = [
  'id', 'canonicalName', 'displayName', 'parentObject', 'domain',
  'description', 'dataType', 'required', 'defaultValue',
  'resolutionPolicy', 'confidencePolicy', 'sourcePriority',
  'consumers', 'version', 'status',
];

assert('All fields have every required property', allFields.every((f) =>
  REQUIRED_PROPS.every((p) => p in f)
));
assert('All field IDs are non-empty strings', allFields.every((f) => typeof f.id === 'string' && f.id.length > 0));
assert('All field displayNames are strings',  allFields.every((f) => typeof f.displayName === 'string'));
assert('All field descriptions are strings',  allFields.every((f) => typeof f.description === 'string'));
assert('All field versions are strings',      allFields.every((f) => typeof f.version === 'string'));
assert('All field sourcePriority are arrays', allFields.every((f) => Array.isArray(f.sourcePriority)));
assert('All field consumers are arrays',      allFields.every((f) => Array.isArray(f.consumers)));

// ─────────────────────────────────────────────────────────────────────────────
// 5. Stable Field IDs
// ─────────────────────────────────────────────────────────────────────────────
section('5. Stable Field IDs (Board-mandated examples)');

const mandatoryIds = [
  'identity.artist_name', 'identity.artist_image', 'identity.primary_genre',
  'identity.apple_artist_id', 'identity.spotify_artist_id',
  'rights.pro', 'rights.publisher', 'rights.record_label', 'rights.distributor',
  'catalog.release_count', 'catalog.track_count', 'catalog.primary_release',
  'distribution.country_count', 'distribution.platform_count',
  'monitoring.last_scan', 'executive.health_score',
];

for (const id of mandatoryIds) {
  assert(`Stable ID "${id}" exists`, getField(id) !== undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Domain Ownership
// ─────────────────────────────────────────────────────────────────────────────
section('6. Domain Ownership');

assert('All field domains are valid', allFields.every((f) => VALID_DOMAINS.has(f.domain)));

assert('No field is owned by Executive Intelligence (constitutional)', allFields.every(
  (f) => f.domain !== DOMAINS.EXECUTIVE
));

const domainCounts = {};
for (const f of allFields) {
  domainCounts[f.domain] = (domainCounts[f.domain] || 0) + 1;
}
assert('Identity™ domain has fields',           (domainCounts['Identity']              ?? 0) > 0);
assert('Music Rights™ domain has fields',       (domainCounts['Music Rights']          ?? 0) > 0);
assert('Catalog™ domain has fields',            (domainCounts['Catalog']               ?? 0) > 0);
assert('Global Distribution™ domain has fields',(domainCounts['Global Distribution']   ?? 0) > 0);
assert('Backend Verification™ domain has fields',(domainCounts['Backend Verification'] ?? 0) > 0);
assert('Monitoring™ domain has fields',         (domainCounts['Monitoring']            ?? 0) > 0);
assert('Executive Intelligence domain has ZERO fields', (domainCounts['Executive Intelligence'] ?? 0) === 0);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Registry Validation — passes on valid registry
// ─────────────────────────────────────────────────────────────────────────────
section('7. Registry Validation — valid registry');

const result = validateRegistry(CANONICAL_OBJECTS, allFields);
assert('validateRegistry returns { valid, errors, warnings }',
  typeof result.valid === 'boolean' &&
  Array.isArray(result.errors) &&
  Array.isArray(result.warnings)
);
assert('Valid registry produces zero errors', result.errors.length === 0, result.errors.join('; '));
assert('All field IDs are globally unique', (() => {
  const ids = allFields.map((f) => f.id);
  return new Set(ids).size === ids.length;
})());
assert('All field data types are known', allFields.every((f) => VALID_DATA_TYPES.has(f.dataType)));
assert('All field parent objects are known', allFields.every((f) => VALID_OBJECT_IDS.has(f.parentObject)));
assert('All resolution policies are known', allFields.every((f) => VALID_RESOLUTION_POLICIES.has(f.resolutionPolicy)));
assert('All confidence policies are known', allFields.every((f) => VALID_CONFIDENCE_POLICIES.has(f.confidencePolicy)));

// ─────────────────────────────────────────────────────────────────────────────
// 8. Registry Validation — catches broken inputs
// ─────────────────────────────────────────────────────────────────────────────
section('8. Registry Validation — catches broken inputs');

const { errors: dupIdErrors } = validateRegistry(CANONICAL_OBJECTS, [
  ...allFields,
  { ...allFields[0] },   // exact duplicate of first field
]);
assert('Duplicate field ID is caught', dupIdErrors.some((e) => e.includes('Duplicate field ID')));

const { errors: badDomainErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.bad_domain', domain: 'Nonexistent Domain' },
]);
assert('Unknown domain is caught', badDomainErrors.some((e) => e.includes('unknown domain')));

const { errors: execOwnerErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.exec_owned', domain: DOMAINS.EXECUTIVE },
]);
assert('Executive-owned field is caught', execOwnerErrors.some((e) => e.includes('Executive Intelligence never owns')));

const { errors: badTypeErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.bad_type', dataType: 'invalid_type' },
]);
assert('Invalid data type is caught', badTypeErrors.some((e) => e.includes('unknown dataType')));

const { errors: badObjectErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.bad_object', parentObject: 'NonexistentObject' },
]);
assert('Unknown parent object is caught', badObjectErrors.some((e) => e.includes('unknown parentObject')));

const { errors: dupCanonicalErrors } = validateRegistry(CANONICAL_OBJECTS, [
  ...allFields,
  {
    ...allFields[0],
    id: 'identity.artist_name_duplicate',   // different ID, same parentObject+canonicalName
  },
]);
assert('Duplicate canonical name on same parent object is caught',
  dupCanonicalErrors.some((e) => e.includes('Duplicate canonical name') || e.includes('Duplicate field ID'))
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. Registry Loader API
// ─────────────────────────────────────────────────────────────────────────────
section('9. Registry Loader API');

assert('getField("identity.artist_name") returns the correct field', (() => {
  const f = getField('identity.artist_name');
  return f !== undefined && f.id === 'identity.artist_name' && f.domain === 'Identity';
})());

assert('getField("executive.health_score") returns Monitoring-owned field', (() => {
  const f = getField('executive.health_score');
  return f !== undefined && f.domain === 'Monitoring';
})());

assert('getField("nonexistent.field") returns undefined', getField('nonexistent.field') === undefined);

assert('getFieldsByDomain("Identity") returns only Identity fields', (() => {
  const fs = getFieldsByDomain('Identity');
  return fs.length > 0 && fs.every((f) => f.domain === 'Identity');
})());

assert('getFieldsByDomain("Executive Intelligence") returns empty array', (() => {
  const fs = getFieldsByDomain('Executive Intelligence');
  return Array.isArray(fs) && fs.length === 0;
})());

assert('getFieldsByObject("Artist") returns fields', (() => {
  const fs = getFieldsByObject('Artist');
  return fs.length > 0;
})());

assert('getFieldsByObject("NonexistentObject") returns empty array', (() => {
  const fs = getFieldsByObject('NonexistentObject');
  return Array.isArray(fs) && fs.length === 0;
})());

assert('All 6 owning domains are represented in getFieldsByDomain', (() => {
  const owningDomains = [
    'Identity', 'Music Rights', 'Catalog',
    'Global Distribution', 'Backend Verification', 'Monitoring',
  ];
  return owningDomains.every((d) => getFieldsByDomain(d).length > 0);
})());

// ─────────────────────────────────────────────────────────────────────────────
// 10. Domain field counts and field-domain pairing
// ─────────────────────────────────────────────────────────────────────────────
section('10. Domain field arrays match REGISTRY.fields');

assert('IDENTITY_FIELDS all have domain Identity',           IDENTITY_FIELDS.every((f) => f.domain === 'Identity'));
assert('RIGHTS_FIELDS all have domain Music Rights',         RIGHTS_FIELDS.every((f) => f.domain === 'Music Rights'));
assert('CATALOG_FIELDS all have domain Catalog',             CATALOG_FIELDS.every((f) => f.domain === 'Catalog'));
assert('DISTRIBUTION_FIELDS all have domain Global Distribution', DISTRIBUTION_FIELDS.every((f) => f.domain === 'Global Distribution'));
assert('BACKEND_FIELDS all have domain Backend Verification', BACKEND_FIELDS.every((f) => f.domain === 'Backend Verification'));
assert('MONITORING_FIELDS all have domain Monitoring',        MONITORING_FIELDS.every((f) => f.domain === 'Monitoring'));

const totalFieldCount =
  IDENTITY_FIELDS.length + RIGHTS_FIELDS.length + CATALOG_FIELDS.length +
  DISTRIBUTION_FIELDS.length + BACKEND_FIELDS.length + MONITORING_FIELDS.length;

assert('REGISTRY.fields count equals sum of all domain arrays', REGISTRY.fields.length === totalFieldCount);

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`  CANONICAL REGISTRY VERIFIED: ${passed} assertions passed`);
} else {
  console.log(`  FAILED: ${failed} assertion(s) failed, ${passed} passed`);
}
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
