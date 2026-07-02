// ─────────────────────────────────────────────────────────────────────────────
// lib/render-audit-pdf.js
//
// Executive Brief™ v1.0 — Presentation Layer
//
// Renders a Royaltē Executive Brief™ PDF for a saved scan (audit_scans row).
// All intelligence is sourced exclusively from payload.* intelligence objects
// assembled by the Royaltē Intelligence Pipeline™. No business logic lives
// here — this is a display layer only.
//
// Pipeline:
//   1. Load audit_scans row by id.
//   2. Read assembled intelligence objects from payload.*.
//   3. Fill lib/executive-brief-template-v1.html with placeholder values.
//   4. POST filled HTML to PDFShift /v3/convert/pdf, get PDF buffer.
//   5. Upload buffer to Supabase Storage bucket 'audit-reports'.
//   6. Update audit_scans row (pdf_status/pdf_url/pdf_rendered_at).
//
// Public API:
//   renderAuditPdf(scanId) → { scanId, pdfUrl, pdfStatus, alreadyRendered }
//   _buildPlaceholdersForTest(payload, scanId) → map (test helper, no I/O)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFile }     from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname         = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH     = join(__dirname, 'executive-brief-template-v1.html');
const STORAGE_BUCKET    = 'audit-reports';
const PDFSHIFT_ENDPOINT = 'https://api.pdfshift.io/v3/convert/pdf';

// Ring circumference for r=50 SVG circle: 2π × 50 ≈ 314.16
const RING_CIRCUMFERENCE = 314.16;

// ── Supabase client ───────────────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[render-audit-pdf] Supabase credentials not configured');
  return createClient(url, key);
}

// ── HTML escape ────────────────────────────────────────────────────────────────
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Filename sanitizer ────────────────────────────────────────────────────────
function sanitizeFilenamePart(s) {
  if (!s) return 'Artist';
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80) || 'Artist';
}

// ── Date formatter ────────────────────────────────────────────────────────────
function formatScanDate(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(d);
  } catch { return 'Unknown'; }
}

// ── Status label → CSS class (constitutional presentation mapping only) ───────
// Reads a CIM-certified status label; maps to a CSS class.
// No thresholds. No score comparisons. No intelligence.
// CIM source: healthIntelligence.status / healthIntelligence.domainStatuses.*
function statusToCls(status) {
  if (status === 'Excellent')    return { label: 'Excellent',    cls: 'excellent' };
  if (status === 'Strong')       return { label: 'Strong',       cls: 'strong'    };
  if (status === 'Moderate')     return { label: 'Moderate',     cls: 'moderate'  };
  return                                { label: 'Needs Review', cls: 'review'    };
}

// ── Coverage status label → CSS pill (constitutional presentation mapping) ────
// CIM source: publishingIntelligence.coverageStatus
function coverageStatusPill(status) {
  if (status === 'Verified')  return { label: 'Verified',    cls: 'verified'   };
  if (status === 'Partial')   return { label: 'Partial',     cls: 'partial'    };
  if (status === 'Limited')   return { label: 'Limited',     cls: 'review'     };
  if (status === 'Not Found') return { label: 'Not Found',   cls: 'review'     };
  return                             { label: 'Unavailable', cls: 'unavailable' };
}

// ── Score → CSS bar width (%): clamp to 4-100 for visual clarity ─────────────
function barPct(score) {
  const s = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : 0;
  return Math.max(4, s);
}

// ── Availability/coverage → pill label + class ────────────────────────────────
function availToPill(state) {
  if (!state) return { label: 'Unknown', cls: 'unavailable' };
  const s = String(state).toUpperCase();
  if (s === 'VERIFIED'           ) return { label: 'Verified',    cls: 'verified'   };
  if (s === 'ACTIVE'             ) return { label: 'Active',      cls: 'verified'   };
  if (s === 'PARTIAL'            ) return { label: 'Partial',     cls: 'partial'    };
  if (s === 'AUTH_UNAVAILABLE'   ) return { label: 'Unavailable', cls: 'unavailable'};
  if (s === 'UNABLE_TO_CONFIRM'  ) return { label: 'Unconfirmed', cls: 'partial'    };
  if (s === 'NOT_FOUND'          ) return { label: 'Not Found',   cls: 'review'     };
  return { label: esc(state), cls: 'unavailable' };
}

// ── AI confidence string → percentage ────────────────────────────────────────
function confidenceToPct(conf) {
  if (!conf) return 40;
  const s = String(conf).toLowerCase();
  if (s === 'high')     return 87;
  if (s === 'moderate') return 65;
  if (s === 'partial')  return 55;
  return 40;
}

// ── Confidence → display label ────────────────────────────────────────────────
function confidenceLabel(conf) {
  if (!conf) return 'Limited Confidence';
  const s = String(conf).toLowerCase();
  if (s === 'high')     return 'High Confidence';
  if (s === 'moderate') return 'Moderate Confidence';
  if (s === 'partial')  return 'Partial Confidence';
  return 'Limited Confidence';
}

