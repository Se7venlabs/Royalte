# INVESTOR DUE DILIGENCE

**Owner:** Se7ven Labs LLC
**Status:** master investor summary — refreshed on demand for each diligence cycle.
**Effective:** 2026-06-11

Single-document investor summary. When a prospective investor opens diligence, this file is the entry point — every other Vault file is referenced from here, so the investor can dive into the specific register they want without re-collecting context.

> This file is **prepared for investors**. It uses plain-language summaries rather than the internal jargon used elsewhere in the Vault. Numerical fields without operational data carry "TBD"; the Vault never fabricates metrics.

---

## 1. Corporate

| | |
|---|---|
| Legal name | Se7ven Labs LLC |
| Founded | (private — held by counsel) |
| Headquarters | (private — held by counsel) |
| Jurisdiction | (private — held by counsel) |
| Cap table | Founder-held to date. No outside investment closed yet. |
| Counsel of record | (private — held by counsel) |
| Auditor of record | (private — held by counsel) |

Detailed corporate documents (formation, operating agreement, cap table) live in counsel's records; this file does not duplicate them.

---

## 2. Intellectual property

### 2.1 Trademark posture

- **0** registered marks · **0** pending applications · **36** PLANNED marks. Full register: `TRADEMARKS.md`.
- Strongest common-law assertions: **Royaltē™**, **Royaltē Mission Control™**, **Royaltē Audit™**, **Music Backend Intelligence™**.
- Anticipated priority order for filing: house mark (Se7ven Labs™) → primary product mark (Royaltē™) → category mark (Music Backend Intelligence™) → engineering-tier marks.

### 2.2 Patent posture

- **0** issued patents · **0** pending applications.
- **9** patent candidates identified across the locked Phases 2 – 7 architecture. Full list: `PATENTS.md` § Candidates.
- Counsel's prior-art analysis: `PRIOR_ART.md`.
- Strategic posture: a mix of filings, defensive publications (`DEFENSIVE_PUBLICATIONS.md`), and trade-secret retention (`TRADE_SECRETS.md`).

### 2.3 Copyright posture

- Copyright attaches at fixation; the full register is in `COPYRIGHTS.md`.
- Registration of the locked engines and the Master Constitution is on the Board's agenda; no registrations filed yet.

### 2.4 Trade-secret posture

- Multiple methodology categories maintained as trade secret — health weighting calibration, identity matching heuristics, AI Executive Runtime topology + prompt corpora. Full register: `TRADE_SECRETS.md`.
- Protection methods: repository access control · NDA on engagement · compartmentalisation · no publication · code-comment discipline.

---

## 3. Products

The full register is in `PRODUCT_REGISTRY.md`. Summary:

### 3.1 Engineering Stack (locked)

The Royaltē™ platform is built on the **Royaltē Engineering Stack™** — a seven-layer architecture canonicalised in the Master Constitution § 8B:

| Layer | Product | Lock |
|---|---|---|
| 2 | Royaltē Publishing Intelligence Adapter™ | `mlc-publishing-adapter-v1.0` (`bca9e68`) |
| 3 | Royaltē Identity Graph™ | `bf12b5a` |
| 4 | Royaltē Canonical Intelligence Assembly Engine™ | `a3c78d7` |
| 5 | Royaltē Rule Library™ | `8907bd6` + Phase 6.5 amendment |
| 6 | Royaltē Intelligence Engine™ | `intelligence-engine-v1.0` (`a23788b`) |
| 6.5 | Royaltē Golden Fixture Library™ | `52b1750` |
| 7 | Royaltē Health Engine™ | `ec57481` |

### 3.2 Consumer surfaces (locked)

