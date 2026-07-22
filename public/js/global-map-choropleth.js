/* ============================================================
 * GlobalMapChoropleth™ — Royaltē Platform Component v2.0
 * ============================================================
 * Board directive (2026-07-21, Executive Visual Rebuild): replaces
 * GlobalMapViewport™'s scattered-dot treatment with a real per-territory
 * shaded world map. Every territory's fill color is resolved from real
 * distributionGaps.territories evidence — never hardcoded.
 *
 * Map asset: public/img/world-territories-map.svg (Wikimedia Commons
 * "BlankMap-World-Compact.svg", public domain, no attribution required).
 * 252 ISO 3166-1 alpha-2 country groups; confirmed 167/167 real Apple
 * storefront codes present before adoption.
 *
 * Territories outside Apple's 167-storefront evaluation universe (the
 * SVG has broader ISO coverage than Apple's storefront list) are
 * rendered in a dim neutral tone — not part of the evidence surface,
 * not "Unknown" (a real assessed state), just out of scope for this
 * evidence source.
 *
 * Usage:
 *   var choropleth = initGlobalMapChoropleth(hostEl, {
 *     territories: distributionGaps.territories,  // real, from
 *                                                   // api/_lib/global-music-footprint.js
 *     onCountrySelect: function (territory) { ... },
 *   });
 * ============================================================ */

