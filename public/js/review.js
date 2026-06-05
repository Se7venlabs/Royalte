/* ═══════════════════════════════════════════════════════════════════
   ROYALTĒ REVIEW — render layer (Brief 016)

   Loads the same data Mission Control reads (scan_snapshots,
   monitoring_alerts, audit_scans, profiles, monitoring_subscriptions)
   and composes an executive intelligence briefing across 8 sections.

   STRICT RULE: render only verified data. Never invent findings,
   never invent opportunities, never invent actions. When a signal is
   missing, surface "could not be determined from reviewed sources"
   rather than fabricating values. The Royaltē Review is the trust
   surface — its credibility depends on this rule.

   Helpers + loaders intentionally duplicated from dashboard.js (no
   shared module yet — the two pages diverge enough that the cost of
   duplication is lower than the refactor risk at this stage).
   ═══════════════════════════════════════════════════════════════════ */

import { getSupabase } from '/js/supabase-client.js';

const MC_VERSION = '1.0.2';

/* ─────────────────────────────────────────────
   HELPERS (mirrored from dashboard.js)
   ───────────────────────────────────────────── */

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function _resolveHealthScoreFromSnapshot(s) {
  if (!s) return null;
  if (typeof s.health_score === 'number') return s.health_score;
  const p = s.payload || {};
  if (typeof p.overallScore === 'number') return clamp(100 - p.overallScore, 0, 100);
  if (p.score && typeof p.score.overall === 'number') return clamp(100 - p.score.overall, 0, 100);
  return null;
}
function _healthBand(score) {
  if (score == null) return { label: '—', cls: '' };
  if (score >= 90) return { label: 'Excellent',          cls: 'band-excellent' };
  if (score >= 75) return { label: 'Strong',             cls: 'band-strong'    };
  if (score >= 60) return { label: 'Moderate',           cls: 'band-moderate'  };
  return                  { label: 'Review Recommended', cls: 'band-review'    };
}
function _confidenceLabelForScan(scan) {
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const sources = ['appleMusic','spotify','youtube','musicbrainz','discogs','lastfm'];
  const verified = sources.filter(k => p[k]?.availability === 'VERIFIED').length;
  if (verified >= 3) return { label: 'High',     count: verified, total: sources.length };
  if (verified >= 2) return { label: 'Moderate', count: verified, total: sources.length };
  return                    { label: 'Limited',  count: verified, total: sources.length };
}

// Intelligence outcome derivation — must mirror renderMcIntelligenceConfidence
// in dashboard.js. Six artist-facing outcomes; never surfaces source-platform
// names per Brief 015n's Intelligence Network principle.
function intelligenceOutcomes(scan, profile) {
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const v = (k) => p[k]?.availability === 'VERIFIED';
  const isMonitoring = !!(profile && (profile.founding_artist === true || profile.tier === 'paid'));
  return [
    { label: 'Streaming Presence',    status: (v('appleMusic') || v('spotify'))   ? 'verified' : 'pending' },
    { label: 'Metadata Verification', status: (v('appleMusic') && v('spotify'))   ? 'verified' : 'pending' },
    { label: 'Artist Identity',       status: v('musicbrainz')                     ? 'verified' : 'pending' },
    { label: 'Authority Signals',     status: (v('discogs') || v('lastfm'))       ? 'verified' : 'pending' },
    { label: 'Podcast Intelligence',  status: isMonitoring                         ? 'active'   : 'locked'  },
    { label: 'Catalog Monitoring',    status: 'active' },
  ];
}

const PLATFORM_DISPLAY = Object.freeze({
  apple_music: 'Apple Music', spotify: 'Spotify', youtube: 'YouTube',
});
function _platformDisplay(p) { return p ? (PLATFORM_DISPLAY[p] || p) : ''; }

