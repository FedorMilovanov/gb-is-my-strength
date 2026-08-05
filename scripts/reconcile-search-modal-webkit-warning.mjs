#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(ROOT, 'scripts/search-modal-browser-contract.mjs');

function replaceOnce(text, before, after, label) {
  const first = text.indexOf(before);
  assert.notEqual(first, -1, `missing exact anchor: ${label}`);
  assert.equal(text.indexOf(before, first + before.length), -1, `non-unique exact anchor: ${label}`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

let text = fs.readFileSync(target, 'utf8');

text = replaceOnce(
  text,
  `  const consoleErrors = [];
  const pageErrors = [];`,
  `  const consoleErrors = [];
  const engineWarnings = [];
  const pageErrors = [];`,
  'engine warning ledger',
);

text = replaceOnce(
  text,
  `  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });`,
  `  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const expectedWebKitViewportWarning =
      text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
    if (browserName === 'webkit' && expectedWebKitViewportWarning) {
      engineWarnings.push(text);
      return;
    }
    consoleErrors.push(text);
  });`,
  'exact WebKit engine warning classification',
);

text = replaceOnce(
  text,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer };`,
  `    return { browser: browserName, viewport, aria, focusableCount, geometry, layer, engineWarnings };`,
  'engine warning evidence return',
);

assert.match(text, /expectedWebKitViewportWarning/, 'exact WebKit warning classifier missing');
assert.match(text, /engineWarnings\.push\(text\)/, 'engine warning ledger mutation missing');
assert.match(text, /consoleErrors\.push\(text\)/, 'unexpected console error barrier missing');
assert.match(text, /assert\.deepEqual\(consoleErrors, \[\], `\$\{browserName\} console errors`\)/, 'strict unexpected console error assertion missing');
assert.match(text, /layer, engineWarnings \}/, 'engine warning evidence missing from report');

fs.writeFileSync(target, text);
console.log('Exact WebKit viewport warning classified without weakening application-error barriers');
