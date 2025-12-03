import { execa } from 'execa';
import fs from 'node:fs/promises';
import os from 'node:os';

export class EnvironmentDetector {
  async detect() {
    return {
      isCodespaces: this.detectCodespaces(),
      isContainer: await this.detectContainer(),
      packageManager: await this.detectPackageManager(),
      initSystem: await this.detectInitSystem(),
      platform: this.getPlatformInfo()
    };
  }

  detectCodespaces() {
    return !!(process.env.CODESPACES ||
              process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN);
  }

  async detectContainer() {
    // Check for container indicators
    try {
      await fs.access('/.dockerenv');
      return true;
    } catch {
      // Fallback to cgroup check
      try {
        const { stdout } = await execa('grep', ['-q', 'docker', '/proc/1/cgroup']);
        return stdout.includes('docker');
      } catch {
        return false;
      }
    }
  }

  async detectPackageManager() {
    try {
      await execa('yarn', ['--version'], { stdio: 'ignore' });
      return 'yarn';
    } catch {
      try {
        await execa('pnpm', ['--version'], { stdio: 'ignore' });
        return 'pnpm';
      } catch {
        try {
          await execa('npm', ['--version'], { stdio: 'ignore' });
          return 'npm';
        } catch {
          return 'unknown';
        }
      }
    }
  }

  async detectInitSystem() {
    if (process.platform === 'win32') {
      return 'windows';
    }

    try {
      await execa('systemctl', ['--version'], { stdio: 'ignore' });
      return 'systemd';
    } catch {
      try {
        await execa('service', ['--version'], { stdio: 'ignore' });
        return 'sysvinit';
      } catch {
        return 'unknown';
      }
    }
  }

  getPlatformInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length
    };
  }
}