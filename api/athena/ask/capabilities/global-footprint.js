// Global Music Footprint™ capability — ATHENA™ Phase 3E Capability Registry™
import { registerCapability } from './registry.js';
import { makeFingerprintCapability } from './_fingerprint-capability.js';

registerCapability(makeFingerprintCapability('footprint', { name: 'globalFootprint', workspace: '/workspaces/global-music-footprint.html' }));
