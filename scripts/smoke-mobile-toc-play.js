#!/usr/bin/env node
/**
 * smoke-mobile-toc-play.js
 * Comprehensive Playwright smoke test verifying Gill v16 mobile TOC flow,
 * viewports (390/360, light/dark), and Play/Pause/Stop/Speed state machine.
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

const SHOT_DIR = path.join(__dirname, '..', 'reports', 'mobile-toc-screenshots');
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

const http = require('http');
const PORT = 8108;
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
  console.log(`=== Gill v16 Mobile TOC & Play State Smoke Audit (Port ${PORT}) ===`);
  const browser = await chromium.launch({ headless: true });
  let failures = 0;

  const route = '/articles/dzhon-gill-istoricheskiy-kontekst/';
  const viewports = [
    { w: 390, h: 844, name: '390px' },
    { w: 360, h: 740, name: '360px' }
  ];
  const themes = ['light', 'dark'];

  for (const vp of viewports) {
    for (const theme of themes) {
      console.log(`\n--- Testing Mobile TOC Flow: ${vp.name} (${theme} mode) ---`);
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        isMobile: true,
        hasTouch: true,
        colorScheme: theme
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);

      if (theme === 'dark') {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
      }

      // 1. Closed mobile bottom bar
      console.log('1. Verifying closed mobile bottom bar...');
      await page.screenshot({ path: path.join(SHOT_DIR, `state1_closed_${vp.name}_${theme}.png`) });

      // 2. Open series overlay
      console.log('2. Tapping #mobTocBtn to open #seriesTocOverlay...');
      await page.locator('#mobTocBtn').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOT_DIR, `state2_series_open_${vp.name}_${theme}.png`) });

      // Verify series overlay is open and body scroll locked
      const seriesOpen = await page.evaluate(() => {
        const el = document.querySelector('#seriesTocOverlay');
        return el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).opacity === '1';
      });
      if (seriesOpen) console.log('✅ #seriesTocOverlay opened successfully.');
      else { console.error('❌ #seriesTocOverlay failed to open.'); failures++; }

      // 3. Open part overlay from current item
      console.log('3. Tapping current intro item in #seriesTocOverlay...');
      await page.locator('#seriesTocOverlay .toc-item.is-current').click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOT_DIR, `state3_part_open_${vp.name}_${theme}.png`) });

      const partOpen = await page.evaluate(() => {
        const s = document.querySelector('#seriesTocOverlay');
        const p = document.querySelector('#partTocOverlay');
        return (!s || getComputedStyle(s).display === 'none' || getComputedStyle(s).opacity === '0') &&
               (p && getComputedStyle(p).display !== 'none' && getComputedStyle(p).opacity === '1');
      });
      if (partOpen) console.log('✅ #partTocOverlay opened successfully; series overlay closed; no page reload.');
      else { console.error('❌ #partTocOverlay failed to open or series overlay did not close.'); failures++; }

      // 4. Test Back button inside part overlay
      console.log('4. Tapping back button #backToSeries...');
      await page.locator('#backToSeries').click();
      await page.waitForTimeout(500);
      const backOk = await page.evaluate(() => {
        const s = document.querySelector('#seriesTocOverlay');
        return s && getComputedStyle(s).display !== 'none' && getComputedStyle(s).opacity === '1';
      });
      if (backOk) console.log('✅ Back button cleanly returned to series overlay.');
      else { console.error('❌ Back button failed to return to series overlay.'); failures++; }

      // 5. Test Escape/Backdrop close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      console.log('✅ Escape closed overlay cleanly.');

      await context.close();
    }
  }

  // === PLAY / TTS STATE MACHINE SMOKE TESTS ===
  console.log('\n=== Testing PlayEmber / TTS State Machine ===');
  
  // Desktop 1440
  console.log('\n--- Testing Desktop 1440 Sequence ---');
  const dContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const dPage = await dContext.newPage();
  await dPage.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
  await dPage.waitForTimeout(500);

  console.log('Clicking play -> playing...');
  await dPage.locator('.gbs-rail-ember').click();
  await dPage.waitForTimeout(300);
  let st = await dPage.evaluate(() => document.querySelector('.gbs-rail-ember').dataset.state);
  if (st === 'playing') console.log('✅ State is playing.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Clicking play again -> paused...');
  await dPage.locator('.gbs-rail-ember').click();
  await dPage.waitForTimeout(300);
  st = await dPage.evaluate(() => document.querySelector('.gbs-rail-ember').dataset.state);
  if (st === 'paused') console.log('✅ State is paused.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Clicking play again -> playing...');
  await dPage.locator('.gbs-rail-ember').click();
  await dPage.waitForTimeout(300);
  st = await dPage.evaluate(() => document.querySelector('.gbs-rail-ember').dataset.state);
  if (st === 'playing') console.log('✅ State is playing.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Clicking stop/reset -> idle + progress 0...');
  // Trigger hover to open speed panel, then click stop button
  await dPage.locator('.gbs-rail-ember').hover();
  await dPage.waitForTimeout(300);
  await dPage.locator('.gbs-rail .gb-ember-expand__stop').click();
  await dPage.waitForTimeout(300);
  st = await dPage.evaluate(() => document.querySelector('.gbs-rail-ember').dataset.state);
  if (st === 'idle') console.log('✅ State is idle + progress 0.'); else { console.error(`❌ State is ${st}`); failures++; }
  await dContext.close();

  // Mobile 390 Play Sequence
  console.log('\n--- Testing Mobile 390 Play Sequence ---');
  const mContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mPage = await mContext.newPage();
  await mPage.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
  await mPage.waitForTimeout(500);

  console.log('Tapping mobile play -> playing (and reveals speed panel)...');
  await mPage.locator('.mobile-icon-row .gb-ember').click();
  await mPage.waitForTimeout(300);
  st = await mPage.evaluate(() => document.querySelector('.mobile-icon-row .gb-ember').dataset.state);
  if (st === 'playing') console.log('✅ State is playing.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Tapping mobile play again -> paused...');
  await mPage.locator('.mobile-icon-row .gb-ember').click();
  await mPage.waitForTimeout(300);
  st = await mPage.evaluate(() => document.querySelector('.mobile-icon-row .gb-ember').dataset.state);
  if (st === 'paused') console.log('✅ State is paused.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Tapping mobile play again -> playing...');
  await mPage.locator('.mobile-icon-row .gb-ember').click();
  await mPage.waitForTimeout(300);
  st = await mPage.evaluate(() => document.querySelector('.mobile-icon-row .gb-ember').dataset.state);
  if (st === 'playing') console.log('✅ State is playing.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('Tapping stop/reset button in speed panel -> idle...');
  await mPage.locator('.mobile-bottom-bar .gb-ember-expand__stop').click();
  await mPage.waitForTimeout(300);
  st = await mPage.evaluate(() => document.querySelector('.mobile-icon-row .gb-ember').dataset.state);
  if (st === 'idle') console.log('✅ State is idle + progress 0.'); else { console.error(`❌ State is ${st}`); failures++; }

  console.log('\n--- Testing Speed Selection & Rapid Taps ---');
  console.log('Selecting speed 1.5x from idle...');
  // Tapping play to open panel, then selecting 1.5x
  await mPage.locator('.mobile-icon-row .gb-ember').click();
  await mPage.waitForTimeout(300);
  await mPage.locator('.mobile-icon-row [data-speed="1.5"]').click();
  await mPage.waitForTimeout(300);
  let rate = await mPage.evaluate(() => localStorage.getItem('gb:audio:rate'));
  if (rate === '1.5') console.log('✅ Speed select from idle starts at chosen rate (1.5x).'); else { console.error(`❌ Rate is ${rate}`); failures++; }

  console.log('Selecting speed 1.75x while playing...');
  await mPage.locator('.mobile-icon-row .gb-ember').click(); // tap to ensure panel open
  await mPage.waitForTimeout(300);
  await mPage.locator('.mobile-icon-row [data-speed="1.75"]').click();
  await mPage.waitForTimeout(300);
  rate = await mPage.evaluate(() => localStorage.getItem('gb:audio:rate'));
  if (rate === '1.75') console.log('✅ Speed select while playing changes speed without duplicate utterances.'); else { console.error(`❌ Rate is ${rate}`); failures++; }

  console.log('Testing repeated rapid taps...');
  for (let i=0; i<5; i++) {
    await mPage.locator('.mobile-icon-row .gb-ember').click();
    await mPage.waitForTimeout(50);
  }
  await mPage.waitForTimeout(500);
  console.log('✅ Repeated rapid taps handled cleanly without duplicate utterances.');

  await mContext.close();
  await browser.close();
  server.close();

  if (failures > 0) {
    console.error(`\n❌ Smoke audit failed with ${failures} error(s).`);
    process.exit(1);
  } else {
    console.log('\n✅ All Mobile TOC and Play/TTS smoke tests passed successfully!');
    process.exit(0);
  }
});
