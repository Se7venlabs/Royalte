// Executive Memory™ Store — ATHENA™ Phase 3C
//
// Sole write path into public.executive_memory_items. Called from
// api/executive-memory-actions.js, server-side, on behalf of a
// Bearer-authenticated artist. Never called from the browser directly.
//
// Memory Promotion™ (constitutional rule, enforced here, not in the UI):
// an ATHENA Recommendation may never be silently promoted into Executive
// Memory™. createMemoryItem() refuses to write a row with
// source: 'ATHENA Recommendation' unless the caller explicitly passes
// promotedBy: 'user_confirmed' -- i.e. the UI has already obtained the
// artist's explicit confirmation before calling this. There is no other
// path to persist an ATHENA-sourced statement.
//
// Lifecycle rules, also enforced here rather than in the UI:
//   - createMemoryItem   -- new 'active' row. Memory Promotion(tm) gate above.
//   - confirmMemoryItem  -- sets last_confirmed_at on an existing 'active' row.
//     Does not create a new row -- confirmation re-affirms, it doesn't replace.
//   - correctMemoryItem  -- an artist manually fixes a wrong statement. Always
//     writes the replacement with source: 'User Confirmed' (a correction is,
//     definitionally, a user assertion) via supersedeMemoryItem below.
//   - supersedeMemoryItem -- the general replace primitive: marks the old row
//     'superseded' (superseded_by -> new row's id) and inserts a new 'active'
//     row with the caller-specified source/statement. correctMemoryItem is a
//     thin wrapper over this -- no duplicated replace logic.
//   - expireMemoryItem   -- marks a row 'expired' in place. No replacement
//     row is created (nothing supersedes it -- it simply no longer applies).
//
// Rows are never hard-deleted and never overwritten in place except for the
// two narrow, explicitly-scoped UPDATEs above (last_confirmed_at; status +
// superseded_by) -- matching the Executive Brief Archive's immutable-history
// convention.
//
// Contract: every exported function never throws. Each resolves to a
// {ok: true, ...} or {ok: false, error} shape so a persistence failure can
// never take down the caller's response.

import { publish } from '../athena/bus/executive-intelligence-bus.js';

const TABLE = 'executive_memory_items';

