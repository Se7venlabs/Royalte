# Royaltē Board Decisions

**Status:** append-only chronological record of every Board decision affecting the platform.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.

**Append-only rule:** existing entries are never edited, reordered, or deleted. Corrections are made by appending a new entry that supersedes the prior one (with explicit reference back).

Entries are listed **newest first** for ease of catching up; chronological order within the file is preserved by date.

---

## Decision Log

### 2026-07-03 — Phase 3.6 TheAudioDB — Artist & Media Intelligence Authority™ PAL Production Migration™ — UNANIMOUSLY APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Board UNANIMOUSLY APPROVES Phase 3.6 Provider Expansion 08 — TheAudioDB as Royaltē's Artist & Media Intelligence Authority™. AudioDBConnector acquires biography, artwork, logos, clear art, fan art, banners, discography, music videos, social links, and genre metadata from the TheAudioDB Public API (free tier, key embedded in path). No credentials required. Board Amendment 1–6 applied: constitutional `profile / media / discography / statistics` namespace established as the reference model for all future media-rich providers. |
| **Directives adopted** | (1) TheAudioDB's constitutional role is Artist & Media Intelligence Authority™ — evidence acquisition only; no Artist Intelligence™, Brand Intelligence™, or Media scoring in this phase. (2) Constitutional media namespace: `platforms.audiodb.profile` (biography, country, genre, etc.) / `media` (thumbnails, logos, banners, fanArt, social, videos) / `discography` / `statistics`. (3) Each image type preserved independently — do not collapse (logo, clearart, thumb, wideThumb, fanart×4, banner). (4) Visual evidence is constitutional evidence — artwork and media are first-class evidence, not decoration. (5) Biography preserved in full at bridge layer; V1 compat synthesis truncates to 400 chars. (6) This namespace is the constitutional reference model for future media-rich providers (Last.fm, SoundCloud, etc.). (7) Provider trust: 70 (community-maintained media database). (8) No-credentials `authenticate()` pattern is constitutional for all credential-free providers. |
| **Impact** | Eight constitutional providers, 834/834 certified. TheAudioDB completes Royaltē's first-generation evidence ecosystem. Evidence foundation for Artist Intelligence™ and Brand Intelligence™ established. |
| **Vote** | Board Approved — UNANIMOUS |
| **PR Number** | #203 |
| **Commit SHA** | `bd4464e` |
| **Constitution update required** | No |

---

### 2026-07-03 — Phase 3.6 Deezer — Streaming Verification Authority™ PAL Production Migration™ — UNANIMOUSLY APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Board UNANIMOUSLY APPROVES Phase 3.6 Provider Expansion 07 — Deezer as Royaltē's first constitutional Streaming Verification Authority™. DeezerConnector acquires independent streaming evidence (ARTIST_IDENTITY, ALBUMS, TRACKS, ISRC, ARTWORK, GENRES) from the Deezer Public API without performing any comparison, conflict detection, or confidence scoring. Legacy `getDeezer()` direct-call retired. All Deezer acquisition now flows through PAL. |
| **Directives adopted** | (1) Deezer's constitutional role is Streaming Verification Authority™ — it acquires evidence only; it never compares providers, detects conflicts, calculates confidence, or performs verification. (2) Future Verification Intelligence™ will consume Deezer evidence to determine agreement/disagreement with Apple Music and Spotify — this is a future phase, not this provider. (3) `platforms.deezer.isrcs[]` is the constitutional bridge for future Verification Intelligence. (4) Provider trust: 80 (independent streaming authority — governance decision, never computed). (5) Deezer public API requires no credentials; `authenticate()` returning AVAILABLE without a network call is the constitutional pattern for credential-free providers. |
| **Impact** | Seven constitutional providers, 740/740 certified. The original three streaming providers (Apple, Spotify, Deezer) are now 100% migrated to PAL. Evidence foundation for Verification Intelligence™ is established. |
| **Vote** | Board Approved — UNANIMOUS |
| **PR Number** | #201 |
| **Commit SHA** | `ba66b26` |
| **Constitution update required** | No |

---

