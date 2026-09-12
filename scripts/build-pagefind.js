#!/usr/bin/env node
/* Build Pagefind index via npm exec -c to avoid npx argument parsing differences inside npm scripts. */
'use strict';
const path = require('path');
const { spawnNpm } = require('./lib/npm-spawn');

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? (process.argv[idx + 1] || fallback) : fallback;
}
const site = argValue('--site', '.');
const outputPath = argValue('--output-path', 'pagefind');
const version = argValue('--version', '1.5.2');
if (!/^[\w./-]+$/.test(site) || !/^[\w./-]+$/.test(outputPath) || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Unsafe --site, --output-path or --version value');
  process.exit(1);
}
const args = ['exec', '--yes', `--package=pagefind@${version}`, '-c', `pagefind --site ${site} --output-path ${outputPath}`];
const res = spawnNpm(args, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
process.exit(res.status);
