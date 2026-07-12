// Canonical Intelligence Platform™ -- Executive Brief™ Validation
// Validates brief structure, section ordering, timeline ordering,
// recommendation references, summary integrity, and format output.

import { SECTION_ORDER, SECTION_STATUS } from './sections.js';

const REQUIRED_BRIEF_FIELDS       = ['briefId', 'version', 'generatedAt', 'summary', 'metrics', 'timeline', 'recommendations', 'sections', 'engineVersion'];
const REQUIRED_SUMMARY_FIELDS     = ['summaryId', 'generatedAt', 'overallHealth', 'topPriorities', 'highestRisks', 'biggestOpportunities', 'totalRecommendations'];
const REQUIRED_SECTION_FIELDS     = ['sectionId', 'type', 'title', 'status', 'generatedAt', 'data'];
const REQUIRED_TIMELINE_FIELDS    = ['timelineId', 'generatedAt', 'events', 'alerts', 'totalEvents', 'totalAlerts'];
const REQUIRED_FORMATTED_FIELDS   = ['format', 'status', 'briefId'];

function checkFields(obj, fields, label) {
  const errors = [];
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      errors.push(`${label} missing required field: ${f}`);
    }
  }
  return errors;
}

export function validateBrief(brief) {
  if (!brief || typeof brief !== 'object') {
    return { valid: false, errors: ['brief must be a non-null object'] };
  }
  const errors = checkFields(brief, REQUIRED_BRIEF_FIELDS, 'brief');
  if (brief.sections !== undefined && !Array.isArray(brief.sections)) {
    errors.push('brief.sections must be an array');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return { valid: false, errors: ['summary must be a non-null object'] };
  }
  const errors = checkFields(summary, REQUIRED_SUMMARY_FIELDS, 'summary');
  if (summary.topPriorities !== undefined && !Array.isArray(summary.topPriorities)) {
    errors.push('summary.topPriorities must be an array');
  }
  if (summary.highestRisks !== undefined && !Array.isArray(summary.highestRisks)) {
    errors.push('summary.highestRisks must be an array');
  }
  return { valid: errors.length === 0, errors };
}

export function validateSections(sections) {
  if (!Array.isArray(sections)) {
    return { valid: false, errors: ['sections must be an array'] };
  }
  const errors = [];
  for (const [i, section] of sections.entries()) {
    errors.push(...checkFields(section, REQUIRED_SECTION_FIELDS, `sections[${i}]`));
    if (section.status && !Object.values(SECTION_STATUS).includes(section.status)) {
      errors.push(`sections[${i}] has unknown status: ${section.status}`);
    }
  }
  // Verify section types appear in SECTION_ORDER sequence
  const presentTypes = sections.map(s => s.type).filter(t => SECTION_ORDER.includes(t));
  let lastOrderIdx = -1;
  for (const type of presentTypes) {
    const idx = SECTION_ORDER.indexOf(type);
    if (idx < lastOrderIdx) errors.push(`Section "${type}" appears out of canonical order`);
    lastOrderIdx = idx;
  }
  return { valid: errors.length === 0, errors };
}

export function validateTimeline(timeline) {
  if (!timeline || typeof timeline !== 'object') {
    return { valid: false, errors: ['timeline must be a non-null object'] };
  }
  const errors = checkFields(timeline, REQUIRED_TIMELINE_FIELDS, 'timeline');
  if (timeline.events !== undefined && !Array.isArray(timeline.events)) {
    errors.push('timeline.events must be an array');
  }
  if (timeline.alerts !== undefined && !Array.isArray(timeline.alerts)) {
    errors.push('timeline.alerts must be an array');
  }
  // Verify events sorted newest-first
  if (Array.isArray(timeline.events)) {
    for (let i = 0; i < timeline.events.length - 1; i++) {
      const ta = timeline.events[i].timestamp     || timeline.events[i].detectedAt     || '';
      const tb = timeline.events[i + 1].timestamp || timeline.events[i + 1].detectedAt || '';
      if (ta && tb && ta < tb) {
        errors.push(`timeline.events not sorted newest-first at index ${i}`);
        break;
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateRecommendationReferences(brief) {
  if (!brief?.recommendations?.all) return { valid: true, errors: [] };
  const { byPriority, totalCount, all } = brief.recommendations;
  const errors = [];
  if (totalCount !== all.length) {
    errors.push(`recommendations.totalCount (${totalCount}) does not match all.length (${all.length})`);
  }
  if (byPriority) {
    const summed = (byPriority.urgent?.length || 0)
      + (byPriority.high?.length         || 0)
      + (byPriority.medium?.length       || 0)
      + (byPriority.low?.length          || 0)
      + (byPriority.informational?.length || 0);
    if (summed !== all.length) {
      errors.push(`recommendations.byPriority total (${summed}) does not match all.length (${all.length})`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateFormatting(formatted) {
  if (!formatted || typeof formatted !== 'object') {
    return { valid: false, errors: ['formatted must be a non-null object'] };
  }
  const errors = checkFields(formatted, REQUIRED_FORMATTED_FIELDS, 'formatted');
  if (formatted.format === 'json' && formatted.status === 'COMPLETE') {
    if (!formatted.content || typeof formatted.content !== 'string') {
      errors.push('formatted.content must be a non-empty string for json format');
    }
  }
  return { valid: errors.length === 0, errors };
}
