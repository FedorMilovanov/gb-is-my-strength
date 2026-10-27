#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ownerPath = path.resolve(process.cwd(), 'src/components/reader-platform/ReaderPreferencesHead.astro');
const source = fs.readFileSync(ownerPath, 'utf8');

assert.match(
  source,
  /const state = \{ phase: 'idle', promise: null, pendingOpen: false, opener: null \};/,
  'shared search owner must expose one explicit lazy-load state',
);
assert.match(
  source,
  /if \(state\.phase === 'loading' && state\.promise\) return state\.promise;/,
  'shared search owner must deduplicate an in-flight bootstrap',
);
assert.match(
  source,
  /state\.phase = 'loading';[\s\S]*?window\.__gbSearchBootRequested = true;/,
  'shared owner must enter loading and set the boot latch before script acquisition',
);

const failStart = source.indexOf('const fail = (error) => {');
const loadStart = source.indexOf('script.onload = () => {', failStart);
const errorStart = source.indexOf('script.onerror = () => fail(new Error(', failStart);
const appendStart = source.indexOf('document.head.appendChild(script);', failStart);
assert.ok(failStart >= 0 && loadStart > failStart && errorStart > loadStart && appendStart > errorStart,
  'shared owner must install load/error terminal handlers before appending its script');

const failureBody = source.slice(failStart, loadStart);
for (const [pattern, message] of [
  [/script\.remove\(\);/, 'failed script node must be removed before retry'],
  [/state\.phase = 'failed';/, 'failed load must reach a terminal failed phase'],
  [/state\.promise = null;/, 'failed load must release the shared promise'],
  [/state\.pendingOpen = false;/, 'failed load must clear pending open state'],
  [/state\.opener = null;/, 'failed load must release its opener'],
  [/window\.__gbSearchBootRequested = false;/, 'failed load must release the retry latch'],
]) assert.match(failureBody, pattern, message);

const loadBody = source.slice(loadStart, errorStart);
assert.match(loadBody, /if \(!runtimeReady\(\)\) return fail\(/,
  'script load without a ready runtime must use the same failure cleanup');
assert.match(loadBody, /state\.phase = 'ready';[\s\S]*?state\.promise = null;[\s\S]*?resolve\(true\);/,
  'successful acquisition must settle ready state and release the shared promise');
assert.match(source.slice(errorStart, appendStart), /script\.onerror = \(\) => fail\(new Error\(/,
  'network error must use the shared failure cleanup');

console.log('Shared search bootstrap retry source contract: PASS');
