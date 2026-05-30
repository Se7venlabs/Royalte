/* ═══════════════════════════════════════════════════════════════════
   ROYALTĒ MISSION CONTROL — render layer (Brief 015)

   Replaces the V1 dashboard.js entirely. Populates the 9-card grid
   in public/dashboard.html. Auth / session / Supabase wiring is
   preserved verbatim from the V1 dashboard (loadLatestScan,
   loadProfile, wireSignOut, checkAdminStatus, getSyntheticProfile,
   activateTrialIfNeeded, renderTrialBanner, loadReservation,
   renderPricing, wireReservationFlow, handleReserveClick,
   wireLockCTAs, fillConfirmedState, _countActionNeededAlerts).

   SINGLE SOURCE OF TRUTH (LOCKED): health_score is read from
   scan_snapshots only. computeV2HealthScore() in
   api/_lib/persist-os-scan.js is the only place it's computed.
   No render function recomputes the score.

   Removed in this rebuild:
     · components/backend-protection.js — folded into Cards 2 + 5
     · All V1 reword tables (EXACT_REWORDS, PATTERN_REWORDS, etc.)
     · mapCanonicalToDashboard / renderAll — V1 surface, deleted
     · V1 helpers (tierClass, severityLabel, getBackendConfidence, etc.)
   ═══════════════════════════════════════════════════════════════════ */

import { getSupabase } from '/js/supabase-client.js';

/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function formatScanDateShort(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  } catch { return '—'; }
}

function formatMemberSince(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
  } catch { return '—'; }
}

function relativeTimePast(date) {
  const ms = Date.now() - date.getTime();
  if (ms < 36e5) return 'less than an hour ago';
  const hours = Math.floor(ms / 36e5);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? '1 day ago' : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

function relativeTimeFuture(date) {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return 'soon';
  const days = Math.ceil(ms / 864e5);
  return days === 1 ? 'in 1 day' : `in ${days} days`;
}

// Short relative time for the Intelligence Feed (e.g. "2h", "3d").
function relativeTimeShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const ms = Date.now() - d.getTime();
  if (ms < 60e3) return 'just now';
  if (ms < 36e5) return `${Math.floor(ms / 60e3)}m`;
  if (ms < 864e5) return `${Math.floor(ms / 36e5)}h`;
  if (ms < 30 * 864e5) return `${Math.floor(ms / 864e5)}d`;
  return `${Math.floor(ms / (30 * 864e5))}mo`;
}

// Score → band label + CSS class suffix.
function _healthBand(score) {
  if (score >= 90) return { label: 'Excellent',          cls: 'band-excellent' };
  if (score >= 75) return { label: 'Strong',             cls: 'band-strong'    };
  if (score >= 60) return { label: 'Moderate',           cls: 'band-moderate'  };
  return                  { label: 'Review Recommended', cls: 'band-review'    };
}

