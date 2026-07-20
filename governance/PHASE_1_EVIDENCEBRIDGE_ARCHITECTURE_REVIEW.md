# Phase 1 — EvidenceBridge Architecture Review

**Status:** Complete. No code changed. Supersedes the deletion plan for `lib/rie/EvidenceBridge.js`'s provider translators in `governance/NORMALIZATION_LAYER_PLATFORM_CERTIFICATION.md` (Finding N1) and Phase 1 remediation Item A.

---

## 1. Corrected findings

The original certification (Finding N1) concluded the 18 non-Apple/Spotify translator functions in `EvidenceBridge.js` were computed and discarded on every scan, and recommended deletion. That framing was too strong. Confirmed this session:

- **The translators are reachable.** `bridgeToCanonical()` has two production call sites: `lib/rie/index.js:336` (inside `runRIE()`) and `api/_lib/apple-pal-acquisition.js:172` (inside `synthesizeAppleMusicCompat()`).
- **The translators are tested.** `tests/certification/suites/07` through `13` — seven dated Board Certification suites (Phase 3.6/3.8, 2026-07-02/03) — import `bridgeToCanonical` directly and assert on each provider's translation output by name.
- **The translators are Board-certified.** These suites are wired into `tests/certification/harness.mjs`, the platform's permanent certification gate; all 20 suites passed in this session's baseline run.
- **The previous "zero test coverage" claim was accurate only for one file** (`lib/rie/__tests__/rie-activation.test.js`), not the certification suite as a whole.
- **The previous "architecturally unreachable" / "safe to delete" conclusion is retracted.**

## 2. Provider matrix

"Compat synthesis" = the function `run-scan.js` calls to build the legacy `rawResponse` shape. "Reaches canonicalForEnrichment (rich)" = whether the full provider object, not just a boolean flag, survives into what `normalizeAuditResponse()` and the RIE actually consume. "Overlap" = whether compat synthesis and the EvidenceBridge translator are independently-written implementations of the same parsing job.

| Provider | Compat synthesis | EvidenceBridge translator(s) | Reaches canonicalForEnrichment (rich)? | Merged in `_mergeApplePalEvidence`? | Certification suite | Overlap? | Classification |
|---|---|---|---|---|---|---|---|
| Apple Music | `synthesizeAppleMusicCompat()` — **calls `bridgeToCanonical()` internally** | `translateArtistIdentity`, `translateAlbums`, `translateTerritories` | Yes | Yes (PAL-authoritative) | 2.2/2.3/2.4 (Phase 1 cert) | No — one shared implementation, called twice | **KEEP** |
| Spotify | `synthesizeSpotifyCompat()` — independent parsing | `translateSpotifyArtistIdentity`, `translateSpotifyAlbums`, `translateSpotifyTopTracks` | Yes | Yes (PAL-authoritative, Phase 3.6) | 16-spotify-connector | Yes — two independent parsers; EvidenceBridge's result wins via deep-merge | **INVESTIGATE** |
| MusicBrainz | `synthesizeMBCompat()` — independent parsing | `translateMBArtistIdentity`, `translateMBRecordings`, `translateMBReleaseGroups` | No — boolean flag only | No | 07-musicbrainz-connector | Yes — neither implementation's rich output reaches canonical | **INVESTIGATE** |
| Discogs | `synthesizeDiscogsCompat()` — independent parsing | `translateDiscogsArtistIdentity`, `translateDiscogsReleases` | No — boolean + `discogsReleases` scalar | No | 08-discogs-connector | Yes, same pattern | **INVESTIGATE** |
| YouTube | `synthesizeYouTubeCompat()` — independent parsing | `translateYouTubeChannelIdentity`, `translateYouTubeChannelData` | Yes (compat path only) | No | 09-youtube-connector | Yes — compat path is the one consumed | **INVESTIGATE** |
| MLC | None (no `synthesizeMLCCompat`) | `translateMLCRecordings`, `translateMLCWorks` | N/A — live MLC path is separate (`fetchMlcWorksByArtist` + Board-locked `mlc-adapter.js`, feeds `cio.publishing` directly) | No | 10-mlc-connector | A third, independent, fully-dormant MLC parser | **INVESTIGATE** |
| Deezer | `synthesizeDeezerCompat()` — independent parsing | `translateDeezerArtistIdentity`, `translateDeezerAlbums`, `translateDeezerTopTracks` | Yes (compat path only) | No | 11-deezer-connector | Yes, same pattern as YouTube | **INVESTIGATE** |
| AudioDB | `synthesizeAudioDbCompat()` — independent parsing | `translateAudioDBArtistProfile`, `translateAudioDBDiscography`, `translateAudioDBVideos` | No — boolean flag only | No | 12-audiodb-connector | Yes, same pattern as MusicBrainz | **INVESTIGATE** |
| Last.fm | `synthesizeLastFmCompat()` — independent parsing | `translateLastFmArtistInfo`, `translateLastFmTopTracks`, `translateLastFmTopAlbums` | No — boolean + 2 scalars | No | 13-lastfm-connector | Yes, same pattern as MusicBrainz | **INVESTIGATE** |

Tidal has a compat synthesizer that reaches canonical rich, but no EvidenceBridge translator at all — no overlap, not part of this question.

## 3. Architectural conclusion

Three distinct patterns exist under one label:

1. **Apple** — intentional, non-duplicated. One implementation, two call sites. Nothing to resolve.
2. **Spotify** — two independent parsers, both live; EvidenceBridge silently wins the merge. Whether the two ever disagree is unverified.
3. **MusicBrainz, Discogs, YouTube, Deezer, AudioDB, Last.fm** — two independent parsers each; for 4 of 6, neither one's rich output reaches the canonical object at all. Reads as unresolved architecture, most plausibly explained by `ROADMAP.md`'s own "connector completion roadmap" item: each provider's acquisition-layer migration was certified provider-by-provider, ahead of a separate, not-yet-issued Board decision on merge authority.
4. **MLC** — a third, unrelated, fully-dormant parser alongside the real, Board-locked MLC path.

No deletion is recommended for any translator.

## Future Board Decisions

- Provider merge authority: should any of the 7 non-Apple/Spotify providers become merge-authoritative, matching Apple/Spotify?
- Spotify's dual-parser path: confirm the two implementations never diverge, or consolidate to one.
- Compatibility-synthesis strategy: should compat synthesis eventually consume the canonical translation layer instead of re-implementing it?
- No provider translator is authorized for deletion until the above are resolved via ADR.
