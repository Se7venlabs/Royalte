# DEFENSIVE PUBLICATIONS

**Owner:** Se7ven Labs LLC
**Effective:** 2026-06-11

## Purpose

Publish strategic ideas to establish prior art and prevent future patent conflicts.

A defensive publication is a public, dated disclosure of an invention that Se7ven Labs LLC deliberately chooses not to patent. Once published, the disclosure enters the prior-art record — preventing any third party from later filing a patent on the same idea while reserving Se7ven Labs's own freedom to operate. This is the **anti-patent** tool: useful when filing costs exceed strategic value, when the invention is too peripheral to defend, or when the Board wants to ensure the methodology remains open without surrendering credit or first-use evidence.

Defensive publications complement (do not replace) the `PATENTS.md` register. An invention may begin in `PATENTS.md` as `IDENTIFIED` and later move to `RELEASED AS DEFENSIVE PUBLICATION` here, with the original row in `PATENTS.md` superseded by a new row citing the disposition.

---

## Register

| Title | Description | Publication Date | Inventor | Notes |
|---|---|---|---|---|
| *(none yet)* | | | | |

---

## Candidate disclosures under Board consideration

The following methodologies are candidates for defensive publication (in the alternative to patent filing). They are listed here so the record exists; the Board has not yet authorised any specific disclosure.

- **Constitutional separation pattern for intelligence systems.** The doctrine that Knowledge (rules), Execution (engine), Scoring (health/quantification), and Presentation (UI) must each live in a distinct, single-responsibility module — and that violations are detectable by static analysis.
- **Append-only governance layer.** Repository-level governance files (`BOARD_DECISIONS.md`, `CHANGELOG.md`) that are append-only by Board rule, with a constitutional clause binding every architectural phase merge to a synchronous governance update in the same PR.
- **Royaltē Boot Sequence™.** The 5-question pre-implementation initialisation procedure for AI sessions operating in a constitutional codebase, with Constitutional Priority chain enforced before any implementation work.
- **Golden-fixture regression methodology for declarative rule engines.** Immutable, versioned-forward reference fixtures that exercise the full (data → rule library → engine → output) pipeline; fixtures are never overwritten, only added or versioned forward (e.g. `-v2.json`).

---

## Approved channels

When the Board authorises a defensive publication, the disclosure is published in **at least two** of the following channels so the prior-art record is robust:

| Channel | Purpose |
|---|---|
| Se7ven Labs blog / public website | Primary disclosure with a dated, indexable URL. |
| GitHub public repository (this repo or a companion) | Dated commit hash establishes priority; archival via the Software Heritage archive. |
| IP.com / Defensive Publications Series | Specialist defensive-publication registry (paid, but explicitly designed for this purpose). |
| ArXiv (technical disclosures) | Academic timestamp + DOI for methodology disclosures. |
| Industry trade publication | Music-industry recognition where relevant. |

Each disclosure is mirrored back into this file with a publication date and at least one URL.

---

## Conventions

- A defensive publication is **not** a patent. The disclosure surrenders the right to later file a patent on the same idea, in exchange for blocking third-party patenting.
- Once published, the row in the register is permanent; corrections are appended as superseding entries.
- The original invention always has a corresponding row in `PATENTS.md` (so the inventor and priority date are preserved even after the disposition decision).

---

*Owned by Se7ven Labs LLC. Internal corporate record; not a legal filing.*
