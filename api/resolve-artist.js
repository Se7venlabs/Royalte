// ─────────────────────────────────────────────────────────────────────────
// ROYALTÉ ENGINEERING PRINCIPLE (Constitutional)
// Apple Music is the canonical identity authority.
// Confidence policy (Board-locked 2026-06-20):
//
//   RULE A — Song match + exact artist name match
//     → Identity confirmed via song.
//     → Take first Apple artist URL. No multiplicity check.
//     → Song match is the disambiguation mechanism; it is authoritative.
//
//   RULE B — Song search fails → searchArtist returns exactly 1 result
//     → Artist-name confident. Return URL.
//
//   RULE C — Song search fails → searchArtist returns 2+ results
//     → Cannot confirm identity without song. Return 409 ambiguous.
//     → Frontend: "We couldn't safely verify that artist.
//                  Please use an Apple Music or Spotify URL."
//
// DO NOT return 409 when a song match already confirmed identity.
// The song is collected precisely to avoid that friction.
//
// Telemetry policy (Board-locked 2026-06-20):
//   All four resolution outcomes are logged as structured JSON.
//   Email alerts are sent only for ambiguous identity and artist not found.
//   Successful resolutions produce log entries only — no inbox noise.
// ─────────────────────────────────────────────────────────────────────────
//
// GET /api/resolve-artist?name=...&song=...
//
// Resolves artist name + song title to a single canonical Apple Music
// artist URL, which is passed directly into the existing runAudit() pipeline.

import { searchArtist }       from './apple-music.js';
import { generateAppleToken } from './apple-token.js';
import {
  extractIp,
  checkBlocked,
  checkRateLimit,
  recordViolation,
} from './_lib/rate-limit.js';

const APPLE_API  = 'https://api.music.apple.com/v1';
const ALERT_TO   = 'info@royalte.ai';
const ALERT_FROM = 'Royaltē Alerts <alerts@royalte.ai>';

// ── Telemetry ──────────────────────────────────────────────────────────────
// Structured JSON entries are emitted for all four resolution outcomes.
// Fields support future daily report aggregation without schema changes.

const EVENTS = Object.freeze({
  SONG_CONFIRMED:  '[resolve-artist] Song-confirmed identity',
  ARTIST_ONLY:     '[resolve-artist] Artist-only resolution',
  AMBIGUOUS:       '[resolve-artist] Ambiguous identity',
  NOT_FOUND:       '[resolve-artist] Artist not found',
});

function logEvent(event, name, song, extra = {}) {
  console.log(JSON.stringify({
    service:   'resolve-artist',
    event,
    artistName: name,
    songTitle:  song || null,
    timestamp:  new Date().toISOString(),
    ...extra,
  }));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Fire-and-forget — never throws, never delays the HTTP response.
function sendAlert(subject, name, song, eventType) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const timestamp = new Date().toISOString();
  const html = `
    <p><strong>Artist Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Song Title:</strong> ${escapeHtml(song || '(not provided)')}</p>
    <p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
    <p><strong>Event Type:</strong> ${escapeHtml(eventType)}</p>
  `;

  fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    ALERT_FROM,
      to:      [ALERT_TO],
      subject,
      html,
    }),
  }).catch(() => { /* never break main flow */ });
}

// ── Diagnostic instrumentation ────────────────────────────────────────────
// Structured JSON entries emitted at every decision point.
// Captured in Vercel function logs. Prefix: [resolve-diag]
// Board Validation Issue #001 Phase 3 — 2026-07-12.

function diagLog(step, name, song, data = {}) {
  console.log(JSON.stringify({
    prefix:     '[resolve-diag]',
    step,
    artistName: name,
    songTitle:  song || null,
    timestamp:  new Date().toISOString(),
    ...data,
  }));
}

// ── Apple Music helpers ────────────────────────────────────────────────────