// ── Domain icon SVG paths (purple fill) ──────────────────────────────────────
const DOMAIN_ICONS = {
  Identity:   `<svg viewBox="0 0 10 10" fill="none"><circle cx="5" cy="3.5" r="2" fill="#7B35A0"/><path d="M1 9c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="#7B35A0" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  Metadata:   `<svg viewBox="0 0 10 10" fill="none"><rect x="1" y="2" width="8" height="1.2" rx=".6" fill="#7B35A0"/><rect x="1" y="4.4" width="6" height="1.2" rx=".6" fill="#7B35A0"/><rect x="1" y="6.8" width="4" height="1.2" rx=".6" fill="#7B35A0"/></svg>`,
  Publishing: `<svg viewBox="0 0 10 10" fill="none"><path d="M2 1.5h6a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5H2a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5z" stroke="#7B35A0" stroke-width="1.2"/><path d="M3.5 4.5h3M3.5 6.5h2" stroke="#7B35A0" stroke-width="1" stroke-linecap="round"/></svg>`,
  Rights:     `<svg viewBox="0 0 10 10" fill="none"><path d="M5 1L1.5 3v3.5C1.5 8.4 3 9.5 5 10c2-0.5 3.5-1.6 3.5-3.5V3z" fill="#7B35A0" opacity=".25" stroke="#7B35A0" stroke-width="1"/><path d="M3.5 5.5l1 1 2-2" stroke="#7B35A0" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  Collection: `<svg viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="3.5" stroke="#7B35A0" stroke-width="1.2"/><path d="M5 2v3l2 1" stroke="#7B35A0" stroke-width="1" stroke-linecap="round"/></svg>`,
  Monitoring: `<svg viewBox="0 0 10 10" fill="none"><path d="M1 7L3.5 4.5l2 2L8 3" stroke="#7B35A0" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="3" r="1" fill="#7B35A0"/></svg>`,
  Catalog:    `<svg viewBox="0 0 10 10" fill="none"><path d="M5 1L6.5 4h3.5L7 6.5 8.5 10 5 7.5 1.5 10 3 6.5.5 4H4z" fill="#7B35A0" opacity=".3" stroke="#7B35A0" stroke-width=".8"/></svg>`,
};

// ── Build score bar HTML for one domain row ───────────────────────────────────
function domainRow(name, score, status) {
  const pct = barPct(score);
  const icon = DOMAIN_ICONS[name] || DOMAIN_ICONS.Identity;
  return `
    <div class="p2-domain-row">
      <div class="p2-domain-icon">${icon}</div>
      <div class="p2-domain-name">${esc(name)}&#x2122;</div>
      <div class="p2-domain-bar-wrap">
        <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="p2-domain-score">${score}</div>
      <div class="p2-domain-pill"><span class="pill pill-${esc(status.cls)}">${esc(status.label)}</span></div>
    </div>
  `;
}

// ── Page 1: top strengths list ────────────────────────────────────────────────
// CIM source: executiveBrief.topStrengths (Executive Brief Engine is sole owner)
function buildTopStrengthsHtml(topStrengths) {
  const items = (Array.isArray(topStrengths) ? topStrengths : []).slice(0, 5);

  if (!items.length) {
    return `<div class="p1-item-empty">No specific strengths identified from reviewed sources in this scan.</div>`;
  }
  return items.map((it) => {
    const label = typeof it === 'string' ? it : (it?.title || String(it));
    return `
      <div class="p1-item">
        <div class="p1-item-dot p1-item-dot-strength">
          <svg viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2 4-4" stroke="#065F46" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <span class="p1-item-text">${esc(label)}</span>
      </div>
    `;
  }).join('');
}

// ── Page 1: top opportunities list ───────────────────────────────────────────
// CIM source: executiveBrief.topOpportunities (Executive Brief Engine is sole owner)
function buildTopOpportunitiesHtml(topOpportunities) {
  const items = (Array.isArray(topOpportunities) ? topOpportunities : []).slice(0, 5);

  if (!items.length) {
    return `<div class="p1-item-empty">No opportunities identified. Royalt&#x113; OS will alert you when gaps appear.</div>`;
  }
  return items.map((it) => {
    const label = typeof it === 'string' ? it : (it?.title || String(it));
    return `
      <div class="p1-item">
        <div class="p1-item-dot p1-item-dot-opp">
          <svg viewBox="0 0 9 9" fill="none"><path d="M4.5 2v5M2 4.5l2.5-2.5L7 4.5" stroke="#6B32A0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <span class="p1-item-text">${esc(label)}</span>
      </div>
    `;
  }).join('');
}

// ── Page 2: health breakdown rows (7 domains) ─────────────────────────────────
// status is pre-resolved from healthIntelligence.domainStatuses — no scoring here.
function buildHealthBreakdownRowsHtml(domains) {
  return domains.map(({ name, score, status }) => domainRow(name, score, status)).join('');
}

