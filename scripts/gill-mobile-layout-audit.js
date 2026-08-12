#!/usr/bin/env node
'use strict';

/**
 * Gill mobile reference layout audit.
 *
 * Verifies the actual Android/Yandex regression:
 * - bottom bar must be readable with the intended frosted surface in light/dark;
 * - backdrop blur and a protective minimum alpha must remain active;
 * - article text must not leak through or under it;
 * - old root-static one-level bar must be upgraded by JS;
 * - explicit Part TOC trigger must exist and open #partTocOverlay;
 * - Series TOC trigger must open #seriesTocOverlay;
 * - generic fallback controls must not float over Gill mobile content;
 * - no horizontal overflow on 360/390px.
 *
 * Oracle authority:
 * - every failure is tied to one route/viewport/theme case;
 * - request and HTTP failures retain URL/method/resource type provenance;
 * - mandatory Product resources fail closed;
 * - explicitly known optional external resources are diagnostics, never blanket ignores;
 * - unknown/unattributed resource or console failures fail the oracle authority;
 * - all 24 Gill browser cases must be recorded, completed, and fully exercised.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'gill-mobile-layout-audit-2026-06-29');
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  '/articles/dzhon-gill-chast-1-chelovek/',
  '/articles/dzhon-gill-chast-2-uchenyi/',
  '/articles/dzhon-gill-chast-3-nasledie/',
  '/articles/dzhon-gill-chast-4-ekzeget/',
  '/articles/dzhon-gill-istoricheskiy-kontekst/',
  '/articles/dzhon-gill-spravochnik/',
];
const VIEWPORTS = [
  { name: 'mobile', width: 360, height: 740 },
  { name: 'mobile-wide', width: 390, height: 844 },
];
const THEMES = ['light', 'dark'];
const EXPECTED_CASES = ROUTES.length * VIEWPORTS.length * THEMES.length;
const SELF_TEST_ONLY = process.argv.includes('--authority-self-test');

let BASE = (process.env.AUDIT_BASE || '').replace(/\/$/, '');
const failures = [];
const diagnostics = [];
const cases = [];
const proof = {
  generatedAt: new Date().toISOString(),
  base: '',
  expectedCases: EXPECTED_CASES,
  checks: [],
  diagnostics,
  cases,
  failures,
};

function ok(name, detail = {}) {
  proof.checks.push({ ok: true, name, detail });
  console.log('✅ ' + name);
}
function fail(name, detail = {}) {
  const item = { ok: false, name, detail };
  proof.checks.push(item);
  failures.push(item);
  console.error('❌ ' + name + (detail ? ' — ' + JSON.stringify(detail) : ''));
}
function assert(cond, name, detail = {}) { cond ? ok(name, detail) : fail(name, detail); }
function diagnostic(category, detail = {}) {
  const item = { category, detail };
  diagnostics.push(item);
  console.warn('ℹ️ ' + category + (detail ? ' — ' + JSON.stringify(detail) : ''));
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  if (file.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function serveDist() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ not found. Run `npm run strangler:build:production-like` first.');
  }
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://127.0.0.1');
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';
        const file = path.join(DIST, pathname.replace(/^\//, ''));
        if (!file.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }
        if (!fs.existsSync(file)) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
      } catch (err) {
        res.writeHead(500); res.end(String(err && err.stack || err));
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function alphaFromColor(value) {
  const str = String(value || '').trim();
  if (str.startsWith('rgba(')) {
    const parts = str.slice(5, -1).split(',').map(s => s.trim());
    return Number(parts[3]);
  }
  if (str.startsWith('rgb(')) return 1;
  if (str === 'transparent') return 0;
  return 1;
}

function rgbTriplet(value) {
  const str = String(value || '').trim();
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map(s => Number(String(s).trim()));
  if (parts.length < 3 || parts.slice(0, 3).some(n => Number.isNaN(n))) return null;
  return parts.slice(0, 3);
}
function relLum(rgb) {
  return rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrastRatio(a, b) {
  const ra = rgbTriplet(a), rb = rgbTriplet(b);
  if (!ra || !rb) return null;
  const l1 = relLum(ra), l2 = relLum(rb);
  const high = Math.max(l1, l2), low = Math.min(l1, l2);
  return (high + 0.05) / (low + 0.05);
}

function isProductionIconPath(pathname) {
  const value = String(pathname || '').toLowerCase();
  return value.includes('favicon') ||
    value.includes('apple-touch-icon') ||
    /\/icons\/icon-[^/]+$/.test(value);
}

function isTelemetryHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'mc.yandex.ru' ||
    host.endsWith('.mc.yandex.ru') ||
    host === 'mc.yandex.com' ||
    host.endsWith('.mc.yandex.com');
}

function classifyResourceUrl(rawUrl, base = BASE) {
  let url;
  let baseUrl;
  try {
    url = new URL(rawUrl, base || 'http://127.0.0.1');
    baseUrl = new URL(base || 'http://127.0.0.1');
  } catch (_) {
    return { category: 'unknown-invalid-url', hardFail: true };
  }

  const host = url.hostname.toLowerCase();
  const productHost = host === 'gospod-bog.ru' || host === 'www.gospod-bog.ru';

  if (url.origin === baseUrl.origin) {
    return { category: 'mandatory-same-origin', hardFail: true };
  }
  if (productHost && isProductionIconPath(url.pathname)) {
    return { category: 'optional-production-icon', hardFail: false };
  }
  if (isTelemetryHost(host)) {
    return { category: 'optional-telemetry', hardFail: false };
  }
  if (
    (host === '127.0.0.1' || host === 'localhost') &&
    url.port === '9' &&
    url.pathname === '/gill-console-error-probe'
  ) {
    return { category: 'test-environment-probe', hardFail: false };
  }
  if (productHost) {
    return { category: 'mandatory-product-absolute', hardFail: true };
  }
  return { category: 'unknown-external', hardFail: true };
}

function runAuthoritySelfTests() {
  const base = 'http://127.0.0.1:4173';
  const fixtures = [
    ['same-origin Product CSS', `${base}/css/site.css`, 'mandatory-same-origin', true],
    ['production absolute icon', 'https://gospod-bog.ru/favicon.ico', 'optional-production-icon', false],
    ['Yandex telemetry', 'https://mc.yandex.ru/watch/123', 'optional-telemetry', false],
    ['test-environment probe', 'http://127.0.0.1:9/gill-console-error-probe', 'test-environment-probe', false],
    ['unknown external script', 'https://example.invalid/app.js', 'unknown-external', true],
    ['production absolute Product JS', 'https://gospod-bog.ru/js/site.js', 'mandatory-product-absolute', true],
  ];
  for (const [name, url, category, hardFail] of fixtures) {
    const actual = classifyResourceUrl(url, base);
    assert(
      actual.category === category && actual.hardFail === hardFail,
      `Oracle classifier fixture: ${name}`,
      { url, expected: { category, hardFail }, actual },
    );
  }
}

function requestEvidence(request) {
  const failure = request.failure();
  return {
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    errorText: failure ? failure.errorText : null,
  };
}

function responseEvidence(response) {
  const request = response.request();
  return {
    url: response.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    status: response.status(),
    statusText: response.statusText(),
  };
}

function caseDetail(identity) {
  return {
    route: identity.route,
    viewport: identity.viewport,
    width: identity.width,
    height: identity.height,
    theme: identity.theme,
  };
}

function caseLabel(identity) {
  return `${identity.route} ${identity.width}x${identity.height}-${identity.theme}`;
}

function resourceFailureName(prefix, classification, identity) {
  if (classification.category === 'mandatory-same-origin') {
    return `${prefix} mandatory same-origin resource ${caseLabel(identity)}`;
  }
  if (classification.category === 'mandatory-product-absolute') {
    return `${prefix} mandatory production-absolute Product resource ${caseLabel(identity)}`;
  }
  return `${prefix} oracle unattributed external resource ${caseLabel(identity)}`;
}

function processResourceEvidence(identity, requestFailures, httpFailures) {
  for (const record of requestFailures) {
    const classification = classifyResourceUrl(record.url);
    const detail = { case: caseDetail(identity), classification: classification.category, ...record };
    if (classification.hardFail) {
      fail(resourceFailureName('Request failure:', classification, identity), detail);
    } else {
      diagnostic(`Optional request failure: ${classification.category}`, detail);
    }
  }

  for (const record of httpFailures) {
    const classification = classifyResourceUrl(record.url);
    const detail = { case: caseDetail(identity), classification: classification.category, ...record };
    if (classification.hardFail) {
      fail(resourceFailureName('HTTP failure:', classification, identity), detail);
    } else {
      diagnostic(`Optional HTTP failure: ${classification.category}`, detail);
    }
  }
}

function isKnownProductionIconCsp(text) {
  const value = String(text || '');
  return value.includes('violates the following Content Security Policy directive') &&
    value.includes('https://gospod-bog.ru/') &&
    (value.includes('favicon') || value.includes('apple-touch-icon') || value.includes('icons/icon-'));
}

function processConsoleEvidence(identity, consoleErrors, requestFailures, httpFailures) {
  const resourceRecords = [...requestFailures, ...httpFailures];

  for (const entry of consoleErrors) {
    const detail = { case: caseDetail(identity), ...entry };

    if (isKnownProductionIconCsp(entry.text)) {
      diagnostic('Optional console error: production-absolute icon CSP', detail);
      continue;
    }

    const isGenericResourceConsole = /Failed to load resource:/i.test(entry.text || '');
    if (isGenericResourceConsole && resourceRecords.length) {
      diagnostic('Console resource error correlated to structured request evidence', {
        ...detail,
        correlatedResources: resourceRecords.map(record => ({
          url: record.url,
          method: record.method,
          resourceType: record.resourceType,
          errorText: record.errorText || null,
          status: record.status || null,
        })),
      });
      continue;
    }

    if (entry.location && entry.location.url) {
      const classification = classifyResourceUrl(entry.location.url);
      if (!classification.hardFail) {
        diagnostic(`Optional console error: ${classification.category}`, {
          ...detail,
          classification: classification.category,
        });
        continue;
      }
      fail(`Console error ${caseLabel(identity)}`, {
        ...detail,
        classification: classification.category,
      });
      continue;
    }

    fail(`Oracle unattributed console error ${caseLabel(identity)}`, detail);
  }
}

function processPageErrors(identity, pageErrors) {
  for (const entry of pageErrors) {
    const msg = entry.message || '';
    const stack = entry.stack || '';
    const isOurInitScript = /classList/.test(msg) && /null/.test(msg) &&
      (/addInitScript|evaluate/.test(stack) || !/\.js/.test(stack));
    const isMetrika = /null/.test(msg) &&
      /classList|style|querySelector|getElementById/.test(msg) &&
      /metrika|mc\.yandex|yandex/.test(stack.toLowerCase());

    if (isOurInitScript) {
      diagnostic('Test-environment pageerror: init-script race', {
        case: caseDetail(identity),
        message: msg,
        stack,
      });
      continue;
    }
    if (isMetrika) {
      diagnostic('Optional pageerror: Yandex Metrika', {
        case: caseDetail(identity),
        message: msg,
        stack,
      });
      continue;
    }

    fail(`Page error ${caseLabel(identity)}`, {
      case: caseDetail(identity),
      message: msg,
      stack,
    });
  }
}

async function settleRendering(page) {
  await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function readOverlayState(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      className: el.className,
      ariaHidden: el.getAttribute('aria-hidden'),
      display: s.display,
      opacity: s.opacity,
      visible: s.display !== 'none' && Number(s.opacity) > 0.5,
    };
  }, selector);
}

async function waitForOverlayVisible(page, selector) {
  await page.waitForFunction(sel => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && Number(s.opacity) > 0.5;
  }, selector, { timeout: 1500 }).catch(() => {});
}

async function runCase(browser, viewport, dark, route) {
  const mode = dark ? 'dark' : 'light';
  const identity = {
    route,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    theme: mode,
  };
  const caseRecord = {
    ...caseDetail(identity),
    completed: false,
    exercised: false,
    stage: 'setup',
    failureCountBefore: failures.length,
  };
  cases.push(caseRecord);

  const requestFailures = [];
  const httpFailures = [];
  const consoleErrors = [];
  const pageErrors = [];
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: dark ? 'dark' : 'light',
  });
  const page = await context.newPage();

  page.on('requestfailed', request => {
    requestFailures.push(requestEvidence(request));
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      httpFailures.push(responseEvidence(response));
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location(),
      });
    }
  });
  page.on('pageerror', err => {
    pageErrors.push({
      message: err.message || '',
      stack: err.stack || '',
    });
  });

  try {
    caseRecord.stage = 'theme-init';
    await page.addInitScript(isDark => {
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
      var de = document.documentElement;
      if (de) { if (isDark) de.classList.add('dark'); else de.classList.remove('dark'); }
    }, dark);

    caseRecord.stage = 'navigation';
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.evaluate(isDark => {
      document.documentElement.classList.toggle('dark', isDark);
      try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (_) {}
    }, dark);

    caseRecord.stage = 'layout';
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await settleRendering(page);

    const facts = await page.evaluate(() => {
      const bar = document.querySelector('.mobile-bottom-bar');
      const partBtn = document.querySelector('#mobPartTocBtn');
      const seriesBtn = document.querySelector('#mobTocBtn');
      const fallback = document.querySelector('.gb-mobile-fallback-controls');
      const root = document.querySelector('[data-gill-v16]');
      const label = document.querySelector('.mobile-btoc-section__main, #gbs2MobSec');
      const style = bar ? getComputedStyle(bar) : null;
      const labelStyle = label ? getComputedStyle(label) : null;
      const partStyle = partBtn ? getComputedStyle(partBtn) : null;
      const barRect = bar ? bar.getBoundingClientRect() : null;
      const doc = document.documentElement;
      const centerEl = barRect ? document.elementFromPoint(Math.round(barRect.left + barRect.width / 2), Math.round(barRect.top + barRect.height / 2)) : null;
      const fallbackRect = fallback ? fallback.getBoundingClientRect() : null;

      // Tolerance for article text under bar (font baseline/line-height rounding)
      const INTERSECT_TOLERANCE = 12;

      const articleCandidate = [...document.querySelectorAll('article p, article h2, .article-body p, main p, header.article-header p')]
        .map(el => ({ el, r: el.getBoundingClientRect(), text: (el.textContent || '').trim() }))
        .find(x => {
          if (!x.text || x.r.width < 20 || x.r.height < 8 || !barRect) return false;
          // Fails only if it runs deep UNDER the bar (more than tolerance)
          return x.r.top < barRect.bottom && x.r.bottom > (barRect.top + INTERSECT_TOLERANCE);
        });
      return {
        hasRoot: !!root,
        hasBar: !!bar,
        hasPartBtn: !!partBtn,
        hasSeriesBtn: !!seriesBtn,
        upgradedOldRoot: !!(bar && bar.hasAttribute('data-gill-mobile-bar') && partBtn),
        barText: bar ? bar.textContent.replace(/\s+/g, ' ').trim() : '',
        barRect: barRect ? { left: barRect.left, top: barRect.top, right: barRect.right, bottom: barRect.bottom, width: barRect.width, height: barRect.height } : null,
        barBg: style ? style.backgroundColor : '',
        barBackdropFilter: style ? (style.backdropFilter || style.webkitBackdropFilter || '') : '',
        barDisplay: style ? style.display : '',
        barPosition: style ? style.position : '',
        barOverflow: style ? style.overflow : '',
        bodyPaddingBottom: Number.parseFloat(getComputedStyle(document.body).paddingBottom || '0'),
        labelOpacity: labelStyle ? Number(labelStyle.opacity) : null,
        labelColor: labelStyle ? labelStyle.color : '',
        labelBg: partStyle ? partStyle.backgroundColor : '',
        docWidth: doc.scrollWidth,
        viewportWidth: window.innerWidth,
        centerInsideBar: !!(bar && centerEl && (centerEl === bar || bar.contains(centerEl))),
        fallbackVisible: !!(fallback && fallbackRect && fallbackRect.width > 20 && fallbackRect.height > 20 && getComputedStyle(fallback).display !== 'none' && getComputedStyle(fallback).visibility !== 'hidden'),
        articleIntersectsBar: !!articleCandidate,
        articleLeakCandidate: articleCandidate ? { text: articleCandidate.text.slice(0, 80), rect: { top: articleCandidate.r.top, bottom: articleCandidate.r.bottom } } : null,
      };
    });

    const tag = caseLabel(identity);
    const alpha = alphaFromColor(facts.barBg);
    const hasFrostBlur = /blur\(/.test(facts.barBackdropFilter || '');
    const contrast = contrastRatio(facts.labelColor, facts.barBg) || contrastRatio(facts.labelColor, facts.labelBg);
    assert(facts.hasRoot, `Gill root present ${tag}`);
    assert(facts.hasBar, `Gill mobile bar present ${tag}`, facts);
    assert(facts.hasPartBtn, `Explicit Part TOC button present ${tag}`, facts);
    // v4 bottom bar (gbs_series_mobile_v4_refined) has NO dedicated «Серия»
    // button (#mobTocBtn); the series list is reached one level up via the
    // part overlay's #backToSeries arrow (exercised below).
    assert(facts.upgradedOldRoot, `Old/static Gill bar upgraded or native V3 bar present ${tag}`, facts);
    assert(facts.barPosition === 'fixed', `Bottom bar fixed ${tag}`, facts);
    assert(alpha >= 0.75, `Bottom bar frost alpha >= .75 ${tag}`, { alpha, bg: facts.barBg });
    assert(hasFrostBlur, `Bottom bar backdrop blur active ${tag}`, { backdropFilter: facts.barBackdropFilter });
    assert(facts.centerInsideBar, `Bottom bar center is controlled by bar, not article text ${tag}`, facts);
    assert(!facts.fallbackVisible, `No generic fallback controls over Gill mobile ${tag}`, facts);
    assert(facts.docWidth <= facts.viewportWidth + 1, `No horizontal overflow ${tag}`, facts);
    assert(facts.labelOpacity === null || facts.labelOpacity >= 0.85, `Mobile section label opacity readable ${tag}`, facts);
    assert(contrast === null || contrast >= 4.0, `Mobile section label contrast >= 4.0 ${tag}`, { contrast, color: facts.labelColor, bg: facts.barBg, labelBg: facts.labelBg });
    assert(!facts.articleIntersectsBar, `Article text does not run under bottom bar ${tag}`, facts.articleLeakCandidate || {});
    // v4 section button carries the «Сейчас читаете» label above the current
    // section name (the old bar exposed «Оглавление части»/«Серия» text — both
    // retired). No «Серия» text in the bar any more.
    assert(/Сейчас читаете/.test(facts.barText), `Bottom bar exposes «Сейчас читаете» label ${tag}`, facts);

    caseRecord.stage = 'part-toc';
    if (facts.hasPartBtn) {
      await page.click('#mobPartTocBtn');
      await waitForOverlayVisible(page, '#partTocOverlay');
    }
    const partOpen = await readOverlayState(page, '#partTocOverlay');
    assert(partOpen && partOpen.visible, `Part TOC opens from bottom bar ${tag}`, partOpen || {});

    // v4 series-reachability: the part overlay's #backToSeries arrow opens the
    // series list (replaces the retired direct #mobTocBtn «Серия» button).
    caseRecord.stage = 'series-toc';
    const backToSeries = await page.$('#backToSeries');
    if (backToSeries) {
      await backToSeries.click();
      await waitForOverlayVisible(page, '#seriesTocOverlay');
    }
    const seriesOpen = await readOverlayState(page, '#seriesTocOverlay');
    assert(seriesOpen && seriesOpen.visible, `Series TOC reachable via part→back arrow ${tag}`, seriesOpen || {});

    caseRecord.stage = 'complete';
    caseRecord.exercised = true;
  } catch (err) {
    fail(`Gill case execution error ${caseLabel(identity)}`, {
      case: caseDetail(identity),
      stage: caseRecord.stage,
      message: err && err.message || String(err),
      stack: err && err.stack || '',
    });
  } finally {
    processResourceEvidence(identity, requestFailures, httpFailures);
    processConsoleEvidence(identity, consoleErrors, requestFailures, httpFailures);
    processPageErrors(identity, pageErrors);
    caseRecord.completed = true;
    caseRecord.failureCount = failures.length - caseRecord.failureCountBefore;
    await context.close().catch(err => {
      fail(`Gill context close error ${caseLabel(identity)}`, {
        case: caseDetail(identity),
        message: err && err.message || String(err),
      });
    });
  }
}

function writeProofAndExit() {
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(proof, null, 2));
  if (failures.length) {
    console.error(`\nGill mobile layout audit failed: ${failures.length} issue(s). See ${OUT}/summary.json`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nGill mobile layout audit passed. See ${OUT}/summary.json`);
}

if (SELF_TEST_ONLY) {
  proof.base = 'self-test';
  runAuthoritySelfTests();
  writeProofAndExit();
} else {
  (async () => {
    let server = null;
    let browser = null;
    try {
      if (!BASE) {
        server = await serveDist();
        const address = server.address();
        BASE = `http://127.0.0.1:${address.port}`;
      }
      proof.base = BASE;
      runAuthoritySelfTests();

      const { chromium } = require('playwright');
      browser = await chromium.launch();
      for (const route of ROUTES) {
        for (const viewport of VIEWPORTS) {
          await runCase(browser, viewport, false, route);
          await runCase(browser, viewport, true, route);
        }
      }
    } catch (err) {
      fail('fatal', { message: err.message, stack: err.stack });
    } finally {
      if (browser) await browser.close().catch(err => {
        fail('browser close error', { message: err.message, stack: err.stack });
      });
      if (server) await new Promise(resolve => server.close(resolve));

      const completedCases = cases.filter(item => item.completed).length;
      const exercisedCases = cases.filter(item => item.exercised).length;
      assert(cases.length === EXPECTED_CASES, 'Gill case manifest has all expected cases', {
        expected: EXPECTED_CASES,
        actual: cases.length,
      });
      assert(completedCases === EXPECTED_CASES, 'Gill case manifest completed every case', {
        expected: EXPECTED_CASES,
        actual: completedCases,
      });
      assert(exercisedCases === EXPECTED_CASES, 'Gill case manifest fully exercised every case', {
        expected: EXPECTED_CASES,
        actual: exercisedCases,
      });

      writeProofAndExit();
    }
  })();
}
