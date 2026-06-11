# Royaltē Board Decisions

**Status:** append-only chronological record of every Board decision affecting the platform.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.

**Append-only rule:** existing entries are never edited, reordered, or deleted. Corrections are made by appending a new entry that supersedes the prior one (with explicit reference back).

Entries are listed **newest first** for ease of catching up; chronological order within the file is preserved by date.

---

## Decision Log

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
