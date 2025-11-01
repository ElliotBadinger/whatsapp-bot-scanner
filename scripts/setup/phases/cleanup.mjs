import { execa } from 'execa';

import { ROOT_DIR } from '../config.mjs';
import { runWithSpinner } from '../utils/runtime.mjs';
import { Confirm } from '../utils/prompts.mjs';

async function cleanUpStack({ context, runtime, output }) {
  if (context.flags.reset) {
    output.heading('Reset Requested');
    output.warn('Reset will delete Postgres data and the WhatsApp session volume.');
    if (!context.flags.noninteractive) {
      const confirm = await new Confirm({
        name: 'confirmReset',
        message: 'Proceed with destructive reset (DB + WhatsApp session will be deleted)?',
        initial: false
      }).run();
      if (!confirm) {
        context.flags.reset = false;
        output.warn('Reset aborted by user.');
        return;
      }
    }
    await runWithSpinner(context, 'docker compose down -v --remove-orphans', () =>
      execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'down', '-v', '--remove-orphans'], { cwd: ROOT_DIR })
    );
    return;
  }
  if (context.flags.clean) {
    output.heading('Stopping existing stack');
    await runWithSpinner(context, 'docker compose down', () =>
      execa(runtime.dockerComposeCommand[0], [...runtime.dockerComposeCommand.slice(1), 'down'], { cwd: ROOT_DIR })
    );
  }
}

export default {
  id: 'cleanup',
  title: 'Clean up previous runs',
  prerequisites: ['preflight'],
  copy: {
    guided: {
      description: 'Optionally stop or reset the Docker stack before provisioning new resources.'
    },
    expert: {
      description: 'Tear down existing containers or volumes if requested via flags.'
    }
  },
  steps: [async (api) => cleanUpStack(api)]
};
