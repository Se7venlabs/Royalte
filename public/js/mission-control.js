// ─────────────────────────────────────────────────────────────────────
//  Royaltē Mission Control™ — runtime boot module (Phase 4B-3)
// ─────────────────────────────────────────────────────────────────────
//
//  Wires the locked Mission Control™ Executive OS to the persisted
//  Identity Intelligence™ object that lives at
//
//      audit_scans.payload.identityIntelligence
//
//  Per the Stage 4B-3 Board directive (2026-06-17):
//
//    - Mission Control READS the persisted intelligence object.
//    - Mission Control RENDERS the persisted intelligence object.
//    - Mission Control NEVER mutates the persisted intelligence object.
//    - Mission Control NEVER clones the persisted intelligence object.
//    - Mission Control NEVER recomputes the persisted intelligence object.
//    - Mission Control NEVER calls a provider adapter.
//    - Mission Control NEVER executes Rule Library logic.
//    - Mission Control NEVER assembles a CIO.
//
//  All transformation logic lives in mission-control-renderers.js
//  (pure, testable). This file does only three things:
//    1. Resolve which scan's intelligence to render (scanId from URL
//       OR the authenticated user's latest audit_scans row, mirroring
//       the public/js/dashboard.js pattern).
//    2. Read audit_scans.payload.identityIntelligence via the existing
//       Supabase anon client (RLS enforces user scoping).
//    3. Apply each render plan to the locked DOM surface.
//
//  Failure mode: if the read fails OR the intelligence object is
//  absent, the locked sample HTML stays exactly as it was — no error
//  bubbles to the user. The console gets a single warning.
// ─────────────────────────────────────────────────────────────────────

import { getSupabase } from '/js/supabase-client.js';
import { initRtz } from '/js/royalte-tz.js';
import {
  renderIdentity,
  renderPublishing,
  renderCatalog,
  renderGlobalMusicFootprint,
  renderRoyalteAI,
  renderBackend,
  renderChangeDetection,
  renderHealth,
  safeIdentityIntelligence,
  safePublishingIntelligence,
  safeCatalogIntelligence,
  safeGlobalMusicFootprintIntelligence,
  safeRoyalteAI,
  safeBackendIntelligence,
  safeMonitoringIntelligence,
  safeHealthIntelligence,
} from '/js/mission-control-renderers.js';

// ─── Persisted payload fetch (Phase 4B-3 + Phase 5B) ──────────────
//
// One Supabase read per scan, returning the full payload (which
// carries every intelligence object). Identity + Publishing both
// share the same row so the boot module never makes a second round
// trip per intelligence domain. Future intelligence objects ride
// the same payload.

function getScanIdFromUrl() {
  try {
    return new URL(window.location.href).searchParams.get('scanId') || null;
  } catch {
    return null;
  }
}

async function fetchScanPayload() {
  // Preview mode: load bundled fixture payload — no Supabase call.
  // Activated by ?preview=1 query param (redirect from /mission-control-preview)
  // or by being served directly at a path containing 'mission-control-preview'.
  const _isPreview = typeof window !== 'undefined' && (
    new URL(window.location.href).searchParams.has('preview') ||
    window.location.pathname.includes('mission-control-preview')
  );
  if (_isPreview) {
    try {
      const { MC_PREVIEW_PAYLOAD } = await import('/js/mc-preview-payload.js');
      return MC_PREVIEW_PAYLOAD;
    } catch (err) {
      console.warn('[mc] preview payload load failed:', err?.message || err);
      return null;
    }
  }

  // Architecture boundary (Phase 4.3): pre-authentication state must be
  // sourced exclusively from the scan that triggered this navigation.
  //
  // Two hard rules on the preactivate path (?preactivate=1):
  //   1. If the bridged sessionStorage payload is present → use it and return.
  //   2. If sessionStorage was already consumed AND no scanId is in the URL →
  //      return null. Never fall back to a "latest owned" Supabase query,
  //      which could surface a different artist's intelligence.
  //
  // Only after authentication can MC query owned scans. Until then, the
  // only permissible source is the specific scan the artist just completed.
  const _isPreactivate = (() => {
    try { return new URL(window.location.href).searchParams.get('preactivate') === '1'; }
    catch { return false; }
  })();

  try {
    const _stored = sessionStorage.getItem('royalte_scan_payload');
    if (_stored) {
      sessionStorage.removeItem('royalte_scan_payload');
      const _parsed = JSON.parse(_stored);
      if (_parsed && typeof _parsed === 'object') {
        console.log('[mc-diag] sessionStorage HIT — artist:', _parsed.subject?.artistName || '(no subject.artistName)', '| top-level keys:', Object.keys(_parsed).join(','));
        return _parsed;
      }
    } else {
      console.log('[mc-diag] sessionStorage MISS — falling to Supabase path. _isPreactivate:', _isPreactivate, '| scanId:', getScanIdFromUrl() || 'none');
    }
  } catch (_ssErr) {
    console.warn('[mc-diag] sessionStorage read/parse threw:', _ssErr?.message || _ssErr);
  }

  // Preactivate path with no scanId: refuse to query. A "latest owned"
  // query here would display another artist's intelligence before
  // authentication is established — violating the ownership boundary.
  if (_isPreactivate && !getScanIdFromUrl()) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  // DIAGNOSTIC — remove after ownership trace confirmed
  let diagUserId = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    diagUserId = user ? user.id : null;
    console.log('[mc-diag] auth.getUser:', diagUserId ? `authenticated uid=${diagUserId}` : 'ANONYMOUS (no session)');
  } catch (diagErr) {
    console.log('[mc-diag] auth.getUser threw:', diagErr?.message);
  }

  const scanId = getScanIdFromUrl();
  console.log('[mc-diag] scanId from URL:', scanId || 'none — querying latest');
  try {
    const query = scanId
      ? supabase
          .from('audit_scans')
          .select('payload')
          .eq('id', scanId)
          .limit(1)
      : supabase
          .from('audit_scans')
          .select('payload')
          .order('created_at', { ascending: false })
          .limit(1);
    const { data, error } = await query;
    if (error) {
      console.warn('[mc] audit_scans read failed:', error.message);
      return null;
    }
    const row = (data && data[0]) || null;
    console.log('[mc-diag] query returned:', row
      ? `artist="${row.payload?.subject?.artistName}" scanId=${row.payload?.scanId}`
      : 'NO ROWS (RLS returned empty set)');
    if (!row || !row.payload) return null;
    return row.payload;
  } catch (err) {
    console.warn('[mc] audit_scans read threw:', err?.message || err);
    return null;
  }
}

// ─── DOM application — locked surface, data-attribute-targeted ────
//
// Each apply* helper takes one slot of a render plan (NOT the raw
// intelligence object) and applies it to the locked Mission Control
// DOM. The plan is produced by renderIdentity(intelligence) in the
// Intelligence Rendering Layer. The boot module never inspects the
// intelligence object itself — that would be a back-door for
// business logic to leak in here.

function applyCoveragePlan(plan) {
  if (!plan) return;
  const valueEl   = document.querySelector('[data-mc-identity-coverage-value]');
  const labelEl   = document.querySelector('[data-mc-identity-coverage-label]');
  const summaryEl = document.querySelector('[data-mc-identity-coverage-summary]');
  if (valueEl) {
    // Preserve the locked "%" small-tag treatment. innerHTML — not
    // textContent — so the locked typography continues to apply.
    valueEl.innerHTML = `${plan.value}<small>%</small>`;
  }
  if (labelEl)   labelEl.textContent   = plan.label;
  if (summaryEl) summaryEl.textContent = plan.summary;
}

function applyProvidersPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return;
  for (const entry of plan) {
    const card = document.querySelector(`[data-mc-identity-provider="${entry.provider}"]`);
    if (!card) continue;
    const pill = card.querySelector('[data-mc-identity-pill]') || card.querySelector('.mc-pill');
    if (!pill) continue;
    pill.className   = entry.pillClass;
    pill.textContent = entry.pillText;
  }
}

// ─── Platform status helpers — Build Pass 1A ─────────────────────────
// Maps a payload.platforms.*.availability string to a pill class + text.
// Deezer and TIDAL are not in identityIntelligence.supportedProviders
// (the assembler only covers apple/spotify/youtube in v1.0); their pill
// states must be read directly from payload.platforms.*.availability.
function _platformPill(availability) {
  switch (availability) {
    case 'VERIFIED':         return { cls: 'mc-pill mc-pill--verified', text: 'Verified' };
    case 'NOT_FOUND':        return { cls: 'mc-pill mc-pill--notfound', text: 'Not Found' };
    case 'AUTH_UNAVAILABLE':
    case 'ERROR':
    default:                 return { cls: 'mc-pill mc-pill--unable',   text: 'Unable to Confirm' };
  }
}

