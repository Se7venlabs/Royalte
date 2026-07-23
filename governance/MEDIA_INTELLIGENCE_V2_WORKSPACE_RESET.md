# Media Intelligence™ V2 — Workspace Reset

**Status:** Presentation-only shell (Phase 1 of 6). Awaiting Executive Board approval before Phase 2 (Intelligence Migration).
**Directive:** Media Intelligence™ V2 Reset — full rebuild against the Board-approved design reference, not an incremental evolution of the existing workspace.
**File:** `public/workspaces/media-intelligence-v2.html` (standalone, not linked from navigation, not production).
**Existing production workspace:** `public/workspaces/media-intelligence.html` — **completely untouched**, remains the live/rollback version per the Board's own migration sequence.
**Deployed preview:** https://royalte-orkuqw7t1-darrylwest-7086s-projects.vercel.app/workspaces/media-intelligence-v2.html

---

## 1. Migration sequence (Board-defined)

1. **Build this shell** — structure, layout, styling only. *(this deliverable)*
2. Executive Board approval
3. Migrate existing intelligence section by section
4. Wire billboard to canonical media assets
5. Regression test
6. Remove the original workspace

Nothing beyond step 1 has started. Steps 2–6 are separate, future, Board-gated phases.

## 2. Fidelity to the approved reference

This is the third attempt at this workspace; the first two were judged to still be interpretation rather than reproduction. This build reproduces the reference directly rather than substituting Royaltē's existing shared chrome:

