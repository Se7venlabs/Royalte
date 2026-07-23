# Media Intelligence™ Digital Billboard — Preview Deliverables

**Status:** HTML Development Preview — not production. Awaiting Executive Board approval.
**Directive:** Media Intelligence™ Presentation Layer Reset (Board directive, Presentation Layer Reset phase).
**File:** `public/workspaces/media-intelligence-billboard-preview.html` (standalone, not linked from navigation).
**Deployed preview:** https://royalte-mj8qm3n50-darrylwest-7086s-projects.vercel.app/workspaces/media-intelligence-billboard-preview.html?dev=1

---

## 1. Constitutional Compliance Report

### 1.1 Constitutional Engineering Lock — verified untouched

No file under any of the following was read for modification, only for context, and none was edited:

| System | Touched? |
|---|---|
| `lib/rie/EvidenceBridge.js` | No |
| Canonical Intelligence Engine / domain assemblers | No |
| `api/schema/canonical-intelligence-model.js` (CIM) | No |
| `public/js/runtime-context-mapper.js` (Runtime Context™) | No |
| `api/_lib/media-intelligence.js` (Media Intelligence Engine™) | No |
| Executive Question Framework™ / Executive Decision Framework™ | No |
| `api/athena/` (ATHENA™) | No |
| Scan pipeline (`api/audit.js`, `lib/rie/index.js`, PAL connectors) | No |
| Existing API contracts | No |
| Existing business logic / KPI calculations | No |

Every number rendered in the preview is read verbatim from `ctx.mediaIntelligence`, produced by the unmodified, already-shipped `assembleMediaIntelligence()`. The preview file performs only display-layer arithmetic that was already used in the prior (superseded) preview: regrouping `assetCompleteness.slots` by `provider` for the sidebar bars, and counting `unsupportedReleases.length` — both pure re-presentations of fields already present in the real payload, not new calculations.

### 1.2 Real evidence vs. representative imagery — the line, precisely

| Element | Classification | Why |
|---|---|---|
| Media Asset Completeness™ ring (38%), sub-label ("3 of 8 real assets present") | **Real** | Direct read of `assetCompleteness.completenessPercent` / `presentCount` / `totalSlots` |
| GOOD / FAIR / NEEDS ATTENTION qualitative label on the ring | **Real, editorial bucketing** | Disclosed thresholds (≥70 Good, 40–69 Fair, <40 Needs Attention) over the real percentage — same pattern as Content Activity Status™'s own thresholds elsewhere in this engine, not a new invented metric |
| Platform Coverage™ list + bars (YouTube 100%, Apple Music 100%, TheAudioDB 0%) | **Real** | Regrouped from `assetCompleteness.slots`, limited to the 3 platforms with real connectors |
| Media Activity Pulse (waveform) | **Decorative, explicitly labeled** | Fixed SVG path, not bound to any time-series — caption reads "Decorative — not a real trend," since Media Intelligence™ has zero real change-detection today |
| 5-metric ring row (Completeness, Platform Coverage, Content Activity, Digital Presence, Unsupported Releases) | **Real** | Direct reads, identical source fields to the production `media-intelligence.html` cards |
| Executive Insight / Recommended Action text | **Real, deterministic template** | Built only from populated real fields; empty when nothing qualifies |
| Gallery panel photography (Artist Photo, Album Art, Music Video, Channel Banner) in **Design Reference** mode | **Representative imagery — explicitly authorized for this preview only** | Free-license stock photography, tagged `DEMO` in the corner on every panel it appears on. Never wired to a scan; toggling to Real Evidence mode reverts every panel to the same honest Missing Evidence Experience the platform would show today (since `assembleMediaIntelligence()` does not yet expose asset URLs — only presence booleans) |
| Instagram / TikTok coverage, any platform not YouTube/Apple Music/TheAudioDB | **Absent, deliberately** | No real connector exists for either platform anywhere in this codebase (confirmed in `MEDIA_INTELLIGENCE_EVIDENCE_AUDIT.md` §1) — a capability claim, not a photo, so the representative-imagery allowance does not extend to it |
| "vs last scan" deltas, trend arrows | **Absent, deliberately** | Media Intelligence™ has zero real scan-over-scan change detection (`ARTIST_PROFILE_CARD_MONITORING_SCHEMA.md` §3 — only 3 of 9 constitutional domains have real coverage, and Media Intelligence is not one of them) |
| "Platform Diversity 5/7" (mockup) | **Absent, deliberately** | Not a real metric anywhere in the engine; would require both a definition of "7" and Instagram/TikTok evidence that doesn't exist |

