// Royaltē — Block D: scan-diff computation.
//
// computeChanges() is a pure function: it compares two canonical
// AuditResponse payloads (a prior snapshot vs a fresh rescan) and returns an
// array of change records. The caller (the monitoring cron) attaches user_id
// and snapshot_id before inserting into scan_changes.
//
// Each record is { change_type, payload }. change_type is one of the values
// the scan_changes CHECK constraint allows:
//   'issue_new' | 'issue_resolved' | 'score_change'
//   | 'revenue_risk_change' | 'platform_change'
//
// NOTE — this function assumes both payloads come from a NON-degraded scan.
// The cron skips diffing entirely when a rescan is degraded (per the Block D
// decision), so computeChanges itself carries no degradation guard.

/**
 * @param {Object} prevPayload - prior canonical AuditResponse (snapshot N)
 * @param {Object} nextPayload - fresh canonical AuditResponse (snapshot N+1)
 * @returns {Array<{change_type:string, payload:Object}>}
 */
export function computeChanges(prevPayload, nextPayload) {
  const prev = prevPayload || {};
  const next = nextPayload || {};
  const changes = [];

  // ── Issues — new + resolved, diffed by issue id ─────────────────────────
  const prevIssues = Array.isArray(prev.issues) ? prev.issues : [];
  const nextIssues = Array.isArray(next.issues) ? next.issues : [];
  const prevById = new Map(prevIssues.filter(i => i && i.id != null).map(i => [i.id, i]));
  const nextById = new Map(nextIssues.filter(i => i && i.id != null).map(i => [i.id, i]));

  for (const [id, issue] of nextById) {
    if (!prevById.has(id)) {
      changes.push({
        change_type: 'issue_new',
        payload: { issue_id: id, title: issue.title ?? null, severity: issue.severity ?? null },
      });
    }
  }
  for (const [id, issue] of prevById) {
    if (!nextById.has(id)) {
      changes.push({
        change_type: 'issue_resolved',
        payload: { issue_id: id, title: issue.title ?? null, severity: issue.severity ?? null },
      });
    }
  }

  // ── Health score — canonical score.overall ──────────────────────────────
  const prevScore = prev.score?.overall;
  const nextScore = next.score?.overall;
  if (Number.isFinite(prevScore) && Number.isFinite(nextScore) && prevScore !== nextScore) {
    changes.push({
      change_type: 'score_change',
      payload: { from: prevScore, to: nextScore, delta: nextScore - prevScore },
    });
  }

  // ── Revenue risk — canonical score.riskLevel ────────────────────────────
  const prevRisk = prev.score?.riskLevel ?? null;
  const nextRisk = next.score?.riskLevel ?? null;
  if (prevRisk !== nextRisk && (prevRisk !== null || nextRisk !== null)) {
    changes.push({
      change_type: 'revenue_risk_change',
      payload: { from: prevRisk, to: nextRisk },
    });
  }

  // ── Platform coverage — canonical platforms[key].availability ───────────
  // A platform "connected" iff availability === 'VERIFIED'. We only emit a
  // change when connected-ness flips, so AUTH_UNAVAILABLE vs NOT_FOUND noise
  // among non-connected platforms does not generate spurious records.
  const prevPlat = (prev.platforms && typeof prev.platforms === 'object') ? prev.platforms : {};
  const nextPlat = (next.platforms && typeof next.platforms === 'object') ? next.platforms : {};
  for (const key of new Set([...Object.keys(prevPlat), ...Object.keys(nextPlat)])) {
    const was = prevPlat[key]?.availability === 'VERIFIED';
    const is  = nextPlat[key]?.availability === 'VERIFIED';
    if (was !== is) {
      changes.push({
        change_type: 'platform_change',
        payload: {
          platform: key,
          from: was ? 'connected' : 'disconnected',
          to:   is  ? 'connected' : 'disconnected',
        },
      });
    }
  }

  return changes;
}
