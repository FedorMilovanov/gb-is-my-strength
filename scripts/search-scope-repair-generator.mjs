#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.cwd());
const baseSha = String(process.env.BASE_SHA || '').trim();
assert.match(baseSha, /^[0-9a-f]{40}$/i, 'BASE_SHA must be the exact PR base SHA');

const source = execFileSync('git', ['show', `${baseSha}:js/search.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });

const oldMarkup = '<div class="cp-scope-chips" role="tablist"><button class="cp-scope-chip active" data-scope="all" role="tab" aria-selected="true"><span class="cp-scope-icon">\'+v+\'</span><span>Все</span></button><button class="cp-scope-chip" data-scope="articles" role="tab" aria-selected="false"><span class="cp-scope-icon">\'+u+\'</span><span>Статьи</span></button><button class="cp-scope-chip" data-scope="scripture" role="tab" aria-selected="false"><span class="cp-scope-icon">\'+f+\'</span><span>Ссылки</span></button><button class="cp-scope-chip" data-scope="authors" role="tab" aria-selected="false"><span class="cp-scope-icon">\'+w+\'</span><span>Авторы</span></button>';
const newMarkup = '<div class="cp-scope-chips" role="group" aria-label="Область поиска"><button type="button" class="cp-scope-chip active" data-scope="all" aria-pressed="true"><span class="cp-scope-icon">\'+v+\'</span><span>Все</span></button><button type="button" class="cp-scope-chip" data-scope="articles" aria-pressed="false"><span class="cp-scope-icon">\'+u+\'</span><span>Статьи</span></button><button type="button" class="cp-scope-chip" data-scope="scripture" aria-pressed="false"><span class="cp-scope-icon">\'+f+\'</span><span>Ссылки</span></button><button type="button" class="cp-scope-chip" data-scope="authors" aria-pressed="false"><span class="cp-scope-icon">\'+w+\'</span><span>Авторы</span></button>';

const stateOld = 'e.setAttribute("aria-selected",t?"true":"false")';
const stateNew = 'e.setAttribute("aria-pressed",t?"true":"false")';

assert.equal(source.split(oldMarkup).length - 1, 1, 'expected exactly one legacy scope markup owner');
assert.equal(source.split(stateOld).length - 1, 2, 'expected exactly two legacy scope-state assignments');

let repaired = source.replace(oldMarkup, newMarkup);
repaired = repaired.split(stateOld).join(stateNew);

assert.ok(!repaired.includes('cp-scope-chips" role="tablist'), 'legacy tablist semantics remain');
assert.ok(!repaired.includes('data-scope="all" role="tab"'), 'legacy tab role remains');
assert.ok(repaired.includes('cp-scope-chips" role="group" aria-label="Область поиска"'), 'truthful group semantics missing');
assert.equal((repaired.match(/aria-pressed=/g) || []).length, 4, 'expected four initial aria-pressed states');
assert.equal(repaired.split(stateNew).length - 1, 2, 'expected exactly two aria-pressed state synchronizers');

const reportDir = path.join(ROOT, 'reports', 'search-scope-repair');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'search.js'), repaired, 'utf8');
fs.writeFileSync(path.join(reportDir, 'summary.json'), `${JSON.stringify({
  schemaVersion: 1,
  baseSha,
  sourceBytes: Buffer.byteLength(source),
  repairedBytes: Buffer.byteLength(repaired),
  replacements: { markup: 1, stateAssignments: 2 },
}, null, 2)}\n`);

console.log('SEARCH SCOPE REPAIR GENERATOR: PASS (1 markup + 2 state assignments)');
