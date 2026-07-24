// Canonical Intelligence Platform(tm) -- Executive Intelligence Object(tm) (EIO)
//
// Phase 1 (Canonical Executive Intelligence Object(tm)) builder. The EIO is
// the one shape every future Executive surface (Ask ATHENA(tm), AI Insights(tm),
// a future Executive Briefing Hero) is meant to consume -- built once here,
// never re-derived by a UI component.
//
// Constitutional constraint (per the Phase 1 brief): sections with no real
// engine behind them yet (Forecast, Timeline, parts of Executive Memory) are
// marked `available: false` with a `reason`, never populated with invented
// data. This mirrors the Capability Matrix's KEEP/WIRE/EXTEND/RETIRE/NEW
// findings -- the EIO's shape documents platform maturity honestly rather
// than hiding the gap behind a plausible-looking value.
//
// Pure function of (athenaReport, apiResponses, options). Never mutates its
// inputs. Deep-frozen output, matching every other api/athena/* contract.

import { randomUUID, randomInt } from 'node:crypto';
import { computeConfidence }  from './confidence.js';
import { ADAPTER_VERSION }    from './runtime-context-adapter.js';
import { ATHENA_ENGINE_VERSION } from './version.js';

export const EIO_VERSION = Object.freeze({
  version:       '1.0.0',
  name:          'Executive Intelligence Object',
  effectiveDate: '2026-07-24',
});

// Executive Brief(tm) presentation version (Board addendum, 2026-07-24) --
// deliberately distinct from EIO_VERSION/ATHENA_ENGINE_VERSION. Represents
// the Executive Brief experience itself, not the schema or engine that
// produces it.
export const EXECUTIVE_BRIEF_VERSION = '2.0';

// Executive Provenance(tm) / Schema Versioning(tm) (Board addendum, 2026-07-24).
// Identifies the generating component, distinct from any engine/adapter
// version string -- lets a future second pipeline (or a manual backfill
// script) be told apart from this one in an audit.
export const EIO_GENERATED_BY = 'athena_executive_intelligence_pipeline';

const TOP_PRIORITIES_LIMIT = 5;

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = obj[key];
    if (val && typeof val === 'object' && !Object.isFrozen(val)) deepFreeze(val);
  }
  return obj;
}

// Aggregate confidence across the whole EIO. ATHENA computes confidence
// per-risk/per-opportunity (there is no existing "overall" confidence
// anywhere in api/athena/*) -- this is new, additive composition over real
// per-item confidence scores, not a new confidence algorithm.
function buildAggregateConfidence(riskAnalysis, opportunityAnalysis) {
  const items = [
    ...((riskAnalysis && riskAnalysis.risks) || []),
    ...((opportunityAnalysis && opportunityAnalysis.opportunities) || []),
  ];
  if (items.length === 0) {
    return computeConfidence({ supportingDomains: [], dataCompleteness: 0 });
  }
  const domains = [...new Set(items.map(i => i.affectedDomain).filter(Boolean))];
  const avgScore = items.reduce((sum, i) => sum + ((i.confidence && i.confidence.score) || 0), 0) / items.length;
  return computeConfidence({ supportingDomains: domains, dataCompleteness: avgScore });
}

// Source Attribution -- every recommendation already carries sourceType +
// sourceId tracing to a specific riskId/opportunityId (recommendations.js).
// This is a real, existing capability (Capability Matrix §16: "WIRE") --
// the EIO surfaces it, it does not invent it.
// Answers: "What evidence supported this?"
function buildSourceAttribution(recommendations) {
  return (recommendations || []).map(r => Object.freeze({
    recommendationId: r.recommendationId,
    sourceType:        r.sourceType,
    sourceId:           r.sourceId,
    affectedDomains:    r.affectedDomains,
    confidence:         r.confidence,
  }));
}