// SVG sparkline polyline. Values is an array of numbers, all 0–100.
// Returns SVG path "d" attribute fitting a 200×32 viewBox by default.
function _sparkPath(values, opts = {}) {
  const w = opts.width  || 200;
  const h = opts.height || 32;
  if (!Array.isArray(values) || values.length === 0) return '';
  if (values.length === 1) {
    const y = h - (values[0] / 100) * h;
    return `M 0 ${y} L ${w} ${y}`;
  }
  const step = w / (values.length - 1);
  return values.map((v, i) => {
    const x = i * step;
    const y = h - (clamp(v, 0, 100) / 100) * h;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// Donut CSS conic-gradient — purple fill for `pct`% of the ring,
// dim background for the rest.
function _donutGradient(pct) {
  const deg = clamp(pct, 0, 100) * 3.6;
  return `conic-gradient(var(--pur-2) 0deg ${deg}deg,rgba(255,255,255,0.05) ${deg}deg)`;
}

// Intelligence Feed display mapper — change_type + alert → user-facing.
// LOCKED LANGUAGE per Brief 015: song-first, never system language.
function _feedDisplay(alert) {
  const trackName = alert.track_name || alert.artist_name || 'Your catalog';
  const territory = alert.territory ? String(alert.territory).toUpperCase() : '';
  const platform  = alert.platform || '';
  const t = alert.change_type;

  const out = { title: '', sub: '', iconClass: 'is-purple', iconName: 'ti-music' };
  switch (t) {
    case 'territory_loss':
      out.title = `${trackName} — No longer available in ${territory || 'a territory'}`;
      out.sub = platform || 'territory change';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-world';
      break;
    case 'territory_gain':
      out.title = `${trackName} — Now available in ${territory || 'a new territory'}`;
      out.sub = platform || 'territory change';
      out.iconClass = 'is-green';
      out.iconName = 'ti-world';
      break;
    case 'isrc_dropped':
      out.title = `${trackName} — Identifier signal changed`;
      out.sub = 'ISRC no longer detected from reviewed sources';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-key';
      break;
    case 'isrc_added':
      out.title = `${trackName} — Identifier verified`;
      out.sub = 'ISRC confirmed';
      out.iconClass = 'is-green';
      out.iconName = 'ti-key';
      break;
    case 'isrc_mismatch':
      out.title = `${trackName} — Identifier mismatch noted`;
      out.sub = 'Cross-source ISRC values differ';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-key';
      break;
    case 'release_added':
      out.title = `${trackName} — New release detected`;
      out.sub = platform || 'release';
      out.iconClass = 'is-purple';
      out.iconName = 'ti-music';
      break;
    case 'release_removed':
      out.title = `${trackName} — Release no longer detected`;
      out.sub = platform || 'release';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-music';
      break;
    case 'video_added':
      out.title = `${trackName} — YouTube match verified`;
      out.sub = 'YouTube';
      out.iconClass = 'is-green';
      out.iconName = 'ti-video';
      break;
    case 'video_removed':
      out.title = `${trackName} — YouTube match no longer detected`;
      out.sub = 'YouTube';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-video';
      break;
    case 'metadata_changed':
      out.title = `${trackName} — Metadata change detected`;
      out.sub = platform || 'metadata';
      out.iconClass = 'is-amber';
      out.iconName = 'ti-database';
      break;
    case 'baseline_established':
      out.title = 'Baseline established — monitoring now active';
      out.sub = 'Royaltē OS';
      out.iconClass = 'is-green';
      out.iconName = 'ti-file-check';
      break;
    default:
      out.title = `${trackName} — Change detected`;
      out.sub = platform || territory || '';
  }
  return out;
}

/* ─────────────────────────────────────────────
   LOADERS — preserved + new (V2 only)
   ───────────────────────────────────────────── */

// PRESERVED. Reads scan_snapshots latest by sequence_number, falls
// back to audit_scans for users without a snapshot yet.
async function loadLatestScan(supabase, userId) {
  const { data: snapshots, error } = await supabase
    .from('scan_snapshots')
    .select('id, payload, created_at, sequence_number, health_score, score_breakdown, scanned_at, artist_id, artist_name')
    .eq('user_id', userId)
    .order('sequence_number', { ascending: false })
    .limit(1);
  if (error) console.error('[mc] snapshot fetch failed', error);
  if (snapshots && snapshots.length) return snapshots[0];

  const { data: scans, error: scanErr } = await supabase
    .from('audit_scans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (scanErr) {
    console.error('[mc] scan fetch failed', scanErr);
    return null;
  }
  return (scans && scans.length) ? scans[0] : null;
}

// PRESERVED + EXTENDED. Now selects founding_artist_number + created_at
// for the sidebar Founding Artist badge (Brief 015 Flag A1).
async function loadProfile(supabase, userId) {
  const fallback = {
    tier: 'free',
    monitoring_status: 'inactive',
    next_rescan_at: null,
    trial_started_at: null,
    founding_artist: false,
    founding_artist_number: null,
    created_at: null,
  };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tier, monitoring_status, next_rescan_at, trial_started_at, founding_artist, founding_artist_number, created_at')
      .eq('id', userId)
      .single();
    if (error || !data) return fallback;
    return data;
  } catch (e) {
    console.error('[mc] profile read failed', e);
    return fallback;
  }
}

// PRESERVED. Founding Artist reservation row.
async function loadReservation(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('founding_artist_reservations')
      .select('email, created_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) { console.error('[mc] reservation read failed', error); return null; }
    return data || null;
  } catch (e) {
    console.error('[mc] reservation read failed', e);
    return null;
  }
}

// PRESERVED. Unresolved action_needed count for Card 5 (and the old
// sidebar nav badge; that badge is gone in MC but the count is still
// surfaced in the Action Center card subtitle).
async function _countActionNeededAlerts(supabase, userId) {
  try {
    const { count, error } = await supabase
      .from('monitoring_alerts')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .eq('resolved', false)
      .eq('severity', 'action_needed');
    if (error) { console.error('[mc] action count failed', error); return 0; }
    return count || 0;
  } catch (e) { console.error('[mc] action count failed', e); return 0; }
}

// NEW — count of unresolved 'monitor' alerts (Opportunities row on Card 2).
async function _countMonitorAlerts(supabase, userId) {
  try {
    const { count, error } = await supabase
      .from('monitoring_alerts')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .eq('resolved', false)
      .eq('severity', 'monitor');
    if (error) { console.error('[mc] monitor count failed', error); return 0; }
    return count || 0;
  } catch (e) { console.error('[mc] monitor count failed', e); return 0; }
}

// NEW — full scan_snapshots history for the user, oldest first.
// Used by Card 1 (sparkline) and Card 4 (Journey baseline/current/delta).
async function loadScanHistory(supabase, userId) {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('id, health_score, scanned_at')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: true })
    .limit(50);
  if (error) { console.error('[mc] history fetch failed', error); return []; }
  return data || [];
}

