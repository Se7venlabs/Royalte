// Health Intelligence™ capability — ATHENA™ Phase 3E Capability Registry™
import { registerCapability } from './registry.js';
import { makeFingerprintCapability } from './_fingerprint-capability.js';

registerCapability(makeFingerprintCapability('health', { workspace: '/workspaces/health-intelligence.html' }));