function applyDeezerStatus(payload) {
  const card = document.querySelector('[data-mc-identity-provider="deezer"]');
  if (!card) return;
  const pill = card.querySelector('[data-mc-identity-pill]');
  if (!pill) return;
  const deezer = payload?.platforms?.deezer;
  if (!deezer) return;
  // details is only non-null when the Deezer lookup succeeded (same lookup
  // that drives the Top Track row). Use it as the authoritative VERIFIED
  // signal. Fall back to the stored availability string for older payloads
  // (pre-Build-Pass-1 normalization) where details was not yet persisted.
  // Always apply a state — never silently leave the pill at "—".
  const state = (deezer.details != null)
    ? 'VERIFIED'
    : (deezer.availability || 'UNABLE_TO_CONFIRM');
  const { cls, text } = _platformPill(state);
  pill.className   = cls;
  pill.textContent = text;
}

function applyTidalStatus(payload) {
  const card = document.querySelector('[data-mc-identity-provider="tidal"]');
  if (!card) return;
  const pill = card.querySelector('[data-mc-identity-pill]');
  if (!pill) return;
  // Always apply a state — never silently leave the pill at "—".
  // TIDAL has no active scan integration yet; the platform entry is always
  // NOT_FOUND. Defaults to UNABLE_TO_CONFIRM if the key is absent entirely.
  const avail = payload?.platforms?.tidal?.availability || 'UNABLE_TO_CONFIRM';
  const { cls, text } = _platformPill(avail);
  pill.className   = cls;
  pill.textContent = text;
}

// applyDeezerTopTrack — always writes to the DOM when a payload is present.
// No sample values are ever left in place after a live scan.
//   - 1+ tracks → display first-ranked track title + ISRC
//   - 0 tracks  → display "Not Available"
function applyDeezerTopTrack(payload) {
  const titleEl = document.querySelector('[data-mc-identity-top-track-title]');
  const isrcEl  = document.querySelector('[data-mc-identity-top-track-isrc]');
  if (!titleEl || !isrcEl) return;
  const tracks = payload?.platforms?.deezer?.details?.topTracks;
  const track  = Array.isArray(tracks) && tracks.length > 0 ? tracks[0] : null;
  if (track) {
    titleEl.textContent = track.title || 'Not Available';
    isrcEl.textContent  = track.isrc  || '—';
  } else {
    titleEl.textContent = 'Not Available';
    isrcEl.textContent  = '—';
  }
}

// ─── Publishing Intelligence™ apply helpers (Phase 5B Board D6 + D7) ─

function applyPublishingCoveragePlan(plan) {
  if (!plan) return;
  const valueEl   = document.querySelector('[data-mc-publishing-coverage-value]');
  const labelEl   = document.querySelector('[data-mc-publishing-coverage-label]');
  const summaryEl = document.querySelector('[data-mc-publishing-coverage-summary]');
  if (valueEl)   valueEl.innerHTML   = `${plan.value}<small>%</small>`;
  if (labelEl)   labelEl.textContent = plan.label;
  if (summaryEl) summaryEl.textContent = plan.summary;
}

function applyPublishingRegistrationsPlan(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return;
  for (const entry of plan) {
    const row = document.querySelector(`[data-mc-publishing-metric="${entry.metric}"]`);
    if (!row) continue;
    const pill = row.querySelector('[data-mc-publishing-pill]') || row.querySelector('.mc-pill');
    if (!pill) continue;
    pill.className   = entry.pillClass;
    pill.textContent = entry.pillText;
  }
}

function applyRecommendationsPlan(plan) {
  if (plan === null) return; // no intelligence → leave the locked sample HTML
  const list  = document.querySelector('[data-mc-priority-actions]');
  const count = document.querySelector('[data-mc-priority-actions-count]');
  if (!list) return;

  // Render each recommendation as a list item that matches the locked
  // .mc-pa-item visual treatment. The SVG icon + arrow markup is the
  // same shape the locked sample HTML uses.
  list.innerHTML = plan.map((rec) => `
    <li class="mc-pa-item" data-mc-priority-action data-mc-rule-id="${escapeAttr(rec.ruleId || '')}">
      <span class="mc-pa-item-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>
      </span>
      <span class="mc-pa-item-label">${escapeText(rec.label)}</span>
      <svg class="mc-pa-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 5l7 7-7 7"/></svg>
    </li>
  `).join('');

  if (count) count.textContent = String(plan.length);
}

// ─── Global Music Footprint™ apply helpers (GMF Phase v1.0) ──────────
//
// Wires the territory count into the existing animated counter by
// setting data-mc-footprint-territories on .mc-globe-territories-count.
// The IIFE animation in mission-control.html reads that attribute via
// getTerritoryCount() on every requestAnimationFrame tick, so the
// first sweep after boot fires will use the real value.
//
// Coverage, status, and confidence are stored as data attributes on
// #global-footprint for future UI wiring (not currently visible per
// MC Executive OS lock — no layout/visual changes without Board directive).

function applyFootprintPlan(plan) {
  if (!plan) return;
  const countEl = document.querySelector('.mc-globe-territories-count');
  if (countEl) countEl.dataset.mcFootprintTerritories = String(plan.territoriesAvailable);
  const card = document.querySelector('#global-footprint');
  if (!card) return;
  card.dataset.mcFootprintCoverage   = String(plan.coveragePercent);
  card.dataset.mcFootprintStatus     = plan.status;
  card.dataset.mcFootprintConfidence = plan.confidence;
}

// ─── Catalog Intelligence™ apply helpers (Catalog Phase v1.0) ────────

function applyCatalogPlan(plan) {
  if (!plan) return;
  const set = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = String(value);
  };
  set('[data-mc-catalog-singles]',  plan.singles);
  set('[data-mc-catalog-eps]',      plan.eps);
  set('[data-mc-catalog-albums]',   plan.albums);
  set('[data-mc-catalog-tracks]',   plan.totalTracks);
  set('[data-mc-catalog-status]',   plan.catalogStatus);
  // Update the label in place so "Catalog Score™" reads "Catalog Status™"
  const labelEl = document.querySelector('[data-mc-catalog-status-label]');
  if (labelEl) labelEl.textContent = 'Catalog Status™';
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Royaltē AI™ apply helpers (Phase Royaltē AI v1.0) ───────────────
//
// Writes observation to [data-mc-ai-observation] and replaces the
// [data-mc-ai-activity-list] contents with 3 real intelligence items.
// Leaves the locked sample HTML untouched when plan is null.

function applyRoyalteAIPlan(plan) {
  if (!plan) return;
  const bodyEl = document.querySelector('[data-mc-ai-observation]');
  if (bodyEl) bodyEl.textContent = plan.observation;
  const list = document.querySelector('[data-mc-ai-activity-list]');
  if (!list) return;
  list.innerHTML = plan.activities.map((item) => `
    <li class="mc-ai-activity-item">
      <span class="mc-ai-activity-dot" aria-hidden="true"></span>
      <div class="mc-ai-activity-text">
        <div class="mc-ai-activity-title">${escapeText(item.label)}</div>
        <div class="mc-ai-activity-sub">${escapeText(item.text)}</div>
      </div>
    </li>
  `).join('');
}

// ─── Change Detection™ apply helpers (Monitoring Intelligence Phase v1.0) ────
//
// Maps the monitoringIntelligence render plan to the Change Detection™ card.
// Summary counters are set via data attribute selectors; the event feed is
// replaced wholesale using the same innerHTML-replacement pattern as
// applyRoyalteAIPlan. Static SVG icons are keyed to change_type so each
// event class (territory, release, ISRC, baseline, video, podcast) uses the
// appropriate glyph. Leaves the locked sample HTML untouched when plan is null.

const CHANGE_TYPE_ICON_SVG = Object.freeze({
  // Shield + check — first scan / baseline
  baseline_established: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`,
  // Music note — release events
  release_added:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  release_removed:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  // Globe — territory events
  territory_gain:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>`,
  territory_loss:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>`,
  // Fingerprint/hash — ISRC events
  isrc_added:           `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>`,
  isrc_dropped:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>`,
  isrc_mismatch:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3"/><path d="M7 8v8M12 8v8M17 8v8"/></svg>`,
  // Play — YouTube video events
  video_added:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  video_removed:        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  // Mic — podcast
  podcast_appearance:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/></svg>`,
  // Default bolt
  _default:             `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4.5 13h6L11 22l8.5-11h-6z"/></svg>`,
});

