const REQUIRED_METHODS = ['testConnection', 'discoverModels', 'runCanary', 'complete', 'stream', 'normalizeError'];

export function assertProviderAdapter(adapter) {
  const id = String(adapter?.id || '').trim().toLowerCase();
  if (!id || REQUIRED_METHODS.some((method) => typeof adapter?.[method] !== 'function')) {
    throw new TypeError(`Provider adapter must implement the complete adapter contract: ${REQUIRED_METHODS.join(', ')}.`);
  }
  return id;
}

export function createAdapterRegistry(initialAdapters = []) {
  const adapters = new Map();
  const register = (adapter) => {
    const id = assertProviderAdapter(adapter);
    if (adapters.has(id)) throw new TypeError(`Duplicate provider adapter: ${id}.`);
    adapters.set(id, adapter);
    return adapter;
  };
  for (const adapter of initialAdapters) register(adapter);
  return Object.freeze({
    register,
    get(id) {
      const normalized = String(id || '').trim().toLowerCase();
      const adapter = adapters.get(normalized);
      if (!adapter) throw new TypeError(`Unknown provider adapter: ${normalized || '(empty)'}.`);
      return adapter;
    },
    has: (id) => adapters.has(String(id || '').trim().toLowerCase()),
    ids: () => [...adapters.keys()],
  });
}
