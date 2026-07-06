/**
 * ROYALTĒ Developer Console™
 * ─────────────────────────────────────────────────────────────────────────
 * Internal responsive development and Board review tool.
 * NEVER appears in production.
 *
 * ACTIVATION      : ?dev=1 in URL · auto-activates on localhost
 * SIMULATION      : iframe at exact viewport width — real media queries,
 *                   no page reload, JS state preserved between mode switches
 * ARCHITECTURE    : extensible for device presets, grid/safe-area overlays,
 *                   RDS diagnostics, and module certification (Phase 2+)
 *
 * CANONICAL TIERS :
 *   Executive Desktop™    > 1024px   1440 × 900    RDS 12-col
 *   Executive Tablet™    641–1024px   768 × 1024   RDS  8-col
 *   Executive Mobile™     ≤ 640px    390 × 844     RDS  4-col
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Activation guard ───────────────────────────────────────────────── */
  var params   = new URLSearchParams(location.search);
  var devParam = params.get('dev') === '1';
  var isLocal  = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!devParam && !isLocal) return;
  if (window !== window.top) return; /* never render inside the sim iframe  */

  /* ── Viewport definitions ───────────────────────────────────────────── */
  /* Phase 2: expand each entry with { presets: [...] } for device menu.  */
  var VIEWPORTS = [
    {
      id: 'desktop', label: 'Executive Desktop™', short: 'Desktop', icon: '🖥',
      w: 1440, h: 900,  color: '#22c55e', bp: 'Desktop', cols: 12,
    },
    {
      id: 'tablet',  label: 'Executive Tablet™',  short: 'Tablet',  icon: '💻',
      w: 768,  h: 1024, color: '#38bdf8', bp: 'Tablet',  cols: 8,
    },
    {
      id: 'mobile',  label: 'Executive Mobile™',  short: 'Mobile',  icon: '📱',
      w: 390,  h: 844,  color: '#a855f7', bp: 'Mobile',  cols: 4,
    },
  ];

  /* ── State ──────────────────────────────────────────────────────────── */
  var active    = null;   /* active viewport id, or null = native            */
  var collapsed = false;
  var simEl     = null;   /* fixed overlay backdrop                          */
  var frameEl   = null;   /* the simulation iframe                           */
  var frameWrap = null;   /* scaled container around the iframe              */
  var labelEl   = null;   /* device label above the frame                    */

  /* ── Helpers ────────────────────────────────────────────────────────── */
  function nativeVp() {
    var w = window.innerWidth;
    if (w > 1024) return VIEWPORTS[0];
    if (w >= 641) return VIEWPORTS[1];
    return VIEWPORTS[2];
  }

  /* Build sim URL: preserve ?dev=1 so the console guard passes,
     but the iframe hits window !== window.top and self-exits.            */
  function simUrl() {
    var u = new URL(location.href);
    u.searchParams.set('dev', '1');
    return u.toString();
  }

  /* Compute scale factor to fit the viewport into the available screen,
     leaving room for the console panel and device label.                */
  function getScale(vp) {
    var padH = 120; /* topbar + label + breathing room */
    var padW = 60;  /* side margins                    */
    var scaleW = (window.innerWidth  - padW) / vp.w;
    var scaleH = (window.innerHeight - padH) / vp.h;
    return Math.min(1, scaleW, scaleH);
  }

  /* ── Simulation lifecycle ───────────────────────────────────────────── */
  function mountSim(vp) {
    if (!simEl) {
      /* Backdrop — blocks interaction with the real page during sim.    */
      simEl = document.createElement('div');
      simEl.id = 'rdc-overlay';

      /* Device label */
      labelEl = document.createElement('div');
      labelEl.id = 'rdc-label';

      /* Scaled container (visual dimensions) */
      frameWrap = document.createElement('div');
      frameWrap.id = 'rdc-frame-wrap';

      /* Simulation iframe */
      frameEl = document.createElement('iframe');
      frameEl.id = 'rdc-iframe';
      frameEl.src = simUrl();
      frameEl.setAttribute('title', 'ROYALTĒ Developer Console™ — Viewport Simulation');

      frameWrap.appendChild(frameEl);
      simEl.appendChild(labelEl);
      simEl.appendChild(frameWrap);
      document.body.appendChild(simEl);
    }
    applySim(vp);
  }

  /* applySim: update iframe/container dimensions for the target viewport.
     Changing iframe CSS width triggers real media query re-evaluation
     inside the iframe — NO page reload, JS state preserved.            */
  function applySim(vp) {
    if (!frameEl) return;
    var s = getScale(vp);
    var sw = Math.round(vp.w * s);
    var sh = Math.round(vp.h * s);

    /* Container takes the scaled (visual) dimensions. */
    frameWrap.style.cssText = [
      'position:relative',
      'overflow:hidden',
      'width:'  + sw + 'px',
      'height:' + sh + 'px',
      'border-radius:16px',
      'flex-shrink:0',
      'box-shadow:0 0 0 1px rgba(255,255,255,0.10),0 32px 80px rgba(0,0,0,0.90)',
    ].join(';');

    /* Iframe renders at full device size; transform scales it visually.
       Internal viewport = vp.w — media queries fire at the target tier. */
    frameEl.style.cssText = [
      'position:absolute',
      'top:0',
      'left:0',
      'width:'  + vp.w + 'px',
      'height:' + vp.h + 'px',
      'border:none',
      'background:#07050f',
      'transform:scale(' + s.toFixed(4) + ')',
      'transform-origin:top left',
    ].join(';');

    /* Label */
    if (labelEl) {
      labelEl.style.color = vp.color;
      labelEl.textContent = vp.label + ' · ' + vp.w + ' \xD7 ' + vp.h + 'px · RDS ' + vp.cols + '-col';
    }
  }

  function killSim() {
    if (simEl) { simEl.remove(); simEl = null; frameEl = null; frameWrap = null; labelEl = null; }
  }

  /* ── Mode switching ─────────────────────────────────────────────────── */
  function setViewport(id) {
    var vp = VIEWPORTS.find(function (v) { return v.id === id; });
    if (!vp) return;
    if (active === id) {
      /* toggle off — restore panel to bottom, expand */
      active = null;
      collapsed = false;
      killSim();
    } else {
      active = id;
      /* Auto-collapse + move panel to top so simulation fills the screen. */
      collapsed = true;
      mountSim(vp);
    }
    render();
  }

  function exitSim() {
    active = null;
    collapsed = false;
    killSim();
    render();
  }

  /* ── Panel ──────────────────────────────────────────────────────────── */
  var panel = document.createElement('div');
  panel.id = 'rdc-panel';

  function render() {
    var native = nativeVp();
    var vp = active ? VIEWPORTS.find(function (v) { return v.id === active; }) : null;

    /* Re-apply sim dimensions on render (handles window resize). */
    if (vp) applySim(vp);

    var bodyHtml = collapsed ? '' : (
      '<div id="rdc-body">' +

        /* Viewport info block */
        '<div class="rdc-block">' +
          '<div class="rdc-block-label">VIEWPORT' + (vp ? ' · SIMULATING' : '') + '</div>' +
          '<div class="rdc-vp-name" style="color:' + (vp || native).color + '">' + (vp || native).label + '</div>' +
          '<div class="rdc-vp-meta">' +
            (vp
              ? (vp.w + ' \xD7 ' + vp.h + 'px · ' + vp.bp + ' · RDS ' + vp.cols + '-col')
              : (window.innerWidth + ' \xD7 ' + window.innerHeight + 'px · ' + native.bp + ' · Native')
            ) +
          '</div>' +
        '</div>' +

        /* Viewport switcher */
        '<div class="rdc-block">' +
          '<div class="rdc-block-label">SWITCH VIEWPORT</div>' +
          '<div class="rdc-vp-row">' +
            VIEWPORTS.map(function (v) {
              var on = active === v.id;
              var style = on ? ('--rdc-ac:' + v.color + ';color:' + v.color + ';background:' + v.color + '14;border-color:' + v.color + '44;font-weight:700') : '';
              return '<button class="rdc-vp-btn' + (on ? ' on' : '') + '" data-id="' + v.id + '" style="' + style + '" title="' + v.label + ' — ' + v.w + '\xD7' + v.h + 'px">' +
                '<span class="rdc-vp-icon">' + v.icon + '</span>' +
                '<span class="rdc-vp-short">' + v.short + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        /* Status row */
        (vp
          ? '<div class="rdc-status-row">' +
              '<span class="rdc-native-pill">Native: ' + native.label + ' · ' + window.innerWidth + 'px</span>' +
              '<button id="rdc-exit-btn">Exit ✕</button>' +
            '</div>'
          : '<div class="rdc-hint">Select a viewport above to begin simulation</div>'
        ) +

      '</div>'
    );

    /* Move panel to top-right while simulating so it doesn't cover the
       iframe. Restore to bottom-right in native view.                   */
    if (active) {
      panel.classList.add('rdc-panel--sim');
    } else {
      panel.classList.remove('rdc-panel--sim');
    }

    panel.innerHTML =
      '<div id="rdc-header">' +
        '<span class="rdc-dot"></span>' +
        '<span class="rdc-title">Developer Console™</span>' +
        '<button class="rdc-collapse" aria-label="' + (collapsed ? 'Expand' : 'Collapse') + '">' + (collapsed ? '&#9650;' : '&#9660;') + '</button>' +
      '</div>' +
      bodyHtml;

    /* Wire events */
    var hdr = panel.querySelector('#rdc-header');
    hdr.addEventListener('click', function (e) {
      if (e.target.closest('.rdc-collapse')) { collapsed = !collapsed; render(); }
    });

    panel.querySelectorAll('.rdc-vp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setViewport(btn.dataset.id); });
    });

    var exitBtn = panel.querySelector('#rdc-exit-btn');
    if (exitBtn) exitBtn.addEventListener('click', exitSim);
  }

  /* ── Styles ─────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [

    /* Simulation overlay backdrop.
       padding-top: 64px clears the auto-collapsed panel at top:20px.   */
    '#rdc-overlay{',
      'position:fixed;inset:0;z-index:99998;',
      'background:rgba(4,2,12,0.82);',
      'display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:14px;',
      'padding-top:64px;',
      'backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);',
    '}',

    '#rdc-label{',
      'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;',
      'font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;',
    '}',

    /* Console panel — native view: bottom-right; sim active: top-right  */
    '#rdc-panel{',
      'position:fixed;bottom:20px;right:20px;z-index:999999;',
      'background:rgba(7,4,14,0.97);',
      'border:1px solid rgba(168,85,247,0.28);',
      'border-radius:14px;',
      'font-family:-apple-system,BlinkMacSystemFont,"Inter",sans-serif;',
      'font-size:11px;color:#c8cdd8;min-width:224px;',
      'backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);',
      'box-shadow:0 16px 48px rgba(0,0,0,0.85),0 0 0 1px rgba(168,85,247,0.06);',
      'user-select:none;',
      'transition:top 0.2s ease,bottom 0.2s ease;',
    '}',

    /* Simulation active: move panel to top-right, clear of the iframe.  */
    '#rdc-panel.rdc-panel--sim{',
      'bottom:auto;top:20px;',
    '}',

    '#rdc-header{',
      'display:flex;align-items:center;gap:8px;',
      'padding:12px 14px;cursor:default;',
    '}',

    '.rdc-dot{',
      'width:6px;height:6px;border-radius:50%;flex-shrink:0;',
      'background:#a855f7;box-shadow:0 0 8px #a855f7;',
      'animation:rdc-pulse 2s ease-in-out infinite;',
    '}',
    '@keyframes rdc-pulse{0%,100%{opacity:1}50%{opacity:0.4}}',

    '.rdc-title{',
      'flex:1;font-size:9px;font-weight:700;',
      'letter-spacing:0.16em;text-transform:uppercase;color:#a855f7;',
    '}',

    '.rdc-collapse{',
      'background:none;border:none;color:#4b5563;font-size:11px;',
      'cursor:pointer;padding:0 2px;font-family:inherit;line-height:1;',
      'transition:color 0.15s;',
    '}',
    '.rdc-collapse:hover{color:#a855f7;}',

    '#rdc-body{padding:0 14px 14px;}',

    '.rdc-block{',
      'padding:10px 0;',
      'border-top:1px solid rgba(255,255,255,0.05);',
    '}',

    '.rdc-block-label{',
      'font-size:9px;font-weight:700;letter-spacing:0.12em;',
      'text-transform:uppercase;color:#374151;margin-bottom:6px;',
    '}',

    '.rdc-vp-name{font-size:14px;font-weight:700;line-height:1.2;margin-bottom:3px;}',
    '.rdc-vp-meta{font-size:10px;color:#6b7280;font-variant-numeric:tabular-nums;}',

    /* Viewport switcher buttons */
    '.rdc-vp-row{display:flex;gap:5px;}',

    '.rdc-vp-btn{',
      'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;',
      'padding:9px 4px 8px;',
      'background:rgba(255,255,255,0.03);',
      'border:1px solid rgba(255,255,255,0.07);',
      'border-radius:9px;color:#6b7280;',
      'cursor:pointer;font-family:inherit;',
      'transition:all 0.15s ease;',
    '}',
    '.rdc-vp-btn:hover{',
      'background:rgba(168,85,247,0.07);',
      'border-color:rgba(168,85,247,0.22);',
      'color:#c8cdd8;',
    '}',

    '.rdc-vp-icon{font-size:16px;line-height:1;}',
    '.rdc-vp-short{font-size:9px;font-weight:600;letter-spacing:0.04em;}',

    /* Status row */
    '.rdc-status-row{',
      'display:flex;align-items:center;justify-content:space-between;gap:8px;',
      'padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);',
    '}',

    '.rdc-native-pill{font-size:10px;color:#374151;}',

    '#rdc-exit-btn{',
      'font-size:10px;font-weight:600;color:#a855f7;',
      'background:rgba(168,85,247,0.08);',
      'border:1px solid rgba(168,85,247,0.22);',
      'border-radius:6px;padding:5px 10px;',
      'cursor:pointer;font-family:inherit;white-space:nowrap;',
      'transition:all 0.15s ease;',
    '}',
    '#rdc-exit-btn:hover{background:rgba(168,85,247,0.16);border-color:rgba(168,85,247,0.38);}',

    '.rdc-hint{',
      'padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);',
      'font-size:10px;color:#374151;',
    '}',

  ].join('');

  /* ── Mount ──────────────────────────────────────────────────────────── */
  document.head.appendChild(style);
  render();
  document.body.appendChild(panel);
  window.addEventListener('resize', render);

})();