function iconForChangeType(changeType) {
  return CHANGE_TYPE_ICON_SVG[changeType] || CHANGE_TYPE_ICON_SVG._default;
}

function applyChangeDetectionPlan(plan) {
  if (!plan) return;
  const sumValueEl = document.querySelector('[data-mc-cd-sum-value]');
  const sumMetaEl  = document.querySelector('[data-mc-cd-sum-meta]');
  if (sumValueEl) sumValueEl.textContent = plan.sumValue;
  if (sumMetaEl)  sumMetaEl.textContent  = plan.sumMeta;

  const feed = document.querySelector('[data-mc-cd-feed]');
  if (!feed) return;

  if (plan.events.length === 0) {
    // No delta events — show a single "all clear" row
    feed.innerHTML = `
      <li class="mc-cd-event">
        <span class="mc-cd-icon" aria-hidden="true">${iconForChangeType('baseline_established')}</span>
        <div class="mc-cd-event-body">
          <div class="mc-cd-event-title">No changes detected this scan</div>
          <div class="mc-cd-event-meta">This Scan</div>
        </div>
      </li>`;
    return;
  }

  feed.innerHTML = plan.events.map((e) => `
    <li class="mc-cd-event">
      <span class="mc-cd-icon" aria-hidden="true">${iconForChangeType(e.changeType)}</span>
      <div class="mc-cd-event-body">
        <div class="mc-cd-event-title">${escapeText(e.title)}</div>
        <div class="mc-cd-event-meta">This Scan</div>
      </div>
    </li>`).join('');
}

// ─── Music Ecosystem Status™ helpers — Sprint 3.1 ───────────────────
//
// buildEcosystemStatusPlan + applyEcosystemStatusPlan.
//
// Mission Control is a Constitutional Presentation Layer™.
// It reads from constitutional intelligence engines. It never computes.
//
// Constitutional ownership for every displayed value:
//   Health Score / Grade / Trend → Health Intelligence™
//   Last Scan                    → Evidence Snapshot Store™ (monitoringIntelligence.capturedAt)
//   Next Scheduled Scan          → Monitoring Policy™ (monitoringIntelligence.nextScan)
//   Changes Detected             → Evidence Events™ (Change Detection render plan)
//   Priority Actions             → Executive Brief™ (executiveBrief.priorityActions)
//   Monitoring Status            → Monitoring Intelligence™ (monitoringIntelligence.status)

