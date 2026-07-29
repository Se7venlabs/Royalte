# Phase 3D — Cross-Scan Intelligence™ Certification

Branch: `feat/phase3d-cross-scan-intelligence` (PR #442)

Per the Board's "Build Vertical Slices™" directive, this is the first of three fully sequential, fully complete slices (3D → 3C → 3E). This document certifies 3D's implementation before requesting Board merge approval — **per the Merge Standard, certification alone does not authorize merge.**

---

## 1. What already existed vs. what was built

Confirmed by the audit performed during planning (see `governance/BOARD_DECISIONS.md` / the approved Phase 3 plan): Phase 3A/3B (PRs #423/#426) already delivered a working risk/opportunity-*count* comparison and trend engine (`api/_lib/executive-comparison.js`, `api/_lib/executive-trend-detection.js`), covering 6 of ATHENA's own domain vocabulary (identity/rights/catalog/distribution/monitoring/system_operations). That engine was **extended, not replaced**.

**Genuinely new this phase**: `api/_lib/canonical-domain-fingerprints.js` — one small pure extract+compare function pair per canonical domain (Identity, Publishing, Catalog, Health, Backend, Media, Global Music Footprint, Monitoring), reading real fields directly from the two scans' own `audit_scans.payload` rows (confirmed via code trace: the archive's `executive_intelligence_object` jsonb only records each domain's request *status*, never its data — `executive-intelligence-object.js:242`). AI Insights™ and Executive Overview™ compare ATHENA's own `overallLevel`/`riskLevel`, already available on the archive rows — no new fingerprint needed for those two.

New 8-state vocabulary: `IMPROVED / DECLINED / UNCHANGED / NEWLY_DETECTED / RESOLVED / UNKNOWN / NOT_COMPARABLE / INSUFFICIENT_EVIDENCE`.

Both extended endpoints (`/api/executive-comparison`, `/api/executive-trends`) remain backward compatible: the new `canonicalDomains` field is `null` unless the caller's underlying scan rows resolve; every existing field is untouched.

## 2. UI

`public/workspaces/ai-insights.html`'s existing Historical Intelligence™ section gained:
- A "Cross-Scan Intelligence™ — by domain" grid inside the Executive Trends™ card, sourced from `/api/executive-trends`'s new `canonicalDomains`.
- Additional rows on Executive Comparison™ for any canonical domain not in `UNCHANGED`/`INSUFFICIENT_EVIDENCE` state.
- New CSS badge states for the 8-value vocabulary, matching the existing badge pattern.
- Both honestly render an empty state when `canonicalDomains` is `null` (underlying scan rows unresolved) rather than silently omitting the section.

## 3. Automated test results

- `tests/executive-phase3d-domain-comparison-test.mjs` — **20/20 passing** (19 initial + 1 regression test added after the live-verification finding below).
- `tests/executive-phase3b-services-test.mjs` — **19/19 passing**, no regressions to the existing Phase 3B engine.
- `tests/pipeline-test.mjs` — **222 positive + 8 negative assertions passing**, no regressions to the core audit pipeline.

## 4. Live verification (Executive Board Certification Walkthrough)

Performed against the real Preview deployment, using a real Spotify scan (Tame Impala) and a real, pre-confirmed Supabase test user (created via the admin API locally, since the Vault login UI is dead code — see the approved plan's flagged dependency).

**Finding, fixed before certification**: the first live pass showed the new "Cross-Scan Intelligence™ — by domain" grid rendering state badges with **no domain label** — blank text where "Identity Intelligence™" etc. should appear. Root cause: `buildCanonicalDomains()` (`executive-comparison.js`) attached a `label` field via a local map, but `buildCanonicalDomainTrends()` (`executive-trend-detection.js`) called the shared `compareDomain()` directly and that function never attached a label at all — only the comparison endpoint had labels, not the trends endpoint the grid actually reads from.

**Fix**: moved the label map into `canonical-domain-fingerprints.js` as `canonicalDomainLabel()`, and `compareDomain()` — the single shared entrypoint both endpoints call — now attaches `label` itself. Removed the now-redundant local copy in `executive-comparison.js`. Added a regression test (`tests/executive-phase3d-domain-comparison-test.mjs`, "every detectDomainTrends canonicalDomains entry carries a real display label") asserting the exact gap that let this ship, so it can't silently regress.

**Re-verified live after the fix**, on a fresh redeploy: `/api/executive-trends` returns real `label` values for all 8 domains (confirmed via direct fetch), and the UI grid renders both label and badge correctly for every tile:

```
Identity Intelligence™     UNCHANGED
Publishing Intelligence™   INSUFFICIENT EVIDENCE
Catalog Intelligence™      UNCHANGED
Health Intelligence™       UNCHANGED
Backend Intelligence™      UNCHANGED
Media Intelligence™        UNCHANGED
Global Music Footprint™    UNCHANGED
Monitoring™                INSUFFICIENT EVIDENCE
```

`INSUFFICIENT_EVIDENCE` for Publishing/Monitoring was confirmed correct, not a bug: direct payload inspection showed `cim.publishing.coverage: null` (no MLC data resolved for this test scan) and `monitoringIntelligence: null` (genuine first-scan baseline) in both compared scans — the fingerprint functions honestly report unavailable data rather than treating `null` as zero or fabricating a value.

No console errors on any page visited. `/api/executive-comparison` was also verified directly: 10 canonical domains returned (8 fingerprinted + aiInsights + executiveOverview), correct state classification confirmed against known input deltas.

## 5. Certification

- Existing architecture extended, not duplicated — **YES**.
- Every canonical domain's comparison sourced from real evidence, no fabrication — **YES**.
- Backward compatible with every existing caller of the extended endpoints — **YES**.
- One issue found live, root-caused, fixed, and re-verified before this document was finalized — **YES**.
- All automated tests green — **YES**.

## 6. Merge status

**NOT MERGED.** Per the Board's explicit Merge Standard for this phase, certification does not authorize merge — this branch (PR #442) awaits a separate, explicit Board go-ahead. Per the Vertical Slices directive, Phase 3C's implementation does not begin until Phase 3D is merged to `main`.
