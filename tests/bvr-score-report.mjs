// ─────────────────────────────────────────────────────────────────────
//  Best Verified Release™ — Board Validation Report
//
//  Engineering verification only. Not called from any production path.
//  Run: node tests/bvr-score-report.mjs
// ─────────────────────────────────────────────────────────────────────

import {
  debugScoreReport,
  BVR_VERIFICATION_WEIGHTS,
  BVR_METADATA_WEIGHT_PER_FIELD,
  BVR_ARTWORK_WEIGHT,
  BVR_RELEASE_TYPE_WEIGHTS,
  BVR_STREAMING_WEIGHT,
  BVR_RECENCY_WEIGHTS,
} from '../api/_lib/best-verified-release.js';

// ── Representative catalog — Black Alternative ────────────────────────
// Mirrors a realistic Apple Music album list returned by getArtistAlbums().
// trackCount drives Album/EP/Single classification (same logic as engine).

const ARTIST_NAME = 'Black Alternative';

const CATALOG = [
  {
    id: 'apple-1001',
    name: 'This Life of Eternity',
    trackCount: 14,
    releaseDate: '2024-09-20',
    url: 'https://music.apple.com/us/album/this-life-of-eternity/1001',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/this-life-of-eternity/300x300bb.jpg',
  },
  {
    id: 'apple-1002',
    name: 'Reflections EP',
    trackCount: 5,
    releaseDate: '2023-04-11',
    url: 'https://music.apple.com/us/album/reflections-ep/1002',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/reflections-ep/300x300bb.jpg',
  },
  {
    id: 'apple-1003',
    name: 'Midnight Run',
    trackCount: 1,
    releaseDate: '2025-01-14',
    url: 'https://music.apple.com/us/album/midnight-run/1003',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/midnight-run/300x300bb.jpg',
  },
  {
    id: 'apple-1004',
    name: 'First Chapter',
    trackCount: 11,
    releaseDate: '2018-03-07',
    url: 'https://music.apple.com/us/album/first-chapter/1004',
    artwork: null, // no artwork — debut album, older
  },
  {
    id: 'apple-1005',
    name: 'Signal Lost',
    trackCount: 1,
    releaseDate: '2022-11-03',
    url: 'https://music.apple.com/us/album/signal-lost/1005',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/signal-lost/300x300bb.jpg',
  },
  {
    id: 'apple-1006',
    name: 'Between Worlds',
    trackCount: 3,
    releaseDate: '2021-06-18',
    url: 'https://music.apple.com/us/album/between-worlds/1006',
    artwork: 'https://is1-ssl.mzstatic.com/image/thumb/Music/between-worlds/300x300bb.jpg',
  },
];

// ── Formatting helpers ────────────────────────────────────────────────

const W = 58;
function line(ch = '─') { return ch.repeat(W); }
function center(s) {
  const pad = Math.max(0, Math.floor((W - s.length) / 2));
  return ' '.repeat(pad) + s;
}
function row(label, value) {
  const dots = '.'.repeat(Math.max(2, W - label.length - String(value).length));
  return `  ${label}${dots}${value}`;
}
function scoreRow(label, value, max) {
  const sign = value > 0 ? `+${value}` : `${value}`;
  const bar = value > 0 ? '█'.repeat(Math.round((value / max) * 20)) : '';
  return `  ${(label + ' ').padEnd(28)}${sign.padStart(4)}   ${bar}`;
}

// ── Run engine ────────────────────────────────────────────────────────

const report = debugScoreReport(CATALOG, ARTIST_NAME);

// ── Header ────────────────────────────────────────────────────────────

console.log('\n' + line('═'));
console.log(center('ROYALTĒ INTELLIGENCE™'));
console.log(center('Best Verified Release™ — Board Validation Report'));
console.log(center('Engineering Transparency Report — Not for Production'));
console.log(line('═'));
console.log();
console.log(row('Artist', report.artistName));
console.log(row('Catalog entries evaluated', report.candidateCount));
console.log(row('Eligible releases scored', report.eligibleCount));
console.log(row('Ineligible (no name)', report.candidateCount - report.eligibleCount));
console.log();

// ── Max score legend ──────────────────────────────────────────────────

const SCORE_MAX = {
  'Verification Confidence': BVR_VERIFICATION_WEIGHTS.FULL,
  'Metadata Completeness':   BVR_METADATA_WEIGHT_PER_FIELD * 4,
  'Artwork Present':         BVR_ARTWORK_WEIGHT,
  'Release Type (max Album)':BVR_RELEASE_TYPE_WEIGHTS.ALBUM,
  'Streaming Presence':      BVR_STREAMING_WEIGHT,
  'Recency Bonus':           BVR_RECENCY_WEIGHTS.RECENT,
};

console.log(line('─'));
console.log(center('SCORING WEIGHTS (Board-Locked)'));
console.log(line('─'));
let weightTotal = 0;
for (const [label, max] of Object.entries(SCORE_MAX)) {
  console.log(scoreRow(label, max, 100));
  weightTotal += max;
}
console.log('  ' + '─'.repeat(W - 2));
console.log(scoreRow('MAXIMUM POSSIBLE SCORE', weightTotal, 100));
console.log();

// ── Selected release breakdown ────────────────────────────────────────

const sel = report.selected;

