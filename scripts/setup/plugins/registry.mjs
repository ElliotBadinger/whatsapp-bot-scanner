import { PhaseRegistry } from '../phases/registry.mjs';

const plugins = new Map();

export function registerPlugin(plugin) {
  if (!plugin?.id) {
    throw new Error('Plugin requires an id.');
  }
  if (plugins.has(plugin.id)) {
    throw new Error(`Plugin ${plugin.id} already registered.`);
  }
  plugins.set(plugin.id, {
    optional: true,
    hooks: {},
    ...plugin
  });
}

export function listPlugins() {
  return [...plugins.values()];
}

export function clearPlugins() {
  plugins.clear();
}

function createPluginApi({ registry, context, plugin }) {
  if (!(registry instanceof PhaseRegistry)) {
    throw new Error('Plugin API requires a PhaseRegistry instance.');
  }
  return {
    context,
    registerPhase(definition) {
      registry.register(definition);
    },
    extendPhase(id, extender) {
      registry.extend(id, extender);
    }
  };
}

export function activatePlugins({ context, registry }) {
  const active = [];
  for (const plugin of listPlugins()) {
    const enabled = plugin.isEnabled ? plugin.isEnabled(context) !== false : true;
    const instance = { ...plugin, enabled };
    if (enabled && typeof plugin.register === 'function') {
      const api = createPluginApi({ registry, context, plugin: instance });
      plugin.register(api);
    }
    active.push(instance);
  }
  return active;
}
