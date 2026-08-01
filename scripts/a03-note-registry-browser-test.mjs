import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve, configureContext, DESKTOP } from './lib/a04-contract.mjs';
import { desktopWitness, mobileWitness } from './lib/a04-browser-witness.mjs';

const require = createRequire(import.meta.url);
const playwright = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const REPORTS = path.join(ROOT, 'reports');
const engineName = process.env.GB_NOTE_BROWSER || 'chromium';
const browserType = playwright[engineName];
if (!browserType) throw new Error(`unsupported GB_NOTE_BROWSER=${engineName}`);

const registryFile = path.join(DIST, 'data', 'note-registry.json');
assert.ok(fs.existsSync(registryFile), 'dist/data/note-registry.json missing');
const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'));
assert.equal(registry.interactionOwner, 'SiteUtils.makeTooltipController');
const routes = Object.keys(registry.routes || {}).filter((route) => registry.routes[route]?.count > 0).sort();
assert.ok(routes.length > 0, 'NoteRegistry has no routes');
const route = routes[0];
const first = registry.routes[route].notes[0];
const surface = {
  id: 'footnote', trigger: '.fn-marker:not(.map-trigger)', tip: '.tooltip', exception: null,
  activation: 'desktop-focus-click/mobile-touch', mobileSheet: true,
};

const results = [];
const check = (contract, ok, detail = '') => {
  const row = { engine: engineName, route, contract, ok: Boolean(ok), detail: String(detail || '') };
  results.push(row);
  if (!row.ok) throw new Error(`${contract}: ${row.detail}`);
};

function geometryFacts(node) {
  const style = getComputedStyle(node);
  const parentStyle = node.parentElement ? getComputedStyle(node.parentElement) : null;
  const rect = node.getBoundingClientRect();
  return {
    display: style.display,
    position: style.position,
    visibility: style.visibility,
    width: rect.width,
    height: rect.height,
    parentTag: node.parentElement?.tagName || '',
    parentId: node.parentElement?.id || '',
    parentDisplay: parentStyle?.display || '',
    parentVisibility: parentStyle?.visibility || '',
    count: node.querySelectorAll('li').length,
  };
}

