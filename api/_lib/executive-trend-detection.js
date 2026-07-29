// Cross-Scan Trend Intelligence™ — ATHENA™ Phase 3B
//
// Classifies each domain's risk trajectory across an ordered series of
// archived Executive Briefs. Reads only through data already fetched via
// api/_lib/executive-brief-archive-reader.js — never queries the archive
// directly.
//
// Methodology (stated explicitly, not left implicit): for each domain that
// appears in any brief in the window, count real risks with that
// affectedDomain in the FIRST and LAST brief of the window, and classify by
// comparing the two endpoints:
//   emerging  — zero risks at the start, one or more by the end
//   resolved  — one or more risks at the start, zero by the end
//   improving — risk count decreased (but did not reach zero)
//   declining — risk count increased
//   stable    — unchanged
// This is deliberately an endpoint comparison, not a full trendline fit — it
// doesn't look at monotonicity within the window (a domain that got worse
// then better between the first and last brief would read as "stable" or
// whatever the endpoints show). That's a real, disclosed limitation of this
// v1, not hidden: a genuine trendline (weekly/monthly/quarterly aggregation)
// is future work once there's enough archived history per artist to make it
// meaningful — with 2-3 archived briefs today, an endpoint comparison is the
// only honest thing to compute.

import { domainLabel } from './executive-domain-labels.js';
import { compareDomain, DOMAIN_FINGERPRINTS } from './canonical-domain-fingerprints.js';

function countByDomain(items) {
  const counts = {};
  for (const item of items || []) {
    const d = item.affectedDomain;
    if (!d) continue;
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

// detectDomainTrends(briefs, options) -- briefs: FULL archive rows,
// chronological order (oldest first). Caller (executive-timeline.js or the
// trend endpoint) is responsible for fetching in that order via
// listBriefs(..., {order:'asc'}).
//
// options.scanPayloads: optional { first: {payload, schemaVersion}, last: {payload, schemaVersion} }
// -- the two real audit_scans rows for the window's first/last brief. When
// present, adds Phase 3D's canonicalDomains (real per-field domain trend,
// same endpoint-comparison methodology as the risk-count `domains` below --
// canonical-domain-fingerprints.js). Backward compatible: omitting it leaves
// this function's original output unchanged.
export function detectDomainTrends(briefs, options = {}) {
  if (!Array.isArray(briefs) || briefs.length < 2) {
    return {
      available: false,
      reason: 'At least two archived Executive Briefs are required to detect a trend.',
      domains: [],
      canonicalDomains: null,
    };
  }
  const { scanPayloads } = options;

  const first = briefs[0];
  const last  = briefs[briefs.length - 1];
  const firstCounts = countByDomain((first.executive_intelligence_object || {}).risks);
  const lastCounts  = countByDomain((last.executive_intelligence_object  || {}).risks);

  const allDomains = new Set([...Object.keys(firstCounts), ...Object.keys(lastCounts)]);

  const domains = [...allDomains].sort().map(domain => {
    const start = firstCounts[domain] || 0;
    const end   = lastCounts[domain]  || 0;
    let classification;
    if (start === 0 && end > 0)      classification = 'emerging';
    else if (start > 0 && end === 0) classification = 'resolved';
    else if (end < start)            classification = 'improving';
    else if (end > start)            classification = 'declining';
    else                              classification = 'stable';
    return {
      domain,
      label: domainLabel(domain),
      riskCountAtStart: start,
      riskCountAtEnd: end,
      classification,
    };
  });

  return {
    available: true,
    windowSize: briefs.length,
    windowStart: first.generated_at,
    windowEnd: last.generated_at,
    domains,
    canonicalDomains: buildCanonicalDomainTrends(scanPayloads),
  };
}

// Phase 3D — same endpoint-comparison methodology as `domains` above
// (first vs. last brief in the window, not a full trendline fit -- see this
// file's header). Returns null (not []) when scanPayloads wasn't supplied.
function buildCanonicalDomainTrends(scanPayloads) {
  if (!scanPayloads || !scanPayloads.first || !scanPayloads.last) return null;
  const schemaCompatible = !!(scanPayloads.first.schemaVersion) &&
    scanPayloads.first.schemaVersion === scanPayloads.last.schemaVersion;
  return Object.keys(DOMAIN_FINGERPRINTS).map(domainKey =>
    compareDomain(domainKey, scanPayloads.first.payload, scanPayloads.last.payload, { schemaCompatible })
  );
}
