#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const core = require('./search-manifest-policy-normalizer-core');

function helperArgs(argv) {
  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') args.push(arg);
    else if (arg === '--dist') {
      if (index + 1 >= argv.length) throw new Error('--dist requires a value');
      args.push(arg, argv[++index]);
    } else if (arg.startsWith('--dist=')) args.push(arg);
  }
  return args;
}

function run(command, args) {
  const result = spawnSync(process.execPath, [command, ...args], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    run(path.join(__dirname, 'series-landing-discovery-seed.mjs'), helperArgs(argv));
    run(path.join(__dirname, 'search-manifest-policy-normalizer-core.js'), argv);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

module.exports = core;
