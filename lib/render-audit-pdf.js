// ─────────────────────────────────────────────────────────────────────────────
// lib/render-audit-pdf.js
//
// Renders a Royaltē Review PDF for a saved scan (audit_scans row).
//
// Brief 014: the artist-emailed PDF was rebuilt as the "Royaltē Review" —
// the baseline document that feeds Mission Control. The PDF surface was
// promoted to V2 Health Score framing in this brief (see CLAUDE.md).
//
// Pipeline:
//   1. Load audit_scans row by id (canonical AuditResponse v1.0.0 in payload).
//   2. Compute V2 Health Score via computeV2HealthScore(canonical) — same
//      function persist-os-scan uses, so the Review and the dashboard show
//      the same number for the same scan.
//   3. Derive Review-specific surfaces (confidence, action plan, what could
//      not be verified, release list, storefront grid, metadata checklist).
//   4. Fill lib/audit-report-template.html with all placeholder values.
//   5. POST filled HTML to PDFShift /v3/convert/pdf, get PDF buffer.
//   6. Upload buffer to Supabase Storage bucket 'audit-reports' at key
//      '<scanId>.pdf' (upsert), then build a download URL whose filename
//      is "Royalte_Review_{ArtistName}.pdf" (Supabase getPublicUrl
//      download option sets Content-Disposition).
//   7. Update audit_scans row: pdf_status='ready', pdf_url=<download url>,
//      pdf_rendered_at=now(). On failure: pdf_status='failed', pdf_error.
//
// Idempotency: if the row is already pdf_status='ready', returns the
// existing pdf_url without re-rendering. Concurrent callers race-overwrite
// the Storage object — last write wins; cost is 2× PDFShift on collision.
// submit-audit.js enforces the 1-retry cap to keep this rare.
//
// Public API:
//   renderAuditPdf(scanId) -> { scanId, pdfUrl, pdfStatus, alreadyRendered }
//
// Public API name kept (renderAuditPdf) so submit-audit.js and any other
// callers do not need to change — the "audit" in the function name is
// historical; the artifact is the Royaltē Review.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeV2HealthScore } from '../api/_lib/persist-os-scan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH     = join(__dirname, 'audit-report-template.html');
const STORAGE_BUCKET    = 'audit-reports';
const PDFSHIFT_ENDPOINT = 'https://api.pdfshift.io/v3/convert/pdf';

// ── Supabase client (service role bypasses RLS) ──────────────────────────────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[render-audit-pdf] Supabase credentials not configured');
  return createClient(url, key);
}

// ── HTML escape — every value sourced from third-party scan data goes through
//    this. Template static copy is trusted. Raw-HTML placeholder values
//    (built by this module, e.g. action_items_html) are NOT escaped — they
//    are assembled from escaped pieces inside the builders below.
function esc(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Filename sanitizer — keeps only [A-Za-z0-9_-], folds whitespace to '_'.
//    Used in the download filename so "Black Alternative" → "Black_Alternative"
//    and any unsafe character (slash, quote, control) is dropped.
function sanitizeFilenamePart(s) {
  if (!s) return 'Artist';
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')          // strip combining diacritics
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80) || 'Artist';
}

// "May 30, 2026" — Intl with explicit en-US locale.
function formatScanDate(iso) {
  try {
    const d = iso ? new Date(iso) : new Date();
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(d);
  } catch {
    return 'Unknown';
  }
}

// ── Score band → display label + CSS class suffix.
function scoreBand(score) {
  if (score >= 90) return { label: 'Excellent',          cls: 'excellent' };
  if (score >= 75) return { label: 'Strong',             cls: 'strong'    };
  if (score >= 60) return { label: 'Moderate',           cls: 'moderate'  };
  return            { label: 'Review Recommended',       cls: 'review'    };
}

