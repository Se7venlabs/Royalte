// ----------------------------------------------------
//
// Royaltē Intelligence Engine™
//
// The Intelligence Engine executes the
// Royaltē Rule Library™ against the
// Canonical Intelligence Object™.
//
// The Rule Library owns knowledge.
//
// The CIO owns assembled intelligence.
//
// The Intelligence Engine owns execution.
//
// Consumers own presentation.
//
// The engine never invents facts.
//
// The engine never mutates intelligence.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Phase 6 sole purpose: a generic rule executor. Given a CIO and a
//  rule library, evaluate each rule's condition and project firing
//  rules into observations + derived collections (recommendations,
//  risks, strengths, opportunities, coverage).
//
//  Generic iteration — there is no `if (category === 'IDENTITY') …`
//  branch anywhere. Rules drive everything. Adding a new category, a
//  new provider, or a new domain happens only in the Rule Library.
//
//  Phase 6 NEVER:
//    - throws on any input (null CIO, null library, malformed rules,
//      throwing rule conditions). Per-rule failures silently skip the
//      offending rule; engine-level failures append an error
//      observation and return a partial output rather than throwing.
//    - mutates the input CIO or the input rule library. Both are
//      deep-cloned at entry; function references inside cloned rules
//      are preserved (functions cannot be deeply cloned in a useful
//      way, and they are read-only operations from the engine's POV).
//    - performs I/O. No fetch, no fs, no DB. Pure function.
//    - contains provider-specific knowledge. No string in this file
//      matches `\bmlc\b`, `\bspotify\b`, `\bapple\b`, `\byoutube\b`,
//      etc. Provider-specific rules live in the Rule Library.
//
//  Rule shape accepted by this engine (the Board's Phase 6 contract):
//    {
//      ruleId:          string,
//      category:        string,
//      severity:        string,
//      confidence:      string,
//      title:           string,
//      description:     string,
//      recommendation:  string,
//      condition:       (cio) => boolean,
//      evidence:        (cio) => unknown[]   |  unknown[],
//      providerSources: (cio) => unknown[]   |  unknown[],
//      polarity?:       'positive'          (caller marks for strengths)
//    }
//
//  Phase-5-library rules (which use `id` instead of `ruleId`, static
//  `providerSources` arrays, and no `evidence` field) are accepted
//  via defensive fallbacks. The engine is forward- and backward-
//  compatible with both shapes.
//
//  Determinism: observation ids are stable SHA-256 prefixes of
//  (ruleId, title). The engine output's `generatedAt` inherits
//  `cio.generatedAt` when present; identical inputs produce
//  byte-identical JSON output.

import { createHash } from 'node:crypto';
import {
  SEVERITY,
  CATEGORIES,
  ENGINE_VERSION,
  emptyEngineOutput,
  emptyObservation,
} from '../schema/intelligence.js';

// ─── Severity ranking (used for derived collections) ───────────────

const SEVERITY_RANK = Object.freeze({
  INFO:     0,
  LOW:      1,
  MEDIUM:   2,
  HIGH:     3,
  CRITICAL: 4,
});

// ─── Internal helpers ──────────────────────────────────────────────

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

// Plain-data deep clone — used for the CIO (pure JSON-safe shape).
function cloneData(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value));
}

