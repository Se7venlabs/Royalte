# PRIOR ART

**Owner:** Se7ven Labs LLC
**Status:** living register — additions appended; corrections appended as superseding entries.
**Effective:** 2026-06-11

Comparable-technology landscape against which Se7ven Labs LLC inventions are evaluated. Each row identifies a piece of public prior art, the Se7ven Labs methodology it most resembles, and the precise basis on which Royaltē differs. The register protects two adjacent interests:

1. **Patent strategy** — distinguishing claims in any filing depend on a documented prior-art analysis. Counsel reads this file as the inventor's first-pass differentiation.
2. **Litigation defence** — if a third party later asserts a patent that overlaps a Royaltē methodology, the prior-art history captured here is part of the invalidity defence.

Companion files: `PATENTS.md`, `DEFENSIVE_PUBLICATIONS.md`.

---

## Register

| Date | Inventor (3rd-party or public domain) | Description | Comparable Technology | Why Royaltē Differs | Supporting Evidence |
|---|---|---|---|---|---|
| *(no entries yet — added as the prior-art search formalises)* | | | | | | |

---

## Categories under active monitoring

The Se7ven Labs Board has identified the following adjacent technology spaces as the most likely sources of overlapping prior art. Counsel and the architecture executive monitor these continuously.

| Space | Typical IP holders | Royaltē anchor |
|---|---|---|
| Music-rights data aggregation (MLC, PROs, CMOs) | Music Modernization Collective · ASCAP · BMI · SESAC · SOCAN · CISAC databases | Royaltē Identity Graph™ + Publishing Intelligence™ adapters |
| Distribution / catalog audit tools | DistroKid · CD Baby · TuneCore · Songtrust · Stem · DistroLock · Disco · BMAT | Royaltē Audit™ + Royaltē Canonical Intelligence Object™ |
| Royalty-statement parsing / reconciliation | Sound Royalties · Royalty Exchange · Lyric Financial · publisher administration tools | Royaltē Revenue Intelligence™ (reserved) |
| Music identification / matching | MusicBrainz · AcoustID · Gracenote · Shazam · ACRCloud | Royaltē Identity Graph™ matching layer |
| Health-scoring / scorecard generators (general SaaS) | various B2B SaaS scorecard tools | Royaltē Health Engine™ — purpose-built for music backend intelligence, not generic scorecarding |
| Intelligence / observation rule engines (general) | Drools · IBM ODM · expert-system frameworks | Royaltē Rule Library™ + Royaltē Intelligence Engine™ — constitutional separation of knowledge / execution / presentation; pure-data rules; deterministic SHA-prefixed observation IDs |
| AI-executive runtimes (general) | LangChain · AutoGen · CrewAI · Claude Agent SDK | Royaltē Executive Runtime™ + Royaltē AI Executive™ — domain-specific, constitution-bound, append-only governance |

---

## Why Royaltē differs — first-pass differentiation

The following themes recur across the Royaltē anchors and are the most defensible distinctions against generic prior art:

1. **Constitutional separation.** Knowledge (Rule Library) ≠ Execution (Intelligence Engine) ≠ Scoring (Health Engine) ≠ Presentation (consumers). Most prior art collapses two or more of these into the same module.
2. **Provider isolation.** Every provider field name lives in exactly one adapter file. No downstream module references `mlc.*` or `spotify.*` or `apple.*`. Most prior art mixes provider parsing into business logic.
3. **Deep-freeze, deterministic outputs.** Every cross-layer artefact (CIO, Intelligence Report, Health Report) is `Object.freeze`-recursive and uses deterministic SHA-prefixed identifiers. Most prior art emits mutable, non-deterministic outputs.
4. **Reserved future sections.** Both the CIO and the Rule Library carry explicit `reserved` placeholders for `MONITORING` / `REVENUE` / `GENERAL`. Most prior art either omits these or fills them with stubs that erode the contract.
5. **Append-only governance binding every phase merge.** No prior-art rule engine the Board has surveyed couples architectural-phase merges to a synchronous governance update in the same PR.
6. **Music-backend specificity.** Royaltē operates over a precisely-modelled music-rights graph (ISRC ≠ ISWC; recording ↔ composition many-to-many; writer-IPI ↔ composition ↔ recording). Generic IP, generic scoring, and generic rule-engine prior art does not encode these distinctions.

---

## Conventions

- Add a row whenever prior art is identified — before it becomes a question, not after.
- `Why Royaltē Differs` should be specific (which method · which file · which property) rather than aspirational.
- `Supporting Evidence` must be re-fetchable: URL · paper citation · patent number · product release notes.
- When the differentiation argument for a row changes (e.g., a new Royaltē phase reinforces the distinction), append a new row citing the prior one.

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
