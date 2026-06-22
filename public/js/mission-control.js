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
import {
  renderIdentity,
  renderPublishing,
  renderCatalog,
  renderGlobalMusicFootprint,
  renderRoyalteAI,
  renderBackend,
  renderChangeDetection,
  safeIdentityIntelligence,
  safePublishingIntelligence,
  safeCatalogIntelligence,
  safeGlobalMusicFootprintIntelligence,
  safeRoyalteAI,
  safeBackendIntelligence,
  safeMonitoringIntelligence,
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
  const supabase = getSupabase();
  if (!supabase) return null;

  const scanId = getScanIdFromUrl();
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
  if (countEl)   countEl.textContent   = `${plan.connectedCount} / ${plan.totalCount}`;
  if (summaryEl) summaryEl.textContent = plan.summaryLabel;
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
  const payload = await fetchScanPayload();
  if (!payload) return; // graceful fallback: locked sample HTML stays

  // Identity Intelligence™ (Phase 4B-3)
  const identityIntelligence = safeIdentityIntelligence(payload.identityIntelligence);
  if (identityIntelligence) {
    const identityPlan = renderIdentity(identityIntelligence);
    applyCoveragePlan(identityPlan.coverage);
    applyProvidersPlan(identityPlan.providers);
    applyRecommendationsPlan(identityPlan.recommendations);
  }

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
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMissionControl(); });
  } else {
    initMissionControl();
  }
}
