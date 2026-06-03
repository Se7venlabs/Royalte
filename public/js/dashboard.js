/* ═══════════════════════════════════════════════════════════════════
   ROYALTĒ MISSION CONTROL — render layer (Brief 015 + 015a fixes)

   Populates the 9-card grid in public/dashboard.html.

   SINGLE SOURCE OF TRUTH (LOCKED): health_score is read from
   scan_snapshots only via _resolveHealthScoreFromSnapshot, which
   prefers the stored value and falls back to the V1 risk score
   (100 - payload.overallScore / 100 - payload.score.overall) ONLY
   for legacy snapshots that predate Brief 012a. Returns null when
   no signal is available — never 0. computeV2HealthScore() in
   api/_lib/persist-os-scan.js is the only place the V2 score is
   computed from canonical data. No dashboard surface computes it
   from scratch.

   Preserved verbatim from V1 (auth/session/Supabase wiring):
   wireSignOut, checkAdminStatus, getSyntheticProfile,
   activateTrialIfNeeded, renderTrialBanner, renderPricing,
   wireReservationFlow, handleReserveClick, fillConfirmedState,
   wireLockCTAs, loadLatestScan, loadReservation,
   _countActionNeededAlerts.
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

// Brief 015a Fix 1+2 — legacy-data graceful degradation. Prefers the
// stored V2 health_score; falls back to (100 - V1 risk) for snapshots
// that predate Brief 012a's V2 write path. Returns null (not 0) when
// no usable signal exists — caller renders "—".
function _resolveHealthScoreFromSnapshot(s) {
  if (!s) return null;
  if (typeof s.health_score === 'number') return s.health_score;
  const p = s.payload || {};
  if (typeof p.overallScore === 'number') {
    return clamp(100 - p.overallScore, 0, 100);
  }
  if (p.score && typeof p.score.overall === 'number') {
    return clamp(100 - p.score.overall, 0, 100);
  }
  return null;
}

// Review Confidence label from a single scan — used by Card 6 donut
// label AND Card 9 Your Royaltē Review subtitle. One helper, one
// definition. Counts VERIFIED platforms across the 6 reviewed
// sources (Apple, Spotify, YouTube, MusicBrainz, Discogs, LastFM).
function _confidenceLabelForScan(scan) {
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const sources = ['appleMusic','spotify','youtube','musicbrainz','discogs','lastfm'];
  const verified = sources.filter(k => p[k]?.availability === 'VERIFIED').length;
  if (verified >= 3) return { label: 'High',     count: verified, total: sources.length };
  if (verified >= 2) return { label: 'Moderate', count: verified, total: sources.length };
  return                    { label: 'Limited',  count: verified, total: sources.length };
}

// Score band → display label + CSS class suffix.
function _healthBand(score) {
  if (score >= 90) return { label: 'Excellent',          cls: 'band-excellent' };
  if (score >= 75) return { label: 'Strong',             cls: 'band-strong'    };
  if (score >= 60) return { label: 'Moderate',           cls: 'band-moderate'  };
  return                  { label: 'Review Recommended', cls: 'band-review'    };
}

// SVG sparkline path generator.
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

// Donut CSS conic-gradient — purple fill for `pct`% of the ring.
function _donutGradient(pct) {
  const deg = clamp(pct, 0, 100) * 3.6;
  return `conic-gradient(var(--pur-2) 0deg ${deg}deg,rgba(255,255,255,0.05) ${deg}deg)`;
}

// Inline-style fallback colors for the chips (still applied to status
// dots + feed icons). See _iconStyle below.
const ICON_COLORS = Object.freeze({
  green:  { bg: 'rgba(52,211,153,0.40)',  fg: '#34d399', border: 'rgba(52,211,153,0.55)' },
  amber:  { bg: 'rgba(245,158,11,0.40)',  fg: '#f59e0b', border: 'rgba(245,158,11,0.55)' },
  red:    { bg: 'rgba(239,68,68,0.40)',   fg: '#ef4444', border: 'rgba(239,68,68,0.55)' },
  purple: { bg: 'rgba(138,92,255,0.40)',  fg: '#a78bfa', border: 'rgba(138,92,255,0.55)' },
  blue:   { bg: 'rgba(96,165,250,0.40)',  fg: '#60a5fa', border: 'rgba(96,165,250,0.55)' },
});

// Brief 015b → Lucide migration: feed chips, score-delta arrows, and
// every dynamic icon use <i data-lucide="..."> placeholders that
// lucide.createIcons() converts to inline SVGs after each render.
// Helper hoisted here so all renderers can call it without scoping.
function _renderLucide() {
  if (typeof window !== 'undefined' && window.lucide && typeof window.lucide.createIcons === 'function') {
    try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
  }
}
// Brief 015b debug — color removed from inline style. When the chip's
// inline `color` matched its background tint (e.g. both purple at 0.40
// alpha), monochrome-emoji fallback glyphs were rendering invisible.
// Background + border still ride inline so the chip itself outclasses
// any CSS specificity issue; color is left to the CSS modifier classes.
function _iconStyle(colorKey) {
  const c = ICON_COLORS[colorKey] || ICON_COLORS.blue;
  return `background:${c.bg};border:1px solid ${c.border};`;
}
// Translate the existing .is-X class suffix to our color key.
function _iconColorKey(iconClass) {
  if (!iconClass) return 'blue';
  return iconClass.replace(/^is-/, '');
}

// Brief 015b Part 3 — match a feed alert against the latest scan's
// Apple Music albums[]. Returns the artwork URL (with {w}x{h}
// substituted) or null if no match.
function _matchAlbumArtwork(alert, albums) {
  if (!Array.isArray(albums) || albums.length === 0) return null;
  const haystack = ((alert.track_name || '') + ' ' + (alert.title || '')).toLowerCase().trim();
  if (!haystack) return null;
  for (const a of albums) {
    const name = (a?.name || '').toLowerCase().trim();
    if (!name) continue;
    if (haystack.includes(name) || name.includes(haystack)) {
      const url = a?.artwork?.url;
      if (!url) continue;
      // Apple Music URL template uses {w}x{h}. 64×64 = 2× for retina at 32px.
      return url.replace('{w}', '64').replace('{h}', '64');
    }
  }
  return null;
}

// Invoked by <img onerror=...> when album artwork fails to load.
// Swaps the broken img element with the SVG icon fallback. Global
// so it's reachable from inline onerror handlers built in renderMcFeed.
window._mcFeedArtFallback = function(img) {
  if (!img || !img.dataset) return;
  const lucideName = img.dataset.fallbackLucide || 'activity';
  const cls        = img.dataset.fallbackClass  || 'is-blue';
  const style      = img.dataset.fallbackStyle  || '';
  const div = document.createElement('div');
  div.className = `mc-feed-icon ${cls}`;
  div.setAttribute('style', style);
  div.innerHTML = `<i data-lucide="${lucideName}"></i>`;
  img.replaceWith(div);
  _renderLucide();
};

// Intelligence Feed display mapper — change_type → user-facing copy.
// LOCKED FORMAT per Brief 015d:
//   title: "{song name}"
//   sub:   "{what happened} · {territory if any} · {platform}"
// For events without a song name (e.g. baseline_established), the
// label becomes the title.
// Brief 015d Item 8 — Event-chip color semantics (NOT severity).
//   🟢 Green  = Verified         (ISRC verified, metadata verified, source confirmed)
//   🟣 Purple = New Release      (new release / album / single / EP detected)
//   🔵 Blue   = Discovery        (new source connected, new region, new platform, monitoring started)
//   🟠 Amber  = Review           (publishing / metadata / catalog / confidence review recommended)
//   🔴 Red    = Action Required  (critical issue, action required, source unavailable, monitoring alert)
const FEED_META = Object.freeze({
  release_added:        { icon: 'music',        label: 'New release detected',                color: 'is-purple' },
  release_removed:      { icon: 'music',        label: 'Release no longer detected',          color: 'is-amber'  },
  territory_gain:       { icon: 'globe',        label: 'New regional presence detected',      color: 'is-blue'   },
  territory_loss:       { icon: 'globe',        label: 'No longer available in region',       color: 'is-amber'  },
  isrc_added:           { icon: 'link',         label: 'ISRC linked',                          color: 'is-green'  },
  isrc_dropped:         { icon: 'link',         label: 'ISRC signal changed',                  color: 'is-amber'  },
  isrc_mismatch:        { icon: 'link',         label: 'Identifier mismatch detected',         color: 'is-red'    },
  video_added:          { icon: 'circle-play',  label: 'YouTube match verified',               color: 'is-green'  },
  video_removed:        { icon: 'circle-play',  label: 'YouTube match no longer detected',     color: 'is-amber'  },
  metadata_changed:     { icon: 'badge-check',  label: 'Metadata updated',                     color: 'is-green'  },
  baseline_established: { icon: 'scan-search',  label: 'Monitoring started',                   color: 'is-blue'   },
  profile_missing:      { icon: 'alert-circle', label: 'Artist profile signal changed',        color: 'is-red'    },
});
const FEED_DEFAULT = Object.freeze({ icon: 'activity', label: 'Backend signal detected', color: 'is-purple' });

function _feedDisplay(alert) {
  const trackName = alert.track_name || alert.artist_name || '';
  const territory = alert.territory ? String(alert.territory).toUpperCase() : '';
  const platform  = alert.platform || '';
  const meta = FEED_META[alert.change_type] || FEED_DEFAULT;

  // Title = song name. When no track context, fall back to the label
  // (e.g. baseline_established).
  const title = trackName || meta.label;

  // Sub = "{label} · {territory} · {platform}". Skip the label segment
  // when the title is already the label (avoid duplication).
  const subParts = [];
  if (trackName) subParts.push(meta.label);
  if (territory) subParts.push(territory);
  if (platform)  subParts.push(platform);
  const sub = subParts.join(' · ');

  return { title, sub, iconClass: meta.color, lucide: meta.icon };
}

/* ─────────────────────────────────────────────
   LOADERS — preserved + new
   ───────────────────────────────────────────── */

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

