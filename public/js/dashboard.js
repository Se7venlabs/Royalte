/* ═══════════════════════════════════════════════════════════════════
   ROYALTĒ DASHBOARD V1
   Render layer — populates dashboard.html from a single data object.

   V1 SCOPE:
     - Hardcoded mock data (one artist, one scan, fixed values)
     - No auth, no Stripe, no real backend
     - Money values shown as RANGES not specific dollars (Path B)
     - "Verified Data Only" tone preserved throughout

   V2 (LATER):
     - Add Supabase auth gate before render
     - Wire alerts, statement uploads, real scan history
     - One-line swap: see TODO comment in init()
   ═══════════════════════════════════════════════════════════════════ */

import { getSupabase } from '/js/supabase-client.js';


/* ─────────────────────────────────────────────
   DATA CONTRACT
   This is the JSON shape /api/dashboard must
   eventually return. Kept here as the single
   source of truth for backend + frontend.
   ───────────────────────────────────────────── */

/**
 * @typedef {Object} DashboardData
 * @property {Object} user
 * @property {string} user.fullName        - "Jordan Kai"
 * @property {string} user.plan            - "Artist Plan" | "Pro" | "Free"
 * @property {boolean} user.verified
 * @property {number} user.notifications
 *
 * @property {Object} score
 * @property {number} score.value          - 0–100
 * @property {string} score.headline       - "Your setup needs improvement"
 *
 * @property {Object} revenueRisk          - Path B: ranges, not exact dollars
 * @property {string} revenueRisk.range    - "$420 – $2,100 annually"
 * @property {string} revenueRisk.tier     - "high" | "medium" | "low"
 * @property {string} revenueRisk.tierLabel- "High"
 * @property {string} revenueRisk.confidence - "Moderate"
 * @property {string} revenueRisk.note     - "Exact exposure breakdown requires full audit"
 *
 * @property {Object} stats
 * @property {number} stats.issuesFound
 * @property {number} stats.thingsWorking
 *
 * @property {Object} recentScan
 * @property {string} recentScan.dateLabel   - "Apr 24, 2026 · 10:32 AM"
 * @property {string} recentScan.nextDateLabel - "May 24, 2026"
 * @property {number} recentScan.sourcesCount  - 10+
 *
 * @property {Object} identity
 * @property {?string} identity.artistName   - "Gentlemen X" or null
 * @property {string} identity.sourcePlatform - "spotify" | "apple_music"
 * @property {string} identity.resolvedFrom  - "spotify" | "apple_music" | "spotify_from_apple" | "spotify_and_apple"
 * @property {{spotify:boolean, appleMusic:boolean}} identity.platforms
 * @property {string} identity.scanStatus    - "verified" | "limited" | "pending"
 *
 * @property {Array<{date:string, tier:'low'|'med'|'high'}>} trend
 *   - 6 months of severity tier history (Path B: tier-based, not $)
 *
 * @property {Array<Issue>} issues
 * @property {Array<Action>} actionPlan
 *
 * @property {Array<Platform>} platforms
 * @property {number} platformsConnected
 * @property {number} platformsTotal
 */

/**
 * @typedef {Object} Issue
 * @property {string} id
 * @property {string} title           - "Missing ISRC for 3 tracks"
 * @property {string} desc            - "Tracks may not be properly tracked"
 * @property {string} severity        - "high" | "medium" | "low"
 * @property {string} impactLabel     - "Thousands at risk" | "Hundreds at risk" | "—"
 * @property {string} icon            - emoji or key
 */

/**
 * @typedef {Object} Action
 * @property {number} step
 * @property {string} title           - "Fix missing ISRCs (reduce revenue exposure)"
 * @property {string} meta            - "3 tracks"
 * @property {string} severity        - "high" | "medium" | "low"
 */

/**
 * @typedef {Object} Platform
 * @property {string} key             - "spotify" | "apple" | "youtube" | etc.
 * @property {string} name            - "Spotify"
 * @property {string} status          - "connected" | "available"
 */


/* ─────────────────────────────────────────────
   ICONS — inline SVG, kept in JS so HTML stays clean
   ───────────────────────────────────────────── */

const ICONS = {
  // sidebar nav
  dashboard:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  setup:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  issues:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  action:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  catalog:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  monitoring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  reports:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  settings:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  // issue category icons
  isrc:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>',
  yt:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>',
  pub:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  splits:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.85"/></svg>',
  tags:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  // misc
  arrow:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
};


/* ─────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────── */

function renderSidebar(data) {
  const navItems = [
    { id: "dashboard",  label: "Dashboard",  icon: "dashboard",  active: true  },
    { id: "setup",      label: "My Setup",   icon: "setup"   },
    { id: "issues",     label: "Issues Found", icon: "issues", badge: data.stats.issuesFound + "" },
    { id: "action",     label: "Action Plan",  icon: "action"  },
    { id: "catalog",    label: "Catalog",      icon: "catalog",    soonLabel: "Soon" },
    { id: "monitoring", label: "Monitoring",   icon: "monitoring" },
    { id: "reports",    label: "Reports",      icon: "reports" },
    { id: "settings",   label: "Settings",     icon: "settings" }
  ];

  const navHTML = navItems.map(item => {
    const badge = item.badge
      ? `<span class="sb-badge">${item.badge}</span>`
      : item.soonLabel
        ? `<span class="sb-badge soon">${item.soonLabel}</span>`
        : "";
    return `
      <a class="sb-link ${item.active ? 'active' : ''}" data-nav="${item.id}" href="#${item.id}">
        ${ICONS[item.icon]}
        <span class="sb-link-name">${item.label}</span>
        ${badge}
      </a>
    `;
  }).join("");

  document.getElementById("sb-nav").innerHTML = navHTML;

  // user pill
  const initials = (data.user.fullName || "")
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  document.getElementById("sb-user").innerHTML = `
    <div class="sb-user-avatar">${initials}</div>
    <div class="sb-user-info">
      <div class="sb-user-name">
        ${escapeHtml(data.user.fullName)}
        ${data.user.verified ? '<svg class="sb-user-verified" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none"/></svg>' : ''}
      </div>
      <div class="sb-user-plan">${escapeHtml(data.user.plan)}</div>
    </div>
  `;
}

// Sidebar upgrade card — profile-driven, not scan-driven, so it renders on
// every init() path (including the no-scan empty state). Three outcomes:
// pro → hidden; active trial → calm informational card, no CTA; otherwise
// (paused / pre-trial) → "Activate Monitoring" CTA. The CTA carries
// data-lock-cta so wireLockCTAs() smooth-scrolls it to #upgrade.
function renderSidebarUpgrade(profile) {
  const el = document.getElementById("sb-upgrade");
  if (!el) return;

  // Pro users have full active monitoring — no upgrade card at all.
  if (profile.tier === "pro") {
    el.style.display = "none";
    return;
  }
  el.style.display = "";

  const inTrial = profile.monitoring_status === "grace_period"
    && profile.trial_started_at != null;

  if (inTrial) {
    el.innerHTML = `
      <div class="sb-upgrade-state-trial">
        <div class="sb-upgrade-badge">Founding Artist Trial Active</div>
        <p class="sb-upgrade-body">Your backend is currently being actively monitored.</p>
        <p class="sb-upgrade-context">Your audit is your snapshot. Monitoring watches what changes next.</p>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="sb-upgrade-state-paused">
        <div class="sb-upgrade-badge">Monitoring Paused</div>
        <p class="sb-upgrade-body">Your audit remains available. Continuous monitoring and change detection are currently inactive.</p>
        <button class="sb-upgrade-cta" type="button" data-lock-cta>Activate Monitoring →</button>
      </div>
    `;
  }
}


