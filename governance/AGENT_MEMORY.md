# Royaltē Agent Memory

**Status:** institutional memory for every AI agent operating in this repository.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md` § entire document.
**Effective:** 2026-06-11

This is the **second document** every AI shall read after the Master Constitution. It captures the current state of the platform, the Engineering Stack, the Executive Board, and the governance process every AI is expected to follow.

When the Constitution and this document disagree, **the Constitution wins.**

---

## 1. Current Constitution

| | |
|---|---|
| Path | `constitution/ROYALTE_MASTER_CONSTITUTION.md` |
| Version | **v1.3** |
| Effective | 2026-06-11 |
| Last ratifying PR | #132 |
| Companion document | `docs/ROYALTE_ENGINEERING_STACK.md` |

Prior versions are **not** preserved as separate files; their substance lives in the in-document Revision History. The repository shall contain exactly one constitutional authority.

---

## 2. Current Build Phase

| | |
|---|---|
| Most recently completed phase | **Mission Control™ v2.0 Sprint 2 — Evidence Contracts™** |
| Merged at | `d10d469` (PR #305, 2026-07-11) |
| Tag | `evidence-contracts-sprint2-v1.0` |
| Prior phase | Mission Control™ v2.0 Sprint 1 — Canonical Registry Foundation™ (`a902da7`, PR #303, 2026-07-11) |
| Active direction | **Canonical Intelligence Platform™ — Sprint 2 merged and locked.** Evidence Contracts™ are the constitutional transport layer for all provider evidence. Sprint 3 (Evidence Registry™) is next. |
| Next Board gate | Sprint 3 brief required from the Board to begin Evidence Registry™. |

**⚠ ACTIVE INITIATIVE — Mission Control™ Data Integrity Program™ (2026-07-11)**  
Black Alternative is the **Canonical Development Artist™**. Every workspace must accurately represent Black Alternative's verified scan results before any new module development begins.  
Canonical fixture: `public/fixtures/canonical-black-alternative.json`  
Validation report: `governance/CANONICAL_VALIDATION_REPORT.md`

**⚠ MANDATORY GATE — Executive Product Review Standard™ (2026-07-04)**
Every Executive Workspace must pass the mandatory three-gate process before merge:
1. Development Complete
2. Product Review Complete — per `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`
3. Board Review Complete

The Engineering Agent is responsible for the Product Review before opening a PR. No workspace may merge without completing all three gates. See full standard at `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`.

**⚠ MANDATORY GATE — Executive Product Review Standard™ (2026-07-04)**
Every Executive Workspace must pass the mandatory three-gate process before merge:
1. Development Complete
2. Product Review Complete — per `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`
3. Board Review Complete

The Engineering Agent is responsible for the Product Review before opening a PR. No workspace may merge without completing all three gates. See full standard at `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`.

**Executive Workspace Sprint underway.** Three Executive Workspaces complete. Health Intelligence™ (PR #220, emerald), Identity Intelligence™ (PR #222, purple), and Publishing Intelligence™ (PR #224, Royal Violet) are the three active departments in the ws-dept scoping system. Ambient Module Elevation™ introduces workspace-scoped ambient card glows — each dept class owns its accent color; large blur, very low opacity, feathers outside card edges. Future workspaces add `ws-dept--*` scoping without touching existing workspace CSS.

**Reporting Time Zone™ is now dynamic and profile-backed.** `royalte-tz.js` is the sole RTZ owner. Resolution: `profiles.reporting_timezone` → `localStorage` → browser `Intl.DateTimeFormat`. IANA zone stored on first detection; abbreviation derived live (DST-aware). Settings → Preferences override UI is deferred. RTZ lives exclusively on MC System Status™ — never in Executive Workspace panels.

**Executive Image Service™ is now the sole owner of image selection.** No workspace may reference Apple, Spotify, Deezer, or any platform directly for image URLs. Backend: `api/_lib/image-service.js` (`getBestVerifiedArtistImage` / `getBestVerifiedReleaseArtwork`). Frontend: `public/js/royalte-image-service.js` (reads canonical payload fields only). CSS standard: `.royalte-exec-img` (80×80, `--artist` circular, `--artwork` 6px). `run-scan.js` inline platform chains replaced.

**MC Intelligence Sprint (MC cards on Mission Control) remains active.** Three MC modules complete. Health Intelligence™ (PR #211) + Identity Intelligence™ (PR #213) + Publishing Intelligence™ (PR #215) are constitutional presentation layers using the `build*Plan` / `apply*Plan` wiring pattern. Publishing introduces Financial Impact™ (Section 4). Financial Neutrality Rule™ governs all impact language. Executive Layout Optimization™ v1.0 is the density baseline; final holistic pass deferred until all MC modules complete.

**Phase 3.6 Deezer (PR #201, `ba66b26`, 2026-07-03):** Streaming Verification Authority™, trust 80. `getDeezer()` direct-call retired. All original streaming providers (Apple, Spotify, Deezer) now 100% migrated to PAL. Suite 11 (67 assertions). `platforms.deezer.isrcs[]` is the constitutional bridge for future Verification Intelligence™.

**Provider Expansion Sprint (PRs #194–#199, COMPLETE, 2026-07-02):**
- Phase 3.6 Spotify (PR #194, `ba4054d`) — Streaming Authority, trust 90, client-credentials OAuth
- Phase 3.7 Recording Intelligence Foundation™ + Amendment (PR #195, `2057db6`) — Board-locked RECORDING_CONFIDENCE_WEIGHTS; Suite 06 (83 assertions)
- Phase 3.8 MusicBrainz + Amendment 1 (PR #196, `b966881`) — Canonical Metadata Authority, trust 80; Suite 07 (73 assertions)
- Phase 3.6 Discogs + Amendment 1 (PR #197, `aea8095`) — Catalog Authority, trust 75; Suite 08 (79 assertions)
- Phase 3.6 YouTube OAC (PR #198, `fb44ef5`) — Digital Presence Authority, trust 85; Suite 09 (66 assertions)
- Phase 3.6 The MLC (PR #199, `67d7fe8`) — Publishing Authority, trust 95; Suite 10 (63 assertions); Recording → Song Code → Musical Work hierarchy locked

**Phase 3.5 Certification Sprint (COMPLETE):** Board Certification Harness, Certification Artist Library (12 archetypes), Regression Suite, Determinism Suite, CIM Integrity Suite, Performance Baseline (Full RIE p95: 0.33ms), `deepFreeze` bug fix in `backend-intelligence.js`, `royalte-os-v1.0` tagged at `65c5c16`.

**Phase 3.4 — Website Scan is a constitutional presentation layer.** All displayed intelligence reads from the Certified CIM. ISRC Coverage is a permanent RIE field (`isrcCoverage` in `catalogIntelligence`). Catalog Availability reads from `globalMusicFootprint.status`. Zero business logic remains in `_renderV2Found`.

Phase lock history: MC v2.0 Sprint 1 `a902da7` / `canonical-registry-sprint1-v1.0`. Phase 6 `a23788b` / `intelligence-engine-v1.0`. Phase 6.5 `52b1750`. Phase 7 `ec57481`. Phase 7.5 `38ec3be`. Phase 8 `8f00014` / `phase-8-scan-pipeline-wiring-v1.0`. Phase 3.1 (CimAdapter + scan-migration) `77c827a`. Phase 3.2 (One Health Engine) `aca5571`. Phase 3.3 (Apple Production Migration) `584770d`. Phase 3.4 (Product Consumption Cleanup) `8a71df7`. Phase 3.5 (OS v1.0 Certification) `65c5c16` / `royalte-os-v1.0`. Phase 3.6 Spotify `ba4054d`. Phase 3.7 (Recording Intelligence) `2057db6`. Phase 3.8 (MusicBrainz) `b966881`. Phase 3.6 Discogs `aea8095`. Phase 3.6 YouTube `fb44ef5`. Phase 3.6 MLC `67d7fe8`. Phase 3.6 Deezer `ba66b26`. MC-3.2 Health Intelligence™ Executive Assessment `346a2d0`. MC-3.2-ELO Executive Layout Optimization™ v1.0 `83c8804`. MC-3.3 Identity Intelligence™ Executive Passport `654eb52`. MC-3.4 Publishing Intelligence™ Executive Passport + Amendment 1 `2bb1af2`. MC-3.4 Amendment 2 (executive brief typography) `8400134`.

The full phase ledger lives in `governance/ROADMAP.md`. The merge history lives in `governance/CHANGELOG.md`. The legacy retirement checklist lives in `governance/MIGRATION_RETIREMENT_REGISTER.md`.

---

## 3. Engineering Stack

The seven-layer architecture ratified in Constitution Section 8B:

```
1. Providers
       ↓
