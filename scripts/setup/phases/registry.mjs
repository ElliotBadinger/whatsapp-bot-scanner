const PHASE_NOT_FOUND = id => new Error(`Phase ${id} is not registered.`);

function createEditor(phase) {
  return {
    addStep(step) {
      if (typeof step !== 'function') {
        throw new Error('Phase step must be a function.');
      }
      phase.steps.push(step);
    },
    wrapRun(wrapper) {
      if (typeof wrapper !== 'function') {
        throw new Error('Phase run wrapper must be a function.');
      }
      const previous = phase.run.bind(phase);
      phase.run = async (api) => wrapper(api, previous);
    },
    setCopy(mode, copy) {
      if (!mode) {
        phase.copy.default = copy;
        return;
      }
      phase.copy[mode] = copy;
    },
    setVisibility(predicate) {
      phase.isVisible = predicate;
    },
    setTitle(title) {
      phase.title = title;
    }
  };
}

function normalizePhase(definition) {
  if (!definition?.id) {
    throw new Error('Phase requires an id.');
  }
  if (typeof definition.run !== 'function' && !Array.isArray(definition.steps)) {
    throw new Error(`Phase ${definition.id} must provide a run function or steps.`);
  }
  const steps = Array.isArray(definition.steps) ? [...definition.steps] : [];
  const phase = {
    id: definition.id,
    title: definition.title || definition.id,
    prerequisites: definition.prerequisites ? [...definition.prerequisites] : [],
    copy: { ...(definition.copy || {}) },
    isVisible: typeof definition.isVisible === 'function' ? definition.isVisible : () => true,
    steps,
    run: () => Promise.resolve()
  };
  if (typeof definition.run === 'function') {
    phase.run = definition.run;
  } else {
    phase.run = async (api) => {
      for (const step of phase.steps) {
        await step(api);
      }
    };
  }
  return phase;
}

export class PhaseRegistry {
  constructor() {
    this.order = [];
    this.phases = new Map();
    this.pendingExtensions = new Map();
  }

  register(definition) {
    const phase = normalizePhase(definition);
    if (this.phases.has(phase.id)) {
      throw new Error(`Phase ${phase.id} already registered.`);
    }
    this.order.push(phase.id);
    this.phases.set(phase.id, phase);
    if (this.pendingExtensions.has(phase.id)) {
      for (const extender of this.pendingExtensions.get(phase.id)) {
        extender(createEditor(phase));
      }
      this.pendingExtensions.delete(phase.id);
    }
    return phase;
  }

  extend(id, extender) {
    if (this.phases.has(id)) {
      extender(createEditor(this.phases.get(id)));
      return;
    }
    if (!this.pendingExtensions.has(id)) {
      this.pendingExtensions.set(id, []);
    }
    this.pendingExtensions.get(id).push(extender);
  }

  get(id) {
    const phase = this.phases.get(id);
    if (!phase) throw PHASE_NOT_FOUND(id);
    return phase;
  }

  list(context) {
    return this.order
      .map(id => this.phases.get(id))
      .filter(Boolean)
      .filter(phase => phase.isVisible?.(context) !== false);
  }
}

export function createPhaseRegistry() {
  return new PhaseRegistry();
}

export async function runPhases({
  registry,
  context,
  output,
  startAt,
  stopAfter,
  plugins = [],
  runtime = context.runtime
}) {
  const phases = registry.list(context);
  let started = !startAt;
  for (const phase of phases) {
    if (!started) {
      if (phase.id === startAt) {
        started = true;
      } else {
        continue;
      }
    }
    if (phase.prerequisites?.length) {
      const missing = phase.prerequisites.filter(req => !phases.some(p => p.id === req));
      if (missing.length > 0) {
        throw new Error(`Phase ${phase.id} has unknown prerequisites: ${missing.join(', ')}`);
      }
    }
    const copy = phase.copy?.[context.mode] || phase.copy?.default;
    const heading = copy?.title || phase.title;
    if (heading) {
      output.heading(heading);
    }
    if (copy?.description) {
      output.note(copy.description);
    }
    const api = { context, runtime, output, phase, registry };
    for (const plugin of plugins) {
      if (plugin?.enabled && typeof plugin?.hooks?.beforePhase === 'function') {
        await plugin.hooks.beforePhase({ ...api, plugin });
      }
    }
    context.trackPhase(phase);
    const startedAt = Date.now();
    await phase.run(api);
    for (const plugin of plugins) {
      if (plugin?.enabled && typeof plugin?.hooks?.afterPhase === 'function') {
        await plugin.hooks.afterPhase({ ...api, plugin });
      }
    }
    const took = Date.now() - startedAt;
    context.log('phaseResult', { id: phase.id, durationMs: took, mode: context.mode });
    context.markCheckpoint(phase.id, 'completed');
    if (stopAfter && phase.id === stopAfter) {
      break;
    }
  }
}
