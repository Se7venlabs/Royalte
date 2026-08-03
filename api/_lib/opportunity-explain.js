// Opportunity Explanation™ — Phase 4B, Executive Opportunity Engine™
//
// Canonical Ownership™ split, deliberate: "why does this recommendation
// exist at all" is already answered by a Playbook Definition's own
// explainRecommendation(rawInputs) (Phase 4A, Executive Change Request 8)
// — that stays unchanged and is not re-derived here. This module answers
// the different question Phase 4B introduces: "why is it ranked where it
// is." Both are canonical, non-UI-generated, ATHENA-Advisor-ready data —
// never composed ad hoc by a presentation layer.
//
// explainOpportunity() takes only data already computed by the Scoring
// Engine (score, factorBreakdown, band, isQuickWin) plus the Definition's
// title -- no fresh canonical evidence fetch required, so a read-only
// roadmap fetch (GET, no recompute) never needs to re-run eligibility.

const FACTOR_LABELS = Object.freeze({
  revenuePotential:   'Revenue Potential',
  businessImpact:     'Business Impact',
  evidenceConfidence: 'Evidence Confidence',
  difficulty:         'Difficulty',
  estimatedTime:       'Estimated Time',
  priorityWeight:      'Priority',
});

const BAND_IGNORE_CONSEQUENCE = Object.freeze({
  DO_NOW:   'This is currently Royaltē\'s top-priority recommendation — delaying it means the highest-confidence, highest-impact opportunity available today goes unaddressed.',
  DO_NEXT:  'This remains a real opportunity, but Royaltē has ranked other actions ahead of it based on impact, confidence, and effort.',
  DO_LATER: 'This is a lower-urgency opportunity today — revisiting it after higher-ranked actions are complete is reasonable.',
});

const BAND_COMPLETE_CONSEQUENCE = Object.freeze({
  DO_NOW:   'Completing this now addresses Royaltē\'s highest-ranked opportunity, and (once independently verified) removes it from every future roadmap.',
  DO_NEXT:  'Completing this moves a real, ranked opportunity toward resolution and may reprioritize what Royaltē recommends next.',
  DO_LATER: 'Completing this resolves a lower-urgency opportunity — a reasonable use of time once higher-ranked actions are addressed.',
});

// Top two contributing factors by weighted contribution, for a concise
// "ranked here because" sentence -- always derived from the real
// factorBreakdown the Scoring Engine already produced, never invented.
function topFactors(factorBreakdown, count = 2) {
  return Object.entries(factorBreakdown)
    .sort((a, b) => b[1].contribution - a[1].contribution)
    .slice(0, count)
    .map(([factor, data]) => ({
      factor,
      label: FACTOR_LABELS[factor] || factor,
      rawValue: data.rawValue,
      contribution: data.contribution,
    }));
}

// explainOpportunity({score, band, isQuickWin, factorBreakdown}, definition)
// -> { whyRankedHere, whatIfIgnored, whatIfCompleted, topFactors }
export function explainOpportunity(scoredAction, definition) {
  const { score, band, isQuickWin: quickWin, factorBreakdown } = scoredAction || {};
  const title = (definition && definition.title) || 'This Playbook';
  const leading = topFactors(factorBreakdown || {});

  const factorPhrase = leading
    .map(f => `${f.label.toLowerCase()} (${f.rawValue ?? 'not available'})`)
    .join(' and ');

  const whyRankedHere = quickWin
    ? `${title} is flagged as a Quick Win™ — high revenue potential, high evidence confidence, low difficulty, and a short completion time together move it to Do Now regardless of its composite score (${score}/100).`
    : `${title} scored ${score}/100, driven primarily by ${factorPhrase || 'the available opportunity metadata'}.`;

  return Object.freeze({
    whyRankedHere,
    whatIfIgnored: BAND_IGNORE_CONSEQUENCE[band] || BAND_IGNORE_CONSEQUENCE.DO_LATER,
    whatIfCompleted: BAND_COMPLETE_CONSEQUENCE[band] || BAND_COMPLETE_CONSEQUENCE.DO_LATER,
    topFactors: leading,
  });
}
