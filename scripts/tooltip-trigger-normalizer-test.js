#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { normalizeSource, visibleTrigger } = require('./tooltip-trigger-normalizer.js');

function normalize(html) {
  return normalizeSource(html).output;
}

assert.equal(visibleTrigger('†'), '†');
assert.equal(visibleTrigger('<svg><path d="M0 0h1"/></svg>'), '');
assert.equal(visibleTrigger('&dagger;'), '†');

const numbered = '<p>Текст<span class="fn-marker" role="button">12<span class="tooltip">Источник</span></span></p>';
assert.equal(normalize(numbered), numbered, 'numbered markers must remain unchanged');

const numberedDove = '<span class="fn-marker fn-marker--dove">12<span class="tooltip">Источник</span></span>';
assert.equal(
  normalize(numberedDove),
  '<span class="fn-marker">12<span class="tooltip">Источник</span></span>',
  'numbered markers must not retain the dove class'
);

const dagger = '<p>Текст<span class="fn-marker" role="button" tabindex="0" aria-label="Источник">†<span class="tooltip">Пояснение</span></span></p>';
assert.equal(
  normalize(dagger),
  '<p>Текст<span class="fn-marker fn-marker--dove" role="button" tabindex="0" aria-label="Источник"><span class="tooltip">Пояснение</span></span></p>',
  'dagger markers must become empty dove triggers'
);

const svg = '<span class="fn-marker" aria-label="Пояснение"><svg viewBox="0 0 10 10"><path d="M5 0v10M0 5h10"/></svg><span class="tooltip">Текст</span></span>';
assert.equal(
  normalize(svg),
  '<span class="fn-marker fn-marker--dove" aria-label="Пояснение" role="button" tabindex="0"><span class="tooltip">Текст</span></span>',
  'cross-like SVG triggers must become dove triggers'
);

const star = '<span class="fn-marker">*<span class="tooltip">Переводческое пояснение</span></span>';
assert.equal(
  normalize(star),
  '<span class="fn-marker fn-marker--dove" role="button" tabindex="0" aria-label="Показать пояснение"><span class="tooltip">Переводческое пояснение</span></span>',
  'standalone translator notes must use the dove'
);

const alreadyDove = '<span class="fn-marker fn-marker--dove" role="button" tabindex="0"><span class="tooltip">Пояснение</span></span>';
assert.equal(normalize(alreadyDove), alreadyDove, 'canonical dove markers must be idempotent');

console.log('Tooltip trigger normalizer test: OK');
