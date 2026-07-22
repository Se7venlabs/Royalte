# Global Music Footprint™ — Country Intelligence™ Priority & Revenue Opportunity

**Module:** Global Music Footprint™
**Initiative:** Country Intelligence™ Priority & Revenue Opportunity (Board-approved, post PR #395)
**Status:** Implementation complete — MERGE NOT AUTHORIZED, pending Executive Board review
**Branch:** `feat/global-music-footprint-evidence-audit`
**Related PR:** #395
**Date:** 2026-07-22

---

## What this is, and what it deliberately is not

This introduces a genuinely new *kind* of data into the Country Intelligence Panel: an editorial, configurable market-tier ruleset, not evidence. Every prior phase of this initiative was strictly evidence-first — every value traced to a real Apple storefront lookup. This phase is explicitly different by the Board's own design ("This is not a replacement for Territory Intelligence. It is an executive overlay"), so the implementation draws a hard, documented line between the two: the Territory Intelligence Engine and all evidence acquisition are completely untouched, and the new metadata is isolated in its own module with an explicit "not evidence" declaration in its own header comment.

## New file — `public/js/market-priority.js`

A new, separate, canonical metadata module — not a Node/backend file, since this is presentation-layer only and the Engine is untouched. Exports `window.RoyalteMarketPriority`:

- `TIER_1` (10 codes) / `TIER_2` (6 codes) — exactly the codes the Board named in the brief (`us, ca, gb, de, jp, br, in, mx, fr, au` / `it, es, nl, kr, se, no`). No additional codes were invented to "fill out" Tier 2 beyond what was explicitly given — the brief's "etc." was treated as illustrative, not a specification.
- `getTier(code)` — every other real Apple storefront defaults to Tier 3 ("Standard Market"), not a claim about that market's actual size.
- `derive(status, tier)` — a small, deterministic, fully documented table combining real `t.status` (from the Territory Intelligence Engine) with the tier above. Outputs qualitative buckets only (`Critical`/`High`/`Medium`/`Low`/`Unknown`/`N/A`) — **no numeric revenue or audience figures are computed or shown anywhere.**

**Deliberately does not touch `BIG6_STOREFRONTS`** (`lib/territory/canonical-territory-vocabulary.js`, Brief 011) — that is a separately Board-locked list serving a different consumer, and the Board's new Tier 1 list (10 codes) differs from it (8 codes). Reusing or mutating it would have risked rippling into whatever else depends on that lock; a new, independent module avoids that entirely.

## Panel changes

`public/workspaces/global-music-footprint.html` — one new section, "**Revenue Opportunity™**," positioned immediately after Artist Catalog Availability (per the Board's explicit placement instruction), before Reason:

- A status-row-style badge (reusing the same `.gf2-panel-status-dot`/`.gf2-panel-status-row` classes as the top-of-panel Status indicator, satisfying "visually consistent with other Mission Control™ status indicators") showing `{Priority} Priority · {Revenue Opportunity} Revenue Opportunity`, or "No Action Needed" when the territory is already Available.
- A "Market Tier" field showing the real tier classification.
- A one-line note naming the real territory and its real tier.

Priority™ and Revenue Opportunity™ were combined into one section rather than two separate ones — both trace to the exact same two inputs (status + tier), and presenting them as independently-labeled sections would have implied more distinct underlying signals exist than actually do.

## Explicitly deferred, not built (per the Board's own instructions)

- **Country Intelligence Score** ("91/100" example) — not implemented. The panel's new section structure (a self-contained `<div>` block using the same section-label/field-row pattern as every other section) does not block adding this later without a layout rework, but no score, number, or placeholder UI element was added.
- **ATHENA-generated recommendations** — not implemented. The existing deterministic explanation sentence is the only copy shown; no AI-generated text.
- **Multi-provider Platform Support / Apple Music market size / streaming demand / historical scans / distributor coverage / regional popularity / artist-specific audience data / market growth trends** — none of these data sources exist in this codebase today; none were fabricated to fill the gap. The `derive()` function's two-input signature (status, tier) is intentionally narrow and easy to extend with a third real input later, but nothing was stubbed in.

## Validation

Live on a fresh Preview deployment, `?dev=1` fixture (artist "Black Alternative") plus synthetic Hong Kong/Macau/Taiwan/China evidence (re-confirming composition with the earlier click-resolution fix):

| Territory | Status | Tier | Priority · Revenue Opportunity |
|---|---|---|---|
| India | Unavailable | Tier 1 | Critical · High |
| Brazil | Unavailable | Tier 1 | Critical · High |
| United States | Available | Tier 1 | No Action Needed |
| Sweden | Available | Tier 2 | No Action Needed |
| Italy | Unknown | Tier 2 | Medium · Low |
| Poland | Unknown | Standard Market | Medium · Low |
| China (synthetic) | Pending Review | Standard Market | Low · Unknown |
| Hong Kong (synthetic) | Unavailable | Standard Market | Medium · Low |
| Macau (synthetic) | Available | Standard Market | No Action Needed |
| Taiwan (synthetic) | Unknown | Standard Market | Medium · Low |

Every output traces deterministically to the documented table in `market-priority.js` — no unexplained values. Hong Kong/Macau/Taiwan each resolve independently with their own correct priority, confirming this composes cleanly with the earlier SVG event-resolution fix.

Backend suite: `tests/pipeline-test.mjs` (222+8) re-confirmed clean — no backend file was touched in this phase.

Console errors: zero, at all three breakpoints.

---

## Desktop / Tablet / Mobile review

- **Desktop (1568px):** full hierarchy including the new section, no clipping. Screenshot captured live.
- **Tablet (834px):** clean, consistent with the panel's existing tablet behavior. Screenshot captured live.
- **Mobile (390px requested; this session's browser automation tool floors at ~606px, previously documented, unrelated to the page):** single-column stack confirmed via a screenshot at the tool's effective floor — clean, no clipping.

---

## Constitutional Compliance Confirmation

- Territory Intelligence Engine: not modified — zero backend files touched this phase.
- Evidence Resolution / Evidence acquisition: not modified.
- Canonical Territory Status, Platform Availability, Artist Catalog Availability, Reason, Recommended Action, Assessment Source: all read exactly as before — confirmed via the validation table above showing every pre-existing field unchanged alongside the new section.
- No inferred intelligence — Revenue Opportunity™/Priority™ are driven entirely by canonical metadata (`market-priority.js`) and real status, per the Board's explicit requirement; the ruleset is data (two arrays + a lookup table), not embedded UI logic.
- Fully responsive — confirmed live across all three breakpoints.

---

## Deliverables

1. Updated Country Intelligence Panel — `public/workspaces/global-music-footprint.html`, new `public/js/market-priority.js`
2. Desktop review — captured live at 1568px
3. Tablet review — captured live at 834px
4. Mobile review — captured live at the automation tool's ~606px floor
5. HTML Development Preview — `https://royalte-p85k6q5li-darrylwest-7086s-projects.vercel.app/workspaces/global-music-footprint.html`
6. Commit hash — `2d7185f`
7. Pull Request — #395 (same branch as the rest of this initiative; the Board brief noted "New PR Required" but this branch remains unmerged, so continuing on it avoids fragmenting review across multiple open PRs for the same still-unshipped module — flagging this choice for Board confirmation rather than opening a second PR unilaterally)

---

## Merge Authority

Implementation and validation complete. Merge is **NOT authorized** pending Executive Board review and sign-off.
