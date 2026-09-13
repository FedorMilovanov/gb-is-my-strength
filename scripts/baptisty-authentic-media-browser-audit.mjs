#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'baptisty-authentic-media-browser-audit.json');

const ROUTES = [
  { slug: 'noch-na-kure', evidence: 2, journey: 0, status: 0 },
  { slug: 'yuzhnaya-shtunda', evidence: 2, journey: 0, status: 0 },
  { slug: 'dva-sezda-1884', evidence: 1, journey: 0, status: 0 },
  { slug: 'peterburgskaya-liniya', evidence: 3, journey: 0, status: 0 },
  { slug: 'goneniya-i-sovest', evidence: 0, journey: 1, status: 0 },
  { slug: 'sovetskaya-noch', evidence: 1, journey: 0, status: 0 },
  { slug: 'vsehib-1944', evidence: 1, journey: 0, status: 0 },
  { slug: 'iniciativnaya-gruppa', evidence: 3, journey: 0, status: 0 },
  { slug: 'podpolnaya-pechat', evidence: 3, journey: 1, status: 0 },
  { slug: 'spravochnik', evidence: 0, journey: 2, status: 1 },
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 },
};
function contentType(filePath) {
  const map = {
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
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return map[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function createServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
        const rel = pathname.endsWith('/') ? pathname.slice(1) + 'index.html' : pathname.slice(1);
        const file = path.resolve(DIST, rel);
        if (!(file === DIST || file.startsWith(DIST + path.sep))) {
          res.statusCode = 403;
          res.end('forbidden');
          return;
        }
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', contentType(file));
        res.setHeader('Cache-Control', 'no-store');
        fs.createReadStream(file).pipe(res);
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function forceLazyContent(page) {
  const images = page.locator('.article-body img');
  const count = await images.count();
  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    try {
      await page.waitForFunction(
        (imageIndex) => {
          const img = document.querySelectorAll('.article-body img')[imageIndex];
          return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
        },
        index,
        { timeout: 1500, polling: 50 },
      );
    } catch {
      // Measurement below records exact unresolved images and fails the case.
    }
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const article = document.querySelector('.article-body');
    const articleRect = article?.getBoundingClientRect();
    const scrollY = window.scrollY;
    const articleTop = articleRect ? articleRect.top + scrollY : 0;
    const articleBottom = articleRect ? articleRect.bottom + scrollY : 0;
    const selector = [
      '.article-body > figure',
      '.article-body .gbs2-atlas-figure',
      '.article-body .baptist-authentic-media',
      '.article-body .baptist-evidence-journey',
      '.article-body .baptist-research-status',
      '.article-body [data-baptist-master-evidence]',
    ].join(',');
    const raw = [...document.querySelectorAll(selector)]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top + scrollY, bottom: rect.bottom + scrollY };
      })
      .filter((item) => item.bottom > articleTop && item.top < articleBottom)
      .sort((a, b) => a.top - b.top);
    const landmarks = [];
    for (const item of raw) {
      const last = landmarks[landmarks.length - 1];
      if (last && item.top >= last.top && item.bottom <= last.bottom) continue;
      landmarks.push(item);
    }
    let maxVisualGap = Math.max(0, articleBottom - articleTop);
    if (landmarks.length) {
      maxVisualGap = Math.max(
        0,
        landmarks[0].top - articleTop,
        articleBottom - landmarks[landmarks.length - 1].bottom,
      );
      for (let index = 1; index < landmarks.length; index += 1) {
        maxVisualGap = Math.max(maxVisualGap, landmarks[index].top - landmarks[index - 1].bottom);
      }
    }
    const images = [...document.querySelectorAll('.article-body img')].map((img) => ({
      src: img.getAttribute('src') || '',
      currentSrc: img.currentSrc || '',
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      renderedWidth: Math.round(img.getBoundingClientRect().width),
      renderedHeight: Math.round(img.getBoundingClientRect().height),
    }));
    const overflowEls = [...document.querySelectorAll('.article-body *')].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left < -1 || rect.right > window.innerWidth + 1;
    }).length;
    return {
      title: document.title,
      bodyTextLength: document.body?.innerText?.trim().length || 0,
      articleHeight: Math.round(Math.max(0, articleBottom - articleTop)),
      pageScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflowEls,
      evidenceCount: document.querySelectorAll('[data-baptist-master-evidence]').length,
      authenticBlockCount: document.querySelectorAll('.baptist-authentic-media').length,
      journeyCount: document.querySelectorAll('.baptist-evidence-journey').length,
      statusCount: document.querySelectorAll('.baptist-research-status').length,
      atlasCount: document.querySelectorAll('.gbs2-atlas-figure').length,
      maxVisualGap: Math.round(maxVisualGap),
      landmarkCount: landmarks.length,
      images,
      scheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    };
  });
}

if (!fs.existsSync(DIST)) {
  console.error('❌ dist missing; run production-like build first');
  process.exit(1);
}

