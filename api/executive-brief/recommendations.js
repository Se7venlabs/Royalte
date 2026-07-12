// Canonical Intelligence Platform™ -- Executive Brief™ Recommendations
// Groups ATHENA™ recommendations by priority. Surfaces top executive actions.
// All data sourced from athenaReport; never determines or re-ranks independently.

import { randomUUID } from 'node:crypto';

export function buildExecutiveRecommendations(athenaReport = null) {
  const all = Array.isArray(athenaReport?.recommendations) ? athenaReport.recommendations : [];

  const byPriority = {
    urgent:        all.filter(r => r.priority === 'URGENT'),
    high:          all.filter(r => r.priority === 'HIGH'),
    medium:        all.filter(r => r.priority === 'MEDIUM'),
    low:           all.filter(r => r.priority === 'LOW'),
    informational: all.filter(r => r.priority === 'INFORMATIONAL'),
  };

  const topActions = all.slice(0, 5).map(r => Object.freeze({
    action:          r.recommendedAction,
    priority:        r.priority,
    sourceType:      r.sourceType,
    affectedDomains: r.affectedDomains,
    reason:          r.reason,
  }));

  return Object.freeze({
    recommendationsId: randomUUID(),
    generatedAt:       new Date().toISOString(),
    all:               Object.freeze([...all]),
    byPriority: Object.freeze({
      urgent:        Object.freeze([...byPriority.urgent]),
      high:          Object.freeze([...byPriority.high]),
      medium:        Object.freeze([...byPriority.medium]),
      low:           Object.freeze([...byPriority.low]),
      informational: Object.freeze([...byPriority.informational]),
    }),
    urgentCount: byPriority.urgent.length,
    highCount:   byPriority.high.length,
    totalCount:  all.length,
    topActions:  Object.freeze(topActions),
  });
}
