#!/usr/bin/env node
// Exact candidate witness: one real public article owns the Grok pilot, no
// other reader route gets the pilot. The DOM (not a stray CSS selector) is the
// authority for a build-time rollout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const candidates = [
  ['/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', true],
  ['/articles/dzhon-gill-chast-1-chelovek/', false],
  ['/articles/dzhon-gill-chast-2-uchenyi/', false],
  ['/baptisty-rossii/sovetskaya-noch/', false],
  ['/articles/kod-da-vinchi/', false],
];
for (const [route, shouldShow] of candidates) {
  const file = path.join(dist, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  assert.ok(fs.existsSync(file), 'built Product route missing: ' + route);
  const html = fs.readFileSync(file, 'utf8');
  const isPilot = /<aside\b[^>]*class="[^"]*\bhrail--grok\b/.test(html);
  assert.equal(isPilot, shouldShow, 'incorrect route pilot state: ' + route);
  if (shouldShow) {
    assert.match(html, /class="hrail-toc grok-toc"/, 'true canonical Grok TOC missing');
    assert.match(html, /data-grok-heading/, 'canonical heading nodes missing');
    assert.match(html, /data-grok-toggle/, 'disclosure controls missing');
    const links = (html.match(/data-grok-key=/g) || []).length;
    assert.ok(links >= 10, 'incomplete canonical deep-link hierarchy: ' + links);
  }
}
console.log('GROK ROUTE-SCOPED RELEASE CANDIDATE: PASS (' +
  candidates.length + ' real routes; 1 enabled, 4 unchanged; 10+ heading nodes).');