async function searchSongsByArtist(song, name) {
  try {
    const token = generateAppleToken();
    const query = encodeURIComponent(`${song} ${name}`);
    const url   = `${APPLE_API}/catalog/us/search?term=${query}&types=songs&limit=5`;
    const resp  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) return { songs: [], requestUrl: url, httpStatus: resp.status };
    const data = await resp.json();
    return { songs: data?.results?.songs?.data || [], requestUrl: url, httpStatus: 200 };
  } catch (err) {
    return { songs: [], requestUrl: null, httpStatus: null, error: err.message };
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const name = (req.query.name || '').trim();
  const song = (req.query.song || '').trim();

  // Q1 — did resolve-artist receive both params?
  diagLog('ENTRY', name, song, {
    q1_received_artist: !!name,
    q1_received_song:   !!song,
    q1_artist_value:    name  || null,
    q1_song_value:      song  || null,
  });

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  // Rate limit — fail-open on DB error (matches audit.js policy)
  try {
    const clientIp = extractIp(req);
    const blocked  = await checkBlocked(clientIp);
    if (blocked.blocked) {
      const retryAfter = Math.max(
        1,
        Math.ceil((new Date(blocked.expiresAt).getTime() - Date.now()) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'rate_limited', reason: 'blocked', retryAfter });
    }
    const limit = await checkRateLimit(clientIp, 'resolve_artist', {
      burst: { max: 5 },
      hour:  { max: 30 },
      day:   { max: 100 },
    });
    if (!limit.allowed) {
      await recordViolation(clientIp, 'resolve_artist', limit.reason);
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({
        error:      'rate_limited',
        reason:     limit.reason,
        retryAfter: limit.retryAfter,
      });
    }
  } catch { /* fail-open */ }

  try {
    const nameLower = name.toLowerCase();

    // ── RULE A: Song match + exact artist name → identity confirmed ──────
    // The song title is the disambiguation mechanism. Trust it.
    // Multiplicity of Apple artist results does NOT trigger 409 here —
    // the song match is authoritative.
    if (song) {
      // Q2 — RULE A executing
      diagLog('RULE_A_START', name, song, { q2_rule_a_executing: true });

      // Q3/Q4 — Apple song search called; exact URL logged
      const { songs, requestUrl, httpStatus } = await searchSongsByArtist(song, name);
      diagLog('SONG_SEARCH_RESPONSE', name, song, {
        q3_apple_song_api_called: true,
        q4_request_url:           requestUrl,
        q4_http_status:           httpStatus,
        q5_songs_returned:        songs.length,
        q5_song_candidates:       songs.map(s => ({
          songTitle:  s.attributes?.name        ?? null,
          artistName: s.attributes?.artistName  ?? null,
          artistId:   s.attributes?.artistId    ?? null,
          songId:     s.id                      ?? null,
        })),
      });

      const matched = songs.find(
        s => s.attributes?.artistName?.toLowerCase() === nameLower
      );

      // Q6 — was the matched song object found?
      diagLog('SONG_MATCH_RESULT', name, song, {
        q6_match_found:         !!matched,
        q6_matched_song_title:  matched?.attributes?.name       ?? null,
        q6_matched_artist_name: matched?.attributes?.artistName ?? null,
        q6_match_criterion:     `artistName.toLowerCase() === "${nameLower}"`,
      });

      if (matched) {
        const confirmedName = matched.attributes.artistName;

        // Q7 — confirmed artist carried forward into artist search
        diagLog('ARTIST_SEARCH_START', name, song, {
          q7_confirmed_name_carried_forward: confirmedName,
          q7_searching_apple_artists_for:    confirmedName,
        });

        const artistResult  = await searchArtist(confirmedName);

        diagLog('ARTIST_SEARCH_RESPONSE', name, song, {
          q7_artist_search_found:     artistResult.found,
          q7_candidate_count:         artistResult.results.length,
          q7_all_candidates:          artistResult.results.map(r => ({
            name: r.name,
            url:  r.url,
            id:   r.id,
          })),
          q7_first_candidate_name:    artistResult.results[0]?.name ?? null,
          q7_first_candidate_url:     artistResult.results[0]?.url  ?? null,
          q7_defect_note:             artistResult.results.length > 0 && artistResult.results[0]?.name !== confirmedName
            ? `IDENTITY_MISMATCH: results[0].name="${artistResult.results[0]?.name}" !== confirmedName="${confirmedName}"`
            : 'name_check_not_enforced_in_current_code',
        });

        if (artistResult.found && artistResult.results.length > 0) {
          logEvent(EVENTS.SONG_CONFIRMED, name, song, {
            confirmedName,
            candidateCount: artistResult.results.length,
          });
          diagLog('RETURNING_URL', name, song, {
            q7_url_returned:        artistResult.results[0].url,
            q7_url_artist_name:     artistResult.results[0].name,
            q7_confirmed_name:      confirmedName,
            q7_name_mismatch:       artistResult.results[0].name !== confirmedName,
            defect_line:            'resolve-artist.js:182 — results[0] taken without name verification',
          });
          return res.status(200).json({ url: artistResult.results[0].url });
        }
      } else {
        // Q8 — RULE A produced no match; why
        diagLog('RULE_A_NO_MATCH', name, song, {
          q8_rule_a_skipped_reason: songs.length === 0
            ? 'Apple song search returned 0 results for this query'
            : `${songs.length} song(s) returned but none had artistName matching "${name}" (case-insensitive). ` +
              `Artist names found: [${songs.map(s => s.attributes?.artistName ?? 'null').join(', ')}]`,
          q8_falling_through_to_rule_b: true,
        });
      }
    } else {
      // Q2/Q8 — RULE A was skipped entirely
      diagLog('RULE_A_SKIPPED', name, song, {
        q2_rule_a_executing:  false,
        q8_rule_a_skipped_reason: 'song param was empty — RULE A requires a song title',
      });
    }

    // ── RULE B/C: No song match — fallback to artist name only ──────────
    // Without song confirmation a single unambiguous Apple result is required.
    diagLog('RULE_B_START', name, song, { fallback_to_artist_only: true });

    const artistResult = await searchArtist(name);

    diagLog('RULE_B_ARTIST_SEARCH', name, song, {
      found:          artistResult.found,
      candidateCount: artistResult.results.length,
      candidates:     artistResult.results.map(r => ({ name: r.name, url: r.url, id: r.id })),
    });

    if (artistResult.found && artistResult.results.length === 1) {
      logEvent(EVENTS.ARTIST_ONLY, name, song, { candidateCount: 1 });
      diagLog('RETURNING_URL', name, song, {
        rule:              'B',
        url_returned:      artistResult.results[0].url,
        url_artist_name:   artistResult.results[0].name,
        name_mismatch:     artistResult.results[0].name !== name,
        defect_line:       'resolve-artist.js:193 — results[0] taken without name verification',
      });
      return res.status(200).json({ url: artistResult.results[0].url });
    }

    if (artistResult.found && artistResult.results.length > 1) {
      logEvent(EVENTS.AMBIGUOUS, name, song, {
        candidateCount: artistResult.results.length,
      });
      sendAlert(
        'Royaltē Alert — Ambiguous Artist Resolution',
        name,
        song,
        EVENTS.AMBIGUOUS
      );
      diagLog('RETURNING_409', name, song, { candidateCount: artistResult.results.length });
      return res.status(409).json({ error: 'ambiguous' });
    }

    // No results
    logEvent(EVENTS.NOT_FOUND, name, song);
    sendAlert(
      'Royaltē Alert — Artist Resolution Failed',
      name,
      song,
      EVENTS.NOT_FOUND
    );
    diagLog('RETURNING_404', name, song, {});
    return res.status(404).json({ error: 'not_found' });

  } catch (err) {
    console.error('[resolve-artist] Resolution failed:', err.message);
    return res.status(500).json({ error: 'resolution_failed' });
  }
}
