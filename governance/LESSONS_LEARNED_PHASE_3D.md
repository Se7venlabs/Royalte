# Lessons Learned Report™ — Phase 3D: Cross-Scan Intelligence™

Branch: `feat/phase3d-cross-scan-intelligence` (PR #442)

---

## 1. Executive Summary

Milestone: Phase 3D — Cross-Scan Intelligence™, the first of three Board-approved Phase 3 vertical slices (3D → 3C → 3E).

Outcome: successful. The milestone extends the existing Phase 3A/3B comparison and trend engines with real per-field domain comparisons across all 10 canonical domains, using an 8-state vocabulary. One defect was found during live certification, root-caused, fixed, and re-verified before this report was written.

Implementation status: complete on branch, all automated tests passing, live-verified on Preview against a real scan and a real authenticated user.

Board certification status: certified (`governance/PHASE3D_CROSS_SCAN_INTELLIGENCE_CERTIFICATION.md`). **Not merged** — awaiting explicit Board merge approval per the Merge Standard.

---

## 2. Objectives

**Original engineering objectives** (per the Board-approved Phase 3 plan): extend `api/_lib/executive-comparison.js` and `api/_lib/executive-trend-detection.js` — not replace them — to compare real field-level data (not just risk/opportunity counts) across Identity, Publishing, Catalog, Health, Backend, Media, Global Music Footprint, Monitoring, AI Insights, and Executive Overview, using the Board's 8-state vocabulary, with no schema migration and no duplication of data already persisted elsewhere.

**Approved Board scope**: backend + API + UI + tests as one complete, independently mergeable slice, per Build Vertical Slices™.

**Final delivered scope**: matches the approved scope exactly. No scope changes, additions, or reductions occurred during implementation.

---

## 3. Major Architectural Decisions

### 3.1 Read real domain fields from `audit_scans.payload`, never duplicate into the archive

**Problem**: the 8 payload-sourced domains needed real field values (e.g., Identity's `verifiedProviders`/`coverage`) to compare across two scans, but the archive's `executive_intelligence_object` jsonb snapshot only records each domain's request *status* (SUCCESS/NOT_FOUND/etc.), never its data (confirmed via code trace, `executive-intelligence-object.js:242`).

**Alternatives considered**: (a) add new structured columns to `executive_brief_archive` snapshotting key domain fields at archive time; (b) re-run the intelligence pipeline on demand to recompute a comparable snapshot.

**Final decision**: read the two real `audit_scans.payload` rows directly, via the `scan_id` foreign key already present on each archive row.

**Rationale**: the Board's own directive is explicit — "no new implementation may duplicate an existing capability." `audit_scans.payload` is already the single source of truth for a scan's canonical data; snapshotting it a second time into the archive would create two copies that could drift.

**Expected long-term benefit**: zero risk of the archive's domain data going stale relative to the real canonical payload; any future domain field automatically becomes comparable without a migration.

### 3.2 One small pure extract+compare function pair per domain, not one generic comparator

**Problem**: domains have genuinely different "what counts as improvement" semantics — higher is better for Identity coverage, but lower is better for Monitoring's action-needed event count.

**Alternatives considered**: a single generic numeric-delta comparator applied uniformly, with a per-domain "higherIsBetter" flag only.

**Final decision**: `canonical-domain-fingerprints.js` gives each domain its own `extract()`/`compare()` pair, sharing only a small `compareNumeric()` helper for the common case, with domain-specific overrides for `RESOLVED`/`NEWLY_DETECTED` where that vocabulary is genuinely meaningful (e.g., a gap count reaching zero).

**Rationale**: correctness — a generic comparator would have produced wrong results for at least Backend (gap-closing) and Monitoring (event-count) without special-casing, and every domain having its own two small functions is not meaningfully more code than a generic comparator plus per-domain configuration would have been.

**Expected long-term benefit**: adding an 11th domain later means adding one new small function pair, not extending a shared comparator's configuration surface.

### 3.3 AI Insights™ / Executive Overview™ excluded from `DOMAIN_FINGERPRINTS`

**Problem**: these two "domains" aren't canonical evidence domains — they're ATHENA's own synthesized judgment (`overallLevel`, `riskLevel`), already computed and stored on the archive row.

**Final decision**: compare them separately, directly from the archive rows' existing fields, in `executive-comparison.js`'s own `compareAiInsightsAndOverview()`.

**Rationale**: sourcing them from `audit_scans.payload` would mean re-deriving something ATHENA already computed — a second, competing derivation of the same judgment, which is exactly what the Board's "ATHENA must never become a second intelligence engine" principle forbids.

### 3.4 Single shared `compareDomain()` entrypoint

**Final decision**: both `executive-comparison.js` and `executive-trend-detection.js` call one function, `compareDomain(domainKey, payloadBefore, payloadAfter, options)`, rather than each touching the per-domain extract/compare functions directly.

**Rationale**: originally for the stated "no layer duplicates another" principle. Its value was proven in practice — see §5, the one live bug this phase produced was a direct consequence of a caller bypassing this discipline before the fix.

---

## 4. Unexpected Discoveries

- **The single largest discovery of Phase 3 planning**: research before any Phase 3D code was written found that a prior Phase 3A (PR #423) and Phase 3B (PR #426) had already delivered a working Executive Brief Archive, retrieval API, and a risk/opportunity-*count* comparison and trend engine — most of the *original* Phase 3 brief's WP1/WP2/WP4/WP5 already existed. This reshaped the entire phase from "build a comparison engine" to "extend the real one that already exists."
- The archive's jsonb snapshot does not retain raw domain field values (only request status) — this single fact determined the entire data-access design for Phase 3D (§3.1).
- `governance/ATHENA_PHASE3B_HISTORY_TIMELINE_MEMORY_COMPARISON.md`'s own header states "pending final Board review before merge," but the code was already merged to `main` with no pending diff — a documentation/reality mismatch, not a blocker, worth a future correction.
- The "Executive Change Summary™" panel near the AI Insights hero was found to be effectively mislabeled: it reads single-scan monitoring events (near-always empty), not the real cross-scan comparison — that real feature lives in a separate "Historical Intelligence" section further down the same page. Not in this phase's scope to fix; flagged for a future cleanup pass.
- `public/js/vault-auth.js`'s login UI is dead code — `initVault()` routes straight to direct entry. This meant no live product flow could produce the real Bearer session every Phase 3 feature (existing and new) requires; live verification required creating a test user directly via the Supabase admin API, bypassing the UI entirely.

---

## 5. Bugs Discovered During Certification

**Blank domain labels in the "Cross-Scan Intelligence™ — by domain" grid.**

- **Description**: the first live Preview check showed every domain tile rendering its state badge (e.g. "UNCHANGED") but no domain name text.
- **Root cause**: `buildCanonicalDomains()` (`executive-comparison.js`) attached a `label` field via a locally-defined map. `buildCanonicalDomainTrends()` (`executive-trend-detection.js`) called the shared `compareDomain()` directly and that function never attached a label at all — the UI's trends grid reads from the trends endpoint, which was the one path with no label logic.
- **Resolution**: moved label attachment into `compareDomain()` itself — the one function both endpoints already call — via a new exported `canonicalDomainLabel()`. Removed the now-redundant local label map from `executive-comparison.js`.
- **Preventative measure**: added a regression test (`tests/executive-phase3d-domain-comparison-test.mjs`) asserting every `detectDomainTrends` `canonicalDomains` entry carries a non-empty label — the exact gap that let this ship, now structurally guarded against recurring.

This was the only defect found across two full live-verification passes (initial + post-fix), each against a real scan, a real authenticated Supabase user, and direct API + UI inspection.

---

## 6. Technical Debt Removed

- Eliminated a duplicated domain-label map before it became permanent: the fix in §5 consolidated what would otherwise have been two independently-maintained label sources (one per endpoint) into one shared source of truth in `canonical-domain-fingerprints.js`.
- No pre-existing dead code was found or removed in the files touched this phase — Phase 3D is a pure extension of already-clean, already-tested Phase 3B code.

---

## 7. Technical Debt Deferred

| Item | Reason for deferral | Risk | Recommended milestone |
|---|---|---|---|
| Intelligence Vault™ login UI is dead code | Pre-existing Phase 1/2 technical debt, explicitly out of this phase's scope | No live user can reach any Bearer-gated feature (existing or new) through the actual product UI today; every live check this phase required a manually-created test user | Before or alongside Phase 3E, since Ask ATHENA's Conversation Persistence is meaningless without real production user sessions |
| Full multi-point trendline (vs. first/last endpoint comparison) | Disclosed Phase 3B limitation, not addressed this phase; meaningful only once artists have enough archived history | Low — current endpoint-comparison honestly discloses its own limitation, never fabricates a trendline | A future milestone, once real archived-history volume justifies it |
| "Executive Change Summary™" panel mislabeling on AI Insights | Discovered during this phase's research but out of Phase 3D's stated scope | Low — misleading but not incorrect; already honestly empty in the common case | A small, separately-scoped cleanup PR |
| Executive Comparison™ comparison picker (always compares the 2 most recent briefs) | Pre-existing Phase 3B disclosed limitation | Low — correct behavior, just not user-configurable yet | Future UX-scoped milestone |

---

## 8. Performance Observations

No formal benchmarking or load testing was performed this phase — the two new reads added (fetching two `audit_scans` rows by primary key) are indexed point lookups, and only qualitative observation was possible against a single test artist and a single test user during live verification. All endpoint responses observed during live testing returned in well under one second. **No measurable performance impact was observed**, but this statement should not be read as a substitute for real load testing under production traffic, which was not performed.

---

## 9. Testing Summary

- **Unit tests**: `tests/executive-phase3d-domain-comparison-test.mjs` — 20/20 passing (19 written before live verification, 1 regression test added after §5's finding).
- **Regression tests**: `tests/executive-phase3b-services-test.mjs` — 19/19 passing, confirming no behavioral change to the existing Phase 3B engine.
- **Core pipeline**: `tests/pipeline-test.mjs` — 222 positive + 8 negative assertions passing.
- **Preview verification**: two full redeploy cycles (initial implementation, then the label fix), each checked live.
- **Production validation**: not applicable — Preview only; no production deploy has occurred, correctly, since Board merge approval has not yet been granted.
- **Board certification walkthrough**: performed against a real Spotify scan and a real, pre-confirmed Supabase test user (created via the admin API, since the Vault UI is unreachable); verified via direct API inspection (`/api/executive-comparison`, `/api/executive-trends`) and full UI rendering. Documented in `governance/PHASE3D_CROSS_SCAN_INTELLIGENCE_CERTIFICATION.md`.
- **Observation**: the one real bug this phase produced (§5) was invisible to unit tests, because no unit test exercised both endpoints' output through the actual shared UI rendering code in the same assertion — it only surfaced under live, real-scan verification. This reinforces the value of the live-certification step as a distinct, non-redundant layer beyond automated testing, consistent with this project's established practice since Phase 1.

---

## 10. Governance Updates

- **Created**: `governance/PHASE3D_CROSS_SCAN_INTELLIGENCE_CERTIFICATION.md` — this phase's certification record.
- **Created**: `governance/LESSONS_LEARNED_PHASE_3D.md` — this report.
- **Modified**: none. Phase 3A/3B governance documents were left untouched — this phase extended their code, not their documented architecture.
- **Superseded**: none.
- **Deferred**: `governance/ROADMAP.md`'s "What's Live in `main` Today" entry for Phase 3D is intentionally not yet written — per this repo's established convention, that section only reflects work actually merged to `main`. It will be added at merge time, matching the pattern used for every prior phase.

---

## 11. Recommendations for Future Phases

- **Phase 3C** should follow the same principle established in §3.1: Executive Memory's `evidence_reference` field should point at real, already-persisted evidence (a scan_id, an executive_brief_id) rather than duplicating the underlying fact into the memory row itself.
- **Phase 3E**'s Capability Registry should reuse `canonical-domain-fingerprints.js`'s `extract*()` functions directly as the data layer for each domain's capability module — the extraction logic (what real fields represent this domain, what "unavailable" looks like) is already written, tested, and validated against live data; re-deriving it inside a capability module would be exactly the kind of duplication the Board has repeatedly prohibited.
- Resolve, or explicitly re-defer with a dated Board decision, the Vault/auth login gap (§7) before or alongside Phase 3E — Ask ATHENA's Conversation Persistence has no real users to persist conversations for until this is addressed.
- For any future shared entrypoint consumed by multiple callers (the `compareDomain()` pattern), add an explicit test asserting the *complete* output contract (every field every known caller needs), not just the fields the first caller happened to test — this is the general lesson behind §5's bug, not specific to domain comparison.
- The "Executive Change Summary™" mislabeling (§4, §7) is small and low-risk enough to fix in an unrelated future PR whenever someone is already touching `ai-insights.html`.

---

## 12. Final Assessment

- **Overall implementation quality**: solid. The milestone extends established, already-tested architecture faithfully, introduces no schema changes, and every live check found real, evidence-backed values with no fabrication.
- **Confidence level**: High.
- **Readiness for merge**: Ready.
- **Remaining risks**: Low. The Vault/auth gap (§7) limits how this feature can be exercised in production today, but that is pre-existing platform debt, not a defect introduced by this phase. `UNCHANGED`/`INSUFFICIENT_EVIDENCE` will dominate real-world output until artists accumulate genuinely evolving data across scans — this is correct, honest behavior, not a flaw to fix.
- **Executive Board recommendation**: approve for merge.
