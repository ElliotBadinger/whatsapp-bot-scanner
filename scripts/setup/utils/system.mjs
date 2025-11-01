import { execa } from 'execa';

export async function commandExists(command) {
  try {
    await execa('command', ['-v', command], { shell: true, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