/* ─────────────────────────────────────────────
   PAGE HEADER
   ───────────────────────────────────────────── */

function renderHeader(data) {
  document.getElementById("artist-name").textContent = data.user.fullName;
  document.getElementById("welcome-sub").textContent = "Last scan completed " + data.recentScan.dateLabel + ".";

  const bell = document.getElementById("bell-count");
  if (data.user.notifications > 0) {
    bell.textContent = data.user.notifications;
    bell.style.display = "flex";
  } else {
    bell.style.display = "none";
  }
}


/* ─────────────────────────────────────────────
   HERO BANNER (score ring + 3 stats)
   ───────────────────────────────────────────── */

function renderHeroBanner(data) {
  const score = clamp(data.score.value, 0, 100);

  // animate the score ring
  const arc = document.getElementById("score-arc");
  const circumference = 2 * Math.PI * 38; // r=38 → ~238.76
  const offset = circumference - (circumference * score / 100);
  // delay so the entrance fade plays first
  setTimeout(() => {
    arc.style.transition = "stroke-dashoffset 1.1s cubic-bezier(0.22,0.61,0.36,1)";
    arc.style.strokeDashoffset = offset;
  }, 250);

  document.getElementById("score-val").textContent = score + "%";
  document.getElementById("score-headline").textContent = data.score.headline;

  // revenue at risk (Path B: range string, not number)
  document.getElementById("stat-revenue").textContent = data.revenueRisk.range;
  const tierEl = document.getElementById("stat-revenue-tier");
  tierEl.textContent = data.revenueRisk.tierLabel;
  tierEl.className = "hero-stat-sub " + tierClass(data.revenueRisk.tier);

  const heroConf = document.getElementById("stat-revenue-conf");
  if (heroConf) heroConf.textContent = "Confidence: " + data.revenueRisk.confidence;

  document.getElementById("stat-issues").textContent  = data.stats.issuesFound;
  document.getElementById("stat-working").textContent = data.stats.thingsWorking;
}


/* ─────────────────────────────────────────────
   ARTIST IDENTITY CARD (inside hero banner)
   Renders artist name, resolved-from line, status,
   and platform pills based on scan data.
   ───────────────────────────────────────────── */

function renderHeroIdentity(data) {
  const id = data.identity || {};
  const platforms = id.platforms || {};
  const host = document.getElementById("hero-identity");
  if (!host) return;

  // Rule 6.1: artist name fallback
  const displayName = (id.artistName && id.artistName.trim())
    ? id.artistName
    : "Artist detected.";

  // resolved-from copy (Rule 6.5/6.6)
  let resolvedFromText = "";
  switch (id.resolvedFrom) {
    case "spotify":            resolvedFromText = "Spotify"; break;
    case "apple_music":        resolvedFromText = "Apple Music"; break;
    case "spotify_from_apple": resolvedFromText = "Matched from Apple → Spotify"; break;
    case "spotify_and_apple":  resolvedFromText = "Spotify + Apple Music"; break;
    default:                   resolvedFromText = "—";
  }

  // status row (verified/limited/pending)
  const isLimited = id.scanStatus === "limited" || id.resolvedFrom === "apple_music";
  const statusText = id.scanStatus === "pending"
    ? "Scan in progress"
    : isLimited
      ? "Limited scan complete"
      : "Verified scan complete";
  const statusIcon = id.scanStatus === "pending"
    ? `<span class="pulse-dot"></span>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

  // platform pills (Rule 6.3 / 6.4)
  const pills = [];
  if (platforms.spotify) {
    pills.push(`<span class="hi-pill verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      Spotify
    </span>`);
  }
  if (platforms.appleMusic) {
    pills.push(`<span class="hi-pill verified">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      Apple Music
    </span>`);
  }

  // amber fallback tag for Apple-only result (Rule 6.5)
  const fallbackTag = id.resolvedFrom === "apple_music"
    ? `<div class="hi-fallback">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
         Limited Apple result
       </div>`
    : "";

  // tiny avatar — image if provided, initials fallback otherwise
  const initials = (id.artistName || "")
    .split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const avatarInner = id.artistImage
    ? `<img src="${escapeHtml(id.artistImage)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'hi-avatar-initials',textContent:'${escapeHtml(initials)}'}))">`
    : `<span class="hi-avatar-initials">${escapeHtml(initials)}</span>`;

  // stale data banner (only when localStorage scan is older than 24h)
  const staleBanner = id._staleHours
    ? `<div class="hi-stale">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
         Showing scan from ${escapeHtml(id._staleHours)} ago
       </div>`
    : "";

  host.innerHTML = `
    <div class="hi-name-row">
      <div class="hi-avatar">${avatarInner}</div>
      <div class="hi-name-stack">
        <span class="hi-label">Artist</span>
        <span class="hi-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
      </div>
    </div>
    <div class="hi-row">
      <span class="hi-label">Resolved from</span>
      <span class="hi-resolved">${escapeHtml(resolvedFromText)}</span>
    </div>
    <div class="hi-status ${isLimited ? 'limited' : ''}">
      ${statusIcon}
      ${escapeHtml(statusText)}
    </div>
    ${pills.length ? `<div class="hi-pills">${pills.join("")}</div>` : ""}
    ${fallbackTag}
    ${staleBanner}
  `;
}


/* ─────────────────────────────────────────────
   REVENUE-AT-RISK CARD (chart + headline)
   Path B: chart paints severity tiers over time,
   not fake dollar amounts.
   ───────────────────────────────────────────── */

function renderRevenueCard(data) {
  document.getElementById("rev-amount").textContent = data.revenueRisk.range;

  const pill = document.getElementById("rev-tier-pill");
  pill.textContent = data.revenueRisk.tierLabel;
  pill.className = "rev-tier-pill " + tierClass(data.revenueRisk.tier);

  const revConf = document.getElementById("rev-confidence");
  if (revConf) revConf.textContent = "Confidence: " + data.revenueRisk.confidence;

  document.getElementById("rev-sub").textContent = data.revenueRisk.note;

  // build the chart silhouette from tier history
  const trend = data.trend || [];
  if (!trend.length) return;

  const W = 600, H = 180;
  const padL = 36, padR = 16, padT = 10, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const tierY = { low: padT + innerH * 0.85, med: padT + innerH * 0.5, high: padT + innerH * 0.15 };

  const stepX = innerW / Math.max(trend.length - 1, 1);
  const points = trend.map((p, i) => ({ x: padL + i * stepX, y: tierY[p.tier] || tierY.med, label: p.date }));

  // smooth path using simple cubic interpolation
  const linePath = smoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(H - padB).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - padB).toFixed(1)} Z`;

  document.getElementById("rev-line-path").setAttribute("d", linePath);
  document.getElementById("rev-area-path").setAttribute("d", areaPath);

  // x-axis labels
  const labelsHTML = points.map(p =>
    `<text x="${p.x.toFixed(1)}" y="${(H - 8).toFixed(0)}" font-family="Space Mono" font-size="10" fill="#8480a8" text-anchor="middle" letter-spacing="0.06em">${escapeHtml(p.label)}</text>`
  ).join("");
  document.getElementById("rev-x-labels").innerHTML = labelsHTML;
}


