// ACRCloud capability declaration — Phase 3.9 (ACRCloud)
//
// Declares only the evidence type supported by ACRCloud Audio Recognition Connector™ v1:
// the Identify API (https://docs.acrcloud.com/reference/identification-api).
//
// AUDIO_RECOGNITION — POST /v1/identify: identifies a recording from either a raw
//   audio sample or a precomputed fingerprint (subjectRef.audioSample vs.
//   subjectRef.fingerprint selects which; both hit the same endpoint with a
//   different data_type form field — see ACRCloudConnector#dispatchAcquire).
//
// Explicitly NOT declared in v1 (see Board Discovery Report):
//   - Metadata API, Bucket/Custom Files API, Broadcast Monitoring API — different
//     auth model (bearer console token) and/or async/webhook shape; out of scope.
//   - AI-generated music detection / human-vs-AI classification — reserved for a
//     separate, independently certifiable ACRCloud AI Detection Connector™.
//
// Capabilities are immutable. Changes require Board authorization.

import { Capability } from '../../capability/capabilityVocabulary.js';

export const ACR_CAPABILITIES = Object.freeze([
  Capability.AUDIO_RECOGNITION,
]);