(function (root) {
  'use strict';

  var MAP_SVG_URL = '/img/world-territories-map.svg';

  var STATE_COLOR = Object.freeze({
    Available:       '#22c55e',
    Unavailable:      '#ef4444',
    Unknown:          '#9ca3af',
    'Pending Review': '#6b7280',
  });

  var STATE_STROKE = Object.freeze({
    Available:       'rgba(34,197,94,0.55)',
    Unavailable:      'rgba(239,68,68,0.5)',
    Unknown:          'rgba(156,163,175,0.4)',
    'Pending Review': 'rgba(107,114,128,0.35)',
  });

  var OUT_OF_SCOPE_FILL   = '#1c2230';
  var OUT_OF_SCOPE_STROKE = 'rgba(255,255,255,0.04)';

  function buildLoadingState() {
    return '<div class="gmc-loading" role="status">Loading territory map…</div>';
  }

  var _svgCache = null;
  function fetchMapSvg() {
    if (_svgCache) return Promise.resolve(_svgCache);
    return fetch(MAP_SVG_URL)
      .then(function (res) { return res.text(); })
      .then(function (text) { _svgCache = text; return text; });
  }

  function initGlobalMapChoropleth(hostEl, options) {
    if (!hostEl) { console.warn('GlobalMapChoropleth™: host element not found'); return {}; }
    options = options || {};

    var territoryByCode = {};
    (Array.isArray(options.territories) ? options.territories : []).forEach(function (t) {
      if (t && typeof t.code === 'string') territoryByCode[t.code.toLowerCase()] = t;
    });

    hostEl.innerHTML = buildLoadingState();

    var api = { selectCountry: null, clearSelection: null };

    fetchMapSvg().then(function (svgMarkup) {
      hostEl.innerHTML = svgMarkup;
      var svgEl = hostEl.querySelector('svg');
      if (!svgEl) return;
      svgEl.classList.add('gmc-svg');
      svgEl.setAttribute('role', 'img');
      svgEl.setAttribute('aria-label', 'Global territory availability map');

      var tooltip = document.createElement('div');
      tooltip.className = 'gmc-tooltip';
      tooltip.setAttribute('aria-hidden', 'true');
      hostEl.appendChild(tooltip);

      var groups = svgEl.querySelectorAll('g[id], path[id]');
      var selectedEl = null;

      groups.forEach(function (el) {
        var code = (el.getAttribute('id') || '').toLowerCase();
        if (!/^[a-z]{2}$/.test(code)) return; // skip non-territory ids (defs, titles, etc.)

        var t = territoryByCode[code];
        el.classList.add('gmc-territory');
        el.dataset.code = code;

        // Set fill/stroke as direct inline style properties (not CSS custom
        // properties) -- inline style always wins the cascade regardless of
        // DOM injection order, which a var()-based approach did not
        // (discovered live: the fetched SVG's own embedded stylesheet was
        // entering the DOM after ours and winning on equal specificity).
        if (t) {
          el.dataset.status = t.status;
          el.style.fill = STATE_COLOR[t.status] || STATE_COLOR.Unknown;
          el.style.stroke = STATE_STROKE[t.status] || STATE_STROKE.Unknown;
          el.classList.add('gmc-territory--evaluated');
        } else {
          // Outside Apple's 167-storefront evaluation universe -- not
          // "Unknown" (a real assessed state); simply not part of this
          // evidence source's scope. Rendered as inert background.
          el.style.fill = OUT_OF_SCOPE_FILL;
          el.style.stroke = OUT_OF_SCOPE_STROKE;
        }

        if (t) {
          el.addEventListener('mouseenter', function (e) { showTooltip(e, t); });
          el.addEventListener('mousemove', function (e) { moveTooltip(e); });
          el.addEventListener('mouseleave', hideTooltip);
          el.setAttribute('tabindex', '0');
          el.setAttribute('role', 'button');
          el.setAttribute('aria-label', t.name + ' — ' + t.status);
        }
      });

      // Click/keydown resolution is delegated to the SVG root rather than
      // bound per-element. Some territory groups are geographically nested
      // inside another territory's <g> (e.g. Hong Kong/Macau/Taiwan inside
      // China) -- with a listener on every element, a click on the nested
      // child fired the child's own handler correctly, then bubbled to
      // *also* fire the parent's independent handler, which overwrote the
      // panel with the parent's data. A single delegated listener walks
      // from the actual click target outward and resolves to the nearest
      // ancestor-or-self that has real evidence -- for a click landing
      // inside Macau, that's Macau itself (nearer than China), so it
      // never reaches China's data at all. For the ten other nested pairs
      // in this SVG (e.g. France's overseas territories), the nested
      // child has no independent Apple evidence, so resolution correctly
      // continues outward to the parent -- identical to today's behavior,
      // preserved because the walk is evidence-based, not depth-based.
      function resolveTerritoryTarget(target) {
        var el = target;
        while (el && el !== svgEl) {
          if (el.nodeType === 1 && el.dataset && el.dataset.code) {
            var t = territoryByCode[el.dataset.code];
            if (t) return { el: el, t: t };
          }
          el = el.parentNode;
        }
        return null;
      }

      svgEl.addEventListener('click', function (e) {
        var match = resolveTerritoryTarget(e.target);
        if (match) selectCountry(match.el, match.t);
      });

      svgEl.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var match = resolveTerritoryTarget(e.target);
        if (match) { e.preventDefault(); selectCountry(match.el, match.t); }
      });

      function showTooltip(e, t) {
        tooltip.innerHTML =
          '<div class="gmc-tooltip-name">' + escapeHtml(t.name) + '</div>' +
          '<div class="gmc-tooltip-status gmc-tooltip-status--' + statusClass(t.status) + '">' + escapeHtml(t.status) + '</div>';
        tooltip.classList.add('gmc-tooltip--visible');
        moveTooltip(e);
      }
      function moveTooltip(e) {
        var hostRect = hostEl.getBoundingClientRect();
        tooltip.style.left = (e.clientX - hostRect.left + 14) + 'px';
        tooltip.style.top  = (e.clientY - hostRect.top - 8) + 'px';
      }
      function hideTooltip() {
        tooltip.classList.remove('gmc-tooltip--visible');
      }

      function selectCountry(el, t) {
        if (selectedEl) selectedEl.classList.remove('gmc-territory--selected');
        selectedEl = el;
        el.classList.add('gmc-territory--selected');
        if (typeof options.onCountrySelect === 'function') options.onCountrySelect(t);
      }

      api.selectCountry = function (code) {
        var el = svgEl.querySelector('[id="' + code.toLowerCase() + '"]');
        var t = territoryByCode[code.toLowerCase()];
        if (el && t) selectCountry(el, t);
      };
      api.clearSelection = function () {
        if (selectedEl) selectedEl.classList.remove('gmc-territory--selected');
        selectedEl = null;
      };
    }).catch(function (err) {
      console.error('[global-map-choropleth] failed to load map asset:', err.message);
      hostEl.innerHTML = '<div class="gmc-error" role="status">Territory map unavailable.</div>';
    });

    return api;
  }

  function statusClass(status) {
    return String(status || 'unknown').toLowerCase().replace(/\s+/g, '-');
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  root.initGlobalMapChoropleth = initGlobalMapChoropleth;

}(window));
