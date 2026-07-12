// Canonical Intelligence Platform™ -- Executive Brief™ Engine
// Sprint 11 — Publishing layer of the Canonical Intelligence Platform™.
// Assembles platform intelligence. Never determines canonical truth.
// Never performs evidence resolution. Never performs AI reasoning.
//
// CONSTITUTIONAL CONSTRAINT: All intelligence arrives as function parameters.
// Never imports from api/evidence, api/registry, api/normalization,
// api/resolution, api/orchestrator, api/monitoring, or api/athena directly.

import { EXECUTIVE_BRIEF_ENGINE_VERSION }  from './version.js';
import { assembleExecutiveBrief }           from './assembler.js';
import { buildExecutiveSummary }            from './summary.js';
import { buildExecutiveMetrics }            from './metrics.js';
import { buildTimeline }                    from './timeline.js';
import { buildExecutiveRecommendations }    from './recommendations.js';
import { buildAllSections }                 from './sections.js';
import { formatBrief }                      from './formatting.js';
import {
  validateBrief, validateSummary, validateSections,
  validateTimeline, validateRecommendationReferences, validateFormatting,
} from './validate.js';

export function createExecutiveBriefEngine() {
  return Object.freeze({
    assemble:             (apiResponses, athenaReport) => assembleExecutiveBrief(apiResponses, athenaReport),
    buildSummary:         (apiResponses, athenaReport, metrics, timeline) => buildExecutiveSummary(apiResponses, athenaReport, metrics, timeline),
    buildMetrics:         (apiResponses, athenaReport) => buildExecutiveMetrics(apiResponses, athenaReport),
    buildTimeline:        (apiResponses, athenaReport) => buildTimeline(apiResponses, athenaReport),
    buildRecommendations: (athenaReport) => buildExecutiveRecommendations(athenaReport),
    buildSections:        (apiResponses, athenaReport, recs) => buildAllSections(apiResponses, athenaReport, recs),
    format:               (brief, format) => formatBrief(brief, format),
    validate:             (brief) => validateBrief(brief),
    engineVersion:        EXECUTIVE_BRIEF_ENGINE_VERSION,
  });
}

export const EXECUTIVE_BRIEF_ENGINE = createExecutiveBriefEngine();

// ─── Re-exports ──────────────────────────────────────────────────────────────
export { EXECUTIVE_BRIEF_ENGINE_VERSION }                                    from './version.js';
export {
  FORMAT_TYPES, FORMAT_STATUS, FORMAT_REGISTRY, VALID_FORMATS,
  formatBrief, getFormatRegistry,
}                                                                             from './formatting.js';
export { buildExecutiveMetrics }                                              from './metrics.js';
export { buildTimeline }                                                      from './timeline.js';
export { buildExecutiveSummary }                                              from './summary.js';
export { buildExecutiveRecommendations }                                      from './recommendations.js';
export {
  SECTION_TYPES, SECTION_ORDER, SECTION_STATUS,
  buildIdentitySection, buildMusicRightsSection, buildCatalogSection,
  buildDistributionSection, buildMonitoringSection, buildSystemOperationsSection,
  buildAthenaSection, buildRecommendationsSection, buildAppendixSection,
  buildAllSections,
}                                                                             from './sections.js';
export { assembleExecutiveBrief }                                             from './assembler.js';
export {
  validateBrief, validateSummary, validateSections,
  validateTimeline, validateRecommendationReferences, validateFormatting,
}                                                                             from './validate.js';
