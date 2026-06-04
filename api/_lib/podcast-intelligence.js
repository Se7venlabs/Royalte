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
export async function runPodcastDiscovery(supabase, {
  profile,
  userId,
  artistId,
  artistName,
  scanId,
}) {
  if (!isMonitoringSubscriber(profile)) {
    return { ran: false, reason: 'not_subscribed', newCount: 0 };
  }
  if (!supabase || !userId || !artistName) {
    return { ran: false, reason: 'missing_inputs', newCount: 0 };
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

  return {
    ran: true,
    newCount: newRows.length,
    totalCount: episodes.length,
    availability: 'VERIFIED',
  };
}
