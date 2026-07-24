#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCREENSHOT_PATH = path.join(ROOT, 'scripts', 'visual-parity-screenshots.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'visual-parity.yml');

function validate(source) {
  const problems = [];
  const warm = source.indexOf('Warm up long pages twice');
  const settle = source.indexOf('await settleHomeRevealState(page, route);');
  const freeze = source.indexOf('// Freeze only after observers');
  const validateCapture = source.indexOf('await validateHomeCaptureState(page, route);');
  const screenshot = source.indexOf('await page.screenshot({ path: outFile');

  if (warm === -1) problems.push('warm-scroll marker missing');
  if (settle === -1) problems.push('home reveal settle call missing');
  if (freeze === -1) problems.push('post-settle animation freeze marker missing');
  if (validateCapture === -1) problems.push('post-freeze home capture validation missing');
  if (screenshot === -1) problems.push('screenshot call missing');
  if (![warm, settle, freeze, validateCapture, screenshot].some((index) => index === -1)
      && !(warm < settle && settle < freeze && freeze < validateCapture && validateCapture < screenshot)) {
    problems.push('required order is warm-scroll → settle → freeze → validate → screenshot');
  }

  for (const marker of [
    "document.querySelectorAll('.h-reveal')",
    "element.setAttribute('data-visual-parity-settled', '1')",
    'home reveal content hidden before animation freeze',
    '[data-visual-parity-settled="1"]',
    'home capture state lost after animation freeze',
    'home body text unexpectedly short before capture',
    'home horizontal overflow before capture',
  ]) {
    if (!source.includes(marker)) problems.push(`missing fail-closed marker: ${marker}`);
  }

  const earlyFreeze = source.indexOf('*, *::before, *::after { animation: none !important;');
  if (earlyFreeze !== -1 && settle !== -1 && earlyFreeze < settle) {
    problems.push('animation freeze still runs before the home reveal state is proven');
  }

  return problems;
}

const source = fs.readFileSync(SCREENSHOT_PATH, 'utf8');
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

assert.deepEqual(validate(source), [], 'current screenshot pipeline must settle only proven-visible home reveal sections');
assert.match(workflow, /node scripts\/visual-parity-screenshot-settle-contract-test\.js/, 'Visual Parity workflow must run the settle-order contract');

const mutations = [
  source.replace('await settleHomeRevealState(page, route);', '// mutation: settle removed'),
  source.replace('// Freeze only after observers', '// mutation: marker removed'),
  source.replace('await validateHomeCaptureState(page, route);', '// mutation: validation removed'),
  source.replace("element.setAttribute('data-visual-parity-settled', '1')", '// mutation: marker assignment removed'),
  source.replace('home reveal content hidden before animation freeze', 'home reveal warning only'),
];

mutations.forEach((mutation, index) => {
  assert.ok(validate(mutation).length > 0, `mutation ${index + 1} must be rejected`);
});

console.log('Visual parity screenshot settle contract: PASS (order, fail-closed state, 5 mutations).');
