const BUILTIN_PHASES = [
  './preflight.mjs',
  './cleanup.mjs',
  './environment.mjs',
  './config-validation.mjs',
  './api-validation.mjs',
  './docker.mjs',
  './stabilize.mjs',
  './smoke.mjs'
];

export async function registerBuiltinPhases(registry) {
  for (const modulePath of BUILTIN_PHASES) {
    const module = await import(modulePath);
    const definition = module.default ?? module.phase ?? module;
    registry.register(definition);
  }
}
