// ----------------------------------------------------
//
// Royaltē Executive Brief Engine™
//
// The Executive Brief Engine™ transforms
// Royaltē Health Reports™ into executive
// intelligence.
//
// It owns language.
//
// It does NOT own presentation.
//
// It does NOT own layout.
//
// It does NOT own design.
//
// It never invents intelligence.
//
// It never mutates input.
//
// Identical input → identical output. Always.
//
// ----------------------------------------------------
//
//  IMPLEMENTATION NOTES (not part of the constitutional header above)
//
//  Phase 8 sole purpose: deterministic projection of a Royaltē Health
//  Report into a Royaltē Executive Brief. Pure function. No I/O.
//  No clock except `healthReport.generatedAt` (inherited verbatim).
//  Output is deep-frozen.
//
//  Input shape contract:
//
//    The Phase 7 HealthReport carries only summary fields + counts
//    (strengthCount, riskCount, opportunityCount, recommendationCount).
//    The actual `strengths[]`, `risks[]`, `opportunities[]`, and
//    `recommendations[]` arrays live on the Phase 6 IntelligenceReport
//    that produced the HealthReport.
//
//    Callers pass an "enriched" HealthReport — the Phase 7 HealthReport
//    bundled with the Phase 6 engine's upstream arrays:
//      { ...healthReport,
//        strengths,        // engineOutput.strengths
//        risks,            // engineOutput.risks
//        opportunities,    // engineOutput.opportunities
//        recommendations,  // engineOutput.recommendations
//        observations }    // engineOutput.observations (for severity
//                          // cross-reference of recommendations)
//
//    All five upstream arrays are OPTIONAL. When absent, the engine
//    produces a structurally-valid brief with empty top-N sections;
//    the summary / narrative / confidence / next-step strings still
//    derive from the HealthReport's scalar fields.
//
//    The engine NEVER invents an entry that is not present in the
//    upstream arrays. priorityActions are sourced ONLY from
//    recommendations[]; topStrengths/topRisks/topOpportunities are
//    sourced ONLY from their respective arrays.
//
//  The engine NEVER:
//    - throws on any input (single try/catch wraps the entire body)
//    - mutates `healthReport` or any upstream array
//    - performs I/O. No fetch, no fs, no DB. No LLM. No randomness.
//    - calls providers. Pure language projection.

import {
  BRIEF_VERSION,
  HEALTH_HEADLINES,
  RECOMMENDED_NEXT_STEPS,
  emptyBrief,
} from '../schema/executive-brief.js';

// ─── Severity ranking (deterministic ordering) ─────────────────────

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
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function safeArray(x) { return Array.isArray(x) ? x : []; }
function safeString(x) { return typeof x === 'string' ? x : ''; }
function safeNumber(x) { return (typeof x === 'number' && Number.isFinite(x)) ? x : 0; }

function truncateToWords(s, max) {
  const words = safeString(s).trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  return words.slice(0, max).join(' ');
}

// ─── Sort + cap helpers (never invent, never mutate input) ────────

