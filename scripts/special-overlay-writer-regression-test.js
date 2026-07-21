#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const child = require('node:child_process');

const tracked = child.execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const extensions = new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.astro','.html']);
const excluded = ['scripts/','docs/','.github/','reports/','archive/','projects/','node_modules/','dist/'];
const canonical = new Set(['js/site-utils.js']);
const direct = /document\.(?:body|documentElement)\.style\.(?:overflow|position|top|left|right|width|overscrollBehavior)\s*=/g;
const alias = /(?<![\w.])(?:body|html)\.style\.(?:overflow|position|top|left|right|width|overscrollBehavior)\s*=/g;
const hits = [];

for (const file of tracked) {
  if (!extensions.has(path.extname(file).toLowerCase())) continue;
  if (canonical.has(file) || excluded.some(prefix => file.startsWith(prefix))) continue;
  let source;
  try { source = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const pattern of [direct, alias]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      hits.push(`${file}:${source.slice(0, match.index).split('\n').length}:${match[0]}`);
    }
  }
}

assert.deepEqual(hits, [], `direct production lock writers remain:\n${hits.join('\n')}`);
const site = fs.readFileSync('js/site.js','utf8');
const built = fs.readFileSync('konfessii/russkij-baptizm/_app/index.html','utf8');
assert.ok(site.includes('site-image-viewer'));
assert.ok(site.includes('home-mobile-menu'));
assert.ok(built.includes('special:konfessii-mindmap-launcher'));
assert.ok(built.includes('../../../js/site-utils.js'));
console.log('✅ special-overlay-writer-regression-test: zero non-canonical production writers');
