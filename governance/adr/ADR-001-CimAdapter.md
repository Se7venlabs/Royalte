# ADR-001 — CimAdapter's Constitutional Status

**Status:** Decision Pending — Board Review Required
**Raised during:** Platform Certification™ Phase 2 (Canonical Schema), Platform Recovery Phase 1 (Foundation Recovery)
**Related:** ADR-003 (Runtime Context Architecture)

## Problem

`lib/rie/CimAdapter.js`'s own header declares it "MIGRATION INFRASTRUCTURE — REMOVE AFTER PRODUCT MIGRATION... No future intelligence functionality may depend upon CimAdapter." In practice, `public/js/runtime-context-mapper.js` — the module that builds `royalte_workspace_context`, the only shape Mission Control workspaces ever read — sources 8 of its 9 intelligence-domain fields (`identityIntelligence`, `publishingIntelligence`, `catalogIntelligence`, `backendIntelligence`, `globalMusicFootprint`, `healthIntelligence`, `healthReport`, `royalteAI`) from CimAdapter's bridged output, not from `cim.*` directly. Only `identity` reads `payload.cim.identity` natively. The full `cim` object is never attached to `royalte_workspace_context` at all.

Every piece of code that says "this is temporary" is, today, load-bearing.

## Evidence

- `lib/rie/CimAdapter.js:2,11,28` — self-declared temporary, explicit removal directive, explicit prohibition on new dependencies.
- `lib/rie/CimAdapter.js:47` — states its own migration target: "Phase 3.2 (Mission Control) reads from cim directly."
- `public/js/runtime-context-mapper.js:112-159` — the full `buildWorkspaceRuntimeContext()` return object, read in full this session; confirmed no `cim:` key exists in it.
- `governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md` §4, item 6 — the certification finding this ADR formalizes.

## Architectural Options

**A. Retire CimAdapter — migrate `runtime-context-mapper.js` to read `cim.*` natively.**
Resolves the drift for real; matches the code's own stated intent. Requires rewriting the 8 field-sourcing lines in the mapper and re-verifying every Mission Control workspace still renders correctly (all 9 workspaces, per `governance/MISSION_CONTROL_CONSTITUTIONAL_ARCHITECTURE.md`). Real blast radius: this is the live client-side data contract every artist's Mission Control session depends on.

**B. Declare CimAdapter permanent constitutional infrastructure.**
Update its header from "REMOVE AFTER PRODUCT MIGRATION" to a permanent designation. Zero runtime risk — no behavior changes. Leaves a translation hop in the architecture indefinitely, and leaves the CIM's per-object shape effectively private to the server side, since nothing client-side reads it directly except `identity`.

**C. Hybrid — retire CimAdapter incrementally, one domain at a time.**
Migrate one field (e.g. `identityIntelligence`, since `identity` already proves the native path works) per Build Pass, verifying each workspace individually before moving to the next. Lowest risk per step, longest total timeline, requires sustained multi-phase discipline.

## Trade-offs

| | A: Retire now | B: Make permanent | C: Incremental |
|---|---|---|---|
| Resolves the drift | Fully | No — codifies it | Fully, eventually |
| Blast radius per change | High (all 8 fields at once) | None | Low per step |
| Engineering cost | One large Build Pass | One doc edit | Many small Build Passes |
| Matches existing code intent | Yes | No — reverses stated intent | Yes |

## Recommendation

Option C. The `identity` field is already proof that native `cim.*` reads work correctly end-to-end for at least one domain — extending that pattern field-by-field is lower-risk than a single large migration and doesn't require reversing the constitutional intent already written into the code. Option B should only be chosen if the Board decides the migration is not worth the engineering cost at all, in which case the header comment itself becomes the actual lie to fix.

## Consequences

- **If A or C:** every Mission Control workspace must be re-verified against real scan data after its fields move to native `cim.*` reads — a rendering regression here is user-visible, not just a test failure.
- **If B:** the codebase permanently contains a documented contradiction (a module whose own header says "temporary" while being declared permanent) unless that header is also rewritten — cheap, but easy to forget as a follow-up.
- Either way, `governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md`'s "Mission Control Compatibility" rating (currently 🔴) should be re-scored once this ADR resolves.

## Migration Strategy

- **Option A:** single Build Pass — rewrite all 8 field-sourcing lines in `runtime-context-mapper.js` together, run `tests/runtime-context-mapper.test.mjs` plus a manual pass through all 9 Mission Control workspaces against a real scan payload before merge.
- **Option C:** one field per Build Pass, in ascending risk order — suggest starting with `royalteAI` or `catalogIntelligence` (lower workspace complexity) before `healthIntelligence` (feeds the most surfaces). Each step re-runs the same verification as A but scoped to one workspace.
- **Option B:** single documentation edit to `CimAdapter.js`'s header comment; no test surface affected.

## Rollback Considerations

- Options A/C are git-revertible per commit; because `royalte_workspace_context` is rebuilt fresh on every scan (never migrated in the database), there is no persisted-data rollback concern — reverting the code reverts behavior on the next scan with no backfill needed.
- Option B's rollback is trivial (revert the comment) but has no behavioral effect to roll back in the first place.

## Dependencies

- Blocks / is related to ADR-003 (Runtime Context Architecture) — that ADR's options assume ADR-001 has already been decided.
- No dependency on ADR-002 or ADR-004 — independent decisions.

## Board Decision

*Pending.*

## Final Resolution

*Pending.*
