import { execa } from 'execa';
import { EnvironmentDetector } from './environment.mjs';
import { UserInterface } from '../ui/prompts.mjs';
import { DependencyError, GlobalErrorHandler, ERROR_SEVERITY } from './errors.mjs';

export class DependencyManager {
  constructor(envDetector, ui) {
    this.envDetector = envDetector;
    this.ui = ui;
  }

  async ensureNodeJS() {
    const currentVersion = await this.getNodeVersion();
    if (currentVersion && this.isVersionSufficient(currentVersion)) {
      this.ui.success('Node.js version sufficient');
      return;
    }

    this.ui.progress('Installing Node.js...');

    if (await this.envDetector.isContainer()) {
      await this.installNodeViaNodeSource();
    } else {
      await this.installNodeViaFnm();
    }

    this.ui.success(`Node.js installed: ${await this.getNodeVersion()}`);
  }

  async installNodeViaFnm() {
    try {
      // Install fnm if not present
      await execa('curl', ['-fsSL', 'https://fnm.vercel.app/install', '|', 'bash', '-s', '--', '--skip-shell'], {
        shell: true
      });

      // Install Node.js 20 using fnm
      await execa('fnm', ['install', '20'], { stdio: 'inherit' });
      await execa('fnm', ['use', '20'], { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to install Node.js via fnm: ${error.message}`);
    }
  }

  async installNodeViaNodeSource() {
    try {
      // Install Node.js in container environment
      await execa('apt-get', ['update'], { stdio: 'inherit' });
      await execa('apt-get', ['install', '-y', 'curl', 'ca-certificates'], { stdio: 'inherit' });

      // Add NodeSource repository
      await execa('curl', ['-fsSL', 'https://deb.nodesource.com/setup_20.x', '|', 'bash', '-'], {
        shell: true,
        stdio: 'inherit'
      });

      // Install Node.js
      await execa('apt-get', ['install', '-y', 'nodejs'], { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to install Node.js via NodeSource: ${error.message}`);
    }
  }

  async getNodeVersion() {
    try {
      const result = await execa('node', ['--version']);
      return result.stdout.trim().replace('v', '');
    } catch {
      return null;
    }
  }

  isVersionSufficient(version) {
    if (!version || typeof version !== 'string') {
      return false;
    }
    const [major, minor] = version.split('.').map(Number);
    // Allow Node.js 20.x and any newer major versions (22.x, 24.x, etc.)
    return major >= 20;
  }

  async ensureDocker() {
    try {
      await execa('docker', ['--version'], { stdio: 'ignore' });
      await execa('docker', ['compose', 'version'], { stdio: 'ignore' });
      this.ui.success('Docker and Docker Compose detected');
    } catch (error) {
      throw new Error('Docker or Docker Compose not found. Please install Docker and Docker Compose v2.');
    }
  }

  async verifyDependencies() {
    const dependencies = [
      { name: 'Node.js', check: () => this.getNodeVersion() !== null },
      { name: 'Docker', check: async () => {
        try {
          await execa('docker', ['--version'], { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }},
      { name: 'Docker Compose', check: async () => {
        try {
          await execa('docker', ['compose', 'version'], { stdio: 'ignore' });
          return true;
        } catch {
          return false;
        }
      }}
    ];

    const missing = [];
    for (const dep of dependencies) {
      if (!await dep.check()) {
        missing.push(dep.name);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing dependencies: ${missing.join(', ')}`);
    }

    return true;
  }
}