// ── Review Confidence — High / Moderate / Limited.
//    Counts how many of the 4 primary sources returned availability=VERIFIED.
function computeConfidence(canonical) {
  const p = canonical?.platforms || {};
  const sources = [
    p.appleMusic?.availability  === 'VERIFIED',
    p.spotify?.availability     === 'VERIFIED',
    p.youtube?.availability     === 'VERIFIED',
    p.musicbrainz?.availability === 'VERIFIED',
  ];
  const verified = sources.filter(Boolean).length;
  if (verified >= 3) return { label: 'High',     cls: 'high',     count: verified };
  if (verified >= 2) return { label: 'Moderate', cls: 'moderate', count: verified };
  return                    { label: 'Limited',  cls: 'limited',  count: verified };
}

// ── Status per Page 2 category: verified / partial / not confirmed.
function statusFromBool(verified, partial = false) {
  if (verified) return { label: 'Verified',      cls: 'verified'      };
  if (partial)  return { label: 'Partial',       cls: 'partial'       };
  return         { label: 'Not Confirmed', cls: 'not-confirmed' };
}

// ── Action plan — derived from canonical signals. Returns up to 5 items.
function buildActions(canonical) {
  const am      = canonical?.platforms?.appleMusic?.details || {};
  const apple   = canonical?.platforms?.appleMusic   || {};
  const spotify = canonical?.platforms?.spotify      || {};
  const youtube = canonical?.platforms?.youtube      || {};
  const albums  = Array.isArray(am.albums) ? am.albums : [];
  const albumCount = albums.length || am.albumCount || 0;
  const sfa     = am.storefrontAvailability;
  const items   = [];

  // ── Catalog depth — 0 or low ───────────────────────────────────────────
  if (albumCount === 0) {
    items.push({
      observation: 'Catalog depth could not be determined from reviewed sources for this scan.',
      whyMatters: 'A verified catalog is the foundation for everything else Royaltē monitors — releases, ISRCs, territory availability, and identifier health all build on the catalog Royaltē can see.',
      action: 'Confirm your full discography with your distributor and verify each release reached the major DSPs. Re-scan once delivery is confirmed.',
      expectedOutcome: 'Royaltē will be able to verify your catalog and begin monitoring it for changes.',
      effort: '30 Minutes',
      priority: 'High',
    });
  } else if (albumCount < 4) {
    items.push({
      observation: `Catalog depth was below the typical range in reviewed sources (${albumCount} release${albumCount === 1 ? '' : 's'} verified).`,
      whyMatters: 'A small visible catalog may indicate releases that have not yet propagated to all major DSPs or that are missing from primary sources.',
      action: 'Confirm with your distributor that every release reached the DSPs Royaltē reviews.',
      expectedOutcome: 'Future scans will reflect the full catalog and Royaltē will monitor each release for changes.',
      effort: '15 Minutes',
      priority: 'Medium',
    });
  }

  // ── Platforms not verified ─────────────────────────────────────────────
  if (apple.availability !== 'VERIFIED') {
    items.push({
      observation: 'Apple Music presence was not available from reviewed sources for this scan.',
      whyMatters: 'Apple Music is one of the largest royalty-generating DSPs. Unverified presence means catalog, ISRC, and territory signals from Apple cannot be cross-checked.',
      action: 'Confirm your Apple Music for Artists profile is claimed and that your distributor has delivered to Apple. Re-scan after confirming.',
      expectedOutcome: 'Apple Music presence verified; catalog + territory + ISRC checks gain a second source.',
      effort: '15 Minutes',
      priority: 'High',
    });
  }
  if (spotify.availability !== 'VERIFIED') {
    items.push({
      observation: 'Spotify presence was not available from reviewed sources for this scan.',
      whyMatters: 'Spotify is the largest streaming DSP by share. Unverified presence may indicate a delivery issue or a Spotify for Artists profile that is not claimed.',
      action: 'Confirm your Spotify for Artists profile is claimed and that your distributor delivered to Spotify. Re-scan after confirming.',
      expectedOutcome: 'Spotify presence verified; royalty-bearing surface confirmed.',
      effort: '15 Minutes',
      priority: 'High',
    });
  }
  if (youtube.availability !== 'VERIFIED') {
    items.push({
      observation: 'YouTube presence was not available from reviewed sources for this scan.',
      whyMatters: 'YouTube visibility matters for catalog discovery and UGC matching. Unverified presence means Royaltē cannot confirm Content ID coverage.',
      action: 'Confirm your Official Artist Channel on YouTube and verify your distributor has delivered the catalog to YouTube Music.',
      expectedOutcome: 'YouTube presence verified; visibility signals become trackable.',
      effort: '15 Minutes',
      priority: 'Medium',
    });
  }

  // ── Territory partial / missing ────────────────────────────────────────
  if (!sfa || typeof sfa !== 'object') {
    items.push({
      observation: 'Territory availability was not yet verified in this scan.',
      whyMatters: 'Territory coverage is what determines whether your catalog earns royalties in each market. Without verified territory data, regional gaps cannot be detected.',
      action: 'Run a new scan once Apple Music storefront data has propagated, or contact your distributor to confirm worldwide release.',
      expectedOutcome: 'Royaltē can confirm BIG 6 storefront coverage and alert on any territory drop.',
      effort: '5 Minutes',
      priority: 'Medium',
    });
  } else {
    const keys = ['us','ca','gb','de','fr','jp','au'];
    const missing = [];
    for (const sf of keys) {
      const ent = sfa[sf];
      if (!ent || ent.error) { missing.push(sf.toUpperCase()); continue; }
      const avail = Array.isArray(ent.available) ? ent.available.length : 0;
      if (avail === 0) missing.push(sf.toUpperCase());
    }
    if (missing.length > 0) {
      items.push({
        observation: `Availability was not yet verified in ${missing.length} of 7 BIG 6 storefronts (${missing.join(', ')}).`,
        whyMatters: 'BIG 6 storefronts cover the highest-revenue markets globally. A gap here means catalog earnings from that market are not yet confirmed.',
        action: `Confirm with your distributor that releases reached the affected storefronts: ${missing.join(', ')}.`,
        expectedOutcome: 'BIG 6 coverage moves toward full; Royaltē begins monitoring those storefronts for change.',
        effort: '15 Minutes',
        priority: 'Medium',
      });
    }
  }

  // ── ISRC ───────────────────────────────────────────────────────────────
  if (!am.isrcLookup?.isrc) {
    items.push({
      observation: 'ISRC information was not available from reviewed sources for this scan.',
      whyMatters: 'ISRCs are the unique identifier that tie streams and downloads to your royalties. Without verified ISRCs, downstream attribution can fall through.',
      action: 'Request a per-track ISRC report from your distributor or PRO. Cross-check it against your release titles, then run a track-level scan to verify.',
      expectedOutcome: 'Royaltē can verify ISRC coverage and alert on any ISRC change or mismatch in future scans.',
      effort: '30 Minutes',
      priority: 'High',
    });
  }

  return items.slice(0, 5);
}

