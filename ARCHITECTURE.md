# Royaltē OS v1.0 — Architecture

**Certified:** 2026-07-02  
**Tag:** `royalte-os-v1.0` at commit `65c5c16`  
**Authority:** `constitution/ROYALTE_MASTER_CONSTITUTION.md` v1.3

---

## Constitutional Statement

> One Provider Acquisition Layer. One Royaltē Intelligence Engine. One Certified Canonical Intelligence Model. One Health Engine. Zero duplicate intelligence. Zero renderer business logic. Every product is a pure presentation layer.

---

## Four-Layer OS Architecture

```
┌─────────────────────────────────────────────────┐
│              USER INPUT LAYER                   │
│  Browser (Hero V3) / Partner API / CLI          │
│  Collects input only. No intelligence here.     │
└─────────────────────┬───────────────────────────┘
                      │  URL or Artist Name
┌─────────────────────▼───────────────────────────┐
│       LAYER 1 — PROVIDER ACQUISITION LAYER      │
│                                                 │
│  AppleMusicConnector (ACTIVE — Phase 3.3)       │
│  Spotify (legacy direct — TRANSITIONAL)         │
│  MusicBrainz / Discogs / YouTube / others       │
│                                                 │
│  Constitutional rule: every production call to  │
│  an external provider passes through a PAL      │
│  connector. Connectors issue Evidence Contracts.│
│  They never own intelligence.                   │
│                                                 │
│  Files: api/_lib/pal/ · lib/rie/EvidenceBridge  │
└─────────────────────┬───────────────────────────┘
                      │  Evidence Contracts
┌─────────────────────▼───────────────────────────┐
│       LAYER 2 — ROYALTĒ INTELLIGENCE ENGINE     │
│                                                 │
│  CIO Assembler      api/_lib/cio-assembler.js   │
│  Rule Library       api/rules/                  │
│  Intelligence Eng.  api/_lib/intelligence-engine│
│  Health Engine      api/_lib/health-engine.js   │
│  Executive Brief    api/_lib/executive-brief-engine│
│                                                 │
│  Domain Assemblers:                             │
│    Identity Intelligence                        │
│    Publishing Intelligence                      │
│    Catalog Intelligence    ← year range (v1.1)  │
│    Health Intelligence     ← domainStatuses (v1.1)│
│    Global Music Footprint                       │
│    Backend Intelligence                         │
│    Monitoring Intelligence                      │
│    Royaltē AI                                   │
│                                                 │
│  Constitutional rule: assemblers classify,      │
│  score, and label intelligence. Products never  │
│  do any of this.                                │
│                                                 │
│  Entrypoint: lib/rie/index.js runRIE()          │
└─────────────────────┬───────────────────────────┘
                      │  Certified Canonical Intelligence Model
┌─────────────────────▼───────────────────────────┐
│       LAYER 3 — CERTIFIED CIM (data.canonical.*)│
│                                                 │
│  12 §8.2 canonical intelligence objects:        │
│  identity · health · globalFootprint · catalog  │
│  verification · metadata · publishing           │
│  opportunities · actions · aiInsight            │
│  revenueSignals · scanAuthority                 │
│                                                 │
│  Constitutional rule: deep-frozen on exit from  │
│  the RIE. Every product reads from here only.  │
│  No product writes to it. No product re-derives │
│  intelligence from it.                          │
│                                                 │
│  Schema: api/schema/canonical-intelligence-model│
│  Persisted: Supabase audit_scans.payload        │
└──────────┬──────────────┬──────────┬────────────┘
           │              │          │
┌──────────▼──┐  ┌────────▼───┐  ┌──▼──────────┐
│  WEBSITE    │  │  MISSION   │  │  EXECUTIVE  │
│  SCAN       │  │  CONTROL   │  │  BRIEF      │
│             │  │            │  │  Web + PDF  │
│  Renders.   │  │  Renders.  │  │  Renders.   │
│  Nothing    │  │  Nothing   │  │  Nothing    │
│  else.      │  │  else.     │  │  else.      │
└─────────────┘  └────────────┘  └─────────────┘
```

---

## Constitutional Ownership Map

Every displayed concept has exactly one constitutional owner.