/* ─────────────────────────────────────────────
   RECENT SCAN CARD
   ───────────────────────────────────────────── */

function renderRecentScan(data) {
  document.getElementById("recent-scan-meta").textContent = data.recentScan.dateLabel;
  document.getElementById("next-scan-date").textContent  = data.recentScan.nextDateLabel;
}


/* ─────────────────────────────────────────────
   ISSUES LIST
   ───────────────────────────────────────────── */

function renderIssues(data) {
  const issues = data.issues || [];
  const VISIBLE = 3; // V1 lock: only show top 3
  const preview = issues.slice(0, VISIBLE);

  // total count from stats (may be larger than issues.length if backend caps the array)
  const total = Math.max(data.stats.issuesFound || 0, issues.length);
  const visibleShown = Math.min(preview.length, VISIBLE);
  const hiddenCount = Math.max(0, total - visibleShown);

  // pill format: "3 of 15"
  const pill = document.getElementById("issues-count");
  if (pill) {
    pill.textContent = total > 0 ? `${visibleShown} of ${total}` : "0";
  }

  const html = preview.map(issue => `
    <div class="issue-row" data-issue="${issue.id}">
      <div class="issue-ico ${tierClass(issue.severity)}">
        ${ICONS[issue.icon] || ICONS.issues}
      </div>
      <div class="issue-body">
        <div class="issue-title">${escapeHtml(issue.title)}</div>
        <div class="issue-desc">${escapeHtml(issue.desc)}</div>
      </div>
      <div class="issue-sev ${tierClass(issue.severity)}">${escapeHtml(severityLabel(issue.severity))}</div>
      <div class="issue-impact">${escapeHtml(issue.impactLabel)}</div>
    </div>
  `).join("");

  document.getElementById("issues-list").innerHTML = html;

  // locked overflow row (replaces old "+ N more issues" footer)
  const overflow = document.getElementById("issues-locked-overflow");
  const overflowH = document.getElementById("issues-locked-h");
  if (overflow && overflowH) {
    if (hiddenCount > 0) {
      overflowH.innerHTML = `🔒 ${hiddenCount} more issue${hiddenCount === 1 ? "" : "s"} hidden`;
      overflow.style.display = "flex";
    } else {
      overflow.style.display = "none";
    }
  }
}


/* ─────────────────────────────────────────────
   ACTION PLAN LIST
   ───────────────────────────────────────────── */

function renderActionPlan(data) {
  const actions = data.actionPlan || [];

  // V1 lock: action plan is always rendered as a blurred preview, with
  // .action-locked-overlay sitting on top. We still render the rows so
  // the blur looks like real content rather than empty space.
  const html = actions.map(a => `
    <div class="action-row" data-step="${a.step}">
      <div class="action-num">${a.step}</div>
      <div class="action-body">
        <div class="action-title">${escapeHtml(a.title)}</div>
        <div class="action-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/></svg>
          ${escapeHtml(a.meta)}
        </div>
      </div>
      <div class="action-pill ${tierClass(a.severity)}">${escapeHtml(severityLabel(a.severity))}</div>
      <div class="action-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
    </div>
  `).join("");

  document.getElementById("action-list").innerHTML = html;

  // dynamic locked copy (shown by .action-locked-overlay)
  const lockedD = document.getElementById("action-locked-d");
  if (lockedD) {
    const stepCount = actions.length || data.stats.issuesFound || 0;
    lockedD.textContent = stepCount > 0
      ? `${stepCount} step${stepCount === 1 ? "" : "s"} to address unclaimed setup issues — included in your Full Audit.`
      : `Your full step-by-step plan to address unclaimed setup issues is in the Full Audit.`;
  }
}


/* ─────────────────────────────────────────────
   LOCK STRIP (between revenue row and issues row)
   Surfaces dynamic counts of what's hidden + CTA.
   ───────────────────────────────────────────── */

function renderLockStrip(data) {
  const strip = document.getElementById("lock-strip");
  const desc  = document.getElementById("lock-strip-d");
  if (!strip || !desc) return;

  const totalIssues = Math.max(data.stats.issuesFound || 0, (data.issues || []).length);
  const hiddenIssues = Math.max(0, totalIssues - 3);
  const stepCount = (data.actionPlan || []).length;

  const parts = [];
  if (hiddenIssues > 0) parts.push(`<strong>${hiddenIssues} more issue${hiddenIssues === 1 ? "" : "s"}</strong>`);
  if (stepCount > 0)    parts.push(`<strong>your ${stepCount}-step action plan</strong>`);
  parts.push(`<strong>territory + sync detail</strong>`);

  // graceful joiner: "A, B + C"
  let body;
  if (parts.length === 1) body = `Unlock ${parts[0]} with the Full Audit.`;
  else if (parts.length === 2) body = `Unlock ${parts[0]} and ${parts[1]} with the Full Audit.`;
  else body = `Unlock ${parts[0]}, ${parts[1]} and ${parts[parts.length - 1]} with the Full Audit.`;

  desc.innerHTML = body;
  strip.style.display = "flex";
}


/* ─────────────────────────────────────────────
   PLATFORMS GRID
   ───────────────────────────────────────────── */

function renderPlatforms(data) {
  document.getElementById("platforms-meta").textContent =
    `Connected: ${data.platformsConnected} of ${data.platformsTotal}`;

  // logo content lookup (first letter / brand mark)
  const LOGO_CHAR = {
    spotify: "♪", apple: "", youtube: "▶",
    soundcloud: "☁", tiktok: "♫"
  };

  const tiles = (data.platforms || []).map(p => `
    <div class="platform-tile" data-platform="${p.key}">
      <div class="platform-logo ${p.key}">${LOGO_CHAR[p.key] || (p.name[0] || "?")}</div>
      <div class="platform-name">${escapeHtml(p.name)}</div>
      <div class="platform-status ${p.status}">${p.status === 'connected' ? 'Connected' : 'Available'}</div>
    </div>
  `).join("");

  // "+N More Platforms" tile
  const remaining = Math.max(0, data.platformsTotal - data.platforms.length);
  const moreTile = remaining > 0 ? `
    <div class="platform-tile more">
      <div class="platform-logo more">+${remaining}</div>
      <div class="platform-name">More Platforms</div>
      <div class="platform-status available">Available</div>
    </div>
  ` : "";

  document.getElementById("platforms-grid").innerHTML = tiles + moreTile;
}


/* ─────────────────────────────────────────────
   INTERACTIONS
   Wire up buttons — V1 uses console.log + alerts
   as placeholders. V2 will wire to real routes.
   ───────────────────────────────────────────── */