function _esFormatTimeAgo(iso) {
  if (!iso || typeof iso !== 'string') return '—';
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms) || ms < 0) return '—';
    const min = Math.floor(ms / 60000);
    if (min < 1)  return 'Just now';
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24)  return `${hr}h ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return '—'; }
}

// Translates Monitoring Intelligence™ raw status codes to display labels.
// This is a presentation-layer label map — no business logic.
function _esMonitoringStatusLabel(rawStatus) {
  const LABELS = {
    'baseline':           'Operational',
    'active':             'Operational',
    'no_changes':         'Operational',
    'scheduled':          'Scheduled',
    'delayed':            'Delayed',
    'maintenance':        'Maintenance',
    'attention_required': 'Attention Required',
    'attention':          'Attention Required',
  };
  return LABELS[rawStatus] || 'Operational';
}

function buildEcosystemStatusPlan(payload, plans) {
  const hp = plans.healthPlan;
  const cd = plans.cdPlan;
  const mi = payload?.monitoringIntelligence;
  const eb = payload?.executiveBrief;

  // Health Score + Grade — constitutional owner: Health Intelligence™
  const score = hp?.score ?? null;
  const grade = hp?.status ?? '—';

  // Health Trend — constitutional owner: Health Intelligence™
  const delta = (typeof payload?.healthIntelligence?.delta === 'number')
    ? payload.healthIntelligence.delta : null;

  // Last Scan — constitutional owner: Evidence Snapshot Store™
  // Source: monitoringIntelligence.capturedAt (EvidenceSnapshot.capturedAt field)
  const lastScanIso = mi?.capturedAt ?? null;
  const lastScan    = _esFormatTimeAgo(lastScanIso);

  // Next Scheduled Scan — constitutional owner: Monitoring Policy™
  // Source: monitoringIntelligence.nextScan (derived from capturedAt + policy frequencyMs)
  const nextScanIso = mi?.nextScan ?? null;
  let nextScan = 'Scheduled', nextScanMeta = '';
  if (nextScanIso) {
    try {
      const d = new Date(nextScanIso);
      nextScan     = d.toLocaleDateString('en-US', { weekday: 'long' });
      nextScanMeta = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { /* keep defaults */ }
  }

  // Changes Detected — constitutional owner: Evidence Events™
  // Source: Change Detection™ render plan (cdPlan)
  const changesValue = cd?.sumValue ?? '—';
  const changesMeta  = cd?.sumMeta  ?? '';

  // Priority Actions — constitutional owner: Executive Brief™
  // Source: executiveBrief.priorityActions
  const paList  = Array.isArray(eb?.priorityActions) ? eb.priorityActions : [];
  const paCount = paList.length;

  // Monitoring Status — constitutional owner: Monitoring Intelligence™
  // Source: monitoringIntelligence.status → display label map
  const statusLabel   = _esMonitoringStatusLabel(mi?.status ?? null);
  const isOperational = statusLabel === 'Operational';

  return { score, grade, delta, lastScan, nextScan, nextScanMeta,
           changesValue, changesMeta, paCount, statusLabel, isOperational };
}

function applyEcosystemStatusPlan(plan) {
  if (!plan) return;
  const q = (sel) => document.querySelector(sel);

  // Grade label (score written by count-up in __mcRevealModule)
  const gradeEl = q('[data-mc-es-health-grade]');
  if (gradeEl) gradeEl.textContent = plan.grade;

  // Trend indicator
  const trendEl = q('[data-mc-es-health-trend]');
  if (trendEl) {
    if (plan.delta !== null) {
      const dir = plan.delta >= 0 ? '▲' : '▼';
      const sgn = plan.delta > 0 ? '+' : '';
      trendEl.textContent  = `${dir} ${sgn}${plan.delta} since last scan`;
      trendEl.className    = `mc-es-health-trend ${plan.delta >= 0 ? 'up' : 'down'}`;
    } else {
      trendEl.textContent = '';
    }
  }

  // Last scan
  const lastEl = q('[data-mc-es-last-scan]');
  if (lastEl) lastEl.textContent = plan.lastScan;

  // Next scan
  const nextEl = q('[data-mc-es-next-scan]');
  if (nextEl) nextEl.textContent = plan.nextScan;
  const nextMetaEl = q('[data-mc-es-next-scan-meta]');
  if (nextMetaEl) nextMetaEl.textContent = plan.nextScanMeta;

  // Changes
  const chgValEl  = q('[data-mc-es-changes-value]');
  const chgMetaEl = q('[data-mc-es-changes-meta]');
  if (chgValEl)  chgValEl.textContent  = plan.changesValue;
  if (chgMetaEl) chgMetaEl.textContent = plan.changesMeta;

  // Priority actions
  const paValEl  = q('[data-mc-es-priority-value]');
  const paMetaEl = q('[data-mc-es-priority-meta]');
  if (paValEl) {
    if (plan.paCount === 0) {
      paValEl.textContent = 'None';
      paValEl.classList.add('mc-es-no-action');
    } else {
      paValEl.textContent = String(plan.paCount);
      paValEl.classList.remove('mc-es-no-action');
    }
  }
  if (paMetaEl) {
    paMetaEl.textContent = plan.paCount === 0
      ? 'No Action Required'
      : plan.paCount === 1 ? 'High Priority' : 'Actions Required';
  }

  // Monitoring status
  const statusEl = q('[data-mc-es-status-value]');
  if (statusEl) statusEl.textContent = plan.statusLabel;
  const activeEl = q('[data-mc-es-status-active]');
  if (activeEl) activeEl.style.display = plan.isOperational ? 'flex' : 'none';
}

// ─── Health Intelligence™ v2.0 — Sprint 3.2 ────────────────────────
//
// Mission Control is a Constitutional Presentation Layer™.
// Constitutional ownership for every displayed value:
//   Overall Health Score / Grade / Trend / Breakdown → Health Intelligence Engine™
//   Biggest Improvement                              → Evidence Events™
//   Biggest Risk                                     → Health Intelligence Engine™
//   Health Trend Sparkline                           → Historical Health Snapshots™ (pending)
//   Recent Changes                                   → Evidence Events™ / Monitoring Intelligence™

// Display-tier thresholds for status dots — presentation layer only,
// never used for scoring. Determines color of status indicator per category.
const _HI_DOT_THRESHOLDS = { green: 90, teal: 70, amber: 50 };

function _hiDotClass(score) {
  if (score >= _HI_DOT_THRESHOLDS.green)  return 'mc-hi-green';
  if (score >= _HI_DOT_THRESHOLDS.teal)   return 'mc-hi-teal';
  if (score >= _HI_DOT_THRESHOLDS.amber)  return 'mc-hi-amber';
  return 'mc-hi-red';
}

// Constitutional owner: Health Intelligence Engine™ (via healthReport.trend)
function _hiTrendDir(trendRaw) {
  if (!trendRaw || typeof trendRaw !== 'string') return 'stable';
  const t = trendRaw.toLowerCase();
  if (t === 'up'   || t === 'improving') return 'up';
  if (t === 'down' || t === 'declining') return 'down';
  return 'stable';
}

function _hiTrendLabel(dir, delta) {
  if (dir === 'up')   return typeof delta === 'number' ? `▲ +${delta} Since Last Scan` : '▲ Improving';
  if (dir === 'down') return typeof delta === 'number' ? `▼ −${delta} Since Last Scan` : '▼ Declining';
  return '— Stable';
}

// Constitutional owner: Evidence Events™ (strengths from Health Intelligence Engine™)
function _hiBestImprovement(hp) {
  const s = hp?.strengths;
  if (!Array.isArray(s) || s.length === 0) return { title: 'No improvements recorded', meta: '' };
  return { title: s[0], meta: '' };
}

// Constitutional owner: Health Intelligence Engine™ (concerns)
function _hiBiggestRisk(hp) {
  const c = hp?.concerns;
  if (!Array.isArray(c) || c.length === 0) return { title: 'No risks identified', meta: '' };
  return { title: c[0], meta: '' };
}

// Constitutional owner: Evidence Events™ / Monitoring Intelligence™
function _hiRecentChanges(hp, mi) {
  const changes = [];
  if (Array.isArray(hp?.strengths)) {
    for (const s of hp.strengths.slice(0, 2)) { if (s) changes.push(s); }
  }
  if (Array.isArray(mi?.events)) {
    for (const e of mi.events.slice(0, 2)) { if (e?.title && changes.length < 3) changes.push(e.title); }
  }
  if (changes.length === 0 && Array.isArray(hp?.concerns)) {
    for (const c of hp.concerns.slice(0, 2)) { if (c) changes.push(c); }
  }
  return changes.slice(0, 3);
}

// ─── Identity Intelligence™ plan builders — Sprint 3.3 ──────────────
//
// Constitutional Presentation Layer™. Reads ii.* from the locked
// Identity Intelligence Engine™ output. Never computes, scores,
// or verifies. All values sourced from the constitutional owner.

const _ID_COVERAGE_GRADE = (pct) => {
  if (pct >= 90) return 'Excellent Coverage';
  if (pct >= 70) return 'Strong Coverage';
  if (pct >= 50) return 'Good Coverage';
  return 'Needs Attention';
};

const _ID_STATE_PILL = {
  'VERIFIED':           { cls: 'mc-pill mc-pill--verified', text: 'Verified' },
  'ACTION_REQUIRED':    { cls: 'mc-pill mc-pill--action',   text: 'Needs Attention' },
  'NOT_FOUND':          { cls: 'mc-pill mc-pill--notfound', text: 'Not Found' },
  'UNABLE_TO_CONFIRM':  { cls: 'mc-pill mc-pill--unable',   text: 'Unavailable' },
};

function _idPlatformPill(availability) {
  if (availability === 'VERIFIED')  return _ID_STATE_PILL['VERIFIED'];
  if (availability === 'NOT_FOUND') return _ID_STATE_PILL['NOT_FOUND'];
  return _ID_STATE_PILL['UNABLE_TO_CONFIRM'];
}

function _idSeverityLabel(severity) {
  if (!severity) return '';
  const s = String(severity).toUpperCase();
  if (s === 'HIGH')   return 'High Impact';
  if (s === 'MEDIUM') return 'Medium Impact';
  if (s === 'LOW')    return 'Low Impact';
  return severity;
}

function buildIdentityIntelligencePlan(payload) {
  const ii = safeIdentityIntelligence(payload?.identityIntelligence);

  // Section 1 — Coverage
  const coverage = (ii && typeof ii.coverage === 'number') ? ii.coverage : null;
  const verifiedCount = ii?.verifiedProviders ?? 0;
  const totalCount    = ii?.totalProviders    ?? 0;
  const grade = coverage !== null ? _ID_COVERAGE_GRADE(coverage) : '—';
  const sub   = totalCount > 0 ? `${verifiedCount} of ${totalCount} verified` : '— of — verified';

  // Section 2 — Summary counts from the provider state map
  let sumVerified = 0, sumAction = 0, sumMissing = 0, sumUnavailable = 0;
  if (ii?.providers && typeof ii.providers === 'object') {
    for (const state of Object.values(ii.providers)) {
      if      (state === 'VERIFIED')          sumVerified++;
      else if (state === 'ACTION_REQUIRED')   sumAction++;
      else if (state === 'NOT_FOUND')         sumMissing++;
      else                                    sumUnavailable++;
    }
  }

  // Section 3 — Provider pills
  // Constitutional (apple/spotify/youtube) from ii.providers
  const allProviders = [];
  if (ii?.supportedProviders && ii?.providers) {
    for (const p of ii.supportedProviders) {
      const state = ii.providers[p] || 'UNABLE_TO_CONFIRM';
      const pill  = _ID_STATE_PILL[state] || _ID_STATE_PILL['UNABLE_TO_CONFIRM'];
      allProviders.push({ provider: p, ...pill });
    }
  }
  // Platform providers (deezer, tidal) read from payload.platforms
  for (const p of ['deezer', 'tidal']) {
    const avail = payload?.platforms?.[p]?.availability;
    const pill  = _idPlatformPill(avail);
    allProviders.push({ provider: p, ...pill });
  }

  // Section 4 — Biggest Risk: first issue
  const riskIssue = Array.isArray(ii?.issues) ? ii.issues[0] : null;
  const riskTitle = riskIssue?.label ?? (ii ? 'No critical identity issues' : '—');
  const riskMeta  = riskIssue ? _idSeverityLabel(riskIssue.severity) : '';

  // Section 5 — Biggest Win: first strength
  const winStrength = Array.isArray(ii?.strengths) ? ii.strengths[0] : null;
  const winTitle = winStrength?.label ?? (ii ? 'Identity loaded' : '—');
  const winMeta  = '';

  // Section 6 — Recent Changes: strengths first, then issues (up to 3)
  const changes = [];
  if (ii) {
    for (const s of (Array.isArray(ii.strengths) ? ii.strengths : []).slice(0, 2)) {
      if (s?.label) changes.push(s.label);
    }
    for (const issue of (Array.isArray(ii.issues) ? ii.issues : [])) {
      if (changes.length >= 3) break;
      if (issue?.label) changes.push(issue.label);
    }
  }
  if (changes.length === 0) changes.push('Identity data loaded');

  return { coverage, grade, sub, sumVerified, sumAction, sumMissing, sumUnavailable, allProviders, riskTitle, riskMeta, winTitle, winMeta, changes };
}

function applyIdentityIntelligencePlan(plan) {
  if (!plan) return;
  const q  = (s) => document.querySelector(s);
  const qa = (s) => Array.from(document.querySelectorAll(s));

  // Section 1 — Coverage
  const scoreEl = q('[data-mc-id-coverage]');
  if (scoreEl) scoreEl.textContent = plan.coverage !== null ? String(plan.coverage) : '—';
  const gradeEl = q('[data-mc-id-coverage-grade]');
  if (gradeEl) gradeEl.textContent = plan.grade;
  const subEl = q('[data-mc-id-coverage-sub]');
  if (subEl)   subEl.textContent   = plan.sub;

  // Section 2 — Summary counts
  const sv = q('[data-mc-id-sum-verified]');    if (sv) sv.textContent = String(plan.sumVerified);
  const sa = q('[data-mc-id-sum-action]');      if (sa) sa.textContent = String(plan.sumAction);
  const sm = q('[data-mc-id-sum-missing]');     if (sm) sm.textContent = String(plan.sumMissing);
  const su = q('[data-mc-id-sum-unavailable]'); if (su) su.textContent = String(plan.sumUnavailable);

  // Section 3 — Provider pills
  for (const entry of plan.allProviders) {
    const row  = q(`[data-mc-id-provider="${entry.provider}"]`);
    if (!row) continue;
    const pill = row.querySelector('[data-mc-id-provider-pill]') || row.querySelector('.mc-pill');
    if (!pill) continue;
    pill.className   = entry.cls;
    pill.textContent = entry.text;
  }

  // Section 4 — Biggest Risk
  const rt = q('[data-mc-id-risk-title]'); if (rt) rt.textContent = plan.riskTitle;
  const rm = q('[data-mc-id-risk-meta]');  if (rm) rm.textContent = plan.riskMeta;

  // Section 5 — Biggest Win
  const wt = q('[data-mc-id-win-title]'); if (wt) wt.textContent = plan.winTitle;
  const wm = q('[data-mc-id-win-meta]');  if (wm) wm.textContent = plan.winMeta;

  // Section 6 — Recent Changes (textContent-safe DOM build)
  const changesList = q('[data-mc-id-changes]');
  if (changesList) {
    changesList.innerHTML = '';
    for (const c of plan.changes.slice(0, 3)) {
      const li = document.createElement('li');
      li.textContent = c;
      changesList.appendChild(li);
    }
  }
}

// ─── Publishing Intelligence™ plan builders — Sprint 3.4 ─────────────
//
// Constitutional Presentation Layer™. Reads pi.* from the locked
// Publishing Intelligence Engine™ output. Never computes, never
// registers, never estimates dollar amounts.

const _PI_COVERAGE_GRADE = (pct) => {
  if (pct >= 90) return 'Excellent Coverage';
  if (pct >= 70) return 'Good Coverage';
  if (pct >= 50) return 'Fair Coverage';
  return 'Needs Attention';
};

const _PI_STATE_PILL = {
  'VERIFIED':          { cls: 'mc-pill mc-pill--verified', text: 'Verified' },
  'ACTION_REQUIRED':   { cls: 'mc-pill mc-pill--action',   text: 'Needs Attention' },
  'NOT_FOUND':         { cls: 'mc-pill mc-pill--notfound', text: 'Missing' },
  'UNABLE_TO_CONFIRM': { cls: 'mc-pill mc-pill--unable',   text: 'Connected' },
};

// Resolution time lookup per metric (Board Brief § 6, Estimated Resolution Time).
const _PI_RESOLUTION_TIME = {
  writerIpi:             'Est. 5–10 min to resolve',
  iswcCoverage:          'Est. 10–30 min to resolve',
  compositionMatch:      'Est. 10–30 min to resolve',
  mlcRegistration:       'Est. 15–30 min to resolve',
  registeredWorks:       'Est. 15–45 min to resolve',
  registeredSongwriters: 'Est. 15–45 min to resolve',
};

function _piFinancialImpact(issues) {
  const topIssue = Array.isArray(issues) ? issues[0] : null;
  const resolution = topIssue
    ? (_PI_RESOLUTION_TIME[topIssue.metric] || 'Est. 10–30 min to resolve')
    : 'No action required';

  if (!topIssue) {
    return {
      level: 'low', badge: 'LOW RISK', badgeCls: 'mc-pi-impact-badge mc-pi-impact-badge--low',
      body: 'No significant publishing gaps detected.',
      resolution,
    };
  }
  const severities = issues.map(i => String(i.severity || '').toUpperCase());
  if (severities.includes('HIGH')) {
    return {
      level: 'high', badge: 'HIGH RISK', badgeCls: 'mc-pi-impact-badge mc-pi-impact-badge--high',
      body: 'Multiple publishing registrations appear incomplete. Some royalty collection opportunities may not be fully realized until these issues are resolved.',
      resolution,
    };
  }
  if (severities.includes('MEDIUM')) {
    return {
      level: 'medium', badge: 'MEDIUM RISK', badgeCls: 'mc-pi-impact-badge mc-pi-impact-badge--medium',
      body: 'One publishing registration requires attention. Royalty collection may be affected until registration is completed.',
      resolution,
    };
  }
  return {
    level: 'low', badge: 'LOW RISK', badgeCls: 'mc-pi-impact-badge mc-pi-impact-badge--low',
    body: 'No significant publishing gaps detected.',
    resolution,
  };
}

function buildPublishingIntelligencePlan(payload) {
  const pi = safePublishingIntelligence(payload?.publishingIntelligence);

  // Section 1 — Coverage
  const coverage = (pi && typeof pi.coverage === 'number') ? pi.coverage : null;
  const regCount  = pi?.registeredCount ?? 0;
  const totCount  = pi?.totalChecked    ?? 0;
  const grade = coverage !== null ? _PI_COVERAGE_GRADE(coverage) : '—';
  const sub   = totCount > 0 ? `${regCount} of ${totCount} complete` : '— of — complete';

  // Section 2 — Summary counts from the registrations state map
  let sumVerified = 0, sumConnected = 0, sumAttention = 0, sumMissing = 0;
  if (pi?.registrations && typeof pi.registrations === 'object') {
    for (const state of Object.values(pi.registrations)) {
      if      (state === 'VERIFIED')          sumVerified++;
      else if (state === 'ACTION_REQUIRED')   sumAttention++;
      else if (state === 'NOT_FOUND')         sumMissing++;
      else                                    sumConnected++;
    }
  }

  // Section 3 — System pills
  const systems = [];
  const METRIC_ORDER = ['mlcRegistration','registeredWorks','iswcCoverage','registeredSongwriters','writerIpi','compositionMatch'];
  for (const m of METRIC_ORDER) {
    const state = pi?.registrations?.[m] || 'UNABLE_TO_CONFIRM';
    const pill  = _PI_STATE_PILL[state] || _PI_STATE_PILL['UNABLE_TO_CONFIRM'];
    systems.push({ metric: m, ...pill });
  }

  // Section 4 — Financial Impact (derived from issue severities — presentation lookup only)
  const impact = _piFinancialImpact(pi?.issues || []);

  // Section 5 — Biggest Risk
  const riskIssue = Array.isArray(pi?.issues) ? pi.issues[0] : null;
  const riskTitle = riskIssue?.label ?? (pi ? 'No critical publishing issues' : '—');
  const riskMeta  = '';
  const riskRes   = riskIssue ? (_PI_RESOLUTION_TIME[riskIssue.metric] || 'Est. 10–30 min to resolve') : '';

  // Section 6 — Biggest Win
  const winStrength = Array.isArray(pi?.strengths) ? pi.strengths[0] : null;
  const winTitle = winStrength?.label ?? (pi ? 'Publishing data loaded' : '—');

  // Section 7 — Recent Changes (strengths first, then issues, up to 3)
  const changes = [];
  if (pi) {
    for (const s of (Array.isArray(pi.strengths) ? pi.strengths : []).slice(0, 2)) {
      if (s?.label) changes.push(s.label);
    }
    for (const issue of (Array.isArray(pi.issues) ? pi.issues : [])) {
      if (changes.length >= 3) break;
      if (issue?.label) changes.push(issue.label);
    }
  }
  if (changes.length === 0) changes.push('Publishing data loaded');

  return { coverage, grade, sub, sumVerified, sumConnected, sumAttention, sumMissing, systems, impact, riskTitle, riskMeta, riskRes, winTitle, changes };
}

function applyPublishingIntelligencePlan(plan) {
  if (!plan) return;
  const q = (s) => document.querySelector(s);

  // Section 1 — Coverage
  const scoreEl = q('[data-mc-pi-coverage]');
  if (scoreEl) scoreEl.textContent = plan.coverage !== null ? String(plan.coverage) : '—';
  const gradeEl = q('[data-mc-pi-coverage-grade]'); if (gradeEl) gradeEl.textContent = plan.grade;
  const subEl   = q('[data-mc-pi-coverage-sub]');   if (subEl)   subEl.textContent   = plan.sub;

  // Section 2 — Summary counts
  const sv = q('[data-mc-pi-sum-verified]');   if (sv) sv.textContent = String(plan.sumVerified);
  const sc = q('[data-mc-pi-sum-connected]');  if (sc) sc.textContent = String(plan.sumConnected);
  const sa = q('[data-mc-pi-sum-attention]');  if (sa) sa.textContent = String(plan.sumAttention);
  const sm = q('[data-mc-pi-sum-missing]');    if (sm) sm.textContent = String(plan.sumMissing);

  // Section 3 — System pills
  for (const entry of plan.systems) {
    const row  = q(`[data-mc-pi-system="${entry.metric}"]`);
    if (!row) continue;
    const pill = row.querySelector('[data-mc-pi-system-pill]') || row.querySelector('.mc-pill');
    if (!pill) continue;
    pill.className   = entry.cls;
    pill.textContent = entry.text;
  }

  // Section 4 — Financial Impact
  const badge = q('[data-mc-pi-impact-badge]');
  if (badge) { badge.className = plan.impact.badgeCls; badge.textContent = plan.impact.badge; }
  const body = q('[data-mc-pi-impact-body]');
  if (body) body.textContent = plan.impact.body;
  const res = q('[data-mc-pi-impact-resolution]');
  if (res) res.textContent = plan.impact.resolution;

  // Section 5 — Biggest Risk
  const rt = q('[data-mc-pi-risk-title]');      if (rt) rt.textContent = plan.riskTitle;
  const rm = q('[data-mc-pi-risk-meta]');        if (rm) rm.textContent = plan.riskMeta;
  const rr = q('[data-mc-pi-risk-resolution]'); if (rr) rr.textContent = plan.riskRes;

  // Section 6 — Biggest Win
  const wt = q('[data-mc-pi-win-title]'); if (wt) wt.textContent = plan.winTitle;
  const wm = q('[data-mc-pi-win-meta]');  if (wm) wm.textContent = '';

  // Section 7 — Recent Changes (textContent-safe DOM build)
  const changesList = q('[data-mc-pi-changes]');
  if (changesList) {
    changesList.innerHTML = '';
    for (const c of plan.changes.slice(0, 3)) {
      const li = document.createElement('li');
      li.textContent = c;
      changesList.appendChild(li);
    }
  }
}

function buildHealthIntelligencePlan(payload, plans) {
  const hp = plans.healthPlan;  // from renderHealth() — Health Intelligence Engine™
  const hr = payload?.healthReport;
  const mi = payload?.monitoringIntelligence;

  // Section 1: Overall Health Score — constitutional owner: Health Intelligence Engine™
  const score = hp?.score ?? null;
  const grade = hp?.status ?? '—';

  // Health Trend — constitutional owner: Health Intelligence Engine™ (healthReport.trend)
  const trendRaw = hr?.trend ?? null;
  const dir      = _hiTrendDir(trendRaw);
  const delta    = typeof payload?.healthIntelligence?.delta === 'number'
    ? payload.healthIntelligence.delta : null;
  const trendLabel = _hiTrendLabel(dir, delta);

  // Section 2: Breakdown — constitutional owner: Health Intelligence Engine™
  const domains = {
    identity:   hp?.domainScores?.identity   ?? 0,
    publishing: hp?.domainScores?.publishing ?? 0,
    catalog:    hp?.domainScores?.catalog    ?? 0,
    footprint:  hp?.domainScores?.footprint  ?? 0,
    monitoring: hp?.domainScores?.monitoring ?? 0,
    backend:    hp?.domainScores?.backend    ?? 0,
  };

  // Section 3: Biggest Improvement — constitutional owner: Evidence Events™
  const best = _hiBestImprovement(hp);

  // Section 4: Biggest Risk — constitutional owner: Health Intelligence Engine™
  const risk = _hiBiggestRisk(hp);

  // Section 5: Sparkline — current score as terminal point; historical pending
  // Constitutional owner: Health Intelligence Engine™ / Historical Health Snapshots™
  const sparkCurrent = score;

  // Section 6: Recent Changes — constitutional owner: Evidence Events™ / Monitoring Intelligence™
  const changes = _hiRecentChanges(hp, mi);

  return { score, grade, trendDir: dir, trendLabel, domains, best, risk, sparkCurrent, changes };
}

function applyHealthIntelligencePlan(plan) {
  if (!plan) return;
  const q  = (sel)       => document.querySelector(sel);
  const qq = (ctx, sel)  => ctx?.querySelector(sel) ?? null;

  // Section 1 — Score (count-up handled in __mcRevealModule)
  const gradeEl = q('[data-mc-hi-grade]');
  if (gradeEl) gradeEl.textContent = plan.grade;

  const trendRow = q('[data-mc-hi-trend-row]');
  if (trendRow) {
    trendRow.className = `mc-hi-trend-row mc-hi-${plan.trendDir}`;
    const arrowEl = q('[data-mc-hi-trend-arrow]');
    const textEl  = q('[data-mc-hi-trend-text]');
    if (arrowEl) arrowEl.textContent = plan.trendDir === 'up' ? '▲' : plan.trendDir === 'down' ? '▼' : '—';
    if (textEl)  textEl.textContent  = plan.trendLabel.replace(/^[▲▼—]\s*/, '');
  }

  // Section 2 — Breakdown
  const DOMAIN_LABELS = {
    identity: 'Identity', publishing: 'Publishing', catalog: 'Catalog',
    footprint: 'Streaming', monitoring: 'Monitoring', backend: 'Backend',
  };
  for (const [key, score] of Object.entries(plan.domains)) {
    const row = q(`[data-mc-hi-cat="${key}"]`);
    if (!row) continue;
    const scoreEl = qq(row, '[data-mc-hi-cat-score]');
    const dotEl   = qq(row, '[data-mc-hi-cat-dot]');
    if (scoreEl) scoreEl.textContent = String(score);
    if (dotEl)   dotEl.className = `mc-hi-cat-dot ${_hiDotClass(score)}`;
  }

  // Section 3 — Biggest Improvement
  const bestTitle = q('[data-mc-hi-best-title]');
  const bestMeta  = q('[data-mc-hi-best-meta]');
  if (bestTitle) bestTitle.textContent = plan.best.title;
  if (bestMeta && plan.best.meta) bestMeta.textContent = plan.best.meta;

  // Section 4 — Biggest Risk
  const riskTitle = q('[data-mc-hi-risk-title]');
  const riskMeta  = q('[data-mc-hi-risk-meta]');
  if (riskTitle) riskTitle.textContent = plan.risk.title;
  if (riskMeta && plan.risk.meta) riskMeta.textContent = plan.risk.meta;

  // Section 5 — Sparkline: current score at position 4; history pending
  const spark4 = q('[data-mc-hi-spark="4"]');
  if (spark4 && plan.sparkCurrent !== null) spark4.textContent = String(plan.sparkCurrent);

  // Section 6 — Recent Changes
  const changesList = q('[data-mc-hi-changes]');
  if (changesList && plan.changes.length > 0) {
    changesList.innerHTML = plan.changes
      .map((c) => `<li>${escapeHTML(c)}</li>`)
      .join('');
  }
}

// ─── Health Intelligence™ apply helper (Health Intelligence v1.0) ───
//
// Legacy helper — kept for backward-compat with preview mode (initMissionControl).
// The vault path uses applyHealthIntelligencePlan / __mcRevealModule exclusively.
// DOM targets from v1.0 ([data-mc-health-ring-progress], [data-mc-health-domain], etc.)
// no longer exist in the HTML — these querySelector calls are graceful no-ops.

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyHealthPlan(plan) {
  if (!plan) return;

  // Ring progress arc (SVG stroke-dasharray)
  const ringEl = document.querySelector('[data-mc-health-ring-progress]');
  if (ringEl) ringEl.setAttribute('stroke-dasharray', plan.ringDasharray);

  // Score + status + confidence
  const scoreEl = document.querySelector('[data-mc-health-score]');
  if (scoreEl) scoreEl.innerHTML = `${plan.score} <small>/100</small>`;

  const statusEl = document.querySelector('[data-mc-health-status]');
  if (statusEl) statusEl.textContent = plan.status;

  const confEl = document.querySelector('[data-mc-health-confidence]');
  if (confEl) confEl.textContent = `${plan.confidence} Confidence`;

  // Per-domain contributor scores
  const domainMap = {
    identity:   plan.domainScores.identity,
    publishing: plan.domainScores.publishing,
    catalog:    plan.domainScores.catalog,
    footprint:  plan.domainScores.footprint,
    monitoring: plan.domainScores.monitoring,
    backend:    plan.domainScores.backend,
  };
  for (const [domain, score] of Object.entries(domainMap)) {
    const row = document.querySelector(`[data-mc-health-domain="${domain}"]`);
    if (!row) continue;
    const valEl = row.querySelector('.val');
    if (valEl) valEl.textContent = score;
  }

  // Composite average row — displays the canonical health score (one score in the system)
  const compositeEl = document.querySelector('[data-mc-health-composite]');
  if (compositeEl) compositeEl.textContent = plan.score;

  // Strengths / concerns in the foot slot
  const foot = document.querySelector('[data-mc-health-insights]');
  if (!foot) return;

  const hasStrengths = plan.strengths.length > 0;
  const hasConcerns  = plan.concerns.length  > 0;
  if (!hasStrengths && !hasConcerns) return;

  const strengthsHTML = hasStrengths
    ? `<ul class="mc-health-breakdown-list">${plan.strengths.map((s) => `<li><span class="lbl">&#x2713; ${escapeHTML(s)}</span></li>`).join('')}</ul>`
    : '';
  const concernsHTML = hasConcerns
    ? `<ul class="mc-health-breakdown-list">${plan.concerns.map((c) => `<li><span class="lbl">&#x26A0; ${escapeHTML(c)}</span></li>`).join('')}</ul>`
    : '';

  foot.innerHTML = strengthsHTML + concernsHTML;
}

// ─── Backend Intelligence™ apply helpers (Backend Intelligence Phase v1.0) ──
//
// Writes connectedCount and summaryLabel into the summary row, then
// updates each service's sub/status text via [data-mc-backend-service]
// attribute targeting. Leaves the locked sample HTML untouched when
// plan is null.

function applyBackendPlan(plan) {
  if (!plan) return;
  const countEl   = document.querySelector('[data-mc-backend-connected-count]');
  const summaryEl = document.querySelector('[data-mc-backend-summary]');
  // Build Pass 3: countEl shows APIs Responding "N / 4"; summaryEl shows Last Sync.
  if (countEl)   countEl.textContent   = plan.apisRespondingLabel;
  if (summaryEl) summaryEl.textContent = plan.lastSyncLabel;
  for (const svc of plan.services) {
    const row = document.querySelector(`[data-mc-backend-service="${svc.key}"]`);
    if (!row) continue;
    const subEl    = row.querySelector('.mc-bi-service-sub');
    const statusEl = row.querySelector('.mc-bi-service-status');
    if (subEl)    subEl.textContent    = svc.subLabel;
    if (statusEl) statusEl.textContent = svc.statusLabel;
  }
}

// ─── Boot ──────────────────────────────────────────────────────────

async function initMissionControl() {
  // Phase 4.1: all production MC access goes through ?vault=1.
  // Intelligence is wired post-authentication via __mcPopulate() + __mcRevealModule().
  // initMissionControl() only runs in preview mode (fixture data, no vault).
  const _mcUrl     = typeof window !== 'undefined' ? new URL(window.location.href) : null;
  const _isVault   = _mcUrl?.searchParams.has('vault');
  const _isPreview = _mcUrl?.searchParams.has('preview') ||
    (typeof window !== 'undefined' && window.location.pathname.includes('mission-control-preview'));
  if (_isVault && !_isPreview) return;

  const payload = await fetchScanPayload();
  if (!payload) return; // graceful fallback: locked sample HTML stays

  // Identity Intelligence™ (Phase 4B-3) + Top Track (Build Pass 1)
  const identityIntelligence = safeIdentityIntelligence(payload.identityIntelligence);
  if (identityIntelligence) {
    const identityPlan = renderIdentity(identityIntelligence);
    applyCoveragePlan(identityPlan.coverage);
    applyProvidersPlan(identityPlan.providers);
    applyRecommendationsPlan(identityPlan.recommendations);
  }
  applyDeezerStatus(payload);
  applyTidalStatus(payload);
  applyDeezerTopTrack(payload);

  // Publishing Intelligence™ (Phase 5B Board D6 + D7)
  // Same boot pattern, no special-casing per domain. Future intelligence
  // domains (Backend, Health, Priority Actions) land alongside
  // these calls via their own renderXxx + applyXxx pairs.
  const publishingIntelligence = safePublishingIntelligence(payload.publishingIntelligence);
  if (publishingIntelligence) {
    const publishingPlan = renderPublishing(publishingIntelligence);
    applyPublishingCoveragePlan(publishingPlan.coverage);
    applyPublishingRegistrationsPlan(publishingPlan.registrations);
  }

  // Catalog Intelligence™ (Catalog Phase v1.0)
  const catalogIntelligence = safeCatalogIntelligence(payload.catalogIntelligence);
  if (catalogIntelligence) {
    const catalogPlan = renderCatalog(catalogIntelligence);
    applyCatalogPlan(catalogPlan);
  }

  // Global Music Footprint™ (GMF Phase v1.0)
  const globalMusicFootprint = safeGlobalMusicFootprintIntelligence(payload.globalMusicFootprint);
  if (globalMusicFootprint) {
    const footprintPlan = renderGlobalMusicFootprint(globalMusicFootprint);
    applyFootprintPlan(footprintPlan);
  }

  // Royaltē AI™ (Phase Royaltē AI v1.0)
  const royalteAI = safeRoyalteAI(payload.royalteAI);
  if (royalteAI) {
    const aiPlan = renderRoyalteAI(royalteAI);
    applyRoyalteAIPlan(aiPlan);
  }

  // Backend Intelligence™ (Backend Intelligence Phase v1.0)
  const backendIntelligence = safeBackendIntelligence(payload.backendIntelligence);
  if (backendIntelligence) {
    const backendPlan = renderBackend(backendIntelligence);
    applyBackendPlan(backendPlan);
  }

  // Monitoring Intelligence™ — Change Detection™ card (Monitoring Phase v1.0)
  // Per-scan delta only (Option A). Absent for unauthenticated scans;
  // locked sample HTML stays when monitoringIntelligence is null.
  const monitoringIntelligence = safeMonitoringIntelligence(payload.monitoringIntelligence);
  if (monitoringIntelligence) {
    const cdPlan = renderChangeDetection(monitoringIntelligence);
    applyChangeDetectionPlan(cdPlan);
  }

  // Health Intelligence™ (Health Intelligence v1.0)
  // Reads pre-assembled healthIntelligence from audit_scans.payload.
  // The two-phase OS write re-assembles with real monitoringIntelligence
  // before this boot module reads it, so the score reflects all 6 domains.
  const healthIntelligence = safeHealthIntelligence(payload.healthIntelligence);
  if (healthIntelligence) {
    const healthPlan = renderHealth(healthIntelligence);
    applyHealthPlan(healthPlan);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initMissionControl();
      initRtz(); // Reporting Time Zone™ — independent of scan payload
    });
  } else {
    initMissionControl();
    initRtz();
  }
}

// ─── Phase 4 vault activation hooks ────────────────────────────────────
//
// Engineering rule (Board directive 2026-06-29):
//   The operating system exists first. The intelligence exists second.
//
//   window.__mcPopulate()       — fetches the authenticated payload,
//                                 runs all renderers, stores every plan
//                                 in _vaultPlans. Writes NOTHING to the
//                                 DOM. MC stays in its true zero-data
//                                 state until each module activates.
//
//   window.__mcRevealModule(id) — sole writer of intelligence to the DOM.
//                                 Called per-module the moment mc-online
//                                 is set. Reads the stored plan and
//                                 applies it — rings fill, counts rise,
//                                 text appears for that module only.

let _vaultPlans = {};

if (typeof window !== 'undefined') {
  window.__mcPopulate = async function () {
    const payload = await fetchScanPayload();
    if (!payload) return;

    console.log('[mc-diag] __mcPopulate payload source — subject.artistName:', payload.subject?.artistName || '(none)', '| intelligence keys present:', ['identityIntelligence','publishingIntelligence','healthIntelligence','royalteAI','catalogIntelligence','globalMusicFootprint','backendIntelligence','monitoringIntelligence'].filter(k => payload[k] != null).join(',') || 'NONE');

    // Store artist name — sole source of truth for what subject MC is displaying.
    // Consumed by __mcRevealHero() to write [data-mc-page-title].
    _vaultPlans.artistName = payload.subject?.artistName || payload.artistName || null;

    // Identity — Sprint 3.3: executive plan (idPlan) replaces per-slice plans
    const ii = safeIdentityIntelligence(payload.identityIntelligence);
    if (ii) {
      const plan = renderIdentity(ii);
      _vaultPlans.identityCoverage        = plan.coverage;        // legacy
      _vaultPlans.identityProviders       = plan.providers;       // legacy
      _vaultPlans.identityRecommendations = plan.recommendations; // still used by ai-insights
    }
    _vaultPlans.idPlan  = buildIdentityIntelligencePlan(payload);
    _vaultPlans.payload = payload; // platform data (deezer/tidal) read by idPlan builder

    // Persist resolved image context for workspace pages (identity-intelligence, etc.).
    // Uses a separate key that is never consumed/removed — survives navigation for the full session.
    try {
      sessionStorage.setItem('royalte_session_context', JSON.stringify({
        artistImageUrl: payload.cio?.identity?.artwork ||
                        payload.subject?.artistImageUrl ||
                        payload.artistImageUrl || null,
        albumImageUrl:  payload.albumImageUrl || null,
      }));
    } catch (_e) {}

    // Publishing — Sprint 3.4: executive plan (piPlan) replaces per-slice plans
    const pi = safePublishingIntelligence(payload.publishingIntelligence);
    if (pi) {
      const plan = renderPublishing(pi);
      _vaultPlans.publishingCoverage      = plan.coverage;       // legacy (ai-insights)
      _vaultPlans.publishingRegistrations = plan.registrations;  // legacy (ai-insights)
    }
    _vaultPlans.piPlan = buildPublishingIntelligencePlan(payload);

    // Catalog
    const ci = safeCatalogIntelligence(payload.catalogIntelligence);
    if (ci) _vaultPlans.catalogPlan = renderCatalog(ci);

    // Global Music Footprint
    const gmf = safeGlobalMusicFootprintIntelligence(payload.globalMusicFootprint);
    if (gmf) _vaultPlans.footprintPlan = renderGlobalMusicFootprint(gmf);

    // Royaltē AI
    const ai = safeRoyalteAI(payload.royalteAI);
    if (ai) _vaultPlans.aiPlan = renderRoyalteAI(ai);

    // Backend
    const bi = safeBackendIntelligence(payload.backendIntelligence);
    if (bi) _vaultPlans.backendPlan = renderBackend(bi);

    // Monitoring / Change Detection
    const mi = safeMonitoringIntelligence(payload.monitoringIntelligence);
    if (mi) _vaultPlans.cdPlan = renderChangeDetection(mi);

    // Health Intelligence Engine™ render plan
    const hi = safeHealthIntelligence(payload.healthIntelligence);
    if (hi) _vaultPlans.healthPlan = renderHealth(hi);

    // Health Intelligence™ v2.0 executive plan — built after healthPlan is stored
    _vaultPlans.hiPlan = buildHealthIntelligencePlan(payload, _vaultPlans);

    // Ecosystem Status — built last so all plans are available
    _vaultPlans.ecosystemStatusPlan = buildEcosystemStatusPlan(payload, _vaultPlans);
  };

  window.__mcRevealModule = function (id) {
    switch (id) {
      case 'ecosystem-status': {
        const plan = _vaultPlans.ecosystemStatusPlan;
        if (!plan) break;
        applyEcosystemStatusPlan(plan);
        // Count-up on health score (mirrors health-intelligence card pattern)
        if (plan.score !== null) {
          const scoreEl = document.querySelector('[data-mc-es-health-score]');
          if (scoreEl) {
            const target = plan.score;
            const dur    = 1200;
            const t0     = performance.now();
            (function countUp(now) {
              const t     = Math.min((now - t0) / dur, 1);
              const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
              scoreEl.textContent = String(Math.round(target * eased));
              if (t < 1) requestAnimationFrame(countUp);
              else scoreEl.textContent = String(target);
            })(performance.now());
          }
        }
        break;
      }
      case 'health-intelligence': {
        // Sprint 3.2: applyHealthIntelligencePlan writes all 6 sections.
        // Count-up on [data-mc-hi-score] runs immediately after.
        const plan = _vaultPlans.hiPlan;
        if (!plan) break;
        applyHealthIntelligencePlan(plan);
        if (plan.score !== null) {
          const scoreEl = document.querySelector('[data-mc-hi-score]');
          if (scoreEl) {
            const target = plan.score;
            const dur    = 1500;
            const t0     = performance.now();
            (function countUp(now) {
              const t     = Math.min((now - t0) / dur, 1);
              const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
              scoreEl.textContent = String(Math.round(target * eased));
              if (t < 1) requestAnimationFrame(countUp);
              else scoreEl.textContent = String(target);
            })(performance.now());
            // Mirror count-up to sparkline current point so they land together
            const spark4 = document.querySelector('[data-mc-hi-spark="4"]');
            if (spark4) spark4.textContent = String(target);
          }
        }
        break;
      }
      case 'identity-intelligence': {
        // Sprint 3.3: applyIdentityIntelligencePlan writes all 6 sections.
        // Count-up on [data-mc-id-coverage] provides the executive reveal.
        const plan = _vaultPlans.idPlan;
        if (plan) {
          applyIdentityIntelligencePlan(plan);
          if (plan.coverage !== null) {
            const coverageEl = document.querySelector('[data-mc-id-coverage]');
            if (coverageEl) {
              const target = plan.coverage;
              const dur    = 1200;
              const t0     = performance.now();
              (function countUp(now) {
                const t     = Math.min((now - t0) / dur, 1);
                const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
                coverageEl.textContent = String(Math.round(target * eased));
                if (t < 1) requestAnimationFrame(countUp);
                else coverageEl.textContent = String(target);
              })(performance.now());
            }
          }
        }
        break;
      }
      case 'publishing-intelligence': {
        // Sprint 3.4: applyPublishingIntelligencePlan writes all 7 sections.
        // Count-up on [data-mc-pi-coverage] provides the executive reveal.
        const plan = _vaultPlans.piPlan;
        if (plan) {
          applyPublishingIntelligencePlan(plan);
          if (plan.coverage !== null) {
            const coverageEl = document.querySelector('[data-mc-pi-coverage]');
            if (coverageEl) {
              const target = plan.coverage;
              const dur    = 1200;
              const t0     = performance.now();
              (function countUp(now) {
                const t     = Math.min((now - t0) / dur, 1);
                const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
                coverageEl.textContent = String(Math.round(target * eased));
                if (t < 1) requestAnimationFrame(countUp);
                else coverageEl.textContent = String(target);
              })(performance.now());
            }
          }
        }
        break;
      }
      case 'catalog-intelligence': {
        if (_vaultPlans.catalogPlan) applyCatalogPlan(_vaultPlans.catalogPlan);
        break;
      }
      case 'change-detection': {
        if (_vaultPlans.cdPlan) applyChangeDetectionPlan(_vaultPlans.cdPlan);
        break;
      }
      case 'backend-intelligence': {
        if (_vaultPlans.backendPlan) applyBackendPlan(_vaultPlans.backendPlan);
        break;
      }
      case 'global-footprint': {
        if (_vaultPlans.footprintPlan) applyFootprintPlan(_vaultPlans.footprintPlan);
        break;
      }
      case 'ai-insights': {
        if (_vaultPlans.aiPlan)                  applyRoyalteAIPlan(_vaultPlans.aiPlan);
        if (_vaultPlans.identityRecommendations) applyRecommendationsPlan(_vaultPlans.identityRecommendations);
        // Review ring — r=46, circumference ≈ 289; CSS transition fires from 0
        const score = _vaultPlans.healthPlan?.score ?? null;
        const dash  = score !== null ? Math.round(score / 100 * 289) : 240;
        const ring  = document.querySelector('.mc-review-ring .mc-ring-progress');
        if (ring) ring.setAttribute('stroke-dasharray', `${dash} 289`);
        break;
      }
    }
  };

  // window.__mcRevealHero — writes the scanned artist's name to the page
  // title element. Called by vault-auth.js immediately after __mcPopulate()
  // resolves, before any module activates, so the page title reflects the
  // current scan's subject on the first visible frame of Mission Control.
  //
  // Diagnostic: logs the exact value being written and its source so the
  // Board can confirm which artist is being displayed and where it came from.
  window.__mcRevealHero = function () {
    const name    = _vaultPlans.artistName || null;
    const titleEl = document.querySelector('[data-mc-page-title]');
    const nameEl  = document.querySelector('[data-mc-founder-name]');
    const prev    = titleEl ? titleEl.textContent : '(element not found)';
    console.log(
      '[mc-diag] __mcRevealHero called\n' +
      '  Payload artist (source: _vaultPlans.artistName): ' + (name || '(none)') + '\n' +
      '  Current page title text: "' + prev + '"\n' +
      '  Will render: ' + (name ? name.toUpperCase() : '(no update — name absent)')
    );
    if (titleEl && name) titleEl.textContent = name.toUpperCase();
    if (nameEl  && name) nameEl.textContent  = name.toUpperCase();
  };
}