### 2026-07-02 — Phase 3.6 MLC — The MLC Publishing Authority PAL Production Migration™ — UNANIMOUSLY APPROVED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Board UNANIMOUSLY APPROVES Phase 3.6 Provider Expansion 05 — The Mechanical Licensing Collective (The MLC) as Royaltē's first constitutional Publishing Authority. MLCConnector establishes the constitutional precedent for statutory-authority providers. Provider trust: 95 (The MLC is the statutory US mechanical licensing authority under the Music Modernization Act). Board Amendment applied: Recording ≠ Musical Work — hierarchy Recording → ISRC → MLC Song Code → Musical Work → Publishers / Songwriters / ISWC preserved as nested structure in EvidenceBridge; no flattening. |
| **Directives adopted** | (1) No Publishing Intelligence, Rights Intelligence, or Revenue Intelligence built in this phase — evidence acquisition only. (2) EvidenceBridge translates and preserves; translation is encouraged; flattening is not. (3) `platforms.mlc.recordings[]` = Recording entities; `platforms.mlc.details.works[]` = Musical Work entities; `platforms.mlc.mlcSongCodes[]` = constitutional bridge. (4) MLC API field-casing inconsistency (`mlcsongCode` vs `mlcSongCode`) preserved raw — consumers handle the difference. (5) `authenticate()` may make a real network call for session-based OAuth providers — constitutional from this phase forward. |
| **Impact** | The MLC completes Royaltē's first constitutional evidence ecosystem: 6 providers, 6 constitutional authorities, 673/673 certified. |
| **Vote** | Board Approved — UNANIMOUS |
| **PR Number** | #199 |
| **Commit SHA** | `67d7fe8` |
| **Constitution update required** | No |

---

### 2026-07-02 — Phase 3.6 Provider Expansion Sprint — Constitutional Evidence Ecosystem Complete — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Board ratifies the Provider Expansion Sprint, completing Royaltē's first constitutional six-provider evidence ecosystem. Each provider follows the constitutional PAL → Evidence Contract → EvidenceBridge → CIM pipeline without exception. Certification harness grew from 308 assertions (Phase 3.5 baseline) to 673 assertions across 10 suites, 0 failures. |
| **Directives adopted** | (1) Six constitutional providers and their trust values: Apple Music = 100, Spotify = 90, MusicBrainz = 80, Discogs = 75, YouTube OAC = 85, The MLC = 95. (2) Provider Expansion Sprint pattern is the constitutional reference for all future provider integrations. (3) The Recording → Song Code → Musical Work hierarchy is permanent and governs all future publishing-domain features. (4) Certification harness (673 assertions, Suite 10) is the permanent gate for all future Provider Expansion phases. |
| **Impact** | Royaltē possesses a constitutionally certified, provider-agnostic, evidence-driven intelligence platform. All future modules read from CIM — never from provider-specific data directly. |
| **Vote** | Board Approved — UNANIMOUS |
| **PR Numbers** | #194 (Spotify) · #195 (Recording Intelligence + Amendment) · #196 (MusicBrainz + Amendment 1) · #197 (Discogs + Amendment 1) · #198 (YouTube) · #199 (The MLC) |
| **Commit SHAs** | `ba4054d` · `2057db6` · `b966881` · `aea8095` · `fb44ef5` · `67d7fe8` |
| **Constitution update required** | No |

---

### 2026-07-02 — Phase 3.5 — Royaltē OS v1.0 Board Certification — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Board ratifies Phase 3.5 — Royaltē OS v1.0 Certification Sprint. The Board Certification Harness (308 assertions, 5 suites, 0 failures) is accepted as the permanent certification infrastructure for the platform. `royalte-os-v1.0` is the official certified baseline. The `deepFreeze` bug in `backend-intelligence.js` (arrays skipped by `!Array.isArray(v)` guard) is accepted as fixed. The determinism policy (excluding provenance-only timestamps from comparison) is ratified. |
| **Directives adopted** | (1) Intelligence Engine, Health Engine, Rule Library, and RIE changes require 100% harness pass before merge. (2) CIM schema changes require Suite 04 updates + 100% harness pass before merge. (3) No release tag may be created unless harness exits 0 and GitHub CI is green. (4) Certification Artist Library and Golden Fixture Library are append-only — existing fixtures never modified. (5) The certified OS v1.0 architecture is frozen for production. No changes to IE/Health/RIE without Board brief. |
| **Impact** | Royaltē OS v1.0 is the certified production baseline. Phase 3.5 sprints A–F (dead code, ArtistNameAdapter, vocabulary, CimAdapter/Spotify, ISRC Coverage, Publishing expansion) remain Board-deferred until authorized individually. |
| **Vote** | Board Approved — UNANIMOUS |
| **PR Number** | #192 (harness) · #193 (governance backfill) |
| **Commit SHA** | `65c5c16` (harness) |
| **Tag** | `royalte-os-v1.0` |
| **Constitution update required** | No |

---

