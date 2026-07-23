# AI Insights™ — Implementation Readiness Assessment

**Status:** Discovery Phase — assessment only, no implementation authorized.
**Requested by:** Executive Board
**Date:** 2026-07-23

---

## Current Readiness

**Not ready for a full rebuild yet, ready for a scoped first phase.** The discovery found no missing *evidence* — every real fact AI Insights™ needs already exists somewhere in the platform. What's missing is wiring and cleanup, not new data acquisition. This puts AI Insights™ in a materially better starting position than Media Intelligence™ was (which needed two new domain assemblers and a CIM extension before any real card could render).

## Outstanding Risks

1. **CimAdapter dependency.** `identityIntelligence`/`publishingIntelligence` reach this page through a component explicitly marked for removal. A rebuild that doesn't migrate to CIM-native reads (`ctx.identity`, `ctx.publishing`) would be building new work on top of infrastructure already scheduled to disappear.
2. **ATHENA™ branding risk.** Any rebuild that keeps the "ATHENA™" hero/orb without either renaming it or wiring the real engine ships the same constitutional overclaim identified in the Boundary Review — this is a real risk to resolve explicitly, not a detail to defer.
3. **Undeclared contract dependency.** `healthReport` is read by the live page but absent from `mc-workspace-context.js`'s `WORKSPACE_CONTRACTS['ai-insights']` optional list. A rebuild should either declare it properly or stop depending on it directly (routing everything through `executiveBrief`/`royalteAI` instead) — shipping a rebuild without resolving this leaves the same silent gap in place.
4. **Three-source overlap.** `royalteAI`, `executiveBrief`, and `healthReport` are all read independently today with meaningfully overlapping content (all three touch risks/opportunities/priority in some form). A rebuild needs a single, coherent synthesis input, not three parallel reads reconciled ad hoc in the rendering code — this is a real design decision, not just a data-wiring task.

## Dependencies

- **Health Engine, Royaltē AI™ Assembler, Executive Brief Engine** — all live, all real, all already correctly evidence-first. No changes needed to any of them for a Phase 1 rebuild.
- **Media Intelligence™, Recording Intelligence™** — real, live domains (Media Intelligence™ shipped this session) but currently unconsumed by AI Insights™. Wiring them in is additive, not blocking — a Phase 1 rebuild can ship without them and add them in a Phase 2, matching the Board's own "8-10 cards, not more" discipline already established for Media Intelligence™.
- **CIM-native migration off CimAdapter** — a real prerequisite for Identity/Publishing data specifically, but bounded and low-risk (the two shapes are already documented as structurally identical).
- **ATHENA™ engine wiring** — explicitly NOT a dependency for a Phase 1 rebuild. Resolving the boundary violation only requires a branding/labeling decision, not the engine itself being connected.

## Estimated Engineering Complexity

| Workstream | Complexity | Reasoning |
|---|---|---|
| Remove fabricated fill content, dead code, duplicate tiles | Low | Deletion + one new synthesis card (Intelligence Coverage Snapshot™), no new data sourcing |
| Migrate off CimAdapter to CIM-native reads | Low-Medium | Two field renames plus verification, following an already-proven pattern from every single-domain workspace |
| Resolve ATHENA™ branding | Low | A labeling/copy decision, not an engineering build |
| Wire Media Intelligence™ / Recording Intelligence™ into the synthesis chain | Medium | Real new consumption paths, though both source domains are already stable and CIM-native |
| Consolidate `royalteAI`/`executiveBrief`/`healthReport` into one coherent input | Medium-High | The one genuine design/engineering question in this whole assessment — requires a real architectural decision, not just wiring |

**Overall: materially lower complexity than Media Intelligence™'s rebuild.** No new domain assembler, no CIM extension, no new PAL evidence acquisition is required for a real, honest Phase 1.

## Implementation Order (recommended, not authorized)

1. Remove fabricated content and dead code (Executive Actions™ fill text, impact-statement templates, orphaned `data-ai-*` writes, unused `catalogIntelligence`/`backendIntelligence`/`monitoringIntelligence` reads).
2. Resolve the two duplicate tiles — remove or replace with Intelligence Coverage Snapshot™.
3. Resolve ATHENA™ branding (rename, pending Board direction from the Boundary Review).
4. Migrate Identity/Publishing reads off CimAdapter to CIM-native.
5. Declare `healthReport` properly in the workspace contract, or eliminate the direct read in favor of routing everything through `executiveBrief`.
6. (Phase 2) Wire in Media Intelligence™ and Recording Intelligence™.
7. (Phase 2 or later, separately authorized) Resolve the three-source synthesis-input design question.

## Recommended Build Strategy

Mirror the Media Intelligence™ process exactly: Evidence Audit (done, this pass) → KPI Discovery (done, this pass) → Executive Board review and card approval → scoped implementation with live-scan validation before merge, exactly as Media Intelligence™ v1.0 shipped. Given the lower complexity here, a single implementation phase covering steps 1–5 above is realistic without needing to split into multiple Board-reviewed sub-phases — but that scoping decision belongs to the Board, not this assessment.
