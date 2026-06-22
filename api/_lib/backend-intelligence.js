// ─────────────────────────────────────────────────────────────────────
//  Backend Intelligence™ — Assembler (Phase Backend v1.0)
// ─────────────────────────────────────────────────────────────────────
//
//  Constitutional position:
//
//    Scan Engine
//        ↓
//    canonical (normalizeAuditResponse) + publishingIntelligence
//        ↓
//    Backend Intelligence™ Assembler  ◀── THIS MODULE
//        ↓
//    audit_scans.payload.backendIntelligence
//        ↓
//    Mission Control™ · Backend Intelligence card
//
//  Monitored services (v1.0):
//    MusicBrainz   — canonical.platforms.musicbrainz.availability
//    Discogs        — canonical.platforms.discogs.availability
//    MLC            — publishingIntelligence.registrations.mlcRegistration
//    Listen Notes   — AUTH_UNAVAILABLE (monitoring-plan-only; never called
//                     from the standard audit.js scan path per Brief 015o)
//
//  Availability state vocabulary (shared across all Royaltē™ modules):
//    VERIFIED         — confirmed present
//    NOT_FOUND        — looked, genuinely absent
//    AUTH_UNAVAILABLE — API key/auth missing (NOT a gap; not scored as zero)
//    ERROR            — upstream API threw
//
//  Core invariants:
//    - Never throws on any input (null / undefined / malformed).
//    - Never mutates inputs.
//    - Output is deep-frozen.
//    - AUTH_UNAVAILABLE ≠ NOT_FOUND (never conflated, never scored as zero).
//    - Listen Notes is permanently AUTH_UNAVAILABLE on the standard scan
//      path — this is an architectural fact, not a data gap.
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v1.0):
//
//    {
//      services: ServiceEntry[],  // 4 entries, one per backend service
//      connectedCount: number,    // count of VERIFIED services
//      totalCount:     number,    // always 4 for v1.0
//      summaryLabel:   string,    // 'All Verified' | 'N of 4 Connected' | …
//    }
//
//    ServiceEntry = {
//      key:         string,  // 'musicbrainz' | 'discogs' | 'mlc' | 'listenNotes'
//      name:        string,  // display name
//      state:       string,  // availability state constant
//      subLabel:    string,  // secondary row label (e.g. 'Connected', 'Registered')
//      statusLabel: string,  // badge label (e.g. 'Verified', 'Monitoring')
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const BACKEND_INTELLIGENCE_VERSION = '1.0.0';

// Availability state constants — mirror the 4-state model used across
// all Royaltē™ modules. Never add intermediate states.
export const BACKEND_STATE = Object.freeze({
  VERIFIED:         'VERIFIED',
  NOT_FOUND:        'NOT_FOUND',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  ERROR:            'ERROR',
});

// Service registry — ordered as they appear in the MC card (v1.0 lock order).
const SERVICES = Object.freeze([
  Object.freeze({ key: 'musicbrainz', name: 'MusicBrainz' }),
  Object.freeze({ key: 'discogs',     name: 'Discogs'     }),
  Object.freeze({ key: 'mlc',         name: 'MLC'         }),
  Object.freeze({ key: 'listenNotes', name: 'Listen Notes' }),
]);

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !Object.isFrozen(v)) deepFreeze(v);
  }
  return Object.freeze(obj);
}

function safeObj(x) {
  return (x && typeof x === 'object' && !Array.isArray(x)) ? x : null;
}

function safeStr(x) {
  return typeof x === 'string' ? x : '';
}

// ─── State resolution ─────────────────────────────────────────────────
//
// Validates the incoming availability string against the 4-state model.
// Unknown strings degrade to AUTH_UNAVAILABLE (not NOT_FOUND) so
// unknown ≠ absence.

function resolveState(raw) {
  const s = safeStr(raw).toUpperCase();
  if (Object.values(BACKEND_STATE).includes(s)) return s;
  return BACKEND_STATE.AUTH_UNAVAILABLE;
}

// ─── Service label derivation ─────────────────────────────────────────
//
// Returns { subLabel, statusLabel } for a given service key + state.
// Labels match the locked Mission Control™ card vocabulary.