### 2026-07-02 — Phase 3.4 Product Consumption Cleanup — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Board ratifies Phase 3.4 — Product Consumption Cleanup. The Website Scan renderer is now a constitutional presentation layer: zero business logic, zero intelligence computation. All displayed fields read from the Certified CIM. ISRC Coverage is a permanent constitutional intelligence field owned by `assembleCatalogIntelligence` in the RIE. Catalog Availability reads from `globalMusicFootprint.status` (certified by the RIE from 167-storefront PAL evidence). |
| **Directives adopted** | (1) Website Scan performs zero business intelligence — renderer reads only. (2) Certified CIM is the sole source of truth for all displayed values. (3) ISRC Coverage vocabulary locked: Unknown / Limited / Partial / Complete. ISRC_THRESHOLDS (75/25/1) pending formal Board ratification. (4) Catalog Availability vocabulary: Global / Strong / Regional / Limited (from globalMusicFootprint). (5) trackIsrc single-track sentinel PERMANENTLY EXCLUDED as proxy for catalog ISRC coverage. |
| **Impact** | Parity gaps resolved — ISRC and Catalog Availability produce identical results regardless of entry point. Mission Control renderCatalog extended with isrcCoverage in plan (v1.1). |
| **Vote** | Board Approved |
| **PR Number** | #190 |
| **Commit SHA** | `8a71df7` (pending merge) |
| **Constitution update required** | No |

---

### 2026-07-02 — Engineering Rule: Every Migration Must Leave Less Legacy

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Effective immediately: every provider migration must reduce the legacy footprint — it must never increase it. Each migration must migrate ownership, reduce compatibility code, reduce duplicate logic, reduce duplicate provider calls, and reduce duplicate business rules. The Migration Retirement Register (`governance/MIGRATION_RETIREMENT_REGISTER.md`) is the Board's master checklist for tracking and retiring every transitional component. |
| **Reason** | The Apple Production Migration established the blueprint. Future migrations must follow the same discipline and leave the codebase measurably smaller in legacy debt after each phase. |
| **Impact** | All future migration briefs must include a legacy retirement delta (components moving from TRANSITIONAL → READY FOR RETIREMENT → RETIRED). The register is updated after every migration. |
| **Vote** | Board Approved |
| **PR Number** | #189 |
| **Commit SHA** | `584770d` |
| **Constitution update required** | No |

---

### 2026-07-02 — Apple Production Migration (Phase 3.3) — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | Apple Music is now the first production provider fully migrated into the Royaltē Operating System. All Apple acquisition routes exclusively through the Provider Acquisition Layer → AppleMusicConnector → Evidence Contract → Royaltē Intelligence Engine. `run-scan.js` no longer owns Apple acquisition logic. `getAppleMusic()` has zero production callers and is marked READY FOR RETIREMENT. The `AppleMusicConnector` gains global 167-storefront AVAILABILITY capability. The RIE gains a constitutional hybrid merge path for the transitional period while other providers migrate. |
| **Reason** | The Board's migration directive required proving the constitutional production architecture can successfully replace the legacy production path while preserving all existing functionality. PR #189 achieves this objective and establishes the migration blueprint every subsequent provider will follow. |
| **Impact** | Production architecture is now: Artist → run-scan → PAL → AppleMusicConnector → Evidence Contract → RIE → CIM → Products. This is the constitutional production blueprint. Future provider migrations (Spotify, MusicBrainz, Deezer, etc.) follow this exact pattern without inventing new architecture. |
| **Vote** | Board Approved — full acceptance testing passed |
| **PR Number** | #189 |
| **Commit SHA** | `584770d` |
| **Tag** | `apple-pal-production-migration-v1.0` |
| **Constitution update required** | No |

---

### 2026-07-02 — One Health Engine (Phase 3.2) — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Decision** | `cim.health.score` is now the sole authoritative health score in production. `computeV2HealthScore` is retired with zero production consumers. `persist-os-scan.js` reads health from `cim.health` (the Royaltē Health Engine™ output) exclusively. The CimAdapter carries `cim.health` forward as the backward-compat `canonical.health` field. |
| **Reason** | Two health score sources created ambiguity. The V2 signal-driven score and the constitutional Health Engine score coexisted. One Health Engine eliminates this duplication — the CIM is the single source of truth for health, scores, grades, and drivers. |
| **Impact** | Every health surface (Mission Control health card, audit health badge, executive brief, PDF) reads from one source: the constitutional Royaltē Health Engine™. `computeV2HealthScore` function retired and removed from production paths. |
| **Vote** | Board Approved |
| **PR Number** | #188 |
| **Commit SHA** | `aca5571` |
| **Constitution update required** | No |

---

### 2026-06-25 — Mission Control Module Freeze Directive

