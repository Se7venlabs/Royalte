// Distribution Gaps™ — Global Music Footprint™ Workspace
// Board Directive 2026-07-17 — Responsive-First Implementation
//
// Pure renderer. Reads royalte_workspace_context.globalFootprint.distributionGaps
// (CIM-native, Phase 2 Recovery 2026-07-20 -- was .globalMusicFootprint;
// produced by api/_lib/global-music-footprint.js's buildDistributionGaps())
// and renders it. Never fabricates data, never queries storage independently
// of the Workspace Contract, never falls back to demo data on a real scan.
//
// If distributionGaps is null (no per-territory evidence for this scan — e.g.
// the legacy fallback path, or a scan that predates this feature), the summary
// section shows an honest empty state and "View Full List" is disabled. This
// mirrors the workspace-wide "No Scan Loaded" convention at a section level.

(function () {
  'use strict';

  function init() {
    var result = window.RoyalteContext
      ? window.RoyalteContext.readWorkspaceContext({ contract: 'global-music-footprint' })
      : { state: 'invalid', ctx: null };
    if (result.state !== 'valid') return; // workspace-level overlay already handles this

    var gf = result.ctx.globalFootprint;
    var distributionGaps = gf && gf.distributionGaps ? gf.distributionGaps : null;

    renderSummary(distributionGaps);

    if (!distributionGaps) return; // nothing further to wire — View Full List stays disabled

    wireDrawer(distributionGaps);
  }

  // ── § 1 — Summary ──────────────────────────────────────────────────────

  function renderSummary(dg) {
    var totalEl = document.getElementById('gf-gaps-total');
    var unavailEl = document.getElementById('gf-gaps-unavailable');
    var unknownEl = document.getElementById('gf-gaps-unknown');
    var pendingEl = document.getElementById('gf-gaps-pending');
    var emptyEl = document.getElementById('gf-gaps-empty');
    var viewBtn = document.getElementById('gf-gaps-view-btn');
    var summaryEl = document.querySelector('.gf-gaps-summary');

    if (!dg) {
      if (summaryEl) summaryEl.style.display = 'none';
      if (viewBtn) { viewBtn.disabled = true; viewBtn.style.display = 'none'; }
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.textContent = 'Distribution gap detail is not available for this scan.';
      }
      return;
    }

    if (totalEl) totalEl.textContent = String(dg.totalRequiringAttention);
    if (unavailEl) unavailEl.textContent = String(dg.unavailable);
    if (unknownEl) unknownEl.textContent = String(dg.unknown);
    if (pendingEl) pendingEl.textContent = String(dg.notEvaluated);
  }

  // ── § 2–5 — Drawer, filters, list, detail ──────────────────────────────

  var STATUS_FILTERS = ['All', 'Available', 'Unavailable', 'Unknown', 'Pending Review'];
  var PROVIDER_FILTERS = [
    { key: 'apple_music', label: 'Apple Music' },
    { key: 'spotify',     label: 'Spotify' },
    { key: 'deezer',      label: 'Deezer' },
    { key: 'tidal',       label: 'TIDAL' },
  ];

  function statusClass(status) {
    switch (status) {
      case 'Available':   return 'gf-gaps-row-status--available';
      case 'Unavailable': return 'gf-gaps-row-status--unavailable';
      case 'Unknown':     return 'gf-gaps-row-status--unknown';
      default:            return 'gf-gaps-row-status--pending'; // Pending Review
    }
  }

  function providerLabel(key) {
    var found = PROVIDER_FILTERS.filter(function (p) { return p.key === key; })[0];
    return found ? found.label : key;
  }

  function formatLastVerified(iso) {
    if (!iso) return 'Not yet verified';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return 'Not yet verified';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return 'Not yet verified'; }
  }

  function wireDrawer(dg) {
    var state = { status: 'All', providers: [], query: '', lastFocused: null };

    var viewBtn      = document.getElementById('gf-gaps-view-btn');
    var scrim        = document.getElementById('gf-gaps-scrim');
    var drawer        = document.getElementById('gf-gaps-drawer');
    var closeBtn      = document.getElementById('gf-gaps-drawer-close');
    var searchInput   = document.getElementById('gf-gaps-search');
    var statusFilterEl = document.getElementById('gf-gaps-status-filters');
    var providerFilterEl = document.getElementById('gf-gaps-provider-filters');
    var listEl        = document.getElementById('gf-gaps-list');
    var listEmptyEl   = document.getElementById('gf-gaps-list-empty');

    var detailScrim  = document.getElementById('gf-gaps-detail-scrim');
    var detailPanel  = document.getElementById('gf-gaps-detail');
    var detailBody   = document.getElementById('gf-gaps-detail-body');
    var detailBack   = document.getElementById('gf-gaps-detail-back');
    var detailClose  = document.getElementById('gf-gaps-detail-close');

    if (!viewBtn || !drawer) return;

    // Build filter chips once
    if (statusFilterEl) {
      STATUS_FILTERS.forEach(function (s) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gf-gaps-chip' + (s === 'All' ? ' gf-gaps-chip--active' : '');
        btn.textContent = s;
        btn.setAttribute('data-status-filter', s);
        btn.addEventListener('click', function () {
          state.status = s;
          Array.prototype.forEach.call(statusFilterEl.children, function (c) {
            c.classList.toggle('gf-gaps-chip--active', c === btn);
          });
          renderList();
        });
        statusFilterEl.appendChild(btn);
      });
    }

    if (providerFilterEl) {
      PROVIDER_FILTERS.forEach(function (p) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gf-gaps-chip';
        btn.textContent = p.label;
        btn.setAttribute('data-provider-filter', p.key);
        btn.addEventListener('click', function () {
          var idx = state.providers.indexOf(p.key);
          if (idx === -1) { state.providers.push(p.key); btn.classList.add('gf-gaps-chip--active'); }
          else { state.providers.splice(idx, 1); btn.classList.remove('gf-gaps-chip--active'); }
          renderList();
        });
        providerFilterEl.appendChild(btn);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.query = searchInput.value.trim().toLowerCase();
        renderList();
      });
    }

    function matchesFilters(t) {
      if (state.status !== 'All' && t.status !== state.status) return false;
      if (state.providers.length > 0) {
        var hasProvider = t.providers.some(function (p) { return state.providers.indexOf(p) !== -1; });
        if (!hasProvider) return false;
      }
      if (state.query) {
        var haystack = (t.name + ' ' + t.code).toLowerCase();
        if (haystack.indexOf(state.query) === -1) return false;
      }
      return true;
    }

    function renderList() {
      if (!listEl) return;
      var filtered = dg.territories.filter(matchesFilters);
      listEl.innerHTML = '';

      if (filtered.length === 0) {
        if (listEmptyEl) listEmptyEl.hidden = false;
        return;
      }
      if (listEmptyEl) listEmptyEl.hidden = true;

      filtered.forEach(function (t) {
        listEl.appendChild(buildRow(t));
      });
    }

    function buildRow(t) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'gf-gaps-row';
      row.setAttribute('data-code', t.code);
      row.setAttribute('aria-label', t.name + ' — ' + t.status);

      var territoryEl = document.createElement('span');
      territoryEl.className = 'gf-gaps-row-territory';
      var nameEl = document.createElement('span');
      nameEl.className = 'gf-gaps-row-name';
      nameEl.textContent = t.name || t.code;
      var codeEl = document.createElement('span');
      codeEl.className = 'gf-gaps-row-code';
      codeEl.textContent = t.code;
      territoryEl.appendChild(nameEl);
      territoryEl.appendChild(codeEl);

      var statusEl = document.createElement('span');
      statusEl.className = 'gf-gaps-row-status ' + statusClass(t.status);
      statusEl.textContent = t.status;

      var providersEl = document.createElement('span');
      providersEl.className = 'gf-gaps-row-providers';
      if (t.providers.length === 0) {
        var noneEl = document.createElement('span');
        noneEl.className = 'gf-gaps-row-providers-empty';
        noneEl.textContent = 'No provider data';
        providersEl.appendChild(noneEl);
      } else {
        t.providers.forEach(function (p) {
          var dot = document.createElement('span');
          dot.className = 'gf-gaps-row-pdot gf-gaps-row-pdot--' + p;
          dot.title = providerLabel(p);
          providersEl.appendChild(dot);
        });
      }

      var reasonEl = document.createElement('span');
      reasonEl.className = 'gf-gaps-row-reason';
      reasonEl.textContent = t.reason || '';

      row.appendChild(territoryEl);
      row.appendChild(statusEl);
      row.appendChild(providersEl);
      row.appendChild(reasonEl);

      row.addEventListener('click', function () { openDetail(t); });
      return row;
    }

    // ── Drawer open/close ────────────────────────────────────────────────

    function openDrawer() {
      state.lastFocused = document.activeElement;
      scrim.hidden = false;
      drawer.hidden = false;
      // Force reflow so the transition runs from the pre-visible state.
      void drawer.offsetWidth;
      scrim.classList.add('gf-gaps-scrim--visible');
      drawer.classList.add('gf-gaps-drawer--visible');
      document.body.style.overflow = 'hidden';
      renderList();
      if (closeBtn) closeBtn.focus();
      document.addEventListener('keydown', onKeydown);
    }

    function closeDrawer() {
      scrim.classList.remove('gf-gaps-scrim--visible');
      drawer.classList.remove('gf-gaps-drawer--visible');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeydown);
      setTimeout(function () {
        scrim.hidden = true;
        drawer.hidden = true;
      }, 260);
      if (state.lastFocused && typeof state.lastFocused.focus === 'function') state.lastFocused.focus();
    }

    function onKeydown(e) {
      if (e.key !== 'Escape') return;
      if (detailPanel && !detailPanel.hidden) { closeDetail(); return; }
      closeDrawer();
    }

    // ── Detail sub-panel ─────────────────────────────────────────────────

    function openDetail(t) {
      if (!detailPanel || !detailBody) return;
      detailBody.innerHTML = '';

      var territoryBlock = document.createElement('div');
      territoryBlock.className = 'gf-gaps-detail-territory';
      var nameEl = document.createElement('div');
      nameEl.className = 'gf-gaps-detail-name';
      nameEl.textContent = t.name || t.code;
      var codeEl = document.createElement('div');
      codeEl.className = 'gf-gaps-detail-code';
      codeEl.textContent = t.code;
      territoryBlock.appendChild(nameEl);
      territoryBlock.appendChild(codeEl);
      detailBody.appendChild(territoryBlock);

      detailBody.appendChild(detailField('Status', t.status));

      var providersField = document.createElement('div');
      providersField.className = 'gf-gaps-detail-field';
      var providersLabel = document.createElement('div');
      providersLabel.className = 'gf-gaps-detail-label';
      providersLabel.textContent = 'Providers';
      providersField.appendChild(providersLabel);
      var providersList = document.createElement('div');
      providersList.className = 'gf-gaps-detail-providers';
      if (t.providers.length === 0) {
        var noneRow = document.createElement('div');
        noneRow.className = 'gf-gaps-detail-provider-row';
        noneRow.textContent = 'No provider has evaluated this territory yet.';
        providersList.appendChild(noneRow);
      } else {
        t.providers.forEach(function (p) {
          var row = document.createElement('div');
          row.className = 'gf-gaps-detail-provider-row';
          var dot = document.createElement('span');
          dot.className = 'gf-gaps-row-pdot gf-gaps-row-pdot--' + p;
          row.appendChild(dot);
          var label = document.createElement('span');
          label.textContent = providerLabel(p);
          row.appendChild(label);
          providersList.appendChild(row);
        });
      }
      providersField.appendChild(providersList);
      detailBody.appendChild(providersField);

      detailBody.appendChild(detailField('Reason', t.reason || 'Not available from reviewed sources'));
      detailBody.appendChild(detailField('Recommended Action', t.recommendedAction || 'No action needed'));
      detailBody.appendChild(detailField('Last Verified', formatLastVerified(t.lastVerified)));

      detailScrim.hidden = false;
      detailPanel.hidden = false;
      void detailPanel.offsetWidth;
      detailScrim.classList.add('gf-gaps-detail-scrim--visible');
      detailPanel.classList.add('gf-gaps-detail--visible');
      if (detailClose) detailClose.focus();
    }

    function detailField(label, value) {
      var field = document.createElement('div');
      field.className = 'gf-gaps-detail-field';
      var labelEl = document.createElement('div');
      labelEl.className = 'gf-gaps-detail-label';
      labelEl.textContent = label;
      var valueEl = document.createElement('div');
      valueEl.className = 'gf-gaps-detail-value';
      valueEl.textContent = value;
      field.appendChild(labelEl);
      field.appendChild(valueEl);
      return field;
    }

    function closeDetail() {
      detailScrim.classList.remove('gf-gaps-detail-scrim--visible');
      detailPanel.classList.remove('gf-gaps-detail--visible');
      setTimeout(function () {
        detailScrim.hidden = true;
        detailPanel.hidden = true;
      }, 240);
    }

    // ── Wire top-level open/close triggers ──────────────────────────────

    viewBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (scrim) scrim.addEventListener('click', closeDrawer);
    if (detailScrim) detailScrim.addEventListener('click', closeDetail);
    if (detailClose) detailClose.addEventListener('click', closeDetail);
    if (detailBack) detailBack.addEventListener('click', closeDetail);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