function wireInteractions() {
  // sidebar nav (V1: visual only — no routing)
  document.getElementById("sb-nav").addEventListener("click", (e) => {
    const link = e.target.closest("[data-nav]");
    if (!link) return;
    e.preventDefault();
    document.querySelectorAll(".sb-link").forEach(el => el.classList.remove("active"));
    link.classList.add("active");
    // V2: route to /dashboard/{id}
    console.log("[v1] nav →", link.dataset.nav);
  });

  // unlock CTAs — log which surface fired, then let the <a href="/#request"> navigate naturally
  document.querySelectorAll("[data-unlock]").forEach(el => {
    el.addEventListener("click", () => {
      console.log("[v1] unlock CTA →", el.getAttribute("data-unlock"));
    });
  });

  // issue / action / platform tile clicks (V1: log only)
  document.body.addEventListener("click", (e) => {
    const issue    = e.target.closest("[data-issue]");
    const step     = e.target.closest("[data-step]");
    const platform = e.target.closest("[data-platform]");
    if (issue)    console.log("[v1] open issue", issue.dataset.issue);
    // step rows live under the locked overlay — they're behind a blur and pointer-events:none on
    // the preview, but we also short-circuit any leaked clicks just in case
    if (step) {
      e.preventDefault();
      e.stopPropagation();
      console.log("[v1] action step locked — redirecting to unlock");
      window.location.href = "/#request";
      return;
    }
    if (platform) console.log("[v1] manage platform", platform.dataset.platform);
  });

  // "View All Issues" / "Manage Connections" / etc. — log clicks (real links navigate via href)
  document.querySelectorAll(".view-all, .manage-link, [data-jump]")
    .forEach(btn => btn.addEventListener("click", () => {
      console.log("[v1] CTA clicked:", btn.textContent.trim());
    }));
}


/* ─────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────── */

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function tierClass(tier) {
  if (tier === "high") return "high";
  if (tier === "medium" || tier === "med") return "med";
  return "low";
}