// ── Pre-render the action plan HTML for Page 3.
function renderActionPlanHtml(items) {
  if (items.length === 0) {
    return `<div class="action-empty">No specific actions identified from this scan. Royaltē OS will alert you if anything requires attention.</div>`;
  }
  return items.map((it, i) => `
    <article class="action-card priority-${esc(it.priority.toLowerCase())}">
      <header class="action-card-hd">
        <span class="action-num">${i + 1}</span>
        <span class="action-priority">${esc(it.priority)} Priority</span>
        <span class="action-effort">${esc(it.effort)}</span>
      </header>
      <dl class="action-body">
        <dt>Observation</dt>          <dd>${esc(it.observation)}</dd>
        <dt>Why It Matters</dt>       <dd>${esc(it.whyMatters)}</dd>
        <dt>Recommended Action</dt>   <dd>${esc(it.action)}</dd>
        <dt>Expected Outcome</dt>     <dd>${esc(it.expectedOutcome)}</dd>
      </dl>
    </article>
  `).join('');
}

// ── Pre-render top observations (Page 1) — derived from the score driver
//    strings already computed by computeV2HealthScore. Capped at 3.
function renderTopObservationsHtml(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return `<li class="observation-empty">Your catalog looks clean. Royaltē OS is monitoring for changes and will alert you if anything requires attention.</li>`;
  }
  return drivers.slice(0, 3).map((d) => `<li class="observation">${esc(d)}</li>`).join('');
}

