// Global Trend Timeline™ — Global Music Footprint™ Workspace
// Board V1.0 Completion (2026-07-27)
//
// Kept deliberately plain per Board direction -- a single, immediately
// readable signal (Growing / Stable / Declining), never a chart requiring
// interpretation. Raw material: scan_snapshots.canonical_data.territories,
// already captured by extractTerritories() (api/_lib/persist-os-scan.js) on
// every authenticated scan -- no new persistence, no backend change.
//
// Internally represents each historical point as a typed event
// ({ eventType: 'territory_snapshot', date, value }) rather than a bare
// number array, so a future version can interleave other event types
// (distribution-provider changes, regional launches, marketplace
// expansions) onto the same timeline without a redesign. V1.0 only ever
// produces territory_snapshot events; this renderer only understands that
// one type today.

import { getSupabase } from '/js/supabase-client.js';

(function () {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderOnboarding(el, text) {
    el.innerHTML =
      '<div class="gf2-timeline-onboarding">' +
      '<svg class="gf2-timeline-onboarding-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/></svg>' +
      esc(text) +
      '</div>';
  }

  // events: territory_snapshot[] ordered oldest -> newest.
  // Returns { signal: 'growing'|'stable'|'declining', latestDelta, largestExpansion, largestReduction }.
  function computeTrend(events) {
    var latest = events[events.length - 1].value;
    var prior = events[events.length - 2].value;
    var latestDelta = latest - prior;
    var signal = latestDelta > 0 ? 'growing' : latestDelta < 0 ? 'declining' : 'stable';

    var largestExpansion = null; // { delta, from, to }
    var largestReduction = null;
    for (var i = 1; i < events.length; i++) {
      var delta = events[i].value - events[i - 1].value;
      if (delta > 0 && (!largestExpansion || delta > largestExpansion.delta)) {
        largestExpansion = { delta: delta, date: events[i].date };
      }
      if (delta < 0 && (!largestReduction || delta < largestReduction.delta)) {
        largestReduction = { delta: delta, date: events[i].date };
      }
    }

    return { signal: signal, latestDelta: latestDelta, largestExpansion: largestExpansion, largestReduction: largestReduction };
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderTrend(bodyEl, trend) {
    var SIGNAL_LABEL = { growing: 'Growing', stable: 'Stable', declining: 'Declining' };
    var html = '<div class="gf2-trend-signal gf2-trend-signal--' + trend.signal + '">' + SIGNAL_LABEL[trend.signal] + '</div>';
    var detail = [];
    if (trend.latestDelta !== 0) {
      detail.push((trend.latestDelta > 0 ? '+' : '') + trend.latestDelta + ' territories since your last scan.');
    } else {
      detail.push('No change since your last scan.');
    }
    if (trend.largestExpansion) {
      detail.push('Largest Expansion: +' + trend.largestExpansion.delta + ' (' + fmtDate(trend.largestExpansion.date) + ')');
    }
    if (trend.largestReduction) {
      detail.push('Largest Reduction: ' + trend.largestReduction.delta + ' (' + fmtDate(trend.largestReduction.date) + ')');
    }
    html += '<div class="gf2-trend-detail">' + detail.map(esc).join('<br>') + '</div>';
    bodyEl.innerHTML = html;
  }

  async function init() {
    var bodyEl = document.getElementById('gf2-trend-body');
    if (!bodyEl) return;

    var result = window.RoyalteContext
      ? window.RoyalteContext.readWorkspaceContext({ contract: 'global-music-footprint' })
      : { state: 'invalid', ctx: null };
    if (result.state !== 'valid') return; // workspace-level overlay already handles this

    var ctx = result.ctx;
    var artistId = ctx.subject && ctx.subject.artistId ? ctx.subject.artistId : null;

    if (!artistId) {
      renderOnboarding(bodyEl, 'Trend history is unavailable for this scan.');
      return;
    }

    var supabase = getSupabase();
    if (!supabase) {
      renderOnboarding(bodyEl, 'Trend history could not be loaded.');
      return;
    }

    try {
      var sessionResp = await supabase.auth.getSession();
      var session = sessionResp && sessionResp.data ? sessionResp.data.session : null;
      if (!session) {
        renderOnboarding(bodyEl, 'Sign in to see your global footprint trend.');
        return;
      }

      var { data, error } = await supabase
        .from('scan_snapshots')
        .select('scan_number, scanned_at, canonical_data')
        .eq('user_id', session.user.id)
        .eq('artist_id', artistId)
        .order('scan_number', { ascending: true });

      if (error) {
        console.error('[gmf-trend-timeline] query failed', error);
        renderOnboarding(bodyEl, 'Trend history could not be loaded.');
        return;
      }

      var rows = data || [];
      var events = rows
        .filter(function (r) { return r.canonical_data && Array.isArray(r.canonical_data.territories); })
        .map(function (r) {
          return {
            eventType: 'territory_snapshot',
            date: r.scanned_at || null,
            value: r.canonical_data.territories.length,
          };
        });

      if (events.length < 2) {
        renderOnboarding(bodyEl, 'Not enough scan history yet — trend builds after your next scan.');
        return;
      }

      renderTrend(bodyEl, computeTrend(events));
    } catch (err) {
      console.error('[gmf-trend-timeline] unexpected error', err);
      renderOnboarding(bodyEl, 'Trend history could not be loaded.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