2. Normalization Adapters             lib/publishing/*-adapter.js
       ↓
3. Royaltē Identity Graph™            api/_lib/identity-graph.js
       ↓
4. Canonical Intelligence Assembly™   api/_lib/cio-assembler.js
       ↓
5. Canonical Intelligence Object™     (deep-frozen artifact)
       ↓
6. Royaltē Rule Library™              api/rules/*
       ↓
7. Royaltē Intelligence Engine™       api/_lib/intelligence-engine.js
       ↓
8. Consumers
```

Per-layer file paths, public APIs, and lock points are documented in `docs/ROYALTE_ENGINEERING_STACK.md`.

**Constitutional separation (non-negotiable):**
- **Knowledge** belongs in the Rule Library.
- **Execution** belongs in the Intelligence Engine.
- **Presentation** belongs in consumers.

Mixing these is constitutionally rejected.

---

## 4. Executive Board

Full Board roster — including titles, responsibilities, and authorities — lives in `governance/EXECUTIVE_BOARD.md`. Briefs may quote the Board collectively ("Board Directive") or call out a specific Executive when their domain applies.

---

## 5. Product Philosophy

- **Category:** Music Backend Intelligence™
- **Mission:** Royaltē shows artists what is broken between the music and the money.
- **Constitutional motto:** *Clarity Creates Control. Intelligence Creates Value.*
- **Engineering motto:** *One Adapter. One Graph. One CIO. One Library. One Engine. One Platform.*

Royaltē verifies intelligence; Royaltē does not estimate intelligence. Every number must be traceable and defensible. (Constitution § 6, § 8B.6.)

---

## 6. Current Architecture (file map)

| Layer | File | Lock |
|---|---|---|
| Phase 2 — Publishing Adapter | `lib/publishing/mlc-adapter.js` | `mlc-publishing-adapter-v1.0` (`bca9e68`) |
| Phase 3 — Identity Graph | `api/_lib/identity-graph.js` | `bf12b5a` |
| Phase 4 — CIO Assembler | `api/_lib/cio-assembler.js` + `api/schema/cio.js` | `a3c78d7` |
| Phase 5 — Rule Library | `api/rules/*` | `8907bd6` (+ Phase 6.5 polarity amendment — see below) |
| Phase 6 — Intelligence Engine | `api/_lib/intelligence-engine.js` + `api/schema/intelligence.js` | `intelligence-engine-v1.0` (`a23788b`) |
| Phase 6.5 — Golden Fixture Library | `tests/fixtures/*` + `tests/golden-fixture-test.mjs` | `52b1750` |
| Phase 7 — Health Engine | `api/_lib/health-engine.js` + `api/schema/health.js` | `ec57481` |
| Phase 7.5 — Intellectual Property Vault™ | `/ip/` (24 markdown files) | `38ec3be` |
| Phase 8 — Executive Brief Engine | `api/_lib/executive-brief-engine.js` + `api/schema/executive-brief.js` | `8f00014` |

Test suites (13, all deterministic) live under `tests/`. Pipeline regression is enforced by GitHub Actions on every PR.

**Phase 8 input-shape contract.** The Executive Brief Engine reads `strengths/risks/opportunities/recommendations/observations` arrays defensively off the input HealthReport. Phase 7's HealthReport carries only the *counts*; callers pass an *enriched* HealthReport bundled with the upstream Phase 6 arrays (`{...healthReport, strengths, risks, opportunities, recommendations, observations}`). When arrays are absent, top-N sections fall through to empty and the engine still produces a valid brief from the HealthReport scalar fields. The engine NEVER invents an entry not present in the upstream arrays.

**Board ruling 2026-06-12 (PR #141 ratification):** the enriched-HealthReport contract is **accepted as an interim architectural solution** and shall remain documented until superseded by a future **Canonical Runtime Object™** phase. Treat any brief that touches the Phase 8 input shape as constrained by this ruling — preserve the contract until Canonical Runtime Object™ is briefed.

**Phase 7.5 / IP Vault location.** The Vault is the authoritative internal corporate record of every Se7ven Labs LLC intellectual-property claim — trademarks, patents, copyrights, trade secrets, inventions, brand, domains, licensing, valuation, acquisition data room. It is permanent across product lifecycles and corporate evolution (Board ratification 2026-06-12). When a future brief involves IP, the Vault is the primary reference and the place updates land. Five files inside the Vault are append-only (`FIRST_USE_LOG.md`, `PATENTS.md`, `INVENTION_LOG.md`, `FOUNDER_NOTES.md`, `ARCHITECTURE_DECISIONS.md`). Two are confidential (`TRADE_SECRETS.md`, `VALUATION.md`).

**Health Engine ≠ legacy V2 health score.** `api/_lib/persist-os-scan.js::computeV2HealthScore` is the locked V2-surface health score derived from raw scan signals at persist time (Brief 012a, 2026-05-29). The new Phase 7 Health Engine at `api/_lib/health-engine.js` scores Intelligence Reports (Phase 6 output) — different inputs, different consumers, different surfaces. They coexist; the V2 score is not deprecated. Future consolidation is a future Board decision.

**Phase 5 rule format addendum (Phase 6.5):** rules may carry an optional `polarity: 'positive'` field. When present, the rule's observation is routed to `engineOutput.strengths[]` by the Phase 6 engine (in addition to `observations[]`). Currently applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`. Backward compatible — rules without `polarity` behave exactly as before.

**Golden Fixture rule:** Fixtures under `tests/fixtures/` are immutable. They carry `_fixtureVersion` and are versioned forward; never overwritten. New canonical states are added as new files; evolving an existing one means adding `-v2.json` alongside the original.

---

## 7. Strategic Direction

| | |
|---|---|
| Active direction | **OS Migration** — eliminate legacy provider acquisition one provider at a time |
| Migration blueprint | Apple Production Migration (PR #189, 2026-07-02) — proven in production |
| First migrated provider | **Apple Music** — fully constitutional (PAL → AppleMusicConnector → Evidence Contract → RIE → CIM) |
| Next provider | Board-authorized only; Spotify recommended as highest impact |
| Legacy retirement register | `governance/MIGRATION_RETIREMENT_REGISTER.md` — living Board checklist |
| Engineering rule | Every migration must leave LESS legacy than it started with (Board Directive 2026-07-02) |
| One Health Engine | `cim.health.score` is the sole authoritative health score (PR #188, 2026-07-02) |

---

## 8. AI Startup Sequence

Every Royaltē AI shall initialize using this order on every session:

1. `constitution/ROYALTE_MASTER_CONSTITUTION.md`
2. `governance/AGENT_MEMORY.md` (this document)
3. `governance/ROADMAP.md`
4. `governance/BOARD_DECISIONS.md`
5. Current Assignment (the brief or task at hand)

This is the standard onboarding procedure for every AI system used by Se7ven Labs.

---

## 9. Governance Update Policy

**New Constitutional Rule** ratified by Board Directive 2026-06-11:

> No architectural Phase may be considered complete until:
> 1. Governance files updated
> 2. `governance/ROADMAP.md` updated
> 3. `governance/BOARD_DECISIONS.md` updated with the Board's authorising decision
> 4. `governance/CHANGELOG.md` updated with the merge entry
> 5. `governance/AGENT_MEMORY.md` updated (this file) where the phase changes the platform's current state
>
> **Only then may the PR be merged into main.**

`BOARD_DECISIONS.md` and `CHANGELOG.md` are **append-only**: existing entries are never edited; new entries are added at the end (or at the top of the chronological section per file convention).

`AGENT_MEMORY.md`, `ROADMAP.md`, and `EXECUTIVE_BOARD.md` are **living documents**: they may be revised to reflect current state, but historical context is preserved via Board Decisions and Changelog references.

---

## 10. Out-of-Scope Reminders

What this governance layer is **not**:

- Not a substitute for the Master Constitution. The Constitution governs principles; this layer governs operational state.
- Not a substitute for `MEMORY.md`-style auto-memory inside any specific AI tool. Local AI tooling memory is per-tool and per-session; this governance layer is per-repository and per-platform.
- Not a place to embed business logic, rules, or runtime configuration. All of that lives in code under the Engineering Stack.