// ── Page 2: catalog stat boxes ────────────────────────────────────────────────
function buildCatalogStatBoxesHtml(ci, gmf, pi) {
  const albums   = ci?.albums      ?? 0;
  const eps      = ci?.eps         ?? 0;
  const singles  = ci?.singles     ?? 0;
  const tracks   = ci?.totalTracks ?? 0;
  const works    = pi?.totalChecked ?? 0; // Phase 3.4: read from CIM; assemblePublishingIntelligence owns this count
  const terrs    = gmf?.territoriesAvailable ?? 0;

  const boxes = [
    { num: albums,  label: 'Albums'   },
    { num: eps,     label: 'EPs'      },
    { num: singles, label: 'Singles'  },
    { num: tracks,  label: 'Tracks'   },
    { num: works,   label: 'Works'    },
    { num: terrs,   label: 'Countries'},
  ];
  return boxes.map(({ num, label }) => `
    <div class="p2-stat">
      <div class="p2-stat-num">${num || '—'}</div>
      <div class="p2-stat-label">${esc(label)}</div>
    </div>
  `).join('');
}

// ── Page 3: backend intelligence cards ───────────────────────────────────────
// domainStatuses: from healthIntelligence.domainStatuses (CIM-certified labels).
// No score classification here — status is read from CIM, never computed.
function buildBackendCardsHtml(ii, pi, ci, gmf, bi, mi, healthScore, domainStatuses) {
  const ds = domainStatuses || {};
  const domains = [
    {
      name:   'Identity',
      score:  typeof healthScore.identityScore   === 'number' ? healthScore.identityScore   : 0,
      recs:   Array.isArray(ii?.recommendations) ? ii.recommendations.slice(0, 3) : [],
      status: statusToCls(ds.identity   || 'Needs Review'),
    },
    {
      name:   'Metadata',
      score:  typeof healthScore.metadataScore   === 'number' ? healthScore.metadataScore   : 0,
      recs:   [],
      status: statusToCls(ds.metadata   || 'Needs Review'),
    },
    {
      name:   'Publishing',
      score:  typeof healthScore.publishingScore === 'number' ? healthScore.publishingScore : 0,
      recs:   Array.isArray(pi?.recommendations) ? pi.recommendations.slice(0, 3) : [],
      status: statusToCls(ds.publishing || 'Needs Review'),
    },
    {
      name:   'Catalog',
      score:  typeof healthScore.catalogScore    === 'number' ? healthScore.catalogScore    : 0,
      recs:   ci?.catalogStatus ? [`Catalog status: ${ci.catalogStatus}`] : [],
      status: statusToCls(ds.catalog    || 'Needs Review'),
    },
    {
      name:   'Collection',
      score:  typeof healthScore.coverageScore   === 'number' ? healthScore.coverageScore   : 0,
      recs:   gmf?.status ? [`Territory coverage: ${gmf.status}`] : [],
      status: statusToCls(ds.footprint  || 'Needs Review'),
    },
    {
      name:   'Monitoring',
      score:  typeof mi?.score === 'number' ? mi.score : 50,
      recs:   mi?.state ? [`Monitoring state: ${mi.state}`] : ['Establish monitoring baseline'],
      status: statusToCls(ds.monitoring || 'Needs Review'),
    },
  ];

  return domains.map(({ name, score, recs, status }) => {
    const icon   = DOMAIN_ICONS[name] || DOMAIN_ICONS.Identity;
    const recsHtml = recs.length
      ? recs.map((r) => {
          const text = typeof r === 'string' ? r : (r?.action || r?.title || String(r));
          return `<div class="p3-card-rec">${esc(text)}</div>`;
        }).join('')
      : `<div class="p3-card-rec" style="color:var(--text-light);font-style:italic;">No specific recommendations from reviewed sources.</div>`;

    return `
      <div class="p3-card">
        <div class="p3-card-hd">
          <span class="p3-card-name">${esc(name)}&#x2122;</span>
          <span class="pill pill-${esc(status.cls)}">${esc(status.label)}</span>
        </div>
        <div class="p3-card-score">${score}</div>
        <div class="score-bar-wrap" style="margin-bottom:5px">
          <div class="score-bar-fill" style="width:${barPct(score)}%"></div>
        </div>
        <div class="p3-card-recs">
          <div class="p3-card-recs-lbl">Findings &amp; Recommendations</div>
          ${recsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ── Page 3: compliance / registration rows ────────────────────────────────────
function buildComplianceHtml(pi, ii) {
  const regs = pi?.registrations || {};
  const rows = [
    { label: 'MLC Registration',     state: regs.mlcRegistration     || 'UNABLE_TO_CONFIRM' },
    { label: 'ISWC Coverage',        state: regs.iswcCoverage        || 'UNABLE_TO_CONFIRM' },
    { label: 'Writer Credits',       state: regs.writerCredits       || 'UNABLE_TO_CONFIRM' },
    { label: 'Publisher Information', state: regs.publisherInformation || 'UNABLE_TO_CONFIRM' },
    { label: 'Identity Verification', state: (ii?.verifiedProviders || 0) > 0 ? 'VERIFIED' : 'UNABLE_TO_CONFIRM' },
  ];
  return rows.map(({ label, state }) => {
    const pill = availToPill(state);
    return `
      <div class="p3-comp-row">
        <span class="p3-comp-label">${esc(label)}</span>
        <span class="pill pill-${esc(pill.cls)}">${esc(pill.label)}</span>
      </div>
    `;
  }).join('');
}

// ── Page 5: deep dive insight cards ──────────────────────────────────────────
function buildDeepDiveInsightsHtml(royalteAI, executiveBrief) {
  const cards = [
    {
      label: 'Value Optimization',
      title: 'Catalog Asset Value',
      text:  royalteAI?.positiveSignal || 'No verified positive signals identified from reviewed sources.',
    },
    {
      label: 'For Attention',
      title: 'Priority Focus',
      text:  royalteAI?.priority || 'No critical issues detected in reviewed sources.',
    },
    {
      label: 'Territorial Coverage',
      title: 'Global Distribution',
      text:  executiveBrief?.recommendedNextStep
        ? `Recommended: ${executiveBrief.recommendedNextStep}`
        : 'Territory intelligence pending.',
    },
    {
      label: 'Publishing Intelligence',
      title: 'Rights & Registration',
      text:  executiveBrief?.confidenceStatement || 'Assessment based on available reviewed sources.',
    },
  ];

  return cards.map(({ label, title, text }) => `
    <div class="p5-deep-card">
      <div class="p5-deep-lbl">${esc(label)}</div>
      <div class="p5-deep-title">${esc(title)}</div>
      <div class="p5-deep-text">${esc(text)}</div>
    </div>
  `).join('');
}

// ── Page 5: key takeaways ─────────────────────────────────────────────────────
// CIM sources: executiveBrief.* (Executive Brief Engine sole owner) + royalteAI.*
// healthIntelligence.concerns removed — executiveBrief.topOpportunities is the
// constitutional source for opportunity language in every product surface.
function buildKeyTakeawaysHtml(executiveBrief, royalteAI) {
  const items = [];

  const headline = executiveBrief?.healthHeadline;
  if (headline) items.push(headline);

  const conf = executiveBrief?.confidenceStatement;
  if (conf) items.push(conf);

  if (Array.isArray(executiveBrief?.topOpportunities)) {
    for (const o of executiveBrief.topOpportunities.slice(0, 2)) {
      const label = typeof o === 'string' ? o : (o?.title || String(o));
      if (label) items.push(label);
    }
  }

  const rec = executiveBrief?.recommendedNextStep;
  if (rec && items.length < 4) items.push(`Next step: ${rec}`);

  const nextAction = royalteAI?.nextAction;
  if (nextAction && items.length < 4 && nextAction !== 'No immediate actions required.') {
    items.push(nextAction);
  }

  while (items.length < 3) {
    items.push('Royalt&#x113; Intelligence&#x2122; is monitoring your backend for changes.');
  }

  return items.slice(0, 5).map((it) => `
    <div class="p5-takeaway">
      <div class="p5-takeaway-dot"></div>
      <span>${esc(it)}</span>
    </div>
  `).join('');
}

// ── Page 6: action plan by time horizon ──────────────────────────────────────
// Category → phase mapping
const CATEGORY_PHASE = {
  IDENTITY:   'now',
  METADATA:   'now',
  PUBLISHING: '30',
  RIGHTS:     '30',
  CATALOG:    '90',
  COVERAGE:   '90',
  MONITORING: '12m',
};

function buildPriorityPhaseHtml(priorityActions, phase, recommendations) {
  // Bucket priority actions by category → phase
  const phaseActions = [];

  if (Array.isArray(priorityActions)) {
    for (const a of priorityActions) {
      const cat = String(a?.category || '').toUpperCase();
      const mapped = CATEGORY_PHASE[cat] || 'now';
      if (mapped === phase) phaseActions.push(a);
    }
  }

  // Supplement with recommendations (already bucketed by caller)
  if (Array.isArray(recommendations)) {
    for (const r of recommendations) {
      if (phaseActions.length >= 3) break;
      const cat = String(r?.category || '').toUpperCase();
      const mapped = CATEGORY_PHASE[cat] || 'now';
      if (mapped === phase) phaseActions.push(r);
    }
  }

  if (!phaseActions.length) {
    return `<div class="p6-action-empty">No specific actions identified for this timeframe from reviewed sources.</div>`;
  }

  return phaseActions.slice(0, 3).map((a) => {
    const cat    = a?.category || '';
    const action = a?.action   || a?.title || 'Review and address';
    return `
      <div class="p6-action">
        <div class="p6-action-cat">${esc(cat)} Intelligence&#x2122;</div>
        <div class="p6-action-text">${esc(action)}</div>
      </div>
    `;
  }).join('');
}

// ── Page 7: intelligence engine status rows ───────────────────────────────────
// domainStatuses: from healthIntelligence.domainStatuses (CIM-certified labels).
// Maps CIM vocabulary to active/partial/limited display indicator — no thresholds.
function statusToIntelState(ds) {
  if (ds === 'Excellent' || ds === 'Strong') return 'active';
  if (ds === 'Moderate')                     return 'partial';
  return 'limited';
}

function buildIntelligenceStatusHtml(ii, pi, ci, bi, mi, royalteAI, domainStatuses) {
  const ds = domainStatuses || {};
  const engines = [
    { name: 'Identity Intelligence™',    state: statusToIntelState(ds.identity)   },
    { name: 'Publishing Intelligence™',  state: statusToIntelState(ds.publishing) },
    { name: 'Catalog Intelligence™',     state: statusToIntelState(ds.catalog)    },
    { name: 'Backend Intelligence™',     state: statusToIntelState(ds.backend)    },
    { name: 'Monitoring Intelligence™',  state: mi?.state === 'active' ? 'active' : 'partial'   },
    { name: 'Royalt&#x113; AI™',        state: royalteAI?.generatedBy === 'engine_live' ? 'active' : 'partial' },
  ];

  return engines.map(({ name, state }) => {
    const cls = `p7-s-${state}`;
    const label = state === 'active' ? 'Active' : state === 'partial' ? 'Partial' : 'Limited';
    return `
      <div class="p7-intel-row">
        <span class="p7-intel-name">${name}</span>
        <span class="p7-intel-status ${cls}">${label}</span>
      </div>
    `;
  }).join('');
}

// ── Territory label builder ───────────────────────────────────────────────────
// Phase 3.4: reads territoriesAvailable from the Certified CIM.
// Constitutional owner: assembleGlobalMusicFootprint (RIE).
// CIM path: gmf.territoriesAvailable (already counts Apple Music storefronts verified).
// Raw storefront filtering removed — the assembler owns that computation.
function buildTerritoryLabel(gmf) {
  const count = gmf?.territoriesAvailable;

  if (typeof count === 'number' && count > 0) {
    return { big: String(count), detail: 'Apple Music Territories Verified', short: String(count), shortDetail: 'Apple Music Territories' };
  }

  return { big: '—', detail: 'Territory data not yet available from reviewed sources', short: '—', shortDetail: 'Countries' };
}

// ── Monitoring state → CSS class + label ─────────────────────────────────────
function monitoringStateInfo(mi) {
  const state = mi?.state || mi?.statusLabel || '';
  const s = String(state).toLowerCase();
  if (s.includes('active'))   return { cls: 'p7-s-active',  label: 'Active'   };
  if (s.includes('baseline')) return { cls: 'p7-s-partial', label: 'Baseline' };
  if (s.includes('no_change')) return { cls: 'p7-s-active', label: 'Stable'   };
  return                              { cls: 'p7-s-limited', label: 'Standby'  };
}

// catalogYearRange() REMOVED — Phase 3.4 Final Certification.
// Constitutional replacement: catalogIntelligence.{firstReleaseYear, latestReleaseYear,
// catalogAgeYears} assembled by assembleCatalogIntelligence (RIE sole owner).
// Raw payload.platforms.appleMusic.details.albums[] access permanently retired here.

// publishingStatusPill() REMOVED — Phase 3.4 Final Certification.
// Constitutional replacement: publishingIntelligence.coverageStatus assembled by
// assemblePublishingIntelligence (RIE sole owner). Threshold classification
// (≥75 Verified, ≥40 Partial, etc.) now lives exclusively in the assembler.

// ── Footprint status → CSS class ─────────────────────────────────────────────
function footprintStatusCls(gmf) {
  const s = String(gmf?.status || '').toLowerCase();
  if (s.includes('broad')) return 'verified';
  if (s.includes('strong')) return 'strong';
  if (s.includes('moderate')) return 'moderate';
  return 'partial';
}

// ── Catalog status → CSS class ────────────────────────────────────────────────
function catalogStatusCls(ci) {
  const s = String(ci?.catalogStatus || '').toLowerCase();
  if (s.includes('active') && !s.includes('limited')) return 'verified';
  if (s.includes('partial')) return 'partial';
  return 'moderate';
}

// ── Catalog confidence → CSS class ───────────────────────────────────────────
function catalogConfidenceCls(ci) {
  const c = String(ci?.confidence || '').toLowerCase();
  if (c === 'verified')         return 'verified';
  if (c === 'partial')          return 'partial';
  if (c === 'unable to confirm') return 'review';
  return 'partial';
}

// ── Strategic opportunity % (derived from health score + observations) ────────
function strategicOppPct(healthScore, executiveBrief) {
  const score = typeof healthScore?.overallScore === 'number' ? healthScore.overallScore : 50;
  // Headroom: the gap between current score and 100, expressed as improvement potential
  const headroom = Math.round((100 - score) * 0.4);
  return Math.max(5, Math.min(40, headroom));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PLACEHOLDER BUILDER
// Reads all intelligence from payload.* — no direct canonical field access.
// ═══════════════════════════════════════════════════════════════════════════════
function buildPlaceholders(scanId, payload) {
  const p = payload || {};

  // ── Extract all intelligence objects (graceful fallback for older scans) ────
  const executiveBrief         = p.executiveBrief         || {};
  const healthScore            = p.healthScore            || {};
  const healthIntelligence     = p.healthIntelligence     || {};
  const identityIntelligence   = p.identityIntelligence   || {};
  const publishingIntelligence = p.publishingIntelligence || {};
  const catalogIntelligence    = p.catalogIntelligence    || {};
  const globalMusicFootprint   = p.globalMusicFootprint   || {};
  const backendIntelligence    = p.backendIntelligence    || {};
  const monitoringIntelligence = p.monitoringIntelligence || {};
  const royalteAI              = p.royalteAI              || {};

  // ── Artist name — read from multiple possible paths ──────────────────────
  const artistName = p.subject?.artistName
    || p.identity?.canonicalArtistName
    || executiveBrief.artistName
    || 'Unknown Artist';

  const scanDate = formatScanDate(p.scannedAt || healthScore.generatedAt);

  // ── Health Score (Phase 7 — constitutional source of truth) ─────────────
  // healthBand reads status from healthIntelligence CIM — no score classification here.
  const overallScore  = typeof healthScore.overallScore === 'number' ? healthScore.overallScore : 0;
  const overallGrade  = healthScore.overallGrade || '—';
  const healthBand    = statusToCls(healthIntelligence.status || 'Needs Review');
  const healthSummary = healthScore.summary || 'Intelligence analysis pending.';

  // Ring SVG stroke-dasharray
  const healthScoreDash = `${((overallScore / 100) * RING_CIRCUMFERENCE).toFixed(1)} ${RING_CIRCUMFERENCE}`;

  // ── Phase 7 category scores ──────────────────────────────────────────────
  const phaseIdentityScore    = typeof healthScore.identityScore   === 'number' ? healthScore.identityScore   : 0;
  const phasePublishingScore  = typeof healthScore.publishingScore === 'number' ? healthScore.publishingScore : 0;
  const phaseCatalogScore     = typeof healthScore.catalogScore    === 'number' ? healthScore.catalogScore    : 0;
  const phaseMetadataScore    = typeof healthScore.metadataScore   === 'number' ? healthScore.metadataScore   : 0;
  const phaseCoverageScore    = typeof healthScore.coverageScore   === 'number' ? healthScore.coverageScore   : 0;

  // ── Health Intelligence informational contributor scores ─────────────────
  const hiMonitoringScore = typeof healthIntelligence.monitoringScore === 'number' ? healthIntelligence.monitoringScore : 50;
  const hiPublishingScore = typeof healthIntelligence.publishingScore === 'number' ? healthIntelligence.publishingScore : 0;

  // ── Per-domain status labels from CIM ────────────────────────────────────
  // CIM source: healthIntelligence.domainStatuses (assembled by assembleHealthIntelligence)
  // No score classification here — renderers read, never classify.
  const domainStatuses = healthIntelligence.domainStatuses || {};
  function domainStatus(key) { return statusToCls(domainStatuses[key] || 'Needs Review'); }

  // ── 7-domain breakdown for Page 2 ───────────────────────────────────────
  // scores from Health Engine; status labels from healthIntelligence.domainStatuses (CIM).
  const domainData = [
    { name: 'Identity',   score: phaseIdentityScore,   status: domainStatus('identity')   },
    { name: 'Metadata',   score: phaseMetadataScore,   status: domainStatus('metadata')   },
    { name: 'Publishing', score: phasePublishingScore,  status: domainStatus('publishing') },
    { name: 'Rights',     score: hiPublishingScore,     status: domainStatus('publishing') },
    { name: 'Collection', score: phaseCoverageScore,    status: domainStatus('footprint')  },
    { name: 'Monitoring', score: hiMonitoringScore,     status: domainStatus('monitoring') },
    { name: 'Catalog',    score: phaseCatalogScore,     status: domainStatus('catalog')    },
  ];

  // ── Territory labels ─────────────────────────────────────────────────────
  const terrInfo    = buildTerritoryLabel(globalMusicFootprint);
  const footprintCls = footprintStatusCls(globalMusicFootprint);
  const footprintStatus = globalMusicFootprint.status || 'Unknown';
  const footprintPct = typeof globalMusicFootprint.coveragePercent === 'number'
    ? globalMusicFootprint.coveragePercent : 0;

  // ── Catalog year range from CIM ─────────────────────────────────────────
  // CIM source: catalogIntelligence.{firstReleaseYear, latestReleaseYear, catalogAgeYears}
  // assembled by assembleCatalogIntelligence (RIE sole owner).
  const firstReleaseYear  = catalogIntelligence.firstReleaseYear;
  const latestReleaseYear = catalogIntelligence.latestReleaseYear;
  const catalogAgeYears   = catalogIntelligence.catalogAgeYears;
  // timelineFillPct: visual CSS scale from age in years; pure presentation geometry.
  const timelineFillPct = (typeof catalogAgeYears === 'number' && catalogAgeYears > 0)
    ? Math.min(100, Math.round((catalogAgeYears / 20) * 80) + 20) : 80;

  // ── Catalog ──────────────────────────────────────────────────────────────
  const catStatusCls    = catalogStatusCls(catalogIntelligence);
  const catConfidenceCls = catalogConfidenceCls(catalogIntelligence);
  const catInsight      = catalogIntelligence.catalogStatus
    ? `Your catalog is ${catalogIntelligence.catalogStatus.toLowerCase()} with ${(catalogIntelligence.confidence || 'partial').toLowerCase()} confidence from reviewed sources.`
    : 'Catalog intelligence is pending from reviewed sources.';

  // ── Publishing ───────────────────────────────────────────────────────────
  // CIM source: publishingIntelligence.coverageStatus (sole classification authority).
  // coverage: null → unable to verify (AUTH_UNAVAILABLE); coverage: 0 → verified zero.
  const pubPill    = coverageStatusPill(publishingIntelligence.coverageStatus);
  const pubCoverage = publishingIntelligence.coverage;  // number | null
  const pubCoverageDisplay = pubCoverage === null ? '—' : String(pubCoverage);
  const pubWorks   = publishingIntelligence.totalChecked || 0;

  // ── Monitoring posture ───────────────────────────────────────────────────
  const monitorInfo = monitoringStateInfo(monitoringIntelligence);

  // ── AI fields ────────────────────────────────────────────────────────────
  const aiObservation = royalteAI.observation      || executiveBrief.aiExecutiveInsight || 'Intelligence analysis is pending from reviewed sources.';
  const aiPriority    = royalteAI.priority         || '—';
  const aiNextAction  = royalteAI.nextAction       || executiveBrief.recommendedNextStep || 'Schedule a full backend review.';
  const aiNarrative   = executiveBrief.executiveNarrative || royalteAI.observation || 'Intelligence analysis is pending.';
  const aiConfPct     = confidenceToPct(royalteAI.confidence);
  const aiConfLabel   = confidenceLabel(royalteAI.confidence);

  const strategicOpp  = strategicOppPct(healthScore, executiveBrief);

  // ── Executive Brief content ───────────────────────────────────────────────
  const execSummary      = executiveBrief.executiveSummary
    || `${esc(artistName)}'s music backend has been assessed. Health Score: ${overallScore}/100 (${healthBand.label}).`;
  const execHeadline     = executiveBrief.healthHeadline || healthBand.label;
  const aiInsight        = royalteAI.observation || executiveBrief.aiExecutiveInsight || 'Intelligence analysis pending.';
  const confStatement    = executiveBrief.confidenceStatement || 'This assessment is based on available reviewed sources.';
  const recNextStep      = executiveBrief.recommendedNextStep || 'Schedule Full Backend Review';

  const priorityActions  = Array.isArray(executiveBrief.priorityActions)  ? executiveBrief.priorityActions  : [];
  const topStrengths     = Array.isArray(executiveBrief.topStrengths)     ? executiveBrief.topStrengths     : [];
  const topOpportunities = Array.isArray(executiveBrief.topOpportunities) ? executiveBrief.topOpportunities : [];
  // healthIntelligence.strengths/concerns removed — Executive Brief Engine is the sole
  // owner of top strengths and opportunity language across all product surfaces.

  // ── Backend infrastructure counts ────────────────────────────────────────
  const backendConnected = typeof backendIntelligence.connectedCount === 'number' ? backendIntelligence.connectedCount : 0;
  const backendTotal     = typeof backendIntelligence.totalCount     === 'number' ? backendIntelligence.totalCount     : 0;

  // ── Build all placeholder values ─────────────────────────────────────────
  return {
    // ── Shared across all pages
    artist_name:  esc(artistName),
    scan_date:    esc(scanDate),
    health_score: String(overallScore),
    health_grade: esc(overallGrade),
    health_status:    esc(healthBand.label),
    health_status_cls: esc(healthBand.cls),
    health_score_dash: esc(healthScoreDash),
    health_summary:   esc(healthSummary),
    health_percentile_note: 'Assessed by Royaltē Intelligence™',

    // ── Page 1
    executive_summary:  esc(execSummary),
    ai_insight:         esc(aiInsight),
    top_strengths_html:     buildTopStrengthsHtml(topStrengths),
    top_opportunities_html: buildTopOpportunitiesHtml(topOpportunities),

    // ── Page 2
    health_breakdown_rows_html: buildHealthBreakdownRowsHtml(domainData),
    catalog_stat_boxes_html:    buildCatalogStatBoxesHtml(catalogIntelligence, globalMusicFootprint, publishingIntelligence),
    territory_label_short: esc(terrInfo.short),
    territory_detail_label: esc(terrInfo.detail),
    footprint_status:    esc(footprintStatus),
    footprint_status_cls: esc(footprintCls),
    catalog_status:      esc(catalogIntelligence.catalogStatus || 'Unknown'),
    catalog_status_cls:  esc(catStatusCls),
    catalog_insight:     esc(catInsight),

    // ── Page 3
    backend_cards_html: buildBackendCardsHtml(
      identityIntelligence, publishingIntelligence, catalogIntelligence,
      globalMusicFootprint, backendIntelligence, monitoringIntelligence, healthScore,
      domainStatuses
    ),
    compliance_html:   buildComplianceHtml(publishingIntelligence, identityIntelligence),
    ai_observation:    esc(aiObservation),
    backend_connected: String(backendConnected),
    backend_total:     String(backendTotal),

    // ── Page 4
    catalog_albums:    String(catalogIntelligence.albums   ?? 0),
    catalog_eps:       String(catalogIntelligence.eps      ?? 0),
    catalog_singles:   String(catalogIntelligence.singles  ?? 0),
    catalog_tracks:    String(catalogIntelligence.totalTracks ?? 0),
    publishing_works:  String(pubWorks || catalogIntelligence.totalTracks || 0),
    territory_count:   String(globalMusicFootprint.territoriesAvailable ?? 0),
    territory_label_big: esc(terrInfo.big),
    footprint_coverage_pct: String(footprintPct),
    catalog_first_year:  esc(firstReleaseYear  != null ? String(firstReleaseYear)  : '—'),
    catalog_latest_year: esc(latestReleaseYear != null ? String(latestReleaseYear) : '—'),
    timeline_fill_pct:   String(timelineFillPct),
    catalog_confidence:  esc(catalogIntelligence.confidence || 'Partial'),
    catalog_confidence_cls: esc(catConfidenceCls),
    publishing_coverage: pubCoverageDisplay,
    publishing_status:   esc(pubPill.label),
    publishing_status_cls: esc(pubPill.cls),

    // ── Page 5
    ai_executive_narrative: esc(aiNarrative),
    deep_dive_insights_html: buildDeepDiveInsightsHtml(royalteAI, executiveBrief),
    key_takeaways_html:      buildKeyTakeawaysHtml(executiveBrief, royalteAI),
    ai_next_action:          esc(aiNextAction),
    ai_confidence_pct:       String(aiConfPct),
    ai_confidence_label:     esc(aiConfLabel),
    strategic_opp_pct:       String(strategicOpp),

    // ── Page 6
    priority_now_html: buildPriorityPhaseHtml(priorityActions, 'now',  []),
    priority_30_html:  buildPriorityPhaseHtml(priorityActions, '30',   []),
    priority_90_html:  buildPriorityPhaseHtml(priorityActions, '90',   []),
    priority_12m_html: buildPriorityPhaseHtml(priorityActions, '12m',  []),

    // ── Page 7
    intelligence_status_html: buildIntelligenceStatusHtml(
      identityIntelligence, publishingIntelligence, catalogIntelligence,
      backendIntelligence, monitoringIntelligence, royalteAI, domainStatuses
    ),
    recommended_next_step: esc(recNextStep),
    confidence_statement:  esc(confStatement),
    monitoring_state_label: esc(monitorInfo.label),
    monitoring_status_cls:  esc(monitorInfo.cls),
  };
}

// ── Template fill — {{key}} replace ──────────────────────────────────────────
function fillTemplate(template, map) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : ''
  );
}

