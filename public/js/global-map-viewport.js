/* ============================================================
 * GlobalMapViewport™ — Royaltē Platform Component v1.0
 * ============================================================
 * PROTECTED COMPONENT. Do not modify anchor coordinates,
 * projection, rendering geometry, or marker placement from
 * outside this file.
 *
 * Owns:
 *   • World map image + viewport
 *   • Geographic Anchor Engine™ (Board-locked coordinates)
 *   • Provider Cluster™ marker rendering
 *   • Legend + provider filter
 *   • Global Scan sweep animation + badge
 *   • Country detail popover
 *   • Responsive scaling behaviour
 *
 * Usage:
 *   var viewport = initGlobalMapViewport(hostEl, options);
 *   viewport.hidePopover();   // programmatic access if needed
 *
 * options.onCountrySelect(countryName, providers[])
 *   — fires when a country marker is clicked
 *
 * CSS dependency: royalte-workspace.css (gf-* namespace)
 * ============================================================ */

(function (root) {
  'use strict';

  /* ── Geographic Anchor Engine™ — 24 Board-locked country anchors ───
   * Calibration formula: l = 43.0 + 0.271 * lon;  t = 52 - 0.60 * lat
   * l/t are % positions within gf-map-inner.
   * These coordinates are the sole position authority for every country.
   * No workspace page may read or override these values.
   * Source of truth: this file only.
   * Next recalibration: single Board-directed pass after geometry is locked.
   */
  var ANCHORS = {
    'Canada':         { l: 25.0, t: 20.0, flag: '🇨🇦', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'United States':  { l: 27.0, t: 35.0, flag: '🇺🇸', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Mexico':         { l: 26.0, t: 49.0, flag: '🇲🇽', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Brazil':         { l: 37.0, t: 75.0, flag: '🇧🇷', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Peru':           { l: 35.0, t: 85.0, flag: '🇵🇪', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'United Kingdom': { l: 48.0, t: 29.0, flag: '🇬🇧', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'France':         { l: 48.5, t: 33.0, flag: '🇫🇷', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Germany':        { l: 50.0, t: 28.0, flag: '🇩🇪', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Spain':          { l: 47.0, t: 39.0, flag: '🇪🇸', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Italy':          { l: 51.0, t: 36.0, flag: '🇮🇹', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Sweden':         { l: 53.0, t: 16.0, flag: '🇸🇪', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Poland':         { l: 51.0, t: 31.0, flag: '🇵🇱', p: ['apple','spotify','deezer'],          d: 'Mar 2024' },
    'South Africa':   { l: 52.0, t: 85.0, flag: '🇿🇦', p: ['apple','spotify','deezer'],          d: 'Feb 2024' },
    'Egypt':          { l: 52.0, t: 50.0, flag: '🇪🇬', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Norway':         { l: 50.0, t: 21.0, flag: '🇳🇴', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Türkiye':        { l: 55.0, t: 36.0, flag: '🇹🇷', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Indonesia':      { l: 71.0, t: 71.0, flag: '🇮🇩', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Singapore':      { l: 68.0, t: 65.0, flag: '🇸🇬', p: ['apple','spotify','deezer','tidal'], d: 'Mar 2024' },
    'India':          { l: 64.0, t: 55.0, flag: '🇮🇳', p: ['apple','spotify'],                  d: 'Feb 2024' },
    'China':          { l: 67.0, t: 30.0, flag: '🇨🇳', p: ['apple'],                            d: 'Jan 2024' },
    'Japan':          { l: 77.0, t: 41.0, flag: '🇯🇵', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'South Korea':    { l: 74.0, t: 41.0, flag: '🇰🇷', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Australia':      { l: 75.0, t: 85.0, flag: '🇦🇺', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'New Zealand':    { l: 77.0, t: 71.0, flag: '🇳🇿', p: ['apple','spotify'],                  d: 'Feb 2024' },
  };

  /* ── Tablet Anchor Set™ — independent coordinate layer for 641–1024px ──
   * Owns all flag and marker positions on Executive Tablet™.
   * Updated per Board calibration pass only — ANCHORS (desktop) untouched.
   * Phase 1: mirrors desktop coordinates. Board provides adjustments.
   * Phase 2: restore markers after Board approves tablet flag positions.
   */
  var TABLET_ANCHORS = {
    'Canada':         { l: 25.0, t: 20.0, flag: '🇨🇦', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'United States':  { l: 27.0, t: 35.0, flag: '🇺🇸', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Mexico':         { l: 26.0, t: 49.0, flag: '🇲🇽', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Brazil':         { l: 37.0, t: 75.0, flag: '🇧🇷', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Peru':           { l: 35.0, t: 85.0, flag: '🇵🇪', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'United Kingdom': { l: 48.0, t: 29.0, flag: '🇬🇧', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'France':         { l: 48.5, t: 33.0, flag: '🇫🇷', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Germany':        { l: 50.0, t: 28.0, flag: '🇩🇪', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Spain':          { l: 47.0, t: 39.0, flag: '🇪🇸', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Italy':          { l: 51.0, t: 36.0, flag: '🇮🇹', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'Sweden':         { l: 53.0, t: 16.0, flag: '🇸🇪', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Poland':         { l: 51.0, t: 31.0, flag: '🇵🇱', p: ['apple','spotify','deezer'],          d: 'Mar 2024' },
    'South Africa':   { l: 52.0, t: 85.0, flag: '🇿🇦', p: ['apple','spotify','deezer'],          d: 'Feb 2024' },
    'Egypt':          { l: 52.0, t: 50.0, flag: '🇪🇬', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Norway':         { l: 50.0, t: 21.0, flag: '🇳🇴', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Türkiye':        { l: 55.0, t: 36.0, flag: '🇹🇷', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Indonesia':      { l: 71.0, t: 71.0, flag: '🇮🇩', p: ['apple','spotify'],                  d: 'Mar 2024' },
    'Singapore':      { l: 68.0, t: 65.0, flag: '🇸🇬', p: ['apple','spotify','deezer','tidal'], d: 'Mar 2024' },
    'India':          { l: 64.0, t: 55.0, flag: '🇮🇳', p: ['apple','spotify'],                  d: 'Feb 2024' },
    'China':          { l: 67.0, t: 30.0, flag: '🇨🇳', p: ['apple'],                            d: 'Jan 2024' },
    'Japan':          { l: 77.0, t: 41.0, flag: '🇯🇵', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'South Korea':    { l: 74.0, t: 41.0, flag: '🇰🇷', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'Australia':      { l: 75.0, t: 85.0, flag: '🇦🇺', p: ['apple','spotify','deezer'],          d: 'Jan 2024' },
    'New Zealand':    { l: 77.0, t: 71.0, flag: '🇳🇿', p: ['apple','spotify'],                  d: 'Feb 2024' },
  };

  var P_COLOR = { apple: '#FC3C44', spotify: '#1DB954', deezer: '#A238FF', tidal: '#00D5FF' };
  var P_NAME  = { apple: 'Apple Music', spotify: 'Spotify', deezer: 'Deezer', tidal: 'TIDAL' };

  /* Provider Cluster™ — diamond offsets around anchor (% units)
   *   Apple (top) · Deezer (left) · Spotify (right) · TIDAL (bottom)
   * Future providers extend this registry; no map redesign needed.
   */
  var P_OFF = {
    apple:   [ 0.0, -1.8],
    deezer:  [-1.6,  0.0],
    spotify: [ 1.6,  0.0],
    tidal:   [ 0.0,  1.8],
  };

  /* ── Internal HTML template ──────────────────────────────────────── */
  function buildInnerHTML() {
    return [
      '<div class="gf-map-inner" aria-label="Global Music Footprint world map" role="img">',

        '<img class="gf-map-img" src="/img/mission-control-world-map.png" alt="" aria-hidden="true">',

        '<div class="gf-legend" role="group" aria-label="Provider filter">',
          '<div class="gf-legend-title">Legend</div>',
          '<div class="gf-legend-item" data-filter="apple" role="button" tabindex="0" aria-pressed="false" aria-label="Filter by Apple Music">',
            '<span class="gf-legend-dot gf-legend-dot--apple"></span>',
            '<span class="gf-legend-name">Apple Music</span>',
          '</div>',
          '<div class="gf-legend-item" data-filter="spotify" role="button" tabindex="0" aria-pressed="false" aria-label="Filter by Spotify">',
            '<span class="gf-legend-dot gf-legend-dot--spotify"></span>',
            '<span class="gf-legend-name">Spotify</span>',
          '</div>',
          '<div class="gf-legend-item" data-filter="deezer" role="button" tabindex="0" aria-pressed="false" aria-label="Filter by Deezer">',
            '<span class="gf-legend-dot gf-legend-dot--deezer"></span>',
            '<span class="gf-legend-name">Deezer</span>',
          '</div>',
          '<div class="gf-legend-item" data-filter="tidal" role="button" tabindex="0" aria-pressed="false" aria-label="Filter by TIDAL">',
            '<span class="gf-legend-dot gf-legend-dot--tidal"></span>',
            '<span class="gf-legend-name">TIDAL</span>',
          '</div>',
        '</div>',

        '<div class="gf-scan-sweep" aria-hidden="true"></div>',

        '<div class="gf-popover" role="dialog" aria-label="Country details" aria-hidden="true">',
          '<div class="gf-popover-country">',
            '<span class="gf-popover-country-dot" aria-hidden="true"></span>',
            '<span class="gmv-pop-country">—</span>',
          '</div>',
          '<div class="gf-popover-divider"></div>',
          '<div class="gf-popover-row">',
            '<span class="gf-popover-label">Providers</span>',
            '<span class="gf-popover-providers gmv-pop-providers"></span>',
          '</div>',
          '<div class="gf-popover-row">',
            '<span class="gf-popover-label">First Detected</span>',
            '<span class="gf-popover-val gmv-pop-detected">—</span>',
          '</div>',
          '<div class="gf-popover-row">',
            '<span class="gf-popover-label">Status</span>',
            '<span class="gf-popover-val gf-popover-val--verified gmv-pop-status">—</span>',
          '</div>',
        '</div>',

      '</div>',

      '<div class="gf-map-status">',
        '<div class="gf-scan-badge" aria-label="Global Scan — Active">',
          '<span class="gf-scan-dot" aria-hidden="true"></span>',
          '<span class="gf-scan-text">',
            '<span class="gf-scan-title">Global Scan™</span>',
            '<span class="gf-scan-sub">Scanning Global Distribution</span>',
          '</span>',
        '</div>',
        '<div class="gf-territories-badge" aria-label="142 territories verified">',
          '<span class="gf-territories-label">Territories Verified™</span>',
          '<span class="gf-territories-count">142</span>',
        '</div>',
      '</div>',
    ].join('');
  }

  /* ── initGlobalMapViewport ───────────────────────────────────────── */
  function initGlobalMapViewport(hostEl, options) {
    if (!hostEl) { console.warn('GlobalMapViewport™: host element not found'); return {}; }
    options = options || {};

    /* ── Viewport-aware anchor selection ──────────────────────────────
     * Tablet (641–1024px) owns its own independent coordinate layer.
     * Calibration mode (?calibrate=tablet) activates viewport-agnostically
     * so the Board can review flag positions on any screen size.      */
    var isTablet      = window.innerWidth >= 641 && window.innerWidth <= 1024;
    var tabletCalMode = !!options.tabletCalibrationMode;
    var activeAnchors = (isTablet || tabletCalMode) ? TABLET_ANCHORS : ANCHORS;

    /* render */
    hostEl.innerHTML = buildInnerHTML();

    var mapInner          = hostEl.querySelector('.gf-map-inner');
    var popover           = hostEl.querySelector('.gf-popover');
    var legend            = hostEl.querySelector('.gf-legend');
    var activeFilter      = null;
    var filterResetTimer  = null;

    /* ── Geographic Anchor Engine™ ───────────────────────────────── */
    /* Viewport-selected anchors drive flag and cluster positions.    */
    /* Desktop: ANCHORS (locked). Tablet: TABLET_ANCHORS.            */
    Object.keys(activeAnchors).forEach(function (country) {
      var a = activeAnchors[country];

      var flagEl = document.createElement('span');
      flagEl.className = 'gf-anchor';
      flagEl.style.left = a.l + '%';
      flagEl.style.top  = a.t + '%';
      flagEl.textContent = a.flag;
      flagEl.setAttribute('aria-hidden', 'true');
      flagEl.dataset.country = country;
      flagEl.dataset.anchorL = a.l;
      flagEl.dataset.anchorT = a.t;
      mapInner.appendChild(flagEl);

      /* Phase 2 / production: omit markers during tablet calibration pass */
      if (!tabletCalMode) {
        a.p.forEach(function (prov) {
          var off = P_OFF[prov] || [0, 0];
          var el  = document.createElement('span');
          el.className = 'gf-marker gf-marker--' + prov;
          el.style.cssText = 'left:' + (a.l + off[0]) + '%;top:' + (a.t + off[1]) + '%;animation-delay:' + ((a.l / 100) * 4).toFixed(2) + 's';
          el.dataset.country  = country;
          el.dataset.provider = prov;
          el.dataset.detected = a.d;
          el.dataset.allp     = a.p.join(',');
          el.dataset.anchorL  = a.l;
          el.dataset.anchorT  = a.t;
          el.setAttribute('aria-label', country + ' — ' + P_NAME[prov]);
          el.setAttribute('role', 'button');
          el.setAttribute('tabindex', '0');
          mapInner.appendChild(el);
        });
      }
    });

    /* ── popover ─────────────────────────────────────────────────── */
    function showPopover(el) {
      var markerRect = el.getBoundingClientRect();
      var mapRect    = mapInner.getBoundingClientRect();
      var relX = markerRect.left - mapRect.left + markerRect.width / 2;
      var relY = markerRect.top  - mapRect.top;
      var popW = 210, popH = 148;
      var left = relX - popW / 2;
      var top  = relY - popH - 14;
      left = Math.max(8, Math.min(left, mapRect.width - popW - 8));
      if (top < 8) top = relY + 18;
      popover.style.left = left + 'px';
      popover.style.top  = top  + 'px';
      hostEl.querySelector('.gmv-pop-country').textContent  = el.dataset.country;
      hostEl.querySelector('.gmv-pop-detected').textContent = el.dataset.detected;
      hostEl.querySelector('.gmv-pop-status').textContent   = 'Verified';
      var provsEl = hostEl.querySelector('.gmv-pop-providers');
      provsEl.innerHTML = '';
      el.dataset.allp.split(',').forEach(function (prov) {
        var dot = document.createElement('span');
        dot.className = 'gf-pdot';
        dot.style.background = P_COLOR[prov] || '#fff';
        dot.title = P_NAME[prov] || prov;
        provsEl.appendChild(dot);
      });
      popover.classList.add('gf-popover--visible');
      popover.setAttribute('aria-hidden', 'false');
    }

    function hidePopover() {
      popover.classList.remove('gf-popover--visible');
      popover.setAttribute('aria-hidden', 'true');
    }

    /* ── legend auto-reset after 15 s of inactivity ──────────────── */
    function resetFilter() {
      if (!activeFilter) return;
      activeFilter = null;
      legend.querySelectorAll('.gf-legend-item').forEach(function (li) {
        li.classList.remove('gf-legend-item--active');
        li.setAttribute('aria-pressed', 'false');
      });
      mapInner.querySelectorAll('.gf-marker').forEach(function (m) {
        m.classList.remove('gf-marker--filtered');
      });
      hidePopover();
    }

    function scheduleFilterReset() {
      clearTimeout(filterResetTimer);
      filterResetTimer = setTimeout(resetFilter, 15000);
    }

    function cancelFilterReset() {
      clearTimeout(filterResetTimer);
      filterResetTimer = null;
    }

    /* ── marker click ─────────────────────────────────────────────── */
    mapInner.addEventListener('click', function (e) {
      var marker = e.target.closest('.gf-marker');
      if (marker && !marker.classList.contains('gf-marker--filtered')) {
        e.stopPropagation();
        showPopover(marker);
        if (typeof options.onCountrySelect === 'function') {
          options.onCountrySelect(marker.dataset.country, marker.dataset.allp.split(','));
        }
      } else if (!e.target.closest('.gf-popover') && !e.target.closest('.gf-legend')) {
        hidePopover();
      }
    });

    /* keyboard support for markers */
    mapInner.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var marker = e.target.closest('.gf-marker');
        if (marker && !marker.classList.contains('gf-marker--filtered')) {
          e.preventDefault();
          marker.click();
        }
      }
    });

    /* ── legend filter ────────────────────────────────────────────── */
    legend.addEventListener('click', function (e) {
      var item = e.target.closest('.gf-legend-item');
      if (!item) return;
      var filter  = item.dataset.filter;
      var markers = mapInner.querySelectorAll('.gf-marker');
      if (activeFilter === filter) {
        cancelFilterReset();
        activeFilter = null;
        item.classList.remove('gf-legend-item--active');
        item.setAttribute('aria-pressed', 'false');
        markers.forEach(function (m) { m.classList.remove('gf-marker--filtered'); });
      } else {
        activeFilter = filter;
        legend.querySelectorAll('.gf-legend-item').forEach(function (li) {
          li.classList.remove('gf-legend-item--active');
          li.setAttribute('aria-pressed', 'false');
        });
        item.classList.add('gf-legend-item--active');
        item.setAttribute('aria-pressed', 'true');
        markers.forEach(function (m) {
          m.classList.toggle('gf-marker--filtered', m.dataset.provider !== filter);
        });
        scheduleFilterReset();
      }
      hidePopover();
    });

    legend.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        var item = e.target.closest('.gf-legend-item');
        if (item) { e.preventDefault(); item.click(); }
      }
    });

    /* dismiss popover on Escape or outside click */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hidePopover();
    });

    if (options.calibrationMode) enableCalibrationMode(mapInner);
    if (tabletCalMode)           enableCalibrationMode(mapInner, '⚙ TABLET CALIBRATION — Phase 1 — flags only · click a flag for L / T');

    /* public API for workspace integration */
    return { hidePopover: hidePopover };
  }

  /* ── Calibration Mode (dev only — not shipped in production) ─────── */
  function enableCalibrationMode(mapInner, bannerLabel) {
    /* styles — scoped to gmv-cal-* namespace */
    var s = document.createElement('style');
    s.textContent = [
      '.gmv-cal-banner{position:absolute;top:0;left:0;right:0;z-index:50;background:rgba(250,204,21,.1);border-bottom:1px solid rgba(250,204,21,.35);padding:5px 10px;font:10px/1.4 monospace;color:#fde047;letter-spacing:.06em;text-align:center;pointer-events:none;}',
      '.gmv-cal-grid{position:absolute;inset:0;z-index:12;pointer-events:none;}',
      '.gmv-cal-vline{position:absolute;top:0;bottom:0;width:1px;background:rgba(56,189,248,.2);transform:translateX(-50%);}',
      '.gmv-cal-hline{position:absolute;left:0;right:0;height:1px;background:rgba(56,189,248,.2);transform:translateY(-50%);}',
      '.gmv-cal-vline.cal-edge,.gmv-cal-hline.cal-edge{background:rgba(56,189,248,.5);}',
      '.gmv-cal-ll{position:absolute;top:22px;font:9px/1 monospace;color:rgba(56,189,248,.9);transform:translateX(-50%);background:rgba(5,11,24,.7);padding:1px 3px;border-radius:2px;pointer-events:none;}',
      '.gmv-cal-tl{position:absolute;left:6px;font:9px/1 monospace;color:rgba(56,189,248,.9);transform:translateY(-50%);background:rgba(5,11,24,.7);padding:1px 3px;border-radius:2px;pointer-events:none;}',
      '.gmv-cal-corner{position:absolute;font:9px/1 monospace;color:rgba(56,189,248,.75);background:rgba(5,11,24,.8);padding:2px 5px;border-radius:2px;pointer-events:none;}',
      '.gmv-cal-readout{position:absolute;bottom:36px;right:8px;z-index:30;background:rgba(5,11,24,.92);border:1px solid rgba(56,189,248,.4);border-radius:5px;padding:8px 12px;font:11px/1.9 monospace;color:#e2e8f0;min-width:170px;}',
      '.gmv-cal-readout .cr-val{color:#facc15;font-weight:bold;}',
      '.gmv-cal-readout .cr-name{color:#38bdf8;font-size:12px;font-weight:bold;display:block;margin-bottom:2px;}',
      '.gmv-cal-readout .cr-dim{color:#475569;font-size:10px;}',
    ].join('');
    document.head.appendChild(s);

    /* banner */
    var banner = document.createElement('div');
    banner.className = 'gmv-cal-banner';
    banner.textContent = bannerLabel || '⚙ CALIBRATION MODE — click any marker to read anchor L / T';
    mapInner.appendChild(banner);

    /* grid lines + labels */
    var grid = document.createElement('div');
    grid.className = 'gmv-cal-grid';

    for (var i = 0; i <= 100; i += 10) {
      var edge = (i === 0 || i === 100) ? ' cal-edge' : '';

      var vl = document.createElement('div');
      vl.className = 'gmv-cal-vline' + edge;
      vl.style.left = i + '%';
      grid.appendChild(vl);

      var ll = document.createElement('div');
      ll.className = 'gmv-cal-ll';
      ll.style.left = i + '%';
      ll.textContent = 'L' + i;
      grid.appendChild(ll);

      var hl = document.createElement('div');
      hl.className = 'gmv-cal-hline' + edge;
      hl.style.top = i + '%';
      grid.appendChild(hl);

      var tl = document.createElement('div');
      tl.className = 'gmv-cal-tl';
      tl.style.top = i + '%';
      tl.textContent = 'T' + i;
      grid.appendChild(tl);
    }

    /* corner axis labels */
    [
      { style: 'top:14px;left:4px',    text: 'T=0  L=0'   },
      { style: 'top:14px;right:4px',   text: 'T=0  L=100' },
      { style: 'bottom:36px;left:4px', text: 'T=100 L=0'  },
      { style: 'bottom:36px;right:4px',text: 'T=100 L=100'},
    ].forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'gmv-cal-corner';
      el.setAttribute('style', c.style);
      el.textContent = c.text;
      grid.appendChild(el);
    });

    mapInner.appendChild(grid);

    /* readout panel */
    var readout = document.createElement('div');
    readout.className = 'gmv-cal-readout';
    readout.innerHTML = '<span class="cr-dim">click a marker</span><br><span id="gmv-cr-name" class="cr-name" style="display:none"></span>L: <span class="cr-val" id="gmv-cr-l">—</span><br>T: <span class="cr-val" id="gmv-cr-t">—</span>';
    mapInner.appendChild(readout);

    /* live mouse coordinates */
    mapInner.addEventListener('mousemove', function (e) {
      var r = mapInner.getBoundingClientRect();
      var l = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
      var t = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
      var lEl = mapInner.querySelector('#gmv-cr-l');
      var tEl = mapInner.querySelector('#gmv-cr-t');
      if (lEl) lEl.textContent = l + '%';
      if (tEl) tEl.textContent = t + '%';
    });

    /* marker / flag click → show anchor coordinates */
    mapInner.addEventListener('click', function (e) {
      var target = e.target.closest('.gf-marker') || e.target.closest('.gf-anchor');
      if (!target || !target.dataset.anchorL) return;
      var lEl    = mapInner.querySelector('#gmv-cr-l');
      var tEl    = mapInner.querySelector('#gmv-cr-t');
      var nameEl = mapInner.querySelector('#gmv-cr-name');
      if (lEl)    lEl.textContent    = parseFloat(target.dataset.anchorL).toFixed(1) + '%';
      if (tEl)    tEl.textContent    = parseFloat(target.dataset.anchorT).toFixed(1) + '%';
      if (nameEl) { nameEl.textContent = target.dataset.country; nameEl.style.display = 'block'; }
    });
  }

  /* ── Expose ──────────────────────────────────────────────────────── */
  root.initGlobalMapViewport = initGlobalMapViewport;

}(window));
