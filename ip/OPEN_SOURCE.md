# OPEN SOURCE

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

The open-vs-closed posture of every Se7ven Labs LLC asset. Each row records what the asset is, whether it is open source or closed source, the license under which it is distributed (if open), the reason for the posture, and any notes that contextualise the choice.

The register has two purposes:

1. **Strategic clarity** — at any moment, the Board can answer "which of our assets are open, which are closed, and why?" without rediscovering the question.
2. **Acquirer-readiness** — `ACQUISITION_DATA_ROOM.md` § 12 references this file; an acquirer expects to find an unambiguous answer.

The Vault distinguishes:

- **Closed Source Assets** — the Se7ven Labs LLC platform IP: engines, schemas, rule libraries, identity graph, governance, constitution, brand. Default posture: **closed**.
- **Open Source Assets** — assets the Board has explicitly designated as open (e.g., a public defensive publication, a developer tool, an example client).
- **Open Source Used** — third-party open-source dependencies the platform consumes (not the same as Se7ven Labs assets being open).

---

## Closed Source Assets

The platform's core IP. Default posture for everything in `api/_lib/*`, `api/schema/*`, `api/rules/*`, `api/_lib/identity-graph.js`, `lib/publishing/*`, `tests/fixtures/*`, the Constitution, the Governance Layer, the AI Executive prompt corpora, the Royaltē Review template, the locked UI surfaces, and this Vault.

