// ─────────────────────────────────────────────────────────────────────────
// ROYALTÉ ENGINEERING PRINCIPLE (Constitutional)
// Royaltē verifies intelligence.
// Royaltē does not estimate intelligence.
// If a provider cannot be verified: UNVERIFIED.
// Every number must be traceable and defensible.
// ─────────────────────────────────────────────────────────────────────────
//
// Payload Convergence Test — Constitutional Rule (Governance Directive Rule 3)
// ──────────────────────────────────────────────────────────────────────────
// Apple-URL and Spotify-URL inputs for the SAME artist MUST produce
// IDENTICAL business-intelligence payloads. Provenance fields exempt.
//
// Reference artist: Black Alternative
//   Apple   ID 505490272
//   Spotify ID 1lnM3VZrD6SG9vxBsE9654
//
// Modes:
//   CONVERGE_LIVE=1                  → live-fetch from $CONVERGE_HOST
//                                      (defaults to https://royalte.ai)
//   default                          → diff cached fixtures at
//                                      api/fixtures/convergence-{apple,spotify}.json
//
// Examples:
//   node tests/payload-convergence-test.mjs
//   CONVERGE_LIVE=1 node tests/payload-convergence-test.mjs
//   CONVERGE_LIVE=1 CONVERGE_HOST=https://royalte-xyz.vercel.app \
//     node tests/payload-convergence-test.mjs
//
// Exit code: 0 on convergence, 1 on any business-intelligence divergence.
// ──────────────────────────────────────────────────────────────────────────

import fs from 'fs';

const APPLE_URL   = 'https://music.apple.com/us/artist/black-alternative/505490272';
const SPOTIFY_URL = 'https://open.spotify.com/artist/1lnM3VZrD6SG9vxBsE9654';

// Provenance fields exempt from convergence. The check exempts any leaf
// path whose first segment matches an entry here, AND any exact match.
const PROVENANCE_EXEMPT = new Set([
  // Top-level provenance (and any sub-path under these)
  'platform',
  'resolvedFrom',
  'resolvedFromType',
  'resolvedFromTitle',
  'artistImageUrl',
  'imageUrl',
  'albumImageUrl',
  'appleArtworkUrl',
  'artistUrl',
  'scannedAt',
  'scanId',
  'scanMode',
  // YouTube path divergence on identity URLs is acceptable when canonical
  // name match yields the same result; topVideos/videoId set varies by
  // YouTube API ordering even for the same query. Compare aggregate
  // counts but not per-video identifiers.
  'youtube.ugc.topVideos',
]);

function flatten(d, prefix = '') {
  const out = {};
  if (d === null || d === undefined) {
    out[prefix || '<root>'] = d;
    return out;
  }
  if (Array.isArray(d)) {
    if (d.length === 0) { out[prefix] = '[]'; return out; }
    d.forEach((v, i) => {
      const p = `${prefix}[${i}]`;
      if (v !== null && typeof v === 'object') Object.assign(out, flatten(v, p));
      else out[p] = v;
    });
    return out;
  }
  if (typeof d === 'object') {
    for (const [k, v] of Object.entries(d)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object') Object.assign(out, flatten(v, p));
      else out[p] = v;
    }
    return out;
  }
  out[prefix] = d;
  return out;
}

function isExempt(path) {
  if (PROVENANCE_EXEMPT.has(path)) return true;
  // Any prefix match against an exempt top-level token
  for (const exempt of PROVENANCE_EXEMPT) {
    if (path === exempt) return true;
    if (path.startsWith(exempt + '.') || path.startsWith(exempt + '[')) return true;
  }
  return false;
}

async function fetchAudit(host, url) {
  const r = await fetch(`${host}/api/audit?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} fetching ${url}`);
  return await r.json();
}

async function load() {
  if (process.env.CONVERGE_LIVE === '1') {
    const host = (process.env.CONVERGE_HOST || 'https://royalte.ai').replace(/\/$/, '');
    console.log(`[convergence] LIVE mode — host: ${host}`);
    const apple   = await fetchAudit(host, APPLE_URL);
    const spotify = await fetchAudit(host, SPOTIFY_URL);
    return { apple, spotify, mode: 'live', host };
  }
  const applePath   = 'api/fixtures/convergence-apple.json';
  const spotifyPath = 'api/fixtures/convergence-spotify.json';
  if (!fs.existsSync(applePath) || !fs.existsSync(spotifyPath)) {
    console.error(`✖ Fixtures missing.`);
    console.error(`  Expected: ${applePath}`);
    console.error(`  Expected: ${spotifyPath}`);
    console.error(`  Capture with: CONVERGE_LIVE=1 CONVERGE_HOST=<preview> \\`);
    console.error(`                node -e "<fetch + write fixtures>"`);
    process.exit(2);
  }
  return {
    apple:   JSON.parse(fs.readFileSync(applePath,   'utf8')),
    spotify: JSON.parse(fs.readFileSync(spotifyPath, 'utf8')),
    mode:    'fixtures',
  };
}

async function main() {
  const { apple, spotify, mode, host } = await load();
  const A = flatten(apple);
  const S = flatten(spotify);
  const all = new Set([...Object.keys(A), ...Object.keys(S)]);

  const divergent = [];
  let comparedCount = 0;
  let exemptCount   = 0;
  for (const path of all) {
    if (isExempt(path)) { exemptCount++; continue; }
    comparedCount++;
    const a = A[path];
    const s = S[path];
    if (JSON.stringify(a) !== JSON.stringify(s)) {
      divergent.push({ path, apple: a, spotify: s });
    }
  }

  console.log(`[convergence] mode=${mode}${host ? ` host=${host}` : ''}`);
  console.log(`[convergence] fields compared: ${comparedCount}, provenance-exempt: ${exemptCount}`);

  if (divergent.length === 0) {
    console.log(`✓ Payload convergence VERIFIED — Apple URL and Spotify URL produce identical business intelligence.`);
    process.exit(0);
  }

  console.error(`✖ Payload convergence FAILED — ${divergent.length} divergent business-intelligence field(s):\n`);
  for (const d of divergent.slice(0, 40)) {
    const a = JSON.stringify(d.apple);
    const s = JSON.stringify(d.spotify);
    console.error(`  ${d.path}`);
    console.error(`    apple   = ${a && a.length > 100 ? a.slice(0, 100) + '…' : a}`);
    console.error(`    spotify = ${s && s.length > 100 ? s.slice(0, 100) + '…' : s}`);
  }
  if (divergent.length > 40) {
    console.error(`\n  … ${divergent.length - 40} more not shown`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(`[convergence] threw: ${e.message}`);
  process.exit(1);
});
