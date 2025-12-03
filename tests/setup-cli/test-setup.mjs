import { vi } from 'vitest';
import { execa } from 'execa';

// Global test setup
export function setup() {
  // Mock console methods to reduce test output noise
  global.console.log = vi.fn();
  global.console.error = vi.fn();
  global.console.warn = vi.fn();
  global.console.info = vi.fn();

  // Mock process.exit to prevent test termination
  const originalExit = process.exit;
  process.exit = vi.fn((code) => {
    throw new Error(`Process exit called with code ${code}`);
  });

  // Mock execa for command execution
  const originalExeca = execa;
  execa.execa = vi.fn().mockImplementation((cmd) => {
    if (typeof cmd === 'string') {
      if (cmd.includes('docker')) {
        return Promise.resolve({ stdout: 'Docker version 20.10.7' });
      }
      if (cmd.includes('node')) {
        return Promise.resolve({ stdout: 'v20.0.0' });
      }
    }
    return Promise.reject(new Error('Command not found'));
  });

  // Store original methods for restoration
  global.__originalConsole__ = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  };

  global.__originalProcess__ = {
    exit: originalExit
  };

  global.__originalExeca__ = {
    execa: originalExeca
  };
}

export function teardown() {
  // Restore original console methods
  if (global.__originalConsole__) {
    console.log = global.__originalConsole__.log;
    console.error = global.__originalConsole__.error;
    console.warn = global.__originalConsole__.warn;
    console.info = global.__originalConsole__.info;
  }

  // Restore original process methods
  if (global.__originalProcess__) {
    process.exit = global.__originalProcess__.exit;
  }

  // Restore original execa
  if (global.__originalExeca__) {
    execa.execa = global.__originalExeca__.execa;
  }

  // Clean up global references
  delete global.__originalConsole__;
  delete global.__originalProcess__;
  delete global.__originalExeca__;
}