const TERRITORY_NAMES = Object.freeze({
  us:'United States', ca:'Canada', gb:'United Kingdom', de:'Germany', fr:'France',
  jp:'Japan', au:'Australia', br:'Brazil', es:'Spain', it:'Italy', mx:'Mexico',
  nl:'Netherlands', se:'Sweden', no:'Norway', dk:'Denmark', fi:'Finland',
  pl:'Poland', ie:'Ireland', nz:'New Zealand', kr:'South Korea', in:'India',
  ar:'Argentina', cl:'Chile', co:'Colombia', za:'South Africa', pt:'Portugal',
  be:'Belgium', ch:'Switzerland', at:'Austria',
});
function _territoryDisplay(code) {
  if (!code) return '';
  const k = String(code).toLowerCase();
  return TERRITORY_NAMES[k] || String(code).toUpperCase();
}

// Feed display — mirrors dashboard.js _feedDisplay
const FEED_META = Object.freeze({
  release_added:        { tag:'NEW RELEASE',     color:'is-purple', event:'New Release Detected' },
  release_removed:      { tag:'REVIEW',          color:'is-amber',  event:'Release Removed' },
  territory_gain:       { tag:'DISCOVERY',       color:'is-blue',   event:'New Region Detected' },
  territory_loss:       { tag:'REVIEW',          color:'is-amber',  event:'Region Unavailable' },
  isrc_added:           { tag:'VERIFIED',        color:'is-green',  event:'ISRC Verified' },
  isrc_dropped:         { tag:'REVIEW',          color:'is-amber',  event:'ISRC Changed' },
  isrc_mismatch:        { tag:'ACTION REQUIRED', color:'is-red',    event:'ISRC Mismatch Detected' },
  video_added:          { tag:'VERIFIED',        color:'is-green',  event:'YouTube Match Verified' },
  video_removed:        { tag:'REVIEW',          color:'is-amber',  event:'YouTube Match Removed' },
  metadata_changed:     { tag:'VERIFIED',        color:'is-green',  event:'Metadata Verified' },
  baseline_established: { tag:'DISCOVERY',       color:'is-blue',   event:'Monitoring Started' },
  profile_missing:      { tag:'ACTION REQUIRED', color:'is-red',    event:'Profile Signal Changed' },
  podcast_appearance:   { tag:'DISCOVERY',       color:'is-blue',   event:'Podcast Appearance Detected' },
});
const FEED_DEFAULT = Object.freeze({ tag:'SIGNAL', color:'is-purple', event:'Backend Signal' });
function _titleCase(s) {
  if (!s) return '';
  return s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function _feedDisplay(alert) {
  const meta = FEED_META[alert.change_type] || FEED_DEFAULT;
  const trackName = alert.track_name || alert.artist_name || '';
  const track = trackName || meta.event || _titleCase(meta.tag);
  const event = trackName ? meta.event : '';
  let metaLine = '';
  if (alert.territory)     metaLine = _territoryDisplay(alert.territory);
  else if (alert.platform) metaLine = _platformDisplay(alert.platform);
  return { color: meta.color, track, event, meta: metaLine };
}
function _matchAlbumArtwork(alert, albums) {
  if (!Array.isArray(albums) || albums.length === 0) return null;
  const haystack = ((alert.track_name || '') + ' ' + (alert.title || '')).toLowerCase().trim();
  if (!haystack) return null;
  for (const a of albums) {
    const name = (a?.name || '').toLowerCase().trim();
    if (!name) continue;
    if (haystack.includes(name) || name.includes(haystack)) {
      const url = typeof a.artwork === 'string' ? a.artwork : (a?.artwork?.url || null);
      if (url) return url;
    }
  }
  return null;
}

// Filter out baseline-artifact alerts (release_added rows synthesized
// within 1h of baseline_established for the same artist). Same logic
// as dashboard.js so the review feed matches the dashboard feed.
function _filterBaselineArtifacts(alerts, baselineTimes) {
  if (!Array.isArray(alerts) || !alerts.length) return [];
  if (!baselineTimes || !Object.keys(baselineTimes).length) {
    return alerts.filter(a => a.change_type !== 'baseline_established');
  }
  const ONE_HOUR_MS = 3600 * 1000;
  return alerts.filter((a) => {
    if (a.change_type === 'baseline_established') return false;
    if (a.change_type !== 'release_added') return true;
    const baseT = baselineTimes[a.artist_id];
    if (!baseT) return true;
    return Math.abs(new Date(a.detected_at).getTime() - baseT) > ONE_HOUR_MS;
  });
}

function _renderLucide() {
  if (window.lucide?.createIcons) {
    try { window.lucide.createIcons(); } catch (e) { /* non-fatal */ }
  }
}

/* ─────────────────────────────────────────────
   LOADERS (mirrored from dashboard.js + 2 new)
   ───────────────────────────────────────────── */

async function loadLatestScan(supabase, userId) {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('id, payload, created_at, sequence_number, health_score, score_breakdown, scanned_at, artist_id, artist_name, canonical_data')
    .eq('user_id', userId)
    .order('sequence_number', { ascending: false })
    .limit(1);
  if (error) console.error('[review] latest scan failed', error);
  return (data && data.length) ? data[0] : null;
}
async function loadScanHistory(supabase, userId) {
  const { data, error } = await supabase
    .from('scan_snapshots')
    .select('id, health_score, scanned_at, payload')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: true })
    .limit(50);
  if (error) { console.error('[review] history failed', error); return []; }
  return data || [];
}
async function loadProfile(supabase, userId) {
  const fallback = { tier:'free', monitoring_status:'inactive', next_rescan_at:null, trial_started_at:null, founding_artist:false, founding_artist_number:null, created_at:null };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('tier, monitoring_status, next_rescan_at, trial_started_at, founding_artist, founding_artist_number, created_at')
      .eq('id', userId)
      .single();
    if (error || !data) return fallback;
    return data;
  } catch (e) { console.error('[review] profile failed', e); return fallback; }
}
async function loadAlertFeed(supabase, userId, fetchLimit = 20) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('change_type, severity, track_name, artist_name, artist_id, territory, platform, detected_at, title, detail, resolved')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(fetchLimit);
  if (error) { console.error('[review] feed failed', error); return []; }
  return data || [];
}
async function loadOpportunityAlerts(supabase, userId, limit = 5) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('change_type, severity, track_name, territory, platform, detected_at, title, detail')
    .eq('user_id', userId)
    .eq('severity', 'monitor')
    .eq('resolved', false)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[review] opportunity alerts failed', error); return []; }
  return data || [];
}
async function loadActionAlerts(supabase, userId, limit = 10) {
  const { data, error } = await supabase
    .from('monitoring_alerts')
    .select('change_type, severity, track_name, territory, platform, detected_at, title, detail')
    .eq('user_id', userId)
    .eq('severity', 'action_needed')
    .eq('resolved', false)
    .order('detected_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[review] action alerts failed', error); return []; }
  return data || [];
}
async function loadAlertOverview(supabase, userId) {
  try {
    const { count: total } = await supabase
      .from('monitoring_alerts')
      .select('id', { head:true, count:'exact' })
      .eq('user_id', userId);
    const { count: resolved } = await supabase
      .from('monitoring_alerts')
      .select('id', { head:true, count:'exact' })
      .eq('user_id', userId)
      .eq('resolved', true);
    return { total: total || 0, resolved: resolved || 0 };
  } catch (e) { console.error('[review] overview failed', e); return { total:0, resolved:0 }; }
}
async function _loadBaselineTimes(supabase, userId) {
  try {
    const { data } = await supabase
      .from('monitoring_alerts')
      .select('artist_id, detected_at')
      .eq('user_id', userId)
      .eq('change_type', 'baseline_established')
      .order('detected_at', { ascending: true });
    const out = {};
    (data || []).forEach((row) => {
      if (!out[row.artist_id]) out[row.artist_id] = new Date(row.detected_at).getTime();
    });
    return out;
  } catch (e) { console.error('[review] baselines failed', e); return {}; }
}
async function loadMonitoringActive(supabase, userId) {
  try {
    const { count } = await supabase
      .from('monitoring_subscriptions')
      .select('id', { head:true, count:'exact' })
      .eq('user_id', userId)
      .eq('active', true);
    return (count || 0) > 0;
  } catch (e) { console.error('[review] monitoring active failed', e); return false; }
}
async function _countActionNeededAlerts(supabase, userId) {
  try {
    const { count } = await supabase
      .from('monitoring_alerts')
      .select('id', { head:true, count:'exact' })
      .eq('user_id', userId)
      .eq('resolved', false)
      .eq('severity', 'action_needed');
    return count || 0;
  } catch (e) { return 0; }
}
async function _countMonitorAlerts(supabase, userId) {
  try {
    const { count } = await supabase
      .from('monitoring_alerts')
      .select('id', { head:true, count:'exact' })
      .eq('user_id', userId)
      .eq('resolved', false)
      .eq('severity', 'monitor');
    return count || 0;
  } catch (e) { return 0; }
}
// New for Section 8 — earliest active subscription's next scheduled scan.
async function loadNextScanAt(supabase, userId) {
  try {
    const { data } = await supabase
      .from('monitoring_subscriptions')
      .select('next_scan_at')
      .eq('user_id', userId)
      .eq('active', true)
      .order('next_scan_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    return data?.next_scan_at || null;
  } catch (e) { console.error('[review] next scan failed', e); return null; }
}

/* ─────────────────────────────────────────────
   SECTION RENDERERS
   ───────────────────────────────────────────── */

function renderHeader({ artistName, score, band, lastReviewDate }) {
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('review-artist', (artistName || 'Artist').toUpperCase());
  setText('review-score', score == null ? '—' : String(score));
  const bandEl = document.getElementById('review-band');
  if (bandEl) {
    bandEl.textContent = band.label;
    bandEl.classList.remove('band-strong','band-excellent','band-moderate','band-review');
    if (band.cls) bandEl.classList.add(band.cls);
  }
  setText('review-last', lastReviewDate ? formatScanDateShort(lastReviewDate) : 'No reviews yet');
}

// Brief 016 — Royaltē Assessment template. Plain English, real values
// only. Adjective comes from the band; coverage from confidence count;
// changes/actions from alert counts. Null-safe throughout.
function renderAssessment({ band, conf, totalChanges, criticalCount }) {
  const el = document.getElementById('review-assessment');
  if (!el) return;
  if (!band || !band.label || band.label === '—') {
    el.innerHTML = 'Backend health <strong>could not be determined from reviewed sources</strong>. Run a scan to populate this assessment.';
    return;
  }
  const adjectiveByBand = {
    'Excellent': 'in excellent shape',
    'Strong':    'strong',
    'Moderate':  'in moderate shape',
    'Review Recommended': 'in need of review',
  };
  const adjective = adjectiveByBand[band.label] || band.label.toLowerCase();
  const coverage = (conf && Number.isFinite(conf.count) && Number.isFinite(conf.total))
    ? `verified <strong>${conf.count} of ${conf.total}</strong> public sources`
    : `coverage <strong>could not be determined from reviewed sources</strong>`;
  const changesText = (totalChanges === 0)
    ? `detected <strong>no changes</strong> since baseline`
    : `detected <strong>${totalChanges}</strong> change${totalChanges === 1 ? '' : 's'} since baseline`;
  const actionText = (criticalCount === 0)
    ? `and found <strong>0 issues</strong> requiring action`
    : `and found <strong>${criticalCount}</strong> issue${criticalCount === 1 ? '' : 's'} requiring action`;
  el.innerHTML = `Your backend is <strong>${adjective}</strong> and actively monitored. Royaltē ${coverage}, ${changesText}, ${actionText}.`;
}

function renderConfidence({ outcomes, conf }) {
  const levelEl = document.getElementById('review-conf-level');
  const subEl   = document.getElementById('review-conf-sub');
  const listEl  = document.getElementById('review-conf-list');
  if (!levelEl || !listEl) return;

  if (!conf || !conf.label) {
    levelEl.textContent = '—';
    if (subEl) subEl.textContent = 'Confidence Level';
    listEl.innerHTML = '<div class="review-confidence-row"><span class="review-confidence-row-k">Verification could not be determined from reviewed sources.</span></div>';
    return;
  }

  levelEl.textContent = conf.label.toUpperCase();
  levelEl.classList.remove('is-moderate','is-limited');
  if (conf.label === 'Moderate') levelEl.classList.add('is-moderate');
  else if (conf.label === 'Limited') levelEl.classList.add('is-limited');

  if (subEl) subEl.textContent = `${conf.count} of ${conf.total} sources verified`;

  listEl.innerHTML = outcomes.map((o) => {
    const label = (o.status === 'active') ? 'Active'
                : (o.status === 'verified') ? 'Verified'
                : (o.status === 'locked') ? 'Monitoring Plan Required'
                : 'Pending';
    return `
      <div class="review-confidence-row">
        <span class="review-confidence-row-k">${escapeHtml(o.label)}</span>
        <span class="review-confidence-row-v is-${escapeHtml(o.status)}">${escapeHtml(label)}</span>
      </div>
    `;
  }).join('');
}

function renderOpportunitySignals({ opportunityAlerts }) {
  const cardEl = document.getElementById('review-opportunity');
  if (!cardEl) return;
  if (!opportunityAlerts || opportunityAlerts.length === 0) {
    cardEl.innerHTML = '<p class="review-opportunity-empty">No opportunity signals detected during this review period.</p>';
    return;
  }
  cardEl.innerHTML = `
    <div class="review-opportunity-list">
      ${opportunityAlerts.map((a) => {
        const d = _feedDisplay(a);
        const when = a.detected_at ? relativeTimePast(new Date(a.detected_at)) : '';
        const metaParts = [];
        if (d.meta) metaParts.push(d.meta);
        if (when)   metaParts.push(when);
        return `
          <div class="review-opportunity-card">
            <div class="review-opportunity-icon"><i data-lucide="sparkles"></i></div>
            <div class="review-opportunity-body">
              <div class="review-opportunity-title">${escapeHtml(d.event || a.title || 'Opportunity detected')}</div>
              <div class="review-opportunity-detail">${escapeHtml(d.track)}</div>
              ${metaParts.length ? `<div class="review-opportunity-meta">${escapeHtml(metaParts.join(' · '))}</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  _renderLucide();
}

// Brief 016 Section 5 — verified items pulled from canonical_data
// (with payload fallback for legacy snapshots). Each item is a real
// derived signal; nothing fabricated. Items are only included when
// the underlying data is present + non-null.
function renderBackendHighlights({ scan, monitoringActive }) {
  const el = document.getElementById('review-highlights');
  if (!el) return;
  const p = (scan && scan.payload && scan.payload.platforms) || {};
  const am = p.appleMusic?.details || {};
  const items = [];

  // Streaming presence — list verified DSPs (apple/spotify/youtube).
  const dsps = [];
  if (p.appleMusic?.availability === 'VERIFIED') dsps.push('Apple Music');
  if (p.spotify?.availability    === 'VERIFIED') dsps.push('Spotify');
  if (p.youtube?.availability    === 'VERIFIED') dsps.push('YouTube');
  if (dsps.length) {
    items.push({
      icon: 'shield-check', accent: '',
      title: 'Streaming Presence Verified',
      detail: `Confirmed on ${dsps.join(', ')}.`,
    });
  }

  // Catalog depth — albums + tracks counts.
  const albums = Array.isArray(am.albums) ? am.albums : [];
  const albumCount = albums.length || am.albumCount || 0;
  const trackCount = albums.reduce((n, a) => n + (typeof a?.trackCount === 'number' ? a.trackCount : 0), 0);
  if (albumCount > 0) {
    const trackPart = trackCount > 0 ? ` across ${trackCount} track${trackCount === 1 ? '' : 's'}` : '';
    items.push({
      icon: 'disc-3', accent: 'is-blue',
      title: 'Catalog Verified',
      detail: `${albumCount} release${albumCount === 1 ? '' : 's'}${trackPart}.`,
    });
  }

  // Territory coverage — count of regions with any availability.
  const sfa = am.storefrontAvailability;
  if (sfa && typeof sfa === 'object') {
    let verifiedRegions = 0;
    let totalRegions = 0;
    Object.values(sfa).forEach((ent) => {
      totalRegions++;
      const avail = Array.isArray(ent?.available) ? ent.available.length : 0;
      if (avail > 0) verifiedRegions++;
    });
    if (totalRegions > 0) {
      items.push({
        icon: 'globe', accent: 'is-teal',
        title: 'Global Coverage',
        detail: `Available in ${verifiedRegions} of ${totalRegions} reviewed regions.`,
      });
    }
  }

  // ISRC status.
  const isrcVerified = !!am.isrcLookup?.isrc;
  items.push({
    icon: isrcVerified ? 'link' : 'link-2-off',
    accent: isrcVerified ? '' : 'is-muted',
    title: isrcVerified ? 'ISRC Verified' : 'ISRC Pending Verification',
    detail: isrcVerified
      ? 'Track identifiers confirmed by reviewed sources.'
      : 'ISRC information not yet confirmed in reviewed sources.',
  });

  // Monitoring status.
  items.push({
    icon: monitoringActive ? 'radar' : 'pause-circle',
    accent: monitoringActive ? 'is-teal' : 'is-muted',
    title: monitoringActive ? 'Continuous Monitoring' : 'Monitoring Paused',
    detail: monitoringActive
      ? 'Royaltē is watching your backend 24/7.'
      : 'Activate monitoring to surface changes automatically.',
  });

  if (items.length === 0) {
    el.innerHTML = '<div class="review-highlight-item"><div class="review-highlight-body"><div class="review-highlight-detail">Backend signals could not be determined from reviewed sources.</div></div></div>';
    return;
  }

  el.innerHTML = items.slice(0, 5).map((it) => `
    <div class="review-highlight-item">
      <div class="review-highlight-icon ${escapeHtml(it.accent || '')}"><i data-lucide="${escapeHtml(it.icon)}"></i></div>
      <div class="review-highlight-body">
        <div class="review-highlight-title">${escapeHtml(it.title)}</div>
        <div class="review-highlight-detail">${escapeHtml(it.detail)}</div>
      </div>
    </div>
  `).join('');
  _renderLucide();
}

function renderWhatChanged({ feedAlerts, baselineTimes, albums }) {
  const el = document.getElementById('review-changes');
  if (!el) return;
  const alerts = _filterBaselineArtifacts(feedAlerts || [], baselineTimes).slice(0, 5);
  if (alerts.length === 0) {
    el.innerHTML = '<p class="review-changes-empty">No changes detected since your last review. Royaltē is monitoring continuously.</p>';
    return;
  }
  el.innerHTML = `
    <div class="review-changes-list">
      ${alerts.map((a) => {
        const d = _feedDisplay(a);
        const when = relativeTimeShort(a.detected_at);
        const metaLine = d.meta ? `${escapeHtml(d.meta)} • ${escapeHtml(when)}` : escapeHtml(when);
        const artworkUrl = _matchAlbumArtwork(a, albums);
        const anchor = artworkUrl
          ? `<img class="review-change-art" src="${escapeHtml(artworkUrl)}" alt="" loading="lazy">`
          : `<div class="review-change-fallback ${escapeHtml(d.color)}"><i data-lucide="music"></i></div>`;
        const eventEl = d.event ? `<div class="review-change-event">${escapeHtml(d.event)}</div>` : '';
        return `
          <div class="review-change-item">
            <div class="review-change-accent ${escapeHtml(d.color)}"></div>
            ${anchor}
            <div class="review-change-body">
              <div class="review-change-track">${escapeHtml(d.track)}</div>
              ${eventEl}
              <div class="review-change-meta">${metaLine}</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  _renderLucide();
}

function renderActionsRequired({ actionAlerts }) {
  const el = document.getElementById('review-actions');
  if (!el) return;
  if (!actionAlerts || actionAlerts.length === 0) {
    el.innerHTML = `
      <div class="review-actions-empty">
        <span class="review-actions-empty-dot"></span>
        <span class="review-actions-empty-label">ALL SYSTEMS NORMAL</span>
      </div>
    `;
    return;
  }
  // Real action_needed alerts — prioritize by detected_at (most recent first).
  // No High/Medium/Low fabrication; each row carries its own data.
  el.innerHTML = `
    <div class="review-actions-list">
      ${actionAlerts.map((a) => `
        <div class="review-action-item">
          <span class="review-action-priority">Action</span>
          <div class="review-action-body">
            <div class="review-action-title">${escapeHtml(a.title || 'Action needed')}</div>
            ${a.detail ? `<div class="review-action-detail">${escapeHtml(a.detail)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderMonitoringStatus({ monitoringActive, scan, history, nextScanAt }) {
  const pillEl  = document.getElementById('review-mon-pill');
  const lastEl  = document.getElementById('review-mon-last');
  const nextEl  = document.getElementById('review-mon-next');
  const daysEl  = document.getElementById('review-mon-days');

  if (pillEl) {
    pillEl.textContent = monitoringActive ? 'Active' : 'Paused';
    pillEl.classList.remove('is-on','is-off');
    pillEl.classList.add(monitoringActive ? 'is-on' : 'is-off');
  }

  const scannedAt = scan?.scanned_at || scan?.created_at;
  if (lastEl) lastEl.textContent = scannedAt ? relativeTimePast(new Date(scannedAt)) : 'Not yet scanned';

  if (nextEl) {
    if (nextScanAt) {
      const future = new Date(nextScanAt);
      nextEl.textContent = future.getTime() > Date.now()
        ? relativeTimeFuture(future)
        : 'Scheduled';
    } else {
      nextEl.textContent = monitoringActive ? 'Scheduled' : 'Not scheduled';
    }
  }

  if (daysEl) {
    if (history && history.length > 0 && history[0].scanned_at) {
      const start = new Date(history[0].scanned_at).getTime();
      const days  = Math.max(1, Math.floor((Date.now() - start) / 864e5) + 1);
      daysEl.textContent = String(days);
    } else {
      daysEl.textContent = '—';
    }
  }
}

/* ─────────────────────────────────────────────
   TOP BAR + SIDEBAR (mirror dashboard.js renderers)
   ───────────────────────────────────────────── */

function renderArtistName(artistName) {
  const el = document.getElementById('tb-artist-name');
  if (el) el.textContent = (artistName || 'Artist').toUpperCase();
}
function renderStatusBar({ healthScore, monitoringActive, criticalCount, opportunitiesCount, totalChanges, confidenceLabel, scanDate }) {
  let statusClass, statusText;
  if (criticalCount > 0)         { statusClass = 'is-red';   statusText = 'ACTION REQUIRED'; }
  else if (opportunitiesCount > 0){ statusClass = 'is-amber'; statusText = 'ATTENTION NEEDED'; }
  else                            { statusClass = 'is-green'; statusText = 'ALL SYSTEMS NORMAL'; }
  const dotEl = document.getElementById('tb-status-dot');
  if (dotEl) { dotEl.classList.remove('is-green','is-amber','is-red'); dotEl.classList.add(statusClass); }
  const labelEl = document.getElementById('tb-status-label');
  if (labelEl) { labelEl.textContent = statusText; labelEl.classList.remove('is-green','is-amber','is-red'); labelEl.classList.add(statusClass); }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('tb-stat-health',     healthScore == null ? '—' : String(healthScore));
  set('tb-stat-monitoring', monitoringActive ? 'Active' : 'Paused');
  set('tb-stat-changes',    String(totalChanges || 0));
  set('tb-stat-confidence', confidenceLabel || '—');
  set('tb-stat-revenue',    String(opportunitiesCount || 0));
  set('tb-last-scan',       scanDate ? relativeTimePast(new Date(scanDate)) : '—');
}
function renderSidebar(profile) {
  const faBox     = document.getElementById('sb-fa');
  const faNumEl   = document.getElementById('sb-fa-num');
  const faSinceEl = document.getElementById('sb-fa-since');
  if (!faBox) return;
  if (profile && profile.founding_artist === true) {
    faBox.style.display = '';
    if (faNumEl)   faNumEl.textContent = profile.founding_artist_number != null ? `#${profile.founding_artist_number}` : '';
    if (faSinceEl) faSinceEl.textContent = `Member Since ${formatMemberSince(profile.created_at)}`;
  } else {
    faBox.style.display = 'none';
  }
}
function wireSignOut(supabase) {
  const btn = document.getElementById('sign-out-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await supabase.auth.signOut(); } catch {}
    window.location.href = '/';
  });
}

/* ─────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────── */

async function init() {
  const supabase = getSupabase();
  if (!supabase) { window.location.href = '/'; return; }

  // Session — same cold-launch refresh fallback as dashboard.js.
  let session = null;
  try { session = (await supabase.auth.getSession()).data.session; } catch (e) {}
  if (!session) {
    try {
      const ref = await supabase.auth.refreshSession();
      session = ref?.data?.session || null;
    } catch (e) {}
  }
  if (!session) { window.location.href = '/'; return; }

  // Sidebar footer version.
  const versionEl = document.getElementById('sb-version');
  if (versionEl) versionEl.textContent = `MC v${MC_VERSION}`;

  wireSignOut(supabase);

  const profile = await loadProfile(supabase, session.user.id);
  renderSidebar(profile);

  // Parallel data load.
  const [
    scan, history, monitoringActive, baselineTimes,
    alertOverview, criticalCount, opportunitiesCount, nextScanAt,
    feedAlerts, opportunityAlerts, actionAlerts,
  ] = await Promise.all([
    loadLatestScan(supabase, session.user.id),
    loadScanHistory(supabase, session.user.id),
    loadMonitoringActive(supabase, session.user.id),
    _loadBaselineTimes(supabase, session.user.id),
    loadAlertOverview(supabase, session.user.id),
    _countActionNeededAlerts(supabase, session.user.id),
    _countMonitorAlerts(supabase, session.user.id),
    loadNextScanAt(supabase, session.user.id),
    loadAlertFeed(supabase, session.user.id, 20),
    loadOpportunityAlerts(supabase, session.user.id, 5),
    loadActionAlerts(supabase, session.user.id, 10),
  ]);

  // Derived values.
  const artistName = (scan && scan.artist_name)
    || scan?.payload?.subject?.artistName
    || session.user?.email?.split('@')[0]
    || 'Artist';
  const score = _resolveHealthScoreFromSnapshot(scan);
  const band  = _healthBand(score);
  const conf  = _confidenceLabelForScan(scan);
  const outcomes = intelligenceOutcomes(scan, profile);
  const albums = scan?.payload?.platforms?.appleMusic?.details?.albums || [];

  // Top bar.
  renderArtistName(artistName);
  renderStatusBar({
    healthScore: score,
    monitoringActive,
    criticalCount,
    opportunitiesCount,
    totalChanges: alertOverview.total,
    confidenceLabel: conf.label,
    scanDate: scan?.scanned_at || scan?.created_at,
  });

  // Review sections.
  renderHeader({ artistName, score, band, lastReviewDate: scan?.scanned_at });
  renderAssessment({ band, conf, totalChanges: alertOverview.total, criticalCount });
  renderConfidence({ outcomes, conf });
  renderOpportunitySignals({ opportunityAlerts });
  renderBackendHighlights({ scan, monitoringActive });
  renderWhatChanged({ feedAlerts, baselineTimes, albums });
  renderActionsRequired({ actionAlerts });
  renderMonitoringStatus({ monitoringActive, scan, history, nextScanAt });

  _renderLucide();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
