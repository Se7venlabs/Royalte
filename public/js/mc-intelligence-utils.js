/* Royaltē Mission Control™ — Intelligence Rendering Utilities v1.0
 * Single source of truth for score interpretation across all MC workspaces.
 * A score of 82 means the same thing everywhere in Mission Control™.
 *
 * Load synchronously before any workspace wiring script:
 *   <script src="/js/mc-intelligence-utils.js"></script>
 *
 * Exposes: window.RoyalteIntel
 */
(function (global) {
  'use strict';

  /* Score → color band. First match wins. */
  var COLOR_BANDS = [
    { min: 80, color: 'green'  },
    { min: 60, color: 'blue'   },
    { min: 40, color: 'orange' },
    { min:  0, color: 'purple' },
  ];

  /* Score → status label. First match wins. */
  var LABEL_THRESHOLDS = [
    { min: 100, label: 'Excellent'       },
    { min:  80, label: 'Strong'          },
    { min:  60, label: 'Good'            },
    { min:  40, label: 'Moderate'        },
    { min:   1, label: 'Needs Attention' },
    { min:   0, label: 'Critical'        },
  ];

  function scoreColor(s) {
    var n = Math.round(Number(s) || 0);
    for (var i = 0; i < COLOR_BANDS.length; i++) {
      if (n >= COLOR_BANDS[i].min) return COLOR_BANDS[i].color;
    }
    return 'purple';
  }

  function scoreLabel(s) {
    var n = Math.round(Number(s) || 0);
    for (var i = 0; i < LABEL_THRESHOLDS.length; i++) {
      if (n >= LABEL_THRESHOLDS[i].min) return LABEL_THRESHOLDS[i].label;
    }
    return 'Critical';
  }

  /*
   * Sets a .hi-status-pill element: updates class, label text, and re-inserts
   * the .hi-status-dot child (textContent clears children; dot is preserved).
   *
   * labelOverride — supply to bypass scoreLabel (e.g. "Baseline Established").
   */
  function setPill(el, score, labelOverride) {
    if (!el) return;
    var col = scoreColor(score);
    var lbl = (labelOverride != null && labelOverride !== '') ? labelOverride : scoreLabel(score);
    var dot = el.querySelector('.hi-status-dot');
    el.className = 'hi-status-pill hi-status-pill--' + col;
    el.textContent = lbl;
    if (dot) el.prepend(dot);
  }

  /*
   * Updates a progress fill element and its ARIA container.
   *
   * fillEl    — the colored fill div
   * progEl    — the progress container (receives aria-valuenow)
   * score     — 0–100
   * baseClass — CSS base class without color modifier, e.g. 'hi-cat-progress-fill'
   *             Pass null to skip className update (when only --pct matters).
   */
  function setProgressFill(fillEl, progEl, score, baseClass) {
    var s = Math.round(Number(score) || 0);
    var col = scoreColor(s);
    if (fillEl) {
      fillEl.style.setProperty('--pct', s + '%');
      if (baseClass) fillEl.className = baseClass + ' ' + baseClass + '--' + col;
    }
    if (progEl) progEl.setAttribute('aria-valuenow', String(s));
  }

  /*
   * Returns the strokeDasharray value for an SVG ring arc.
   * Clamps score to 0–100.
   *
   * Usage: ringArc.style.strokeDasharray = RI.ringArcDasharray(score, RI.RING_CIRC_R40);
   */
  function ringArcDasharray(score, circumference) {
    var s = Math.max(0, Math.min(100, Number(score) || 0));
    return (s / 100 * circumference).toFixed(1) + ' ' + Math.ceil(circumference);
  }

  /*
   * Reads royalte_workspace_context from sessionStorage.
   * Returns {} on missing key or parse error — never throws.
   */
  function readContext() {
    try {
      return JSON.parse(sessionStorage.getItem('royalte_workspace_context') || '{}');
    } catch (_) {
      return {};
    }
  }

  global.RoyalteIntel = {
    scoreColor:       scoreColor,
    scoreLabel:       scoreLabel,
    setPill:          setPill,
    setProgressFill:  setProgressFill,
    ringArcDasharray: ringArcDasharray,
    readContext:      readContext,
    RING_CIRC_R40:    251.327,   /* 2π × 40 */
    RING_CIRC_R36:    226.195,   /* 2π × 36 */
  };

}(window));