// Sort risks by severity desc (CRITICAL first), then deterministic
// tiebreakers (category, title) for stable identical-input-identical-
// output behaviour.
function sortRisks(risks) {
  return [...risks].sort((a, b) => {
    const sa = SEVERITY_RANK[safeString(a && a.severity)] || 0;
    const sb = SEVERITY_RANK[safeString(b && b.severity)] || 0;
    if (sb !== sa) return sb - sa;
    const ca = safeString(a && a.category);
    const cb = safeString(b && b.category);
    if (ca !== cb) return ca < cb ? -1 : 1;
    const ta = safeString(a && a.title);
    const tb = safeString(b && b.title);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

// Sort strengths / opportunities by category then title — all
// strengths share severity (INFO, polarity:'positive') and all
// opportunities share severity (MEDIUM), so the deterministic order
// is fully determined by category + title.
function sortByCategoryThenTitle(items) {
  return [...items].sort((a, b) => {
    const ca = safeString(a && a.category);
    const cb = safeString(b && b.category);
    if (ca !== cb) return ca < cb ? -1 : 1;
    const ta = safeString(a && a.title);
    const tb = safeString(b && b.title);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

// Sort recommendations by source-observation severity desc, falling
// back to ruleId for determinism. Looks up severity via observationId
// when observations[] is supplied; otherwise treats all severities as
// equal and preserves rule-id ordering.
function sortRecommendations(recommendations, observations) {
  const obsMap = new Map();
  for (const o of observations) {
    if (o && typeof o.id === 'string') obsMap.set(o.id, o);
  }
  return [...recommendations].sort((a, b) => {
    const oa = (a && a.observationId) ? obsMap.get(a.observationId) : null;
    const ob = (b && b.observationId) ? obsMap.get(b.observationId) : null;
    const sa = oa ? (SEVERITY_RANK[safeString(oa.severity)] || 0) : 0;
    const sb = ob ? (SEVERITY_RANK[safeString(ob.severity)] || 0) : 0;
    if (sb !== sa) return sb - sa;
    const ra = safeString(a && a.ruleId);
    const rb = safeString(b && b.ruleId);
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });
}

// ─── Language builders (template-driven, deterministic) ───────────

// Executive summary — max 300 words.
function buildExecutiveSummary(report) {
  const score = safeNumber(report.overallScore);
  const grade = safeString(report.overallGrade);
  const label = HEALTH_HEADLINES[grade] || '';

  const identity   = safeNumber(report.identityScore);
  const publishing = safeNumber(report.publishingScore);
  const catalog    = safeNumber(report.catalogScore);
  const metadata   = safeNumber(report.metadataScore);
  const coverage   = safeNumber(report.coverageScore);
  const confidence = safeNumber(report.confidenceScore);

  const strengthCount      = safeNumber(report.strengthCount);
  const riskCount          = safeNumber(report.riskCount);
  const opportunityCount   = safeNumber(report.opportunityCount);

  const subject = safeString(report.artistName) !== ''
    ? `${report.artistName}'s music backend infrastructure`
    : 'Your music backend infrastructure';

  const categorySummary =
    `Identity scored ${identity}, publishing ${publishing}, catalog ${catalog}, ` +
    `and metadata ${metadata}, with coverage at ${coverage} and confidence at ${confidence}`;

  const riskSentence = riskCount > 0
    ? `${riskCount} risk${riskCount === 1 ? '' : 's'} require executive attention, ` +
      `alongside ${strengthCount} documented strength${strengthCount === 1 ? '' : 's'} ` +
      `and ${opportunityCount} opportunit${opportunityCount === 1 ? 'y' : 'ies'} for further improvement`
    : `${strengthCount} documented strength${strengthCount === 1 ? '' : 's'} reinforce a stable foundation, ` +
      `with ${opportunityCount} opportunit${opportunityCount === 1 ? 'y' : 'ies'} identified for further improvement`;

  const outlook = buildOutlookClause(grade);

  const summary =
    `${subject} has been assessed and received an overall Health Score of ${score}/100, ` +
    `rated ${grade} — ${label}. ${categorySummary}. ${riskSentence}. ${outlook}.`;

  return truncateToWords(summary, 300);
}

function buildOutlookClause(grade) {
  if (grade === 'A+' || grade === 'A') return 'The outlook is strong, with the infrastructure positioned to compound value over time';
  if (grade === 'B') return 'The outlook is positive, with focused work on the noted gaps positioning the catalog for sustained growth';
  if (grade === 'C') return 'The outlook is acceptable, but addressing the noted gaps is necessary to unlock further value';
  if (grade === 'D') return 'The outlook depends on resolving the identified gaps before they materially impact revenue';
  return 'The outlook requires immediate executive action to prevent further value erosion';
}

// Executive narrative — max 150 words.
function buildExecutiveNarrative(report, topRisksList, topOpportunitiesList) {
  const grade = safeString(report.overallGrade);
  const score = safeNumber(report.overallScore);
  const recCount = safeNumber(report.recommendationCount);

  const maturity = buildMaturityClause(grade, score);

  const primaryRisk = topRisksList.length > 0
    ? `The primary risk identified is ${safeString(topRisksList[0].title) || 'an unresolved infrastructure issue'} ` +
      `in the ${safeString(topRisksList[0].category).toLowerCase() || 'reviewed'} domain`
    : 'No material risks have been identified in the current assessment';

  const primaryOpportunity = topOpportunitiesList.length > 0
    ? `The primary opportunity available is ${safeString(topOpportunitiesList[0].title) || 'further refinement'} ` +
      `in the ${safeString(topOpportunitiesList[0].category).toLowerCase() || 'reviewed'} domain`
    : 'Optimisation opportunities are limited under current conditions';

  const longTerm = buildLongTermClause(grade, recCount);

  const narrative = `${maturity}. ${primaryRisk}. ${primaryOpportunity}. ${longTerm}.`;
  return truncateToWords(narrative, 150);
}

function buildMaturityClause(grade, score) {
  if (grade === 'A+') return `The backend infrastructure reflects world-class maturity at a Health Score of ${score}`;
  if (grade === 'A')  return `The backend infrastructure reflects excellent maturity at a Health Score of ${score}`;
  if (grade === 'B')  return `The backend infrastructure reflects strong maturity at a Health Score of ${score}, with minor gaps`;
  if (grade === 'C')  return `The backend infrastructure reflects developing maturity at a Health Score of ${score}, with material gaps`;
  if (grade === 'D')  return `The backend infrastructure reflects significant maturity gaps at a Health Score of ${score}`;
  return `The backend infrastructure reflects critical maturity deficiencies at a Health Score of ${score}`;
}

function buildLongTermClause(grade, recCount) {
  if (grade === 'A+' || grade === 'A') return 'Long term, the infrastructure is positioned to compound value with minimal intervention';
  if (grade === 'B') return `Long term, executing the ${recCount} priority recommendation${recCount === 1 ? '' : 's'} will harden the foundation`;
  if (grade === 'C') return `Long term, completing the ${recCount} recommendation${recCount === 1 ? '' : 's'} is necessary to reach a defensible posture`;
  if (grade === 'D') return `Long term, immediate work on the ${recCount} recommendation${recCount === 1 ? '' : 's'} is needed to avoid revenue impact`;
  return `Long term, urgent remediation of the ${recCount} recommendation${recCount === 1 ? '' : 's'} is required`;
}

// Confidence statement — derived from confidenceScore bucket.
// Bands chosen to match the Phase 7 confidence-score derivation
// (starts at 50, +10 per HIGH, -5 per UNKNOWN, clamped [0,100]):
//   >=75 → HIGH (multiple HIGH-confidence observations)
//   >=50 → MEDIUM (baseline or modest positive signal)
//   >=25 → LOW (negative signal dominates)
//   <25  → UNKNOWN
function buildConfidenceStatement(confidenceScore) {
  const n = (typeof confidenceScore === 'number' && Number.isFinite(confidenceScore)) ? confidenceScore : -1;
  if (n >= 75) return 'This assessment is based on verified intelligence from multiple sources.';
  if (n >= 50) return 'This assessment is based on partially verified intelligence.';
  if (n >= 25) return 'This assessment is based on limited available intelligence.';
  return 'Confidence level has not yet been determined for this assessment.';
}

// Recommended next step — deterministic lookup from RECOMMENDED_NEXT_STEPS
// keyed on the top risk's category (lowercased). Falls back to 'default'
// when no top risk is present or the category is unrecognised.
function recommendedNextStepFor(topRisksList) {
  if (topRisksList.length === 0) return RECOMMENDED_NEXT_STEPS.default;
  const cat = safeString(topRisksList[0].category).toLowerCase();
  return RECOMMENDED_NEXT_STEPS[cat] || RECOMMENDED_NEXT_STEPS.default;
}

// AI executive insight — template-driven; max 120 words.
function buildAiExecutiveInsight(report, topStrengthsList, topRisksList, nextStep) {
  const grade = safeString(report.overallGrade);
  const score = safeNumber(report.overallScore);

  const strengthSummary = topStrengthsList.length > 0
    ? `verifiable strength in ${safeString(topStrengthsList[0].category).toLowerCase() || 'reviewed categories'}`
    : 'consistent performance across reviewed categories';

  const riskSummary = topRisksList.length > 0
    ? `${safeString(topRisksList[0].title) || 'an unresolved issue'} ` +
      `in the ${safeString(topRisksList[0].category).toLowerCase() || 'reviewed'} domain`
    : 'no material risks at this time';

  const outlook = (grade === 'A+' || grade === 'A')
    ? `The catalog is well positioned to compound value at its current Health Score of ${score}`
    : (grade === 'B' || grade === 'C')
      ? `Executing the recommended next step will materially improve the Health Score from ${score}`
      : `Immediate executive action is required to recover from a Health Score of ${score}`;

  const insight =
    `Based on the intelligence assembled, this catalog demonstrates ${strengthSummary}. ` +
    `The primary area requiring executive attention is ${riskSummary}. ` +
    `Addressing "${nextStep}" would materially improve backend infrastructure health. ${outlook}.`;

  return truncateToWords(insight, 120);
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * generateExecutiveBrief — project canonical Health intelligence into a
 * Royaltē Executive Brief.
 *
 * Signature: generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth)
 *
 *   cio               — Canonical Intelligence Object; owns artistName.
 *   intelligenceReport — Intelligence Engine output; the sole owner of
 *                        all intelligence arrays (strengths, risks,
 *                        opportunities, recommendations, observations).
 *   healthReport      — generateHealthReport() output; the sole owner of
 *                        presentation metadata (generatedAt, trend,
 *                        confidence text).
 *   canonicalHealth   — computeHealthScore() output, computed ONCE by the
 *                        orchestrator (api/audit.js) and passed in. Owns
 *                        all score and grade fields. The brief never
 *                        calls computeHealthScore() itself.
 *
 * Always returns a deeply-frozen, structurally-valid brief.
 * Never throws. Pure: no I/O, no LLM, no randomness, no wall clock.
 *
 * Top-N sections are sourced exclusively from intelligenceReport arrays.
 * No fallback to other layers. Fail closed on missing required inputs.
 */
export function generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth) {
  const brief = emptyBrief();

  try {
    // Helper: a valid pipeline object is a non-null, non-array plain object.
    const isValidObj = (x) => x !== null && x !== undefined
      && typeof x === 'object' && !Array.isArray(x);

    // Fail closed: both canonicalHealth and intelligenceReport must be
    // present and well-formed. Missing either → return empty brief.
    // Never silently substitute arrays from a different layer.
    if (!isValidObj(canonicalHealth) || !isValidObj(intelligenceReport)) {
      return deepFreeze(brief);
    }

    // Health Report is the sole owner of presentation metadata.
    brief.generatedAt = safeString(healthReport?.generatedAt);

    // Arrays come exclusively from intelligenceReport — the sole owner of
    // intelligence observations. No fallback to other layers.
    const strengths       = safeArray(intelligenceReport.strengths);
    const risks           = safeArray(intelligenceReport.risks);
    const opportunities   = safeArray(intelligenceReport.opportunities);
    const recommendations = safeArray(intelligenceReport.recommendations);
    const observations    = safeArray(intelligenceReport.observations);

    // Top-N projections (sorted + capped at 5).
    const topStrengthsList     = sortByCategoryThenTitle(strengths).slice(0, 5);
    const topRisksList         = sortRisks(risks).slice(0, 5);
    const topOpportunitiesList = sortByCategoryThenTitle(opportunities).slice(0, 5);
    const priorityActionsList  = sortRecommendations(recommendations, observations).slice(0, 5);

    // Build enriched object for internal language builders.
    // canonicalHealth provides all score fields; CIO supplies artistName.
    const enrichedForBuilders = Object.assign(Object.create(null), canonicalHealth, {
      artistName: isValidObj(cio)
        ? safeString(cio.canonicalArtistName) || safeString(cio.identity?.name)
        : '',
    });

    // Language sections.
    brief.healthHeadline      = HEALTH_HEADLINES[safeString(canonicalHealth.overallGrade)] || '';
    brief.executiveSummary    = buildExecutiveSummary(enrichedForBuilders);
    brief.executiveNarrative  = buildExecutiveNarrative(enrichedForBuilders, topRisksList, topOpportunitiesList);
    brief.topStrengths        = topStrengthsList;
    brief.topRisks            = topRisksList;
    brief.topOpportunities    = topOpportunitiesList;
    brief.priorityActions     = priorityActionsList;
    brief.confidenceStatement = buildConfidenceStatement(canonicalHealth.confidenceScore);
    brief.recommendedNextStep = recommendedNextStepFor(topRisksList);
    brief.aiExecutiveInsight  = buildAiExecutiveInsight(enrichedForBuilders, topStrengthsList, topRisksList, brief.recommendedNextStep);

    // Reserved sections remain null until future phases populate them.
    // Already set by emptyBrief(); no mutation here.
  } catch (_e) {
    // Engine-level failure: return whatever partial state we have.
  }

  return deepFreeze(brief);
}

// Re-export schema constants for consumer convenience.
export { BRIEF_VERSION, HEALTH_HEADLINES, RECOMMENDED_NEXT_STEPS, emptyBrief };
