# Canonical Market Metadata Registry™

**Module:** Global Music Footprint™ (foundation layer, cross-cutting)
**Initiative:** Canonical Market Metadata Registry™ (Board-approved architecture enhancement)
**Status:** Implementation complete — MERGE NOT AUTHORIZED, pending Executive Board review
**Branch:** `feat/global-music-footprint-evidence-audit`
**Related PR:** #395
**Date:** 2026-07-22

---

## 1. Canonical Market Metadata Registry™

New file: **`public/js/canonical-market-metadata.js`**. A classic browser script (matches every other `public/js/` file in this codebase — no bundler, no `type="module"`, zero script-ordering risk introduced), exposing `window.RoyalteCanonicalMarketMetadata`:

- `REGISTRY` — 167 frozen territory records, one per real Apple storefront code, each with: `code`, `isoCode`, `appleStorefront`, `region`, `marketClassification`, `revenueOpportunityTier` (1/2/3), `displayOrder`, `enabled`.
- `getTerritory(code)`, `getTier(code)`, `tierLabel(tier)`, `getRegion(code)` — lookups.
- `deriveStrategicSignal(status, code)` — the one legitimate piece of logic in the file (see §5).

**All 167 entries were generated programmatically** from `lib/territory/canonical-territory-vocabulary.js`'s `ALL_APPLE_STOREFRONTS` (via a one-off Node script, not hand-transcribed), guaranteeing the registry's code list is byte-identical to the already-verified 167/167 canonical list — no risk of a manually-typed registry silently drifting from the real storefront set. Region assignment and `displayOrder` reproduce that same file's existing grouping and order (Americas 36 / Europe 44 / Middle East & Africa 55 / Asia Pacific 32) exactly, verified by summing the region boundaries against the real array length before generation.

`revenueOpportunityTier`/`marketClassification` reproduce exactly the Tier 1 (`us, ca, gb, de, jp, br, in, mx, fr, au`) and Tier 2 (`it, es, nl, kr, se, no`) lists from the prior Board brief — no additional codes were invented to fill out Tier 2 beyond what was explicitly given.

### Fields intentionally not included, and why

- **`name`** — omitted. Every real evidence object already carries `t.name` (sourced by the Territory Intelligence Engine from `getCountryName()`). Duplicating it here would be exactly the kind of second copy this registry exists to prevent.
- **`subRegion`, `strategicPriority`** — omitted entirely rather than populated with empty placeholder keys. No real source exists for `subRegion` yet. `strategicPriority` is not static metadata at all (see §5) — a country doesn't have one fixed priority; it depends on a specific artist's real-time catalog status.

### Fields explicitly reserved for future expansion — not implemented, not stubbed

`population`, `streamingAdoption`, `gdp`, `primaryLanguages`, `musicConsumptionIndex`, `appleMusicMarketSize`, `spotifyMarketSize`, `regionalGrowthRate`, `catalogDemandScore`, `historicalScanFrequency`, `distributorCoverage`, `rightsOrganizationPresence`, `emergingMarketFlag`, `athenaIntelligenceWeight`, `executiveOpportunityScore` — none of these were calculated, inferred, or added as empty keys. Each `REGISTRY` record is a plain object; adding any of these later is a matter of adding a real key with a real value, no structural rework required.

---

## 2. Migration Summary

| Step | Detail |
|---|---|
| Consumer audit | `grep -rn "market-priority\|RoyalteMarketPriority" public/` before touching anything, confirming `global-music-footprint.html` is the **only** real consumer anywhere in the repo. |
| Panel migration | `global-music-footprint.html`'s script tag changed from `/js/market-priority.js` to `/js/canonical-market-metadata.js`; the panel's call site changed from the two-step `MP.getTier(t.code)` → `MP.derive(t.status, tier)` to the single `CMM.deriveStrategicSignal(t.status, t.code)`. |
| `market-priority.js` retirement | File content replaced with a ~25-line deprecated shim: no logic of its own, delegates every call to `window.RoyalteCanonicalMarketMetadata`. Kept (not deleted) purely as the Board-required backward-compatibility safety net, clearly marked deprecated, with instructions in its own header for confirming when it's safe to delete. |
| Duplicate-shim cleanup | An earlier draft of `canonical-market-metadata.js` also defined a `RoyalteMarketPriority` alias inline; removed once the standalone shim file existed, so the compatibility alias lives in exactly one place, not two. |

**No functional regression**: every value the panel showed before this migration is byte-identical after it (see §4 Validation Results) — the same deterministic status+tier table, now sourced from the registry instead of the old file, with identical inputs producing identical outputs.

---

## 3. Dependency Map

```
public/workspaces/global-music-footprint.html
  └─ loads /js/canonical-market-metadata.js   (NEW — real dependency)
       └─ window.RoyalteCanonicalMarketMetadata.{getTier, tierLabel, deriveStrategicSignal}
  └─ (no longer loads /js/market-priority.js)

public/js/market-priority.js  (DEPRECATED SHIM — not loaded by any page today)
  └─ delegates to window.RoyalteCanonicalMarketMetadata if present
  └─ zero real consumers as of this migration (confirmed by repo-wide grep)
```