- **Royaltē Scan™** V1 (design frozen; PR #122 held).
- **Royaltē Mission Control™** V1 (design frozen 2026-06-04).
- **Royaltē Signal Meter™** (design locked 2026-06-04).
- **Royaltē Review** (artist-emailed PDF; Brief 014).
- **Royaltē Audit™** V1 display (scoring locked 2026-05-14, PR #24).
- **Royaltē Executive Brief™** (format locked).

### 3.3 Platform services (operational)

- `/api/audit` (synchronous audit engine).
- `/api/submit-audit` (customer-facing email + PDF delivery).
- Rate-limit + abuse defence (Supabase-backed atomic RPC).

### 3.4 Reserved future surfaces

- Royaltē Monitoring™ (subscriber-gated).
- Royaltē Revenue Intelligence™ (Phase reserved).

---

## 4. Architecture

- **Royaltē Master Constitution v1.3** — supreme governing document. Sections 1 – 8B + companion `docs/ROYALTE_ENGINEERING_STACK.md`.
- **Royaltē Governance Layer™** — append-only `/governance/` directory; constitutional rule § 9 binds every phase merge to a synchronous governance update.
- **Royaltē Boot Sequence™** — 5-question pre-implementation initialisation procedure binding every AI session.
- **Constitutional separation** (knowledge ≠ execution ≠ scoring ≠ presentation) is the platform's most defended architectural invariant.
- See `ARCHITECTURE_DECISIONS.md` for the full ADR log.

---

## 5. Ownership

- Founder: **Darryl West** (100% to date).
- Executive Board: 7 AI Executives operating under the Royaltē Executive Runtime™ + `governance/EXECUTIVE_BOARD.md` (see `AI_MODELS.md`).
- No outside equity holders.

---

## 6. Algorithms

The locked algorithms are the platform's core IP:

- **Royaltē Identity Graph™** — multi-provider artist / composition / recording reconciliation.
- **Royaltē Canonical Intelligence Object™** + **Assembly Engine™** — deeply-frozen assembled intelligence.
- **Royaltē Rule Library™** + **Royaltē Intelligence Engine™** — declarative business knowledge + generic deterministic execution.
- **Royaltē Health Engine™** — Board-locked weights + grade bands → 0-100 + A+/A/B/C/D/F.
- **V2 Health Score** — raw-signal scoring at scan persist time (Brief 012a).

---

## 7. Licensing

The full register is in `LICENSING.md`. 6 surfaces identified as licensable across API · SDK · OEM · Enterprise · White Label · Subscription. No licenses offered, executed, or invoiced to date.

---

## 8. Patents

Patent candidates identified across the locked Phases 2 – 7 — full list in `PATENTS.md`. No filings issued, pending, or abandoned yet.

---

## 9. Trademarks

Full register: `TRADEMARKS.md`. 36 PLANNED marks; 0 registered; 0 pending. Common-law claims documented in `TRADEMARK_USAGE.md` and `FIRST_USE_LOG.md`.

---

## 10. Financial

- Revenue: $0 (pre-launch).
- MRR: $0 · ARR: $0.
- Cash position / burn / runway: held by CFO outside the Vault.
- No outside investment closed yet.

The CFO maintains a live financial pack outside this Vault; investor diligence cycles receive the live pack on request.

---

## 11. Strategic assets

- **Reconciled Identity Graph** — strategic data asset; grows with every scan.
- **Royaltē Review longitudinal corpus** — strategic observational dataset.
- **Constitutional architecture** — defensible IP; potential for defensive publications + selective patent filings.
- **Royaltē Executive Runtime™ + AI Executives** — generalisable beyond Royaltē to additional Se7ven Labs products.
- **Domain portfolio** — see `DOMAIN_REGISTRY.md`.
- **Brand assets** — Royaltē™ wordmark · Royaltē Orb™ · Royaltē Signal Meter™ · Se7ven Labs logo.

---

## Reading list for the investor

Recommended order of file reads after this summary:

1. `PRODUCT_REGISTRY.md` — what exists.
2. `IP_ROADMAP.md` — where it's going.
3. `ARCHITECTURE_DECISIONS.md` — why it's shaped the way it is.
4. `LICENSING.md` — how it generates revenue.
5. `VALUATION.md` (restricted access) — how the CFO frames value.
6. `COMPETITOR_ANALYSIS.md` — landscape.
7. `TRADEMARKS.md`, `PATENTS.md`, `COPYRIGHTS.md`, `TRADE_SECRETS.md` — IP detail.

---

*Owned by Se7ven Labs LLC. Internal corporate record; prepared for investor diligence. Not a legal filing.*
