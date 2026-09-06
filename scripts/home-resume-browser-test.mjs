#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const DIST = join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

if (!existsSync(DIST)) throw new Error('home resume browser contract requires built dist/');

async function resolveDistFile(urlPath) {
  const clean = decodeURIComponent(String(urlPath || '/').split('?')[0]);
  const normalized = normalize(clean).replace(/^([/\\])+/, '');
  const candidate = resolve(DIST, normalized || '.');
  if (candidate !== DIST && !candidate.startsWith(DIST + sep)) return null;
  try {
    if ((await stat(candidate)).isDirectory()) return join(candidate, 'index.html');
    return candidate;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const file = await resolveDistFile(req.url);
    if (!file) throw new Error('not found');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const base = `http://127.0.0.1:${server.address().port}`;

let browser;
try {
  const pinnedChromium = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
  browser = await chromium.launch(existsSync(pinnedChromium) ? { executablePath: pinnedChromium } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.route(/gospod-bog\.ru|mc\.yandex/, (route) => route.abort());

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const bootstrap = await page.evaluate(() => ({
    siteId: String(window.SITE_CONFIG?.site?.id || window.SITE_CONFIG?.siteId || ''),
    enabled: Boolean(window.SITE_CONFIG?.features?.homepageResume?.enabled),
    readerState: Boolean(window.GBReaderState?.listSaved && window.GBReaderState?.dismissSaved),
  }));
  if (!bootstrap.siteId || !bootstrap.enabled || !bootstrap.readerState) {
    throw new Error(`homepage resume bootstrap missing: ${JSON.stringify(bootstrap)}`);
  }

  const fixture = await page.evaluate(({ siteId }) => {
    const prefix = `gb:reader-state:v1:${siteId}:`;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith(prefix)) localStorage.removeItem(key);
    }
    const now = Date.now();
    const primaryRoute = '/articles/novoe-serdce';
    const secondaryRoute = '/baptisty-rossii/podpolnaya-pechat';
    localStorage.setItem(prefix + primaryRoute, JSON.stringify({
      version: 1,
      routePath: '//evil.example/tampered-payload',
      title: 'Продолжить: Новое сердце',
      sectionTitle: 'Глава 4',
      progress: 64,
      scrollY: 1400,
      completed: false,
      savedAt: now,
      dismissedAt: 0,
      source: 'reader-state-v1',
    }));
    localStorage.setItem(prefix + secondaryRoute, JSON.stringify({
      version: 1,
      routePath: secondaryRoute,
      title: '<img src=x onerror="window.__resumeXss=1"> Подпольная печать',
      sectionTitle: 'Самиздат',
      progress: 41,
      scrollY: 900,
      completed: false,
      savedAt: now - 1000,
      dismissedAt: 0,
      source: 'reader-state-v1',
    }));
    localStorage.setItem(prefix + '//evil.example/off-origin', JSON.stringify({
      title: 'Off-origin trap', progress: 88, savedAt: now + 5000,
    }));
    localStorage.setItem(prefix + '/articles/completed', JSON.stringify({
      title: 'Completed trap', progress: 100, completed: true, savedAt: now + 4000,
    }));
    return { prefix, primaryRoute, secondaryRoute };
  }, { siteId: bootstrap.siteId });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#resumeReadingBlock:not([hidden])', { timeout: 8000 });

  const beforeDismiss = await page.evaluate(() => {
    const link = document.getElementById('resumeReadingLink');
    const listLinks = [...document.querySelectorAll('#resumeList a')];
    return {
      title: document.getElementById('resumeReadingTitle')?.textContent || '',
      meta: document.getElementById('resumeReadingMeta')?.textContent || '',
      href: link?.href || '',
      pathname: link ? new URL(link.href).pathname : '',
      progress: document.getElementById('resumeReadingProgressTrack')?.getAttribute('aria-valuenow'),
      listCount: listLinks.length,
      listText: listLinks.map((node) => node.textContent || ''),
      listImages: document.querySelectorAll('#resumeList img').length,
      xss: window.__resumeXss || 0,
      inventory: window.GBReaderState.listSaved({ maxItems: 5 }).map((item) => item.routePath),
    };
  });

  if (beforeDismiss.title !== 'Продолжить: Новое сердце') throw new Error(`wrong primary title: ${beforeDismiss.title}`);
  if (beforeDismiss.pathname !== fixture.primaryRoute) throw new Error(`storage-key route authority lost: ${beforeDismiss.pathname}`);
  if (!beforeDismiss.meta.includes('64%') || beforeDismiss.progress !== '64') throw new Error(`progress projection mismatch: ${JSON.stringify(beforeDismiss)}`);
  if (beforeDismiss.listCount !== 1 || !beforeDismiss.listText[0]?.includes('<img src=x')) throw new Error(`secondary inventory mismatch: ${JSON.stringify(beforeDismiss)}`);
  if (beforeDismiss.listImages !== 0 || beforeDismiss.xss !== 0) throw new Error('stored title escaped textContent boundary');
  if (beforeDismiss.inventory.includes('//evil.example/off-origin') || beforeDismiss.inventory.includes('/articles/completed')) {
    throw new Error(`unsafe/completed snapshot entered inventory: ${JSON.stringify(beforeDismiss.inventory)}`);
  }
  if (new URL(beforeDismiss.href).origin !== new URL(base).origin) throw new Error(`resume link escaped origin: ${beforeDismiss.href}`);

  await page.click('#resumeReadingDismiss');
  await page.waitForFunction((route) => new URL(document.getElementById('resumeReadingLink').href).pathname === route, fixture.secondaryRoute);

  const afterDismiss = await page.evaluate(({ prefix, primaryRoute }) => {
    const raw = JSON.parse(localStorage.getItem(prefix + primaryRoute));
    return {
      title: document.getElementById('resumeReadingTitle')?.textContent || '',
      dismissedAt: Number(raw?.dismissedAt || 0),
      remaining: window.GBReaderState.listSaved({ maxItems: 5 }).map((item) => item.routePath),
    };
  }, fixture);
  if (!afterDismiss.title.includes('Подпольная печать')) throw new Error(`dismiss did not advance inventory: ${JSON.stringify(afterDismiss)}`);
  if (!(afterDismiss.dismissedAt > 0) || afterDismiss.remaining.includes(fixture.primaryRoute)) {
    throw new Error(`ReaderState dismissal did not persist/filter: ${JSON.stringify(afterDismiss)}`);
  }
  if (pageErrors.length) throw new Error(`homepage emitted page errors: ${pageErrors.join(' | ')}`);

  console.log('HOME RESUME BROWSER CONTRACT: PASS');
  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
