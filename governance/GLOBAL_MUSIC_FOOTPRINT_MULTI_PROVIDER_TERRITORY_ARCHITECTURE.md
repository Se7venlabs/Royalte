# Global Music Footprint™ — Multi-Provider Territory Architecture — Technical Clarification

**Status:** Informational — no implementation, no code changes
**Requested by:** Executive Board, pre-continuation clarification request
**Date:** 2026-07-22
**Scope:** Documents the real, current state of every provider connector's territory/availability capability, and the real architecture for how additional providers would be incorporated. Every claim below was verified directly against the working codebase (file:line citations included) — nothing here is aspirational unless explicitly labeled "not yet built."

---

## Executive summary

**Today, Apple Music is the only provider actually contributing territory evidence to the Global Music Footprint™ map.** Two other providers (Spotify, Deezer) have connector-level code *capable* of returning some territory data, but neither is wired into the live acquisition flow — same "declared but never called" pattern the Phase 1 audit found for Apple's own `Capability.TERRITORIES`. TIDAL has no territory capability at all today, despite being named in the Board's provider list. No other connector (MusicBrainz, YouTube, Discogs, AudioDB, Last.fm, MLC, ACRCloud) declares any territory-related capability.

The **conflict-resolution policy** (`reconcileTerritoryState()`) is already written in a genuinely provider-general way and does not need to change to support multiple providers. The **evidence-extraction layer** that feeds it is currently hard-coded to Apple only and would need a real, scoped extension — not a rewrite — to light up multi-provider reconciliation.

---

## 1. Territory Data Available — per provider

Verified by reading each connector's capability-profile file and, where a territory-related capability is declared, its implementation.