| | |
|---|---|
| **Date** | 2026-06-25 |
| **Decision** | All Mission Control™ modules are frozen. Only the module currently designated as the active Build Pass target may receive any changes. No other module's layout, wiring, data, copy, styling, or behavior may be modified while it is frozen. The freeze lifts for a module only when the Board explicitly opens a Build Pass for it. |
| **Reason** | Concurrent edits across multiple modules during Board review create ambiguity about what is being approved. Isolating changes to one module at a time ensures the Board is approving a known, stable surface. |
| **Impact** | Any PR touching a frozen module must be blocked until the Board opens that module. Engineers must confirm the target module before beginning any Build Pass work. Currently frozen: Identity Intelligence™, Publishing Intelligence™, Backend Intelligence™ (Build Pass 3 complete — now frozen), Catalog Intelligence™, Global Music Footprint™, Royaltē AI™, Health Intelligence™, Monitoring Intelligence™. |
| **Vote** | Board Approved |
| **PR Number** | — |
| **Commit SHA** | 62dbed5 (last merge, Build Pass 3 completion) |
| **Constitution update required** | No |

---

### 2026-06-20 — Phase 8: Scan Pipeline Wiring — Health & Executive Brief

| | |
|---|---|
| **Date** | 2026-06-20 |
| **Decision** | Wire `computeHealthScore()`, `generateHealthReport()`, and `generateExecutiveBrief()` into the production scan pipeline in `api/audit.js` as step 5 of `assembleIntelligenceForScan()`. `computeHealthScore()` is called exactly once per scan; the canonical result is passed downstream to `generateHealthReport()` and `generateExecutiveBrief()` — never re-derived by consumers. `generateExecutiveBrief()` signature updated to the Board-approved 4-argument form: `(cio, intelligenceReport, healthReport, canonicalHealth)`. Layer ownership enforced: `canonicalHealth` owns all scores/grades; `intelligenceReport` owns all arrays; `healthReport` owns `generatedAt`. `healthScore`, `healthReport`, and `executiveBrief` persisted in the enriched scan payload. `executive-brief-engine-test.mjs` migrated to the new 4-arg signature (40 → 40 assertions, zero coverage lost). |
| **Reason** | All intelligence layers existed independently but were not connected into the scan execution path. Phase 8 closes the loop: every production scan now produces a full constitutional intelligence pipeline output. |
| **Impact** | Every scan now produces: CIO → Intelligence Report → Health Score → Health Report → Executive Brief. All five outputs persisted for downstream consumers. `computeHealthScore()` is the single canonical scoring authority per scan — called once, passed everywhere. |
| **Vote** | Board Approved Unanimous |
| **PR Number** | #155 |
| **Commit SHA** | `17f462f` |
| **Tag** | `phase-8-scan-pipeline-wiring-v1.0` |
| **Constitution update required** | No |

---

### 2026-06-20 — Roadmap Governance Correction

| | |
|---|---|
| **Date** | 2026-06-20 |
| **Decision** | Correct `governance/ROADMAP.md` to reflect constitutional truth. Add Phase 6C and Phase 6D rows as ✅ Complete. Revert Phases 7, 7.5, 8, and 9+ from ✅ Complete to ⬜ Planned. Rewrite "What's Live in main Today" to describe only code present on `main`. Rename "Anticipated Phase 7" to "Next Engineering Target" with Board-mandated prefix. |
| **Reason** | The roadmap had incorrectly listed Phases 7, 7.5, and 8 as Complete. The Board principle is "Roadmap = Truth" — the roadmap must only reflect phases that have completed the full constitutional governance process. Phases 6C and 6D were missing from the table entirely. |
| **Impact** | Roadmap now accurately reflects the current constitutional state of the platform: Phases 1–6D complete; Phase 7+ planned. No code changes. No Constitution amendment required. |
| **Vote** | Board APPROVED |
| **PR Number** | (governance backfill — same PR as Phase 6D SHA backfill) |
| **Constitution update required** | No |

---

### 2026-06-20 — Phase 6D: Catalog Rule Library Migration Layer

| | |
|---|---|
| **Date** | 2026-06-20 |
| **Decision** | Add a dual-read migration layer to `api/rules/catalog-rules.js` connecting the Rule Library to the Canonical Catalog Model™ (`cio.catalog.catalogModel`). Introduces `catalogField(cio, fieldName)` as the single migration helper (reads `catalogModel` first, falls back to legacy `cio.catalog` fields; `hasOwnProperty.call()` for prototype safety), `readonlyCatalogValue(cio, value)` (deep-frozen `structuredClone()` with per-scan WeakMap cache keyed by CIO object), cycle-safe `deepFreeze()` with WeakSet guard, and orphan detection derived from `releaseIds[]` semantics on `catalogModel.recordings`. Full backward compatibility with legacy CIO shapes. 139/139 regression assertions passing across 6 test suites. |
| **Reason** | The Canonical Catalog Model™ (Phase 6C) introduced a new facts source that the Rule Library must consume without breaking legacy consumers. Phase 6D is the governed migration: catalog rules become authoritative consumers of `catalogModel` while the legacy fallback ensures zero behavioral change for scans without a catalog model. Immutability is constitutional — rules consume facts, never own or mutate them. |
| **Impact** | Rule Library catalog rules now derive facts from the Canonical Catalog Model™. `catalogField()` is the single read path. Orphan detection is derived from `releaseIds[]` semantics rather than a legacy `orphanRecordings[]` array. The per-scan WeakMap cache prevents repeated `structuredClone()` on the same catalog object within one evaluation cycle. |
| **Vote** | Board APPROVED UNANIMOUS |
| **PR Number** | #152 |
| **Commit SHA** | `2979410` |
| **Tag** | `phase-6d-catalog-rule-migration-v1.0` |
| **Constitution update required** | No |

