// ATHENA Capability Registry™ — import this one file to register all 11
// capabilities (self-registering: each import below calls
// registerCapability() at module load time as a side effect).

import './identity.js';
import './publishing.js';
import './catalog.js';
import './health.js';
import './backend.js';
import './media.js';
import './global-footprint.js';
import './monitoring.js';
import './executive-memory.js';
import './executive-brief-archive.js';
import './conversation-history.js';

export { registerCapability, getCapabilities, getCapability } from './registry.js';
