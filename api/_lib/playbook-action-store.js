// Playbook Action Engine™ Store — Phase 4A, Executive Actions™
//
// Sole write path into public.playbook_actions / playbook_action_history.
// Called from api/playbook-actions.js, server-side, on behalf of a
// Bearer-authenticated artist. Never called from the browser directly.
//
// Executive Health States™ (Board Executive Change Request 3):
//   available -> recommended -> started -> in_progress ->
//   waiting_verification -> verified -> completed -> archived
// An artist's own confirmation (completePlaybook()) only ever reaches
// waiting_verification. Only verifyPlaybook() -- given fresh evidence,
// re-checked against the same isEligible() the playbook was triggered by --
// can move a row to verified/completed. This makes Evidence First™ real:
// self-report is never treated as independent re-verification.
//
// Canonical Ownership™: this store alone owns Status, Progress (as facts --
// completed_steps/total_steps, never a persisted percentage), Executive
// Action Numbers (fact: action_number; display string always derived), and
// Completion/Confidence History. Steps and Version are owned by the
// Playbook Registry (api/playbooks/); this store only references
// playbookId/playbookVersion/definitionSchema as snapshots taken at
// recommend/start time.
//
// Stable identity: "resume" means looking up an existing non-archived row
// for the (artist_profile_id, playbook_id) pair before creating a new one --
// the DB's own partial unique index is the enforcement backstop; this
// store's own lookup-before-insert is the primary path.
//
// Contract: every exported function never throws. Each resolves to a
// {ok: true, ...} or {ok: false, error} shape so a persistence failure can
// never take down the caller's response.

const ACTIONS_TABLE = 'playbook_actions';
const HISTORY_TABLE = 'playbook_action_history';

const VALID_STATUS = Object.freeze([
  'available', 'recommended', 'started', 'in_progress',
  'waiting_verification', 'verified', 'completed', 'archived',
]);
const VALID_CONFIDENCE = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']);

function isValidConfidence(c) { return c == null || VALID_CONFIDENCE.includes(c); }

// progressPercentage is always derived, never stored (facts in, percentages
// calculated at read time).
function withProgressPercentage(row) {
  if (!row) return row;
  const pct = row.total_steps > 0 ? Math.round((row.completed_steps / row.total_steps) * 100) : 0;
  return { ...row, progressPercentage: pct };
}

// Executive Action Numbers™ (Executive Change Request 6) -- 'EA-000001' is
// always formatted at read time from the stored fact (action_number),
// never persisted as text.
export function formatActionNumber(actionNumber) {
  if (actionNumber == null) return null;
  return 'EA-' + String(actionNumber).padStart(6, '0');
}

function withActionNumber(row) {
  if (!row) return row;
  return { ...row, actionNumberDisplay: formatActionNumber(row.action_number) };
}

function enrich(row) {
  return withActionNumber(withProgressPercentage(row));
}

async function recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus, fromStepId = null, toStepId = null, confidence = null, note = null }) {
  try {
    await supabase.from(HISTORY_TABLE).insert({
      action_id: actionId,
      artist_profile_id: artistProfileId,
      from_status: fromStatus,
      to_status: toStatus,
      from_step_id: fromStepId,
      to_step_id: toStepId,
      confidence,
      note,
    });
  } catch (err) {
    // History is an audit trail, not the primary write -- a failure here
    // must never undo or fail the state transition that already succeeded.
    console.error('[playbook-action-store] history write failed (non-fatal):', err?.message || err);
  }
}

