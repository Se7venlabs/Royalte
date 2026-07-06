/**
 * RDS Preview Console™
 * ──────────────────────────────────────────────────────────────────────────
 * Internal developer tool for Royaltē OS™ responsive design validation.
 *
 * ACTIVATION   : Add ?dev=1 to any MC URL
 * PURPOSE      : Live viewport tier indicator + one-click preview launchers
 * CANONICAL TIERS:
 *   Executive Desktop™    > 1024px
 *   Executive Tablet™    641–1024px
 *   Executive Mobile™     ≤ 640px
 *
 * ARCHITECTURE
 *   Phase 1 (v1.0)  : Live tier indicator + window-based preview launchers
 *   Phase 2 (future): Class-injection simulation (no new window required)
 *   Phase 3 (future): Live RDS diagnostics — grid overlay, token inspector
 * ──────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  if (new URLSearchParams(location.search).get('dev') !== '1') return;

  /* ── Canonical viewport tiers ─────────────────────────────────────────── */
  var TIERS = [
    { id: 'desktop', label: 'Executive Desktop™', short: 'Desktop', range: '> 1024px',   w: 1440, h: 900,  color: '#22c55e' },
    { id: 'tablet',  label: 'Executive Tablet™',  short: 'Tablet',  range: '641–1024px', w: 768,  h: 1024, color: '#38bdf8' },
    { id: 'mobile',  label: 'Executive Mobile™',  short: 'Mobile',  range: '≤ 640px',    w: 390,  h: 844,  color: '#a855f7' },
  ];

  function activeTier() {
    var w = window.innerWidth;
    if (w > 1024) return 'desktop';
    if (w >= 641) return 'tablet';
    return 'mobile';
  }

  /* ── Panel element ─────────────────────────────────────────────────────── */
  var panel = document.createElement('div');
  panel.id = 'rds-preview-console';

  function render() {
    var tierId = activeTier();
    var active = TIERS.find(function (t) { return t.id === tierId; });
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    panel.innerHTML =
      '<div class="rds-pc-header">' +
        '<div class="rds-pc-dot"></div>' +
        '<span>RDS Preview Console™</span>' +
      '</div>' +
      '<div class="rds-pc-viewport">' +
        '<div class="rds-pc-vp-label">Active Viewport</div>' +
        '<div class="rds-pc-vp-tier" style="color:' + active.color + '">' + active.label + '</div>' +
        '<div class="rds-pc-vp-size">' + vw + ' × ' + vh + 'px</div>' +
      '</div>' +
      '<div class="rds-pc-modes">' +
        TIERS.map(function (t) {
          var isActive = t.id === tierId;
          var activeStyle = isActive
            ? 'border-color:' + t.color + '33;color:' + t.color + ';background:' + t.color + '12;font-weight:700;'
            : '';
          return '<button class="rds-pc-btn" data-tier="' + t.id + '" data-w="' + t.w + '" data-h="' + t.h + '" style="' + activeStyle + '">' +
            '<span>' + t.short + '</span>' +
            '<span class="rds-pc-range">' + t.range + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="rds-pc-footer">RDS v1.0 · ?dev=1</div>';

    panel.querySelectorAll('.rds-pc-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = parseInt(btn.dataset.w);
        var h = parseInt(btn.dataset.h);
        window.open(
          location.href,
          '_blank',
          'width=' + w + ',height=' + h + ',menubar=no,toolbar=no,location=yes,scrollbars=yes,resizable=yes'
        );
      });
    });
  }

  /* ── Styles ────────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '#rds-preview-console {',
      'position: fixed; bottom: 20px; right: 20px; z-index: 999999;',
      'background: rgba(8, 5, 18, 0.96);',
      'border: 1px solid rgba(168, 85, 247, 0.28);',
      'border-radius: 14px; padding: 14px 16px;',
      'font-family: -apple-system, BlinkMacSystemFont, "Inter", sans-serif;',
      'font-size: 11px; color: #c8cdd8; min-width: 212px;',
      'backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);',
      'box-shadow: 0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(168,85,247,0.06);',
      'user-select: none;',
    '}',
    '.rds-pc-header {',
      'display: flex; align-items: center; gap: 8px;',
      'margin-bottom: 10px; padding-bottom: 10px;',
      'border-bottom: 1px solid rgba(168,85,247,0.10);',
    '}',
    '.rds-pc-header span {',
      'font-size: 9px; font-weight: 700; letter-spacing: 0.18em;',
      'text-transform: uppercase; color: #a855f7;',
    '}',
    '.rds-pc-dot {',
      'width: 6px; height: 6px; border-radius: 50%;',
      'background: #a855f7; box-shadow: 0 0 8px #a855f7;',
      'animation: rds-pc-pulse 2s ease-in-out infinite; flex-shrink: 0;',
    '}',
    '@keyframes rds-pc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }',
    '.rds-pc-viewport { margin-bottom: 10px; }',
    '.rds-pc-vp-label {',
      'font-size: 9px; color: #4b5563; letter-spacing: 0.10em;',
      'text-transform: uppercase; margin-bottom: 3px;',
    '}',
    '.rds-pc-vp-tier { font-size: 13px; font-weight: 600; line-height: 1.2; }',
    '.rds-pc-vp-size { font-size: 10px; color: #6b7280; margin-top: 2px; font-variant-numeric: tabular-nums; }',
    '.rds-pc-modes { display: flex; flex-direction: column; gap: 4px; }',
    '.rds-pc-btn {',
      'display: flex; align-items: center; justify-content: space-between;',
      'padding: 8px 10px;',
      'background: rgba(255,255,255,0.03);',
      'border: 1px solid rgba(255,255,255,0.07);',
      'border-radius: 8px; color: #6b7280;',
      'font-size: 11px; font-weight: 500; cursor: pointer;',
      'font-family: inherit; text-align: left;',
      'transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;',
    '}',
    '.rds-pc-btn:hover {',
      'background: rgba(168,85,247,0.07);',
      'border-color: rgba(168,85,247,0.20);',
      'color: #c8cdd8;',
    '}',
    '.rds-pc-range { font-size: 9px; opacity: 0.65; font-variant-numeric: tabular-nums; }',
    '.rds-pc-footer {',
      'margin-top: 10px; padding-top: 8px;',
      'border-top: 1px solid rgba(168,85,247,0.07);',
      'font-size: 9px; color: #374151; text-align: center;',
      'letter-spacing: 0.06em;',
    '}',
  ].join(' ');

  /* ── Mount ─────────────────────────────────────────────────────────────── */
  document.head.appendChild(style);
  render();
  document.body.appendChild(panel);
  window.addEventListener('resize', render);
})();