// Brief 015a Fix 1 — SELECT now includes `payload` so the resolver can
// fall back to V1 risk for legacy snapshots.
async function loadScanHistory(supabase, userId) {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('id, health_score, scanned_at, payload')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: true })
    .limit(50);
  if (error) { console.error('[mc] history fetch failed', error); return []; }
  return data || [];
}

// Brief 015a-rev2 Fix 5 — fetch a wider window (20) so we can filter
// baseline-artifact alerts client-side and still surface up to 5 real
// post-baseline changes in the feed.
async function loadAlertFeed(supabase, userId, fetchLimit = 20) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('change_type, severity, track_name, artist_name, territory, platform, detected_at, title, detail')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(fetchLimit);
  if (error) { console.error('[mc] feed fetch failed', error); return []; }
  return data || [];
}

// Brief 015a-rev3 Fix 4 — baselineTimes is now passed in (queried once
// per page load by _loadBaselineTimes against monitoring_alerts). The
// previous in-alerts derivation failed when the baseline_established
// marker fell outside the 20-row fetch window, leaving artifact alerts
// visible. The dedicated query guarantees correctness regardless of how
// many alerts the user has accumulated.
//
// Filter rule: a release_added alert whose detected_at is within 1 hour
// of ANY baseline_established timestamp is treated as a baseline
// artifact (from the first delta-engine run) and excluded.
// baseline_established itself is kept — it IS a meaningful event.
function _filterBaselineArtifacts(alerts, baselineTimes) {
  if (!Array.isArray(alerts) || alerts.length === 0) return alerts;
  if (!Array.isArray(baselineTimes) || baselineTimes.length === 0) return alerts;
  const ONE_HOUR_MS = 60 * 60 * 1000;
  return alerts.filter(a => {
    if (a.change_type !== 'release_added') return true;
    const t = new Date(a.detected_at).getTime();
    if (Number.isNaN(t)) return true;
    return !baselineTimes.some(bt => Math.abs(t - bt) <= ONE_HOUR_MS);
  });
}

