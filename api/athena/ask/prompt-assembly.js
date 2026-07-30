// Prompt Assembly™ — ATHENA™ Phase 3E, Intelligence Layer™
//
// Normalizes context into a structured, provider-agnostic list of labeled
// sections -- never a raw vendor-formatted prompt. Owns Cost Controls™
// (token budget via a character-count proxy -- no tokenizer installed, a
// documented approximation; evidence dedup; context trimming). Always
// prepends the Executive Personality™ section so ATHENA's voice stays
// consistent regardless of which provider is configured.

import { buildPersonalitySection } from './personality.js';

const MAX_PROMPT_CHARS = 20_000;
const PROTECTED_SECTIONS = Object.freeze(['personality', 'question', 'evidence']);

function dedupeEvidence(evidence) {
  const seen = new Set();
  const out = [];
  for (const item of evidence) {
    const key = `${item.sourceType}::${item.sourceId}::${item.fact}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// assemblePrompt({question, contextSections, attributedEvidence}) ->
// {sections, evidence, truncated, totalChars}. `evidence` here is already
// Evidence-Attribution-tagged -- anything not evidence-attributed never
// reaches this function in the first place, so there's nothing further to
// strip; the "strips anything not evidence-attributed" guarantee lives at
// the boundary between context-builder.js/evidence-attribution.js and here.
export function assemblePrompt({ question, contextSections = [], attributedEvidence = [] }) {
  const dedupedEvidence = dedupeEvidence(attributedEvidence);

  const sections = [
    buildPersonalitySection(),
    { section: 'question', text: question || '' },
    ...contextSections,
    { section: 'evidence', text: dedupedEvidence.map(e => `[${e.sourceType}] ${e.fact}`).join('\n') },
  ];

  let totalChars = sections.reduce((sum, s) => sum + (s.text ? s.text.length : 0), 0);
  let truncated = false;

  // Trim context sections first (least critical to keep whole), never the
  // personality/question/evidence sections, which are load-bearing.
  const trimmable = sections.filter(s => !PROTECTED_SECTIONS.includes(s.section));
  while (totalChars > MAX_PROMPT_CHARS && trimmable.length > 0) {
    const removed = trimmable.pop();
    const idx = sections.indexOf(removed);
    if (idx !== -1) {
      totalChars -= (removed.text ? removed.text.length : 0);
      sections.splice(idx, 1);
      truncated = true;
    }
  }

  return { sections, evidence: dedupedEvidence, truncated, totalChars };
}

export { MAX_PROMPT_CHARS };
