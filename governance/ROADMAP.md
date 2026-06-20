# Royaltē Platform Roadmap

**Status:** single source of truth for platform progress.
**Authority:** subordinate to `constitution/ROYALTE_MASTER_CONSTITUTION.md`.
**Updated:** after every Board-approved merge (per governance rule, see `AGENT_MEMORY.md` § 9).

When this roadmap and the Constitution disagree, **the Constitution wins.**

---

## Active Build — Intelligence-Wiring Sprint

### Phase Status

| Phase | Title | Status | Locked at | Tag |
|---|---|---|---|---|
| 1 | MLC Public API Connectivity | ✅ Complete | (probe endpoint live) | — |
| 2 | Publishing Intelligence Adapter™ | ✅ Complete | `bca9e68` | `mlc-publishing-adapter-v1.0` |
| 3 | Royaltē Identity Graph™ | ✅ Complete | `bf12b5a` | — |
| 4 | Canonical Intelligence Assembly Engine™ | ✅ Complete | `a3c78d7` | — |
| 5 | Royaltē Rule Library™ | ✅ Complete | `8907bd6` | — |
| 6 | Royaltē Intelligence Engine™ | ✅ Complete | `a23788b` | `intelligence-engine-v1.0` |
| 6.5 | Royaltē Golden Fixture Library™ + Phase 5 polarity amendment | ✅ Complete | `52b1750` | — |
| 6C | Canonical Catalog Model™ Composer | ✅ Complete | `9259220` | — |
| 6D | Catalog Rule Library Migration Layer | ✅ Complete | `2979410` | `phase-6d-catalog-rule-migration-v1.0` |
| 7 | Royaltē Health Engine™ | ⬜ Planned | — | — |
| 7.5 | (per Board directive) | ⬜ Planned | — | — |
| 8 | (per Board directive) | ⬜ Planned | — | — |
| 9+ | (per future Board directives) | ⬜ Planned | — | — |

---

## What's Live in `main` Today

- **Phases 1–6D are merged and locked.** The Intelligence Stack provides:
  - **Rule Library** at `api/rules/` — declarative pure-data rules with `(cio) => boolean` conditions; polarity-aware; category-indexed
  - **Intelligence Engine** at `api/_lib/intelligence-engine.js` — `runIntelligenceEngine(cio, ruleLibrary)` sole entrypoint; generic iteration; deeply frozen output
  - **Golden Fixture Library** at `tests/fixtures/` — 7 canonical CIO reference states; 30-assertion regression surface; append-only
  - **Canonical Catalog Model™ Composer** at `api/_lib/catalog-model-composer.js` — sole owner of `catalogModel` assembly; pure composition; never evaluates rules
  - **Catalog Rule Migration Layer** in `api/rules/catalog-rules.js` — Phase 6D dual-read layer connecting the Rule Library to the Canonical Catalog Model™
- **Phase 6D migration layer details:**
  - `catalogField(cio, fieldName)` — reads `cio.catalog.catalogModel` first, falls back to legacy `cio.catalog` fields; `hasOwnProperty.call()` for prototype safety
  - CIO-scoped immutable cache via nested WeakMap — one cache shard per scan evaluation, eligible for GC when the CIO graph becomes unreachable
  - `deepFreeze()` with WeakSet cycle guard — prevents infinite recursion on circular graphs; recursively freezes all nested objects and arrays
  - Orphan detection derived from `releaseIds[]` semantics — empty `releaseIds[]` on a recording is a canonical fact; the Rule Library decides what it means
  - 139/139 regression assertions passing across 6 test suites
  - Tagged `phase-6d-catalog-rule-migration-v1.0` at `2979410`
- **Royaltē Scan Experience V1 is DESIGN FROZEN.** PR #122 remains open and is held until intelligence wiring is complete. No layout / spacing / typography / color / animation / UX changes are authorised in the meantime.
- **Constitution at v1.3** (effective 2026-06-11) ratifies the seven-layer Engineering Stack.
- **Phase 5 rule format** permits the optional `polarity: 'positive'` field on positive-framing rules — applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`.

---

## What's Not Live Yet

- **The Intelligence Engine is not yet wired into the production audit pipeline.** `runIntelligenceEngine(cio, ALL_RULES)` exists and tests green, but `api/audit.js` does not yet call it.
- **No UI currently consumes engine output.** Phase 7+ will introduce the first consumers under the Constitutional separation rule.
- **Monitoring and Revenue reserved sections remain placeholders.** `MONITORING`, `REVENUE`, and `GENERAL` in the Rule Library carry empty arrays; `monitoring` and `revenue` CIO sections ship `{ reserved: true }`. Phase 7+ may begin populating them.
- **All future work is Board-authorized only.** No phase begins until the Board issues a formal brief.

---

## Next Engineering Target

**Phase 7 has been designated by the Board as the next engineering target. No implementation brief has been issued. No engineering work has commenced.**

When the Board authorises Phase 7 — Royaltē Health Engine™ — the expected scope is:
- Use the Canonical Catalog Model™, Publishing Graph™, Identity Graph™, Metadata Graph™, and Rule Library™ to generate deterministic Health Intelligence
- Deliver: Royaltē Health Score™, Health Drivers, Risk Factors, Backend Improvement Tracking, Executive Brief™, Mission Control™
- Wire health intelligence as the first artist-facing output layer

---

## Outside the Intelligence-Wiring Sprint

These tracks were active prior to the sprint and remain on the roadmap:

| Track | Status |
|---|---|
| Royaltē Scan Experience V1 (`public/index.html`) | 🔒 DESIGN FROZEN (PR #122 held) |
| Royaltē Master Constitution | ✅ v1.3 (2026-06-11) |
| Canonical Payload V2 (wire format) | ✅ Board-ratified (`constitution/CANONICAL_PAYLOAD_V2.md`) |
| Beta launch | June 1, 2026 (per `LAUNCH_CHECKLIST.md`) |
| Live intelligence sources to wire | Spotify · Apple Music · MusicBrainz · Discogs · Listen Notes · YouTube · MLC Public API · MLC Bulk Data Feed |

---

## How to Update This Roadmap

Per the constitutional governance rule (see `AGENT_MEMORY.md` § 9), every Board-approved merge that affects platform state shall:

1. Tick the relevant ⬜ entry to ✅ in the **Phase Status** table.
2. Append the corresponding lock point (commit SHA, tag if any) in the row.
3. Update **What's Live in `main` Today** if the merge changes platform behaviour or new files are added to the Engineering Stack.
4. Move the **Next Engineering Target** entry into the Phase Status table once a Board brief is issued and work commences.

This roadmap is a **living document**. Older state is preserved through `governance/CHANGELOG.md` (append-only) and `governance/BOARD_DECISIONS.md` (append-only); the roadmap itself reflects only the present.