// For Card 4 "Last Change Detected" — exclude baseline_established too,
// since the baseline marker is an inception event, not a "change".
function _lastGenuineChangeAt(alerts, baselineTimes) {
  const cleaned = _filterBaselineArtifacts(alerts, baselineTimes)
    .filter(a => a.change_type !== 'baseline_established');
  return cleaned.length > 0 ? cleaned[0].detected_at : null;
}

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

// Brief 015a-rev3 Fix 4 — loads every baseline_established detected_at
// timestamp for the user. Separate query so the filter is correct even
// when baseline_established lies outside the alert-feed fetch window.
async function _loadBaselineTimes(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('monitoring_alerts')
      .select('detected_at')
      .eq('user_id', userId)
      .eq('change_type', 'baseline_established');
    if (error) { console.error('[mc] baseline times fetch failed', error); return []; }
    const times = (data || [])
      .map(r => new Date(r.detected_at).getTime())
      .filter(t => !Number.isNaN(t));
    // Brief 015b Part 4 — diagnostic. Confirms the dedicated baseline
    // query is returning timestamps. If empty, the artifact filter is
    // a no-op and release_added entries will leak through.
    console.log('[mc] baseline_established times loaded:', times.length, times);
    return times;
  } catch (e) { console.error('[mc] baseline times fetch failed', e); return []; }
}

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

