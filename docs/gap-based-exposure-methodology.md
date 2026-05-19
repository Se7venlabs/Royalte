# Gap-Based Exposure — Methodology

## Status: INITIAL — recalibrate post-beta with real user data

Every per-incident dollar range in this document is an INITIAL estimate. They
are deliberately wide and conservative. They will be recalibrated once real
user data (reported royalty discrepancies vs. detected gaps) is available. Do
not treat any figure here as precise — the component's own copy frames the
output as an operational observation, not a financial claim.

## Architectural principle

Exposure is derived from SPECIFIC detected backend gaps, not from artist
audience estimation. Each indicator has its own dollar-impact range tied to
the gap it detects. The aggregate is the sum of the per-indicator ranges.

This avoids the failure mode of audience-based estimation (the retired Phase 2
`estimateRoyaltyGap` model), which produced wildly wrong numbers when an
artist's real revenue comes from sources — sync, performance, mechanical, PRO
payouts — that audience signals such as streaming playcount cannot see.

## Indicator 1: Performance royalty routing — ISRC missing

- **Per-incident impact:** $50–$300/yr per release without a verified ISRC
- **Source:** ASCAP / BMI / SoundExchange unmatched-performance recovery data
- **Calibration:** average recovery rate at PRO audit for small-to-mid catalogs
- **Detectable from:** a track-input scan with `subject.trackIsrc` absent, or
  `catalog.appleMusic.albums[].isrcs.length === 0` where that data is present
- **Multiplier:** count of releases without a verified ISRC

## Indicator 2: Content ID gap — unmonetized UGC views

- **Per-incident impact:** $5–$50/yr per 1,000 unmonetized UGC views
- **Source:** YouTube published payout rates ($0.005–$0.05 per 1,000 views)
  plus Content ID coverage data
- **Calibration:** blended rate accounting for variable claim-approval rates
- **Detectable from:** the engine's `youtube.ugc.contentIdRisk` flag — true
  only when UGC is present *and* no official channel claims it. The indicator
  does **not** fire on a raw `estimatedViews` delta alone; a present official
  channel suppresses it (the content is treated as covered).
- **Multiplier:** estimated unmonetized UGC views / 1,000, gated as above

## Indicator 3: Cross-network distribution gap (primary catalog network)

- **Per-incident impact:** $200–$500/yr (15–25% audience-reach loss band)
- **Source:** Apple Music market-share data (~25% of US streaming, varies by
  territory)
- **Calibration:** catalog absence implies reach loss across iOS-primary
  listenership
- **Detectable from:** `appleMusic.catalogComparison.matchRate < 100`
- **Multiplier:** scaled by `(1 - matchRate)` against a baseline activity band

## Indicator 4: Publishing cross-reference gap (industry metadata registry)

- **Per-incident impact:** $50–$250/yr (5–10% publishing match-rate loss band)
- **Source:** the role of the industry metadata registry in publishing-data
  routing
- **Calibration:** rough industry estimate of match-rate degradation when the
  registry link is absent
- **Detectable from:** the registry (MusicBrainz) not VERIFIED
- **Multiplier:** flat band — applied once when the registry link is absent

## Indicator 5: Catalog age — extended royalty verification

- **Per-incident impact:** $3–$18 per release-year of unaudited catalog
  activity (INITIAL — the roughest figure in this document)
- **Source:** catalog age implies accumulation of unmatched activity over time
- **Calibration:** rough estimate; explicitly requires real data to refine
- **Detectable from:** `catalog.catalogAgeYears > 5`
- **Multiplier:** `catalogAgeYears × release count`

## Indicators with no clear dollar math — "Exposure pending validation"

These gaps are revenue-relevant but not directly quantifiable. They are
displayed with the label **"Exposure pending validation"** — never a
fabricated dollar range:

- Sync licensing discoverability (editorial absence affects sync-deal
  probability, not a measurable amount)
- Metadata richness (affects future revenue, not current)
- Ecosystem confidence (composite signal, no single dollar tie)
- Editorial reference absence (a sync-research path, no direct revenue)
- Genre metadata gaps (discoverability impact, not direct revenue)

"Exposure pending validation" is intentional: it reads as premium, measured,
and operational. Forcing a number where none is defensible would undermine the
whole model.

## Aggregate calculation

Aggregate exposure = sum of per-indicator low values to sum of per-indicator
high values, computed from QUANTIFIED indicators only.

- If every displayed indicator is "Exposure pending validation," the aggregate
  shows the same — no fabricated total.
- If some indicators are quantified and others are pending, the aggregate
  shows the quantified portion plus a note: "Additional exposure pending
  validation on N indicators."
- If no revenue-relevant gaps are detected at all, the component renders its
  empty state (green checkmark) — no gaps are invented to justify the card.

At most five indicators are displayed, sorted by severity (HIGH → MED → LOW).

## Recalibration plan

Post-beta, with real user data:

1. Cross-reference detected gaps against actual reported royalty discrepancies
   (user-submitted).
2. Tune per-incident ranges against real recovered amounts.
3. Add new indicators as new detection capabilities ship (MLC visibility,
   Content ID verification, territory weighting, PRO integration).
4. Quarterly methodology review.

## Sources

- ASCAP performance-royalty matching data
- BMI unmatched-performance recovery statistics
- SoundExchange digital-performance reports
- YouTube published Content ID monetization rates
- Apple Music market-share reports
- MusicBrainz cross-reference role in royalty pipelines

All sources are publicly available industry documentation. This document is
internal-only until the methodology is reviewed for public publication.
