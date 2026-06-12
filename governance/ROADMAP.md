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
| 7 | Royaltē Health Engine™ | ✅ Complete | `ec57481` | — |
| 7.5 | Se7ven Labs Intellectual Property Vault™ | ✅ Complete | `38ec3be` | — |
| 8 | Royaltē Executive Brief Engine™ | ✅ Complete | `8f00014` | — |
| 9+ | (per future Board directives) | ⬜ | — | — |

---

## What's Live in `main` Today

- **Phases 1–8 (incl. 6.5 + 7.5) are merged and locked.** The full Engineering Stack (Section 8B of the Constitution) is in place at the file paths documented in `docs/ROYALTE_ENGINEERING_STACK.md`. The Golden Fixture Library™ at `tests/fixtures/` provides 7 canonical CIO reference states + a 30-assertion regression surface. The Health Engine™ at `api/_lib/health-engine.js` projects Intelligence Reports into a 0-100 score + A+/A/B/C/D/F grade with Board-locked category weights. The **Executive Brief Engine™** at `api/_lib/executive-brief-engine.js` projects Health Reports into a locked-format executive briefing (headline · summary · narrative · top-5 strengths/risks/opportunities/priority-actions · confidence statement · next step · AI executive insight) with Board-locked vocabulary. The **Se7ven Labs Intellectual Property Vault™** at `/ip/` is the authoritative internal corporate record of all Se7ven Labs LLC IP, ratified as permanent across every product lifecycle, subsidiary, merger, or restructuring.
- **Royaltē Scan Experience V1 is DESIGN FROZEN.** PR #122 remains open and is held until intelligence wiring is complete. No layout / spacing / typography / color / animation / UX changes are authorised in the meantime.
- **Constitution at v1.3** (effective 2026-06-11) ratifies the seven-layer Engineering Stack.
- **Phase 5 rule format now permits** the optional `polarity: 'positive'` field on positive-framing rules — applied to `publishing.strong-coverage` and `catalog.complete-delivery-verified`.

## What's Not Live Yet

- **The Intelligence Engine is not yet wired into the scan pipeline.** `runIntelligenceEngine(cio, ALL_RULES)` exists and tests green, but `api/audit.js` does not yet call it. That's Phase 7.
- **No UI consumer reads engine output.** Phase 7+ will introduce the first consumers under the Constitutional separation rule.
- **Phase 5 reserved categories** (`MONITORING`, `REVENUE`, `GENERAL` in the Rule Library) carry empty arrays; **Phase 4 reserved CIO sections** (`monitoring`, `revenue`) ship `{ reserved: true }` placeholders. Phase 7+ may begin populating them.

---

## Anticipated Phase 7 — Engine Wiring (no brief authorised)

When the Board authorises Phase 7, the expected scope is:
- Wire `assembleCio` into `api/audit.js` so every scan persists a CIO alongside the canonical AuditResponse
- Wire `runIntelligenceEngine(cio, ALL_RULES)` so every scan produces an engine output
- Persistence path TBD (Supabase column on `audit_scans` is the leading candidate)
- **Zero UI changes** — `public/index.html` stays DESIGN FROZEN

The Board has not yet issued the Phase 7 brief. No work has commenced.

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

Per the new constitutional rule (see `AGENT_MEMORY.md` § 9), every Board-approved merge that affects platform state shall:

1. Tick the relevant ⬜ entry to ✅ in the **Phase Status** table.
2. Append the corresponding lock point (commit SHA, tag if any) in the row.
3. Update **What's Live in `main` Today** if the merge changes platform behaviour or new files are added to the Engineering Stack.
4. Move stale items out of **Anticipated Phase N** into a new section if a Phase is restructured.

This roadmap is a **living document**. Older state is preserved through `governance/CHANGELOG.md` (append-only) and `governance/BOARD_DECISIONS.md` (append-only); the roadmap itself reflects only the present.
