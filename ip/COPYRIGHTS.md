# COPYRIGHTS

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

Register of creative works owned by Se7ven Labs LLC that attract copyright automatically under U.S. and Canadian law, plus the disposition of each (no action · registered · registration in progress). Registration is not required for copyright to exist, but is required to recover statutory damages and attorney's fees in U.S. infringement actions — so the Board may elect to register specific high-value works.

Companion files: `PATENTS.md` (patentable methodologies), `TRADEMARKS.md` (marks), `TRADE_SECRETS.md` (deliberately unpublished know-how).

The columns of each section table are: **Asset · Date · Owner · Registration · Notes**. `Date` is the date of fixation (when the work was first reduced to a tangible medium); `Owner` defaults to `Se7ven Labs LLC` unless explicitly otherwise; `Registration` is the U.S. Copyright Office or CIPO certificate number once issued.

---

## Software

Source code is copyrighted from the moment of fixation. Registration is optional but advisable for the constitutional engines and the assembled platform release.

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Royaltē Publishing Intelligence Adapter™ (`lib/publishing/mlc-adapter.js`) | 2026-06-10 | Se7ven Labs LLC | — | Locked at `bca9e68`, tag `mlc-publishing-adapter-v1.0`. |
| Royaltē Identity Graph™ (`api/_lib/identity-graph.js`) | 2026-06-10 | Se7ven Labs LLC | — | Locked at `bf12b5a`. |
| Royaltē Canonical Intelligence Assembly Engine™ (`api/_lib/cio-assembler.js`, `api/schema/cio.js`) | 2026-06-10 | Se7ven Labs LLC | — | Locked at `a3c78d7`. |
| Royaltē Rule Library™ (`api/rules/*`) | 2026-06-11 | Se7ven Labs LLC | — | Locked at `8907bd6`. |
| Royaltē Intelligence Engine™ (`api/_lib/intelligence-engine.js`, `api/schema/intelligence.js`) | 2026-06-11 | Se7ven Labs LLC | — | Locked at `a23788b`, tag `intelligence-engine-v1.0`. |
| Royaltē Golden Fixture Library™ (`tests/fixtures/*`, `tests/golden-fixture-test.mjs`) | 2026-06-11 | Se7ven Labs LLC | — | Locked at `52b1750`. |
| Royaltē Health Engine™ (`api/_lib/health-engine.js`, `api/schema/health.js`) | 2026-06-11 | Se7ven Labs LLC | — | Locked at `ec57481`. |
| Royaltē Scan™ V1 UI (`public/index.html` Scan section) | 2026-06-10 (design freeze) | Se7ven Labs LLC | — | PR #122 held. |
| Royaltē Mission Control™ V1 UI (`public/dashboard.html`, `public/js/dashboard.js`) | 2026-06-04 (design freeze) | Se7ven Labs LLC | — | |
| Audit pipeline (`api/audit.js`, `api/submit-audit.js`, `api/_lib/*`) | 2026-05-08 onward | Se7ven Labs LLC | — | Canonical AuditResponse schema at `api/schema/auditResponse.js`. |

---

## Algorithms

Algorithmic *expressions* (the specific reduction to code, prose, or pseudocode) are copyrighted. The underlying idea is not — patent or trade-secret protection governs that.

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Royaltē Health Engine™ scoring expression | 2026-06-11 | Se7ven Labs LLC | — | `api/_lib/health-engine.js` (specific weighting, deduction, grade-lookup expression). |
| Royaltē Intelligence Engine™ rule-projection expression | 2026-06-11 | Se7ven Labs LLC | — | `api/_lib/intelligence-engine.js` (severity-rank routing, polarity-positive strengths routing, SHA-prefix observation ID). |
| V2 Health Score expression (`computeV2HealthScore` in `api/_lib/persist-os-scan.js`) | 2026-05-29 | Se7ven Labs LLC | — | Brief 012a. |

---