// NEW — recent monitoring_alerts for the Intelligence Feed (Card 3).
async function loadAlertFeed(supabase, userId, limit = 5) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('change_type, severity, track_name, artist_name, territory, platform, detected_at, title, detail')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[mc] feed fetch failed', error); return []; }
  return data || [];
}

// NEW — unresolved action_needed alerts for Card 5 list (up to 3).
async function loadActionItems(supabase, userId, limit = 3) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('title, detail, severity, change_type')
    .eq('user_id', userId)
    .eq('resolved', false)
    .in('severity', ['action_needed', 'monitor'])
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[mc] action items fetch failed', error); return []; }
  return data || [];
}

// NEW — totals for Card 9 Monitoring Overview.
async function loadAlertOverview(supabase, userId) {
  const out = { total: 0, resolved: 0 };
  try {
    const totalResp = await supabase
      .from('monitoring_alerts')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId);
    out.total = totalResp.count || 0;

    const resolvedResp = await supabase
      .from('monitoring_alerts')
      .select('id', { head: true, count: 'exact' })
      .eq('user_id', userId)
      .eq('resolved', true);
    out.resolved = resolvedResp.count || 0;
  } catch (e) { console.error('[mc] alert overview failed', e); }
  return out;
}

// NEW — monitoring_subscriptions.active for Card 2 row 1.
async function loadMonitoringActive(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('monitoring_subscriptions')
      .select('active')
      .eq('user_id', userId)
      .limit(1);
    if (error || !data || !data.length) return false;
    return data[0].active === true;
  } catch (e) { console.error('[mc] monitoring active fetch failed', e); return false; }
}

// NEW — earliest scan_snapshot row's matching audit_scans pdf_url for
// Card 8 Baseline Review. Best-effort: returns null if the older
// snapshot has no matching audit_scans row, which is common for V2
// re-scans where only the first audit_scans row carries pdf_url.
async function loadBaselinePdf(supabase, baselineSnapshot) {
  if (!baselineSnapshot) return null;
  try {
    // Most recent ready PDF for this user — usually the baseline since
    // PDFs are only generated via submit-audit (one per scan).
    const { data } = await supabase
      .from('audit_scans')
      .select('pdf_url, pdf_status, created_at')
      .eq('pdf_status', 'ready')
      .order('created_at', { ascending: true })
      .limit(1);
    if (data && data.length) return data[0].pdf_url || null;
  } catch (e) { console.error('[mc] baseline pdf fetch failed', e); }
  return null;
}

/* ─────────────────────────────────────────────
   RENDERERS — Mission Control
   ───────────────────────────────────────────── */

function renderMcTopBar(artistName, scanDate) {
  const nameEl = document.getElementById('tb-artist-name');
  if (nameEl) nameEl.textContent = artistName || 'Artist';
  const lastEl = document.getElementById('tb-last-scan');
  if (lastEl) lastEl.textContent = scanDate ? relativeTimePast(new Date(scanDate)) : '—';
}

function renderMcSidebar(profile) {
  // Active state: Mission Control on load (set by the .is-active class
  // in the HTML). Sidebar nav click → set active state via hash routing
  // is a follow-up; for now nav items are passive links.
  const faBox     = document.getElementById('sb-fa');
  const faNumEl   = document.getElementById('sb-fa-num');
  const faSinceEl = document.getElementById('sb-fa-since');
  if (!faBox) return;
  if (profile && profile.founding_artist === true) {
    faBox.style.display = '';
    if (faNumEl) faNumEl.textContent = profile.founding_artist_number != null ? `#${profile.founding_artist_number}` : '';
    if (faSinceEl) faSinceEl.textContent = `Member Since ${formatMemberSince(profile.created_at)}`;
  } else {
    faBox.style.display = 'none';
  }
}

