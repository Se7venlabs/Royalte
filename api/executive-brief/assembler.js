// Canonical Intelligence Platform™ -- Executive Brief™ Assembler
// Sole entrypoint for brief construction. Orchestrates all section builders.
// Deterministic: same inputs always produce structurally identical output.

import { randomUUID }                        from 'node:crypto';
import { EXECUTIVE_BRIEF_ENGINE_VERSION }     from './version.js';
import { buildExecutiveMetrics }              from './metrics.js';
import { buildTimeline }                      from './timeline.js';
import { buildExecutiveSummary }              from './summary.js';
import { buildExecutiveRecommendations }      from './recommendations.js';
import { buildAllSections }                   from './sections.js';

export function assembleExecutiveBrief(apiResponses = {}, athenaReport = null) {
  const metrics         = buildExecutiveMetrics(apiResponses, athenaReport);
  const timeline        = buildTimeline(apiResponses, athenaReport);
  const summary         = buildExecutiveSummary(apiResponses, athenaReport, metrics, timeline);
  const recommendations = buildExecutiveRecommendations(athenaReport);
  const sections        = buildAllSections(apiResponses, athenaReport, recommendations);

  return Object.freeze({
    briefId:       randomUUID(),
    version:       EXECUTIVE_BRIEF_ENGINE_VERSION.version,
    generatedAt:   new Date().toISOString(),
    summary,
    metrics,
    timeline,
    recommendations,
    sections,
    engineVersion: EXECUTIVE_BRIEF_ENGINE_VERSION,
  });
}
