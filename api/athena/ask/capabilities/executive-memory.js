// Executive Memory™ capability — ATHENA™ Phase 3E Capability Registry™
//
// Read-only consumer of Phase 3C's persisted memory items (passed in via
// rawInputs.memoryItems -- fetched by the caller, never queried here; this
// capability never writes -- Memory Promotion™ stays owned exclusively by
// api/_lib/executive-memory-store.js).

import { registerCapability } from './registry.js';

const MAX_EVIDENCE_ITEMS = 10;

function items(rawInputs) {
  return Array.isArray(rawInputs.memoryItems) ? rawInputs.memoryItems : [];
}

function buildContext(rawInputs) {
  const list = items(rawInputs);
  if (list.length === 0) {
    return { available: false, summary: 'No Executive Memory™ items recorded yet.', data: null };
  }
  return {
    available: true,
    summary: `${list.length} active Executive Memory™ item(s) on record.`,
    data: { items: list },
  };
}

registerCapability({
  name: 'executiveMemory',
  advertiseAvailability(rawInputs) { return buildContext(rawInputs).available; },
  buildContext,
  provideEvidence(rawInputs) {
    return items(rawInputs).slice(0, MAX_EVIDENCE_ITEMS).map(item => ({
      fact: item.statement,
      sourceType: 'Executive Memory',
      sourceId: item.id || null,
    }));
  },
  provideConfidence(rawInputs) {
    return items(rawInputs).length > 0 ? 'HIGH' : 'INSUFFICIENT_DATA';
  },
  provideCitations(rawInputs) {
    if (items(rawInputs).length === 0) return [];
    return [{ label: 'Executive Memory™', workspace: '/workspaces/ai-insights.html' }];
  },
});
