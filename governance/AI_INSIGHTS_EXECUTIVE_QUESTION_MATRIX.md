# AI Insights™ — Executive Question Audit™

**Status:** Discovery Phase — no code changes. Investigation only.
**Requested by:** Executive Board
**Date:** 2026-07-23
**Standard applied:** Constitution §4.21, Executive Question Framework™ — every KPI/insight must answer one, and only one, executive business question, stated in a single sentence.

---

| # | Card / Element | Executive Question (as currently implied) | Answers One? | Meaningful? | Verdict |
|---|---|---|---|---|---|
| 1 | Risk count headline ("N critical issues") | "How many critical issues need my attention right now?" | Yes | Yes | **Keep** — real count, clear question |
| 2 | Executive Actions™ real recommendation cards | "What should I fix first?" | Yes | Yes | **Keep**, but see Decision Audit — needs the underlying fabricated-fill-content removed |
| 3 | Executive Actions™ synthetic low-score fill cards | Implies "What should I fix first?" but is answered with generic, non-specific template text | No — answers a *different*, unstated question ("what does a generically weak module look like") | No — an artist cannot act on "Your Publishing Intelligence™ score needs improvement" without a specific evidence-backed reason | **Remove.** No executive question is legitimately answered by hardcoded filler; if there are too few real risks/opportunities to fill 4 cards, showing fewer real cards is more honest than padding with generic text |
| 4 | Priority Roadmap™ | "In what order should I act?" | Yes | Yes | **Keep** — real, sourced from `executiveBrief.priorityActions` |
| 5 | Forecast insight 0 (headline narrative) | "What's the single most important thing happening in my business right now?" | Yes | Yes | **Keep, rewrite the fallback chain** — currently falls back through `royalteAI.executiveInsight` → `executiveBrief.executiveSummary`; both are real, no issue, but see ATHENA Boundary Review on how this is presented |
| 6 | Forecast insight 1 (top risk) | "What's my biggest risk?" | Yes | Yes | **Keep** — duplicates information from card 2/Priority Roadmap™ in narrative form; acceptable if intentionally framed as a *summary restatement*, not a new fact (see Duplicate Intelligence Audit) |
| 7 | Forecast insight 2 (top opportunity) | "What's my biggest opportunity?" | Yes | Yes | **Keep** — same caveat as #6 |
| 8 | "Confidence Score™" metric tile | Implies "How confident should I be in this analysis?" but is actually just the Health Score | No — the label promises a different question than the data answers | No — misleading as currently labeled | **Remove or re-source.** Either relabel honestly as "Health Score" (making the duplication explicit and intentional) or replace with a genuinely different metric answering a genuinely different question (see KPI Discovery) |
| 9 | "Evidence Coverage™" metric tile | Implies "How much of my business is backed by real evidence?" but is actually just the Health Grade | No — same mislabeling problem as #8 | No | **Remove or re-source**, same reasoning |
| 10 | "Open Risks™" metric tile | "How many open risks exist?" | Yes | Yes, but redundant with card 1's "N critical issues" | **Consolidate** — cards 1 and 10 answer the same question twice on the same page |
| 11 | "Opportunities" metric tile | "How many opportunities exist?" | Yes | Marginal — a bare count with no ranking or detail | **Keep as a supporting stat only**, not a standalone headline card |
| 12 | Living Intelligence Core orbital SVG | Implies "What is being analyzed right now?" | No — not bound to any real field, purely decorative | No — animation with no informational content | **Remove or clearly label as pure visual branding**, not an intelligence display |
| 13 | ATHENA™ hero branding / orb label | Implies "ATHENA has analyzed your business" | No — no real system performs this analysis today | No — actively misleading given the real ATHENA™ engine is dormant with zero production callers | **Remove or rewrite** — see ATHENA Boundary Review for the constitutional violation this represents |

---

## Summary

Of 13 distinct page elements evaluated: **6 clearly pass** (real evidence, one clear question, meaningful), **3 need removal** (fabricated fill content, decorative animation with no data), **2 need relabeling or replacement** (the two mislabeled Health-Score-duplicate tiles), **1 needs consolidation** (duplicate risk-count display), **1 needs rewriting** (ATHENA branding overstating what's actually happening).

No element on the current page is a case of "real evidence, real question, but the wrong question" — the failures cluster specifically around (a) content that isn't real evidence at all, and (b) branding/labeling that overstates what a real, correctly-computed value actually represents.
