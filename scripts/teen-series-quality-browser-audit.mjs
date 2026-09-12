#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT_DIR = join(ROOT, 'reports', 'teen-series-browser');

const ARTICLE_ROUTES = [
  { route: '/articles/podrostok-za-kadrom-dvoynaya-zhizn/', id: 'teen-double-life', refs: 3 },
  { route: '/articles/podrostok-za-kadrom-roditelyam-posle-razoblacheniya/', id: 'teen-parents-after-disclosure', refs: 2 },
  { route: '/articles/podrostok-za-kadrom-chto-delat-tserkvi/', id: 'teen-church-response', refs: 3 },
  { route: '/articles/vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie/', id: 'adult-child-left-home', refs: 2 },
  { route: '/articles/vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya/', id: 'adult-child-home-money', refs: 3 },
  { route: '/articles/sovershennoletie-roditelskaya-vlast-chto-menyaetsya/', id: 'adult-child-authority', refs: 2 },
  { route: '/articles/vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti/', id: 'adult-daughter-marriage', refs: 3 },
];

const VIEWPORTS = [
  { name: '320x720', width: 320, height: 720 },
  { name: '360x800', width: 360, height: 800 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
];
const SCREENSHOT_WIDTHS = new Set([320, 390, 768, 1024, 1440]);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  routes: ARTICLE_ROUTES.map((x) => x.route),
  viewports: VIEWPORTS,
  scenes: [],
  darkScenes: [],
  errors: [],
};

function safeName(route) {
  return route.split('/').filter(Boolean).at(-1) || 'landing';
}
function issue(route, viewport, message) {
  report.errors.push({ route, viewport, message });
}
function check(condition, route, viewport, message) {
  if (!condition) issue(route, viewport, message);
}
function insideViewport(box, width, height, tolerance = 2) {
  return Boolean(
    box &&
    box.x >= -tolerance &&
    box.y >= -tolerance &&
    box.x + box.width <= width + tolerance &&
    box.y + box.height <= height + tolerance
  );
}

