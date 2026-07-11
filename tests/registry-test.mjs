// ─────────────────────────────────────────────────────────────────────────────
// Canonical Intelligence Platform™ — Registry Test Suite
// Sprint 1A: Ownership Corrections (Canonical Domains + Consumer Workspaces)
// ─────────────────────────────────────────────────────────────────────────────

import {
  REGISTRY,
  getField,
  getProvisionalField,
  getFieldsByDomain,
  getFieldsByObject,
} from '../api/registry/index.js';
import { REGISTRY_VERSION }   from '../api/registry/version.js';
import { CANONICAL_OBJECTS, VALID_OBJECT_IDS } from '../api/registry/objects.js';
import { validateRegistry, validateProvisionalFields } from '../api/registry/validate.js';
import {
  DOMAINS,
  CONSUMER_WORKSPACES,
  OBJECT_CLASSES,
  DATA_TYPES,
  RESOLUTION_POLICIES,
  CONFIDENCE_POLICIES,
  FIELD_STATUSES,
  OBJECT_STATUSES,
  VALID_DOMAINS,
  VALID_CONSUMER_WORKSPACES,
  VALID_OBJECT_CLASSES,
  VALID_DATA_TYPES,
  VALID_RESOLUTION_POLICIES,
  VALID_CONFIDENCE_POLICIES,
  VALID_OBJECT_STATUSES,
  VALID_FIELD_STATUSES,
} from '../api/registry/types.js';
import { IDENTITY_FIELDS }     from '../api/registry/fields/identity.js';
import { RIGHTS_FIELDS }       from '../api/registry/fields/rights.js';
import { CATALOG_FIELDS }      from '../api/registry/fields/catalog.js';
import { DISTRIBUTION_FIELDS } from '../api/registry/fields/distribution.js';
import { SYSTEM_OPS_FIELDS }   from '../api/registry/fields/system-ops.js';
import { MONITORING_FIELDS }   from '../api/registry/fields/monitoring.js';
import { DERIVED_FIELDS }      from '../api/registry/fields/derived.js';

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

assert('REGISTRY exports without throwing',          REGISTRY !== null && typeof REGISTRY === 'object');
assert('REGISTRY.objects is non-empty frozen array', Array.isArray(REGISTRY.objects) && REGISTRY.objects.length > 0);
assert('REGISTRY.fields is non-empty frozen array',  Array.isArray(REGISTRY.fields)  && REGISTRY.fields.length > 0);
assert('REGISTRY.version is present',                typeof REGISTRY.version === 'object');
assert('REGISTRY.fieldsByDomain is present',         typeof REGISTRY.fieldsByDomain === 'object');
assert('REGISTRY.fieldsByObject is present',         typeof REGISTRY.fieldsByObject === 'object');
assert('REGISTRY.provisionalFields is present',      Array.isArray(REGISTRY.provisionalFields));
assert('REGISTRY.provisionalFields is non-empty',    REGISTRY.provisionalFields.length > 0);

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
// 4. Object Classification (Sprint 1A — objectClass)
// ─────────────────────────────────────────────────────────────────────────────
section('4. Object Classification (objectClass)');

assert('All objects have an objectClass property',
  CANONICAL_OBJECTS.every((o) => typeof o.objectClass === 'string' && o.objectClass.length > 0)
);
assert('All objectClass values are valid (Business|Platform|Derived)',
  CANONICAL_OBJECTS.every((o) => VALID_OBJECT_CLASSES.has(o.objectClass))
);
assert('OBJECT_CLASSES has Business, Platform, Derived',
  OBJECT_CLASSES.BUSINESS === 'Business' &&
  OBJECT_CLASSES.PLATFORM === 'Platform' &&
  OBJECT_CLASSES.DERIVED  === 'Derived'
);