| Asset | Status | License | Reason | Notes |
|---|---|---|---|---|
| Royaltē Publishing Intelligence Adapter™ (`lib/publishing/mlc-adapter.js`) | CLOSED | proprietary — Se7ven Labs LLC | Core provider-isolation IP. | Tag `mlc-publishing-adapter-v1.0`. |
| Royaltē Identity Graph™ (`api/_lib/identity-graph.js`) | CLOSED | proprietary — Se7ven Labs LLC | Strategic data + methodology asset. | `bf12b5a`. |
| Royaltē Canonical Intelligence Assembly Engine™ (`api/_lib/cio-assembler.js` + `api/schema/cio.js`) | CLOSED | proprietary — Se7ven Labs LLC | Core constitutional layer. | `a3c78d7`. |
| Royaltē Rule Library™ (`api/rules/*`) | CLOSED | proprietary — Se7ven Labs LLC | Core competitive advantage. | `8907bd6` + amendment at `52b1750`. |
| Royaltē Intelligence Engine™ (`api/_lib/intelligence-engine.js` + `api/schema/intelligence.js`) | CLOSED | proprietary — Se7ven Labs LLC | Core constitutional layer. | Tag `intelligence-engine-v1.0`. |
| Royaltē Golden Fixture Library™ (`tests/fixtures/*` + `tests/golden-fixture-test.mjs`) | CLOSED | proprietary — Se7ven Labs LLC | Encodes reference intelligence; would help competitors replicate. | `52b1750`. |
| Royaltē Health Engine™ (`api/_lib/health-engine.js` + `api/schema/health.js`) | CLOSED | proprietary — Se7ven Labs LLC | Board-locked weighting + grade bands are competitive IP. | `ec57481`. |
| Royaltē Scan™ V1 UI (`public/index.html` Scan section) | CLOSED | proprietary — Se7ven Labs LLC | Locked design freeze. | PR #122. |
| Royaltē Mission Control™ V1 (`public/dashboard.html` + `public/js/dashboard.js`) | CLOSED | proprietary — Se7ven Labs LLC | Locked design freeze. | 2026-06-04. |
| Royaltē Review template (`lib/audit-report-template.html` + `lib/render-audit-pdf.js`) | CLOSED | proprietary — Se7ven Labs LLC | Brand-critical deliverable. | Brief 014. |
| Royaltē Master Constitution (`constitution/ROYALTE_MASTER_CONSTITUTION.md`) | CLOSED | proprietary — Se7ven Labs LLC | Supreme governing document. | v1.3. |
| Canonical Payload V2 (`constitution/CANONICAL_PAYLOAD_V2.md`) | CLOSED | proprietary — Se7ven Labs LLC | Canonical wire format; defines product surface. | 2026-06-09. |
| Royaltē Engineering Stack™ companion (`docs/ROYALTE_ENGINEERING_STACK.md`) | CLOSED | proprietary — Se7ven Labs LLC | Companion to Constitution § 8B. | PR #132. |
| Royaltē Governance Layer™ (`governance/*`) | CLOSED | proprietary — Se7ven Labs LLC | Institutional memory + governance rules. | `253de6b`. |
| Royaltē Boot Sequence™ (`CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION") | CLOSED | proprietary — Se7ven Labs LLC | Operational procedure. | 2026-06-09. |
| Se7ven Labs Intellectual Property Vault™ (this `/ip/` directory) | CLOSED | proprietary — Se7ven Labs LLC | Internal corporate record. | Phase 7.5. |
| AI Executive prompt corpora | CLOSED | proprietary — Se7ven Labs LLC · trade secret | Operating IP for the Royaltē Executive Runtime™. | Registered as trade secret in `TRADE_SECRETS.md` § AI architecture. |
| Brand assets (Royaltē™ wordmark · Royaltē Orb™ · Royaltē Signal Meter™ · Se7ven Labs logo) | CLOSED | proprietary — Se7ven Labs LLC | Brand IP. | `BRAND_GUIDELINES.md`. |

---

## Open Source Assets

Assets the Board has explicitly designated as open. **None currently designated.**

| Asset | Status | License | Reason | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

**Candidate disclosures** (registered in `DEFENSIVE_PUBLICATIONS.md`) may transition into this section if the Board ratifies them. Typical candidates:

- Public abstraction of the Constitutional Separation pattern (defensive publication).
- Public abstraction of the Append-only Governance Layer pattern (defensive publication).
- Public abstraction of the Royaltē Boot Sequence™ (defensive publication).
- Public abstraction of the Golden-Fixture regression methodology (defensive publication).

When ratified, the entry moves from "candidate" to a populated row above with date, license, and URL.

---

## Open Source Used (third-party dependencies)

Open-source dependencies the platform consumes. Counsel + the Architecture executive monitor license compatibility; the comprehensive dependency list lives in `package.json` (Node) and the Python script header (Pydantic + reportlab).

| Dependency family | License | Use |
|---|---|---|
| Node.js runtime + npm ecosystem | open-source (MIT and others) | Vercel function execution. |
| Python 3 + Pydantic + WeasyPrint family | open-source (MIT / BSD / LGPL) | `generate_audit_pdf.py` schema mirror + PDF rendering. |
| Supabase JS client | Apache-2.0 | Persistence calls. |
| Resend (email API) client | (vendor; embedded in npm package) | Email delivery. |
| (other npm deps) | per-package licensing | Listed in `package.json`; license-check on every dependency bump. |

> Routine license-compatibility review is performed at every dependency bump. Any dependency under a copyleft license (e.g., AGPL) is reviewed by counsel before adoption.

---

## Policy

- **Default closed.** Every new asset created by Se7ven Labs LLC is closed-source by default.
- **Opening an asset requires Board ratification.** The decision is recorded in `governance/BOARD_DECISIONS.md` and the row in this file is updated to reflect the new posture.
- **Defensive publications** are a deliberate exception: the public disclosure trades the right to patent for the prior-art benefit (see `DEFENSIVE_PUBLICATIONS.md`).
- **Trade-secret assets are never open-sourced.** A trade-secret entry in `TRADE_SECRETS.md` cannot move directly to OPEN; the entry must first be superseded by a row in `PATENTS.md` or `DEFENSIVE_PUBLICATIONS.md`, and only then may the asset move to OPEN.

---

## Conventions

- One row per asset.
- `Status` values: `CLOSED` · `OPEN` · `DUAL` (rare — closed core + open client/example) · `RETIRED`.
- `License` for closed assets is `proprietary — Se7ven Labs LLC`. For open assets it is the SPDX identifier (e.g., `MIT`, `Apache-2.0`, `CC-BY-4.0`).
- Rows are **never edited** when the posture changes; append a superseding row that cites the disposition.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
