# Royaltē Engineering Stack™

**Status:** companion to `constitution/ROYALTE_MASTER_CONSTITUTION.md` §8B
**Authority:** the Constitution governs principles; this document records the implementation map.

Where the two disagree, **the Constitution wins.**

---

## The seven layers (finalized 2026-06-11)

```
1. Providers                                  (Spotify · Apple Music ·
                                               MusicBrainz · Discogs · YouTube ·
                                               MLC · …)
       ↓
2. Normalization Adapters                     lib/publishing/*-adapter.js
       ↓
3. Royaltē Identity Graph™                    api/_lib/identity-graph.js
       ↓
4. Canonical Intelligence Assembly Engine™    api/_lib/cio-assembler.js
       ↓
5. Canonical Intelligence Object™ (CIO)       (deep-frozen artifact)
       ↓
6. Royaltē Rule Library™                      api/rules/*
       ↓
7. Royaltē Intelligence Engine™               api/_lib/intelligence-engine.js
       ↓
   Observations · Recommendations · Risks · Strengths · Opportunities · Coverage
       ↓
8. Consumers                                  Mission Control™ · Executive Brief™ ·
                                               Health™ · Monitoring™ ·
                                               Revenue Signals™ · APIs · AI Agents
```

---

## Layer 1 — Providers

Raw third-party APIs. Not owned by Royaltē. The platform's stance: every value sourced from a provider must be re-derived through the layers below; nothing presented to a consumer ever traces back to a raw provider field by name.

Currently surfaced: Spotify · Apple Music · MusicBrainz · Deezer · AudioDB · Discogs · SoundCloud · Last.fm · Wikidata · YouTube · Tidal · MLC.

---

## Layer 2 — Normalization Adapters

Per-provider translators. Each adapter is the **only** module in the codebase that knows a given provider's field names.

| Provider | Adapter | Status |
|---|---|---|
| **MLC** | `lib/publishing/mlc-adapter.js` | 🔒 tagged `mlc-publishing-adapter-v1.0` (Phase 2, 2026-06-10) |
| Future SOCAN / ASCAP / BMI / CISAC / MusicBrainz publishing | `lib/publishing/*-adapter.js` | reserved |

**Public contract** (locked at v1.0):
- `normalizeMlcWork(rawMlcWork) → PublishingWork | null`
- `normalizeMlcWorks(rawArray) → PublishingWork[]`
- `validatePublishingWork(work) → { valid, errors }`

**`PublishingWork` shape** (Royaltē-canonical, provider-neutral): `title · canonicalTitle · mlcSongCode · iswc · writers[] · publishers[] · source · rawMlcResponse · lastUpdated · confidence`.

**Tests:** `tests/publishing-adapter-test.mjs` — 20 assertions.

---

## Layer 3 — Royaltē Identity Graph™

Cross-platform relationships. The graph is the sole owner of CompositionNode, writer index, and recording↔composition link maps.

| File | Owns |
|---|---|
| `api/_lib/identity-graph.js` | Identity Graph public API + Publishing Layer |