async function loadBaselinePdf(supabase, baselineSnapshot) {
  if (!baselineSnapshot) return null;
  try {
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

// Brief 015e P0 — artist name is the personal anchor; set it as early
// as we know it so it paints before alert-derived data arrives.
function renderMcArtistName(artistName) {
  const nameEl = document.getElementById('tb-artist-name');
  if (nameEl) nameEl.textContent = (artistName || 'Artist').toUpperCase();
}

// Brief 015e P1 — command-center status strip. Status derivation:
//   criticalCount > 0       → ACTION REQUIRED  (red)
//   opportunitiesCount > 0  → ATTENTION NEEDED (amber)
//   otherwise               → ALL SYSTEMS NORMAL (green)
function renderMcStatusBar({
  healthScore,
  monitoringActive,
  criticalCount = 0,
  opportunitiesCount = 0,
  totalChanges = 0,
  confidenceLabel,
  scanDate,
}) {
  let statusClass, statusText;
  if (criticalCount > 0) {
    statusClass = 'is-red';
    statusText  = 'ACTION REQUIRED';
  } else if (opportunitiesCount > 0) {
    statusClass = 'is-amber';
    statusText  = 'ATTENTION NEEDED';
  } else {
    statusClass = 'is-green';
    statusText  = 'ALL SYSTEMS NORMAL';
  }

  const dotEl = document.getElementById('tb-status-dot');
  if (dotEl) {
    dotEl.classList.remove('is-green', 'is-amber', 'is-red');
    dotEl.classList.add(statusClass);
  }
  const labelEl = document.getElementById('tb-status-label');
  if (labelEl) {
    labelEl.textContent = statusText;
    labelEl.classList.remove('is-green', 'is-amber', 'is-red');
    labelEl.classList.add(statusClass);
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tb-stat-health',     healthScore == null ? '—' : String(healthScore));
  set('tb-stat-monitoring', monitoringActive ? 'Active' : 'Paused');
  set('tb-stat-changes',    String(totalChanges || 0));
  set('tb-stat-confidence', confidenceLabel || '—');
  set('tb-last-scan',       scanDate ? relativeTimePast(new Date(scanDate)) : '—');
}

function renderMcSidebar(profile) {
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
// Score reading uses the resolver (so legacy snapshots still display).
// Brief 015a-rev2 Fix 3 — delta only computes against a TRULY stored
// baseline (not the V1 fallback). If baseline scan predates Brief 012a,
// no fake delta — show "Baseline established" instead. Keeps Card 1 and
// Card 9 in the same score family.
function renderMcHealth(scan, history) {
  const current        = _resolveHealthScoreFromSnapshot(scan);
  const baselineStored = (history && history.length > 0 && typeof history[0].health_score === 'number')
    ? history[0].health_score : null;
  const delta = (current != null && baselineStored != null) ? (current - baselineStored) : null;

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
    if (deltaEl) { deltaEl.innerHTML = '<i data-lucide="minus"></i><span>—</span>'; _renderLucide(); }
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
      deltaEl.innerHTML = '<i data-lucide="minus"></i><span>Baseline established</span>';
    } else if (delta > 0) {
      deltaEl.className = 'mc-score-delta';
      deltaEl.innerHTML = `<i data-lucide="trending-up"></i><span>+${delta} points since baseline</span>`;
    } else if (delta < 0) {
      deltaEl.className = 'mc-score-delta is-down';
      deltaEl.innerHTML = `<i data-lucide="trending-down"></i><span>${delta} points since baseline</span>`;
    } else {
      deltaEl.className = 'mc-score-delta is-neutral';
      deltaEl.innerHTML = '<i data-lucide="equal"></i><span>0 points since baseline</span>';
    }
    _renderLucide();
  }

  if (sparkEl) {
    const values = (history && history.length)
      ? history.map(h => _resolveHealthScoreFromSnapshot(h) ?? 0)
      : [current];
    sparkEl.innerHTML =
      `<path d="${_sparkPath(values)}" stroke="var(--pur-2)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />` +
      `<circle cx="200" cy="${(32 - (current/100)*32).toFixed(1)}" r="2.5" fill="var(--pur-2)" />`;
    sparkEl.setAttribute('preserveAspectRatio', 'none');
  }
}

// CARD 2 — Backend Status (Brief 015a Fix 4: explicit .is-green class)
function renderMcBackendStatus({ monitoringActive, criticalCount, opportunitiesCount }) {
  const list = document.getElementById('mc-status-list');
  if (!list) return;

  const rows = [];

  // Brief 015d — Lucide icons inside the colored dot. Monitoring
  // Active gets the .is-pulse modifier which animates the outer
  // chip's box-shadow ring (mc-status-pulse keyframe), keeping the
  // "alive" feel without an inner CSS dot.
  const dotGreen = _iconStyle('green');
  const dotAmber = _iconStyle('amber');
  const dotRed   = _iconStyle('red');

  // Row 1 — Monitoring status
  if (monitoringActive) {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot green is-pulse" style="${dotGreen}">
          <i data-lucide="shield-check"></i>
        </div>
        <div class="mc-status-text">
          <div class="mc-status-title">Monitoring Active</div>
          <div class="mc-status-sub">Your backend is being monitored 24/7</div>
        </div>
      </div>
    `);
  } else {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot amber" style="${dotAmber}">
          <i data-lucide="shield-off"></i>
        </div>
        <div class="mc-status-text">
          <div class="mc-status-title">Monitoring Paused</div>
          <div class="mc-status-sub">Continuous monitoring is currently paused</div>
        </div>
      </div>
    `);
  }

  // Row 2 — Critical Issues
  if (criticalCount > 0) {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot red" style="${dotRed}"><i data-lucide="triangle-alert"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">${criticalCount} Critical Issue${criticalCount === 1 ? '' : 's'}</div>
          <div class="mc-status-sub">Requires attention</div>
        </div>
      </div>
    `);
  } else {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot green" style="${dotGreen}"><i data-lucide="circle-check"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">No Critical Issues</div>
          <div class="mc-status-sub">No problems detected</div>
        </div>
      </div>
    `);
  }

  // Row 3 — Opportunities
  if (opportunitiesCount > 0) {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot amber" style="${dotAmber}"><i data-lucide="alert-circle"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">${opportunitiesCount} Opportunit${opportunitiesCount === 1 ? 'y' : 'ies'}</div>
          <div class="mc-status-sub">Review recommended</div>
        </div>
      </div>
    `);
  } else {
    rows.push(`
      <div class="mc-status-row">
        <div class="mc-status-dot green" style="${dotGreen}"><i data-lucide="circle-check"></i></div>
        <div class="mc-status-text">
          <div class="mc-status-title">No Opportunities</div>
          <div class="mc-status-sub">Nothing to review right now</div>
        </div>
      </div>
    `);
  }

  list.innerHTML = rows.join('');
  _renderLucide();
}

// CARD 3 — Intelligence Feed
// Brief 015a-rev3 Fix 4 — baselineTimes passed in so the artifact
// filter works regardless of fetch window.
// Brief 015b Part 2 + 3 — emoji icon replaces Tabler glyph (no CDN
// dependency); when a feed item matches an album in the latest
// scan's appleMusic.albums[], the album artwork displays instead
// of the emoji chip. img errors fall back to emoji via
// window._mcFeedArtFallback.
function renderMcFeed(alertsRaw, baselineTimes, albums) {
  const list = document.getElementById('mc-feed-list');
  if (!list) return;
  const alerts = _filterBaselineArtifacts(alertsRaw || [], baselineTimes).slice(0, 5);

  if (alerts.length === 0) {
    list.innerHTML = `<div class="mc-feed-empty">Your backend is being watched. Royaltē will surface activity here as it's detected.</div>`;
    return;
  }
  list.innerHTML = alerts.map((a) => {
    const d = _feedDisplay(a);
    const when = relativeTimeShort(a.detected_at);
    const iconStyle = _iconStyle(_iconColorKey(d.iconClass));
    const artwork = _matchAlbumArtwork(a, albums);
    let iconEl;
    if (artwork) {
      // img + Lucide fallback via global error handler. data-fallback-lucide
      // carries the Lucide icon name string.
      iconEl = `<img class="mc-feed-art" src="${escapeHtml(artwork)}" alt="" loading="lazy" crossorigin="anonymous"`
             + ` data-fallback-lucide="${escapeHtml(d.lucide)}"`
             + ` data-fallback-class="${escapeHtml(d.iconClass)}"`
             + ` data-fallback-style="${escapeHtml(iconStyle)}"`
             + ` onerror="window._mcFeedArtFallback&&window._mcFeedArtFallback(this)">`;
    } else {
      iconEl = `<div class="mc-feed-icon ${escapeHtml(d.iconClass)}" style="${iconStyle}"><i data-lucide="${escapeHtml(d.lucide)}"></i></div>`;
    }
    return `
      <div class="mc-feed-item">
        ${iconEl}
        <div class="mc-feed-body">
          <div class="mc-feed-title">${escapeHtml(d.title)}</div>
          <div class="mc-feed-sub">${escapeHtml(d.sub)}</div>
        </div>
        <div class="mc-feed-time">${escapeHtml(when)}</div>
      </div>
    `;
  }).join('');
  _renderLucide();
}

