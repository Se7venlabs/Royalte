// Canonical Intelligence Platform(tm) -- Conflict Detection(tm)
// Detects disagreement between provider values; never hides conflicts.

import { randomUUID } from 'crypto';
import { CONFLICT_TYPES } from './types.js';

export function detectConflict(providerValues) {
  const entries = Object.entries(providerValues).filter(([, v]) => v !== null && v !== undefined);

  if (entries.length === 0) {
    return Object.freeze({
      conflictId:   randomUUID(),
      conflictType: CONFLICT_TYPES.NO_DATA,
      isConflicting: false,
      providerValues: Object.freeze({ ...providerValues }),
      agreementGroups: Object.freeze([]),
      conflictingPairs: Object.freeze([]),
    });
  }

  if (entries.length === 1) {
    return Object.freeze({
      conflictId:   randomUUID(),
      conflictType: CONFLICT_TYPES.SINGLE_SOURCE,
      isConflicting: false,
      providerValues: Object.freeze({ ...providerValues }),
      agreementGroups: Object.freeze([[entries[0][0]]]),
      conflictingPairs: Object.freeze([]),
    });
  }

  // Group providers by identical normalized value
  const valueGroups = new Map();
  for (const [provider, value] of entries) {
    const key = String(value);
    if (!valueGroups.has(key)) valueGroups.set(key, []);
    valueGroups.get(key).push(provider);
  }

  const agreementGroups = Array.from(valueGroups.values()).sort((a, b) => b.length - a.length);
  const uniqueValues = valueGroups.size;

  let conflictType;
  let isConflicting;

  if (uniqueValues === 1) {
    conflictType  = CONFLICT_TYPES.ALL_AGREE;
    isConflicting = false;
  } else if (agreementGroups[0].length > 1) {
    conflictType  = CONFLICT_TYPES.PARTIAL_AGREEMENT;
    isConflicting = true;
  } else {
    conflictType  = CONFLICT_TYPES.CONFLICT;
    isConflicting = true;
  }

  // Record all pairs that conflict
  const conflictingPairs = [];
  if (isConflicting) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        if (String(entries[i][1]) !== String(entries[j][1])) {
          conflictingPairs.push(Object.freeze([entries[i][0], entries[j][0]]));
        }
      }
    }
  }

  return Object.freeze({
    conflictId:       randomUUID(),
    conflictType,
    isConflicting,
    providerValues:   Object.freeze({ ...providerValues }),
    agreementGroups:  Object.freeze(agreementGroups.map(g => Object.freeze([...g]))),
    conflictingPairs: Object.freeze(conflictingPairs),
  });
}