// CARD 1 — Royaltē Health Score™
function renderMcHealth(scan, history) {
  const current = (scan && typeof scan.health_score === 'number') ? scan.health_score : null;
  const baseline = (history && history.length > 0 && typeof history[0].health_score === 'number')
    ? history[0].health_score : null;
  const delta = (current != null && baseline != null) ? (current - baseline) : null;

  const numEl    = document.getElementById('mc-score-num');
  const circleEl = document.getElementById('mc-score-circle');
  const bandEl   = document.getElementById('mc-score-band');
  const descEl   = document.getElementById('mc-score-desc');
  const deltaEl  = document.getElementById('mc-score-delta');
  const sparkEl  = document.getElementById('mc-spark-health');

  if (current == null) {
    if (numEl)  numEl.textContent = '—';
    if (bandEl) bandEl.textContent = 'Awaiting first scan';
    if (descEl) descEl.textContent = 'Your Health Score appears after your first scan.';
    if (deltaEl) deltaEl.innerHTML = '<i class="ti ti-minus"></i><span>—</span>';
    return;
  }

  const band = _healthBand(current);
  if (numEl)  numEl.textContent = String(current);
  if (circleEl) {
    circleEl.classList.remove('band-excellent','band-strong','band-moderate','band-review');
    circleEl.classList.add(band.cls);
  }
  if (bandEl) {
    bandEl.textContent = band.label;
    bandEl.classList.remove('band-excellent','band-strong','band-moderate','band-review');
    bandEl.classList.add(band.cls);
  }
  if (descEl) descEl.textContent = 'Your music business backend health, computed from verified sources.';

  if (deltaEl) {
    if (delta == null || history.length < 2) {
      deltaEl.className = 'mc-score-delta is-neutral';
      deltaEl.innerHTML = '<i class="ti ti-minus"></i><span>Baseline established</span>';
    } else if (delta > 0) {
      deltaEl.className = 'mc-score-delta';
      deltaEl.innerHTML = `<i class="ti ti-trending-up"></i><span>+${delta} points since baseline</span>`;
    } else if (delta < 0) {
      deltaEl.className = 'mc-score-delta is-down';
      deltaEl.innerHTML = `<i class="ti ti-trending-down"></i><span>${delta} points since baseline</span>`;
    } else {
      deltaEl.className = 'mc-score-delta is-neutral';
      deltaEl.innerHTML = '<i class="ti ti-equal"></i><span>0 points since baseline</span>';
    }
  }

  if (sparkEl) {
    const values = (history && history.length)
      ? history.map(h => typeof h.health_score === 'number' ? h.health_score : 0)
      : [current];
    sparkEl.innerHTML =
      `<path d="${_sparkPath(values)}" stroke="var(--pur-2)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />` +
      `<circle cx="200" cy="${(32 - (current/100)*32).toFixed(1)}" r="2.5" fill="var(--pur-2)" />`;
    sparkEl.setAttribute('preserveAspectRatio', 'none');
  }
}

// CARD 2 — Backend Status
function renderMcBackendStatus({ monitoringActive, criticalCount, opportunitiesCount }) {
  const list = document.getElementById('mc-status-list');
  if (!list) return;

  const rows = [];

  rows.push(`
    <div class="mc-status-row">
      <div class="mc-status-dot${monitoringActive ? '' : ' is-amber'}">
        <i class="ti ${monitoringActive ? 'ti-check' : 'ti-alert-triangle'}"></i>
      </div>
      <div class="mc-status-text">
        <div class="mc-status-title">${monitoringActive ? 'Monitoring Active' : 'Monitoring Paused'}</div>
        <div class="mc-status-sub">${monitoringActive ? 'Your backend is being monitored 24/7' : 'Continuous monitoring is currently paused'}</div>
      </div>
    </div>
  `);

  if (criticalCount > 0) {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot is-red"><i class="ti ti-alert-circle"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">${criticalCount} Critical Issue${criticalCount === 1 ? '' : 's'}</div>
          <div class="mc-status-sub">Requires attention</div>
        </div>
      </div>
    `);
  } else {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot"><i class="ti ti-check"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">No Critical Issues</div>
          <div class="mc-status-sub">No problems detected</div>
        </div>
      </div>
    `);
  }

  if (opportunitiesCount > 0) {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot is-amber"><i class="ti ti-bulb"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">${opportunitiesCount} Opportunit${opportunitiesCount === 1 ? 'y' : 'ies'}</div>
          <div class="mc-status-sub">Review recommended</div>
        </div>
      </div>
    `);
  } else {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot"><i class="ti ti-check"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">No Opportunities</div>
          <div class="mc-status-sub">Nothing to review right now</div>
        </div>
      </div>
    `);
  }

  list.innerHTML = rows.join('');
}

