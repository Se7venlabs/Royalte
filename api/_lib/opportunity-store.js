// Opportunity Store™ — Phase 4B, Executive Opportunity Engine™
//
// Sole write path into public.opportunity_scores / opportunity_score_history.
// Called from api/opportunity-actions.js, server-side, on behalf of a
// Bearer-authenticated artist. Never called from the browser directly.
//
// Board-facing name: "Opportunity Registry™". Named opportunity-store.js
// here, not "registry", because "Registry" in this codebase (Playbook
// Registry, Capability Registry) means specifically a Map of
// self-registering static content populated once at import time -- this
// is the opposite: per-artist DB state, mutated on every recompute.
//
// Canonical Ownership™: this store alone owns Score, Band, Rank, Quick Win
// flag, and Opportunity History (Confidence/factor breakdown is a
// snapshot, not recomputed here -- api/_lib/opportunity-engine.js owns the
// actual ranking math). Steps/Version/Definition content remain owned by
// the Playbook Registry (api/playbooks/); this store only ever reads a
// Definition's already-loaded content via getPlaybook(), never mutates it.
//
// Contract: every exported function never throws. Each resolves to a
// {ok: true, ...} or {ok: false, error} shape so a persistence failure can
// never take down the caller's response.

import { rankOpportunities, RANKABLE_STATUSES } from './opportunity-engine.js';
import { explainOpportunity } from './opportunity-explain.js';
import { getPlaybook } from '../playbooks/definitions/index.js';

const SCORES_TABLE = 'opportunity_scores';
const HISTORY_TABLE = 'opportunity_score_history';

