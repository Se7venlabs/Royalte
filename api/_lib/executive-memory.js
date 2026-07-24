// Executive Memory™ (foundation) — ATHENA™ Phase 3B
//
// Derives what can be honestly known from the archive alone: which risks
// recur across scans, and which have been resolved (present in an earlier
// archived brief, absent from the latest). Reads exclusively through
// api/_lib/executive-brief-archive-reader.js.
//
// Scope boundary, stated explicitly rather than silently worked around:
// Goals, Dismissed Recommendations, and Milestones (per the Phase 3 roadmap
// brief's own examples -- "Release EP", "Launch monitoring") are
// artist-authored intent and state changes. They are NOT derivable from
// archived Executive Intelligence Objects, which only ever record what
// ATHENA observed, never what an artist decided or dismissed. Building real
// support for them requires a new writable table (e.g. an artist can mark a
// recommendation "dismissed", or set a free-text goal) -- which is a second
// persistence layer beyond the immutable Executive Brief Archive™, and this
// phase's constitutional guidance is explicit: "Phase 3B is a consumer of
// historical intelligence, not a producer of new persistence." So these
// three remain honestly `available: false` here, exactly like Forecast™ and
// Timeline™ did in Phase 1's EIO -- not fabricated, not silently dropped.
// Authorizing that new table is a real, separate decision for a future brief.

import { listBriefs } from './executive-brief-archive-reader.js';

function riskKey(risk) {
  return `${risk.affectedDomain || 'unknown'}::${risk.title || ''}`;
}

const GOALS_UNAVAILABLE_REASON =
  "No persistent goal-setting store exists yet -- goals are artist-authored intent, not derivable from archived Executive Intelligence, and would require a new writable store outside this phase's scope.";
const DISMISSED_UNAVAILABLE_REASON =
  'No persistent dismissal/action-tracking store exists yet -- same reasoning as goals.';
const MILESTONES_UNAVAILABLE_REASON =
  'No persistent milestone store exists yet -- same reasoning as goals.';

export async function buildExecutiveMemory(supabase, artistProfileId, { limit = 20 } = {}) {
  const briefs = await listBriefs(supabase, artistProfileId, { limit, full: true, order: 'asc' });

  const unavailableFoundation = {
    goals: { available: false, reason: GOALS_UNAVAILABLE_REASON },
    dismissedActions: { available: false, reason: DISMISSED_UNAVAILABLE_REASON },
    milestones: { available: false, reason: MILESTONES_UNAVAILABLE_REASON },
  };

  if (briefs.length === 0) {
    return {
      available: false,
      reason: 'No archived Executive Briefs yet.',
      recurringIssues: [],
      resolvedIssues: [],
      ...unavailableFoundation,
    };
  }

  const latest = briefs[briefs.length - 1];
  const latestRiskKeys = new Set((latest.executive_intelligence_object.risks || []).map(riskKey));

  const firstSeen = new Map();
  briefs.slice(0, -1).forEach((brief) => {
    (brief.executive_intelligence_object.risks || []).forEach((risk) => {
      const key = riskKey(risk);
      if (!firstSeen.has(key)) {
        firstSeen.set(key, {
          title: risk.title || null,
          domain: risk.affectedDomain || null,
          firstSeenExecutiveBriefId: brief.executive_brief_id,
          firstSeenAt: brief.generated_at,
        });
      }
    });
  });

  const recurringIssues = [];
  const resolvedIssues = [];
  firstSeen.forEach((info, key) => {
    (latestRiskKeys.has(key) ? recurringIssues : resolvedIssues).push(info);
  });

  return {
    available: true,
    scope: 'derived_from_archive_history',
    recurringIssues,
    resolvedIssues,
    ...unavailableFoundation,
  };
}
