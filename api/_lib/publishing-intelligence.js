// ─────────────────────────────────────────────────────────────────────
//  Royaltē Publishing Intelligence™ — Assembler  (Phase 5B)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    /api/audit  →  normalizeMlcWorks()  →  addPublishingWork() to graph
//        ↓
//    Canonical Intelligence Object™  (publishing summary +
//        ↓                           publishingSources observations)
//    Rule Library™
//        ↓
//    Observations
//        ↓
//    Publishing Intelligence™  ◀── THIS MODULE
//        ↓
//    Mission Control™ · Royaltē AI™ · Executive Brief™ · Priority Actions™
//    + Royaltē Health™ (aggregates the observations this layer produces)
//
//  Phase 5B Board directive (2026-06-17):
//
//    D1 — Scope: MLC only for v1.0. Adding SOCAN / ASCAP / BMI / CISAC /
//                MusicBrainz Publishing is a future enrichment that extends
//                SUPPORTED_SOURCES + cio.observations.publishingSources
//                without changing this module's output shape.
//
//    D3 — CIO Philosophy: cio.publishing stays lean (counts + references).
//                Per-source availability lives at
//                cio.observations.publishingSources.<source>. This module
//                reads from BOTH — the summary for derived per-metric
//                state, the observations for raw source availability.
//
//    D4 — Coverage: intelligence-DERIVED, not raw scan data. Computed in
//                this module from registeredCount / totalChecked.
//                INFORMATIONAL only — never an executive score.
//
//    D5 — State vocabulary: same four-state model as Identity Intelligence™
//                (VERIFIED / ACTION_REQUIRED / NOT_FOUND / UNABLE_TO_CONFIRM).
//                AUTH_UNAVAILABLE and ERROR resolve to UNABLE_TO_CONFIRM,
//                NEVER to NOT_FOUND. Royaltē maintains one universal
//                executive state vocabulary across intelligence domains.
//
//    D7 — Phase 5B card metrics: MLC Registration, ISWC Coverage,
//                Writer Credits, Publisher Information. (MusicBrainz
//                Publishing Metadata / Composition Metadata Integrity /
//                Publishing Territory Coverage stay as static MC HTML
//                until their own intelligence domains exist.)
//
//    D8 — Output shape (the four shape keys above, plus
//                supportedSources / registeredCount / totalChecked /
//                coverage / strengths / issues / recommendations).
//
//    D9 — Health Engine Perspective (HEP): this module emits
//                observations; Royaltē Health™ aggregates them. This
//                module NEVER computes an executive score.
//
// ─────────────────────────────────────────────────────────────────────
//  Output object shape (LOCKED v1.0 — new fields require Board approval):
//
//    {
//      registrations: {
//        mlcRegistration:      PUBLISHING_STATE,
//        iswcCoverage:         PUBLISHING_STATE,
//        writerCredits:        PUBLISHING_STATE,
//        publisherInformation: PUBLISHING_STATE,
//      },
//      supportedSources:     string[],    // ['mlc'] for v1.0; future
//                                          // adapters append.
//      registeredCount:      number,      // count where state === VERIFIED
//      totalChecked:         number,      // Object.keys(registrations).length
//      coverage:             number,      // round(registered / total * 100)
//      strengths:       Array<{ metric, label }>,
//      issues:          Array<{ metric, label, ruleId, title, severity }>,
//      recommendations: Array<{ metric, label, ruleId, recommendation }>,
//    }
//
//  COVERAGE (informational, per Board D4 + D9):
//
//    coverage = round(registeredCount / totalChecked * 100)
//
//    Where registeredCount counts registrations whose state is
//    VERIFIED only. ACTION_REQUIRED, NOT_FOUND, and UNABLE_TO_CONFIRM
//    do not count. Coverage answers "How many publishing dimensions
//    look healthy?" — it is NOT a Health Score.
//
//    Score-class computation belongs exclusively to the future Royaltē
//    Health™ Engine. This module emits observations; Royaltē Health™
//    aggregates them across intelligence domains.
//
//  Determinism & purity:
//    - Pure function of (intelligenceReport, cio).
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
// ─────────────────────────────────────────────────────────────────────

export const PUBLISHING_INTELLIGENCE_VERSION = '1.0.0';

export const PUBLISHING_STATE = Object.freeze({
  VERIFIED:          'VERIFIED',
  ACTION_REQUIRED:   'ACTION_REQUIRED',
  NOT_FOUND:         'NOT_FOUND',
  UNABLE_TO_CONFIRM: 'UNABLE_TO_CONFIRM',
});

