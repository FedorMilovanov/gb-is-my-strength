#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { chromium, firefox, webkit } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = [
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Статья для теста · Господь Бог — Сила Моя</title>',
  '<style>body{margin:0;background:#faf6ef;color:#332a25;font:18px/1.7 Georgia,serif}',
  'main{max-width:640px;margin:60px auto;padding:20px}article p{max-width:100%}',
  '.hmbar{position:fixed;bottom:0;left:0;right:0;background:#24171b;color:#e9cfbd;display:flex;align-items:center;justify-content:end;gap:5px;height:52px;padding:0 12px}',
  '.hmbar button{width:36px;height:36px;color:inherit;background:none;border:0}',
  '#selection-share-popup{position:fixed;top:15px;left:12px;background:#342229;color:white;display:flex;z-index:900;padding:5px;border-radius:9px}',
  '</style></head><body>',
  '<main><article data-pagefind-body><h1>Статья для теста</h1><p id="demo">Размышление о богословском тексте и изучении Писания.</p>',
  '<p id="more">Достаточно длинный фрагмент для проверки сохранения выделенного текста.</p></article></main>',
  '<div id="selection-share-popup" role="toolbar" aria-hidden="false"></div>',
  '<div class="hmbar"><button class="gb-save" data-fc-action="save" aria-label="Сохранить статью" type="button">☆</button>',
  '<button id="hmShareBtn" type="button">↗</button></div>',
  '<script>window.SITE_CONFIG={version:"reader-library-test",site:{id:"gb"},page:{title:"Статья для теста"}};</script>',
  '<script src="/src/runtime/favorite-store.js"></script>',
  '<script src="/js/highlights.js"></script>',
  '</body></html>',
].join('');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/js/highlights.js' || url.pathname === '/css/highlights-runtime.css' ||
      url.pathname === '/src/runtime/favorite-store.js' || url.pathname === '/js/reader-library-presenter.js') {
    const file = path.join(root, url.pathname.replace(/^\//, ''));
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.end(fs.readFileSync(file));
  } else {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  }
});
const longQuote = 'Длинная выдержка из первой статьи для исследования, '.repeat(16);
const storedQuote = { id: 'old-quote', text: longQuote, url: '/articles/first/#:~:text=example', articleTitle: 'Первый материал', savedAt: 1700000000000 };
const storedNote = { id: 'old-note', text: 'Личная заметка к первой статье', articleTitle: 'Первый материал', url: '/articles/first/', savedAt: 1700000000010 };
function initStorage() {
  localStorage.setItem('gb-highlights-v1', JSON.stringify([storedQuote]));
  localStorage.setItem('gb-reader-notes-v1', JSON.stringify([storedNote]));
  localStorage.setItem('gb-favorites', JSON.stringify([{ path: '/articles/another', title: 'Второй материал', addedAt: 1700000000020 }]));
}

