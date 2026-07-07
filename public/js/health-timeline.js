/* Health Timeline™ — Interactive historical scan browser.
 * Data model: HEALTH_TIMELINE_SCANS → htLoadScan(idx) → DOM update.
 * No API calls at selection time. All 7 scans pre-loaded on page init.
 * Constitutional note: presentation layer only. No business logic.
 */
(function () {
  'use strict';

  var CIRC = 251.3; /* 2π × r40 */

  /* ── 7-day scan history: Jun 27 – Jul 3, 2026 ──────────────────────────
   * breakdown[]  → KPI card order:  Identity · Publishing · Catalog · Change Det. · Footprint · Backend
   * catScores[]  → card grid order: Identity · Publishing · Catalog · Change Det. · Backend · Footprint
   * catPills[]   → same grid order
   * catMovement[]→ same grid order
   */
  var SCANS = [
    /* [0] Jun 27 — Backend connected */
    {
      scanTime: 'Jun 27, 2026 · 9:15 AM',
      healthScore: 71,
      scorePill: { label: 'Good', color: 'blue' },
      trend: '▲ Baseline established',
      athena: [
        'ATHENA completed its first full scan on Jun 27.',
        'Backend connection confirmed — identity and publishing require attention.'
      ],
      breakdown:   [52, 48, 78, 58, 70, 88],
      catScores:   [52, 48, 78, 58, 88, 70],
      catPills: [
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Strong',          color: 'green'  },
        { label: 'Active',          color: 'blue'   },
        { label: 'Strong',          color: 'green'  },
        { label: 'Active',          color: 'blue'   },
      ],
      catMovement: [
        { text: '— First scan',  dir: 'flat' },
        { text: '— First scan',  dir: 'flat' },
        { text: '— First scan',  dir: 'flat' },
        { text: '— First scan',  dir: 'flat' },
        { text: '— First scan',  dir: 'flat' },
        { text: '— First scan',  dir: 'flat' },
      ],
    },
    /* [1] Jun 28 */
    {
      scanTime: 'Jun 28, 2026 · 9:02 AM',
      healthScore: 74,
      scorePill: { label: 'Good', color: 'blue' },
      trend: '▲ 3% from yesterday',
      athena: [
        'ATHENA monitoring cycle clean — minor improvements across all categories.',
        'Identity gap persists — 2 actions recommended.'
      ],
      breakdown:   [55, 52, 82, 61, 73, 91],
      catScores:   [55, 52, 82, 61, 91, 73],
      catPills: [
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Strong',          color: 'green'  },
        { label: 'Active',          color: 'blue'   },
        { label: 'Excellent',       color: 'green'  },
        { label: 'Active',          color: 'blue'   },
      ],
      catMovement: [
        { text: '▲ 3% from Jun 27', dir: 'up' },
        { text: '▲ 4% from Jun 27', dir: 'up' },
        { text: '▲ 4% from Jun 27', dir: 'up' },
        { text: '▲ 3% from Jun 27', dir: 'up' },
        { text: '▲ 3% from Jun 27', dir: 'up' },
        { text: '▲ 3% from Jun 27', dir: 'up' },
      ],
    },
    /* [2] Jun 29 — Catalog verified */
    {
      scanTime: 'Jun 29, 2026 · 8:47 AM',
      healthScore: 78,
      scorePill: { label: 'Strong', color: 'green' },
      trend: '▲ 4% from yesterday',
      athena: [
        'Catalog verification completed — 88 tracks confirmed across registered systems.',
        'Publishing gap narrowing — strong upward trajectory across all monitored sources.'
      ],
      breakdown:   [58, 57, 88, 65, 76, 95],
      catScores:   [58, 57, 88, 65, 95, 76],
      catPills: [
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Strong',          color: 'green'  },
        { label: 'Active',          color: 'blue'   },
        { label: 'Excellent',       color: 'green'  },
        { label: 'Strong',          color: 'green'  },
      ],
      catMovement: [
        { text: '▲ 3% from Jun 28', dir: 'up' },
        { text: '▲ 5% from Jun 28', dir: 'up' },
        { text: '▲ 6% from Jun 28', dir: 'up' },
        { text: '▲ 4% from Jun 28', dir: 'up' },
        { text: '▲ 4% from Jun 28', dir: 'up' },
        { text: '▲ 3% from Jun 28', dir: 'up' },
      ],
    },
    /* [3] Jun 30 */
    {
      scanTime: 'Jun 30, 2026 · 9:11 AM',
      healthScore: 81,
      scorePill: { label: 'Strong', color: 'green' },
      trend: '▲ 3% from yesterday',
      athena: [
        'Publishing intelligence improving — registration gaps partially resolved.',
        'Identity and catalog continuing strong trajectory this cycle.'
      ],
      breakdown:   [61, 60, 93, 68, 78, 97],
      catScores:   [61, 60, 93, 68, 97, 78],
      catPills: [
        { label: 'Active',    color: 'blue'  },
        { label: 'Active',    color: 'blue'  },
        { label: 'Strong',    color: 'green' },
        { label: 'Active',    color: 'blue'  },
        { label: 'Excellent', color: 'green' },
        { label: 'Strong',    color: 'green' },
      ],
      catMovement: [
        { text: '▲ 3% from Jun 29', dir: 'up' },
        { text: '▲ 3% from Jun 29', dir: 'up' },
        { text: '▲ 5% from Jun 29', dir: 'up' },
        { text: '▲ 3% from Jun 29', dir: 'up' },
        { text: '▲ 2% from Jun 29', dir: 'up' },
        { text: '▲ 2% from Jun 29', dir: 'up' },
      ],
    },
    /* [4] Jul 1 */
    {
      scanTime: 'Jul 1, 2026 · 8:58 AM',
      healthScore: 83,
      scorePill: { label: 'Strong', color: 'green' },
      trend: '▲ 2% from yesterday',
      athena: [
        'ATHENA monitoring active — all primary systems performing above threshold.',
        'Publishing action still pending — one registration gap requires your attention.'
      ],
      breakdown:   [63, 62, 96, 71, 80, 98],
      catScores:   [63, 62, 96, 71, 98, 80],
      catPills: [
        { label: 'Active',    color: 'blue'  },
        { label: 'Active',    color: 'blue'  },
        { label: 'Excellent', color: 'green' },
        { label: 'Active',    color: 'blue'  },
        { label: 'Excellent', color: 'green' },
        { label: 'Strong',    color: 'green' },
      ],
      catMovement: [
        { text: '▲ 2% from Jun 30', dir: 'up' },
        { text: '▲ 2% from Jun 30', dir: 'up' },
        { text: '▲ 3% from Jun 30', dir: 'up' },
        { text: '▲ 3% from Jun 30', dir: 'up' },
        { text: '▲ 1% from Jun 30', dir: 'up' },
        { text: '▲ 2% from Jun 30', dir: 'up' },
      ],
    },
    /* [5] Jul 2 */
    {
      scanTime: 'Jul 2, 2026 · 9:03 AM',
      healthScore: 86,
      scorePill: { label: 'Strong', color: 'green' },
      trend: '▲ 3% from yesterday',
      athena: [
        'Near-peak performance across all monitored categories.',
        'One publishing action remains — resolution expected to push Health Score above 90.'
      ],
      breakdown:   [65, 65, 98, 73, 81, 99],
      catScores:   [65, 65, 98, 73, 99, 81],
      catPills: [
        { label: 'Active',    color: 'blue'  },
        { label: 'Active',    color: 'blue'  },
        { label: 'Excellent', color: 'green' },
        { label: 'Active',    color: 'blue'  },
        { label: 'Excellent', color: 'green' },
        { label: 'Strong',    color: 'green' },
      ],
      catMovement: [
        { text: '▲ 2% from Jul 1', dir: 'up' },
        { text: '▲ 3% from Jul 1', dir: 'up' },
        { text: '▲ 2% from Jul 1', dir: 'up' },
        { text: '▲ 2% from Jul 1', dir: 'up' },
        { text: '▲ 1% from Jul 1', dir: 'up' },
        { text: '▲ 1% from Jul 1', dir: 'up' },
      ],
    },
    /* [6] Jul 3 — CURRENT */
    {
      scanTime: 'Today, 8:42 AM',
      healthScore: 89,
      scorePill: { label: 'Strong', color: 'green' },
      trend: '▲ 3% from yesterday',
      athena: [
        'ATHENA is actively monitoring your music business.',
        'This cycle is clean — one Publishing action requires your attention.'
      ],
      breakdown:   [67, 67, 100, 75, 82, 100],
      catScores:   [67, 67, 100, 75, 100, 82],
      catPills: [
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Needs Attention', color: 'purple' },
        { label: 'Strong',          color: 'green'  },
        { label: 'Active',          color: 'blue'   },
        { label: 'Excellent',       color: 'green'  },
        { label: 'Strong',          color: 'green'  },
      ],
      catMovement: [
        { text: '▼ 3% this week', dir: 'down' },
        { text: '▼ 2% this week', dir: 'down' },
        { text: '▲ 8% this week', dir: 'up'   },
        { text: '▲ 2% this week', dir: 'up'   },
        { text: '▲ 5% this week', dir: 'up'   },
        { text: '▲ 3% this week', dir: 'up'   },
      ],
    },
  ];

  var PILL_COLOR_CLASSES = [
    'hi-status-pill--green', 'hi-status-pill--blue',
    'hi-status-pill--purple', 'hi-status-pill--amber', 'hi-status-pill--red',
  ];
  var FILL_COLOR_CLASSES = [
    'hi-cat-progress-fill--green', 'hi-cat-progress-fill--blue',
    'hi-cat-progress-fill--purple', 'hi-cat-progress-fill--amber', 'hi-cat-progress-fill--red',
  ];
  var SCORE_COLOR_CLASSES = [
    'hi-cat-score-num--green', 'hi-cat-score-num--blue',
    'hi-cat-score-num--purple', 'hi-cat-score-num--amber', 'hi-cat-score-num--red',
  ];
  var MOVE_DIR_CLASSES = ['hi-cat-movement--up', 'hi-cat-movement--down', 'hi-cat-movement--flat'];

  var _currentIdx    = 6;
  var _dotOrigClass  = [];
  var _animFrames    = [];

  /* Cancel any running number animations so fast clicking doesn't stack. */
  function _cancelAnimations() {
    _animFrames.forEach(function (id) { cancelAnimationFrame(id); });
    _animFrames = [];
  }

  function _animateNum(el, from, to, dur) {
    var start = null;
    dur = dur || 480;
    function tick(ts) {
      if (!start) start = ts;
      var p    = Math.min((ts - start) / dur, 1);
      var ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * ease);
      if (p < 1) { _animFrames.push(requestAnimationFrame(tick)); }
      else { el.textContent = to; }
    }
    _animFrames.push(requestAnimationFrame(tick));
  }

  function _animateRing(ring, fromScore, toScore) {
    var start = null, dur = 480;
    function tick(ts) {
      if (!start) start = ts;
      var p    = Math.min((ts - start) / dur, 1);
      var ease = 1 - Math.pow(1 - p, 3);
      var v    = fromScore + (toScore - fromScore) * ease;
      ring.style.strokeDasharray = (v / 100 * CIRC).toFixed(1) + ' 252';
      if (p < 1) { _animFrames.push(requestAnimationFrame(tick)); }
      else { ring.style.strokeDasharray = (toScore / 100 * CIRC).toFixed(1) + ' 252'; }
    }
    _animFrames.push(requestAnimationFrame(tick));
  }

  function _applyPill(el, pill) {
    PILL_COLOR_CLASSES.forEach(function (c) { el.classList.remove(c); });
    el.classList.add('hi-status-pill--' + pill.color);
    /* Update the trailing text node that holds the label */
    var nodes = el.childNodes;
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
        nodes[i].textContent = pill.label;
        break;
      }
    }
  }

  function _applyProgressFill(fillEl, score, color) {
    FILL_COLOR_CLASSES.forEach(function (c) { fillEl.classList.remove(c); });
    fillEl.classList.add('hi-cat-progress-fill--' + color);
    fillEl.style.setProperty('--pct', score + '%');
    var bar = fillEl.parentElement;
    if (bar) bar.setAttribute('aria-valuenow', score);
  }

  function _applyScoreNum(el, from, to, color) {
    SCORE_COLOR_CLASSES.forEach(function (c) { el.classList.remove(c); });
    el.classList.add('hi-cat-score-num--' + color);
    _animateNum(el, from, to);
  }

  function htLoadScan(idx) {
    if (idx === _currentIdx) return;
    var scan = SCANS[idx];
    if (!scan) return;

    _cancelAnimations();

    var mainEl      = document.getElementById('ht-main');
    var scoreNumEl  = document.querySelector('.hi-score-ring-num');
    var ringEl      = document.querySelector('.hi-score-ring-progress');
    var fromScore   = parseInt(scoreNumEl.textContent, 10) || 89;

    /* ── Fade out ── */
    mainEl.classList.add('ht-main--fading');

    setTimeout(function () {

      /* Scan date */
      var dateEl = document.getElementById('ht-scan-date');
      if (dateEl) dateEl.textContent = scan.scanTime;

      /* Historical scan banner */
      var bannerEl = document.getElementById('ht-history-banner');
      if (bannerEl) {
        if (idx < SCANS.length - 1) {
          document.getElementById('ht-history-banner-date').textContent = ' — ' + scan.scanTime;
          bannerEl.hidden = false;
        } else {
          bannerEl.hidden = true;
        }
      }

      /* Health score — ring + number animate together */
      document.querySelector('.hi-score-ring-wrap')
        .setAttribute('aria-label', 'Health score: ' + scan.healthScore + ' out of 100');
      _animateRing(ringEl, fromScore, scan.healthScore);
      _animateNum(scoreNumEl, fromScore, scan.healthScore);

      /* Overall status pill */
      var scorePillEl = document.querySelector('.hi-kpi-card--score .hi-score-meta-row .hi-status-pill');
      if (scorePillEl) _applyPill(scorePillEl, scan.scorePill);

      /* Trend */
      var trendEl = document.querySelector('.hi-kpi-trend');
      if (trendEl) trendEl.textContent = scan.trend;

      /* ATHENA summary */
      var athenaEls = document.querySelectorAll('.hi-kpi-athena-brief');
      for (var a = 0; a < athenaEls.length && a < scan.athena.length; a++) {
        athenaEls[a].textContent = scan.athena[a];
      }

      /* KPI breakdown values */
      var bvalEls = document.querySelectorAll('.hi-kpi-breakdown-val');
      for (var b = 0; b < bvalEls.length && b < scan.breakdown.length; b++) {
        _animateNum(bvalEls[b], parseInt(bvalEls[b].textContent, 10) || 0, scan.breakdown[b]);
      }

      /* Category cards (grid order: Identity · Publishing · Catalog · ChangeDet · Backend · Footprint) */
      var catScoreEls = document.querySelectorAll('a.hi-cat-card .hi-cat-score-num');
      var catFillEls  = document.querySelectorAll('a.hi-cat-card .hi-cat-progress-fill');
      var catPillEls  = document.querySelectorAll('a.hi-cat-card .hi-status-pill');
      var catMoveEls  = document.querySelectorAll('a.hi-cat-card .hi-cat-movement');

      for (var c = 0; c < scan.catScores.length; c++) {
        var pill = scan.catPills[c];
        if (catScoreEls[c]) {
          _applyScoreNum(catScoreEls[c], parseInt(catScoreEls[c].textContent, 10) || 0, scan.catScores[c], pill.color);
        }
        if (catFillEls[c])  { _applyProgressFill(catFillEls[c], scan.catScores[c], pill.color); }
        if (catPillEls[c])  { _applyPill(catPillEls[c], pill); }
        if (catMoveEls[c]) {
          var mv = scan.catMovement[c];
          MOVE_DIR_CLASSES.forEach(function (cl) { catMoveEls[c].classList.remove(cl); });
          catMoveEls[c].classList.add('hi-cat-movement--' + mv.dir);
          catMoveEls[c].textContent = mv.text;
        }
      }

      /* ── Fade back in ── */
      mainEl.classList.remove('ht-main--fading');
      _currentIdx = idx;

    }, 190);

    _updateDots(idx);
  }

  function _updateDots(activeIdx) {
    var dots = document.querySelectorAll('.ht-scan-dot');
    dots.forEach(function (dot, i) {
      dot.className = _dotOrigClass[i];
      if (i === activeIdx && i !== SCANS.length - 1) {
        dot.classList.remove('hi-timeline-dot--active', 'hi-timeline-dot--event');
        dot.classList.add('hi-timeline-dot--selected');
      }
    });
  }

  function _init() {
    var dots = document.querySelectorAll('.ht-scan-dot');
    if (!dots.length) return;

    dots.forEach(function (dot, idx) {
      _dotOrigClass[idx] = dot.className;
      dot.addEventListener('click', function () { htLoadScan(idx); });
      dot.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); htLoadScan(idx); }
      });
    });

    /* Wire "Return to current" on the banner */
    var returnBtn = document.getElementById('ht-history-return');
    if (returnBtn) {
      returnBtn.addEventListener('click', function () { htLoadScan(6); });
    }
  }

  document.addEventListener('DOMContentLoaded', _init);

})();
