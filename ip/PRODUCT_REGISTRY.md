# PRODUCT REGISTRY

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

Every Royaltē™ product and platform layer, in one place: name · description · owner · status · dependencies · Constitution section · version. The register reflects platform reality at the time of the most recent entry; older state is preserved through `INVENTION_LOG.md`, `governance/CHANGELOG.md`, and `governance/BOARD_DECISIONS.md`.

Companion files: `LICENSING.md` (which of these products are available for license), `IP_ROADMAP.md` (which products are anticipated), `AI_MODELS.md` (the AI Executive registry).

---

## Engineering Stack — Royaltē Platform

The seven-layer Engineering Stack established in Constitution v1.3 § 8B.

| Name | Description | Owner | Status | Dependencies | Constitution Section | Version |
|---|---|---|---|---|---|---|
| Royaltē Publishing Intelligence Adapter™ | Sole owner of MLC publishing field-name parsing. Public API: `normalizeMlcWork`, `normalizeMlcWorks`, `validatePublishingWork`. | Se7ven Labs LLC | LOCKED | MLC Public API · OAuth | § 8B (Layer 2 — Adapters) | `mlc-publishing-adapter-v1.0` (`bca9e68`) |
| Royaltē Identity Graph™ | Owner of artist / composition / recording identity relationships across providers. `royalteId` issuance; external-ID maps for `mlc · socan · ascap · bmi · cisac · musicbrainz`. | Se7ven Labs LLC | LOCKED | Publishing Adapter | § 8B (Layer 3 — Identity Graph) | `bf12b5a` |
| Royaltē Canonical Intelligence Object™ (CIO) | Deep-frozen assembled-intelligence artefact every consumer reads. Summarises only (royalteId / IPI refs); never embeds graph nodes. | Se7ven Labs LLC | LOCKED | Identity Graph · Adapters · scan payload | § 8B (Layer 5 — CIO) | `a3c78d7` |
| Royaltē Canonical Intelligence Assembly Engine™ | Pure projection of (Identity Graph + adapter outputs + scan payload) → CIO. Deterministic, frozen output, never mutates input. | Se7ven Labs LLC | LOCKED | Identity Graph · Adapters | § 8B (Layer 4 — Assembly Engine) | `a3c78d7` |
| Royaltē Rule Library™ | Declarative business knowledge — pure-data rules with `(cio) → boolean` conditions. 12 rules across IDENTITY / PUBLISHING / CATALOG / METADATA; reserved arrays for MONITORING / REVENUE / GENERAL. Phase 6.5 amendment added optional `polarity: 'positive'`. | Se7ven Labs LLC | LOCKED | CIO | § 8B (Layer 6 — Rule Library) | `8907bd6` + amendment at `52b1750` |
| Royaltē Intelligence Engine™ | Generic deterministic rule executor. `runIntelligenceEngine(cio, ruleLibrary) → frozen engineOutput`. Generic iteration — no category switch; rules drive everything. Never throws; never mutates inputs. | Se7ven Labs LLC | LOCKED | CIO + Rule Library | § 8B (Layer 7 — Intelligence Engine) | `intelligence-engine-v1.0` (`a23788b`) |
| Royaltē Golden Fixture Library™ | Canonical regression surface — 7 immutable CIO reference fixtures + 30-assertion regression suite. `tests/fixtures/` is append-only, versioned forward; never overwrite. | Se7ven Labs LLC | LOCKED | CIO + Intelligence Engine | (test surface) | `52b1750` |
| Royaltē Health Engine™ | Sole authority for projecting an Intelligence Report into a Royaltē Health Report (0-100 score · A+/A/B/C/D/F grade · per-category breakdown). Pure, deterministic, deep-frozen output. Board-locked `CATEGORY_WEIGHTS` (sum to 1.0) and `GRADE_THRESHOLDS`. | Se7ven Labs LLC | LOCKED | Intelligence Engine output | (proposed § 8B extension — pending Constitution amendment) | `0c10fb4` (code) / `ec57481` (full lock), PR #137 |

---

## ATHENA™ Intelligence Layer