const SERVICE_LABELS = Object.freeze({
  musicbrainz: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Connected',  statusLabel: 'Verified'   }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Found',  statusLabel: 'Not Found'  }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Unavailable', statusLabel: 'Unavailable' }),
    ERROR:            Object.freeze({ subLabel: 'Error',      statusLabel: 'Unavailable' }),
  }),
  discogs: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Connected',  statusLabel: 'Verified'   }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Found',  statusLabel: 'Not Found'  }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Unavailable', statusLabel: 'Unavailable' }),
    ERROR:            Object.freeze({ subLabel: 'Error',      statusLabel: 'Unavailable' }),
  }),
  mlc: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Registered', statusLabel: 'Connected'  }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Registered', statusLabel: 'Not Found' }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Unavailable', statusLabel: 'Unavailable' }),
    ERROR:            Object.freeze({ subLabel: 'Error',      statusLabel: 'Unavailable' }),
  }),
  // Listen Notes is monitoring-plan-only. In standard scans the state
  // is always AUTH_UNAVAILABLE; label vocabulary retained from the locked
  // MC card. Future phases may supply VERIFIED state for monitoring subscribers.
  listenNotes: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Tracking',   statusLabel: 'Monitoring' }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Found',  statusLabel: 'Not Found'  }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Monitoring Required', statusLabel: 'Monitoring' }),
    ERROR:            Object.freeze({ subLabel: 'Error',      statusLabel: 'Unavailable' }),
  }),
});

function labelsFor(key, state) {
  const svcLabels = SERVICE_LABELS[key];
  if (!svcLabels) return { subLabel: 'Unavailable', statusLabel: 'Unavailable' };
  return svcLabels[state] || { subLabel: 'Unavailable', statusLabel: 'Unavailable' };
}

// ─── Summary label ─────────────────────────────────────────────────────

function deriveSummaryLabel(connectedCount, totalCount) {
  if (connectedCount === totalCount) return 'All Verified';
  if (connectedCount === 0) return 'Checking connections...';
  return `${connectedCount} of ${totalCount} Connected`;
}

// ─── Raw availability reads ─────────────────────────────────────────────
//
// Each function reads one service's raw availability from its canonical
// source and returns the 4-state constant.

function readMusicBrainzState(canonical) {
  const c = safeObj(canonical);
  if (!c) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const platforms = safeObj(c.platforms);
  if (!platforms) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const mb = safeObj(platforms.musicbrainz);
  if (!mb) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(mb.availability);
}

function readDiscogsState(canonical) {
  const c = safeObj(canonical);
  if (!c) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const platforms = safeObj(c.platforms);
  if (!platforms) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const dc = safeObj(platforms.discogs);
  if (!dc) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(dc.availability);
}

function readMlcState(publishingIntelligence) {
  const pi = safeObj(publishingIntelligence);
  if (!pi) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const regs = safeObj(pi.registrations);
  if (!regs) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const raw = safeStr(regs.mlcRegistration);
  if (!raw) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(raw);
}

// ─── Public API ──────────────────────────────────────────────────────

export function assembleBackendIntelligence(canonical, publishingIntelligence) {
  try {
    const states = {
      musicbrainz: readMusicBrainzState(canonical),
      discogs:     readDiscogsState(canonical),
      mlc:         readMlcState(publishingIntelligence),
      // Listen Notes: monitoring-plan-only; AUTH_UNAVAILABLE on standard scan path.
      listenNotes: BACKEND_STATE.AUTH_UNAVAILABLE,
    };

    const services = SERVICES.map(({ key, name }) => {
      const state = states[key];
      const { subLabel, statusLabel } = labelsFor(key, state);
      return Object.freeze({ key, name, state, subLabel, statusLabel });
    });

    const connectedCount = services.filter((s) => s.state === BACKEND_STATE.VERIFIED).length;
    const totalCount = SERVICES.length;

    return deepFreeze({
      services,
      connectedCount,
      totalCount,
      summaryLabel: deriveSummaryLabel(connectedCount, totalCount),
    });
  } catch (err) {
    console.error('[backend-intelligence] assembly threw (returning empty shell):', err?.message || err);
    const fallbackServices = SERVICES.map(({ key, name }) => Object.freeze({
      key,
      name,
      state:       BACKEND_STATE.AUTH_UNAVAILABLE,
      subLabel:    'Unavailable',
      statusLabel: 'Unavailable',
    }));
    return deepFreeze({
      services:      fallbackServices,
      connectedCount: 0,
      totalCount:    SERVICES.length,
      summaryLabel:  'Checking connections...',
    });
  }
}