---

### 2026-06-12 — Phase 8: Royaltē Executive Brief Engine™

| | |
|---|---|
| **Date** | 2026-06-12 |
| **Decision** | Add a new constitutional layer at `api/_lib/executive-brief-engine.js` + `api/schema/executive-brief.js`: the **Royaltē Executive Brief Engine™** — sole authority for projecting a Royaltē Health Report (Phase 7 output) into a Royaltē Executive Brief (locked-format founder-facing intelligence briefing). Pure function: `generateExecutiveBrief(healthReport)`. Never throws, never mutates input, fully deterministic, deeply-frozen output. Board-locked `HEALTH_HEADLINES` (6 grade-keyed headlines) and `RECOMMENDED_NEXT_STEPS` (6 category-keyed next-steps + `default`). 40-assertion test suite at `tests/executive-brief-engine-test.mjs`. Total: 3 new files (895 lines). |
| **Reason** | The Intelligence Engine identifies; the Health Engine quantifies; the Executive Brief Engine **explains in executive language**. Constitutional separation continues: Knowledge (Rule Library) → Execution (Intelligence Engine) → Scoring (Health Engine) → **Language (Executive Brief Engine)** → Presentation (consumers). The engine owns language; it never owns presentation, layout, or design. It never invents intelligence — every top-N entry is sourced verbatim from the upstream arrays the caller provides. |
| **Impact** | (a) The Engineering Stack gains a new constitutional layer between the Health Engine (Phase 7) and the consumer surfaces — *Language*. (b) Future consumers reading executive-brief output — Mission Control intelligence-feed cards, the Royaltē Review PDF, future automated email briefs — read from the Executive Brief Engine, never recompute language. (c) Input-shape contract: the engine reads `strengths/risks/opportunities/recommendations/observations` arrays defensively from the input HealthReport, allowing callers to pass an *enriched* HealthReport (Phase 7 output bundled with the upstream Phase 6 arrays). When absent, top-N sections default to empty; the engine never invents. (d) Board-locked vocabulary tables (`HEALTH_HEADLINES`, `RECOMMENDED_NEXT_STEPS`) become the canonical Royaltē executive vocabulary; future edits require Board ratification. |
| **Vote** | Board RATIFIED · Conditional → unconditional on CI green |
| **PR Number** | #141 |
| **Commit SHA** | `8f00014` |
| **Note on input-shape contract** | The "enriched HealthReport" input contract (caller bundles upstream Phase 6 arrays into the Phase 7 HealthReport) is **accepted as an interim architectural solution** and shall remain documented until superseded by a future **Canonical Runtime Object™** phase. |
| **Constitution update required** | Likely yes at the next Constitution amendment cycle (formal Section 8B extension to ratify the new layer alongside the Health Engine extension and the future Canonical Runtime Object™). Not blocked on it for merge. |

---

### 2026-06-12 — Phase 7.5: Se7ven Labs Intellectual Property Vault™ + Permanence Amendment

