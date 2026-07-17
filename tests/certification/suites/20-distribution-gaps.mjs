// ─── Suite 20: Distribution Gaps™ Certification ───────────────────────────────
//
// Board Directive 2026-07-17 — "Global Music Footprint™ — Distribution Gaps™"
//
// Verifies assembleGlobalMusicFootprint()'s new `distributionGaps` field: a
// pure derivation from the Territory Intelligence Engine's real per-territory
// evidence, added additively alongside GMF's existing v1.0 output fields.
// Fully self-contained — mocked evidence packages, no live PAL/network calls.
//
// Groups:
//   A — Presence: distributionGaps populated on the Engine primary path, null
//       on the legacy fallback and error paths (no fabrication where no
//       per-territory evidence exists to derive it from)
//   B — Count integrity: unavailable/unknown/notEvaluated/totalRequiringAttention
//       trace exactly to territoryIntelligence.summary — no drift, no re-derivation
//   C — Full territory list: ALL evaluated territories present (not just gaps),
//       including AVAILABLE — required for the drawer's "Available" filter
//   D — No fabrication: providers/reason/recommendedAction/lastVerified never
//       invent data absent from the Engine's own evidence
//   E — Determinism: same input always produces the same derived output (pure)
//   F — Status vocabulary: exactly the Board's 4-tier UI vocabulary
//       (Available/Unavailable/Unknown/Pending Review); ERROR groups into Unknown
//   G — Purity: deep-frozen, never mutates input, never throws
//
// Returns: { name, passed, failed, assertions, details[] }

import { assembleGlobalMusicFootprint } from '../../../api/_lib/global-music-footprint.js';
import { assembleTerritoryIntelligence, TerritoryState } from '../../../api/_lib/territory-intelligence.js';
import { Capability } from '../../../provider-acquisition/capability/capabilityVocabulary.js';

function check(label, pass, note = '') {
  return { label, pass, note: pass ? '' : (note || 'assertion failed') };
}

const NOW = '2026-07-17T12:00:00.000Z';

function appleEvidencePackage(storefronts, overrides = {}) {
  return {
    evidenceType: Capability.AVAILABILITY,
    contract: {
      health: { state: 'AVAILABLE' },
      acquiredAt: NOW,
      payload: { albumId: 'test-album', storefronts },
      ...overrides,
    },
  };
}

// Mixed fixture covering all five Engine states across a handful of storefronts.
const MIXED_STOREFRONTS = {
  us: { data: [{ id: 1 }] },              // AVAILABLE
  ca: { data: [{ id: 1 }] },              // AVAILABLE
  gb: { data: [] },                       // UNAVAILABLE
  de: { error: 'RATE_LIMITED' },          // ERROR
  fr: {},                                 // UNKNOWN (malformed shape)
  // every other of the 167 storefronts is absent from payload -> NOT_EVALUATED
};

function findRow(gmf, code) {
  return gmf.distributionGaps.territories.find((t) => t.code === code);
}

// ── Group A: Presence ──────────────────────────────────────────────────────

function groupA() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const primary = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);
  results.push(check('primary Engine path populates distributionGaps', primary.distributionGaps !== null && typeof primary.distributionGaps === 'object'));

  const legacy = assembleGlobalMusicFootprint(null, null, null, null);
  results.push(check('legacy fallback path (no territoryIntelligence) returns distributionGaps: null — no fabrication', legacy.distributionGaps === null));

  const legacyWithCanonical = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { details: { globalStorefrontAvailability: { available: ['us'], unavailable: ['gb'], total: 2 } } } } }, null);
  results.push(check('legacy canonical-storefront path also returns distributionGaps: null', legacyWithCanonical.distributionGaps === null));

  const errorPath = assembleGlobalMusicFootprint(undefined, undefined, { get platforms() { throw new Error('boom'); } }, engine);
  results.push(check('error path (assembly throws) returns distributionGaps: null, does not crash', errorPath.distributionGaps === null));

  return { name: 'A-presence', results };
}

// ── Group B: Count integrity ───────────────────────────────────────────────

