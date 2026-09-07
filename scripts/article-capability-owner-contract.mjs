#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const count = (text, needle) => text.split(needle).length - 1;

const COMPOSER = 'src/runtime/article-interactions.js';
const READER = 'src/components/reader-platform/ReaderActionsRuntime.astro';
const SERIES_CHROME = 'src/components/article-pilots/gill-series/GillSeriesChrome.astro';
const ANTISOVETOV = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
const KRAJNE = 'src/components/article-pilots/krajne/KrajneBody.astro';

const families = [
  {
    id: 'strategic-map',
    module: 'src/runtime/article-strategic-map.js',
    importPath: './article-strategic-map.js',
    install: 'installArticleStrategicMap()',
    selector: ".map-trigger[data-tip]",
  },
  {
    id: 'faq-accordion',
    module: 'src/runtime/article-faq-accordion.js',
    importPath: './article-faq-accordion.js',
    install: 'installArticleFaqAccordions()',
    selector: '.faq-accordion__q',
  },
  {
    id: 'heading-anchors',
    module: 'src/runtime/article-heading-anchors.js',
    importPath: './article-heading-anchors.js',
    install: 'installArticleHeadingAnchors()',
    selector: 'h2[id], h3[id], h4[id]',
  },
  {
    id: 'reversible-cards',
    module: 'src/runtime/article-reversible-cards.js',
    importPath: './article-reversible-cards.js',
    install: 'installArticleReversibleCards()',
    selector: '.flip-card, .error-flip-card, .heart-flip-card',
  },
];

const composer = read(COMPOSER);
const reader = read(READER);
const seriesChrome = read(SERIES_CHROME);
const antisovetov = read(ANTISOVETOV);
const krajne = read(KRAJNE);

assert.match(composer, /const VERSION = 3;/, 'article interaction composer must advertise capability-complete version 3');
assert.equal(count(reader, "../../runtime/article-interactions.js"), 1, 'ReaderActionsRuntime must own exactly one article-interactions transport');
assert.equal(count(seriesChrome, 'ReaderActionsRuntime'), 1, 'Gill series chrome must mount exactly one ReaderActionsRuntime');
assert.equal(/enhancements\.js|site\.js/.test(seriesChrome), false, 'Gill series chrome must not restore legacy enhancements/site transport');
assert.equal(/enhancements\.js|site\.js/.test(composer), false, 'native article composer must not import legacy enhancements/site monoliths');

for (const family of families) {
  const source = read(family.module);
  assert.equal(count(composer, `from '${family.importPath}'`), 1, `${family.id}: exactly one native module import required`);
  assert.equal(count(composer, family.install), 1, `${family.id}: exactly one install call required`);
  assert.equal(count(source, "const OWNER = 'native-v1';"), 1, `${family.id}: one explicit native owner marker required`);
  assert.ok(source.includes(family.selector), `${family.id}: module must own its retained capability selector`);
}

assert.ok(antisovetov.includes('id="strategicMapData"'), 'Antisovetov strategic map data authority disappeared');
assert.ok(antisovetov.includes('map-trigger'), 'Antisovetov retained strategic-map triggers disappeared');
assert.ok(antisovetov.includes('faq-accordion__q'), 'Antisovetov retained FAQ capability disappeared');
assert.ok(krajne.includes('faq-accordion__q'), 'Krajne retained FAQ capability disappeared');
assert.ok(krajne.includes('heart-flip-card'), 'Krajne retained reversible-card capability disappeared');

const legacyEnhancements = read('js/enhancements.js');
const legacySite = read('js/site.js');
assert.ok(legacyEnhancements.includes('strategicMapData'), 'historical strategic-map comparison owner unexpectedly absent');
assert.ok(legacySite.includes('heading-anchor'), 'historical heading-anchor comparison owner unexpectedly absent');
assert.ok(legacySite.includes('flip-card'), 'historical reversible-card comparison owner unexpectedly absent');

console.log(`Article capability owner contract: PASS (${families.length} retained families, one native owner each)`);
