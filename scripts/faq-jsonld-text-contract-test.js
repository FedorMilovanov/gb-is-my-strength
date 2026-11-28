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


// Static, route-scoped parity guard: the current FAQ has literal paragraphs,
// lists and inline emphasis. Unknown markup fails closed; this is not a generic
// HTML parser or a replacement for rendered browser parity checks.
function auditAntisovetovFaqParity(body, head) {
  function normalizeLiteral(html) {
    const text = html.replace(/&nbsp;/g, ' ')
      .replace(/<\/?(?:p|ul|li)>/g, ' ')
      .replace(/<\/?(?:strong|em)>/g, '');
    if (/[<>{}]|&(?:#\d+|#x[\da-f]+|[a-z][\w-]*);/i.test(text)) throw new Error('Unsupported FAQ markup; review the literal source projection');
    return text.replace(/\s+/g, ' ').trim();
  }
  const schema = [...head.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).flatMap(doc => doc['@graph'] || [doc])
    .filter(node => node['@type'] === 'FAQPage');
  if (schema.length !== 1 || !Array.isArray(schema[0].mainEntity)) throw new Error('Expected exactly one static FAQPage');
  const chunks = body.split('<div class="faq-accordion__item">').slice(1);
  if (!chunks.length || chunks.length !== schema[0].mainEntity.length) throw new Error('FAQ question count drift');
  return chunks.map((chunk, index) => {
    const q = chunk.match(/<span class="faq-accordion__q-text">([\s\S]*?)<\/span>/);
    const a = chunk.match(/<div class="faq-accordion__body-inner">([\s\S]*?)<\/div>/);
    if (!q || !a) throw new Error('FAQ source shape changed');
    const question = normalizeLiteral(q[1]), answer = normalizeLiteral(a[1]);
    const entity = schema[0].mainEntity[index];
    if (!question || !answer || entity['@type'] !== 'Question' || entity.acceptedAnswer?.['@type'] !== 'Answer') throw new Error('Invalid FAQ item');
    return { question, answer, schemaQuestion: entity.name, schemaAnswer: entity.acceptedAnswer.text, questionMatch: question === entity.name, answerMatch: answer === entity.acceptedAnswer.text };
  });
}
const antisovetovBody = fs.readFileSync('src/components/article-pilots/antisovetov/AntisovetovBody.astro', 'utf8');
const antisovetovHead = fs.readFileSync('src/components/article-pilots/antisovetov/AntisovetovPageHead.astro', 'utf8');
const antisovetovFaq = auditAntisovetovFaqParity(antisovetovBody, antisovetovHead);
assert(antisovetovFaq.every(item => item.questionMatch && item.answerMatch), 'Antisovetov static FAQ text must exactly match all visible questions and answers');
const firstFaq = antisovetovFaq[0];
const omitLastSentence = firstFaq.answer.replace(/ Чтобы не обмануться,[\s\S]*$/, '');
assert.notEqual(omitLastSentence, firstFaq.answer, 'omission mutation must change the answer');
const omittedHead = antisovetovHead.replace(JSON.stringify(firstFaq.answer), JSON.stringify(omitLastSentence));
assert.notEqual(omittedHead, antisovetovHead);
assert(!auditAntisovetovFaqParity(antisovetovBody, omittedHead)[0].answerMatch, 'omitted sentence must fail parity');
const punctuationHead = antisovetovHead.replace('паттерн.', 'паттерн .');
assert.notEqual(punctuationHead, antisovetovHead);
assert(!auditAntisovetovFaqParity(antisovetovBody, punctuationHead)[4].answerMatch, 'inline punctuation drift must fail parity');
const questionHead = antisovetovHead.replace(JSON.stringify(firstFaq.question), JSON.stringify(firstFaq.question + '!'));
assert.notEqual(questionHead, antisovetovHead);
assert(!auditAntisovetovFaqParity(antisovetovBody, questionHead)[0].questionMatch, 'question drift must fail parity');
const unknownMarkup = antisovetovBody.replace('<strong>измены природе этой власти</strong>', '<span>измены природе этой власти</span>');
assert.notEqual(unknownMarkup, antisovetovBody);
assert.throws(() => auditAntisovetovFaqParity(unknownMarkup, antisovetovHead), /Unsupported FAQ markup/);
console.log('Antisovetov static FAQ: ' + antisovetovFaq.length + ' exact question/answer pairs, 4 negative controls');