// recommendPlaybook({supabase, artistProfileId, playbookId, playbookVersion,
//                     definitionSchema, totalSteps, evidenceConfidence,
//                     recommendationSource, supportingEvidence})
// Idempotent: if any non-archived row already exists for this artist+playbook
// pair (recommended or further along), returns it unchanged -- a
// recommendation never regresses or duplicates an artist's real progress.
// Persisting the recommendation itself (not just returning a computed list)
// is what makes it permanent Executive History™ (Executive Change Request 10) --
// even if the artist never starts it, "this was recommended on <date>"
// survives.
export async function recommendPlaybook({
  supabase, artistProfileId, playbookId, playbookVersion, definitionSchema, totalSteps,
  evidenceConfidence = null, recommendationSource = null, supportingEvidence = null,
}) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required' };
  if (!playbookId || typeof playbookId !== 'string') return { ok: false, error: 'playbookId is required' };
  if (!playbookVersion || typeof playbookVersion !== 'string') return { ok: false, error: 'playbookVersion is required' };
  if (typeof definitionSchema !== 'number') return { ok: false, error: 'definitionSchema is required' };
  if (typeof totalSteps !== 'number' || totalSteps <= 0) return { ok: false, error: 'totalSteps must be a positive number' };
  if (!isValidConfidence(evidenceConfidence)) return { ok: false, error: `invalid evidenceConfidence: ${evidenceConfidence}` };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId)
      .eq('playbook_id', playbookId)
      .neq('status', 'archived')
      .maybeSingle();
    if (fetchErr) {
      console.error('[playbook-action-store] recommendPlaybook lookup failed:', fetchErr.message || fetchErr);
      return { ok: false, error: 'lookup failed' };
    }
    if (existing) {
      return { ok: true, item: enrich(existing), created: false };
    }

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .insert({
        artist_profile_id: artistProfileId,
        playbook_id: playbookId,
        playbook_version: playbookVersion,
        definition_schema: definitionSchema,
        status: 'recommended',
        completed_steps: 0,
        total_steps: totalSteps,
        current_step_id: null,
        evidence_confidence: evidenceConfidence,
        recommendation_source: recommendationSource,
        supporting_evidence: supportingEvidence,
      })
      .select()
      .single();
    if (error) {
      console.error('[playbook-action-store] recommendPlaybook insert failed:', error.message || error);
      return { ok: false, error: 'create failed' };
    }

    await recordHistory(supabase, { actionId: data.id, artistProfileId, fromStatus: 'available', toStatus: 'recommended', confidence: evidenceConfidence });
    return { ok: true, item: enrich(data), created: true };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on recommendPlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// startPlaybook({supabase, artistProfileId, playbookId, playbookVersion,
