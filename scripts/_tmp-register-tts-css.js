#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const auditPath = path.join(root, 'scripts/audit-pro.js');
let source = fs.readFileSync(auditPath, 'utf8');

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Missing audit-pro anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Non-unique audit-pro anchor: ${label}`);
  }
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
  "  'css/reader-preferences.css'\n]);",
  "  'css/reader-preferences.css',\n  'css/tts-download-notice.css'\n]);",
  'ALLOWED_CSS registration'
);
replaceOnce(
  "  if (!extraCss.length && !missingCss.length) R.ok('Structure: exactly 7 CSS files in /css');",
  "  if (!extraCss.length && !missingCss.length) R.ok(`Structure: exactly ${ALLOWED_CSS.size} CSS files in /css`);",
  'CSS structure summary'
);
replaceOnce(
  "  if (!extraJs.length && !missingJs.length) R.ok('Structure: exactly 11 JS files in /js');",
  "  if (!extraJs.length && !missingJs.length) R.ok(`Structure: exactly ${ALLOWED_JS.size} JS files in /js`);",
  'JS structure summary'
);

fs.writeFileSync(auditPath, source, 'utf8');
fs.unlinkSync(__filename);
console.log('Registered TTS notice stylesheet in audit-pro and made structure counts registry-derived.');