// Executive Brief ID(tm) (Board addendum, 2026-07-24) -- unique, immutable
// identifier for this specific Executive Intelligence assessment. Generated
// exclusively here, inside the Executive Intelligence Pipeline(tm) -- never
// in Mission Control, AI Insights(tm), or any client-side code.
//
// Format: EB-YYYY-MM-DD-XXXXXX, date from this EIO's own generatedAt
// (UTC, so the ID is traceable to the exact generation event, not wall-clock
// skew between server and caller).
//
// Honesty note (not silently glossed over): XXXXXX is a cryptographically
// random 6-digit suffix, not a true sequential counter. This pipeline is a
// stateless pure function with no persistence layer -- a real sequential
// counter requires a database, which doesn't exist for Executive Briefs yet.
// Random 6 digits (1,000,000 values/day) makes same-day collisions
// vanishingly unlikely but not database-guaranteed-unique. Phase 3's
// Executive Brief archival work (Board-flagged as a future capability this
// ID enables) is the natural place to add a real DB-backed sequence and, if
// needed, backfill this format without changing it.
export function generateExecutiveBriefId(generatedAt) {
  const d = new Date(generatedAt);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const seq = String(randomInt(0, 1000000)).padStart(6, '0');
  return `EB-${y}-${m}-${day}-${seq}`;
}

// Executive Provenance(tm) (Board addendum, 2026-07-24) -- separate from
// Source Attribution. Answers: "Which version of the Executive Intelligence
// platform generated this recommendation?" Audit/debugging metadata; not
// intended for prominent UI display per the Board's own note.
function buildRecommendationProvenance(recommendations, versions) {
  return (recommendations || []).map(r => Object.freeze({
    recommendationId: r.recommendationId,
    generatedAt:       versions.generatedAt,
    engineVersion:      versions.athenaVersion,
    schemaVersion:      versions.schemaVersion,
    confidence:         r.confidence,
    sourceDomains:      r.affectedDomains,
    generatedBy:        versions.generatedBy,
  }));
}

