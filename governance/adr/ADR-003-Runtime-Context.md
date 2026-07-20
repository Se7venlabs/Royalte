# ADR-003 — Runtime Context Architecture

**Status:** Decision Pending — Board Review Required
**Raised during:** Platform Certification™ Phase 2 (Canonical Schema)
**Related:** ADR-001 (CimAdapter)

## Problem

`royalte_workspace_context` (built by `public/js/runtime-context-mapper.js`) is the sole contract every Mission Control workspace reads through `readWorkspaceContext({ contract })`. Its shape today is a mix of CIM-native (`identity`), CimAdapter-bridged legacy names (8 fields, see ADR-001), and locally-computed client-side normalization (`_normalizeExecutiveBrief`, `_normalizeMonitoring`) — a fourth reshaping layer on top of the server-side pipeline (normalize → CIO → CIM → CimAdapter). Separately from *whether* CimAdapter is retired (ADR-001), there's a broader question: is `royalte_workspace_context`'s current shape — a hand-maintained mapper function performing ad hoc renames and defaults — the right long-term architecture, or should the contract be generated directly and mechanically from the CIM schema so drift like ADR-001's becomes structurally impossible?

## Evidence

- `public/js/runtime-context-mapper.js:1-21` — its own stated contract: "Single authoritative transformation from raw scan payload to `royalte_workspace_context` schema v1.1... Workspaces receive one stable shape — never need to know payload paths."
- `public/js/runtime-context-mapper.js:50,76` — `_normalizeExecutiveBrief`, `_normalizeMonitoring` — real transformation logic living in this client-side layer, not just field renaming.
- 5 of the CIM's 13 §8.2 objects (`opportunities`, `recording`, `scanAuthority`, `metadata`, `revenueSignals`) have no field in `royalte_workspace_context` under any name — confirmed by reading the mapper's full return object this session (`governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md` §4, item 7).

## Architectural Options

**A. Keep the hand-maintained mapper, migrate it to read `cim.*` (ADR-001, Option A/C).**
Least structural change. Still relies on a human keeping the mapper's field list in sync with the CIM schema by convention — the same failure mode that produced ADR-001's drift in the first place, just with a shorter list of places drift can hide.

**B. Generate `royalte_workspace_context` mechanically from `CIM_OBJECTS`.**
A schema-driven mapper that iterates the CIM's own object list rather than naming each field by hand would make "a CIM object exists but isn't exposed to Mission Control" structurally impossible — closing the `opportunities`/`recording`/`scanAuthority`/`metadata` gap by construction, not by discipline. Real design work: deciding a default exposure rule (e.g., every CIM object gets a same-named field unless explicitly excluded) and handling the fields that intentionally need renaming or normalization (`executiveBrief`, `monitoringIntelligence`).

**C. Leave the runtime context layer as a deliberately separate, hand-curated client-side concern.**
Argument for: not every CIM object is meant for a UI surface (`scanAuthority` is provenance metadata, not user-facing). A hand-curated allowlist may be the correct security/product boundary, not a bug. Argument against: today's omissions look accidental, not curated — nothing marks `recording` as "intentionally not exposed yet" versus "forgotten."

## Trade-offs

| | A: Migrate, keep hand-maintained | B: Schema-driven generation | C: Leave hand-curated, document intent |
|---|---|---|---|
| Prevents future silent omissions | No | Yes, structurally | No, but makes omissions explicit |
| Engineering cost | Low (paired with ADR-001) | Medium-High — new generation mechanism | Low — documentation only |
| Fits "not every CIM object belongs in MC" | Awkwardly | Needs an explicit exclusion mechanism | Naturally |

## Recommendation

Sequence this after ADR-001, not instead of it — resolving *which* fields the mapper sources from `cim.*` is a prerequisite to deciding *how* the mapper should be structured. Once ADR-001 lands, Option C (explicit allowlist with stated inclusion/exclusion reasoning) is the lowest-risk way to close the `recording`/`opportunities`/`scanAuthority`/`metadata` visibility gap without a new generation mechanism — but Option B is worth real consideration if more CIM objects are added over time and this class of drift recurs.

## Consequences

- **If B:** introduces a new, generated-code-adjacent mechanism into a codebase that has otherwise favored hand-written, explicitly-commented transformation functions throughout (`normalizeAuditResponse.js`, `EvidenceBridge.js`, `cio-assembler.js` all follow this style) — a real stylistic and maintainability shift worth the Board weighing explicitly, not just a technical one.
- **If C:** requires deciding, object by object, whether `opportunities`/`recording`/`scanAuthority`/`metadata` are "not yet built" or "deliberately internal" — a product decision this ADR does not have enough evidence to make on its own.

## Migration Strategy

- Cannot start meaningfully before ADR-001 resolves (see Dependencies) — the mapper's CimAdapter-sourced fields would need to move first regardless of which option is chosen here.
- **Option C** once unblocked: audit each of the 5 currently-unexposed CIM objects, add an explicit field (or an explicit "intentionally not exposed" comment) for each, update `tests/runtime-context-mapper.test.mjs` to assert on the decision either way.
- **Option B** once unblocked: design the generation mechanism, prototype against 2-3 CIM objects, verify output is identical to the hand-written mapper for those fields before cutting over the rest.

## Rollback Considerations

- Same as ADR-001: no persisted-data concern, `royalte_workspace_context` is rebuilt fresh per scan, so any rollback is a code revert with no backfill.

## Dependencies

- **Blocked by ADR-001** — cannot be meaningfully resolved until CimAdapter's fate is decided, since that determines what the mapper is actually sourcing fields from.

## Board Decision

*Pending.*

## Final Resolution

*Pending.*
