'use strict';

const { spawnSync } = require('child_process');

function assertNumericStatus(result, label = 'npm') {
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    const error = new Error(`${label} launch failed${code}: ${result.error.message}`);
    error.code = result.error.code || 'CHILD_PROCESS_LAUNCH_FAILED';
    error.cause = result.error;
    throw error;
  }

  if (!Number.isInteger(result.status)) {
    const signal = result.signal || 'none';
    const error = new Error(
      `${label} exited without numeric status (status=${String(result.status)}, signal=${signal})`,
    );
    error.code = 'CHILD_PROCESS_NO_STATUS';
    throw error;
  }

  return result;
}

function quoteWindowsNpmArg(value) {
  const arg = String(value);
  if (/["&|<>^%!\r\n]/.test(arg)) {
    const error = new Error(`unsafe Windows npm argument: ${JSON.stringify(arg)}`);
    error.code = 'UNSAFE_WINDOWS_NPM_ARGUMENT';
    throw error;
  }
  return `"${arg}"`;
}

function spawnNpm(args, options = {}) {
  if (!Array.isArray(args)) throw new TypeError('spawnNpm args must be an array');
  if (Object.hasOwn(options, 'shell')) throw new TypeError('spawnNpm owns the shell option');

  if (process.platform === 'win32') {
    const commandLine = ['npm.cmd', ...args.map(quoteWindowsNpmArg)].join(' ');
    return assertNumericStatus(spawnSync(commandLine, { ...options, shell: true }), 'npm');
  }

  return assertNumericStatus(spawnSync('npm', args, options), 'npm');
}

module.exports = { spawnNpm, assertNumericStatus, quoteWindowsNpmArg };
