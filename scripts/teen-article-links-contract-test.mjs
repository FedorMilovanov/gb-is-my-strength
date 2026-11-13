#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkTeenArticleLinks } from './lib/teen-article-links.mjs';

function fixture(t) {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'teen-article-links-'));
  t.after(() => fs.rmSync(dist, { recursive: true, force: true }));
  function write(route, html) {
    const file = path.join(dist, route.replace(/^\/+/, ''), 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
  return { dist, write };
}

const site = 'https://gospod-bog.ru';
const routes = ['/articles/a/'];

test('checks local reader links, including relative URLs, Unicode fragments and image links', (t) => {
  const { dist, write } = fixture(t);
  write('/articles/a/', `<a href="/missing-rail/">outside prose</a>
    <main id="article-content">
      <a href="#local">local</a><div id="local"></div>
      <a href="../b/?view=1#%D1%82%D0%B5%D0%BC%D0%B0">relative</a>
      <a href="https://gospod-bog.ru/articles/b/#legacy"><img alt="B"></a>
      <a href="/articles/b/#top">top</a><a href="/articles/b/#:~:text=visible">text directive</a>
      <a href="https://elsewhere.invalid/missing">external</a><a href="mailto:a@example.invalid">email</a>
    </main>`);
  write('/articles/b/', '<h2 id="тема">Тема</h2><a name="legacy"></a>');
  assert.deepEqual(checkTeenArticleLinks({ dist, routes, site }), { checked: 5, errors: [] });
});

test('fails closed on broken targets, fragments, encoding and missing article root', (t) => {
  const { dist, write } = fixture(t);
  write('/articles/a/', `<main id="article-content">
    <a href="/articles/no-page/">missing target</a>
    <a href="/articles/b/#absent">missing fragment</a>
    <a href="/articles/b/#%FF">invalid encoding</a>
  </main>`);
  write('/articles/b/', '<h2 id="present">Тема</h2>');
  const result = checkTeenArticleLinks({ dist, routes, site });
  assert.equal(result.checked, 3);
  assert.equal(result.errors.length, 3);
  assert.match(result.errors[0], /target missing/);
  assert.match(result.errors[1], /fragment missing/);
  assert.match(result.errors[2], /invalid link encoding/);
  write('/articles/a/', '<main id="other"></main>');
  assert.match(checkTeenArticleLinks({ dist, routes, site }).errors[0], /#article-content missing/);
  assert.match(checkTeenArticleLinks({ dist, routes: ['/articles/not-built/'], site }).errors[0], /article HTML missing/);
});