// CARD 3 — Intelligence Feed
function renderMcFeed(alerts) {
  const list = document.getElementById('mc-feed-list');
  if (!list) return;
  if (!alerts || alerts.length === 0) {
    list.innerHTML = `<div class="mc-feed-empty">Your backend is being watched. Royaltē will surface activity here as it's detected.</div>`;
    return;
  }
  list.innerHTML = alerts.map((a) => {
    const d = _feedDisplay(a);
    const when = relativeTimeShort(a.detected_at);
    return `
      <div class="mc-feed-item">
        <div class="mc-feed-icon ${escapeHtml(d.iconClass)}"><i class="ti ${escapeHtml(d.iconName)}"></i></div>
        <div class="mc-feed-body">
          <div class="mc-feed-title">${escapeHtml(d.title)}</div>
          <div class="mc-feed-sub">${escapeHtml(d.sub)}</div>
        </div>
        <div class="mc-feed-time">${escapeHtml(when)}</div>
      </div>
    `;
  }).join('');
}

// CARD 4 — Backend Health Journey™
function renderMcJourney(history) {
  const body = document.getElementById('mc-journey-body');
  if (!body) return;
  if (!history || history.length === 0) {
    body.innerHTML = `<div class="mc-journey-empty">Awaiting your first scan to establish a baseline.</div>`;
    return;
  }
  if (history.length < 2) {
    body.innerHTML = `<div class="mc-journey-empty">Baseline established. Score progress appears after your next scan.</div>`;
    return;
  }
  const baseline = history[0].health_score ?? 0;
  const current  = history[history.length - 1].health_score ?? 0;
  const delta    = current - baseline;
  const deltaCls = delta > 0 ? '' : 'is-neutral';
  const deltaIcon = delta > 0 ? 'ti-trending-up' : (delta < 0 ? 'ti-trending-down' : 'ti-equal');
  const deltaTxt = delta > 0 ? `↑ ${delta} Points Improved`
                 : delta < 0 ? `${delta} Points Changed`
                 : '0 Points · Holding';
  const values = history.map(h => typeof h.health_score === 'number' ? h.health_score : 0);

  body.innerHTML = `
    <div class="mc-journey-row">
      <div class="mc-journey-baseline">
        <div class="mc-journey-num">${baseline}</div>
        <div class="mc-journey-lbl">Baseline</div>
      </div>
      <span class="mc-journey-arrow"><i class="ti ti-arrow-right"></i></span>
      <div class="mc-journey-current">
        <div class="mc-journey-num">${current}</div>
        <div class="mc-journey-lbl">Current</div>
      </div>
      <span class="mc-journey-badge ${deltaCls}"><i class="ti ${deltaIcon}"></i>${escapeHtml(deltaTxt)}</span>
    </div>
    <svg class="mc-journey-chart" viewBox="0 0 320 80" preserveAspectRatio="none" aria-hidden="true">
      <path d="${_sparkPath(values, { width: 320, height: 64 })}"
        stroke="var(--pur-2)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="320" cy="${(64 - (current/100)*64).toFixed(1)}" r="3" fill="var(--pur-2)" />
    </svg>
  `;
}

// CARD 5 — Action Center
function renderMcActionCenter({ items, totalCount }) {
  const countEl = document.getElementById('mc-action-count');
  const listEl  = document.getElementById('mc-action-list');
  if (!countEl || !listEl) return;

  if (totalCount === 0) {
    countEl.className = 'mc-action-count is-good';
    countEl.textContent = 'Nothing requires attention right now';
    listEl.innerHTML = `<div class="mc-action-empty">You're in good shape. Royaltē has not detected any issues requiring action. Monitoring continues.</div>`;
    return;
  }

  countEl.className = 'mc-action-count';
  countEl.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'} need your attention`;

  listEl.innerHTML = items.map((it) => {
    const sev = it.severity || 'monitor';
    return `
      <div class="mc-action-item sev-${escapeHtml(sev)}">
        <div class="mc-action-row1">
          <div class="mc-action-title">${escapeHtml(it.title || 'Action needed')}</div>
          <span class="mc-action-badge sev-${escapeHtml(sev)}">${sev === 'action_needed' ? 'Action' : (sev === 'monitor' ? 'Monitor' : 'Info')}</span>
        </div>
        <div class="mc-action-sub">${escapeHtml(it.detail || '')}</div>
      </div>
    `;
  }).join('');
}

