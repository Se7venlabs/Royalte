# ADR-002 — CIO Scope vs. the 4 Domain Assemblers That Bypass It

**Status:** Partially Resolved — Option 3 (sibling evidence object) adopted and implemented for 3 of 4 assemblers; Recording Intelligence remains open.
**Raised during:** Platform Certification™ Phase 1 (Normalization Layer), Phase 2 (Canonical Schema)
**Updated:** 2026-07-21, Normalization Layer Completion audit — this file was found stale (still read "Decision Pending" after the resolution below had already merged); corrected to match `lib/rie/index.js`'s own current violation-list comments, the actual source of truth.

## Problem

Four domain assemblers — Catalog Intelligence, Global Music Footprint, Backend Intelligence, and Recording Intelligence — read `canonicalForEnrichment` (pre-CIO, semi-normalized data) directly instead of reading the CIO, the object specifically designed to be the one thing "Consumers never bypass" (`api/_lib/cio-assembler.js:14`). Three of the four are self-documented in `lib/rie/index.js` as "Known Phase 3 violations, carried forward intentionally." The root cause: the CIO was deliberately locked lean at Phase 4 (identity / publishing-summary / catalog-summary / metadata / sources only) and was never expanded when these four domains were built afterward — they reach around it because it literally doesn't carry what they need (full catalog listings, territory data, verification detail, track-level ISRC data).

## Evidence

- `lib/rie/index.js:52-59` (as amended this session, Platform Recovery Phase 1 Item D) — the violation list, now including Recording Intelligence.
- `api/_lib/backend-intelligence.js:18,183` — confirmed live: `assembleBackendIntelligence(canonical, publishingIntelligence)` reads `canonical.platforms.musicbrainz.availability` directly, no `cio` parameter at all.
- `api/schema/cio.js:225-239` — the CIO's `catalog` section: `releasesCount`, `catalogAgeYears`, `catalogConfidence` only. No release list, no per-track data, no territory data, no verification-service data.
- `governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md` §7, §8 (N4) and `governance/CANONICAL_SCHEMA_CIO_CIM_PLATFORM_CERTIFICATION.md` §7 — the certification findings this ADR formalizes.

## Architectural Options

**A. Expand the CIO to actually carry what these 4 domains need.**
Makes the "consumers never bypass the CIO" rule true again. Real schema-design work: deciding what belongs in a genuinely-summarizing CIO versus what stays domain-specific evidence. Risk of the CIO becoming a second copy of `canonicalForEnrichment` if scope isn't disciplined — defeats its own stated purpose ("SUMMARISING — never duplicating," `cio-assembler.js:24`).

**B. Formally revise the constitutional rule.**
Acknowledge that some domain assemblers legitimately need broader evidence than a lean CIO can carry, and define a second, explicit contract (e.g., a "Domain Evidence" pass-through) that isn't the CIO but is equally constitutional — rather than calling it a "violation" indefinitely. Cheaper than A; risks normalizing the exact bypass pattern the CIO was built to prevent.

**C. Leave as-is, keep documenting.**
Zero engineering cost. The four assemblers keep working exactly as today. The CIO's stated invariant remains false in practice for 4 of 9 domains, indefinitely.

## Trade-offs

| | A: Expand CIO | B: Revise the rule | C: Leave as-is |
|---|---|---|---|
| CIO's "single source of truth" claim | Becomes true | Becomes explicitly qualified | Stays false in practice |
| Engineering cost | High — real schema design | Medium — governance + one new contract | None |
| Risk of scope creep | CIO could bloat into a second canonicalForEnrichment | Low | None |
| Affects | 4 domain assemblers + CIO schema + tests | Governance docs + 1 new contract definition | Nothing |

## Recommendation

No recommendation given without a decision on what Catalog/GlobalFootprint/Backend/Recording actually need long-term — that's product and architecture judgment, not something this evidence alone resolves. Flagging Option B as worth serious consideration: the CIO's "no duplication" rule (`cio-assembler.js:24`) suggests these 4 domains were never meant to fit inside it, which would make the current "violation" framing a mislabeling rather than a defect.

## Consequences