**Backend (Territory Intelligence Engine, ATHENA, Reporting): zero dependency on this registry today.** The Board's brief lists these as modules that "should eventually consume this registry" — none of them do yet, and this task does not wire them, per the explicit "Do not modify the Territory Intelligence Engine" constraint.

**Known limitation, disclosed rather than papered over**: `public/js/canonical-market-metadata.js` is a classic browser script, not an ES module — it cannot currently be `import`-ed by backend Node code (this repo runs `"type": "module"`, and a classic script has no `export` statements for `import` to resolve). Making it genuinely dual-environment (real backend + frontend single source) requires one of:

1. Converting this file to a real ES module and loading it in the browser via `<script type="module">` — technically clean, but changes how this page's other scripts would need to interoperate with it (module scripts execute deferred, unlike the classic scripts this page currently uses, which run synchronously in document order) — a real, if small, behavioral change requiring its own careful verification, not something to fold into this "no functional regression" migration.
2. A small, explicitly-labeled backend-side mirror that re-exports the same literal data — acceptable only as a documented, single-owner "generated from" relationship (same pattern used to generate this file itself), not silent duplication.

Neither was implemented here. This is flagged as a distinct, explicitly deferred follow-up decision for the Board, not solved by this Foundation-phase task — consistent with the brief's own "This is an architectural refactor... [not] modify Territory Intelligence Engine."

---

## 4. Validation Results

Live on a fresh Preview deployment, both the `?dev=1` fixture and synthetic Hong Kong/Macau/Taiwan/China evidence, comparing directly against the pre-migration values recorded in `GLOBAL_MUSIC_FOOTPRINT_PRIORITY_REVENUE_OPPORTUNITY.md`:

| Territory | Status | Tier (before → after) | Priority · Revenue Opportunity (before → after) |
|---|---|---|---|
| India | Unavailable | Tier 1 → Tier 1 | Critical · High → Critical · High |
| Brazil | Unavailable | Tier 1 → Tier 1 | Critical · High → Critical · High |
| United States | Available | Tier 1 → Tier 1 | No Action Needed → No Action Needed |
| Sweden | Available | Tier 2 → Tier 2 | No Action Needed → No Action Needed |
| Italy | Unknown | Tier 2 → Tier 2 | Medium · Low → Medium · Low |
| Poland | Unknown | Standard Market → Standard Market | Medium · Low → Medium · Low |
| Hong Kong (synthetic) | Unavailable | Standard Market → Standard Market | Medium · Low → Medium · Low |
| Macau (synthetic) | Available | Standard Market → Standard Market | No Action Needed → No Action Needed |
| Taiwan (synthetic) | Unknown | Standard Market → Standard Market | Medium · Low → Medium · Low |
| China (synthetic) | Available | Standard Market → Standard Market | No Action Needed → No Action Needed |

Zero deltas — every value identical before and after migration. Hong Kong/Macau/Taiwan continue to resolve independently with correct, individual results (confirms composition with the earlier click-resolution fix still holds).

Backend suite: `tests/pipeline-test.mjs` (222+8) re-confirmed clean — no backend file touched.

`node --check` passed on both new/modified JS files; a standalone Node functional test (loading both files with a mock `window` global) confirmed `REGISTRY.length === 167`, correct tier lookups, and correct shim delegation before deployment.

Console errors: zero.

---

## Constitutional Compliance Confirmation

- Territory Intelligence Engine: not modified.
- Evidence Resolution: not modified.
- Platform Availability, Artist Catalog Availability: not modified — confirmed identical output in the validation table above.
- The registry contains zero business logic, evidence calculations, or availability calculations — only static classification data plus the one documented status+tier combinator, which is presentational bucketing (analogous to `STATUS_DISPLAY_LABELS` already existing in `api/_lib/global-music-footprint.js`), not a territory/platform/artist-availability determination.
- No duplication introduced going forward: the tier/priority ruleset now lives in exactly one file; the deprecated shim contains no logic of its own.
- Fully responsive — no layout changed in this migration (data-source change only); prior responsive validation for this panel section stands unchanged.

---

## 5. Note on "Strategic Priority" as a registry field

The Board's field list named "Strategic Priority" as registry metadata. It is deliberately **not** stored as a static per-territory value in `REGISTRY`, because it isn't one — the same territory's real priority differs per artist and per scan (India is Critical for an artist missing there, but "No Action Needed" for an artist already available there). Storing a fixed "Strategic Priority" value per territory would either be wrong for most artists or would silently duplicate/contradict the real, evidence-driven signal `deriveStrategicSignal()` already computes correctly. The registry stores only the static half of that computation (`revenueOpportunityTier`); the dynamic half stays a function, not a stored field. Flagging this explicitly rather than silently deviating from the literal field list.

---

## Deliverables

1. Canonical Market Metadata Registry™ — `public/js/canonical-market-metadata.js`
2. Migration Summary — §2
3. Dependency Map — §3
4. Validation Results — §4
5. HTML Development Preview — `https://royalte-r8d9k4umz-darrylwest-7086s-projects.vercel.app/workspaces/global-music-footprint.html`
6. Commit hash — `7b5cb1c`
7. Pull Request — #395

---

## Merge Authority

Implementation and validation complete, zero functional regression confirmed. Merge is **NOT authorized** pending Executive Board review and sign-off.
