// ─── Suite 04: CIM Structural Integrity ──────────────────────────────────────
//
// Runs the full RIE pipeline on the canonical-radiohead fixture and verifies
// the output CIM satisfies every structural contract:
//  • All 12 §8.2 objects present (even if null)
//  • _certified flag is true
//  • _cimVersion is present
//  • Output is deeply frozen
//  • No accidental undefined values in non-null objects
//  • Intelligence objects have expected field types
//
// Returns: { name, passed, failed, assertions, details[] }

import { runRIE }       from '../../../lib/rie/index.js';
import { CIM_OBJECTS }  from '../../../api/schema/canonical-intelligence-model.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const FIXED_TS   = '2026-07-02T00:00:00.000Z';

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function isDeepFrozen(obj) {
  if (obj === null || typeof obj !== 'object') return true;
  if (!Object.isFrozen(obj)) return false;
  return Object.values(obj).every(v => isDeepFrozen(v));
}

function check(label, pass, note = '') {
  return { label, pass, note };
}

export async function runCimIntegrity() {
  const suite = { name: '04-cim-integrity', passed: 0, failed: 0, assertions: 0, details: [] };
  const assertions = [];

  // Load fixture
  let radiohead;
  try {
    const raw = readFileSync(
      join(__dirname, '../../../api/fixtures/canonical-radiohead.json'), 'utf8'
    );
    radiohead = JSON.parse(raw);
    assertions.push(check('canonical-radiohead fixture loads', true));
  } catch (e) {
    assertions.push(check('canonical-radiohead fixture loads', false, e.message));
    suite.failed += assertions.filter(a => !a.pass).length;
    suite.passed += assertions.filter(a => a.pass).length;
    suite.assertions += assertions.length;
    suite.details.push({ fixture: 'canonical-radiohead', status: 'ERROR', assertions });
    return suite;
  }

  // Run full RIE pipeline
  let cim;
  try {
    cim = await runRIE(
      { canonicalForEnrichment: deepClone(radiohead) },
      { now: () => FIXED_TS }
    );
    assertions.push(check('runRIE completes without throw', true));
  } catch (e) {
    assertions.push(check('runRIE completes without throw', false, e.message));
    suite.failed += assertions.filter(a => !a.pass).length;
    suite.passed += assertions.filter(a => a.pass).length;
    suite.assertions += assertions.length;
    suite.details.push({ fixture: 'canonical-radiohead', status: 'ERROR', assertions });
    return suite;
  }

  // ── §8.2 object presence ─────────────────────────────────────────────────
  for (const key of CIM_OBJECTS) {
    assertions.push(check(`§8.2: ${key} key present in CIM`, key in cim,
      `missing key: ${key}`));
  }

  // ── CIM metadata ─────────────────────────────────────────────────────────
  assertions.push(check('_certified is true',              cim._certified === true));
  assertions.push(check('_cimVersion is string',           typeof cim._cimVersion === 'string'));
  assertions.push(check('_certifiedAt is ISO string',
    typeof cim._certifiedAt === 'string' && cim._certifiedAt.includes('T')));

  // ── Deep freeze ───────────────────────────────────────────────────────────
  assertions.push(check('CIM is deeply frozen', isDeepFrozen(cim)));

  // ── health object ─────────────────────────────────────────────────────────
  // cim.health maps to the assembled health score + intelligence.
  // domainStatuses lives in healthIntelligence and is surfaced via audit.js's
  // data.canonical.healthIntelligence — it is NOT a field on cim.health in the
  // current CIM schema (Phase 3.5 known gap, tracked in MIGRATION_RETIREMENT_REGISTER).
  if (cim.health !== null) {
    assertions.push(check('health.score is number',   typeof cim.health?.score === 'number'));
    assertions.push(check('health.score in 0..100',   cim.health?.score >= 0 && cim.health?.score <= 100));
    assertions.push(check('health.grade is string',   typeof cim.health?.grade === 'string'));
    assertions.push(check('health.status is string',  typeof cim.health?.status === 'string'));
    assertions.push(check('health.identityScore is number',
      typeof cim.health?.identityScore === 'number'));
  } else {
    assertions.push(check('health: present or null (null is valid)', true,
      'health is null — RIE emitted null for this field'));
  }

  // ── identity object ───────────────────────────────────────────────────────
  // cim.identity is identityIntelligence: { providers, supportedProviders,
  // verifiedProviders, totalProviders, coverage, strengths, issues, recommendations }
  // subjectName lives in cim.scanAuthority, not cim.identity.
  if (cim.identity !== null) {
    assertions.push(check('identity.verifiedProviders is number',
      typeof cim.identity?.verifiedProviders === 'number'));
    assertions.push(check('identity.coverage is number',
      typeof cim.identity?.coverage === 'number'));
    assertions.push(check('identity.providers is object',
      typeof cim.identity?.providers === 'object'));
  } else {
    assertions.push(check('identity: present or null (null is valid)', true));
  }

  // ── scanAuthority object (subjectName lives here) ─────────────────────────
  assertions.push(check('scanAuthority.subjectName is string or null',
    typeof cim.scanAuthority?.subjectName === 'string' || cim.scanAuthority?.subjectName === null));

  // ── catalog object ────────────────────────────────────────────────────────
  if (cim.catalog !== null) {
    assertions.push(check('catalog.albums is number',     typeof cim.catalog?.albums === 'number'));
    assertions.push(check('catalog.totalTracks is number', typeof cim.catalog?.totalTracks === 'number'));
  } else {
    assertions.push(check('catalog: present or null (null is valid)', true));
  }

  // ── publishing object ────────────────────────────────────────────────────
  if (cim.publishing !== null) {
    assertions.push(check('publishing.coverageStatus is string',
      typeof cim.publishing?.coverageStatus === 'string'));
    const validCoverage = cim.publishing?.coverage === null || typeof cim.publishing?.coverage === 'number';
    assertions.push(check('publishing.coverage is number or null', validCoverage));
  } else {
    assertions.push(check('publishing: present or null (null is valid)', true));
  }

  // ── scanAuthority object ──────────────────────────────────────────────────
  assertions.push(check('scanAuthority present and non-null', cim.scanAuthority !== null));
  if (cim.scanAuthority !== null) {
    assertions.push(check('scanAuthority._cimVersion present',
      typeof cim.scanAuthority?._cimVersion === 'string'));
    assertions.push(check('scanAuthority.generatedAt present',
      typeof cim.scanAuthority?.generatedAt === 'string'));
  }

  // ── No accidental undefined (serialize round-trip) ───────────────────────
  let serialized;
  try {
    serialized = JSON.stringify(cim);
    assertions.push(check('CIM serializes to JSON without error', true));
    assertions.push(check('JSON does not contain "undefined"',
      !serialized.includes('"undefined"')));
  } catch (e) {
    assertions.push(check('CIM serializes to JSON without error', false, e.message));
  }

  const pass = assertions.filter(a => a.pass).length;
  const fail = assertions.filter(a => !a.pass).length;
  suite.passed     += pass;
  suite.failed     += fail;
  suite.assertions += assertions.length;

  suite.details.push({
    fixture:    'canonical-radiohead',
    status:     fail === 0 ? 'PASS' : 'FAIL',
    cimVersion: cim._cimVersion,
    certified:  cim._certified,
    assertions,
  });

  return suite;
}
