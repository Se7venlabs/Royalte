# Global Music Footprint™ — SVG Event Resolution Audit & Fix

**Module:** Global Music Footprint™
**Initiative:** SVG Click-Event Resolution Audit (Board-approved investigation & implementation)
**Status:** Implementation complete — MERGE NOT AUTHORIZED, pending Executive Board review
**Branch:** `feat/global-music-footprint-evidence-audit`
**Related PR:** #395 (Canonical Territory Vocabulary Completion)
**Related Governance:** `APPLE_STOREFRONT_SVG_TERRITORY_VERIFICATION.md` (§8, original disclosure of this defect)
**Date:** 2026-07-22

---

## 1. SVG Event Architecture Audit

**Map asset:** `public/img/world-territories-map.svg` — 252 elements matching `g[id]`/`path[id]` with a two-letter lowercase id. Countries with simple boundaries are a single `<path id="xx">`; countries with multi-part boundaries (island nations, exclaves) are a `<g id="xx">` wrapping multiple child `<path>` elements with no `id` of their own.

**Nesting structure:** 11 of the 252 elements are themselves nested inside another territory's `<g>` — i.e. `<g id="parent"><g id="child">...</g></g>`, geographically dependent or disputed territories drawn inside their parent's group by the original Wikimedia asset:

```
ge → [xa, xo]         fr → [gp, mq, re, yt]     rs → [xk]
cn → [hk, mo, tw]      ma → [eh]                 nl → [bq]
il → [ps]              no → [xv]                 md → [xp]
ua → [xd, xl]          cy → [xc]
```

**Listener attachment strategy (before fix):** `global-map-choropleth.js`'s init routine ran `svgEl.querySelectorAll('g[id], path[id]')`, then for every matched element with a two-letter id that had real territory evidence (`t = territoryByCode[code]`), attached five independent listeners directly to that element: `mouseenter`, `mousemove`, `mouseleave`, `click`, `keydown`. No delegation, no `stopPropagation()` anywhere.

**Event bubbling behaviour:** `mouseenter`/`mouseleave` are non-bubbling DOM events — a listener on a nested child never triggers a listener on its ancestor for these two, so hover/tooltip behavior was never affected by nesting. `click`, `mousemove`, and `keydown` do bubble. `mousemove`'s handler (`moveTooltip`) is idempotent regardless of which element it re-fires on, so bubbling there is harmless. `click`'s handler (`selectCountry`) is **not** idempotent across different territories — it overwrites shared UI state (the Country Intelligence Panel) — so this was the only listener where bubbling caused an observable defect.

**Click propagation path (nested case, e.g. Macau):** click target = `<g id="mo">` (or a `<path>` descendant inside it) → Macau's own listener fires (`selectCountry(mo, t_mo)`, correct) → event continues bubbling → reaches `<g id="cn">` → China's own listener fires second (`selectCountry(cn, t_cn)`) → panel is overwritten with China's data. Final state visible to the user is always whichever listener fired *last*, which is always the outermost ancestor with a listener — never the element actually clicked.

**Territory resolution path:** determined entirely by `el.dataset.code`, set unconditionally on every matched element regardless of whether it has real evidence (`territoryByCode[code]`). Elements without real evidence (e.g. `gp`, `xk`, `eh`) get `data-code` but no listeners at all under the old per-element-binding design — so a click landing on one of those already fell through by pure absence-of-listener to whichever ancestor *did* have one. This turns out to matter directly for the fix (§2–§3).

---

## 2. Root Cause Analysis

The defect is not "nesting causes bugs" in general — it is specifically: **the old architecture attached an independent click listener to every element with evidence, with no mechanism to stop a click from also triggering an ancestor's listener.** Whether this was observable depended entirely on whether *both* the parent and the child independently had real Apple-storefront evidence.

Cross-referencing all 11 nested relationships against `ALL_APPLE_STOREFRONTS` (167 codes, `lib/territory/canonical-territory-vocabulary.js`) settles the exact scope:

