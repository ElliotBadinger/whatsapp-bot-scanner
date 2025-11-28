const phases = [];

export function registerPhase(phase) {
  if (!phase?.id || typeof phase.run !== "function") {
    throw new Error("Invalid phase registration.");
  }
  phases.push({ ...phase });
}

export function listPhases() {
  return [...phases];
}

export function clearPhases() {
  phases.length = 0;
}

export async function runPhases(
  context,
  { startAt, stopAfter, mode = "full" } = {},
) {
  let started = !startAt;
  for (const phase of phases) {
    if (!started) {
      if (phase.id === startAt) {
        started = true;
      } else {
        continue;
      }
    }
    context.trackPhase(phase);
    const start = Date.now();
    await phase.run(context);
    const took = Date.now() - start;
    context.log("phaseResult", { id: phase.id, durationMs: took, mode });
    context.markCheckpoint(phase.id, "completed");
    if (stopAfter && phase.id === stopAfter) {
      break;
    }
  }
}