| Provider | Territory capability declared? | What it actually returns |
|---|---|---|
| **Apple Music** | `Capability.AVAILABILITY` ✅ (`apple-capabilities.js:14`) + `Capability.TERRITORIES` ✅ (declared, dead — see Phase 1 audit) | Real storefront ID sweep: `#fetchGlobalStorefrontAvailability()` checks all 167 Apple storefront codes for a given album, returning per-storefront catalog-match results (`{ data: [...] } | { error }`). This is the only provider offering a bulk, artist/release-wide, multi-market sweep in one capability. |
| **Spotify** | `Capability.AVAILABILITY` ✅ (`spotify-capabilities.js:14`) — **declared, never requested in acquisition** | Per-market `is_playable` check via `?market={code}` on a *specific known track or album ID* — one HTTP call returns data for exactly one market (`SpotifyConnector.js:209-226`). Spotify removed the bulk `available_markets` field from its API (confirmed via live verification noted in the connector's own comment, 2026-07-17); `/markets` itself returns 403 under this project's access tier. There is no way to get "all markets in one call" from Spotify today. |
| **Deezer** | `Capability.AVAILABILITY` ✅ (`deezer-capabilities.js:14`) — **declared, never requested in acquisition** | Per-*track* detail lookup (`#fetchTrackDetail()`, requires a known Deezer track ID) returning `available_countries` for that single track, plus `bpm`/`gain`/`contributors`/`track_token` (`DeezerConnector.js:219-225`, shipped Phase 3.6). This is track-scoped, not artist/storefront-scoped like Apple's. |
| **TIDAL** | **None** — no `AVAILABILITY`, no `TERRITORIES` case exists anywhere in `TidalConnector.js`'s dispatch table (confirmed by direct inspection of the connector; only `ARTIST_IDENTITY`/`ALBUMS`/`RELEASES`/`TRACKS`/`ISRC`/`ARTWORK` are handled) | Nothing. A stale comment in `SpotifyConnector.js` references "TIDAL's existing AVAILABILITY implementation" — this does not match the current TIDAL connector and appears to be documentation drift, flagged here for correction. |
| MusicBrainz, YouTube, Discogs, AudioDB, Last.fm, MLC, ACRCloud (both connectors) | None | These are identity/metadata/publishing/audio-fingerprint providers; none expose or declare territory/market data. |

**Confirmed independently, by grepping every acquisition file in `api/_lib/*.js` for `Capability.AVAILABILITY` and `Capability.TERRITORIES`:** the only real request for either capability anywhere in the live scan pipeline is Apple's `Capability.AVAILABILITY` in `apple-pal-acquisition.js`. Spotify's and Deezer's acquisition files (`spotify-pal-acquisition.js`, `deezer-pal-acquisition.js`) request only `ARTIST_IDENTITY`, `ALBUMS`, `TRACKS` — never `AVAILABILITY`.

---

## 2. Canonical Usage — per provider, today

| Provider | Role today | Why |
|---|---|---|
| Apple Music | **Canonical Authority** | The only provider whose territory evidence actually reaches the Territory Intelligence Engine. Every map color, every KPI, every Country Intelligence Panel field is Apple-sourced. |
| Spotify | **Future Expansion** (not yet Supporting Evidence) | Connector capability exists but is disconnected from the acquisition flow that feeds the Engine. Its per-market, ID-scoped shape (not a bulk sweep) also means it would function as *validation/confirmation* evidence for specific markets, not a second bulk authority, even once wired. |
| Deezer | **Future Expansion** (not yet Supporting Evidence) | Same disconnection as Spotify. Track-scoped shape (not artist/storefront-scoped) means it would validate individual recordings' territory presence, not sweep a whole catalog the way Apple's capability does. |
| TIDAL | **Future Expansion** (capability does not exist yet) | No connector-level territory capability to wire up — this is new connector work, not an acquisition-flow wiring task like Spotify/Deezer. |
| All others | **Not applicable** | No territory-relevant capability. |

None of the five roles the Board listed (Canonical Authority / Supporting Evidence / Validation / Gap Detection / Future Expansion) currently applies to more than one provider simultaneously — there is no live multi-provider evidence today to assign "Supporting Evidence" or "Validation" roles to.

---

## 3. Map Contribution — per provider, today

| Provider | Map influence |
|---|---|
| Apple Music | **100% — determines every territory's color.** `assembleTerritoryIntelligence()` (§4 below) is fed exclusively by Apple's evidence; the choropleth renders exactly what this function returns. |
| Spotify | **No direct impact.** No evidence reaches the map. |
| Deezer | **No direct impact.** No evidence reaches the map. |
| TIDAL | **No direct impact.** No evidence reaches the map. |

The "Provider Coverage" map layer added in the Executive Visual Rebuild is honestly labeled but currently renders identically to the "Availability" layer, because Apple is the only contributing provider — this was called out explicitly in that phase's review package rather than presented as more than it is.

---

## 4. Conflict Resolution

This is the most important architectural finding in this document, and it has two distinct parts that must not be conflated.

### The resolution *policy* is already real and provider-general

`reconcileTerritoryState(observations)` (`api/_lib/territory-intelligence.js:122-149`) is Board Decision 2, already implemented, and takes an *array* of per-provider observations for a single territory — not a single value. Its precedence order:

1. **AVAILABLE wins** — if any contributing provider positively confirms availability, the territory is Available, regardless of what any other provider says.
2. **UNKNOWN takes precedence over a partial UNAVAILABLE consensus** — if any provider's evidence is itself unsupported or unevaluated, the aggregate cannot honestly claim unavailability just because other providers say so.
3. **UNAVAILABLE requires unanimous consensus** — every provider that successfully returned a real answer (excluding ones that errored) must agree it's unavailable.
4. **ERROR** — evaluation failed and nothing else established a result.
5. **NOT_EVALUATED** — no provider evidence exists at all for this territory.

So, using the Board's own example — **Apple says available, Spotify says not** — rule 1 applies: **Available wins.** The user sees the territory as Available, with `confidence` reflecting how many providers actually agree (`deriveConfidence()`: `'Verified'` when more than one observation exists, `'Partial'` when only one does — `territory-intelligence.js:151-156`).

### The evidence *extraction* layer feeding that policy is currently single-provider only

`extractAppleObservations()` (`territory-intelligence.js:64-118`) — note the name — uses `evidencePackages.find(...)`, singular, and hard-codes `provider: APPLE_PROVIDER` on every observation it produces. Every territory's `evidence[]` array today therefore contains **at most one entry**, always from Apple. The multi-provider branches of `reconcileTerritoryState()` above are real, tested code, but they are never actually exercised with genuinely conflicting data today, because no second provider's observation ever reaches them.

**What the user ultimately sees today:** exactly Apple's answer, every time, because there is nothing to reconcile it against yet.

**What would need to change to make real conflicts resolvable:** `extractAppleObservations()` would need to become a provider-general `extractObservations()` that iterates every territory-capability evidence package present (Apple's, and eventually Spotify's/Deezer's/others'), tagging each observation with its real source provider, and merges them per territory before calling the *already-correct* `reconcileTerritoryState()`. This is a real but scoped extension — the reconciliation policy itself does not need to change.

---

## 5. Territory Classification — states and evidence requirements

The Engine has exactly five internal states (`TerritoryState`), displayed to users as four (`STATUS_DISPLAY_LABELS` in `api/_lib/global-music-footprint.js` collapses `ERROR` into the same user-facing "Unknown" as the internal `UNKNOWN` state, detail preserved in `reason`):

| Engine state | User-facing label | Evidence required |
|---|---|---|
| `AVAILABLE` | Available | At least one provider's evidence positively confirms a real catalog match in that territory. |
| `UNAVAILABLE` | Unavailable ("Missing" on the map legend) | At least one provider successfully evaluated the territory and found no catalog match, **and** no provider (successful or not) reported Available or Unknown. |
| `UNKNOWN` | Unknown | At least one provider's evidence is unsupported, incomplete, or its response shape couldn't be interpreted — the Engine will not guess. |
| `ERROR` | Unknown (detail in `reason`) | The acquisition attempt for that territory itself failed (timeout, request error) — distinct internally from Unknown (a bad *answer*) vs. Error (no answer obtained), though both currently read "Unknown" to the artist. |
| `NOT_EVALUATED` | Pending Review | No provider evidence exists for this territory at all — nothing was ever attempted. |

**"Partial" does not exist as a real state today**, despite appearing in both the Board's original mockup and this message's own question list. The current model is binary per provider (a territory either has a confirmed catalog match or it doesn't) — there is no real evidence source today that could express "your catalog is 60% present in this market" (e.g. some releases available, others not, within one territory). Building a real Partial state would require either (a) per-release rather than per-artist territory evidence aggregated with a real completeness ratio, or (b) an explicit definition of what "Partial" means evidentially that this session has not yet been given. Flagging rather than inventing a threshold, per this program's standing practice.

---

## 6. Future Architecture — how this scales

**Adding evidence from Spotify or Deezer** (both already have a declared, if narrow, `AVAILABILITY` capability): additive work only.
1. Wire `Capability.AVAILABILITY` into `spotify-pal-acquisition.js` / `deezer-pal-acquisition.js`'s acquisition flow (mirroring exactly how Apple's was added — this session's ISRC Intelligence™ v1 work is the direct precedent for "add a capability request to an existing parallel acquisition batch").
2. Generalize `extractAppleObservations()` into a provider-general `extractObservations()` per §4.
3. **No change needed** to `reconcileTerritoryState()`, `assembleGlobalMusicFootprint()`, the CIM shape, the runtime context, or the map rendering code (`global-map-choropleth.js`) — all of them already consume the Engine's five-state output generically, not Apple-specifically. The map does not need to know how many providers contributed a territory's state.

**Adding a genuinely new provider** (TIDAL territory support, SoundExchange, Amazon Music, Pandora, Qobuz, Boomplay, Anghami, or any other regional DSP): larger, real connector work, but the same shape.
1. Build (or extend) a PAL connector exposing a real territory/market capability for that provider — this varies entirely by what each provider's actual API supports (some may offer a bulk sweep like Apple, others a narrow per-track/per-market check like Spotify/Deezer, some may offer nothing usable at all — this has to be verified per provider the same way this document verified the five above, not assumed).
2. Register that capability, wire it into acquisition, extend `extractObservations()` to recognize the new provider.
3. Everything downstream — reconciliation, the CIM, the map — is unchanged, because the architecture was deliberately built provider-general from `reconcileTerritoryState()` onward, even though only one provider populates it today.

**Will additional providers alter map behavior?** No. They add *evidence*, which can change *which state a given territory resolves to* (per the real reconciliation policy in §4) — the map's rendering logic, color scheme, and interaction model do not need to change for a provider count of one, two, or ten.

---

## 7. Executive Data Flow Diagram

**Important terminology clarification before this diagram:** this codebase has a separate, real set of modules literally named "Evidence Registry," "Resolution Engine," and "Orchestrator" (the Sprint 1-12 Constitutional Stack, `api/registry/`, `api/resolution/`, `api/orchestrator/` etc.) — but per this session's own prior confirmed finding (Repository Review, PR #368), **that entire chain has zero production callers and is not part of the live scan pipeline.** It is unrelated to Global Music Footprint™. The diagram below uses the Board's requested conceptual stages but labels each with the *actual, live* module that performs that role — not the dormant, similarly-named infrastructure — to avoid the Board mistaking one for the other.

```
Provider APIs
  Apple Music (storefront sweep, live)
  Spotify (per-market check, connector exists, not wired)
  Deezer (per-track check, connector exists, not wired)
  TIDAL (no territory capability yet)
      ↓
Evidence Connectors
  provider-acquisition/connectors/apple-music/AppleMusicConnector.js  (LIVE)
  provider-acquisition/connectors/spotify/SpotifyConnector.js         (capability exists, unused)
  provider-acquisition/connectors/deezer/DeezerConnector.js           (capability exists, unused)
      ↓
Acquisition (PAL)
  api/_lib/apple-pal-acquisition.js requests Capability.AVAILABILITY  (LIVE — the only real request)
      ↓
EvidencePackage[] (evidenceType: Capability.AVAILABILITY, provider: 'apple_music')
      ↓
Territory Intelligence Engine™  (api/_lib/territory-intelligence.js)
  extractAppleObservations()  — currently single-provider extraction (§4)
      ↓
  reconcileTerritoryState()   — already provider-general conflict resolution (§4)
      ↓
  assembleTerritoryIntelligence() → 5-state model, all 167 real storefronts
      ↓
Canonical Territory Intelligence
  api/_lib/global-music-footprint.js — assembleGlobalMusicFootprint()
  → cim.globalFootprint (lib/rie/index.js)
  → canonical.globalMusicFootprint (lib/rie/CimAdapter.js)
      ↓
Runtime Context
  public/js/runtime-context-mapper.js → royalte_workspace_context.globalFootprint
      ↓
Global Music Footprint™ Map
  public/js/global-map-choropleth.js — renders exactly what the Engine
  resolved, one territory at a time, no independent computation
```

Note what does **not** appear in this real chain: the dormant "Evidence Registry"/"Resolution Engine"/"Orchestrator" stack the Board's phrasing evoked. The live path is shorter and simpler than that dormant infrastructure — evidence extraction and conflict resolution both happen inside `territory-intelligence.js` itself, not in a separate registry/resolution service.

---

## Summary answer to the Board's core question

**Is the map evidence-driven, provider-agnostic, and scalable?**

- **Evidence-driven:** yes, fully — confirmed across three review packages this initiative (Phase 1 audit, Phase 2 refactor, Phase 3 visual rebuild), zero fabricated values remain.
- **Provider-agnostic *in its resolution policy*:** yes, already — `reconcileTerritoryState()` does not know or care which provider an observation came from.
- **Provider-agnostic *in practice, today*:** no — only Apple's evidence ever reaches that policy. This is an honest, current limitation, not a design flaw; the extraction layer was deliberately scoped to Apple-only for Phase 5.2 and documented as such.
- **Scalable:** yes — adding Spotify or Deezer evidence is additive wiring work (precedented by this session's ISRC Intelligence™ v1 initiative); adding a wholly new provider is real connector work but does not require touching reconciliation, the CIM, or the map.