export const SUPPORTED_SOURCES = Object.freeze(['mlc']);

// The four per-MC-card-row metrics wired in Phase 5B Board D7. Each
// metric is a deterministic function of the underlying CIO publishing
// summary + observed source availability. Iteration order matches the
// Mission Control card so the renderer can iterate without a hardcoded
// list of its own.
export const REGISTRATION_METRICS = Object.freeze([
  'mlcRegistration',
  'iswcCoverage',
  'writerCredits',
  'publisherInformation',
]);

export const METRIC_LABELS = Object.freeze({
  mlcRegistration:      'MLC Registration',
  iswcCoverage:         'ISWC Coverage',
  writerCredits:        'Writer Credits',
  publisherInformation: 'Publisher Information',
});

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
      deepFreeze(v);
    }
  }
  return Object.freeze(obj);
}

function safeCio(cio) {
  return (cio && typeof cio === 'object' && !Array.isArray(cio)) ? cio : null;
}

function safeReport(report) {
  return (report && typeof report === 'object' && !Array.isArray(report)) ? report : null;
}

function getMlcObservation(cio) {
  const obs = cio?.observations?.publishingSources?.mlc;
  if (!obs || typeof obs !== 'object') return null;
  return obs;
}

function getPublishingSummary(cio) {
  const p = cio?.publishing;
  if (!p || typeof p !== 'object') return null;
  return p;
}

function getMetricObservations(report, metric) {
  if (!report || !Array.isArray(report.observations)) return [];
  const prefix = `publishing.${metric}.`;
  return report.observations.filter((o) =>
    o && typeof o.ruleId === 'string' && o.ruleId.startsWith(prefix)
  );
}

// Per-metric state derivation. Each metric is a deterministic function
// of the underlying source availability + CIO publishing summary fields.
// No metric ever invents data; missing inputs always resolve to
// UNABLE_TO_CONFIRM, never NOT_FOUND (Board D5 invariant).

function deriveMlcRegistration(mlcObs, summary) {
  if (!mlcObs) return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  const a = mlcObs.availability;
  if (a === 'AUTH_UNAVAILABLE' || a === 'ERROR' || a == null) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  if (a === 'NOT_FOUND') return PUBLISHING_STATE.NOT_FOUND;
  if (a !== 'VERIFIED')  return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  // VERIFIED upstream — confirm at least one work made it into the CIO
  if (!summary || typeof summary.worksCount !== 'number' || summary.worksCount <= 0) {
    return PUBLISHING_STATE.NOT_FOUND;
  }
  return PUBLISHING_STATE.VERIFIED;
}

