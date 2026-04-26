// [API HOOK] GET /api/audit?session_id=... → results.actionPlan
export const ACTION_PLAN = [
  { num: 1, title: 'Add missing ISRCs',           sub: '3 tracks',    severity: 'High',   steps: ['Log into your distributor', 'Locate the 3 tracks flagged below', 'Submit ISRC codes via the distributor dashboard'], link: 'https://help.distrokid.com/hc/en-us/articles/360008486514' },
  { num: 2, title: 'Claim YouTube Content ID',    sub: '2 channels',  severity: 'High',   steps: ['Apply for YouTube Content ID through your distributor', 'Verify channel ownership', 'Wait 7-14 days for approval'], link: 'https://support.google.com/youtube/answer/2797370' },
  { num: 3, title: 'Link publishing to recordings', sub: '4 releases', severity: 'Medium', steps: ['Open your publishing admin dashboard', 'Match each work to its master recording', 'Submit ISWC ↔ ISRC linking'], link: '#' },
  { num: 4, title: 'Review & update splits',      sub: '2 tracks',    severity: 'Medium', steps: ['Review writer splits with co-writers', 'Update splits in PRO portal (ASCAP/BMI/SOCAN)', 'Sync changes with publishing admin'], link: '#' },
  { num: 5, title: 'Add editorial tags',          sub: '7 tracks',    severity: 'Low',    steps: ['Open Apple Music for Artists', 'Submit editorial tag requests for each track', 'Allow 5-10 business days for review'], link: 'https://artists.apple.com' },
];
