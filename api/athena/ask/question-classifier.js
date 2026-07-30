// Question Classifier™ — ATHENA™ Phase 3E
//
// Determines what a question is ABOUT (subject matter), so the Context
// Builder assembles only relevant Capability Registry data instead of the
// entire dataset on every question. Deterministic, keyword based -- never
// an LLM call, same constraint as the Intent Engine that runs before it.
//
// executiveMemory, executiveBriefArchive, and conversationHistory are always
// included regardless of category -- continuity (recalling prior context,
// confirmed facts) matters for every question, not just some.

export const CATEGORIES = Object.freeze({
  IDENTITY:    'Identity',
  PUBLISHING:  'Publishing',
  ROYALTIES:   'Royalties',
  CATALOG:     'Catalog',
  MARKETING:   'Marketing',
  MEDIA:       'Media',
  DISTRIBUTION: 'Distribution',
  STRATEGY:    'Strategy',
  REVENUE:     'Revenue',
  HEALTH:      'Health',
  GENERAL:     'General',
});

const ALWAYS_INCLUDED = Object.freeze(['executiveMemory', 'executiveBriefArchive', 'conversationHistory']);

const ALL_CAPABILITY_KEYS = Object.freeze([
  'identity', 'publishing', 'catalog', 'health', 'backend', 'media',
  'globalFootprint', 'monitoring', 'executiveMemory', 'executiveBriefArchive', 'conversationHistory',
]);

// Category -> pattern + relevant domain-specific capability keys (the
// always-included three are appended by classifyQuestion itself, not
// repeated here).
const CATEGORY_RULES = [
  { category: CATEGORIES.ROYALTIES,    pattern: /\b(royalt|revenue|earning|mechanical|payout|collect)/i, domains: ['publishing', 'backend'] },
  { category: CATEGORIES.REVENUE,      pattern: /\b(revenue|income|money|paid|payment)/i,                  domains: ['publishing', 'backend'] },
  { category: CATEGORIES.PUBLISHING,   pattern: /\b(publish|pro\b|mlc|registration|mechanical|composition|writer)/i, domains: ['publishing'] },
  { category: CATEGORIES.IDENTITY,     pattern: /\b(identity|verified|provider|profile|claim)/i,           domains: ['identity'] },
  { category: CATEGORIES.CATALOG,      pattern: /\b(catalog|isrc|track|release|discography)/i,             domains: ['catalog'] },
  { category: CATEGORIES.MARKETING,    pattern: /\b(market|promot|audience|reach|fan)/i,                    domains: ['globalFootprint', 'media'] },
  { category: CATEGORIES.DISTRIBUTION, pattern: /\b(distribut|territor|market(s)?|available in)/i,         domains: ['globalFootprint', 'media'] },
  { category: CATEGORIES.MEDIA,        pattern: /\b(video|youtube|social|content|media)/i,                  domains: ['media'] },
  { category: CATEGORIES.HEALTH,       pattern: /\b(health|score|grade|status)/i,                            domains: ['health'] },
  { category: CATEGORIES.STRATEGY,     pattern: /\b(strategy|priorit|focus|first|overall)/i,                domains: null }, // null -> all
];

export function classifyQuestion(question, intent) {
  const text = typeof question === 'string' ? question : '';
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) {
      const domains = rule.domains === null
        ? ALL_CAPABILITY_KEYS.filter(k => !ALWAYS_INCLUDED.includes(k))
        : rule.domains;
      return {
        category: rule.category,
        domains: [...new Set([...domains, ...ALWAYS_INCLUDED])],
      };
    }
  }
  // Unmatched / General -- the safe default for open-ended questions
  // includes every capability, per the Board's explicit instruction.
  return {
    category: CATEGORIES.GENERAL,
    domains: [...ALL_CAPABILITY_KEYS],
  };
}