const businessObjects = CANONICAL_OBJECTS.filter((o) => o.objectClass === 'Business');
const platformObjects = CANONICAL_OBJECTS.filter((o) => o.objectClass === 'Platform');
const derivedObjects  = CANONICAL_OBJECTS.filter((o) => o.objectClass === 'Derived');

assert('Business objects are present (≥ 10)',  businessObjects.length >= 10);
assert('Platform objects are present (≥ 3)',   platformObjects.length >= 3);
assert('Derived objects are present (≥ 4)',    derivedObjects.length  >= 4);

assert('Artist is Business', CANONICAL_OBJECTS.find((o) => o.id === 'Artist')?.objectClass === 'Business');
assert('Scan is Platform',   CANONICAL_OBJECTS.find((o) => o.id === 'Scan')?.objectClass   === 'Platform');
assert('Alert is Derived',   CANONICAL_OBJECTS.find((o) => o.id === 'Alert')?.objectClass  === 'Derived');
assert('HealthIndicator is Derived', CANONICAL_OBJECTS.find((o) => o.id === 'HealthIndicator')?.objectClass === 'Derived');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Canonical Field Registry — structural completeness
// ─────────────────────────────────────────────────────────────────────────────
section('5. Canonical Field Registry — structure');

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
// 6. Stable Field IDs
// ─────────────────────────────────────────────────────────────────────────────
section('6. Stable Field IDs (Board-mandated)');

const canonicalIds = [
  'identity.artist_name', 'identity.artist_image', 'identity.primary_genre',
  'identity.apple_artist_id', 'identity.spotify_artist_id',
  'rights.pro', 'rights.publisher', 'rights.record_label', 'rights.distributor',
  'catalog.release_count', 'catalog.track_count', 'catalog.primary_release',
  'distribution.country_count', 'distribution.platform_count',
  'monitoring.last_scan',
  // backend.* prefix IDs remain stable even though domain moved to Identity™ (Correction #6)
  'backend.apple_verified', 'backend.spotify_verified', 'backend.catalog_match_rate',
];

for (const id of canonicalIds) {
  assert(`Canonical ID "${id}" resolves via getField()`, getField(id) !== undefined);
}

