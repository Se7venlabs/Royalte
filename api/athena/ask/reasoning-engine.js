// Executive Reasoning Engine™ — ATHENA™ Phase 3E, Decision Layer™
//
// Deterministic Before Generative™: if Royaltē already knows the answer,
// no AI provider is ever invoked. Sits between the Question Classifier and
// the AI pipeline. Built on the same Capability Registry the Context
// Builder uses -- the only difference between the two exits is whether an
// LLM is consulted, never which data layer is queried.
//
// attemptDeterministicAnswer(...) tries a small, bounded set of matcher/
// composer pairs, one per deterministic question shape the Board named
// explicitly. A match with insufficient underlying data still returns
// deterministically (an "insufficient evidence" answer costs no AI call
// either) -- only a question that matches NO pattern returns null, letting
// the pipeline fall through to the Context Builder.
//
// rawInputs shape (assembled by the caller -- api/ask-athena.js or a test
// harness): { artistProfileId, scanPayload, previousScanPayload,
// schemaVersion, previousSchemaVersion, latestBrief, previousBrief,
// briefCount, memoryItems, recurringIssues, resolvedIssues, conversationTurns }.

import { compareExecutiveBriefs } from '../../_lib/executive-comparison.js';
import { getCapability } from './capabilities/registry.js';
import {
  buildResponseContract, makeInsufficientEvidenceResponse, ANSWER_TYPES,
} from './response-contract.js';

const PROVIDER_VERSION = 'deterministic';

function scanPayloadsFor(rawInputs) {
  if (!rawInputs.scanPayload || !rawInputs.previousScanPayload) return undefined;
  return {
    before: { payload: rawInputs.previousScanPayload, schemaVersion: rawInputs.previousSchemaVersion },
    after:  { payload: rawInputs.scanPayload,          schemaVersion: rawInputs.schemaVersion },
  };
}