| | |
|---|---|
| **Date** | 2026-06-12 |
| **Decision** | Establish the **Se7ven Labs Intellectual Property Vault™** at `/ip/`. Documentation-only addition of 24 markdown files (2,547 lines total) capturing trademarks (36 PLANNED marks), patents (9 candidate methodologies + register), copyrights (13 asset categories), trade secrets (9 methodology registers; CONFIDENTIAL), product registry, invention log, founder notes, IP roadmap, licensing posture, AI Executive registry, ADR log, domain registry, brand guidelines, press register, valuation framework, competitor analysis, investor due diligence, acquisition data room, and open-source posture. Executive Sponsor: Victoria Sterling. Mid-PR Permanence Amendment ratifies the Vault as a permanent corporate asset that survives every product lifecycle, subsidiary, merger, acquisition, restructuring, or reorganization. |
| **Reason** | The platform's IP — engineering stack, marks, methodologies, brand, contractual posture, strategic assets — needs one canonical internal corporate record before any of it is exposed to counsel, investors, acquirers, or partners. Until now the IP record was scattered across `governance/`, `docs/`, in-code comments, and the founder's memory. The Vault is the single source of truth. The Permanence Amendment formalises that the Vault outlives any single product. |
| **Impact** | (a) `/ip/` is a new top-level directory. Documentation only; no runtime / governance / constitutional impact. (b) Three append-only files inside the Vault — `FIRST_USE_LOG.md`, `PATENTS.md`, `INVENTION_LOG.md`, `FOUNDER_NOTES.md`, `ARCHITECTURE_DECISIONS.md` — establish the constitutional precedent that IP evidence is never edited in place. (c) Two confidential files — `TRADE_SECRETS.md`, `VALUATION.md` — carry restricted-access headers. (d) Vault's `BRAND_GUIDELINES.md` § 9.1 codifies the locked Royaltē spelling rule (ē, U+0113) as a permanent IP-defence artefact. (e) Phase 7.5 sets precedent that documentation-only phases may carry brief-level "No governance modifications" scope while still being recorded in governance post-merge via the standing protocol. |
| **Vote** | Board RATIFIED · UNANIMOUS (including Permanence Amendment) |
| **PR Number** | #139 |
| **Commit SHA** | `38ec3be` (Vault establishment at `7a72e77`; Permanence Amendment at `38ec3be`) |
| **Constitution update required** | No. The Vault is internal corporate record; it does not amend the Master Constitution. Future amendment may formally reference the Vault as the canonical IP register. |

---

### 2026-06-11 — Phase 7: Royaltē Health Engine™

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Add a new constitutional Engineering Stack layer at `api/_lib/health-engine.js` + `api/schema/health.js`: the **Royaltē Health Engine™** — sole authority for projecting a Royaltē Intelligence Report (Phase 6 engine output) into a deeply-frozen Royaltē Health Report (overall 0-100 score, A+/A/B/C/D/F grade, per-category breakdown across `identity / publishing / catalog / metadata / coverage / confidence` with Board-locked weights summing to 1.0, plus `reserved.monitoring` and `reserved.revenue` placeholders). Pure function: `computeHealthScore(intelligenceReport)`. Never throws, never mutates input, fully deterministic. New 35-assertion test suite at `tests/health-engine-test.mjs`. Total: 3 new files. |
| **Reason** | The Intelligence Engine identifies what is wrong; the Health Engine quantifies how wrong, in language the artist can act on. Constitutional separation continues: Knowledge (Rule Library) → Execution (Intelligence Engine) → Scoring (Health Engine) → Presentation (consumers). The Health Engine is the *constitutional* quantification layer — separate from the legacy V2 health score in `api/_lib/persist-os-scan.js`, which scores raw scan signals at persist time for the V2 frontend display. The two coexist: V2 score operates on raw scan booleans; Health Engine operates on intelligence reports. Different inputs, different consumers. |
| **Impact** | (a) The Engineering Stack gains an 8th constitutional layer (Health Engine), between layer 7 (Intelligence Engine) and layer 8 (Consumers). (b) Future consumers reading health intelligence — Mission Control, Executive Brief, the scan UI's headline score — read from the Health Engine, never recompute. (c) Board-locked weights (`identity:0.20 · publishing:0.25 · catalog:0.20 · metadata:0.15 · coverage:0.10 · confidence:0.10`) and grade bands (`A+ 98-100 · A 95-97 · B 90-94 · C 80-89 · D 70-79 · F 0-69`) become the canonical health-scoring constants. (d) The V2 score (`computeV2HealthScore` in `persist-os-scan.js`) is unchanged; its eventual relationship to the Health Engine is a future Board decision, not in scope for Phase 7. |
| **Vote** | Board RATIFIED · Conditional → unconditional after roadmap amendment |
| **PR Number** | #137 |
| **Commit SHA** | `ec57481` (Phase 7 work at `0c10fb4`; roadmap amendment at `ec57481`) |
| **Constitution update required** | Likely yes (future formal Section 8B bump to ratify the new layer). Not blocked on it for merge; treated as a constitutional candidate at the next Constitution amendment cycle. |

---