The rule applied throughout: **representative *photography* is permitted, clearly tagged, and reversible via the mode toggle; representative or fabricated *numbers/capability claims* are never permitted**, regardless of mode.

### 1.3 Missing Evidence Experience — preserved

Every panel without a real (or, in Design Reference mode, representative) asset shows the same icon + "No {Label} Found" pattern established in the first preview round. Confirmed live in Real Evidence mode: all 6 panels render the missing-state correctly, with source attribution still shown per panel.

---

## 2. Before / After Comparison

| Aspect | First preview round (incremental-evolution direction) | Current preview (Presentation Layer Reset) |
|---|---|---|
| Layout composition | Single-column stack: billboard hero → stat row → platform-bar row | Two-column hero matching the reference: left intelligence sidebar (score ring, health signal, platform list) beside the billboard gallery, matching the mockup's actual spatial composition |
| Headline metric | Buried in a stat row below the billboard | Promoted to a prominent ring in the sidebar, mirroring the mockup's "Media Coverage Score" position (using the real, already-named Media Asset Completeness™ rather than inventing a new composite score — see §1.2) |
| Health/activity motif | Not present | "Media Activity Pulse" decorative waveform added in the sidebar, explicitly labeled non-data-bearing |
| Gallery imagery | Missing Evidence Experience only, no photography in any mode | Adds a **Design Reference** mode with clearly tagged representative photography, plus a **Real Evidence** mode that reproduces the original preview's honest missing-state behavior exactly |
| Metric row | Present, 4 cards | Present, 5 cards (adds Digital Presence™), positioned below the full hero per the reference |
| Executive insight/action | Present | Present, unchanged logic |
| Fabricated data | None | None — still zero deltas, zero Instagram/TikTok, zero invented composites |

---

## 3. Responsive Validation

Tested against the deployed Vercel preview (`royalte-mj8qm3n50-darrylwest-7086s-projects.vercel.app`), Design Reference and Real Evidence modes both checked.

| Breakpoint | Viewport tested | Result |
|---|---|---|
| Desktop | 1568×712 (effective, browser-automation tool default) | Two-column hero renders as designed; sidebar left, billboard right; 6-panel gallery in a single row; rotation highlight visible and advancing; zero console errors |
| Tablet | 834×872 (requested 834×1112 — browser-automation tool applied its own chrome) | `.mib-layout` correctly collapses to a single column at the 1080px breakpoint — sidebar cards stack full-width above the billboard; gallery drops to 3 columns |
| Mobile | 597×667 (requested 390×844 — browser-automation `resize_window` floored the width, a known limitation documented earlier this session; true sub-560px viewport could not be forced) | Sidebar and metric row stack cleanly; gallery remains 3-column at 597px (correct, since it is above the 560px 2-column breakpoint). The `@media (max-width: 560px) { .mib-gallery { grid-template-columns: repeat(2, 1fr); } }` rule was independently confirmed present and correctly authored via direct stylesheet inspection, since the tool could not physically reach that width this session |

Functional checks: Design Reference ⇄ Real Evidence toggle verified in both directions (real stats identical across modes; DEMO tags appear only in Design Reference mode); Billboard Asset Rotation™ confirmed advancing (`data-mib-panel` index changed 4→5 over one 2.6s interval); zero console errors at any tested breakpoint.

---

## 4. Deployment

- Branch: `docs/media-intelligence-billboard-preview` (unchanged from the first preview round)
- Commits this round: rebuild to reference-matching two-column layout, Design Reference / Real Evidence toggle, representative imagery
- No production files modified (`public/workspaces/media-intelligence.html` untouched)
- Preview URL: https://royalte-mj8qm3n50-darrylwest-7086s-projects.vercel.app/workspaces/media-intelligence-billboard-preview.html?dev=1
