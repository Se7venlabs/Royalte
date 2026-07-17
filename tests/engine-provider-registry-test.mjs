// Engine Provider Registry™ Certification — ROYALTĒ v3.0 §1
//
// Verifies provider-acquisition/registry/EngineProviderRegistry.js against
// the Board's own rules: one entry per provider, no duplicates, every
// required field present, every PAL-migrated entry's runtime reference
// resolves to a real connector file on disk, and the registry stays a
// pure documentation layer (no runtime coupling, deep-frozen).
//
// No test runner / framework — throws on first failure, matching the
// repo's existing test-file convention.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PROVIDERS, ProviderStatus, HealthStatus, CertificationStatus, EngineGroup,
  getProvider, getProvidersByEngineGroup, getProvidersByStatus,
  getUncertifiedProviders, getUnmigratedProviders,
} from '../provider-acquisition/registry/EngineProviderRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

let passed = 0;
function assert(name, cond) {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok  ${name}`);
}

const REQUIRED_FIELDS = [
  'id', 'name', 'engineGroups', 'purpose', 'capabilityProfile', 'dataTypes',
  'authMethod', 'envVars', 'endpoints', 'rateLimits', 'runtimeReference',
  'owner', 'status', 'healthStatus', 'lastValidationDate', 'certification', 'notes',
];

console.log('\n[TEST] Structural completeness...');
{
  assert('registry is non-empty', PROVIDERS.length > 0);
  assert('registry is deep-frozen', Object.isFrozen(PROVIDERS));
  for (const p of PROVIDERS) {
    for (const field of REQUIRED_FIELDS) {
      assert(`${p.id}: has field "${field}"`, field in p);
    }
    assert(`${p.id}: frozen`, Object.isFrozen(p));
  }
}

console.log('\n[TEST] One entry per provider — no duplicates (Board Rule)...');
{
  const ids = PROVIDERS.map((p) => p.id);
  const names = PROVIDERS.map((p) => p.name);
  assert('no duplicate ids', new Set(ids).size === ids.length);
  assert('no duplicate names', new Set(names).size === names.length);
}

console.log('\n[TEST] Every provider identifies every consuming Engine Group (Board Rule)...');
{
  const validGroups = new Set(Object.values(EngineGroup));
  for (const p of PROVIDERS) {
    assert(`${p.id}: engineGroups is a non-empty array`, Array.isArray(p.engineGroups) && p.engineGroups.length > 0);
    for (const g of p.engineGroups) {
      assert(`${p.id}: engine group "${g}" is a recognized EngineGroup`, validGroups.has(g));
    }
  }
}

console.log('\n[TEST] Status / health / certification use only the declared enums...');
{
  const validStatus = new Set(Object.values(ProviderStatus));
  const validHealth = new Set(Object.values(HealthStatus));
  const validCert   = new Set(Object.values(CertificationStatus));
  for (const p of PROVIDERS) {
    assert(`${p.id}: status is a valid ProviderStatus`, validStatus.has(p.status));
    assert(`${p.id}: healthStatus is a valid HealthStatus`, validHealth.has(p.healthStatus));
    assert(`${p.id}: certification.status is a valid CertificationStatus`, validCert.has(p.certification?.status));
    assert(`${p.id}: certification.evidence is a non-empty string`, typeof p.certification?.evidence === 'string' && p.certification.evidence.length > 0);
  }
}

console.log('\n[TEST] Runtime reference traceability (Board Rule: "linked to its runtime implementation")...');
{
  for (const p of PROVIDERS) {
    assert(`${p.id}: runtimeReference is a non-empty string`, typeof p.runtimeReference === 'string' && p.runtimeReference.length > 0);
    // PAL-migrated providers must reference a connector file that exists on disk.
    if (!p.runtimeReference.includes('NOT PAL-migrated')) {
      const filePath = p.runtimeReference.split(':')[0]; // strip any :functionName suffix
      const fullPath = join(REPO_ROOT, filePath);
      assert(`${p.id}: runtime reference resolves to a real file (${filePath})`, existsSync(fullPath));
    }
  }
}

console.log('\n[TEST] Certified providers are consistent with PAL migration status...');
{
  for (const p of PROVIDERS) {
    const isMigrated = !p.runtimeReference.includes('NOT PAL-migrated');
    if (p.certification.status === CertificationStatus.CERTIFIED) {
      assert(`${p.id}: Certified implies PAL-migrated (has a real connector)`, isMigrated);
    }
    if (!isMigrated) {
      assert(`${p.id}: not-PAL-migrated providers are never marked Certified`, p.certification.status !== CertificationStatus.CERTIFIED);
    }
  }
}

console.log('\n[TEST] No governance/runtime coupling — this file never imports the runtime registry...');
{
  const src = await import('node:fs').then((fs) => fs.readFileSync(join(REPO_ROOT, 'provider-acquisition/registry/EngineProviderRegistry.js'), 'utf8'));
  assert('does not import ProviderRegistry.js', !src.includes("from './ProviderRegistry.js'") && !src.includes('from "./ProviderRegistry.js"'));
  assert('does not import RegistryEntry.js', !src.includes("from './RegistryEntry.js'") && !src.includes('from "./RegistryEntry.js"'));
}

console.log('\n[TEST] Runtime ProviderRegistry.js / RegistryEntry.js remain untouched (Board Directive)...');
{
  const runtimeRegistrySrc = await import('node:fs').then((fs) => fs.readFileSync(join(REPO_ROOT, 'provider-acquisition/registry/ProviderRegistry.js'), 'utf8'));
  const entrySrc = await import('node:fs').then((fs) => fs.readFileSync(join(REPO_ROOT, 'provider-acquisition/registry/RegistryEntry.js'), 'utf8'));
  // Structural fingerprint check — confirms the runtime files still expose
  // exactly their pre-existing shape, not a byte-for-byte diff (which would
  // be brittle against incidental formatting).
  assert('ProviderRegistry.js still exports the ProviderRegistry class', runtimeRegistrySrc.includes('export class ProviderRegistry'));
  assert('ProviderRegistry.js still has register/lookup/updateHealth/updateStatus/isEnabled/listAll',
    ['register(', 'lookup(', 'updateHealth(', 'updateStatus(', 'isEnabled(', 'listAll('].every((m) => runtimeRegistrySrc.includes(m)));
  assert('RegistryEntry.js still exports createRegistryEntry', entrySrc.includes('export function createRegistryEntry'));
  assert('RegistryEntry.js still has its original 7-field shape',
    ['name', 'version', 'capabilityProfile', 'trustValue', 'healthState', 'enabled', 'implementationStatus'].every((f) => entrySrc.includes(f)));
}

console.log('\n[TEST] Lookup helpers...');
{
  assert('getProvider returns a known provider', getProvider('apple_music')?.name === 'Apple Music');
  assert('getProvider returns null for unknown id', getProvider('nonexistent') === null);
  const territoryProviders = getProvidersByEngineGroup(EngineGroup.TERRITORY_INTELLIGENCE);
  assert('getProvidersByEngineGroup(Territory Intelligence) returns exactly Apple Music (Board Decision 1, Phase 5.2 — sole territory provider)',
    territoryProviders.length === 1 && territoryProviders[0].id === 'apple_music');
  assert('getProvidersByStatus(Active) returns every provider (none Planned/Deprecated today)', getProvidersByStatus(ProviderStatus.ACTIVE).length === PROVIDERS.length);
  assert('getUncertifiedProviders is empty (no provider is actively broken/uncertified today)', getUncertifiedProviders().length === 0);
  assert('getUnmigratedProviders identifies exactly the 3 legacy non-PAL providers',
    JSON.stringify(getUnmigratedProviders().map((p) => p.id).sort()) === JSON.stringify(['listen_notes', 'soundcloud', 'wikidata']));
}

console.log('\n[TEST] Purity — helpers never mutate the frozen registry...');
{
  const snapshot = JSON.stringify(PROVIDERS);
  getProvider('apple_music');
  getProvidersByEngineGroup(EngineGroup.IDENTITY_INTELLIGENCE);
  getProvidersByStatus(ProviderStatus.ACTIVE);
  getUncertifiedProviders();
  getUnmigratedProviders();
  assert('PROVIDERS unchanged after all lookup calls', JSON.stringify(PROVIDERS) === snapshot);
}

console.log(`\n✓ Engine Provider Registry (ROYALTĒ v3.0 §1) certified. ${passed} assertions.\n`);