## Architecture

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Royaltē Engineering Stack™ — seven-layer architecture diagram + companion document | 2026-06-11 | Se7ven Labs LLC | — | `docs/ROYALTE_ENGINEERING_STACK.md` + Constitution v1.3 § 8B. PR #132 (`33edba6`). |
| Royaltē Governance Layer™ — repository governance topology | 2026-06-11 | Se7ven Labs LLC | — | `governance/*`. PR #133 + #134 (`253de6b`). |
| Royaltē Boot Sequence™ — 5-question initialisation procedure | 2026-06-09 | Se7ven Labs LLC | — | `CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION". |

---

## Specifications

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Canonical AuditResponse contract (`api/schema/auditResponse.js`) | 2026-05-08 | Se7ven Labs LLC | — | `AUDIT_RESPONSE_VERSION='1.0.0'`. Mirrored Pydantic model lives in `generate_audit_pdf.py`. |
| Canonical Intelligence Object schema (`api/schema/cio.js`) | 2026-06-10 | Se7ven Labs LLC | — | |
| Intelligence Engine output schema (`api/schema/intelligence.js`) | 2026-06-11 | Se7ven Labs LLC | — | `ENGINE_VERSION='1.0.0'`. |
| Health Engine output schema (`api/schema/health.js`) | 2026-06-11 | Se7ven Labs LLC | — | `HEALTH_VERSION='1.0.0'`. |
| Canonical Payload V2 specification | 2026-06-09 | Se7ven Labs LLC | — | `constitution/CANONICAL_PAYLOAD_V2.md` — 12-object intelligence model. |

---

## Documentation

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Royaltē Master Constitution v1.0 → v1.3 | 2026-06-09 → 2026-06-11 | Se7ven Labs LLC | — | `constitution/ROYALTE_MASTER_CONSTITUTION.md`. Revision history preserved in-document. |
| Royaltē Engineering Stack™ companion doc | 2026-06-11 | Se7ven Labs LLC | — | `docs/ROYALTE_ENGINEERING_STACK.md`. |
| `CLAUDE.md` — operating handbook for AI sessions | 2026-05 onward | Se7ven Labs LLC | — | Repo root. |
| `governance/AGENT_MEMORY.md` | 2026-06-11 | Se7ven Labs LLC | — | |
| `governance/BOARD_DECISIONS.md` | 2026-06-11 | Se7ven Labs LLC | — | Append-only. |
| `governance/CHANGELOG.md` | 2026-06-11 | Se7ven Labs LLC | — | Append-only. |
| `governance/ROADMAP.md` | 2026-06-11 | Se7ven Labs LLC | — | Living. |

---

## Books

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

---

## Articles

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| *(none yet — first long-form articles will land here as published)* | | | | |

---

## Reports

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Royaltē Review (artist PDF) template | 2026-05-30 | Se7ven Labs LLC | — | `lib/audit-report-template.html` + `lib/render-audit-pdf.js`. Brief 014. |
| Royaltē Executive Brief™ format | TBD | Se7ven Labs LLC | — | Locked-format founder-facing briefing (defined in `CLAUDE.md`). |

---

## White Papers

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

---

## Images

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Se7ven Labs logo (popped) — `public/se7ven_labs_popped.png` | (origin) | Se7ven Labs LLC | — | Source image preserved on `main`. |
| Royaltē Orb™ — design freeze 2026-06-10 | 2026-06-10 | Se7ven Labs LLC | — | PR #122. |
| Royaltē Signal Meter™ — design freeze 2026-06-04 | 2026-06-04 | Se7ven Labs LLC | — | Internal memory: `project_royalte_signal_meter_locked`. |

---

## Videos

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

---

## Presentations

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| *(none yet — Board / investor decks will land here as authored)* | | | | |

---

## Brand assets

| Asset | Date | Owner | Registration | Notes |
|---|---|---|---|---|
| Se7ven Labs wordmark | (origin) | Se7ven Labs LLC | — | Capitalisation rule locked in `BRAND_GUIDELINES.md` § 8. |
| Royaltē wordmark | 2026-05 (earliest preserved use) | Se7ven Labs LLC | — | Locked spelling — `Royaltē` with `ē` (U+0113). `BRAND_GUIDELINES.md` § 9.1. |
| Favicon family | (current) | Se7ven Labs LLC | — | `public/favicon*.png`. |
| Email signature template | (current) | Se7ven Labs LLC | — | `BRAND_GUIDELINES.md` § 6. |

---

## Conventions

- Copyright attaches at fixation; this register is the **internal record** of fixation dates, not the registration certificate.
- When registration is filed, append the certificate number to the row; do not edit the date.
- For derived or composite assets (e.g., the Royaltē Review PDF rendered from a template), register both the template and the rendered specimen.
- For third-party assets (open-source libraries, stock photography, licensed fonts), use `OPEN_SOURCE.md` instead — they are not Se7ven Labs copyrights.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
