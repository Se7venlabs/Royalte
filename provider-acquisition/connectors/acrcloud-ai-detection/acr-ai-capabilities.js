// ACRCloud AI Detection capability declaration — Phase 5.0
//
// Declares only the evidence type supported by the ACRCloud AI Detection
// Connector™: AI-generated-music classification via ACRCloud's File Scanning
// product (engine 5 — AI Music Detection).
// https://docs.acrcloud.com/faq/ai-music-detection
//
// AI_MUSIC_DETECTION — submit-and-poll acquisition via ACRCloud File
//   Scanning: identifies whether a recording is likely AI-generated, which
//   AI system likely produced it, and a per-source confidence breakdown.
//
// This is a completely separate capability and connector from
// AUDIO_RECOGNITION (../acrcloud/) — different ACRCloud product, different
// auth model, different processing model. See README.md for the full
// architectural distinction.
//
// Capabilities are immutable. Changes require Board authorization.

import { Capability } from '../../capability/capabilityVocabulary.js';

export const ACR_AI_DETECTION_CAPABILITIES = Object.freeze([
  Capability.AI_MUSIC_DETECTION,
]);
