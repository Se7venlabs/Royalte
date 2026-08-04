# Mission Control™ Workspace Layout Standard

**Status:** BOARD-MANDATED, 2026-08-04, following the Phase 4C PR #2 layout architecture finding. Canonical layout specification for all current and future `public/workspaces/*.html` pages.

## Context

PR #485 (Phase 4C — Executive Opportunity Roadmap™) shipped with its KPI cards and roadmap columns compressed into the upper-left corner of the page instead of filling the workspace. The Executive Board's review correctly identified this as a layout **architecture** defect, not a CSS tuning issue, and directed that the root cause be found and the shared framework be reused rather than patched around.

**Root cause**: `action-center.html` never wrapped its content in `<div class="hi-main">`. `.ws-body` (`royalte-workspace.css:1254`) is `display:flex` with the default row direction and no padding — it exists only to pair a workspace's main content column against an optional right rail. Without `.hi-main`, each top-level section became a direct flex child of that row and shrank to its own intrinsic width instead of stacking full-width. This had been true since PR #1 (`ac4b054`) but was only visually obvious once real KPI/roadmap content was added.

This document exists so the next new workspace — and the next engineer, human or AI — doesn't rediscover the same bug by trial and error.

## The canonical container chain

Every Mission Control workspace must nest its content exactly like this:

```html
<div class="ws-shell ws-dept--<workspace>">
  <aside class="ws-rail">...</aside>          <!-- left nav, fixed 256px -->

  <div id="ws-no-scan-overlay" hidden>...</div> <!-- full-page gate, sibling of ws-content -->

  <div class="ws-content">
    <header class="ws-breadcrumb">...</header>
    <div class="ws-body">
      <div class="hi-main">
        <!-- ALL workspace content goes here -->
      </div>
    </div>
  </div>
</div>
```

| Class | Defined in | What it does |
|---|---|---|
| `.ws-shell` | `royalte-workspace.css:115` | `display:grid; grid-template-columns:256px 1fr; max-width:1920px; margin:0 auto` — the page-level frame, rail + content. |
| `.ws-content` | `royalte-workspace.css:138` | `display:flex; flex-direction:column` — stacks the breadcrumb above the body. |
| `.ws-body` | `royalte-workspace.css:1254` | `display:flex; flex:1; align-items:flex-start` — **row** direction, no padding. Exists to pair `.hi-main` against an optional right rail (a small number of workspaces add one); on its own it does **not** provide a content column. |
| `.hi-main` | `royalte-workspace.css:1261` | `flex:1; min-width:0; padding:28px 32px 56px; display:flex; flex-direction:column; gap:28px` — **this is the actual content column.** Full width, standard padding, vertical stacking with a 28px gap between sections. |

**The rule: `.ws-body` is never a direct container for content. Content always goes inside `.hi-main`, one level deeper.** Skipping `.hi-main` is exactly the PR #2 defect — sections become row-flex siblings and collapse to intrinsic width.

## What's unique per workspace vs. what's shared

Per the Board's directive: **nothing about the container/grid is workspace-specific — only the content inside `.hi-main` is.**

Shared, never override:
- `.ws-shell` / `.ws-content` / `.ws-body` / `.hi-main` — max-width, breakpoints, grid, padding, gap.
- KPI cards — reuse `.hi-kpi-row` / `.hi-kpi-card` / `.hi-kpi-label` / `.hi-kpi-icon-wrap` / `.ii-kpi-num-row` / `.ii-kpi-big-num` / `.ii-kpi-caption` (`royalte-workspace.css`, used as-is by Publishing/Identity/Catalog Intelligence). Color modifiers already exist for green/orange/purple/violet/blue/crimson/teal — add a new modifier only if none of those fit, never a parallel class family.

Workspace-specific, expected to vary:
- The `.ws-dept--<workspace>` accent (`--ws-accent`, `--ws-accent-soft`, `--ws-accent-border`, `--ws-accent-glow` custom properties).
- Section/card content markup and any content-level classes needed for that workspace's own data (e.g. `action-center.html`'s `.ec-roadmap-card`, `.ec-quickwin-tile`) — these live *inside* `.hi-main` and never redefine the container chain above them.

## Compliance audit (as of this document)

| Workspace | Uses `.hi-main` | Notes |
|---|---|---|
| `action-center.html` | ✅ | Fixed in PR #485 (this incident). |
| `ai-insights.html` | ✅ | |
| `backend-intelligence.html` | ✅ | |
| `catalog-intelligence.html` | ✅ | |
| `global-music-footprint.html` | ✅ | |
| `health-intelligence.html` | ✅ | |
| `identity-intelligence.html` | ✅ | |
| `media-intelligence.html` | ✅ | |
| `publishing-intelligence.html` | ✅ | |
| `settings.html` | ⚠️ No | Uses its own equivalent, `.st-main` (`flex-direction:column; padding:20px 28px 40px; max-width:920px; width:100%`), defined locally in the page's own `<style>` block. Functionally not broken — `.st-main` independently provides the padding/column-stacking `.hi-main` would — but it duplicates rather than reuses the shared container, and drifts if `.hi-main`'s padding/gap standard ever changes. Low-priority cleanup, not a rendering defect. |
| `ask-athena.html` | ⚠️ No — **likely affected by the same defect PR #2 had** | `.ws-body` has three direct children (`<h1>`, a description `<div>`, and `<div class="aa-shell">`), with no `.hi-main` wrapper. `.aa-shell` (the chat panel) sets its own internal `flex-direction:column` but has no `flex:1` or explicit width relative to `.ws-body`'s row context — the same shape of problem `action-center.html` had. **Not fixed as part of this document** — Ask ATHENA™ is a previously Board-certified, actively-linked workspace; changing its layout requires its own authorized, reviewed pass (with Preview verification), not a silent fix bundled into an unrelated governance doc. Flagging here so it's a tracked, known item rather than rediscovered later. |
| `executive-brief.html`, `monitoring-timeline.html`, `priority-actions.html`, `royalte-review.html` | ⚠️ No | Confirmed elsewhere (`governance/PHASE4C_EXECUTIVE_ACTION_CENTER_ARCHITECTURE.md`) as legacy pages predating the current workspace architecture, disconnected from the active Mission Control nav graph. Out of scope for this standard unless reconnected. |

## Pre-merge checklist for any new or modified workspace

Before requesting Board visual review on a workspace change:

1. Content sits inside `.hi-main`, which sits inside `.ws-body`, which sits inside `.ws-content` — verify with `grep -n 'class="hi-main"'` on the file.
2. No competing `max-width`, `padding`, or `display:flex` rule on a container between `.ws-shell` and `.hi-main`.
3. KPI cards use `.hi-kpi-row`/`.hi-kpi-card` and existing color modifiers, not new bespoke KPI CSS.
4. Compare the rendered Preview side-by-side against Publishing Intelligence™ (or another already-compliant workspace) for identical left/right margins, section spacing, and card width, per the Board's own validation checklist from the PR #2 layout review.
