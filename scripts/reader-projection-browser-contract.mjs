#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });
assert.ok(fs.existsSync(DIST), 'production-like dist is required');

const ROUTES = [
  { id: 'herm', route: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', expectSummary: true, expectSchema: true },
  { id: 'gill', route: '/articles/dzhon-gill-chast-1-chelovek/' },
  { id: 'antisovetov', route: '/articles/20-antisovetov-pastoru/' },
];
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'mobile', width: 390, height: 844 },
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.bin': 'application/octet-stream',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      let target = path.join(DIST, pathname.replace(/^\/+/, ''));
      if (pathname.endsWith('/')) target = path.join(target, 'index.html');
      if (!path.extname(target)) target = path.join(target, 'index.html');
      if (!target.startsWith(DIST) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, {
        'content-type': MIME[path.extname(target)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function record(checks, id, area, description, pass, evidence = null) {
  checks.push({ id, area, description, pass: Boolean(pass), evidence });
}

async function installSpeechFixture(context) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gbx-vosk-warmup', 'off');
      localStorage.setItem('gb:audio:rate', '1');
      localStorage.setItem('gb:audio:speaker', '3');
    } catch {}
    window.__readerProjectionSpeech = { speaks: 0, cancels: 0, lastText: '', texts: [] };
    function FakeUtterance(text) {
      this.text = String(text || '');
      this.lang = 'ru-RU';
      this.rate = 1;
      this.pitch = 1;
      this.onboundary = null;
      this.onend = null;
      this.onerror = null;
    }
    const speech = {
      getVoices: () => [{ name: 'Projection Fixture Russian', lang: 'ru-RU', localService: true }],
      speak: (utterance) => {
        window.__readerProjectionSpeech.speaks += 1;
        window.__readerProjectionSpeech.lastText = String(utterance.text || '');
        window.__readerProjectionSpeech.texts.push(window.__readerProjectionSpeech.lastText);
        window.__readerProjectionSpeech.active = utterance;
      },
      cancel: () => {
        window.__readerProjectionSpeech.cancels += 1;
        window.__readerProjectionSpeech.active = null;
      },
      pause: () => {},
      resume: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    try { Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance }); }
    catch { window.SpeechSynthesisUtterance = FakeUtterance; }
    try { Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: speech }); }
    catch { window.speechSynthesis = speech; }
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const api = window.GBReaderProjection;
    const root = api?.getRoot?.();
    const ledger = api?.getLedger?.() || null;
    const section = api?.getCurrentSection?.() || null;
    const selectors = api?.getSpeakableSelectors?.() || [];
    const schemaSelectors = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      let payload;
      try { payload = JSON.parse(script.textContent || 'null'); } catch { return; }
      const visit = (value) => {
        if (!value || typeof value !== 'object') return;
        if (value.speakable?.cssSelector) schemaSelectors.push(value.speakable.cssSelector);
        Object.values(value).forEach(visit);
      };
      visit(payload);
    });
    return {
      apiVersion: api?.version || null,
      ready: document.documentElement.getAttribute('data-gb-reader-projection-ready'),
      root: Boolean(root),
      rootProjection: root?.getAttribute('data-reader-projection') || null,
      rootInclude: root?.getAttribute('data-reader-include') || null,
      searchPolicy: root?.getAttribute('data-search-policy') || null,
      speakablePolicy: root?.getAttribute('data-speakable-policy') || null,
      printPolicy: root?.getAttribute('data-print-policy') || null,
      notePolicy: root?.getAttribute('data-reader-note-policy') || null,
      sectionCount: root?.querySelectorAll('[data-reader-section]').length || 0,
      summaryCount: root?.querySelectorAll('[data-reader-summary="include"]').length || 0,
      ttsOwner: window.GBReaderTTS?.version || null,
      controlsOwner: window.GBReaderControlsA11y?.version || null,
      selectors,
      schemaSelectors,
      section,
      ledger,
      ttsFirst: api?.getTtsSegments?.()[0]?.text || '',
      searchLength: api?.getSearchText?.().length || 0,
      printCount: api?.getPrintNodes?.().length || 0,
      speakableCount: api?.getSpeakableNodes?.().length || 0,
    };
  });
}

