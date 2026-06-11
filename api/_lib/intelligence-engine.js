// ----------------------------------------------------
//
// Royaltē Intelligence Engine™
//
// The Intelligence Engine reasons over
// Canonical Intelligence Objects™.
//
// It never invents facts.
//
// It never mutates intelligence.
//
// It produces deterministic observations
// from deterministic evidence.
//
// Consumers read observations.
//
// The Intelligence Engine owns reasoning.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Phase 5 sole purpose: project a Phase 4 Canonical Intelligence
//  Object into a deterministic engine output consisting of:
//
//    observations[]    rule-fired observations with stable ids
//    recommendations[] per-observation guidance
//    risks[]           CRITICAL + HIGH severity observation summaries
//    strengths[]       positive observations (what's working)
//    opportunities[]   MEDIUM severity observation summaries
//    coverage[]        per-CIO-section status summary
//    engineVersion     '1.0.0'
//    generatedAt       ISO timestamp (inherits cio.generatedAt when
//                      present so the engine output is deterministic
//                      whenever the CIO is)
//
//  Phase 5 NEVER:
//    - throws on any input (null, undefined, malformed)
//    - mutates the input CIO (the engine is pure)
//    - makes external calls (no I/O, no network, no DB)
//    - invokes an LLM or any model. Reasoning is rule-based and
//      deterministic.
//    - includes randomness. Same input → same output, every time.
//
//  Rule application is data-defensive: rules read CIO fields with
//  optional-chaining + Array.isArray checks, so a Phase 4 CIO (which
//  does not yet carry orphanRecordings, missingCredits, etc.) silently
//  declines to fire those rules. As Phase 6+ expands the CIO shape,
//  the same engine begins surfacing those observations automatically.
//
//  Observation ids are deterministic SHA-256 prefixes derived from
//  (type, title), so the same observation fires with the same id every
//  run — useful for downstream dedup, cron diffs, and stable URLs.

import { createHash } from 'node:crypto';
import {
  OBSERVATION_TYPES,
  SEVERITY,
  CONFIDENCE,
  ENGINE_VERSION,
  emptyEngineOutput,
} from '../schema/intelligence.js';

// ─── Internal helpers ───────────────────────────────────────────────

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

// Stable observation id from (type, title). SHA-256 prefix → 16 hex
// chars. Same observation under the same rule fires with the same id
// across runs and processes.
function obsId(type, title) {
  const hash = createHash('sha256').update(`${type}|${title}`).digest('hex');
  return `obs_${hash.substring(0, 16)}`;
}

function makeObservation({
  type, severity, confidence, title, description, recommendation,
  evidence = [], providerSources = [],
}) {
  return {
    id:              obsId(type, title),
    type,
    severity,
    confidence,
    title,
    description,
    recommendation,
    evidence:        Array.isArray(evidence) ? [...evidence] : [],
    providerSources: Array.isArray(providerSources) ? [...providerSources] : [],
  };
}

// summariseObservation: structured summary used in risks / opportunities
// arrays so downstream consumers can reference the originating
// observation by id without re-projecting it.
function summariseObservation(obs) {
  return {
    observationId: obs.id,
    type:          obs.type,
    severity:      obs.severity,
    title:         obs.title,
  };
}