// CARD 6 — Intelligence Profile
function renderMcIntelligenceProfile(scan) {
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const sources = ['appleMusic','spotify','youtube','musicbrainz','discogs','lastfm'];
  const verifiedCount = sources.filter(k => p[k]?.availability === 'VERIFIED').length;
  const pct = (verifiedCount / sources.length) * 100;

  let confidence;
  if (verifiedCount >= 3) confidence = 'High';
  else if (verifiedCount >= 2) confidence = 'Moderate';
  else confidence = 'Limited';

  const donut    = document.getElementById('mc-donut');
  const labelEl  = document.getElementById('mc-donut-label');
  const pubEl    = document.getElementById('mc-profile-public');
  const privEl   = document.getElementById('mc-profile-private');
  const pointsEl = document.getElementById('mc-profile-points');
  const updEl    = document.getElementById('mc-profile-updated');

  if (donut)   donut.style.background = _donutGradient(pct);
  if (labelEl) labelEl.textContent = confidence;
  if (pubEl)   pubEl.textContent  = `${verifiedCount} / 6`;
  if (privEl)  privEl.textContent = '0 / 7';
  if (pointsEl) {
    // Rough data-points count — sum of non-empty canonical platform details.
    const fields = sources.reduce((n, k) => n + (p[k]?.details ? Object.keys(p[k].details).length : 0), 0);
    pointsEl.textContent = String(fields);
  }
  if (updEl) updEl.textContent = scan?.scanned_at ? relativeTimePast(new Date(scan.scanned_at)) : '—';
}

// CARD 7 — Global Presence (BIG 6 storefront grid)
const BIG6 = [
  { code:'us', name:'USA',       flag:'🇺🇸' },
  { code:'ca', name:'Canada',    flag:'🇨🇦' },
  { code:'gb', name:'UK',        flag:'🇬🇧' },
  { code:'de', name:'Germany',   flag:'🇩🇪' },
  { code:'fr', name:'France',    flag:'🇫🇷' },
  { code:'jp', name:'Japan',     flag:'🇯🇵' },
  { code:'au', name:'Australia', flag:'🇦🇺' },
];

function renderMcGlobalPresence(scan) {
  const sfa = scan?.payload?.platforms?.appleMusic?.details?.storefrontAvailability;
  const grid = document.getElementById('mc-flag-grid');
  const subEl = document.getElementById('mc-presence-sub');
  if (!grid) return;

  let verifiedN = 0;
  const cells = BIG6.map(sf => {
    const ent = sfa ? sfa[sf.code] : null;
    let cls = '';
    if (!ent || ent.error) cls = '';
    else {
      const avail = Array.isArray(ent.available) ? ent.available.length : 0;
      const unavail = Array.isArray(ent.unavailable) ? ent.unavailable.length : 0;
      if (avail > 0 && unavail === 0) { cls = 'is-verified'; verifiedN++; }
      else if (avail > 0)             { cls = 'is-partial'; verifiedN++; }
      else                             { cls = 'is-unavail'; }
    }
    return `<div class="mc-flag-cell ${cls}"><div class="mc-flag-emoji">${sf.flag}</div><div class="mc-flag-name">${escapeHtml(sf.name)}</div></div>`;
  }).join('');
  grid.innerHTML = cells;
  if (subEl) subEl.textContent = `${verifiedN} of 7 regions verified`;
}

// CARD 8 — Baseline Review
function renderMcBaselineReview({ baseline, pdfUrl }) {
  const dateEl  = document.getElementById('mc-baseline-date');
  const numEl   = document.getElementById('mc-baseline-num');
  const pdfBtn  = document.getElementById('mc-baseline-pdf');
  const viewBtn = document.getElementById('mc-baseline-view');

  if (!baseline) {
    if (dateEl) dateEl.textContent = 'No baseline yet';
    if (numEl)  numEl.textContent = '—';
    if (pdfBtn) { pdfBtn.removeAttribute('href'); pdfBtn.style.opacity = '0.5'; pdfBtn.style.pointerEvents = 'none'; }
    return;
  }
  if (dateEl) dateEl.textContent = `Generated ${formatScanDateShort(baseline.scanned_at)}`;
  if (numEl)  numEl.textContent = String(baseline.health_score ?? '—');
  if (pdfBtn) {
    if (pdfUrl) { pdfBtn.href = pdfUrl; pdfBtn.style.opacity = ''; pdfBtn.style.pointerEvents = ''; }
    else        { pdfBtn.removeAttribute('href'); pdfBtn.style.opacity = '0.5'; pdfBtn.style.pointerEvents = 'none'; }
  }
}

