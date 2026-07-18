# Royaltē — Artist Profile Card
# Section 7: Media Intelligence™ Field Schema

## Purpose

Define the Media Intelligence™ field contract for the Artist Profile Card. **Workflow for this section differs from Sections 2–6 by explicit Board directive**: the Media Intelligence™ workspace (`public/workspaces/media-intelligence.html`) was built first, so the HTML/UI is the approved product model — fields were inventoried from the live page, not handed down as a founder brief. Only after the inventory was complete was the implementation traced. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit Identity/Publishing/Catalog/Global Music Footprint/Backend, modify Mission Control, or activate ATHENA. Scope is field-schema completion only. No production code is changed by this document.

**Workflow followed:**
```text
Media Intelligence™ HTML → Field Inventory → Code Trace → Evidence Validation → Artist Profile Media Schema → Documentation PR
```

**Rule applied throughout:** the HTML is the product specification; the code is the implementation. Where they disagree, the difference is documented below — neither the HTML nor the code was changed to make them agree.

---

## Step 1–3: Field Inventory (from the live HTML/JS, `public/workspaces/media-intelligence.html`)

Every visible card, KPI, table, badge, button, and data field, grouped by on-page section, exactly as presented:

### § Executive Header
| Element | Content |
|---|---|
| Eyebrow | "Media Intelligence™" (static) |
| Heading | "Executive view of your official video ecosystem across connected music platforms." (static) |
| Description | "Channel health, release cadence, and visual content opportunities — all in one view." (static) |
| Date Range selector | "Last 30 Days" (static — no interaction wiring found) |
| Export Report button | static button — no click handler found |

### § Executive KPI Row (5 cards)
| KPI | Sub-elements |
|---|---|
| Subscribers | value, delta vs. prior period, caption |
| Channel Views | value, delta vs. prior period, caption |
| Total Videos | value, delta, caption "Official Uploads" |
| Platforms Detected | count, status text, per-platform dot list |
| Missing Video Opportunities™ | count, "Action Required" status |

### § Latest Video Releases™ card
"View All" link (static, `href="#"`, non-functional). Per-video row: thumbnail, play icon, duration, title, type (Official Music Video / Lyric Video / Live Performance / Behind the Scenes / YouTube Shorts), platform + release date, status.

### § Monetization Status™ card
Radial readiness ring (%), status label, summary text, checklist (5 rows: Official Channel, Public, Linked to Releases, Rights Information Present, Metadata Complete — each met/not-met), "View Details" button (static — no handler found).

### § Missing Video Opportunities™ card
"View All" link (static). Per-opportunity row: icon (by opportunity type), title, description, priority badge (High/Medium/Low).

### § Video Performance Summary™ card
Grid of 6 stats: Subscribers (val+delta), Channel Views (val+delta), Total Videos (val+delta), Public Videos (val), Official Artist Channel (Yes/No), Latest Upload (date + "N days ago").

### § ATHENA Media Insights™ card
"View All" link (static). List of insight text strings (sparkle icon + text).

### § No-Scan state
"No Scan Loaded" overlay with icon, message, CTA to Mission Control — confirmed to be the actual default production state (see Code Trace below).

---

## Step 4–5: Code Trace & Evidence Validation

**The renderer identifies itself as a UI-shell phase, in its own comment** (`media-intelligence.html:723-730`): *"Media Intelligence™ — Runtime Renderer v1.0 (UI shell phase). Input: `royalte_workspace_context.mediaIntelligence` (dev-fixture only during this phase — see Board Implementation Brief v1.0). Never queries storage or renders demo data outside the dev fixture — a production scan without this domain correctly shows the standard 'No Scan Loaded' overlay."*

This is a materially different situation from every prior section's findings (Catalog's fixture-only KPIs, Global Music Footprint's static legend, Backend's largely-static Digital Twin): those were undocumented gaps discovered by tracing. **This one is explicitly, intentionally documented in the code itself**, citing an actual named authority ("Board Implementation Brief v1.0"). That distinction is preserved here rather than flattened — this is the "intentional, evidenced" case; the prior findings were not.

**Confirmed, zero real backend exists for this domain:**
- No `assembleMediaIntelligence()` or equivalent function anywhere in `api/_lib/` or `lib/rie/`.
- `lib/rie/index.js` — zero references to "media"/"Media". Not wired into CIM assembly at all.
- `public/js/mc-workspace-context.js:148-158` **does** define a formal read contract for `media-intelligence` (`required: ['mediaIntelligence']`, `requiredFields: ['mediaIntelligence.subscribers', 'mediaIntelligence.totalVideos']`) — with its own comment citing the same "UI-shell phase (Board Implementation Brief v1.0)" reasoning. The contract exists; nothing populates it in production.
- The dev fixture (`media-intelligence.html:253-318`, gated on `localhost` or `?dev=1`) is the **only** place this entire data shape exists anywhere in the codebase.

