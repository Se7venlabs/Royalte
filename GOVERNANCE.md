# Royaltē Engineering Governance

**Status:** Permanent. Living document — append new rules; never remove.  
**Authority:** `constitution/ROYALTE_MASTER_CONSTITUTION.md` v1.3  
**Effective:** 2026-06-09 (Constitution v1.3); certification rules added 2026-07-02

---

## Constitutional Priority Chain

> Royaltē OS™ > existing code > previous prompts > convenience.

When any source conflicts with the Master Constitution, the Constitution wins. Flag the conflict and hold work until reconciled.

---

## Session Initialization

Every AI session must:

1. Read `CLAUDE.md` fully
2. Read `constitution/ROYALTE_MASTER_CONSTITUTION.md`
3. Read `governance/AGENT_MEMORY.md` (current platform state)
4. Read `governance/ROADMAP.md` (active phase status)
5. Read `governance/BOARD_DECISIONS.md` (recent Board directives)

No implementation work proceeds until these five are read.

---

## Pre-Implementation Checklist

Before writing any code:

1. Does this feature map to a Canonical Intelligence Object (the 12 ratified §8.2 objects)?
2. Is this a presentation layer only — zero business logic?
3. Does intelligence generate once and consume everywhere?
4. Does this eliminate or avoid duplicate logic?
5. Does this reinforce Music Backend Intelligence™?

If any answer is unclear: **STOP** and consult the Constitution.

---

## Certification Gates (PERMANENT — effective 2026-07-02)

These gates apply to every future merge on the platform:

### Intelligence / Health / RIE changes
Any change to the following requires 100% Board Certification Harness pass before merge:
- `api/_lib/intelligence-engine.js`
- `api/_lib/health-engine.js`
- `api/rules/` (any rule file)
- `lib/rie/index.js` or any RIE assembler
- `api/_lib/backend-intelligence.js`
- `api/_lib/identity-intelligence.js`
- `api/_lib/publishing-intelligence.js`
- `api/_lib/catalog-intelligence.js`
- `api/_lib/health-intelligence.js`
- `api/_lib/executive-brief-engine.js`

Run: `node tests/certification/harness.mjs` → must exit `0`.

### CIM schema changes
Any addition, removal, or rename of a field in the 12 §8.2 CIM objects requires:
1. `tests/certification/suites/04-cim-integrity.mjs` updated to match new schema
2. `CERTIFICATION.md` updated with new field in the relevant section
3. 100% harness pass before merge

### Release tagging
No release tag (`royalte-os-v*.*.x` or any production tag) may be created unless:
- `node tests/certification/harness.mjs` exits `0`
- GitHub CI `Run pipeline test` check is green
- Board explicitly authorizes the tag in a Board directive

---

## Phase PR Governance Protocol (PERMANENT — effective 2026-06-12, Phase 9)

**Phase PRs contain only the brief's deliverable.**

Governance file updates (`AGENT_MEMORY.md`, `ROADMAP.md`, `BOARD_DECISIONS.md`, `CHANGELOG.md`) land in a **post-merge governance backfill PR** after Board ratification. This PR is documentation-only: no runtime code, no API changes, no test behavior changes.

The backfill PR title convention: `Phase X.Y Governance Backfill — [Phase title]`

---

## Commit & Merge Conventions

- **No `Co-Authored-By:` trailer on commits.** Repo-wide convention since 2026-05-13.
- **Merge style:** `gh pr merge <N> --rebase --delete-branch`
- **No direct push to `main`** for any change touching Vercel functions.
- **Branch per Build Pass:** all revisions and fixes stay on the same branch until Board approval and merge. Never open a new branch for a correction within an active pass.
- **One module freeze at a time:** all Mission Control modules frozen unless the Board explicitly opens a Build Pass for a specific module.

---

## Engineering Stack Ownership Rules (Seven Layers)

```
Layer 1: Providers             — External APIs only. No intelligence here.
Layer 2: Normalization         — lib/publishing/*-adapter.js sole owner of field name parsing.
Layer 3: Identity Graph        — api/_lib/identity-graph.js sole owner of artist identity state.
Layer 4: CIO Assembly          — api/_lib/cio-assembler.js sole owner of CIO assembly.
Layer 5: CIO                   — Deep-frozen artifact. No layer may mutate it after assembly.
Layer 6: Rule Library          — api/rules/ sole owner of declarative business knowledge.
Layer 7: Intelligence Engine   — api/_lib/intelligence-engine.js sole executor. Never owns knowledge.
```

Constitutional separations (non-negotiable):
- **Knowledge** belongs in the Rule Library. Never in the engine, never in a renderer.
- **Execution** belongs in the Intelligence Engine. Never in rules, never in assemblers.
- **Presentation** belongs in consumers. Consumers never classify, score, or label.

---

## Scan Engine / Identity Graph Separation (Board Directive — 2026-06-09)

The scan engine **must not own artist identity data.** All artist-specific records live in `api/_lib/identity-graph.js` (Royaltē Identity Graph™). The engine reads from the graph; it never writes to it.

---

## Provider Isolation Rules

- No module outside `lib/publishing/mlc-adapter.js` may read MLC field names directly.
- No module outside a PAL connector may read provider-specific field names from any other provider.
- All future provider adapters land in `lib/publishing/` or `provider-acquisition/connectors/`.

---

## Migration Rules (Board Directive — 2026-07-02)

Every provider migration must:
- Leave the codebase with **less legacy** than before the migration started
- Migrate ownership (from legacy direct call to PAL connector)
- Reduce or eliminate compatibility shims for the migrated provider
- Update `governance/MIGRATION_RETIREMENT_REGISTER.md` after merge

---

## Intelligence Integrity Rules

- `computeHealthScore()` is called exactly once per scan. The canonical result is passed downstream and never re-derived.
- The CIM is deeply frozen on exit from the RIE. No product may mutate it.
- `AUTH_UNAVAILABLE` ≠ `NOT_FOUND` ≠ verified-zero. These three states must never be conflated in the CIM or in any product renderer.
- No renderer may read sub-assembler outputs directly when a CIM path exists for the same data.

---

## Governance File Update Requirement (every Phase merge)

Per Phase 7+ governance rule: every Board-approved merge must trigger updates to:
1. `governance/AGENT_MEMORY.md` § 2 (current build phase)
2. `governance/ROADMAP.md` (tick phase to ✅, record SHA)
3. `governance/BOARD_DECISIONS.md` (append ratification entry)
4. `governance/CHANGELOG.md` (prepend merge entry)

These updates land in the post-merge backfill PR per the Phase PR Governance Protocol above.

---

## Royaltē Spelling

The product name is **Royaltē** — with the macron `ē` (U+0113). The IP Vault `/ip/` uses this spelling throughout. The company name in legal and IP contexts is **Se7ven Labs**. The platform is **Royaltē OS™**.

---

## Vercel Preview Policy (Board Directive — 2026-06-16)

Vercel Preview is the sole UI review surface. No local PNGs, no `/tmp` images, no GitHub raw-image embeds in PR bodies. Ship → push → deliver Vercel Preview URL.
