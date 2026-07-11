// Canonical Intelligence Platform(tm) -- Normalization Transformers
//
// Low-level pure transform primitives used by normalizer rules.
// No side effects. No imports. No state.
//
// Every function is safe to call with any value type: if the type is wrong
// the original value is returned unchanged (fail-safe).

// -- String ------------------------------------------------------------------

export function trimWhitespace(value) {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export function collapseSpaces(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\s+/g, ' ');
}

export function normalizeUnicodeNfc(value) {
  if (typeof value !== 'string') return value;
  return value.normalize('NFC');
}

// Curly / smart double quotes → straight double quote
// Curly / smart single quotes → straight single quote
export function normalizeStraightQuotes(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[“”„‟❝❞″‶]/g, '"')
    .replace(/[‘’‚‛❛❜]/g, "'");
}

// Typographic apostrophes → straight apostrophe
export function normalizeApostrophe(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[’ʼʹ`´]/g, "'");
}

export function normalizeEmptyString(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

// undefined → null (canonical null semantics)
export function normalizeUndefined(value) {
  return value === undefined ? null : value;
}

// -- Identifiers -------------------------------------------------------------

// ISRC format (ISO 3901): CC-XXX-YY-NNNNN
// Accepts with or without hyphens; input is uppercased.
export function formatIsrc(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[-\s]/g, '').toUpperCase();
  if (cleaned.length !== 12) return value;
  // Basic character check: first 5 alphanumeric, last 7 digits
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(cleaned)) return value;
  return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5, 7)}-${cleaned.slice(7)}`;
}

// UPC/EAN: strip formatting, left-pad 12-digit to 13
export function formatUpc(value) {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[-\s]/g, '');
  if (!/^\d+$/.test(cleaned)) return value;
  if (cleaned.length === 12) return cleaned.padStart(13, '0');
  if (cleaned.length === 13) return cleaned;
  return value;
}

// -- URLs --------------------------------------------------------------------

// Lowercase scheme and host; remove trailing slash from bare path.
export function normalizeUrl(value) {
  if (typeof value !== 'string') return value;
  try {
    const u = new URL(value);
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  } catch {
    return value;
  }
}

// -- Dates -------------------------------------------------------------------

// Normalize date strings to ISO 8601 YYYY-MM-DD.
// Accepts: YYYY-MM-DD (pass-through), YYYY (pass-through), full ISO datetime (truncate).
export function normalizeIsoDate(value) {
  if (typeof value !== 'string') return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{4}$/.test(value)) return value;
  // Full ISO datetime: keep date portion
  const m = value.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (m) return m[1];
  // Fallback: attempt Date parse
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

// -- Location ----------------------------------------------------------------

// ISO 3166-1 alpha-2: exactly 2 uppercase letters.
export function normalizeCountryCode(value) {
  if (typeof value !== 'string') return value;
  const c = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(c)) return c;
  return value;
}

// ISO 639-1: exactly 2 lowercase letters.
export function normalizeLanguageCode(value) {
  if (typeof value !== 'string') return value;
  const c = value.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(c)) return c;
  return value;
}

// -- Booleans ----------------------------------------------------------------

// String "true"/"false"/"yes"/"no"/"1"/"0" → boolean.
// Any other string or non-string is returned as-is.
export function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  const lower = value.trim().toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === '0') return false;
  return value;
}

// -- Numeric -----------------------------------------------------------------

// String digits → integer; already-numeric pass-through.
export function normalizeInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) return value;
  return parseInt(trimmed, 10);
}

// Negative integers → null (platforms have no negative follower counts, etc.)
export function normalizePositiveInteger(value) {
  const n = typeof value === 'string' ? parseInt(value.trim(), 10) : value;
  if (typeof n !== 'number' || Number.isNaN(n)) return value;
  return n < 0 ? null : n;
}
