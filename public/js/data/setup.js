// [API HOOK] GET /api/setup → distributor / PRO / publishing / etc.
// Each area is an intake "module" with:
//   detected:  fields auto-populated from connected platforms (read-only)
//   intake:    fields the user fills in (input/select/toggle)
//   checks:    sub-checks that roll up into the area's status
//   warning:   inline missing-item alert with revenue-at-risk (optional)
//   actions:   route links the user can jump to (Action Plan / Issues)
export const SETUP = [
  {
    id: 'distributor',
    title: 'Distributor',
    blurb: 'How your music is delivered to streaming platforms and download stores.',
    status: 'connected',
    score: 88,
    lastVerified: 'Apr 24, 2026',
    detected: [
      { label: 'Provider',         value: 'DistroKid' },
      { label: 'Account email',    value: 'jordan@example.com' },
      { label: 'Active releases',  value: '14' },
      { label: 'Last sync',        value: '2 days ago' },
    ],
    intake: [
      { type: 'select', label: 'Backup distributor (optional)', value: '', options: ['', 'TuneCore', 'CD Baby', 'AWAL', 'UnitedMasters', 'Amuse'], placeholder: 'None selected' },
      { type: 'text',   label: 'Tracks awaiting ISRC',          value: '3', hint: 'Detected from your latest scan' },
    ],
    checks: [
      { label: 'ISRC coverage',           state: 'partial', detail: '11 of 14 tracks have ISRCs' },
      { label: 'Content ID enrollment',   state: 'ok',      detail: 'Enrolled via DistroKid' },
      { label: 'Apple Digital Masters',   state: 'ok',      detail: 'Eligible' },
      { label: 'Spotify for Artists',     state: 'partial', detail: 'Claimed but not verified' },
    ],
    warning: { severity: 'medium', text: '3 tracks are missing ISRCs and may not be tracked on streaming platforms.', impact: '$1,210+ at risk' },
    actions: [
      { label: 'Fix in Action Plan',      route: 'actions' },
      { label: 'View affected tracks',    route: 'catalog' },
    ],
  },
  {
    id: 'pro',
    title: 'PRO (Performance Rights)',
    blurb: 'Your performance rights organization. Collects royalties when your songs are played publicly.',
    status: 'connected',
    score: 76,
    lastVerified: 'Apr 22, 2026',
    detected: [
      { label: 'Society',           value: 'SOCAN' },
      { label: 'Member ID',         value: '****-2871' },
      { label: 'Registered works',  value: '12 of 14' },
      { label: 'Account status',    value: 'Active' },
    ],
    intake: [
      { type: 'text',   label: 'IPI / CAE number',           value: '00374829471', hint: '11 digits, assigned by your PRO' },
      { type: 'select', label: 'Splits set with co-writers', value: 'partial', options: ['confirmed', 'partial', 'not-set'], labels: { confirmed: 'Confirmed for all works', partial: 'Confirmed for some works', 'not-set': 'Not yet set' } },
      { type: 'toggle', label: 'Foreign collection enabled', value: true,  hint: 'Allows your PRO to collect from sister societies abroad' },
    ],
    checks: [
      { label: 'Writer splits documented',     state: 'partial', detail: '2 tracks pending co-writer confirmation' },
      { label: 'Works registered with PRO',    state: 'partial', detail: '12 of 14 works' },
      { label: 'Statements uploaded',          state: 'ok',      detail: '4 statements parsed' },
      { label: 'IPI / CAE number on file',     state: 'ok',      detail: 'Verified' },
    ],
    warning: { severity: 'medium', text: '2 tracks have unconfirmed writer splits, which can delay or block royalty distribution.', impact: '$420+ at risk' },
    actions: [
      { label: 'Review splits in Action Plan', route: 'actions' },
      { label: 'View 2 affected issues',       route: 'issues' },
    ],
  },
  {
    id: 'publishing',
    title: 'Publishing Admin',
    blurb: 'Connects your songs (compositions) to recordings so mechanical and sync royalties flow to you.',
    status: 'partial',
    score: 58,
    lastVerified: 'Apr 22, 2026',
    detected: [
      { label: 'Provider',           value: 'Songtrust' },
      { label: 'Publisher name',     value: 'Jordan Kai Music' },
      { label: 'Linked recordings',  value: '10 of 14' },
      { label: 'Open issues',        value: '4' },
    ],
    intake: [
      { type: 'text',     label: 'Publisher / company name',    value: 'Jordan Kai Music' },
      { type: 'textarea', label: 'ISWCs (one per line)',        value: 'T-309.123.456-1\nT-309.123.457-9\nT-309.123.458-6', hint: 'International Standard Musical Work Codes' },
      { type: 'multi',    label: 'Sub-publishing territories',  value: ['NA', 'EU', 'UK'], options: ['NA', 'EU', 'UK', 'JP', 'AU', 'LATAM', 'Asia (other)'], hint: 'Where your publisher collects on your behalf' },
    ],
    checks: [
      { label: 'ISWC ↔ ISRC linking',         state: 'partial', detail: '10 of 14 recordings linked to compositions' },
      { label: 'Sub-publishing coverage',     state: 'partial', detail: '3 of 7 territories registered' },
      { label: 'Mechanical collections',      state: 'ok',      detail: 'Active via Songtrust' },
      { label: 'Sync rep / agent',            state: 'missing', detail: 'No representation on file' },
    ],
    warning: { severity: 'high', text: '4 recordings are not linked to their compositions. Mechanical and streaming-mechanical royalties may be uncollected.', impact: '$842+ at risk' },
    actions: [
      { label: 'Link recordings in Action Plan', route: 'actions' },
      { label: 'View 4 affected issues',         route: 'issues' },
    ],
  },
  {
    id: 'soundexchange',
    title: 'SoundExchange',
    blurb: 'US digital performance royalties from non-interactive radio (Pandora, SiriusXM, internet radio).',
    status: 'partial',
    score: 62,
    lastVerified: 'Apr 21, 2026',
    detected: [
      { label: 'Account status',     value: 'Active' },
      { label: 'Registered tracks',  value: '8 of 14' },
      { label: 'Direct deposit',     value: 'Set up' },
      { label: 'Payee type',         value: 'Featured artist' },
    ],
    intake: [
      { type: 'text',   label: 'Payee number',                value: 'PA-7782619' },
      { type: 'text',   label: 'SR (Sound Recording) number', value: '', placeholder: 'Required for some claims', hint: 'Optional, but recommended' },
      { type: 'toggle', label: 'Also collect as non-featured', value: false, hint: 'Enable if you also perform as a session musician' },
    ],
    checks: [
      { label: 'Payee registered',             state: 'ok',      detail: 'Verified' },
      { label: 'Direct deposit configured',    state: 'ok',      detail: 'Linked to checking account' },
      { label: 'All recordings registered',    state: 'partial', detail: '8 of 14 recordings registered' },
      { label: 'Featured/non-featured split',  state: 'missing', detail: 'Not yet declared' },
    ],
    warning: { severity: 'low', text: '6 recordings are not yet registered with SoundExchange. US digital radio plays will not generate royalties for those tracks.', impact: '$168+ at risk' },
    actions: [
      { label: 'Register tracks in Action Plan', route: 'actions' },
    ],
  },
  {
    id: 'youtube',
    title: 'YouTube Content ID',
    blurb: 'YouTube\'s rights-management system. Identifies your music in user-uploaded videos and monetizes the views.',
    status: 'missing',
    score: 22,
    lastVerified: 'Apr 18, 2026',
    detected: [
      { label: 'Enrollment status',  value: 'Not enrolled' },
      { label: 'Eligible tracks',    value: '14' },
      { label: 'Channels linked',    value: '1' },
      { label: 'Recommended path',   value: 'Apply via distributor' },
    ],
    intake: [
      { type: 'text',   label: 'Primary YouTube channel URL', value: 'https://youtube.com/@jordankai' },
      { type: 'text',   label: 'Additional channels',         value: '', placeholder: 'One URL per line' },
      { type: 'toggle', label: 'YouTube Partner Program enabled', value: true,  hint: 'Required for AdSense revenue' },
      { type: 'toggle', label: 'AdSense linked to channel',       value: true },
    ],
    checks: [
      { label: 'Content ID enrollment',     state: 'missing', detail: 'Not enrolled — apply via distributor' },
      { label: 'Channel ownership verified', state: 'ok',      detail: 'Verified' },
      { label: 'Active claim conflicts',    state: 'partial', detail: '1 disputed claim on "Late Light"' },
      { label: 'AdSense monetization',      state: 'ok',      detail: 'Active' },
    ],
    warning: { severity: 'high', text: 'You are not enrolled in Content ID. UGC uses of your music on YouTube are not being monetized.', impact: '$1,032+ at risk' },
    actions: [
      { label: 'Enroll via Action Plan',  route: 'actions' },
      { label: 'View 2 affected issues',  route: 'issues' },
    ],
  },
  {
    id: 'neighbouring',
    title: 'Neighbouring Rights',
    blurb: 'Performer royalties from radio, public venues, and streaming outside the US. Separate from songwriter and master royalties.',
    status: 'missing',
    score: 18,
    lastVerified: 'Apr 18, 2026',
    detected: [
      { label: 'Society',              value: 'None registered' },
      { label: 'Performer ISNI',       value: 'Not on file' },
      { label: 'Territories covered',  value: '0 of 12' },
      { label: 'Estimated annual impact', value: '$487+' },
    ],
    intake: [
      { type: 'text',   label: 'Performer ISNI',              value: '', placeholder: '0000 0000 1234 5678', hint: 'International Standard Name Identifier' },
      { type: 'select', label: 'Primary society',             value: '', options: ['', 'Re:Sound (Canada)', 'PPL (UK)', 'GVL (Germany)', 'SCF (Italy)', 'SAMI (Sweden)', 'Gramex (Denmark)'], placeholder: 'Select your home society' },
      { type: 'multi',  label: 'Territories to register',     value: [], options: ['Canada', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Sweden', 'Denmark', 'Australia', 'Japan', 'Brazil'] },
    ],
    checks: [
      { label: 'Home society registered',      state: 'missing', detail: 'Not registered with any society' },
      { label: 'Performer ISNI on file',       state: 'missing', detail: 'Required for cross-border collection' },
      { label: 'Featured performer credits',   state: 'partial', detail: '11 of 14 recordings credited' },
      { label: 'Sister-society agreements',    state: 'missing', detail: 'No reciprocal coverage' },
    ],
    warning: { severity: 'medium', text: 'You are not registered with any neighbouring rights society. Performer royalties from international radio and public performance are not being collected.', impact: '$487+ at risk' },
    actions: [
      { label: 'Register in Action Plan',  route: 'actions' },
    ],
  },
];