// Rule clone — preserves function references on top of structural
// duplication so the engine's iteration sees a fresh container while
// the rule's logic remains callable.
function cloneRule(rule) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return null;
  const out = {};
  for (const key of Object.keys(rule)) {
    const value = rule[key];
    if (typeof value === 'function') {
      out[key] = value;                          // preserve reference
    } else if (value !== null && typeof value === 'object') {
      try { out[key] = JSON.parse(JSON.stringify(value)); }
      catch { out[key] = value; }                // fall back on non-serialisable
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Resolve a rule field that may be either a function `(cio) => unknown[]`
// or a static array. Failures fall back to []. Used for both `evidence`
// and `providerSources` so the engine works with both Phase 5 rules
// (static arrays) and Phase 6 rules (callable accessors).
function resolveArrayField(field, cio) {
  if (typeof field === 'function') {
    try {
      const result = field(cio);
      return Array.isArray(result) ? result : [];
    } catch { return []; }
  }
  if (Array.isArray(field)) return field;
  return [];
}

// Stable observation id from (ruleId, title). SHA-256 prefix → 16 hex
// chars. Same rule firing produces the same id across runs and
// processes (useful for downstream dedup + cron diffs).
function makeObservationId(ruleId, title) {
  const hash = createHash('sha256').update(`${ruleId}|${title}`).digest('hex');
  return `obs_${hash.substring(0, 16)}`;
}

// Resolve the rule's stable identifier. Phase 6 contract is `ruleId`;
// Phase 5 library rules ship `id`. Prefer the new name, fall back to
// the legacy one. Returns null when neither exists.
function resolveRuleId(rule) {
  if (typeof rule.ruleId === 'string' && rule.ruleId !== '') return rule.ruleId;
  if (typeof rule.id     === 'string' && rule.id     !== '') return rule.id;
  return null;
}

// Reduced summary form used by risks[] and opportunities[].
function summariseObservation(obs) {
  return {
    observationId: obs.id,
    ruleId:        obs.ruleId,
    category:      obs.category,
    severity:      obs.severity,
    title:         obs.title,
  };
}

// Coverage classification for one CIO section. POPULATED when any
// populated-key carries a non-empty value; RESERVED for explicit
// { reserved: true } placeholders; EMPTY otherwise.
function sectionCoverage(section, populatedKeys) {
  if (!section || typeof section !== 'object') return { status: 'EMPTY', itemCount: 0 };
  if (section.reserved === true) return { status: 'RESERVED', itemCount: 0 };
  let itemCount = 0;
  let populated = false;
  for (const key of populatedKeys) {
    const value = section[key];
    if (Array.isArray(value) && value.length > 0) {
      populated = true;
      itemCount = Math.max(itemCount, value.length);
    } else if (typeof value === 'number' && value > 0) {
      populated = true;
      itemCount = Math.max(itemCount, value);
    } else if (typeof value === 'string' && value !== '') {
      populated = true;
    }
  }
  return { status: populated ? 'POPULATED' : 'EMPTY', itemCount };
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * runIntelligenceEngine — execute the Rule Library against a CIO.
 *
 * Always returns a deeply-frozen, structurally-valid engine output.
 * Never throws. Pure: no I/O, no LLM, no randomness, no clock except
 * the one inherited from cio.generatedAt (or the current wall clock
 * when the CIO does not provide one).
 *
 * Generic iteration — the engine knows nothing about specific
 * categories or providers; rules drive everything.
 */
export function runIntelligenceEngine(cio, ruleLibrary) {
  const output = emptyEngineOutput();

  // ── Engine-level try/catch — never throws to the caller. ─────────
  try {
    // Step 1 + 2: deep clone the inputs so we never mutate them.
    const safeCio   = cloneData(cio);
    const safeRules = Array.isArray(ruleLibrary) ? ruleLibrary.map(cloneRule) : [];

    // Step 3: evaluate each rule in order, with per-rule deduplication
    // and isolation. Failures silently skip the offending rule.
    const seenRuleIds       = new Set();
    const positivePolarityIds = new Set();

    for (let i = 0; i < safeRules.length; i += 1) {
      const rule = safeRules[i];
      if (!rule || typeof rule !== 'object') continue;

      const ruleId = resolveRuleId(rule);
      if (ruleId === null) continue;
      if (seenRuleIds.has(ruleId)) continue;       // duplicate → skip second
      seenRuleIds.add(ruleId);

      if (typeof rule.condition !== 'function') continue;

      let fired = false;
      try { fired = rule.condition(safeCio) === true; } catch { continue; }
      if (!fired) continue;

      // Build observation
      const obs = emptyObservation();
      obs.ruleId          = ruleId;
      obs.category        = (typeof rule.category   === 'string') ? rule.category   : '';
      obs.severity        = (typeof rule.severity   === 'string') ? rule.severity   : '';
      obs.confidence      = (typeof rule.confidence === 'string') ? rule.confidence : '';
      obs.title           = (typeof rule.title      === 'string') ? rule.title      : '';
      obs.description     = (typeof rule.description === 'string') ? rule.description : '';
      obs.recommendation  = (typeof rule.recommendation === 'string') ? rule.recommendation : '';
      obs.evidence        = resolveArrayField(rule.evidence,        safeCio);
      obs.providerSources = resolveArrayField(rule.providerSources, safeCio);
      obs.id              = makeObservationId(ruleId, obs.title);

      output.observations.push(obs);

      if (rule.polarity === 'positive') positivePolarityIds.add(obs.id);
    }

    // Step 4–7: derive recommendations / risks / strengths / opportunities
    // from observations. All severity comparisons go through the
    // SEVERITY_RANK table so the engine doesn't hard-code values.

    output.recommendations = output.observations
      .filter((o) => SEVERITY_RANK[o.severity] >= SEVERITY_RANK.MEDIUM
                  && typeof o.recommendation === 'string'
                  && o.recommendation !== '')
      .map((o) => ({
        observationId:  o.id,
        ruleId:         o.ruleId,
        recommendation: o.recommendation,
      }));

    output.risks = output.observations
      .filter((o) => SEVERITY_RANK[o.severity] >= SEVERITY_RANK.HIGH)
      .map(summariseObservation);

    output.strengths = output.observations
      .filter((o) => positivePolarityIds.has(o.id));

    output.opportunities = output.observations
      .filter((o) => o.severity === SEVERITY.MEDIUM)
      .map(summariseObservation);

    // Step 8: coverage[] — one entry per CIO section.
    output.coverage = [
      { section: 'identity',   ...sectionCoverage(safeCio && safeCio.identity,   ['canonicalArtistName', 'externalProfiles']) },
      { section: 'publishing', ...sectionCoverage(safeCio && safeCio.publishing, ['worksCount', 'writerIPIs', 'workRoyalteIds']) },
      { section: 'catalog',    ...sectionCoverage(safeCio && safeCio.catalog,    ['releasesCount', 'catalogAgeYears', 'recordings']) },
      { section: 'metadata',   ...sectionCoverage(safeCio && safeCio.metadata,   ['flagCount', 'missingCredits', 'duplicateReleases', 'inconsistentMetadata']) },
      { section: 'sources',    ...sectionCoverage(safeCio && safeCio.sources,    ['sources']) },
      { section: 'monitoring', ...sectionCoverage(safeCio && safeCio.monitoring, []) },
      { section: 'revenue',    ...sectionCoverage(safeCio && safeCio.revenue,    []) },
    ];

    // Envelope
    output.engineVersion = ENGINE_VERSION;
    output.generatedAt   = (safeCio && typeof safeCio.generatedAt === 'string' && safeCio.generatedAt !== '')
      ? safeCio.generatedAt
      : new Date().toISOString();
  } catch (e) {
    // Engine-level failure: append a single error observation and
    // return whatever partial output we managed to assemble. The
    // engine still never throws to the caller.
    const errObs = emptyObservation();
    errObs.ruleId         = '_engine_error';
    errObs.category       = CATEGORIES.GENERAL;
    errObs.severity       = SEVERITY.INFO;
    errObs.confidence     = 'UNKNOWN';
    errObs.title          = 'Engine execution error';
    errObs.description    = (e && typeof e.message === 'string') ? e.message : 'unknown';
    errObs.recommendation = '';
    errObs.id             = makeObservationId(errObs.ruleId, errObs.title);
    output.observations.push(errObs);
    if (!output.engineVersion) output.engineVersion = ENGINE_VERSION;
    if (!output.generatedAt)   output.generatedAt   = new Date().toISOString();
  }

  // Step 9 + 10: deep-freeze and return.
  return deepFreeze(output);
}
