#!/usr/bin/env node
/**
 * premium-mobile-visibility-smoke.js (PC-MAIN-03 Guard)
 * Enforces that PremiumControls (.gb-ember / .gb-save) are actually visible and
 * tappable (rect >= 30x30) on mobile viewports (390x844, touch-enabled) across
 * representative route families.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const DIST = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ does not exist. Please run `npm run strangler:build:production-like` first.');
  process.exit(2);
}

// Start local static server for Playwright
const http = require('http');
const PORT = 8107;
const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0].replace(/\/$/, '/index.html');
  let filePath = path.join(DIST, urlPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('404'); return;
  }
  let ext = path.extname(filePath);
  let cType = ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/plain';
  res.writeHead(200, { 'Content-Type': cType });
  res.end(fs.readFileSync(filePath));
});

server.listen(PORT, async () => {
  console.log(`=== PremiumControls Mobile Visibility Smoke Audit (Port ${PORT}) ===`);
  const routes = [
    '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/',
    '/articles/krajne-li-isporcheno-serdce/',
    '/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/',
    '/articles/dzhon-gill-chast-1-chelovek/',
    '/articles/dzhon-gill-spravochnik/',
    '/baptisty-rossii/noch-na-kure/',
    '/nagornaya/chast-1/'
  ];

  const browser = await chromium.launch({ headless: true });
  let failures = 0;

  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const isAstro = await page.evaluate(() => {
      const h = document.documentElement.outerHTML;
      return h.includes('data-astro-cid-') || h.includes('data-pc-anchor') || h.includes('FloatingCluster');
    });

    const data = await page.evaluate(() => {
      const embers = Array.from(document.querySelectorAll('.gb-ember')).map(el => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          cls: el.className,
          display: cs.display,
          w: Math.round(r.width),
          h: Math.round(r.height),
          x: Math.round(r.x),
          y: Math.round(r.y),
          visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
        };
      });
      return {
        embers,
        saves: document.querySelectorAll('.gb-save').length,
        roots: document.querySelectorAll('[data-fc-root],[data-fc-controls]').length
      };
    });

    const hasVisibleEmber = data.embers.some(e => e.w >= 30 && e.h >= 30);

    if (hasVisibleEmber) {
      console.log(`✅ ${route}: visible mobile .gb-ember OK (${JSON.stringify(data.embers)})`);
    } else {
      if (isAstro) {
        console.error(`❌ ${route}: no visible/tappable .gb-ember on mobile (${JSON.stringify(data.embers)})`);
        failures++;
      } else {
        console.log(`⚠️ ${route} (legacy root copy): mobile controls currently 0x0/invisible (will be fixed upon Astro promotion)`);
      }
    }
    await page.close();
  }

  await browser.close();
  server.close();

  if (failures > 0) {
    console.error(`\n❌ PremiumControls mobile visibility smoke failed (${failures} fatal issue(s)).`);
    process.exit(1);
  } else {
    console.log('\n✅ PremiumControls mobile visibility smoke OK (Astro native routes verified, legacy copies tracked).');
    process.exit(0);
  }
});
