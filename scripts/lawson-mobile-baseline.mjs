import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const REPORT_DIR = join(ROOT, 'reports', 'tmp');
await mkdir(REPORT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
};

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      let pathname = url.pathname;
      let file;
      if (pathname.includes('.') && !pathname.endsWith('/')) {
        file = join(DIST, pathname.replace(/^\/+/, ''));
      } else {
        file = routeFile(pathname);
        try {
          if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        } catch {}
      }
      // Fallback to dist file directly if exists
      if (!existsSync(file)) {
        const alt = join(DIST, pathname.replace(/^\/+/, ''));
        if (existsSync(alt)) file = alt;
      }
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch (e) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found: ' + e.message);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

const execPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/tmp/chrome.sh';
console.log(`Using chromium: ${execPath}`);

const { server, base } = await serve();
console.log(`Serving dist at ${base}`);

const browser = await chromium.launch({
  executablePath: execPath,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const viewports = [
  { w: 320, h: 760 },
  { w: 360, h: 800 },
  { w: 390, h: 844 },
  { w: 412, h: 915 },
  { w: 430, h: 932 },
];

const routes = [
  '/articles/steven-lawson-samoobman-i-publichnyy-golos/',
  '/articles/serdce-i-sokrovishche/',
  '/articles/krajne-li-isporcheno-serdce/',
  '/baptisty-rossii/peterburgskaya-liniya/',
  '/nagornaya/chast-1/',
];

for (const route of routes) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const url = base + route;
    console.log(`\n=== ${route} ${vp.w}x${vp.h} ===`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    // Wait for fonts
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    // Check for leaked menu
    const leaked = await page.evaluate(() => {
      const nav = document.querySelector('.astro-header__nav');
      if (!nav) return { exists: false };
      const rect = nav.getBoundingClientRect();
      const style = getComputedStyle(nav);
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        rect: { top: rect.top, bottom: rect.bottom, height: rect.height, width: rect.width },
        text: nav.textContent?.slice(0,200),
      };
    });
    console.log('leaked nav:', leaked);

    const headerInfo = await page.evaluate(() => {
      const header = document.querySelector('.astro-header');
      if (!header) return null;
      const r = header.getBoundingClientRect();
      const s = getComputedStyle(header);
      return { display: s.display, height: r.height, top: r.top, bottom: r.bottom };
    });
    console.log('header:', headerInfo);

    const mobileTop = await page.evaluate(() => {
      const el = document.querySelector('.hmtop');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { display: s.display, height: r.height, top: r.top, bottom: r.bottom };
    });
    console.log('hmtop:', mobileTop);

    const mobileBottom = await page.evaluate(() => {
      const el = document.querySelector('.hmbar');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { display: s.display, height: r.height, top: r.top, bottom: r.bottom };
    });
    console.log('hmbar:', mobileBottom);

    const h1Info = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      if (!h1) return null;
      const r = h1.getBoundingClientRect();
      return { text: h1.textContent?.slice(0,100), height: r.height, top: r.top, bottom: r.bottom, fontSize: getComputedStyle(h1).fontSize };
    });
    console.log('h1:', h1Info);

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Screenshot
    const safeRoute = route.replace(/[^a-z0-9]/gi, '_').replace(/^_+|_+$/g, '');
    const fileName = `${safeRoute}_${vp.w}x${vp.h}.png`;
    const filePath = join(REPORT_DIR, fileName);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`Screenshot saved: ${filePath}`);

    // Also full page for first viewport
    if (vp.w === 390) {
      const fullPath = join(REPORT_DIR, `${safeRoute}_${vp.w}x${vp.h}_full.png`);
      await page.screenshot({ path: fullPath, fullPage: true });
      console.log(`Full screenshot: ${fullPath}`);
    }

    await context.close();
  }
}

await browser.close();
server.close();
console.log('\nDone');
