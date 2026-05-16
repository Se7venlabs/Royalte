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

// Stable issue identity for diffing.
//
// Canonical issue `id`s are content hashes of the title — and titles embed
// volatile metrics ("~1,734,031 unmonetised UGC views…"). A metric tick
// between rescans produces a different hash for what is the SAME issue, which
// made the raw-id diff emit phantom issue_resolved + issue_new pairs.
//
// issueKey() matches on (module + severity + digit-stripped title) instead,
// so metric drift no longer reads as a change. Conservative by design: if two
// genuinely different issues happen to collapse to one key, we under-report
// (a false negative) rather than fabricate a change (a false positive).
function issueKey(issue) {
  const mod = String(issue.module ?? '').trim().toLowerCase();
  const sev = String(issue.severity ?? '').trim().toLowerCase();
  const title = String(issue.title ?? '')
    .replace(/[\d,]/g, '')   // strip digits + thousands separators (volatile metrics)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return `${mod}|${sev}|${title}`;
}

/**
 * @param {Object} prevPayload - prior canonical AuditResponse (snapshot N)
 * @param {Object} nextPayload - fresh canonical AuditResponse (snapshot N+1)
 * @returns {Array<{change_type:string, payload:Object}>}
 */
export function computeChanges(prevPayload, nextPayload) {
  const prev = prevPayload || {};
  const next = nextPayload || {};
  const changes = [];

  // ── Issues — new + resolved ─────────────────────────────────────────────
  // Matched on the stable normalized key (issueKey), NOT the raw content-hash
  // id. Same key in both snapshots → no change emitted.
  const prevIssues = Array.isArray(prev.issues) ? prev.issues : [];
  const nextIssues = Array.isArray(next.issues) ? next.issues : [];
  const prevKeys = new Set(prevIssues.filter(Boolean).map(issueKey));
  const nextKeys = new Set(nextIssues.filter(Boolean).map(issueKey));

  const emittedNew = new Set();
  for (const issue of nextIssues) {
    if (!issue) continue;
    const key = issueKey(issue);
    if (!prevKeys.has(key) && !emittedNew.has(key)) {
      emittedNew.add(key);
      changes.push({
        change_type: 'issue_new',
        payload: { issue_id: issue.id ?? null, title: issue.title ?? null, severity: issue.severity ?? null },
      });
    }
  }

  const emittedResolved = new Set();
  for (const issue of prevIssues) {
    if (!issue) continue;
    const key = issueKey(issue);
    if (!nextKeys.has(key) && !emittedResolved.has(key)) {
      emittedResolved.add(key);
      changes.push({
        change_type: 'issue_resolved',
        payload: { issue_id: issue.id ?? null, title: issue.title ?? null, severity: issue.severity ?? null },
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
