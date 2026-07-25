# ATHENA™ Phase 3B — Executive History™, Timeline™, Memory™, Comparison™

**Status:** Implementation complete, PR #426, pending final Board review before merge.
**Depends on:** ATHENA™ Phase 3A (`ATHENA_PHASE3A_EXECUTIVE_BRIEF_ARCHIVE_ARCHITECTURE.md`), `CANONICAL_EXECUTIVE_ARCHITECTURE.md`.

---

## 1. Summary

Phase 3B is a **consumer** of the Executive Brief Archive™ established in Phase 3A — it introduces no new persistence. Every capability below reads through one shared data-access layer, `api/_lib/executive-brief-archive-reader.js` (refactored out of Phase 3A's read endpoint), so "which function queries the archive" has exactly one answer across all five services.

| Priority | Deliverable | Service | Endpoint |
|---|---|---|---|
| 1 | Executive History™ | `api/_lib/executive-history.js` | reuses `api/executive-brief-archive.js` list mode |
| 2 | Executive Timeline™ | `api/_lib/executive-timeline.js` | `api/executive-timeline.js` |
| 3 | Executive Memory™ (foundation) | `api/_lib/executive-memory.js` | `api/executive-memory.js` |
| 4 | Executive Comparison™ | `api/_lib/executive-comparison.js` | `api/executive-comparison.js` |
| 5 | Trend detection | `api/_lib/executive-trend-detection.js` | `api/executive-trends.js` |
| 6 | Authenticated History API | `api/_lib/executive-brief-archive-reader.js` | all of the above |
| Amendment 2 | Executive History Summary™ | `api/_lib/executive-history-summary.js` | `api/executive-history-summary.js` |
| Amendment 1 | AI Insights™ integration | — | `public/workspaces/ai-insights.html`, new "Historical Intelligence™" section |

All endpoints are Bearer-authenticated and scope every query to the caller's own `auth.uid()` server-side — none accept an artist id from the client. `api/executive-intelligence.js` (the unauthenticated compute endpoint) was never touched and remains incapable of reading the archive, per the Phase 3A constraint carried forward.

---

## 2. Methodology — stated explicitly, not left implicit

**Executive Comparison™** (`compareExecutiveBriefs`) reports every real field delta between two archived briefs (risk/opportunity/critical-issue counts, categorical level changes, per-domain risk/opportunity movement). It deliberately does **not** produce a synthetic composite "Executive Health +N" score — no such single number exists anywhere in the Executive Intelligence Object, and inventing one would be a second scoring formula competing with the real Health Engine™, which `CANONICAL_EXECUTIVE_ARCHITECTURE.md`'s layer separation forbids.

**Cross-Scan Trend Intelligence™** (`detectDomainTrends`) classifies each domain by comparing risk counts at the *first and last* brief of the analyzed window: `emerging` (0 → N), `resolved` (N → 0), `improving` (decreased), `declining` (increased), `stable` (unchanged). This is an endpoint comparison, not a full trendline — a domain that got worse then better within the window would read by its endpoints only. Disclosed as a real v1 limitation in the module's own header, not hidden.

**Executive History Summary™** (`getExecutiveHistorySummary`, Board Amendment 2) is more rigorous than Trend Detection where it can afford to be, since it looks at the *entire* analyzed window rather than just two points:
- **Most Improved Domain** — the single domain with the largest net risk-count decrease from first to last brief in the window. Only reported if at least one domain genuinely improved (never a "least bad" fallback).
- **Most Volatile Domain** — the domain with the greatest *total variation* (sum of `|change|` between every consecutive pair of archived briefs), which captures real up-and-down movement a net-change measure would miss (a domain that spiked and returned to baseline nets to zero but is genuinely the most volatile one).
- `archivedBriefCount` is a true total (`countBriefs()`, an exact-count query independent of any row limit); `analyzedBriefCount` and `windowLimited: true` disclose honestly when the domain-level analysis window (capped at 100 most recent briefs) is smaller than the artist's full archived history.

**Executive Memory™ (foundation)** (`buildExecutiveMemory`) derives Recurring Issues (present in an earlier archived brief AND the latest) and Resolved Issues (present earlier, absent from the latest) from real archive history — genuinely derivable. **Goals, Dismissed Recommendations, and Milestones remain `available: false`** with an explicit reason: they are artist-authored intent and state changes, not derivable from archived Executive Intelligence, and building real support requires a new writable table — a second persistence layer explicitly out of this phase's "consumer, not a producer of new persistence" scope. This mirrors exactly how Phase 1 handled Forecast™/Timeline™ before their real engines existed: honestly unavailable, never fabricated.

---

## 3. AI Insights™ integration (Amendment 1)

A new "Historical Intelligence™" section was added to `public/workspaces/ai-insights.html`, appended after the existing Intelligence Coverage Snapshot™ and before the Ask ATHENA™ placeholder — purely additive, no existing locked section renamed, redesigned, or restructured (same discipline as Phase 2's Option 3 evolution). Five sub-panels in the Board-specified order: Executive History Summary™, Executive Timeline™, Executive Trends™, Executive Memory™, Executive Comparison™.

**Consolidation, not duplication:** the Executive Memory™ panel built in Phase 2 (which only ever showed the current scan's monitoring history) now lives inside this section and reads the richer Phase 3B `/api/executive-memory` response (cross-scan recurring/resolved issues) instead of being a second, separate panel. `renderMemoryBody()` was updated in place; the Phase 2 panel was not duplicated.

**Authentication boundary, visible in the UI:** the entire Historical Intelligence™ section requires an authenticated session (the archive is per-artist). Anonymous visitors see an honest "Sign in to view your historical intelligence" message — every other section of the page (Hero, Executive Actions™, Priority Roadmap™, Executive Forecast™, Coverage Snapshot™) is completely unaffected, preserving the Phase 3A constitutional rule that anonymous scan behavior never regresses. The page resolves the caller's Supabase session via the same dynamic-import pattern introduced in Phase 3A (`/js/supabase-client.js`, no `<script type="module">` tag needed).

**Executive Comparison™ default:** no comparison-picker UI exists yet — the panel automatically compares the two most recently archived briefs. Building a picker is natural follow-up UI work, not required to satisfy this amendment.

---

## 4. Test coverage

- `tests/executive-phase3b-services-test.mjs` — 19 tests: archive reader (filtering, ordering, comparison-pair fetch), Comparison (deltas, explicit absence of a synthetic health score), Trend Detection (all 5 classifications), History (availability), Timeline (real event surfacing, chronological ordering), Memory (recurring/resolved classification, permanent unavailability of goals/dismissed/milestones), **History Summary** (empty archive, single brief, multi-brief min/max, Most Improved Domain, Most Volatile Domain distinguishing net-change from total-variation, `windowLimited` honesty with 150 synthetic briefs).
- `tests/executive-brief-archive-test.mjs` — 18/18, unaffected by the reader refactor (endpoint contract unchanged).
- `tests/athena-adapter-test.mjs` (49/49), `tests/athena-engine-test.mjs` (138/138), `tests/pipeline-test.mjs` (222+8) — all unaffected, confirming isolation from Phase 1/2 and the core engine.

---

## 5. Files

**New:** `api/_lib/executive-brief-archive-reader.js`, `executive-comparison.js`, `executive-domain-labels.js`, `executive-history.js`, `executive-history-summary.js`, `executive-memory.js`, `executive-timeline.js`, `executive-trend-detection.js`; `api/executive-comparison.js`, `executive-history-summary.js`, `executive-memory.js`, `executive-timeline.js`, `executive-trends.js`; `tests/executive-phase3b-services-test.mjs`; this document.

**Modified:** `api/executive-brief-archive.js` (refactored to a thin wrapper over the shared reader, same contract), `public/workspaces/ai-insights.html` (new Historical Intelligence™ section; `renderMemoryBody()` updated to the Phase 3B cross-scan shape; small domain-label mirror comment), `vercel.json` (5 new routes).

**Not touched:** `api/athena/*`, `api/executive-intelligence.js`'s generation/archival logic (Phase 1–3A), `supabase/migrations/*` (no new migration — Phase 3B introduces zero new persistence).

---

## 6. Governance sequencing

Per the standing Phase PR governance protocol (Board Directive 2026-06-12), `CHANGELOG.md` and `BOARD_DECISIONS.md` entries require the actual merge commit SHA and are added in a post-merge backfill PR, consistent with every prior phase in this initiative (Phase 1/2, Phase 3A's code PR and its two follow-up governance/operational-validation PRs). This document itself — the Phase 3B architecture record — is included in PR #426 since it doesn't depend on a merge SHA.