// CARD 9 — Monitoring Overview
function renderMcMonitoringOverview({ history, alertOverview }) {
  const daysEl     = document.getElementById('mc-ovr-days');
  const changesEl  = document.getElementById('mc-ovr-changes');
  const resolvedEl = document.getElementById('mc-ovr-resolved');
  if (!daysEl) return;

  let days = 0;
  if (history && history.length > 0 && history[0].scanned_at) {
    const start = new Date(history[0].scanned_at).getTime();
    days = Math.max(1, Math.floor((Date.now() - start) / 864e5) + 1);
  }
  daysEl.textContent = String(days);
  if (changesEl)  changesEl.textContent  = String(alertOverview.total || 0);
  if (resolvedEl) resolvedEl.textContent = String(alertOverview.resolved || 0);
}

/* ─────────────────────────────────────────────
   PRESERVED — auth, trial, reservation, lock CTAs
   (V1 wiring kept verbatim except where modified
   above; see top-of-file comment for the list.)
   ───────────────────────────────────────────── */

function wireSignOut(supabase) {
  const btn = document.getElementById('sign-out-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await supabase.auth.signOut(); }
    catch (e) { console.error('[mc] sign-out failed', e); }
    window.location.href = '/';
  });
}

async function checkAdminStatus(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch (err) { console.error('[admin] check failed', err); return false; }
}

function getSyntheticProfile(state) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (state) {
    case 'trial_active':
      return { tier:'free', founding_artist:false, monitoring_status:'grace_period',
        trial_started_at:new Date(now - 7*day).toISOString(),
        next_rescan_at:  new Date(now + 7*day).toISOString() };
    case 'paused':
      return { tier:'free', founding_artist:false, monitoring_status:'inactive',
        trial_started_at:new Date(now - 30*day).toISOString(), next_rescan_at:null };
    case 'monthly_paid':
      return { tier:'pro', founding_artist:false, monitoring_status:'active',
        trial_started_at:null, next_rescan_at:new Date(now + 7*day).toISOString() };
    case 'founding_artist':
      return { tier:'pro', founding_artist:true, monitoring_status:'active',
        trial_started_at:null, next_rescan_at:new Date(now + 7*day).toISOString() };
    case 'pre_trial':
      return { tier:'free', founding_artist:false, monitoring_status:'inactive',
        trial_started_at:null, next_rescan_at:null };
    default:
      return null;
  }
}

async function activateTrialIfNeeded(supabase, userId, profile) {
  if (profile.monitoring_status !== 'inactive') return profile;
  if (profile.trial_started_at != null) return profile;

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        monitoring_status: 'grace_period',
        trial_started_at:  now.toISOString(),
        next_rescan_at:    trialEnd.toISOString(),
      })
      .eq('id', userId)
      .select('tier, monitoring_status, next_rescan_at, trial_started_at, founding_artist, founding_artist_number, created_at')
      .single();
    if (error || !data) { console.error('[mc] trial activation failed', error); return profile; }
    return data;
  } catch (e) { console.error('[mc] trial activation failed', e); return profile; }
}

function renderTrialBanner(profile) {
  const banner = document.getElementById('trial-banner');
  if (!banner) return;
  const inGrace = profile.monitoring_status === 'grace_period';
  const trialStarted = profile.trial_started_at != null;
  if (!inGrace || !trialStarted) { banner.style.display = 'none'; return; }
  const trialEnd = new Date(profile.next_rescan_at);
  const daysRemaining = Math.ceil((trialEnd - new Date()) / 864e5);
  if (daysRemaining <= 0) { banner.style.display = 'none'; return; }
  const numEl = document.getElementById('trial-days-num');
  if (numEl) numEl.textContent = String(daysRemaining);
  const labelEl = document.getElementById('trial-days-label');
  if (labelEl) labelEl.textContent = daysRemaining === 1 ? 'day remaining' : 'days remaining';
  banner.style.display = '';
}

function fillConfirmedState(confirmed, email) {
  if (!confirmed) return;
  confirmed.textContent = `Reserved. We'll notify ${email} when checkout opens.`;
  confirmed.style.display = '';
}

function renderPricing(profile, reservation) {
  const section = document.getElementById('pricing');
  if (!section) return;
  if (profile.tier === 'pro' || profile.founding_artist === true) {
    section.style.display = 'none'; return;
  }
  const cta = document.getElementById('reserve-founding-artist');
  const confirmed = document.getElementById('founding-artist-confirmed');
  if (reservation) {
    if (cta) cta.style.display = 'none';
    fillConfirmedState(confirmed, reservation.email);
  } else {
    if (cta) cta.style.display = '';
    if (confirmed) confirmed.style.display = 'none';
  }
}