async function runRouteCase(browser, origin, route, viewport, checks) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  await page.goto(`${origin}${route.route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBReaderProjection?.version === 1, null, { timeout: 15000 });
  await page.evaluate(() => window.GBReaderProjection.refresh());
  await page.waitForTimeout(120);
  const state = await snapshot(page);
  const prefix = `${route.id}-${viewport.id}`;

  record(checks, `${prefix}-01`, 'owner', 'ReaderProjection v1 is installed', state.apiVersion === 1, state);
  record(checks, `${prefix}-02`, 'owner', 'projection ready marker is exact', state.ready === '1', state.ready);
  record(checks, `${prefix}-03`, 'root', 'reader root is resolved', state.root, state);
  record(checks, `${prefix}-04`, 'root', 'reader root is version-marked', state.rootProjection === '1', state.rootProjection);
  record(checks, `${prefix}-05`, 'root', 'reader root has article include policy', state.rootInclude === 'article', state.rootInclude);
  record(checks, `${prefix}-06`, 'policy', 'search policy is explicit', state.searchPolicy === 'include', state.searchPolicy);
  record(checks, `${prefix}-07`, 'policy', 'speakable policy is explicit', state.speakablePolicy === 'include', state.speakablePolicy);
  record(checks, `${prefix}-08`, 'policy', 'print policy is explicit', state.printPolicy === 'include', state.printPolicy);
  record(checks, `${prefix}-09`, 'policy', 'note policy is explicit', state.notePolicy === 'exclude', state.notePolicy);
  record(checks, `${prefix}-10`, 'sections', 'at least one section is projected', state.sectionCount > 0, state.sectionCount);
  record(checks, `${prefix}-11`, 'tts', 'TTS projection is non-empty', Boolean(state.ttsFirst && state.ledger?.tts > 0), state.ledger);
  record(checks, `${prefix}-12`, 'search', 'search representation is non-empty', state.searchLength > 100, state.searchLength);
  record(checks, `${prefix}-13`, 'print', 'print representation is non-empty', state.printCount > 0, state.printCount);
  record(checks, `${prefix}-14`, 'speakable', 'canonical speakable selectors are exact', JSON.stringify(state.selectors) === JSON.stringify(['h1', '.article-lead', '.summary-card', '[data-speakable]']), state.selectors);
  record(checks, `${prefix}-15`, 'speakable', 'speakable representation is non-empty', state.speakableCount > 0, state.speakableCount);
  record(checks, `${prefix}-16`, 'sections', 'current section has a label', Boolean(state.section?.label), state.section);
  record(checks, `${prefix}-17`, 'preservation', 'canonical TTS owner remains installed', Number(state.ttsOwner) >= 2, state.ttsOwner);
  record(checks, `${prefix}-18`, 'preservation', 'controls accessibility owner remains installed', Number(state.controlsOwner) >= 1, state.controlsOwner);
  record(checks, `${prefix}-19`, 'runtime', 'no uncaught page errors', pageErrors.length === 0, pageErrors);
  if (route.expectSummary) {
    record(checks, `${prefix}-20`, 'summary', 'summary is explicitly included', state.summaryCount >= 1, state.summaryCount);
  } else {
    record(checks, `${prefix}-20`, 'summary', 'summary ledger is truthful', state.summaryCount === Number(state.ledger?.summary || 0), { marker: state.summaryCount, ledger: state.ledger?.summary });
  }
  if (route.expectSchema) {
    const exact = state.schemaSelectors.some((selectors) => JSON.stringify(selectors) === JSON.stringify(state.selectors));
    record(checks, `${prefix}-21`, 'speakable', 'JSON-LD speakable uses canonical selectors', exact, state.schemaSelectors);
  } else {
    record(checks, `${prefix}-21`, 'speakable', 'schema absence does not invent selectors', state.schemaSelectors.every(Array.isArray), state.schemaSelectors);
  }

  await page.screenshot({ path: path.join(REPORTS, `reader-projection-${prefix}.png`), fullPage: false });
  await context.close();
}

async function runBridgeCase(browser, origin, checks) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installSpeechFixture(context);
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  await page.goto(`${origin}${ROUTES[0].route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBReaderProjection?.version === 1 && window.GBReaderTTS?.version >= 2, null, { timeout: 15000 });

  const bridge = await page.evaluate(() => {
    const api = window.GBReaderProjection;
    const root = api.getRoot();
    const selector = api.policy.blockSelector;
    root.querySelectorAll(selector).forEach((node) => node.setAttribute('data-reader-exclude', 'fixture-existing'));
    const include = document.createElement('p');
    include.id = 'reader-projection-fixture-include';
    include.setAttribute('data-reader-include', 'body');
    include.textContent = 'ПРОЕКЦИЯ ВКЛЮЧЕНА';
    const exclude = document.createElement('p');
    exclude.id = 'reader-projection-fixture-exclude';
    exclude.setAttribute('data-reader-exclude', 'fixture');
    exclude.textContent = 'ПРОЕКЦИЯ ИСКЛЮЧЕНА';
    root.prepend(exclude);
    root.prepend(include);
    const report = api.refresh();
    const segments = api.getTtsSegments();
    const search = api.getSearchText();
    const print = api.getPrintNodes().map((node) => node.id);
    return {
      report,
      segments: segments.map((segment) => ({ text: segment.text, kind: segment.kind, sectionId: segment.sectionId, sectionLabel: segment.sectionLabel })),
      search,
      print,
      excludeNoSpeech: exclude.hasAttribute('data-no-speech'),
      includeNoSpeech: include.hasAttribute('data-no-speech'),
      excludedInSegments: segments.some((segment) => segment.text.includes('ПРОЕКЦИЯ ИСКЛЮЧЕНА')),
      includedInSegments: segments.some((segment) => segment.text.includes('ПРОЕКЦИЯ ВКЛЮЧЕНА')),
    };
  });

  record(checks, 'bridge-01', 'bridge', 'explicit exclusion materializes data-no-speech', bridge.excludeNoSpeech, bridge);
  record(checks, 'bridge-02', 'bridge', 'explicit include remains speech-visible', !bridge.includeNoSpeech, bridge);
  record(checks, 'bridge-03', 'bridge', 'included fixture enters TTS segments', bridge.includedInSegments, bridge.segments);
  record(checks, 'bridge-04', 'bridge', 'excluded fixture stays out of TTS segments', !bridge.excludedInSegments, bridge.segments);
  record(checks, 'bridge-05', 'bridge', 'fixture projection has exactly one segment', bridge.segments.length === 1, bridge.segments);
  record(checks, 'bridge-06', 'bridge', 'fixture segment text is exact', bridge.segments[0]?.text === 'ПРОЕКЦИЯ ВКЛЮЧЕНА', bridge.segments);
  record(checks, 'bridge-07', 'bridge', 'fixture segment keeps paragraph kind', bridge.segments[0]?.kind === 'paragraph', bridge.segments);
  record(checks, 'bridge-08', 'bridge', 'fixture segment keeps section label', Boolean(bridge.segments[0]?.sectionLabel), bridge.segments);
  record(checks, 'bridge-09', 'bridge', 'search includes projected content', bridge.search.includes('ПРОЕКЦИЯ ВКЛЮЧЕНА'), bridge.search);
  record(checks, 'bridge-10', 'bridge', 'search excludes reader-excluded content', !bridge.search.includes('ПРОЕКЦИЯ ИСКЛЮЧЕНА'), bridge.search);
  record(checks, 'bridge-11', 'bridge', 'print includes projected content', bridge.print.includes('reader-projection-fixture-include'), bridge.print);
  record(checks, 'bridge-12', 'bridge', 'print excludes reader-excluded content', !bridge.print.includes('reader-projection-fixture-exclude'), bridge.print);
  record(checks, 'bridge-13', 'bridge', 'ledger reports one TTS segment', bridge.report.tts === 1, bridge.report);

  await page.evaluate(() => {
    window.GBReaderTTS.stop();
    window.__readerProjectionSpeech.speaks = 0;
    window.__readerProjectionSpeech.lastText = '';
    window.__readerProjectionSpeech.texts = [];
    window.GBReaderTTS.play();
  });
  await page.waitForTimeout(160);
  const speech = await page.evaluate(() => ({
    ...window.__readerProjectionSpeech,
    phase: window.GBReaderTTS.getState().phase,
  }));
  record(checks, 'bridge-14', 'tts-runtime', 'canonical TTS speaks once from projected DOM', speech.speaks === 1, speech);
  record(checks, 'bridge-15', 'tts-runtime', 'canonical TTS speaks included projection text', speech.lastText === 'ПРОЕКЦИЯ ВКЛЮЧЕНА', speech);
  record(checks, 'bridge-16', 'tts-runtime', 'canonical TTS does not speak excluded text', !speech.texts.some((text) => text.includes('ПРОЕКЦИЯ ИСКЛЮЧЕНА')), speech);
  record(checks, 'bridge-17', 'tts-runtime', 'canonical TTS enters active phase', ['starting', 'playing'].includes(speech.phase), speech);
  record(checks, 'bridge-18', 'runtime', 'bridge case has no uncaught page errors', pageErrors.length === 0, pageErrors);
  await page.screenshot({ path: path.join(REPORTS, 'reader-projection-bridge-mobile.png'), fullPage: false });
  await context.close();
}