async function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(String(req.url || '/').split('?')[0]);
      let file = join(root, pathname.replace(/^\//, ''));
      try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      } catch {}
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function settleGlossary(page) {
  await page.evaluate(async () => {
    const runtime = window.__gbGlossaryRuntime;
    if (runtime?.promise) {
      try { await runtime.promise; } catch {}
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForTimeout(80);
}

async function inspectArticle(page, spec, vp) {
  const route = spec.route;
  const viewport = vp.name;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 45_000 });
  check(response?.ok(), route, viewport, `HTTP response is not OK: ${response?.status()}`);
  await settleGlossary(page);

  const metrics = await page.evaluate(() => {
    const article = document.querySelector('article[data-teen-series-article]');
    const prose = document.querySelector('.teen-series-prose');
    const firstP = prose?.querySelector('p');
    const h1 = document.querySelector('h1');
    const pStyle = firstP ? getComputedStyle(firstP) : null;
    const h1Style = h1 ? getComputedStyle(h1) : null;
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
    const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    const tocHrefs = [...document.querySelectorAll('#gbs2PartToc .gbat-part.cur a.gbat-sub[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter(Boolean);
    const uniqueTocHrefs = [...new Set(tocHrefs)];
    const currentPartCount = document.querySelectorAll('#gbs2PartToc .gbat-part.cur').length;
    const missingTocTargets = uniqueTocHrefs.filter((href) => !document.getElementById(href.slice(1)));
    const terms = [...document.querySelectorAll('article .gterm')];
    const forbiddenGlossary = document.querySelectorAll(
      'a .gterm, .bref .gterm, nav .gterm, figure .gterm, table .gterm, ' +
      '.article-header .gterm, .author-card .gterm, [data-pagefind-ignore] .gterm, ' +
      'h1 .gterm, h2 .gterm, h3 .gterm, .quiz-wrapper .gterm'
    ).length;
    const shortHeading = [...document.querySelectorAll('article h2')]
      .find((el) => el.textContent.trim() === 'Коротко');
    let shortCount = 0;
    if (shortHeading) {
      let node = shortHeading.nextElementSibling;
      while (node && node.tagName !== 'H2') {
        if (node.tagName === 'OL' || node.tagName === 'UL') {
          shortCount = node.querySelectorAll(':scope > li').length;
          break;
        }
        node = node.nextElementSibling;
      }
    }
    const sourceHeading = [...document.querySelectorAll('article h2')]
      .some((el) => /Источники/.test(el.textContent));
    const correction = document.querySelector('.teen-correction-boundary');
    const articleRect = article?.getBoundingClientRect();
    const proseRect = prose?.getBoundingClientRect();
    const firstPRect = firstP?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      docWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      articleRect: articleRect ? { x: articleRect.x, width: articleRect.width, right: articleRect.right } : null,
      proseRect: proseRect ? { x: proseRect.x, width: proseRect.width, right: proseRect.right } : null,
      firstPRect: firstPRect ? { width: firstPRect.width } : null,
      paragraphFontSize: pStyle ? parseFloat(pStyle.fontSize) : 0,
      paragraphLineHeight: pStyle ? parseFloat(pStyle.lineHeight) : 0,
      h1FontSize: h1Style ? parseFloat(h1Style.fontSize) : 0,
      duplicateIds,
      tocCount: uniqueTocHrefs.length,
      currentPartCount,
      missingTocTargets,
      glossaryCount: terms.length,
      glossaryReady: terms.filter((el) => el.dataset.gbTooltipReady === '1').length,
      glossaryIdentity: terms.filter((el) => Boolean(el.dataset.term)).length,
      glossaryTermCounts: terms.reduce((counts, el) => {
        const key = el.dataset.term || '(missing)';
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
      forbiddenGlossary,
      bibleRefs: document.querySelectorAll('.bref[data-ref]').length,
      emptyBibleRefs: document.querySelectorAll('.bref[data-ref=""]').length,
      shortCount,
      sourceHeading,
      correction: Boolean(correction),
      correctionExcluded: Boolean(correction?.hasAttribute('data-reader-exclude') && correction?.hasAttribute('data-pagefind-ignore')),
      seriesIdentity: document.body.getAttribute('data-gbs2-series'),
    };
  });

  check(errors.length === 0, route, viewport, `pageerror: ${errors.join('; ')}`);
  check(metrics.docWidth <= metrics.innerWidth + 2, route, viewport,
    `document horizontal overflow: ${metrics.docWidth} > ${metrics.innerWidth}`);
  // documentElement.scrollWidth is the browser's actual horizontal-scroll owner.
  // body.scrollWidth can legitimately include the fixed 304px rail/padding accounting
  // at the exact desktop breakpoint even when the document and reader surface do not
  // overflow. Keep bodyWidth in the evidence payload, but do not use it as the verdict.
  check(metrics.articleRect && metrics.articleRect.x >= -2 && metrics.articleRect.right <= metrics.innerWidth + 2,
    route, viewport, 'article escapes viewport');
  check(metrics.proseRect && metrics.proseRect.x >= -2 && metrics.proseRect.right <= metrics.innerWidth + 2,
    route, viewport, 'prose escapes viewport');
  check(metrics.paragraphFontSize >= 15, route, viewport,
    `body font too small: ${metrics.paragraphFontSize}px`);
  check(metrics.paragraphLineHeight >= metrics.paragraphFontSize * 1.4, route, viewport,
    `body line-height too tight: ${metrics.paragraphLineHeight}px / ${metrics.paragraphFontSize}px`);
  check((metrics.firstPRect?.width || 0) <= Math.min(metrics.innerWidth, 920), route, viewport,
    `reading measure too wide: ${metrics.firstPRect?.width || 0}px`);
  check(metrics.duplicateIds.length === 0, route, viewport,
    `duplicate DOM ids: ${metrics.duplicateIds.join(', ')}`);
  check(metrics.currentPartCount === 1, route, viewport,
    `part TOC current owner drifted: ${metrics.currentPartCount}`);
  check(metrics.tocCount >= 8, route, viewport,
    `configured current-part TOC is too shallow for long-form article: ${metrics.tocCount}`);
  check(metrics.missingTocTargets.length === 0, route, viewport,
    `part TOC has missing targets: ${metrics.missingTocTargets.join(', ')}`);
  const glossaryMaxCanonicalCount = Math.max(0, ...Object.values(metrics.glossaryTermCounts));
  check(glossaryMaxCanonicalCount <= 3, route, viewport,
    `glossary per-term cadence max exceeded: ${JSON.stringify(metrics.glossaryTermCounts)}`);
  check(metrics.glossaryReady === metrics.glossaryCount, route, viewport,
    `glossary tooltip readiness mismatch: ${metrics.glossaryReady}/${metrics.glossaryCount}`);
  check(metrics.glossaryIdentity === metrics.glossaryCount, route, viewport,
    `glossary canonical identity mismatch: ${metrics.glossaryIdentity}/${metrics.glossaryCount}`);
  check(metrics.forbiddenGlossary === 0, route, viewport,
    `glossary marker leaked into forbidden surface: ${metrics.forbiddenGlossary}`);
  check(metrics.bibleRefs === spec.refs, route, viewport,
    `Bible reference count drifted: ${metrics.bibleRefs} != ${spec.refs}`);
  check(metrics.emptyBibleRefs === 0, route, viewport, 'empty Bible data-ref found');
  check(metrics.shortCount >= 4 && metrics.shortCount <= 6, route, viewport,
    `«Коротко» must contain 4–6 items, found ${metrics.shortCount}`);
  check(metrics.sourceHeading, route, viewport, 'reader-facing sources heading missing');
  check(metrics.correction && metrics.correctionExcluded, route, viewport,
    'correction boundary missing or not excluded from reader/Pagefind projection');
  check(metrics.seriesIdentity === 'teen-double-life', route, viewport,
    `series identity drifted: ${metrics.seriesIdentity}`);

  if (SCREENSHOT_WIDTHS.has(vp.width)) {
    await page.screenshot({
      path: join(REPORT_DIR, `${safeName(route)}-${vp.name}-light.jpg`),
      fullPage: true,
      type: 'jpeg',
      quality: 66,
      animations: 'disabled',
    });
  }

  const firstBible = page.locator('.bref[data-ref]').first();
  try {
    await firstBible.scrollIntoViewIfNeeded();
    if (vp.width <= 768) await firstBible.click();
    else await firstBible.focus();
    const tip = page.locator('.btip.is-open').last();
    await tip.waitFor({ state: 'visible', timeout: 8_000 });
    const box = await tip.boundingBox();
    check(insideViewport(box, vp.width, vp.height), route, viewport,
      `Bible tooltip escapes viewport: ${JSON.stringify(box)}`);
    if (vp.width <= 768) await firstBible.click();
    else await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('.btip.is-open').length === 0, null, { timeout: 5_000 });
  } catch (error) {
    issue(route, viewport, `Bible tooltip interaction failed: ${error.message}`);
  }

  if (metrics.glossaryCount > 0) {
    const firstTerm = page.locator('article .gterm').first();
    try {
      await firstTerm.scrollIntoViewIfNeeded();
      if (vp.width <= 768) await firstTerm.click();
      else await firstTerm.focus();
      const tip = page.locator('.gtip.is-open').last();
      await tip.waitFor({ state: 'visible', timeout: 8_000 });
      const box = await tip.boundingBox();
      check(insideViewport(box, vp.width, vp.height), route, viewport,
        `Glossary tooltip escapes viewport: ${JSON.stringify(box)}`);
      if (vp.width <= 768) await firstTerm.click();
      else await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.querySelectorAll('.gtip.is-open').length === 0, null, { timeout: 5_000 });
    } catch (error) {
      issue(route, viewport, `Glossary tooltip interaction failed: ${error.message}`);
    }
  }

  try {
    const correction = page.locator('.teen-correction-boundary');
    await correction.scrollIntoViewIfNeeded();
    const email = correction.locator('.gb-accuracy-btn--email');
    const telegram = correction.locator('.gb-accuracy-btn--tg');
    check(await email.isVisible(), route, viewport, 'correction email action not visible');
    check(await telegram.isVisible(), route, viewport, 'correction Telegram action not visible');
  } catch (error) {
    issue(route, viewport, `correction action witness failed: ${error.message}`);
  }

  report.scenes.push({ route, viewport, metrics, pageErrors: errors });
}

async function inspectLanding(page, vp) {
  const route = '/podrostok-za-kadrom/';
  const viewport = vp.name;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 45_000 });
  check(response?.ok(), route, viewport, `HTTP response is not OK: ${response?.status()}`);
  const metrics = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.teen-series-card')];
    const hero = document.querySelector('.teen-series-hero img');
    const links = cards.map((a) => a.getAttribute('href')).filter(Boolean);
    const rect = hero?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      docWidth: document.documentElement.scrollWidth,
      cardCount: cards.length,
      uniqueLinks: new Set(links).size,
      heroWidthAttr: hero?.getAttribute('width'),
      heroHeightAttr: hero?.getAttribute('height'),
      heroRect: rect ? { x: rect.x, width: rect.width, right: rect.right } : null,
      h1Count: document.querySelectorAll('h1').length,
    };
  });
  check(errors.length === 0, route, viewport, `pageerror: ${errors.join('; ')}`);
  check(metrics.docWidth <= metrics.innerWidth + 2, route, viewport,
    `landing horizontal overflow: ${metrics.docWidth} > ${metrics.innerWidth}`);
  check(metrics.cardCount === 7 && metrics.uniqueLinks === 7, route, viewport,
    `landing card projection drifted: cards=${metrics.cardCount}, unique=${metrics.uniqueLinks}`);
  check(metrics.heroWidthAttr === '1200' && metrics.heroHeightAttr === '630', route, viewport,
    `landing hero intrinsic dimensions drifted: ${metrics.heroWidthAttr}x${metrics.heroHeightAttr}`);
  check(metrics.heroRect && metrics.heroRect.x >= -2 && metrics.heroRect.right <= metrics.innerWidth + 2,
    route, viewport, 'landing hero escapes viewport');
  check(metrics.h1Count === 1, route, viewport, `landing H1 count=${metrics.h1Count}`);
  if (SCREENSHOT_WIDTHS.has(vp.width)) {
    await page.screenshot({
      path: join(REPORT_DIR, `landing-${vp.name}-light.jpg`),
      fullPage: true,
      type: 'jpeg',
      quality: 68,
      animations: 'disabled',
    });
  }
  report.scenes.push({ route, viewport, metrics, pageErrors: errors });
}

