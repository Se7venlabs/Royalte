# INVENTION LOG

**Owner:** Se7ven Labs LLC
**Status:** **APPEND-ONLY. Never overwrite. Never delete.**
**Effective:** 2026-06-11

Chronological diary of original inventions. Each row captures the moment an idea crystallised, the inventor who recognised it, an internal estimate of commercial potential, and any notes that contextualise the entry. The log preserves authorship and timing **regardless** of the disposition decision (file as patent · file as defensive publication · retain as trade secret · take no action) — so that priority can be re-established at any time in the future.

Companion files: `PATENTS.md`, `PRIOR_ART.md`, `DEFENSIVE_PUBLICATIONS.md`, `TRADE_SECRETS.md`, `FOUNDER_NOTES.md`.

---

## Ledger

| Date | Title | Description | Inventor | Commercial Potential | Notes |
|---|---|---|---|---|---|
| 2026-05-08 | Audit pipeline (engine + persistence) | Engine fan-out to ~10 third-party platforms via `Promise.allSettled`; canonical AuditResponse contract introduced. | Darryl West | Strategic | First Vercel-function production deploy. |
| 2026-05-13 | Branch-protection-gated `Run pipeline test` | Ruleset `16344395` requires the pipeline test to pass before merge; codifies the first constitutional CI invariant. | Darryl West | Medium | First constitutional gate enforced by the platform itself. |
| 2026-05-14 | Royaltē Audit™ scoring model lock | 0-30 Low Risk / 31-60 Moderate / 61-80 At Risk / 81-100 Critical bands with `+N risk` section formatting. | Darryl West | High | PR #24. CLAUDE.md V1 scoring lock. |
| 2026-05-20 | V2 Health Score model (signal-driven) | Health Score (0-100, higher = better) with locked bucket maxes (catalog_verification 40 / big6 20 / backend_health 20 / youtube_presence 10 / isrc 10). Driver strings follow trust tone. | Darryl West | High | Brief 012a (2026-05-29 finalisation). |
| 2026-05-29 | Music Backend Intelligence™ category | Repositioning of the product category from "music royalty audit" to "Music Backend Intelligence™." | Darryl West | Strategic | First public use 2026-05-29. Internal memory: `project_royalte_positioning`. |
| 2026-05-30 | Royaltē Review (V2 framing of the artist PDF) | Audit-report email PDF promoted to V2 framing; uses V2 Health Score model; renders from locked template. | Darryl West | High | Brief 014. `lib/audit-report-template.html` + `lib/render-audit-pdf.js`. |
| 2026-06-04 | Royaltē Mission Control™ V1 structure | Locked MC structure: command bar + 3 cards + structural posture. | Darryl West | High | Internal memory: `project_royalte_mc_freeze`. |
| 2026-06-04 | Royaltē Signal Meter™ design | Health Score VU meter design language. | Darryl West | Medium | Internal memory: `project_royalte_signal_meter_locked`. |
| 2026-06-07 | Canonical Identity Architecture (Apple-canonical / Spotify-verification) | Apple Music = canonical identity; Spotify = verification; all enrichment independent. One Royaltē Canonical Artist Object as single source of truth. | Darryl West | Strategic | Internal memory: `project_royalte_canonical_identity_architecture`. |
| 2026-06-09 | Royaltē Master Constitution v1.0 | Seven inherited principles binding every future brief; supreme governing document instantiated. | Darryl West | Strategic | Successively bumped to v1.3 by 2026-06-11. |
| 2026-06-09 | Royaltē Governance Directive | Engineering-tier corollary to the Constitution: source-of-truth comments, named-constant gates, convergence tests, intelligence maps, file-level principle headers. | Darryl West | High | Internal memory: `project_royalte_governance_directive`. |
| 2026-06-09 | Identity Graph separation (engine never owns artist data) | Constitutional rule: the scan engine MUST NOT own artist identity. All artist-specific records live in `api/_lib/identity-graph.js`. | Darryl West | High | Internal memory: `project_royalte_identity_graph_separation`. |
| 2026-06-09 | Canonical Payload V2 — 12-object intelligence model | The 12 ratified objects every product consumes. Distribution folded into globalFootprint; providers under verification.providers.*; AI Insight generated once. | Darryl West | Strategic | `constitution/CANONICAL_PAYLOAD_V2.md`. |
| 2026-06-09 | Royaltē Boot Sequence™ | 5-question pre-implementation initialisation procedure; Constitutional Priority chain. | Darryl West | Strategic | `CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION". |
| 2026-06-10 | Provider-isolated normalisation adapter pattern | Single-owner rule for provider field-name parsing — first instance: MLC adapter. | Darryl West | Strategic | Tag `mlc-publishing-adapter-v1.0` at `bca9e68`, PR #126 (Phase 2). |
| 2026-06-10 | Royaltē Identity Graph™ Publishing Layer | `CompositionNode` + `royalteId` + external-IDs map across mlc / socan / ascap / bmi / cisac / musicbrainz; provider-neutral public API. | Darryl West | Strategic | `bf12b5a`, PR #127 (Phase 3). |
| 2026-06-10 | Royaltē Scan™ V1 design freeze | UI lock: layout / spacing / typography / color / animation / UX. Only intelligence wiring permitted while held. | Darryl West | High | PR #122 (held open). |
| 2026-06-10 | Royaltē Canonical Intelligence Assembly Engine™ | Pure deterministic projection of (Identity Graph + adapter outputs + scan payload) → deeply-frozen CIO; summarises only (royalteId / IPI refs); reserved monitoring + revenue sections. | Darryl West | Strategic | `a3c78d7`, PR #128 (Phase 4). |
| 2026-06-11 | Royaltē Rule Library™ | Declarative business knowledge as pure-data rules; `(cio) → boolean` conditions; never executes; never imports provider field names; structural validation with stable error codes. | Darryl West | Strategic | `8907bd6`, PR #130 (Phase 5). |
| 2026-06-11 | Constitutional separation (knowledge ≠ execution ≠ scoring ≠ presentation) | The doctrine that drove PR #129 to be closed in favour of PR #130 + #131. | Darryl West | Strategic | Closed PR #129 ratified the doctrine. |
| 2026-06-11 | Royaltē Intelligence Engine™ | Generic deterministic rule executor; no category switch; rules drive everything; SHA-256 prefix observation IDs; polarity-driven strengths routing. | Darryl West | Strategic | Tag `intelligence-engine-v1.0` at `a23788b`, PR #131 (Phase 6). |
| 2026-06-11 | Royaltē Engineering Stack™ (Constitution v1.3 § 8B) | Seven-layer architecture canonicalised: Providers → Adapters → Identity Graph → Assembly Engine → CIO → Rule Library → Intelligence Engine → Consumers. | Darryl West | Strategic | `33edba6`, PR #132. |
| 2026-06-11 | Royaltē Governance Layer™ | Append-only `/governance/` directory; AI Startup Order; constitutional rule binding every phase merge to a synchronous governance update. | Darryl West | Strategic | `253de6b`, PR #133 + #134. |
| 2026-06-11 | Royaltē Golden Fixture Library™ + immutable-fixture rule | Canonical regression surface; fixtures immutable, versioned forward; never overwrite. Exposed the Phase 5 / Phase 6 polarity gap, resolved via the additive `polarity: 'positive'` rule field. | Darryl West | High | `52b1750`, PR #135 (Phase 6.5). |
| 2026-06-11 | Royaltē Health Engine™ | Deterministic projection of Intelligence Report → 0-100 score + A+/A/B/C/D/F grade; Board-locked CATEGORY_WEIGHTS (sum to 1.0) and GRADE_THRESHOLDS; per-severity deduction table; deeply-frozen output; never throws. | Darryl West | Strategic | `ec57481`, PR #137 (Phase 7). |
| 2026-06-11 | Se7ven Labs Intellectual Property Vault™ | This `/ip/` directory: 24 markdown files capturing trademarks, patents, copyrights, trade secrets, product registry, invention log, founder notes, IP roadmap, licensing, AI models, ADR log, domains, brand, press, valuation, competitor analysis, investor DD, acquisition data room, open-source posture. | Darryl West | Strategic | Phase 7.5 (this branch). |

---

## Conventions

- One row per atomic invention or methodology.
- `Date` is the date of crystallisation (when the inventor first recognised the idea as distinct), not the date the row was added.
- `Inventor` is the named person who recognised the invention. Co-inventors are listed comma-separated.
- `Commercial Potential` is the inventor's internal qualitative estimate: `Low` · `Medium` · `High` · `Strategic`.
- `Notes` carries the anchor evidence (commit SHA, PR, brief number, memory key).
- Rows are **never edited**. Corrections are appended as a new row that explicitly supersedes the prior row.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
