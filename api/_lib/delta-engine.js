// Royaltē OS — Delta Engine (Brief 002 · score authority moved to
// persist-os-scan.js by Brief 012a follow-up).
//
// Compares a new scan_snapshots row against the prior snapshot for the
// same (user, artist) and emits monitoring_alerts rows for each meaningful
// change. health_score and score_breakdown are written at insert time by
// persistOSScanSnapshot using the V2 signal-driven formula; this engine
// no longer touches them.
//
// Backend only. Tests inject a mock Supabase client.
//
// Contract for canonical_data shape (V2):
//   territories:     string[]            — territory codes (e.g. 'US', 'JP')
//   tracks:          { name|title, isrc }[]
//   releases:        { title|name }[]
//   youtubeMatches:  { title|name }[]    — confirmed YouTube matches
// Each list is optional; missing fields are treated as empty arrays so the
// engine degrades gracefully against V1-shaped payloads.

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

// Board Architecture Note (Phase 5.4 WP3): Territory monitoring shall
// consume Territory Intelligence Engine output only. This module owns
// change detection, not territory classification. Classification remains
// exclusively owned by the Territory Intelligence Engine
// (api/_lib/territory-intelligence.js). getTerritories() below reads
// canonical_data.territories, which persist-os-scan.js's extractTerritories()
// now sources from the Engine's globalMusicFootprint.distributionGaps
// output (Board Decision, Option A) — this function only diffs two already-
// classified snapshots and never decides availability itself.
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

  if (alerts.length > 0) {
    const { error } = await supabase.from('monitoring_alerts').insert(alerts);
    if (error) {
      throw new Error(`monitoring_alerts insert failed: ${error.message || error}`);
    }
  }

  return alerts;
}
