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
    'Japan':          { l: 80.0, t: 41.0, flag: '🇯🇵', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
    'South Korea':    { l: 72.0, t: 41.0, flag: '🇰🇷', p: ['apple','spotify','deezer','tidal'], d: 'Jan 2024' },
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

    /* render */
    hostEl.innerHTML = buildInnerHTML();

    var mapInner     = hostEl.querySelector('.gf-map-inner');
    var popover      = hostEl.querySelector('.gf-popover');
    var activeFilter = null;

    /* ── Geographic Anchor Engine™ ───────────────────────────────── */
    /* Single source of truth: anchor l/t drives flag and cluster.   */
    /* No coordinate reads or writes from outside this function.     */
    Object.keys(ANCHORS).forEach(function (country) {
      var a = ANCHORS[country];

      var flagEl = document.createElement('span');
      flagEl.className = 'gf-anchor';
      flagEl.style.left = a.l + '%';
      flagEl.style.top  = a.t + '%';
      flagEl.textContent = a.flag;
      flagEl.setAttribute('aria-hidden', 'true');
      mapInner.appendChild(flagEl);

      a.p.forEach(function (prov) {
        var off = P_OFF[prov] || [0, 0];
        var el  = document.createElement('span');
        el.className = 'gf-marker gf-marker--' + prov;
        el.style.cssText = 'left:' + (a.l + off[0]) + '%;top:' + (a.t + off[1]) + '%;animation-delay:' + ((a.l / 100) * 4).toFixed(2) + 's';
        el.dataset.country  = country;
        el.dataset.provider = prov;
        el.dataset.detected = a.d;
        el.dataset.allp     = a.p.join(',');
        el.setAttribute('aria-label', country + ' — ' + P_NAME[prov]);
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        mapInner.appendChild(el);
      });
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
    var legend = hostEl.querySelector('.gf-legend');
    legend.addEventListener('click', function (e) {
      var item = e.target.closest('.gf-legend-item');
      if (!item) return;
      var filter  = item.dataset.filter;
      var markers = mapInner.querySelectorAll('.gf-marker');
      if (activeFilter === filter) {
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

    /* public API for workspace integration */
    return { hidePopover: hidePopover };
  }

  /* ── Expose ──────────────────────────────────────────────────────── */
  root.initGlobalMapViewport = initGlobalMapViewport;

}(window));
