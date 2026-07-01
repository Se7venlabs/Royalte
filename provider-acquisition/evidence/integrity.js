// Evidence integrity helpers — PAL Technical Design v3 §3.2
// Operates over bytes. Never inspects payload meaning.
// Node built-in crypto only — no runtime dependencies added.

import { createHash } from 'node:crypto';

// Checksum of the stored payload. Detects tampering or storage corruption.
export function computePayloadChecksum(payload) {
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

// Hash of the exact bytes received from the provider before any parsing.
// Enables provider regression detection and scan replay (Evidence Store, §5A).
export function computeRawResponseHash(rawResponse) {
  const bytes = Buffer.isBuffer(rawResponse)
    ? rawResponse
    : Buffer.from(typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}
