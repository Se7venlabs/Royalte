// Executive Memory™ — ATHENA™ Phase 3B (derived) + Phase 3C (persisted)
//
// Two distinct sources merged into one response:
//
// 1. Derived from the archive alone (Phase 3B, unchanged): which risks
//    recur across scans, and which have been resolved (present in an
//    earlier archived brief, absent from the latest). Reads exclusively
//    through api/_lib/executive-brief-archive-reader.js.
//
// 2. Real, persisted memory items (Phase 3C): Goals, Dismissed
//    Recommendations, and Milestones are artist-authored intent -- not
//    derivable from archived Executive Intelligence Objects, which only
//    ever record what ATHENA observed, never what an artist decided or
//    dismissed. Phase 3B left these honestly `available: false` pending a
//    writable store; that store now exists
//    (supabase/migrations/20260730000000_executive_memory_items.sql,
//    api/_lib/executive-memory-store.js) and is read here via
//    listActiveMemoryItems(), grouped by memory_type. `available: true`
//    now reflects that the capability itself exists -- an empty `items`
//    array means no items yet, not "no store exists."

import { listBriefs } from './executive-brief-archive-reader.js';

const TABLE = 'executive_memory_items';

function riskKey(risk) {
  return `${risk.affectedDomain || 'unknown'}::${risk.title || ''}`;
}

// Real persisted items only (never throws -- an empty/failed read degrades
// to an empty list, exactly like every other honest-empty-state pattern in
// this codebase; a memory read failure must never break the rest of this
// response, which the derived recurring/resolved data above can still serve).
async function listActiveMemoryItems(supabase, artistProfileId) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('artist_profile_id', artistProfileId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[executive-memory] listActiveMemoryItems failed:', error.message || error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[executive-memory] unexpected error reading memory items:', err?.message || err);
    return [];
  }
}

function groupByType(items, memoryType) {
  return items.filter(i => i.memory_type === memoryType);
}

export async function buildExecutiveMemory(supabase, artistProfileId, { limit = 20 } = {}) {
  const briefs = await listBriefs(supabase, artistProfileId, { limit, full: true, order: 'asc' });
  const memoryItems = await listActiveMemoryItems(supabase, artistProfileId);

  const persistedFoundation = {
    goals: { available: true, items: groupByType(memoryItems, 'goal') },
    dismissedActions: { available: true, items: groupByType(memoryItems, 'dismissed_action') },
    milestones: { available: true, items: groupByType(memoryItems, 'milestone') },
    // Every active item, regardless of memory_type -- Memory History™ view.
    allItems: memoryItems,
  };

  if (briefs.length === 0) {
    return {
      available: memoryItems.length > 0,
      reason: memoryItems.length > 0 ? null : 'No archived Executive Briefs yet.',
      recurringIssues: [],
      resolvedIssues: [],
      ...persistedFoundation,
    };
  }

  const latest = briefs[briefs.length - 1];
  const latestRiskKeys = new Set((latest.executive_intelligence_object.risks || []).map(riskKey));

  const firstSeen = new Map();
  briefs.slice(0, -1).forEach((brief) => {
    (brief.executive_intelligence_object.risks || []).forEach((risk) => {
      const key = riskKey(risk);
      if (!firstSeen.has(key)) {
        firstSeen.set(key, {
          title: risk.title || null,
          domain: risk.affectedDomain || null,
          firstSeenExecutiveBriefId: brief.executive_brief_id,
          firstSeenAt: brief.generated_at,
        });
      }
    });
  });

  const recurringIssues = [];
  const resolvedIssues = [];
  firstSeen.forEach((info, key) => {
    (latestRiskKeys.has(key) ? recurringIssues : resolvedIssues).push(info);
  });

  return {
    available: true,
    scope: 'derived_from_archive_history',
    recurringIssues,
    resolvedIssues,
    ...persistedFoundation,
  };
}
