# Royaltē Board Decisions

**Status:** append-only chronological record of every Board decision affecting the platform.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.

**Append-only rule:** existing entries are never edited, reordered, or deleted. Corrections are made by appending a new entry that supersedes the prior one (with explicit reference back).

Entries are listed **newest first** for ease of catching up; chronological order within the file is preserved by date.

---

## Decision Log

### 2026-07-11 — Mission Control™ v2.0 Sprint 2 — Evidence Contracts™ — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-11 |
| **Decision** | Sprint 2 (Evidence Contracts™) is ratified. The Evidence Contract layer is constitutionally ratified as the standard transport interface between every provider connector and the Canonical Intelligence Platform pipeline. |
| **Reason** | Mission Control™ v2.0 requires a constitutional contract for how providers contribute evidence. Sprint 2 establishes this layer: 6 Evidence Contracts (Identity, Rights, Catalog, Distribution, Monitoring, Operations), a 16-provider registry, a 13-rule validation engine, an Evidence Envelope™ factory, a Contract Registry with startup integrity check, and full architectural documentation. No connector may invent its own output shape — it must satisfy an Evidence Contract. |
| **Impact** | `api/evidence/` created — types.js, version.js, providers.js, validate.js, envelope.js, index.js, 6 contract files + EVIDENCE_CONTRACTS.md. `tests/evidence-contracts-test.mjs` — 203 assertions / 12 sections. Contract Registry validates at startup; broken registry = startup failure. Tagged `evidence-contracts-sprint2-v1.0` at `d10d469`. |
| **Vote** | Board Unanimous |
| **PR Number** | #305 |
| **Commit SHA** | `d10d469` |
| **Tag** | `evidence-contracts-sprint2-v1.0` |
| **Constitution update required** | No |

---

### 2026-07-11 — Mission Control™ v2.0 Sprint 1 — Canonical Registry Foundation™ — RATIFIED

| | |
|---|---|
| **Date** | 2026-07-11 |
| **Decision** | Sprint 1 (Canonical Registry Foundation™) and Sprint 1A (Ownership Corrections) are ratified as an architectural milestone. The Canonical Field Registry is constitutionally ratified as the single source of truth for every piece of intelligence Royaltē tracks. |
| **Reason** | Mission Control™ v2.0 requires a stable field registry before any Evidence Contract, connector, or workspace work can proceed. Sprint 1 establishes this foundation: 14 registry files, 6 owning domains, 6 consumer workspaces, 3 object classes, 26 canonical objects, a provisional field governance layer, startup validation, and architectural documentation. |
| **Impact** | `api/registry/` created — types.js, objects.js, version.js, validate.js, index.js, 6 domain field files + derived.js, REGISTRY_ARCHITECTURE.md. `tests/registry-test.mjs` — 168 assertions / 15 sections. Registry validates at startup; broken registry = startup failure. Tagged `canonical-registry-sprint1-v1.0` at `a902da7`. |
| **Vote** | Board Unanimous |
| **PR Number** | #303 |
| **Commit SHA** | `a902da7` |
| **Tag** | `canonical-registry-sprint1-v1.0` |
| **Constitution update required** | No |

---

### 2026-07-11 — Identity Intelligence™ Workspace 2 — Data Integrity Program™ Validation — APPROVED

| | |
|---|---|
| **Date** | 2026-07-11 |
| **Decision** | Identity Intelligence™ Workspace 2 validated against Black Alternative's canonical fixture and approved. All displayed intelligence — provider statuses, coverage, verified counts, snapshot fields — accurately represents the canonical scan results. Single Source of Truth Architecture™ adopted: the canonical fixture lives at one physical path (`public/fixtures/canonical-black-alternative.json`) and is fetched, never duplicated. |
| **Reason** | Data Integrity Program™ validation revealed that the workspace contained fabricated data (hardcoded Deezer/TIDAL "Verified 95/97%" badges), broken field wiring (Primary Release, Genres, Top Track null-state), and a duplicate source of truth (inline JS object copying the canonical fixture). Board standard: every workspace displays live, traceable intelligence or a truthful empty state. |
| **Impact** | `public/workspaces/identity-intelligence.html` — source fixes (artist name fallback, snapshot null-state handling, Deezer/TIDAL alert semantics, Primary Release wiring from `catalogIntelligence.bestVerifiedRelease.releaseTitle`). `public/fixtures/canonical-black-alternative.json` created as sole fetchable fixture; `api/fixtures/canonical-black-alternative.json` retired. Dev loader refactored to fetch from canonical fixture path — never embeds a copy. Governance references updated. 226/226 pipeline green. |
| **Vote** | Board Approved |
| **PR Number** | #299 |
| **Commit SHA** | `500a3b4` (source fixes) + `0680561` (single source of truth architecture) |
| **Constitution update required** | No |