### 2026-06-11 — Phase 6.5: Royaltē Golden Fixture Library™ + Phase 5 polarity amendment

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Create `tests/fixtures/` with 7 canonical CIO reference fixtures (`artist-empty`, `artist-perfect`, `artist-duplicate-profiles`, `artist-missing-publishing`, `artist-orphan-recordings`, `artist-fragmented-catalog`, `artist-metadata-conflicts`) + `fixture-loader.mjs` (`loadFixture`, `listFixtures`) + `golden-fixture-test.mjs` (30 deterministic assertions). Each fixture is versioned and named; fixtures are immutable — versioned forward, never overwritten. **Amend Phase 5** by adding the optional `polarity: 'positive'` field to `publishing.strong-coverage` and `catalog.complete-delivery-verified` so strength rules flow correctly into `engineOutput.strengths[]` under the Phase 6 contract. |
| **Reason** | Without the polarity amendment, the Phase 5 Rule Library's two semantically-positive INFO rules fire correctly into `observations[]` but never reach `strengths[]` (Phase 6 routes by explicit `polarity:'positive'`). The amendment closes the constitutional gap between Phase 5's declarative rule format and Phase 6's strengths routing, making the Golden Fixture Library's `artist-perfect` scenario meaningful. |
| **Impact** | (a) Phase 6.5 establishes a canonical regression surface for future architectural change — any locked-stack alteration that breaks fixture-driven engine output is caught immediately. (b) Phase 5 rule format now formally permits an optional `polarity` field on positive-framing rules. Backward compatible — rules without `polarity` continue to behave exactly as before. (c) Fixture versioning rule (`_fixtureVersion`) becomes the constitutional precedent for evolving golden references: never overwrite, always version forward. |
| **Vote** | Board Approved (Option A) — UNANIMOUS |
| **PR Number** | #135 |
| **Commit SHA** | `52b1750` |
| **Constitution update required** | No — the Phase 5 amendment is additive and the fixture library is a test surface. Future formal Constitution amendment may record the fixture-versioning rule as a sub-section of § 8B. |

---

### 2026-06-11 — Establish Repository Governance Layer™

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Create permanent `/governance` directory containing `AGENT_MEMORY.md`, `BOARD_DECISIONS.md`, `ROADMAP.md`, `CHANGELOG.md`, `EXECUTIVE_BOARD.md`. Establish AI Startup Order and new constitutional rule binding every future phase merge to a governance update. |
| **Reason** | The repository must become the single source of truth for institutional memory, accessible to AI agents, engineers, contractors, and future employees. |
| **Impact** | Every Phase 7+ merge must update governance files before merge. AI agents now have a standardized startup sequence. |
| **Vote** | Board Approved · Priority HIGH |
| **PR Number** | #133 |
| **Commit SHA** | `60e76ef` |
| **Constitution update required** | No — recorded in `AGENT_MEMORY.md` § 9; future Constitution amendment may formally enshrine. |

---

### 2026-06-11 — Ratify Constitution v1.3 (Royaltē Engineering Stack™)

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Bump Master Constitution to v1.3. Add Section 8B — Royaltē Engineering Stack™ documenting the finalized seven-layer architecture (Providers → Adapters → Identity Graph → Assembly Engine → CIO → Rule Library → Intelligence Engine → Consumers). Add long-form companion at `docs/ROYALTE_ENGINEERING_STACK.md`. |
| **Reason** | Reflect the finalized architectural stack ratified across Phases 1–6. |
| **Impact** | Section 8B becomes the constitutional reference for every future architectural decision. Documentation-only change. |
| **Vote** | Board Approved |
| **PR Number** | #132 |
| **Commit SHA** | `33edba6` |
| **Constitution update required** | Yes — bumped 1.2 → 1.3. |

---