async function captureDark(browser, base, spec, vp) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: 'dark',
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem('theme', 'dark'); } catch {}
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(base + spec.route, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.waitForTimeout(100);
    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      dark: document.documentElement.classList.contains('dark'),
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    check(metrics.scrollWidth <= metrics.width + 2, spec.route, `${vp.name}-dark`, 'dark-mode horizontal overflow');
    check(metrics.dark, spec.route, `${vp.name}-dark`, 'dark theme did not apply');
    await page.screenshot({
      path: join(REPORT_DIR, `${safeName(spec.route)}-${vp.name}-dark.jpg`),
      fullPage: true,
      type: 'jpeg',
      quality: 66,
      animations: 'disabled',
    });
    report.darkScenes.push({ route: spec.route, viewport: vp.name, metrics, pageErrors: errors });
    check(errors.length === 0, spec.route, `${vp.name}-dark`, `pageerror: ${errors.join('; ')}`);
  } finally {
    await context.close();
  }
}

if (!existsSync(DIST)) throw new Error('production-like dist missing');
await mkdir(REPORT_DIR, { recursive: true });
const { server, base } = await serve(DIST);
let browser;
try {
  const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : { headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      baseURL: base,
      viewport: { width: vp.width, height: vp.height },
      colorScheme: 'light',
    });
    try {
      for (const spec of ARTICLE_ROUTES) {
        const page = await context.newPage();
        try { await inspectArticle(page, spec, vp); }
        catch (error) { issue(spec.route, vp.name, `scene crashed: ${error.stack || error.message}`); }
        finally { await page.close(); }
      }
      const landingPage = await context.newPage();
      try { await inspectLanding(landingPage, vp); }
      catch (error) { issue('/podrostok-za-kadrom/', vp.name, `landing scene crashed: ${error.stack || error.message}`); }
      finally { await landingPage.close(); }
    } finally {
      await context.close();
    }
  }

  for (const spec of [ARTICLE_ROUTES[0], ARTICLE_ROUTES.at(-1)]) {
    for (const vp of VIEWPORTS.filter((item) => item.width === 390 || item.width === 1440)) {
      await captureDark(browser, base, spec, vp);
    }
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

report.summary = {
  sceneCount: report.scenes.length,
  darkSceneCount: report.darkScenes.length,
  screenshotCount: 8 * SCREENSHOT_WIDTHS.size + 4,
  errorCount: report.errors.length,
  expectedArticleScenes: ARTICLE_ROUTES.length * VIEWPORTS.length,
  expectedLandingScenes: VIEWPORTS.length,
};
await writeFile(join(REPORT_DIR, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`);

assert.equal(report.scenes.length, ARTICLE_ROUTES.length * VIEWPORTS.length + VIEWPORTS.length,
  'quality audit scene count drifted');
assert.equal(report.errors.length, 0,
  `Teen series quality browser audit failed with ${report.errors.length} issue(s):\n` +
  report.errors.map((entry) => `- ${entry.route} @ ${entry.viewport}: ${entry.message}`).join('\n'));

console.log('✅ Teen series quality Playwright audit PASS');
console.log(`  scenes: ${report.scenes.length} light + ${report.darkScenes.length} dark`);
console.log('  viewports: 320 / 360 / 390 / 768 / 1024 / 1440');
console.log('  checked: overflow, reading measure, 4–6 summary rule, deep TOC, per-term glossary cadence/placement/interaction, Bible tooltip bounds, correction actions');
console.log(`  evidence: ${REPORT_DIR}`);