---

### 2026-07-11 — Mission Control™ Canonical Validation Report™ v1.0 — Required Engineering Artifact — APPROVED

| | |
|---|---|
| **Date** | 2026-07-11 |
| **Decision** | The Mission Control™ Canonical Validation Report™ is a required engineering artifact. It documents the verified intelligence state of every workspace against Black Alternative's scan results and becomes the Executive Board's primary reference during development and the engineering team's authoritative validation guide. |
| **Reason** | Mission Control™ is an Executive Intelligence Platform. Its credibility depends on the accuracy of every intelligence module. The CVR proves every displayed value is traceable, verified, and trusted. |
| **Impact** | `governance/CANONICAL_VALIDATION_REPORT.md` created — 9-workspace validation, data lineage, variance register, board decision register. 6/9 workspaces verified; 2 open Board decisions (DECISION-001: status vocabulary alignment; DECISION-002: AUTH_UNAVAILABLE backend scoring). Living document — updated whenever an engine, model, workspace, or fixture changes. |
| **Vote** | Board Approved |
| **PR Number** | #297 |
| **Commit SHA** | `6c52407` |
| **Constitution update required** | No |

---

### 2026-07-11 — Mission Control™ Data Integrity Program™ — Black Alternative as Canonical Development Artist™ — INITIATED

| | |
|---|---|
| **Date** | 2026-07-11 |
| **Decision** | All new module development paused. Every Mission Control™ workspace must be validated using Black Alternative's verified scan results before it can be considered complete. A workspace is complete only when the intelligence accurately represents Black Alternative's real music ecosystem — not when the JavaScript works or the tests pass. |
| **Reason** | Live Board review of Black Alternative's Mission Control™ revealed that displayed intelligence did not accurately reflect their actual music ecosystem. Architecture complete; data accuracy validation begins. |
| **Impact** | Black Alternative designated Canonical Development Artist™. `public/fixtures/canonical-black-alternative.json` added as reference fixture. Three text-quality bugs in Executive Brief Engine™ fixed at source (`8989e88`): subject-verb agreement, zero-recommendation guard, no-risk sentence. Two items flagged for future Board decision: (1) healthIntelligence "Excellent" vs Phase 7 "B/Strong" vocabulary alignment; (2) backendScore 100 with MLC AUTH_UNAVAILABLE scoring philosophy. |
| **Vote** | Board Initiated |
| **PR Number** | #295 |
| **Commit SHA** | `8989e88` |
| **Constitution update required** | No |

---

### 2026-07-10 — Royaltē AI™ Intelligence Wiring Phase 1B.3 — Demo Placeholder Removal + Full CWA™ Wiring — APPROVED

| | |
|---|---|
| **Date** | 2026-07-10 |
| **Decision** | Royaltē AI™ workspace fully wired to live intelligence via the Canonical Workspace Architecture™ (4-layer: §1 Context, §2 Intelligence, §3 Presentation, §4 Render). All 9 hardcoded demo items (4 rec cards, 5 priority rows) removed. Mission Control™ must never display fictional intelligence. |
| **Reason** | Demo placeholder content was shown unconditionally to every artist regardless of their actual scan data. Board standard: every workspace must display live data or a truthful empty state — never fabricated content. |
| **Impact** | `public/workspaces/ai-insights.html` — full CWA™ rewrite; loading/empty/live three-state lifecycle for `#ai-rec-grid` and `#ai-priorities-list`; cross-module synthesis across 8 intelligence sources; cleanup IIFE for no-session-context path. Validation harness rebuilt to production-equivalent (`/tmp/validate-ai-wiring.mjs`). 63/63 data flow · 46/46 smoke · 226/226 pipeline. |
| **Vote** | Board Approved |
| **PR Number** | #293 |
| **Commit SHA** | `9b5e648` |
| **Constitution update required** | No |

---

