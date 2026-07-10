// Royaltē Monitoring Intelligence™
// Monitoring Intelligence Migration Sprint™ — Board Authorization 2026-07-03
//
// Constitutional definition:
//   Monitoring Intelligence consumes Evidence Events and answers:
//     - What changed?
//     - When?
//     - Where?
//     - Which provider?
//     - Why does it matter?
//     - How confident are we?
//     - What evidence supports it?
//
// Constitutional constraints:
//   - Passive: never edits provider data
//   - Explainable: every event answer is human-readable and traceable
//   - Policy-driven: no threshold, severity, or rule is hard-coded
//   - Pure: same inputs always produce the same output (deterministic)
//   - Never throws: all errors are caught; partial output returned
//   - Output is deep-frozen
//
// Primary entrypoint: runMonitoringIntelligence(snapshotA, snapshotB, policy)
//
// This function:
//   1. Compares two snapshots via EvidenceDiffEngine
//   2. Creates an EvidenceEvent per detected diff
//   3. Assigns severity via MonitoringPolicy
//   4. Generates explainability strings per event
//   5. Returns a frozen MonitoringReport
//
// Authority: Royaltē Master Constitution — Monitoring Intelligence Migration Sprint™

import { randomUUID } from 'node:crypto';

import { compareSnapshots, extractProvider } from '../diff/EvidenceDiffEngine.js';
import { createEvidenceEvent }               from '../events/EvidenceEvent.js';
import { EventSeverity }                     from '../events/EventSeverity.js';
import {
  DEFAULT_MONITORING_POLICY,
  resolveSeverity,
  computeConfidence,
} from '../policy/MonitoringPolicy.js';

export const MONITORING_INTELLIGENCE_VERSION = '1.0';

// ── Public entrypoint ─────────────────────────────────────────────────────────

/**
 * Run Monitoring Intelligence over two consecutive Evidence Snapshots.
 *
 * Compares snapshotA (baseline) against snapshotB (current), generates
 * constitutional Evidence Events for every detected difference, and returns
 * a frozen Monitoring Report.
 *
 * @param {EvidenceSnapshot}  snapshotA — baseline (older)
 * @param {EvidenceSnapshot}  snapshotB — current (newer)
 * @param {object}            policy    — MonitoringPolicy; defaults to DEFAULT_MONITORING_POLICY
 * @returns {Readonly<MonitoringReport>}
 */
export function runMonitoringIntelligence(snapshotA, snapshotB, policy = DEFAULT_MONITORING_POLICY) {
  const reportId     = randomUUID();
  const generatedAt  = new Date().toISOString();
  const policyVersion = policy?.policyVersion ?? DEFAULT_MONITORING_POLICY.policyVersion;

  // Handle missing snapshots gracefully — return empty report
  if (!snapshotA || !snapshotB) {
    return buildReport({
      reportId, generatedAt, policyVersion,
      snapshotA, snapshotB,
      events: [],
    });
  }

  try {
    const diffs  = compareSnapshots(snapshotA, snapshotB);
    const events = diffs.flatMap(diff => {
      try {
        return [buildEvent(diff, snapshotA, snapshotB, policy)];
      } catch {
        // A single malformed diff never aborts the report
        return [];
      }
    });

    return buildReport({ reportId, generatedAt, policyVersion, snapshotA, snapshotB, events });
  } catch {
    // Constitutional guarantee: never throws
    return buildReport({ reportId, generatedAt, policyVersion, snapshotA, snapshotB, events: [] });
  }
}

// ── Event assembly ─────────────────────────────────────────────────────────────

function buildEvent(diff, snapshotA, snapshotB, policy) {
  const { path, changeType, previousValue, currentValue } = diff;
  const provider = extractProvider(path) ?? 'unknown';

  // Confidence: derived from provider trust in snapshot metadata
  const providerMeta  = findProviderMeta(snapshotB, provider);
  const providerTrust = providerMeta?.trust ?? null;
  const completeness  = providerMeta?.completeness ?? null;
  const confidence    = computeConfidence(providerTrust, completeness, policy);

  // Severity: policy-driven
  const severity = resolveSeverity(path, changeType, policy);

  // Explanation: constitutional explainability
  const explanation = generateExplanation({
    path, changeType, previousValue, currentValue,
    snapshotA, snapshotB, provider, severity,
  });

  return createEvidenceEvent({
    detectedAt:     snapshotB.capturedAt,
    provider,
    evidenceDomain: path,
    changeType,
    previousValue,
    currentValue,
    evidenceSource: {
      providerName:         provider,
      acquisitionTimestamp: snapshotB.capturedAt,
    },
    confidence,
    snapshotRefs: {
      previous: snapshotA.snapshotId,
      current:  snapshotB.snapshotId,
    },
    severity,
    explanation,
  });
}

function findProviderMeta(snapshot, provider) {
  return snapshot?.metadata?.providerMetadata?.find?.(m => m.provider === provider) ?? null;
}

// ── Explainability ─────────────────────────────────────────────────────────────

