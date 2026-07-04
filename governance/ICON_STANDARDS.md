# Royaltē Executive Icon Standards™

**Authority:** Board-approved standard. All Executive Workspaces must reference business functions from this registry.  
**Registry file:** `public/icons/royalte-icon-registry.svg`  
**Icon style:** Phosphor Icons — Duotone only. No other styles (thin, light, regular, fill, bold) are permitted.

---

## Design Principle

Executive Workspaces reference **business functions**, not icon library names.  
The registry is the sole coupling point between UI and the underlying icon library.  
If Phosphor is ever replaced, only this file and `royalte-icon-registry.svg` require updating. No workspace code changes.

---

## Usage

```html
<svg class="royalte-icon" fill="currentColor" aria-hidden="true">
  <use href="/icons/royalte-icon-registry.svg#royalte-[function]"></use>
</svg>
```

Size modifier classes: `royalte-icon--xs` (11px) · `royalte-icon--sm` (18px) · `royalte-icon--md` (20px) · `royalte-icon--lg` (24px) · `royalte-icon--xl` (28px)

---

## Navigation Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-mission-control`       | Dashboard overview                      | `squares-four`             |
| `royalte-health`                | Health Intelligence — vitals            | `pulse`                    |
| `royalte-identity`              | Identity Intelligence — artist ID       | `identification-card`      |
| `royalte-publishing`            | Publishing Intelligence — works         | `file-text`                |
| `royalte-catalog`               | Catalog Intelligence — releases         | `vinyl-record`             |
| `royalte-global`                | Global Music Footprint                  | `globe`                    |
| `royalte-ai-insights`           | AI Intelligence brief                   | `lightbulb-filament`       |
| `royalte-backend`               | Backend Intelligence — infrastructure   | `network`                  |
| `royalte-settings`              | Settings and preferences                | `gear-six`                 |
| `royalte-monitoring`            | Monitoring Timeline — signal stream     | `waveform`                 |

---

## UI Control Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-calendar`              | Date range selector                     | `calendar-blank`           |
| `royalte-caret-down`            | Dropdown / expand                       | `caret-down`               |
| `royalte-check`                 | Inline confirmed checkmark              | `check-fat`                |
| `royalte-check-circle`          | Success / verified state                | `check-circle`             |
| `royalte-warning`               | Attention / needs review                | `warning-circle`           |
| `royalte-alert`                 | Critical alert / risk flag              | `warning`                  |
| `royalte-clock`                 | Time / activity timestamp               | `clock`                    |
| `royalte-trend-up`              | Positive trend / improving              | `trend-up`                 |
| `royalte-arrow-up`              | Upward direction / increase             | `arrow-up`                 |

---

## Health Intelligence Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-signal`                | Health signal / vitals monitor          | `heartbeat`                |
| `royalte-performance`           | Performance tracking / trend            | `chart-line-up`            |
| `royalte-insights`              | AI recommendations / insights           | `lightbulb`                |
| `royalte-youtube`               | YouTube platform presence               | `youtube-logo`             |

---

## Identity Intelligence Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-verified`              | Verified identity / coverage            | `shield-check`             |
| `royalte-profile`               | Artist profile / person                 | `user-circle`              |
| `royalte-fingerprint`           | Digital identity fingerprint            | `fingerprint`              |
| `royalte-organization`          | Label / PRO / organization              | `buildings`                |

---

## Publishing Intelligence Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-compositions`          | Musical compositions / works            | `music-notes`              |
| `royalte-administration`        | Publishing administration               | `buildings`                |
| `royalte-claims`                | Publishing claims / rights tags         | `tag`                      |
| `royalte-collection`            | Royalty collection / revenue            | `currency-dollar`          |
| `royalte-rights`                | Rights ownership / copyright            | `copyright`                |
| `royalte-publisher`             | Publisher / rights holder               | `identification-card`      |

---

## Catalog Intelligence Functions

| Executive Function ID           | Business Meaning                        | Phosphor Duotone Icon      |
|---------------------------------|-----------------------------------------|----------------------------|
| `royalte-artwork`               | Release artwork / album cover           | `image-square`             |
| `royalte-lyrics`                | Lyrics / vocal content                  | `microphone`               |
| `royalte-credits`               | Producer and writer credits             | `users`                    |
| `royalte-isrc`                  | ISRC track recording codes              | `hash`                     |
| `royalte-upc`                   | UPC universal product codes             | `barcode`                  |
| `royalte-metadata`              | Metadata integrity / completeness       | `check-circle`             |
| `royalte-track`                 | Individual track                        | `music-note`               |
| `royalte-release`               | Release / album / project               | `disc`                     |
| `royalte-projects`              | Catalog projects collection             | `stack`                    |

---

## Adding New Icons

1. Select only from `~/Downloads/phosphor-icons/SVGs/duotone/` (duotone style only).
2. Choose an ID that names the **business function**, not the Phosphor icon.
3. Add the `<symbol>` to `public/icons/royalte-icon-registry.svg`.
4. Add a row to this standards table.
5. No workspace HTML requires changes — workspaces reference the function ID, not the library.

---

*Source: Board-approved 2026-07-04. Governance backfill required in same PR.*