### 2026-07-04 — Executive Product Review Standard™ — Mandatory Merge Gate — MANDATORY

| | |
|---|---|
| **Date** | 2026-07-04 |
| **Decision** | No Executive Workspace may be merged into main until it has passed all three mandatory gates: (1) Development Complete, (2) Product Review Complete per `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`, (3) Board Review Complete. The Engineering Agent conducting development is responsible for completing the Product Review before opening a PR. The Board is responsible for the final approval before merge. Neither gate may be skipped. |
| **Reason** | Feature complete ≠ product complete. The final 2–3% of quality — visual consistency, emotional impact, OS coherence — is only found by experiencing the product, not by reading code. Every workspace must feel like one operating system. The previous review passes (PRs #232, #233) confirmed that product reviews surface real issues that code review misses: unicode character inconsistencies, inline style violations, panel stat grid rhythm breaks. |
| **Impact** | Mandatory pre-merge gate on all current and future Executive Workspaces. Standard documented at `governance/EXECUTIVE_PRODUCT_REVIEW_STANDARD.md`. Agent Memory updated. Session memory updated. |
| **Vote** | MANDATORY — Board-issued standard, no vote required |
| **PR Number** | #234 |
| **Commit SHA** | pending |
| **Constitution update required** | No |

---

### 2026-07-03 — Executive Workspace Image Selection Standard™ — Platform-Agnostic Architecture — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Executive Workspaces must never reference a specific music platform for image selection. The UI requests only **Best Verified Artist Image™** or **Best Verified Release Artwork™** via `getBestVerifiedArtistImage()` / `getBestVerifiedReleaseArtwork()`. The backend intelligence layer owns source selection, quality evaluation, and future platform expansion. No workspace UI may read from `payload.platforms.apple.*`, `payload.platforms.spotify.*`, or any provider-specific path for images. |
| **Reason** | Royaltē must not appear to favour any streaming platform. Hardcoding Apple or Spotify into UI image selection would require UI redesigns for every future provider integration. Architecture separation keeps workspaces platform-agnostic and future-proof. |
| **Impact** | New `api/_lib/image-service.js` — sole backend owner. New `public/js/royalte-image-service.js` — sole frontend owner. `api/_lib/run-scan.js` inline platform chains replaced with service calls. `public/css/royalte-workspace.css` — `.royalte-exec-img` 80×80 standard class + `--artist` / `--artwork` variants. |
| **Vote** | Board Approved |
| **PR Number** | #228 |
| **Commit SHA** | `7127bc0` |
| **Constitution update required** | No |

---

### 2026-07-03 — Reporting Time Zone™ Board Addendum — Dynamic tz detection + profile storage — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | RTZ must never be hardcoded. On first login the browser's `Intl.DateTimeFormat` detects the IANA zone automatically (e.g. `America/Toronto`). The zone is stored in `profiles.reporting_timezone` (authenticated) or `localStorage` (anonymous). The derived abbreviation (EDT, PST, GMT, etc.) is displayed throughout Royaltē OS via `[data-mc-rtz-abbr]`. The artist may override this value later from Settings → Preferences (deferred surface). IP-based fallback also deferred. |
| **Reason** | A hardcoded "EDT" would break for every artist outside the US Eastern time zone. The Reporting Time Zone™ is a user-level reporting standard that governs scans, alerts, and Executive Brief™ reports — it must reflect the artist's actual locale. |
| **Impact** | New `public/js/royalte-tz.js` — sole owner of RTZ detection, storage (`profiles.reporting_timezone` + `localStorage`), and DOM rendering (`[data-mc-rtz-abbr]`). New migration `supabase/migrations/20260703000000_reporting_timezone.sql` — `profiles.reporting_timezone text DEFAULT NULL`. `public/js/mission-control.js` — imports and calls `initRtz()` on DOMContentLoaded, independent of scan payload. |
| **Vote** | Board Approved |
| **PR Number** | #226 |
| **Commit SHA** | `6efd9e2` |
| **Constitution update required** | No |

---

### 2026-07-03 — Reporting Time Zone™ Placement Amendment #004 — MC System Status™ only — CORRECTION

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Board correction of Amendment #003. RTZ removed from ALL Executive Workspace right panels (Health, Identity, Publishing). RTZ placed exclusively on Mission Control's existing system status section, renamed from "Monitoring Status" to **System Status™**. Approved hierarchy: System Status™ / Operational / ✓ Monitoring Active / divider / clock + abbreviation / Reporting Time Zone™ / System Time Synced ✓. Supersedes Amendment #003. |
| **Reason** | Executive Workspaces are artist intelligence surfaces — system status is an OS-level concern, not a workspace-level concern. Mission Control is the correct home for OS infrastructure indicators. |
| **Impact** | Orphaned `hi-sys-*` + `rtz-*` CSS removed from `royalte-workspace.css`. System Status™ HTML block removed from `health-intelligence.html`, `identity-intelligence.html`, `publishing-intelligence.html`. `mc-es-cell--status` renamed to System Status™; `mc-es-rtz-*` CSS + RTZ HTML block appended in MC inline style. |
| **Vote** | Board Correction — Required |
| **PR Number** | #226 |
| **Commit SHA** | `6efd9e2` |
| **Constitution update required** | No |

---

### 2026-07-03 — Reporting Time Zone™ System Status Amendment #003 — SUPERSEDED by Amendment #004

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | ~~Add RTZ as a `hi-panel-section--system` at the bottom of the right exec panel in all three active Executive Workspaces.~~ **SUPERSEDED by Amendment #004 (above).** Entered governance record for completeness; implementation was reversed before production merge. |
| **Reason** | Superseded — placement decision was corrected to MC System Status™ only. |
| **Impact** | None (reversed in same PR #226 before merge). |
| **Vote** | Board Approved then Corrected |
| **PR Number** | #226 |
| **Commit SHA** | `6efd9e2` (net result after #004 reversal) |
| **Constitution update required** | No |

---

### 2026-07-03 — Publishing Intelligence™ Workspace — Board Amendment #002 — Rights Ownership™ — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Replace Songwriter Splits™ (from Amendment #001) with Rights Ownership™ (shield-check icon, 100% Independent). Canonical system card order locked: The MLC → Songtrust → Music Reports → Publisher (Interscope) → ISWC Coverage™ → Rights Ownership™. Supersedes the Songwriter Splits™ portion of Amendment #001. |
| **Reason** | Rights Ownership™ conveys executive clarity — the artist has independent rights, the most valuable publishing position. Songwriter splits are a detail better suited to a future dedicated surface. |
| **Impact** | Card 6 in `publishing-intelligence.html` updated. CSS `pi-system-badge--verified` applied. Canonical 6-card order locked for all future Publishing workspace iterations. |
| **Vote** | Board Approved |
| **PR Number** | #224 |
| **Commit SHA** | `cdd4fda` |
| **Constitution update required** | No |

---

### 2026-07-03 — Publishing Intelligence™ Workspace — Board Amendment #001 — ISWC Coverage™ + Superseded — PARTIALLY SUPERSEDED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Remove PRO and Harry Fox Agency. Replace with ISWC Coverage™ (tag icon, 16 Assigned · 2 Pending) and Songwriter Splits™ (Amendment #001). Songwriter Splits™ subsequently superseded by Amendment #002 (Rights Ownership™). ISWC Coverage™ survives as card 5 in canonical order. |
| **Reason** | PRO and Harry Fox Agency are generic industry names with no live data backing them in V1. ISWC Coverage™ is a concrete, data-backed signal. |
| **Impact** | `publishing-intelligence.html` — cards 5 and 6 replaced. Amendment #002 subsequently locked the canonical order and replaced card 6 again. |
| **Vote** | Board Approved |
| **PR Number** | #224 |
| **Commit SHA** | `cdd4fda` (net result after Amendment #002) |
| **Constitution update required** | No |

---

### 2026-07-03 — Publishing Intelligence™ Workspace — Phase 1 Build — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve Publishing Intelligence™ as the third Executive Intelligence Workspace. Royal Violet (`#7c3aed`). System-focused (no artist avatar). 4 KPI cards (Potential Royalty Impact™ as Executive Signature™ with amber pulse, Publishing Coverage™, Registered Works™, Collection Health™). 6 Core Publishing System cards. `pi-*` CSS namespace. `ws-dept--publishing` ambient glow. |
| **Reason** | Publishing and rights are the highest-leverage financial surface for independent artists. A dedicated publishing workspace surfaces royalty risk as an executive priority. |
| **Impact** | `public/workspaces/publishing-intelligence.html` — full new workspace (~520 lines). `public/css/royalte-workspace.css` — `pi-*` namespace + `ws-dept--publishing` glow appended (~237 lines). |
| **Vote** | Board Approved |
| **PR Number** | #224 |
| **Commit SHA** | `cdd4fda` |
| **Constitution update required** | No |

---

### 2026-07-03 — Ambient Module Elevation™ — Executive Workspace Design Language — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve Ambient Module Elevation™ system. Every Executive Workspace declares its department via `ws-dept--*` class on `ws-shell`. All card modules receive a workspace-scoped ambient glow (large blur, very low opacity, feathers outside card edges). Hover amplifies the glow. Health Intelligence™ (emerald) and Identity Intelligence™ (purple) are the first two implementations. Future workspaces extend the system by adding their own `ws-dept--*` scoped glow rules. |
| **Reason** | Each workspace must feel like a distinct intelligence department without changing layout, navigation, or spacing. The ambient glow achieves atmospheric differentiation while maintaining OS consistency. |
| **Impact** | `public/css/royalte-workspace.css` — `.ws-dept--health` and `.ws-dept--identity` scoped glow rules appended (~60 lines). `public/workspaces/health-intelligence.html` — `ws-dept--health` added to `ws-shell`. `public/workspaces/identity-intelligence.html` — `ws-dept--identity` added to `ws-shell`. |
| **Vote** | Board Approved |
| **PR Number** | #222 |
| **Commit SHA** | `96a8dc5` |
| **Constitution update required** | No |

---

### 2026-07-03 — Phase 4 — Identity Intelligence™ Workspace Build — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve Identity Intelligence™ as the second Executive Intelligence Workspace, built on the Health Intelligence™ standard. Color identity: Purple. Reuses Health workspace components (`hi-main`, `hi-kpi-row/card`, `hi-status-pill`, `hi-exec-panel`, `hi-artist-*`). New `ii-*` namespace covers only Identity-specific components, organized in 5 logical CSS blocks per Board Amendment #001. Executive Signature™: Identity Coverage™ ring animates once on page load (0→92%), then stops permanently. |
| **Reason** | Identity Intelligence™ answers the executive question "Does the music industry recognize me correctly?" It requires a dedicated workspace that inherits the Health Intelligence™ design language while expressing its own intelligence and visual identity (purple accent, artist avatar, platform cards, coverage ring). |
| **Impact** | `public/workspaces/identity-intelligence.html` — full rewrite from MC card stub to complete Executive Workspace (~520 lines). `public/css/royalte-workspace.css` — `ii-*` CSS namespace appended in 5 blocks (~270 lines). |
| **Vote** | Board Approved |
| **PR Number** | #222 |
| **Commit SHA** | `c43f431` (workspace) · `96a8dc5` (ambient glow) |
| **Constitution update required** | No |

---

### 2026-07-03 — Sprint 3.4 Amendment 2 — Publishing Intelligence™ Executive Layout Refinement — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve CSS-only typography refinement of Publishing Intelligence™. Financial Impact™ elevated to executive brief style; Biggest Risk and Biggest Win reduced to supporting cards. No HTML structure, JS, or data changes. |
| **Reason** | Financial Impact™ was visually competing with smaller cards rather than leading the lower section. The explanation body — the artist's executive message — needed higher typographic weight. |
| **Impact** | `public/mission-control.html` CSS only: impact body 11px → 12.5px weight-500 `var(--mc-text)`; labels recede to 8px muted; Risk + Win padding/icon/title compressed. |
| **Vote** | Board Approved |
| **PR Number** | #216 |
| **Commit SHA** | `8400134` |
| **Constitution update required** | No |

---

### 2026-07-03 — Sprint 3.4 — Publishing Intelligence™ Executive Passport + Financial Impact Amendment — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve and merge Sprint 3.4 — Publishing Intelligence™ executive passport (7 sections) plus Board Amendment expanding Section 4 into a Financial Impact mini Executive Brief. |
| **Reason** | The legacy publishing card (ring + flat checklist) provided no executive context. The 7-section passport delivers publishing completeness as a financial readiness dashboard. The Amendment adds Potential Royalty Impact™ explanation and Estimated Resolution to Section 4, giving artists a complete executive read within five seconds. Financial Neutrality Rule™ preserved throughout — no dollar amounts. |
| **Impact** | `public/mission-control.html`: old `mc-pub-body` + `mc-pub-checks` replaced with `mc-pi-body` 7-section grid. Section 4 Financial Impact™ contains risk badge, Potential Royalty Impact™ explanation, and Estimated Resolution time. `public/js/mission-control.js`: `buildPublishingIntelligencePlan` + `applyPublishingIntelligencePlan` added; `_piFinancialImpact` returns fuller body copy + resolution time. `public/js/vault-auth.js`: sentinel updated to `data-mc-pi-*`. |
| **Vote** | Board Approved (Sprint 3.4) + Board Approved (Amendment) |
| **PR Number** | #215 |
| **Commit SHA** | `7f52f4f` (Sprint 3.4) · `2bb1af2` (Amendment) |
| **Constitution update required** | No |

---

### 2026-07-03 — Sprint 3.3 — Identity Intelligence™ Executive Passport — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve and merge Sprint 3.3 — Identity Intelligence™ executive passport redesign. Replaces the legacy fingerprint ring + provider checklist with a 6-section constitutional presentation layer: Identity Coverage (% + grade), Identity Summary (4-count cells), Identity Providers (constitutional + platform pills), Biggest Risk, Biggest Win, Recent Changes. |
| **Reason** | The legacy identity card surfaced a fingerprint animation and a flat provider checklist with no executive context. The 6-section passport delivers the same intelligence as a structured executive readout aligned with the Health Intelligence™ card pattern established in Sprint 3.2. |
| **Impact** | `public/mission-control.html`: old `mc-identity-body` + `mc-identity-checks` blocks replaced with `mc-id-body` 6-section grid. `public/js/mission-control.js`: `buildIdentityIntelligencePlan` + `applyIdentityIntelligencePlan` added; count-up animation on coverage reveal. `public/js/vault-auth.js`: sentinel blanking updated to `data-mc-id-*` targets. Legacy identity plans preserved for ai-insights module. |
| **Vote** | Board Approved |
| **PR Number** | #213 |
| **Commit SHA** | `654eb52` |
| **Constitution update required** | No |

---

### 2026-07-03 — Executive Layout Optimization™ v1.0 — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve and merge the Executive Layout Optimization™ CSS-only density pass on Mission Control™ targeting the 1920×1080 viewport. No content removed, no wiring changed, no business logic touched. Mobile/tablet responsiveness unchanged. Classified as Executive Layout Optimization™ Version 1; a final holistic pass is deferred until all MC modules are redesigned. |
| **Reason** | At full desktop resolution the Executive Overview required vertical scrolling, reducing the immediate executive readout. Information density must match the ambition of the product. |
| **Impact** | Page title 36→24px, hero banner ~40px shorter (radar 130→90px, cell padding compressed), Health Intelligence™ card ~170px shorter (breakdown 2-col grid, sparkline inline, section gaps tightened). Estimated 260px total reduction on main column. |
| **Vote** | Board Approved |
| **PR Number** | #211 |
| **Commit SHA** | `83c8804` |
| **Constitution update required** | No |

---

### 2026-07-03 — Sprint 3.2 — Health Intelligence™ Executive Assessment — APPROVED

| | |
|---|---|
| **Date** | 2026-07-03 |
| **Decision** | Approve and merge Sprint 3.2: redesign of the Health Intelligence™ card into a 6-section executive assessment. Sections: (1) Overall Health Score + Grade + Trend, (2) Health Breakdown (6 categories, 2-col grid), (3) Biggest Improvement, (4) Biggest Risk, (5) Health Trend sparkline (current scan only; historical pending), (6) Recent Changes. Scope locked to the health-intelligence module only. All values sourced constitutionally from `renderHealth()` / `healthReport` / monitoring intelligence. |
| **Reason** | The former Health card showed only the ring + single metric. The executive OS requires at minimum a category breakdown and risk/strength highlights at a glance. |
| **Impact** | `public/mission-control.html` — new `mc-hi-*` CSS + HTML 6-section structure. `public/js/mission-control.js` — `buildHealthIntelligencePlan` + `applyHealthIntelligencePlan`. `public/js/vault-auth.js` — `_blankSentinelData` updated to new `data-mc-hi-*` targets. |
| **Vote** | Board Approved |
| **PR Number** | #211 |
| **Commit SHA** | `346a2d0` |
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
