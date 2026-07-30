// Conversation Memory™ Store — ATHENA™ Phase 3E
//
// Sole write/read path into public.athena_conversations /
// athena_conversation_turns. Called from api/ask-athena.js, server-side, on
// behalf of a Bearer-authenticated artist. Never called from the browser
// directly. Explicitly and completely distinct from Executive Memory™
// (api/_lib/executive-memory-store.js) -- nothing here ever writes to
// executive_memory_items.
//
// Contract: every exported function never throws. Each resolves to a
// {ok: true, ...} or {ok: false, error} shape so a persistence failure can
// never take down the caller's response -- api/ask-athena.js degrades to a
// fresh conversation (no prior turns) rather than failing the whole request.

const CONVERSATIONS_TABLE = 'athena_conversations';
const TURNS_TABLE = 'athena_conversation_turns';
const DEFAULT_RECENT_TURNS = 6;

// startConversation({supabase, artistProfileId}) -> {ok, conversation}
export async function startConversation({ supabase, artistProfileId }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId) return { ok: false, error: 'artistProfileId is required' };

  try {
    const { data, error } = await supabase
      .from(CONVERSATIONS_TABLE)
      .insert({ artist_profile_id: artistProfileId })
      .select()
      .single();
    if (error) {
      console.error('[athena-conversation-store] startConversation failed:', error.message || error);
      return { ok: false, error: 'create failed' };
    }
    return { ok: true, conversation: data };
  } catch (err) {
    console.error('[athena-conversation-store] unexpected error on startConversation:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// getConversation({supabase, artistProfileId, conversationId}) -> {ok, conversation}
// Ownership-scoped -- never trusts a caller-supplied id alone.
export async function getConversation({ supabase, artistProfileId, conversationId }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !conversationId) return { ok: false, error: 'artistProfileId and conversationId are required' };

  try {
    const { data, error } = await supabase
      .from(CONVERSATIONS_TABLE)
      .select('*')
      .eq('id', conversationId)
      .eq('artist_profile_id', artistProfileId)
      .maybeSingle();
    if (error || !data) {
      return { ok: false, error: 'conversation not found or not owned by caller' };
    }
    return { ok: true, conversation: data };
  } catch (err) {
    console.error('[athena-conversation-store] unexpected error on getConversation:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// appendTurn({supabase, artistProfileId, conversationId, role, content, responseContract}) -> {ok, turn}
// role must be 'user' or 'athena'. responseContract is only meaningful for
// 'athena' turns (null for 'user' turns) -- lets a resumed conversation
// re-render citations/recommendations exactly as originally returned.
export async function appendTurn({ supabase, artistProfileId, conversationId, role, content, responseContract = null }) {
  if (!supabase) return { ok: false, error: 'store unavailable' };
  if (!artistProfileId || !conversationId) return { ok: false, error: 'artistProfileId and conversationId are required' };
  if (role !== 'user' && role !== 'athena') return { ok: false, error: `invalid role: ${role}` };
  if (!content || typeof content !== 'string') return { ok: false, error: 'content is required' };

  try {
    const { data, error } = await supabase
      .from(TURNS_TABLE)
      .insert({
        conversation_id: conversationId,
        artist_profile_id: artistProfileId,
        role,
        content,
        response_contract: responseContract,
      })
      .select()
      .single();
    if (error) {
      console.error('[athena-conversation-store] appendTurn failed:', error.message || error);
      return { ok: false, error: 'append failed' };
    }

    // Best-effort last_turn_at bump -- a failure here never fails the
    // caller's request; the turn itself is already durably written above.
    await supabase
      .from(CONVERSATIONS_TABLE)
      .update({ last_turn_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('artist_profile_id', artistProfileId);

    return { ok: true, turn: data };
  } catch (err) {
    console.error('[athena-conversation-store] unexpected error on appendTurn:', err?.message || err);
    return { ok: false, error: 'unexpected error' };
  }
}

// getRecentTurns({supabase, artistProfileId, conversationId, limit}) -> {ok, turns}
// Returns turns oldest-first (conversation reading order), capped to the
// most recent `limit`. Fetches ascending and slices the tail in JS rather
// than fetching descending + reversing -- avoids a subtle ordering bug when
// two turns land in the same timestamp bucket (append-then-reply can be
// fast enough to tie at millisecond precision): an ascending stable sort on
// a tie preserves true insertion order, while descending-then-reverse does
// not. Conversation Memory™ is deliberately short-lived (a handful of
// turns per conversation), so fetching the full conversation before slicing
// is not a scale concern.
export async function getRecentTurns({ supabase, artistProfileId, conversationId, limit = DEFAULT_RECENT_TURNS }) {
  if (!supabase) return { ok: false, error: 'store unavailable', turns: [] };
  if (!artistProfileId || !conversationId) return { ok: false, error: 'artistProfileId and conversationId are required', turns: [] };

  try {
    const { data, error } = await supabase
      .from(TURNS_TABLE)
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('artist_profile_id', artistProfileId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[athena-conversation-store] getRecentTurns failed:', error.message || error);
      return { ok: false, error: 'read failed', turns: [] };
    }
    return { ok: true, turns: (data || []).slice(-limit) };
  } catch (err) {
    console.error('[athena-conversation-store] unexpected error on getRecentTurns:', err?.message || err);
    return { ok: false, error: 'unexpected error', turns: [] };
  }
}
