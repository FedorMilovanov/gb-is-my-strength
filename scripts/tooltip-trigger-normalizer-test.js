#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { normalizeSource, visibleTrigger } = require('./tooltip-trigger-normalizer.js');

function normalize(html) {
  return normalizeSource(html).output;
}

function markerPrefix(html) {
  const match = html.match(/<span\b[^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'][^>]*>([\s\S]*?)<span\b[^>]*\bclass=["'][^"']*\btooltip\b/i);
  return match ? match[1] : null;
}

assert.equal(visibleTrigger('†'), '†');
assert.equal(visibleTrigger('<svg><path d="M0 0h1"/></svg>'), '');
assert.equal(visibleTrigger('&dagger;'), '†');

const numbered = '<p>Текст<span class="fn-marker" role="button">12<span class="tooltip">Источник</span></span></p>';
const numberedOut = normalize(numbered);
assert.equal(numberedOut, numbered, 'numbered markers must remain unchanged');
assert.doesNotMatch(numberedOut, /fn-marker--dove/);
assert.equal(visibleTrigger(markerPrefix(numberedOut)), '12');

const numberedDove = '<span class="fn-marker fn-marker--dove">12<span class="tooltip">Источник</span></span>';
const numberedDoveOut = normalize(numberedDove);
assert.doesNotMatch(numberedDoveOut, /fn-marker--dove/, 'numbered markers must not retain the dove class');
assert.equal(visibleTrigger(markerPrefix(numberedDoveOut)), '12');

const dagger = '<p>Текст<span class="fn-marker" role="button" tabindex="0" aria-label="Источник">†<span class="tooltip">Пояснение</span></span></p>';
const daggerOut = normalize(dagger);
assert.match(daggerOut, /class="fn-marker fn-marker--dove"/, 'dagger marker must gain the dove class');
assert.equal(visibleTrigger(markerPrefix(daggerOut)), '', 'dagger glyph must be removed');
assert.doesNotMatch(markerPrefix(daggerOut), /†|‡/);

const svg = '<span class="fn-marker" aria-label="Пояснение"><svg viewBox="0 0 10 10"><path d="M5 0v10M0 5h10"/></svg><span class="tooltip">Текст</span></span>';
const svgOut = normalize(svg);
assert.match(svgOut, /class="fn-marker fn-marker--dove"/, 'cross-like SVG trigger must gain the dove class');
assert.equal(visibleTrigger(markerPrefix(svgOut)), '');
assert.doesNotMatch(markerPrefix(svgOut), /<svg\b/i, 'old SVG trigger must be removed');
assert.match(svgOut, /role="button"/);
assert.match(svgOut, /tabindex="0"/);

const star = '<span class="fn-marker">*<span class="tooltip">Переводческое пояснение</span></span>';
const starOut = normalize(star);
assert.match(starOut, /class="fn-marker fn-marker--dove"/);
assert.equal(visibleTrigger(markerPrefix(starOut)), '');
assert.match(starOut, /aria-label="Показать пояснение"/);

const incompleteDove = '<span class="fn-marker fn-marker--dove" role="button" tabindex="0"><span class="tooltip">Пояснение</span></span>';
const canonicalDove = normalize(incompleteDove);
assert.match(canonicalDove, /aria-label="Показать пояснение"/, 'existing doves must receive an accessible name');
assert.equal(normalize(canonicalDove), canonicalDove, 'canonical dove markers must be idempotent after accessibility normalization');

require('./tooltip-style-normalizer-test.js');
console.log('Tooltip trigger normalizer test: OK');
