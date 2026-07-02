// Royaltē Recording Intelligence™ — Title Normalizer
//
// Strips version/mix/edit/remaster parentheticals and dash-suffixes from
// recording titles so MLC searches find the registered composition, not the
// release variant.
//
// Examples:
//   "Nosferatu (Cryptic Mix)"           → "Nosferatu"
//   "Shape of You (Radio Edit)"         → "Shape of You"
//   "Blinding Lights - Remastered"      → "Blinding Lights"
//   "Strange Situation (feat. Chuck Ice)"→ "Strange Situation"
//   "Perfect"                           → "Perfect"   (unchanged)
//
// Pure functions. No I/O. No side effects.

// Parenthetical or bracketed version info: (Radio Edit), [Live], (feat. X), etc.
const PAREN_VERSION_RE = /\s*[\(\[][^\)\]]*\b(remix|mix|edit|remaster(?:ed)?|live|acoustic|instrumental|version|extended|radio|single|feat\.?|ft\.?|with\s+)[^\)\]]*[\)\]]\s*$/gi;

// Dash-separated suffix: " - Remastered", " – Live Version", etc.
const DASH_VERSION_RE = /\s*[-–]\s*(remix|mix|edit|remaster(?:ed)?|live|acoustic|instrumental|version|extended|radio|single)\s*$/gi;

// Feature credits: "(feat. Chuck Ice)", "(ft. Someone)" regardless of position
const FEAT_RE = /\s*[\(\[](feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]\s*/gi;

// Strip one round of version suffixes
function stripVersionSuffix(title) {
  return title
    .replace(PAREN_VERSION_RE, '')
    .replace(DASH_VERSION_RE, '')
    .trim();
}

// normalizeTitle: strip version info, preserve feature credits.
// Use for MLC /search/recordings where artist filter handles attribution.
export function normalizeTitle(title) {
  if (typeof title !== 'string' || !title.trim()) return title ?? '';
  return stripVersionSuffix(title) || title;
}

// normalizeTitleStrict: also strips feature credits.
// Use for /search/songcode bare-title searches.
export function normalizeTitleStrict(title) {
  if (typeof title !== 'string' || !title.trim()) return title ?? '';
  const stripped = stripVersionSuffix(title).replace(FEAT_RE, ' ').replace(/\s{2,}/g, ' ').trim();
  return stripped || title;
}

// titleVariants: returns search candidates from most specific to least,
// deduplicated, for use in waterfall search strategies.
export function titleVariants(title) {
  if (typeof title !== 'string' || !title.trim()) return [];
  const seen = new Set();
  const out  = [];
  const add  = (t) => {
    const clean = typeof t === 'string' ? t.trim() : null;
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      out.push(clean);
    }
  };
  add(title);
  add(normalizeTitle(title));
  add(normalizeTitleStrict(title));
  return out;
}