// executive.* are provisional — must NOT be in getField(), only in getProvisionalField()
assert('executive.health_score is NOT in getField() (provisional)',
  getField('executive.health_score') === undefined
);
assert('executive.health_score resolves via getProvisionalField()',
  getProvisionalField('executive.health_score') !== undefined
);
assert('executive.health_grade resolves via getProvisionalField()',
  getProvisionalField('executive.health_grade') !== undefined
);
assert('executive.priority_actions resolves via getProvisionalField()',
  getProvisionalField('executive.priority_actions') !== undefined
);
assert('executive.ai_insight resolves via getProvisionalField()',
  getProvisionalField('executive.ai_insight') !== undefined
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Domain Ownership (Sprint 1A — corrected domain names)
// ─────────────────────────────────────────────────────────────────────────────
section('7. Domain Ownership');

assert('All canonical field domains are valid', allFields.every((f) => VALID_DOMAINS.has(f.domain)));

// Consumer workspaces must never own fields
const consumerWorkspaceValues = new Set(Object.values(CONSUMER_WORKSPACES));
assert('No canonical field is owned by a Consumer Workspace', allFields.every(
  (f) => !consumerWorkspaceValues.has(f.domain)
));

// The six owning domains (Sprint 1A corrected names)
const domainCounts = {};
for (const f of allFields) {
  domainCounts[f.domain] = (domainCounts[f.domain] || 0) + 1;
}

assert('Identity™ domain has fields',              (domainCounts['Identity']               ?? 0) > 0);
assert('Music Rights™ domain has fields',          (domainCounts['Music Rights']           ?? 0) > 0);
assert('Catalog™ domain has fields',               (domainCounts['Catalog']                ?? 0) > 0);
assert('Distribution Availability™ domain has fields', (domainCounts['Distribution Availability'] ?? 0) > 0);
assert('System Operations™ domain has fields',     (domainCounts['System Operations']      ?? 0) > 0);
assert('Monitoring™ domain has fields',            (domainCounts['Monitoring']             ?? 0) > 0);

// Deprecated domain names must NOT appear
assert('Old "Global Distribution" domain has ZERO fields',   (domainCounts['Global Distribution']   ?? 0) === 0);
assert('Old "Backend Verification" domain has ZERO fields',  (domainCounts['Backend Verification']  ?? 0) === 0);
assert('Executive Intelligence domain has ZERO fields',      (domainCounts['Executive Intelligence'] ?? 0) === 0);

// DOMAINS constant reflects corrected names
assert('DOMAINS.DISTRIBUTION === "Distribution Availability"', DOMAINS.DISTRIBUTION === 'Distribution Availability');
assert('DOMAINS.SYSTEM_OPS   === "System Operations"',         DOMAINS.SYSTEM_OPS   === 'System Operations');
assert('DOMAINS has no EXECUTIVE key', !('EXECUTIVE' in DOMAINS));

// ─────────────────────────────────────────────────────────────────────────────
// 8. System Operations™ Domain (Sprint 1A — new domain)
// ─────────────────────────────────────────────────────────────────────────────
section('8. System Operations™ Domain');

assert('SYSTEM_OPS_FIELDS is a non-empty array',    Array.isArray(SYSTEM_OPS_FIELDS) && SYSTEM_OPS_FIELDS.length > 0);
assert('All SYSTEM_OPS_FIELDS have domain "System Operations"',
  SYSTEM_OPS_FIELDS.every((f) => f.domain === 'System Operations')
);
assert('All ops.* field IDs use the ops. prefix',
  SYSTEM_OPS_FIELDS.every((f) => f.id.startsWith('ops.'))
);

const opsIds = [
  'ops.evidence_completeness', 'ops.connector_status', 'ops.registry_integrity',
  'ops.verification_coverage', 'ops.scan_integrity', 'ops.provider_availability',
  'ops.infrastructure_health',
];
for (const id of opsIds) {
  assert(`System Ops field "${id}" present`, getField(id) !== undefined);
}

assert('System Ops fields do NOT contain artist/catalog fields', SYSTEM_OPS_FIELDS.every(
  (f) => !f.canonicalName.includes('artist') && !f.canonicalName.includes('catalog')
));

// ─────────────────────────────────────────────────────────────────────────────
// 9. Provisional Field Isolation (Sprint 1A)
// ─────────────────────────────────────────────────────────────────────────────
section('9. Provisional Field Isolation');

assert('DERIVED_FIELDS array is non-empty',          DERIVED_FIELDS.length > 0);
assert('REGISTRY.provisionalFields matches DERIVED_FIELDS length',
  REGISTRY.provisionalFields.length === DERIVED_FIELDS.length
);

// Provisional fields must NOT appear in canonical field set
const canonicalFieldIds = new Set(allFields.map((f) => f.id));
assert('No provisional field ID appears in canonical REGISTRY.fields',
  DERIVED_FIELDS.every((f) => !canonicalFieldIds.has(f.id))
);

// All provisional fields have status PROVISIONAL
assert('All DERIVED_FIELDS have status PROVISIONAL',
  DERIVED_FIELDS.every((f) => f.status === 'PROVISIONAL')
);

// All provisional fields have domain === null
assert('All DERIVED_FIELDS have domain === null',
  DERIVED_FIELDS.every((f) => f.domain === null)
);

// Provisional fields have known parent objects
assert('All DERIVED_FIELDS have known parentObject',
  DERIVED_FIELDS.every((f) => VALID_OBJECT_IDS.has(f.parentObject))
);

// Provisional fields have valid data types
assert('All DERIVED_FIELDS have valid dataType',
  DERIVED_FIELDS.every((f) => VALID_DATA_TYPES.has(f.dataType))
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Provisional Field Validation Layer (governed but isolated)
// ─────────────────────────────────────────────────────────────────────────────
section('10. Provisional Field Validation Layer');

const provResult = validateProvisionalFields(DERIVED_FIELDS, allFields);
assert('validateProvisionalFields returns { valid, errors, warnings }',
  typeof provResult.valid === 'boolean' &&
  Array.isArray(provResult.errors) &&
  Array.isArray(provResult.warnings)
);
assert('DERIVED_FIELDS pass provisional validation with zero errors',
  provResult.valid, provResult.errors.join('; ')
);

// P1 — duplicate provisional IDs caught
const { errors: dupProvIds } = validateProvisionalFields([
  ...DERIVED_FIELDS,
  { ...DERIVED_FIELDS[0] },
], allFields);
assert('P1: duplicate provisional field ID is caught',
  dupProvIds.some((e) => e.includes('Provisional duplicate field ID'))
);

// P2 — duplicate canonical names caught
const { errors: dupProvNames } = validateProvisionalFields([
  ...DERIVED_FIELDS,
  { ...DERIVED_FIELDS[0], id: 'executive.health_score_copy' },
], allFields);
assert('P2: duplicate provisional canonical name is caught',
  dupProvNames.some((e) => e.includes('Provisional duplicate canonical name'))
);

// P3 — unknown parent object caught
const { errors: badProvParent } = validateProvisionalFields([
  { ...DERIVED_FIELDS[0], id: 'executive.bad_parent', parentObject: 'NonexistentObject' },
], allFields);
assert('P3: unknown provisional parentObject is caught',
  badProvParent.some((e) => e.includes('unknown parentObject'))
);

// P4 — invalid data type caught
const { errors: badProvType } = validateProvisionalFields([
  { ...DERIVED_FIELDS[0], id: 'executive.bad_type', dataType: 'invalid_type' },
], allFields);
assert('P4: invalid provisional dataType is caught',
  badProvType.some((e) => e.includes('unknown dataType'))
);

// P5 — non-PROVISIONAL status caught
const { errors: badProvStatus } = validateProvisionalFields([
  { ...DERIVED_FIELDS[0], id: 'executive.bad_status', status: 'ACTIVE' },
], allFields);
assert('P5: non-PROVISIONAL status in provisional field is caught',
  badProvStatus.some((e) => e.includes('status must be "PROVISIONAL"'))
);

// P6 — non-null domain caught
const { errors: badProvDomain } = validateProvisionalFields([
  { ...DERIVED_FIELDS[0], id: 'executive.bad_domain', domain: 'Monitoring' },
], allFields);
assert('P6: assigned domain in provisional field is caught',
  badProvDomain.some((e) => e.includes('domain must be null'))
);

// P8 — ID collision with canonical field caught
const { errors: collisionErrors } = validateProvisionalFields([
  { ...DERIVED_FIELDS[0], id: 'identity.artist_name' },
], allFields);
assert('P8: provisional ID collision with canonical field is caught',
  collisionErrors.some((e) => e.includes('collides with a canonical field ID'))
);

// ─────────────────────────────────────────────────────────────────────────────
// 11. Registry Validation — passes on valid registry
// ─────────────────────────────────────────────────────────────────────────────
section('11. Registry Validation — valid registry');

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
assert('All field data types are known',    allFields.every((f) => VALID_DATA_TYPES.has(f.dataType)));
assert('All field parent objects are known', allFields.every((f) => VALID_OBJECT_IDS.has(f.parentObject)));
assert('All resolution policies are known', allFields.every((f) => VALID_RESOLUTION_POLICIES.has(f.resolutionPolicy)));
assert('All confidence policies are known', allFields.every((f) => VALID_CONFIDENCE_POLICIES.has(f.confidencePolicy)));

assert('All objects pass objectClass validation', (() => {
  const { errors: objErrors } = validateRegistry(CANONICAL_OBJECTS, allFields);
  return !objErrors.some((e) => e.includes('objectClass'));
})());

// ─────────────────────────────────────────────────────────────────────────────
// 12. Registry Validation — catches broken inputs
// ─────────────────────────────────────────────────────────────────────────────
section('12. Registry Validation — catches broken inputs');

const { errors: dupIdErrors } = validateRegistry(CANONICAL_OBJECTS, [
  ...allFields,
  { ...allFields[0] },
]);
assert('Duplicate field ID is caught', dupIdErrors.some((e) => e.includes('Duplicate field ID')));

const { errors: badDomainErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.bad_domain', domain: 'Nonexistent Domain' },
]);
assert('Unknown domain is caught', badDomainErrors.some((e) => e.includes('unknown domain')));

// Consumer workspace as field domain is caught
const { errors: wsOwnerErrors } = validateRegistry(CANONICAL_OBJECTS, [
  { ...allFields[0], id: 'test.ws_owned', domain: CONSUMER_WORKSPACES.HEALTH },
]);
assert('Consumer workspace as field domain is caught',
  wsOwnerErrors.some((e) => e.includes('consumer workspaces never own fields'))
);

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
  { ...allFields[0], id: 'identity.artist_name_duplicate' },
]);
assert('Duplicate canonical name on same parent object is caught',
  dupCanonicalErrors.some((e) => e.includes('Duplicate canonical name') || e.includes('Duplicate field ID'))
);

