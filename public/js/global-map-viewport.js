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

  /* ── Desktop Anchor Set™ — master coordinate reference ─────────────
   * Calibration formula: l = 43.0 + 0.271 * lon;  t = 52 - 0.60 * lat
   * l/t are % positions within gf-map-inner.
   * LOCKED after Board desktop calibration approval.
   * Tablet and mobile calibration never modify this dataset.
   * Source of truth: this file only. One dataset per viewport, no inheritance.
   *
   * Constitutional Refactor (Board directive, 2026-07-21): these anchors
   * carry ONLY geographic projection data (l/t pixel position, flag) --
   * this is a fixed cartographic fact (where a country sits on this map
   * image), not business intelligence, and is exempt from the evidence-
   * fabrication findings in governance/GLOBAL_MUSIC_FOOTPRINT_EVIDENCE_AUDIT.md.
   * The per-country provider list and "detected" date that used to live
   * here (`p`, `d`) WERE the fabrication -- both are now resolved at
   * render time from real per-territory evidence (see resolveAnchorTerritory
   * below), keyed by the ANCHOR_CODES ISO lookup, not hardcoded here.
   */
  var DESKTOP_ANCHORS = {
    'Canada':         { l: 17.1, t: 22.4, flag: '🇨🇦' },
    'United States':  { l: 17.1, t: 35.9, flag: '🇺🇸' },
    'Mexico':         { l: 17.1, t: 47.8, flag: '🇲🇽' },
    'Brazil':         { l: 34.4, t: 72.7, flag: '🇧🇷' },
    'Peru':           { l: 27.2, t: 85.5, flag: '🇵🇪' },
    'United Kingdom': { l: 46.9, t: 28.9, flag: '🇬🇧' },
    'France':         { l: 48.2, t: 33.5, flag: '🇫🇷' },
    'Germany':        { l: 50.3, t: 30.0, flag: '🇩🇪' },
    'Spain':          { l: 46.1, t: 38.6, flag: '🇪🇸' },
    'Italy':          { l: 51.0, t: 37.0, flag: '🇮🇹' },
    'Sweden':         { l: 54.4, t: 16.1, flag: '🇸🇪' },
    'Poland':         { l: 50.0, t: 30.4, flag: '🇵🇱' },
    'South Africa':   { l: 53.0, t: 86.9, flag: '🇿🇦' },
    'Egypt':          { l: 54.0, t: 47.4, flag: '🇪🇬' },
    'Norway':         { l: 50.0, t: 20.9, flag: '🇳🇴' },
    'Türkiye':        { l: 57.0, t: 36.5, flag: '🇹🇷' },
    'Indonesia':      { l: 80.2, t: 72.1, flag: '🇮🇩' },
    'Singapore':      { l: 76.0, t: 65.1, flag: '🇸🇬' },
    'India':          { l: 69.1, t: 54.9, flag: '🇮🇳' },
    'China':          { l: 73.9, t: 41.0, flag: '🇨🇳' },
    'Japan':          { l: 85.2, t: 42.0, flag: '🇯🇵' },
    'South Korea':    { l: 82.3, t: 42.4, flag: '🇰🇷' },
    'Australia':      { l: 84.5, t: 85.5, flag: '🇦🇺' },
    'New Zealand':    { l: 86.9, t: 70.9, flag: '🇳🇿' },
  };

  /* ── Tablet Anchor Set™ — independent coordinate layer for 641–1024px ──
   * Completely independent from DESKTOP_ANCHORS and MOBILE_ANCHORS.
   * Calibrated only after Desktop is Board-approved and locked.
   * Desktop calibration never modifies this dataset.
   */
  var TABLET_ANCHORS = {
    'Canada':         { l: 18.1, t: 21.0, flag: '🇨🇦' },
    'United States':  { l: 20.0, t: 34.1, flag: '🇺🇸' },
    'Mexico':         { l: 17.4, t: 46.8, flag: '🇲🇽' },
    'Brazil':         { l: 32.8, t: 73.8, flag: '🇧🇷' },
    'Peru':           { l: 25.2, t: 69.6, flag: '🇵🇪' },
    'United Kingdom': { l: 46.9, t: 28.7, flag: '🇬🇧' },
    'France':         { l: 48.4, t: 33.2, flag: '🇫🇷' },
    'Germany':        { l: 50.0, t: 26.8, flag: '🇩🇪' },
    'Spain':          { l: 46.3, t: 38.9, flag: '🇪🇸' },
    'Italy':          { l: 51.7, t: 37.9, flag: '🇮🇹' },
    'Sweden':         { l: 52.7, t: 15.7, flag: '🇸🇪' },
    'Poland':         { l: 51.3, t: 30.9, flag: '🇵🇱' },
    'South Africa':   { l: 53.7, t: 90.2, flag: '🇿🇦' },
    'Egypt':          { l: 55.4, t: 47.1, flag: '🇪🇬' },
    'Norway':         { l: 50.1, t: 21.4, flag: '🇳🇴' },
    'Türkiye':        { l: 56.8, t: 36.0, flag: '🇹🇷' },
    'Indonesia':      { l: 80.0, t: 70.0, flag: '🇮🇩' },
    'Singapore':      { l: 76.0, t: 63.0, flag: '🇸🇬' },
    'India':          { l: 69.4, t: 52.2, flag: '🇮🇳' },
    'China':          { l: 74.6, t: 46.5, flag: '🇨🇳' },
    'Japan':          { l: 84.9, t: 42.0, flag: '🇯🇵' },
    'South Korea':    { l: 82.2, t: 42.4, flag: '🇰🇷' },
    'Australia':      { l: 84.8, t: 85.5, flag: '🇦🇺' },
    'New Zealand':    { l: 87.0, t: 71.2, flag: '🇳🇿' },
  };

  /* ── Mobile Anchor Set™ — independent coordinate layer for ≤640px ────
   * Completely independent from DESKTOP_ANCHORS and TABLET_ANCHORS.
   * Calibrated only after Desktop and Tablet are Board-approved and locked.
   * 10 primary markets only (Phase 3 calibration); the remaining evaluated
   * territories are available in the Distribution Gaps™ drawer.
   */
  var MOBILE_ANCHORS = {
    'Canada':         { l: 17.4, t: 22.2, flag: '🇨🇦' },
    'United States':  { l: 20.0, t: 36.7, flag: '🇺🇸' },
    'Brazil':         { l: 33.1, t: 75.2, flag: '🇧🇷' },
    'United Kingdom': { l: 46.1, t: 26.7, flag: '🇬🇧' },
    'France':         { l: 48.5, t: 33.0, flag: '🇫🇷' },
    'Germany':        { l: 50.0, t: 28.0, flag: '🇩🇪' },
    'Japan':          { l: 84.9, t: 42.7, flag: '🇯🇵' },
    'India':          { l: 69.1, t: 50.2, flag: '🇮🇳' },
    'Australia':      { l: 84.6, t: 85.7, flag: '🇦🇺' },
    'South Africa':   { l: 53.7, t: 88.2, flag: '🇿🇦' },
  };

  /* ── Anchor → real territory-evidence lookup ─────────────────────────
   * ISO 3166-1 alpha-2 codes, lowercase, matching the Territory
   * Intelligence Engine's real per-territory `code` field
   * (lib/territory/canonical-territory-vocabulary.js ALL_APPLE_STOREFRONTS).
   * A pure name→code translation table, not business intelligence --
   * same category as canonical-territory-vocabulary.js's own COUNTRY_NAMES.
   */
  var ANCHOR_CODES = {
    'Canada': 'ca', 'United States': 'us', 'Mexico': 'mx', 'Brazil': 'br',
    'Peru': 'pe', 'United Kingdom': 'gb', 'France': 'fr', 'Germany': 'de',
    'Spain': 'es', 'Italy': 'it', 'Sweden': 'se', 'Poland': 'pl',
    'South Africa': 'za', 'Egypt': 'eg', 'Norway': 'no', 'Türkiye': 'tr',
    'Indonesia': 'id', 'Singapore': 'sg', 'India': 'in', 'China': 'cn',
    'Japan': 'jp', 'South Korea': 'kr', 'Australia': 'au', 'New Zealand': 'nz',
  };

  var P_COLOR = { apple: '#FC3C44', spotify: '#1DB954', deezer: '#A238FF', tidal: '#00D5FF' };
  var P_NAME  = { apple: 'Apple Music', spotify: 'Spotify', deezer: 'Deezer', tidal: 'TIDAL' };

  /* Real per-territory `providers[]` (from distributionGaps.territories, see
   * api/_lib/global-music-footprint.js buildDistributionGaps()) carries PAL
   * provider ids ('apple_music', 'spotify', 'deezer', 'tidal') -- normalize
   * to the short keys this component's CSS/markup namespace already uses
   * (.gf-marker--apple, .gf-legend-dot--apple, etc, pre-dating this refactor
   * and left unchanged to avoid an unnecessary stylesheet edit). */
  var PROVIDER_ID_TO_KEY = { apple_music: 'apple', spotify: 'spotify', deezer: 'deezer', tidal: 'tidal' };
  function shortProviderKey(providerId) {
    return PROVIDER_ID_TO_KEY[providerId] || null;
  }

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
            '<span class="gf-popover-label">Last Verified</span>',
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
        '<div class="gf-territories-badge" aria-label="Territories verified: pending scan data">',
          '<span class="gf-territories-label">Territories Verified™</span>',
          '<span class="gf-territories-count">—</span>',
        '</div>',
      '</div>',
    ].join('');
  }

  /* formatMapDate — 'Jan 15, 2026' from an ISO timestamp, honest fallback
   * when no real lastVerified evidence exists for a territory. */
  function formatMapDate(iso) {
    if (!iso) return 'Not yet verified';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'Not yet verified';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  /* ── initGlobalMapViewport ───────────────────────────────────────── */
  function initGlobalMapViewport(hostEl, options) {
    if (!hostEl) { console.warn('GlobalMapViewport™: host element not found'); return {}; }
    options = options || {};

    /* ── Three-tier coordinate selection — viewport-only, no URL override ─
     * The URL param (calibrate=desktop|tablet|mobile) controls cal mode only.
     * It never changes which anchor dataset is active — that is always
     * determined purely by window.innerWidth. This guarantees that adjusting
     * one viewport's dataset cannot affect any other viewport's rendering.  */
    var _vw = window.innerWidth;
    var activeAnchors = _vw <= 640  ? MOBILE_ANCHORS
                      : _vw <= 1024 ? TABLET_ANCHORS
                                    : DESKTOP_ANCHORS;
    var _cal    = options.calibrationMode; /* 'desktop' | 'tablet' | 'mobile' | null */
    var calMode = (_cal === 'desktop' && _vw > 1024)
               || (_cal === 'tablet'  && _vw > 640 && _vw <= 1024)
               || (_cal === 'mobile'  && _vw <= 640);

    /* render */
    hostEl.innerHTML = buildInnerHTML();

    var mapInner          = hostEl.querySelector('.gf-map-inner');
    var popover           = hostEl.querySelector('.gf-popover');
    var legend            = hostEl.querySelector('.gf-legend');
    var activeFilter      = null;
    var filterResetTimer  = null;

    /* ── Real evidence lookup (Board directive, 2026-07-21 Constitutional
     * Refactor) — options.territories is the real distributionGaps.territories
     * array (api/_lib/global-music-footprint.js). Never fabricated: an
     * anchor country with no matching real territory renders its flag only,
     * with zero provider markers, rather than inventing presence. */
    var territoryByCode = {};
    (Array.isArray(options.territories) ? options.territories : []).forEach(function (t) {
      if (t && typeof t.code === 'string') territoryByCode[t.code.toLowerCase()] = t;
    });

    var territoriesBadge = hostEl.querySelector('.gf-territories-count');
    var territoriesBadgeWrap = hostEl.querySelector('.gf-territories-badge');
    if (territoriesBadge && options.territoriesAvailable != null) {
      territoriesBadge.textContent = String(options.territoriesAvailable);
      if (territoriesBadgeWrap) territoriesBadgeWrap.setAttribute('aria-label', options.territoriesAvailable + ' territories verified');
    }

    /* ── Geographic Anchor Engine™ ───────────────────────────────── */
    /* activeAnchors is viewport-selected above. Each tier is fully  */
    /* independent — modifying one dataset never affects the others. */
    Object.keys(activeAnchors).forEach(function (country) {
      var a = activeAnchors[country];
      var code    = ANCHOR_CODES[country] || null;
      var realT   = code ? territoryByCode[code] : null;
      var status  = realT ? realT.status : 'Unknown';
      var lastVerified = realT ? realT.lastVerified : null;
      var providers = (realT && Array.isArray(realT.providers))
        ? realT.providers.map(shortProviderKey).filter(Boolean)
        : [];

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

      /* Calibration passes: flags only, dots suppressed until Phase 4.
       * providers is real evidence -- an anchor with no confirmed providers
       * (unavailable/unknown/pending-review/no-match territory) renders no
       * markers at all, matching "no fabricated markers" directly. */
      if (!calMode) {
        providers.forEach(function (prov) {
          var off = P_OFF[prov] || [0, 0];
          var el  = document.createElement('span');
          el.className = 'gf-marker gf-marker--' + prov;
          el.style.cssText = 'left:' + (a.l + off[0]) + '%;top:' + (a.t + off[1]) + '%;animation-delay:' + ((a.l / 100) * 4).toFixed(2) + 's';
          el.dataset.country  = country;
          el.dataset.provider = prov;
          el.dataset.detected = lastVerified || '';
          el.dataset.status   = status;
          el.dataset.allp     = providers.join(',');
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
      hostEl.querySelector('.gmv-pop-detected').textContent = formatMapDate(el.dataset.detected);
      hostEl.querySelector('.gmv-pop-status').textContent   = el.dataset.status || 'Unknown';
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

    if (calMode) {
      var _banners = {
        desktop: '⚙ DESKTOP CALIBRATION — Phase 1 — flags only · click a flag for L / T',
        tablet:  '⚙ TABLET CALIBRATION — Phase 2 — flags only · click a flag for L / T',
        mobile:  '⚙ MOBILE CALIBRATION — Phase 3 — flags only · click a flag for L / T',
      };
      /* Mobile hides the map section via CSS; override it for calibration */
      if (_cal === 'mobile') {
        var _mcs = document.createElement('style');
        _mcs.textContent = '.gf-map-section{display:block!important}';
        document.head.appendChild(_mcs);
      }
      enableCalibrationMode(mapInner, _banners[_cal]);
    }

    /* public API for workspace integration */
    return { hidePopover: hidePopover };
  }

  /* ── Calibration Mode (dev only — not shipped in production) ─────── */
  function enableCalibrationMode(mapInner, bannerLabel) {
    /* styles — scoped to gmv-cal-* namespace */
    var s = document.createElement('style');
    s.textContent = [
      '.gmv-cal-banner{position:absolute;top:0;left:0;right:0;z-index:50;background:rgba(250,204,21,.1);border-bottom:1px solid rgba(250,204,21,.35);padding:5px 10px;font:10px/1.4 monospace;color:#fde047;letter-spacing:.06em;text-align:center;pointer-events:none;}',
      '.gf-legend{display:none!important;}',
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