function composeCompareLastTwoScans(rawInputs, meta) {
  if (!rawInputs.latestBrief || !rawInputs.previousBrief) {
    return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  }
  const cmp = compareExecutiveBriefs(rawInputs.previousBrief, rawInputs.latestBrief, {
    scanPayloads: scanPayloadsFor(rawInputs),
  });
  const changedDomains = (cmp.canonicalDomains || []).filter(d => d.state !== 'UNCHANGED' && d.state !== 'UNKNOWN');
  const evidence = (cmp.canonicalDomains || []).map(d => ({ fact: d.detail, sourceType: 'Canonical Domain', sourceId: d.domain }));
  const summary = `Overall level moved ${cmp.overallLevelBefore || 'Unknown'} -> ${cmp.overallLevelAfter || 'Unknown'}; risk count ${cmp.riskCountBefore} -> ${cmp.riskCountAfter}.`;
  const answer = changedDomains.length > 0
    ? `${summary} ${changedDomains.length} domain(s) changed: ${changedDomains.map(d => `${d.label} (${d.state})`).join(', ')}.`
    : `${summary} No canonical domains changed between these two scans.`;
  return buildResponseContract({
    ...meta,
    answer, summary, evidence,
    answerType: ANSWER_TYPES.DERIVED_CONCLUSION,
    confidence: 'HIGH',
    citations: [{ label: 'Cross-Scan Intelligence™', workspace: '/workspaces/ai-insights.html' }],
    relatedBriefIds: [rawInputs.previousBrief.executive_brief_id, rawInputs.latestBrief.executive_brief_id],
    relatedWorkspaces: ['/workspaces/ai-insights.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

function risksByDomain(rawInputs, domain) {
  const risks = (rawInputs.latestBrief && rawInputs.latestBrief.executive_intelligence_object && rawInputs.latestBrief.executive_intelligence_object.risks) || [];
  return risks.filter(r => r.affectedDomain === domain);
}

function composeUnresolvedPublishingIssues(rawInputs, meta) {
  if (!rawInputs.latestBrief) return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  const risks = risksByDomain(rawInputs, 'publishing');
  const answer = risks.length > 0
    ? `${risks.length} unresolved Publishing issue(s): ${risks.map(r => r.title).join('; ')}.`
    : 'No unresolved Publishing issues in your latest Executive Brief.';
  return buildResponseContract({
    ...meta,
    answer, summary: answer,
    evidence: risks.map(r => ({ fact: r.title, sourceType: 'Executive Brief', sourceId: r.riskId || null })),
    answerType: risks.length > 0 ? ANSWER_TYPES.CONFIRMED_FACT : ANSWER_TYPES.CONFIRMED_FACT,
    confidence: 'HIGH',
    citations: [{ label: 'Publishing Intelligence™', workspace: '/workspaces/publishing-intelligence.html' }],
    relatedWorkspaces: ['/workspaces/publishing-intelligence.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

function composeMissingRegistrations(rawInputs, meta) {
  if (!rawInputs.latestBrief) return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  const risks = risksByDomain(rawInputs, 'publishing').filter(r => /regist/i.test(r.title || '') || /regist/i.test(r.description || ''));
  const answer = risks.length > 0
    ? `${risks.length} registration gap(s) detected: ${risks.map(r => r.title).join('; ')}.`
    : 'No missing registrations detected in your latest Executive Brief.';
  return buildResponseContract({
    ...meta,
    answer, summary: answer,
    evidence: risks.map(r => ({ fact: r.title, sourceType: 'Executive Brief', sourceId: r.riskId || null })),
    answerType: ANSWER_TYPES.CONFIRMED_FACT,
    confidence: 'HIGH',
    citations: [{ label: 'Publishing Intelligence™', workspace: '/workspaces/publishing-intelligence.html' }],
    relatedWorkspaces: ['/workspaces/publishing-intelligence.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

function composeShowExecutiveMemory(rawInputs, meta) {
  const capability = getCapability('executiveMemory');
  const ctx = capability ? capability.buildContext(rawInputs) : { available: false };
  if (!ctx.available) return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  const items = ctx.data.items;
  const answer = `${items.length} active Executive Memory™ item(s): ${items.slice(0, 10).map(i => i.statement).join('; ')}${items.length > 10 ? '…' : ''}`;
  return buildResponseContract({
    ...meta,
    answer, summary: ctx.summary,
    evidence: capability.provideEvidence(rawInputs),
    answerType: ANSWER_TYPES.CONFIRMED_FACT,
    confidence: 'HIGH',
    citations: capability.provideCitations(rawInputs),
    relatedMemoryIds: items.map(i => i.id).filter(Boolean),
    relatedWorkspaces: ['/workspaces/ai-insights.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

function composeRecurringRisks(rawInputs, meta) {
  const recurring = Array.isArray(rawInputs.recurringIssues) ? rawInputs.recurringIssues : [];
  if (recurring.length === 0 && !Array.isArray(rawInputs.recurringIssues)) {
    return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  }
  const answer = recurring.length > 0
    ? `${recurring.length} recurring risk(s) across your scan history: ${recurring.map(r => r.title).join('; ')}.`
    : 'No recurring risks detected across your scan history.';
  return buildResponseContract({
    ...meta,
    answer, summary: answer,
    evidence: recurring.map(r => ({ fact: r.title, sourceType: 'Executive Brief', sourceId: r.firstSeenExecutiveBriefId || null })),
    answerType: ANSWER_TYPES.DERIVED_CONCLUSION,
    confidence: 'HIGH',
    citations: [{ label: 'Executive Memory™', workspace: '/workspaces/ai-insights.html' }],
    relatedWorkspaces: ['/workspaces/ai-insights.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

function composeHistoricalImprovements(rawInputs, meta) {
  const resolved = Array.isArray(rawInputs.resolvedIssues) ? rawInputs.resolvedIssues : [];
  if (resolved.length === 0 && !Array.isArray(rawInputs.resolvedIssues)) {
    return makeInsufficientEvidenceResponse({ ...meta, providerVersion: PROVIDER_VERSION });
  }
  const answer = resolved.length > 0
    ? `${resolved.length} issue(s) resolved since first detected: ${resolved.map(r => r.title).join('; ')}.`
    : 'No resolved issues yet across your scan history.';
  return buildResponseContract({
    ...meta,
    answer, summary: answer,
    evidence: resolved.map(r => ({ fact: r.title, sourceType: 'Executive Brief', sourceId: r.firstSeenExecutiveBriefId || null })),
    answerType: ANSWER_TYPES.DERIVED_CONCLUSION,
    confidence: 'HIGH',
    citations: [{ label: 'Executive Memory™', workspace: '/workspaces/ai-insights.html' }],
    relatedWorkspaces: ['/workspaces/ai-insights.html'],
    providerVersion: PROVIDER_VERSION,
  });
}

// Ordered most-specific-first -- the first matching pattern wins.
const PATTERNS = [
  { id: 'compare_last_two_scans',        matches: q => /compar(e|ison)|last two scans|since my last scan|what changed/i.test(q), compose: composeCompareLastTwoScans },
  { id: 'missing_registrations',         matches: q => /missing.*regist|regist.*missing/i.test(q),                                compose: composeMissingRegistrations },
  { id: 'unresolved_publishing_issues',  matches: q => /unresolved.*publish|publish.*(issue|problem)/i.test(q),                    compose: composeUnresolvedPublishingIssues },
  { id: 'show_executive_memory',         matches: q => /show.*(my )?(executive )?memory|what.*memory/i.test(q),                    compose: composeShowExecutiveMemory },
  { id: 'list_recurring_risks',          matches: q => /recurring (risk|issue)/i.test(q),                                          compose: composeRecurringRisks },
  { id: 'historical_improvements',       matches: q => /historical improvement|what.*improved|resolved issues/i.test(q),           compose: composeHistoricalImprovements },
];

// attemptDeterministicAnswer({question, intent, category, rawInputs}) ->
// ResponseContract | null. Returns null only when no deterministic pattern
// matches the question at all -- the pipeline then proceeds to the Context
// Builder / AI-required path.
export function attemptDeterministicAnswer({ question, intent, category, rawInputs }) {
  const text = typeof question === 'string' ? question : '';
  const meta = { questionCategory: category, questionIntent: intent };
  for (const pattern of PATTERNS) {
    if (pattern.matches(text)) {
      return pattern.compose(rawInputs || {}, meta);
    }
  }
  return null;
}

// Exported for testing.
export { PATTERNS };
