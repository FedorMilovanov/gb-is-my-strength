#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = join(ROOT, 'reports', 'map-engine-correctness-browser.json');
const ROUTE_PATH = '/karty/avraam/';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = pathname.includes('.') && !pathname.endsWith('/')
        ? join(DIST, pathname.replace(/^\/+/, ''))
        : routeFile(pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
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

const results = [];
function check(name, condition, detail = '') {
  const row = { name, ok: Boolean(condition), detail: String(detail || '') };
  results.push(row);
  if (row.ok) {
    console.log(`✅ ${name}`);
    return;
  }
  console.error(`❌ ${name}${row.detail ? `\n   → ${row.detail}` : ''}`);
  process.exitCode = 1;
}

async function createContext(browser, base, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1200, height: 820 },
    reducedMotion: options.reducedMotion || 'no-preference',
    serviceWorkers: 'block',
  });
  if (options.trackBlockingLoading) {
    await context.addInitScript(() => {
      window.__mapBlockingLoadingSeen = false;
      const appendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function patchedAppendChild(node) {
        if (node instanceof Element && node.classList.contains('me-loading')) {
          window.__mapBlockingLoadingSeen = true;
        }
        return appendChild.call(this, node);
      };
    });
  }
  await context.route('**/*', async (requestRoute) => {
    const request = requestRoute.request();
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return requestRoute.abort();
    if (['image', 'media', 'font'].includes(request.resourceType())) return requestRoute.abort();
    return requestRoute.continue();
  });
  return context;
}

async function openReadyPage(context, base) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const response = await page.goto(base + ROUTE_PATH, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#stage[data-map-state="ready"]', { timeout: 20000 });
  check('Avraam route returns HTTP 200', response?.status() === 200, String(response?.status()));
  check('Avraam route reaches ready MapEngine state', true);
  return { page, pageErrors };
}

function expectedScaleDelta(facts) {
  return Math.abs(facts.lineWidth - facts.expectedWidth);
}

const route = JSON.parse(await readFile(join(DIST, 'karty', 'avraam', 'route.json'), 'utf8'));
const lotStory = route.stories.find((story) => story.id === 'lot');
const akedaStory = route.stories.find((story) => story.id === 'akeda');
const ur = route.places.find((place) => place.id === 'ur');
check('Avraam fixture retains noncontiguous Lot stages [3,5]', JSON.stringify(lotStory?.stages) === '[3,5]', JSON.stringify(lotStory?.stages));
check('Avraam fixture retains a multi-photo Ur dossier', Array.isArray(ur?.photos) && ur.photos.length >= 2, String(ur?.photos?.length || 0));
check('Avraam fixture retains verified waypoints', Array.isArray(route.verified_waypoints) && route.verified_waypoints.length > 0, String(route.verified_waypoints?.length || 0));

