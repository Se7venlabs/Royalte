// Playbook Action Engine™ Store — Phase 4A, Executive Actions™
//
// Sole write path into public.playbook_actions / playbook_action_history.
// Called from api/playbook-actions.js, server-side, on behalf of a
// Bearer-authenticated artist. Never called from the browser directly.
//
// Canonical Ownership™: this store alone owns Status, Progress (as facts --
// completed_steps/total_steps, never a persisted percentage), and
// Completion History. Steps and Version are owned by the Playbook Registry
// (api/playbooks/); this store only references playbookId/playbookVersion/
// definitionSchema as snapshots taken at start time.
//
// Stable identity (see the approved Phase 4A plan): "resume" means looking
// up an existing non-archived row for the (artist_profile_id, playbook_id)
// pair before creating a new one -- the DB's own exclusion constraint
// (playbook_actions_one_active_per_playbook) is the enforcement backstop;
// this store's own lookup-before-insert is the primary path so a resume
// never even attempts a conflicting insert.
//
// Contract: every exported function never throws. Each resolves to a
// {ok: true, ...} or {ok: false, error} shape so a persistence failure can
// never take down the caller's response.

const ACTIONS_TABLE = 'playbook_actions';
const HISTORY_TABLE = 'playbook_action_history';

const VALID_STATUS = Object.freeze(['available', 'started', 'in_progress', 'completed', 'archived']);
const VALID_CONFIDENCE = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']);

function isValidConfidence(c) { return c == null || VALID_CONFIDENCE.includes(c); }

// progressPercentage is always derived, never stored (Board Final
// Refinement #3 -- facts in, percentages calculated at read time).
function withProgressPercentage(row) {
  if (!row) return row;
  const pct = row.total_steps > 0 ? Math.round((row.completed_steps / row.total_steps) * 100) : 0;
  return { ...row, progressPercentage: pct };
}

async function recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus, fromStepId = null, toStepId = null, note = null }) {
  try {
    await supabase.from(HISTORY_TABLE).insert({
      action_id: actionId,
      artist_profile_id: artistProfileId,
      from_status: fromStatus,
      to_status: toStatus,
      from_step_id: fromStepId,
      to_step_id: toStepId,
      note,
    });
  } catch (err) {
    // History is an audit trail, not the primary write -- a failure here
    // must never undo or fail the state transition that already succeeded.
    console.error('[playbook-action-store] history write failed (non-fatal):', err?.message || err);
  }
}

// startPlaybook({supabase, artistProfileId, playbookId, playbookVersion,
//                 definitionSchema, totalSteps, recommendationSource,
//                 evidenceConfidence, supportingEvidence})
// Idempotent: resumes an existing non-archived row for this artist+playbook
// pair instead of duplicating.
export async function startPlaybook({
  supabase, artistProfileId, playbookId, playbookVersion, definitionSchema, totalSteps,
  recommendationSource = null, evidenceConfidence = null, supportingEvidence = null,
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
    if (existing) {
      return { ok: true, item: withProgressPercentage(existing), resumed: true };
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

    await recordHistory(supabase, { actionId: data.id, artistProfileId, fromStatus: 'available', toStatus: 'started' });
    return { ok: true, item: withProgressPercentage(data), resumed: false };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on startPlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

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
      .neq('status', 'archived')
      .neq('status', 'completed')
      .maybeSingle();
    if (fetchErr || !existing) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or already completed/archived' };
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

    await recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus: 'in_progress', fromStepId, toStepId: stepId, note });
    return { ok: true, item: withProgressPercentage(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on advancePlaybookStep:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// completePlaybook({supabase, artistProfileId, actionId, completionOutcome})
// Evidence First™: this records the artist's own confirmation. It never
// claims the underlying platform state was re-verified -- only a future
// real scan can do that (see the plan's "Evidence-first completion" note).
export async function completePlaybook({ supabase, artistProfileId, actionId, completionOutcome = 'user_confirmed_complete' }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !actionId) return { ok: false, error: 'artistProfileId and actionId are required' };

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from(ACTIONS_TABLE)
      .select('*')
      .eq('id', actionId)
      .eq('artist_profile_id', artistProfileId)
      .neq('status', 'archived')
      .neq('status', 'completed')
      .maybeSingle();
    if (fetchErr || !existing) {
      return { ok: false, error: 'playbook action not found, not owned by caller, or already completed/archived' };
    }

    const fromStatus = existing.status;
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(ACTIONS_TABLE)
      .update({
        status: 'completed',
        completion_outcome: completionOutcome,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', actionId)
      .select()
      .single();
    if (error || !data) {
      console.error('[playbook-action-store] completePlaybook update failed:', error?.message || error);
      return { ok: false, error: 'complete failed' };
    }

    await recordHistory(supabase, { actionId, artistProfileId, fromStatus, toStatus: 'completed', note: completionOutcome });
    return { ok: true, item: withProgressPercentage(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on completePlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// archivePlaybook({supabase, artistProfileId, actionId})
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
    return { ok: true, item: withProgressPercentage(data) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on archivePlaybook:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// listPlaybookActions({supabase, artistProfileId, status})
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
    return { ok: true, items: (data || []).map(withProgressPercentage) };
  } catch (err) {
    console.error('[playbook-action-store] unexpected error on listPlaybookActions:', err?.message || err);
    return { ok: false, error: 'unexpected error', items: [] };
  }
}

// Exported for testing.
export { VALID_STATUS, VALID_CONFIDENCE, withProgressPercentage };