function severityLabel(tier) {
  if (tier === "high") return "High";
  if (tier === "medium" || tier === "med") return "Medium";
  return "Low";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// simple smooth path through points using midpoint averaging
function smoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` Q ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} ${cx.toFixed(1)} ${((p0.y + p1.y) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}


/**
 * Transform a canonical AuditResponse (audit_scans.payload, schema v1.0.0)
 * into the dashboard data contract. This is the Chunk 3 load path — the
 * dashboard reads the user's latest scan from Supabase, not localStorage.
 * Reuses the shared mapping helpers below.
 *
 * @param {Object} canonical - audit_scans.payload (canonical AuditResponse)
 * @returns {DashboardData}
 */
function mapCanonicalToDashboard(canonical) {
  canonical = canonical || {};
  const subject   = canonical.subject  || {};
  const scoreObj  = canonical.score    || {};
  const modules   = canonical.modules && typeof canonical.modules === "object" ? canonical.modules : {};
  const platforms = canonical.platforms && typeof canonical.platforms === "object" ? canonical.platforms : {};
  const issuesRaw = Array.isArray(canonical.issues) ? canonical.issues : [];

  // ── score ────────────────────────────────────
  const score = clamp(Math.round(Number(scoreObj.overall) || 0), 0, 100);
  const scoreHeadline = headlineForScore(score);

  // riskTier still drives the trend silhouette below — kept.
  const riskTier = mapRiskTier(scoreObj.riskLevel || riskFromScore(score));

  // ── revenue exposure — real royaltyGap numbers (Spotify-demotion Phase 2).
  // Replaces the canned tier-bucket strings: the hero stat is now a per-artist
  // estimate from royaltyGap.potentialGapLow/High. Tier label + confidence are
  // computed here from the canonical payload — no schema change.
  const royaltyGap    = canonical.royaltyGap || {};
  const metricsObj    = canonical.metrics || {};
  const gapLow        = Math.max(0, Math.round(Number(royaltyGap.potentialGapLow)  || 0));
  const gapHigh       = Math.max(0, Math.round(Number(royaltyGap.potentialGapHigh) || 0));
  const annualStreams = Number(royaltyGap.estAnnualStreams) || 0;
  const lastfmPlays   = Number(metricsObj.lastfmPlays) || 0;
  // Edge A — no Last.fm signal at all: honest "Limited data", not fake numbers.
  const exposureNoData = annualStreams === 0 || lastfmPlays === 0;
  const exposureTier   = exposureTierFromValue(gapHigh);
  const revenueRisk = exposureNoData
    ? {
        range: "$0 – $0 annually",
        tier: "low",
        tierLabel: "Limited data",
        confidence: "Limited",
        note: "Limited scan data — run a fresh scan for a fuller estimate.",
      }
    : {
        range: formatExposureRange(gapLow, gapHigh),
        tier: exposureTier.cssKey,
        tierLabel: exposureTier.label,
        confidence: confidenceFromLastfm(lastfmPlays),
        note: "Estimated from streaming activity. Recalibrated over the first 30 days of monitoring.",
      };

  // ── stats ────────────────────────────────────
  const issuesFound = issuesRaw.length;
  const modScores = Object.values(modules).map(m => Number(m && m.score) || 0);
  const thingsWorking = modScores.filter(s => s >= 75).length * 2;

  // ── recent scan dates ────────────────────────
  const scannedAt = canonical.scannedAt ? new Date(canonical.scannedAt) : new Date();
  const next = new Date(scannedAt.getTime()); next.setDate(next.getDate() + 30);

  // ── identity ─────────────────────────────────
  const spotifyOk = (platforms.spotify    || {}).availability === "VERIFIED";
  const appleOk   = (platforms.appleMusic || {}).availability === "VERIFIED";
  let resolvedFrom = "spotify";
  if (spotifyOk && appleOk)        resolvedFrom = "spotify_and_apple";
  else if (appleOk && !spotifyOk)  resolvedFrom = "apple_music";
  const identity = {
    artistName:     subject.artistName || null,
    artistImage:    null,
    sourcePlatform: spotifyOk ? "spotify" : (appleOk ? "apple_music" : "spotify"),
    resolvedFrom:   resolvedFrom,
    platforms: { spotify: spotifyOk, appleMusic: appleOk },
    scanStatus:     spotifyOk ? "verified" : (appleOk ? "limited" : "verified")
  };

  // ── trend (Path B: tier-based silhouette) ────
  const trend = buildTrendFromCurrentTier(riskTier);

  // ── issues + action plan ─────────────────────
  const issues = issuesRaw.slice(0, 5).map((it, i) => {
    const sev = normalizeSeverity(it.severity);
    return {
      id:          it.id || ("i" + (i + 1)),
      title:       it.title || "Issue detected",
      desc:        it.detail || it.title || "—",
      severity:    sev,
      impactLabel: impactLabelForSeverity(sev),
      icon:        iconKeyForFlag(it)
    };
  });

  const actionPlan = issuesRaw.slice(0, 5).map((it, i) => ({
    step:     i + 1,
    title:    actionTitleFromFlag(it),
    meta:     it.moduleName || "—",
    severity: normalizeSeverity(it.severity)
  }));

  // ── platforms grid ───────────────────────────
  const PLAT_META = {
    spotify:    { key: "spotify",    name: "Spotify" },
    appleMusic: { key: "apple",      name: "Apple Music" },
    youtube:    { key: "youtube",    name: "YouTube" },
    soundcloud: { key: "soundcloud", name: "SoundCloud" },
    deezer:     { key: "deezer",     name: "Deezer" },
    tidal:      { key: "tidal",      name: "Tidal" }
  };
  const platformList = [];
  Object.keys(PLAT_META).forEach(k => {
    const p = platforms[k];
    if (p && p.availability === "VERIFIED") {
      platformList.push({ key: PLAT_META[k].key, name: PLAT_META[k].name, status: "connected" });
    }
  });
  const platformsTotal = Object.keys(platforms).length || 15;

  // ── final assembly ───────────────────────────
  return {
    user: {
      fullName:  identity.artistName || "Artist",
      plan:      "Free Scan",
      verified:  identity.scanStatus === "verified",
      notifications: 0
    },
    score: { value: score, headline: scoreHeadline },
    revenueRisk,
    stats: { issuesFound, thingsWorking },
    recentScan: {
      dateLabel:     formatScanDate(scannedAt),
      nextDateLabel: formatNextDate(next),
      sourcesCount:  10
    },
    identity,
    trend,
    issues,
    actionPlan,
    platforms:  platformList,
    platformsConnected: platformList.length,
    platformsTotal:     platformsTotal
  };
}

/* ── mapping helpers ──────────────────────────── */

function pickFirst(values, fallback) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

/**
 * Look up the artist/album/track image URL across known shapes.
 * Order is intentional — exactly per spec.
 *   1. audit.imageUrl
 *   2. audit.artworkUrl
 *   3. audit.artistImageUrl
 *   4. audit.albumImageUrl
 *   5. audit.trackImageUrl
 *   6. audit.track?.album?.images?.[0]?.url
 *   7. audit.album?.images?.[0]?.url
 *   8. audit.artist?.images?.[0]?.url
 * Returns null if none yield a usable URL string → initials fallback.
 */
function pickArtistImage(audit) {
  if (!audit || typeof audit !== "object") return null;

  const candidates = [
    audit.imageUrl,
    audit.artworkUrl,
    audit.artistImageUrl,
    audit.albumImageUrl,
    audit.trackImageUrl,
    audit.track && audit.track.album && audit.track.album.images && audit.track.album.images[0] && audit.track.album.images[0].url,
    audit.album && audit.album.images && audit.album.images[0] && audit.album.images[0].url,
    audit.artist && audit.artist.images && audit.artist.images[0] && audit.artist.images[0].url
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}


function normalizeSeverity(s) {
  s = String(s || "").toLowerCase();
  if (s === "high"   || s === "critical") return "high";
  if (s === "low"    || s === "info")     return "low";
  return "medium";
}

function mapRiskTier(v) {
  if (typeof v === "number") {
    if (v >= 70) return "high";
    if (v >= 40) return "medium";
    return "low";
  }
  const s = String(v || "").toLowerCase();
  if (s.includes("high"))   return "high";
  if (s.includes("low"))    return "low";
  return "medium";
}

function riskFromScore(score) {
  // inverse: lower score = higher risk
  if (score < 50) return "high";
  if (score < 75) return "medium";
  return "low";
}

/* ── Revenue Exposure helpers (Spotify-demotion Phase 2) ─────────── */

// Compact USD formatting — $X / $XK / $X.XM.
function fmtMoney(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v >= 1000000) return "$" + (v / 1000000).toFixed(v >= 10000000 ? 0 : 1) + "M";
  if (v >= 1000)    return "$" + Math.round(v / 1000) + "K";
  return "$" + v;
}

function formatExposureRange(low, high) {
  return fmtMoney(low) + " – " + fmtMoney(high) + " annually";
}

// Exposure tier label — locked PR A thresholds on royaltyGap.potentialGapHigh.
// cssKey feeds tierClass() for the existing high/med/low pill styling.
function exposureTierFromValue(high) {
  const h = Number(high) || 0;
  if (h >= 10000) return { label: "Significant exposure", cssKey: "high" };
  if (h >= 1000)  return { label: "Moderate exposure",    cssKey: "medium" };
  if (h >= 100)   return { label: "Limited exposure",     cssKey: "low" };
  return { label: "Minimal exposure", cssKey: "low" };
}

// Confidence from Last.fm play volume — aligns with Phase 1 Scale Confidence.
function confidenceFromLastfm(plays) {
  const p = Number(plays) || 0;
  if (p >= 10000000) return "High";
  if (p >= 100000)   return "Moderate";
  return "Limited";
}

function impactLabelForSeverity(sev) {
  if (sev === "high")   return "Significant exposure";
  if (sev === "medium") return "Moderate exposure";
  return "Limited exposure";
}

function headlineForScore(score) {
  if (score >= 85) return "Your setup is solid";
  if (score >= 70) return "Your setup needs improvement";
  if (score >= 50) return "Multiple gaps detected";
  return "Critical gaps detected";
}

function detectSourcePlatform(audit, platforms) {
  if (audit.sourcePlatform) return String(audit.sourcePlatform).toLowerCase();
  if (platforms.spotify    && platforms.spotify.found    !== false) return "spotify";
  if (platforms.appleMusic && platforms.appleMusic.found !== false) return "apple_music";
  if (platforms.apple      && platforms.apple.found      !== false) return "apple_music";
  return "spotify";
}

function detectResolvedFrom(audit, platforms) {
  if (audit.resolvedFrom) return audit.resolvedFrom;
  const sp = !!(platforms.spotify    && platforms.spotify.found    !== false);
  const ap = !!((platforms.appleMusic && platforms.appleMusic.found !== false) ||
                (platforms.apple      && platforms.apple.found      !== false));
  if (sp && ap) return "spotify_and_apple";
  if (sp) return "spotify";
  if (ap) return "apple_music";
  return "spotify";
}

function detectScanStatus(audit) {
  if (audit.scanStatus) return String(audit.scanStatus).toLowerCase();
  // Apple-only scans have less data — flag as limited
  const platforms = audit.platforms || {};
  const sp = !!(platforms.spotify    && platforms.spotify.found    !== false);
  const ap = !!((platforms.appleMusic && platforms.appleMusic.found !== false) ||
                (platforms.apple      && platforms.apple.found      !== false));
  if (!sp && ap) return "limited";
  return "verified";
}

function iconKeyForFlag(f) {
  const key = String((f && (f.category || f.type || f.code || f.title)) || "").toLowerCase();
  if (key.includes("isrc"))     return "isrc";
  if (key.includes("youtube") || key.includes("content id")) return "yt";
  if (key.includes("publish")) return "pub";
  if (key.includes("split"))   return "splits";
  if (key.includes("tag") || key.includes("metadata")) return "tags";
  return "isrc";
}

function actionTitleFromFlag(f) {
  const t = String((f && (f.title || f.message || f.name)) || "").toLowerCase();
  if (t.includes("isrc"))            return "Fix missing ISRCs (reduce revenue exposure)";
  if (t.includes("content id"))      return "Claim YouTube Content ID (reduce revenue exposure)";
  if (t.includes("publish"))         return "Link publishing to recordings";
  if (t.includes("split"))           return "Review & update splits";
  if (t.includes("tag") || t.includes("metadata")) return "Add editorial tags";
  return f && f.title ? "Fix: " + f.title : "Review issue";
}

function buildTrendFromCurrentTier(tier) {
  // V1: no historical data — paint a flat current-tier line
  return [
    { date: "Feb", tier },
    { date: "Mar", tier },
    { date: "Apr", tier },
    { date: "May", tier },
    { date: "Jun", tier },
    { date: "Jul", tier }
  ];
}

function formatScanDate(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${min} ${ampm}`;
}