// ── Pre-render top recommended actions for Page 1 (titles only, max 3).
function renderTopActionsHtml(items) {
  if (items.length === 0) {
    return `<li class="action-summary-empty">No specific actions identified from this scan.</li>`;
  }
  return items.slice(0, 3).map((it) => `
    <li class="action-summary priority-${esc(it.priority.toLowerCase())}">
      <span class="action-summary-priority">${esc(it.priority)}</span>
      <span class="action-summary-text">${esc(it.action)}</span>
    </li>
  `).join('');
}

// ── Page 4: drivers list rendered as locked-tone explanations.
function renderDriversHtml(drivers) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return `<div class="drivers-empty">Your score is not currently being lowered by any observed factors.</div>`;
  }
  return `<ul class="drivers-list">${drivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;
}

// ── Page 5: release list rendered as a table.
function renderReleaseListHtml(canonical) {
  const am = canonical?.platforms?.appleMusic?.details || {};
  const albums = Array.isArray(am.albums) ? am.albums : [];
  if (albums.length === 0) {
    return `<div class="release-empty">No releases were available from reviewed sources for this scan.</div>`;
  }
  const rows = albums.slice(0, 25).map((a) => {
    const title  = a?.name || 'Untitled';
    const tc     = typeof a?.trackCount === 'number' ? a.trackCount : null;
    const type   = tc === 1 ? 'Single' : (tc != null && tc <= 6) ? 'EP' : 'Album';
    const date   = a?.releaseDate ? formatScanDate(a.releaseDate) : '—';
    return `<tr><td>${esc(title)}</td><td>${esc(type)}</td><td>${esc(date)}</td></tr>`;
  }).join('');
  const moreNote = albums.length > 25
    ? `<tr class="release-more"><td colspan="3">+ ${albums.length - 25} more releases — full list in Mission Control</td></tr>`
    : '';
  return `
    <table class="release-table">
      <thead><tr><th>Title</th><th>Type</th><th>Release Date</th></tr></thead>
      <tbody>${rows}${moreNote}</tbody>
    </table>
  `;
}

// ── Page 5: release counts by type.
function releaseCounts(canonical) {
  const am = canonical?.platforms?.appleMusic?.details || {};
  const albums = Array.isArray(am.albums) ? am.albums : [];
  let albumN = 0, epN = 0, singleN = 0, trackN = 0;
  for (const a of albums) {
    const tc = typeof a?.trackCount === 'number' ? a.trackCount : null;
    if (tc === 1) singleN++;
    else if (tc != null && tc <= 6) epN++;
    else albumN++;
    if (typeof tc === 'number') trackN += tc;
  }
  return { albums: albumN, eps: epN, singles: singleN, tracks: trackN };
}

// ── Page 6: ISRC table or empty-state (artist scans have no per-track ISRC).
function renderIsrcSectionHtml(canonical) {
  const am = canonical?.platforms?.appleMusic?.details || {};
  const lookup = am.isrcLookup;
  if (!lookup?.isrc) {
    return `
      <div class="isrc-empty">
        <p>Identifier verification requires a track-level scan. Run a scan using a specific track URL to see ISRC data.</p>
      </div>
    `;
  }
  // Single-track ISRC (the only shape today).
  return `
    <table class="isrc-table">
      <thead><tr><th>Track Name</th><th>ISRC</th><th>Verification Source</th></tr></thead>
      <tbody>
        <tr>
          <td>${esc(lookup.name || 'Track')}</td>
          <td><code>${esc(lookup.isrc)}</code></td>
          <td>Apple Music</td>
        </tr>
      </tbody>
    </table>
  `;
}

// ── Page 6: ISRC counters.
function isrcCounts(canonical) {
  const am = canonical?.platforms?.appleMusic?.details || {};
  const tracksReviewed = am.isrcLookup ? 1 : 0;
  const isrcsVerified  = am.isrcLookup?.isrc ? 1 : 0;
  return { tracksReviewed, isrcsVerified };
}

// ── Page 7: BIG 6 storefront grid.
const BIG6 = [
  { code: 'us', name: 'United States',  flag: '🇺🇸' },
  { code: 'ca', name: 'Canada',         flag: '🇨🇦' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'de', name: 'Germany',        flag: '🇩🇪' },
  { code: 'fr', name: 'France',         flag: '🇫🇷' },
  { code: 'jp', name: 'Japan',          flag: '🇯🇵' },
  { code: 'au', name: 'Australia',      flag: '🇦🇺' },
];

function renderStorefrontGridHtml(canonical) {
  const sfa = canonical?.platforms?.appleMusic?.details?.storefrontAvailability;
  if (!sfa || typeof sfa !== 'object') {
    return `<div class="storefront-empty">Run a new scan to see territory data.</div>`;
  }
  return `
    <div class="storefront-grid">
      ${BIG6.map((sf) => {
        const ent = sfa[sf.code];
        const avail = ent && Array.isArray(ent.available) ? ent.available.length : 0;
        const status = avail > 0 ? 'verified' : 'not-confirmed';
        const label = avail > 0 ? `${avail} release${avail === 1 ? '' : 's'} available` : 'Not yet verified';
        return `
          <div class="storefront-cell status-${status}">
            <div class="storefront-flag">${sf.flag}</div>
            <div class="storefront-name">${esc(sf.name)}</div>
            <div class="storefront-status">${esc(label)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ── Page 8: metadata visibility checklist.
function renderMetadataChecklistHtml(canonical) {
  const subj = canonical?.subject || {};
  const am   = canonical?.platforms?.appleMusic?.details || {};
  const albums = Array.isArray(am.albums) ? am.albums : [];
  const items = [
    { label: 'Artist name',              verified: !!subj.artistName },
    { label: 'Release dates',            verified: albums.some((a) => !!a?.releaseDate) },
    { label: 'Genre classification',     verified: !!am.primaryGenre || !!(am.genres && am.genres.length) },
    { label: 'Credits',                  verified: false }, // not exposed by canonical today
  ];
  return `
    <ul class="metadata-checklist">
      ${items.map((it) => {
        const s = it.verified ? { label: 'Verified', cls: 'verified' }
                              : { label: 'Not confirmed from reviewed sources', cls: 'not-confirmed' };
        return `
          <li class="metadata-row status-${s.cls}">
            <span class="metadata-label">${esc(it.label)}</span>
            <span class="metadata-status">${esc(s.label)}</span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

// ── Page 9: YouTube visibility block.
function renderYoutubeBlockHtml(canonical) {
  const yt = canonical?.platforms?.youtube || {};
  const details = yt.details || {};
  const matches = Array.isArray(details.confirmedMatches) ? details.confirmedMatches : [];
  const official = matches.filter((m) => m && (m.isOfficial || m.official)).length;
  const status =
    yt.availability === 'VERIFIED' && matches.length > 0 ? { label: 'Verified',      cls: 'verified'      } :
    yt.availability === 'VERIFIED'                       ? { label: 'Limited',       cls: 'partial'       } :
                                                           { label: 'Not Confirmed', cls: 'not-confirmed' };
  return `
    <ul class="youtube-block">
      <li class="yt-row"><span class="yt-label">Qualified Matches</span><span class="yt-value">${matches.length}</span></li>
      <li class="yt-row"><span class="yt-label">Official Videos</span><span class="yt-value">${official}</span></li>
      <li class="yt-row"><span class="yt-label">Status</span><span class="yt-value status-${esc(status.cls)}">${esc(status.label)}</span></li>
      <li class="yt-row"><span class="yt-label">Public Visibility Signals</span><span class="yt-value">${matches.length > 0 ? 'Detected' : 'None observed'}</span></li>
    </ul>
    <p class="yt-disclaimer">Visibility only. Royaltē does not infer revenue, monetization, or UGC claims from public signals.</p>
  `;
}

// ── Page 10: what Royaltē could not verify — derived from drivers + unreached
//    platforms + missing sections. Honest fallback when everything verified.
function renderUnverifiedHtml(canonical, drivers) {
  const items = [];
  const p = canonical?.platforms || {};
  const am = p.appleMusic?.details || {};

  // Platforms with non-VERIFIED availability
  for (const [key, label] of [['appleMusic', 'Apple Music'], ['spotify', 'Spotify'], ['youtube', 'YouTube'], ['musicbrainz', 'MusicBrainz']]) {
    const avail = p[key]?.availability;
    if (avail && avail !== 'VERIFIED') {
      items.push(`${label} presence (${avail.toLowerCase().replace('_', ' ')})`);
    }
  }
  if (!am.storefrontAvailability) {
    items.push('BIG 6 territory storefronts');
  }
  if (!am.isrcLookup?.isrc) {
    items.push('Per-track ISRC verification');
  }

  // De-dupe against driver strings (they say the same thing in tone-locked form)
  if (items.length === 0 && (!drivers || drivers.length === 0)) {
    return `<div class="unverified-empty">All reviewed sources returned data for this scan.</div>`;
  }
  if (items.length === 0) {
    // Fall back to the drivers list verbatim — they ARE the unverified statements
    return `<ul class="unverified-list">${drivers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`;
  }
  return `<ul class="unverified-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
}

// ── Verified platforms list for Page 2.
function verifiedPlatformsList(canonical) {
  const p = canonical?.platforms || {};
  const out = [];
  if (p.appleMusic?.availability  === 'VERIFIED') out.push('Apple Music');
  if (p.spotify?.availability     === 'VERIFIED') out.push('Spotify');
  if (p.youtube?.availability     === 'VERIFIED') out.push('YouTube');
  if (p.musicbrainz?.availability === 'VERIFIED') out.push('MusicBrainz');
  return out;
}

// ── Single source of truth for the V2 Health Score (LOCKED rule).
//    computeV2HealthScore in api/_lib/persist-os-scan.js is the ONLY place
//    that derives the score. Surfaces consume; they do not recompute.
//    Order of preference here:
//      1. payload.health_score / payload.score_breakdown  — stored on the
//         row by persist-os-scan at insert time (the V2 path).
//      2. computeV2HealthScore(canonical)                  — fallback for
//         legacy scans that predate Brief 012a, or the V1 audit_scans path
//         where the renderer-loaded row is not the persisted snapshot.
//    The fallback is the SAME canonical function — never a renderer-local
//    formula.
function resolveHealthScore(payload) {
  const storedScore = typeof payload?.health_score === 'number' ? payload.health_score : null;
  if (storedScore != null) {
    const bk = payload.score_breakdown || {};
    return {
      score:     storedScore,
      drivers:   Array.isArray(bk.drivers) ? bk.drivers : [],
      breakdown: {
        catalog_verification: typeof bk.catalog_verification === 'number' ? bk.catalog_verification : 0,
        big6_coverage:        typeof bk.big6_coverage        === 'number' ? bk.big6_coverage        : 0,
        backend_health:       typeof bk.backend_health       === 'number' ? bk.backend_health       : 0,
        youtube_presence:     typeof bk.youtube_presence     === 'number' ? bk.youtube_presence     : 0,
      },
    };
  }
  return computeV2HealthScore(payload);
}

// ── Top-level builder — assembles every {{placeholder}} value for the template.
function buildPlaceholders(scanId, payload) {
  const canonical = payload || {};
  const subject   = canonical.subject || {};
  const artistName = subject.artistName || 'Unknown Artist';
  const scanDate   = formatScanDate(canonical.scannedAt);

  // V2 Health Score — single source of truth (see resolveHealthScore above).
  const v2 = resolveHealthScore(canonical);
  const band = scoreBand(v2.score);

  const confidence = computeConfidence(canonical);

  // Action plan
  const actions       = buildActions(canonical);
  const actionPlanHtml = renderActionPlanHtml(actions);
  const topActionsHtml = renderTopActionsHtml(actions);

  // Top observations on Page 1 — derived from drivers.
  const topObsHtml = renderTopObservationsHtml(v2.drivers);

  // Page 2 — verified data points + per-category status.
  const verifiedPlatforms = verifiedPlatformsList(canonical);
  const am = canonical.platforms?.appleMusic?.details || {};
  const albums = Array.isArray(am.albums) ? am.albums : [];
  const tracksFound  = albums.reduce((n, a) => n + (typeof a?.trackCount === 'number' ? a.trackCount : 0), 0);
  const releasesFound = albums.length;

  const catalogStatus    = statusFromBool(albums.length >= 1, albums.length === 0 && (am.albumCount || 0) > 0);
  const identifierStatus = statusFromBool(!!am.isrcLookup?.isrc);
  const metadataStatus   = statusFromBool(!!subject.artistName && (am.primaryGenre || (am.genres && am.genres.length)));
  const youtubeStatus    = statusFromBool(canonical.platforms?.youtube?.availability === 'VERIFIED');

  // Page 4 — score breakdown.
  const bk = v2.breakdown || {};
  const driversHtml = renderDriversHtml(v2.drivers);

  // Page 5 — releases + counts.
  const counts = releaseCounts(canonical);
  const releaseListHtml = renderReleaseListHtml(canonical);

  // Page 6 — ISRC.
  const isrc = isrcCounts(canonical);
  const isrcSectionHtml = renderIsrcSectionHtml(canonical);

  // Page 7 — storefront grid.
  const storefrontGridHtml = renderStorefrontGridHtml(canonical);

  // Page 8 — metadata.
  const metadataChecklistHtml = renderMetadataChecklistHtml(canonical);

  // Page 9 — YouTube.
  const youtubeBlockHtml = renderYoutubeBlockHtml(canonical);

  // Page 10 — what could not be verified.
  const unverifiedHtml = renderUnverifiedHtml(canonical, v2.drivers);

  return {
    // Cover + per-page header
    artist_name: esc(artistName),
    scan_date:   esc(scanDate),

    // Page 1 — executive summary
    health_score:     String(v2.score),
    score_band_label: esc(band.label),
    score_band_class: esc(band.cls),
    confidence_label: esc(confidence.label),
    confidence_class: esc(confidence.cls),
    confidence_count: String(confidence.count),
    top_observations_html: topObsHtml,
    top_actions_html:      topActionsHtml,

    // Page 2 — what Royaltē learned
    tracks_found_n:        String(tracksFound),
    releases_found_n:      String(releasesFound),
    verified_platforms:    esc(verifiedPlatforms.length ? verifiedPlatforms.join(', ') : 'None verified in this scan'),
    catalog_status_label:  esc(catalogStatus.label),
    catalog_status_class:  esc(catalogStatus.cls),
    identifier_status_label: esc(identifierStatus.label),
    identifier_status_class: esc(identifierStatus.cls),
    metadata_status_label: esc(metadataStatus.label),
    metadata_status_class: esc(metadataStatus.cls),
    youtube_status_label:  esc(youtubeStatus.label),
    youtube_status_class:  esc(youtubeStatus.cls),

    // Page 3 — action plan
    action_plan_html: actionPlanHtml,
    action_count:     String(actions.length),

    // Page 4 — score breakdown + drivers
    bucket_catalog_pts:  String(bk.catalog_verification ?? 0),
    bucket_big6_pts:     String(bk.big6_coverage        ?? 0),
    bucket_backend_pts:  String(bk.backend_health       ?? 0),
    bucket_youtube_pts:  String(bk.youtube_presence     ?? 0),
    drivers_html:        driversHtml,

    // Page 5 — catalog verification
    catalog_albums_n:  String(counts.albums),
    catalog_eps_n:     String(counts.eps),
    catalog_singles_n: String(counts.singles),
    catalog_tracks_n:  String(counts.tracks),
    release_list_html: releaseListHtml,

    // Page 6 — identifier verification
    tracks_reviewed_n: String(isrc.tracksReviewed),
    isrcs_verified_n:  String(isrc.isrcsVerified),
    isrc_section_html: isrcSectionHtml,

    // Page 7 — BIG 6
    storefront_grid_html: storefrontGridHtml,

    // Page 8 — metadata
    metadata_checklist_html: metadataChecklistHtml,

    // Page 9 — YouTube
    youtube_block_html: youtubeBlockHtml,

    // Page 10 — what could not be verified
    unverified_html: unverifiedHtml,
  };
}

// ── Template fill — {{key}} replace, no expressions, no conditionals. Raw-HTML
//    placeholders (e.g. action_plan_html) carry trusted assembled HTML from
//    the builders above; everything else is HTML-escaped at build time.
function fillTemplate(template, map) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : '';
  });
}

// ── PDFShift ─────────────────────────────────────────────────────────────────
async function renderViaPdfShift(html) {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) throw new Error('PDFSHIFT_API_KEY not configured');

  const auth = Buffer.from(`api:${apiKey}`).toString('base64');
  const resp = await fetch(PDFSHIFT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      source:    html,
      use_print: true,
      format:    'Letter',
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`PDFShift ${resp.status}: ${errText.slice(0, 500) || resp.statusText}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ── Storage upload — uses Supabase getPublicUrl({ download: '...' }) to
//    set Content-Disposition on the response so the browser saves as
//    "Royalte_Review_{ArtistName}.pdf" instead of "{uuid}.pdf".
async function uploadPdf(supabase, scanId, pdfBuffer, artistName) {
  const path = `${scanId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert:      true,
    });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const downloadName = `Royalte_Review_${sanitizeFilenamePart(artistName)}.pdf`;
  const { data: pub } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path, { download: downloadName });
  if (!pub?.publicUrl) throw new Error('Storage upload succeeded but public URL missing');
  return pub.publicUrl;
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function renderAuditPdf(scanId) {
  if (!scanId || typeof scanId !== 'string') {
    throw new Error('renderAuditPdf: scanId required');
  }

  const supabase = getSupabase();

  // Load row
  const { data: row, error: loadErr } = await supabase
    .from('audit_scans')
    .select('id, payload, pdf_status, pdf_url, pdf_attempts')
    .eq('id', scanId)
    .single();
  if (loadErr || !row) {
    throw new Error(`audit_scans row not found for scanId ${scanId}: ${loadErr?.message || 'no row'}`);
  }

  // Idempotent short-circuit — already rendered.
  if (row.pdf_status === 'ready' && row.pdf_url) {
    return {
      scanId,
      pdfUrl:          row.pdf_url,
      pdfStatus:       'ready',
      alreadyRendered: true,
    };
  }

  // Mark rendering + bump attempts.
  const nextAttempts = (row.pdf_attempts || 0) + 1;
  const { error: markErr } = await supabase
    .from('audit_scans')
    .update({
      pdf_status:   'rendering',
      pdf_attempts: nextAttempts,
      pdf_error:    null,
    })
    .eq('id', scanId);
  if (markErr) throw new Error(`audit_scans mark-rendering failed: ${markErr.message}`);

  try {
    const template = await readFile(TEMPLATE_PATH, 'utf8');
    const map      = buildPlaceholders(scanId, row.payload || {});
    const html     = fillTemplate(template, map);
    const pdfBuf   = await renderViaPdfShift(html);
    const artist   = row.payload?.subject?.artistName || 'Artist';
    const pdfUrl   = await uploadPdf(supabase, scanId, pdfBuf, artist);

    const { error: doneErr } = await supabase
      .from('audit_scans')
      .update({
        pdf_status:      'ready',
        pdf_url:         pdfUrl,
        pdf_rendered_at: new Date().toISOString(),
        pdf_error:       null,
      })
      .eq('id', scanId);
    if (doneErr) throw new Error(`audit_scans finalize failed: ${doneErr.message}`);

    return {
      scanId,
      pdfUrl,
      pdfStatus:       'ready',
      alreadyRendered: false,
    };
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 2000);
    await supabase
      .from('audit_scans')
      .update({ pdf_status: 'failed', pdf_error: msg })
      .eq('id', scanId);
    throw err;
  }
}

// ── Test helper — pure, no DB / network. Used by tests/review-render-test.mjs
//    to verify the placeholder map shape and HTML fragment integrity against
//    a canonical fixture without hitting PDFShift or Supabase.
export function _buildPlaceholdersForTest(payload, scanId = 'TEST-SCAN-ID') {
  return buildPlaceholders(scanId, payload);
}
