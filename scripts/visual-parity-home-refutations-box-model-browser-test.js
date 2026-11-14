#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'visual-parity', 'home-refutations-box-model');
const REPORT_FILE = path.join(REPORT_DIR, 'report.json');
const REFUTATIONS_SOURCE = fs.readFileSync(path.join(ROOT, 'src', 'components', 'home', 'HomeSections', 'Refutations.astro'), 'utf8');
const VISUAL_WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'visual-parity.yml'), 'utf8');
const DEPLOY_WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const SCRIPT_COMMAND = 'node scripts/visual-parity-home-refutations-box-model-browser-test.js';

fs.mkdirSync(REPORT_DIR, { recursive: true });
assert.match(
  REFUTATIONS_SOURCE,
  /#main-content #razbor \.h-refutation-card\s*\{[\s\S]{0,220}?box-sizing:\s*border-box\s*;/,
  'Refutations source owner must retain explicit border-box geometry',
);
assert.ok(VISUAL_WORKFLOW.includes(SCRIPT_COMMAND), 'Visual Parity workflow must execute the Refutations box-model browser contract');
assert.ok(DEPLOY_WORKFLOW.includes(SCRIPT_COMMAND), 'immutable release readiness must execute the Refutations box-model browser contract');

function contentType(filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function startServer() {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'dist/index.html is missing — build the production-like candidate first');
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      try {
        let requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
        if (requestPath.endsWith('/')) requestPath += 'index.html';
        const filePath = path.resolve(DIST, `.${requestPath}`);
        const insideDist = filePath === DIST || filePath.startsWith(`${DIST}${path.sep}`);
        if (!insideDist) {
          response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('forbidden');
          return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('not found');
          return;
        }
        response.writeHead(200, {
          'content-type': contentType(filePath),
          'cache-control': 'no-store',
        });
        fs.createReadStream(filePath).pipe(response);
      } catch (error) {
        response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        response.end(String(error));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({
      server,
      origin: `http://127.0.0.1:${server.address().port}`,
    }));
  });
}