//                 definitionSchema, totalSteps, evidenceConfidence,
//                 recommendationSource, supportingEvidence})
// Idempotent: resumes an existing non-archived row (whatever its status)
// for this artist+playbook pair instead of duplicating. A 'recommended' row
// transitions to 'started'; a row already started/further along is simply
// returned as-is (resume, not a step backward).
export async function startPlaybook({
  supabase, artistProfileId, playbookId, playbookVersion, definitionSchema, totalSteps,
  evidenceConfidence = null, recommendationSource = null, supportingEvidence = null,
}) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required' };
  if (!playbookId || typeof playbookId !== 'string') return { ok: false, error: 'playbookId is required' };
  if (!playbookVersion || typeof playbookVersion !== 'string') return { ok: false, error: 'playbookVersion is required' };
  if (typeof definitionSchema !== 'number') return { ok: false, error: 'definitionSchema is required' };
  if (typeof totalSteps !== 'number' || totalSteps <= 0) return { ok: false, error: 'totalSteps must be a positive number' };
  if (!isValidConfidence(evidenceConfidence)) return { ok: false, error: `invalid evidenceConfidence: ${evidenceConfidence}` };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId)
      .eq('playbook_id', playbookId)
      .neq('status', 'archived')
      .maybeSingle();
    if (fetchErr) {
      console.error('[playbook-action-store] startPlaybook lookup failed:', fetchErr.message || fetchErr);
      return { ok: false, error: 'lookup failed' };
    }

    if (existing && existing.status !== 'available' && existing.status !== 'recommended') {
      return { ok: true, item: enrich(existing), resumed: true };
    }

    if (existing) {
      // 'recommended' -> 'started'
      const { data, error } = await supabase
        .from(ACTIONS_TABLE)
        .update({ status: 'started', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error || !data) {
        console.error('[playbook-action-store] startPlaybook update failed:', error?.message || error);
        return { ok: false, error: 'start failed' };
      }
      await recordHistory(supabase, { actionId: data.id, artistProfileId, fromStatus: 'recommended', toStatus: 'started', confidence: evidenceConfidence });
      return { ok: true, item: enrich(data), resumed: true };
    }

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .insert({
        artist_profile_id: artistProfileId,
        playbook_id: playbookId,
        playbook_version: playbookVersion,
        definition_schema: definitionSchema,
        status: 'started',
        completed_steps: 0,
        total_steps: totalSteps,
        current_step_id: null,
        evidence_confidence: evidenceConfidence,
        recommendation_source: recommendationSource,
        supporting_evidence: supportingEvidence,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      console.error('[playbook-action-store] startPlaybook insert failed:', error.message || error);
      return { ok: false, error: 'create failed' };
    }

    await recordHistory(supabase, { actionId: data.id, artistProfileId, fromStatus: 'available', toStatus: 'started', confidence: evidenceConfidence });
    return { ok: true, item: enrich(data), resumed: false };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on startPlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

const NOT_ADVANCEABLE = Object.freeze(['archived', 'completed', 'verified', 'waiting_verification']);

// advancePlaybookStep({supabase, artistProfileId, actionId, stepId, note})
// Keyed by the stable stepId, never by array position. Increments
// completed_steps by one fact; never writes a percentage.
export async function advancePlaybookStep({ supabase, artistProfileId, actionId, stepId, note = null }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required' };
  if (!stepId || typeof stepId !== 'string') return { ok: false, error: 'stepId is required' };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .maybeSingle();
    if (fetchErr || !existing || NOT_ADVANCEABLE.includes(existing.status)) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or not in an advanceable state' };
    }

    const fromStatus = existing.status;
    const fromStepId = existing.current_step_id;
    const nextCompletedSteps = Math.min(existing.completed_steps + 1, existing.total_steps);

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .update({
        status: 'in_progress',
        completed_steps: nextCompletedSteps,
        current_step_id: stepId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .select()
      .single();
    if (error || !data) {
      console.error('[playbook-action-store] advancePlaybookStep update failed:', error?.message || error);
      return { ok: false, error: 'advance failed' };
    }

    await recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus: 'in_progress', fromStepId, toStepId: stepId, confidence: existing.evidence_confidence, note });
    return { ok: true, item: enrich(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on advancePlaybookStep:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// completePlaybook({supabase, artistProfileId, actionId, completionOutcome})
// Evidence First™ (Board Executive Change Request 3): an artist's own
// confirmation moves the row to 'waiting_verification' ONLY -- never
// directly to 'completed'. It never claims the underlying platform state
// was independently re-verified. Only verifyPlaybook() (below), given
// fresh canonical evidence, can move it further.
export async function completePlaybook({ supabase, artistProfileId, actionId, completionOutcome = 'user_confirmed_complete' }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required' };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .maybeSingle();
    if (fetchErr || !existing || NOT_ADVANCEABLE.includes(existing.status)) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or already awaiting/verified/completed/archived' };
    }

    const fromStatus = existing.status;

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .update({
        status: 'waiting_verification',
        completion_outcome: completionOutcome,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .select()
      .single();
    if (error || !data) {
      console.error('[playbook-action-store] completePlaybook update failed:', error?.message || error);
      return { ok: false, error: 'complete failed' };
    }

    await recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus: 'waiting_verification', confidence: existing.evidence_confidence, note: completionOutcome });
    return { ok: true, item: enrich(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on completePlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// verifyPlaybook({supabase, artistProfileId, actionId, resolved, evidenceConfidence})
// `resolved` is computed by the caller (api/playbook-actions.js) by
// re-running the Playbook Definition's own isEligible() against FRESH
// canonical evidence -- never a self-report, never fabricated here. This
// is the one real mechanism behind Evidence First™: only independently
// re-confirmed evidence moves a row to verified/completed.
//
// This is an explicit, callable action today, not an automatic
// post-scan hook -- deliberately not wired into api/audit.js's scan
// pipeline this phase (that cross-cutting integration is real, separate
// work; see governance/PLAYBOOK_ACTION_ENGINE_ARCHITECTURE.md). This
// function is the correct, real extension point for that hook later.
export async function verifyPlaybook({ supabase, artistProfileId, actionId, resolved, evidenceConfidence = null }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required' };
  if (typeof resolved !== 'boolean') return { ok: false, error: 'resolved (boolean) is required' };
  if (!isValidConfidence(evidenceConfidence)) return { ok: false, error: `invalid evidenceConfidence: ${evidenceConfidence}` };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .eq('status', 'waiting_verification')
      .maybeSingle();
    if (fetchErr || !existing) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or not awaiting verification' };
    }

    if (!resolved) {
      // Checked, but the underlying issue still isn't resolved -- stays in
      // waiting_verification, informational history entry only, not an error.
      await recordHistory(supabase, {
        actionId, artistProfileId, fromStatus: 'waiting_verification', toStatus: 'waiting_verification',
        confidence: evidenceConfidence, note: 'Verification check: issue not yet resolved',
      });
      return { ok: true, item: enrich(existing), verified: false };
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .update({
        status: 'completed',
        verified_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', actionId)
      .select()
      .single();
    if (error || !data) {
      console.error('[playbook-action-store] verifyPlaybook update failed:', error?.message || error);
      return { ok: false, error: 'verify failed' };
    }

    // Two distinct timeline events (Verified, then Completed), matching the
    // Board's own Automatic Executive Timeline™ example list, even though
    // the underlying status update happens atomically in one row write.
    await recordHistory(supabase, { actionId, artistProfileId, fromStatus: 'waiting_verification', toStatus: 'verified', confidence: evidenceConfidence });
    await recordHistory(supabase, { actionId, artistProfileId, fromStatus: 'verified', toStatus: 'completed', confidence: evidenceConfidence });

    return { ok: true, item: enrich(data), verified: true };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on verifyPlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// archivePlaybook({supabase, artistProfileId, actionId})
// Works from any non-archived status -- archiving is always available,
// never blocked by where a playbook is in its lifecycle. Never deletes the
// row (Executive Change Request 10 -- Executive History™ is permanent).
export async function archivePlaybook({ supabase, artistProfileId, actionId }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required' };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .neq('status', 'archived')
      .maybeSingle();
    if (fetchErr || !existing) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or already archived' };
    }

    const fromStatus = existing.status;

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', actionId)
      .select()
      .single();
    if (error || !data) {
      console.error('[playbook-action-store] archivePlaybook update failed:', error?.message || error);
      return { ok: false, error: 'archive failed' };
    }

    await recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus: 'archived' });
    return { ok: true, item: enrich(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on archivePlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// listPlaybookActions({supabase, artistProfileId, status})
// Executive History™ is permanent (Executive Change Request 10) -- with no
// status filter, this returns every row regardless of status, including
// archived. Callers that want "everything still visible on the dashboard"
// should filter status !== 'archived' themselves, exactly as
// api/playbook-actions.js already does.
export async function listPlaybookActions({ supabase, artistProfileId, status = null }) {
  if (!supabase) return { ok: false, error: 'store unavailable', items: [] };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required', items: [] };

  try {
    let query = supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId)
      .order('updated_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[playbook-action-store] listPlaybookActions failed:', error.message || error);
      return { ok: false, error: 'read failed', items: [] };
    }
    return { ok: true, items: (data || []).map(enrich) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on listPlaybookActions:', err?.message || err);
    return { ok: false, error: 'unexpected error', items: [] };
  }
}

// Automatic Executive Timeline™ (Executive Change Request 7) -- every state
// transition already produces a history row via recordHistory() above, in
// every lifecycle function. This function reads that history back with a
// human-readable label computed at read time (never persisted -- "store
// facts, calculate derived values", same discipline as progressPercentage).
const STATUS_EVENT_LABELS = Object.freeze({
  recommended: 'Recommended',
  started: 'Started Playbook',
  in_progress: 'Step Completed',
  waiting_verification: 'Completed by Artist — Waiting Verification',
  verified: 'Verified',
  completed: 'Completed',
  archived: 'Archived',
});

export function describeHistoryEvent(row) {
  if (row.to_status === 'in_progress' && row.to_step_id) {
    return `Completed step ${row.to_step_id}`;
  }
  return STATUS_EVENT_LABELS[row.to_status] || `Status changed to ${row.to_status}`;
}

export async function getPlaybookHistory({ supabase, artistProfileId, actionId }) {
  if (!supabase) return { ok: false, error: 'store unavailable', events: [] };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required', events: [] };

  try {
    const { data, error } = await supabase
      .from(HISTORY_TABLE)
      .select('*')
      .eq('action_id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[playbook-action-store] getPlaybookHistory failed:', error.message || error);
      return { ok: false, error: 'read failed', events: [] };
    }
    const events = (data || []).map(row => ({ ...row, label: describeHistoryEvent(row) }));
    return { ok: true, events };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on getPlaybookHistory:', err?.message || err);
    return { ok: false, error: 'unexpected error', events: [] };
  }
}

// Executive Dashboard Metrics™ (Executive Change Request 9) -- backend
// counts only, no UI required this phase. Executive History™ is
// permanent (Executive Change Request 10), so counts include every status
// the caller asks about; archived is excluded from "active" by convention
// at the call site, not hidden here.
export async function getPlaybookCounts({ supabase, artistProfileId }) {
  if (!supabase) return { ok: false, error: 'store unavailable', counts: null };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required', counts: null };

  try {
    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .select('status')
      .eq('artist_profile_id', artistProfileId);
    if (error) {
      console.error('[playbook-action-store] getPlaybookCounts failed:', error.message || error);
      return { ok: false, error: 'read failed', counts: null };
    }
    const counts = { total: 0 };
    for (const status of VALID_STATUS) counts[status] = 0;
    for (const row of (data || [])) {
      counts.total++;
      if (counts[row.status] != null) counts[row.status]++;
    }
    counts.active = counts.started + counts.in_progress;
    return { ok: true, counts };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on getPlaybookCounts:', err?.message || err);
    return { ok: false, error: 'unexpected error', counts: null };
  }
}

// Exported for testing.
export { VALID_STATUS, VALID_CONFIDENCE, withProgressPercentage, withActionNumber, enrich };
