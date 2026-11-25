#!/usr/bin/env node
/**
 * Local Journal acceptance witness; no CI/gate/route/Research mutation.
 * Requires existing Playwright plus an explicit axe-core file (no dependency changes).
 * JOURNAL_CHROMIUM_EXECUTABLE may select a sandbox-compatible Chromium.
 * Example: node scripts/journal-editorial-browser.mjs --origin=http://localhost:4173
 *   --axe=/path/to/axe.min.js; checks public history at the same --origin
 * --browser=firefox|webkit uses that actual Playwright browser, never Chromium emulation.
 * --suite=print runs only the actual-PDF matrix (Chromium + Python/PyMuPDF).
 * --suite=mobile exercises native compact-TOC focus; --mobile-heights=390,844.
 * --pdf-python=/path/to/python selects that environment; --print-baseline=/path/to/capture.json
 * additionally checks earlier text/styles and unchanged public print geometry.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from 'playwright';
import { reviewAtlasContrast } from './lib/journal-atlas-contrast-review.mjs';
const require = createRequire(import.meta.url);
const { monitorRuntime } = require('./lib/browser-runtime-noise.js');
const root = fileURLToPath(new URL('../', import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const i = arg.indexOf('='); return [arg.slice(2, i), arg.slice(i + 1)]; }));
const origin = args.origin || 'http://localhost:4173';
const engine = args.browser || 'chromium';
const suite = args.suite || 'full';
const visibleScrollbars = args['visible-scrollbars'] === 'true';
const stopOnFirstError = args['stop-on-first-error'] === 'true';
assert.ok(!args.transfer && !args['public-only'] && !args['history-origin'], 'Public history uses a canonical route; obsolete transfer and preview flags are not accepted');
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'unknown browser engine');
assert.ok(['full', 'short', 'mobile', 'print', 'forced-colors'].includes(suite), 'use --suite=full|short|mobile|print|forced-colors');
assert.ok(suite !== 'forced-colors' || engine === 'chromium', 'forced-colors system-palette witness currently requires actual Chromium');
assert.ok(suite !== 'print' || engine === 'chromium', 'actual PDF generation requires Chromium; do not substitute an emulated print DOM');
const axePath = args.axe || path.join(root, 'node_modules/axe-core/axe.min.js');
assert.ok(suite === 'print' || fs.existsSync(axePath), 'provide --axe=<existing axe-core file>; do not silently skip the accessibility audit');
const axeSource = suite === 'print' ? '' : fs.readFileSync(axePath, 'utf8');
const isExpectedJournalConsole = (_, message) =>
  !['error', 'warning'].includes(message.type()) ||
  (engine === 'webkit' && ['warning','error'].includes(message.type()) &&
    message.text() === 'Viewport argument key "interactive-widget" not recognized and ignored.');
const output = path.resolve(root, args.output || 'reports/g3-editorial-local-20261118');
fs.mkdirSync(path.join(output, 'after'), { recursive: true });
const widths = args.widths ? args.widths.split(',').map(Number) : [320, 360, 390, 430, 768, 1024, 1440, 1920];
const shortHeights = args.heights ? args.heights.split(',').map(Number) : [390, 480, 600];
const mobileWidths = args.widths ? widths.filter((width) => width <= 1023) : [320, 360, 390, 430, 768, 1023];
const mobileHeights = args['mobile-heights'] ? args['mobile-heights'].split(',').map(Number) : [390, 844];
assert.ok(mobileHeights.every((height) => Number.isInteger(height) && height >= 320 && height <= 1080));
assert.ok(suite !== 'mobile' || mobileWidths.length > 0, 'the mobile suite needs a compact width');
assert.ok(widths.every((width) => Number.isInteger(width) && width >= 320));
assert.ok(shortHeights.every((height) => Number.isInteger(height) && height >= 320 && height <= 600));
assert.ok(suite !== 'short' || widths.some((width) => width >= 1024), 'the short suite needs at least one desktop width');
const routes = [{ kind: 'journal', url: origin + '/journal/' }, { kind: 'dossier', url: origin + '/journal/dossiers/g3/' },
  { kind: 'history', url: origin + '/journal/dossiers/g3/history/' }];
const report = { engine, suite, version: null, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  worktree: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim(),
  visibleScrollbars,
  note: 'Local artifact/manuscript only. axe is automated evidence, not full WCAG or artistic signoff. Timings are local lab, not field Core Web Vitals. Short-window theme is the browser color preference; no-JS retains the existing SSR palette.',
  sourceSha256: {}, cases: [], interactions: [], shortViewports: [], mobileFocus: [], forcedColors: [], printCases: [], problems: [] };
const witnessFiles = [
  ...['G3Dossier.astro', 'G3HistoryArticle.astro', 'G3HistoryFeature.astro', 'JournalLanding.astro', 'JournalEditorialShell.astro', 'JournalMasthead.astro', 'JournalArticleHeader.astro', 'JournalContents.astro', 'JournalDataFigure.astro', 'JournalSourceReturn.astro', 'JournalDocumentHead.astro', 'JournalFontPreloads.astro', 'journalEditorial.css', 'g3History.css'].map((name) => `src/components/journal/${name}`),
  ...['g3R6Adopted.json', 'g3ExpansionHandoff.ts', 'g3EditorialMedia.ts', 'g3HistorySources.ts', 'g3HistoryMetadata.ts', 'g3ProductMetadata.ts', 'g3PublicationHandoff.ts', 'g3SourceBibliography.ts', 'journalProductMetadata.ts'].map((name) => `src/data/journal/${name}`),
  ...['G3AnnualFinance.astro','G3SpeakerMatrix.astro','adopted-visual-data.json','adopted-visual-inputs.ts','finance.css','matrix-data.json','matrix.css','matrix.js'].map(name => 'src/components/journal/g3-visual/'+name),
  ...['G3HistoricalPanorama.astro','G3ExpenseWaterfall.astro','G3EcosystemSpread.astro','finance-model.mjs','graphics.css'].map(name => 'src/components/journal/g3-graphics/'+name),
  'src/components/journal/journalDocumentMetadata.ts', 'src/pages/journal/index.astro', 'src/pages/journal/dossiers/g3/index.astro', 'src/pages/journal/dossiers/g3/history/index.astro',
  'src/components/journal/editorial/JournalCompactDocumentIndex.astro',
  'src/styles/editorial-edition.css',
  'src/components/article-pilots/_shared/MobileChromePage.astro',
  'src/components/reader-platform/ReaderPreferencesHead.astro',
  'css/reader-preferences.css',
  'js/reader-preferences-head.js',
  'js/reader-preferences.js',
  'js/reader-state.js',
  'public/images/journal/g3-ministries-cover-1200.avif',
  'public/images/journal/g3-ministries-cover-1200.webp',
  'public/images/journal/g3-ministries-cover-640.avif',
  'public/images/journal/g3-ministries-cover-640.webp',
  'public/images/journal/g3-ministries-og-1200x630.webp',
  'scripts/journal-editorial-browser.mjs', 'scripts/lib/journal-atlas-contrast-review.mjs', 'scripts/lib/journal-print-pdf.py', 'scripts/journal-editorial-contract.mjs', 'scripts/journal-local-review.mjs', 'scripts/fixtures/g3-history-review.astro',
];
for (const name of witnessFiles) report.sourceSha256[name] = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
const browser = await ({ chromium, firefox, webkit })[engine].launch({
  headless: true,
  ...(visibleScrollbars ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {}),
  ...(engine === 'chromium' && process.env.JOURNAL_CHROMIUM_EXECUTABLE ? {
    executablePath: process.env.JOURNAL_CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  } : {}),
});
report.version = browser.version();
const audit = async (page) => {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run({ runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return { violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) })),
      incomplete: result.incomplete.map((v) => ({ id: v.id, impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, html: n.html, summary: n.failureSummary })) })) };
  });
};
const contextFor = (width, theme, options = {}) => browser.newContext({ viewport: { width, height: width <= 430 ? 844 : width === 768 ? 1024 : 1080 },
  colorScheme: theme, deviceScaleFactor: 1, serviceWorkers: 'block', ...options });
const ready = async (page, url, stage = () => {}) => {
  // Diagnose WebKit's reported WOFF2 errors with actual HTTP responses and
  // native browser request failures. Keep the strict font-face rejection.
  const fontNetwork = [];
  const isFont = (requestUrl) => /\.woff2(?:[?#]|$)/i.test(requestUrl);
  page.on('response', (response) => {
    if (isFont(response.url())) fontNetwork.push({ url: response.url(), status: response.status() });
  });
  page.on('requestfailed', (request) => {
    if (isFont(request.url())) fontNetwork.push({
      url: request.url(), failure: request.failure() || 'request failed'
    });
  });
  stage('navigation/load');
  const response = await page.goto(url, { waitUntil: 'load', timeout: 25_000 });
  assert.equal(response.status(), 200, url);
  // Verify the actual article preload contract on the shipped HTML; fail
  // independently of WebKit's CSS FontFaceSet status, not instead of it.
  if (new URL(url).pathname.startsWith('/journal/dossiers/g3/')) {
    const hints = await page.locator('link[rel="preload"][as="font"]').evaluateAll((links) =>
      links.map((el) => new URL(el.href).pathname));
    const history = new URL(url).pathname.startsWith('/journal/dossiers/g3/history/');
    const source600 = '/fonts/SourceSans3/sourcesans3-cyrillic-600.woff2';
    const lora600 = '/fonts/Lora/lora-cyrillic-600.woff2';
    assert.equal(hints.filter((hint) => hint === source600).length, 1,
      'G3 Article must preload exactly one semibold Cyrillic Source Sans face');
    assert.equal(hints.filter((hint) => hint === lora600).length, history ? 0 : 1,
      'Only G3 dossier must preload semibold Cyrillic Lora; history must not preload unused face');
  }
  stage('navigation/fonts-ready');
  // A Firefox browsing context with JS disabled may leave an injected
  // document.fonts.ready promise unsettled. Observe the actual FontFaceSet
  // from the test driver, even with page scripts disabled; require the three
  // typefaces rendered by every Journal route, and fail on font-face errors.
  const deadline = Date.now() + 15_000;
  let fonts, stable = 0;
  while (true) {
    fonts = await page.evaluate(() => ({
      status: document.fonts.status,
      faces: [...document.fonts].map((face) => ({
        family: face.family, weight: face.weight, status: face.status
      }))
    }));
    const failed = fonts.faces.filter((face) => face.status === 'error');
    assert.deepEqual(failed, [], 'CSS font faces failed to load: ' + JSON.stringify(failed)
      + '; WOFF2 requests: ' + JSON.stringify(fontNetwork)
      + '; fontset: ' + JSON.stringify({ status: fonts.status, faces: fonts.faces }));
    const loadedFamilies = new Set(fonts.faces.filter((face) => face.status === 'loaded')
      .map((face) => face.family.replace(/^["']|["']$/g, '')));
    const familiesReady = ['Lora', 'Source Sans 3', 'Playfair Display']
      .every((family) => loadedFamilies.has(family));
    stable = fonts.status === 'loaded' && familiesReady ? stable + 1 : 0;
    if (stable >= 2) break;
    if (Date.now() >= deadline) throw new Error('font readiness did not settle within 15s: '
      + JSON.stringify({ status: fonts.status, familiesReady, faces: fonts.faces, fontNetwork }));
    await page.waitForTimeout(120);
  }
  stage('navigation/complete');
  return response;
};
const settle = async (page) => {
  // Wait for native smooth scrolling + the shared mobile chrome's 280ms transition.
  await page.waitForFunction(() => new Promise((resolve) => {
    let y = scrollY, frames = 0;
    const tick = () => { frames = Math.abs(y - scrollY) < .5 ? frames + 1 : 0; y = scrollY; frames > 12 ? resolve(true) : requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(300);
};
// Page timers/rAF do not run when scripting is disabled. Poll from the test
// process instead, still waiting for the real native smooth-scroll destination.
const settleWithoutScripts = async (page) => {
  let previous = await page.evaluate(() => scrollY), stable = 0;
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.waitForTimeout(80);
    const current = await page.evaluate(() => scrollY);
    stable = Math.abs(current - previous) < .5 ? stable + 1 : 0;
    previous = current;
    if (stable >= 5) return;
  }
  throw new Error('native no-JS scroll did not settle');
};
const inspect = (page) => page.evaluate(() => {
  const visible = (el) => el.checkVisibility ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : Boolean(el.getClientRects().length);
  const overflow = [...document.querySelectorAll('.journal-edition *')].filter(visible).map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.left < -1 || r.right > innerWidth + 1)).map(({ el, r }) => ({ tag: el.tagName, class: String(el.className), left: r.left, right: r.right })).slice(0, 12);
  const image = document.querySelector('.je-article-cover img, .lead-context img');
  const body = document.querySelector('.prose > p:not(.source-note-paragraph), .je-history-text > p');
  const metrics = (el) => el ? ({ y: Math.round(el.getBoundingClientRect().top + scrollY), width: Math.round(el.getBoundingClientRect().width) }) : null;
  const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
  const brokenAnchors = [...document.querySelectorAll('a[href^="#"]')].map((el) => el.getAttribute('href'))
    .filter((href) => !document.getElementById(decodeURIComponent(href.slice(1))));
  return { overflow, documentOverflow: document.documentElement.scrollWidth - innerWidth,
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index), brokenAnchors,
    h1: document.querySelectorAll('h1').length, contents: document.querySelectorAll('[data-journal-contents]').length,
    theme: document.documentElement.dataset.readerTheme, cover: image ? { ...metrics(image), src: new URL(image.currentSrc).pathname, loaded: image.complete && image.naturalWidth > 0 } : null,
    author: metrics(document.querySelector('.je-article-byline')), body: body ? { ...metrics(body), fontSize: getComputedStyle(body).fontSize, lineHeight: getComputedStyle(body).lineHeight } : null,
    fontFaces: [...document.fonts].filter((face) => face.status === 'loaded').map((face) => `${face.family} ${face.weight}`),
    transferBytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + entry.transferSize, 0),
    lcp: window.__journalLab?.lcp ?? null, cls: window.__journalLab?.cls ?? null };
});
const shot = (page, name, options) => page.screenshot({ path: path.join(output, `after/${name}.png`), ...options });
const assertPublishedHistory = async (page, response) => {
  assert.equal(response.status(), 200);
  assert.ok(!/noindex/i.test(response.headers()['x-robots-tag'] || ''), 'Public history may not set noindex header');
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://gospod-bog.ru/journal/dossiers/g3/history/');
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /index,\s*follow/);
  assert.equal(await page.locator('body[data-journal-id="g3-history"]').count(), 1);
  assert.equal(await page.locator('.je-review-note, [data-research-publication-status="PUBLICATION_HOLD"]').count(), 0);
  assert.equal(await page.locator('.bibliography-item').count(), 33, 'Research bibliography must contain all 33 adopted sources');
  for (const id of ['13','14','15','16']) assert.equal(await page.locator('[data-history-expansion-claim="G3-HIST-PUB-'+id+'"]').count(),1);
  assert.equal(await page.locator('.g3-matrix[data-publication-claims="G3-HIST-PUB-12"]').count(),1);
  assert.equal(await page.locator('.g3-matrix .gm-row').count(),26);
  assert.equal(await page.locator('.g3-matrix [data-journal-citation]').count(),60);
  assert.equal(await page.locator('.g3g-history').count(),1);
  assert.equal(await page.locator('.g3g-history [data-journal-citation]').count(),18);
};
const assertAdoptedFinance = async (page) => {
  const annual=page.locator('.g3-annual-finance[data-publication-claims="G3-PUB-017"]');
  assert.equal(await annual.count(),1);
  assert.equal(await annual.locator('tbody tr').count(),7);
  const rows=await annual.locator('tbody tr').evaluateAll(rows=>rows.map(row=>[...row.querySelectorAll('th,td')].map(cell=>Number(cell.textContent.replace(/\s+/gu,'').replace('−','-')))));
  assert.deepEqual(rows,[[2019,100,0,100,100],[2020,204510,29901,174609,174709],[2021,1471335,1054265,417070,591779],[2022,1735978,1010186,725792,1318931],[2023,1705689,2071986,-366297,1043850],[2024,1212253,1401429,-189176,854674],[2025,399645,950642,-550997,304459]]);
  assert.equal(await annual.locator('[data-journal-citation]').count(),2);
  assert.equal(await annual.locator('.gaf-hold').count(),0);
  const waterfall=page.locator('.g3g-finance');
  assert.equal(await waterfall.count(),1);
  assert.equal(await waterfall.locator('#cite-finance-G3-S002-2').count(),1);
  const deltas=await waterfall.locator('tbody td').evaluateAll(cells=>cells.map(cell=>Number(cell.textContent.replace(/\s+/gu,'').replace('−','-'))));
  assert.deepEqual(deltas,[817283,246511,-1994,1061800]);
  assert.equal(await page.locator('.g3g-ecosystem').count(),1);
  assert.equal(await page.locator('.g3g-ecosystem [data-journal-citation]').count(),7);
};
const citationFor = (page, kind, second = false) => page.locator(kind === 'dossier'
  ? second ? '#cite-finance-G3-S002-2' : '#finance .source-note[data-journal-citation]'
  : second ? '#cite-g3-history-challies' : '#g3-growth [data-journal-citation][href="#history-source-challies"]');
const sourceRoundTrip = async (page, citation, keyboard, onSource) => {
  const id = await citation.getAttribute('id');
  const hash = await citation.getAttribute('href');
  assert.ok(id && hash, 'the citation must have a stable SSR ID and source destination');
  if (keyboard) { await citation.focus(); await page.keyboard.press('Enter'); } else await citation.click();
  await settle(page);
  assert.equal(new URL(page.url()).hash, hash, 'native source navigation must retain its fragment');
  const source = page.locator(hash);
  assert.equal(await source.evaluate((el) => el === document.activeElement), true, 'native source destination must receive focus');
  assert.equal(await source.locator('h3').isVisible(), true);
  const back = source.locator('[data-journal-source-return]');
  assert.equal(await back.getAttribute('href'), `#${id}`, 'return to this citation, not the first use of a repeated source');
  const label = (await citation.textContent()).replace(/\s+/gu, ' ').trim();
  assert.equal(await back.getAttribute('aria-label'), `К месту чтения: ${label}`);
  if (onSource) await onSource(source);
  if (keyboard) await back.click(); else { await back.focus(); await page.keyboard.press('Enter'); }
  await settle(page);
  assert.equal(new URL(page.url()).hash, `#${id}`);
  assert.equal(await citation.evaluate((el) => el === document.activeElement), true, 'return must restore keyboard focus to the citation');
  const position = await citation.evaluate((el) => ({ y: el.getBoundingClientRect().top,
    expected: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || '0') + parseFloat(getComputedStyle(el).scrollMarginTop || '0') }));
  assert.ok(Math.abs(position.y - position.expected) < 2, `citation hidden or offset from its native fragment destination: ${JSON.stringify(position)}`);
  return { id, source: hash, keyboardOutbound: keyboard, keyboardReturn: !keyboard, focusRestored: true, position };
};

const g44Sources = [
  [
    "cite-r6-challies-2018-video",
    "challies-2018-video"
  ],
  [
    "cite-r6-firstlove-2018",
    "firstlove-2018"
  ],
  [
    "cite-r6-challies-2018-lessons",
    "challies-2018-lessons"
  ],
  [
    "cite-g3-year-2018-ascol-2018",
    "ascol-2018"
  ],
  [
    "cite-g3-year-2018-statement-2018",
    "statement-2018"
  ],
  [
    "cite-g3-year-2018-responses-2018",
    "responses-2018"
  ],
  [
    "cite-g3-year-2018-challies",
    "challies"
  ]
];
async function g44NativeReturns(page, js) {
  const section=page.locator('#g3-year-2018');
  assert.equal(await section.count(),1);
  const ordered=await section.locator('[data-journal-citation]').evaluateAll(nodes=>nodes.map(n=>n.id));
  assert.deepEqual(ordered,g44Sources.map(([id])=>id),'G44 source order / no duplication');
  const results=[];
  for (const [i,[id,sourceId]] of g44Sources.entries()) {
    const citation=section.locator('#'+id), hash='#history-source-'+sourceId;
    assert.equal(await page.locator('#'+id).count(),1);
    assert.equal(await citation.getAttribute('href'),hash);
    assert.equal(await page.locator(hash).count(),1);
    if(js) { results.push(await sourceRoundTrip(page,citation,i%2===0)); continue; }
    const fallback=sourceId==='challies'?'#g3-history':'#g3-year-2018';
    if(i%2===0){await citation.focus();await page.keyboard.press('Enter');}else await citation.click();
    await settleWithoutScripts(page);
    assert.equal(new URL(page.url()).hash,hash);
    const source=page.locator(hash), back=source.locator('[data-journal-source-return]');
    assert.equal(await source.evaluate(e=>e===document.activeElement),true);
    assert.equal(await back.count(),1);
    assert.equal(await back.getAttribute('href'),fallback);
    assert.equal(await back.getAttribute('aria-label'),null);
    if(i%2===0)await back.click();else{await back.focus();await page.keyboard.press('Enter');}
    await settleWithoutScripts(page);
    assert.equal(new URL(page.url()).hash,fallback);
    assert.equal(await page.locator(fallback).evaluate(e=>e===document.activeElement),true);
    results.push({id,source:hash,fallback,nativeFocus:true});
  }
  return results;
}


function g44MeasureFocus(root){
  const a=document.activeElement, css=getComputedStyle(a), r=a.getBoundingClientRect(), header=document.querySelector('.mcp-top'), hs=header&&getComputedStyle(header);
  const headerBottom=hs&&hs.display!=='none'&&hs.visibility!=='hidden'&&Number(hs.opacity)>0?Math.max(0,header.getBoundingClientRect().bottom):0;
  const width=parseFloat(css.outlineWidth)||0, offset=parseFloat(css.outlineOffset)||0, outset=Math.max(0,width+offset);
  const hit=(x,y)=>{const e=document.elementFromPoint(x,y);return e===a||a.contains(e);};
  const rects=node=>{
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT), out=[];
    while(walker.nextNode())if(walker.currentNode.textContent.trim()){
      const range=document.createRange();range.selectNodeContents(walker.currentNode);
      for(const rect of range.getClientRects())if(rect.width>0&&rect.height>0)out.push({rect:rect.toJSON(),parent:walker.currentNode.parentElement});
    }
    return out;
  };
  const fragments=[...a.getClientRects()].filter(x=>x.width>0&&x.height>0).map(x=>({rect:x.toJSON(),hit:hit((x.left+x.right)/2,(x.top+x.bottom)/2)}));
  const textRects=rects(a).map(x=>x.rect), inset=Math.max(0,-offset);
  const textClear=textRects.length>0&&textRects.every(x=>fragments.some(f=>x.left>=f.rect.left+inset-1&&x.right<=f.rect.right-inset+1&&x.top>=f.rect.top+inset-1&&x.bottom<=f.rect.bottom-inset+1));
  const samples=fragments.flatMap(({rect:f})=>[[f.left+width,f.top+width],[f.right-width,f.top+width],
    [f.left+width,f.bottom-width],[f.right-width,f.bottom-width],...[.2,.5,.8].flatMap(t=>[
    [f.left+(f.right-f.left)*t,f.top+width/2],[f.left+(f.right-f.left)*t,f.bottom-width/2],
    [f.left+width/2,f.top+(f.bottom-f.top)*t],[f.right-width/2,f.top+(f.bottom-f.top)*t]])]);
  const edgeMisses=samples.filter(([x,y])=>!hit(x,y));
  const textMisses=textRects.filter(t=>!hit((t.left+t.right)/2,(t.top+t.bottom)/2));
  const strips=fragments.flatMap(({rect:f})=>[
    {left:f.left,right:f.right,top:f.top,bottom:f.top+width},{left:f.left,right:f.right,top:f.bottom-width,bottom:f.bottom},
    {left:f.left,right:f.left+width,top:f.top,bottom:f.bottom},{left:f.right-width,right:f.right,top:f.top,bottom:f.bottom}]);
  const intersects=(x,y)=>Math.min(x.right,y.right)-Math.max(x.left,y.left)>.5&&Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top)>.5;
  const neighborCollisions=rects(root).filter(t=>!a.contains(t.parent)&&strips.some(strip=>intersects(strip,t.rect))).map(t=>t.rect);
  const clippingAncestors=[];
  for(let el=a.parentElement;el&&el!==document.documentElement;el=el.parentElement){
    const st=getComputedStyle(el), box=el.getBoundingClientRect();
    const cx=['hidden','clip','auto','scroll'].includes(st.overflowX),cy=['hidden','clip','auto','scroll'].includes(st.overflowY);
    if(!cx&&!cy)continue;
    const clip={left:box.left+el.clientLeft,right:box.left+el.clientLeft+el.clientWidth,top:box.top+el.clientTop,bottom:box.top+el.clientTop+el.clientHeight};
    if(fragments.some(({rect:f})=>(cx&&(f.left-outset<clip.left-1||f.right+outset>clip.right+1))||(cy&&(f.top-outset<clip.top-1||f.bottom+outset>clip.bottom+1))))clippingAncestors.push({tag:el.tagName,id:el.id,clip});
  }
  const rgba=value=>{
    const m=value.match(/^rgba?\(([^)]+)\)$/i);if(!m)return null;
    const values=m[1].trim().split(/[,\s/]+/).map(Number);
    return (values.length===3||values.length===4)&&values.every(Number.isFinite)?[...values.slice(0,3),values[3]??1]:null;
  };
  const ring=rgba(css.outlineColor);let background=null,determinable=true,opacity=1;
  for(let el=a;el;el=el.parentElement){
    const st=getComputedStyle(el);opacity*=Number(st.opacity);
    if(!background&&determinable){
      const bg=rgba(st.backgroundColor);
      if(st.backgroundImage!=='none'||!bg||(bg[3]>0&&bg[3]<1))determinable=false;
      else if(bg[3]===1)background=bg;
    }
  }
  const luminance=c=>c.slice(0,3).map(n=>{const s=n/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  let contrast=null;
  if(ring&&background&&determinable&&opacity===1){
    const painted=ring.slice(0,3).map((n,i)=>n*ring[3]+background[i]*(1-ring[3]));
    const l=[luminance(painted),luminance(background)];contrast=(Math.max(...l)+.05)/(Math.min(...l)+.05);
  }
  const indicatorVisible=Boolean(ring&&ring[3]>0&&opacity>0&&css.visibility==='visible');
  const viewportWidth=document.documentElement.clientWidth;
  return {id:a.id,inside:root.contains(a),focusVisible:a.matches(':focus-visible'),rect:r.toJSON(),headerBottom,width,offset,outset,style:css.outlineStyle,color:css.outlineColor,indicatorVisible,contrast,background,opacity,fragments,textRects,textClear,edgeSamples:samples.length,edgeMisses,textMisses,neighborCollisions,clippingAncestors,scrollY,viewportWidth,viewportHeight:innerHeight,
    viewportOK:r.height>=44&&r.left-outset>=-1&&r.right+outset<=viewportWidth+1&&r.top-outset>=headerBottom-1&&r.bottom+outset<=innerHeight+1,
    overflow:document.documentElement.scrollWidth-viewportWidth,
    scrollMarginTop:css.scrollMarginTop,scrollMarginBottom:css.scrollMarginBottom};
}

// Standalone links must retain a distinct action cue without a resting
// underline wall. Inspect real computed geometry and forced-color recovery.
const historyActionIds = ["cite-g3-invitation-2011","cite-g3-history-challies","cite-g3-year-2013-gnl-2013","cite-g3-year-2013-challies","cite-g3-year-2014-sbts-2014","cite-g3-year-2014-gnl-2014","cite-g3-year-2015-gnl-2015","cite-g3-year-2016-gnl-2016","cite-g3-year-2017-gnl-2017","cite-r6-challies-2018-video","cite-r6-firstlove-2018","cite-r6-challies-2018-lessons","cite-g3-year-2018-ascol-2018","cite-g3-year-2018-statement-2018","cite-g3-year-2018-responses-2018","cite-g3-year-2018-challies","cite-g3-year-2019-announcement-2019","cite-g3-year-2019-gnl-2019","cite-g3-year-2019-piper-2019","cite-g3-year-2020-gnl-2020","cite-r6-white-manuscripts-2022","cite-r6-white-bible-2022","cite-g3-year-2023-announcement-2023","cite-g3-year-2024-reformation-2024","cite-g3-year-2024-316-2024","cite-g3-year-2024-cessationist-2024","cite-g3-year-2024-peters-2024","cite-g3-year-2024-early-venue-2023","cite-r6-crotts-2021","cite-r6-benson-2022","cite-g3-growth-challies","cite-g3-growth-aniol-2021","cite-g3-growth-context-overview"];
const dossierActionKeys = ["#journal-g3-toc","#documents","#overview","cite-timeline-G3-S001","cite-timeline-G3-S008","cite-timeline-G3-S010","cite-timeline-G3-S096","cite-timeline-G3-S015","cite-timeline-G3-S011","cite-finance-G3-S002","cite-governance-G3-S096","cite-buice-G3-S008","cite-buck-G3-S012","#bibliography","#documents"];
async function standaloneSourceActions(page, kind, forced = false) {
  const selector = kind === 'history'
    ? '.je-history-footnote > a, .jcdi-records a[data-journal-citation]'
    : kind === 'atlas' ? '.g3g-history a[data-journal-citation]'
    : kind === 'atlas-map' ? '.g3g-history .g3g-atlas-list a[data-journal-citation]'
    : '.je-contents-jump, .je-contents > .je-contents-return, .source-note-paragraph > a.source-note, .timeline div > a.claim-ref';
  // Measure resting affordance, never an incidental hover after scrolling.
  await page.mouse.move(0, 0);
  const rows = await page.locator(selector).evaluateAll(nodes => nodes.map(el => {
    const style = getComputedStyle(el), arrow = getComputedStyle(el, '::after'), rect = el.getBoundingClientRect();
    const blockers = [];
    for (let node = el; node; node = node.parentElement) {
      const css = getComputedStyle(node);
      if (css.display === 'none' || css.visibility !== 'visible' || Number(css.opacity) === 0 ||
          css.pointerEvents === 'none' || node.hasAttribute('inert') || node.getAttribute('aria-hidden') === 'true') blockers.push(node.tagName);
    }
    return { id: el.id, href: el.getAttribute('href'), height: rect.height, left: rect.left, right: rect.right,
      viewport: document.documentElement.clientWidth, decoration: style.textDecorationLine,
      width: rect.width, blockers, hovered: el.matches(':hover'), hoverCapable: matchMedia('(hover: hover) and (pointer: fine)').matches, nativeClosedReturn: el.matches('.je-contents-return') && !el.closest('details').open,
      arrow: arrow.content !== 'none' && arrow.borderTopStyle === 'solid' && arrow.borderRightStyle === 'solid' };
  }));
  const expected = kind === 'history' ? historyActionIds : (kind === 'atlas' || kind === 'atlas-map')
    ? Array.from({length:kind === 'atlas' ? 18 : 5},(_,i)=>'cite-g3g-history-'+(i+1)) : dossierActionKeys;
  assert.deepEqual(rows.map(row => row.id || row.href), expected, kind + ' exact standalone action inventory');
  for (const row of rows) {
    if (row.nativeClosedReturn) continue;
    assert.ok(!row.blockers.length && row.width > 0 && row.height >= 43.5 && row.left >= -1 && row.right <= row.viewport + 1, JSON.stringify(row));
    assert.ok(row.arrow, 'missing standalone action cue: ' + JSON.stringify(row));
    assert.ok(!row.hovered || !row.hoverCapable, 'resting witness must not measure a pointer-hovered source: ' + JSON.stringify(row));
    assert.equal(row.decoration.includes('underline'), forced, 'resting/forced-color action cue: ' + JSON.stringify(row));
  }
  return rows;
}
// Open the real native chronology only for its source-action witness; restore
// the original state before the next screenshot or interaction.
async function atlasSourceActions(page, forced = false) {
  const chronology = page.locator('.g3g-history .g3g-chron-details');
  const summary = chronology.locator('summary');
  assert.equal(await chronology.count(),1);
  assert.equal(await summary.count(),1);
  const wasOpen = await chronology.evaluate(el=>el.open);
  const map = await standaloneSourceActions(page,'atlas-map',forced);
  const hiddenRows = chronology.locator('a[data-journal-citation]');
  assert.equal(await hiddenRows.count(),13);
  assert.deepEqual(await hiddenRows.evaluateAll(nodes=>nodes.map(n=>n.id)),Array.from({length:13},(_,i)=>'cite-g3g-history-'+(i+6)));
  try {
    if (!wasOpen) {
      // Native summary activation, not forced visibility.
      await summary.click();
      assert.equal(await chronology.evaluate(el=>el.open),true);
    }
    const expanded = await standaloneSourceActions(page,'atlas',forced);
    return { map, expanded, initiallyOpen:wasOpen };
  } finally {
    if ((await chronology.evaluate(el=>el.open))!==wasOpen) {
      await summary.click();
      assert.equal(await chronology.evaluate(el=>el.open),wasOpen,'restore native chronology state');
    }
  }
}

// Adversarial checks run on the real routed page AFTER visual capture, in a
// discarded context. Restore each mutation before the next independent case.
async function rejectBrokenSourceActions(page) {
  const first = page.locator('#' + historyActionIds[0]);
  const results = [];
  for (const [name, value] of [['display','none'],['visibility','hidden'],['opacity','0'],['pointer-events','none'],['text-decoration','underline']]) {
    const prior = await first.evaluate((el, prop) => ({ value:el.style.getPropertyValue(prop), priority:el.style.getPropertyPriority(prop) }), name);
    try {
      await first.evaluate((el, [prop, val]) => el.style.setProperty(prop,val,'important'), [name,value]);
      await assert.rejects(standaloneSourceActions(page,'history'), { name:'AssertionError' }, 'hidden/noninteractive source must fail: '+name);
      results.push(name);
    } finally {
      await first.evaluate((el, [prop, prior]) => { if(prior.value)el.style.setProperty(prop,prior.value,prior.priority);else el.style.removeProperty(prop); }, [name,prior]);
    }
  }
  for (const attr of ['inert','aria-hidden','data-id-probe']) {
    const original = await first.evaluate((el, attr) => attr==='data-id-probe'?el.id:el.getAttribute(attr),attr);
    try {
      await first.evaluate((el, attr) => { if(attr==='data-id-probe')el.id='missing-source-id-probe';else el.setAttribute(attr,'true'); },attr);
      await assert.rejects(standaloneSourceActions(page,'history'), { name:'AssertionError' }, 'incomplete/noninteractive source must fail: '+attr);
      results.push(attr);
    } finally {
      // The exact element is still in place even when its ID was mutated.
      if(attr==='data-id-probe')await page.locator('#missing-source-id-probe').evaluate((el,id)=>el.id=id,original);
      else await first.evaluate((el,[attr,original])=>{if(original===null)el.removeAttribute(attr);else el.setAttribute(attr,original);},[attr,original]);
    }
  }
  assert.equal((await standaloneSourceActions(page,'history')).length,33,'restore original source inventory');
  return results;
}
// Check the approved hover affordance separately from the strict resting oracle.
async function sourceActionHoverWitness(page) {
  if (!await page.evaluate(()=>matchMedia('(hover: hover) and (pointer: fine)').matches)) return { supported:false };
  const ids=[historyActionIds[0],'cite-r6-challies-2018-video','cite-g3g-history-1'];
  const results=[];
  try {
    for(const id of ids) {
      const link=page.locator('#'+id);
      await page.mouse.move(0,0);
      const before=await link.evaluate(el=>({hovered:el.matches(':hover'),decoration:getComputedStyle(el).textDecorationLine}));
      assert.ok(!before.hovered && !before.decoration.includes('underline'),id+' rest');
      await link.hover();
      const hover=await link.evaluate(el=>({hovered:el.matches(':hover'),decoration:getComputedStyle(el).textDecorationLine}));
      assert.ok(hover.hovered && hover.decoration.includes('underline'),id+' native hover');
      await page.mouse.move(0,0);
      const after=await link.evaluate(el=>({hovered:el.matches(':hover'),decoration:getComputedStyle(el).textDecorationLine}));
      assert.deepEqual(after,before,id+' restored rest');
      results.push({id,before,hover,after});
    }
  } finally { await page.mouse.move(0,0); }
  return {supported:true,results};
}
async function wideHistoryGeometry(page) {
  const state = await page.evaluate(() => {
    const rect = el => el.getBoundingClientRect().toJSON();
    const grid = document.querySelector('[data-editorial-layout="wide"]');
    const rail = grid.querySelector('.je-editorial-rail'), story = grid.querySelector('.journal-story-column');
    const atlas = story.querySelector('.g3g-history'), index = story.querySelector('#g3-2018-document-index');
    const svg = atlas.querySelector('.g3g-atlas-map svg'), land = svg.querySelector('.g3g-atlas-land');
    const frame = rect(svg), painted = rect(land);
    const label = svg.querySelector('.g3g-atlas-coordinate text');
    const matrix = label.getScreenCTM();
    return { viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
      grid: rect(grid), rail: rect(rail), story: rect(story), atlas: rect(atlas), index: rect(index),
      ordinary: rect(story.querySelector('#g3-speakers')), origin: rect(story.querySelector('.je-history-origin')),
      paragraph: rect(story.querySelector('#g3-year-2018 .je-history-text > p')), frame, painted,
      paintedWidth: Math.max(0, Math.min(frame.right, painted.right) - Math.max(frame.left, painted.left)),
      labelSize: parseFloat(getComputedStyle(label).fontSize) * Math.hypot(matrix.a, matrix.b),
      atlasTextSizes: [atlas.querySelector('.g3g-map-key'),atlas.querySelector('.g3g-atlas-list h5'),atlas.querySelector('.g3g-atlas-list a')].map(el=>parseFloat(getComputedStyle(el).fontSize)),
      markers: Array.from(svg.querySelectorAll('.g3g-atlas-marker > *')).map(rect),
      mapLabels: Array.from(svg.querySelectorAll('text')).map(el => ({ text:el.textContent.trim(), box:rect(el),
        size:parseFloat(getComputedStyle(el).fontSize)*Math.hypot(el.getScreenCTM().a,el.getScreenCTM().b) })),
      mapKey: rect(atlas.querySelector('.g3g-map-key')),
      mapKeyItems: Array.from(atlas.querySelectorAll('.g3g-map-key > span')).map(rect),
      mapList: rect(atlas.querySelector('.g3g-atlas-list')),
      mapRows: Array.from(atlas.querySelectorAll('.g3g-atlas-list li')).map(rect),
      mapLinks: atlas.querySelectorAll('.g3g-atlas-list a').length,
      allAtlasLinks: Array.from(atlas.querySelectorAll('a[data-journal-citation]')).map(a => a.id),
      scale: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gb-reader-font-scale') || '1') };
  });
  assert.equal(state.scrollWidth, state.viewport, 'wide layout root overflow');
  assert.equal(state.markers.length, 4);
  assert.equal(state.mapLabels.length,13);
  assert.equal(state.mapKeyItems.length,2);
  assert.equal(state.mapRows.length,4);
  assert.equal(state.mapLinks, 5);
  const inside=(box,parent)=>box.width>0&&box.height>0&&box.left>=parent.left-1&&box.right<=parent.right+1&&box.top>=parent.top-1&&box.bottom<=parent.bottom+1;
  const disjoint=(boxes)=>boxes.every((a,i)=>boxes.slice(i+1).every(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1||Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1));
  assert.ok(state.markers.every(box=>inside(box,state.frame))&&disjoint(state.markers),'atlas markers must be inside map and separated');
  assert.ok(state.mapLabels.every(label=>label.text&&inside(label.box,state.frame))&&disjoint(state.mapLabels.map(label=>label.box)),'atlas text must be inside map and not overlap other labels');
  assert.ok(inside(state.mapKey,state.atlas)&&inside(state.mapList,state.atlas)&&state.mapKey.top>=state.frame.bottom-1&&state.mapList.top>=state.mapKey.bottom-1,'map, key and source list must occupy separate natural flow');
  assert.ok(state.mapKeyItems.every(box=>inside(box,state.mapKey))&&disjoint(state.mapKeyItems),'legend must fit without overlapping');
  assert.ok(state.mapRows.every(box=>inside(box,state.mapList))&&disjoint(state.mapRows),'map source rows must fit without overlapping');
  assert.deepEqual(state.allAtlasLinks, Array.from({length:18}, (_,i) => 'cite-g3g-history-' + (i+1)));
  for (const box of [state.atlas,state.index,state.ordinary,state.origin,state.paragraph]) {
    assert.ok(box.left >= -1 && box.right <= state.viewport + 1 && box.left >= state.story.left - 1 && box.right <= state.story.right + 1, JSON.stringify(state));
  }
  assert.ok(state.ordinary.width <= 741 && state.origin.width <= 741 && state.paragraph.width <= 741, 'prose measure changed');
  assert.ok(state.paintedWidth >= state.frame.width * .94, 'SVG painted geography must use the actual frame, not a small centered drawing');
  if (page.viewportSize().width >= 1440) {
    assert.ok(state.atlas.width >= state.story.width - 2 && state.atlas.width > state.ordinary.width * 1.4, 'wide atlas not using its track');
    assert.ok(state.atlas.right <= state.rail.left - 16 && state.index.right <= state.rail.left - 16, 'figure intersects separate TOC track');
    assert.ok(state.index.width >= Math.min(1100,state.story.width) - 2 && state.index.width <= 1101);
    assert.ok(state.paintedWidth > state.ordinary.width * 1.35 && state.mapLabels.every(label=>label.size>=14), 'map itself must scale and retain readable desktop labels');
  }
  return state;
}
async function g44RouteWitness(page, js, name, controlOnly=false) {
  const index=page.locator('#g3-2018-document-index'), toc=page.locator('[data-journal-contents]');
  assert.equal(await index.count(),1);
  const links=index.locator('a[data-journal-citation]');
  const ids=g44Sources.map(([id])=>id);
  assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>n.id)),ids);
  const result={viewport:page.viewportSize(),js,forward:[],backward:[],controlOnly};
  const diagnostic=engine==='webkit'&&!js&&[320,390].includes(result.viewport.width);
  const trace=async()=>page.evaluate(()=>{
    const a=document.activeElement, r=a.getBoundingClientRect(), v=window.visualViewport;
    return {id:a.id,tag:a.tagName,href:a.getAttribute('href'),focusVisible:a.matches(':focus-visible'),
      hash:location.hash,scrollY,rect:r.toJSON(),innerHeight,innerWidth,
      visualViewport:v?{width:v.width,height:v.height,offsetTop:v.offsetTop,offsetLeft:v.offsetLeft,pageTop:v.pageTop,scale:v.scale}:null};
  });
  const traceSeries=async()=>{
    const values=[{elapsedMs:0,state:await trace()}];
    let elapsed=0;
    for(const delay of [75,75,150,300,600]){
      await page.waitForTimeout(delay);elapsed+=delay;
      values.push({elapsedMs:elapsed,state:await trace()});
    }
    return values;
  };
  const startNative=async()=>{
    if(!await toc.evaluate(el=>el.open)) await toc.locator('summary').click();
    await toc.locator('a[href="#g3-year-2018"]').click();
    await settleWithoutScripts(page);
    assert.equal(new URL(page.url()).hash,'#g3-year-2018');
    assert.equal(await page.locator('#g3-year-2018').evaluate(el=>el===document.activeElement),true);
  };
  // Capture the real, built component before sequential keyboard navigation.
  // A locator screenshot can scroll; never use it to make a focus state pass.
  await index.screenshot({path:path.join(output,'after',name+'-g44-spread.png'),timeout:8000});
  // Ordinary wheel input is a separate art witness, before the native
  // keyboard sequence starts. Keep all real sticky chrome in the capture.
  if(js&&result.viewport.width<=430){
    const firstRow=()=>index.evaluate(root=>{
      const row=root.querySelector('li'), rect=row.getBoundingClientRect();
      const visibleRects=[...row.querySelectorAll('.jcdi-date,.jcdi-label,a[data-journal-citation]')].flatMap(el=>{
        const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT), rects=[];
        while(walker.nextNode())if(walker.currentNode.textContent.trim()){
          const range=document.createRange();range.selectNodeContents(walker.currentNode);
          for(const r of range.getClientRects()){
            if(!r.width||!r.height)continue;
            const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);
            rects.push({text:walker.currentNode.textContent,rect:r.toJSON(),visible:r.top>=0&&r.bottom<=innerHeight&&el.contains(hit)});
          }
        }
        return rects;
      });
      return {scrollY,rect:rect.toJSON(),height:innerHeight,visibleRects,
        allTextVisible:visibleRects.length>0&&visibleRects.every(r=>r.visible)};
    });
    result.artWitness={before:await firstRow()};
    await shot(page,name+'-g44-mobile-before-wheel');
    const now=await firstRow();
    // A single native wheel gesture aims the first row at mid-viewport.
    // No scrollIntoView/focus/hidden-header intervention.
    await page.mouse.move(Math.floor(result.viewport.width/2),Math.floor(result.viewport.height*.8));
    await page.mouse.wheel(0,Math.round(now.rect.top+now.rect.height/2-now.height/2));
    await settleWithoutScripts(page);
    result.artWitness.after=await firstRow();
    await shot(page,name+'-g44-mobile-after-wheel');
    result.artWitness.afterShot=await firstRow();
    console.log('G44_ART_WHEEL '+JSON.stringify({name,before:result.artWitness.before.allTextVisible,after:result.artWitness.after.allTextVisible,afterShot:result.artWitness.afterShot.allTextVisible}));
    assert.ok(result.artWitness.after.allTextVisible&&result.artWitness.afterShot.allTextVisible,'G44 first row must be readable after ordinary wheel input');
  }
  const original=await page.evaluate(()=>{
    const style=document.documentElement.style;
    return {value:style.getPropertyValue('--gb-reader-font-scale'),priority:style.getPropertyPriority('--gb-reader-font-scale')};
  });
  const font=()=>links.first().evaluate(a=>parseFloat(getComputedStyle(a).fontSize));
  const before=await font();
  try {
    await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','2'));
    const after=await font();
    assert.ok(Math.abs(after-2*before)<.25,'G44 must actually scale reading labels to 200%');
    result.scale={before,after};
    // Native TOC activation is the sequential starting point, not focus() on
    // every link. The first Tab must arrive at the first real document citation.
    await startNative();
    const focusState=async expected=>{
      let state, previous, stable=0;
      for(let attempt=0;attempt<45;attempt++){
        state=await index.evaluate(g44MeasureFocus);
        result.lastState=state;
        if(state.id!==expected){
          // Keep the original mismatch a failure; retain subsequent native
          // observations to distinguish a transient from a repeated focus.
          if(diagnostic)result.mismatchSeries=await traceSeries();
          break;
        }
        const now=[state.scrollY,state.rect.top,state.rect.bottom,state.headerBottom];
        stable=previous&&now.every((x,i)=>Math.abs(x-previous[i])<.5)?stable+1:0;
        if(stable>=4&&state.viewportOK)break;
        previous=now;await page.waitForTimeout(75);
      }
      assert.equal(state.id,expected,'native G44 Tab/Shift+Tab order');
      assert.ok(stable>=4,'G44 native focus did not settle: '+JSON.stringify(state));
      assert.ok(state.inside&&state.focusVisible&&state.width>=2&&state.style==='solid'&&state.viewportOK&&state.overflow===0,'G44 focus / viewport: '+JSON.stringify(state));
      assert.ok(state.fragments.length>0&&state.fragments.every(f=>f.hit)&&state.textClear,'G44 focus fragments or text clipped: '+JSON.stringify(state));
      assert.ok(state.indicatorVisible&&state.offset===-state.width,'G44 fully inset painted focus indicator: '+JSON.stringify(state));
      // G44 is a flat-paper component: unknown composited contrast is missing evidence,
      // not permission to pass. Other Journal surfaces retain their own rules.
      assert.ok(state.contrast!==null&&state.contrast>=3,'G44 focus indicator contrast not established: '+JSON.stringify(state));
      assert.ok(state.edgeSamples>0&&!state.edgeMisses.length&&!state.textMisses.length&&!state.neighborCollisions.length&&!state.clippingAncestors.length,'G44 focus edge/text/ancestor occlusion: '+JSON.stringify(state));
      return state;
    };
    // B: the acceptance sequence is native input only. No screenshot or
    // locator scrolling between any forward and reverse key presses.
    result.keyboardTrace={variant:'B-no-intermediate-screenshot',keys:[]};
    for(const [i,id] of (controlOnly?ids.slice(0,2):ids).entries()){
      const step=diagnostic&&i<2?{expected:id,before:await trace()}:null;
      if(step)result.keyboardTrace.keys.push(step);
      await page.keyboard.press('Tab');
      if(step)step.afterKey=await trace();
      const state=await focusState(id);result.forward.push(state);
      if(step)step.settled=await trace();
    }
    if(!controlOnly){
      for(const id of ids.slice(0,-1).reverse()){
        await page.keyboard.press('Shift+Tab');result.backward.push(await focusState(id));
      }
      assert.equal(result.forward.length,7);assert.equal(result.backward.length,6);
    }else assert.equal(result.forward.length,2);
    // The following screenshot is AFTER the entire uninterrupted witness.
    await shot(page,name+(controlOnly?'-g44-control-end':'-g44-2x-reverse'));
    // A: independently restart by the same native fragment; isolate the
    // screenshot operation from acceptance. Never use this replay to make B pass.
    await startNative();
    await page.keyboard.press('Tab');await focusState(ids[0]);
    if(diagnostic)result.screenshotTrace={variant:'A-intermediate-screenshot',beforeShot:await trace()};
    await shot(page,name+'-g44-2x-first');
    if(diagnostic){
      result.screenshotTrace.afterShot=await trace();
      result.screenshotTrace.beforeSecondKey=await trace();
      await page.keyboard.press('Tab');
      result.screenshotTrace.afterSecondKey=await traceSeries();
      result.screenshotTrace.secondReachedExpected=result.screenshotTrace.afterSecondKey.at(-1).state.id===ids[1];
      fs.writeFileSync(path.join(output,'after',name+'-g44-screenshot-ab.json'),JSON.stringify({
        head:report.head,engine,viewport:result.viewport,controlOnly,
        expected:ids.slice(0,2),B:result.keyboardTrace,A:result.screenshotTrace
      },null,2)+'\n');
      console.log('G44_SCREENSHOT_AB '+JSON.stringify({name,controlOnly,
        B:result.keyboardTrace.keys.map(k=>({expected:k.expected,before:k.before.id,after:k.afterKey.id,settled:k.settled.id})),
        A:{before:result.screenshotTrace.beforeShot,after:result.screenshotTrace.afterShot,
          secondReachedExpected:result.screenshotTrace.secondReachedExpected,final:result.screenshotTrace.afterSecondKey.at(-1).state}}));
    }
    if(!controlOnly){
      // Independent native replay for the final-link screenshot. No screenshot
      // before reaching it, and no acceptance claim based on this replay.
      await startNative();
      for(const id of ids){await page.keyboard.press('Tab');await focusState(id);}
      await shot(page,name+'-g44-2x-last');
    }
  }catch(error){
    result.failure=error.message;
    fs.writeFileSync(path.join(output,'after',name+'-g44-failure.json'),JSON.stringify({head:report.head,engine,...result},null,2)+'\n');
    await shot(page,name+'-g44-failure',{timeout:8000}).catch(()=>{});
    throw error;
  }finally{
    await page.evaluate(({value,priority})=>{
      const style=document.documentElement.style;
      if(value)style.setProperty('--gb-reader-font-scale',value,priority);else style.removeProperty('--gb-reader-font-scale');
    },original);
  }
  if(!controlOnly){
    result.returns=await g44NativeReturns(page,js);
    assert.equal(result.returns.length,7);
  }
  return result;
}

// axe reports contrast review items for rows clipped by a native scrollport.
// Retain every item; accept only this measured case, with a flat opaque paper
// background and independently computed >=4.5:1 foreground contrast. Anything
// outside this exact relationship remains a failing/unresolved review item.
const reviewClippedContrast = async (page, reviews) => {
  const witnesses = [];
  for (const review of reviews) {
    assert.equal(review.id, 'color-contrast', 'unexpected compact-TOC accessibility review');
    for (const node of review.nodes) {
      assert.ok(node.summary?.includes("Element's background color could not be determined because it's partially obscured by another element"), 'unresolved axe review: '+JSON.stringify(node));
      assert.equal(node.target.length, 1);
      const state = await page.evaluate((selector) => {
        const matches = document.querySelectorAll(selector), el = matches[0];
        const nav = el?.closest('[data-journal-contents] nav'), link = el?.closest('a');
        if (matches.length !== 1 || !nav || !link || !nav.contains(link)) return { validTarget: false };
        const rgb = (color) => /^rgba?\(/u.test(color) ? color.match(/[\d.]+/gu).map(Number) : [];
        const fg = rgb(getComputedStyle(el).color);
        let parent = el, bg = [], flat = true;
        while (parent && bg.length === 0) {
          const style = getComputedStyle(parent), color = rgb(style.backgroundColor);
          flat &&= style.backgroundImage === 'none' && Number(style.opacity) === 1 && style.filter === 'none' && style.mixBlendMode === 'normal';
          if (color.length >= 3 && (color[3] ?? 1) > 0) bg = color;
          parent = parent.parentElement;
        }
        const luminance = (color) => color.slice(0, 3).map((c) => c / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
          .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        const a = luminance(fg), b = luminance(bg), r = nav.getBoundingClientRect();
        const clip = { left: r.left + nav.clientLeft, top: r.top + nav.clientTop,
          right: r.left + nav.clientLeft + nav.clientWidth, bottom: r.top + nav.clientTop + nav.clientHeight };
        const inside = (r) => r.left >= clip.left - 1 && r.right <= clip.right + 1 && r.top >= clip.top - 1 && r.bottom <= clip.bottom + 1;
        const rect = el.getBoundingClientRect().toJSON(), linkRect = link.getBoundingClientRect().toJSON();
        return { validTarget: true, foreground: fg, background: bg, flat,
          opaque: fg.length >= 3 && bg.length >= 3 && (fg[3] ?? 1) === 1 && (bg[3] ?? 1) === 1,
          contrastRatio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), clip, rect, linkRect,
          clipped: !inside(rect) || !inside(linkRect) };
      }, node.target[0]);
      assert.ok(state.validTarget && state.flat && state.opaque && state.clipped && state.contrastRatio >= 4.5,
        `unresolved contrast review: ${JSON.stringify({ target: node.target, state })}`);
      witnesses.push({ target: node.target, ...state });
    }
  }
  return witnesses;
};
try {
  // W64: actual authored history page, not another off-route geometry fixture.
  // Keep normal viewport captures with neighbouring prose and sticky chrome.
  if (engine === 'chromium' && ['full', 'short'].includes(suite) && widths.includes(1440)) {
    report.wideHistory = [];
    for (const width of [390,430,1440,1920]) for (const theme of ['light','dark']) {
      const viewport = { width, height: width <= 430 ? 844 : 900 };
      const context = await contextFor(width, theme, { viewport });
      const page = await context.newPage();
      const name = 'history-wide-' + width + 'x' + viewport.height + '-' + theme;
      const item = { name, viewport, theme, runtime: [] };
      monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
      try {
        const response = await ready(page, routes.find(route => route.kind === 'history').url);
        await assertPublishedHistory(page, response);
        item.normal = await wideHistoryGeometry(page);
        item.atlasSourceActions = await atlasSourceActions(page);
        if (width <= 430) item.sourceActions = await standaloneSourceActions(page,'history');
        await shot(page, name + '-full', { fullPage: true });
        for (const [label, selector] of [['atlas','.g3g-history'], ['g44','#g3-2018-document-index']]) {
          await page.locator(selector).evaluate(el => window.scrollTo({top:scrollY + el.getBoundingClientRect().top - 160,behavior:'instant'}));
          await settleWithoutScripts(page);
          await shot(page, name + '-' + label, { fullPage: false });
        }
        await page.evaluate(() => document.documentElement.style.setProperty('--gb-reader-font-scale','2'));
        await settleWithoutScripts(page);
        item.scaled = await wideHistoryGeometry(page);
        item.scaledAtlasSourceActions = await atlasSourceActions(page);
        assert.equal(item.scaled.scale,2);
        assert.ok(item.scaled.atlasTextSizes.every((size,i)=>Math.abs(size-item.normal.atlasTextSizes[i]*2)<.25),'atlas text alternative must follow 200% Reader scale');
        for (const [label, selector] of [['atlas','.g3g-history'], ['g44','#g3-2018-document-index']]) {
          await page.locator(selector).evaluate(el => window.scrollTo({top:scrollY + el.getBoundingClientRect().top - 160,behavior:'instant'}));
          await settleWithoutScripts(page);
          await shot(page, name + '-' + label + '-200pct', { fullPage: false });
        }
        if (width===390 && theme==='light') {
          await page.evaluate(()=>document.documentElement.style.setProperty('--gb-reader-font-scale','1'));
          await settleWithoutScripts(page);
          item.negativeSourceActions = await rejectBrokenSourceActions(page);
          item.sourceActionHover = await sourceActionHoverWitness(page);
          const atlasChronology = page.locator('.g3g-history .g3g-chron-details');
          assert.equal(await atlasChronology.evaluate(el=>el.open),false,'native closed chronology baseline');
          item.atlasNativeReturns = [await sourceRoundTrip(page,page.locator('#cite-g3g-history-1'),true)];
          await atlasChronology.locator('summary').click();
          try {
            assert.equal(await atlasChronology.evaluate(el=>el.open),true);
            item.atlasNativeReturns.push(await sourceRoundTrip(page,page.locator('#cite-g3g-history-6'),false));
          } finally {
            if(await atlasChronology.evaluate(el=>el.open))await atlasChronology.locator('summary').click();
          }
          assert.equal(await atlasChronology.evaluate(el=>el.open),false);
        }
        assert.deepEqual(item.runtime, []);
        console.log('PASS '+name);
      } catch (error) {
        item.failure = error.message; report.problems.push(name + ': ' + error.message);
        console.error('FAIL '+name+': '+error.message);
        await shot(page,name+'-failure').catch(()=>{});
      } finally { report.wideHistory.push(item); await context.close(); }
    }
  }
  // W50: normal desktop context in a fresh browser context, outside native Tab.
  // Mobile contextual evidence already exists in the mobile suite.
  if (engine === 'chromium' && ['full', 'short'].includes(suite) && widths.includes(1440)) {
    report.g44DesktopContext = [];
    for (const theme of ['light', 'dark']) {
      const viewport = { width: 1440, height: 900 };
      const context = await contextFor(viewport.width, theme, { viewport });
      const page = await context.newPage();
      const name = 'history-context-1440x900-' + theme + '-g44';
      const item = { name, theme, viewport, runtime: [] };
      monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
      try {
        const response = await ready(page, routes.find(route => route.kind === 'history').url);
        await assertPublishedHistory(page, response);
        const index = page.locator('#g3-2018-document-index');
        assert.equal(await index.count(), 1);
        const measure = () => index.evaluate(root => {
          const lanes = root.querySelector('.jcdi-lanes'), css = getComputedStyle(root);
          const rect = el => el.getBoundingClientRect().toJSON();
          const style = el => {
            const s = getComputedStyle(el);
            return { fontSize: parseFloat(s.fontSize), lineHeight: s.lineHeight,
              fontFamily: s.fontFamily, fontWeight: s.fontWeight, color: s.color, rect: rect(el) };
          };
          const preceding = root.previousElementSibling;
          const header = document.querySelector('.mcp-top'), hs = header && getComputedStyle(header);
          const headerBottom = hs && hs.display !== 'none' && hs.visibility !== 'hidden' && Number(hs.opacity) > 0
            ? Math.max(0, rect(header).bottom) : 0;
          const tracks = getComputedStyle(lanes).gridTemplateColumns;
          return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
            theme: document.documentElement.dataset.readerTheme, paper: css.getPropertyValue('--je-paper').trim(),
            readerScale: parseFloat(css.getPropertyValue('--gb-reader-font-scale').trim() || '1'),
            container: rect(root), containerFont: parseFloat(css.fontSize), tracks, columns: tracks.trim().split(/\s+/).length,
            heading: style(root.querySelector('.jcdi-title')), headerBottom, scrollY,
            preceding: preceding ? { tag: preceding.tagName, rect: rect(preceding) } : null,
            rootOverflow: root.scrollWidth - root.clientWidth,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            rows: [...root.querySelectorAll('.jcdi-records > li')].map(li => {
              const link = li.querySelector('a[data-journal-citation]');
              return { id: link.id, rect: rect(li), overflow: li.scrollWidth - li.clientWidth,
                date: style(li.querySelector('.jcdi-date')), event: style(li.querySelector('.jcdi-label')), link: style(link) };
            }) };
        });
        // Match the heading-relative reading position, keep real chrome/prose.
        await index.evaluate(root => window.scrollTo({ top: scrollY + root.getBoundingClientRect().top - 180, behavior: 'instant' }));
        await settleWithoutScripts(page);
        item.normal = await measure();
        await shot(page, name + '-normal', { fullPage: false });
        item.afterShot = await measure();
        const normal = item.normal;
        assert.deepEqual(normal.viewport, { ...viewport, dpr: 1 });
        assert.equal(normal.theme, theme);
        assert.equal(normal.readerScale, 1);
        assert.equal(normal.columns, 2);
        assert.equal(normal.rootOverflow, 0);
        assert.equal(normal.documentOverflow, 0);
        assert.deepEqual(normal.rows.map(row => row.id), g44Sources.map(([id]) => id));
        assert.ok(normal.rows.every(row => row.overflow <= 0 && row.link.rect.height >= 44));
        assert.ok(normal.heading.rect.top >= normal.headerBottom && normal.heading.rect.bottom <= viewport.height);
        assert.ok(normal.preceding?.tag === 'P' && normal.preceding.rect.bottom > normal.headerBottom
          && normal.preceding.rect.top < normal.heading.rect.top, 'capture must include surrounding prose');
        assert.ok(Math.abs(item.afterShot.container.top - normal.container.top) < 2, 'viewport capture moved the article');
        // Reflow measurement is deliberately after the normal screenshot.
        // This context is discarded; native keyboard tests never use it.
        await page.evaluate(() => document.documentElement.style.setProperty('--gb-reader-font-scale', '2'));
        await settleWithoutScripts(page);
        item.scaled = await measure();
        assert.equal(item.scaled.columns, 1);
        assert.equal(item.scaled.rootOverflow, 0);
        assert.equal(item.scaled.documentOverflow, 0);
        assert.ok(item.scaled.rows.every((row, i) => row.overflow <= 0 && row.link.rect.height >= 44
          && ['date', 'event', 'link'].every(key => Math.abs(row[key].fontSize - 2 * normal.rows[i][key].fontSize) < .25)));
        assert.deepEqual(item.runtime, []);
        console.log('G44_DESKTOP_CONTEXT ' + JSON.stringify({ name, normal: { viewport: normal.viewport,
          width: normal.container.width, columns: normal.columns, theme: normal.theme, font: normal.rows[0].event.fontSize },
          scaled: { width: item.scaled.container.width, columns: item.scaled.columns, font: item.scaled.rows[0].event.fontSize } }));
      } catch (error) {
        item.failure = error.message;
        report.problems.push(name + ': ' + error.message);
        console.error('FAIL ' + name + ': ' + error.message);
      } finally {
        report.g44DesktopContext.push(item);
        await context.close();
      }
    }
  }
  if (suite === 'full') for (const route of routes) for (const width of widths) for (const theme of ['light', 'dark']) {
    const context = await contextFor(width, theme);
    await context.addInitScript(() => {
      window.__journalLab = { lcp: null, cls: null };
      try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__journalLab.lcp = entry.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try {
        if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
          window.__journalLab.cls = 0;
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__journalLab.cls += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        }
      } catch { window.__journalLab.cls = null; }
    });
    const page = await context.newPage();
    const item = { kind: route.kind, width, theme, runtime: [] };
    monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
    try {
      const response = await ready(page, route.url);
      if (route.kind === 'history') await assertPublishedHistory(page, response);
      else if (route.kind === 'dossier') await assertAdoptedFinance(page);
      item.layout = await inspect(page);
      await shot(page, `${route.kind}-${width}-${theme}`);
      assert.equal(item.layout.documentOverflow, 0);
      assert.deepEqual(item.layout.overflow, [], 'visible elements must fit; root overflow:clip alone is not a pass');
      assert.deepEqual(item.layout.duplicateIds, [], 'Public routes must have unique IDs');
      assert.deepEqual(item.layout.brokenAnchors, [], 'every local anchor needs a real target');
      assert.equal(item.layout.h1, 1);
      assert.equal(item.layout.theme, theme);
      assert.equal(item.layout.cover?.loaded, true);
      if (engine === 'chromium' && route.kind === 'dossier' && width === 390 && theme === 'light') {
        // Browser-history focus/viewport must recover together. Earlier
        // preventScroll made this intermittently leave focus far offscreen.
        const backProbe = await context.newPage();
        try {
          const backResponse = await backProbe.goto(route.url, { waitUntil: 'load', timeout: 60000 });
          assert.equal(backResponse.status(), 200);
          await backProbe.locator('.je-contents-jump').focus();
          await backProbe.keyboard.press('Enter');
          await backProbe.waitForFunction(() => location.hash === '#journal-g3-toc');
          await backProbe.goBack({ waitUntil: 'domcontentloaded' });
          await backProbe.waitForFunction(() => {
            const jump = document.querySelector('.je-contents-jump');
            const rect = jump?.getBoundingClientRect();
            return !location.hash && document.activeElement === jump && rect &&
              rect.top >= 0 && rect.bottom <= window.innerHeight;
          }, undefined, { timeout: 6000 });
          await backProbe.waitForTimeout(650);
          item.nativeBack = await backProbe.evaluate(() => {
            const jump = document.querySelector('.je-contents-jump');
            const rect = jump?.getBoundingClientRect();
            return { hash: location.hash, focused: document.activeElement === jump,
              y: rect?.top, bottom: rect?.bottom, viewport: innerHeight };
          });
          assert.equal(item.nativeBack.hash, '');
          assert.equal(item.nativeBack.focused, true);
          assert.ok(item.nativeBack.y >= 0 && item.nativeBack.bottom <= item.nativeBack.viewport,
            `native Back left the restored focus outside the visible viewport: ${JSON.stringify(item.nativeBack)}`);
        } finally { await backProbe.close(); }
      }
      if (engine === 'webkit' && route.kind === 'dossier' && width === 390 && theme === 'light') {
        // Safari/WebKit without JS can skip implicit link tab stops after
        // browser Back. The SSR return link uses explicit tabindex=0, keeping
        // the native forward Tab destination usable without custom handlers.
        const nojsContext = await contextFor(width, theme, { javaScriptEnabled: false });
        const nojsProbe = await nojsContext.newPage();
        try {
          const backResponse = await nojsProbe.goto(route.url, { waitUntil: 'load', timeout: 60000 });
          assert.equal(backResponse.status(), 200);
          await nojsProbe.locator('.je-contents-jump').focus();
          await nojsProbe.keyboard.press('Enter');
          await nojsProbe.waitForTimeout(600);
          assert.equal(new URL(nojsProbe.url()).hash, '#journal-g3-toc');
          await nojsProbe.goBack({ waitUntil: 'domcontentloaded' });
          await nojsProbe.waitForTimeout(750);
          await nojsProbe.keyboard.press('Tab');
          await nojsProbe.waitForTimeout(400);
          item.noJsWebkitBack = await nojsProbe.evaluate(() => {
            const active = document.activeElement, rect = active?.getBoundingClientRect();
            return { href: active?.getAttribute('href'), y: rect?.top,
              bottom: rect?.bottom, viewport: innerHeight };
          });
          assert.equal(item.noJsWebkitBack.href, '#overview', 'WebKit no-JS Tab must find the native return link');
          assert.ok(item.noJsWebkitBack.y >= 0 && item.noJsWebkitBack.bottom <= item.noJsWebkitBack.viewport,
            `WebKit no-JS native return focus clipped: ${JSON.stringify(item.noJsWebkitBack)}`);
          await nojsProbe.keyboard.press('Enter');
          await nojsProbe.waitForTimeout(700);
          assert.equal(new URL(nojsProbe.url()).hash, '#overview',
            'WebKit no-JS return must reach the story without scripts');
        } finally { await nojsContext.close(); }
      }
      item.axe = await audit(page);
      assert.deepEqual(item.axe.violations, [], 'axe WCAG A/AA violations');
      assert.deepEqual(item.axe.incomplete, [], 'static editorial surfaces must not leave unresolved axe review items');
      if (engine === 'chromium') {
        assert.ok(item.layout.cls !== null && item.layout.cls <= .1, `initial-load local CLS budget exceeded: ${item.layout.cls}`);
      }
      if (route.kind !== 'journal') {
        assert.equal(item.layout.contents, 1, 'one TOC, not duplicated desktop/mobile navigation');
        const toc = page.locator('[data-journal-contents]');
        assert.equal(await toc.evaluate((el) => el.open), width >= 1024);
        if (width < 1024) {
          await toc.locator('summary').focus(); await page.keyboard.press('Enter');
          assert.equal(await toc.evaluate((el) => el.open), true);
          await page.keyboard.press('Escape');
          assert.equal(await toc.evaluate((el) => el.open), false);
          assert.equal(await toc.locator('summary').evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press('Enter');
        }
        if (route.kind === 'dossier') {
          // Native return exists only on mobile. Generic TOC anchor grid CSS
          // must never override its hide/show rule in the desktop sticky rail.
          const returnLink = toc.locator('.je-contents-return');
          assert.equal(await returnLink.count(), 1, 'one native return within the existing TOC');
          assert.equal(await returnLink.evaluate((el) => getComputedStyle(el).display),
            width < 1024 ? 'inline-flex' : 'none', 'responsive TOC return visibility must not become the generic link grid');
          if (width < 1024) assert.equal(await returnLink.isVisible(), true, 'mobile native return must be accessible');
        }
        const id = route.kind === 'dossier' ? 'finance' : 'g3-year-2018';
        await toc.locator(`a[href="#${id}"]`).click();
        await settle(page);
        const anchor = await page.locator(`#${id}`).evaluate((el) => ({
          y: el.getBoundingClientRect().top,
          expected: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop || '0') + parseFloat(getComputedStyle(el).scrollMarginTop || '0'),
        }));
        const y = anchor.y;
        assert.ok(Math.abs(y - anchor.expected) < 2, `native anchor offset disagrees with shared scroll-padding + local margin: ${JSON.stringify(anchor)}`);
        assert.ok(y >= (width < 1024 ? 110 : 25) && y < 260, `anchor hidden under chrome / excessive offset: y=${y}`);
        assert.equal(new URL(page.url()).hash, `#${id}`);
        if (width < 1024) {
          assert.equal(await toc.evaluate((el) => el.open), false);
          assert.equal(await page.locator(`#${id}`).evaluate((el) => el === document.activeElement), true);
        }
        item.anchor = { id, y, mobileFocusAndClose: width < 1024 };
        item.citationMarkup = await page.locator('[data-journal-source-navigation]').evaluate((article) => {
          const links = [...article.querySelectorAll('a[href^="#src-"], a[href^="#history-source-"]')];
          const sources = [...article.querySelectorAll('.bibliography-item')];
          return { count: links.length, ids: links.map((link) => link.id),
            allMarked: links.every((link) => link.hasAttribute('data-journal-citation') && Boolean(link.id)),
            sources: sources.length, returns: article.querySelectorAll('[data-journal-source-return]').length,
            oneReturnPerSource: sources.every((source) => source.querySelectorAll('[data-journal-source-return]').length === 1) };
        });
        assert.ok(item.citationMarkup.count > 0 && item.citationMarkup.allMarked);
        assert.equal(new Set(item.citationMarkup.ids).size, item.citationMarkup.count);
        assert.equal(item.citationMarkup.returns, item.citationMarkup.sources);
        assert.equal(item.citationMarkup.oneReturnPerSource, true);
        item.citationRoundTrip = await sourceRoundTrip(page, citationFor(page, route.kind), theme === 'light');
        if (route.kind === 'history' && [320,390,768,1440].includes(width)) item.g44Returns = await g44NativeReturns(page,true);
        if ([390, 1440].includes(width)) {
          await shot(page, `${route.kind}-body-${width}-${theme}`);
          item.repeatedSourceRoundTrip = await sourceRoundTrip(page, citationFor(page, route.kind, true), theme !== 'light', async (source) => {
            assert.equal(await source.locator('h3').isVisible(), true, 'citation must land on an always-visible title');
            await shot(page, `${route.kind}-sources-${width}-${theme}`);
            item.citationAxe = await audit(page);
            assert.deepEqual(item.citationAxe.violations, []);
            assert.deepEqual(item.citationAxe.incomplete, []);
            if (route.kind === 'dossier') {
              const disclosure = source.locator('details');
              await disclosure.locator('summary').focus(); await page.keyboard.press('Space');
              assert.equal(await disclosure.evaluate((el) => el.open), true);
              assert.equal(await disclosure.locator('.biblio-links').isVisible(), true);
            }
          });
          assert.equal(item.repeatedSourceRoundTrip.source, item.citationRoundTrip.source);
          assert.notEqual(item.repeatedSourceRoundTrip.id, item.citationRoundTrip.id);
          await shot(page, `${route.kind}-returned-${width}-${theme}`);
        }
      }
      assert.deepEqual(item.runtime, [], 'unexpected runtime/network errors');
      console.log(`PASS ${route.kind} ${width} ${theme}`);
    } catch (error) {
      item.failure = error.message; item.stack = error.stack; report.problems.push(`${route.kind} ${width} ${theme}: ${error.message}`);
      console.error(`FAIL ${route.kind} ${width} ${theme}: ${error.message.slice(0, 280)}`);
    } finally { report.cases.push(item); await context.close(); }
  }
  if (suite === 'full') for (const route of routes) {
    const result = { kind: route.kind, runtime: [] };
    const context = await contextFor(390, 'light');
    const page = await context.newPage();
    monitorRuntime(page, result.runtime, { isIgnoredConsole: isExpectedJournalConsole });
    try {
      await ready(page, route.url);
      // WebKit's default Tab skips implicit links. After explicitly focusing
      // the actual skip link, native Enter still must activate it.
      if (engine === 'webkit') await page.locator('.skip-link').focus();
      else await page.keyboard.press('Tab');
      assert.equal(await page.locator('.skip-link').evaluate((el) => el === document.activeElement), true);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#main-content').evaluate((el) => el === document.activeElement), true);
      result.skipLink = true;
      const button = page.locator('[data-journal-theme]');
      await button.click();
      assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await page.reload({ waitUntil: 'networkidle' });
      assert.equal(await page.locator('html').getAttribute('data-reader-theme'), 'dark');
      const second = await context.newPage(); await ready(second, route.url);
      await page.locator('[data-journal-theme]').click();
      await second.waitForFunction(() => document.documentElement.dataset.readerTheme === 'light');
      await second.close();
      result.themeTogglePersistenceCrossTab = true;
      await page.evaluate(() => window.GBReaderPreferences.set({ fontScale: 1.4 }, { source: 'journal-qa' }));
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      const resized = await inspect(page);
      assert.equal(resized.documentOverflow, 0); assert.deepEqual(resized.overflow, []);
      result.readerScaleAndRootText200 = resized.body;
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; window.GBReaderPreferences.set({ fontScale: 1 }, { source: 'journal-qa' }); });
      if (route.kind !== 'journal') {
        const citationId = await citationFor(page, route.kind).getAttribute('id');
        const sourceHash = await citationFor(page, route.kind).getAttribute('href');
        // A copied citation URL is tested in a genuinely new tab, not a
        // same-document goto (no response) or artificial about:blank detour.
        const bookmark = await context.newPage();
        monitorRuntime(bookmark, result.runtime, { isIgnoredConsole: isExpectedJournalConsole });
        await ready(bookmark, `${route.url}#${citationId}`); await settle(bookmark);
        const citation = citationFor(bookmark, route.kind);
        assert.equal(await citation.evaluate((el) => el === document.activeElement), true);
        await citation.click(); await settle(bookmark);
        const back = bookmark.locator(`${sourceHash} [data-journal-source-return]`);
        const expected = `#${citationId}`;
        assert.equal(await back.getAttribute('href'), expected);
        // Modified/middle activation must not retarget the original tab's return.
        result.ignoredModifiedCitations = await citationFor(bookmark, route.kind, true).evaluate((link) => {
          const variants = [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }];
          return variants.map((modifiers) => {
            const cancelDefault = (event) => event.preventDefault();
            document.addEventListener('click', cancelDefault, { once: true });
            link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...modifiers }));
            const source = document.getElementById(link.hash.slice(1));
            return source.querySelector('[data-journal-source-return]').getAttribute('href');
          });
        });
        assert.deepEqual(result.ignoredModifiedCitations, Array(5).fill(expected));
        await bookmark.goBack(); await settle(bookmark);
        assert.equal(new URL(bookmark.url()).hash, expected);
        await bookmark.goForward(); await settle(bookmark);
        assert.equal(new URL(bookmark.url()).hash, sourceHash);
        assert.equal(await back.getAttribute('href'), expected);
        result.nativeCitationBackForward = true;
        const fallback = route.kind === 'dossier' ? '#finance' : '#g3-history';
        await bookmark.reload({ waitUntil: 'networkidle' }); await settle(bookmark);
        assert.equal(await back.getAttribute('href'), fallback, 'reload must use its honest SSR fallback, not stale cross-load state');
        const direct = await context.newPage();
        await ready(direct, route.url + sourceHash);
        assert.equal(await direct.locator(`${sourceHash} [data-journal-source-return]`).getAttribute('href'), fallback);
        await direct.close();
        result.stableCitationBookmarkAndDirectSourceFallback = true;
        await bookmark.close();
      }
      await page.emulateMedia({ media: 'print' });
      assert.equal(await page.locator('.je-masthead').isVisible(), false);
      if (route.kind !== 'journal') {
        assert.equal(await page.locator('.je-editorial-rail').isVisible(), false);
        assert.equal(await page.locator('[data-journal-source-return]').evaluateAll((links) => links.every((link) => getComputedStyle(link).display === 'none')), true, 'paper must not contain screen-only return controls');
        if (route.kind === 'dossier') assert.equal(await page.locator('.bibliography-item').first().locator('.biblio-links').evaluate((el) => {
          const details = el.closest('details'), rect = el.getBoundingClientRect(), style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility === 'visible' &&
            getComputedStyle(details, '::details-content').contentVisibility === 'visible';
        }), true, 'print must reveal closed source locators as actual layout boxes');
        if (route.kind === 'history') {
          assert.equal(await page.locator('.je-review-note').count(), 0, 'No unpublished warning belongs in public print');
          result.printYearLabels = await page.locator('.je-history-dateline > span, .je-history-year-mark time').evaluateAll((labels) => labels.map((label) => {
            const range = document.createRange(); range.selectNodeContents(label);
            const rects = [...range.getClientRects()];
            return { year: label.textContent.trim(), lines: new Set(rects.map((r) => r.top)).size,
              textWidth: Math.max(...rects.map((r) => r.width)), available: label.parentElement.getBoundingClientRect().width };
          }));
          assert.ok(result.printYearLabels.every((label) => label.lines === 1 && label.textWidth <= label.available + 1), 'a four-digit printed year must fit on a single line');
        }
      }
      result.print = true;
      if (engine === 'chromium') await page.pdf({ path: path.join(output, `${route.kind}-print.pdf`), format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
      await page.emulateMedia({ media: 'screen' });
      {
        // Exercise cold keyboard search bootstrap on each public route.
        await page.keyboard.press('Control+k');
        const palette = page.locator('.cp-backdrop.is-open');
        await palette.waitFor();
        assert.equal(await page.locator('.cp-backdrop').count(), 1);
        await page.keyboard.press('Escape');
        await page.locator('.je-masthead [data-action="open-search"]').click();
        await palette.waitFor();
        await page.locator('.cp-input').fill('G3');
        await page.waitForFunction(() => [...document.querySelectorAll('.cp-backdrop a[href]')].some((el) => el.getAttribute('href')?.includes('/journal/dossiers/g3/')), undefined, { timeout: 10000 });
        result.searchAxe = await audit(page);
        assert.deepEqual(result.searchAxe.violations, []);
        // axe 4.11 asks for review of controlsWithinPopup on this shared combobox.
        // Keep the finding visible and verify its actual IDREF/role relationship;
        // never blanket-ignore an incomplete rule or mutate the shared palette.
        result.searchAriaReferencesReview = await page.locator('.cp-input').evaluate((input) => {
          const controls = input.getAttribute('aria-controls');
          const activeId = input.getAttribute('aria-activedescendant');
          const list = document.getElementById(controls || '');
          const active = document.getElementById(activeId || '');
          const unique = (id) => [...document.querySelectorAll('[id]')].filter((el) => el.id === id).length === 1;
          return { controls, uniqueControls: unique(controls), listRole: list?.getAttribute('role'),
            listVisible: Boolean(list?.getClientRects().length), expanded: input.getAttribute('aria-expanded'),
            uniqueActive: unique(activeId), activeInList: Boolean(active && list?.contains(active)),
            activeRole: active?.getAttribute('role'), activeSelected: active?.getAttribute('aria-selected') };
        });
        assert.deepEqual(result.searchAriaReferencesReview, { controls: 'cp-listbox', uniqueControls: true,
          listRole: 'listbox', listVisible: true, expanded: 'true', uniqueActive: true,
          activeInList: true, activeRole: 'option', activeSelected: 'true' });
        for (const review of result.searchAxe.incomplete) {
          assert.equal(review.id, 'aria-valid-attr-value', 'unexpected search accessibility review item');
          for (const node of review.nodes) {
            assert.ok(node.html.includes('class="cp-input"') && node.summary?.includes('aria-controls="cp-listbox"'), 'unexpected search review target');
          }
        }
        const firstOption = await page.locator('.cp-input').getAttribute('aria-activedescendant');
        const optionCount = await page.locator('#cp-listbox [role=option]').count();
        assert.ok(optionCount >= 1, 'search must have a keyboard-operable result');
        await page.keyboard.press('ArrowDown');
        const downOption = await page.locator('.cp-input').getAttribute('aria-activedescendant');
        if (optionCount > 1) assert.notEqual(downOption, firstOption, 'ArrowDown must advance when multiple options exist');
        else assert.equal(downOption, firstOption, 'ArrowDown must retain the sole option');
        await page.keyboard.press('ArrowUp');
        assert.equal(await page.locator('.cp-input').getAttribute('aria-activedescendant'), firstOption);
        result.searchKeyboardArrows = true;
        await shot(page, `${route.kind}-search-390-light`);
        await page.keyboard.press('Escape');
        assert.equal(await palette.count(), 0);
        assert.equal(await page.locator('.je-masthead [data-action="open-search"]').evaluate((el) => el === document.activeElement), true);
        await page.keyboard.press('Meta+k');
        await page.locator('.cp-backdrop.is-open').waitFor();
        assert.equal(await page.locator('.cp-backdrop').count(), 1);
        await page.keyboard.press('Escape');
        result.searchClickKeyboardQueryEscape = true;
        result.coldControlKAndMetaK = true;
      }
      assert.deepEqual(result.runtime, []);
    } catch (error) { result.failure = error.message; result.stack = error.stack; report.problems.push(`${route.kind} interaction: ${error.message}`); }
    finally { await context.close(); report.interactions.push(result); }
    const noJs = await contextFor(390, 'light', { javaScriptEnabled: false });
    try {
      const p = await noJs.newPage(); await ready(p, route.url);
      const layout = await inspect(p);
      assert.equal(layout.documentOverflow, 0); assert.deepEqual(layout.overflow, []);
      assert.equal(await p.locator('h1').isVisible(), true);
      if (route.kind !== 'journal') {
        assert.equal(await p.locator('[data-journal-contents] a').first().isVisible(), true);
        await p.locator('[data-journal-contents] a').first().click(); await settleWithoutScripts(p);
        assert.ok(new URL(p.url()).hash.length > 1);
        const citation = citationFor(p, route.kind);
        assert.ok(await citation.getAttribute('id'), 'stable citation IDs must not depend on JavaScript');
        const sourceHash = await citation.getAttribute('href');
        await citation.click(); await settleWithoutScripts(p);
        const back = p.locator(`${sourceHash} [data-journal-source-return]`);
        const fallback = route.kind === 'dossier' ? '#finance' : '#g3-history';
        assert.equal(await back.getAttribute('href'), fallback);
        assert.equal(await back.getAttribute('aria-label'), null, 'no-JS must not promise a remembered exact citation');
        await back.click(); await settleWithoutScripts(p);
        assert.equal(new URL(p.url()).hash, fallback);
        assert.equal(await p.locator(fallback).evaluate((el) => el === document.activeElement), true);
        result.noJsSourceFallback = { source: sourceHash, destination: fallback };
        if (route.kind === 'history') result.g44NoJsReturns = await g44NativeReturns(p,false);
      }
      result.noJsReadingAndAnchors = true;
    } catch (error) { report.problems.push(`${route.kind} no-JS: ${error.message}`); }
    finally { await noJs.close(); }
  }
  // The same native disclosure must remain usable when desktop width no longer
  // implies desktop height. Exercise the actual scroll container, not forced clicks.
  if (['full', 'short'].includes(suite)) for (const route of routes.filter((route) => route.kind !== 'journal'))
    for (const width of widths.filter((width) => width >= 1024)) for (const height of shortHeights)
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(width, theme, { viewport: { width, height }, javaScriptEnabled });
        const page = await context.newPage();
        const item = { kind: route.kind, width, height, theme, javaScriptEnabled, runtime: [] };
        const name = `${route.kind}-short-${width}x${height}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
        const rail = page.locator('.je-editorial-rail__scrollport');
        const stickyRail = page.locator('.je-editorial-rail');
        const toc = page.locator('[data-journal-contents]');
        const summary = toc.locator('summary');
        const last = toc.locator('li:last-child a');
        const middle = page.locator(route.kind === 'dossier' ? '#finance' : '#g3-growth');
        const railState = () => rail.evaluate((el) => ({ y: scrollY, rect: el.getBoundingClientRect().toJSON(),
          clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: el.scrollTop,
          horizontalOverflow: el.scrollWidth - el.clientWidth, overflow: getComputedStyle(el).overflowY,
          clearance: { top: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
            bottom: parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) },
          paper: getComputedStyle(el).getPropertyValue('--je-paper').trim() }));
        try {
          await ready(page, route.url);
          await middle.scrollIntoViewIfNeeded(); await settleWithoutScripts(page);
          item.before = await railState();
          item.sticky = await stickyRail.evaluate((el) => ({ position: getComputedStyle(el).position,
            overflow: getComputedStyle(el).overflowY, top: el.getBoundingClientRect().top }));
          assert.equal(item.sticky.position, 'sticky', 'desktop TOC wrapper must own sticky layout');
          assert.equal(item.sticky.overflow, 'visible', 'sticky wrapper must not be a second scrollport');
          assert.ok(item.before.rect.top >= item.before.clearance.top - 1 && item.before.rect.bottom <= height - item.before.clearance.bottom + 1,
            `sticky rail exceeds the document's focus-safe viewport: ${JSON.stringify(item.before)}`);
          assert.equal(item.before.horizontalOverflow, 0);
          assert.ok(item.before.scrollHeight > item.before.clientHeight, 'short desktop rail must have a native scroll range');
          await rail.hover({ position: { x: 80, y: 80 } });
          // A wheel step within the available scroll range must not disturb
          // the reading position. At the boundary, wheel chains naturally.
          await page.mouse.wheel(0, 120); await page.waitForTimeout(160);
          item.afterWheel = await railState();
          assert.ok(item.afterWheel.scrollTop > 0 && item.afterWheel.scrollTop <= item.afterWheel.scrollHeight - item.afterWheel.clientHeight,
            'wheel must move within the rail scroll range');
          assert.ok(Math.abs(item.afterWheel.y - item.before.y) < 1, 'scrolling the rail must not displace the reading position');
          // Hidden desktop return links cannot occur in native Tab order.
          // Exercise EVERY rendered keyboard link (TOC and rail notes), not
          // hidden SSR/mobile alternatives; keep a witness of excluded nodes.
          item.railLinks = await rail.locator('a').evaluateAll((links) => links.map((link) => ({
            href: link.getAttribute('href'),
            rendered: link.getClientRects().length > 0 && getComputedStyle(link).visibility !== 'hidden'
          })));
          const links = item.railLinks.filter((entry) => entry.rendered).map((entry) => entry.href);
          assert.ok(links.length >= 5, 'short-window rail needs at least five native rendered keyboard links');
          if (route.kind === 'dossier')
            assert.ok(item.railLinks.some((entry) => entry.href === '#overview' && !entry.rendered),
              'SSR mobile-only return link must remain hidden on desktop');
          const focused = async (expected) => {
            // Native Tab may initiate smooth document scrolling asynchronously.
            // Test the *settled reading position* (including no-JS), not an
            // in-flight frame. Keep the original <1px reading-position gate.
            // Retain the immediate sample to diagnose transient root movement.
            const immediateDocumentY = await page.evaluate(() => scrollY);
            await settleWithoutScripts(page);
            const state = await rail.evaluate((el) => {
              const active = document.activeElement, style = getComputedStyle(active);
              return { href: active.getAttribute('href'), inside: el.contains(active), y: scrollY,
                rect: active.getBoundingClientRect().toJSON(), clip: el.getBoundingClientRect().toJSON(),
                scrollbar: el.offsetWidth - el.clientWidth,
                outline: (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0),
                focusVisible: active.matches(':focus-visible') };
            });
            item.lastKeyboardState = { ...state, immediateDocumentY, settledDocumentY: state.y, readingBaselineY: item.before.y };
            assert.equal(state.inside, true); assert.equal(state.href, expected);
            assert.equal(state.focusVisible, true, 'keyboard focus must have a visible indicator');
            assert.ok(state.outline >= 2, 'the focus-visible state must actually paint an outline');
            assert.ok(state.rect.top - state.outline >= state.clip.top - 1 && state.rect.bottom + state.outline <= state.clip.bottom + 1,
              `vertical focus outline clipped: ${JSON.stringify(state)}`);
            assert.ok(state.rect.left - state.outline >= state.clip.left - 1 && state.rect.right + state.outline <= state.clip.right - state.scrollbar + 1,
              `horizontal focus outline clipped: ${JSON.stringify(state)}`);
            assert.ok(Math.abs(state.y - item.before.y) < 1, 'native Tab traversal must scroll the rail, not the article');
            return { href: state.href, y: state.rect.top, bottom: state.rect.bottom, outline: state.outline };
          };
          await summary.focus();
          await settleWithoutScripts(page);
          item.afterSummaryFocus = await railState();
          assert.ok(Math.abs(item.afterSummaryFocus.y - item.before.y) < 1,
            'native TOC summary focus must not move the reading position before Tab');
          item.keyboardForward = [];
          for (const href of links) { await page.keyboard.press('Tab'); item.keyboardForward.push(await focused(href)); }
          if (width === 1440 && height === 480) {
            await shot(page, name);
            if (javaScriptEnabled) {
              item.axe = await audit(page);
              assert.deepEqual(item.axe.violations, []);
              const reviewed = await reviewAtlasContrast(page, item.axe.incomplete, { short: true });
              item.graphicsReview = reviewed;
              assert.deepEqual(reviewed.remaining, []);
            }
          }
          item.keyboardBackward = [];
          for (const href of links.slice(0, -1).reverse()) { await page.keyboard.press('Shift+Tab'); item.keyboardBackward.push(await focused(href)); }
          await page.keyboard.press('Shift+Tab');
          assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
          // Native focus may leave the 2px disclosure border scrolled away.
          // Require the entire summary outline + a stable article, not scrollTop=0.
          item.summaryReturn = await focused(null);
          item.summaryScrollTop = (await railState()).scrollTop;
          await rail.hover({ position: { x: 80, y: 80 } });
          await page.mouse.wheel(0, 1500); await page.waitForTimeout(160);
          const href = await last.getAttribute('href');
          const lastRect = await last.boundingBox();
          assert.ok(lastRect.y >= 0 && lastRect.y + lastRect.height <= height, 'last TOC entry must be visible before pointer activation');
          await last.click(); await settleWithoutScripts(page);
          assert.equal(new URL(page.url()).hash, href);
          assert.equal(await page.locator(href).evaluate((el) => el === document.activeElement), true);
          item.nativeTarget = await page.locator(href).evaluate((el) => ({ id: el.id, y: el.getBoundingClientRect().top }));
          assert.ok(item.nativeTarget.y >= 25 && item.nativeTarget.y < height / 2, 'native section heading must stay visible');
          if (width === 1440 && height === 480 && theme === 'light') {
            await page.setViewportSize({ width: 844, height: 390 }); await settleWithoutScripts(page);
            item.mobileResize = await rail.evaluate((el) => ({
              overflow: getComputedStyle(el).overflowY,
              maxHeight: getComputedStyle(el).maxHeight,
              innerPosition: getComputedStyle(el).position,
              outerPosition: getComputedStyle(el.closest('.je-editorial-rail')).position
            }));
            assert.equal(item.mobileResize.overflow, 'visible');
            assert.equal(item.mobileResize.maxHeight, 'none');
            assert.equal(item.mobileResize.innerPosition, 'static',
              'mobile scrollport must not become a second sticky element');
            assert.equal(item.mobileResize.outerPosition, javaScriptEnabled ? 'sticky' : 'static',
              'the outer rail must retain the original JS/no-JS mobile sticky ownership');
            assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
            if (javaScriptEnabled) await summary.click();
            await last.click(); await settleWithoutScripts(page);
            assert.equal(new URL(page.url()).hash, href);
            assert.equal(await page.locator(href).evaluate((el) => el === document.activeElement), true);
            assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
            const layout = await inspect(page);
            assert.equal(layout.documentOverflow, 0); assert.deepEqual(layout.overflow, []);
            await shot(page, `${route.kind}-resize-844x390-${javaScriptEnabled ? 'js' : 'nojs'}`);
            await page.setViewportSize({ width: 1440, height: 1080 });
            await middle.scrollIntoViewIfNeeded(); await settleWithoutScripts(page);
            item.tallResize = await railState();
            assert.equal(await toc.evaluate((el) => el.open), true);
            assert.equal(item.tallResize.scrollHeight, item.tallResize.clientHeight, 'tall window must not get an unnecessary scroll range');
            assert.equal(item.tallResize.scrollTop, 0);
            await rail.hover({ position: { x: 80, y: 80 } });
            await page.mouse.wheel(0, 200); await settleWithoutScripts(page);
            assert.ok((await railState()).y > item.tallResize.y + 100, 'native wheel must still reach the article when the rail fits');
          }
          if (route.kind === 'history' && width === 1440 && height === 480) {
            item.g44 = await g44RouteWitness(page,javaScriptEnabled,name);
            const originalViewport=page.viewportSize();
            try {
              await page.setViewportSize({width:768,height:1024});
              item.g44Tablet=await g44RouteWitness(page,javaScriptEnabled,name+'-768x1024');
            } finally { await page.setViewportSize(originalViewport); }
          }
          // Real route breakpoint regression: establish focus before resize.
          // No forced post-resize focus or synthetic change event.
          if (width === 1440 && height === 480 && theme === 'light') {
            item.tocBreakpointFocus = [];
            const originalViewport = page.viewportSize();
            try {
              const targets = [
                ['first', toc.locator('nav a').first(), true],
                ['last', toc.locator('nav a').last(), true],
                ['outside', middle, false],
                ['summary', summary, false],
              ];
              for (const [label, target, descendant] of targets) {
                await page.setViewportSize({ width: 1024, height: 768 });
                await settleWithoutScripts(page);
                assert.equal(await toc.evaluate(el => el.open), true);
                await target.focus();
                assert.equal(await target.evaluate(el => el === document.activeElement), true, label + ' initial focus');
                await page.setViewportSize({ width: 1023, height: 768 });
                await settleWithoutScripts(page);
                const expected = javaScriptEnabled && descendant ? summary : target;
                const compactOpen = await toc.evaluate(el => el.open);
                const compactFocus = await expected.evaluate(el => el === document.activeElement);
                assert.equal(compactOpen, !javaScriptEnabled, label + ' compact state');
                assert.equal(compactFocus, true, label + ' compact focus');
                await page.setViewportSize({ width: 1024, height: 768 });
                await settleWithoutScripts(page);
                const desktopOpen = await toc.evaluate(el => el.open);
                const desktopFocus = await expected.evaluate(el => el === document.activeElement);
                assert.equal(desktopOpen, true, label + ' desktop state');
                assert.equal(desktopFocus, true, label + ' desktop focus');
                item.tocBreakpointFocus.push({ label, compactOpen, compactFocus, desktopOpen, desktopFocus });
              }
              if (route.kind === 'dossier') {
                item.compactOnlyFocus = [];
                for (const [label, target] of [['jump', page.locator('.je-contents-jump')], ['return', toc.locator('.je-contents-return')]]) {
                  for (const key of ['Tab', 'Shift+Tab']) {
                    await page.setViewportSize({ width: 1023, height: 768 });
                    await settleWithoutScripts(page);
                    if (label === 'return' && !await toc.evaluate(el => el.open)) await summary.click();
                    await target.focus();
                    assert.equal(await target.evaluate(el => el === document.activeElement), true);
                    await page.setViewportSize({ width: 1024, height: 768 });
                    await settleWithoutScripts(page);
                    assert.equal(await target.evaluate(el => el === document.activeElement && el.getClientRects().length > 0), true, label + ' retained focus');
                    await page.keyboard.press(key);
                    await settleWithoutScripts(page);
                    assert.equal(await target.isVisible(), false, label + ' hides after native departure');
                    assert.equal(await page.evaluate(() => document.activeElement !== document.body), true, label + ' native departure');
                    item.compactOnlyFocus.push({ label, key, retained: true, departed: true });
                  }
                }
              }
              if (javaScriptEnabled) {
                await page.setViewportSize({ width: 1023, height: 768 });
                await settleWithoutScripts(page);
                if (!await toc.evaluate(el => el.open)) await summary.click();
                const link = toc.locator('nav a').first();
                const hash = await link.getAttribute('href');
                // Same-task competing focus: use the actual bound click handler
                // and native fragment navigation, not a copied implementation.
                await link.evaluate((el, outsideId) => {
                  el.click();
                  document.getElementById(outsideId).focus();
                }, await middle.getAttribute('id'));
                await settleWithoutScripts(page);
                assert.equal(new URL(page.url()).hash, hash);
                assert.equal(await middle.evaluate(el => el === document.activeElement), true, 'queued focus must not override newer intent');
                item.staleTocFocus = true;
                if (!await toc.evaluate(el => el.open)) await summary.click();
                const last = toc.locator('nav a').last();
                const lastHash = await last.getAttribute('href');
                await link.evaluate((el, nextHash) => {
                  const disclosure = el.closest('details');
                  el.click();
                  disclosure.open = true;
                  Array.from(disclosure.querySelectorAll('nav a')).find(a => a.getAttribute('href') === nextHash).click();
                }, lastHash);
                await settleWithoutScripts(page);
                assert.equal(new URL(page.url()).hash, lastHash);
                assert.equal(await page.locator(lastHash).evaluate(el => el === document.activeElement), true, 'new activation must own native focus');
                item.supersededTocFocus = true;
              }
            } finally { await page.setViewportSize(originalViewport); }
          }
          assert.deepEqual(item.runtime, []);
          console.log(`PASS ${name}`);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack; report.problems.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message.slice(0, 280)}`);
          await shot(page, `${name}-failure`).catch(() => {});
        } finally {
          report.shortViewports.push(item);
          // Keep the first real WebKit native-Tab/root-scroll measurements even
          // when GitHub cancels a superseded run before the final JSON write.
          // This is a deliberately PARTIAL forensic file, never a PASS receipt.
          fs.writeFileSync(path.join(output, 'short-checkpoint.json'), JSON.stringify({
            ...report, checkpoint: { partial: true, completedShortCases: report.shortViewports.length,
              expectedShortCases: 2 * widths.filter((value) => value >= 1024).length * shortHeights.length * 2 * 2,
              evidenceOnly: true }
          }, null, 2) + '\n');
          await context.close();
        }
      }
  // Compact TOC has its own scrollport. Real native Tab must leave room for
  // the painted outline, not merely the link's border box. Sample from the
  // driver so no-JS and smooth-scroll/transform transitions actually settle.
  if (['full', 'mobile'].includes(suite)) for (const route of routes.filter((route) => route.kind !== 'journal'))
    for (const width of mobileWidths) for (const height of mobileHeights)
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(width, theme, { viewport: { width, height }, javaScriptEnabled });
        const page = await context.newPage();
        const item = { kind: route.kind, width, height, theme, javaScriptEnabled, runtime: [], phase: 'initialization' };
        const name = `${route.kind}-mobile-${width}x${height}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
        // Kill a truly stalled engine with a failing, artifact-backed result.
        // This cannot turn missing checks into PASS or change route behavior.
        const watchdog = setTimeout(() => {
          const diagnostic = { head: report.head, engine, name, item, timeoutMs: 75_000 };
          fs.writeFileSync(path.join(output, 'after', `${name}-watchdog.json`), JSON.stringify(diagnostic, null, 2) + '\n');
          console.error(`FAIL ${name}: 75s mobile-case watchdog in phase ${item.phase}; diagnostic JSON retained`);
          process.exit(124);
        }, 75_000);
        const toc = page.locator('[data-journal-contents]'), summary = toc.locator('summary'), nav = toc.locator('nav');
        const selected = [390, 844].includes(width);
        const settleMobile = async () => {
          let previous, stable = 0;
          for (let attempt = 0; attempt < 90; attempt++) {
            const current = await toc.evaluate((el) => [scrollY, el.querySelector('nav').scrollTop,
              el.getBoundingClientRect().top, document.querySelector('.mcp-top')?.getBoundingClientRect().bottom ?? 0]);
            stable = previous && current.every((value, i) => Math.abs(value - previous[i]) < .5) ? stable + 1 : 0;
            if (stable >= 5) return;
            previous = current;
            await page.waitForTimeout(50);
          }
          throw new Error('native compact-TOC/root/header scrolling did not settle');
        };
        const focused = async (expected, isReturn = false) => {
          await settleMobile();
          // Wait for WebKit native smooth keyboard-focus scrolling to actually
          // finish; do not scroll or refocus from the harness. No-JS has no
          // timers, so poll from the driver rather than waitForFunction.
          let nativeVisible = false;
          for (let step = 0; step < 45; step++) {
            nativeVisible = await toc.evaluate(() => {
              const active = document.activeElement, rect = active.getBoundingClientRect();
              const style = getComputedStyle(active);
              const margin = Math.max(0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0));
              const header = document.querySelector('.mcp-top');
              const hs = header && getComputedStyle(header);
              const headerBottom = hs && hs.display !== 'none' && hs.visibility !== 'hidden' && Number(hs.opacity) > 0
                ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
              return rect.top - margin >= headerBottom - 1 && rect.bottom + margin <= innerHeight + 1;
            });
            if (nativeVisible) break;
            await page.waitForTimeout(75);
          }
          assert.ok(nativeVisible, 'native keyboard focus remains offscreen after bounded real-scroll settling');
          await settleMobile();
          const state = await toc.evaluate((el) => {
            const active = document.activeElement, style = getComputedStyle(active), nav = el.querySelector('nav');
            const r = nav.getBoundingClientRect(), header = document.querySelector('.mcp-top');
            const headerRect = header?.getBoundingClientRect(), headerStyle = header && getComputedStyle(header);
            const returnLink = el.querySelector('.je-contents-return');
            return { href: active.getAttribute('href'), tag: active.tagName, id: active.id || '',
              activeClass: String(active.className || ''), activeHtml: active.outerHTML?.slice(0, 500),
              detailsOpen: el.open, summaryFocused: active === el.querySelector('summary'),
              returnVisible: returnLink ? getComputedStyle(returnLink).display !== 'none' : false,
              returnTabIndex: returnLink?.tabIndex, returnHref: returnLink?.getAttribute('href'),
              inside: el.contains(active), rect: active.getBoundingClientRect().toJSON(),
              clip: { left: r.left + nav.clientLeft, right: r.left + nav.clientLeft + nav.clientWidth,
                top: r.top + nav.clientTop, bottom: r.top + nav.clientTop + nav.clientHeight },
              scrollbar: nav.offsetWidth - nav.clientWidth, scrollTop: nav.scrollTop, y: scrollY,
              insideScrollport: nav.contains(active), isNativeReturn: active.matches('.je-contents-return'),
              usableViewportWidth: document.documentElement.clientWidth,
              outline: Math.max(0, (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0)),
              outlineWidth: parseFloat(style.outlineWidth) || 0, outlineOffset: parseFloat(style.outlineOffset) || 0,
              outlineStyle: style.outlineStyle,
              textRects: active.matches('summary') ? (() => {
                const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT), rects = [];
                while (walker.nextNode()) if (walker.currentNode.textContent.trim()) {
                  const range = document.createRange(); range.selectNodeContents(walker.currentNode);
                  rects.push(...[...range.getClientRects()].map((r) => r.toJSON()));
                }
                return rects;
              })() : [],
              focusVisible: active.matches(':focus-visible'),
              headerBottom: headerStyle?.display !== 'none' && headerStyle?.visibility !== 'hidden' && Number(headerStyle?.opacity) > 0
                ? Math.max(0, headerRect.bottom) : 0 };
          });
          if (state.href !== expected || !state.inside) {
            item.focusFailure = { expected, state };
            throw new Error('native TOC keyboard focus mismatch: ' + JSON.stringify(item.focusFailure));
          }
          assert.equal(state.focusVisible, true);
          assert.ok(state.outlineWidth >= 2 && state.outlineStyle === 'solid', 'the indicator must really paint, even when fully inset');
          const { rect: r, outline: o, clip: c } = state;
          const inset = Math.max(0, -state.outlineOffset);
          assert.ok(state.textRects.every((text) => text.left >= r.left + inset - 1 && text.right <= r.right - inset + 1
            && text.top >= r.top + inset - 1 && text.bottom <= r.bottom - inset + 1), 'an inset summary indicator must not cover text');
          assert.ok(r.left - o >= -1 && r.right + o <= state.usableViewportWidth + 1 && r.top - o >= state.headerBottom - 1 && r.bottom + o <= height + 1,
            `focus outline outside usable viewport / under visible shared header: ${JSON.stringify(state)}`);
          if (expected !== null && state.insideScrollport) {
            assert.ok(r.left - o >= c.left - 1 && r.right + o <= c.right + 1 && r.top - o >= c.top - 1 && r.bottom + o <= c.bottom + 1,
              'compact nav clips the focus outline: ' + JSON.stringify(state));
            if (visibleScrollbars) assert.ok(state.scrollbar > 0, 'visible-scrollbar run needs a real native gutter');
          }
          if (isReturn) {
            assert.equal(expected, '#overview');
            assert.equal(state.isNativeReturn, true, 'native return must be identifiable independently from TOC #overview');
            assert.equal(state.insideScrollport, false, 'native return is outside scrolling TOC items');
          } else if (expected !== null) {
            assert.equal(state.insideScrollport, true, 'actual TOC link must belong to the scrollport');
            assert.equal(state.isNativeReturn, false);
          }
          return state;
        };
        try {
          item.phase = 'navigation/ready';
          const response = await ready(page, route.url, (phase) => { item.phase = phase; });
          if (route.kind === 'history') await assertPublishedHistory(page, response);
          else if (route.kind === 'dossier') await assertAdoptedFinance(page);
          // The shared dark-theme anchor color must not override Journal's
          // inverse skip-navigation foreground. Check the *focused* control
          // in every real mobile engine/theme and JS/no-JS mode.
          await page.locator('a.skip-link').focus();
          item.skipLinkContrast = await page.locator('a.skip-link').evaluate((el) => {
            const style = getComputedStyle(el);
            const rgb = (value) => value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
            const fg = rgb(style.color), bg = rgb(style.backgroundColor);
            if (!fg || !bg) throw new Error('skip-link has no opaque RGB colors');
            const lum = (c) => c.map((value) => {
              const n = value / 255;
              return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
            }).reduce((acc, channel, i) => acc + channel * [0.2126, 0.7152, 0.0722][i], 0);
            const a = lum(fg), b = lum(bg);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
          assert.ok(item.skipLinkContrast >= 4.5,
            `focused skip-link contrast below WCAG AA: ${item.skipLinkContrast.toFixed(2)}:1 (${name})`);
          assert.equal(await page.locator('[data-journal-contents]').count(), 1);
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
          await summary.focus();
          item.summaryEntry = await focused(null);
          if (!javaScriptEnabled) { await page.keyboard.press('Space'); assert.equal(await toc.evaluate((el) => el.open), false); }
          await page.keyboard.press('Enter'); assert.equal(await toc.evaluate((el) => el.open), true);
          await settleMobile();
          await page.locator(route.kind === 'dossier' ? '#finance' : '#g3-growth').scrollIntoViewIfNeeded();
          await settleMobile();
          item.standaloneSourceActions = await standaloneSourceActions(page, route.kind);
          const links = await nav.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          item.phase = 'native Tab to return link';
          const nativeReturn = route.kind === 'dossier' ? toc.locator('.je-contents-return') : null;
          if (nativeReturn) {
            await page.keyboard.press('Tab');
            item.returnBeforeNav = await focused('#overview', true);
          }
          item.phase = 'forward native Tab navigation';
          item.keyboardForward = [];
          for (const [index, href] of links.entries()) {
            // WebKit's default Tab skips implicit links; inspect real focus
            // and painted outline. Chromium/Firefox retain native Tab traversal.
            await page.keyboard.press('Tab');
            item.keyboardForward.push(await focused(href));
            if (selected && (index === 0 || index === links.length - 1))
              await shot(page, name + '-' + (index === 0 ? 'first' : 'last'));
          }
          item.phase = 'backward native Shift+Tab navigation';
          item.keyboardBackward = [];
          for (const href of links.slice(0, -1).reverse()) {
            await page.keyboard.press('Shift+Tab');
            item.keyboardBackward.push(await focused(href));
          }
          if (nativeReturn) {
            await page.keyboard.press('Shift+Tab');
            item.returnBeforeSummary = await focused('#overview', true);
          }
          await page.keyboard.press('Shift+Tab');
          item.summaryReturn = await focused(null);
          if (selected) await shot(page, name + '-summary');
          await page.keyboard.press('Escape');
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled, 'Escape belongs to the existing JS adapter, not native no-JS details');
          assert.equal(await summary.evaluate((el) => el === document.activeElement), true);
          await page.keyboard.press('Space'); assert.equal(await toc.evaluate((el) => el.open), javaScriptEnabled);
          if (!javaScriptEnabled) await page.keyboard.press('Enter');
          assert.equal(await toc.evaluate((el) => el.open), true);
          item.phase = 'axe accessibility audit';
          if (selected && javaScriptEnabled) {
            item.axe = await audit(page);
            assert.deepEqual(item.axe.violations, []);
            // A narrowly measured review of exact map text, never an axe rule exclusion.
            // Non-history routes and all remaining nodes retain the previous strict TOC review.
            const atlas = route.kind === 'history'
              ? await reviewAtlasContrast(page, item.axe.incomplete)
              : { witnesses: [], remaining: item.axe.incomplete };
            item.atlasContrastReview = atlas.witnesses;
            item.clippedContrastReview = await reviewClippedContrast(page, atlas.remaining);
          }
          if (nativeReturn) await page.keyboard.press('Tab');
          for (const href of links) {
            await page.keyboard.press('Tab');
          }
          item.phase = 'last native link activation';
          item.lastActivation = await focused(links.at(-1));
          await page.keyboard.press('Enter'); await settleMobile();
          assert.equal(new URL(page.url()).hash, links.at(-1));
          assert.equal(await toc.evaluate((el) => el.open), !javaScriptEnabled);
          if (!javaScriptEnabled) {
            const nativeList = await nav.evaluate((el) => ({ maxHeight: getComputedStyle(el).maxHeight, overflowY: getComputedStyle(el).overflowY }));
            assert.deepEqual(nativeList, { maxHeight: 'none', overflowY: 'visible' }, 'no-JS compact TOC must use natural page scrolling');
          }
          assert.equal(await page.locator(links.at(-1)).evaluate((el) => el === document.activeElement), true);
          item.nativeTarget = await page.locator(links.at(-1)).evaluate((el) => ({ id: el.id, y: el.getBoundingClientRect().top }));
          assert.ok(item.nativeTarget.y >= 25 && item.nativeTarget.y < height - 25, 'last native target must remain on screen');
          item.layout = await inspect(page);
          // A classic root scrollbar makes scrollWidth - innerWidth = -15px.
          // Compare against the actual usable viewport; never hide positive
          // overflow by calling the legitimate gutter a product failure.
          item.viewport = await page.evaluate(() => ({ outerWidth: innerWidth,
            usableWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert.equal(item.viewport.scrollWidth, item.viewport.usableWidth);
          assert.deepEqual(item.layout.overflow, []);
          assert.deepEqual(item.runtime, []);
          if (route.kind === 'history' && [320,390].includes(width) && height === 844) {
            item.phase = 'G44 real route witness';
            item.g44 = await g44RouteWitness(page,javaScriptEnabled,name);
            assert.deepEqual(item.runtime, []);
          }
          if (route.kind==='history'&&engine==='webkit'&&!javaScriptEnabled&&width===390&&height===390){
            item.phase='G44 short-viewport screenshot A/B control';
            item.g44Control=await g44RouteWitness(page,false,name,true);
            assert.deepEqual(item.runtime,[]);
          }
          item.phase = 'complete';
          console.log(`PASS ${name}`);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack; report.problems.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message.slice(0, 1600)}`);
          fs.writeFileSync(path.join(output, 'after', `${name}-diagnostic.json`),
            JSON.stringify({ head: report.head, engine, name, item }, null, 2) + '\n');
          await shot(page, `${name}-failure`, { timeout: 8000 }).catch(() => {});
        } finally {
          report.mobileFocus.push(item);
          // Firefox may retain a native disclosure/scroll task after an assertion
          // failure. A hung teardown must fail closed, not monopolize CI for 55m.
          let teardownTimeout;
          try {
            await Promise.race([
              context.close(),
              new Promise((_, reject) => { teardownTimeout = setTimeout(() => reject(new Error('browser context teardown exceeded 10s')), 10_000); }),
            ]);
          } catch (closeError) {
            console.error(`FAIL ${name}: ${closeError.message}; diagnostic JSON retained`);
            process.exit(1);
          } finally {
            clearTimeout(teardownTimeout);
            clearTimeout(watchdog);
          }
          if (stopOnFirstError && item.failure) process.exit(1);
        }
      }
  // Agent4/#2339 confirmed this on selected Agent8: forced colors exposes all
  // transparent borders, erasing the current-section distinction. Check actual
  // computed system colors in Chromium, not hard-coded RGB or a CSS text regex.
  if (['full', 'forced-colors'].includes(suite) && engine === 'chromium')
    for (const route of routes)
      for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
        const context = await contextFor(width, theme, { forcedColors: 'active' });
        const page = await context.newPage(), item = { kind: route.kind, width, theme, runtime: [] };
        const name = `${route.kind}-forced-${width}-${theme}`;
        monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
        try {
          await ready(page, route.url);
          item.state = await page.locator('.je-masthead__nav').evaluate((nav) => {
            // Ephemeral test probe only; never disable forced-color adjustment.
            const probe = document.createElement('span');
            probe.style.cssText = 'position:absolute;color:Highlight;background:Canvas';
            document.body.append(probe);
            const style = getComputedStyle(probe), expected = { canvas: style.backgroundColor, highlight: style.color };
            probe.remove();
            return { active: matchMedia('(forced-colors: active)').matches, expected,
              links: [...nav.querySelectorAll('a')].map((link) => {
                const style = getComputedStyle(link);
                return { current: link.hasAttribute('aria-current'), href: link.getAttribute('href'),
                  border: style.borderBottomColor, width: style.borderBottomWidth, style: style.borderBottomStyle };
              }) };
          });
          assert.equal(item.state.active, true);
          assert.equal(item.state.links.length, 3, 'one three-link Journal navigation owner');
          assert.equal(await page.locator('.je-masthead__navigation > a.je-masthead__home[href="/"]').count(), 1, 'separate main-site return');
          assert.equal(item.state.links.filter((link) => link.current).length, 1);
          assert.notEqual(item.state.expected.canvas, item.state.expected.highlight);
          for (const link of item.state.links) {
            assert.equal(link.width, '2px'); assert.equal(link.style, 'solid');
            assert.equal(link.border, link.current ? item.state.expected.highlight : item.state.expected.canvas,
              'Forced colors must distinguish the current section, not underline every link equally');
          }
          if (width < 1024 && route.kind !== 'journal') item.standaloneSourceActions = await standaloneSourceActions(page, route.kind, true);
          if (route.kind === 'history') item.atlasSourceActions = await atlasSourceActions(page,true);
          await shot(page, name);
          const current = page.locator('.je-masthead__nav a[aria-current]');
          await current.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
          item.focus = await current.evaluate((link) => {
            const style = getComputedStyle(link);
            return { focused: document.activeElement === link, visible: link.matches(':focus-visible'),
              width: parseFloat(style.outlineWidth), offset: parseFloat(style.outlineOffset),
              style: style.outlineStyle, color: style.outlineColor, rect: link.getBoundingClientRect().toJSON(),
              usableWidth: document.documentElement.clientWidth, height: innerHeight };
          });
          const f = item.focus, outset = Math.max(0, f.width + f.offset);
          assert.ok(f.focused && f.visible && f.width >= 2 && f.style === 'solid');
          assert.notEqual(f.color, item.state.expected.canvas, 'the keyboard outline must not vanish into Canvas');
          assert.ok(f.rect.left - outset >= -1 && f.rect.right + outset <= f.usableWidth + 1
            && f.rect.top - outset >= -1 && f.rect.bottom + outset <= f.height + 1);
          await shot(page, `${name}-focus`);
          assert.deepEqual(item.runtime, []);
          console.log(`PASS ${name}`);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack; report.problems.push(`${name}: ${error.message}`);
          console.error(`FAIL ${name}: ${error.message.slice(0, 280)}`);
          await shot(page, `${name}-failure`).catch(() => {});
        } finally { report.forcedColors.push(item); await context.close(); }
      }
  if (['full', 'print'].includes(suite) && engine === 'chromium') {
    const printDirectory = path.join(output, 'print');
    fs.mkdirSync(printDirectory, { recursive: true });
    // Fresh contexts retain real JS/no-JS behavior and browser color preference.
    // DOM checks cannot see page breaks; the separate analyzer reads these PDFs.
    for (const route of routes) for (const paper of ['A4', 'Letter'])
      for (const theme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
        const context = await contextFor(1440, theme, { javaScriptEnabled });
        const page = await context.newPage();
        const name = `${route.kind}-${paper}-${theme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        const item = { kind: route.kind, paper, theme, javaScriptEnabled, pdf: path.join(printDirectory, `${name}.pdf`), runtime: [] };
        monitorRuntime(page, item.runtime, { isIgnoredConsole: isExpectedJournalConsole });
        try {
          const response = await ready(page, route.url);
          if (route.kind === 'history') await assertPublishedHistory(page, response);
          else if (route.kind === 'dossier') await assertAdoptedFinance(page);
          await page.emulateMedia({ media: 'print' });
          item.dom = await page.evaluate(() => {
            const next = document.querySelector('.je-next-story');
            const title = next?.querySelector('a').cloneNode(true);
            title?.querySelectorAll('[aria-hidden]').forEach((element) => element.remove());
            const normalize = (element) => element.textContent.replace(/\s+/gu, ' ').trim();
            return { heading: normalize(document.querySelector('h1')),
              sourceTitles: [...document.querySelectorAll('.bibliography-item h3')].map(normalize),
              companion: next ? { label: normalize(next.querySelector('p')), title: normalize(title), breakInside: getComputedStyle(next).breakInside } : null,
              reviewWarning: document.querySelector('.je-review-note') ? normalize(document.querySelector('.je-review-note')) : null,
              // The shared skip link is off-canvas, not display:none; prove its
              // omission from actual PDF text instead of assuming its CSS owner.
              screenOnlyLabels: [...new Set([...document.querySelectorAll('.skip-link, [data-journal-source-return]')].map(normalize))],
              screenControlsHidden: [...document.querySelectorAll('.je-masthead, .je-editorial-rail, .je-source-return')].every((element) => getComputedStyle(element).display === 'none'),
              paper: getComputedStyle(document.querySelector('.journal-edition')).getPropertyValue('--je-paper').trim() };
          });
          assert.equal(item.dom.screenControlsHidden, true, 'print must omit only screen navigation, not bibliography');
          assert.equal(item.dom.paper, '#fff', 'print must use white paper in either browser preference');
          await page.pdf({ path: item.pdf, format: paper, printBackground: true,
            margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });

          if(route.kind==='history'){
            const index=page.locator('#g3-2018-document-index');
            const paperIndex=await index.evaluate(root=>{
              const groups=[...root.querySelectorAll('.jcdi-group')];
              return {heading:root.querySelector('h3').textContent.trim(),nextHeading:document.querySelector('#g3-later-title').textContent.trim(),
                columns:getComputedStyle(root.querySelector('.jcdi-lanes')).display,
                groups:groups.map(g=>({heading:g.querySelector('h4').textContent.trim(),rows:[...g.querySelectorAll('li')].map(li=>({
                  date:li.querySelector('.jcdi-date').textContent.trim(),label:li.querySelector('.jcdi-label').textContent.trim(),
                  citation:li.querySelector('a[data-journal-citation]').textContent.trim(),id:li.querySelector('a[data-journal-citation]').id,
                  breakInside:getComputedStyle(li).breakInside
                }))}))};
            });
            assert.equal(paperIndex.columns,'block');
            assert.deepEqual(paperIndex.groups.map(g=>g.rows.length),[3,3,1]);
            assert.deepEqual(paperIndex.groups.flatMap(g=>g.rows.map(r=>r.id)),g44Sources.map(([id])=>id));
            assert.ok(paperIndex.groups.flatMap(g=>g.rows).every(r=>r.breakInside==='avoid'),'G44 print keeps only individual rows together');
            item.g44Paper=paperIndex;
            const pdfCheck=spawnSync(args['pdf-python']||'python3',['-c',[
              'import fitz, json, sys, unicodedata',
              'spec=json.loads(sys.argv[2])',
              'norm=lambda t: "".join(c for c in unicodedata.normalize("NFKC",t) if not c.isspace() and ord(c)!=173)',
              'with fitz.open(sys.argv[1]) as doc: content=norm(" ".join(p.get_text(sort=True) for p in doc))',
              'title=norm(spec["heading"]); end=norm(spec["nextHeading"])',
              'start=content.find(title); assert start>=0, "missing compact print heading"',
              'stop=content.find(end,start+len(title)); assert stop>start, "missing next section"',
              'region=content[start:stop]; cursor=0; total=0',
              'for group in spec["groups"]:',
              '    tokens=[group["heading"]]+[v for row in group["rows"] for v in (row["date"],row["label"],row["citation"])]',
              '    for token in tokens:',
              '        value=norm(token); at=region.find(value,cursor); assert at>=0, "missing/out-of-order printed G44 item: "+token',
              '        cursor=at+len(value); total+=1',
              'print(json.dumps({"orderedFields":total,"rows":sum(len(g["rows"]) for g in spec["groups"])}))'
            ].join('\n'),item.pdf,JSON.stringify(paperIndex)],{cwd:root,encoding:'utf8'});
            assert.equal(pdfCheck.status,0,pdfCheck.error?.message||pdfCheck.stderr);
            item.g44Paper.actual=JSON.parse(pdfCheck.stdout);
            assert.deepEqual(item.g44Paper.actual,{orderedFields:24,rows:7});
          }
          assert.deepEqual(item.runtime, []);
        } catch (error) {
          item.failure = error.message; item.stack = error.stack;
          report.problems.push(`${name} print capture: ${error.message}`);
        } finally { report.printCases.push(item); await context.close(); }
      }
    const capture = path.join(printDirectory, 'capture.json');
    fs.writeFileSync(capture, JSON.stringify({ head: report.head, worktree: report.worktree, sourceSha256: report.sourceSha256,
      engine, version: report.version, cases: report.printCases }, null, 2) + '\n');
    const analyzerArgs = [path.join(root, 'scripts/lib/journal-print-pdf.py'), '--capture', capture, '--output', path.join(printDirectory, 'pagination.json')];
    if (args['print-baseline']) analyzerArgs.push('--baseline', path.resolve(root, args['print-baseline']));
    const analysis = spawnSync(args['pdf-python'] || 'python3', analyzerArgs, { cwd: root, encoding: 'utf8' });
    report.printAnalysis = { executable: args['pdf-python'] || 'python3', args: analyzerArgs, exit: analysis.status,
      signal: analysis.signal, stdout: analysis.stdout, stderr: analysis.stderr, error: analysis.error?.message ?? null };
    console.log(analysis.stdout || '');
    if (analysis.stderr) console.error(analysis.stderr);
    if (analysis.status !== 0) report.problems.push(`actual PDF analysis exit ${analysis.status}: see print/pagination.json and printAnalysis`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(output, `browser-${engine}.json`), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.cases.length} responsive + ${report.shortViewports.length} short-window + ${report.mobileFocus.length} mobile-focus + ${report.forcedColors.length} forced-colors + ${report.printCases.length} print cases; ${report.problems.length} problem(s); browser ${engine} ${report.version}`);
if (report.problems.length) { console.error(report.problems.join('\n')); process.exitCode = 1; }
