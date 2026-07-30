// Executive Context Builder™ — ATHENA™ Phase 3E, Intelligence Layer™
//
// Reached only when the Reasoning Engine returns null (AI-required path).
// Thin: asks the Capability Registry for only the domains the Question
// Classifier flagged as relevant, assembles the result -- no domain-specific
// knowledge lives here. Also folds in Conversation Memory™ (short-lived
// per-conversation turn history, explicitly distinct from Executive
// Memory™ -- never written to executive_memory_items).

import { getCapability } from './capabilities/registry.js';

const MAX_CONVERSATION_TURNS = 6;

function buildConversationMemorySection(rawInputs) {
  const turns = Array.isArray(rawInputs.conversationTurns) ? rawInputs.conversationTurns.slice(-MAX_CONVERSATION_TURNS) : [];
  if (turns.length === 0) return null;
  const text = turns.map(t => `${t.role === 'user' ? 'Artist' : 'ATHENA'}: ${t.content}`).join('\n');
  return { section: 'recent_conversation', text };
}

// buildExecutiveContext({domains, rawInputs}) -> {sections, evidence, citations, confidenceLevels}
export function buildExecutiveContext({ domains = [], rawInputs = {} } = {}) {
  const sections = [];
  const evidence = [];
  const citations = [];
  const confidenceLevels = [];

  for (const domain of domains) {
    const capability = getCapability(domain);
    if (!capability) continue;
    if (!capability.advertiseAvailability(rawInputs)) continue;

    const ctx = capability.buildContext(rawInputs);
    sections.push({ section: domain, text: ctx.summary });
    evidence.push(...capability.provideEvidence(rawInputs));
    citations.push(...capability.provideCitations(rawInputs));
    confidenceLevels.push(capability.provideConfidence(rawInputs));
  }

  const conversationSection = buildConversationMemorySection(rawInputs);
  if (conversationSection) sections.push(conversationSection);

  return { sections, evidence, citations, confidenceLevels };
}
