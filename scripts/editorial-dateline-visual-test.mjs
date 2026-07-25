#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE = process.env.DATELINE_BASE_URL || 'http://127.0.0.1:4173';
const OUT = path.resolve('reports/editorial-dateline');
const routes = [
  ['gill-part-1', '/articles/dzhon-gill-chast-1-chelovek/'],
  ['gill-part-2', '/articles/dzhon-gill-chast-2-uchenyi/'],
  ['gill-part-3', '/articles/dzhon-gill-chast-3-nasledie/'],
];
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const [slug, route] of routes) {
    for (const mode of [
      { name: 'desktop', viewport: { width: 1440, height: 1000 } },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ]) {
      const context = await browser.newContext({ viewport: mode.viewport, isMobile: !!mode.isMobile, hasTouch: !!mode.hasTouch, locale: 'ru-RU' });
      const page = await context.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 120000 });
      await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
      const markers = page.locator('.editorial-dateline');
      const count = await markers.count();
      assert.ok(count > 0, `${route}: no editorial datelines`);
      const audit = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.editorial-dateline')];
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          nodes: nodes.map((node) => {
            const style = getComputedStyle(node);
            return {
              tag: node.tagName,
              role: node.getAttribute('role'),
              float: style.cssFloat,
              radius: style.borderRadius,
              background: style.backgroundColor,
              display: style.display,
              fontSize: parseFloat(style.fontSize),
              width: node.getBoundingClientRect().width,
              viewport: window.innerWidth,
            };
          }),
        };
      });
      assert.ok(audit.overflow <= 1, `${route}/${mode.name}: horizontal overflow ${audit.overflow}px`);
      for (const node of audit.nodes) {
        assert.equal(node.tag, 'P');
        assert.notEqual(node.role, 'heading');
        assert.equal(node.float, 'none');
        assert.equal(node.radius, '0px');
        assert.ok(node.background === 'rgba(0, 0, 0, 0)' || node.background === 'transparent', `unexpected background ${node.background}`);
        assert.equal(node.display, 'flex');
        assert.ok(node.fontSize <= 15.1, `dateline looks too much like a heading: ${node.fontSize}px`);
        assert.ok(node.width <= node.viewport + 1, 'dateline overflows viewport');
      }
      await markers.first().screenshot({ path: path.join(OUT, `${slug}-${mode.name}-first.png`) });
      if (slug === 'gill-part-1' && mode.name === 'desktop') {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await markers.nth(Math.min(1, count - 1)).screenshot({ path: path.join(OUT, `${slug}-dark.png`) });
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      }
      if (mode.name === 'desktop') {
        await page.emulateMedia({ media: 'print' });
        const prep = await page.evaluate(() => window.GBPrintPagination?.prepare?.() || null);
        assert.ok(prep?.prepared, `${route}: semantic print preparation failed`);
        const printAudit = await page.evaluate(() => [...document.querySelectorAll('.editorial-dateline')].map((node) => ({
          keepNext: node.hasAttribute('data-print-keep-next'),
          flow: node.getAttribute('data-print-flow'),
        })));
        assert.ok(printAudit.every((item) => item.keepNext), `${route}: a dateline can orphan from following content`);
        await page.pdf({ path: path.join(OUT, `${slug}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.GBPrintPagination?.reset?.());
        const leftovers = await page.evaluate(() => document.querySelectorAll('[data-gb-print-generated],.gb-print-closing-group').length);
        assert.equal(leftovers, 0, `${route}: print DOM did not restore`);
      }
      report.push({ slug, mode: mode.name, count, audit });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(OUT, 'visual-report.json'), JSON.stringify(report, null, 2));
console.log(`✅ Editorial dateline visual contract passed (${report.length} viewport checks)`);