| Parent | Apple storefront? | Children | Any child an Apple storefront? |
|---|---|---|---|
| ge | No | xa, xo | No |
| fr | **Yes** | gp, mq, re, yt | No |
| rs | No | xk | No |
| **cn** | **Yes** | **hk, mo, tw** | **Yes — all three** |
| ma | Yes | eh | No |
| nl | Yes | bq | No |
| il | Yes | ps | No |
| no | Yes | xv | No |
| md | Yes | xp | No |
| ua | Yes | xd, xl | No |
| cy | Yes | xc | No |

**China → [Hong Kong, Macau, Taiwan] is the only one of the 11 relationships where both the parent and its children are independently real, evaluated Apple storefronts.** In every other case the nested child (a disputed territory's non-ISO Wikipedia code, or a dependent territory Apple doesn't operate a storefront for) has no entry in `territoryByCode`, so it never had a listener of its own — meaning the click already, correctly, fell through to the parent's real evidence. That fallback behavior is desirable and must be preserved, not just silenced. A blanket `stopPropagation()` on every click listener would have broken it: `gp` (Guadeloupe) would stop resolving to France entirely and silently do nothing on click, which is a regression, not a fix. This is exactly why the Board's caution against assuming `stopPropagation()` is automatically correct was warranted.

---

## 3. Recommended Architectural Solution

**Selected: Option B — event delegation with canonical, evidence-based territory resolution.**

Instead of binding `click`/`keydown` to every matched element, a single listener of each type is attached once to the SVG root. On event, it walks from the actual event target (`e.target`) outward through `parentNode`, and resolves to **the nearest ancestor-or-self element whose `data-code` has a real entry in `territoryByCode`** — not the nearest element with `data-code` at all, and not based on nesting depth in the abstract. This single rule reproduces the correct outcome for all 11 relationships with zero per-country special-casing:

- Click inside Macau → nearest evidence-bearing ancestor-or-self is Macau itself (nearer than China) → resolves to Macau.
- Click inside Guadeloupe → Guadeloupe has no evidence → walk continues outward → France is the nearest evidence-bearing ancestor → resolves to France (identical to today).
- Click on any non-nested territory → resolves to itself, as always.

Why this over the alternatives the Board listed:
- **Option A** (determine the true clicked territory before executing panel logic) — this is what the chosen solution does; Option B is the concrete mechanism for it.
- **Option C** (adjust listener attachment strategy alone, e.g. attach only to leaf/innermost elements) — doesn't work, because which element is "innermost" varies per relationship (sometimes the parent is the only one with evidence, sometimes the child is), and static attachment can't express "prefer whichever the click actually landed nearest to."
- **Option D** (targeted `stopPropagation()`) — rejected per the Root Cause Analysis above: correct only for the China case, actively breaks the other 10.
- **Option E** — no alternative surfaced during investigation that didn't reduce to a form of B.

This also strengthens the architecture beyond fixing the reported symptom: listener count for click/keydown drops from up to 167 individually-bound elements to exactly 2 (one `click`, one `keydown` on the SVG root), and the resolution rule is structurally incapable of regressing if the map's underlying nesting changes in a future asset update — there is no per-element wiring left to forget.

Hover (`mouseenter`/`mousemove`/`mouseleave`) is untouched — not part of the defect (non-bubbling, or idempotent), and touching it would be scope creep against the Board's explicit "do not redesign" guidance.

---

## 4. Implementation Summary

**File changed:** `public/js/global-map-choropleth.js` only.

- Removed the per-element `click` and `keydown` listener registration from inside the `groups.forEach` loop (previously lines 121, 125–127).
- `mouseenter`/`mousemove`/`mouseleave` listeners, `tabindex`/`role`/`aria-label` attribute-setting: unchanged, still per-element, since they are correct as-is.
- Added `resolveTerritoryTarget(target)`: walks `target` → `target.parentNode` → ... until reaching `svgEl`, returning the first `{ el, t }` pair where `el.dataset.code` resolves to a real territory in `territoryByCode`, or `null`.
- Added one delegated `click` listener and one delegated `keydown` listener on `svgEl`, each calling `resolveTerritoryTarget` and invoking the existing, unchanged `selectCountry(el, t)` on a match.

No other file touched. No change to territory matching (`territoryByCode` construction), fill/stroke color logic, SVG geometry, map dimensions, responsive breakpoints, or any Territory Intelligence Engine / evidence-acquisition code.

