'use strict';

const assert = require('node:assert/strict');

// A contiguous run of Unicode letters/combining marks is one word.
// Punctuation, hyphens and digits separate approved compound forms such as
// PDF-архив and 3D-карта. Stress marks do not hide a change of script.
function mixedScriptTokens(text) {
  const clean = String(text || '').replace(/(?:https?:\/\/|mailto:)[^\s"'<>]+/giu, ' ');
  return [...new Set((clean.match(/[\p{L}\p{M}]+/gu) || []).filter(token =>
    /\p{Script=Cyrillic}/u.test(token) && /\p{Script=Latin}/u.test(token)))];
}

// Actual built HTML only. Do not reclassify frozen source references as live.
// Inspect text and reader-visible/a11y attributes, not href/src or JS payloads.
const PROTECTED = new Set(['script', 'style', 'code', 'pre', 'kbd', 'samp', 'template']);
const READABLE_ATTRS = new Set(['alt', 'aria-label', 'aria-description', 'title', 'placeholder']);
const META_TEXT = /^(?:description|og:(?:title|description|image:alt)|twitter:(?:title|description|image:alt))$/i;

function mixedScriptHtml(html) {
  const { parse } = require('parse5');
  const results = new Map();
  function add(text, surface) {
    for (const token of mixedScriptTokens(text)) {
      results.set(surface + '\0' + token, { surface, token });
    }
  }
  function visit(node) {
    if (PROTECTED.has(node.tagName)) return;
    if (node.nodeName === '#text') add(node.value, 'text');
    for (const attr of node.attrs || []) {
      if (READABLE_ATTRS.has(attr.name)) add(attr.value, attr.name);
    }
    if (node.tagName === 'meta') {
      const key = node.attrs.find(a => a.name === 'name' || a.name === 'property')?.value || '';
      const content = node.attrs.find(a => a.name === 'content')?.value;
      if (META_TEXT.test(key)) add(content, 'meta:' + key);
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(String(html || '')));
  return [...results.values()];
}

function assertMixedScriptContract({ html = false } = {}) {
  const bad = ['Чекy', 'hе', 'academическую', 'хюперентюнхáней', 'тe\u0301ст'];
  for (const token of bad) assert.deepEqual(mixedScriptTokens(token), [token]);
  const good = ['Чеку', 'he', 'академическую', 'хюперентюнха\u0301ней',
    'PDF-архив, 3D-карта, John Gill, ὑπερεντυγχάνει, שָׁמִיר',
    'https://example.test/Чекy'];
  for (const text of good) assert.deepEqual(mixedScriptTokens(text), []);
  if (!html) return;
  const fixture = '<!doctype html><meta name="description" content="Чекy"><script>const s="Чекy"</script>' +
    '<p>h&#1077;</p><svg><text>Чекy</text></svg><img alt="Чекy" src="/Чекy.png">' +
    '<button aria-label="hе">PDF-архив</button><code>Чекy</code>' +
    '<a href="/Чекy">Чеку</a><p>хюперентюнха́ней</p>';
  assert.deepEqual(mixedScriptHtml(fixture), [
    { surface: 'meta:description', token: 'Чекy' },
    { surface: 'text', token: 'hе' },
    { surface: 'text', token: 'Чекy' },
    { surface: 'alt', token: 'Чекy' },
    { surface: 'aria-label', token: 'hе' },
  ]);
  assert.deepEqual(mixedScriptHtml('<p>Чеку; he; PDF-архив</p><img src="/Чекy.png"><code>Чекy</code>'), []);
}

module.exports = { mixedScriptTokens, mixedScriptHtml, assertMixedScriptContract };
