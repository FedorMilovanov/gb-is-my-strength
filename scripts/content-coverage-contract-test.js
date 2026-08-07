#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, 'content-coverage-audit.js');
const authorityPath = path.join(__dirname, 'lib', 'legacy-source-authority.js');
const {
  coverageHealth,
  frequencyDeficit,
  pageText,
  words,
} = require(auditPath);
const {
  classifyLegacyAuthority,
} = require(authorityPath);

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`OK ${name}`);
}

check('frequency deficit counts repeated occurrence loss', () => {
  const result = frequencyDeficit(new Map([['слово', 3]]), new Map([['слово', 1]]));
  assert.equal(result.total, 3);
  assert.equal(result.missing, 2);
  assert.deepEqual(result.missingWords, ['слово(-2)']);
});

check('frequency deficit counts fully absent words', () => {
  const result = frequencyDeficit(new Map([['альфа', 2], ['бета', 1]]), new Map([['альфа', 2]]));
  assert.equal(result.total, 3);
  assert.equal(result.missing, 1);
  assert.deepEqual(result.missingWords, ['бета(-1)']);
});

check('extra dist occurrences never create negative loss', () => {
  const result = frequencyDeficit(new Map([['слово', 1]]), new Map([['слово', 4]]));
  assert.equal(result.total, 1);
  assert.equal(result.missing, 0);
});

check('health rejects expected-but-zero exercise', () => {
  assert.deepEqual(coverageHealth({ expected: 1, exercised: 0 }), [
    'expected 1 authoritative comparison(s) but exercised 0',
  ]);
});

check('health accepts an intentional empty authoritative set', () => {
  assert.deepEqual(coverageHealth({ expected: 0, exercised: 0 }), []);
});

check('health rejects impossible exercised greater than expected', () => {
  assert.deepEqual(coverageHealth({ expected: 1, exercised: 2 }), [
    'exercised 2 exceeds expected 1',
  ]);
});

check('authority classifier keeps conservative unprofiled legacy', () => {
  assert.equal(classifyLegacyAuthority(null).kind, 'authoritative');
});

check('authority classifier distinguishes explicit reference-only from undeclared', () => {
  assert.equal(classifyLegacyAuthority({ legacyStatus: 'reference-only' }).kind, 'non-authoritative');
  assert.equal(classifyLegacyAuthority({}).kind, 'undeclared');
});

check('page text excludes script/style markup before counting', () => {
  const text = pageText('<p>Слово слово</p><script>Скрытое слово</script><style>.слово{}</style>');
  const multiset = words(text);
  assert.equal(multiset.get('слово'), 2);
  assert.equal(multiset.has('скрытое'), false);
});

check('generic coverage audit has no route-specific legacy thresholds/allowlists', () => {
  const src = fs.readFileSync(auditPath, 'utf8');
  assert.equal(src.includes('const THRESHOLD'), false);
  assert.equal(src.includes('const ALLOW'), false);
  assert.equal(src.includes('? true : true'), false);
});

console.log(`\nContent coverage contract: ${checks}/${checks} checks passed`);