const { server, base } = await serve();
const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(explicit && existsSync(explicit) ? { executablePath: explicit } : {});
try {
  // Rendered-width scale + resize + waypoint/readiness/loading ownership.
  {
    const context = await createContext(browser, base, { trackBlockingLoading: true });
    const { page, pageErrors } = await openReadyPage(context, base);
    const scaleFacts = async () => page.evaluate(() => {
      const stage = document.querySelector('#stage');
      const canvas = stage?.querySelector('.me-canvas');
      const svg = canvas?.querySelector('svg');
      const line = stage?.querySelector('#me-scale-line');
      const label = stage?.querySelector('#me-scale-label');
      const viewBox = svg?.viewBox?.baseVal;
      const km = Number.parseFloat(label?.textContent || '');
      const kmPerUnit = window.MapEngine?.distanceKm?.({ x: 0, y: 0 }, { x: 1, y: 0 });
      const renderedWidth = canvas?.getBoundingClientRect().width || 0;
      const lineWidth = line?.getBoundingClientRect().width || 0;
      return {
        renderedWidth,
        viewWidth: viewBox?.width || 0,
        lineWidth,
        km,
        kmPerUnit,
        expectedWidth: km && kmPerUnit && viewBox?.width
          ? km * (renderedWidth / viewBox.width) * (1 / kmPerUnit)
          : 0,
      };
    });
    const before = await scaleFacts();
    check('Scale bar matches rendered canvas geometry before resize', before.renderedWidth > 0 && before.expectedWidth > 0 && expectedScaleDelta(before) <= 2.5, JSON.stringify(before));

    await page.setViewportSize({ width: 760, height: 820 });
    await page.waitForTimeout(120);
    const after = await scaleFacts();
    check('Canvas really resized without a route reload', after.renderedWidth < before.renderedWidth - 100, JSON.stringify({ before, after }));
    check('Scale bar recomputes after rendered-width resize', after.expectedWidth > 0 && expectedScaleDelta(after) <= 2.5, JSON.stringify(after));

    const waypointFacts = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll('#me-waypoints [data-screen-anchor="waypoint"]')];
      return anchors.map((anchor) => {
        const text = anchor.querySelector('text');
        const bg = anchor.querySelector('rect');
        const textRect = text?.getBoundingClientRect();
        const bgRect = bg?.getBoundingClientRect();
        return {
          mapX: anchor.getAttribute('data-map-x'),
          mapY: anchor.getAttribute('data-map-y'),
          textHeight: textRect?.height || 0,
          bgWidth: bgRect?.width || 0,
          bgHeight: bgRect?.height || 0,
        };
      });
    });
    check('Every verified waypoint has one screen-space anchor', waypointFacts.length === route.verified_waypoints.length, JSON.stringify(waypointFacts));
    check('Waypoint anchors retain map coordinates', waypointFacts.every((row) => row.mapX && row.mapY), JSON.stringify(waypointFacts));
    check('Waypoint labels remain CSS-pixel readable with a background', waypointFacts.every((row) => row.textHeight >= 8 && row.textHeight <= 18 && row.bgWidth > 20 && row.bgHeight >= 14), JSON.stringify(waypointFacts));

    const loadingSeen = await page.evaluate(() => Boolean(window.__mapBlockingLoadingSeen));
    check('Ready route data never creates the blocking loading overlay by default', loadingSeen === false, String(loadingSeen));
    check('Scale/waypoint scenario has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  }

  // Reduced motion must apply the camera target in the same JS task.
  {
    const context = await createContext(browser, base, { reducedMotion: 'reduce', viewport: { width: 1000, height: 820 } });
    const { page, pageErrors } = await openReadyPage(context, base);
    const motionFacts = await page.evaluate((storyId) => {
      const svg = document.querySelector('#stage .me-canvas svg');
      const chip = document.querySelector(`.me-story-chip[data-story="${storyId}"]`);
      const before = svg?.getAttribute('viewBox') || '';
      chip?.click();
      const after = svg?.getAttribute('viewBox') || '';
      return { before, after, story: document.querySelector('#stage')?.getAttribute('data-active-story') || '' };
    }, akedaStory.id);
    check('Reduced-motion story selection changes the camera synchronously', motionFacts.story === 'akeda' && motionFacts.after && motionFacts.after !== motionFacts.before, JSON.stringify(motionFacts));
    check('Reduced-motion scenario has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  }

  // Noncontiguous story tour must preserve authored stage identity.
  {
    const context = await createContext(browser, base);
    const { page, pageErrors } = await openReadyPage(context, base);
    await page.evaluate(() => document.querySelector('.me-story-chip[data-story="lot"]')?.click());
    const tourFacts = await page.evaluate(() => {
      document.body.focus();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
      const panel = document.querySelector('.me-panel.me-panel--open');
      return {
        panelOpen: Boolean(panel),
        panelName: panel?.querySelector('.me-panel__name')?.textContent || '',
        panelStage: panel?.querySelector('.me-panel__stage')?.textContent || '',
        captionTitle: document.querySelector('.me-caption__title')?.textContent || '',
        captionStage: document.querySelector('.me-caption__stage')?.textContent || '',
        stage3Transform: document.querySelector('.me-stage-dot[data-stage="3"]')?.style.transform || '',
        stage0Transform: document.querySelector('.me-stage-dot[data-stage="0"]')?.style.transform || '',
      };
    });
    const openedPlace = route.places.find((place) => place.name === tourFacts.panelName);
    const firstLotStage = lotStory.stages[0];
    const expectedStage = route.stages[firstLotStage];
    check('Lot tour opens a dossier from authored stage 3', tourFacts.panelOpen && openedPlace?.stage === firstLotStage && tourFacts.panelStage.includes(expectedStage?.n || ''), JSON.stringify(tourFacts));
    check('Lot tour caption uses authored stage 3 content', tourFacts.captionTitle === (expectedStage?.t || '') && tourFacts.captionStage.includes(expectedStage?.n || ''), JSON.stringify({ tourFacts, expectedStage }));
    check('Lot tour animates the stage-3 dot, not sequence index 0', tourFacts.stage3Transform === 'scale(1.4)' && tourFacts.stage0Transform !== 'scale(1.4)', JSON.stringify(tourFacts));
    check('Tour scenario has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  }

  // Multi-photo modal must open the clicked full-size source and own its index/place.
  {
    const context = await createContext(browser, base);
    const { page, pageErrors } = await openReadyPage(context, base);
    const photoFacts = await page.evaluate(() => {
      document.querySelector('#me-markers [data-place-id="ur"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.querySelector('.me-tab[data-tab="photos"]')?.click();
      document.querySelector('.me-photo-dot[data-idx="1"]')?.click();
      const slides = [...document.querySelectorAll('.me-photo-slide')];
      const image = slides[1]?.querySelector('img');
      image?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return {
        clickableClass: image?.classList.contains('me-clickable-photo') || false,
        photoIndex: image?.getAttribute('data-photo-index') || '',
        fullSource: image?.getAttribute('data-src') || '',
        modalSource: document.querySelector('.me-photo-modal__img')?.getAttribute('src') || '',
        modalOpen: document.querySelector('.me-photo-modal')?.classList.contains('me-photo-modal--open') || false,
      };
    });
    check('Second gallery image carries canonical click/index metadata', photoFacts.clickableClass && photoFacts.photoIndex === '1' && photoFacts.fullSource === ur.photos[1].src, JSON.stringify(photoFacts));
    check('Photo modal opens the canonical full-size second source', photoFacts.modalOpen && photoFacts.modalSource === ur.photos[1].src, JSON.stringify(photoFacts));
    check('Photo scenario has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  }

  // Story search and notifications must remain inside one canonical owner.
  {
    const context = await createContext(browser, base);
    const { page, pageErrors } = await openReadyPage(context, base);
    const storyFacts = await page.evaluate(() => {
      document.querySelector('.me-story-chip[data-story="lot"]')?.click();
      const statuses = [...document.querySelectorAll('.me-toast[role="status"][aria-live="polite"][aria-atomic="true"]')];
      return { count: statuses.length, text: statuses[0]?.textContent || '' };
    });
    check('Map exposes exactly one persistent polite live region', storyFacts.count === 1, JSON.stringify(storyFacts));
    check('Story change announces through the canonical live region', storyFacts.text.includes(lotStory.label), JSON.stringify(storyFacts));

    await page.locator('.me-search').fill(ur.name);
    await page.waitForTimeout(260);
    const searchFacts = await page.evaluate(() => {
      const marker = document.querySelector('#me-markers [data-place-id="ur"]');
      return {
        story: document.querySelector('#stage')?.getAttribute('data-active-story') || '',
        opacity: marker?.style.opacity || '',
      };
    });
    check('Search cannot promote Ur outside the active Lot story', searchFacts.story === 'lot' && searchFacts.opacity === '0', JSON.stringify(searchFacts));
    check('Search/live-region scenario has no page errors', pageErrors.length === 0, pageErrors.join(' | '));
    await context.close();
  }

  await mkdir(join(ROOT, 'reports'), { recursive: true });
  await writeFile(REPORT, JSON.stringify({
    schemaVersion: 1,
    route: ROUTE_PATH,
    status: process.exitCode ? 'failure' : 'pass',
    results,
  }, null, 2) + '\n');

  if (process.exitCode) throw new Error('MapEngine correctness browser contract failed');
  console.log('✅ MapEngine correctness browser contract passed');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
