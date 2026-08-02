#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'reports', 'diotrophes-wave12');
const ROUTE = '/articles/diotrefy-nashego-vremeni/';
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const failures = [];
const results = [];
mkdirSync(OUT, { recursive: true });

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  if (!clean || pathname.endsWith('/')) return join(DIST, clean, 'index.html');
  return join(DIST, clean);
}

const server = createServer((req, res) => {
  try {
    let file = routeFile(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control':'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function record(engine, profile, contract, ok, detail = '') {
  results.push({ engine, profile, contract, ok:Boolean(ok), detail:String(detail || '') });
  if (!ok) failures.push(`${engine}/${profile}/${contract}: ${detail}`);
}

async function inspect(browserType, engine, profile) {
  const browser = await browserType.launch();
  try {
    for (const javaScriptEnabled of [true, false]) {
      const mode = javaScriptEnabled ? 'js' : 'no-js';
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        isMobile: profile.mobile,
        hasTouch: profile.mobile,
        javaScriptEnabled,
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && !/mc\.yandex|ERR_BLOCKED_BY_CLIENT|Failed to load resource|Load failed/i.test(message.text())) consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.route(/mc\.yandex|gospod-bog\.ru/, (request) => request.abort());
      const response = await page.goto(base + ROUTE, { waitUntil: javaScriptEnabled ? 'networkidle' : 'domcontentloaded' });
      record(engine, `${profile.id}-${mode}`, 'http-200', response?.status() === 200, `status=${response?.status()}`);
      const state = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const external = [...document.querySelectorAll('main a[href^="https://"]')].map((node) => node.href);
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim() || '',
          mainCount: document.querySelectorAll('main').length,
          articleCount: document.querySelectorAll('article.article-body').length,
          publicationMarker: document.body.dataset.wave12Publication,
          sourceAuthority: document.querySelector('[data-source-authority]')?.getAttribute('data-source-authority'),
          readerLinks: new Set(external).size,
          hasFaithful: Boolean(document.querySelector('#faithful-witness-under-pressure')),
          hasResponses: Boolean(document.querySelector('#twenty-faithful-responses')),
          draftLeak: /PUBLICATION_HOLD|ещё не зарегистрирован как публичный маршрут/.test(bodyText),
          horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          robots: document.querySelector('meta[name="robots"]')?.content || '',
        };
      });
      record(engine, `${profile.id}-${mode}`, 'single-main', state.mainCount === 1, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'single-article', state.articleCount === 1, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'title-h1', state.h1 === 'Диотрефы нашего времени' && state.title.includes('Диотрефы нашего времени'), JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'publication-marker', state.publicationMarker === 'true', JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'authority-marker', state.sourceAuthority === '148', JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'reader-links', state.readerLinks === 73, `unique=${state.readerLinks}`);
      record(engine, `${profile.id}-${mode}`, 'faithful-sections', state.hasFaithful && state.hasResponses, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'no-draft-leak', !state.draftLeak, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'no-horizontal-overflow', state.horizontalOverflow <= 1, `overflow=${state.horizontalOverflow}`);
      record(engine, `${profile.id}-${mode}`, 'canonical-index', state.canonical.endsWith(ROUTE) && /index/.test(state.robots), JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'console-clean', consoleErrors.length === 0, consoleErrors.join(' | '));
      record(engine, `${profile.id}-${mode}`, 'page-clean', pageErrors.length === 0, pageErrors.join(' | '));
      if (javaScriptEnabled) {
        await page.screenshot({ path: join(OUT, `${engine}-${profile.id}.png`), fullPage: true });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await inspect(chromium, 'chromium', { id:'android-390', width:390, height:844, mobile:true });
  await inspect(chromium, 'chromium', { id:'desktop-1440', width:1440, height:900, mobile:false });
  await inspect(webkit, 'webkit', { id:'iphone-390', width:390, height:844, mobile:true });
  await inspect(webkit, 'webkit', { id:'desktop-1440', width:1440, height:900, mobile:false });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width:1240, height:900 } });
    await page.route(/mc\.yandex|gospod-bog\.ru/, (request) => request.abort());
    await page.goto(base + ROUTE, { waitUntil:'networkidle' });
    await page.emulateMedia({ media:'print' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      for (const image of document.images) { image.loading = 'eager'; image.fetchPriority = 'high'; }
      await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
    });
    const pdfPath = join(OUT, 'diotrophes-wave12.pdf');
    await page.pdf({ path:pdfPath, format:'A4', printBackground:true, margin:{ top:'12mm', right:'10mm', bottom:'12mm', left:'10mm' } });
    const bytes = statSync(pdfPath).size;
    record('chromium', 'print-a4', 'pdf-size', bytes > 150_000, `bytes=${bytes}`);
    if (existsSync('/usr/bin/pdfinfo') && existsSync('/usr/bin/pdftotext')) {
      const info = execFileSync('/usr/bin/pdfinfo', [pdfPath], { encoding:'utf8' });
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
      const textPath = join(OUT, 'diotrophes-wave12.txt');
      execFileSync('/usr/bin/pdftotext', [pdfPath, textPath]);
      const pdfText = readFileSync(textPath, 'utf8');
      record('chromium', 'print-a4', 'page-count', pages >= 8 && pages <= 120, `pages=${pages}`);
      record('chromium', 'print-a4', 'first-and-last-content', pdfText.includes('Диотрефы нашего времени') && pdfText.includes('Практическая лестница различения'), `pages=${pages}`);
    } else {
      record('chromium', 'print-a4', 'poppler-present', false, 'pdfinfo/pdftotext missing');
    }
  } finally {
    await browser.close();
  }
} finally {
  server.close();
}

writeFileSync(join(OUT, 'browser-contract.json'), JSON.stringify({ route:ROUTE, results, failures }, null, 2));
if (failures.length) {
  console.error(`❌ Wave 12 browser contract failed (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✅ Wave 12 browser contract passed (${results.length} checks)`);
