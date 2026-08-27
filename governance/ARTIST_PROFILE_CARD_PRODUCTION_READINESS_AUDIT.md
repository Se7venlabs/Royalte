# Artist Profile Card™ — Production Readiness Audit (Phase 1)

**Status:** Audit complete. No code changes made. Per Board directive: **DO NOT MERGE** until reviewed and findings prioritized.
**Scope:** Live production (`royalte.ai`, fresh Taylor Swift scan, `scanId e144b839-0909-4933-8cbe-a40f15d11ee7`) + full source read of every file cited below. Every finding has a file:line citation and was either read directly in code or reproduced live in the browser — nothing here is speculative.
**Method:** Four parallel code audits (Header/Section 1; Health/Identity/Publishing; Catalog/Global Footprint/Media; Backend/AI Insights/Monitoring/Settings) plus a live click-through of Mission Control and every workspace, console-error check, and cross-check of prior constitutional-series findings (#44–#56, logged 2026-07-18) against current code.
**Not covered in this pass:** mobile-viewport rendering (the session's resize tool did not visibly affect screenshot capture — this needs a real device or a different verification method, not asserted here), Lighthouse-style performance measurement, and full keyboard-navigation/screen-reader walkthroughs (spot-checked only).

---

## How to read this

Severity rubric used throughout:
- **Critical** — fabricated or wrong data shown to a real user, or a real user action corrupts real data on screen.
- **High** — blank/undefined/broken/dead UI for a common, real state.
- **Medium** — inconsistent terminology/formatting, or a missing fallback that doesn't break the page.
- **Low** — cosmetic/spacing/animation nit.

---

## 1. Executive Header (`public/mission-control.html` / `public/js/mission-control.js`)

**Root cause, Critical:** `mission-control.html` is a static "locked sample" hero that contains **none** of the DOM hooks (`data-mc-hi-*`, `#ecosystem-status`, `.mc-hero`, etc.) that `mission-control.js`'s fully-built, well-guarded plan builders (`buildHealthIntelligencePlan`, the Identity/Publishing executive plans, `buildEcosystemStatusPlan`) write to. Confirmed via repo-wide grep — zero matches. Effect: **the Royaltē Health Score™ never renders anywhere on Mission Control, for any user, any scan state**, despite ~600 lines of correctly-written code that silently no-ops.

**Live-confirmed, Critical — five fields are 100% static, never wired to any scan:**
- "Last Scan: **7:12 AM**" — same value on a scan run at 3:44 PM and again at 3:47 PM.
- "Executive Confidence™: **98% Very High**" — same value both times.
- "ATHENA™ has detected **3 items**... identified **7 new opportunities**" — same numbers both times.
- "Overall Business Status: **Operational**" — no code reference anywhere; always shows this.
- 6 of 7 hero-node statuses (Identity "Verified", Publishing "Action Required", Catalog "Operational", AI Insights "ATHENA™ Active", Media "Ready", Backend "Stable") — hardcoded, zero JS wiring. Only the Global™ node (`"N Markets"`) is real.

I verified this two ways independently — direct code read (`mission-control.html:133-261`) and two live scans four minutes apart showing byte-identical "live" numbers.

**Critical — fallback gap on identity fields:** `#mc-greeting` ships hardcoded as `BLACK ALTERNATIVE`; the left-rail identity block ships hardcoded as the **founder's own name and title** ("Darryl West / Founder Account · Active"). Both are only overwritten if `__mcRevealHero()` resolves a real name — `fetchScanPayload()` failure (RLS miss, malformed storage, network error) leaves either placeholder showing to a real visitor with no error surfaced.

**High:** No Artist Image field exists anywhere in the header — the only image is a decorative, non-artist-specific, `aria-hidden` static asset.

**Not real concepts anywhere in the codebase today (would be fabricated if built as literally named):** Profile Version, Profile Status, Executive Status. "Scan Status" exists only in unused backend modules with zero frontend consumers.

**Low:** the Global™ hero node shows a market count in what's otherwise a "status" slot on all 7 sibling nodes — a labeling inconsistency, not a defect.

---

## 2. "Section 1 — Artist Profile" fields

No section by this name exists anywhere. The closest real implementation is `public/workspaces/settings.html`'s "Profile Information" card (`settings.html:528-550`, `renderProfileInfo()` at `:1039-1050`).

| Brief's field | Exists? | Where | Note |
|---|---|---|---|
| Artist Name | Yes | `settings.html:538` | Good `'—'` fallback |
| Artist Profile ID | Mislabeled | `settings.html:545` | Value is the raw Supabase auth UUID, not a distinct profile ID (Medium) |
| Artist URL | Mislabeled | `settings.html:541` | Value is a bare slug, no protocol/domain (Medium) |
| Date Created | Yes | `settings.html:546` | Guarded, reasonable |
| Last Updated | Not surfaced | — | `profiles.updated_at` is a real, populated, auto-updating DB column, never rendered anywhere (Medium) |
| Last Scan | Not present | — | Not in this section at all |
| Scan Status | Not present | — | Real backend field, zero frontend consumers |
| Profile Status | Doesn't exist | — | Zero matches repo-wide |
| Profile Version | Doesn't exist | — | Zero matches repo-wide — not a schema, payload, or UI concept |

---

## 3. Health Intelligence (`public/workspaces/health-intelligence.html`)

**Critical — Executive Timeline™ overwrites real data with fiction.** `public/js/health-timeline.js:17-221` is a fully hardcoded 7-day dataset (fictional scores, fictional ATHENA briefs). Wired to all 7 timeline dots (`:404-421`) — **clicking any dot, including "Return to Current," replaces the real user's on-screen score/breakdown/briefs with this fictional dataset, with no code path back to real data short of a page reload.** This is worse than the original carried-over finding (#53) suggested — it's not just "runs on mock data," it actively corrupts the live view on user interaction.

**Critical — category sparklines/trend % are static HTML,** never touched by the real-data render script; a real non-first-scan user sees fabricated per-category trend percentages tied to no real history.

**Still present (#52):** `grade` is computed backend-side but never reaches this workspace's render path — never rendered anywhere.

**High:** `.hi-kpi-trend` permanently stuck on placeholder "— Trend Updating" for any real user who never clicks a (mock) timeline dot.

**High:** Category-card status pills are classified by a different, undocumented threshold set client-side (`Excellent/Strong/Good/Moderate/...`) than the backend's own documented "constitutional source of truth" `domainStatuses` (`Excellent/Strong/Moderate/Needs Review`), which is computed but never read by any frontend file. A score of 65 can show as "Moderate" (backend truth) or "Good" (frontend's own invented label) depending on which element renders it — "Good" isn't even in the backend's vocabulary.

**High:** the "AI Insights™" category card is bound to `hi.monitoringScore` (a different domain entirely) — the number shown has nothing to do with the workspace it links to.

**Medium/High:** "Date range selector" is a focusable, `role="button"` element with zero click/keydown handler — same dead-control pattern repeated verbatim on Identity Intelligence.

---

## 4. Identity Intelligence (`public/workspaces/identity-intelligence.html`)

Overall well-built — coverage ring, empty states, and fallback handling are solid (verified live: ring settles correctly at 100% / "5 of 5 Verified" after its count-up animation).

**Medium:** Two `img` elements (artist photo, latest-release artwork) keep `alt=""` even after real images load — unlabeled content images for screen readers, not decorative.

**Medium:** Pervasive `href="#"` CTAs ("View Details →" etc.) with no click handlers or real targets.

**Low:** Count-up ring animations aren't gated for `prefers-reduced-motion` and can display a misleading intermediate number for ~1–2s before settling (live-observed: briefly showed "8%" before settling at "100%", contradicting the adjacent static "5 of 5 Verified" text during the transition).

---

## 5. Publishing Intelligence / "Publishing Ecosystem™" (`public/workspaces/publishing-intelligence.html`)

**Fixed since the constitutional series:** #44 (dead SoundExchange weighting) is resolved — now reads the correct canonical field, with an explicit Board Ruling citation in code.

**Medium naming inconsistency, live-confirmed:** every other workspace's nav rail calls this "Publishing Intelligence" (subtitle "Your Works"); the page itself brands as "Publishing Ecosystem™" (subtitle "Your Rights") everywhere — title, breadcrumb, H1, nav self-label. Same destination, two names depending on where you're looking from. I saw this directly: the Identity page's sidebar said "Publishing Intelligence / Your Works"; landing on the page itself immediately relabels to "Publishing Ecosystem™ / Your Rights."

**High:** "Record Label" is rendered from two independently-sourced values on the same page (artist self-disclosure in one card, canonical scan evidence in another) with no reconciliation — they can show two different label names for the same fact.

**Medium:** PRO registration-status lookup (`proStat = regData[proKey] || 'REGISTERED'`) can never succeed — `pi.registrations`'s real keys don't include any PRO name, so this always silently falls back to the literal string `'REGISTERED'`, and the "upgradeable via Official Source" code path documented in a comment is dead.

**Low:** dev-fixture activation guard is scoped to `localhost`/`127.0.0.1` **and** any `*.vercel.app` preview host — wider than Health/Identity's `localhost`-only guard.

---

## 6. Catalog Intelligence (`public/workspaces/catalog-intelligence.html`)

**Fixed since the constitutional series:** #45 (ISRC Coverage wrong field names) is resolved — current field reads match the assembler's real output shape.

**Live-confirmed inconsistency:** "ISRC Coverage™" KPI reads "20/20 · Complete" while the "Latest Release™" panel directly below it, for the same catalog, shows "ISRC: **Not Available**" for that release. Whatever the correct scoping logic is (e.g. singles vs. albums), as displayed it reads as a direct contradiction on one screen.

**Live-observed / High:** "Last Catalog Sync: 2 hours ago" shown immediately after a scan that had completed minutes earlier — this timestamp source doesn't track the actual scan that just ran.

**Medium:** dev-fixture auto-activates on any `*.vercel.app` hostname with no query param needed — inconsistent with the stricter `localhost`/`?dev=1` guard used by Global Music Footprint and Media Intelligence. Any preview URL for this workspace can silently render fabricated data.

**Low:** missing-ISRC "reason" text is hardcoded rather than driven by the real `reason` field the backend already provides (harmless today — only one reason code exists — but will silently drop information if a second is ever added).

---

## 7. Global Music Footprint (`public/workspaces/global-music-footprint.html`)

No new defects found beyond what's already tracked in the open forensic investigation (territory-count discrepancy) — **per Board directive, the forensic trace instrumentation across this workspace and its supporting files is intentional, gated, and untouched.**

**Medium:** no shared vocabulary for "we have no data here" across this workspace ("Not Available in this Storefront" / "— Not yet assessed" / "N/A") vs. Catalog Intelligence ("Not Available") vs. Media Intelligence ("No Data" / "not found") — three different empty-state phrasings for the same underlying concept across the workspaces the Board is reviewing together.

**Low:** the Country Detail Panel is the only place in any of these workspaces that uses emoji (✅/❌) as a status indicator — every other status uses a colored badge/dot/text.

**Low:** the Distribution Health™ ring lacks `aria-hidden="true"`, unlike every sibling decorative graphic on the same and adjacent workspaces (the number is already announced via adjacent text).

---

## 8. Media Intelligence (`public/workspaces/media-intelligence.html`)

**Resolved since the constitutional series:** this is no longer a UI shell — `api/_lib/media-intelligence.js` and `media-evidence.js` are real, wired assemblers, confirmed live in the scan path. This is the newest domain (Board directive 2026-07-22) and, accordingly, has the roughest edges below.

**Medium, live-confirmed false negative:** Catalog Media Support™ decides "supported" via exact-string date matching between an Apple album and an Apple video. I saw this live — **"reputation" and "Lover"** (both Taylor Swift albums with well-known official videos) show **"No Video Found" / red "Action Required"** on the highest-visibility status card, purely because the video's upload date differs from the album's release date. This is documented in code as a known-fragile heuristic, but it's live, user-visible, and wrong for a mainstream, unambiguous case.

**High:** "Export Report" is a prominent, always-visible primary button with no click handler anywhere in the codebase.

**Medium:** "Date range selector" — the same dead-control pattern as Health/Identity, present here too.

---

## 9. Backend Intelligence (`public/workspaces/backend-intelligence.html`)

**Confirmed still true, and worse than previously scoped (#50):** the entire Digital Twin™ node network and its detail-panel content (ratings like "98/100," "9 Fields Confirmed") are literal hardcoded strings — zero `fetch()` calls anywhere in the file. Identical for every artist regardless of real registration/rights status.

**Critical — fabricated fallback numbers presented as real data:** when the real backend score is null, the UI doesn't show an honest empty state — it animates a hardcoded fallback (Backend Status defaults to **98**, Verification Score to **94**, Evidence Verified to **22**) indistinguishably from genuine data.

**Critical — two code paths can directly contradict each other on the same page:** the real assembler can legitimately report a service "Not Found"/"Unavailable," while the fully-static Digital Twin panel always reads "Needs Review" / "2 Absent" regardless.

**High:** status pill text ("Infrastructure Verified — 2 Areas Need Attention") is hardcoded, never derived from the real gap count — will misstate the real number for any artist whose actual gap count differs from 2.

**High:** a 4th KPI card ("Infrastructure Risk™") has no `id` and zero JS wiring — pure decoration, identical for every artist.

**Medium:** a real, actionable button ("View Infrastructure Report →") has `tabindex="-1"`, making it unreachable by keyboard.

---

## 10. AI Insights (`public/workspaces/ai-insights.html`)

Best-audited workspace in this pass — no defects found. Empty/error states are honest ("not enough history yet," "comparison unavailable"), "Ask ATHENA™" is honestly labeled "Coming Soon" rather than faked.

**Medium (process risk, not a live bug today):** `DOMAIN_LABELS` is manually duplicated between server (`api/_lib/executive-domain-labels.js`) and client, with an explicit "keep in sync by hand" comment — currently in sync, but no shared source of truth.

---

## 11. Monitoring Timeline (`public/workspaces/monitoring-timeline.html`)

**Confirmed still true (#54), and functionally worse than the original description:** the renderer reads `ev.category`/`ev.polarity`/`ev.type`/uppercase `severity` — none of which exist on real events (real shape: `{changeType, title, severity}`, severity lowercase). Concretely:
- **Critical:** every real event is bucketed under "Backend Intelligence™" regardless of true domain, because `category` is always absent and falls back to `'backend'`.
- **Critical:** the summary sentence's "improved"/"critical" counts are always 0 for real data (comparing against fields that never match), so the UI silently downgrades to a generic message **even when real `action_needed` events (territory loss, ISRC drop, release removal) are present** — this actively hides urgency from the artist.
- **Critical:** dot color-coding is completely non-functional for real data — a real gain and a real loss render identically.

**Confirmed still true (#56):** only 3 of 9 constitutionally-envisioned domains (Global Footprint, Catalog, a raw Media signal) have any real change-detection emitter at all.

---

## 12. Settings (`public/workspaces/settings.html`)

**Resolved since the constitutional series:** a real, full Settings workspace now exists (2144 lines) — the old "no dedicated Settings page" finding is closed. `display_name` is now editable and persisted; `email` is intentionally read-only (routed through Supabase Auth), a defensible choice, not a gap.

**Medium:** Connected Services grid hardcodes "Not Connected" for every platform for every user, even when Backend Intelligence shows the same platform as "Verified" for that same artist from real scan evidence — a direct, visible contradiction between two workspaces about the same fact (partially mitigated by explanatory copy, but the status label itself still contradicts).

---

## Prioritized Findings Summary

**Critical (10):**
1. Royaltē Health Score™ and Ecosystem Status never render anywhere on Mission Control (systemic DOM-hook mismatch).
2. Mission Control header: 5+ fields are 100% static/fabricated regardless of real scan data (Last Scan, Executive Confidence™, ATHENA counts, Business Status, 6 hero-node statuses).
3. Mission Control header: artist-name and founder-identity fallback strings ship to real users on any payload-fetch failure.
4. Health Intelligence: Executive Timeline™ overwrites real on-screen data with fictional data on click, no recovery without reload.
5. Health Intelligence: category sparklines/trend % are static fabricated HTML.
6. Backend Intelligence: fabricated fallback numbers (98/94/22) shown indistinguishably from real data.
7. Backend Intelligence: static Digital Twin panel can directly contradict the real assembler's output on the same page.
8. Monitoring Timeline: every real event mis-bucketed to "Backend Intelligence™."
9. Monitoring Timeline: urgency-hiding — real action-needed events silently downgrade to a generic, non-urgent summary.
10. Monitoring Timeline: color-coding is non-functional for all real data.

**High (9):** No Artist Image field exists; Health KPI trend permanently stuck on placeholder; conflicting status-label vocabularies (frontend vs. backend "constitutional source of truth") on Health category pills; AI Insights category card bound to the wrong domain's score; Publishing shows two different Record Label values with no reconciliation; Media Intelligence "Export Report" is dead; Backend status-pill gap-count is hardcoded; Backend 4th KPI card is pure decoration; Catalog "Last Catalog Sync" doesn't reflect the actual just-completed scan.

**Medium (12):** Two-name inconsistency for Publishing Intelligence/Ecosystem; dead date-range-selector control (repeated on 3 workspaces); PRO registration-status lookup is dead code, always falls back to one literal string; ISRC Coverage 20/20 "Complete" contradicts an adjacent "Not Available" on the same screen; Media Intelligence exact-date-match heuristic produces live false negatives on mainstream releases; three different empty-state vocabularies across Catalog/Footprint/Media; Settings "Connected Services" contradicts Backend Intelligence for the same platform/artist; inconsistent dev-fixture activation guards across workspaces; Artist Profile ID/URL fields mislabeled (auth UUID / bare slug); `profiles.updated_at` exists but never surfaced as "Last Updated"; images with empty `alt` after load on Identity Intelligence; dead `href="#"` CTAs on Identity/Publishing.

**Low (5):** Count-up ring animations not gated for reduced motion, can flash a misleading number; Global™ hero node shows a count where siblings show a status word; emoji-only status indicators on one panel of Global Footprint; Distribution Health™ ring missing `aria-hidden`; missing-ISRC reason text hardcoded rather than field-driven.

**Not yet verifiable in this pass:** mobile-viewport rendering, performance/Lighthouse metrics, full keyboard/screen-reader walkthrough. Recommend a follow-up pass once Phase 1 findings are triaged, since fixing the Critical items will change a meaningful fraction of these surfaces anyway.

---

## Recommendation

Do not proceed to Phase 2 (Header polish) in isolation — **Finding #1 above (the header's fundamental disconnect from `mission-control.js`) blocks nearly everything the brief's Phase 2 asks to validate**, since the header currently has no live data path at all. Recommend the Board triage this list into a fix sequence before further phases begin, per the brief's own gate.
