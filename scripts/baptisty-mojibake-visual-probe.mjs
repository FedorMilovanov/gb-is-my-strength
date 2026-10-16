#!/usr/bin/env node
/**
 * baptisty-mojibake-visual-probe.mjs — что читатель реально видит испорченным.
 *
 * Маскированный текст серии «Баптисты России» измеряется не по исходникам, а по
 * отрендеренной странице: видимые текстовые узлы с масками (`?`-раны), подписи
 * к изображениям и служебные `alt`/`title`. Это доказательная база к храповику
 * `scripts/baptisty-mojibake-ratchet.mjs` и к отчёту о раунде.
 *
 * Окружение: `dist/` собран, Chromium доступен (CHROME_PATH/PW-мост — см.
 * audit/BAPTISTY-AND-SERIES-BROWSER-AUDIT-2026-10-13.md §1).
 *
 *   node scripts/baptisty-mojibake-visual-probe.mjs            # 9 страниц серии
 *   node scripts/baptisty-mojibake-visual-probe.mjs --json     # машиночитаемо
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const AS_JSON = process.argv.includes('--json');
const ROUTES = [
  '/baptisty-rossii/',
  '/baptisty-rossii/dva-sezda-1884/',
  '/baptisty-rossii/goneniya-i-sovest/',
  '/baptisty-rossii/iniciativnaya-gruppa/',
  '/baptisty-rossii/noch-na-kure/',
  '/baptisty-rossii/peterburgskaya-liniya/',
  '/baptisty-rossii/podpolnaya-pechat/',
  '/baptisty-rossii/sovetskaya-noch/',
  '/baptisty-rossii/spravochnik/',
  '/baptisty-rossii/vsehib-1944/',
  '/baptisty-rossii/yuzhnaya-shtunda/',
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    const clean = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname).replace(/^\/+/, '');
    let file = clean ? join(DIST, clean) : join(DIST, 'index.html');
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise((resolve) => server.listen(8240, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const report = [];

for (const route of ROUTES) {
  await page.goto(`http://127.0.0.1:8240${route}`, { waitUntil: 'networkidle' });
  const row = await page.evaluate(() => {
    const describe = (node) => {
      const chain = [];
      for (let el = node; el && el.nodeType === 1 && chain.length < 3; el = el.parentElement) {
        let tag = el.tagName.toLowerCase();
        if (el.className && typeof el.className === 'string') tag += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
        chain.unshift(tag);
      }
      return chain.join(' > ');
    };
    const visible = (node) => {
      if (!node || !node.parentElement) return false;
      const style = getComputedStyle(node.parentElement);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.05) return false;
      const rect = node.parentElement.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };
    const scope = document.querySelector('article') || document.querySelector('main') || document.body;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const screen = new Map();
    while (walker.nextNode()) {
      const text = (walker.currentNode.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!/\?{2,}/.test(text)) continue;
      if (!visible(walker.currentNode)) continue;
      const where = describe(walker.currentNode.parentElement);
      const key = `${where}|${text}`;
      screen.set(key, { where, text: text.slice(0, 160) });
    }
    const alt = [];
    for (const image of document.querySelectorAll('img[alt]')) {
      if (/\?{2,}/.test(image.alt)) alt.push({ where: 'img alt', text: image.alt.slice(0, 160) });
    }
    for (const link of document.querySelectorAll('a[title]')) {
      if (/\?{2,}/.test(link.title)) alt.push({ where: 'a title', text: link.title.slice(0, 160) });
    }
    const headings = [...screen.values()].filter((item) => /h[1-4]\b/.test(item.where));
    return { screen: [...screen.values()], alt, headings };
  });
  report.push({ route, ...row, screenCount: row.screen.length, headingCount: row.headings.length, altCount: row.alt.length });
  if (!AS_JSON) {
    console.log(`${row.screen.length || row.alt.length ? '⚠' : '✅'} ${route} — видимых узлов: ${row.screen.length} (из них заголовков: ${row.headings.length}), alt/title: ${row.alt.length}`);
    for (const item of row.headings) console.log(`      ${item.where}: ${item.text}`);
  }
}

await browser.close();
server.close();

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const totals = report.reduce((acc, row) => ({
    screen: acc.screen + row.screenCount,
    headings: acc.headings + row.headingCount,
    alt: acc.alt + row.altCount,
  }), { screen: 0, headings: 0, alt: 0 });
  console.log(`\nMOJIBAKE-VISUAL routes=${report.length} видимых узлов=${totals.screen} заголовков=${totals.headings} alt/title=${totals.alt}`);
  console.log('Источник дефекта — исходники серии; инвентарь: data/baptisty-mojibake-inventory.json');
}