| Displayed Concept | Owner | CIM Path |
|------------------|-------|---------|
| Health Score | Health Engine | `health.score` |
| Health Grade | Health Engine | `health.grade` |
| Health Status Vocabulary | Health Intelligence assembler | `health.status` |
| Per-Domain Status Labels | Health Intelligence assembler | `health.domainStatuses.*` |
| Executive Summary | Executive Brief Engine | `executiveBrief.executiveSummary` |
| Top Strengths | Executive Brief Engine | `executiveBrief.topStrengths[]` |
| Top Opportunities | Executive Brief Engine | `executiveBrief.topOpportunities[]` |
| Priority Actions | Executive Brief Engine | `executiveBrief.priorityActions[]` |
| Identity Coverage | Identity Intelligence assembler | `identityIntelligence.coverage` |
| Provider Status | Identity Intelligence assembler | `identityIntelligence.supportedProviders[].state` |
| Publishing Coverage | Publishing Intelligence assembler | `publishingIntelligence.coverage` |
| Publishing Coverage Status | Publishing Intelligence assembler | `publishingIntelligence.coverageStatus` |
| Albums / EPs / Singles | Catalog Intelligence assembler | `catalogIntelligence.{albums,eps,singles}` |
| Catalog Year Range | Catalog Intelligence assembler | `catalogIntelligence.{firstReleaseYear,latestReleaseYear}` |
| Catalog Availability | Global Music Footprint assembler | `globalMusicFootprint.status` |
| Territory Count | Global Music Footprint assembler | `globalMusicFootprint.territoriesAvailable` |
| Backend Services | Backend Intelligence assembler | `backendIntelligence.services[]` |
| Royaltē AI Insight | Royaltē AI assembler | `royalteAI.observation` |

---

## Certified Provider Status (OS v1.0)

| Provider | Acquisition Path | Status |
|---------|-----------------|--------|
| Apple Music | PAL → `AppleMusicConnector` → Evidence Contract | ✅ CONSTITUTIONAL |
| Spotify | Legacy direct API in `run-scan.js` | 🔄 TRANSITIONAL — Phase 3.5 target |
| MusicBrainz | Legacy direct API | 🔄 TRANSITIONAL |
| Discogs | Legacy direct API | 🔄 TRANSITIONAL |
| YouTube | Legacy direct API | 🔄 TRANSITIONAL |
| Last.fm | Legacy direct API | 🔄 TRANSITIONAL |
| MLC | `lib/publishing/mlc-adapter.js` | 🔄 AUTH_UNAVAILABLE in test env |

---

## Determinism Contract

The same evidence always produces the same CIM. Verified:
- Intelligence Engine: 10 runs per fixture, JSON-identical
- Health Engine: deterministic (pure function)
- Full RIE pipeline: 5 runs, fixed clock, JSON-identical (excluding `scanId`, internal timestamps)

Certified by Suite 02 of the Board Certification Harness.

---

## Performance Baseline (OS v1.0)

Measured 2026-07-02 on `royalte-os-v1.0`. Warm path, 20-sample mean.

| Stage | P50 (ms) | P95 (ms) |
|-------|---------|---------|
| Intelligence Engine | 0.04 | 0.07 |
| Health Engine | 0.00 | 0.01 |
| Identity Intelligence | 0.00 | 0.01 |
| Publishing Intelligence | 0.00 | 0.01 |
| Full RIE pipeline | 0.15 | 0.31 |

Full RIE budget: 500ms. Current P95: 0.31ms. Headroom: 99.9%.

*Note: these figures exclude PAL provider acquisition (network I/O). Provider acquisition timing requires `CERT_LIVE=1` live scan measurement.*

---

## Key Invariants

1. **Renderers read, never classify.** A renderer maps CIM values to HTML and CSS. It never applies thresholds, counts providers, or computes ratios.

2. **AUTH_UNAVAILABLE ≠ NOT_FOUND ≠ Verified Zero.** Three distinct evidence states. Never conflated in the CIM or display. Publishing coverage is `null` when unverifiable, `0` when verified-zero.

3. **Executive Brief Engine owns product-facing language.** Strengths, opportunities, and recommendations in any product come from `executiveBrief.*` only. No renderer supplements this from sub-assembler outputs.

4. **Provider migrations touch only PAL and RIE.** No product renderer changes when a new provider is added or an existing one is migrated.

5. **The CIM is deeply frozen.** Every object in the CIM is recursively frozen on exit from the RIE. No product can mutate the intelligence it receives.