async function check(browserName, driver, url, width) {
  const browser = await driver.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width, height: 720 }, acceptDownloads: true });
  await context.addInitScript(({ quote, note }) => {
    localStorage.setItem('gb-highlights-v1', JSON.stringify([quote]));
    localStorage.setItem('gb-reader-notes-v1', JSON.stringify([note]));
    localStorage.setItem('gb-favorites', JSON.stringify([{ path: '/articles/another', title: 'Второй материал', addedAt: 1700000000020 }]));
  }, { quote: storedQuote, note: storedNote });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#gb-hl-fab').waitFor();
  assert.equal(await page.locator('#gb-hl-fab.gb-hl-fab--docked').count(), 1, 'bottom bar hosts shared library');
  assert.equal(await page.locator('.gb-save').count(), 1, 'original SaveButton must remain intact');
  assert.equal(await page.locator('#gb-hl-fab').isVisible(), true, 'library remains visible with existing data');

  await page.locator('#gb-hl-fab').click();
  await page.locator('.gb-hl-item').first().waitFor();
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'), 'false');
  assert.equal(await page.locator('#gb-hl-item').count(), 0, 'no competing legacy item container');
  assert.equal(await page.locator('.gb-hl-item').count(), 3, 'legacy quotes, notes and favorites are united');
  assert.equal(await page.locator('#gb-hl-count').textContent(), '· 3');
  const overflow = await page.evaluate(() => ({ sheet: document.querySelector('#gb-hl-panel').scrollWidth, viewport: innerWidth }));
  assert(overflow.sheet <= overflow.viewport, 'library must fit narrow viewport');
  const longBody = page.locator('.gb-hl-item[data-type="quote"] .gb-hl-quote').first();
  assert(await longBody.evaluate((el) => el.classList.contains('is-collapsed')), 'long quote is collapsed');
  const expand = page.locator('.gb-hl-item[data-type="quote"] .gb-hl-expand').first();
  await expand.click();
  assert.equal(await expand.getAttribute('aria-expanded'), 'true');
  await expand.click();
  assert.equal(await expand.getAttribute('aria-expanded'), 'false');

  await page.locator('[data-library-tab="note"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('[data-library-action="edit-note"]').click();
  assert.equal(await page.locator('#gb-hl-editor').isVisible(), true);
  await page.locator('#gb-hl-note-text').fill('Личная заметка изменена');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  assert((await page.locator('.gb-hl-note').textContent()).includes('изменена'));

  await page.locator('#gb-hl-new-note').click();
  await page.locator('#gb-hl-note-text').fill('Вторая заметка текущей статьи');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  assert.equal(await page.locator('.gb-hl-item[data-type="note"]').count(), 2);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1')).length), 2);

  await page.locator('[data-library-tab="favorite"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('#gb-hl-close').click();
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('inert'), '');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'gb-hl-fab', 'focus returns to opener');

  const result = await page.evaluate(() => window.GBFavoriteStore.add({ path: '/articles/third', title: 'Третий материал' }));
  assert.equal(result.saved, true);
  await page.locator('#gb-hl-fab').click();
  await page.locator('.gb-hl-item').first().waitFor();
  await page.locator('[data-library-tab="favorite"]').click();
  assert.equal(await page.locator('.gb-hl-item').count(), 2, 'favorite store additions are live');
  await page.locator('[data-library-tab="all"]').click();
  await page.locator('#gb-hl-search').fill('Третий');
  assert.equal(await page.locator('.gb-hl-item').count(), 1);
  await page.locator('#gb-hl-search').fill('');
  await page.locator('#gb-hl-source').selectOption('Первый материал');
  assert.equal(await page.locator('.gb-hl-item').count(), 2, 'source filter selects quote and note');
  await page.locator('#gb-hl-source').selectOption('all');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#gb-hl-export').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'gb-moya-biblioteka.md');
  await page.locator('#gb-hl-close').click();
  await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('more'));
    const selection = getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await page.locator('#ss-save').click();
  const length = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1')).length);
  assert.equal(length, 2, 'selection saved under existing quote key');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('gb-highlights-v1'))[0].url.includes('#more:~:text=')), true,
    'saved quote source points to native text fragment at its section anchor');
  await page.locator('#ss-note').click();
  assert.equal(await page.locator('#gb-hl-editor').isVisible(), true);
  await page.locator('#gb-hl-note-text').fill('Заметка к новой цитате');
  await page.locator('#gb-hl-editor button[type="submit"]').click();
  const linked = await page.evaluate(() => JSON.parse(localStorage.getItem('gb-reader-notes-v1')).some((x) => x.quoteText && x.quoteText.includes('Достаточно')));
  assert.equal(linked, true, 'notes can attach to selected quotes');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#gb-hl-backdrop').getAttribute('aria-hidden'), 'true');
  assert.deepEqual(errors, [], 'no client-side JS errors');
  console.log('PASS', browserName, width, 'legacy quote/favorite data, notes, expand, search, export, selection, accessibility');
  await browser.close();
}

(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = 'http://127.0.0.1:' + server.address().port + '/articles/sample/';
  try {
    for (const [name, browser] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
      for (const width of [320, 390]) await check(name, browser, url, width);
    }
    console.log('✅ Reader Library browser integration: 6 end-to-end passes');
  } finally { server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