const { server, base } = await serve();
const browser = await browserType.launch();
try {
  const context = await browser.newContext({ viewport: DESKTOP, serviceWorkers: 'block' });
  await configureContext(context, base);
  const page = await context.newPage();
  const response = await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  check('document:status', response?.status() === 200, response?.status());
  const facts = await page.evaluate((expected) => {
    const markers = [...document.querySelectorAll('.fn-marker:not(.map-trigger)')];
    const endnotes = document.querySelector('[data-note-registry-endnotes]');
    const marker = document.getElementById(expected.refId);
    const tip = document.getElementById(expected.tipId);
    const endnote = document.getElementById(expected.endnoteId);
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    return {
      markerCount: markers.length,
      endnoteCount: endnotes?.querySelectorAll('li[data-note-id]').length || 0,
      markerNoteId: marker?.getAttribute('data-note-id'),
      markerOrdinal: marker?.getAttribute('data-note-ordinal'),
      describedBy: marker?.getAttribute('aria-describedby'),
      controls: marker?.getAttribute('aria-controls'),
      tipNoteId: tip?.getAttribute('data-note-id'),
      tipIgnored: tip?.hasAttribute('data-pagefind-ignore'),
      endnoteNoteId: endnote?.getAttribute('data-note-id'),
      endnoteText: normalize(endnote?.textContent),
      endnotesSpeakable: endnotes?.hasAttribute('data-speakable'),
      endnotesInsidePagefindBody: Boolean(endnotes?.closest('[data-pagefind-body]')),
      endnotesAriaLabelled: Boolean(endnotes?.getAttribute('aria-labelledby')),
      duplicateIds: [...document.querySelectorAll('[id]')].map((node) => node.id).filter((id, index, all) => all.indexOf(id) !== index),
    };
  }, first);
  check('registry:marker-count', facts.markerCount === registry.routes[route].count, JSON.stringify(facts));
  check('registry:endnote-count', facts.endnoteCount === registry.routes[route].count, JSON.stringify(facts));
  check('registry:stable-id-mapping', facts.markerNoteId === first.id && facts.tipNoteId === first.id && facts.endnoteNoteId === first.id, JSON.stringify(facts));
  check('a11y:reference-links', facts.describedBy === first.endnoteId && facts.controls === first.tipId && facts.endnotesAriaLabelled, JSON.stringify(facts));
  check('search:single-projection', facts.tipIgnored && facts.endnotesInsidePagefindBody, JSON.stringify(facts));
  check('tts:endnote-speakable', facts.endnotesSpeakable, JSON.stringify(facts));
  check('document:no-duplicate-ids', facts.duplicateIds.length === 0, JSON.stringify(facts.duplicateIds));
  check('registry:text-preserved', facts.endnoteText.includes(first.text), facts.endnoteText);
  await context.close();

  const desktop = await desktopWitness(browser, base, routes, surface);
  check('interaction:desktop-opens', desktop.opens && desktop.mountedToBody && desktop.tipDetachedFromTrigger, JSON.stringify(desktop));
  check('interaction:escape-focus-return', desktop.escapeCloses && desktop.focusContinuity, JSON.stringify(desktop));
  check('interaction:desktop-no-pageerror', desktop.pageErrors.length === 0 && !desktop.error, JSON.stringify(desktop));

  const mobile = await mobileWitness(browser, base, routes, surface);
  check('interaction:mobile-touch-cycle', mobile.touchOpens && mobile.secondTouchCloses, JSON.stringify(mobile));
  check('interaction:mobile-owner-mount', mobile.mountedToBody && mobile.tipDetachedFromTrigger && mobile.insideViewport, JSON.stringify(mobile));
  check('interaction:mobile-no-pageerror', mobile.pageErrors.length === 0 && !mobile.error, JSON.stringify(mobile));

  if (engineName === 'chromium') {
    const noJs = await browser.newContext({ viewport: DESKTOP, javaScriptEnabled: false, serviceWorkers: 'block' });
    await configureContext(noJs, base);
    const noJsPage = await noJs.newPage();
    await noJsPage.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const noJsFacts = await noJsPage.locator('[data-note-registry-endnotes]').evaluate(geometryFacts);
    check(
      'no-js:endnotes-visible',
      noJsFacts.display !== 'none' && noJsFacts.position === 'static' && noJsFacts.visibility === 'visible' && noJsFacts.width > 1 && noJsFacts.height > 1,
      JSON.stringify(noJsFacts),
    );
    await noJs.close();

    const printContext = await browser.newContext({ viewport: DESKTOP, serviceWorkers: 'block' });
    await configureContext(printContext, base);
    const printPage = await printContext.newPage();
    await printPage.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await printPage.emulateMedia({ media: 'print' });
    const printFacts = await printPage.locator('[data-note-registry-endnotes]').evaluate(geometryFacts);
    check(
      'print:endnotes-visible',
      printFacts.display !== 'none' && printFacts.position === 'static' && printFacts.visibility === 'visible' && printFacts.width > 1 && printFacts.height > 1,
      JSON.stringify(printFacts),
    );
    fs.mkdirSync(REPORTS, { recursive: true });
    const pdfFile = path.join(REPORTS, 'a03-note-registry-print.pdf');
    await printPage.pdf({ path: pdfFile, format: 'A4', printBackground: true });
    const pdf = fs.readFileSync(pdfFile);
    check('print:pdf-generated', pdf.subarray(0, 4).toString() === '%PDF' && pdf.length > 1000, `${pdf.length} bytes`);
    await printContext.close();
  }

  fs.mkdirSync(REPORTS, { recursive: true });
  const report = {
    schemaVersion: 1,
    contract: 'A03-note-registry-browser',
    engine: engineName,
    route,
    registryRoutes: registry.routeCount,
    registryNotes: registry.noteCount,
    total: results.length,
    passed: results.filter((row) => row.ok).length,
    failed: results.filter((row) => !row.ok).length,
    results,
  };
  fs.writeFileSync(path.join(REPORTS, `a03-note-registry-browser-${engineName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(REPORTS, `a03-note-registry-browser-${engineName}.md`), [
    `# A03 NoteRegistry — ${engineName}`,
    '',
    `- Route: \`${route}\``,
    `- Registry routes/notes: **${registry.routeCount}/${registry.noteCount}**`,
    `- Passed: **${report.passed}/${report.total}**`,
    `- Interaction owner: \`${registry.interactionOwner}\``,
    '',
  ].join('\n'));
  console.log(`A03 NoteRegistry ${engineName}: ${report.passed}/${report.total}; route=${route}; notes=${registry.noteCount}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