// sectionCoverage: classify a CIO section by data-presence heuristics.
// Returns { status, itemCount } where status is one of
// 'POPULATED' | 'EMPTY' | 'RESERVED'. The keys argument lists the
// fields the engine treats as "populated signals" for that section.
function sectionCoverage(section, populatedKeys) {
  if (!section || typeof section !== 'object') {
    return { status: 'EMPTY', itemCount: 0 };
  }
  if (section.reserved === true) {
    return { status: 'RESERVED', itemCount: 0 };
  }
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

// Safe number / array / object accessors — never throw, always return a
// well-typed value.
const num   = (x, d = 0)   => (typeof x === 'number' && Number.isFinite(x)) ? x : d;
const arr   = (x)          => (Array.isArray(x) ? x : []);
const obj   = (x)          => (x && typeof x === 'object' && !Array.isArray(x)) ? x : {};

// ─── Public API ─────────────────────────────────────────────────────

/**
 * runIntelligenceEngine — project a Phase 4 CIO into a deterministic,
 * frozen engine output. Never throws. Never mutates the input. No
 * external calls. No LLM. No randomness.
 *
 * The engine output's `generatedAt` is inherited from `cio.generatedAt`
 * when present so callers receiving a deterministic CIO receive a
 * deterministic engine output. When the input CIO is missing or carries
 * no generatedAt, the engine stamps the current wall-clock time.
 */
export function runIntelligenceEngine(cio) {
  const output = emptyEngineOutput();

  // Defensive null guard — engine never throws, returns a valid empty
  // output for a missing or non-object CIO. Coverage[] still emits an
  // entry per section, all marked EMPTY, so consumers can iterate
  // uniformly.
  if (!cio || typeof cio !== 'object' || Array.isArray(cio)) {
    output.coverage = [
      { section: 'identity',   status: 'EMPTY', itemCount: 0 },
      { section: 'publishing', status: 'EMPTY', itemCount: 0 },
      { section: 'catalog',    status: 'EMPTY', itemCount: 0 },
      { section: 'metadata',   status: 'EMPTY', itemCount: 0 },
      { section: 'sources',    status: 'EMPTY', itemCount: 0 },
      { section: 'monitoring', status: 'EMPTY', itemCount: 0 },
      { section: 'revenue',    status: 'EMPTY', itemCount: 0 },
    ];
    return deepFreeze(output);
  }

  // Inherit generatedAt from the CIO when present so the engine output
  // is deterministic over the same CIO state.
  if (typeof cio.generatedAt === 'string' && cio.generatedAt !== '') {
    output.generatedAt = cio.generatedAt;
  }

  // ── Slice the CIO defensively ───────────────────────────────────
  const identity   = obj(cio.identity);
  const publishing = obj(cio.publishing);
  const catalog    = obj(cio.catalog);
  const metadata   = obj(cio.metadata);

  // ── IDENTITY rules ──────────────────────────────────────────────

  // Rule: duplicate DSP profiles
  const externalProfiles = arr(identity.externalProfiles);
  const providerCounts = {};
  for (const profile of externalProfiles) {
    if (profile && typeof profile.provider === 'string' && profile.provider !== '') {
      providerCounts[profile.provider] = (providerCounts[profile.provider] || 0) + 1;
    }
  }
  const duplicateProviders = Object.keys(providerCounts)
    .filter((p) => providerCounts[p] > 1)
    .sort();
  if (duplicateProviders.length > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.IDENTITY,
      severity:       SEVERITY.MEDIUM,
      confidence:     CONFIDENCE.HIGH,
      title:          'Duplicate artist profiles detected',
      description:    'Multiple distribution profiles share the same provider identifier in reviewed sources.',
      recommendation: 'Review and consolidate duplicate profiles to ensure consistent artist identity across reviewed sources.',
      evidence:       duplicateProviders.map((p) => `${p}: ${providerCounts[p]} profiles`),
      providerSources: duplicateProviders,
    }));
  }

  // Rule: artist confidence unresolved
  if (identity.artistConfidence === 'UNKNOWN') {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.IDENTITY,
      severity:       SEVERITY.LOW,
      confidence:     CONFIDENCE.MEDIUM,
      title:          'Artist identity confidence unresolved',
      description:    'The artist identity confidence has not yet resolved from reviewed sources.',
      recommendation: 'Additional verification across reviewed sources is recommended to lift identity confidence.',
      evidence:       ['artistConfidence: UNKNOWN'],
    }));
  }

  // ── CATALOG rules ───────────────────────────────────────────────

  // Recordings inventory — supports both the Phase-4 catalog.releasesCount
  // signal and the future-shape recordingIntelligence.recordings[] array.
  const recordings = arr(catalog.recordings);
  const recordingsCount = recordings.length > 0
    ? recordings.length
    : num(catalog.releasesCount, 0);

  // Rule: catalog count inconsistency across providers — fires when the
  // CIO carries a catalog.byProvider map (future shape) with at least
  // two providers reporting different counts.
  const byProvider = obj(catalog.byProvider);
  const providerCountKeys = Object.keys(byProvider).filter((k) => typeof byProvider[k] === 'number').sort();
  if (providerCountKeys.length >= 2) {
    const values = providerCountKeys.map((k) => byProvider[k]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min !== max) {
      output.observations.push(makeObservation({
        type:           OBSERVATION_TYPES.CATALOG,
        severity:       SEVERITY.MEDIUM,
        confidence:     CONFIDENCE.HIGH,
        title:          'Catalog count inconsistency detected',
        description:    'Reviewed providers report different release counts for this artist.',
        recommendation: 'Review distribution status to ensure consistent catalog delivery across reviewed sources.',
        evidence:       providerCountKeys.map((k) => `${k}: ${byProvider[k]}`),
        providerSources: providerCountKeys,
      }));
    }
  }

  // Rule: orphan recordings — recordings that exist without a release linkage
  const orphanRecordings = arr(catalog.orphanRecordings);
  if (orphanRecordings.length > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.CATALOG,
      severity:       SEVERITY.HIGH,
      confidence:     CONFIDENCE.HIGH,
      title:          'Orphan recordings detected',
      description:    'Recordings exist without corresponding release linkage in reviewed sources.',
      recommendation: 'Verify catalog delivery and confirm release linkage for the affected recordings.',
      evidence:       [`orphanCount: ${orphanRecordings.length}`],
    }));
  }

  // ── PUBLISHING rules ────────────────────────────────────────────

  const worksCount        = num(publishing.worksCount, 0);
  const writerCount       = num(publishing.writerCount, 0);
  const publisherCount    = num(publishing.publisherCount, 0);
  // Coverage is optional Phase-4 / future-shape field; treat null as
  // "unknown — do not fire coverage-conditional rules".
  const publishingCoverage = (typeof publishing.publishingCoverage === 'number')
    ? publishing.publishingCoverage
    : null;

  // Rule: low publishing coverage
  if (worksCount > 0 && publishingCoverage !== null && publishingCoverage < 80) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.PUBLISHING,
      severity:       SEVERITY.MEDIUM,
      confidence:     CONFIDENCE.MEDIUM,
      title:          'Publishing coverage appears incomplete',
      description:    'Identified compositions show publishing coverage below the typical threshold in reviewed sources.',
      recommendation: 'Review composition registrations across reviewed publishing sources.',
      evidence:       [`publishingCoverage: ${publishingCoverage}%`],
    }));
  }

  // Rule: recordings exist but no compositions
  if (worksCount === 0 && recordingsCount > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.PUBLISHING,
      severity:       SEVERITY.HIGH,
      confidence:     CONFIDENCE.HIGH,
      title:          'No publishing registrations found',
      description:    'Recordings are identified in reviewed sources but no associated composition registrations were found.',
      recommendation: 'Register compositions with a performance rights organization to claim publishing revenue.',
      evidence:       [`worksCount: 0`, `recordingsCount: ${recordingsCount}`],
    }));
  }

  // Rule: writers identified but no publishers
  if (writerCount > 0 && publisherCount === 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.PUBLISHING,
      severity:       SEVERITY.MEDIUM,
      confidence:     CONFIDENCE.MEDIUM,
      title:          'Writers identified but no publisher found',
      description:    'Writer information is present in reviewed sources but no publisher entries were identified.',
      recommendation: 'Verify publishing administration arrangements for the identified writers.',
      evidence:       [`writerCount: ${writerCount}`, `publisherCount: ${publisherCount}`],
    }));
  }

  // ── METADATA rules ──────────────────────────────────────────────

  const missingCredits       = arr(metadata.missingCredits);
  const duplicateReleases    = arr(metadata.duplicateReleases);
  const inconsistentMetadata = arr(metadata.inconsistentMetadata);

  if (missingCredits.length > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.METADATA,
      severity:       SEVERITY.LOW,
      confidence:     CONFIDENCE.HIGH,
      title:          'Missing credits detected',
      description:    'One or more credits are missing from release metadata in reviewed sources.',
      recommendation: 'Complete metadata credits with the relevant distribution partners.',
      evidence:       [`missingCount: ${missingCredits.length}`],
    }));
  }

  if (duplicateReleases.length > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.METADATA,
      severity:       SEVERITY.MEDIUM,
      confidence:     CONFIDENCE.HIGH,
      title:          'Duplicate releases detected',
      description:    'Releases appear duplicated across reviewed metadata sources.',
      recommendation: 'Audit catalog for duplicates and consolidate where appropriate.',
      evidence:       [`duplicateCount: ${duplicateReleases.length}`],
    }));
  }

  if (inconsistentMetadata.length > 0) {
    output.observations.push(makeObservation({
      type:           OBSERVATION_TYPES.METADATA,
      severity:       SEVERITY.LOW,
      confidence:     CONFIDENCE.MEDIUM,
      title:          'Metadata inconsistencies found',
      description:    'Metadata fields show inconsistencies across reviewed sources.',
      recommendation: 'Standardize metadata across reviewed distribution partners.',
      evidence:       [`inconsistencyCount: ${inconsistentMetadata.length}`],
    }));
  }

  // ── STRENGTHS (positive observations) ───────────────────────────

  if (worksCount > 0 && publishingCoverage !== null && publishingCoverage >= 80) {
    output.strengths.push(makeObservation({
      type:           OBSERVATION_TYPES.PUBLISHING,
      severity:       SEVERITY.INFO,
      confidence:     CONFIDENCE.HIGH,
      title:          'Strong publishing coverage',
      description:    'Identified compositions show strong publishing coverage in reviewed sources.',
      recommendation: 'Maintain current registration discipline.',
      evidence:       [`publishingCoverage: ${publishingCoverage}%`],
    }));
  }

  if (recordingsCount > 0 && orphanRecordings.length === 0) {
    output.strengths.push(makeObservation({
      type:           OBSERVATION_TYPES.CATALOG,
      severity:       SEVERITY.INFO,
      confidence:     CONFIDENCE.HIGH,
      title:          'Complete catalog delivery verified',
      description:    'All identified recordings have corresponding release linkage in reviewed sources.',
      recommendation: 'Continue current catalog delivery practices.',
      evidence:       [`recordingsCount: ${recordingsCount}`, 'orphanCount: 0'],
    }));
  }

  // ── RISKS / OPPORTUNITIES / RECOMMENDATIONS (derived) ───────────

  output.risks = output.observations
    .filter((o) => o.severity === SEVERITY.CRITICAL || o.severity === SEVERITY.HIGH)
    .map(summariseObservation);

  output.opportunities = output.observations
    .filter((o) => o.severity === SEVERITY.MEDIUM)
    .map(summariseObservation);

  output.recommendations = output.observations
    .filter((o) => typeof o.recommendation === 'string' && o.recommendation !== '')
    .map((o) => ({
      observationId:  o.id,
      type:           o.type,
      recommendation: o.recommendation,
    }));

  // ── COVERAGE per CIO section ────────────────────────────────────

  const coverageRows = [
    { section: 'identity',   ...sectionCoverage(cio.identity,   ['canonicalArtistName', 'externalProfiles']) },
    { section: 'publishing', ...sectionCoverage(cio.publishing, ['worksCount', 'writerIPIs', 'workRoyalteIds']) },
    { section: 'catalog',    ...sectionCoverage(cio.catalog,    ['releasesCount', 'catalogAgeYears', 'recordings']) },
    { section: 'metadata',   ...sectionCoverage(cio.metadata,   ['flagCount', 'missingCredits', 'duplicateReleases', 'inconsistentMetadata']) },
    { section: 'sources',    ...sectionCoverage(cio.sources,    ['sources']) },
    { section: 'monitoring', ...sectionCoverage(cio.monitoring, []) },
    { section: 'revenue',    ...sectionCoverage(cio.revenue,    []) },
  ];
  output.coverage = coverageRows;

  output.engineVersion = ENGINE_VERSION;

  return deepFreeze(output);
}