---

## 5. Validation Results

- `node --check public/js/global-map-choropleth.js` — syntax valid.
- No changes to any file the pipeline test suite covers; full suite re-run clean (unchanged from PR #395's last validation: 222+8 pipeline assertions, 20/20 RIE activation, 17/17 CIO assembler; the one pre-existing `scan-migration.test.js` failure is unrelated and reproduces independently on a clean stash).
- Deployed to a fresh Vercel Preview and validated live (§6).

---

## 6. Regression Test Results

All tests run live against `https://royalte-2z0ntue2u-darrylwest-7086s-projects.vercel.app/workspaces/global-music-footprint.html`.

**Primary defect — China's three nested storefronts, each given independent real-shaped evidence with distinct statuses:**

| Clicked | Resolved panel name | Resolved status | Correct? |
|---|---|---|---|
| Hong Kong (hk) | Hong Kong | Unavailable | ✓ |
| Macau (mo) | Macau | Available | ✓ |
| Taiwan (tw) | Taiwan | Unknown | ✓ |
| China (cn) | China | Available | ✓ |

Verified against the real, unmodified page (`showCountryPanel`, not a test harness), reading the actual DOM (`#gf2-panel-name`, status element) after each click. Also confirmed the map's `.gmc-territory--selected` highlight class lands on exactly the clicked element (`mo`), never on `cn`.

**Keyboard activation parity:** focused Macau, dispatched `Enter` — panel correctly showed "Macau." Keyboard path uses the same `resolveTerritoryTarget` function, confirmed working identically to mouse click.

**All 11 nested relationships, click-by-click (parent and every listed child):**

| Clicked | Resolves to | Matches predicted/preserved behavior |
|---|---|---|
| ge | (no evidence, no panel) | ✓ unchanged |
| fr → gp | France | ✓ unchanged (falls through, no independent evidence) |
| rs → xk | Serbia* | ✓ unchanged |
| **cn → hk** | **Hong Kong** | ✓ **fixed** (previously resolved to China) |
| **cn → mo** | **Macau** | ✓ **fixed** (previously resolved to China) |
| **cn → tw** | **Taiwan** | ✓ **fixed** (previously resolved to China) |
| ma → eh | Morocco | ✓ unchanged |
| nl → bq | Netherlands | ✓ unchanged |
| il → ps | Israel | ✓ unchanged |
| no → xv | Norway | ✓ unchanged |
| md → xp | Moldova | ✓ unchanged |
| ua → xd, xl | Ukraine | ✓ unchanged |
| cy → xc | Cyprus | ✓ unchanged |

\*Serbia (`rs`) is not an Apple storefront in production (absent from `ALL_APPLE_STOREFRONTS`); given a synthetic evidence entry for this test specifically to confirm the resolution walk works symmetrically regardless of which real-world territories happen to have evidence on a given day.

**Representative territories across regions (non-nested, confirming zero regression to the common case):** United States, Canada, United Kingdom, Germany, France, Australia, Japan, Netherlands, Sweden, Ireland, Brazil, South Africa, India — each resolved correctly to itself.

**Console errors:** zero, checked after the full test sequence above.

---

## 7. Nested SVG Audit — permanent governance reference

| Parent Territory | Child Territory | Apple Storefront? (child) | Independent Evidence? (child) | Requires Independent Click? | Current Behaviour (pre-fix) | Final Behaviour (post-fix) |
|---|---|---|---|---|---|---|
| Georgia (ge) | xa | No | No | No | No panel (no listener either side) | No panel (unchanged) |
| Georgia (ge) | xo | No | No | No | No panel | No panel (unchanged) |
| France (fr) | gp (Guadeloupe) | No | No | No | Falls through to France | Falls through to France (unchanged) |
| France (fr) | mq (Martinique) | No | No | No | Falls through to France | Falls through to France (unchanged) |
| France (fr) | re (Réunion) | No | No | No | Falls through to France | Falls through to France (unchanged) |
| France (fr) | yt (Mayotte) | No | No | No | Falls through to France | Falls through to France (unchanged) |
| Serbia (rs) | xk (Kosovo, non-ISO) | No | No | No | Falls through to Serbia (if Serbia has evidence) | Falls through to Serbia (unchanged) |
| **China (cn)** | **hk (Hong Kong)** | **Yes** | **Yes** | **Yes** | **Overwritten by China (bug)** | **Opens Hong Kong (fixed)** |
| **China (cn)** | **mo (Macau)** | **Yes** | **Yes** | **Yes** | **Overwritten by China (bug)** | **Opens Macau (fixed)** |
| **China (cn)** | **tw (Taiwan)** | **Yes** | **Yes** | **Yes** | **Overwritten by China (bug)** | **Opens Taiwan (fixed)** |
| Morocco (ma) | eh (Western Sahara) | No | No | No | Falls through to Morocco | Falls through to Morocco (unchanged) |
| Netherlands (nl) | bq (Caribbean Netherlands) | No | No | No | Falls through to Netherlands | Falls through to Netherlands (unchanged) |
| Israel (il) | ps (Palestine) | No | No | No | Falls through to Israel | Falls through to Israel (unchanged) |
| Norway (no) | xv (Svalbard, non-ISO) | No | No | No | Falls through to Norway | Falls through to Norway (unchanged) |
| Moldova (md) | xp (Transnistria, non-ISO) | No | No | No | Falls through to Moldova | Falls through to Moldova (unchanged) |
| Ukraine (ua) | xd (non-ISO) | No | No | No | Falls through to Ukraine | Falls through to Ukraine (unchanged) |
| Ukraine (ua) | xl (non-ISO) | No | No | No | Falls through to Ukraine | Falls through to Ukraine (unchanged) |
| Cyprus (cy) | xc (Northern Cyprus, non-ISO) | No | No | No | Falls through to Cyprus | Falls through to Cyprus (unchanged) |

**Guidance for future map development:** if a future SVG asset update or a future provider adds independent evidence for any territory currently marked "No" in the "Independent Evidence?" column above (e.g. if Apple ever adds a Guadeloupe-specific storefront distinct from France), no code change is required — `resolveTerritoryTarget`'s evidence-based walk will automatically start resolving that territory to itself the moment `territoryByCode` contains a real entry for it. This table should be re-verified if `world-territories-map.svg` is ever replaced or re-vendored.

---

## 8. Constitutional Compliance Confirmation

- Territory Intelligence Engine: not modified.
- Evidence acquisition (PAL, connectors): not modified.
- Apple storefront identifiers, `ALL_APPLE_STOREFRONTS`, `COUNTRY_NAMES`: not modified.
- SVG geometry / asset: not modified.
- Map color logic, territory matching (`territoryByCode` construction), fill/stroke resolution: not modified.
- No hardcoded per-country exceptions introduced — the fix is one general rule applied uniformly to all 252 elements.
- Mobile/tablet compatibility: unaffected (no CSS, layout, or dimension changes).
- Performance: listener count reduced (167→2 for click, same for keydown), not increased.

---

## 9. Executive Recommendation

**Production ready:** Yes, pending Board visual/interaction approval. The fix is minimal in surface area (one file, ~40 lines), general rather than special-cased, and independently verified against all 11 real nested relationships in the production SVG plus a representative regional sample — every prediction from the root-cause analysis matched the live test result exactly.

**Recommended merge decision:** Approve for merge alongside or after PR #395, following Board review of the live preview.

---

## Merge Authority

Implementation and full regression testing complete. Merge is **NOT authorized** pending Executive Board review and sign-off.

---

## Deliverables Reference

1. SVG Event Architecture Audit — §1
2. Root Cause Analysis — §2
3. Recommended Architectural Solution — §3
4. Implementation Summary — §4
5. Validation Results — §5
6. Regression Test Results — §6
7. Updated Governance Documentation — this document, plus cross-reference added to `APPLE_STOREFRONT_SVG_TERRITORY_VERIFICATION.md` §8
8. Commit hash — `a4ab57b`
9. Pull Request — #395
10. HTML Development Preview — `https://royalte-2z0ntue2u-darrylwest-7086s-projects.vercel.app/workspaces/global-music-footprint.html`