const { server, origin } = await startServer();
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  for (const route of ROUTES) {
    for (const viewport of VIEWPORTS) await runRouteCase(browser, origin, route, viewport, checks);
  }
  await runBridgeCase(browser, origin, checks);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

assert.ok(checks.length >= 140, `ReaderProjection browser contract requires at least 140 checks, got ${checks.length}`);
assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'browser check IDs must be unique');
const failed = checks.filter((item) => !item.pass);
const summary = {
  sha: process.env.GITHUB_SHA || null,
  routes: ROUTES.length,
  viewports: VIEWPORTS.length,
  checks: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
};
fs.writeFileSync(path.join(REPORTS, 'reader-projection-browser-contract.json'), JSON.stringify({ summary, checks }, null, 2));
const markdown = [
  '# ReaderProjection browser contract', '',
  `- SHA: \`${summary.sha || 'local'}\``,
  `- Routes: **${summary.routes}**`,
  `- Viewports: **${summary.viewports}**`,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`, '',
  '| ID | Area | Result | Description |',
  '|---|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.area} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`),
].join('\n');
fs.writeFileSync(path.join(REPORTS, 'reader-projection-browser-contract.md'), markdown);
checks.forEach((item) => console.log(`[READER-PROJECTION-BROWSER] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} ${item.area} :: ${item.description}`));
console.log('[READER-PROJECTION-BROWSER-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `ReaderProjection browser contract failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('ReaderProjection browser contract: PASS');
