// Territory Change Intelligence™ + Territory Alerts™ — Global Music Footprint™ Workspace
// Board V1.0 Completion (2026-07-27)
//
// Reads the SAME evidence the Delta Engine (api/_lib/delta-engine.js) already
// produces and stores in monitoring_alerts on every authenticated scan --
// this file introduces no new alert generation, no schema change, and no
// duplicate of the Delta Engine's comparison logic. It only queries and
// presents what already exists, two ways:
//   - Territory Change Intelligence™ (primary): the actual named territories
//     added/removed -- artists care where, not just how many.
//   - Territory Alerts™ (secondary): the same rows, aggregated into one
//     artist-level summary sentence. Presentation logic only.
//
// Queried directly against monitoring_alerts (not ctx.monitoringIntelligence
// .events, which is capped at 4 total cross-domain events and could
// silently truncate territory-specific ones).
//
// First-ever scan (no prior snapshot to compare against): the Delta Engine
// emits change_type 'baseline_established', never 'territory_gain'/'loss'
// -- so an empty query result here is ambiguous between "first scan" and
// "no changes since last scan" unless disambiguated via
// ctx.monitoringIntelligence.status, which this file checks first.

import { getSupabase } from '/js/supabase-client.js';

(function () {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderOnboarding(el, text) {
    el.innerHTML = '<div class="gf2-changes-onboarding">' + esc(text) + '</div>';
  }

  function renderChanges(bodyEl, added, removed) {
    if (added.length === 0 && removed.length === 0) {
      renderOnboarding(bodyEl, 'No territory changes detected since your last scan.');
      return;
    }
    var html = '<div class="gf2-changes-cols">';
    html += '<div><div class="gf2-changes-col-title gf2-changes-col-title--added">Added</div>';
    if (added.length === 0) {
      html += '<div class="gf2-changes-empty">None</div>';
    } else {
      added.forEach(function (t) {
        html += '<div class="gf2-changes-item"><span class="gf2-changes-dot gf2-changes-dot--added" aria-hidden="true"></span>' + esc(t) + '</div>';
      });
    }
    html += '</div><div><div class="gf2-changes-col-title gf2-changes-col-title--removed">Removed</div>';
    if (removed.length === 0) {
      html += '<div class="gf2-changes-empty">None</div>';
    } else {
      removed.forEach(function (t) {
        html += '<div class="gf2-changes-item"><span class="gf2-changes-dot gf2-changes-dot--removed" aria-hidden="true"></span>' + esc(t) + '</div>';
      });
    }
    html += '</div></div>';
    bodyEl.innerHTML = html;
  }

  function renderAlertsSummary(alertsEl, added, removed) {
    if (added.length === 0 && removed.length === 0) {
      alertsEl.innerHTML = '<div class="gf2-alerts-detail">No territory changes detected during the latest scan.</div>';
      return;
    }
    var parts = [];
    if (added.length > 0) {
      parts.push(
        '<div class="gf2-alerts-headline gf2-alerts-headline--expanded">Global Footprint Expanded</div>' +
        '<div class="gf2-alerts-detail">' + added.length + ' ' + (added.length === 1 ? 'territory was' : 'territories were') + ' added during the latest monitoring scan.</div>'
      );
    }
    if (removed.length > 0) {
      parts.push(
        '<div class="gf2-alerts-headline gf2-alerts-headline--reduced" style="margin-top:' + (added.length > 0 ? '14px' : '0') + '">Global Footprint Reduced</div>' +
        '<div class="gf2-alerts-detail">' + removed.length + ' ' + (removed.length === 1 ? 'territory was' : 'territories were') + ' removed during the latest monitoring scan.</div>'
      );
    }
    alertsEl.innerHTML = parts.join('');
  }

  async function init() {
    var changesBody = document.getElementById('gf2-changes-body');
    var alertsBody = document.getElementById('gf2-alerts-body');
    if (!changesBody || !alertsBody) return;

    var result = window.RoyalteContext
      ? window.RoyalteContext.readWorkspaceContext({ contract: 'global-music-footprint' })
      : { state: 'invalid', ctx: null };
    if (result.state !== 'valid') return; // workspace-level overlay already handles this

    var ctx = result.ctx;
    var artistId = ctx.subject && ctx.subject.artistId ? ctx.subject.artistId : null;
    var monitoring = ctx.monitoringIntelligence || null;

    // First-ever scan -- honest "nothing to compare yet", never an empty
    // "no changes" (which would falsely imply a comparison happened).
    if (monitoring && monitoring.status === 'baseline') {
      renderOnboarding(changesBody, 'This is your first scan — nothing to compare yet. Territory changes will appear here starting with your next scan.');
      renderOnboarding(alertsBody, 'Territory alerts begin after your next scan.');
      return;
    }

    if (!artistId) {
      renderOnboarding(changesBody, 'Territory change history is unavailable for this scan.');
      renderOnboarding(alertsBody, 'Territory alerts are unavailable for this scan.');
      return;
    }

    var supabase = getSupabase();
    if (!supabase) {
      renderOnboarding(changesBody, 'Territory change history could not be loaded.');
      renderOnboarding(alertsBody, 'Territory alerts could not be loaded.');
      return;
    }

    try {
      var sessionResp = await supabase.auth.getSession();
      var session = sessionResp && sessionResp.data ? sessionResp.data.session : null;
      if (!session) {
        renderOnboarding(changesBody, 'Sign in to see territory change history for this artist.');
        renderOnboarding(alertsBody, 'Sign in to see territory alerts for this artist.');
        return;
      }

      var { data, error } = await supabase
        .from('monitoring_alerts')
        .select('change_type, territory, detected_at')
        .eq('user_id', session.user.id)
        .eq('artist_id', artistId)
        .in('change_type', ['territory_gain', 'territory_loss'])
        .order('detected_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[gmf-territory-changes] query failed', error);
        renderOnboarding(changesBody, 'Territory change history could not be loaded.');
        renderOnboarding(alertsBody, 'Territory alerts could not be loaded.');
        return;
      }

      var rows = data || [];
      var added = rows.filter(function (r) { return r.change_type === 'territory_gain'; })
        .map(function (r) { return r.territory; }).filter(Boolean);
      var removed = rows.filter(function (r) { return r.change_type === 'territory_loss'; })
        .map(function (r) { return r.territory; }).filter(Boolean);

      renderChanges(changesBody, added, removed);
      renderAlertsSummary(alertsBody, added, removed);
    } catch (err) {
      console.error('[gmf-territory-changes] unexpected error', err);
      renderOnboarding(changesBody, 'Territory change history could not be loaded.');
      renderOnboarding(alertsBody, 'Territory alerts could not be loaded.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
