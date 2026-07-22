# Global Music Footprint™ — Platform Availability vs Artist Catalog Availability

**Module:** Global Music Footprint™
**Initiative:** Territory Intelligence™ UI Enhancement (Board-approved)
**Status:** Implementation complete — MERGE NOT AUTHORIZED, pending Executive Board review
**Branch:** `feat/global-music-footprint-evidence-audit`
**Related PR:** #395
**Date:** 2026-07-22

---

## Background

During Board validation, India and South Africa displayed `Status: Unavailable` / `Reason: Catalog not found in this storefront`. Investigation confirmed the underlying evidence was correct — Apple's storefront exists in both territories, the lookup succeeded, the Territory Intelligence Engine worked correctly, and the artist's catalog is genuinely not listed there. The ambiguity was presentational: a single "Provider Coverage" row conflated "does Apple operate here" with "is this artist's catalog here," so a real catalog gap could read as a platform outage.

## Real data source — not inferred, not hardcoded

`api/_lib/territory-intelligence.js`'s `assembleTerritoryIntelligence()` iterates `ALL_APPLE_STOREFRONTS` exclusively (`lib/territory/canonical-territory-vocabulary.js`) — every territory it ever produces is, by construction, one where Apple operates a storefront. This was previously an implicit invariant; it is now an explicit, engine-sourced field:

```js
platformSupport: [{ provider: 'apple_music', supported: true }]
```

added per-territory inside the Engine (`TERRITORY_INTELLIGENCE_VERSION` 1.0.0 → 1.1.0), threaded unchanged through `api/_lib/global-music-footprint.js`'s `buildDistributionGaps()` (`GLOBAL_MUSIC_FOOTPRINT_VERSION` 1.2.0 → 1.3.0). The frontend reads this field directly — it does not compute or guess platform support itself. The array shape (rather than a single boolean) is deliberate: a future multi-provider phase appends additional `{ provider, supported }` entries with no schema change, matching the "Future Ready" requirement without building multi-provider logic today.

## Country Intelligence Panel changes

`public/workspaces/global-music-footprint.html`, `showCountryPanel()`. The former single "Provider Coverage" section is now two:

**Platform Availability** — one row per entry in `t.platformSupport`: provider display name, "✅ Supported" / "❌ Not Supported" (real, from the field above).

**Artist Catalog** — one row: the real artist name (`ctx.artistName`, from the loaded scan context) with "✅ Available" / "❌ Not Available" / "— Not yet assessed", using the exact same `t.status`/`t.providers` logic that was already there (unchanged — the "providers[] means evidence, not confirmation" distinction from earlier in this initiative still applies and still gates the label correctly).

Market Details, Recommended Action, and Assessment Summary sections are unchanged, per the Board's "do not invent new recommendations" instruction.

## Validation

Tested live on a fresh Preview deployment, both the `?dev=1` fixture (artist "Black Alternative") and synthetic evidence injected for territories the fixture doesn't cover:

| Territory | Apple Music | Artist Catalog |
|---|---|---|
| India | ✅ Supported | ❌ Not Available |
| South Africa | ✅ Supported | ❌ Not Available |
| United States | ✅ Supported | ✅ Available |
| Canada | ✅ Supported | ✅ Available |
| Hong Kong | ✅ Supported | ❌ Not Available |
| Macau | ✅ Supported | ✅ Available |
| Taiwan | ✅ Supported | ❌ Not Available |
| China | ✅ Supported | ✅ Available |

All match canonical evidence exactly — same underlying `status`/`providers` values as before this change, only the presentation is new. Hong Kong/Macau/Taiwan were included specifically to confirm this change composes cleanly with the SVG event-resolution fix (`GLOBAL_MUSIC_FOOTPRINT_SVG_EVENT_RESOLUTION_AUDIT.md`) shipped earlier on this same branch — each nested territory shows its own correct Platform/Catalog split, no cross-contamination from China.

Backend suite: `tests/pipeline-test.mjs` (222+8), `lib/rie/__tests__/rie-activation.test.js` (20/20), `tests/cio-assembler-test.mjs` (17/17) — all pass unchanged.

Console errors: zero, at desktop (1568px), tablet (834px), and mobile (390px, tool floor ~606px — a known automation-tool limitation, not a page defect).

## Incidental fix — pre-existing, disclosed

While performing the required tablet check, found that `.gf2-panel-empty`'s CSS rule (`display: flex`) had identical specificity to the browser's default `[hidden] { display: none }`, so the author rule always won regardless of the `hidden` attribute `showCountryPanel()` sets — the empty-state placeholder ("Select a territory...") rendered simultaneously with populated panel content. Silent at some breakpoints, visible at tablet width where the panel stacks full-width below the map. Pre-existing since the Executive Visual Rebuild, unrelated to this change's logic; fixed by scoping the rule to `.gf2-panel-empty:not([hidden])` — one line, pure CSS specificity correction, no effect on any evidence, status, or layout dimension.

## Constitutional Compliance Confirmation

- Territory Intelligence Engine calculations: unchanged — `platformSupport` is a new, additive, real field, not a recomputation of any existing value.
- Evidence acquisition: not modified.
- Canonical territory status, provider confidence: not modified.
- Global Music Footprint™ workspace: not redesigned — one panel section split into two, using the Board's own suggested layout and labels.
- Platform support and artist catalog availability are now independently represented, sourced from the canonical Engine, never inferred client-side.
- Structure supports future multi-provider expansion without a shape change.
- Responsive across desktop/tablet/mobile — confirmed live.

## Deliverables

1. Updated Country Intelligence Panel — `public/workspaces/global-music-footprint.html`
2. Validation — see table above (screenshots taken live during Board session review)
3. Desktop review — 1568px, confirmed clean
4. Tablet review — 834px, confirmed clean (after the empty-state fix)
5. Mobile review — 390px, confirmed clean (tool floors at ~606px; real DOM content verified directly)
6. HTML Development Preview — `https://royalte-1vkk7lm5j-darrylwest-7086s-projects.vercel.app/workspaces/global-music-footprint.html`
7. Commit hashes — `ef53687` (Platform/Catalog split), `68de138` (empty-state fix)
8. Pull Request — #395

---

## Merge Authority

Implementation and validation complete. Merge is **NOT authorized** pending Executive Board review and sign-off, consistent with every prior phase of this initiative.
