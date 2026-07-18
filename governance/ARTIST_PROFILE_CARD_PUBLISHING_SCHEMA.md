# Royaltē — Artist Profile Card
# Section 3: Publishing Intelligence Field Schema

## Purpose

Define the Publishing Intelligence field contract for the Artist Profile Card: rights ownership, publishing relationships, and registration ecosystem. This document works within the approved architecture (`governance/ARTIST_PROFILE_CARD_ARCHITECTURE.md` §8) and does not introduce architecture changes, revisit Identity, modify Mission Control, or activate ATHENA. Scope is field-schema completion only.

## Source of Truth Layers

Three layers, never mixed — same discipline as Section 2 (Identity):

1. **Approved Artist Profile Card Product Model** — what Publishing Intelligence must represent.
2. **Current Implementation Reality** — what exists in code today, with file:line citations.
3. **Implementation Gap** — the work required to align current code with the approved model.

## Correction to a stated premise, confirmed by direct trace

Music Rights Profile is **not** a 2-question (PRO + SoundExchange) flow. Current onboarding (`public/onboarding.html:546-586`) asks **3 questions**: `pro`, `publishing_management` (self / admin / publisher, with a conditional `organization_name`), and `mlc`. **SoundExchange was removed from MRP per PR #330** — `pr.soundexchange` is always null today; the field is retained as dead code pending a Board decision (`public/workspaces/publishing-intelligence.html:731,1058`). This supersedes the "2-question onboarding" description on record from PR #286 — noted here rather than silently assumed, per this document's own no-assumptions rule.

---

## Approved Publishing Intelligence Sections

The approved product model for Publishing Intelligence (unchanged from the brief — no approved field is dropped by the findings below):

**1. Rights Profile** — Performing Rights Organization (PRO), Mechanical Rights Organization, Sound Recording Rights Organization, Publishing Administrator, Publisher, Record Label

**2. Publishing Relationships** — Self Published Status, Publisher Name, Publishing Administrator Name, Administration Status, Publishing Relationship Type (Self Published / Publishing Administrator / Traditional Publisher / Co-Publishing)

**3. Rights Registrations** — PRO Registration Status, SoundExchange Registration Status, MLC Registration Status, Registration Coverage, Registration Gaps

**4. Writer Information** — Writer Name, Songwriter Role, Ownership Percentage, Writer Identifier (IPI, CAE)

**5. Publishing Health / Intelligence** — Publishing Coverage, Missing Registrations, Rights Conflicts, Ownership Issues, Recommended Actions

---

## Section 1 — Implemented Fields

Only fields traceable to current, committed code. Untracked/uncommitted files in the working tree were excluded from this trace — they belong to unrelated in-progress work, not confirmed implementation.

**Note on `api/registry/fields/rights.js`:** this is a declarative field catalog (Canonical Field Registry, Sprint 1A) describing target schema — it is not imported by `publishing-intelligence.js`, `identity-graph.js`, or `mlc-adapter.js`, and is not itself a data producer. It is cited below only as corroborating context, never as proof a field is live.

### Rights Profile

**Performing Rights Organization (PRO)**
- Display Name: PRO
- Section: Rights Profile
- Classification: Canonical Data Field
- Population Source: Onboarding
- Current Implementation Reference: `public/onboarding.html:548` (question key `pro`), stored `performing_rights.pro`, saved via `api/save-music-rights-profile.js`, rendered `publishing-intelligence.html:1048`.

**Publishing Administrator**
- Display Name: Publishing Administrator
- Section: Rights Profile
- Classification: Canonical Data Field (derived, not a dedicated onboarding question)
- Population Source: Onboarding
- Current Implementation Reference: derived from `publishing_management === 'admin'` + `organization_name` (`publishing-intelligence.html:1092-1095`). Also declared, not produced, in `api/registry/fields/rights.js:85-101`.

**Publisher**
- Display Name: Publisher
- Section: Rights Profile
- Classification: Canonical Data Field (derived, not a dedicated onboarding question)
- Population Source: Onboarding
- Current Implementation Reference: derived from `publishing_management === 'publisher'` + `organization_name` (`publishing-intelligence.html:1086-1089`).

### Publishing Relationships

**Self Published Status**
- Display Name: Self Published
- Section: Publishing Relationships
- Classification: Canonical Data Field
- Population Source: Onboarding
- Current Implementation Reference: `publishing_management === 'self'` option (`onboarding.html:568`).

