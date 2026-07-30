// Media Intelligence™ capability — ATHENA™ Phase 3E Capability Registry™
import { registerCapability } from './registry.js';
import { makeFingerprintCapability } from './_fingerprint-capability.js';

registerCapability(makeFingerprintCapability('media', { workspace: '/workspaces/media-intelligence.html' }));
