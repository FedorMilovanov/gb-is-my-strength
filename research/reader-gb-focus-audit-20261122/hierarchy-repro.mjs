// Read-only curated-TOC and book page/location identity probe. No feature-flag rollout.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || path.resolve('package.json'));
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8476';
const output = process.env.OUTPUT_DIR || '/tmp/reader-gb-hierarchy';
fs.mkdirSync(output, { recursive:true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath:process.env.CHROMIUM_PATH } : {}), args:['--no-sandbox']
});
const results = [];
try {
  for (const fixture of [
    { route:'/articles/dzhon-gill-chast-2-uchenyi/', ids:['sec-whitefield','sec-ordinances'], book:false },
    { route:'/baptisty-rossii/dva-sezda-1884/', ids:['petersburg-april-1884','baptism-as-boundary','police-intervention'], book:true }
  ]) {
    const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true,
      hasTouch:true, reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    await page.goto(base + fixture.route);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const row = { route:fixture.route, samples:[], checks:[] };
    const check = (name,pass) => row.checks.push({name,pass});
    check('Native mobile surface', await page.evaluate(() => !document.querySelector('.np-w57-ready') &&
      getComputedStyle(document.querySelector('.mobile-top-bar')).display === 'flex'));
    for (const id of fixture.ids) {
      await page.evaluate(id => scrollTo({top:document.getElementById(id).getBoundingClientRect().top + scrollY + 200,
        behavior:'instant'}), id);
      await page.waitForTimeout(1200);
      const live = await page.evaluate(() => GBReaderState.getSnapshot().sectionId);
      check(`Live section is ${id}`, live === id);
      await page.locator('#mobPartTocBtn').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(450);
      const projection = await page.evaluate(id => {
        const root = document.querySelector('article.article-body') || document.querySelector('article');
        const headings = [...root.querySelectorAll('h2[id],h3[id]')];
        const heading = document.getElementById(id);
        const index = headings.indexOf(heading);
        const parent = heading.tagName === 'H3' ? headings.slice(0,index).reverse().find(e => e.tagName === 'H2') : null;
        const links = [...document.querySelectorAll('#partTocOverlay a[href^="#"]')];
        return { id, parent:parent?.id || null, represented:links.some(e => e.hash === '#'+id),
          parentRepresented:!!parent && links.some(e => e.hash === '#'+parent.id),
          activeLocal:links.filter(e => e.classList.contains('active')).map(e => e.hash),
          pageMarkers:[...document.querySelectorAll('#partTocOverlay a[aria-current="page"]')].map(e => ({href:e.getAttribute('href'), active:e.classList.contains('active')})),
          currentPart:document.querySelector('#partTocOverlay .gbat-part.cur .gbat-t')?.textContent.trim() };
      }, id);
      row.samples.push({live,projection});
      if (projection.represented) check(`Represented location follows ${id}`, projection.activeLocal.includes('#'+id));
      if (id === 'sec-whitefield') {
        check('Fixture has neither exact nor parent row', !projection.represented && projection.parent === 'part-controversy' && !projection.parentRepresented);
        check('No unrelated exact-location marker for omitted heading', projection.activeLocal.length === 0);
      }
      if (fixture.book) check(`Preserve current article page state at ${id}`,
        projection.currentPart === 'Рождение братства' && projection.pageMarkers.length === 1 &&
        projection.pageMarkers[0].href === fixture.route && projection.pageMarkers[0].active);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(350);
    }
    results.push(row);
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(`${output}/hierarchy.json`,JSON.stringify(results,null,2));
const checks = results.flatMap(r => r.checks);
console.log(JSON.stringify({passed:checks.filter(c=>c.pass).length,total:checks.length,results},null,2));
process.exitCode = checks.some(c=>!c.pass) ? 1 : 0;