- **If A:** every field added to the CIO is a permanent, versioned, constitutional commitment (`CIO_VERSION` bump per ADR's own governance policy) — raises the bar for what "summarizing, not duplicating" means in practice.
- **If B:** a new contract type needs its own schema file, versioning policy, and validation function (mirroring `cio.js`/`validateCio()`), which is real design surface, not just a relabeling exercise.
- **If C:** `governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md`'s N4 finding stays open indefinitely, and each future certification phase touching Catalog/GlobalFootprint/Backend/Recording inherits the same caveat.

## Migration Strategy

- **Option A:** requires a field-by-field audit of what each of the 4 assemblers actually reads from `canonicalForEnrichment` today (not fully enumerated in this ADR), then extending `emptyCio()`/`assembleCio()` to carry it, then migrating each assembler's signature one at a time — likely 4 separate Build Passes given the CIO/CIM regression surface.
- **Option B:** define the new contract shape, get it Board-ratified as its own schema file, then repoint the 4 assemblers to it instead of `canonicalForEnrichment` — a smaller diff than A per assembler, but requires the new contract to exist first.
- **Option C:** no migration — status quo.

## Rollback Considerations

- Both A and B change function signatures for 4 live domain assemblers called inside `runRIE()` — any rollback must revert the assembler signature and the `lib/rie/index.js` call site together, or the pipeline throws. Recommend pairing each assembler's migration with its own revert-tested commit rather than one combined commit for all 4.
- No persisted-data concern (same reasoning as ADR-001 — CIM is rebuilt fresh per scan).

## Dependencies

- Independent of ADR-001, ADR-003, ADR-004 — no blocking relationship in either direction, though resolving this ADR would likely change what `royalte_workspace_context` needs to expose (soft link to ADR-003).

## Board Decision

**Option 3 adopted** (Phase 2 Recovery, 2026-07-20 — a variant not originally enumerated above as A/B/C, discovered during implementation and Board-ratified in the moment): sibling canonical evidence objects, one per domain, each a pure structural relocation of already-normalized fields out of `canonicalForEnrichment` into a domain-scoped shape — not merged into the CIO (avoids Option A's bloat risk), not a single shared "Domain Evidence" contract (avoids Option B's need to design one generalized shape up front). Each sibling object is independently versioned by convention (one file, one assembler, one call site), holds zero business logic, and is deep-frozen. This is effectively Option B implemented incrementally, per-domain, without first designing a single shared contract — the generalization Option B envisioned may still be worth doing later if a fourth or fifth sibling object reveals a common shape, but was not a prerequisite for closing the 3 resolved instances below.

## Final Resolution

**Resolved for 3 of 4 assemblers**, verified live in `lib/rie/index.js` (see comments at lines 61-86 as of this update):

- **Catalog Intelligence** — now reads `api/_lib/catalog-evidence.js`'s `assembleCatalogEvidence(canonicalForEnrichment)` output instead of `canonicalForEnrichment` directly. (PR merging Catalog Intelligence recovery, 2026-07-20.)
- **Backend Intelligence** — now reads `api/_lib/backend-evidence.js`'s `assembleBackendEvidence(canonicalForEnrichment)` output. (PR merging Backend Intelligence recovery, 2026-07-20.)
- **Global Music Footprint** — now reads `api/_lib/global-footprint-evidence.js`'s `assembleGlobalFootprintEvidence(canonicalForEnrichment)` output. Its other evidence input, `territoryIntelligence`, was never part of this bypass — unchanged, reads raw `evidencePackages` by separate, deliberate Board design since Phase 5.2. (PR #383, merged 2026-07-21.)

**Still open — Recording Intelligence.** `lib/recording/recording-intelligence.js`, called from `lib/rie/index.js`, still receives `canonicalForEnrichment` directly — the one remaining instance of the pattern this ADR addresses. It was added later (Phase 3.7) than the original 3 findings and was not in scope for the 2026-07-20 Recovery Program's target list. **Recommended correction:** apply the identical Option-3 sibling-evidence-object pattern (a `recording-evidence.js`, mirroring `catalog-evidence.js`) — same shape of fix, same low risk, already proven 3 times over in this exact codebase. **Not implemented as part of the 2026-07-21 Normalization Layer Completion audit**, because that audit's Board brief explicitly listed "no new canonical objects" among its non-goals; a 4th sibling evidence object, even following established precedent, was judged to need its own explicit Board go-ahead rather than being folded in unilaterally. Estimated scope: small — one new ~80-100 line file (matching `backend-evidence.js`'s size) plus a one-parameter signature change to `assembleRecordingIntelligence` and its call site in `lib/rie/index.js`.
