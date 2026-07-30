// Placeholder Provider™ — ATHENA™ Phase 3E
//
// Board-mandated initial provider. Zero external calls: composes a
// deterministic answer directly from the assembled prompt's evidence
// section, and always discloses it is not a full conversational answer.
// Makes the entire pipeline testable today at zero cost and trivially meets
// every Performance Goal by construction. Swapping in a real vendor later
// (see provider-factory.js) is strictly additive -- nothing outside
// providers/ ever changes.

const PROVIDER_VERSION = 'placeholder-1.0';
const DISCLOSURE = '(Placeholder provider — full conversational reasoning arrives once a real AI provider is configured.)';

async function generate(assembledPrompt) {
  const evidenceSection = (assembledPrompt.sections || []).find(s => s.section === 'evidence');
  const facts = evidenceSection && evidenceSection.text ? evidenceSection.text.split('\n').filter(Boolean) : [];

  const text = facts.length > 0
    ? `Based on the verified evidence available: ${facts.slice(0, 5).join(' ')} ${DISCLOSURE}`
    : `There is currently insufficient verified evidence to answer that question. ${DISCLOSURE}`;

  return { text, raw: { facts } };
}

async function healthCheck() {
  return { ok: true, detail: 'placeholder provider always healthy — no external dependency' };
}

function estimateCost() {
  return 0;
}

// Rough chars-per-token approximation -- no tokenizer installed, documented
// as an estimate, matching prompt-assembly.js's own character-count budget.
function estimateTokens(assembledPrompt) {
  const totalChars = (assembledPrompt.sections || []).reduce((sum, s) => sum + (s.text ? s.text.length : 0), 0);
  return Math.ceil(totalChars / 4);
}

export const placeholderProvider = Object.freeze({
  generate, healthCheck, estimateCost, estimateTokens, providerVersion: PROVIDER_VERSION,
});