export function buildExecutiveIntelligenceObject(athenaReport, apiResponses = {}, options = {}) {
  if (!athenaReport || typeof athenaReport !== 'object') {
    throw new Error('buildExecutiveIntelligenceObject: athenaReport is required');
  }

  const { executiveAnalysis, riskAnalysis, opportunityAnalysis, recommendations, context } = athenaReport;
  const businessContext = executiveAnalysis && executiveAnalysis.businessContext;
  const healthSummary   = executiveAnalysis && executiveAnalysis.healthSummary;

  const topPriorities = (recommendations || [])
    .filter(r => r.priority === 'URGENT' || r.priority === 'HIGH')
    .slice(0, TOP_PRIORITIES_LIMIT);

  const generatedAt = new Date().toISOString();
  const versions = {
    generatedAt,
    generatedBy:      EIO_GENERATED_BY,
    schemaVersion:    EIO_VERSION.version,
    pipelineVersion:  options.pipelineVersion || null,
    adapterVersion:   options.adapterVersion  || ADAPTER_VERSION.version,
    athenaVersion:    ATHENA_ENGINE_VERSION.version,
    runtimeContextVersion: options.runtimeContextVersion || null,
  };

  return deepFreeze({
    eioId:      randomUUID(),
    eioVersion: EIO_VERSION.version,
    generatedAt,
    artistId:    athenaReport.executiveAnalysis?.artistId || null,
    scanId:      athenaReport.executiveAnalysis?.scanId   || null,

    // Executive Brief ID(tm) (Board addendum, 2026-07-24) -- the canonical
    // identity of this specific Executive Intelligence assessment. Immutable
    // once created; part of Executive Intelligence metadata, not a UI label.
    executiveBriefId: generateExecutiveBriefId(generatedAt),

    // Executive Briefing -- headline read, built from real businessContext +
    // healthSummary only. No comparison-to-previous-scan claim here (that
    // requires real change detection, currently only 3 of 9 domains --
    // see governance/AI_INSIGHTS_EXECUTIVE_MORNING_BRIEF_DEFERRAL.md).
    executiveBriefing: {
      artistName:      (businessContext && businessContext.artistName) || null,
      overallLevel:    (healthSummary && healthSummary.overallLevel) || null,
      riskLevel:       (healthSummary && healthSummary.riskLevel) || null,
      criticalIssues:  (healthSummary && healthSummary.criticalIssues) || 0,
      totalOpportunities: (healthSummary && healthSummary.totalOpportunities) || 0,
    },

    executiveSummary: buildExecutiveSummaryText(businessContext, healthSummary),

    topPriorities: topPriorities.map(r => r.recommendedAction),

    recommendations: recommendations || [],
    opportunities:   (opportunityAnalysis && opportunityAnalysis.opportunities) || [],
    risks:           (riskAnalysis && riskAnalysis.risks) || [],

    confidence: buildAggregateConfidence(riskAnalysis, opportunityAnalysis),

    // Forecast -- NOT built here. Capability Matrix §9: a narrative
    // "Executive Forecast" card exists in ai-insights.html today (3 fixed
    // template bullets), but no rule-based score-projection engine exists
    // anywhere. Marking unavailable rather than fabricating a projection.
    forecast: {
      available: false,
      reason: 'No score-projection engine exists yet (Capability Matrix §9: EXTEND, not built). ' +
              'ai-insights.html currently shows a fixed narrative card, not computed intelligence.',
    },

    // Timeline Summary -- NOT built here. Capability Matrix §11 explicitly
    // warns against reusing the existing mock (governance/ARTIST_PROFILE_CARD_HEALTH_SCHEMA.md's
    // hardcoded Timeline) as a starting point.
    timelineSummary: {
      available: false,
      reason: 'No real Executive Timeline(tm) engine exists (Capability Matrix §11: NEW). ' +
              'A hardcoded mock exists elsewhere in governance docs and is explicitly not reused here.',
    },

    // Executive Memory Summary -- partially real. historicalChanges is real
    // (this scan's monitoring timeline via Conversation Context(tm)), but it
    // is NOT persistent cross-session memory (goals, dismissed actions,
    // milestones) -- that does not exist anywhere yet (Capability Matrix §10).
    executiveMemorySummary: {
      available: true,
      scope: 'current_scan_monitoring_history_only',
      historicalChanges: (context && context.historicalChanges) || [],
      goals:            { available: false, reason: 'No persistent Executive Memory(tm) store exists yet.' },
      dismissedActions: { available: false, reason: 'No persistent Executive Memory(tm) store exists yet.' },
      milestones:       { available: false, reason: 'No persistent Executive Memory(tm) store exists yet.' },
    },

    businessHealthSummary: healthSummary || null,

    sourceAttribution: buildSourceAttribution(recommendations),

    // Executive Provenance(tm) (Board addendum, 2026-07-24) -- per-recommendation,
    // separate from sourceAttribution above. Audit/debugging metadata.
    provenance: buildRecommendationProvenance(recommendations, versions),

    // Executive Intelligence Schema Versioning(tm) (Board addendum, 2026-07-24).
    // Self-describing: identifies exactly how this EIO was generated, so it
    // can be audited and reproduced independent of when it's read.
    metadata: {
      schemaVersion:         versions.schemaVersion,
      generatedAt:            versions.generatedAt,
      generatedBy:             versions.generatedBy,
      pipelineVersion:         versions.pipelineVersion,
      adapterVersion:          versions.adapterVersion,
      athenaVersion:           versions.athenaVersion,
      runtimeContextVersion:   versions.runtimeContextVersion,
      // Executive Brief(tm) presentation version (Board addendum,
      // 2026-07-24) -- distinct from schemaVersion/athenaVersion above.
      executiveVersion:        EXECUTIVE_BRIEF_VERSION,
      athenaReportId:          athenaReport.athenaReportId || null,
      domainStatus: Object.fromEntries(
        Object.entries(apiResponses || {}).map(([domain, r]) => [domain, (r && r.status) || 'NOT_FOUND'])
      ),
    },
  });
}

function buildExecutiveSummaryText(businessContext, healthSummary) {
  if (!businessContext || !healthSummary) {
    return 'Executive summary unavailable -- insufficient canonical intelligence for this scan.';
  }
  const name = businessContext.artistName || 'This artist';
  const level = (healthSummary.overallLevel || 'unknown').toLowerCase();
  const critical = healthSummary.criticalIssues || 0;
  const opportunities = healthSummary.totalOpportunities || 0;
  const criticalClause = critical > 0
    ? `${critical} critical issue${critical === 1 ? '' : 's'} require${critical === 1 ? 's' : ''} attention`
    : 'no critical issues were identified';
  return `${name}'s overall business health is ${level}. ${criticalClause}. ` +
    `${opportunities} opportunit${opportunities === 1 ? 'y was' : 'ies were'} identified from reviewed sources.`;
}