// Bad objectClass on an object is caught
const { errors: badClassErrors } = validateRegistry([
  ...CANONICAL_OBJECTS,
  { id: 'TestObj', objectClass: 'InvalidClass', description: 'test', version: '1.0.0', status: 'ACTIVE' },
], allFields);
assert('Unknown objectClass on object is caught',
  badClassErrors.some((e) => e.includes('unknown objectClass'))
);

// ─────────────────────────────────────────────────────────────────────────────
// 13. Registry Loader API
// ─────────────────────────────────────────────────────────────────────────────
section('13. Registry Loader API');

assert('getField("identity.artist_name") returns correct field', (() => {
  const f = getField('identity.artist_name');
  return f !== undefined && f.id === 'identity.artist_name' && f.domain === 'Identity';
})());

assert('getField("backend.apple_verified") returns Identity-owned field', (() => {
  const f = getField('backend.apple_verified');
  return f !== undefined && f.domain === 'Identity';
})());

assert('getField("ops.scan_integrity") returns System Operations field', (() => {
  const f = getField('ops.scan_integrity');
  return f !== undefined && f.domain === 'System Operations';
})());

assert('getField("executive.health_score") returns undefined (provisional)', (() => {
  return getField('executive.health_score') === undefined;
})());

assert('getProvisionalField("executive.health_score") returns the provisional field', (() => {
  const f = getProvisionalField('executive.health_score');
  return f !== undefined && f.status === 'PROVISIONAL' && f.domain === null;
})());

