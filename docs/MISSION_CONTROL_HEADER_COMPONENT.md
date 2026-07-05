# MissionControlHeader™ — Component Extraction Specification

**Status:** Documentation only. Do not extract or refactor until Board issues a dedicated brief.  
**Documented:** MC Global Standardization Pass 1 (2026-07-05)

---

## Current pattern

Every Mission Control workspace uses an identical header structure. Today it is copy-pasted across all 6 modules with per-module class prefixes (`hi-`, `ii-`, `pi-`, `ci-`, `bi-`, `gf-`). The shared structure is:

```html
<header class="ws-breadcrumb">
  <a class="ws-breadcrumb-link" href="/mission-control.html">Royaltē OS™</a>
  <span class="ws-breadcrumb-sep">/</span>
  <a class="ws-breadcrumb-link" href="/mission-control.html">Mission Control</a>
  <span class="ws-breadcrumb-sep">/</span>
  <span class="ws-breadcrumb-current [dept]-breadcrumb-current">[Module Name™]</span>
</header>

<div class="ws-body">

  <div class="hi-main">

    <div class="[dept]-exec-header">
      <div class="[dept]-exec-title-block">
        <div class="[dept]-exec-eyebrow">[Module Name™]</div>
        <h1 class="[dept]-exec-heading">[Page Title]</h1>
        <div class="[dept]-exec-desc">[One-line module description]</div>
        <div class="[dept]-exec-meta-row">
          <div class="[dept]-exec-updated">
            <div class="[dept]-exec-updated-dot" aria-hidden="true"></div>
            Last Sync: [timestamp]
          </div>
        </div>
      </div>
      <div class="hi-date-selector" ...>
        <!-- date range picker — already shared across all modules -->
      </div>
    </div>

  </div><!-- /hi-main -->

</div><!-- /ws-body -->
```

---

## What varies per module

| Element | Varies? | Notes |
|---|---|---|
| Breadcrumb trail | No | Identical across all 6 |
| `ws-body` / `hi-main` | No | Shared layout shell |
| Exec header class prefix | Yes | `hi-`, `ii-`, `pi-`, `ci-`, `bi-`, `gf-` |
| Eyebrow text | Yes | Module name |
| Page title (`h1`) | Yes | Module-specific |
| Description | Yes | One line per module |
| Last Sync timestamp | No | Same format across all (standardized Pass 1) |
| Date selector | No | `hi-date-selector` — already shared |
| Artist avatar block | Identity only | `ii-exec-artist-block` wraps the title block |
| Ring score widget | Backend only | `bi-exec-header` has a ring + ATHENA trigger replacing the standard layout |

---

## What the component would own

When extracted, `MissionControlHeader™` would accept:

```js
{
  module:      'Health Intelligence™',   // eyebrow + breadcrumb label
  title:       'Music Business Health Report',
  description: 'Your complete music business health score…',
  lastSync:    'Today, 8:42 AM',
  dateRange:   'Jun 27 – Jul 3, 2026',
  accentClass: 'ws-dept--health',        // drives CSS custom property theming
}
```

It would render the breadcrumb, `ws-body` open tag, `hi-main` open tag, and the exec header — with the caller responsible for the content beneath.

---

## Already shared (no work needed)

- `hi-date-selector` — already a single shared class used by all 6 modules
- `ws-breadcrumb`, `ws-breadcrumb-link`, `ws-breadcrumb-sep` — already shared
- `ws-body`, `hi-main` — shared layout primitives
- `ws-rail` navigation sidebar — fully shared, identical across all modules

---

## Extraction risks

- **Backend Intelligence™** exec header is structurally different (ring score + ATHENA trigger). It would need a `variant: 'score-ring'` prop or be excluded from the component.
- **Identity Intelligence™** has an artist avatar block wrapping the title block — needs a `slot` or `children` pattern.
- CSS custom property theming via `ws-dept--*` would need to be passed into the component host element.

---

## Recommended extraction order (when Board approves)

1. Extract `hi-date-selector` first — already shared, lowest risk.
2. Extract breadcrumb — purely structural, no style variation.
3. Extract standard exec header — covers Health, Publishing, Catalog, Global.
4. Handle Identity avatar variant.
5. Handle Backend ring-score variant last (most divergent).
