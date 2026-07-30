// Identity Intelligence™ capability — ATHENA™ Phase 3E Capability Registry™
import { registerCapability } from './registry.js';
import { makeFingerprintCapability } from './_fingerprint-capability.js';

registerCapability(makeFingerprintCapability('identity', { workspace: '/workspaces/identity-intelligence.html' }));
