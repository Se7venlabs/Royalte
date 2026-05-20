// Royaltē OS — Delta Engine (Brief 002)
//
// Compares a new scan_snapshots row against the prior snapshot for the
// same (user, artist) and emits monitoring_alerts rows for each meaningful
// change. After emitting, updates scan_snapshots.health_score and
// scan_snapshots.score_breakdown for the new row.
//
// Backend only — not yet wired into any API route. Brief 003 will hook
// this into the V2 write path. Tests inject a mock Supabase client.
//
// Contract for canonical_data shape (V2):
//   territories:     string[]            — territory codes (e.g. 'US', 'JP')
//   tracks:          { name|title, isrc }[]
//   releases:        { title|name }[]
//   youtubeMatches:  { title|name }[]    — confirmed YouTube matches
// Each list is optional; missing fields are treated as empty arrays so the
// engine degrades gracefully against V1-shaped payloads.

// ─── Score model ────────────────────────────────────────────────────────────

const SEVERITY_DELTA = {
  action_needed: -8,
  monitor: -4,
  positive: +2,
  informational: 0,
};

// change_type → which breakdown bucket and how much it shifts.
// Buckets start at their max value; deductions floor at 0, additions cap
// at the bucket max.
const BREAKDOWN_DELTA = {
  release_removed: { bucket: 'catalog_verification', delta: -8 },
  isrc_dropped:    { bucket: 'catalog_verification', delta: -6 },
  isrc_mismatch:   { bucket: 'catalog_verification', delta: -3 },
  territory_loss:  { bucket: 'big6_coverage',        delta: -6 },
  video_removed:   { bucket: 'youtube_presence',     delta: -6 },
  video_added:     { bucket: 'youtube_presence',     delta: +3 },
};

const BUCKET_MAX = {
  catalog_verification: 35,
  big6_coverage: 30,
  backend_health: 20,
  youtube_presence: 15,
};

const HEALTH_FLOOR = 20;
const HEALTH_CAP   = 100;

// ─── Canonical-data accessors (graceful on missing fields) ──────────────────

const getCanonical = (s) => (s && s.canonical_data) || {};

const getTerritories = (s) => {
  const arr = getCanonical(s).territories;
  return Array.isArray(arr) ? arr : [];
};

const getTracks = (s) => {
  const arr = getCanonical(s).tracks;
  return Array.isArray(arr) ? arr : [];
};

const getReleases = (s) => {
  const arr = getCanonical(s).releases;
  return Array.isArray(arr) ? arr : [];
};

const getYoutubeMatches = (s) => {
  const arr = getCanonical(s).youtubeMatches;
  return Array.isArray(arr) ? arr : [];
};

const trackKey   = (t) => (t && (t.name  || t.title)) || null;
const releaseKey = (r) => (r && (r.title || r.name )) || null;
const videoKey   = (v) => (v && (v.title || v.name )) || null;

// ─── Alert builder ──────────────────────────────────────────────────────────

function buildAlert(currentSnapshot, previousSnapshot, partial) {
  return {
    user_id:          currentSnapshot.user_id,
    artist_id:        currentSnapshot.artist_id,
    artist_name:      currentSnapshot.artist_name,
    scan_id:          currentSnapshot.id,
    previous_scan_id: (previousSnapshot && previousSnapshot.id) || null,
    detected_at:      new Date().toISOString(),
    resolved:         false,
    track_name:       null,
    territory:        null,
    isrc:             null,
    platform:         null,
    ...partial,
  };
}

// ─── Per-rule emitters ──────────────────────────────────────────────────────

function emitBaseline(currentSnapshot) {
  const releases   = getReleases(currentSnapshot);
  const tracks     = getTracks(currentSnapshot);
  const territories = getTerritories(currentSnapshot);
  const videos     = getYoutubeMatches(currentSnapshot);
  const isrcCount  = tracks.filter((t) => t && t.isrc).length;
  return [
    buildAlert(currentSnapshot, null, {
      change_type: 'baseline_established',
      severity: 'informational',
      title: 'Baseline established — monitoring now active',
      detail: `${releases.length} releases · ${isrcCount} ISRCs · available in ${territories.length} territories · YouTube: ${videos.length} confirmed matches`,
    }),
  ];
}

function emitTerritoryDeltas(currentSnapshot, previousSnapshot) {
  const prev = new Set(getTerritories(previousSnapshot));
  const curr = new Set(getTerritories(currentSnapshot));
  const alerts = [];

  for (const t of prev) {
    if (curr.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'territory_loss',
      severity: 'action_needed',
      title: `Territory removed: ${t}`,
      detail: `${currentSnapshot.artist_name} is no longer available in territory ${t} on Apple Music. Confirm with your distributor whether this is intentional.`,
      territory: t,
      platform: 'apple_music',
    }));
  }

  for (const t of curr) {
    if (prev.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'territory_gain',
      severity: 'positive',
      title: `Territory added: ${t}`,
      detail: `${currentSnapshot.artist_name} is now available in territory ${t} on Apple Music.`,
      territory: t,
      platform: 'apple_music',
    }));
  }

  return alerts;
}