The AI reasoning layer sitting above the Royaltē Engineering Stack. Board-ratified 2026-07-04. Architecture specification: `constitution/ATHENA_ARCHITECTURE.md`.

| Name | Description | Owner | Status | Dependencies | Constitution Section | Version |
|---|---|---|---|---|---|---|
| ATHENA™ Intelligence Engine | Intelligence layer transforming verified Royaltē music intelligence into trusted executive recommendations. Sole AI entry point for all artist-facing output. Never queries raw providers; consumes Engineering Stack output only. Artists never see an underlying model name. | Se7ven Labs LLC | LOCKED (architecture) | Intelligence Engine output | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| Artist Intelligence Profile™ | Structured per-artist intelligence context assembled from CIO data; the reasoning substrate passed into the ATHENA™ pipeline. | Se7ven Labs LLC | LOCKED (architecture) | CIO | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| Business Rules Engine™ | Deterministic music industry rules that constrain AI reasoning before and after model invocation. Owned entirely by Royaltē; independent of any AI provider. | Se7ven Labs LLC | LOCKED (architecture) | Rule Library | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| Confidence Engine™ | Per-recommendation confidence scoring. Every ATHENA™ recommendation carries a confidence score; scores below the Board-approved threshold automatically trigger Smart Consensus™. | Se7ven Labs LLC | LOCKED (architecture) | Primary Reasoning Model output | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| Smart Consensus™ | Confidence-based AI routing architecture. Routes most requests to a single primary model; invokes secondary model + Consensus Engine™ only when confidence falls below threshold. | Se7ven Labs LLC | LOCKED (architecture) | Confidence Engine™ | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| Consensus Engine™ | Evaluates and resolves disagreement between primary and secondary model outputs on the Smart Consensus™ low-confidence path. | Se7ven Labs LLC | LOCKED (architecture) | Smart Consensus™ | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |
| ATHENA™ Validation™ | Final validation step before Executive Brief™ assembly; enforces output quality and business-rule compliance. | Se7ven Labs LLC | LOCKED (architecture) | Consensus Engine™ or primary model output | `constitution/ATHENA_ARCHITECTURE.md` | Board-ratified 2026-07-04 |

---

## Consumer Surfaces

| Name | Description | Owner | Status | Dependencies | Constitution Section | Version |
|---|---|---|---|---|---|---|
| Royaltē Scan™ V1 | Artist-facing scan experience — the public scan UI on `public/index.html`. Includes Royaltē Orb™ animation, Royaltē Intelligence Ping™, Executive Brief conversion. | Se7ven Labs LLC | DESIGN FROZEN — PR #122 held until intelligence wiring complete | Audit pipeline · Engineering Stack | § 6 (Product principle) · § 8B (Consumer layer) | (held) |
| Royaltē Mission Control™ V1 | Authenticated post-scan UI on `public/dashboard.html`. Locked structure 2026-06-04; only polish, animation, auth permitted without Board direction. | Se7ven Labs LLC | DESIGN FROZEN | Persistence (Supabase `audit_scans`) | § 8B (Consumer layer) | (V1 freeze 2026-06-04) |
| Royaltē Signal Meter™ | Health Score VU meter design. Locked 2026-06-04; no visual redesign without explicit founder request. | Se7ven Labs LLC | LOCKED | V2 Health Score | § 8B (Consumer layer) | (V1 freeze 2026-06-04) |
| Royaltē Review (artist PDF) | Emailed audit deliverable. Promoted to V2 framing by Brief 014; renders from `lib/audit-report-template.html` via `lib/render-audit-pdf.js`. | Se7ven Labs LLC | LOCKED | Audit pipeline · V2 Health Score | § 8B (Consumer layer) | Brief 014 (2026-05-30) |
| Royaltē Audit™ V1 display | Audit results surface on `public/audit.html`. Scoring lock: 0-30 Low Risk · 31-60 Moderate · 61-80 At Risk · 81-100 Critical. | Se7ven Labs LLC | LOCKED | Audit pipeline | (CLAUDE.md V1 scoring lock) | PR #24 (2026-05-14) |
| Royaltē Executive Brief™ | Locked-format founder-facing intelligence briefing format. | Se7ven Labs LLC | LOCKED (format) | CIO · Intelligence Report · Health Report | (operational) | (CLAUDE.md reference) |

