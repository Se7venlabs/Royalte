# AI Insights™ — Architecture Audit

**Status:** Discovery Phase — no code changes, no redesign, no merge. Investigation only.
**Requested by:** Executive Board
**Date:** 2026-07-23
**Method:** Every claim below traces to a specific file/line in `public/workspaces/ai-insights.html` (1,062 lines) and its real data-source chain, confirmed by direct code inspection.

---

## 1. Living Intelligence Core™ (hero section, lines 280–460)

| Element | Purpose | Implementation | Data Source | Dependencies |
|---|---|---|---|---|
| Artist name greeting (`[data-ai-artist-name]`) | Personalize the header | `setText()` call, line 954 | `rawCtx.subject.artistName \|\| rawCtx.artistName` (line 625) | `ctx.subject` |
| "N critical issues" (`[data-ai-risk-count]`) | Headline risk count | `setText()`, line 956 | `healthReport.risks.length` (line 823) | `ctx.healthReport` |
| 7-node orbital SVG (HEALTH™/PUBLISHING™/CATALOG™/AI PREDICTION™/BACKEND™/GLOBAL™/IDENTITY™) | Visual "living intelligence" motif | `setTimeout`-driven CSS class toggle (`ai-node--live`, lines 576–590) | **None — purely decorative, not data-bound to any real field** | none |
| "ATHENA™" / "Executive Silver™ Intelligence Core" core label | Branding | Static markup (lines 454–455) | **None — hardcoded text** | none |
| `[data-ai-health-status]`, `[data-ai-opportunity-count]` | (Intended: health status / opportunity count) | `setText()` calls exist at lines 955, 957 | n/a | **Dead code — no matching DOM element with these attributes exists anywhere in the file. These writes have no visible effect.** |

## 2. Executive Actions™ (lines 462–475, `#ai-rec-grid`)

| Element | Purpose | Implementation | Data Source | Dependencies |
|---|---|---|---|---|
| Recommendation cards | Top prioritized action items | `recGrid.innerHTML = pm.recGridHtml` (line 961); built from top-4 of a merged, severity-sorted list (line 758) | `healthReport.risks` + `healthReport.opportunities` (line 716), padded with `identityIntelligence.issues` (lines 720–727) and `publishingIntelligence.issues` (lines 728–735) | `ctx.healthReport`, `ctx.identityIntelligence`, `ctx.publishingIntelligence` |
| Synthetic low-score entries | Fill the card grid when few real risks/opportunities exist | Canned title/description text from `WEAK_MODULE_MSGS` (lines 696–745), triggered when `healthIntelligence.publishingScore` or `.footprintScore` < 40 | **Hardcoded template text, not evidence** — only the *trigger* (the score) is real | `ctx.healthIntelligence` |
| Detail panel ("Why This Matters" / "Impact on Royalties" / "Recommended Action") | Per-card drill-down | `aiOpenActionDetail()` (lines 981–1016) | "Impact" field = one of 4 hardcoded strings (`IMPACT_STATEMENTS`, lines 750–755) | **Hardcoded, not derived from evidence** |

## 3. Priority Roadmap™ (lines 480–495, `#ai-priorities-list`)

| Element | Purpose | Implementation | Data Source | Dependencies |
|---|---|---|---|---|
| Priority list | Ordered executive action queue | Populated line 965 | `executiveBrief.priorityActions` (line 781) if present, else falls back to the same Executive Actions™ recommendation list | `ctx.executiveBrief` (required by contract), `ctx.healthReport` (fallback path) |

## 4. Executive Forecast™ (lines 497–536)

| Element | Purpose | Implementation | Data Source | Dependencies |
|---|---|---|---|---|
| Insight bullet 0 | Headline forward-looking narrative | `setInsightText`, line 968 | `royalteAI.executiveInsight` → falls back to `executiveBrief.executiveSummary` | `ctx.royalteAI`, `ctx.executiveBrief` |
| Insight bullet 1 | Top risk narrative | line 969 | `healthReport.risks[0].title` → falls back to `royalteAI.priority` | `ctx.healthReport`, `ctx.royalteAI` |
| Insight bullet 2 | Top opportunity narrative | line 970 | `healthReport.opportunities[0].title` → `globalMusicFootprint.reachNarrative` → `royalteAI.nextAction` | `ctx.healthReport`, `ctx.globalMusicFootprint`, `ctx.royalteAI` |
| "Confidence Score™" metric tile | Headline confidence number | `setText`, line 973 | `healthIntelligence.score` or `healthScore.overallScore`, formatted `"N/100"` | `ctx.healthIntelligence`, `ctx.healthScore` — **this is the Health Score, relabeled (see Duplicate Intelligence Audit)** |
| "Evidence Coverage™" metric tile | Headline coverage grade | `setText`, line 974 | `healthReport.grade` or `healthScore.overallGrade` | **This is the Health Grade (A+–F), relabeled** |
| "Open Risks™" metric tile | Risk count | `setText`, line 975 | `healthReport.risks.length` | `ctx.healthReport` |
| "Opportunities" metric tile | Opportunity count | `setText`, line 976 | `healthReport.opportunities.length` | `ctx.healthReport` |

---

## Context read vs. context used (lines 601–637)

`ctx.*` fields read into local variables: `royalteAI`, `healthIntelligence`, `healthReport`, `healthScore`, `executiveBrief`, `identityIntelligence`, `publishingIntelligence`, `catalogIntelligence`, `globalMusicFootprint`, `backendIntelligence`, `monitoringIntelligence`.

**Dead reads — assigned to local variables but never referenced again anywhere in the file:** `catalogIntelligence`, `backendIntelligence`, `monitoringIntelligence`. Three of eleven read fields have zero effect on anything rendered.

---

## Ownership summary

No card on this page computes anything itself. Every real number/label traces to one of: `royalteAI` (`api/_lib/royalte-ai-assembler.js`), `executiveBrief` (`api/_lib/executive-brief-engine.js`), or `healthReport`/`healthIntelligence`/`healthScore` (Health Engine, owned by Health Intelligence™). AI Insights™ today **assembles a page from other domains' already-computed outputs plus a meaningful amount of its own hardcoded template text** (`WEAK_MODULE_MSGS`, `IMPACT_STATEMENTS`) — it does not currently function as a pure "final consumer" in the sense the Board's brief describes; see the Evidence Audit for the full real/placeholder/hardcoded breakdown.