function formatNextDate(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}


/* ─────────────────────────────────────────────
   INIT — auth-gated; loads the user's latest scan
   ───────────────────────────────────────────── */

function renderAll(data) {
  renderSidebar(data);
  renderHeader(data);
  renderHeroBanner(data);
  renderHeroIdentity(data);
  renderRevenueCard(data);
  renderRecentScan(data);
  renderLockStrip(data);
  renderIssues(data);
  renderActionPlan(data);
  renderPlatforms(data);
  wireInteractions();
}

function renderEmptyState() {
  // Only the scan-dependent content is swapped — the Welcome panel and the
  // Pricing section live outside #scan-content and survive the empty state.
  const target = document.getElementById("scan-content");
  if (!target) return;
  target.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48vh;text-align:center;gap:14px;padding:40px;">
      <h1 style="font-family:'Rajdhani',sans-serif;font-size:28px;text-transform:uppercase;letter-spacing:0.04em;margin:0;">No scans yet</h1>
      <p style="opacity:0.7;margin:0;">Run your first catalog audit to see your dashboard.</p>
      <a href="/" class="scan-btn">Run a scan</a>
    </div>`;
}

async function loadLatestScan(supabase, userId) {
  // Block D: the dashboard reads living backend state from scan_snapshots
  // (latest by sequence_number) — the monitoring cron writes new snapshots
  // there. Falls back to audit_scans for any user without a snapshot yet.
  // TODO(post-Block-D): drop the audit_scans fallback once snapshot coverage
  // is confirmed for all users (tracked in LAUNCH_CHECKLIST Block D follow-ups).
  const { data: snapshots, error } = await supabase
    .from("scan_snapshots")
    .select("id, payload, created_at, sequence_number")
    .eq("user_id", userId)
    .order("sequence_number", { ascending: false })
    .limit(1);
  if (error) console.error("[dashboard] snapshot fetch failed", error);
  if (snapshots && snapshots.length) return snapshots[0];

  const { data: scans, error: scanErr } = await supabase
    .from("audit_scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (scanErr) {
    console.error("[dashboard] scan fetch failed", scanErr);
    return null;
  }
  return (scans && scans.length) ? scans[0] : null;
}

function wireSignOut(supabase) {
  const btn = document.getElementById("sign-out-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[dashboard] sign-out failed", e);
    }
    window.location.href = "/";
  });
}

async function loadProfile(supabase, userId) {
  const fallback = {
    tier: "free",
    monitoring_status: "inactive",
    next_rescan_at: null,
    trial_started_at: null,
    founding_artist: false,
  };
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("tier, monitoring_status, next_rescan_at, trial_started_at, founding_artist")
      .eq("id", userId)
      .single();
    if (error || !data) return fallback;
    return data;
  } catch (e) {
    console.error("[dashboard] profile read failed", e);
    return fallback;
  }
}

/* ── Block D — Monitoring section (tier + monitoring_status aware) ── */

function relativeTimePast(date) {
  const ms = Date.now() - date.getTime();
  if (ms < 36e5) return "less than an hour ago";
  const hours = Math.floor(ms / 36e5);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function relativeTimeFuture(date) {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "soon";
  const days = Math.ceil(ms / 864e5);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

function changeLabel(c) {
  const p = c.payload || {};
  switch (c.change_type) {
    case "issue_new":           return `New issue detected: ${p.title || "issue"}`;
    case "issue_resolved":      return `Issue resolved: ${p.title || "issue"}`;
    case "score_change":        return `Health score ${p.delta > 0 ? "improved" : "changed"}: ${p.from} → ${p.to}`;
    case "revenue_risk_change": return `Revenue exposure: ${p.from} → ${p.to}`;
    case "platform_change":     return `Platform ${p.to === "connected" ? "connected" : "disconnected"}: ${p.platform}`;
    default:                    return "Change detected";
  }
}

async function loadMonitoringState(supabase, userId, profile, latestScan) {
  const section = document.getElementById("monitoring");
  if (!section) return;

  const activeEl   = section.querySelector(".monitoring-active");
  const inactiveEl = section.querySelector(".monitoring-inactive");
  const graceEl    = section.querySelector(".monitoring-grace");
  const badge      = section.querySelector(".monitoring-status-badge");
  [activeEl, inactiveEl, graceEl].forEach(el => { if (el) el.style.display = "none"; });

  const isPro = profile.tier === "pro";

  // Pro — continuous active monitoring.
  if (isPro) {
    if (badge) { badge.textContent = "Active"; badge.className = "monitoring-status-badge active"; }
    if (activeEl) activeEl.style.display = "";

    const lastEl = section.querySelector(".last-monitored");
    if (lastEl && latestScan && latestScan.created_at) {
      lastEl.textContent = "Last monitored " + relativeTimePast(new Date(latestScan.created_at));
    }
    const nextEl = section.querySelector(".next-rescan");
    if (nextEl) {
      nextEl.textContent = profile.next_rescan_at
        ? "Next rescan " + relativeTimeFuture(new Date(profile.next_rescan_at))
        : "Next rescan scheduled";
    }

    const listEl = section.querySelector("#recent-changes-list");
    if (listEl) {
      const since = new Date(Date.now() - 14 * 864e5).toISOString();
      const { data: changes } = await supabase
        .from("scan_changes")
        .select("change_type, payload, created_at")
        .eq("user_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (changes && changes.length) {
        listEl.innerHTML = changes.map(c =>
          `<li><span class="change-text">${escapeHtml(changeLabel(c))}</span>` +
          `<span class="change-when">${escapeHtml(relativeTimePast(new Date(c.created_at)))}</span></li>`
        ).join("");
      } else {
        listEl.innerHTML = `<li class="change-empty">No changes detected yet — your backend is being watched.</li>`;
      }
    }
    return;
  }

  // Free + inactive — monitoring spent, protection-loss messaging.
  if (profile.monitoring_status === "inactive") {
    if (badge) { badge.textContent = "Paused"; badge.className = "monitoring-status-badge inactive"; }
    if (inactiveEl) inactiveEl.style.display = "";
    const metaEl = section.querySelector(".inactive-meta");
    if (metaEl && latestScan && latestScan.created_at) {
      metaEl.textContent =
        `Last monitored ${new Date(latestScan.created_at).toLocaleDateString()}. Continuous monitoring and change detection are currently inactive.`;
    }
    return;
  }

  // Free + grace_period (default) — subtle "active, next rescan in N days".
  if (badge) { badge.textContent = "Active"; badge.className = "monitoring-status-badge grace"; }
  if (graceEl) graceEl.style.display = "";
  const graceNext = section.querySelector(".grace-next");
  if (graceNext) {
    graceNext.textContent = profile.next_rescan_at
      ? "Next rescan " + relativeTimeFuture(new Date(profile.next_rescan_at))
      : "Next rescan scheduled";
  }
}

// Lock CTAs smooth-scroll to the in-dashboard #upgrade placeholder.
// Pro users see no overlays, so these listeners are inert for them.
// Block C swaps the scroll for real Stripe checkout — data-lock-cta
// is the stable contract for that future swap.
function wireLockCTAs() {
  document.querySelectorAll("[data-lock-cta]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = document.getElementById("upgrade");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ── Block D.2 — Trial activation + countdown ───────────────────── */

// First-login trial activation. Signups land monitoring_status='inactive'
// with no trial history; the 14-day trial starts the first time the user
// opens the OS. Only flips inactive users with trial_started_at still null —
// grace_period users (already in a trial) and anyone with a recorded trial
// are skipped. On failure the user stays inactive and retries next load.
async function activateTrialIfNeeded(supabase, userId, profile) {
  if (profile.monitoring_status !== "inactive") return profile;
  if (profile.trial_started_at != null) return profile;

  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        monitoring_status: "grace_period",
        trial_started_at: now.toISOString(),
        next_rescan_at: trialEnd.toISOString(),
      })
      .eq("id", userId)
      .select("tier, monitoring_status, next_rescan_at, trial_started_at, founding_artist")
      .single();
    if (error || !data) {
      console.error("[dashboard] trial activation failed", error);
      return profile;
    }
    return data;
  } catch (e) {
    console.error("[dashboard] trial activation failed", e);
    return profile;
  }
}

// Calm trial countdown banner — shown only during an active trial
// (grace_period + trial_started_at set). Hidden once the window lapses;
// the cron flips the row to inactive, this is just a stale-data buffer.
function renderTrialBanner(profile) {
  const banner = document.getElementById("trial-banner");
  if (!banner) return;

  const inGrace = profile.monitoring_status === "grace_period";
  const trialStarted = profile.trial_started_at != null;
  if (!inGrace || !trialStarted) {
    banner.style.display = "none";
    return;
  }

  const trialEnd = new Date(profile.next_rescan_at);
  const daysRemaining = Math.ceil((trialEnd - new Date()) / 864e5);
  if (daysRemaining <= 0) {
    banner.style.display = "none";
    return;
  }

  const numEl = document.getElementById("trial-days-num");
  if (numEl) numEl.textContent = String(daysRemaining);
  const labelEl = document.getElementById("trial-days-label");
  if (labelEl) labelEl.textContent = daysRemaining === 1 ? "day remaining" : "days remaining";
  banner.style.display = "";
}

/* ── V5 Phase 2 — Welcome panel + Founding Artist pricing ───────── */

function renderWelcomePanel(profile) {
  const sub = document.getElementById("welcome-panel-sub");
  if (!sub) return;
  if (profile.founding_artist === true) {
    sub.textContent = "Founding Artist Access — thank you for being early.";
  } else if (profile.tier === "pro") {
    sub.textContent = "Pro Member — your backend is actively monitored.";
  } else {
    sub.textContent = "Backend visibility, audit history, and ongoing monitoring — built for working artists.";
  }
}

async function loadReservation(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("founding_artist_reservations")
      .select("email, created_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) { console.error("[dashboard] reservation read failed", error); return null; }
    return data || null;
  } catch (e) {
    console.error("[dashboard] reservation read failed", e);
    return null;
  }
}

function fillConfirmedState(confirmed, email) {
  if (!confirmed) return;
  const sub = confirmed.querySelector(".cta-confirmed-sub");
  if (sub) sub.textContent = `We'll notify you when checkout opens. Reserved spot for ${email}.`;
  confirmed.style.display = "";
}