**Publisher Name**
- Display Name: Publisher Name
- Section: Publishing Relationships
- Classification: Canonical Data Field
- Population Source: Onboarding
- Current Implementation Reference: `organization_name` when `publishing_management === 'publisher'` (same mechanism as Rights Profile › Publisher above).

**Publishing Administrator Name**
- Display Name: Publishing Administrator Name
- Section: Publishing Relationships
- Classification: Canonical Data Field
- Population Source: Onboarding
- Current Implementation Reference: `organization_name` when `publishing_management === 'admin'`.

**Publishing Relationship Type (partial)**
- Display Name: Publishing Relationship Type
- Section: Publishing Relationships
- Classification: Canonical Data Field — **3-value enum only**
- Population Source: Onboarding
- Current Implementation Reference: `self / admin / publisher` enum (`onboarding.html:568-571`). Approved values "Traditional Publisher" and "Co-Publishing" are not modeled — tracked in Section 2.

### Rights Registrations

**PRO Registration Status**
- Display Name: PRO Registration Status
- Section: Rights Registrations
- Classification: Canonical Data Field
- Population Source: Onboarding (self-reported)
- Current Implementation Reference: badge rendered off `pr.pro` (`publishing-intelligence.html:1048-1055`).

**MLC Registration Status**
- Display Name: MLC Registration Status
- Section: Rights Registrations
- Classification: Canonical Intelligence Field — two independent sources coexist
- Population Source: Onboarding (self-report) **and** Scan (verified)
- Current Implementation Reference: self-reported boolean `pub.mlc_registered` (`onboarding.html:577-585`, rendered `publishing-intelligence.html:1073-1080`); independently computed `registrations.mlcRegistration` (4-state model: VERIFIED / ACTION_REQUIRED / NOT_FOUND / UNABLE_TO_CONFIRM) in `api/_lib/publishing-intelligence.js:181-193`.

**Registration Coverage**
- Display Name: Publishing Coverage™
- Section: Rights Registrations / Publishing Health
- Classification: Canonical Intelligence Field — **two non-identical concepts coexist today**
- Population Source: Royaltē System
- Current Implementation Reference: `assemblePublishingIntelligence()` returns `coverage`/`coverageStatus` (`api/_lib/publishing-intelligence.js:307-317,404`), rendered as the "Publishing Coverage™" KPI card (`publishing-intelligence.html:657-666,1130`). **Current-implementation quirk, not a gap to close by this document:** the same file also computes a separate, additive "Publishing Health™" score (PRO=30, SoundExchange=20 — the dead SoundExchange field still carries scoring weight, `publishing-intelligence.html:1097-1120`). Both exist; they are not reconciled here.

### Writer Information

**Writer Name**
- Display Name: Writer Name
- Section: Writer Information
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: MLC
- Current Implementation Reference: `firstName`/`lastName`/`fullName` via `normalizeWriter()` (`lib/publishing/mlc-adapter.js:67-84`), persisted into `CompositionNode.writers[]` via `buildCompositionWriter()` (`api/_lib/identity-graph.js:174-183`).

**Songwriter Role**
- Display Name: Songwriter Role
- Section: Writer Information
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: MLC
- Current Implementation Reference: `role: safeTrim(raw.writerRoleCode)` (`mlc-adapter.js:82`), carried into `CompositionNode` writer entries (`identity-graph.js:180`).

**Writer Identifier (IPI)**
- Display Name: IPI
- Section: Writer Information
- Classification: Canonical Data Field
- Population Source: Scan
- Provider Source: MLC
- Current Implementation Reference: `writerIPI: safeTrim(raw.writerIPI)` (`mlc-adapter.js:80`); `WriterNode` keyed by `writerIPI` (`identity-graph.js:202-209`). Also declared (not produced) in `api/registry/fields/rights.js:103-119`.

### Publishing Health / Intelligence

**Recommended Actions**
- Display Name: Recommended Actions
- Section: Publishing Health / Intelligence
- Classification: Canonical Intelligence Field — generic pattern, not publishing-specific logic
- Population Source: Royaltē System
- Current Implementation Reference: `recommendations[]` populated from fired `publishing.<metric>.*` rule observations (`api/_lib/publishing-intelligence.js:373-380`) — same four-state issues/recommendations pattern as Identity Intelligence.

---

## Section 2 — Implementation Required

Approved Artist Profile Card fields not fully supported by current code. They remain in the schema — not removed.