### 2026-06-11 — Phase 6: Royaltē Intelligence Engine™ (generic rule executor)

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Merge Phase 6 — generic, deterministic rule executor (`api/_lib/intelligence-engine.js`) that consumes the Rule Library against the CIO. No category switches; rules drive everything. Tag `intelligence-engine-v1.0`. |
| **Reason** | Complete the constitutional separation knowledge / execution / presentation. The engine executes; the Rule Library owns knowledge. |
| **Impact** | Layer 7 of the Engineering Stack is locked. Phase 7+ may wire the engine into consumers. |
| **Vote** | Board Approved |
| **PR Number** | #131 |
| **Commit SHA** | `a23788b` |
| **Constitution update required** | Yes (covered by the v1.3 update at PR #132). |

---

### 2026-06-11 — Close PR #129 (architecturally superseded Intelligence Engine v1)

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Close PR #129 (the original Phase-5 Intelligence Engine that hardcoded rules inside the engine). Work has been redone as PR #130 (Rule Library) + PR #131 (generic engine). |
| **Reason** | The Board reframed Phase 5 mid-sprint into the constitutional separation (knowledge ≠ execution). The original PR #129 design violates that separation. |
| **Impact** | PR #129 closed without merge. `main` was never affected. |
| **Vote** | Board Approved |
| **PR Number** | #129 (closed, not merged) |
| **Commit SHA** | — |
| **Constitution update required** | No |

---

### 2026-06-11 — Phase 5: Royaltē Rule Library™

| | |
|---|---|
| **Date** | 2026-06-11 |
| **Decision** | Merge Phase 5 — declarative business knowledge as pure-data rule objects under `api/rules/*`. 12 rules across IDENTITY / PUBLISHING / CATALOG / METADATA. MONITORING / REVENUE / GENERAL reserved as empty arrays. |
| **Reason** | Constitutional separation: knowledge must live separately from execution. |
| **Impact** | Layer 6 of the Engineering Stack is locked. Rule Library is the only place provider-neutral business knowledge lives. |
| **Vote** | Board Approved |
| **PR Number** | #130 |
| **Commit SHA** | `8907bd6` |
| **Constitution update required** | Yes (covered by v1.3 at PR #132). |

---

### 2026-06-10 — Phase 4: Canonical Intelligence Assembly Engine™

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Decision** | Merge Phase 4 — pure, deterministic projection of (Identity Graph + adapter outputs + scan payload) into a deeply-frozen Canonical Intelligence Object. CIO summarises but never duplicates graph storage (royalteId / IPI references only). |
| **Reason** | Establish the canonical assembled-intelligence artifact every downstream consumer reads. |
| **Impact** | Layer 4 + the CIO shape (Layer 5) are locked. |
| **Vote** | Board Approved |
| **PR Number** | #128 |
| **Commit SHA** | `a3c78d7` |
| **Constitution update required** | Yes (covered by v1.3 at PR #132). |

---

### 2026-06-10 — Phase 3: Royaltē Identity Graph™ (Publishing Layer)

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Decision** | Merge Phase 3 — extend `api/_lib/identity-graph.js` with a Publishing Layer: `CompositionNode` with `royalteId` + `externalIds` map (mlc, socan, ascap, bmi, cisac, musicbrainz) + Recording↔Composition link maps. Provider-neutral public API. |
| **Reason** | The graph owns relationships across providers. ISRC ≠ ISWC; recordings and compositions are intentionally many-to-many. |
| **Impact** | Layer 3 of the Engineering Stack is locked. |
| **Vote** | Board Approved |
| **PR Number** | #127 |
| **Commit SHA** | `bf12b5a` |
| **Constitution update required** | Yes (covered by v1.3 at PR #132). |

---

### 2026-06-10 — Phase 2: Royaltē Publishing Intelligence Adapter™

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Decision** | Merge Phase 2 — `lib/publishing/mlc-adapter.js` as the sole owner of MLC field-name parsing. Tag `mlc-publishing-adapter-v1.0`. Establishes the constitutional rule: no module outside the adapter may read provider field names directly. |
| **Reason** | Provider isolation. Future SOCAN / ASCAP / BMI adapters land in the same `lib/publishing/` directory without changing any downstream consumer. |
| **Impact** | Layer 2 of the Engineering Stack is locked. |
| **Vote** | Board Approved |
| **PR Number** | #126 |
| **Commit SHA** | `bca9e68` |
| **Constitution update required** | Yes (covered by v1.3 at PR #132). |

---

### 2026-06-10 — Phase 1: MLC Public API connectivity proven

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Decision** | Merge `/api/mlc-test` probe endpoint. Document the OAuth two-step flow: `POST /oauth/token` with username + password → `accessToken` + `idToken` → POST search endpoints with `Authorization: Bearer <idToken>`. Verified end-to-end with real publishing data. |
| **Reason** | No phase can wire intelligence into production without first proving the provider connection works. |
| **Impact** | Phase 2+ unblocked. |
| **Vote** | Board Approved |
| **PR Number** | #123 · #124 · #125 (sequential probe iterations) |
| **Commit SHA** | (sequential) |
| **Constitution update required** | No |

---

### 2026-06-10 — Royaltē Scan Experience V1 DESIGN FROZEN

| | |
|---|---|
| **Date** | 2026-06-10 |
| **Decision** | Lock the Royaltē Scan Experience V1 UI. PR #122 stays OPEN; do not merge until live intelligence wiring is complete. No layout / spacing / typography / color / animation / UX changes are authorised; only intelligence wiring into the locked interface. |
| **Reason** | Multiple iterations of design briefs produced the locked UI. Engineering effort must shift from presentation to wiring verified data sources. |
| **Impact** | All Phase 1–6 sprint work proceeds without touching `public/index.html`. |
| **Vote** | Board Approved |
| **PR Number** | #122 (open, held) |
| **Commit SHA** | — |
| **Constitution update required** | No |

---

## How to add a new decision (template)

Copy this stub to the **top** of the Decision Log on every Board-authorised merge:

```markdown
### YYYY-MM-DD — <decision title>

| | |
|---|---|
| **Date** | YYYY-MM-DD |
| **Decision** | <one or two sentences> |
| **Reason** | <why the Board decided this> |
| **Impact** | <what changes in the platform / process> |
| **Vote** | Board Approved |
| **PR Number** | #<number> |
| **Commit SHA** | <merge sha> |
| **Constitution update required** | Yes / No |
```

Never overwrite an existing entry. Never reorder. If a later decision reverses a prior one, the new entry **explicitly cites** the entry it supersedes.
