// Playbook Registry™ — import this one file to register all reference
// playbooks (self-registering: each import below calls registerPlaybook()
// at module load time as a side effect).

import './mlc-registration.js';
import './identity-coverage.js';

export { registerPlaybook, getPlaybook, getAllPlaybooks, getRegistrations } from '../registry.js';