async function inspectViewport(browser, origin, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`console: ${message.text()}`);
  });

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  if (viewport.dark) {
    await page.locator('#themeToggle').click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true,
      `${viewport.name}: dark-theme toggle failed`);
  }
  // All four native Home surfaces must actually paint, including lazy-loaded
  // series art and the five directions in their compact navigation mode.
  await page.locator('#issledovat').scrollIntoViewIfNeeded();
  for (const card of await page.locator('#publikacii .h-mobile-lab-shelf .h-featured-series').all()) {
    await card.scrollIntoViewIfNeeded();
  }
  const section = page.locator('#razbor');
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);

  const cards = await page.locator('#razbor .h-refutation-card').evaluateAll((elements) => elements.map((card) => {
    const shell = card.closest('.h-refutation-shell');
    const cardStyle = getComputedStyle(card);
    const cardRect = card.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect() || null;
    const abstract = card.querySelector('.h-article-abstract');
    const abstractRect = abstract?.getBoundingClientRect() || null;
    return {
      href: card.getAttribute('href'),
      abstractDisplay: abstract ? getComputedStyle(abstract).display : 'missing',
      abstractText: abstract?.textContent?.trim() || '',
      abstractHeight: abstractRect?.height ?? 0,
      abstractBottomInset: abstractRect ? cardRect.bottom - abstractRect.bottom : null,
      boxSizing: cardStyle.boxSizing,
      display: cardStyle.display,
      visibility: cardStyle.visibility,
      cardWidth: cardRect.width,
      cardHeight: cardRect.height,
      shellWidth: shellRect?.width ?? null,
      shellHeight: shellRect?.height ?? null,
      hasShell: Boolean(shell),
    };
  }));
  const pageGeometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    featuredCount: document.querySelectorAll('#publikacii .h-featured-shelf--lead > .h-featured-series').length,
    featuredIntro: document.querySelector('#publikacii .h-home-section-head > p')?.textContent?.trim() || '',
    editorialCardWidths: [...document.querySelectorAll('#publikacii .h-featured-shelf--lead > .h-featured-series')]
      .map((element) => Math.round(element.getBoundingClientRect().width)),
  }));
  const homeSurfaces = await page.evaluate(() => {
    const routes = document.querySelector('#issledovat .h-home-routes');
    const routeCards = [...(routes?.querySelectorAll('.h-home-route') || [])];
    const rect = (element) => element?.getBoundingClientRect();
    const series = [...document.querySelectorAll('#publikacii .h-mobile-lab-shelf .h-featured-series')];
    const leadLast = document.querySelector('#publikacii .h-featured-shelf--lead > .h-featured-series:last-child');
    const getImageCoverage = (card) => {
      const wrap = card?.querySelector('.h-featured-img-wrap');
      const img = wrap?.querySelector('img');
      const box = rect(wrap);
      const art = rect(img);
      return {
        wrapWidth: box?.width || 0,
        wrapHeight: box?.height || 0,
        imageWidth: art?.width || 0,
        imageHeight: art?.height || 0,
        loaded: Boolean(img?.complete && img?.naturalWidth),
      };
    };
    return {
      routesDisplay: routes ? getComputedStyle(routes).display : 'missing',
      routesClientWidth: routes?.clientWidth || 0,
      routesScrollWidth: routes?.scrollWidth || 0,
      directions: routeCards.map((card) => {
        const label = card.querySelector('.h-home-route__eyebrow');
        const title = card.querySelector('.h-home-route__copy strong');
        const box = rect(card);
        const copy = rect(card.querySelector('.h-home-route__copy'));
        return {
          href: card.getAttribute('href'),
          width: box?.width || 0,
          height: box?.height || 0,
          left: box?.left || 0,
          right: box?.right || 0,
          copyRight: copy?.right || 0,
          eyebrowFontSize: label ? parseFloat(getComputedStyle(label).fontSize) : 0,
          titleFontSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
        };
      }),
      futureSeries: series.map(getImageCoverage),
      leadLastArt: getImageCoverage(leadLast),
      featuredPalette: [...document.querySelectorAll('#publikacii .h-featured-series')].map((card) => {
        const title = card.querySelector('.h-featured-title');
        const description = card.querySelector('.h-featured-abstract');
        const panel = card.querySelector('.h-featured-body');
        return {
          background: getComputedStyle(card).backgroundColor,
          titleColor: title ? getComputedStyle(title).color : '',
          abstractColor: description ? getComputedStyle(description).color : '',
          panelBackground: panel ? getComputedStyle(panel).backgroundImage : '',
        };
      }),
    };
  });
  const screenshot = path.join(REPORT_DIR, `${viewport.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();

  assert.ok(cards.length >= 2, `${viewport.name}: expected at least two canonical Refutations cards, got ${cards.length}`);
  assert.equal(pageGeometry.featuredCount, 3, `${viewport.name}: expected three published editorial projects`);
  assert.doesNotMatch(pageGeometry.featuredIntro, /Два больших проекта/, `${viewport.name}: stale editorial project count`);
  if (viewport.width >= 761) {
    assert.ok(pageGeometry.editorialCardWidths[2] > pageGeometry.editorialCardWidths[0] * 1.5,
      `${viewport.name}: last editorial card did not use the full row`);
  }
  assert.equal(homeSurfaces.directions.length, 5, `${viewport.name}: five library directions required`);
  assert.equal(homeSurfaces.futureSeries.length, 3, `${viewport.name}: three future series required`);
  assert.equal(homeSurfaces.featuredPalette.length, 6,
    `${viewport.name}: all six editorial cards must share the theme palette`);
  const colorChannels = (value) => {
    const match = value.match(/^rgba?\(([^)]+)\)$/);
    assert.ok(match, `${viewport.name}: unexpected computed color ${value}`);
    return match[1].split(',').slice(0, 3).map((channel) => Number.parseFloat(channel));
  };
  for (const [index, palette] of homeSurfaces.featuredPalette.entries()) {
    const background = colorChannels(palette.background);
    const title = colorChannels(palette.titleColor);
    const abstract = colorChannels(palette.abstractColor);
    if (viewport.dark) {
      assert.ok(Math.max(...background) < 65 && Math.min(...title) > 210 && Math.min(...abstract) > 180,
        `${viewport.name}: editorial card ${index} lost dark-theme ink contrast`);
    } else {
      assert.ok(Math.min(...background) > 220 && Math.max(...title) < 100 && Math.max(...abstract) < 115,
        `${viewport.name}: editorial card ${index} retained the night palette in daylight mode`);
      assert.ok(palette.panelBackground.includes('rgb(255, 253, 250)'),
        `${viewport.name}: editorial card ${index} still paints a dark content panel`);
    }
  }
  if (viewport.width <= 900) {
    assert.equal(homeSurfaces.routesDisplay, 'grid', `${viewport.name}: mobile directions must use one stable list, not a carousel`);
    assert.ok(homeSurfaces.routesScrollWidth <= homeSurfaces.routesClientWidth + 1,
      `${viewport.name}: directions have hidden horizontal scrolling`);
    for (const item of homeSurfaces.directions) {
      assert.ok(item.height >= 88 && item.height <= 165,
        `${viewport.name}: ${item.href} has disproportionate list height ${item.height}`);
      assert.ok(item.eyebrowFontSize >= 9.4 && item.titleFontSize >= 15.5,
        `${viewport.name}: ${item.href} has unreadable typography ${item.eyebrowFontSize}/${item.titleFontSize}`);
      assert.ok(item.width <= viewport.width && item.copyRight <= item.right + 1,
        `${viewport.name}: ${item.href} text clips beyond its card`);
    }
    for (let index = 1; index < homeSurfaces.directions.length; index++) {
      assert.ok(homeSurfaces.directions[index].left >= homeSurfaces.directions[index - 1].left - 1,
        `${viewport.name}: directions are not full-width stacked entries`);
    }
  }
  for (const [index, art] of homeSurfaces.futureSeries.entries()) {
    assert.ok(art.loaded && art.wrapWidth > 70 && art.wrapHeight > 100,
      `${viewport.name}: future-series ${index} image failed to load/size`);
    if (viewport.width <= 760) {
      assert.ok(art.imageHeight >= art.wrapHeight - 2,
        `${viewport.name}: future-series ${index} image left an empty strip (${art.imageHeight}/${art.wrapHeight})`);
    }
  }
  if (viewport.width >= 761) {
    assert.ok(homeSurfaces.leadLastArt.loaded
      && homeSurfaces.leadLastArt.imageHeight >= homeSurfaces.leadLastArt.wrapHeight - 2,
      `${viewport.name}: full-row editorial photo does not fill its image track`);
  }
  assert.deepEqual(pageErrors, [], `${viewport.name}: page errors: ${pageErrors.join('\n')}`);
  assert.ok(pageGeometry.scrollWidth <= pageGeometry.viewportWidth, `${viewport.name}: horizontal overflow ${pageGeometry.scrollWidth} > ${pageGeometry.viewportWidth}`);
  for (const card of cards) {
    assert.equal(card.hasShell, true, `${viewport.name}: ${card.href} lost its Refutations shell`);
    assert.equal(card.boxSizing, 'border-box', `${viewport.name}: ${card.href} computed box-sizing is ${card.boxSizing}`);
    assert.notEqual(card.display, 'none', `${viewport.name}: ${card.href} is display:none`);
    assert.notEqual(card.visibility, 'hidden', `${viewport.name}: ${card.href} is hidden`);
    assert.ok(card.cardWidth > 0 && card.cardHeight > 0, `${viewport.name}: ${card.href} has zero geometry`);
    assert.ok(Math.abs(card.cardWidth - card.shellWidth) <= 1, `${viewport.name}: ${card.href} width ${card.cardWidth} differs from shell ${card.shellWidth}`);
    assert.ok(Math.abs(card.cardHeight - card.shellHeight) <= 1, `${viewport.name}: ${card.href} height ${card.cardHeight} differs from shell ${card.shellHeight}`);
    assert.ok(card.abstractText.length > 50, `${viewport.name}: ${card.href} lost its meaningful abstract`);
    assert.notEqual(card.abstractDisplay, 'none', `${viewport.name}: ${card.href} abstract is hidden`);
    assert.ok(card.abstractHeight > 14, `${viewport.name}: ${card.href} abstract has no painted height`);
    assert.ok(card.abstractBottomInset >= 5, `${viewport.name}: ${card.href} abstract approaches or clips card bottom (${card.abstractBottomInset}px)`);
  }

  return {
    viewport,
    cards,
    pageGeometry,
    homeSurfaces,
    pageErrors,
    consoleErrors,
    screenshot: path.relative(ROOT, screenshot),
  };
}

(async () => {
  const { server, origin } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const report = {
    generatedAt: new Date().toISOString(),
    origin,
    status: 'running',
    viewports: [],
  };
  try {
    for (const viewport of [
      { name: 'desktop-1440', width: 1440, height: 1000, mobile: false },
      { name: 'desktop-1440-dark', width: 1440, height: 1000, mobile: false, dark: true },
      { name: 'tablet-768', width: 768, height: 960, mobile: true },
      { name: 'mobile-390', width: 390, height: 844, mobile: true },
      { name: 'mobile-390-dark', width: 390, height: 844, mobile: true, dark: true },
      { name: 'mobile-320', width: 320, height: 720, mobile: true },
    ]) {
      report.viewports.push(await inspectViewport(browser, origin, viewport));
    }
    report.status = 'pass';
    console.log('Home Refutations box-model browser contract: PASS (desktop and mobile).');
  } catch (error) {
    report.status = 'failure';
    report.failure = {
      name: error?.name || 'Error',
      message: error?.message || String(error),
      stack: error?.stack || '',
    };
    throw error;
  } finally {
    fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
