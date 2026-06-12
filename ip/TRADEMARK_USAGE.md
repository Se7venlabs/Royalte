# TRADEMARK USAGE

**Owner:** Se7ven Labs LLC
**Purpose:** evidence ledger for common-law trademark rights.
**Effective:** 2026-06-11

Common-law trademark protection in the United States and Canada accrues through **dated commercial use** in connection with the goods or services the mark designates. This file documents — by mark and by channel — the artefacts that establish that use. Each row references an evidence location that can be re-fetched at any time (git SHA, deployed URL, on-disk file, archived screenshot).

When a row is added here, the corresponding chronological entry should also land in `FIRST_USE_LOG.md`.

---

## Channels of first use

| Channel | What it proves | Typical evidence |
|---|---|---|
| **First Website** | Public-facing use of the mark in commerce. | Deployed URL · git SHA of the source · archived screenshot. |
| **First PDF** | Marked branding in a deliverable to a customer or audience. | PDF file on disk · render command · output URL. |
| **First Presentation** | Marked branding in front of an audience. | Slide deck file · date · venue · audience description. |
| **First Blog** | Mark used in editorial content the public can find. | Post URL · git SHA · publication date. |
| **First Social Media** | Mark used in a public broadcast channel. | Permalink · channel · date · audience. |
| **First API** | Mark used in a developer-facing surface. | Endpoint URL · git SHA · response payload containing the mark. |
| **First Git Commit** | Mark embedded in the source of record. | Repo · commit SHA · file path · line range. |
| **First Product** | Mark used as the designation of a shipping product. | Product version · release notes · download URL. |
| **First Demo** | Mark used in a demonstration to a third party. | Date · audience · screen recording or transcript. |
| **First Commercial Use** | Mark used in connection with paid goods or services. | Invoice · contract · transaction record · customer name. |

---

## Per-mark evidence ledger

Rows below are populated as marks accumulate corroborating evidence. The Vault's policy is **add as you discover**, do not retroactively invent.

### Royaltē™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Website | 2026-05 (earliest preserved deployment) | `public/index.html` on `main` | Git history of `public/index.html` |
| First Git Commit | (earliest commit naming `Royaltē` verbatim) | This repository | `git log --all -S "Royaltē"` |
| First PDF | 2026-05-30 (Royaltē Review artist PDF surface) | `lib/audit-report-template.html` / `lib/render-audit-pdf.js` | Brief 014 |
| First Commercial Use | TBD | | |
| First Customer | TBD | | |

### Royaltē Health Engine™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-11 | `api/_lib/health-engine.js` (Phase 7) | `0c10fb4` (Phase 7 code); `ec57481` (full lock) |
| First PR | 2026-06-11 | PR #137 | GitHub PR #137 |

### Royaltē Intelligence Engine™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-11 | `api/_lib/intelligence-engine.js` (Phase 6) | `a23788b`, tag `intelligence-engine-v1.0` |
| First PR | 2026-06-11 | PR #131 | GitHub PR #131 |

### Royaltē Identity Graph™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-10 | `api/_lib/identity-graph.js` (Phase 3) | `bf12b5a` |
| First PR | 2026-06-10 | PR #127 | GitHub PR #127 |

### Royaltē Rule Library™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-11 | `api/rules/*` (Phase 5) | `8907bd6` |
| First PR | 2026-06-11 | PR #130 | GitHub PR #130 |

### Royaltē Canonical Intelligence Object™ · Royaltē Canonical Intelligence Assembly Engine™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-10 | `api/_lib/cio-assembler.js`, `api/schema/cio.js` (Phase 4) | `a3c78d7` |
| First PR | 2026-06-10 | PR #128 | GitHub PR #128 |

### Royaltē Mission Control™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | (earliest commit landing the `mc` family) | `public/dashboard.html` + `public/js/dashboard.js` | Search `git log -- public/dashboard.html` |
| Design Freeze | 2026-06-04 | locked design lineage | Internal memory: `project_royalte_mc_freeze` |

### Royaltē Scan™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Website | 2026-06-10 (V1 Scan Experience freeze) | `public/index.html` Scan section | PR #122 (held open) |

### Royaltē Engineering Stack™ · Royaltē Governance Layer™ · Royaltē Boot Sequence™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Constitution Reference | 2026-06-11 (Constitution v1.3 § 8B) | `constitution/ROYALTE_MASTER_CONSTITUTION.md` § 8B + `docs/ROYALTE_ENGINEERING_STACK.md` | PR #132 (`33edba6`) |
| Governance Layer first PR | 2026-06-11 | PR #133 + PR #134 | `253de6b` |
| Boot Sequence first Reference | 2026-06-09 | `CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION" | Repo root |

### Royaltē Golden Fixture Library™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-11 | `tests/fixtures/*` (Phase 6.5) | `52b1750` |
| First PR | 2026-06-11 | PR #135 | GitHub PR #135 |

### Music Backend Intelligence™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Website | 2026-05-29 (positioning lock) | `public/index.html` headline copy | Internal memory: `project_royalte_positioning` |
| First PDF | 2026-05-30 | Royaltē Review PDF | Brief 014 |

### Publishing Intelligence™

| Channel | Date | Asset / location | Evidence reference |
|---|---|---|---|
| First Git Commit | 2026-06-10 | `lib/publishing/mlc-adapter.js` (Phase 2) | `bca9e68`, tag `mlc-publishing-adapter-v1.0` |
| First PR | 2026-06-10 | PR #126 | GitHub PR #126 |

---

## Marks awaiting first-use evidence

The following PLANNED marks have not yet accumulated a documented first use in any channel above. They are tracked here so the Vault's gaps are visible.

- Se7ven Labs™
- Royaltē Health™ · Royaltē Health Score™
- Royaltē Intelligence™ · Royaltē Intelligence Report™
- Royaltē Executive Brief™
- Royaltē Monitoring™
- Royaltē Revenue Intelligence™
- Royaltē Music Backend Intelligence™
- Royaltē Backend Health™
- Royaltē Audit™ *(originated 2026-05-14 but ledger row pending)*
- Royaltē Executive Runtime™
- Royaltē AI Executive™
- Se7ven Labs AI Operating System™
- Se7ven Labs Executive Runtime™
- Music Backend Health™
- Backend Health™
- Catalog Intelligence™
- Identity Intelligence™
- Revenue Signals™
- Collection Signals™

---

*Owned by Se7ven Labs LLC. Common-law trademark rights depend on documented commercial use; this file is the canonical record of that use.*
