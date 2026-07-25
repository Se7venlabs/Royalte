// Executive History Summary™ — ATHENA™ Phase 3B (Amendment 2)
//
// A lightweight executive aggregation over the archive -- never a second
// persistence layer. Everything below is computed live from
// api/_lib/executive-brief-archive-reader.js on every call; nothing is
// cached or stored.
//
// Methodology (stated explicitly):
//   - "Archived Executive Briefs" is a true total count (countBriefs()),
//     independent of any analysis window.
//   - Domain-level analysis (Most Improved / Most Volatile) runs over up to
//     ANALYSIS_WINDOW_LIMIT most recent briefs, chronological order. If the
//     artist has more archived history than that, `windowLimited: true` says
//     so honestly rather than silently analyzing a subset and calling it complete.
//   - "Most Improved Domain" -- the domain with the largest NET DECREASE in
//     risk count from the first to the last brief in the analyzed window.
//     Unlike Cross-Scan Trend Intelligence™ (which classifies each domain
//     independently as improving/declining/etc.), this picks the single
//     biggest mover, and only if at least one domain genuinely improved --
//     never a "least bad" fallback when nothing did.
//   - "Most Volatile Domain" -- the domain with the greatest TOTAL VARIATION
//     (sum of |change| between every consecutive pair of archived briefs in
//     the window), not just net first-to-last movement. This intentionally
//     differs from the improvement metric: a domain that oscillated up and
//     down repeatedly is volatile even if it net-improved or ended flat.
//     Only reported if some domain actually moved (total variation > 0).

import { listBriefs, countBriefs } from './executive-brief-archive-reader.js';
import { domainLabel } from './executive-domain-labels.js';

const ANALYSIS_WINDOW_LIMIT = 100;

function countByDomain(items) {
  const counts = {};
  for (const item of items || []) {
    const d = item.affectedDomain;
    if (!d) continue;
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

export async function getExecutiveHistorySummary(supabase, artistProfileId) {
  const archivedBriefCount = await countBriefs(supabase, artistProfileId);

  if (archivedBriefCount === 0) {
    return {
      available: false,
      reason: 'No archived Executive Briefs yet.',
      archivedBriefCount: 0,
    };
  }

  const briefs = await listBriefs(supabase, artistProfileId, { limit: ANALYSIS_WINDOW_LIMIT, full: true, order: 'asc' });
  const windowLimited = archivedBriefCount > briefs.length;

  const first = briefs[0];
  const last = briefs[briefs.length - 1];
  const riskCounts = briefs.map(b => b.risk_count);

  let mostImprovedDomain = null;
  let mostVolatileDomain = null;

  if (briefs.length >= 2) {
    const allDomains = new Set();
    briefs.forEach(b => Object.keys(countByDomain(b.executive_intelligence_object.risks)).forEach(d => allDomains.add(d)));

    let bestImprovement = 0;
    let mostVariation = 0;

    allDomains.forEach((domain) => {
      const series = briefs.map(b => countByDomain(b.executive_intelligence_object.risks)[domain] || 0);
      const netImprovement = series[0] - series[series.length - 1]; // positive = fewer risks now

      let totalVariation = 0;
      for (let i = 1; i < series.length; i++) totalVariation += Math.abs(series[i] - series[i - 1]);

      if (netImprovement > bestImprovement) {
        bestImprovement = netImprovement;
        mostImprovedDomain = { domain, label: domainLabel(domain), netImprovement };
      }
      if (totalVariation > mostVariation) {
        mostVariation = totalVariation;
        mostVolatileDomain = { domain, label: domainLabel(domain), totalVariation };
      }
    });
  }

  return {
    available: true,
    archivedBriefCount,
    analyzedBriefCount: briefs.length,
    windowLimited,
    firstExecutiveScanAt: first.generated_at,
    latestExecutiveScanAt: last.generated_at,
    highestRecordedRiskCount: Math.max(...riskCounts),
    lowestRecordedRiskCount: Math.min(...riskCounts),
    mostImprovedDomain,
    mostVolatileDomain,
  };
}