// CARD 4 — Catalog Intelligence (Brief 015a Change 1)
function renderMcCatalogIntelligence(scan, feedAlerts, baselineTimes) {
  const am = scan?.payload?.platforms?.appleMusic?.details || {};
  const albums = Array.isArray(am.albums) ? am.albums : [];
  const tracks = albums.reduce((n, a) => n + (typeof a?.trackCount === 'number' ? a.trackCount : 0), 0);
  const releases = albums.length || am.albumCount || 0;
  const isrcVerified = !!am.isrcLookup?.isrc;
  const p = scan?.payload?.platforms || {};
  const sources = ['appleMusic','spotify','youtube','musicbrainz','discogs','lastfm']
    .filter(k => p[k]?.availability === 'VERIFIED').length;
  // Brief 015a-rev3 Fix 4 — baselineTimes passed in; exclude baseline
  // artifacts AND the baseline marker itself.
  const lastChangeAt = _lastGenuineChangeAt(feedAlerts, baselineTimes);
  const lastChange = lastChangeAt
    ? relativeTimePast(new Date(lastChangeAt))
    : 'No changes detected yet';

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('mc-cat-tracks',   tracks);
  set('mc-cat-releases', releases);
  set('mc-cat-isrc',     isrcVerified ? 'Verified' : 'Pending verification');
  set('mc-cat-sources',  `${sources} / 6`);
  set('mc-cat-last',     lastChange);
}

