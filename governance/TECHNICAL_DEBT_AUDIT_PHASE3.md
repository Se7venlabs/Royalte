# Technical Debt Audit — Phase 3 Closeout

Post-Merge Engineering Directive. A complete audit of the Executive Intelligence codebase as it exists on `main`, per the Board's closeout directive (§4). No changes made except where explicitly noted as low-risk and self-contained — most items here are documented, not fixed, per the directive's own instruction ("no changes are required unless they are low-risk and self-contained").

---

## Method

Grepped the full Executive Intelligence tree (`api/athena/`, `api/_lib/executive-*.js`, `api/_lib/canonical-domain-fingerprints.js`, `api/ask-athena.js`, and the workspace pages that call these endpoints) for explicit debt markers (`TODO`, `FIXME`, `HACK`, `deprecated`, `XXX`), then cross-referenced every debt item already disclosed in the three Lessons Learned Reports (Phase 3D, 3C, 3E) to confirm current state, then looked for structural duplication not previously flagged.

## Findings

### 1. Zero inline debt markers

No `TODO`, `FIXME`, `HACK`, `XXX`, or `deprecated` comment exists anywhere in the Executive Intelligence tree. This codebase's convention is to document known issues by name in governance/Lessons Learned reports rather than leave inline markers — confirmed consistent across all of Phase 3.

### 2. Dead code: `public/js/vault-auth.js`'s login UI (pre-existing, carried forward across all three Phase 3 milestones)

**Status**: still present, confirmed by direct read. `initVault()` calls `_enterMissionControlDirect()` unconditionally — the real authenticated-login code path is unreachable from any live UI action.

**Impact**: every Phase 3 feature (Executive Memory™, Cross-Scan Intelligence™, Ask ATHENA™) requires a real Bearer session, and no live product flow produces one. Every live certification across 3D, 3C, and 3E required manually-created test users via the Supabase admin API.

**Recommendation**: this is the single most repeated finding across all three Phase 3 Lessons Learned reports. It should be prioritized before Phase 4 planning — not a "no changes required" item, but explicitly flagged (not fixed) per this audit's own no-runtime-change scope.

### 3. Dead/misleading UI: "Executive Change Summary™" panel on `ai-insights.html`

**Status**: still present, confirmed by direct read (`ai-insights.html` lines ~135, ~705, ~1193). This panel reads single-scan Monitoring Intelligence™ events (near-always empty for a typical scan), not the real cross-scan comparison — the actual comparison feature lives in the separate "Historical Intelligence" section further down the same page.

**Impact**: low — misleading label, not incorrect data (the panel is honestly empty in the common case, never fabricates content).

**Recommendation**: unchanged from Phase 3D's original finding — small, separately-scoped cleanup PR, whenever someone is already touching `ai-insights.html`.

### 4. Duplicate boilerplate: `getAdminClient()` + Bearer-token extraction, repeated across 13 endpoint files

