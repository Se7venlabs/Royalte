// [API HOOK] GET /api/audit?session_id=... → results.issues
export const ISSUES = [
  { id: 1, icon: 'tag',     title: 'Missing ISRC for 3 tracks',         sub: 'Tracks may not be properly tracked',     severity: 'High',   impact: '$1,210+', tracks: 3 },
  { id: 2, icon: 'youtube', title: 'YouTube Content ID not claimed',    sub: "You're missing out on Content ID revenue", severity: 'High',   impact: '$1,032+', tracks: 2 },
  { id: 3, icon: 'link',    title: 'Publishing not linked to recordings', sub: 'Publishing and master not connected',  severity: 'Medium', impact: '$842+',   tracks: 4 },
  { id: 4, icon: 'users',   title: 'Missing writer splits on 2 tracks', sub: 'Incomplete splits can cause payment issues', severity: 'Medium', impact: '$623+', tracks: 2 },
  { id: 5, icon: 'apple',   title: 'Apple Music missing editorial tags', sub: 'Improper tagging reduces discoverability', severity: 'Low', impact: '$320+', tracks: 7 },
  { id: 6, icon: 'globe',   title: 'Territory coverage gap (3 regions)', sub: 'Music not registered in 3 collection territories', severity: 'Medium', impact: '$487+', tracks: 0 },
  { id: 7, icon: 'tag',     title: 'Inconsistent artist name on 1 track', sub: 'Name spelling differs across platforms', severity: 'Low', impact: '$210+', tracks: 1 },
  { id: 8, icon: 'shield',  title: 'SoundExchange registration incomplete', sub: 'Digital performance royalties at risk', severity: 'Low', impact: '$168+', tracks: 0 },
];