function wireReservationFlow(session) {
  const cta = document.getElementById('reserve-founding-artist');
  if (!cta) return;
  cta.addEventListener('click', () => handleReserveClick(session, cta));
}

async function handleReserveClick(session, cta) {
  if (window.__royalteIsAdmin) { console.log('[admin] reservation skipped — preview mode'); return; }
  const email = session?.user?.email;
  const errEl = document.getElementById('founding-artist-error');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (!email) {
    if (errEl) { errEl.textContent = "Couldn't read your account email — please refresh and try again."; errEl.style.display = ''; }
    return;
  }
  const originalText = cta.textContent;
  cta.disabled = true;
  cta.textContent = 'Reserving…';
  try {
    const resp = await fetch('/api/founding-artist/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) throw new Error(data.error || ('HTTP ' + resp.status));
    cta.style.display = 'none';
    fillConfirmedState(document.getElementById('founding-artist-confirmed'), email);
  } catch (e) {
    console.error('[mc] reservation failed', e);
    cta.disabled = false;
    cta.textContent = originalText;
    if (errEl) { errEl.textContent = "Couldn't reserve your spot — please try again in a moment."; errEl.style.display = ''; }
  }
}

function wireLockCTAs() {
  document.querySelectorAll('[data-lock-cta]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('upgrade');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */

async function init() {
  const supabase = getSupabase();
  if (!supabase) { window.location.href = '/'; return; }

  let session = null;
  try {
    const res = await supabase.auth.getSession();
    session = res.data.session;
  } catch (e) { console.error('[mc] getSession failed', e); }
  if (!session) { window.location.href = '/'; return; }

  wireSignOut(supabase);

  const isAdmin = await checkAdminStatus(supabase, session.user.id);
  window.__royalteIsAdmin = isAdmin;

  let profile = await loadProfile(supabase, session.user.id);
  if (isAdmin) {
    const previewState = new URLSearchParams(location.search).get('preview_state');
    if (previewState) {
      const synthetic = getSyntheticProfile(previewState);
      if (synthetic) {
        profile = { ...profile, ...synthetic };
        console.log('[admin] preview state:', previewState, profile);
      }
    }
  }
  if (!isAdmin) {
    profile = await activateTrialIfNeeded(supabase, session.user.id, profile);
  }
  document.body.classList.add('tier-' + profile.tier);

  renderMcSidebar(profile);
  renderTrialBanner(profile);

  // Latest scan + history are needed by Cards 1, 4, 9.
  const [scan, history, monitoringActive] = await Promise.all([
    loadLatestScan(supabase, session.user.id),
    loadScanHistory(supabase, session.user.id),
    loadMonitoringActive(supabase, session.user.id),
  ]);

  const artistName = (scan && scan.artist_name) || (scan?.payload?.subject?.artistName) || (session.user?.email?.split('@')[0]) || 'Artist';
  renderMcTopBar(artistName, scan?.scanned_at || scan?.created_at);

  // Card 1 — Health Score
  renderMcHealth(scan, history);

  // Card 2 — Backend Status (run counts in parallel)
  const [criticalCount, opportunitiesCount] = await Promise.all([
    _countActionNeededAlerts(supabase, session.user.id),
    _countMonitorAlerts(supabase, session.user.id),
  ]);
  renderMcBackendStatus({ monitoringActive, criticalCount, opportunitiesCount });

  // Card 3 — Intelligence Feed
  const feedAlerts = await loadAlertFeed(supabase, session.user.id, 5);
  renderMcFeed(feedAlerts);

  // Card 4 — Backend Health Journey™
  renderMcJourney(history);

  // Card 5 — Action Center (uses the same critical+monitor pool)
  const actionItems = await loadActionItems(supabase, session.user.id, 3);
  renderMcActionCenter({ items: actionItems, totalCount: criticalCount + opportunitiesCount });

  // Card 6 — Intelligence Profile
  renderMcIntelligenceProfile(scan);

  // Card 7 — Global Presence
  renderMcGlobalPresence(scan);

  // Card 8 — Baseline Review
  const baseline = (history && history.length > 0) ? history[0] : null;
  const baselinePdfUrl = await loadBaselinePdf(supabase, baseline);
  renderMcBaselineReview({ baseline, pdfUrl: baselinePdfUrl });

  // Card 9 — Monitoring Overview
  const alertOverview = await loadAlertOverview(supabase, session.user.id);
  renderMcMonitoringOverview({ history, alertOverview });

  // Below-grid conditional sections (trial banner already rendered above).
  const reservation = await loadReservation(supabase, session.user.id);
  renderPricing(profile, reservation);
  wireReservationFlow(session);

  wireLockCTAs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
