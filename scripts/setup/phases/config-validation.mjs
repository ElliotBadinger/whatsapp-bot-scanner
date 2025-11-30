import { execa } from "execa";

import { ROOT_DIR } from "../config.mjs";
import { runWithSpinner } from "../utils/runtime.mjs";

async function runConfigValidation({ context, output }) {
  output.heading("Validating configuration");
  await runWithSpinner(context, "node scripts/validate-config.js", () =>
    execa("node", ["scripts/validate-config.js"], {
      cwd: ROOT_DIR,
      stdio: "inherit",
    }),
  );
  output.success("Configuration validation passed.");
}

export default {
  id: "config-validation",
  title: "Validate configuration",
  prerequisites: ["environment"],
  copy: {
    guided: {
      description:
        "Ensure configuration files align with expected schema before launching services.",
    },
    expert: {
      description:
        "Runs scripts/validate-config.js to confirm workspace integrity.",
    },
  },
  steps: [async (api) => runConfigValidation(api)],
};
