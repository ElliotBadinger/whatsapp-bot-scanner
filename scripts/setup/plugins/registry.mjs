const plugins = new Map();

export function registerPlugin(plugin) {
  if (!plugin?.id) {
    throw new Error("Plugin requires an id.");
  }
  if (plugins.has(plugin.id)) {
    throw new Error(`Plugin ${plugin.id} already registered.`);
  }
  plugins.set(plugin.id, {
    optional: true,
    stages: [],
    ...plugin,
  });
}

export function listPlugins() {
  return [...plugins.values()];
}

export function pluginsForStage(stage, context) {
  return listPlugins().filter(
    (plugin) =>
      plugin.stages.includes(stage) && plugin.isEnabled?.(context) !== false,
  );
}

export function clearPlugins() {
  plugins.clear();
}