assert('getProvisionalField("nonexistent") returns undefined',
  getProvisionalField('nonexistent') === undefined
);

assert('getField("nonexistent.field") returns undefined', getField('nonexistent.field') === undefined);

assert('getFieldsByDomain("Identity") returns only Identity fields', (() => {
  const fs = getFieldsByDomain('Identity');
  return fs.length > 0 && fs.every((f) => f.domain === 'Identity');
})());

assert('getFieldsByDomain("System Operations") returns only System Operations fields', (() => {
  const fs = getFieldsByDomain('System Operations');
  return fs.length > 0 && fs.every((f) => f.domain === 'System Operations');
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
    'Distribution Availability', 'System Operations', 'Monitoring',
  ];
  return owningDomains.every((d) => getFieldsByDomain(d).length > 0);
})());

// ─────────────────────────────────────────────────────────────────────────────
// 14. Domain field arrays match REGISTRY.fields (Sprint 1A corrected)
// ─────────────────────────────────────────────────────────────────────────────
section('14. Domain field arrays match REGISTRY.fields');

assert('IDENTITY_FIELDS all have domain Identity',
  IDENTITY_FIELDS.every((f) => f.domain === 'Identity'));
assert('RIGHTS_FIELDS all have domain Music Rights',
  RIGHTS_FIELDS.every((f) => f.domain === 'Music Rights'));