**Locked at:** Phase 3, `bf12b5a` (2026-06-10, PR #127).

**Public API:**
- `addPublishingWork(artistName, publishingWork)`
- `getPublishingWorks(artistName) → CompositionNode[]`
- `getCompositionByISWC(iswc) → CompositionNode | null`
- `getCompositionByProviderId(provider, id) → CompositionNode | null` (provider-neutral)
- `getWriterByIPI(ipi) → WriterNode | null`
- `linkRecordingToComposition(isrc, iswc)` · `getCompositionsForRecording(isrc)` · `getRecordingsForComposition(iswc)`
- `lookupYouTubeChannelId(artistName)` · `getYouTubeChannelEntry(artistName)` — Board-exempted YouTube identity layer

**`CompositionNode` shape:** `royalteId · externalIds{mlc, socan, ascap, bmi, cisac, musicbrainz} · iswc · title · canonicalTitle · writers[] · publishers[] · recordings[] · sources[] · addedAt · lastObservedAt · confidence`. Merge by `externalIds` or `ISWC` only — never by title.

**Tests:** `tests/identity-graph-publishing-test.mjs` — 23 assertions.

---

## Layer 4 — Canonical Intelligence Assembly Engine™

Pure deterministic projection of (graph state + adapter outputs + scan payload) into the CIO.

| File | Owns |
|---|---|
| `api/_lib/cio-assembler.js` | The Assembly Engine |
| `api/schema/cio.js` | CIO schema + empty factories |

**Locked at:** Phase 4, `a3c78d7` (2026-06-10, PR #128).

**Public API:**
- `assembleCio(artistName, sources, options?) → frozen CIO`
- `validateCio(cio) → { valid, errors }`
- `CIO_VERSION = '1.0.0'`

**Invariants:** never throws · never mutates inputs · deterministic given `(artistName, sources, options.now)` · returned CIO is deeply frozen.

**Tests:** `tests/cio-assembler-test.mjs` — 17 assertions.

---

## Layer 5 — Canonical Intelligence Object™

The deeply-frozen artifact representing Royaltē's understanding of an artist at one moment in time. **Summarizes — never duplicates graph storage.** Carries `royalteId` and `writerIPI` references back into the Identity Graph; never embeds `PublishingWork` or `CompositionNode` objects.

Phase 4 shape (locked):

```
{
  cioVersion:  '1.0.0',
  generatedAt: ISO,
  confidence:  'UNKNOWN',
  identity:    { canonicalArtistName, externalProfiles[], artistConfidence },
  publishing:  { worksCount, workRoyalteIds[], writerCount, writerIPIs[],
                 publisherCount, publishingConfidence },
  catalog:     { releasesCount, catalogAgeYears, catalogConfidence },
  metadata:    { flagCount, metadataConfidence },
  sources:     { sources: [{ provider, confidence, observedAt, rawReference }] },
  monitoring:  { reserved: true },          // Phase 7+
  revenue:     { reserved: true },          // Phase 7+
}
```

---

## Layer 6 — Royaltē Rule Library™

Declarative business knowledge. Every rule is a frozen plain object with a pure `(cio) → boolean` condition function. **Rules never execute themselves.**

| File | Category | Rules |
|---|---|---|
| `api/rules/identity-rules.js` | IDENTITY | 2 |
| `api/rules/publishing-rules.js` | PUBLISHING | 4 |
| `api/rules/catalog-rules.js` | CATALOG | 3 |
| `api/rules/metadata-rules.js` | METADATA | 3 |
| `api/rules/index.js` | Constants · `ALL_RULES` · `validateRule` · `getRulesByCategory` | — |
| (reserved) | MONITORING · REVENUE · GENERAL | 0 (placeholders) |

**Locked at:** Phase 5, `8907bd6` (2026-06-11, PR #130).

**Rule format** (locked):
```
{
  id              stable, unique
  category        IDENTITY · PUBLISHING · CATALOG · METADATA · MONITORING · REVENUE · GENERAL
  title           human-readable, provider-neutral
  description     evidence framing
  severity        INFO · LOW · MEDIUM · HIGH · CRITICAL
  confidence      UNKNOWN · LOW · MEDIUM · HIGH
  recommendation  guidance string
  providerSources string[] (or function returning string[])
  condition       (cio) => boolean  // PURE, NEVER THROWS, NEVER MUTATES
}
```

**Public API:**
- `ALL_RULES` (frozen aggregate of every rule)
- `RULE_CATEGORIES` · `SEVERITY` · `CONFIDENCE` enumerations
- `validateRule(rule) → { valid, errors }`
- `getRulesByCategory(category) → Rule[]`
- Per-category arrays: `identityRules`, `publishingRules`, `catalogRules`, `metadataRules`, `monitoringRules`, `revenueRules`, `generalRules`

**Tests:** `tests/rule-library-test.mjs` — 29 assertions.

---

## Layer 7 — Royaltē Intelligence Engine™

Generic deterministic execution: evaluate every rule against the CIO and project firing rules into structured output.

| File | Owns |
|---|---|
| `api/_lib/intelligence-engine.js` | The engine |
| `api/schema/intelligence.js` | Engine schema + empty factories |

**Locked at:** Phase 6, `a23788b` · tagged `intelligence-engine-v1.0` (2026-06-11, PR #131).

**Public API:**
- `runIntelligenceEngine(cio, ruleLibrary) → frozen engine output`

**Output:**
```
{
  observations:    Observation[],
  recommendations: { observationId, ruleId, recommendation }[],   // severity ≥ MEDIUM
  risks:           summary[],                                      // severity ≥ HIGH
  strengths:       Observation[],                                  // polarity 'positive'
  opportunities:   summary[],                                      // severity === MEDIUM
  coverage:        { section, status, itemCount }[],               // 7 rows
  engineVersion:   '1.0.0',
  generatedAt:     ISO,                                             // inherits cio.generatedAt
}
```

**Invariants:** never throws · never mutates CIO or ruleLibrary · deterministic · generic iteration (no category switch) · output deeply frozen.

**Tests:** `tests/intelligence-engine-test.mjs` — 30 assertions, including a 500-rule load.

---

## Layer 8 — Consumers

Read the Intelligence Engine's frozen output and render it for their surface. **No consumer recomputes intelligence.** No consumer reads from the CIO directly. No consumer reads from the Rule Library directly. Each consumer reads `runIntelligenceEngine(cio, ALL_RULES)` and projects observations/recommendations/etc. into its own presentation.

Current consumers (Phase 7+ will wire them in — none read engine output today):

- Mission Control™
- Executive Brief™
- Royaltē Health™
- Monitoring™
- Revenue Signals™
- APIs
- AI Agents

---

## Phase ledger

| Phase | Subject | Lock | PR | Tag |
|---|---|---|---|---|
| 1 | MLC Public API connectivity probe | live at `/api/mlc-test` | #123 / #124 / #125 | — |
| **2** | **Publishing Intelligence Adapter™** | `bca9e68` | #126 | `mlc-publishing-adapter-v1.0` |
| **3** | **Royaltē Identity Graph™** | `bf12b5a` | #127 | — |
| **4** | **Canonical Intelligence Assembly Engine™** | `a3c78d7` | #128 | — |
| **5** | **Royaltē Rule Library™** | `8907bd6` | #130 | — |
| **6** | **Royaltē Intelligence Engine™** | `a23788b` | #131 | `intelligence-engine-v1.0` |

(PR #129 — the original Phase-5 Intelligence Engine that hardcoded rules — was architecturally superseded by the Phase 5 + Phase 6 split and closed without merge.)

---

## Determinism guarantee

The combined `(adapter → graph → assembler → engine)` chain is a pure function of `(artist name, provider responses, scan payload, rule library)`. Given byte-identical inputs, every layer produces byte-identical output across runs, processes, and machines.

No randomness · no LLM in the reasoning path · no network call inside any of layers 4–7 · all engine outputs are deep-frozen.

---

## Adding new intelligence — where each change lands

| Change | Lands in |
|---|---|
| Royaltē learns to talk to a new provider | Layer 2 (a new adapter under `lib/publishing/` or `lib/<domain>/`) |
| Royaltē learns a new relationship type (e.g. "manager-of") | Layer 3 (Identity Graph addition) |
| Royaltē decides to surface a new aggregate (e.g. revenue projection) | Layer 4 (Assembly Engine summarization) + new CIO field at Layer 5 |
| Royaltē adopts a new business rule | Layer 6 (new entry in one of `api/rules/*`) |
| Royaltē fixes a reasoning bug | Layer 7 (engine bug fix; signature stays at v1.0) |
| Royaltē surfaces an existing observation in a new place | Layer 8 (a new consumer reading `runIntelligenceEngine(cio, ALL_RULES)`) |

Each layer is independently addressable. Each layer is independently testable. Each layer is constitutionally responsible for one thing, and one thing only.

**One Adapter. One Graph. One CIO. One Library. One Engine. One Platform.**
