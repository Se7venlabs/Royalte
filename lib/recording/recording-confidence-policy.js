// Royaltē Recording Intelligence™ — Recording Confidence Policy
//
// Board-ratified constants for the Recording Confidence engine.
// Algorithms compute. Policy defines Board-approved constants.
//
// Board Authorization: Phase 3.7 Amendment (2026-07-02) — UNANIMOUS
//
// RECORDING_CONFIDENCE_POLICY is immutable. No implementation code may
// embed confidence weights directly. The algorithm in recording-confidence.js
// reads exclusively from this module.
//
// Weight Rationale (Board Record):
//   isrc (55%) — ISRC is the industry's primary recording identifier and has
//                the greatest impact on royalty matching, rights administration,
//                cross-platform reconciliation, and backend integrity.
//
//   provider (20%) — Multi-provider agreement is valuable evidence but should
//                    not outweigh a verified ISRC.
//
//   title (15%) — Title agreement is supporting evidence; normalized titles
//                 converging strengthens identity confidence.
//
//   artist (10%) — Reserved; activates when Apple and Spotify artist names
//                  can be compared across providers.
//
// Total must equal 1.00. Enforced by the certification harness.
//
// To change weights: Board must ratify; update this file only; no algorithm
// changes are required.

export const RECORDING_CONFIDENCE_POLICY = Object.freeze({
  weights: Object.freeze({
    isrc:     0.55,  // Board-ratified 2026-07-02
    provider: 0.20,  // Board-ratified 2026-07-02
    title:    0.15,  // Board-ratified 2026-07-02
    artist:   0.10,  // Board-ratified 2026-07-02
  }),
});
