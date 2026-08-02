#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(ROOT, 'data', 'visual-parity-baseline.json');
const ROUTE = '/pastor-series/';
const REVIEWED_SOURCE_SHA = 'fcfd20c54d276b2f8ed848b942e4ff43d27d051b';
const POLICY = Object.freeze({
  mode: 'native-contract',
  reason: 'The strict-native pastor-series landing now publishes two current parts, current 102-minute series metadata and the Wave 12 authority; the root legacy landing remains historical evidence of the superseded one-part plan and is no longer the approved render owner.',
  requiredGuards: [
    'scripts/pastor-series-visual-parity-audit.js',
    'scripts/diotrophes-wave12-browser-contract.mjs',
    'scripts/public-surface-browser-matrix.mjs',
  ],
  reviewedAt: '2026-08-02',
  reviewedSourceSha: REVIEWED_SOURCE_SHA,
});

function parseArgs(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const check = argv.includes('--check') || !write;
  const unknown = argv.filter((arg) => arg !== '--write' && arg !== '--check');
  if (unknown.length) throw new Error(`unknown argument(s): ${unknown.join(', ')}`);
  if (write && argv.includes('--check')) throw new Error('use either --write or --check');
  return { write, check };
}

function stable(value) {
  return JSON.stringify(value);
}

function normalizeBaseline(baseline) {
  if (baseline?.tolerancePct !== 0.5) throw new Error('global visual tolerance drift');
  const output = JSON.parse(JSON.stringify(baseline));
  output.updatedAt = '2026-08-02';
  output.routeModes = output.routeModes || {};
  output.routeModes[ROUTE] = JSON.parse(JSON.stringify(POLICY));
  return output;
}

function validatePolicy(baseline) {
  if (baseline?.tolerancePct !== 0.5) throw new Error('global tolerance was changed');
  const policy = baseline?.routeModes?.[ROUTE];
  if (stable(policy) !== stable(POLICY)) throw new Error('pastor-series native visual policy drift');
  for (const guard of POLICY.requiredGuards) {
    const absolute = path.join(ROOT, guard);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`missing guard: ${guard}`);
  }
}

function main() {
  const options = parseArgs();
  const source = fs.readFileSync(BASELINE_FILE, 'utf8');
  const baseline = JSON.parse(source);
  const normalized = normalizeBaseline(baseline);
  validatePolicy(normalized);
  const output = `${JSON.stringify(normalized, null, 2)}\n`;

  if (options.write) {
    if (output === source) {
      console.log('Pastor-series native visual policy already normalized.');
      return;
    }
    fs.writeFileSync(BASELINE_FILE, output, 'utf8');
    console.log('Pastor-series native visual policy normalized.');
    return;
  }

  if (options.check && output !== source) {
    throw new Error('pastor-series native visual policy is not normalized; run with --write');
  }
  console.log('Pastor-series native visual policy validated.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}

module.exports = { parseArgs, normalizeBaseline, validatePolicy, POLICY, ROUTE };
