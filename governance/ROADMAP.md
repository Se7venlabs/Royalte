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
| 7 | Royaltē Health Engine™ | ✅ Complete | `ec57481` | — |
| 7.5 | Se7ven Labs IP Vault™ | ✅ Complete | `38ec3be` | — |
| 8 | Scan Pipeline Wiring — Health & Executive Brief | ✅ Complete | `17f462f` | `phase-8-scan-pipeline-wiring-v1.0` |
| 9+ | (per future Board directives) | ⬜ Planned | — | — |

---

## What's Live in `main` Today

- **Phases 1–8 are merged and locked.** The full Intelligence Stack is wired into production:
  - **Rule Library** at `api/rules/` — declarative pure-data rules with `(cio) => boolean` conditions; polarity-aware; category-indexed
  - **Intelligence Engine** at `api/_lib/intelligence-engine.js` — `runIntelligenceEngine(cio, ruleLibrary)` sole entrypoint; generic iteration; deeply frozen output
  - **Golden Fixture Library** at `tests/fixtures/` — 7 canonical CIO reference states; 30-assertion regression surface; append-only
  - **Canonical Catalog Model™ Composer** at `api/_lib/catalog-model-composer.js` — sole owner of `catalogModel` assembly; pure composition; never evaluates rules
  - **Catalog Rule Migration Layer** in `api/rules/catalog-rules.js` — Phase 6D dual-read layer connecting the Rule Library to the Canonical Catalog Model™
  - **Royaltē Health Engine™** at `api/_lib/health-engine.js` — `computeHealthScore(intelligenceReport)` sole scoring authority; Board-locked weights and grade thresholds; pure, deterministic, deeply frozen output
  - **Royaltē Executive Brief Engine™** at `api/_lib/executive-brief-engine.js` — `generateExecutiveBrief(cio, intelligenceReport, healthReport, canonicalHealth)` sole entrypoint; presentation layer only; never scores, never invents
  - **Se7ven Labs IP Vault™** at `/ip/` — permanent internal corporate IP register (24 markdown files); survives product lifecycles, mergers, acquisitions
- **Phase 8 scan pipeline wiring** (`api/audit.js`): every scan now runs the full constitutional pipeline end-to-end:
  - `runIntelligenceEngine(cio, ALL_RULES)` → `computeHealthScore(report)` [once] → `generateHealthReport(cio, report)` → `generateExecutiveBrief(cio, report, healthReport, healthScore)` → persists `healthScore`, `healthReport`, `executiveBrief` in the enriched scan payload
  - `computeHealthScore()` called exactly once per scan; canonical result passed downstream, never re-derived
- **Royaltē Scan Experience V1 is DESIGN FROZEN.** PR #122 remains open and is held until intelligence wiring is complete. No layout / spacing / typography / color / animation / UX changes are authorised in the meantime.
- **Constitution at v1.3** (effective 2026-06-11) ratifies the seven-layer Engineering Stack.
- **Phase 5 rule format** permits the optional `polarity: 'positive'` field on positive-framing rules — applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`.

---

## What's Not Live Yet

- **No UI currently consumes Phase 8 engine output.** `healthScore`, `healthReport`, and `executiveBrief` are now persisted in every scan payload but are not yet surfaced in Mission Control or the scan UI.
- **Monitoring and Revenue reserved sections remain placeholders.** `MONITORING`, `REVENUE`, and `GENERAL` in the Rule Library carry empty arrays; `monitoring` and `revenue` in reserved sections ship `null`. Phase 9+ may begin populating them.
- **All future work is Board-authorized only.** No phase begins until the Board issues a formal brief.

---

## Next Engineering Target

**Phase 9+ is pending a Board brief.** The Intelligence Stack is fully wired. Next targets are expected to include Mission Control™ data wiring and scan UI intelligence display.

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