function groupB() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const gmf = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);
  const dg = gmf.distributionGaps;

  results.push(check('unavailable count traces exactly to engine.summary.unavailable',
    dg.unavailable === engine.summary.unavailable));
  results.push(check('unknown count is engine.summary.unknown + engine.summary.error (grouped, no separate Error tier)',
    dg.unknown === (engine.summary.unknown + engine.summary.error)));
  results.push(check('notEvaluated count traces exactly to engine.summary.notEvaluated',
    dg.notEvaluated === engine.summary.notEvaluated));
  results.push(check('totalRequiringAttention === unavailable + unknown + notEvaluated (no double count, no drift)',
    dg.totalRequiringAttention === dg.unavailable + dg.unknown + dg.notEvaluated));
  results.push(check('totalRequiringAttention === territories.length - available count',
    dg.totalRequiringAttention === dg.territories.length - engine.summary.available));

  return { name: 'B-count-integrity', results };
}

// ── Group C: Full territory list ───────────────────────────────────────────

function groupC() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const gmf = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);

  results.push(check('territories array includes all 167 evaluated territories, not just gaps',
    gmf.distributionGaps.territories.length === 167, `got ${gmf.distributionGaps.territories.length}`));
  results.push(check('AVAILABLE territories are present in the list (required for the drawer "Available" filter)',
    gmf.distributionGaps.territories.some((t) => t.status === 'Available')));
  results.push(check('territories.length matches engine.territories.length exactly',
    gmf.distributionGaps.territories.length === engine.territories.length));

  return { name: 'C-full-territory-list', results };
}

// ── Group D: No fabrication ────────────────────────────────────────────────

function groupD() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const gmf = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);

  const us = findRow(gmf, 'us'); // AVAILABLE
  results.push(check('AVAILABLE territory: providers reflects real evidence (apple_music), not the full platform roster',
    JSON.stringify(us.providers) === JSON.stringify(['apple_music'])));
  results.push(check('AVAILABLE territory: recommendedAction is null — no action fabricated where none applies',
    us.recommendedAction === null));
  results.push(check('AVAILABLE territory: lastVerified is the real acquiredAt timestamp, not a fabricated date',
    us.lastVerified === NOW));

  const jp = findRow(gmf, 'jp'); // absent from payload -> NOT_EVALUATED
  results.push(check('NOT_EVALUATED territory: providers is empty — no provider was ever consulted',
    Array.isArray(jp.providers) && jp.providers.length === 0));
  results.push(check('NOT_EVALUATED territory: lastVerified is null, never a fabricated "not yet checked" date',
    jp.lastVerified === null));
  results.push(check('NOT_EVALUATED territory: reason is honest about absence of evaluation',
    jp.reason === 'Not yet evaluated for this territory'));

  const de = findRow(gmf, 'de'); // ERROR (provider_request_failed)
  results.push(check('ERROR territory: reason reflects the real reasonCode, not a generic placeholder',
    de.reason === 'Provider request failed during acquisition'));
  results.push(check('ERROR territory: recommendedAction is keyed off the real reasonCode',
    de.recommendedAction === 'Re-run scan — the provider request failed and can be retried.'));

  // No evidence packages at all -> every territory NOT_EVALUATED, zero fabrication anywhere
  const emptyEngine = assembleTerritoryIntelligence([]);
  const emptyGmf = assembleGlobalMusicFootprint(null, null, null, emptyEngine);
  results.push(check('no evidence at all: every territory has empty providers array',
    emptyGmf.distributionGaps.territories.every((t) => t.providers.length === 0)));
  results.push(check('no evidence at all: every territory has null lastVerified',
    emptyGmf.distributionGaps.territories.every((t) => t.lastVerified === null)));
  results.push(check('no evidence at all: no territory status is fabricated as Available or Unavailable',
    emptyGmf.distributionGaps.territories.every((t) => t.status === 'Pending Review')));

  return { name: 'D-no-fabrication', results };
}

// ── Group E: Determinism ───────────────────────────────────────────────────

