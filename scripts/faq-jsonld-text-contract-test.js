#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/enhancements.js', 'utf8');
const firstOuter = source.indexOf('!function(){');
const faqStart = source.indexOf('!function(){', firstOuter + 1);
const nextModule = source.indexOf('}(),function(){var e=document.createElement("link")', faqStart);
assert(faqStart >= 0 && nextModule > faqStart, 'FAQ JSON-LD module boundary must remain discoverable');
const faqSource = source.slice(faqStart, nextModule + 3);

assert(!faqSource.includes('n.innerHTML'), 'FAQ answer serialization must never read innerHTML');
assert(!faqSource.includes('document.createElement("div")'), 'FAQ answer serialization must not create an HTML sanitizer container');
assert(!faqSource.includes('querySelectorAll("script, style, iframe'), 'FAQ answer serialization must not maintain a tag blacklist');

function runFaqModule(moduleSource) {
  const appended = [];
  const questionClone = {
    textContent: '  Можно   ли доверять? ',
    querySelector(selector) {
      assert.equal(selector, '.faq-accordion__icon');
      return null;
    },
  };
  const question = {
    cloneNode(deep) {
      assert.equal(deep, true);
      return questionClone;
    },
  };
  const answer = {
    textContent: '  Видимый   ответ  с безопасной ссылкой.  ',
    get innerHTML() {
      throw new Error('innerHTML MUST NOT be read by FAQ JSON-LD serialization');
    },
  };
  const item = {
    querySelector(selector) {
      if (selector === '.faq-accordion__q') return question;
      if (selector === '.faq-accordion__body-inner') return answer;
      return null;
    },
  };
  const accordion = {
    querySelectorAll(selector) {
      assert.equal(selector, '.faq-accordion__item');
      return [item];
    },
  };
  const document = {
    querySelectorAll(selector) {
      if (selector === 'script[type="application/ld+json"]') return [];
      if (selector === '.faq-accordion') return [accordion];
      return [];
    },
    createElement(tag) {
      assert.equal(tag, 'script', `unexpected HTML parser/sanitizer element: ${tag}`);
      return { type: '', textContent: '' };
    },
    head: {
      appendChild(node) { appended.push(node); },
    },
  };

  vm.runInNewContext(moduleSource, { document, JSON, Array }, { filename: 'enhancements-faq-jsonld.js' });
  assert.equal(appended.length, 1, 'FAQ JSON-LD script must be generated exactly once');
  const payload = JSON.parse(appended[0].textContent);
  assert.equal(payload['@type'], 'FAQPage');
  assert.equal(payload.mainEntity.length, 1);
  assert.equal(payload.mainEntity[0].name, 'Можно ли доверять?');
  assert.equal(payload.mainEntity[0].acceptedAnswer.text, 'Видимый ответ с безопасной ссылкой.');
  assert(!/[<>]/.test(payload.mainEntity[0].acceptedAnswer.text), 'Answer.text must remain plain text');
  return payload;
}

runFaqModule(faqSource);

// This mutation is the permanent witness for the incident: text-only schema
// serialization must fail if a future change reads HTML again.
const mutated = faqSource.replace('(n.textContent||"")', '(n.innerHTML||"")');
assert.notEqual(mutated, faqSource, 'mutation must actually replace the answer text owner');
assert.throws(
  () => runFaqModule(mutated),
  /innerHTML MUST NOT be read/,
  'contract must kill a regression back to innerHTML',
);

console.log('✅ FAQ JSON-LD contract: plain text owner + innerHTML mutation killed');
