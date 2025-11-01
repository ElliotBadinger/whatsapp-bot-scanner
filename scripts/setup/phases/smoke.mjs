import { execa } from 'execa';

import { TROUBLESHOOTING_LINES, ROOT_DIR } from '../config.mjs';
import { fetchWithTimeout } from '../utils/network.mjs';
import { redact } from '../utils/runtime.mjs';
import { Confirm } from '../utils/prompts.mjs';
import { commandExists } from '../utils/system.mjs';

async function smokeTest({ context, runtime, output }) {
  if (context.flags.dryRun) return;
  output.heading('Smoke Test');
  const token = runtime.envFile.get('CONTROL_PLANE_API_TOKEN');
  if (!token) {
    output.warn('Control plane token missing; cannot run authenticated smoke test.');
    return;
  }
  const reversePort = runtime.envFile.get('REVERSE_PROXY_PORT') || '8088';
  try {
    const res = await fetchWithTimeout(`http://localhost:${reversePort}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      output.success('Control-plane status endpoint reachable.');
    } else {
      output.warn(`Control-plane status check returned HTTP ${res.status}.`);
    }
  } catch {
    output.warn('Control-plane status check failed; verify docker compose logs.');
  }
}

async function offerPairingWatcher({ context, runtime, output }) {
  if (context.flags.noninteractive || context.flags.dryRun) return;
  if ((runtime.envFile.get('WA_AUTH_STRATEGY') || 'remote').toLowerCase() !== 'remote') return;
  if ((runtime.envFile.get('WA_REMOTE_AUTH_AUTO_PAIR') || '').toLowerCase() !== 'true') {
    output.info('Need audio cues later? Run npm run watch:pairing-code for audible alerts.');
    return;
  }
  if (!(await commandExists('node'))) {
    output.warn('Node.js not detected; cannot launch pairing watcher automatically.');
    return;
  }
  const startWatcher = await new Confirm({
    name: 'watcher',
    message: 'Start the pairing code watcher (plays audio when code arrives)?',
    initial: true
  }).run();
  if (!startWatcher) {
    output.note('You can run npm run watch:pairing-code later.');
    return;
  }
  await execa('npm', ['run', 'watch:pairing-code'], { cwd: ROOT_DIR, stdio: 'inherit' });
}

export default {
  id: 'smoke',
  title: 'Smoke test and observability',
  prerequisites: ['stabilize'],
  copy: {
    guided: {
      description: 'Run the smoke test and highlight observability endpoints for post-setup review.'
    },
    expert: {
      description: 'Pings status endpoints and surfaces any pending integrations or disabled features.'
    }
  },
  async run({ context, runtime, output }) {
    await smokeTest({ context, runtime, output });
    output.heading('Observability & Access');
    const reversePort = runtime.envFile.get('REVERSE_PROXY_PORT') || '8088';
    output.info(`Reverse proxy: http://localhost:${reversePort}`);
    output.info(`Control plane UI: http://localhost:${reversePort}/`);
    output.info('Grafana: http://localhost:3002 (admin / admin)');
    output.info('Prometheus: inside docker network at prometheus:9090');
    const token = runtime.envFile.get('CONTROL_PLANE_API_TOKEN');
    if (token) {
      output.info(`Control plane token (redacted): ${redact(token)}`);
    }
    output.warn('Harden services (TLS + IP restrictions) before exposing beyond localhost.');
    if (runtime.missingKeys.length > 0) {
      output.heading('Pending API Keys');
      for (const item of runtime.missingKeys) {
        output.warn(item);
      }
    }
    if (runtime.disabledFeatures.length > 0) {
      output.heading('Disabled Integrations');
      for (const item of runtime.disabledFeatures) {
        output.warn(item);
      }
    }
    output.heading('Troubleshooting Tips');
    for (const line of TROUBLESHOOTING_LINES) {
      output.info(line);
    }
    await offerPairingWatcher({ context, runtime, output });
  }
};
