#!/usr/bin/env node
/* Build Pagefind index via npm exec -c to avoid npx argument parsing differences inside npm scripts. */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? (process.argv[idx + 1] || fallback) : fallback;
}
const site = argValue('--site', '.');
const outputPath = argValue('--output-path', 'pagefind');
const version = argValue('--version', '1.5.2');
if (!/^[\w./-]+$/.test(site) || !/^[\w./-]+$/.test(outputPath)) {
  console.error('Unsafe --site or --output-path value');
  process.exit(1);
}
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = ['exec', '--yes', `--package=pagefind@${version}`, '-c', `pagefind --site ${site} --output-path ${outputPath}`];
const res = spawnSync(npmCmd, args, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
process.exit(res.status || 0);