// recomputeOpportunityRoadmap({supabase, artistProfileId, actions})
//
// `actions` is the artist's own real playbook_actions rows, already
// fetched by the caller (api/opportunity-actions.js) and NOT pre-filtered
// -- this function filters to RANKABLE_STATUSES itself so there is one
// source of truth for that list. Each rankable action's Definition is
// resolved via getPlaybook() (in-memory, no I/O).
//
// Writes: upserts one opportunity_scores row per rankable action (by
// action_id, UNIQUE), and writes an opportunity_score_history row on every
// call, unconditionally -- matching playbook_action_history's own
// unconditional recordHistory() precedent, no "was this change big
// enough" filter.
export async function recomputeOpportunityRoadmap({ supabase, artistProfileId, actions }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required' };

  try {
    const rankable = (actions || []).filter(a => RANKABLE_STATUSES.includes(a.status));
    const actionsWithDefinitions = rankable
      .map(action => ({ action, definition: getPlaybook(action.playbook_id) }))
      .filter(pair => !!pair.definition);

    const roadmap = rankOpportunities(actionsWithDefinitions);
    const rankableActionIds = new Set(roadmap.all.map(i => i.actionId));

    // Fetch ALL of this artist's currently-tracked opportunity_scores rows
    // (not just the newly-rankable ones) -- needed both for from_score/
    // from_band snapshotting AND to find rows whose action has left the
    // rankable set entirely (e.g. moved to waiting_verification) since the
    // last recompute.
    const { data: existingRows, error: fetchErr } = await supabase
      .from(SCORES_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId);
    if (fetchErr) {
      console.error('[opportunity-store] recompute lookup failed:', fetchErr.message || fetchErr);
      return { ok: false, error: 'lookup failed' };
    }
    const existingByActionId = new Map((existingRows || []).map(r => [r.action_id, r]));

    // An action that has left the rankable set (e.g. artist marked it
    // complete, now awaiting verification) is no longer "current" --
    // remove its opportunity_scores row. Its FULL history in
    // opportunity_score_history is untouched and permanent (Opportunity
    // History™, Objective 16) -- only the current-state row goes away,
    // exactly mirroring how archivePlaybook() removes nothing from
    // playbook_action_history even though playbook_actions.status changes.
    const staleActionIds = (existingRows || [])
      .map(r => r.action_id)
      .filter(id => !rankableActionIds.has(id));
    if (staleActionIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from(SCORES_TABLE)
        .delete()
        .eq('artist_profile_id', artistProfileId)
        .in('action_id', staleActionIds);
      if (deleteErr) {
        console.error('[opportunity-store] stale score cleanup failed (non-fatal):', deleteErr.message || deleteErr);
      }
    }

    for (const item of roadmap.all) {
      const existing = existingByActionId.get(item.actionId) || null;
      const rowShape = {
        action_id: item.actionId,
        artist_profile_id: artistProfileId,
        playbook_id: item.playbookId,
        scoring_version: item.scoringVersion,
        score: item.score,
        band: item.band,
        is_quick_win: item.isQuickWin,
        rank: item.rank,
        factor_breakdown: item.factorBreakdown,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase.from(SCORES_TABLE).update(rowShape).eq('id', existing.id);
        if (error) {
          console.error('[opportunity-store] score update failed:', error.message || error);
          return { ok: false, error: 'update failed' };
        }
      } else {
        const { error } = await supabase.from(SCORES_TABLE).insert(rowShape);
        if (error) {
          console.error('[opportunity-store] score insert failed:', error.message || error);
          return { ok: false, error: 'create failed' };
        }
      }

      await recordScoreHistory(supabase, {
        actionId: item.actionId,
        artistProfileId,
        scoringVersion: item.scoringVersion,
        score: item.score,
        band: item.band,
        isQuickWin: item.isQuickWin,
        rank: item.rank,
        factorBreakdown: item.factorBreakdown,
        fromScore: existing ? existing.score : null,
        fromBand: existing ? existing.band : null,
      });
    }

    return { ok: true, roadmap, counts: roadmapCounts(roadmap) };
  } catch (err) {
    console.error('[opportunity-store] unexpected error on recomputeOpportunityRoadmap:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

async function recordScoreHistory(supabase, { actionId, artistProfileId, scoringVersion, score, band, isQuickWin, rank, factorBreakdown, fromScore, fromBand }) {
  try {
    await supabase.from(HISTORY_TABLE).insert({
      action_id: actionId,
      artist_profile_id: artistProfileId,
      scoring_version: scoringVersion,
      score,
      band,
      is_quick_win: isQuickWin,
      rank,
      factor_breakdown: factorBreakdown,
      from_score: fromScore,
      from_band: fromBand,
    });
  } catch (err) {
    // History is an audit trail, not the primary write -- a failure here
    // must never undo or fail the score write that already succeeded.
    console.error('[opportunity-store] history write failed (non-fatal):', err?.message || err);
  }
}

function roadmapCounts(roadmap) {
  return {
    total: roadmap.all.length,
    doNow: roadmap.doNow.length,
    doNext: roadmap.doNext.length,
    doLater: roadmap.doLater.length,
    quickWins: roadmap.quickWins.length,
  };
}

// getOpportunityRoadmap({supabase, artistProfileId})
//
// Cheap read of the last-persisted opportunity_scores rows -- NEVER
// recomputes. Mirrors GET /api/playbook-actions vs POST checkEligibility's
// split exactly, so a page load never forces a write. Explanation text is
// re-derived at read time (from the already-stored factor_breakdown, plus
// the Definition's title via getPlaybook()) -- never itself persisted,
// same "facts stored, derived values computed" discipline as
// progressPercentage.
export async function getOpportunityRoadmap({ supabase, artistProfileId }) {
  if (!supabase) return { ok: false, error: 'store unavailable', roadmap: null, counts: null };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required', roadmap: null, counts: null };

  try {
    const { data, error } = await supabase
      .from(SCORES_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId)
      .order('rank', { ascending: true });
    if (error) {
      console.error('[opportunity-store] getOpportunityRoadmap failed:', error.message || error);
      return { ok: false, error: 'read failed', roadmap: null, counts: null };
    }

    // Executive Timeline™ (Phase 4C PR #3) needs each item's current
    // Playbook Action status ('started', 'in_progress', etc.) -- a fact
    // opportunity_scores itself doesn't carry, since Stable Opportunity
    // Identity™ means action_id IS the playbook_actions.id, not a copy of
    // its status. Read-only cross-reference of the Playbook Action
    // Engine's OWN table, same precedent as getOpportunityDashboardMetrics's
    // resolvedThisMonth query below -- Canonical Ownership of
    // playbook_actions stays with api/_lib/playbook-action-store.js; this
    // store never writes it.
    const actionIds = (data || []).map(r => r.action_id);
    let statusByActionId = {};
    if (actionIds.length > 0) {
      const { data: actionRows, error: actionsErr } = await supabase
        .from('playbook_actions')
        .select('id, status')
        .eq('artist_profile_id', artistProfileId)
        .in('id', actionIds);
      if (!actionsErr) {
        statusByActionId = Object.fromEntries((actionRows || []).map(r => [r.id, r.status]));
      }
    }

    const all = (data || []).map(row => {
      const definition = getPlaybook(row.playbook_id) || null;
      const scoredForExplain = { score: row.score, band: row.band, isQuickWin: row.is_quick_win, factorBreakdown: row.factor_breakdown };
      return {
        actionId: row.action_id,
        playbookId: row.playbook_id,
        // Exposes a fact the store already looks up (definition.title) --
        // not new business logic. Without this, a Roadmap UI consumer
        // would have to duplicate a playbookId -> title mapping
        // client-side, which is exactly the kind of duplicate logic
        // Phase 4C's own directive forbids, and would silently go stale
        // the moment a new Playbook Definition is registered.
        title: definition?.title || row.playbook_id,
        // Real Playbook Action lifecycle status (see cross-reference above).
        // null only if the join genuinely found nothing -- honest
        // degradation, never fabricated as e.g. 'available'.
        status: statusByActionId[row.action_id] ?? null,
        // Definition.prerequisites already exists (Phase 4A) and is
        // already loaded on `definition` above -- exposing it here is the
        // same "expose an existing fact" pattern as title, for Executive
        // Timeline™'s honest "Dependencies (when applicable)" field.
        prerequisites: definition?.prerequisites || [],
        scoringVersion: row.scoring_version,
        score: row.score,
        band: row.band,
        isQuickWin: row.is_quick_win,
        rank: row.rank,
        factorBreakdown: row.factor_breakdown,
        explanation: definition ? explainOpportunity(scoredForExplain, definition) : null,
      };
    });

    const roadmap = {
      all,
      doNow: all.filter(i => i.band === 'DO_NOW'),
      doNext: all.filter(i => i.band === 'DO_NEXT'),
      doLater: all.filter(i => i.band === 'DO_LATER'),
      quickWins: all.filter(i => i.isQuickWin),
    };
    return { ok: true, roadmap, counts: roadmapCounts(roadmap) };
  } catch (err) {
    console.error('[opportunity-store] unexpected error on getOpportunityRoadmap:', err?.message || err);
    return { ok: false, error: 'unexpected error', roadmap: null, counts: null };
  }
}

// Automatic Executive Timeline™ label, computed at read time (never
// persisted) -- same discipline as playbook-action-store.js's
// describeHistoryEvent().
export function describeScoreHistoryEvent(row) {
  if (row.from_band == null) {
    return row.is_quick_win
      ? `Ranked #${row.rank} (score ${row.score}) — Quick Win`
      : `Ranked #${row.rank} (score ${row.score}, ${row.band})`;
  }
  if (row.from_band !== row.band) {
    return `Moved from ${row.from_band} to ${row.band} (score ${row.from_score} → ${row.score})`;
  }
  if (row.from_score !== row.score) {
    return `Score updated: ${row.from_score} → ${row.score} (${row.band})`;
  }
  return `Re-ranked #${row.rank} (score ${row.score}, ${row.band}) — no change`;
}

// getOpportunityHistory({supabase, artistProfileId, actionId})
export async function getOpportunityHistory({ supabase, artistProfileId, actionId }) {
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
      console.error('[opportunity-store] getOpportunityHistory failed:', error.message || error);
      return { ok: false, error: 'read failed', events: [] };
    }
    const events = (data || []).map(row => ({ ...row, label: describeScoreHistoryEvent(row) }));
    return { ok: true, events };
  } catch (err) {
    console.error('[opportunity-store] unexpected error on getOpportunityHistory:', err?.message || err);
    return { ok: false, error: 'unexpected error', events: [] };
  }
}

// getOpportunityDashboardMetrics({supabase, artistProfileId})
//
// Executive Dashboard™ (Objective 15) -- backend counts/pointers only, no
// UI required this phase, matching getPlaybookCounts()'s own deferral.
export async function getOpportunityDashboardMetrics({ supabase, artistProfileId }) {
  if (!supabase) return { ok: false, error: 'store unavailable', metrics: null };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required', metrics: null };

  try {
    const { data, error } = await supabase
      .from(SCORES_TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId);
    if (error) {
      console.error('[opportunity-store] getOpportunityDashboardMetrics failed:', error.message || error);
      return { ok: false, error: 'read failed', metrics: null };
    }
    const rows = data || [];

    const topOpportunity = rows.reduce((best, r) => (!best || r.rank < best.rank) ? r : best, null);
    const highestRevenue = rows
      .filter(r => r.factor_breakdown?.revenuePotential?.rawValue === 'HIGH')
      .reduce((best, r) => (!best || r.score > best.score) ? r : best, null);
    const highestConfidence = rows
      .filter(r => r.factor_breakdown?.evidenceConfidence?.rawValue === 'HIGH')
      .reduce((best, r) => (!best || r.score > best.score) ? r : best, null);
    const mostUrgent = rows
      .filter(r => r.band === 'DO_NOW')
      .reduce((best, r) => (!best || r.score > best.score) ? r : best, null);

    // "Resolved This Month" cross-references the Playbook Action Engine's
    // OWN history table (playbook_action_history, Phase 4A) -- not this
    // store's own opportunity_score_history, which only ever records
    // re-rankings among still-rankable actions. Resolution means a real
    // transition into 'completed'/'verified' (Evidence First(tm) --
    // independently re-verified, not just an artist self-report), read
    // here only, never written -- Canonical Ownership of that table stays
    // with api/_lib/playbook-action-store.js.
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const { data: resolvedRows, error: resolvedErr } = await supabase
      .from('playbook_action_history')
      .select('action_id')
      .eq('artist_profile_id', artistProfileId)
      .in('to_status', ['completed', 'verified'])
      .gte('created_at', startOfMonth.toISOString());
    const resolvedThisMonth = resolvedErr ? null : new Set((resolvedRows || []).map(r => r.action_id)).size;

    const metrics = {
      topOpportunityActionId: topOpportunity?.action_id || null,
      highestRevenueActionId: highestRevenue?.action_id || null,
      quickWinsCount: rows.filter(r => r.is_quick_win).length,
      highestConfidenceActionId: highestConfidence?.action_id || null,
      mostUrgentActionId: mostUrgent?.action_id || null,
      resolvedThisMonth,
    };
    return { ok: true, metrics };
  } catch (err) {
    console.error('[opportunity-store] unexpected error on getOpportunityDashboardMetrics:', err?.message || err);
    return { ok: false, error: 'unexpected error', metrics: null };
  }
}
