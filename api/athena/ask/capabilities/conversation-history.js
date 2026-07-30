// Conversation History™ capability — ATHENA™ Phase 3E Capability Registry™
//
// Read-only consumer of Conversation Memory™ turns, passed in via
// rawInputs.conversationTurns (already fetched + trimmed to the last ~6
// turns by api/_lib/athena-conversation-store.js -- this capability never
// queries Supabase directly). Distinct from the executiveMemory capability
// above: this is short-lived per-conversation turn history, never written
// to executive_memory_items.

import { registerCapability } from './registry.js';

function turns(rawInputs) {
  return Array.isArray(rawInputs.conversationTurns) ? rawInputs.conversationTurns : [];
}

function buildContext(rawInputs) {
  const list = turns(rawInputs);
  if (list.length === 0) {
    return { available: false, summary: 'No prior turns in this conversation.', data: null };
  }
  return {
    available: true,
    summary: `${list.length} prior turn(s) in this conversation.`,
    data: { turns: list },
  };
}

registerCapability({
  name: 'conversationHistory',
  advertiseAvailability(rawInputs) { return buildContext(rawInputs).available; },
  buildContext,
  provideEvidence() {
    // Conversation turns are context for pronoun/reference resolution, not
    // citable evidence for an answer's factual claims -- never surfaced as
    // an evidence entry.
    return [];
  },
  provideConfidence(rawInputs) {
    return buildContext(rawInputs).available ? 'HIGH' : 'INSUFFICIENT_DATA';
  },
  provideCitations() {
    return [];
  },
});
