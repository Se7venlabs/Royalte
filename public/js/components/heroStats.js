// Hero card: animated score-ring fill + 3-stat row.
// The HTML markup is static in dashboard.html; this just sets the ring stroke
// + the score number.
import { $ } from '../utils/dom.js';
import { SCAN_SUMMARY } from '../data/summary.js';

export function renderHeroStats() {
  const ring = $('#scoreRing');
  const num  = $('#scoreNumber');
  if (!ring || !num) return;
  const score = SCAN_SUMMARY.overallScore;
  const circumference = 2 * Math.PI * 52; // matches r=52 in SVG
  const offset = circumference - (score / 100) * circumference;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = offset;
  num.textContent = score;
}