// CARD 5 — Action Center
function renderMcActionCenter({ items, totalCount }) {
  const countEl = document.getElementById('mc-action-count');
  const listEl  = document.getElementById('mc-action-list');
  if (!countEl || !listEl) return;

  if (totalCount === 0) {
    countEl.className = 'mc-action-count is-good';
    countEl.textContent = 'ALL SYSTEMS NORMAL';
    listEl.innerHTML = `<div class="mc-action-empty">Royaltē has not detected any issues requiring action. Monitoring continues.</div>`;
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

// CARD 6 — Intelligence Confidence (Brief 015a Change 2)
function renderMcIntelligenceConfidence(scan) {
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const v = (k) => p[k]?.availability === 'VERIFIED';
  const conf = _confidenceLabelForScan(scan);
  const pct = (conf.count / conf.total) * 100;

  // Catalog Coverage — 3 catalog-bearing DSPs (Apple, Spotify, YouTube).
  const catCount = ['appleMusic','spotify','youtube'].filter(v).length;
  const catalogCoverage = catCount >= 3 ? 'High' : catCount >= 2 ? 'Moderate' : 'Limited';

  // Publishing Visibility — MusicBrainz preferred, Spotify-only is Moderate.
  const publishingVisibility = v('musicbrainz') ? 'Verified'
    : v('spotify') ? 'Moderate' : 'Limited';

  // Metadata Confidence — Apple+Spotify both = High, one = Moderate.
  const appleAndSpotify = v('appleMusic') && v('spotify');
  const oneOfTwo = v('appleMusic') || v('spotify');
  const metadataConfidence = appleAndSpotify ? 'High' : (oneOfTwo ? 'Moderate' : 'Limited');

  const donut    = document.getElementById('mc-donut');
  const labelEl  = document.getElementById('mc-donut-label');
  const srcEl    = document.getElementById('mc-profile-sources');
  const catEl    = document.getElementById('mc-profile-catalog');
  const pubEl    = document.getElementById('mc-profile-publishing');
  const metEl    = document.getElementById('mc-profile-metadata');

  if (donut)   donut.style.background = _donutGradient(pct);
  if (labelEl) labelEl.textContent = conf.label;
  if (srcEl)   srcEl.textContent = `${conf.count} / ${conf.total}`;
  if (catEl)   catEl.textContent = catalogCoverage;
  if (pubEl)   pubEl.textContent = publishingVisibility;
  if (metEl)   metEl.textContent = metadataConfidence;
}

// CARD 7 — Global Presence
// Brief 015b — Brazil added as the 8th market. Constant name kept as
// BIG6 for legacy reach; the count is dynamic via BIG6.length.
const BIG6 = [
  { code:'us', name:'USA',       flag:'🇺🇸' },
  { code:'ca', name:'Canada',    flag:'🇨🇦' },
  { code:'gb', name:'UK',        flag:'🇬🇧' },
  { code:'de', name:'Germany',   flag:'🇩🇪' },
  { code:'fr', name:'France',    flag:'🇫🇷' },
  { code:'jp', name:'Japan',     flag:'🇯🇵' },
  { code:'au', name:'Australia', flag:'🇦🇺' },
  { code:'br', name:'Brazil',    flag:'🇧🇷' },
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
  if (subEl) subEl.textContent = `${verifiedN} of ${BIG6.length} regions verified`;
}

// CARD 8 (was 9) — Monitoring Overview
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

// CARD 9 — Your Royaltē Review (Brief 015a Change 3, swapped to position 9)
//
// Brief 015a-rev2 Fix 3 (revised) — when the baseline scan predates
// Brief 012a it has no stored health_score, and the V1 fallback would
// produce a misleading number (100 − risk = e.g. 25). Instead: show the
// CURRENT scan's stored health_score so Card 1 and Card 9 always sit in
// the same score family. Add the subtitle "Score reflects current data"
// when we fall through to current. Card 1's delta also avoids the V1
// fallback (see renderMcHealth) for the same consistency reason.
function renderMcYourReview({ baseline, currentScan, pdfUrl, confidenceLabel }) {
  const numEl  = document.getElementById('mc-review-num');
  const dateEl = document.getElementById('mc-review-date');
  const confEl = document.getElementById('mc-review-confidence');
  const pdfBtn = document.getElementById('mc-review-pdf');

  const setPdfDisabled = (disabled) => {
    if (!pdfBtn) return;
    if (disabled) { pdfBtn.removeAttribute('href'); pdfBtn.style.opacity = '0.5'; pdfBtn.style.pointerEvents = 'none'; }
    else          { pdfBtn.style.opacity = ''; pdfBtn.style.pointerEvents = ''; }
  };

  if (!baseline) {
    if (numEl)  numEl.textContent = '—';
    if (dateEl) dateEl.textContent = 'No baseline yet';
    if (confEl) confEl.textContent = 'Review Confidence: —';
    setPdfDisabled(true);
    return;
  }

  const baselineScore = typeof baseline.health_score === 'number' ? baseline.health_score : null;
  const currentScore  = typeof currentScan?.health_score === 'number' ? currentScan.health_score : null;
  const usingCurrent  = baselineScore == null && currentScore != null;
  const scoreToShow   = baselineScore != null ? baselineScore : currentScore;

  if (numEl)  numEl.textContent = scoreToShow == null ? '—' : String(scoreToShow);
  if (dateEl) dateEl.textContent = `Generated ${formatScanDateShort(baseline.scanned_at)}`;
  if (confEl) {
    if (usingCurrent)              confEl.textContent = 'Score reflects current data';
    else if (scoreToShow == null)  confEl.textContent = 'Review Confidence: —';
    else                            confEl.textContent = `Review Confidence: ${confidenceLabel || '—'}`;
  }
  if (pdfUrl) { if (pdfBtn) pdfBtn.href = pdfUrl; setPdfDisabled(false); }
  else        { setPdfDisabled(true); }
}

/* ─────────────────────────────────────────────
   PRESERVED — auth, trial, reservation, lock CTAs
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

  const [scan, history, monitoringActive, baselineTimes] = await Promise.all([
    loadLatestScan(supabase, session.user.id),
    loadScanHistory(supabase, session.user.id),
    loadMonitoringActive(supabase, session.user.id),
    _loadBaselineTimes(supabase, session.user.id),
  ]);

  const artistName = (scan && scan.artist_name) || (scan?.payload?.subject?.artistName) || (session.user?.email?.split('@')[0]) || 'Artist';
  // Paint the artist name immediately (Brief 015e P0); the status row,
  // stats, and Last Scan get populated by renderMcStatusBar at the end
  // of init() once all the derived data is loaded.
  renderMcArtistName(artistName);

  // Card 1 — Health Score
  renderMcHealth(scan, history);

  // Card 2 — Backend Status
  const [criticalCount, opportunitiesCount] = await Promise.all([
    _countActionNeededAlerts(supabase, session.user.id),
    _countMonitorAlerts(supabase, session.user.id),
  ]);
  renderMcBackendStatus({ monitoringActive, criticalCount, opportunitiesCount });

  // Card 3 — Intelligence Feed. albums[] from the latest scan flows
  // into renderMcFeed so feed items matching a known release can show
  // the Apple Music artwork instead of the emoji chip (Brief 015b).
  const feedAlerts = await loadAlertFeed(supabase, session.user.id);
  const albums = scan?.payload?.platforms?.appleMusic?.details?.albums || [];
  renderMcFeed(feedAlerts, baselineTimes, albums);

  // Card 4 — Catalog Intelligence (uses scan + latest GENUINE change)
  renderMcCatalogIntelligence(scan, feedAlerts, baselineTimes);

  // Card 5 — Action Center
  const actionItems = await loadActionItems(supabase, session.user.id, 3);
  renderMcActionCenter({ items: actionItems, totalCount: criticalCount + opportunitiesCount });

  // Card 6 — Intelligence Confidence
  renderMcIntelligenceConfidence(scan);

  // Card 7 — Global Presence
  renderMcGlobalPresence(scan);

  // Card 8 — Monitoring Overview (moved up per Brief 015a Change 4)
  const alertOverview = await loadAlertOverview(supabase, session.user.id);
  renderMcMonitoringOverview({ history, alertOverview });

  // Card 9 — Your Royaltē Review (moved down, renamed per Brief 015a Change 3 + 4)
  const baseline = (history && history.length > 0) ? history[0] : null;
  const baselinePdfUrl = await loadBaselinePdf(supabase, baseline);
  const confidence = _confidenceLabelForScan(baseline || scan);
  renderMcYourReview({ baseline, currentScan: scan, pdfUrl: baselinePdfUrl, confidenceLabel: confidence.label });

  // Brief 015e P1 — populate the command-center status bar now that we
  // have every input. Health score uses the current scan (same source
  // Card 1 reads). Confidence reads the baseline (or the current scan
  // when no baseline yet exists), matching Card 9's framing.
  renderMcStatusBar({
    healthScore: _resolveHealthScoreFromSnapshot(scan),
    monitoringActive,
    criticalCount,
    opportunitiesCount,
    totalChanges: (alertOverview && typeof alertOverview.total === 'number') ? alertOverview.total : 0,
    confidenceLabel: confidence.label,
    scanDate: scan?.scanned_at || scan?.created_at,
  });

  // Below-grid conditional sections
  const reservation = await loadReservation(supabase, session.user.id);
  renderPricing(profile, reservation);
  wireReservationFlow(session);

  wireLockCTAs();

  // Final sweep — convert any remaining <i data-lucide="..."> placeholders
  // emitted during init() to inline SVGs.
  _renderLucide();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
