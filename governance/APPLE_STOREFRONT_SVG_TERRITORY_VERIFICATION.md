# Apple Storefront → SVG Territory Verification

**Status:** Verification & Governance Evidence — no functional changes, no production code modified, no SVG asset modified.
**Requested by:** Executive Board
**Date:** 2026-07-22
**Scope:** One-to-one coverage validation between Apple's 167 canonical storefront territories and the polygon set in the production world map SVG powering the Global Music Footprint™ choropleth.

---

## 6. Architectural Evidence — headline conclusion (stated first, evidence follows)

> **Every Apple storefront territory currently supported by the Canonical Territory Intelligence Engine maps directly to a unique SVG territory polygon with no missing geographic representation.**

**TRUE.** 167 / 167 matched. 0 missing. 0 duplicate SVG ids. 0 ISO-shape mismatches. This is supported by direct, reproducible verification below, not by assumption or by the fact that no discrepancy has been *observed* in ad-hoc testing — every one of the 167 codes was individually checked against the actual SVG file's element ids.

**One adjacent, non-blocking finding is disclosed in §4**, per the instruction not to silently suppress discrepancies: 72 of the 167 territories have no human-readable display name in the codebase's `COUNTRY_NAMES` table and fall back to their raw ISO code (e.g. "AG" instead of "Antigua and Barbuda"). This does **not** affect polygon matching or map rendering — all 72 render correctly and are colored correctly — it only affects the text label shown in hover tooltips and the Country Intelligence Panel for those specific territories.

---

## 1. Apple Storefront Inventory

**Source of truth:** `lib/territory/canonical-territory-vocabulary.js`, exports `ALL_APPLE_STOREFRONTS` (the array of 167 codes) and `COUNTRY_NAMES` (display-name lookup, keyed uppercase). This is the single canonical list — per that file's own header, it consolidated three previously-independent, verified-byte-identical copies during Phase 5.2.

All 167 storefront codes are **exactly two lowercase letters**, confirmed programmatically (§5). Apple's storefront codes are lowercase; this document's tables render the **ISO Alpha-2** column in uppercase per ISO 3166-1 convention — the two are the same code, differing only in case, per `getCountryName()`'s own `code.toUpperCase()` normalization (`canonical-territory-vocabulary.js`).

