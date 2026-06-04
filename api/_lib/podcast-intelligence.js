// ─────────────────────────────────────────────────────────────────────────
// Podcast Intelligence — Phase 1 orchestrator (Brief 015o).
//
// Gates the Listen Notes call behind a monitoring-plan check, dedupes
// discoveries against the podcast_appearances table, and emits one
// monitoring_alerts row per NEW episode discovered so the discovery
// surfaces in the Intelligence Feed timeline.
//
// Not yet wired to a trigger. Callable from any server-side context
// (the next phase will decide whether discovery runs on each scan,
// on a pg_cron schedule, or via an admin endpoint).
// ─────────────────────────────────────────────────────────────────────────

import { searchEpisodesByArtist } from './listen-notes.js';

/**
 * Gating helper. Mirrors the client-side check used by
 * renderMcIntelligenceConfidence in public/js/dashboard.js — both
 * surfaces evaluate the same rule. Keep them in sync.
 *
 * Founding artists are grandfathered as monitoring subscribers; paid
 * tier explicitly qualifies. Free and trial tiers do NOT qualify.
 */
export function isMonitoringSubscriber(profile) {
  if (!profile) return false;
  if (profile.founding_artist === true) return true;
  if (profile.tier === 'paid') return true;
  return false;
}

/**
 * Run a podcast discovery scan for one user.
 *
 * Behaviour:
 *  - Skip entirely (no API call burned) when the user is not on a
 *    monitoring plan or required inputs are missing.
 *  - Search Listen Notes for episodes matching the artist name.
 *  - Upsert each result into podcast_appearances with
 *    onConflict (user_id, source_episode_id) DO NOTHING — re-running
 *    the discovery never duplicates or re-alerts on known episodes.
 *  - For each NEW row (the upsert .select() returns inserted rows
 *    only), emit a monitoring_alerts row of change_type
 *    'podcast_appearance' so the Intelligence Feed surfaces it.
 *
 * Caller is expected to pass a service-role Supabase client (writes
 * bypass RLS on these tables — see migration).
 *
 * @returns {Promise<{ran: boolean, reason?: string, newCount: number,
 *                    totalCount?: number, availability?: string,
 *                    error?: string}>}
 */
export const PODCAST_INTERVAL_DAYS = 7;

