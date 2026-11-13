#!/usr/bin/env node
/**
 * Wave 33 Contract:
 * 1. Canonical Russian Bible book alias coverage (`Прит.`, `Матф.`, `Отк.`, `Езд.`, `Числ.`, etc.)
 * 2. Fail-closed material typography gate (`SYS-MATERIAL-TYPOGRAPHY-GATE-FAILOPEN`)
 * 3. Remaining Heart & Gill S4 verbatim Synodal quote & inner-quote parity in `dist/`
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadBibleRegistry, parseBibleReference } from '../src/lib/bible-reference-core.mjs';

const require = createRequire(import.meta.url);
const {
  collectImmutableHtmlPaths,
  runCli: runTypografCli,
  scanHtmlTypography,
} = require('./typograf.js');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

// 1. Canonical Bible aliases resolve; apocrypha stays non-canonical
const registry = loadBibleRegistry();
const expectedAliases = [
  ['Прит. 4:23', 'pritchi'],
  ['Матф. 23:4', 'matfeya'],
  ['Отк. 2:23', 'otkrovenie'],
  ['Езд. 7:10', 'ezdra'],
  ['Числ. 20:10', 'chisla'],
  ['Иеремии 31:33', 'ieremiya'],
  ['Лука 18:13', 'luki'],
  ['Михея 1:9', 'mihey'],
  ['Аввакума 3:19', 'avvakum'],
];
for (const [ref, bookId] of expectedAliases) {
  const parsed = parseBibleReference(ref, registry);
  assert.equal(parsed?.ok, true, `Expected ${ref} to parse cleanly`);
  assert.equal(parsed.bookId, bookId, `Expected ${ref} -> ${bookId}`);
}
assert.equal(parseBibleReference('1 Енох 1:9', registry)?.ok, false, 'Apocryphal 1 Enoch must remain non-canonical');

// 2. Fail-closed typography gate (`SYS-MATERIAL-TYPOGRAPHY-GATE-FAILOPEN`)
assert.equal(
  scanHtmlTypography('<!doctype html><html lang="ru"><body><p>Он сказал: "Привет, мир"</p></body></html>').length,
  1,
  'Cyrillic straight quotes must be flagged'
);
assert.equal(
  scanHtmlTypography('<!doctype html><html lang="ru"><body><p>Слово - дело</p></body></html>').length,
  1,
  'Cyrillic spaced ASCII hyphen must be flagged'
);
assert.equal(
  scanHtmlTypography('<!doctype html><html lang="ru"><body><p><em lang="en">He said "hello" - world</em> <code>"код"</code></p></body></html>').length,
  0,
  'Foreign lang="en" and <code> blocks must not false-positive'
);

const immutable = collectImmutableHtmlPaths(ROOT);
assert.ok(
  immutable.size >= 53 && immutable.has(path.resolve(ROOT, 'articles', 'kod-da-vinchi', 'index.html')),
  'Reference-only legacy HTML must be protected from typograf mutation'
);
assert.equal(runTypografCli(['--dry-run'], ROOT), 0, 'Clean active + dist HTML corpus must exit 0');

// 3. Built dist/ verification for Wave 33 S4 & inner-quote repairs
assert.ok(fs.existsSync(DIST), 'dist/ must exist');
const stripTags = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');

const checks = [
  ['/articles/serdce-pod-skorbyu/', 'быть подобными образу Сына Своего', 'быть подобными образу Сына Его'],
  ['/articles/starye-dorozhki-serdca/', 'трости надломленной не переломит', 'трости надломленной Он не переломит'],
  ['/articles/serdce-ne-v-odinochku/', 'чтобы кто из вас не ожесточился, обольстившись грехом', 'день... чтобы кто не ожесточился'],
  ['/articles/religioznoe-serdce/', '«Боже! будь милостив ко мне грешнику!»', '«Боже! будь милостив ко мне, грешнику».'],
  ['/articles/novoe-serdce/', '«Итак, обрежьте крайнюю плоть сердца вашего', '«итак обрежьте крайнюю плоть сердца вашего'],
  ['/articles/serdce-i-telo/', 'и в душах ваших, которые суть Божии', null],
  ['/articles/dzhon-gill-chast-2-uchenyi/', '„Я могу позволить себе быть бедным', '"Я могу позволить себе быть бедным'],
  ['/articles/dzhon-gill-chast-4-ekzeget/', 'под „всеми людьми“ понимать', 'под "всеми людьми" понимать'],
  ['/articles/serdce-hrista-k-nemoshchnym/', 'мы были Его „врагами“', 'мы были Его "врагами"'],
];

for (const [route, mustContain, mustNotContain] of checks) {
  const fp = path.join(DIST, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  const plain = stripTags(fs.readFileSync(fp, 'utf8'));
  assert.ok(plain.includes(mustContain), `${route}: missing "${mustContain}"`);
  if (mustNotContain) {
    assert.ok(!plain.includes(mustNotContain), `${route}: still contains "${mustNotContain}"`);
  }
}

console.log(`✅ Wave 33 Bible aliases, fail-closed typograf gate & S4 quote contract passed (${expectedAliases.length} aliases + ${checks.length} routes)`);