Royaltē does not maintain a separate "Internal Canonical Territory Code" distinct from Apple's own storefront code — `ALL_APPLE_STOREFRONTS`' codes **are** the internal canonical representation (per that file's stated Board decision: "One canonical territory vocabulary shall exist"). There is no second internal coding scheme to reconcile against.

The full 167-row inventory, cross-referenced against the SVG, is presented together in §2 (splitting the inventory from the verification table would require presenting the same 167 rows twice).

---

## 2. SVG Territory Verification — full 167-row table

**Production SVG:** `public/img/world-territories-map.svg` (1,046,643 bytes on disk at verification time).

Grouped by the same four regions `ALL_APPLE_STOREFRONTS` itself is organized into (Americas / Europe / Middle East & Africa / Asia Pacific), for direct comparison against the source file.

### Americas (36)

| Apple Storefront Code | Territory Name | ISO Alpha-2 | Name Source | SVG Polygon Found | Status |
|---|---|---|---|---|---|
| ag | AG | AG | raw code (no display name) | Yes | ✓ Matched |
| ai | AI | AI | raw code (no display name) | Yes | ✓ Matched |
| bb | BB | BB | raw code (no display name) | Yes | ✓ Matched |
| bm | BM | BM | raw code (no display name) | Yes | ✓ Matched |
| bo | Bolivia | BO | COUNTRY_NAMES | Yes | ✓ Matched |
| br | Brazil | BR | COUNTRY_NAMES | Yes | ✓ Matched |
| bs | BS | BS | raw code (no display name) | Yes | ✓ Matched |
| bz | BZ | BZ | raw code (no display name) | Yes | ✓ Matched |
| ca | Canada | CA | COUNTRY_NAMES | Yes | ✓ Matched |
| cl | Chile | CL | COUNTRY_NAMES | Yes | ✓ Matched |
| co | Colombia | CO | COUNTRY_NAMES | Yes | ✓ Matched |
| cr | Costa Rica | CR | COUNTRY_NAMES | Yes | ✓ Matched |
| dm | DM | DM | raw code (no display name) | Yes | ✓ Matched |
| do | Dominican Republic | DO | COUNTRY_NAMES | Yes | ✓ Matched |
| ec | Ecuador | EC | COUNTRY_NAMES | Yes | ✓ Matched |
| gd | GD | GD | raw code (no display name) | Yes | ✓ Matched |
| gt | Guatemala | GT | COUNTRY_NAMES | Yes | ✓ Matched |
| gy | GY | GY | raw code (no display name) | Yes | ✓ Matched |
| hn | Honduras | HN | COUNTRY_NAMES | Yes | ✓ Matched |
| jm | Jamaica | JM | COUNTRY_NAMES | Yes | ✓ Matched |
| kn | KN | KN | raw code (no display name) | Yes | ✓ Matched |
| ky | KY | KY | raw code (no display name) | Yes | ✓ Matched |
| lc | LC | LC | raw code (no display name) | Yes | ✓ Matched |
| mx | Mexico | MX | COUNTRY_NAMES | Yes | ✓ Matched |
| ni | NI | NI | raw code (no display name) | Yes | ✓ Matched |
| pa | Panama | PA | COUNTRY_NAMES | Yes | ✓ Matched |
| pe | Peru | PE | COUNTRY_NAMES | Yes | ✓ Matched |
| py | Paraguay | PY | COUNTRY_NAMES | Yes | ✓ Matched |
| sr | SR | SR | raw code (no display name) | Yes | ✓ Matched |
| sv | El Salvador | SV | COUNTRY_NAMES | Yes | ✓ Matched |
| tc | TC | TC | raw code (no display name) | Yes | ✓ Matched |
| tt | Trinidad and Tobago | TT | COUNTRY_NAMES | Yes | ✓ Matched |
| us | United States | US | COUNTRY_NAMES | Yes | ✓ Matched |
| uy | Uruguay | UY | COUNTRY_NAMES | Yes | ✓ Matched |
| vc | VC | VC | raw code (no display name) | Yes | ✓ Matched |
| vg | VG | VG | raw code (no display name) | Yes | ✓ Matched |

### Europe (44)

| Apple Storefront Code | Territory Name | ISO Alpha-2 | Name Source | SVG Polygon Found | Status |
|---|---|---|---|---|---|
| al | AL | AL | raw code (no display name) | Yes | ✓ Matched |
| am | AM | AM | raw code (no display name) | Yes | ✓ Matched |
| at | Austria | AT | COUNTRY_NAMES | Yes | ✓ Matched |
| az | AZ | AZ | raw code (no display name) | Yes | ✓ Matched |
| be | Belgium | BE | COUNTRY_NAMES | Yes | ✓ Matched |
| bg | Bulgaria | BG | COUNTRY_NAMES | Yes | ✓ Matched |
| by | BY | BY | raw code (no display name) | Yes | ✓ Matched |
| ch | Switzerland | CH | COUNTRY_NAMES | Yes | ✓ Matched |
| cy | Cyprus | CY | COUNTRY_NAMES | Yes | ✓ Matched |
| cz | Czechia | CZ | COUNTRY_NAMES | Yes | ✓ Matched |
| de | Germany | DE | COUNTRY_NAMES | Yes | ✓ Matched |
| dk | Denmark | DK | COUNTRY_NAMES | Yes | ✓ Matched |
| ee | Estonia | EE | COUNTRY_NAMES | Yes | ✓ Matched |
| es | Spain | ES | COUNTRY_NAMES | Yes | ✓ Matched |
| fi | Finland | FI | COUNTRY_NAMES | Yes | ✓ Matched |
| fr | France | FR | COUNTRY_NAMES | Yes | ✓ Matched |
| gb | United Kingdom | GB | COUNTRY_NAMES | Yes | ✓ Matched |
| gr | Greece | GR | COUNTRY_NAMES | Yes | ✓ Matched |
| hr | Croatia | HR | COUNTRY_NAMES | Yes | ✓ Matched |
| hu | Hungary | HU | COUNTRY_NAMES | Yes | ✓ Matched |
| ie | Ireland | IE | COUNTRY_NAMES | Yes | ✓ Matched |
| is | Iceland | IS | COUNTRY_NAMES | Yes | ✓ Matched |
| it | Italy | IT | COUNTRY_NAMES | Yes | ✓ Matched |
| kg | KG | KG | raw code (no display name) | Yes | ✓ Matched |
| kz | KZ | KZ | raw code (no display name) | Yes | ✓ Matched |
| lt | Lithuania | LT | COUNTRY_NAMES | Yes | ✓ Matched |
| lu | Luxembourg | LU | COUNTRY_NAMES | Yes | ✓ Matched |
| lv | Latvia | LV | COUNTRY_NAMES | Yes | ✓ Matched |
| md | MD | MD | raw code (no display name) | Yes | ✓ Matched |
| mk | MK | MK | raw code (no display name) | Yes | ✓ Matched |
| mt | Malta | MT | COUNTRY_NAMES | Yes | ✓ Matched |
| nl | Netherlands | NL | COUNTRY_NAMES | Yes | ✓ Matched |
| no | Norway | NO | COUNTRY_NAMES | Yes | ✓ Matched |
| pl | Poland | PL | COUNTRY_NAMES | Yes | ✓ Matched |
| pt | Portugal | PT | COUNTRY_NAMES | Yes | ✓ Matched |
| ro | Romania | RO | COUNTRY_NAMES | Yes | ✓ Matched |
| ru | RU | RU | raw code (no display name) | Yes | ✓ Matched |
| se | Sweden | SE | COUNTRY_NAMES | Yes | ✓ Matched |
| si | Slovenia | SI | COUNTRY_NAMES | Yes | ✓ Matched |
| sk | Slovakia | SK | COUNTRY_NAMES | Yes | ✓ Matched |
| tj | TJ | TJ | raw code (no display name) | Yes | ✓ Matched |
| tr | Turkey | TR | COUNTRY_NAMES | Yes | ✓ Matched |
| ua | UA | UA | raw code (no display name) | Yes | ✓ Matched |
| uz | UZ | UZ | raw code (no display name) | Yes | ✓ Matched |

### Middle East & Africa (55)

| Apple Storefront Code | Territory Name | ISO Alpha-2 | Name Source | SVG Polygon Found | Status |
|---|---|---|---|---|---|
| ae | UAE | AE | COUNTRY_NAMES | Yes | ✓ Matched |
| ao | AO | AO | raw code (no display name) | Yes | ✓ Matched |
| bf | BF | BF | raw code (no display name) | Yes | ✓ Matched |
| bh | Bahrain | BH | COUNTRY_NAMES | Yes | ✓ Matched |
| bj | BJ | BJ | raw code (no display name) | Yes | ✓ Matched |
| bw | Botswana | BW | COUNTRY_NAMES | Yes | ✓ Matched |
| cd | CD | CD | raw code (no display name) | Yes | ✓ Matched |
| cg | CG | CG | raw code (no display name) | Yes | ✓ Matched |
| ci | Côte d'Ivoire | CI | COUNTRY_NAMES | Yes | ✓ Matched |
| cm | Cameroon | CM | COUNTRY_NAMES | Yes | ✓ Matched |
| cv | CV | CV | raw code (no display name) | Yes | ✓ Matched |
| dj | DJ | DJ | raw code (no display name) | Yes | ✓ Matched |
| dz | DZ | DZ | raw code (no display name) | Yes | ✓ Matched |
| eg | Egypt | EG | COUNTRY_NAMES | Yes | ✓ Matched |
| et | Ethiopia | ET | COUNTRY_NAMES | Yes | ✓ Matched |
| ga | GA | GA | raw code (no display name) | Yes | ✓ Matched |
| gh | Ghana | GH | COUNTRY_NAMES | Yes | ✓ Matched |
| gm | GM | GM | raw code (no display name) | Yes | ✓ Matched |
| gn | GN | GN | raw code (no display name) | Yes | ✓ Matched |
| gq | GQ | GQ | raw code (no display name) | Yes | ✓ Matched |
| gw | GW | GW | raw code (no display name) | Yes | ✓ Matched |
| il | Israel | IL | COUNTRY_NAMES | Yes | ✓ Matched |
| jo | JO | JO | raw code (no display name) | Yes | ✓ Matched |
| ke | Kenya | KE | COUNTRY_NAMES | Yes | ✓ Matched |
| kw | Kuwait | KW | COUNTRY_NAMES | Yes | ✓ Matched |
| lb | LB | LB | raw code (no display name) | Yes | ✓ Matched |
| lr | LR | LR | raw code (no display name) | Yes | ✓ Matched |
| ly | LY | LY | raw code (no display name) | Yes | ✓ Matched |
| ma | Morocco | MA | COUNTRY_NAMES | Yes | ✓ Matched |
| mg | Madagascar | MG | COUNTRY_NAMES | Yes | ✓ Matched |
| ml | ML | ML | raw code (no display name) | Yes | ✓ Matched |
| mr | MR | MR | raw code (no display name) | Yes | ✓ Matched |
| mu | MU | MU | raw code (no display name) | Yes | ✓ Matched |
| mw | Malawi | MW | COUNTRY_NAMES | Yes | ✓ Matched |
| mz | Mozambique | MZ | COUNTRY_NAMES | Yes | ✓ Matched |
| na | Namibia | NA | COUNTRY_NAMES | Yes | ✓ Matched |
| ne | NE | NE | raw code (no display name) | Yes | ✓ Matched |
| ng | Nigeria | NG | COUNTRY_NAMES | Yes | ✓ Matched |
| om | Oman | OM | COUNTRY_NAMES | Yes | ✓ Matched |
| qa | Qatar | QA | COUNTRY_NAMES | Yes | ✓ Matched |
| rw | Rwanda | RW | COUNTRY_NAMES | Yes | ✓ Matched |
| sa | Saudi Arabia | SA | COUNTRY_NAMES | Yes | ✓ Matched |
| sc | SC | SC | raw code (no display name) | Yes | ✓ Matched |
| sl | SL | SL | raw code (no display name) | Yes | ✓ Matched |
| sn | Senegal | SN | COUNTRY_NAMES | Yes | ✓ Matched |
| st | ST | ST | raw code (no display name) | Yes | ✓ Matched |
| sz | SZ | SZ | raw code (no display name) | Yes | ✓ Matched |
| td | TD | TD | raw code (no display name) | Yes | ✓ Matched |
| tn | Tunisia | TN | COUNTRY_NAMES | Yes | ✓ Matched |
| tz | Tanzania | TZ | COUNTRY_NAMES | Yes | ✓ Matched |
| ug | Uganda | UG | COUNTRY_NAMES | Yes | ✓ Matched |
| ye | YE | YE | raw code (no display name) | Yes | ✓ Matched |
| za | South Africa | ZA | COUNTRY_NAMES | Yes | ✓ Matched |
| zm | Zambia | ZM | COUNTRY_NAMES | Yes | ✓ Matched |
| zw | Zimbabwe | ZW | COUNTRY_NAMES | Yes | ✓ Matched |

### Asia Pacific (32)

| Apple Storefront Code | Territory Name | ISO Alpha-2 | Name Source | SVG Polygon Found | Status |
|---|---|---|---|---|---|
| au | Australia | AU | COUNTRY_NAMES | Yes | ✓ Matched |
| bt | BT | BT | raw code (no display name) | Yes | ✓ Matched |
| cn | CN | CN | raw code (no display name) | Yes | ✓ Matched |
| fj | FJ | FJ | raw code (no display name) | Yes | ✓ Matched |
| fm | FM | FM | raw code (no display name) | Yes | ✓ Matched |
| hk | Hong Kong | HK | COUNTRY_NAMES | Yes | ✓ Matched |
| id | Indonesia | ID | COUNTRY_NAMES | Yes | ✓ Matched |
| in | India | IN | COUNTRY_NAMES | Yes | ✓ Matched |
| jp | Japan | JP | COUNTRY_NAMES | Yes | ✓ Matched |
| kh | Cambodia | KH | COUNTRY_NAMES | Yes | ✓ Matched |
| kr | South Korea | KR | COUNTRY_NAMES | Yes | ✓ Matched |
| la | LA | LA | raw code (no display name) | Yes | ✓ Matched |
| lk | Sri Lanka | LK | COUNTRY_NAMES | Yes | ✓ Matched |
| mn | MN | MN | raw code (no display name) | Yes | ✓ Matched |
| mo | MO | MO | raw code (no display name) | Yes | ✓ Matched |
| mv | MV | MV | raw code (no display name) | Yes | ✓ Matched |
| my | Malaysia | MY | COUNTRY_NAMES | Yes | ✓ Matched |
| np | Nepal | NP | COUNTRY_NAMES | Yes | ✓ Matched |
| nr | NR | NR | raw code (no display name) | Yes | ✓ Matched |
| nz | New Zealand | NZ | COUNTRY_NAMES | Yes | ✓ Matched |
| pg | PG | PG | raw code (no display name) | Yes | ✓ Matched |
| ph | Philippines | PH | COUNTRY_NAMES | Yes | ✓ Matched |
| pw | PW | PW | raw code (no display name) | Yes | ✓ Matched |
| sb | SB | SB | raw code (no display name) | Yes | ✓ Matched |
| sg | Singapore | SG | COUNTRY_NAMES | Yes | ✓ Matched |
| th | Thailand | TH | COUNTRY_NAMES | Yes | ✓ Matched |
| tl | TL | TL | raw code (no display name) | Yes | ✓ Matched |
| to | TO | TO | raw code (no display name) | Yes | ✓ Matched |
| tw | Taiwan | TW | COUNTRY_NAMES | Yes | ✓ Matched |
| vn | Vietnam | VN | COUNTRY_NAMES | Yes | ✓ Matched |
| vu | VU | VU | raw code (no display name) | Yes | ✓ Matched |
| ws | WS | WS | raw code (no display name) | Yes | ✓ Matched |

---

## 3. Coverage Summary

```
Apple Storefronts:              167
SVG Territory Polygons (total unique 2-letter ids in the SVG): 252
Successful Matches:             167 / 167
Missing Matches:                0
Duplicate SVG ids (same code on >1 element): 0
ISO Shape Mismatches (Apple code not exactly [a-z]{2}): 0
Naming Conflicts (Apple name vs. SVG name disagreement): 0 — see note below
Alias Resolution required: 0
```

**Note on "Naming Conflicts":** the verification methodology (§5) matches purely on **ISO code identity** (Apple's lowercase code against the SVG element's `id` attribute), not on country-name string comparison — the SVG's own `<title>` elements (present on many, not all, entries) were not used as the matching key. Because matching is code-based, not name-based, no naming-conflict scenario can arise from this method by construction. This is a deliberate methodology choice, documented in §5, not an oversight — code-based matching is the correct approach because it is what the actual rendering code (`global-map-choropleth.js`) uses at runtime (`el.getAttribute('id')`, not any name field).

**252 SVG polygons vs. 167 Apple storefronts** is expected, not a discrepancy: the source SVG (Wikimedia Commons' public-domain world map) has broader real-world ISO coverage than Apple's storefront list — 85 SVG territories have no Apple storefront equivalent (e.g. dependent territories, non-Apple-supported micro-states). These render on the map as inert, out-of-scope background per `global-map-choropleth.js`'s existing, previously-reviewed design (`OUT_OF_SCOPE_FILL`) — they are not part of this verification's pass/fail criteria, since the Board's request is specifically about Apple-storefront coverage, not SVG-to-world completeness.

---

## 4. Exception Report

**No polygon-matching exceptions exist.** 167 / 167 Apple storefronts have a confirmed, unique, non-duplicated SVG polygon.

**One disclosed, non-blocking naming-completeness observation** (not a polygon-matching exception, included per the instruction to document every discrepancy rather than suppress it):

| Apple Storefront Code | Expected Territory Name | SVG Identifier | Reason | Proposed Resolution |
|---|---|---|---|---|
| 72 of 167 codes (full list: ag, ai, bb, bm, bs, bz, dm, gd, gy, kn, ky, lc, ni, sr, tc, vc, vg, al, am, az, by, kg, kz, md, mk, ru, tj, ua, uz, ao, bf, bj, cd, cg, cv, dj, dz, ga, gm, gn, gq, gw, jo, lb, lr, ly, ml, mr, mu, ne, sc, sl, st, sz, td, ye, bt, cn, fj, fm, la, mn, mo, mv, nr, pg, pw, sb, tl, to, vu, ws) | Real country/territory name (e.g. "Antigua and Barbuda" for `ag`) | Matches correctly by ISO code (polygon renders, colors correctly) | `COUNTRY_NAMES` (`canonical-territory-vocabulary.js`) does not currently include a display-name entry for these 72 codes; `getCountryName()`'s documented fallback returns the raw uppercased code instead | Extend `COUNTRY_NAMES` to cover all 167 codes. This is a display-layer completeness item, not a rendering or evidence defect — flagged for the Board's awareness, not proposed as an in-scope change under this verification-only request. |

No ISO code mismatches, no duplicate matches, and no missing territories were found or suppressed.

---

## 5. Verification Methodology

**Source of Apple storefront list:** `lib/territory/canonical-territory-vocabulary.js`, `ALL_APPLE_STOREFRONTS` export (167 entries) and `COUNTRY_NAMES` export, imported directly — not transcribed by hand, not re-typed from documentation.

**Source SVG file:** `public/img/world-territories-map.svg`, read directly from the production working tree at verification time (1,046,643 bytes).

**Matching methodology:** for every code in `ALL_APPLE_STOREFRONTS`, the SVG file's raw text was scanned via regular expression for `<g id="{code}"` or `<path id="{code}"` (both patterns are real and present in the file — countries with simple boundaries are a single `<path id="xx">`; countries with multi-part boundaries, e.g. island nations or countries with exclaves, are a `<g id="xx">` wrapping multiple child `<path>` elements, per the file's own construction). A code is "Matched" if and only if at least one such element exists with that exact id. This is the identical matching mechanism the live rendering code (`global-map-choropleth.js:88-97`) uses at runtime — `svgEl.querySelectorAll('g[id], path[id])`, filtered to two-letter lowercase ids — so this verification tests the real code path, not an approximation of it.

**ISO standard used:** ISO 3166-1 alpha-2 (two-letter country codes). Apple's storefront codes are documented in the source file as "mostly but not entirely ISO-2" — this verification independently confirmed (not merely repeated the source comment) that all 167 codes conform to the `[a-z]{2}` shape; none deviate structurally, and no non-standard code (e.g. a UN M49 numeric code, or a non-ISO regional alias like `xk` for Kosovo) is present in the current 167-entry list.

**Alias handling rules:** none were required. No Apple code needed translation, remapping, or alias resolution to find its SVG match — every match is a direct, unmodified, case-normalized (lowercase-to-lowercase) string equality check.

**Validation process (reproducible):**
1. Import `ALL_APPLE_STOREFRONTS` and `COUNTRY_NAMES` from the canonical vocabulary module.
2. Read `public/img/world-territories-map.svg` as raw text.
3. Extract every `<g id="...">` / `<path id="...">` occurrence via regex, retaining only those matching `[a-z]{2}` (filtering out non-territory ids such as `<defs>`/`<title>` internal ids, which use different id shapes).
4. Build a set of unique matched ids; separately record occurrence counts per id to detect duplicates.
5. For each of the 167 Apple codes, test set membership.
6. Cross-reference `COUNTRY_NAMES` for a display name; record raw-code fallback where absent.

This script is not currently a permanent repository test — it was run once, ad hoc, against the production files for this verification. If the Board wants this check to run automatically on every future change to either the storefront list or the SVG asset (regression protection against a future edit silently breaking coverage), that would be a small, separate, explicitly-scoped follow-up (a real test file, e.g. `tests/territory-svg-coverage-test.mjs`) — not undertaken here, since this request was verification-only.

---

## 7. Deliverable

This document: `governance/APPLE_STOREFRONT_SVG_TERRITORY_VERIFICATION.md`.

No production code was modified. No SVG asset was modified. No identifiers were renamed. No data was normalized beyond the case-insensitive comparison already used by the live rendering code itself.

---

## 8. Remediation Note — Canonical Territory Vocabulary Completion (2026-07-22)

This section documents the follow-up implementation authorized by the Board against the §4 finding above. It does not alter or remove any evidence in §1–§7; those remain the original verification record.

**Original finding (§4):** 72 of 167 Apple storefront codes had no entry in `COUNTRY_NAMES` and rendered raw ISO codes (e.g. "AG") instead of readable names ("Antigua and Barbuda") in tooltips and the Country Intelligence Panel.

**Implementation commit:** `b4f0f1c`, branch `feat/global-music-footprint-evidence-audit`, PR #395. Added all 72 missing entries to `COUNTRY_NAMES` in `lib/territory/canonical-territory-vocabulary.js`. No other export in that file was touched — `ALL_APPLE_STOREFRONTS`, `BIG6_STOREFRONTS`, `getCountryName()`, `normalizeStorefrontCode()`, `isKnownStorefront()` are byte-identical apart from the new object entries.

**Final validation result:** 167 / 167 codes now resolve to a real human-readable name. 0 raw-code fallbacks. 0 missing entries. 0 duplicate keys (checked both at the runtime object-key level and the raw source-text level, since JS silently allows duplicate literal keys). 0 duplicate name values among the 167 Apple storefronts. The §2/§3 polygon-matching results (167/167 SVG matches, 0 missing, 0 duplicates) were independently re-run after this change and are **unchanged** — this was a display-name-only addition; it does not touch code matching, polygon lookup, or any rendering logic in `global-map-choropleth.js`.

**Confirmation — no rendering or evidence logic changed:** Territory status values, evidence, confidence, `recommendedAction`, and `reason` fields are untouched — they come from the Territory Intelligence Engine, not this vocabulary file. Map color logic, territory matching (`el.getAttribute('id')` against `territoryByCode`), and SVG geometry are untouched. Live UI verification (real scans, both fixture and production Michael Jackson/Adele/Apple-storefront spot checks) confirmed correct names rendering in: map tooltips, the Country Intelligence Panel, and the Top Missing Markets / Distribution Gaps drawer (`gmf-distribution-gaps.js`) — representative codes tested across all four regions, including several that previously fell back to raw codes (`ag`, `kz`, `sz`, `cv`, `tl`, `ws`, `lc`, and others). Zero console errors at any point during this verification.

**Separate, pre-existing defect discovered during this verification (not part of this task's scope, not fixed here):** While spot-checking display names by clicking territories on the live map, three real Apple storefronts — Hong Kong (`hk`), Macau (`mo`), Taiwan (`tw`) — were found to display **China's** data in the Country Intelligence Panel instead of their own, despite each having its own correct, independent evidence record (confirmed directly via `sessionStorage`: Macau's own record correctly reads `{code: "mo", name: "Macau", status: "Available", ...}`). Root cause: `public/img/world-territories-map.svg` nests `<g id="hk">`, `<g id="mo">`, and `<g id="tw">` inside `<g id="cn">`; `global-map-choropleth.js` attaches an independent click listener to every matched element and never calls `event.stopPropagation()`, so a click on a nested child fires its own handler correctly, then bubbles to fire the parent China handler second, which overwrites the panel. This is a defect in the click-event wiring introduced during the Executive Visual Rebuild (`global-map-choropleth.js`, no commit hash change in this task), not in the territory vocabulary, evidence, or polygon-matching work covered by this document. Ten other parent/child nesting relationships exist in the same SVG (`ge`, `fr`, `rs`, `ma`, `nl`, `il`, `no`, `md`, `ua`, `cy`) but their nested children are non-Apple-storefront codes (Wikipedia-internal codes for disputed territories, e.g. `xk`, or dependent territories with no independent Apple evidence, e.g. `gp`, `bq`, `ps`), so clicking them either does nothing (no listener attached, since they have no evidence) or correctly bubbles to a parent that is the only real evidence-holder for that area — not a defect in those 10 cases. **Per this task's constitutional guidance ("do not alter the verified choropleth architecture," "do not alter map geometry, territory matching, canonical status logic"), this bug was not fixed under this task and requires a separate Board directive to authorize a fix** (adding `stopPropagation()` to the three affected click handlers in `global-map-choropleth.js`).
