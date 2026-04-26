// [API HOOK] GET /api/audit?session_id=... → results.platforms
// `icon` references a key in BRAND_ICONS (utils/brandIcons.js).
export const PLATFORMS = [
  { name: 'Spotify',     icon: 'spotify',    status: 'connected' },
  { name: 'Apple Music', icon: 'apple',      status: 'connected' },
  { name: 'YouTube',     icon: 'youtube',    status: 'connected' },
  { name: 'SoundCloud',  icon: 'soundcloud', status: 'connected' },
  { name: 'TikTok',      icon: 'tiktok',     status: 'connected' },
  { name: '+9',          icon: 'more',       status: 'available', meta: 'More Platforms' },
];
