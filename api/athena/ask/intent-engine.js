// Executive Intent Engine™ — ATHENA™ Phase 3E
//
// Determines what the artist wants ATHENA to DO with a question, before the
// Question Classifier determines what it's ABOUT. Deterministic, pattern
// based -- never an LLM call, since it must run before any provider is
// selected. Feeds the Question Classifier, Prompt Assembly's section
// ordering, and the Reasoning Engine's pattern matching (e.g. a Compare
// intent strongly suggests a deterministic "compare last two scans" match).

export const INTENTS = Object.freeze({
  EXPLAIN:   'Explain',
  COMPARE:   'Compare',
  DIAGNOSE:  'Diagnose',
  FORECAST:  'Forecast',
  RECOMMEND: 'Recommend',
  EDUCATE:   'Educate',
  NAVIGATE:  'Navigate',
  SUMMARIZE: 'Summarize',
  ANALYZE:   'Analyze',
});

// Ordered most-specific-first -- the first matching pattern wins.
const INTENT_PATTERNS = [
  { intent: INTENTS.COMPARE,   pattern: /\b(compare|versus|vs\.?|difference between|changed since|what changed)\b/i },
  { intent: INTENTS.DIAGNOSE,  pattern: /\b(why (is|did|does|has)|what('s| is) wrong|what caused|root cause)\b/i },
  { intent: INTENTS.FORECAST,  pattern: /\b(forecast|predict|will i|projected|future|next (quarter|month|year))\b/i },
  { intent: INTENTS.RECOMMEND, pattern: /\b(should i|what should|recommend|what('s| is) the best|priorit)/i },
  { intent: INTENTS.EDUCATE,   pattern: /\b(what is|what('s| is) an?|explain what|how does .* work|define)\b/i },
  { intent: INTENTS.NAVIGATE,  pattern: /\b(show me|take me to|open|go to|where (is|can i))\b/i },
  { intent: INTENTS.SUMMARIZE, pattern: /\b(summarize|summary|overview|recap|tl;?dr)\b/i },
  { intent: INTENTS.ANALYZE,   pattern: /\b(analyze|breakdown|deep dive|assessment of)\b/i },
  { intent: INTENTS.EXPLAIN,   pattern: /\b(explain|help me understand|walk me through)\b/i },
];

// classifyIntent(question) -> {intent, confidence}. Falls back to ANALYZE
// (the safest default for an open-ended question) when nothing matches,
// with LOW confidence so downstream consumers can treat it as a guess.
export function classifyIntent(question) {
  if (typeof question !== 'string' || !question.trim()) {
    return { intent: INTENTS.ANALYZE, confidence: 'LOW' };
  }
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(question)) {
      return { intent, confidence: 'HIGH' };
    }
  }
  return { intent: INTENTS.ANALYZE, confidence: 'LOW' };
}