console.log(line('═'));
console.log(center('SELECTED RELEASE'));
console.log(line('═'));
console.log();
console.log(`  Release:      ${sel.releaseTitle}`);
console.log(`  Artist:       ${report.artistName}`);
console.log(`  Type:         ${sel.releaseType}`);
console.log(`  Released:     ${sel.releaseDate || 'Unknown'}`);
console.log(`  Artwork:      ${sel.artwork ? 'Present ✓' : 'Absent ✗'}`);
if (sel.artwork) console.log(`  Artwork URL:  ${sel.artwork}`);
console.log();
console.log(line('─'));
console.log(center('SCORE BREAKDOWN'));
console.log(line('─'));
console.log();
console.log(scoreRow('Verification Confidence', sel.verificationScore, 100));
console.log(`${''.padEnd(32)}(${sel.verificationScore === BVR_VERIFICATION_WEIGHTS.FULL ? 'FULL — id + url + name present' : sel.verificationScore === BVR_VERIFICATION_WEIGHTS.PARTIAL ? 'PARTIAL' : 'MINIMAL'})`);
console.log();
console.log(scoreRow('Metadata Completeness', sel.metadataScore, 100));
const metaFields = sel.metadataScore / BVR_METADATA_WEIGHT_PER_FIELD;
console.log(`${''.padEnd(32)}(${metaFields}/4 fields × ${BVR_METADATA_WEIGHT_PER_FIELD}pts: name · trackCount · releaseDate · artwork)`);
console.log();
console.log(scoreRow('Artwork Present', sel.artworkScore, 100));
console.log();
console.log(scoreRow(`Release Type (${sel.releaseType})`, sel.typeScore, 100));
console.log(`${''.padEnd(32)}(Album +${BVR_RELEASE_TYPE_WEIGHTS.ALBUM} / EP +${BVR_RELEASE_TYPE_WEIGHTS.EP} / Single +${BVR_RELEASE_TYPE_WEIGHTS.SINGLE})`);
console.log();
console.log(scoreRow('Streaming Presence', sel.streamingScore, 100));
console.log(`${''.padEnd(32)}(Apple Music canonical — verified source)`);
console.log();
console.log(scoreRow('Recency Bonus', sel.recencyScore, 100));
const recencyLabel = sel.recencyScore === BVR_RECENCY_WEIGHTS.RECENT      ? '≤2 years old'
                   : sel.recencyScore === BVR_RECENCY_WEIGHTS.MODERATE     ? '3–5 years old'
                   : 'established (>5 years)';
console.log(`${''.padEnd(32)}(${recencyLabel})`);
console.log();
console.log('  ' + '─'.repeat(W - 2));
console.log(scoreRow('SELECTION SCORE', sel.selectionScore, 100));
console.log();

// ── Selection reason ──────────────────────────────────────────────────

console.log(line('─'));
console.log(center('WHY THIS RELEASE WAS SELECTED'));
console.log(line('─'));
console.log();

const reasons = [];
if (sel.verificationScore === BVR_VERIFICATION_WEIGHTS.FULL)
  reasons.push('Highest verification confidence — id, url, and name all present');
if (sel.metadataScore === BVR_METADATA_WEIGHT_PER_FIELD * 4)
  reasons.push('Complete metadata — all 4 fields present (name, trackCount, releaseDate, artwork)');
if (sel.artworkScore > 0)
  reasons.push('High-quality artwork available at 300×300 from Apple Music');
if (sel.typeScore === BVR_RELEASE_TYPE_WEIGHTS.ALBUM)
  reasons.push('Album — highest release-type weighting (+15 vs EP +10 vs Single +5)');
if (sel.streamingScore > 0)
  reasons.push('Confirmed available on Apple Music (canonical streaming source)');
if (sel.recencyScore === BVR_RECENCY_WEIGHTS.RECENT)
  reasons.push('Recent release — within the past 2 years (+5 recency bonus)');
else if (sel.recencyScore === BVR_RECENCY_WEIGHTS.MODERATE)
  reasons.push('Moderately recent — within the past 5 years (+2 recency bonus)');
reasons.push('Highest total selection score among all evaluated candidates');

reasons.forEach((r) => console.log(`  • ${r}`));
console.log();

// ── All candidates ────────────────────────────────────────────────────

console.log(line('═'));
console.log(center('ALL EVALUATED CANDIDATES'));
console.log(center(`(${report.eligibleCount} eligible releases, ranked by selection score)`));
console.log(line('═'));

report.candidates.forEach((c, i) => {
  console.log();
  const rank = `#${i + 1}`;
  const statusTag = c.status === 'SELECTED' ? ' ← SELECTED' : '';
  console.log(`  ${rank}  ${c.releaseTitle}${statusTag}`);
  console.log(`       Type: ${c.releaseType}   Released: ${c.releaseDate || 'Unknown'}   Artwork: ${c.artwork ? 'Yes' : 'No'}`);
  console.log(`       Score: ${c.selectionScore}/100`);
  console.log(`         Verification +${c.verificationScore}  Metadata +${c.metadataScore}  Artwork +${c.artworkScore}  Type +${c.typeScore}  Streaming +${c.streamingScore}  Recency +${c.recencyScore}`);
  if (c.status === 'NOT SELECTED') {
    console.log(`       Reason not selected: ${c.reasonNotSelected}`);
  }
  if (i < report.candidates.length - 1) console.log('  ' + '─'.repeat(W - 2));
});

console.log();
console.log(line('═'));
console.log(center('END OF BOARD VALIDATION REPORT'));
console.log(center(`Best Verified Release™ Selection Engine v1.0`));
console.log(line('═'));
console.log();
