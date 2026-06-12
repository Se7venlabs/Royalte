# AI MODELS

**Owner:** Se7ven Labs LLC
**Status:** living registry — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

Registry of AI Executives — the named AI agents that operate the Royaltē™ platform under the Royaltē Executive Runtime™. Each executive carries a portfolio, a Constitutional version, a system-prompt version, a set of dependencies, and a set of responsibilities. The registry is the canonical source of truth for **who is operating what** at any given moment.

Companion files: `PRODUCT_REGISTRY.md`, `ARCHITECTURE_DECISIONS.md`, `TRADE_SECRETS.md` (the prompt corpora themselves are trade-secret).

> Executives are AI agents, not human employees. The titles below describe portfolios within the Royaltē Executive Runtime™ — they do not imply employment, agency, or corporate-officer status under any jurisdiction.

---

## Registry

| Name | Purpose | Owner | Version | Prompt Version | Constitution Version | Dependencies | Status | Responsibilities |
|---|---|---|---|---|---|---|---|---|
| **Athena** | Chief Executive Officer / Strategy | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Royaltē Master Constitution · Board Directives · Royaltē Roadmap | OPERATIONAL | Strategic direction; cross-executive sequencing; brief authorship; Board liaison; final-call when executive opinions diverge; product positioning lock (Music Backend Intelligence™). |
| **Hephaestus** | Chief Technology Officer / Architecture | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Royaltē Engineering Stack™ · Royaltē Governance Layer™ · Royaltē Boot Sequence™ | OPERATIONAL | Engineering Stack integrity; phase-lock enforcement; constitutional separation guard (knowledge ≠ execution ≠ scoring ≠ presentation); ADR authorship in `ARCHITECTURE_DECISIONS.md`; provider-isolation enforcement; engine determinism and immutability guarantees. |
| **Celine** | Creative Director | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Royaltē Brand Guidelines · locked UI design freezes | OPERATIONAL | Visual identity; brand tone-of-voice; Royaltē Orb™ + Royaltē Signal Meter™ stewardship; copy tone (trust-tone language); Mission Control / Scan / Review surface aesthetic continuity. |
| **Avery Cole** | Audit Generation | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Audit pipeline (`/api/audit`, `/api/submit-audit`) · Royaltē Review template · canonical AuditResponse | OPERATIONAL | Per-artist Royaltē Audit™ + Royaltē Review generation; PDF authorship; explanation of intelligence in artist-facing language; AUTH_UNAVAILABLE / NOT_FOUND distinction in copy. |
| **Ellie Morgan** | Content & SEO / Public Use | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Royaltē Brand Guidelines · Royaltē positioning lock · public-facing surfaces | OPERATIONAL | Public-facing copy on `public/index.html` and the Royaltē blog; SEO posture; press releases (`PRESS.md`); social-channel voice; defensive-publication authorship when the Board ratifies disclosure. |
| **Victoria Sterling** | Chief Legal Officer / General Counsel / Chief Intellectual Property Strategist | Se7ven Labs LLC | v1.0 | (private) | v1.3 | Royaltē Master Constitution · this Vault (`/ip/`) · `governance/EXECUTIVE_BOARD.md` § 7 | OPERATIONAL | Executive Sponsor of this Vault; constitutional integrity; IP / trademark / patent / copyright / trade-secret strategy; MLC and PRO relationship stewardship; privacy and data-handling review; counsel coordination for filings; final review of any brief that amends the Constitution or affects how Royaltē handles artist data and provider terms. |
| **Marcus Blackwell** | Chief Financial Officer | Se7ven Labs LLC | v1.0 | (private) | v1.3 | `VALUATION.md` · `LICENSING.md` · `INVESTOR_DUE_DILIGENCE.md` · `ACQUISITION_DATA_ROOM.md` | OPERATIONAL | Valuation tracking; pricing and packaging strategy; licensing economics; investor due-diligence stewardship; acquisition data-room maintenance; revenue-side reasoning for Royaltē Revenue Intelligence™ when it ships. |

---

## Operating rules

### Sole sources of truth

- **Athena** is the sole source of truth for *strategic direction* — when executives disagree on direction, Athena calls it (subject to Board override).
- **Hephaestus** is the sole source of truth for *architectural integrity* — every phase merge is gated by Hephaestus's review.
- **Victoria Sterling** is the sole source of truth for *constitutional integrity* and *IP claims* — the Vault and the Constitution travel with Victoria.
- **Marcus Blackwell** is the sole source of truth for *valuation* and *commercial terms* — counterparty pricing is gated by Marcus.

### Versioning

- `Version` increments when the executive's portfolio or operating envelope changes.
- `Prompt Version` increments when the underlying system prompt changes (the prompt corpus itself is registered in `TRADE_SECRETS.md`).
- `Constitution Version` records the Constitution version under which the executive was last reviewed; it advances when the Constitution does.

### Onboarding a new executive

1. Author the executive's portfolio and operating envelope.
2. Add the row at the bottom of this registry.
3. If the executive is a Supporting Executive, also add them to the Ownership Block of `README.md`.
4. If the executive is constitutional (CEO / CTO / CLO / CFO), bump the Master Constitution and record the decision in `governance/BOARD_DECISIONS.md`.

### Decommissioning an executive

- Set `Status` to `RETIRED` and append a row noting the date and reason. Never delete the original row.

---

## Conventions

- One row per executive. Sub-personae or specialised modes are not listed here; they are listed in the executive's prompt corpus.
- `Status` values: `IDENTIFIED` · `IN DEVELOPMENT` · `OPERATIONAL` · `SUSPENDED` · `RETIRED`.
- `Prompt Version` is opaque; the corpus is trade-secret (`TRADE_SECRETS.md` § AI architecture).
- `Constitution Version` tracks the most recent Constitution version under which the executive was reviewed.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
