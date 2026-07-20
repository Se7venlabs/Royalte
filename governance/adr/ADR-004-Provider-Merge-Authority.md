# ADR-004 — Provider Merge Authority (EvidenceBridge)

**Status:** Decision Pending — Board Review Required
**Raised during:** Platform Recovery Phase 1 (Foundation Recovery) — discovered while investigating Task A (EvidenceBridge translator deletion, subsequently cancelled)

## Problem

`lib/rie/EvidenceBridge.js` has a fully-built, individually Board-certified translator for 9 providers (Apple, Spotify, MusicBrainz, Discogs, YouTube, MLC, Deezer, AudioDB, Last.fm). Only Apple and Spotify are merge-authoritative — `lib/rie/index.js`'s `_mergeApplePalEvidence()` only ever merges those two providers' bridged output into `canonicalForEnrichment`. For MusicBrainz, Discogs, and AudioDB specifically, not even the separate "compat synthesis" path's rich data reaches the canonical object — only a boolean presence flag survives. Each provider's PAL connector + EvidenceBridge translator + certification suite was built and locked as that provider's acquisition-layer migration completed (dated Board Certifications, Phase 3.6/3.8, 2026-07-02/03), but no corresponding "Provider X is now merge-authoritative" directive was ever issued for the 7 non-Apple/Spotify providers.

## Evidence

- `lib/rie/index.js:233-270` (`_mergeApplePalEvidence`) — only merges `bridged.subject`, `bridged.platforms.appleMusic`, `bridged.platforms.spotify`, `bridged.source`.
- `tests/certification/suites/07` through `13` — seven dated, named Board Certification suites, each specifically verifying "EvidenceBridge: [Provider] translation," all passing.
- `api/_lib/run-scan.js:395-438` — confirms `musicbrainz`/`discogs`/`audiodb`/`lastfm`'s compat-synthesized rich objects never become root keys on `rawResponse`; only Deezer/Tidal/YouTube/Apple get that treatment.
- `governance/ROADMAP.md`'s "Next Engineering Target" section — "Connector completion roadmap — finish remaining Connectors™" is a named, unauthorized candidate initiative, consistent with this being planned-but-not-yet-decided work rather than an oversight.
- `governance/PHASE_1_EVIDENCEBRIDGE_ARCHITECTURE_REVIEW.md` — full provider-by-provider matrix and findings this ADR formalizes.

## Architectural Options

**A. Promote some or all 7 providers to merge-authoritative.**
Extend `_mergeApplePalEvidence()` (or its successor) to merge additional providers' bridged output, matching Apple/Spotify's pattern. Turns already-certified, already-tested infrastructure into live functionality with comparatively little new code. Requires deciding, per provider, whether EvidenceBridge's translation should win over the existing compat-synthesis path where both are live today (Deezer, YouTube) — a real behavior change for those two.

**B. Formally park the non-Apple/Spotify translators as intentional future-readiness infrastructure.**
Document (as this ADR and the architecture review do) that these are built-ahead, tested, not-yet-authorized-for-merge — a deliberate staging area, not debt. Zero engineering cost beyond documentation. Leaves real, tested capability unused indefinitely with no committed timeline.

**C. Retire EvidenceBridge's coverage for providers unlikely to ever be promoted.**
For providers where the compat-synthesis path is judged sufficient long-term (e.g., if AudioDB/Last.fm are considered "enough" as boolean-flag-only signals), remove their EvidenceBridge translators specifically, keeping the ones for providers plausibly on a real promotion path. Requires the Board to make a per-provider judgment call this document doesn't have the evidence to make.

## Trade-offs

| | A: Promote | B: Park, document | C: Retire selectively |
|---|---|---|---|
| Uses existing certified work | Yes | Not yet | Partially — discards some of it |
| Engineering cost | Medium — per-provider merge logic + behavior-change review for Deezer/YouTube | Low — documentation only | Low-Medium — per-provider deletion decision |
| Risk | Behavior change for 2 already-live compat paths | None | Loses tested infrastructure if judgment is wrong |
| Resolves the "why do two parsers exist" question | Yes, for promoted providers | No — leaves it open | Yes, for retired providers |

## Recommendation

Option B in the near term (already reflected in `governance/PHASE_1_EVIDENCEBRIDGE_ARCHITECTURE_REVIEW.md`'s "Future Board Decisions"), with Option A as the natural next step if and when the Board authorizes the "connector completion roadmap" `ROADMAP.md` already names as a candidate initiative. No basis in current evidence for Option C on any specific provider — that judgment call belongs to whoever owns the product roadmap for what Mission Control ultimately surfaces from each provider.

## Consequences

- **If A (any provider promoted):** for Deezer and YouTube specifically, promotion means deciding whether EvidenceBridge's translation should override the currently-live compat-synthesis path — a real behavior change for data two providers already expose today, not just new data appearing.
- **If A (MusicBrainz/Discogs/AudioDB):** promotion effectively activates previously-invisible data on Mission Control surfaces for the first time — needs its own UI/product review, not just a backend wiring change.
- **If B (park, no promotion):** zero behavior change; the "why do two parsers exist per provider" question stays open and will resurface in any future certification phase touching these providers.

## Migration Strategy

- **Option A, per provider:** extend `_mergeApplePalEvidence()` (or a generalized successor) to merge that provider's bridged branch; re-run certification suite 07–13 for that provider plus the full harness; for Deezer/YouTube specifically, diff EvidenceBridge's output against the existing compat-synthesis output on real evidence first, to confirm promotion doesn't silently change values Mission Control already displays.
- **Option C, per provider:** remove the specific provider's translator functions and certification suite section together — cannot repeat the mistake this session already caught once (deleting certified code); requires an explicit Board sign-off per provider, not a blanket removal.

## Rollback Considerations

- Option A is code-revertible; because promotion changes what reaches `audit_scans.payload`, any scan persisted *while* a provider was promoted retains that richer data even after a revert — not a correctness problem (old data stays valid), but worth the Board knowing rollback doesn't retroactively un-enrich already-persisted scans.
- Option C rollback would mean restoring deleted, certified code from git history — recoverable, but loses the "currently certified and green" state until re-verified.

## Dependencies

- Independent of ADR-001, ADR-002, ADR-003.
- Loosely coupled to `governance/ROADMAP.md`'s unauthorized "Connector completion roadmap" candidate initiative — Option A here would likely be scoped as that initiative's first concrete work item if authorized.

## Board Decision

*Pending.*

## Final Resolution

*Pending.*
