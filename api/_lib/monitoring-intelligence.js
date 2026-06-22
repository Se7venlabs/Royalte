// ─────────────────────────────────────────────────────────────────────
//  Monitoring Intelligence™ — Assembler (Phase Monitoring v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓
//    persistOSScanSnapshot → computeDelta → generatedAlerts
//        ↓
//    Monitoring Intelligence™ Assembler  ◀── THIS MODULE
//        ↓
//    audit_scans.payload.monitoringIntelligence   (PATCH after delta)
//        ↓
//    Mission Control™ · Change Detection™ card
//
//  Data source:
//    Option A (Board 2026-06-22) — per-scan delta only.
//    Assembler reads the alerts generated during THIS scan's delta
//    computation. No cross-scan history query. No Supabase call.
//    Unauthenticated scans produce no delta → monitoringIntelligence
//    stays null → MC card keeps locked sample HTML.
//
//  Core invariants:
//    - Pure function of ({ scanNumber, alerts }).
//    - Never throws on any input.
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - Events capped at MAX_EVENTS (MC card renders 4 rows).
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      status:      'baseline' | 'active' | 'no_changes',
//      scanNumber:  number,
//      newThisScan: number,   // count of events detected this scan
//      events:      EventEntry[],
//    }
//
//    EventEntry = {
//      changeType: string,   // e.g. 'territory_gain', 'release_added'
//      title:      string,
//      severity:   'informational' | 'positive' | 'action_needed' | 'monitor',
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const MONITORING_INTELLIGENCE_VERSION = '1.0.0';

const MAX_EVENTS = 4;

// Valid severity values from the delta engine. Unknown values degrade to
// 'informational' so a future engine change never breaks the renderer.
const VALID_SEVERITIES = new Set(['informational', 'positive', 'action_needed', 'monitor']);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function safeStr(x) {
  return typeof x === 'string' ? x : '';
}

function deriveStatus(scanNumber, alertCount) {
  if (scanNumber <= 1) return 'baseline';
  if (alertCount === 0) return 'no_changes';
  return 'active';
}

function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const changeType = safeStr(raw.change_type) || 'unknown';
  const title      = safeStr(raw.title).trim();
  if (!title) return null;
  const rawSev  = safeStr(raw.severity).toLowerCase().replace(/ /g, '_');
  const severity = VALID_SEVERITIES.has(rawSev) ? rawSev : 'informational';
  return Object.freeze({ changeType, title, severity });
}

// ─── Public API ──────────────────────────────────────────────────────

export function assembleMonitoringIntelligence({ scanNumber, alerts } = {}) {
  try {
    const num  = (typeof scanNumber === 'number' && Number.isFinite(scanNumber) && scanNumber >= 1)
      ? scanNumber
      : 1;
    const rawAlerts = Array.isArray(alerts) ? alerts : [];

    const events = rawAlerts
      .map(normalizeEvent)
      .filter(Boolean)
      .slice(0, MAX_EVENTS);

    const status = deriveStatus(num, rawAlerts.length);

    return deepFreeze({
      status,
      scanNumber:  num,
      newThisScan: rawAlerts.length,
      events,
    });
  } catch (err) {
    console.error('[monitoring-intelligence] assembly threw (returning empty shell):', err?.message || err);
    return deepFreeze({
      status:      'no_changes',
      scanNumber:  1,
      newThisScan: 0,
      events:      [],
    });
  }
}