| Reference element | This build |
|---|---|
| Top navigation bar (Mission Control / Overview / Catalog / Media Intelligence / Audience / Market / Reports / brand / avatar) | Reproduced directly as a bespoke nav bar for this page, replacing the left-rail shell used in the prior attempt. Deliberate reversal from the prior round's decision — see §4. |
| Full-bleed night cityscape scene behind sidebar + billboard + KPI row | Reproduced via a real photographic background image (Unsplash, free license) with a dark gradient overlay for legibility, spanning the full region — not a small bounded "hero card" as in the prior attempt |
| Billboard as a physical structure (frame, support poles, spotlight fixtures with light cones) | Reproduced: gold-gradient frame, 7 spotlight fixtures with CSS light-cone triangles along the top edge, two support poles beneath the frame |
| Sidebar cards (score ring, health signal, platform list) floating on the scene | Reproduced with a glass effect (semi-transparent dark background + backdrop blur) so the cityscape shows through, rather than opaque cards |
| 5-panel photographic gallery + "ECLIPSE" stylized album art + "MISSING PROMOTIONAL IMAGE" static panel | Reproduced: 4 photographic/representative panels, a CSS-only eclipse graphic for Album Art (no stock photo needed — matches the reference's own obviously-stylized placeholder), and 2 missing-state panels using a TV-static noise texture (inline SVG `feTurbulence`) instead of the prior round's plain hatch pattern |
| KPI row floating directly on the scene (not in a separate box) | Reproduced: same glass-card treatment as the sidebar, positioned directly below the billboard on the photographic background |
| Executive Insight / Recommended Action row on a solid dark background | Reproduced as a separate solid-background footer strip below the photographic scene |

## 3. Constitutional Engineering Lock — verified untouched

| System | Touched? |
|---|---|
| `lib/rie/EvidenceBridge.js` | No |
| Canonical Intelligence Engine / domain assemblers | No |
| `api/schema/canonical-intelligence-model.js` (CIM) | No |
| `public/js/runtime-context-mapper.js` (Runtime Context™) | No |
| `api/_lib/media-intelligence.js` (Media Intelligence Engine™) | No |
| Executive Question Framework™ / Executive Decision Framework™ | No |
| `api/athena/` (ATHENA™) | No |
| Scan pipeline | No |
| `public/workspaces/media-intelligence.html` (existing production workspace) | No |

This file does not read `royalte_workspace_context` at all. That is deliberate, not an oversight: per the Board's own phasing, real evidence wiring is Phase 4 ("Wire billboard to canonical media assets") and intelligence migration is Phase 3 — both explicitly out of scope for Phase 1. Building a context-reading integration now would be work this phase doesn't call for, and would need to be redone once the real migration shape is decided.

## 4. Representative content — what's placeholder, and why it's safe here

Every number, delta, and platform percentage on this page (Media Coverage Score 78%, the five platform percentages, the five KPI cards, Executive Insight/Recommended Action copy) is **representative placeholder content** reproducing the approved design reference exactly, per the Board's explicit "representative imagery is acceptable for the preview" authorization extended this round to numeric content as well as photography — a deliberate widening from the prior round's stricter "photography only" line, made explicitly by the Board for this presentation-first phase.

Every such element carries a visible `DEMO` tag directly on the page (not just in code comments), so the page cannot be mistaken for a real report even if viewed or screenshotted in isolation. This is the safeguard that makes the wider placeholder license acceptable: nothing here is asserted as true, and nothing here is reachable by an artist — the file isn't linked from navigation and isn't production.

**Reversal from the prior round, disclosed:** the previous preview (`media-intelligence-v2.html`, first attempt) kept Royaltē's real left-rail shell specifically to avoid a cross-workspace navigation inconsistency. This round reproduces the reference's top nav bar instead, per the Board's explicit instruction not to substitute engineering preference for the approved blueprint. This is safe because the file is isolated — no other workspace's chrome is affected, and the real Mission Control left-rail navigation is untouched everywhere else in the platform.

## 5. Responsive validation

Tested against the deployed Vercel preview.

| Breakpoint | Viewport tested | Result |
|---|---|---|
| Desktop | 1568×900 (and 1920×874 effective on one pass) | Full scene renders: top nav, photographic billboard district, gold-framed billboard with visible spotlight cones and support poles, floating glass sidebar and KPI cards, solid footer strip, ATHENA placeholder section. Zero console errors. Rotation confirmed advancing (panel 0→1 over one 2.6s interval) |
| Tablet | 834×872 (requested 834×1112 — tool applied its own chrome) | `.miv2-nav-tabs` correctly hides at the 900px breakpoint (nav shows only brand + avatar); `.miv2-content-grid` collapses to one column, sidebar stacks above the billboard; gallery drops to 3 columns |
| Mobile | Tool floored the requested 390px width to 834px both times (known browser-automation limitation, documented in prior rounds this session — not a page defect). The `@media (max-width: 560px)` rules for `.miv2-gallery` and `.miv2-kpi-row` (2-column) and `@media (max-width: 780px)` for `.miv2-footer` (single column) were independently confirmed present and correctly authored via direct stylesheet inspection |

## 6. Fidelity refinement pass (round 2)

After a direct side-by-side comparison against the approved image, the Board flagged that the workspace still needed to match the reference's specific mood and material choices, not just its structure. Four gaps were closed:

| Gap | Fix |
|---|---|
| Scene read as bright/saturated blue across the whole region, including behind the sidebar | Overlay gradient rebuilt so the region is near-black by default, with city glow concentrated in a low, centered band behind the billboard only — matching the reference's high-contrast, mostly-dark canvas |
| Sidebar/KPI cards were semi-transparent glass showing the photo through | Switched to solid, ~94%-opaque dark panels, matching the reference's opaque card treatment |
| Billboard frame read as a thick brushed-metal border | Rebuilt as a slim glowing gold/white LED edge (box-shadow glow, 2px border) matching the reference's illuminated-sign look |
| Lamps were flat triangular spotlight cones | Rebuilt as hanging pendant fixtures on thin wires with a soft downward glow, matching the reference's gallery-style track lighting |

## 7. Structural correction (round 3 — literal implementation pass)

The Board clarified the approved image is the implementation specification, not a reference to reinterpret — every section should occupy the same location as the source. A direct re-measurement against the image found one real structural mismatch: the KPI card row had been built as a full-width row spanning beneath *both* the sidebar and the billboard. In the approved image, the sidebar and the billboard (with the KPI row stacked beneath it) are two independent columns of different heights — the KPI row is only as wide as the billboard above it, not the full page.

Fixed by wrapping the billboard and KPI row in a new `.miv2-right-col`, nested inside the same two-column grid as the sidebar, so the layout now reads `[sidebar column] [billboard + KPI row, stacked]` — matching the reference's actual column structure. Also widened the sidebar column from 250px to 270px to better match the reference's proportions. Verified live: KPI row now starts flush with the billboard's left edge instead of extending under the sidebar; tablet breakpoint re-confirmed correct after the restructure; zero console errors.

## 8. Deployment

- Branch: `docs/media-intelligence-billboard-preview` (same branch as the earlier billboard-preview round; both files coexist as separate preview artifacts)
- No production files modified
- Preview URL: https://royalte-9z6op0bld-darrylwest-7086s-projects.vercel.app/workspaces/media-intelligence-v2.html