export async function runPodcastDiscovery(supabase, {
  profile,
  userId,
  artistId,
  artistName,
  scanId,
  intervalDays = PODCAST_INTERVAL_DAYS,
}) {
  if (!isMonitoringSubscriber(profile)) {
    return { ran: false, reason: 'not_subscribed', newCount: 0 };
  }
  if (!supabase || !userId || !artistName) {
    return { ran: false, reason: 'missing_inputs', newCount: 0 };
  }

  // Brief 015o Phase 2 — API conservation. Skip the Listen Notes call
  // entirely if discovery already ran for this user within the
  // interval window. The monitoring_subscriptions cadence already
  // paces things at 7 days; this is a second line of defense so
  // out-of-band callers (manual retries, future endpoints) can't burn
  // the free-tier quota by accident.
  //
  // TODO(Phase 3) — Multi-artist granularity.
  //   This guard tracks last_run at the PROFILE (user) level. A user
  //   with multiple monitoring_subscriptions only gets podcast
  //   discovery for the FIRST artist scanned in each 7-day window —
  //   subsequent artists in the same window hit this guard and skip.
  //   Conservation-safe today; UX edge case for multi-artist
  //   monitoring. Acceptable for Beta (most users monitor one artist).
  //   Phase 3 would move tracking to a per (user_id, artist_id) row —
  //   either a new podcast_intelligence_runs table OR a column on
  //   monitoring_subscriptions. Do not build Phase 3 until multi-artist
  //   monitoring is common enough to warrant the change.
  const lastRunRaw = profile?.podcast_intelligence_last_run;
  if (lastRunRaw) {
    const lastMs     = new Date(lastRunRaw).getTime();
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    if (Number.isFinite(lastMs) && (Date.now() - lastMs) < intervalMs) {
      return {
        ran: false,
        reason: 'within_interval',
        newCount: 0,
        lastRunAt: lastRunRaw,
        intervalDays,
      };
    }
  }

  const search = await searchEpisodesByArtist(artistName);
  if (search.availability !== 'VERIFIED') {
    return {
      ran: false,
      reason: search.availability.toLowerCase(),
      availability: search.availability,
      error: search.error,
      newCount: 0,
    };
  }

  const episodes = search.episodes || [];
  if (episodes.length === 0) {
    return { ran: true, newCount: 0, totalCount: 0, availability: 'VERIFIED' };
  }

  const rows = episodes.map((e) => ({
    user_id:             userId,
    artist_id:           artistId || null,
    artist_name:         artistName,
    source_episode_id:   e.episodeId,
    source_podcast_id:   e.podcastId,
    episode_title:       e.episodeTitle,
    episode_url:         e.episodeUrl,
    podcast_name:        e.podcastName,
    podcast_url:         e.podcastUrl,
    publish_date:        e.publishDate,
    description_snippet: e.descriptionSnippet,
  }));

  // Upsert with ignoreDuplicates returns ONLY the newly-inserted rows
  // via .select() — existing (skipped) rows are not returned. That
  // gives us a clean "new this run" delta for alert emission.
  const { data: inserted, error: insErr } = await supabase
    .from('podcast_appearances')
    .upsert(rows, { onConflict: 'user_id,source_episode_id', ignoreDuplicates: true })
    .select();

  if (insErr) {
    console.error('[podcast-intelligence] upsert failed:', insErr.message);
    return {
      ran: true,
      newCount: 0,
      totalCount: episodes.length,
      availability: 'ERROR',
      error: insErr.message,
    };
  }

  const newRows = Array.isArray(inserted) ? inserted : [];

  // Emit Intelligence Feed alerts only for NEW discoveries. The title
  // text uses outcome language ("New podcast appearance detected") and
  // never names Listen Notes — per the locked Intelligence Network
  // principle in Brief 015n.
  if (newRows.length > 0) {
    const alerts = newRows.map((r) => ({
      user_id:     userId,
      artist_id:   artistId || null,
      artist_name: artistName,
      scan_id:     scanId || null,
      change_type: 'podcast_appearance',
      severity:    'discovery',
      title:       'New podcast appearance detected',
      detail:      r.podcast_name
        ? `${r.podcast_name} — "${r.episode_title || 'Episode'}"`
        : (r.episode_title || 'Podcast episode'),
      track_name:  r.episode_title,
      platform:    'podcast',
      detected_at: r.detected_at,
      resolved:    false,
    }));
    const { error: alertErr } = await supabase.from('monitoring_alerts').insert(alerts);
    if (alertErr) {
      // Alert emission is best-effort. The canonical record is in
      // podcast_appearances; missing alerts means the feed misses the
      // event but the discovery itself is still persisted.
      console.error('[podcast-intelligence] alerts insert failed:', alertErr.message);
    }
  }

  // Brief 015o Phase 2 — record the run timestamp. Updated only after
  // a successful VERIFIED Listen Notes response (i.e. we actually
  // burned an API call). Best-effort: a failed UPDATE doesn't undo
  // the discovery, but the interval guard would only fail-open on
  // the next tick, not fail-closed — acceptable.
  const ranAt = new Date().toISOString();
  const { error: tsErr } = await supabase
    .from('profiles')
    .update({ podcast_intelligence_last_run: ranAt })
    .eq('id', userId);
  if (tsErr) {
    console.error('[podcast-intelligence] last_run update failed:', tsErr.message);
  }

  return {
    ran: true,
    newCount: newRows.length,
    totalCount: episodes.length,
    availability: 'VERIFIED',
    ranAt,
  };
}
