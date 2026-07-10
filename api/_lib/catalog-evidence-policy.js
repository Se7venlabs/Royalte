// Catalog Evidence Policy — Phase 3.6 Amendment 1
//
// Board-owned constitutional policy for Catalog Intelligence provider precedence.
//
// Constitutional principle: "Intelligence domains should not determine which
// provider is authoritative. That decision belongs to Board-owned policy."
//
// Algorithms consume this policy. They do not define it.
// Change provider precedence only through a formal Board directive.

export const CATALOG_EVIDENCE_POLICY = Object.freeze({
  // releaseChronology: providers consulted in order for release timeline evidence.
  // First provider with data wins. Board-ratified 2026-07-03.
  releaseChronology: Object.freeze(['apple', 'discogs']),
});