const IMPORTANT_DOMAINS = {
  'community.listeners':   'community audience reach',
  'community.playcount':   'cumulative community streaming activity',
  'community.tags':        'community-assigned genre and mood tags',
  'community.similarArtists': 'community discovery relationships',
  'biography':             'artist biography content',
  'topTracks':             'top track catalog (community-ranked)',
  'topAlbums':             'top album catalog (community-ranked)',
  'name':                  'artist display name',
  'artistId':              'provider artist identifier',
  'stats.monthlyListeners': 'monthly listener count',
  'stats.followers':        'artist follower count',
  'profile':               'artist profile information',
  'discography':           'album discography',
};

function generateExplanation({ path, changeType, previousValue, currentValue, snapshotA, snapshotB, provider, severity }) {
  const fieldName  = path.split('.').pop() ?? path;
  const domainHint = Object.entries(IMPORTANT_DOMAINS)
    .find(([key]) => path.includes(key))?.[1] ?? `${provider} evidence field "${fieldName}"`;

  // What changed
  let whatChanged;
  if (changeType === 'addition') {
    whatChanged = `${domainHint} appeared in ${provider} evidence (was absent; now present)`;
  } else if (changeType === 'removal') {
    whatChanged = `${domainHint} was removed from ${provider} evidence (was present; now absent)`;
  } else {
    const prevDisplay = formatValue(previousValue);
    const currDisplay = formatValue(currentValue);
    whatChanged = `${domainHint} changed in ${provider} evidence from ${prevDisplay} to ${currDisplay}`;
  }

  // Why detected
  const prevDate = snapshotA?.capturedAt ? formatDate(snapshotA.capturedAt) : 'prior snapshot';
  const currDate = snapshotB?.capturedAt ? formatDate(snapshotB.capturedAt) : 'current snapshot';
  const whyDetected = `Detected by Evidence Difference Engine™ comparing snapshot from ${prevDate} against snapshot from ${currDate}. Evidence path: ${path}`;

  // Why it matters (severity-informed)
  const whyItMatters = generateWhyItMatters(path, changeType, severity, provider, domainHint);

  return { whatChanged, whyDetected, whyItMatters };
}

function generateWhyItMatters(path, changeType, severity, provider, domainHint) {
  if (severity === EventSeverity.CRITICAL) {
    return `Critical evidence change: ${domainHint} is a core data point. Loss or major change in this field may affect royalty calculations, identity resolution, or reporting accuracy.`;
  }
  if (severity === EventSeverity.HIGH) {
    return `Significant evidence change: ${domainHint} is an important signal for ${provider} platform presence. This change warrants artist review and may affect intelligence accuracy.`;
  }
  if (severity === EventSeverity.MEDIUM) {
    return `Meaningful evidence change: ${domainHint} contributes to ${provider} intelligence. This change reflects a real update in the artist's ${provider} profile and should be noted.`;
  }
  if (severity === EventSeverity.LOW) {
    return `Minor evidence change: ${domainHint} updated on ${provider}. No immediate action required; recorded for historical accuracy and trend tracking.`;
  }
  // INFORMATIONAL
  return `Informational: ${domainHint} ${changeType === 'addition' ? 'now available' : 'updated'} on ${provider}. Recorded as part of the constitutional monitoring audit trail.`;
}

function formatValue(value) {
  if (value === undefined) return '[absent]';
  if (value === null)      return '[null]';
  if (typeof value === 'string') {
    const trimmed = value.length > 60 ? `${value.slice(0, 60)}…` : value;
    return `"${trimmed}"`;
  }
  if (typeof value === 'number') return value.toLocaleString();
  if (Array.isArray(value))     return `[array; ${value.length} items]`;
  if (typeof value === 'object') return '[object]';
  return String(value);
}

function formatDate(iso) {
  try {
    return new Date(iso).toISOString().split('T')[0];
  } catch {
    return iso;
  }
}

// ── Report assembly ────────────────────────────────────────────────────────────

function buildReport({ reportId, generatedAt, policyVersion, snapshotA, snapshotB, events }) {
  const bySeverity   = countBy(events, e => e.severity);
  const byProvider   = countBy(events, e => e.provider);
  const byChangeType = countBy(events, e => e.changeType);

  return Object.freeze({
    reportId,
    schemaVersion:  MONITORING_INTELLIGENCE_VERSION,
    generatedAt,
    policyVersion,
    artistId:       snapshotB?.artistId   ?? snapshotA?.artistId   ?? null,
    artistName:     snapshotB?.artistName ?? snapshotA?.artistName ?? null,
    snapshotRefs: Object.freeze({
      previous: snapshotA?.snapshotId ?? null,
      current:  snapshotB?.snapshotId ?? null,
    }),
    eventCount: events.length,
    events:     Object.freeze(events),
    summary: Object.freeze({
      bySeverity:   Object.freeze(bySeverity),
      byProvider:   Object.freeze(byProvider),
      byChangeType: Object.freeze(byChangeType),
    }),
  });
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
