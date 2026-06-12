# PATENTS

**Owner:** Se7ven Labs LLC
**Status:** **APPEND-ONLY.** Existing entries are never edited or deleted. Corrections are appended as new entries that explicitly supersede the prior one.
**Effective:** 2026-06-11

Register of every invention Se7ven Labs LLC has identified as potentially patentable, plus the disposition of each (no action · provisional · non-provisional · issued · abandoned · maintained as trade secret). Entries are added the moment an inventor *recognises* a candidate invention — well before the disclosure decision is made — so the priority date is preserved internally regardless of the outward filing posture.

Companion files: `PRIOR_ART.md` (the comparable-tech landscape), `DEFENSIVE_PUBLICATIONS.md` (strategic disclosures Se7ven Labs publishes to block third-party claims), `TRADE_SECRETS.md` (inventions Se7ven Labs deliberately keeps unpublished).

---

## Register

| Title | Inventor | Date | Description | Commercial Value | Status | Jurisdiction | Priority Date | Notes |
|---|---|---|---|---|---|---|---|---|
| *(no entries yet — populated as candidate inventions surface)* | | | | | | | | |

---

## Candidate inventions identified by the Royaltē OS™ architecture

The following methodologies were established in code during Phases 2–7 and are *candidates* for patent or defensive-publication review by counsel. They are listed here so the record exists; no filing has been authorised.

| Candidate | First crystallised | Anchor file(s) | Locked at |
|---|---|---|---|
| Provider-isolated normalisation adapter pattern (single-owner rule for provider field-name parsing) | 2026-06-10 | `lib/publishing/mlc-adapter.js` | `bca9e68` (tag `mlc-publishing-adapter-v1.0`) |
| Royaltē Identity Graph™ — multi-provider artist identity reconciliation with deterministic `royalteId` issuance and external-ID maps spanning Apple / Spotify / MusicBrainz / MLC / SOCAN / ASCAP / BMI / CISAC | 2026-06-10 | `api/_lib/identity-graph.js` | `bf12b5a` |
| Canonical Intelligence Object™ assembly — pure deterministic projection of (identity-graph + provider adapters + scan payload) into a deeply-frozen intelligence artefact with explicit reserved sections for future categories | 2026-06-10 | `api/_lib/cio-assembler.js` | `a3c78d7` |
| Declarative Rule Library™ — business knowledge as pure-data `(cio) → boolean` rules with structural validation and category-neutral execution, separating knowledge from execution | 2026-06-11 | `api/rules/*` + `api/rules/index.js` | `8907bd6` |
| Generic Intelligence Engine — category-agnostic rule executor that projects firing rules into observations + risks + opportunities + strengths + coverage with deterministic SHA-256 observation IDs and polarity-driven routing | 2026-06-11 | `api/_lib/intelligence-engine.js` | `a23788b` (tag `intelligence-engine-v1.0`) |
| Royaltē Golden Fixture Library™ regression methodology — immutable, versioned-forward CIO reference fixtures providing canonical regression coverage for the full engineering stack | 2026-06-11 | `tests/fixtures/*` + `tests/golden-fixture-test.mjs` | `52b1750` |
| Royaltē Health Engine™ — deterministic scoring of an Intelligence Report into a 0-100 score + A+/A/B/C/D/F grade with Board-locked category weights, per-severity deduction table, coverage-and-confidence cross-signals, and a deeply-frozen output | 2026-06-11 | `api/_lib/health-engine.js` + `api/schema/health.js` | `ec57481` |
| Royaltē Boot Sequence™ — the five-question pre-implementation initialisation procedure binding every AI session, with Constitutional Priority chain enforced before any implementation work | 2026-06-09 | `CLAUDE.md` § "ROYALTÉ OS™ — SESSION INITIALIZATION" | (operational) |
| Repository-level Governance Layer™ — append-only Board-decision register + changelog with constitutional rule binding every architectural phase merge to a synchronous governance update | 2026-06-11 | `governance/*` + `governance/AGENT_MEMORY.md` § 9 | `253de6b` |

The disposition of each candidate (file as patent · file as defensive publication · maintain as trade secret · no action) is a Board decision and will be recorded as a row in the **Register** above when ratified.

---

## Conventions

- A row is added at the moment of *recognition* — when an engineer, executive, or counsel identifies a methodology as potentially patentable. Priority date is the date of recognition, not the date of filing.
- `Status` values: `IDENTIFIED` · `UNDER REVIEW` · `PROVISIONAL FILED` · `NON-PROVISIONAL FILED` · `ISSUED` · `MAINTAINED` · `ABANDONED` · `RELEASED AS DEFENSIVE PUBLICATION` · `RETAINED AS TRADE SECRET`.
- `Commercial Value` is the inventor's own internal estimate (qualitative — Low / Medium / High / Strategic). Counsel re-estimates at filing time.
- When a candidate moves from IDENTIFIED to any later status, do **not** edit the original row. Append a new row that explicitly cites the row being superseded.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
