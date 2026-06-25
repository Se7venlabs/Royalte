// ─────────────────────────────────────────────────────────────────────
//  Backend Intelligence™ — Assembler (Build Pass 3 v2.0)
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
//  Displayed services (Build Pass 3 — Board directive):
//    MusicBrainz   — canonical.platforms.musicbrainz.availability
//    MLC            — publishingIntelligence.registrations.mlcRegistration
//
//  APIs Responding metric — 4 always-called backend services:
//    MusicBrainz, Discogs, Last.fm, MLC
//    "Responded" = VERIFIED or NOT_FOUND (service returned a valid response).
//    AUTH_UNAVAILABLE / ERROR = not responded (gated or threw).
//
//  Removed from display (Build Pass 3):
//    Discogs      — still integrated; counted in apisResponding, not displayed
//    Listen Notes — monitoring-plan-only; AUTH_UNAVAILABLE on standard scans
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
//
// ─────────────────────────────────────────────────────────────────────
//  Output shape (v2.0):
//
//    {
//      services:       ServiceEntry[],  // 2 displayed services
//      connectedCount: number,          // VERIFIED count among displayed services
//      totalCount:     number,          // always 2 for Build Pass 3
//      apisResponding: { responded: number, total: number },  // 4-service metric
//      lastSync:       string,          // ISO timestamp from canonical.scannedAt
//      summaryLabel:   string,          // backward-compat
//    }
//
//    ServiceEntry = {
//      key:         string,  // 'musicbrainz' | 'mlc'
//      name:        string,  // display name
//      state:       string,  // availability state constant
//      subLabel:    string,  // 'Connected' for VERIFIED states
//      statusLabel: string,  // 'Verified' for VERIFIED states
//    }
//
// ─────────────────────────────────────────────────────────────────────

export const BACKEND_INTELLIGENCE_VERSION = '2.0.0';

export const BACKEND_STATE = Object.freeze({
  VERIFIED:         'VERIFIED',
  NOT_FOUND:        'NOT_FOUND',
  AUTH_UNAVAILABLE: 'AUTH_UNAVAILABLE',
  ERROR:            'ERROR',
});

// Displayed services — MusicBrainz + MLC only (Build Pass 3 Board directive).
const SERVICES = Object.freeze([
  Object.freeze({ key: 'musicbrainz', name: 'MusicBrainz' }),
  Object.freeze({ key: 'mlc',         name: 'MLC'         }),
]);

// APIs Responding — 4 backend services always called on the standard scan path.
// Discogs and Last.fm remain integrated (not displayed) and counted here.
const APIS_MONITORED = Object.freeze(['musicbrainz', 'discogs', 'lastfm', 'mlc']);

// States that represent a successful API response (service is up and returned data).
const RESPONDED_STATES = Object.freeze(new Set([
  BACKEND_STATE.VERIFIED,
  BACKEND_STATE.NOT_FOUND,
]));

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

function resolveState(raw) {
  const s = safeStr(raw).toUpperCase();
  if (Object.values(BACKEND_STATE).includes(s)) return s;
  return BACKEND_STATE.AUTH_UNAVAILABLE;
}

// ─── Service label derivation ─────────────────────────────────────────

const SERVICE_LABELS = Object.freeze({
  musicbrainz: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Connected',   statusLabel: 'Verified'     }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Found',   statusLabel: 'Not Found'    }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Unavailable', statusLabel: 'Unavailable'  }),
    ERROR:            Object.freeze({ subLabel: 'Error',       statusLabel: 'Unavailable'  }),
  }),
  // MLC: Backend Intelligence shows infrastructure status only.
  // Registration status lives exclusively in Publishing Intelligence™.
  mlc: Object.freeze({
    VERIFIED:         Object.freeze({ subLabel: 'Connected',   statusLabel: 'Verified'     }),
    NOT_FOUND:        Object.freeze({ subLabel: 'Not Found',   statusLabel: 'Not Found'    }),
    AUTH_UNAVAILABLE: Object.freeze({ subLabel: 'Unavailable', statusLabel: 'Unavailable'  }),
    ERROR:            Object.freeze({ subLabel: 'Error',       statusLabel: 'Unavailable'  }),
  }),
});

function labelsFor(key, state) {
  const svcLabels = SERVICE_LABELS[key];
  if (!svcLabels) return { subLabel: 'Unavailable', statusLabel: 'Unavailable' };
  return svcLabels[state] || { subLabel: 'Unavailable', statusLabel: 'Unavailable' };
}

function deriveSummaryLabel(connectedCount, totalCount) {
  if (connectedCount === totalCount) return 'All Verified';
  if (connectedCount === 0) return 'Checking connections...';
  return `${connectedCount} of ${totalCount} Connected`;
}

// ─── Raw availability reads ─────────────────────────────────────────────

function readMusicBrainzState(canonical) {
  const c = safeObj(canonical);
  if (!c) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const mb = safeObj(safeObj(c.platforms)?.musicbrainz);
  if (!mb) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(mb.availability);
}

function readDiscogsState(canonical) {
  const c = safeObj(canonical);
  if (!c) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const dc = safeObj(safeObj(c.platforms)?.discogs);
  if (!dc) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(dc.availability);
}

function readLastFmState(canonical) {
  const c = safeObj(canonical);
  if (!c) return BACKEND_STATE.AUTH_UNAVAILABLE;
  const lf = safeObj(safeObj(c.platforms)?.lastfm);
  if (!lf) return BACKEND_STATE.AUTH_UNAVAILABLE;
  return resolveState(lf.availability);
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
    const displayedStates = {
      musicbrainz: readMusicBrainzState(canonical),
      mlc:         readMlcState(publishingIntelligence),
    };

    const services = SERVICES.map(({ key, name }) => {
      const state = displayedStates[key];
      const { subLabel, statusLabel } = labelsFor(key, state);
      return Object.freeze({ key, name, state, subLabel, statusLabel });
    });

    const connectedCount = services.filter((s) => s.state === BACKEND_STATE.VERIFIED).length;
    const totalCount = SERVICES.length;

    // APIs Responding — counts all 4 monitored backend services
    const monitoredStates = [
      readMusicBrainzState(canonical),
      readDiscogsState(canonical),
      readLastFmState(canonical),
      readMlcState(publishingIntelligence),
    ];
    const responded = monitoredStates.filter((s) => RESPONDED_STATES.has(s)).length;
    const apisResponding = Object.freeze({ responded, total: APIS_MONITORED.length });

    // Last Sync — scan completion timestamp from canonical
    const c = safeObj(canonical);
    const lastSync = (c && typeof c.scannedAt === 'string') ? c.scannedAt : null;

    return deepFreeze({
      services,
      connectedCount,
      totalCount,
      apisResponding,
      lastSync,
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
      services:       fallbackServices,
      connectedCount: 0,
      totalCount:     SERVICES.length,
      apisResponding: Object.freeze({ responded: 0, total: APIS_MONITORED.length }),
      lastSync:       null,
      summaryLabel:   'Checking connections...',
    });
  }
}