function groupE() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const run1 = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);
  const run2 = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);

  results.push(check('identical input produces identical distributionGaps counts (pure function)',
    JSON.stringify({ t: run1.distributionGaps.totalRequiringAttention, u: run1.distributionGaps.unavailable, k: run1.distributionGaps.unknown, n: run1.distributionGaps.notEvaluated })
    === JSON.stringify({ t: run2.distributionGaps.totalRequiringAttention, u: run2.distributionGaps.unavailable, k: run2.distributionGaps.unknown, n: run2.distributionGaps.notEvaluated })));
  results.push(check('identical input produces byte-identical territories array',
    JSON.stringify(run1.distributionGaps.territories) === JSON.stringify(run2.distributionGaps.territories)));

  return { name: 'E-determinism', results };
}

// ── Group F: Status vocabulary ─────────────────────────────────────────────

function groupF() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const gmf = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);

  const allowedStatuses = new Set(['Available', 'Unavailable', 'Unknown', 'Pending Review']);
  results.push(check('every territory status is one of the Board\'s exact 4-tier vocabulary (no "Error" tier leaked into the UI)',
    gmf.distributionGaps.territories.every((t) => allowedStatuses.has(t.status))));

  results.push(check('gb (confirmed-empty catalog) maps to "Unavailable"', findRow(gmf, 'gb').status === 'Unavailable'));
  results.push(check('de (ERROR/provider_request_failed) maps to "Unknown", not a separate Error tier', findRow(gmf, 'de').status === 'Unknown'));
  results.push(check('fr (UNKNOWN/malformed shape) maps to "Unknown"', findRow(gmf, 'fr').status === 'Unknown'));
  results.push(check('jp (NOT_EVALUATED) maps to "Pending Review"', findRow(gmf, 'jp').status === 'Pending Review'));
  results.push(check('us (AVAILABLE) maps to "Available"', findRow(gmf, 'us').status === 'Available'));

  return { name: 'F-status-vocabulary', results };
}

// ── Group G: Purity ─────────────────────────────────────────────────────────

function groupG() {
  const results = [];

  const engine = assembleTerritoryIntelligence([appleEvidencePackage(MIXED_STOREFRONTS)]);
  const engineSnapshot = JSON.stringify(engine);
  const gmf = assembleGlobalMusicFootprint(null, null, { platforms: { appleMusic: { availability: 'VERIFIED' } } }, engine);

  results.push(check('territoryIntelligence input is not mutated', JSON.stringify(engine) === engineSnapshot));
  results.push(check('distributionGaps is deep-frozen', Object.isFrozen(gmf.distributionGaps)));
  results.push(check('distributionGaps.territories array is frozen', Object.isFrozen(gmf.distributionGaps.territories)));
  results.push(check('distributionGaps.territories[0] is frozen', Object.isFrozen(gmf.distributionGaps.territories[0])));

  results.push(check('malformed territoryIntelligence (string) does not throw', (() => {
    try { assembleGlobalMusicFootprint(null, null, null, 'not-an-object'); return true; } catch { return false; }
  })()));
  results.push(check('malformed territoryIntelligence (territories not an array) does not throw and yields distributionGaps: null', (() => {
    try {
      const r = assembleGlobalMusicFootprint(null, null, null, { summary: {}, territories: 'nope' });
      return r.distributionGaps === null;
    } catch { return false; }
  })()));

  return { name: 'G-purity', results };
}

// ── Suite runner ──────────────────────────────────────────────────────────────

export async function runDistributionGaps() {
  const groups = [groupA(), groupB(), groupC(), groupD(), groupE(), groupF(), groupG()];

  let passed = 0, failed = 0;
  const details = [];

  for (const group of groups) {
    for (const r of group.results) {
      if (r.pass) passed++;
      else failed++;
      details.push({ group: group.name, label: r.label, status: r.pass ? 'PASS' : 'FAIL', note: r.note });
    }
  }

  return {
    name:       '20-distribution-gaps',
    passed,
    failed,
    assertions: passed + failed,
    details,
  };
}