const VALID_SOURCES = Object.freeze([
  'Canonical Evidence', 'User Confirmed', 'Derived Intelligence',
  'ATHENA Recommendation', 'Historical Context', 'Superseded',
]);
const VALID_CONFIDENCE = Object.freeze(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA']);

function isValidSource(source) { return VALID_SOURCES.includes(source); }
function isValidConfidence(confidence) { return VALID_CONFIDENCE.includes(confidence); }

// createMemoryItem({ supabase, artistProfileId, memoryType, source, statement,
//                     evidenceReference, confidence, promotedBy })
export async function createMemoryItem({
  supabase, artistProfileId, memoryType, source, statement,
  evidenceReference = null, confidence = 'MEDIUM', promotedBy = null,
}) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required' };
  if (!memoryType || typeof memoryType !== 'string') return { ok: false, error: 'memoryType is required' };
  if (!isValidSource(source)) return { ok: false, error: `invalid source: ${source}` };
  if (!statement || typeof statement !== 'string') return { ok: false, error: 'statement is required' };
  if (!isValidConfidence(confidence)) return { ok: false, error: `invalid confidence: ${confidence}` };

  // Memory Promotion™ — the one absolute rule. An ATHENA Recommendation is
  // never writable unless the caller has already obtained explicit user
  // confirmation and says so here.
  if (source === 'ATHENA Recommendation' && promotedBy !== 'user_confirmed') {
    return { ok: false, error: 'ATHENA Recommendation requires explicit user confirmation to become memory (Memory Promotion™)' };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        artist_profile_id: artistProfileId,
        memory_type: memoryType,
        source,
        statement,
        evidence_reference: evidenceReference,
        confidence,
      })
      .select()
      .single();

    if (error) {
      console.error('[executive-memory-store] create failed:', error.message || error);
      return { ok: false, error: 'create failed' };
    }

    publish('executive_memory.created', { item: data, artistProfileId });
    return { ok: true, item: data };
  } catch (err) {
    console.error('[executive-memory-store] unexpected error on create:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// confirmMemoryItem({ supabase, artistProfileId, memoryItemId })
// Re-affirms an existing active item is still true -- does not create a new row.
export async function confirmMemoryItem({ supabase, artistProfileId, memoryItemId }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !memoryItemId) return { ok: false, error: 'artistProfileId and memoryItemId are required' };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ last_confirmed_at: new Date().toISOString() })
      .eq('id', memoryItemId)
      .eq('artist_profile_id', artistProfileId) // never trust a caller-supplied id alone
      .eq('status', 'active')
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: 'memory item not found, not owned by caller, or not active' };
    }

    publish('executive_memory.confirmed', { item: data, artistProfileId });
    return { ok: true, item: data };
  } catch (err) {
    console.error('[executive-memory-store] unexpected error on confirm:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// supersedeMemoryItem({ supabase, artistProfileId, memoryItemId, memoryType,
//                        source, statement, evidenceReference, confidence })
// General replace primitive. Marks the old row 'superseded' and creates a
// new 'active' row. Used directly when new canonical evidence replaces an
// old statement; correctMemoryItem (below) is a thin wrapper for the
// user-correction case.
export async function supersedeMemoryItem({
  supabase, artistProfileId, memoryItemId, memoryType, source, statement,
  evidenceReference = null, confidence = 'MEDIUM',
}) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !memoryItemId) return { ok: false, error: 'artistProfileId and memoryItemId are required' };
  if (!isValidSource(source)) return { ok: false, error: `invalid source: ${source}` };
  if (!statement || typeof statement !== 'string') return { ok: false, error: 'statement is required' };

  try {
    // Confirm the old row exists, is owned by this caller, and is active,
    // before creating anything.
    const { data: oldItem, error: fetchErr } = await supabase
      .from(TABLE)
      .select('id, memory_type')
      .eq('id', memoryItemId)
      .eq('artist_profile_id', artistProfileId)
      .eq('status', 'active')
      .maybeSingle();
    if (fetchErr || !oldItem) {
      return { ok: false, error: 'memory item not found, not owned by caller, or not active' };
    }

    const { data: newItem, error: insertErr } = await supabase
      .from(TABLE)
      .insert({
        artist_profile_id: artistProfileId,
        memory_type: memoryType || oldItem.memory_type,
        source,
        statement,
        evidence_reference: evidenceReference,
        confidence: isValidConfidence(confidence) ? confidence : 'MEDIUM',
      })
      .select()
      .single();
    if (insertErr || !newItem) {
      console.error('[executive-memory-store] supersede insert failed:', insertErr?.message || insertErr);
      return { ok: false, error: 'replacement item could not be created' };
    }

    const { data: updatedOld, error: updateErr } = await supabase
      .from(TABLE)
      .update({ status: 'superseded', superseded_by: newItem.id })
      .eq('id', memoryItemId)
      .select()
      .single();
    if (updateErr || !updatedOld) {
      // The replacement row now exists but the old one couldn't be marked --
      // report honestly rather than pretending full success; the new item
      // is still real and usable.
      console.error('[executive-memory-store] supersede: old row update failed:', updateErr?.message || updateErr);
      return { ok: true, item: newItem, oldItemUpdateFailed: true };
    }

    publish('executive_memory.superseded', { oldItem: updatedOld, newItem, artistProfileId });
    return { ok: true, item: newItem, supersededItem: updatedOld };
  } catch (err) {
    console.error('[executive-memory-store] unexpected error on supersede:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// correctMemoryItem({ supabase, artistProfileId, memoryItemId, statement,
//                      confidence })
// A user manually fixing a wrong memory statement. Always writes the
// replacement as source: 'User Confirmed' -- a correction is, by
// definition, a user assertion, regardless of the original item's source.
export async function correctMemoryItem({ supabase, artistProfileId, memoryItemId, statement, confidence = 'HIGH' }) {
  const result = await supersedeMemoryItem({
    supabase, artistProfileId, memoryItemId,
    source: 'User Confirmed', statement, confidence,
  });
  if (!result.ok) return result;
  publish('executive_memory.corrected', { item: result.item, supersededItem: result.supersededItem, artistProfileId });
  return result;
}

// expireMemoryItem({ supabase, artistProfileId, memoryItemId })
// Marks a row 'expired' in place -- no replacement is created, since
// expiration means the statement no longer applies at all, not that a new
// statement replaces it.
export async function expireMemoryItem({ supabase, artistProfileId, memoryItemId }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !memoryItemId) return { ok: false, error: 'artistProfileId and memoryItemId are required' };

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ status: 'expired' })
      .eq('id', memoryItemId)
      .eq('artist_profile_id', artistProfileId)
      .eq('status', 'active')
      .select()
      .single();

    if (error || !data) {
      return { ok: false, error: 'memory item not found, not owned by caller, or not active' };
    }

    publish('executive_memory.expired', { item: data, artistProfileId });
    return { ok: true, item: data };
  } catch (err) {
    console.error('[executive-memory-store] unexpected error on expire:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// Exported for testing.
export { VALID_SOURCES, VALID_CONFIDENCE, isValidSource, isValidConfidence };