**Status**: newly identified this audit. `getAdminClient()` (identical ~5-line function reading `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, constructing a `createClient(..., {auth:{persistSession:false}})`) and the Bearer-token-extraction/validation block (`authHeader.startsWith('Bearer ')` → `supabase.auth.getUser(token)` → 401 on failure) are each copy-pasted verbatim across 13 files: `api/ask-athena.js`, `api/executive-brief-archive.js`, `api/executive-comparison.js`, `api/executive-intelligence.js`, `api/executive-memory-actions.js`, `api/executive-trends.js`, `api/executive-memory.js`, `api/executive-history-summary.js`, `api/executive-timeline.js`, `api/claim-scan.js`, `api/save-profile-info.js`, `api/royalty-statements.js`, `api/save-music-rights-profile.js`.

**Impact**: low today — the duplication is small (≈15 lines per file) and has not caused a bug (every copy is behaviorally identical, confirmed by the consistent 401 behavior across every endpoint's own tests). Risk grows only if the pattern needs to change (e.g., supporting a second auth scheme) — 13 files would need the same edit.

**Candidate refactor**: extract a shared `api/_lib/auth-context.js` exporting `getAdminClient()` and `resolveAuthenticatedUser(req, supabase)` (returning `{user, error, statusCode}` or similar), then migrate callers incrementally.

**Not done in this audit**: touching 13 live endpoint files is not "self-contained" by this directive's own standard, even though each individual change would be low-risk — the *number* of files touched crosses into a real refactor PR, not a closeout-audit-scope edit. Flagged as a Phase 4 candidate, not executed here.

### 5. Prompt Assembly's token budget is a character-count proxy, not a real tokenizer (Phase 3E, already disclosed)

**Status**: still present, by design — `governance/LESSONS_LEARNED_PHASE_3E.md` §7 already documents this as deferred, not a defect. No new finding; confirmed unchanged.

### 6. Executive Intelligence Bus™ has exactly one publisher and zero subscribers

**Status**: confirmed via `RUNTIME_DEPENDENCY_MAP.md` §4 — `api/athena/bus/executive-intelligence-bus.js` is real, tested code (not dead code by the "never called" definition — `executive-memory-store.js` publishes to it on every write), but nothing on `main` today subscribes. This is an intentional, honestly-disclosed extension point (see the Phase 3C/3E governance docs' own framing), not an oversight.

**Recommendation**: no action — re-evaluate only if a genuine second consumer emerges (e.g. a future notification system).

### 7. Six reserved Phase 3E components — documented, zero code

Executive Decision Engine™, Executive Skills™, Executive Planner™, Executive Learning™, Recommendation Ranking Engine™, Tool Invocation Framework™, Executive Action Framework™ — each has a governance document and no implementation. Not technical debt (nothing was left half-built), but listed here for completeness since a future auditor might otherwise wonder why the doc exists with no matching code. See each document's own "When to build it" section.

### 8. Duplicate query: `listBriefs()` called twice per `/api/ask-athena` request

**Status**: newly identified while gathering query-count data for `governance/PERFORMANCE_BASELINE_PHASE3.md`. `api/ask-athena.js`'s `buildRawInputs()` calls `listBriefs()` directly (limit 2, descending, for `latestBrief`/`previousBrief`), then separately calls `buildExecutiveMemory()`, which internally calls `listBriefs()` again (limit 20, ascending, for `recurringIssues`/`resolvedIssues`) — two real round-trips to `executive_brief_archive` per request. See `PERFORMANCE_BASELINE_PHASE3.md` §4 for full detail and why this was not fixed here (the two calls use genuinely different parameters for genuinely different purposes — collapsing them risks subtly changing which briefs the deterministic "compare last two scans" pattern selects, crossing out of this audit's "low-risk and self-contained" bar).

### 9. No duplicate business logic found beyond items 4 and 8

Specifically checked and confirmed clean: no second implementation of domain comparison logic exists anywhere outside `canonical-domain-fingerprints.js` (the AI Insights/Executive Overview comparison in `executive-comparison.js` is a deliberately separate case — comparing ATHENA's own already-computed judgment, not a second domain-fingerprint system, per that file's own documented rationale). No second Response Contract shape exists — `api/athena/ask/response-contract.js` is the only place `{status, answer, answerType, ...}` is constructed for Ask ATHENA. No second Capability Registry exists.

## Summary

| Item | Type | Action taken |
|---|---|---|
| Vault/auth login UI dead code | Dead code, pre-existing | Documented, not fixed — flagged as highest-priority pre-Phase-4 item |
| "Executive Change Summary™" mislabeling | Misleading UI, pre-existing | Documented, not fixed — low risk, small future PR |
| 13-file `getAdminClient()`/Bearer-auth duplication | Duplicate logic, newly identified | Documented, not fixed — candidate refactor for Phase 4, out of this audit's self-contained-change scope |
| Prompt Assembly character-count proxy | Documented limitation | No change — already disclosed, correct for the placeholder-provider era |
| Executive Intelligence Bus zero subscribers | Honest extension point | No change — not dead code, working as designed |
| Six reserved Phase 3E components | Documentation only | No change — each has its own governance document |
| `listBriefs()` called twice per `/api/ask-athena` request | Duplicate query, newly identified | Documented, not fixed — genuine optimization opportunity, not a trivial merge; candidate for Phase 4 |

No candidate met this directive's bar for "low-risk and self-contained" enough to fix during this audit itself — every finding either requires touching many files (item 4) or is genuinely out of this closeout's scope to fix (items 2, 3, both pre-existing and already carried forward once by the Board's own prior decision). This is consistent with the directive's own instruction: catalog, don't necessarily change.
