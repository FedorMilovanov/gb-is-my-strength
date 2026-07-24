#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testPath = path.join(root, 'scripts/tts-download-notice-browser-test.js');
let source = fs.readFileSync(testPath, 'utf8');

const viewportAnchor = '<meta charset="utf-8"><title>TTS notice fixture</title>';
const viewportReplacement = '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>TTS notice fixture</title>';
if (!source.includes(viewportReplacement)) {
  if (!source.includes(viewportAnchor)) throw new Error('TTS browser fixture head anchor is missing');
  source = source.replace(viewportAnchor, viewportReplacement);
}

const keyboardAnchor = `  await page.locator('.gb-tts-download-notice__action').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__modelFetchAborted === true);
  const active = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert.match(String(active), /gb-tts-download-notice__action/);
`;
const keyboardReplacement = `  await page.locator('.gb-tts-download-notice__action').focus();
  const focusedBefore = await page.evaluate(() => document.activeElement && document.activeElement.className);
  assert.match(String(focusedBefore), /gb-tts-download-notice__action/);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__modelFetchAborted === true);
  const hiddenFocusAfter = await page.evaluate(() => !!(document.activeElement && document.activeElement.hidden));
  assert.equal(hiddenFocusAfter, false, 'keyboard cancellation must not trap focus on a hidden control');
`;
if (!source.includes(keyboardReplacement)) {
  if (!source.includes(keyboardAnchor)) throw new Error('TTS mobile keyboard assertion anchor is missing');
  source = source.replace(keyboardAnchor, keyboardReplacement);
}

fs.writeFileSync(testPath, source, 'utf8');
fs.unlinkSync(__filename);
console.log('Applied mobile viewport and keyboard-focus contracts to TTS browser fixture.');