| Approved Field | Current Gap | Required Implementation Change |
|---|---|---|
| Mechanical Rights Organization | No onboarding question or code reference exists | New onboarding question + storage; no acquisition or MRP field exists today |
| Sound Recording Rights Organization | SoundExchange (the closest concept) was removed from MRP per PR #330 — always null | Requires a Board decision on whether/how to reintroduce a sound-recording-rights field, distinct from the dead SoundExchange field |
| Record Label | Not implemented — explicitly marked "future, added post-scan by intelligence engines" (`api/save-music-rights-profile.js:12-13`); declared only in the unwired field registry (`api/registry/fields/rights.js:49-65`) | New Scan-sourced acquisition + storage; approved Population Source is Scan, not Onboarding |
| Administration Status | No distinct status field — only a generic Artist Disclosure badge (`pi-mrp-badge--verified/unknown`) exists | Model a dedicated Administration Status field, distinct from the raw `publishing_management` enum |
| Publishing Relationship Type — "Traditional Publisher" / "Co-Publishing" values | Only a 3-value enum exists (`self/admin/publisher`) — these two approved values are not modeled | Extend the onboarding enum and all downstream consumers to support 4+ relationship types |
| SoundExchange Registration Status | Field removed from MRP per PR #330; `pr.soundexchange` always null, retained as dead code | Pending Board decision — reactivate, formally retire, or replace with a different registration concept |
| Registration Gaps (as a named field) | No dedicated `registrationGaps` field exists (zero references in tracked code) — the generic `issues[]` array (`api/_lib/publishing-intelligence.js:337-395`) is the closest analog | Persist a dedicated Registration Gaps structure, or formally adopt `issues[]` as the approved shape |
| Ownership Percentage | Zero occurrences anywhere in tracked code; `mlc-adapter.js` has no such field | New acquisition from MLC (or another provider) + `CompositionNode` writer schema extension |
| Writer Identifier (CAE) | Zero occurrences of "CAE" anywhere in tracked code — the codebase only models IPI | Determine whether CAE is a distinct required identifier or an alias of IPI; implement acquisition + storage if distinct |
| Missing Registrations (as a named field) | No dedicated object — represented only as generic `issues[]` entries (e.g. `"${label} not confirmed in reviewed sources"`, `api/_lib/publishing-intelligence.js:386-394`) | Persist a dedicated Missing Registrations structure, or formally adopt `issues[]` as the approved shape |
| Rights Conflicts | No concept exists anywhere in `publishing-intelligence.js`, `identity-graph.js`, or `mlc-adapter.js` | New conflict-detection logic — genuinely new intelligence capability, not a naming/mapping change |
| Ownership Issues | No such field; no ownership-percentage data exists yet to derive issues from | Depends on Ownership Percentage (above) being implemented first |

---

## Publishing Intelligence Rules

1. Onboarding data (PRO, publishing relationship, MLC self-report) does not directly populate Mission Control.
2. Scan results (MLC writer/registration data) map into the Artist Profile Card via the existing CIO/CIM → Identity Graph publishing layer.
3. Mission Control consumes Artist Profile Card data, currently via the existing Runtime Context delivery layer — unchanged and out of scope here.
4. Provider Source and Population Source remain separate concepts. Provider Source is only listed where a field is Scan-sourced from a named external system (e.g. MLC); Onboarding and Royaltē System fields have no Provider Source.
5. A field belongs in **Section 1 — Implemented Fields** only if traceable to real, committed code today. Approved-but-not-yet-built fields belong in **Section 2 — Implementation Required**, never blended into the implemented contract as if they already exist. No approved product field is removed for lack of current support.
6. `api/registry/fields/rights.js` is documentation-as-code describing target schema, not a live producer — never cited as evidence a field is implemented.

---

## Deliverable Status

Publishing Intelligence field schema — complete:
- ✅ Approved publishing fields documented (Rights Profile, Publishing Relationships, Rights Registrations, Writer Information, Publishing Health/Intelligence)
- ✅ Current implementation mapped, each Implemented Field with a file:line citation
- ✅ Missing capabilities documented as gaps, none silently dropped
- ✅ Population sources assigned to every field
- ✅ Provider sources kept separate from population sources
- ✅ One factual correction flagged explicitly rather than assumed (MRP is 3 questions, not 2; SoundExchange removed per PR #330)
- ✅ Schema ready for implementation review

**Publishing Intelligence locked. Proceeding to Catalog Intelligence Field Schema next.**
