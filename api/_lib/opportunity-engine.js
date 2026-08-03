// Executive Opportunity Engine™ — Phase 4B
//
// Pure orchestrator. Given an artist's rankable Playbook Actions and their
// Playbook Definitions, computes each action's Opportunity Score (via
// opportunity-scoring-engine.js), assigns its Executive Roadmap™ band,
// flags Quick Wins™, ranks the full set (with deterministic tie-breaking),
// and returns the grouped Roadmap. No I/O, no persistence -- that is
// api/_lib/opportunity-store.js's job, which calls this engine and writes
// its output.
//
// Canonical Ownership™: this file owns RANKING (scoring + banding +
// ordering many actions against each other). It never touches
// playbook_actions/playbook_action_history, and never talks to Supabase.

import { computeOpportunityScore, computeBand, isQuickWin } from './opportunity-scoring-engine.js';
import { explainOpportunity } from './opportunity-explain.js';
import { RANKABLE_STATUSES, EVIDENCE_CONFIDENCE_RANK, OPPORTUNITY_SCORING_VERSION } from '../schema/opportunity.js';

function tieBreakKey(action) {
  const confidenceRank = EVIDENCE_CONFIDENCE_RANK[action.evidence_confidence] ?? 0;
  const minutes = (action.definition && typeof action.definition.metrics?.estimatedMinutes === 'number')
    ? action.definition.metrics.estimatedMinutes
    : Infinity;
  const actionNumber = typeof action.action_number === 'number' ? action.action_number : Infinity;
  return { confidenceRank, minutes, actionNumber };
}

function compareScored(a, b) {
  if (b.score !== a.score) return b.score - a.score; // higher score first
  const ka = tieBreakKey(a.action);
  const kb = tieBreakKey(b.action);
  if (kb.confidenceRank !== ka.confidenceRank) return kb.confidenceRank - ka.confidenceRank; // higher confidence first
  if (ka.minutes !== kb.minutes) return ka.minutes - kb.minutes; // faster first
  return ka.actionNumber - kb.actionNumber; // stable fallback
}

// rankOpportunities(actionsWithDefinitions) -> { doNow, doNext, doLater, quickWins, all }
//
// `actionsWithDefinitions` is an array of { action, definition } pairs,
// already filtered by the caller to RANKABLE_STATUSES (this function does
// not re-filter -- it re-exports RANKABLE_STATUSES for the caller's
// convenience so there is exactly one source of truth for the list).
export function rankOpportunities(actionsWithDefinitions) {
  const scored = (actionsWithDefinitions || []).map(({ action, definition }) => {
    const { score, factorBreakdown } = computeOpportunityScore(action, definition);
    const quickWin = isQuickWin(definition, action);
    const band = quickWin ? 'DO_NOW' : computeBand(score);
    return { action: { ...action, definition }, definition, score, band, isQuickWin: quickWin, factorBreakdown };
  });

  scored.sort(compareScored);

  const all = scored.map((item, index) => {
    const rank = index + 1;
    const scoredForExplain = { score: item.score, band: item.band, isQuickWin: item.isQuickWin, factorBreakdown: item.factorBreakdown };
    return {
      actionId: item.action.id,
      playbookId: item.definition.playbookId,
      scoringVersion: OPPORTUNITY_SCORING_VERSION,
      score: item.score,
      band: item.band,
      isQuickWin: item.isQuickWin,
      rank,
      factorBreakdown: item.factorBreakdown,
      explanation: explainOpportunity(scoredForExplain, item.definition),
    };
  });

  return {
    all,
    doNow: all.filter(i => i.band === 'DO_NOW'),
    doNext: all.filter(i => i.band === 'DO_NEXT'),
    doLater: all.filter(i => i.band === 'DO_LATER'),
    quickWins: all.filter(i => i.isQuickWin),
  };
}

export { RANKABLE_STATUSES };
