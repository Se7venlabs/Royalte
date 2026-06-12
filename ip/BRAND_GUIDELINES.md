# BRAND GUIDELINES

**Owner:** Se7ven Labs LLC
**Status:** living document — additions appended; spelling rules locked.
**Effective:** 2026-06-11

Operating brand handbook for Se7ven Labs LLC and the Royaltē™ product family. This file does not replace the Royaltē OS™ design freezes (Mission Control · Signal Meter · Scan V1); it complements them with brand-identity rules that survive any UI surface.

---

## 1. Logos

| Asset | Use | Status |
|---|---|---|
| Se7ven Labs logo (popped) | Corporate identity, footers, Vault headers. | Locked. Source: `public/se7ven_labs_popped.png`. |
| Royaltē product wordmark | Product surfaces (Scan, Mission Control, Royaltē Review PDF). | Custom-set type; rules below. |
| Royaltē Orb™ | Scan Experience V1 hero element. | Locked design 2026-06-10 (PR #122). Do not substitute. |

**Logo do-nots.**

- Do not recolour the Se7ven Labs logo.
- Do not stretch or skew either logo.
- Do not add drop shadow or strokes to the Royaltē wordmark.
- Do not place the Royaltē Orb™ on photographic backgrounds without the prescribed scrim.

---

## 2. Wordmarks

The product name **Royaltē** is set in the same display face as on the locked surfaces. When the display face is unavailable, a system serif with the same uppercase-R proportions is acceptable; a sans-serif substitute is **not**.

The corporate name **Se7ven Labs** uses the literal "7" in place of the lowercase "v" — *never* "Seven Labs" or "Se7en Labs". The "L" in "Labs" is uppercase.

---

## 3. Typography

- **Display / wordmark face:** as configured on the locked surfaces.
- **Headings:** the same family used throughout `public/index.html` and `public/dashboard.html`.
- **Body:** the system stack inherited from the locked CSS.
- **Numbers in scores / metrics:** tabular figures, never proportional, so columns align on Royaltē Mission Control™ and the Royaltē Review PDF.

---

## 4. Spacing

- **Wordmark padding:** at minimum, x-height clear space on all sides; at most, no upper bound.
- **Royaltē Orb™:** padding rules locked at the Scan V1 freeze.
- **Mission Control™ cards:** the 2026-06-04 V1 freeze structure is binding (`project_royalte_mc_freeze`).

---

## 5. Favicons

| Asset | Size | Use |
|---|---|---|
| `favicon.ico` | 16 / 32 / 48 px | Browser tab. |
| `apple-touch-icon.png` | 180 px | iOS home-screen. |
| Open Graph image | 1200 × 630 px | Social-share preview. |

All favicon variants derive from the same Se7ven Labs logo; the Royaltē Orb™ may appear as the favicon for the Royaltē product subdomain only.

---

## 6. Email signatures

```
[Name]
[Title]
Se7ven Labs LLC · Royaltē™
[email]
```

Use the exact characters above. The product reference *must* include the `™` symbol until the trademark is formally registered (at which point `®` substitutes).

---

## 7. Trademark usage

- First use of a Se7ven Labs mark in any artefact (web page, PDF, slide, email) takes the `™` symbol. Subsequent uses in the same artefact may drop the symbol once the convention is established.
- Common-law marks (see `TRADEMARKS.md`) use `™`. Registered marks (see `TRADEMARKS.md`) use `®`.
- Never use the symbol on a mark that is neither asserted nor registered — that creates legal exposure.
- Marks of third parties (Apple, Spotify, YouTube, MLC, MusicBrainz, etc.) are referenced for descriptive interoperability only; do not stylise them or imply endorsement.

---

## 8. Capitalization

| Term | Correct | Incorrect |
|---|---|---|
| Royaltē | **Royaltē** | Royalte · ROYALTE · royalte · Royal-T · Royal Te |
| Se7ven Labs | **Se7ven Labs** | Seven Labs · Se7en Labs · se7ven labs · SE7VEN LABS *(headlines only)* |
| Health Score | **Health Score** | health score · HealthScore · Health-Score |
| Intelligence Engine | **Intelligence Engine** | intelligence engine · IntelligenceEngine |
| Mission Control | **Mission Control** | mission control · MissionControl |
| Music Backend Intelligence | **Music Backend Intelligence** | music backend intelligence · MBI |

---

## 9. Approved naming

### 9.1 The Royaltē spelling rule (CRITICAL — Board-locked)

- **Correct:** Royaltē — five letters, lowercase trailing "ē" with macron (Unicode `U+0113`, "Latin Small Letter E with Macron").
- **Incorrect:**
  - **Royalte** (missing macron — looks like the verb stem, dilutes the mark).
  - **Royal-T** (consumer misreading; do not normalise).
  - **Royal Te** (two words; not the mark).
  - **Royaltee** · **Royalty** (different word; different meaning).

When the typesetting environment cannot render `ē`, the substitution rule is: write **Royaltē** literally in the source and let the runtime substitute a fallback; do *not* downgrade the source to "Royalte".

### 9.2 Product family naming

- "Royaltē" prefixes every product surface that ships under the platform brand: *Royaltē Mission Control™*, *Royaltē Scan™*, *Royaltē Health Engine™*, *Royaltē Intelligence Engine™*, *Royaltē Identity Graph™*, *Royaltē Rule Library™*, *Royaltē Canonical Intelligence Object™*, *Royaltē Executive Brief™*, *Royaltē Monitoring™*, *Royaltē Revenue Intelligence™*, *Royaltē Audit™*, *Royaltē Review*, *Royaltē Golden Fixture Library™*, *Royaltē Engineering Stack™*, *Royaltē Governance Layer™*, *Royaltē Boot Sequence™*, *Royaltē AI Executive™*, *Royaltē Executive Runtime™*.
- "Se7ven Labs" prefixes the umbrella offerings that span products: *Se7ven Labs AI Operating System™*, *Se7ven Labs Executive Runtime™*, *Se7ven Labs Intellectual Property Vault™*.
- Category nouns without a corporate prefix (*Music Backend Intelligence™*, *Music Backend Health™*, *Backend Health™*, *Catalog Intelligence™*, *Publishing Intelligence™*, *Identity Intelligence™*, *Revenue Signals™*, *Collection Signals™*) are positioning categories Se7ven Labs LLC claims as house marks; counsel may consolidate at filing.

### 9.3 The "™ vs ®" rule

Until a mark formally registers, every public use carries `™` — even when the mark also appears in this Vault as PLANNED. Removing the symbol weakens the common-law claim. The `®` symbol may only be used once a registration certificate has been issued for the jurisdiction in which the artefact is published.

---

*Owned by Se7ven Labs LLC. This handbook governs Brand operations; it does not constitute legal filing.*
