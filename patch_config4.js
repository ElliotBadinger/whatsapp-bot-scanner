const fs = require('fs');
const file = 'packages/shared/src/config.ts';
let code = fs.readFileSync(file, 'utf8');

const targetFunction = `export function assertEssentialConfig(serviceName: string): void {
  const missing: string[] = [];

  if (!config.modes.mvp && !config.redisUrl?.trim()) missing.push("REDIS_URL");

  if (missing.length > 0) {
    logger.error(
      { service: serviceName, missing },
      "Missing required environment variables",
    );
    process.exit(1);
  }
}`;

const replacementFunction = `export function assertEssentialConfig(serviceName: string): void {
  const missing: string[] = [];

  if (!config.modes.mvp && !config.redisUrl?.trim()) missing.push("REDIS_URL");

  if (config.vt.enabled && !config.vt.apiKey) missing.push("VT_API_KEY");
  if (config.gsb.enabled && !config.gsb.apiKey) missing.push("GSB_API_KEY");
  if (config.whoisxml.enabled && !config.whoisxml.apiKey) missing.push("WHOISXML_API_KEY");

  if (missing.length > 0) {
    logger.error(
      { service: serviceName, missing },
      "Missing required environment variables",
    );
    process.exit(1);
  }
}`;

if (code.includes(targetFunction)) {
    code = code.replace(targetFunction, replacementFunction);
    fs.writeFileSync(file, code);
    console.log("Patched config.ts successfully!");
} else {
    console.log("Could not find the target function.");
}
