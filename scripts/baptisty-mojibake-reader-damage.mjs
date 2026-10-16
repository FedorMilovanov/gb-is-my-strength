#!/usr/bin/env node
/**
 * gb-is-my-strength — замер читательского ущерба от маскированного текста серии «Баптисты России».
 *
 * Считает не строки в исходниках, а то, что видит читатель на СОБРАННЫХ страницах:
 *   * текстовые узлы, где не-ASCII символы заменены двумя и более маскировочными знаками
 *     (`?` в компонентах), и которые реально видны (bbox > 2 px, не clip-скрытые);
 *   * значения атрибутов alt / title / aria-label с масками — их читают скринридеры и
 *     карточки;
 * Дополнительно классифицирует попадание по секциям (`baptist-authentic-media`,
 * `baptist-evidence-journey`), чтобы отчёт говорил, какой блок серии испорчен.
 *
 * Usage:
 *   node scripts/baptisty-mojibake-reader-damage.mjs            # все 11 маршрутов серии
 *   ROUTES="/baptisty-rossii/spravochnik/;…" node scripts/baptisty-mojibake-reader-damage.mjs
 *   node scripts/baptisty-mojibake-reader-damage.mjs --json
 *
 * Запускать из корня репозитория после `npm run strangler:build:production-like`.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const JSON_MODE = process.argv.includes('--json');

const ALL_ROUTES = [
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
const ROUTES = (process.env.ROUTES || '').split(';').filter(Boolean).length
  ? process.env.ROUTES.split(';').filter(Boolean)
  : ALL_ROUTES;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
};

function startServer() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      response.statusCode = 404;
      response.end('not found');
      return;
    }
    response.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

const COLLECT = () => {
  const MASK = /\?{2,}/;
  const visible = (element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 2 || rect.height <= 2) return false; // ср-only здесь clip-based: судим по bbox
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return true;
  };
  const sectionOf = (element) => {
    const section = element.closest('[class*="baptist-"]');
    return section ? section.className.split(/\s+/).find((name) => name.startsWith('baptist-')) || null : null;
  };
  const textNodes = [];
  const attributeFindings = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue || '';
    if (!MASK.test(value)) continue;
    const parent = node.parentElement;
    if (!parent || !visible(parent)) continue;
    textNodes.push({ text: value.trim().slice(0, 120), section: sectionOf(parent), tag: parent.tagName.toLowerCase() });
  }
  for (const element of document.querySelectorAll('[alt], [title], [aria-label]')) {
    for (const attribute of ['alt', 'title', 'aria-label']) {
      const value = element.getAttribute(attribute);
      if (!value || !MASK.test(value)) continue;
      if (!visible(element)) continue;
      attributeFindings.push({ attribute, text: value.slice(0, 120), section: sectionOf(element), tag: element.tagName.toLowerCase() });
    }
  }
  return { textNodes, attributeFindings };
};

async function main() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('❌ нет dist/index.html — сначала npm run strangler:build:production-like');
    process.exit(1);
  }
  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'ru-RU' });
  const report = [];
  try {
    for (const route of ROUTES) {
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !/Failed to load resource:/i.test(message.text())) consoleErrors.push(message.text().slice(0, 140));
      });
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
      const { textNodes, attributeFindings } = await page.evaluate(COLLECT);
      const sections = [...new Set([...textNodes, ...attributeFindings].map((item) => item.section).filter(Boolean))];
      report.push({
        route,
        readerVisibleText: textNodes.length,
        readerVisibleAttributes: attributeFindings.length,
        sections,
        samples: [...textNodes, ...attributeFindings].slice(0, 3).map((item) => (item.attribute ? `${item.attribute}: ${item.text}` : item.text)),
        consoleErrors,
      });
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const damaged = report.filter((item) => item.readerVisibleText + item.readerVisibleAttributes > 0);
  const totals = {
    routes: report.length,
    damagedRoutes: damaged.length,
    readerVisibleText: report.reduce((sum, item) => sum + item.readerVisibleText, 0),
    readerVisibleAttributes: report.reduce((sum, item) => sum + item.readerVisibleAttributes, 0),
  };

  if (JSON_MODE) {
    console.log(JSON.stringify({ totals, report }, null, 2));
  } else {
    console.log('Замер читательского ущерба от маскированного текста (Баптисты России)\n');
    for (const item of report) {
      const sum = item.readerVisibleText + item.readerVisibleAttributes;
      const mark = sum ? '❌' : '✅';
      console.log(`${mark} ${item.route} — текст ${item.readerVisibleText}, атрибуты ${item.readerVisibleAttributes}${item.sections.length ? ` [${item.sections.join(', ')}]` : ''}`);
      for (const sample of item.samples) console.log(`     · ${sample}`);
    }
    console.log(`\nИТОГО: маршрутов ${totals.routes}, с ущербом ${totals.damagedRoutes}; текст ${totals.readerVisibleText}, атрибуты ${totals.readerVisibleAttributes}`);
  }
  process.exit(0);
}

main();
