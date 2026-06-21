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

// ── Apple Music helpers ────────────────────────────────────────────────────

async function searchSongsByArtist(song, name) {
  try {
    const token = generateAppleToken();
    const query = encodeURIComponent(`${song} ${name}`);
    const resp  = await fetch(
      `${APPLE_API}/catalog/us/search?term=${query}&types=songs&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.results?.songs?.data || [];
  } catch { return []; }
}

// ── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const name = (req.query.name || '').trim();
  const song = (req.query.song || '').trim();

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
      const songs   = await searchSongsByArtist(song, name);
      const matched = songs.find(
        s => s.attributes?.artistName?.toLowerCase() === nameLower
      );
      if (matched) {
        const confirmedName = matched.attributes.artistName;
        const artistResult  = await searchArtist(confirmedName);
        if (artistResult.found && artistResult.results.length > 0) {
          logEvent(EVENTS.SONG_CONFIRMED, name, song, {
            confirmedName,
            candidateCount: artistResult.results.length,
          });
          return res.status(200).json({ url: artistResult.results[0].url });
        }
      }
    }

    // ── RULE B/C: No song match — fallback to artist name only ──────────
    // Without song confirmation a single unambiguous Apple result is required.
    const artistResult = await searchArtist(name);

    if (artistResult.found && artistResult.results.length === 1) {
      logEvent(EVENTS.ARTIST_ONLY, name, song, { candidateCount: 1 });
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
    return res.status(404).json({ error: 'not_found' });

  } catch (err) {
    console.error('[resolve-artist] Resolution failed:', err.message);
    return res.status(500).json({ error: 'resolution_failed' });
  }
}