function deriveIswcCoverage(mlcObs, summary) {
  if (!mlcObs) return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  const a = mlcObs.availability;
  if (a === 'AUTH_UNAVAILABLE' || a === 'ERROR' || a == null) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  if (!summary || typeof summary.worksCount !== 'number' || summary.worksCount <= 0) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  // The MLC observation may carry per-source details with iswcCount.
  // When present, derive directly; when absent we cannot judge.
  const d = mlcObs.details;
  if (!d || typeof d !== 'object' || typeof d.iswcCount !== 'number') {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  if (d.iswcCount === 0)                  return PUBLISHING_STATE.NOT_FOUND;
  if (d.iswcCount < summary.worksCount)   return PUBLISHING_STATE.ACTION_REQUIRED;
  return PUBLISHING_STATE.VERIFIED;
}

function deriveWriterCredits(mlcObs, summary) {
  if (!mlcObs) return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  const a = mlcObs.availability;
  if (a === 'AUTH_UNAVAILABLE' || a === 'ERROR' || a == null) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  if (!summary || typeof summary.worksCount !== 'number' || summary.worksCount <= 0) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  // Use cio.publishing.writerCount + cio.publishing.writerIPIs to judge.
  const writerCount = typeof summary.writerCount === 'number' ? summary.writerCount : 0;
  const iPIs        = Array.isArray(summary.writerIPIs) ? summary.writerIPIs.length : 0;
  if (writerCount === 0) return PUBLISHING_STATE.NOT_FOUND;
  // Writers present but none carry an IPI → action: complete writer
  // attribution. (Mirrors the locked Phase 5 publishing rule shape.)
  if (iPIs === 0) return PUBLISHING_STATE.ACTION_REQUIRED;
  return PUBLISHING_STATE.VERIFIED;
}

function derivePublisherInformation(mlcObs, summary) {
  if (!mlcObs) return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  const a = mlcObs.availability;
  if (a === 'AUTH_UNAVAILABLE' || a === 'ERROR' || a == null) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  if (!summary || typeof summary.worksCount !== 'number' || summary.worksCount <= 0) {
    return PUBLISHING_STATE.UNABLE_TO_CONFIRM;
  }
  // MLC adapter is documented to emit publishers: [] (MLC has no
  // publisher data). So when MLC is the only source, this metric
  // resolves to NOT_FOUND for any verified scan. When a future
  // adapter starts populating publisherCount, this flips to VERIFIED.
  const publisherCount = typeof summary.publisherCount === 'number' ? summary.publisherCount : 0;
  return publisherCount > 0 ? PUBLISHING_STATE.VERIFIED : PUBLISHING_STATE.NOT_FOUND;
}

const METRIC_DERIVERS = Object.freeze({
  mlcRegistration:      deriveMlcRegistration,
  iswcCoverage:         deriveIswcCoverage,
  writerCredits:        deriveWriterCredits,
  publisherInformation: derivePublisherInformation,
});

function computeCoverage(registrations) {
  let verified = 0;
  const total = REGISTRATION_METRICS.length;
  for (const metric of REGISTRATION_METRICS) {
    if (registrations[metric] === PUBLISHING_STATE.VERIFIED) verified += 1;
  }
  return {
    registeredCount: verified,
    totalChecked:    total,
    coverage:        total === 0 ? 0 : Math.round((verified / total) * 100),
  };
}

// assemblePublishingIntelligence(intelligenceReport, cio)
//
// Sole public entrypoint. Returns the deep-frozen Publishing
// Intelligence™ object every downstream surface consumes. Never throws.
export function assemblePublishingIntelligence(intelligenceReport, cio) {
  const safeReportRef = safeReport(intelligenceReport);
  const safeCioRef    = safeCio(cio);

  const mlcObs  = safeCioRef ? getMlcObservation(safeCioRef) : null;
  const summary = safeCioRef ? getPublishingSummary(safeCioRef) : null;

  const registrations = {};
  for (const metric of REGISTRATION_METRICS) {
    const fn = METRIC_DERIVERS[metric];
    registrations[metric] = fn(mlcObs, summary);
  }

  const strengths       = [];
  const issues          = [];
  const recommendations = [];

  for (const metric of REGISTRATION_METRICS) {
    const state = registrations[metric];
    const label = METRIC_LABELS[metric];

    if (state === PUBLISHING_STATE.VERIFIED) {
      strengths.push({ metric, label });
      continue;
    }

    if (state === PUBLISHING_STATE.ACTION_REQUIRED) {
      // Promote any fired publishing.<metric>.* rule into the
      // issues + recommendations arrays. If no rule fired but the
      // metric still resolved to ACTION_REQUIRED (derived from
      // CIO summary), surface a generic action item so the artist
      // is told something actionable rather than nothing.
      const fired = getMetricObservations(safeReportRef, metric);
      if (fired.length === 0) {
        issues.push({
          metric,
          label,
          ruleId:   null,
          title:    `${label} requires attention in reviewed sources`,
          severity: 'MEDIUM',
        });
      } else {
        for (const obs of fired) {
          issues.push({
            metric,
            label,
            ruleId:   obs.ruleId,
            title:    typeof obs.title === 'string' ? obs.title : '',
            severity: typeof obs.severity === 'string' ? obs.severity : '',
          });
          if (typeof obs.recommendation === 'string' && obs.recommendation !== '') {
            recommendations.push({
              metric,
              label,
              ruleId:         obs.ruleId,
              recommendation: obs.recommendation,
            });
          }
        }
      }
      continue;
    }

    if (state === PUBLISHING_STATE.NOT_FOUND) {
      issues.push({
        metric,
        label,
        ruleId:   null,
        title:    `${label} not confirmed in reviewed sources`,
        severity: 'MEDIUM',
      });
      continue;
    }

    // UNABLE_TO_CONFIRM: intentionally no issue, no strength.
    // We do not know — say nothing executive about it.
  }

  const { registeredCount, totalChecked, coverage } = computeCoverage(registrations);

  return deepFreeze({
    registrations: {
      mlcRegistration:      registrations.mlcRegistration,
      iswcCoverage:         registrations.iswcCoverage,
      writerCredits:        registrations.writerCredits,
      publisherInformation: registrations.publisherInformation,
    },
    supportedSources: SUPPORTED_SOURCES,
    registeredCount,
    totalChecked,
    coverage,
    strengths,
    issues,
    recommendations,
  });
}
