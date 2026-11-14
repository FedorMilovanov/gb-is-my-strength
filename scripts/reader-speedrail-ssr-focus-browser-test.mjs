#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT = path.join(ROOT, 'reports', 'reader-speedrail-ssr-focus');
const browsers = { chromium, webkit };
const representativeRoutes = [
  '/articles/krajne-li-isporcheno-serdce/',
  '/hard-texts/duhi-v-temnice-noi-kreshchenie-pobeda/',
  '/baptisty-rossii/noch-na-kure/',
];

function type(file) {
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
  }[path.extname(file)] || 'application/octet-stream';
}

function resolvePath(value) {
  const url = new URL(value || '/', 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);
  const relative = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const indexCandidate = path.join(candidate, 'index.html');
  return fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile() ? indexCandidate : null;
}

async function server() {
  const instance = http.createServer((request, response) => {
    const file = resolvePath(request.url);
    if (!file) {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', type(file));
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  return {
    base: `http://127.0.0.1:${instance.address().port}`,
    close: () => new Promise((resolve) => instance.close(resolve)),
  };
}

function routeFromFile(file) {
  const relative = path.relative(DIST, file).split(path.sep).join('/');
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -'index.html'.length)}`;
  return `/${relative}`;
}

function hasHiddenSpeedrail(html) {
  const openingTags = String(html).match(/<[^>]+>/g) || [];
  return openingTags.some((tag) =>
    /class=(['"])[^'"<>]*\bmobile-speedrail\b[^'"<>]*\1/i.test(tag) &&
    /aria-hidden=(['"])true\1/i.test(tag)
  );
}

function affectedRoutes() {
  const files = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && file.endsWith('.html')) files.push(file);
    }
  }
  walk(DIST);
  const routes = files
    .filter((file) => hasHiddenSpeedrail(fs.readFileSync(file, 'utf8')))
    .map(routeFromFile)
    .sort();
  assert.ok(routes.length > 0, 'no hidden speedrail routes in built dist');
  for (const route of representativeRoutes) {
    assert.ok(routes.includes(route), `representative hidden-speedrail route missing from family: ${route}`);
  }
  return routes;
}

async function inspectRoute(page, kind, route, { focusWitness = false } = {}) {
  const pageErrors = [];
  const onPageError = (error) => pageErrors.push(String(error?.stack || error));
  page.on('pageerror', onPageError);
  try {
    // WebKit may dispatch DOMContentLoaded before the external canonical CSS
    // has finished loading. Wait for load before measuring the JS-off surface.
    const response = await page.goto(route, { waitUntil: 'load' });
    assert.ok(response?.ok(), `${kind} ${route}: load failed`);
    const state = await page.evaluate(() => {
      const rails = [...document.querySelectorAll('.reader-mobile-speedrail[aria-hidden="true"], .mobile-speedrail[aria-hidden="true"]')];
      return rails.map((rail) => ({
        id: rail.id || '',
        display: getComputedStyle(rail).display,
        opacity: Number(getComputedStyle(rail).opacity),
        pointerEvents: getComputedStyle(rail).pointerEvents,
        inert: rail.inert,
        rects: rail.getClientRects().length,
        focusableRects: [...rail.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
          .map((node) => ({
            tag: node.tagName,
            tabIndex: node.tabIndex,
            rects: node.getClientRects().length,
          })),
      }));
    });
    assert.ok(state.length > 0, `${kind} ${route}: hidden speedrail missing`);
    for (const rail of state) {
      // Closed rails may retain geometry to animate into the shared slot.
      // JS-off safety is an invisible, non-pointer, inert subtree, not display:none.
      const physicallyHidden = rail.display === 'none' || rail.rects === 0;
      const semanticallyHidden = rail.inert && rail.opacity <= 0.01 && rail.pointerEvents === 'none';
      assert.ok(physicallyHidden || semanticallyHidden,
        `${kind} ${route}: closed rail ${rail.id || '(no id)'} is visible or interactive: ${JSON.stringify(rail)}`);
      assert.ok(rail.inert || rail.focusableRects.every(item => item.rects === 0),
        `${kind} ${route}: closed rail descendants remain keyboard accessible`);
    }

    let trace = [];
    if (focusWitness) {
      // Learning moved inside Settings; begin the JS-off tab witness at the
      // currently visible mobile settings trigger, not a hidden legacy control.
      const start = page.locator('#mobSettingsBtn:visible, #hmSettingsBtn:visible').first();
      await start.waitFor({ state: 'visible' });
      await start.focus();
      for (let index = 0; index < 10; index += 1) {
        await page.keyboard.press('Tab');
        trace.push(await page.evaluate(() => Boolean(document.activeElement?.closest?.('.reader-mobile-speedrail[aria-hidden="true"], .mobile-speedrail[aria-hidden="true"]'))));
      }
      assert.ok(trace.every((entered) => !entered), `${kind} ${route}: Tab entered hidden rail`);
    }

    assert.deepEqual(pageErrors, [], `${kind} ${route}: uncaught page errors`);
    return { kind, route, rails: state, focusWitness, trace, pageErrors };
  } finally {
    page.off('pageerror', onPageError);
  }
}

async function main() {
  fs.mkdirSync(REPORT, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing');
  const routes = affectedRoutes();
  const instance = await server();
  const results = [];
  try {
    for (const [kind, browserType] of Object.entries(browsers)) {
      const browser = await browserType.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        for (const route of routes) {
          results.push(await inspectRoute(page, kind, `${instance.base}${route}`, {
            focusWitness: representativeRoutes.includes(route),
          }));
        }
      } finally {
        await context.close();
        await browser.close();
      }
    }
  } finally {
    await instance.close();
  }

  const evidence = {
    schemaVersion: 3,
    conclusion: 'success',
    sha: process.env.SOURCE_SHA || '',
    browsers: Object.keys(browsers),
    affectedRoutes: routes,
    representativeRoutes,
    cases: results.length,
    results,
  };
  fs.writeFileSync(path.join(REPORT, 'result.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Reader speedrail SSR focus: PASS (${routes.length} routes x ${Object.keys(browsers).length} browsers)`);
}

main().catch((error) => {
  fs.mkdirSync(REPORT, { recursive: true });
  fs.writeFileSync(path.join(REPORT, 'result.json'), `${JSON.stringify({ schemaVersion: 3, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
