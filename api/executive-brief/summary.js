// Canonical Intelligence Platform™ -- Executive Brief™ Summary
// Assembles the Executive Summary™ from ATHENA™ analysis and monitoring data.
// executiveScore = 100 - riskScore (higher is better).

import { randomUUID } from 'node:crypto';

function extractData(response) {
  return (response?.status === 'SUCCESS' && response?.data) ? response.data : {};
}

export function buildExecutiveSummary(apiResponses = {}, athenaReport = null, _metrics = null, timeline = null) {
  const identity        = extractData(apiResponses.identity);
  const riskAnalysis    = athenaReport?.riskAnalysis;
  const oppAnalysis     = athenaReport?.opportunityAnalysis;
  const recommendations = Array.isArray(athenaReport?.recommendations) ? athenaReport.recommendations : [];
  const healthSummary   = athenaReport?.executiveAnalysis?.healthSummary;

  const topPriorities = recommendations
    .filter(r => r.priority === 'URGENT' || r.priority === 'HIGH')
    .slice(0, 5)
    .map(r => Object.freeze({
      action:     r.recommendedAction,
      priority:   r.priority,
      sourceType: r.sourceType,
    }));

  const highestRisks = (riskAnalysis?.risks || [])
    .filter(r => r.level === 'CRITICAL' || r.level === 'HIGH')
    .slice(0, 5)
    .map(r => Object.freeze({ title: r.title, level: r.level, category: r.category }));

  const biggestOpportunities = (oppAnalysis?.opportunities || [])
    .filter(o => o.priority === 'URGENT' || o.priority === 'HIGH')
    .slice(0, 3)
    .map(o => Object.freeze({ title: o.title, type: o.type, priority: o.priority }));

  const latestChanges = (timeline?.events || [])
    .slice(0, 5)
    .map(e => Object.freeze({
      title:     e.title || e.field || 'Change detected',
      severity:  e.severity  || null,
      timestamp: e.timestamp || e.detectedAt || null,
    }));

  const riskScore = riskAnalysis?.riskScore ?? null;

  return Object.freeze({
    summaryId:                randomUUID(),
    generatedAt:              new Date().toISOString(),
    artistId:                 identity.artistId   ?? null,
    artistName:               identity.artistName ?? null,
    overallHealth:            healthSummary?.overallLevel ?? 'UNKNOWN',
    executiveScore:           riskScore != null ? 100 - riskScore : null,
    riskScore,
    riskLevel:                riskAnalysis?.riskLevel ?? null,
    topPriorities:            Object.freeze(topPriorities),
    highestRisks:             Object.freeze(highestRisks),
    biggestOpportunities:     Object.freeze(biggestOpportunities),
    latestSignificantChanges: Object.freeze(latestChanges),
    totalRisks:               riskAnalysis?.risks?.length          ?? 0,
    totalOpportunities:       oppAnalysis?.opportunities?.length   ?? 0,
    totalRecommendations:     recommendations.length,
    criticalRisks:            (riskAnalysis?.risks || []).filter(r => r.level === 'CRITICAL').length,
    urgentRecommendations:    recommendations.filter(r => r.priority === 'URGENT').length,
  });
}
