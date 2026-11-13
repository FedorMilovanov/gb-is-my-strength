import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const article = readFileSync(new URL('../src/content/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas.mdx', import.meta.url), 'utf8');

test('Solomon section uses Russian Synodal numbering for Kings', () => {
  const section = article.match(/<h2 id="solomon">[\s\S]*?(?=<h2 id="demas">)/)?.[0];
  assert.ok(section, 'Solomon section must exist before the Demas section');
  assert.equal((section.match(/3 Цар\. 11\b/g) ?? []).length, 2);
  assert.doesNotMatch(section, /\b1 Цар\. 11\b/);
});

test('Saul references retain their distinct book numbering', () => {
  const section = article.match(/<h2 id="saul">[\s\S]*?(?=<h2 id="jeroboam">)/)?.[0];
  assert.ok(section, 'Saul section must exist before the Jeroboam section');
  assert.match(section, /1 Цар\. 13\b/);
  assert.match(section, /1 Цар\. 15\b/);
});
