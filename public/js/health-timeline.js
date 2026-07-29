/* Health Timeline™ — Phase 2 (Board directive, 2026-07-29): the timeline
 * dots previously loaded 7 entirely fictional scan records (hardcoded
 * scores, ATHENA briefs, category breakdowns for "Jun 27 - Jul 3, 2026")
 * and overwrote the real, live scan's data on screen with them -- with no
 * code path back to real data short of a full page reload, even via
 * "Return to Current". Confirmed a genuine architectural gap, not a
 * simple wiring fix: Historical Health Snapshots™ (real per-scan history)
 * does not exist anywhere in the system yet (governance/ROADMAP.md: "Health
 * Trend sparkline shows current scan only... wiring is deferred"). Per the
 * FIX AS WE GO™ policy's own exception for a genuine architectural
 * dependency, this is formally documented as blocked rather than built
 * here, and the dangerous behavior is removed rather than left live: the
 * dots remain visually present (not a redesign) but are now inert and
 * honestly say so when clicked, instead of corrupting the real scan's
 * displayed data.
 */
(function () {
  'use strict';

  function _showComingSoon(btn) {
    var msg = document.getElementById('ht-coming-soon-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'ht-coming-soon-msg';
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');
      msg.style.cssText = 'font-size:11px;color:rgba(200,195,230,0.6);margin-top:6px;text-align:center';
      var timeline = document.querySelector('.hi-timeline-card') || (btn && btn.closest('.hi-kpi-card')) || document.body;
      timeline.appendChild(msg);
    }
    msg.textContent = 'Historical Health Snapshots™ — Coming Soon. This scan’s real data is shown above.';
  }

  function _init() {
    var btns = document.querySelectorAll('.ht-scan-btn');
    if (!btns.length) return;

    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () { _showComingSoon(btn); });
    });

    /* "Return to current" only ever needs to hide the (never-shown) banner
       and clear the message -- no real data is ever swapped out now. */
    var returnBtn = document.getElementById('ht-history-return');
    if (returnBtn) {
      returnBtn.addEventListener('click', function () {
        var banner = document.getElementById('ht-history-banner');
        if (banner) banner.hidden = true;
        var msg = document.getElementById('ht-coming-soon-msg');
        if (msg) msg.textContent = '';
      });
    }
  }

  /* Script is at bottom of <body> -- DOM is ready. No DOMContentLoaded needed. */
  _init();

})();