**Important nuance — some of the raw ingredients already exist, just not assembled:**
- **YouTube channel statistics are real and already reach canonical**, via `translateYouTubeChannelData()` (`lib/rie/EvidenceBridge.js:615-663`): `canonical.platforms.youtube.details.subscriberCount`, `.viewCount`, `.videoCount` are populated today from real YouTube `COLLECTION_DATA` evidence. This is a close, existing match for the Subscribers / Channel Views / Total Videos KPIs — the gap is assembly, not acquisition.
- **YouTube and Apple Music VIDEOS evidence is acquired but discarded.** Per Media PAL Expansion™ (already completed, task #43 this session), both `youtube-pal-acquisition.js` (step C) and `apple-pal-acquisition.js` (step B) acquire `Capability.VIDEOS` evidence packages. But `EvidenceBridge.js` has **no `translateYouTubeVideos` or Apple-video translator function** — only `translateAudioDBVideos` exists (`EvidenceBridge.js:951-969`, a different provider, populating `canonical.platforms.audiodb.media.videos`, an unrelated shape). The acquired YouTube/Apple video evidence never reaches `canonical` today — a genuine "acquired but not consumed" gap, not a "never acquired" gap.
- **Monetization, Missing Video Opportunities, and ATHENA Media Insights have no real data source anywhere** — no monetization signal is acquired from any provider, and no gap-detection or insight-generation logic for video content exists in any domain assembler.

---

## Artist Profile Media Schema

Approved fields below are exactly the Step 1–3 inventory — nothing added, nothing dropped. Every field is tagged with its approved Population Source and, per the workflow, its real implementation status.

### Section 1 — Implemented Fields

**None.** No field in this domain is backed by real production data today — confirmed by the renderer's own "UI shell phase" comment and by the absence of any assembler wiring into `lib/rie/index.js`. This is the expected, intentional finding for a workspace built UI-first, not a defect.

### Section 2 — Implementation Required

| Approved Field | Classification | Population Source | Current Gap | Required Implementation Change |
|---|---|---|---|---|
| Subscribers | Canonical Data Field | Scan (YouTube) | Real data already exists at `canonical.platforms.youtube.details.subscriberCount` (`EvidenceBridge.js:633`) — not assembled into `mediaIntelligence` | Assembly-only gap: new domain assembler reads existing canonical field, no new acquisition needed |
| Channel Views | Canonical Data Field | Scan (YouTube) | Real data exists at `.details.viewCount` (`EvidenceBridge.js:634`) — not assembled | Assembly-only gap, same as above |
| Total Videos | Canonical Data Field | Scan (YouTube) | Real data exists at `.details.videoCount` (`EvidenceBridge.js:635`) — not assembled | Assembly-only gap, same as above |
| Subscribers / Views / Videos deltas (vs. prior period) | Canonical Intelligence Field | Royaltē System | No historical comparison exists for this domain | Requires snapshot-over-time computation, likely analogous to the existing Monitoring Engine's snapshot-diff pattern |
| Platforms Detected | Canonical Data Field | Scan (YouTube, Apple Music, Spotify) | No consolidated "platforms with video presence" field exists | New aggregation across existing per-provider canonical data |
| Missing Video Opportunities™ (count + list) | Canonical Intelligence Field | Royaltē System | No gap-detection logic for video content exists anywhere | New intelligence logic — genuinely new capability |
| Latest Video Releases™ (video list: title, type, platform, release date, status, duration, thumbnail) | Canonical Data Field | Scan (YouTube, Apple Music) | Evidence is acquired (`Capability.VIDEOS`, both providers) but **discarded** — no `EvidenceBridge` translator exists for it | Requires new `translateYouTubeVideos`/Apple-video translator functions, following the existing `translateAudioDBVideos` pattern, plus a new domain assembler. **Thumbnail specifically has a narrower, already-documented path**: the workspace's own CSS comment (`media-intelligence.html:116-121`) states the YouTube API already provides `v.thumbnail`, the card falls back to a branded placeholder only until it's wired, and "no redesign needed to add real thumbnails — only `v.thumbnail` needs to start arriving populated." |
| Monetization Status™ (status, summary, readiness %, checklist) | Canonical Intelligence Field | Scan (eligibility signal, if available) + Royaltē System (readiness scoring) | No monetization signal is acquired from any provider today | Requires new acquisition (if the YouTube Data API exposes a usable signal) plus new readiness-scoring logic |
| Video Performance Summary™ grid (Public Videos, Official Artist Channel, Latest Upload) | Canonical Data Field | Scan (YouTube) | No distinct "public video count" or "official channel" boolean/date field found in canonical | Partial overlap with existing `officialChannel` data from the legacy V1 path (`api/lib/normalizeAuditResponse.js:204-206`) — needs reconciliation, not necessarily new acquisition |
| ATHENA Media Insights™ (insight text list) | Canonical Intelligence Field | Royaltē System (AI Insights domain) | No insight-generation logic for video/media content exists; real ATHENA (`api/athena/`) has zero production callers per prior findings (`ARTIST_PROFILE_CARD_ARCHITECTURE.md` §5) | The "ATHENA" branding on this card is a forward-reference to the approved target architecture (§8), not a claim that real ATHENA is wired — new intelligence logic required regardless of which engine ultimately generates it |

### Static UI chrome (not data fields — noted for completeness, not tracked as gaps)

Export Report button, "View All" links (×3), Monetization "View Details" button, and the Date Range selector are interactive controls with no bound data and no click handler found. Whether these need wiring is a UX/product decision, not a field-schema gap — noted here rather than silently omitted from the inventory.

---

## Constitutional Validation Pass (Board-directed re-verification)

Per Board request, every visible element on the live page was re-checked line-by-line against this schema, including elements outside the primary card/KPI inventory:

| Visible element | In schema? | Disposition |
|---|---|---|
| Sidebar navigation (`ws-rail`/`mc-nav`, `media-intelligence.html:325-428`) — brand mark + 10 workspace links (Mission Control, Health, Identity, Publishing, Catalog, Global Music Footprint, Media Intelligence [active], AI Insights, Backend, Settings) | Not a Media Intelligence field | **Belongs to Mission Control shell, not any single Artist Profile Card domain.** Identical structure appears on every other workspace traced in this series (Identity, Catalog, Backend) — it is application chrome, not Identity/Catalog/Publishing/etc. domain data, so it is out of scope for a field schema by the same standard applied to those five prior workspaces (none of which inventoried their own copy of this sidebar either) |
| Breadcrumb (`media-intelligence.html:439-445`) — "Royaltē OS™ / Mission Control / Media Intelligence™" | Not a Media Intelligence field | Same disposition as sidebar — shared shell navigation chrome |
| Monetization ring's center icon (decorative musical-note glyph, `media-intelligence.html:546-548`) | Not a data field | Fixed decorative icon, does not represent or vary with any data value |
| ATHENA card's background glow (`mi-athena-glow`, `media-intelligence.html:577`, styled `577-221` in CSS) | Not a data field | Pure visual decoration (radial gradient), `aria-hidden="true"`, no data binding |
| Loading skeleton shimmer state (`data-mi-state="loading"`, CSS `238-244`) | Covered implicitly | A transient pre-load visual state applied to the KPI row, video list, opportunity list, perf grid, and ATHENA list containers before `readWorkspaceContext()` resolves — not a distinct data field, it is the loading presentation of the fields already in the schema |
| Video card thumbnail activation path (`media-intelligence.html:116-121`) | Now cited directly | Added precision to the Latest Video Releases™ row above — the code comment confirms thumbnail specifically needs only data population, not new code, once `v.thumbnail` starts arriving |
| "Board Revision #1" (items 2, 6) and "Board Implementation Brief v1.0" — named in `media-intelligence.html:11-13,24-27,58-61,227-229,723-730` and `mc-workspace-context.js:148` | Reinforces existing framing | Multiple independent code comments cite the same named authorities as the source of this page's design — further confirms the UI is a Board-approved specification, not an engineer's unilateral placeholder |

No new data field was found by this pass. The additions above are chrome/decoration dispositions and one citation refinement (video thumbnail) — the Section 1/Section 2 field classification from the original trace is unchanged.

**All visible Media Intelligence™ fields have been inventoried.**

---

## Media Intelligence™ Rules

1. The HTML is the product specification for this section; the code is the implementation. Disagreements between them are documented, not resolved by changing either.
2. A field belongs in **Section 1 — Implemented Fields** only if backed by real, live production data today. For this domain, that set is empty — documented as a finding, not smoothed over.
3. Where a gap is purely an assembly problem (real canonical data exists but isn't consolidated into `mediaIntelligence`), that is stated explicitly and distinguished from gaps requiring genuinely new acquisition or new intelligence logic.
4. PAL owns acquisition; CIO/CIM (via `EvidenceBridge`) owns normalization/translation; a not-yet-built domain assembler would own consolidation into `mediaIntelligence`; the Artist Profile Card represents the result.
5. No approved field (from the Step 1–3 inventory) is removed for lack of current support.
6. This document does not authorize building the missing assembler, the missing EvidenceBridge translators, or any new acquisition — it documents what exists and what the gap requires, per the Board's own scope limits (documentation only, no production code).

---

## Deliverable Status

Media Intelligence™ field schema — complete:
- ✅ Complete UI field inventory produced first, per the Board-directed workflow (HTML → Inventory → Trace)
- ✅ Code trace confirms zero backend assembler exists; the workspace's own comments already document this as an intentional, named ("Board Implementation Brief v1.0") UI-shell phase — not an undocumented defect
- ✅ Distinguished assembly-only gaps (Subscribers/Views/Videos — real data exists, just not consolidated) from genuine acquisition gaps (video list — evidence acquired but discarded, no translator) from genuine new-capability gaps (Monetization, Missing Opportunities, ATHENA Insights — no source data or logic exists at all)
- ✅ No approved field removed; no field represented as live when it isn't
- ✅ No production code changed; no Mission Control changes
- ✅ Ready for review and lock

**Media Intelligence™ ready to lock.**
