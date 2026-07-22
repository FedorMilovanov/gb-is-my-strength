#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(DIST, rel);
      if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function visible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

(async () => {
  assert(fs.existsSync(path.join(DIST, 'nagornaya/chast-1/index.html')), 'run production-like build first');
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (let part = 1; part <= 5; part += 1) {
        await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-${part}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#bottomBar .nag-bar-controls', { state: 'attached' });
        await page.waitForTimeout(350);
        const state = await page.evaluate((isVisibleSource) => {
          const isVisible = eval(`(${isVisibleSource})`);
          const bar = document.getElementById('bottomBar');
          const cluster = document.querySelectorAll('#bottomBar .nag-bar-controls');
          const visibleEmbers = [...document.querySelectorAll('.gb-ember')].filter(isVisible).length;
          const visibleSaves = [...document.querySelectorAll('.gb-save')].filter(isVisible).length;
          return {
            barVisible: isVisible(bar),
            clusterCount: cluster.length,
            clusterEmberCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-ember').length,
            clusterSaveCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-save').length,
            clusterThemeCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-sidebar-theme-btn').length,
            clusterFontCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-fontsize-btns').length,
            visibleEmbers,
            visibleSaves,
          };
        }, visible.toString());
        assert(state.barVisible, `part ${part} @ ${width}: bottom bar hidden`);
        assert.strictEqual(state.clusterCount, 1, `part ${part} @ ${width}: duplicate/missing bar cluster`);
        assert.strictEqual(state.clusterEmberCount, 1, `part ${part} @ ${width}: bar Play count`);
        assert.strictEqual(state.clusterSaveCount, 1, `part ${part} @ ${width}: bar Save count`);
        assert.strictEqual(state.clusterThemeCount, 0, `part ${part} @ ${width}: cloned theme must be removed`);
        assert.strictEqual(state.clusterFontCount, 0, `part ${part} @ ${width}: cloned font controls must be removed`);
        assert.strictEqual(state.visibleEmbers, 1, `part ${part} @ ${width}: competing visible Play controls`);
        assert.strictEqual(state.visibleSaves, 1, `part ${part} @ ${width}: competing visible Save controls`);
      }
    }

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-1/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    const desktop = await page.evaluate(() => {
      const bar = document.getElementById('bottomBar');
      const style = bar ? getComputedStyle(bar) : null;
      return {
        displayed: !!bar && style.display !== 'none',
        inlineDisplay: bar ? bar.style.getPropertyValue('display') : null,
      };
    });
    assert.strictEqual(desktop.displayed, false, 'desktop: bottom bar must remain hidden');
    assert.strictEqual(desktop.inlineDisplay, '', 'desktop: mobile inline display override must be removed');
    assert.deepStrictEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);
    console.log('✅ Nagornaya bar browser matrix: parts 1–5 @ 360/390 and desktop 1024');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