assert('CATALOG_FIELDS all have domain Catalog',
  CATALOG_FIELDS.every((f) => f.domain === 'Catalog'));
assert('DISTRIBUTION_FIELDS all have domain Distribution Availability',
  DISTRIBUTION_FIELDS.every((f) => f.domain === 'Distribution Availability'));
assert('SYSTEM_OPS_FIELDS all have domain System Operations',
  SYSTEM_OPS_FIELDS.every((f) => f.domain === 'System Operations'));
assert('MONITORING_FIELDS all have domain Monitoring',
  MONITORING_FIELDS.every((f) => f.domain === 'Monitoring'));

// CATALOG_FIELDS includes backend.catalog_match_rate (stable ID, domain: Catalog)
assert('backend.catalog_match_rate is in CATALOG_FIELDS with domain Catalog', (() => {
  const f = CATALOG_FIELDS.find((f) => f.id === 'backend.catalog_match_rate');
  return f !== undefined && f.domain === 'Catalog';
})());

// IDENTITY_FIELDS includes all backend.* provider verification fields
assert('backend.apple_verified is in IDENTITY_FIELDS with domain Identity', (() => {
  const f = IDENTITY_FIELDS.find((f) => f.id === 'backend.apple_verified');
  return f !== undefined && f.domain === 'Identity';
})());

const totalFieldCount =
  IDENTITY_FIELDS.length + RIGHTS_FIELDS.length + CATALOG_FIELDS.length +
  DISTRIBUTION_FIELDS.length + SYSTEM_OPS_FIELDS.length + MONITORING_FIELDS.length;

assert('REGISTRY.fields count equals sum of all domain arrays',
  REGISTRY.fields.length === totalFieldCount,
  `expected ${totalFieldCount}, got ${REGISTRY.fields.length}`
);

// Provisional fields are NOT in the canonical count
assert('DERIVED_FIELDS are NOT counted in REGISTRY.fields',
  !DERIVED_FIELDS.some((df) => REGISTRY.fields.find((f) => f.id === df.id))
);

// ─────────────────────────────────────────────────────────────────────────────
// 15. Consumer Workspace / Domain separation
// ─────────────────────────────────────────────────────────────────────────────
section('15. Consumer Workspace / Domain separation');

assert('CONSUMER_WORKSPACES has Health, Backend, ATHENA, Overview, Brief, AI', (() => {
  return CONSUMER_WORKSPACES.HEALTH   === 'Health Intelligence' &&
         CONSUMER_WORKSPACES.BACKEND  === 'Backend Intelligence' &&
         CONSUMER_WORKSPACES.ATHENA   === 'ATHENA' &&
         CONSUMER_WORKSPACES.OVERVIEW === 'Executive Overview' &&
         CONSUMER_WORKSPACES.BRIEF    === 'Executive Brief' &&
         CONSUMER_WORKSPACES.AI       === 'AI Insights';
})());

assert('No Consumer Workspace value matches any Domain value', (() => {
  const domainValues = new Set(Object.values(DOMAINS));
  return Object.values(CONSUMER_WORKSPACES).every((ws) => !domainValues.has(ws));
})());

assert('VALID_CONSUMER_WORKSPACES set is correct size',
  VALID_CONSUMER_WORKSPACES.size === Object.keys(CONSUMER_WORKSPACES).length
);

assert('VALID_DOMAINS set is correct size (6 domains)',
  VALID_DOMAINS.size === 6
);

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
