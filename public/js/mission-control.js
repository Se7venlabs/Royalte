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
  buildProviderRenderPlan,
  buildCoveragePlan,
  buildRecommendationsPlan,
  safeIdentityIntelligence,
} from '/js/mission-control-renderers.js';

// ─── Identity Intelligence™ fetch ──────────────────────────────────

function getScanIdFromUrl() {
  try {
    return new URL(window.location.href).searchParams.get('scanId') || null;
  } catch {
    return null;
  }
}

async function fetchIdentityIntelligence() {
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
    return safeIdentityIntelligence(row.payload.identityIntelligence);
  } catch (err) {
    console.warn('[mc] audit_scans read threw:', err?.message || err);
    return null;
  }
}

// ─── DOM application — locked surface, data-attribute-targeted ────

function applyCoverage(intelligence) {
  const plan = buildCoveragePlan(intelligence);
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

function applyProviderCards(intelligence) {
  const plan = buildProviderRenderPlan(intelligence);
  if (plan.length === 0) return;
  for (const entry of plan) {
    const card = document.querySelector(`[data-mc-identity-provider="${entry.provider}"]`);
    if (!card) continue;
    const pill = card.querySelector('[data-mc-identity-pill]') || card.querySelector('.mc-pill');
    if (!pill) continue;
    pill.className   = entry.pillClass;
    pill.textContent = entry.pillText;
  }
}

function applyRecommendations(intelligence) {
  const plan = buildRecommendationsPlan(intelligence);
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

// ─── Boot ──────────────────────────────────────────────────────────

async function initMissionControl() {
  const intelligence = await fetchIdentityIntelligence();
  if (!intelligence) return; // graceful fallback: locked sample HTML stays
  applyCoverage(intelligence);
  applyProviderCards(intelligence);
  applyRecommendations(intelligence);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initMissionControl(); });
  } else {
    initMissionControl();
  }
}
