# FIRST USE LOG

**Owner:** Se7ven Labs LLC
**Status:** **APPEND-ONLY.** Existing entries are never edited or deleted. Corrections are appended as new entries that explicitly supersede the prior one.
**Effective:** 2026-06-11

Chronological ledger of every first-use event Se7ven Labs LLC asserts in support of trademark, copyright, and IP claims. Entries are listed **oldest first** to preserve a natural priority order.

Companion files: `TRADEMARK_USAGE.md` (per-mark view of the same evidence), `TRADEMARKS.md` (mark register), `COPYRIGHTS.md` (creative-work register).

---

## Evidence types

| Type | What it documents |
|---|---|
| **Website** | Live deployment URL or archived snapshot. |
| **Documentation** | Markdown / PDF / printed document. |
| **Git** | Specific commit SHA in this or a related repository. |
| **Presentation** | Slide deck or live presentation. |
| **Invoice** | Issued invoice referencing the marked product or service. |
| **Proposal** | Sales or partner proposal containing the mark. |
| **Customer** | Customer-facing artefact (email, contract, onboarding doc). |
| **Video** | Recorded video evidence (demo, talk, marketing). |
| **Podcast** | Podcast appearance, transcript, or RSS reference. |
| **Blog** | Blog post URL with publication date. |
| **Email** | Sent email establishing use in the ordinary course of business. |
| **Social** | Social-media permalink. |
| **Commercial Use** | Documented use connected to paid goods/services. |

---

## Ledger

| Date | Asset | Type | Description | Evidence Location |
|---|---|---|---|---|
| 2026-05-14 | Royaltē Audit™ | Git | Scan scoring model — V1 audit display locked. | PR #24, `CLAUDE.md` reference |
| 2026-05-29 | Music Backend Intelligence™ · Royaltē™ Health Score (V2 model) | Documentation | Positioning + Health Score model locked (Brief 012a). | Internal memory: `project_royalte_positioning` |
| 2026-05-30 | Royaltē Audit™ → "Royaltē Review" | Documentation · Customer | Audit PDF promoted to V2 framing — emailed Royaltē Review. | Brief 014; `lib/audit-report-template.html` |
| 2026-06-04 | Royaltē Mission Control™ | Git · Website | Mission Control structure locked (design freeze). | Internal memory: `project_royalte_mc_freeze` |
| 2026-06-09 | Royaltē Boot Sequence™ | Documentation | 5-question pre-implementation initialisation procedure published. | `CLAUDE.md` — "ROYALTÉ OS™ — SESSION INITIALIZATION" |
| 2026-06-09 | Royaltē Master Constitution v1.0 | Documentation | Supreme governing document ratified. | `constitution/ROYALTE_MASTER_CONSTITUTION.md` (current v1.3) |
| 2026-06-10 | Publishing Intelligence™ · Royaltē Publishing Intelligence Adapter™ | Git | Phase 2 merged — MLC adapter. | `bca9e68`, tag `mlc-publishing-adapter-v1.0`, PR #126 |
| 2026-06-10 | Royaltē Identity Graph™ | Git | Phase 3 Publishing Layer merged. | `bf12b5a`, PR #127 |
| 2026-06-10 | Royaltē Canonical Intelligence Object™ · Royaltē Canonical Intelligence Assembly Engine™ | Git | Phase 4 merged — CIO Assembler. | `a3c78d7`, PR #128 |
| 2026-06-10 | Royaltē Scan™ V1 | Git · Website | Scan Experience V1 DESIGN FROZEN. | PR #122 (held open) |
| 2026-06-11 | Royaltē Rule Library™ | Git | Phase 5 merged — declarative business knowledge. | `8907bd6`, PR #130 |
| 2026-06-11 | Royaltē Intelligence Engine™ · Royaltē Intelligence Report™ | Git | Phase 6 merged — generic deterministic rule executor. | `a23788b`, tag `intelligence-engine-v1.0`, PR #131 |
| 2026-06-11 | Royaltē Engineering Stack™ | Documentation | Constitution v1.3 ratified — Section 8B canonicalises the seven-layer stack. | `33edba6`, PR #132 |
| 2026-06-11 | Royaltē Governance Layer™ | Git · Documentation | `/governance/` directory established. | `253de6b`, PR #133 + PR #134 |
| 2026-06-11 | Royaltē Golden Fixture Library™ | Git | Phase 6.5 merged — canonical CIO regression fixtures. | `52b1750`, PR #135 |
| 2026-06-11 | Royaltē Health Engine™ · Royaltē Health Score™ | Git | Phase 7 merged — constitutional scoring layer. | `0c10fb4` (code) / `ec57481` (full lock), PR #137 |
| 2026-06-11 | Se7ven Labs Intellectual Property Vault™ | Git · Documentation | Phase 7.5 — this Vault established. | feat/ip-vault branch · this commit |

---

## Conventions

- One row per atomic first-use event.
- `Date` is the date of public commercial use, not the date the row was added.
- `Evidence Location` must be re-fetchable: a git SHA, a URL, a file path, a PR number, or an internal memory key. Do not store evidence inline.
- Multi-mark events (e.g. a Phase merge that introduces several marks) cite the marks together but keep a single row.
- If a row is found later to be incorrect, do **not** edit it. Append a new row that explicitly cites the row being corrected.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
