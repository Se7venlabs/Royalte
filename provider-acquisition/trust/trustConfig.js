// Provider Trust configuration — PAL Technical Design v3 §2.11
// Trust values are governance decisions: human-set, versioned, never computed.
// Framework reads and carries the value. It never interprets, ranks, or acts on it.
// Reasoning with trust values is the RIE's job (future phase).

const DEFAULT_CONFIG = Object.freeze({ configVersion: '1.0', providers: {} });

let _current = { configVersion: DEFAULT_CONFIG.configVersion, providers: {} };

export function loadTrustConfig(config = {}) {
  _current = {
    configVersion: config.configVersion ?? DEFAULT_CONFIG.configVersion,
    providers: Object.freeze({ ...(config.providers ?? {}) }),
  };
}

// Returns the configured trust value for a provider, or null if not configured.
// Returns a number — the framework never interprets what the number means.
export function getTrustValue(providerName) {
  return Object.prototype.hasOwnProperty.call(_current.providers, providerName)
    ? _current.providers[providerName]
    : null;
}

export function getTrustConfigVersion() {
  return _current.configVersion;
}

// For test isolation — resets to empty defaults.
export function resetTrustConfig() {
  _current = { configVersion: DEFAULT_CONFIG.configVersion, providers: {} };
}