---

## Platform Services

| Name | Description | Owner | Status | Dependencies | Constitution Section | Version |
|---|---|---|---|---|---|---|
| `/api/audit` | Synchronous engine endpoint. Persists a canonical scan into Supabase `audit_scans`; returns the canonical AuditResponse. Wires through `runAudit()` fan-out to ~10 third-party platforms. | Se7ven Labs LLC | OPERATIONAL | Spotify · Apple Music · MusicBrainz · Deezer · AudioDB · Discogs · SoundCloud · Last.fm · Wikidata · YouTube · Tidal | (CLAUDE.md § Architecture) | `AUDIT_RESPONSE_VERSION='1.0.0'` |
| `/api/submit-audit` | Customer-facing email + PDF delivery endpoint. Renders the Royaltē Review PDF and sends via Resend. | Se7ven Labs LLC | OPERATIONAL | `/api/audit` · PDFShift · Resend | (CLAUDE.md § Architecture) | (current) |
| `/api/mlc-test` | MLC connectivity probe — OAuth two-step flow proven 2026-06-10. | Se7ven Labs LLC | OPERATIONAL | MLC OAuth | (CHANGELOG Phase 1) | PR #123 · #124 · #125 |
| Rate-limit + abuse defence (`api/_lib/rate-limit.js`) | Per-IP sliding-window rate limiting with auto-block after 5+ violations / hour. Atomicity via `rate_limit_check_and_increment` RPC. | Se7ven Labs LLC | OPERATIONAL | Supabase `rate_limits` · `blocked_ips` | (CLAUDE.md § Rate limiting) | `supabase/migrations/20260511163847_rate_limit_rpc.sql` |
| Royaltē Monitoring™ (subscriber-gated) | Continuous monitoring product family. Listen Notes Podcast Intelligence is the first subscriber-gated capability; runs only when `isMonitoringSubscriber(profile)`. | Se7ven Labs LLC | OPERATIONAL (probe), reserved (Engineering Stack) | Listen Notes API · subscriber state | § 8B reserved (Layer 7 reserves) | (Brief 015o) |

---

## Platform Governance

| Name | Description | Owner | Status | Dependencies | Constitution Section | Version |
|---|---|---|---|---|---|---|
| Royaltē Master Constitution | Supreme governing document. Section 8B canonicalises the Engineering Stack. | Se7ven Labs LLC | RATIFIED | — | (self) | v1.3 (2026-06-11) |
| Royaltē Governance Layer™ | `/governance/` directory: `AGENT_MEMORY.md` · `BOARD_DECISIONS.md` · `ROADMAP.md` · `CHANGELOG.md` · `EXECUTIVE_BOARD.md`. New constitutional rule (§ 9) binds every phase merge to a governance update. | Se7ven Labs LLC | LOCKED | Constitution | § 9 (Governance update policy) | `253de6b` (PR #133 + #134) |
| Royaltē Boot Sequence™ | 5-question pre-implementation initialisation procedure binding every AI session. | Se7ven Labs LLC | LOCKED | Constitution · `CLAUDE.md` | (operational) | 2026-06-09 |
| Se7ven Labs Intellectual Property Vault™ | This `/ip/` directory. | Se7ven Labs LLC | v1.0 (HOLD for Board ratification) | — | — | v1.0 (Phase 7.5) |

---

## Conventions

- One row per product. Sub-layers within a product (e.g., per-rule files inside Rule Library) are not listed here; they are listed in their lock memory and in `INVENTION_LOG.md`.
- `Status` values: `IDENTIFIED` · `IN DEVELOPMENT` · `DESIGN FROZEN` · `LOCKED` · `OPERATIONAL` · `DEPRECATED` · `RETIRED`.
- `Dependencies` lists only first-degree dependencies (the products this product directly reads from or calls into).
- `Constitution Section` references the section number in `constitution/ROYALTE_MASTER_CONSTITUTION.md` that governs the product (or `(operational)` if the product is operational-only).
- `Version` is either the most recent lock SHA, the most recent tag, or the most recent design-freeze date.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
