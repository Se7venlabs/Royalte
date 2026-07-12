// Canonical Intelligence Platform™ -- Executive Brief™ Formatting Engine
// Deterministic serialization. Independent of presentation.
// JSON is the sole implemented format in v1.0; all others are reserved.

import { EXECUTIVE_BRIEF_ENGINE_VERSION } from './version.js';

export const FORMAT_TYPES = Object.freeze({
  JSON:  'json',
  PDF:   'pdf',
  HTML:  'html',
  EMAIL: 'email',
  API:   'api',
});

export const FORMAT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  FUTURE: 'FUTURE',
});

export const FORMAT_REGISTRY = Object.freeze({
  json:  Object.freeze({ status: FORMAT_STATUS.ACTIVE, implemented: true  }),
  pdf:   Object.freeze({ status: FORMAT_STATUS.FUTURE, implemented: false }),
  html:  Object.freeze({ status: FORMAT_STATUS.FUTURE, implemented: false }),
  email: Object.freeze({ status: FORMAT_STATUS.FUTURE, implemented: false }),
  api:   Object.freeze({ status: FORMAT_STATUS.FUTURE, implemented: false }),
});

export const VALID_FORMATS = Object.freeze(new Set(Object.values(FORMAT_TYPES)));

function sortedReplacer(key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).sort().reduce((acc, k) => {
      acc[k] = value[k];
      return acc;
    }, {});
  }
  return value;
}

export function formatBrief(brief, format = FORMAT_TYPES.JSON) {
  if (!VALID_FORMATS.has(format)) {
    return Object.freeze({
      format,
      status:  'ERROR',
      message: `Unknown format: ${format}`,
      briefId: brief?.briefId ?? null,
    });
  }

  if (format === FORMAT_TYPES.JSON) {
    const content = JSON.stringify(brief, sortedReplacer, 2);
    return Object.freeze({
      format:         FORMAT_TYPES.JSON,
      status:         'COMPLETE',
      content,
      briefId:        brief?.briefId        ?? null,
      generatedAt:    brief?.generatedAt     ?? null,
      characterCount: content.length,
      engineVersion:  EXECUTIVE_BRIEF_ENGINE_VERSION,
    });
  }

  return Object.freeze({
    format,
    status:      'FUTURE_FORMAT',
    implemented: false,
    message:     `${format} export is reserved for a future release`,
    briefId:     brief?.briefId     ?? null,
    generatedAt: brief?.generatedAt ?? null,
  });
}

export function getFormatRegistry() {
  return FORMAT_REGISTRY;
}