// ── PDFShift ──────────────────────────────────────────────────────────────────
async function renderViaPdfShift(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) throw new Error('PDFSHIFT_API_KEY not configured');

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const resp = await fetch(PDFSHIFT_ENDPOINT, {
    method:  'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: html, use_print: true, format: 'Letter' }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`PDFShift ${resp.status}: ${errText.slice(0, 500) || resp.statusText}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

// ── Supabase Storage upload ───────────────────────────────────────────────────
async function uploadPdf(supabase, scanId, pdfBuffer, artistName) {
  const path = `${scanId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const downloadName = `Royalte_Executive_Brief_${sanitizeFilenamePart(artistName)}.pdf`;
  const { data: pub } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path, { download: downloadName });
  if (!pub?.publicUrl) throw new Error('Storage upload succeeded but public URL missing');
  return pub.publicUrl;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

export async function renderAuditPdf(scanId) {
  if (!scanId || typeof scanId !== 'string') {
    throw new Error('renderAuditPdf: scanId required');
  }

  const supabase = getSupabase();

  const { data: row, error: loadErr } = await supabase
    .from('audit_scans')
    .select('id, payload, pdf_status, pdf_url, pdf_attempts')
    .eq('id', scanId)
    .single();
  if (loadErr || !row) {
    throw new Error(`audit_scans row not found for scanId ${scanId}: ${loadErr?.message || 'no row'}`);
  }

  if (row.pdf_status === 'ready' && row.pdf_url) {
    return { scanId, pdfUrl: row.pdf_url, pdfStatus: 'ready', alreadyRendered: true };
  }

  const nextAttempts = (row.pdf_attempts || 0) + 1;
  const { error: markErr } = await supabase
    .from('audit_scans')
    .update({ pdf_status: 'rendering', pdf_attempts: nextAttempts, pdf_error: null })
    .eq('id', scanId);
  if (markErr) throw new Error(`audit_scans mark-rendering failed: ${markErr.message}`);

  try {
    const template = await readFile(TEMPLATE_PATH, 'utf8');
    const map      = buildPlaceholders(scanId, row.payload || {});
    const html     = fillTemplate(template, map);
    const pdfBuf   = await renderViaPdfShift(html);
    const artist   = row.payload?.subject?.artistName
      || row.payload?.identity?.canonicalArtistName
      || 'Artist';
    const pdfUrl   = await uploadPdf(supabase, scanId, pdfBuf, artist);

    const { error: doneErr } = await supabase
      .from('audit_scans')
      .update({ pdf_status: 'ready', pdf_url: pdfUrl, pdf_rendered_at: new Date().toISOString(), pdf_error: null })
      .eq('id', scanId);
    if (doneErr) throw new Error(`audit_scans finalize failed: ${doneErr.message}`);

    return { scanId, pdfUrl, pdfStatus: 'ready', alreadyRendered: false };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 2000);
    await supabase.from('audit_scans').update({ pdf_status: 'failed', pdf_error: msg }).eq('id', scanId);
    throw err;
  }
}

// ── Test helper — pure, no DB/network ────────────────────────────────────────
export function _buildPlaceholdersForTest(payload, scanId = 'TEST-SCAN-ID') {
  return buildPlaceholders(scanId, payload);
}
