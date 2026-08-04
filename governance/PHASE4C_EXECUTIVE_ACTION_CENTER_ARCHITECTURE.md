# Executive Action Center™ — Phase 4C

**Status:** PR #1 (Foundation) — Board-authorized, in progress. PRs #2-6 not yet started.

## Context

Phase 4A (Playbook Action Engine™) and Phase 4B (Executive Opportunity Engine™) both shipped complete, certified backends — but Phase 4B's entire ranking/roadmap output (Do Now/Do Next/Do Later, Quick Wins) has had no UI anywhere since it merged (2026-08-03, PR #452), by the Board's own explicit "backend support required, UI optional" instruction at the time. Phase 4C is the tenth Mission Control workspace, and the permanent home for both engines' executive-facing surface, plus Executive Progress™ and Executive Timeline™.

**No formal Phase 4C brief existed before this directive.** Its scope was reconstructed entirely from forward-references scattered across the 4A/4B architecture and lessons-learned docs — confirmed via direct research before any code was written:
- `governance/OPPORTUNITY_ENGINE_ARCHITECTURE.md` — "Executive Action Center™ workspace + UI rendering of the Roadmap"
- `governance/PLAYBOOK_ACTION_ENGINE_ARCHITECTURE.md` — "Executive Action Center™ workspace + Executive Progress™ + Executive Timeline™"
- `governance/LESSONS_LEARNED_PHASE_4A.md` — `api/playbook-actions.js` was deliberately designed to serve both the `ai-insights.html` extension (4A) and a future dedicated workspace (4C) without changes
- `governance/LESSONS_LEARNED_PHASE_4B.md` — 4C also carries a content-authoring pass (a 3rd real Playbook Definition)

This document is the first dedicated Phase 4C record; it will accumulate detail as PRs #2-6 land.

## Naming — the dashboard.html "Action Center" question

The Board directed a review of `public/dashboard.html` for a pre-existing "Action Center" naming collision before building anything. Confirmed: `public/dashboard.html:1088` (`data-nav="action-center"`, labeled "Action Center / Tasks & Alerts") and `public/js/dashboard.js:942` (`renderMcActionCenter`) — a real, exact-name collision.

**Decision: proceed with "Action Center" as the new workspace's nav label** (full branded name "Executive Action Center™" everywhere else — page title, breadcrumb, H1), because the collision risk is low in practice, not just in theory: `public/dashboard.html` is confirmed disconnected from the active Mission Control navigation graph — zero references to it from `mission-control.html` or any `public/workspaces/*.html` page, and no explicit `vercel.json` route (only reachable via the generic catch-all at its literal URL). It appears to predate the current workspace architecture and isn't part of the surface an executive using Mission Control today would ever see alongside the new workspace. If `dashboard.html` is ever reconnected to active navigation, this naming should be revisited.

## Architecture — PR #1 (this PR)

New `public/workspaces/action-center.html`, following the Canonical Workspace Architecture™ 4-layer standard (§1 Context → §2 Intelligence → §3 Presentation → §4 Render) used by every other workspace. This foundation PR wires §1 (real — reads `royalte_workspace_context` via `window.RoyalteContext.readWorkspaceContext()`, same no-scan overlay pattern as every sibling workspace) and establishes four section shells for the remaining PRs, each honestly labeled with what it's waiting on rather than showing fabricated data — matching this codebase's established convention (e.g. Health Trend's `—` placeholder until historical data exists) rather than a throwaway "coming soon."

New `.ws-dept--action-center` accent (`public/css/royalte-workspace.css`) uses `--mc-orange` — not yet claimed by any other workspace's dept identity, and already the color this codebase uses for priority/urgency semantics (Ask ATHENA's MEDIUM-confidence badge).

**Navigation**: a new nav entry added to the exact same 9 workspace pages that received the Ask ATHENA (Phase 3E) rollout — `health-intelligence.html`, `identity-intelligence.html`, `publishing-intelligence.html`, `catalog-intelligence.html`, `global-music-footprint.html`, `media-intelligence.html`, `ai-insights.html`, `backend-intelligence.html`, `settings.html` — plus the new page itself (10 total). `mission-control.html` and 4 legacy pages (`executive-brief.html`, `monitoring-timeline.html`, `priority-actions.html`, `royalte-review.html`) were confirmed to have been skipped by that same earlier rollout too — followed the identical precedent rather than deciding fresh.

**Routing**: none needed. Confirmed via `vercel.json` precedent (`ask-athena.html` has no explicit route either) — all `public/workspaces/*.html` pages are served through the generic catch-all.

## Remaining PRs (Board-approved sequence)

| PR | Deliverable | Depends on |
|---|---|---|
| #2 | Executive Opportunity Roadmap™ — render Do Now/Next/Later + Quick Wins | 4B's `opportunity-scoring-engine.js`/`opportunity-store.js` (already complete, unmodified) |
| #3 | Executive Timeline™ | Likely = surfacing 4A's existing Automatic Executive Timeline (`describeHistoryEvent()`), not new logic — to be confirmed during implementation, not assumed |
| #4 | Executive Progress™ | Scope undefined anywhere in governance — implementation must stop and return to the Board if it remains undefined after technical review, per the Board's own directive |
| #5 | Guided Playbooks™ expansion | A 3rd real Playbook Definition, following the existing `api/playbooks/definitions/*.js` pattern exactly |
| #6 | Executive Certification | Full regression, live Executive Board Certification Walkthrough™, documentation, merge |