function renderPricing(profile, reservation) {
  const section = document.getElementById("pricing");
  if (!section) return;
  // Pro users already have full access — hide pricing entirely. A
  // "Manage Subscription" replacement is Block C scope.
  if (profile.tier === "pro") { section.style.display = "none"; return; }

  const cta = document.getElementById("reserve-founding-artist");
  const confirmed = document.getElementById("founding-artist-confirmed");
  if (reservation) {
    if (cta) cta.style.display = "none";
    fillConfirmedState(confirmed, reservation.email);
  } else {
    if (cta) cta.style.display = "";
    if (confirmed) confirmed.style.display = "none";
  }
}

function wireReservationFlow(session) {
  const cta = document.getElementById("reserve-founding-artist");
  if (!cta) return;
  cta.addEventListener("click", () => handleReserveClick(session, cta));
}

async function handleReserveClick(session, cta) {
  // Block F Step 4 — admins may be viewing a synthetic preview state; never
  // let a preview produce a real reservation write.
  if (window.__royalteIsAdmin) { console.log("[admin] reservation skipped — preview mode"); return; }
  const email = session?.user?.email;
  const errEl = document.getElementById("founding-artist-error");
  if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
  if (!email) {
    if (errEl) { errEl.textContent = "Couldn't read your account email — please refresh and try again."; errEl.style.display = ""; }
    return;
  }

  const originalText = cta.textContent;
  cta.disabled = true;
  cta.textContent = "Reserving…";

  try {
    const resp = await fetch("/api/founding-artist/reserve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + session.access_token,
      },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || !data.success) {
      throw new Error(data.error || ("HTTP " + resp.status));
    }
    // Success — flip to the confirmed state.
    cta.style.display = "none";
    fillConfirmedState(document.getElementById("founding-artist-confirmed"), email);
  } catch (e) {
    console.error("[dashboard] reservation failed", e);
    cta.disabled = false;
    cta.textContent = originalText;
    if (errEl) {
      errEl.textContent = "Couldn't reserve your spot — please try again in a moment.";
      errEl.style.display = "";
    }
  }
}

/* ── Block G.1 — Artist Footprint ───────────────────────────────── */

// Scale confidence — Last.fm-based buckets (Spotify demoted, Path A:
// Spotify Development Mode no longer returns follower/popularity data).
// Thresholds are INITIAL — recalibrate against real beta data later.
function scaleConfidence(listeners, plays) {
  const l = Number(listeners);
  const p = Number(plays);
  if (l >= 1000000 || p >= 100000000) {
    return { label: "Strong", desc: "Established audience with strong streaming history." };
  }
  if (l >= 100000 || p >= 10000000) {
    return { label: "Moderate", desc: "Growing audience with developing reach." };
  }
  return { label: "Limited", desc: "Early-stage reach — your footprint is still developing." };
}

// Cross-platform presence — one uniform rule: platforms.<key>.availability
// === 'VERIFIED', across all 8 catalog-network platforms. No raw booleans,
// no >0 proxies — availability is the canonical presence contract.
function crossPlatformPresence(payload) {
  const platforms = (payload && payload.platforms) || {};
  const checks = [
    ["appleMusic", "Apple Music"], ["lastfm", "Last.fm"], ["musicbrainz", "MusicBrainz"],
    ["deezer", "Deezer"], ["youtube", "YouTube"], ["discogs", "Discogs"],
    ["soundcloud", "SoundCloud"], ["wikipedia", "Wikipedia"],
  ];
  const list = checks
    .filter(([key]) => (platforms[key] || {}).availability === "VERIFIED")
    .map(([, name]) => name);
  const count = list.length;
  let tier;
  if (count >= 6)      tier = "Detected across the major catalog network";
  else if (count >= 4) tier = "Detected on " + count + " major platforms";
  else                 tier = "Limited platform presence";
  return { count, list, tier };
}