const server = await createServer();
const port = server.address().port;
const base = 'http://127.0.0.1:' + port;
const results = [];
const problems = [];

try {
  for (const browserEntry of Object.entries({ chromium, webkit })) {
    const browserName = browserEntry[0];
    const browserType = browserEntry[1];
    const browser = await browserType.launch({ headless: true });
    try {
      for (const viewportEntry of Object.entries(VIEWPORTS)) {
        const viewportName = viewportEntry[0];
        const viewport = viewportEntry[1];
        for (const theme of ['light', 'dark']) {
          for (const route of ROUTES) {
            const context = await browser.newContext({
              viewport: viewport,
              colorScheme: theme,
              serviceWorkers: 'block',
              reducedMotion: 'reduce',
            });
            const page = await context.newPage();
            const pageErrors = [];
            const consoleErrors = [];
            const localFailedRequests = [];
            page.on('pageerror', function (error) {
              pageErrors.push(String(error && error.stack ? error.stack : error));
            });
            page.on('console', function (message) {
              if (message.type() === 'error') consoleErrors.push(message.text());
            });
            page.on('requestfailed', function (request) {
              if (request.url().startsWith(base)) localFailedRequests.push(request.url());
            });
            const url = base + '/baptisty-rossii/' + route.slug + '/';
            const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
            await forceLazyContent(page);
            const metrics = await measure(page);
            const failedImages = metrics.images.filter(function (img) {
              return !img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0;
            });
            const overflow = metrics.pageScrollWidth > metrics.viewportWidth + 1 || metrics.overflowEls > 0;
            const prefix = browserName + '/' + viewportName + '/' + theme + '/' + route.slug;

            results.push({
              browser: browserName,
              viewport: viewportName,
              theme: theme,
              route: route.slug,
              status: response ? response.status() : null,
              metrics: metrics,
              failedImages: failedImages,
              pageErrors: pageErrors,
              consoleErrors: consoleErrors,
              localFailedRequests: localFailedRequests,
            });

            if (!response || response.status() !== 200) problems.push(prefix + ': non-200 response');
            if (metrics.bodyTextLength < 500) problems.push(prefix + ': body too short');
            if (failedImages.length) problems.push(prefix + ': failed images=' + failedImages.length);
            if (overflow) problems.push(prefix + ': horizontal overflow');
            if (pageErrors.length) problems.push(prefix + ': page errors=' + pageErrors.length);
            if (localFailedRequests.length) problems.push(prefix + ': local failed requests=' + localFailedRequests.length);
            if (metrics.evidenceCount !== route.evidence) problems.push(prefix + ': evidence count mismatch');
            if (metrics.journeyCount !== route.journey) problems.push(prefix + ': journey count mismatch');
            if (metrics.statusCount !== route.status) problems.push(prefix + ': status count mismatch');
            if (metrics.atlasCount < 1) problems.push(prefix + ': atlas missing');
            if (metrics.scheme !== theme) problems.push(prefix + ': color scheme mismatch');
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}
const summaries = {};
for (const route of ROUTES) {
  summaries[route.slug] = {};
  for (const viewportName of Object.keys(VIEWPORTS)) {
    const slice = results.filter(function (item) {
      return item.route === route.slug && item.viewport === viewportName;
    });
    const gaps = slice.map(function (item) { return item.metrics.maxVisualGap; });
    const heights = slice.map(function (item) { return item.metrics.articleHeight; });
    summaries[route.slug][viewportName] = {
      maxVisualGap: Math.max.apply(null, gaps),
      minVisualGap: Math.min.apply(null, gaps),
      maxArticleHeight: Math.max.apply(null, heights),
      evidence: route.evidence,
      journey: route.journey,
      status: route.status,
      landmarkCount: Math.min.apply(null, slice.map(function (item) {
        return item.metrics.landmarkCount;
      })),
    };
  }
}

const report = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  matrix: {
    browsers: ['chromium', 'webkit'],
    viewports: VIEWPORTS,
    themes: ['light', 'dark'],
    routes: ROUTES.map(function (route) { return route.slug; }),
    cases: results.length,
  },
  summaries: summaries,
  problems: problems,
  results: results,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

console.log('\nBAPTIST AUTHENTIC MEDIA BROWSER MATRIX');
console.log('cases=' + results.length + ' problems=' + problems.length);
for (const route of ROUTES) {
  const d = summaries[route.slug].desktop;
  const m = summaries[route.slug].mobile;
  console.log(
    route.slug.padEnd(24) +
    ' desktop-gap=' + String(d.maxVisualGap).padStart(5) +
    ' mobile-gap=' + String(m.maxVisualGap).padStart(5) +
    ' evidence=' + route.evidence +
    ' journey=' + route.journey +
    ' status=' + route.status
  );
}

if (problems.length) {
  console.log('\n❌ Browser contract failures:');
  for (const problem of problems) console.log('- ' + problem);
  process.exit(1);
}
console.log('\n✅ 80/80 Baptist browser cases pass Chromium/WebKit × desktop/mobile × light/dark.');