function emitTrackDeltas(currentSnapshot, previousSnapshot) {
  const prevByName = new Map();
  for (const t of getTracks(previousSnapshot)) {
    const k = trackKey(t);
    if (k) prevByName.set(k, t);
  }
  const currByName = new Map();
  for (const t of getTracks(currentSnapshot)) {
    const k = trackKey(t);
    if (k) currByName.set(k, t);
  }
  const alerts = [];

  for (const [name, p] of prevByName) {
    const c = currByName.get(name);
    if (!c) continue; // track-level removal is handled as a release removal (or out of scope here)
    const pIsrc = p.isrc || null;
    const cIsrc = c.isrc || null;

    if (pIsrc && !cIsrc) {
      alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
        change_type: 'isrc_dropped',
        severity: 'action_needed',
        title: `ISRC dropped on "${name}"`,
        detail: `Track "${name}" reported ISRC ${pIsrc} in the previous scan but no ISRC was returned in the current scan. This typically indicates a metadata regression at the distributor.`,
        track_name: name,
        isrc: pIsrc,
        platform: 'apple_music',
      }));
    } else if (!pIsrc && cIsrc) {
      alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
        change_type: 'isrc_added',
        severity: 'positive',
        title: `ISRC added on "${name}"`,
        detail: `Track "${name}" now reports ISRC ${cIsrc}.`,
        track_name: name,
        isrc: cIsrc,
        platform: 'apple_music',
      }));
    } else if (pIsrc && cIsrc && pIsrc !== cIsrc) {
      alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
        change_type: 'isrc_mismatch',
        severity: 'monitor',
        title: `ISRC mismatch on "${name}"`,
        detail: `Track "${name}" ISRC changed between scans — previous ${pIsrc}, current ${cIsrc}. Reconcile with your distributor.`,
        track_name: name,
        isrc: `prev:${pIsrc} curr:${cIsrc}`,
        platform: 'apple_music',
      }));
    }
  }

  return alerts;
}

function emitReleaseDeltas(currentSnapshot, previousSnapshot) {
  const prevTitles = new Set();
  for (const r of getReleases(previousSnapshot)) {
    const k = releaseKey(r);
    if (k) prevTitles.add(k);
  }
  const currTitles = new Set();
  for (const r of getReleases(currentSnapshot)) {
    const k = releaseKey(r);
    if (k) currTitles.add(k);
  }
  const alerts = [];

  for (const t of prevTitles) {
    if (currTitles.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'release_removed',
      severity: 'action_needed',
      title: `Release removed: ${t}`,
      detail: `Release "${t}" was present in the previous scan but is missing from the current Apple Music catalog. Verify with your distributor that the takedown was intentional.`,
      track_name: t,
      platform: 'apple_music',
    }));
  }

  for (const t of currTitles) {
    if (prevTitles.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'release_added',
      severity: 'positive',
      title: `Release added: ${t}`,
      detail: `New release "${t}" detected in the current Apple Music catalog.`,
      track_name: t,
      platform: 'apple_music',
    }));
  }

  return alerts;
}

function emitVideoDeltas(currentSnapshot, previousSnapshot) {
  const prevTitles = new Set();
  for (const v of getYoutubeMatches(previousSnapshot)) {
    const k = videoKey(v);
    if (k) prevTitles.add(k);
  }
  const currTitles = new Set();
  for (const v of getYoutubeMatches(currentSnapshot)) {
    const k = videoKey(v);
    if (k) currTitles.add(k);
  }
  const alerts = [];

  for (const t of prevTitles) {
    if (currTitles.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'video_removed',
      severity: 'action_needed',
      title: `YouTube match removed: ${t}`,
      detail: `A confirmed YouTube match for "${t}" was present in the previous scan but is gone in the current scan. The video may have been removed, privated, or unmatched from Content ID.`,
      track_name: t,
      platform: 'youtube',
    }));
  }

  for (const t of currTitles) {
    if (prevTitles.has(t)) continue;
    alerts.push(buildAlert(currentSnapshot, previousSnapshot, {
      change_type: 'video_added',
      severity: 'positive',
      title: `YouTube match added: ${t}`,
      detail: `New confirmed YouTube match detected: "${t}".`,
      track_name: t,
      platform: 'youtube',
    }));
  }

  return alerts;
}

// ─── Score computation ──────────────────────────────────────────────────────

export function computeScores(alerts) {
  let health = HEALTH_CAP;
  const buckets = { ...BUCKET_MAX };

  for (const a of alerts) {
    health += SEVERITY_DELTA[a.severity] || 0;
    const td = BREAKDOWN_DELTA[a.change_type];
    if (td) buckets[td.bucket] += td.delta;
  }

  health = Math.max(HEALTH_FLOOR, Math.min(HEALTH_CAP, health));
  for (const k of Object.keys(buckets)) {
    buckets[k] = Math.max(0, Math.min(BUCKET_MAX[k], buckets[k]));
  }
  return { health_score: health, score_breakdown: buckets };
}

// ─── Public entry point ─────────────────────────────────────────────────────

export async function computeDelta(currentSnapshot, previousSnapshot, supabase) {
  if (!currentSnapshot || !currentSnapshot.id || !currentSnapshot.user_id) {
    throw new Error('computeDelta: currentSnapshot.id and .user_id are required');
  }

  const alerts = previousSnapshot
    ? [
        ...emitTerritoryDeltas(currentSnapshot, previousSnapshot),
        ...emitTrackDeltas(currentSnapshot, previousSnapshot),
        ...emitReleaseDeltas(currentSnapshot, previousSnapshot),
        ...emitVideoDeltas(currentSnapshot, previousSnapshot),
      ]
    : emitBaseline(currentSnapshot);

  const scores = computeScores(alerts);

  if (alerts.length > 0) {
    const { error } = await supabase.from('monitoring_alerts').insert(alerts);
    if (error) {
      throw new Error(`monitoring_alerts insert failed: ${error.message || error}`);
    }
  }

  const { error: updateError } = await supabase
    .from('scan_snapshots')
    .update({
      health_score:    scores.health_score,
      score_breakdown: scores.score_breakdown,
    })
    .eq('id', currentSnapshot.id);
  if (updateError) {
    throw new Error(`scan_snapshots score update failed: ${updateError.message || updateError}`);
  }

  return alerts;
}