// Reads the canonical scan payload directly (metrics.* / platforms.*.availability
// are the stable contract). Spotify-free — followers/popularity were removed
// when Spotify was demoted to supplementary. Number.isFinite guards are
// defensive: metrics.* are required numbers, so the realistic degraded value
// is 0 (honest zeros), not null.
function renderArtistFootprint(payload) {
  const card = document.getElementById("artist-footprint");
  if (!card) return;

  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const fmt = (n) => Number.isFinite(n) ? n.toLocaleString("en-US") : "—";

  const p         = payload || {};
  const metrics   = p.metrics || {};
  const apple     = (p.platforms || {}).appleMusic || {};

  const lastfmListeners = Number(metrics.lastfmListeners);
  const lastfmPlays     = Number(metrics.lastfmPlays);
  const deezerFans      = Number(metrics.deezerFans);

  // #1 Last.fm Listeners — edge A: honest zeros.
  set("af-lastfm-listeners", fmt(lastfmListeners));

  // #2 Last.fm Plays (cumulative).
  set("af-lastfm-plays", Number.isFinite(lastfmPlays)
    ? lastfmPlays.toLocaleString("en-US") + " plays" : "—");

  // #3 Apple Music Releases — edge C: "25+" at the 25-album cap; edge D:
  // AUTH_UNAVAILABLE / ERROR dash out; NOT_FOUND reads as a plain gap.
  const appleAvail = apple.availability;
  if (appleAvail === "AUTH_UNAVAILABLE" || appleAvail === "ERROR") {
    set("af-apple-releases", "—");
  } else if (appleAvail === "VERIFIED") {
    const count = Number(apple.details && apple.details.albumCount);
    set("af-apple-releases", Number.isFinite(count) ? (count >= 25 ? "25+" : String(count)) : "—");
  } else {
    set("af-apple-releases", "Not on Apple Music");
  }

  // #4 Deezer Fans — edge A: honest zeros.
  set("af-deezer-fans", fmt(deezerFans));

  // #5 Cross-Platform Presence.
  const presence = crossPlatformPresence(p);
  set("af-presence", presence.tier);
  set("af-presence-list", presence.list.join(", "));

  // #6 Scale Confidence — Last.fm-based.
  const scale = scaleConfidence(lastfmListeners, lastfmPlays);
  set("af-scale", scale.label);
  set("af-scale-desc", scale.desc);

  // Edge E — all platform sources degraded (should not happen; the engine
  // degrades gracefully). Defensive annotation only.
  const note = document.getElementById("af-degraded-note");
  if (note) note.style.display = presence.count === 0 ? "" : "none";
}

/* ── Block F Step 4 — Admin preview-state tooling ───────────────── */

// Admin status is server-enforced: the admin_users RLS policy
// (auth.uid() = user_id) returns the caller's own row only, so a
// non-admin gets zero rows and this resolves false — it cannot be faked
// from the frontend. State-mutating paths check window.__royalteIsAdmin.
async function checkAdminStatus(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from("admin_users")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch (err) {
    console.error("[admin] check failed", err);
    return false;
  }
}

// Synthetic profile for ?preview_state= — render-only, never written back.
// Returns null for an unknown key (caller leaves the real profile intact).
function getSyntheticProfile(state) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (state) {
    case "trial_active":
      return {
        tier: "free", founding_artist: false, monitoring_status: "grace_period",
        trial_started_at: new Date(now - 7 * day).toISOString(),
        next_rescan_at:   new Date(now + 7 * day).toISOString(),
      };
    case "paused":
      return {
        tier: "free", founding_artist: false, monitoring_status: "inactive",
        trial_started_at: new Date(now - 30 * day).toISOString(),
        next_rescan_at:   null,
      };
    case "monthly_paid":
      return {
        tier: "pro", founding_artist: false, monitoring_status: "active",
        trial_started_at: null,
        next_rescan_at:   new Date(now + 7 * day).toISOString(),
      };
    case "founding_artist":
      return {
        tier: "pro", founding_artist: true, monitoring_status: "active",
        trial_started_at: null,
        next_rescan_at:   new Date(now + 7 * day).toISOString(),
      };
    case "pre_trial":
      return {
        tier: "free", founding_artist: false, monitoring_status: "inactive",
        trial_started_at: null, next_rescan_at: null,
      };
    default:
      return null;
  }
}

async function init() {
  // Auth gate — no active session means no dashboard. Redirect home.
  const supabase = getSupabase();
  if (!supabase) { window.location.href = "/"; return; }

  let session = null;
  try {
    const res = await supabase.auth.getSession();
    session = res.data.session;
  } catch (e) {
    console.error("[dashboard] getSession failed", e);
  }
  if (!session) { window.location.href = "/"; return; }

  wireSignOut(supabase);

  // Block F Step 4 — admin status (server-enforced via admin_users RLS).
  // The global flag gates state-mutating paths (reservation writes,
  // activateTrialIfNeeded) so admin preview mode never touches real data.
  const isAdmin = await checkAdminStatus(supabase, session.user.id);
  window.__royalteIsAdmin = isAdmin;

  // Profile drives tier gating (body class), the monitoring section, the
  // welcome panel, and pricing. Defaults to free / grace_period on failure.
  let profile = await loadProfile(supabase, session.user.id);

  // Block F Step 4 — admin ?preview_state= override. Synthetic profile,
  // render-only, no DB writes. Ignored entirely for non-admins.
  if (isAdmin) {
    const previewState = new URLSearchParams(location.search).get("preview_state");
    if (previewState) {
      const synthetic = getSyntheticProfile(previewState);
      if (synthetic) {
        profile = { ...profile, ...synthetic };
        console.log("[admin] preview state:", previewState, profile);
      }
    }
  }

  // Block D.2 — start the 14-day trial on first OS login. Runs before any
  // render so the welcome panel, trial banner, and monitoring section all
  // see the activated state. Skipped for admins — they are not real
  // customers, and a synthetic 'inactive' preview must never trigger the
  // grace_period DB write inside activateTrialIfNeeded.
  if (!isAdmin) {
    profile = await activateTrialIfNeeded(supabase, session.user.id, profile);
  }
  document.body.classList.add("tier-" + profile.tier);

  // Welcome panel + trial banner render on every path — including the no-scan
  // empty state — so they live outside #scan-content.
  renderWelcomePanel(profile);
  renderTrialBanner(profile);
  renderSidebarUpgrade(profile);

  // Load the user's latest scan. Only #scan-content is scan-dependent.
  const scan = await loadLatestScan(supabase, session.user.id);
  if (!scan || !scan.payload) {
    renderEmptyState();
  } else {
    renderAll(mapCanonicalToDashboard(scan.payload));
    // Block G.1 — Artist Footprint reads the raw canonical payload directly.
    renderArtistFootprint(scan.payload);
    // Block D — Monitoring section (tier + monitoring_status aware).
    await loadMonitoringState(supabase, session.user.id, profile, scan);
  }

  // V5 Phase 2 — Founding Artist pricing + reservation flow. Renders on
  // every path so a no-scan user still sees pricing.
  const reservation = await loadReservation(supabase, session.user.id);
  renderPricing(profile, reservation);
  wireReservationFlow(session);

  // Wire lock CTAs after all gated sections are in the DOM.
  wireLockCTAs();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
