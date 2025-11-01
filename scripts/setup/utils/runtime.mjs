import crypto from 'node:crypto';
import humanizeDuration from 'humanize-duration';
import ora from 'ora';

function humanize(milliseconds) {
  return humanizeDuration(Math.max(1, Math.round(milliseconds)), { largest: 2, round: true });
}

export async function runWithSpinner(context, label, task) {
  if (context.mode === 'expert') {
    context.log('task', { label });
    return task();
  }
  const spinner = ora({ text: label, color: 'cyan' }).start();
  const start = process.hrtime.bigint();
  try {
    const result = await task();
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    spinner.succeed(`${label} (${humanize(duration)})`);
    return result;
  } catch (error) {
    spinner.fail(`${label} failed`);
    throw error;
  }
}

export function formatCliError(error) {
  if (!error) return 'unknown error';
  if (error.shortMessage) return error.shortMessage;
  if (error.stderr) {
    const stderr = String(error.stderr).trim();
    if (stderr) {
      const lines = stderr.split('\n').filter(Boolean);
      return lines.at(-1);
    }
  }
  if (error.stdout) {
    const stdout = String(error.stdout).trim();
    if (stdout) {
      const lines = stdout.split('\n').filter(Boolean);
      return lines.at(-1);
    }
  }
  return error.message || String(error);
}

export function generateHexSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateBase64Secret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64');
}

export function cleanDigits(value) {
  return String(value || '')
    .replace(/\D+/g, '')
    .trim();
}

export function redact(value) {
  if (!value) return value;
  const str = String(value);
  if (str.length <= 4) return '*'.repeat(str.length);
  const visible = str.slice(-4);
  return `${'*'.repeat(str.length - 4)}${visible}`;
}
