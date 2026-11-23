'use strict';
// Diagnostic: run against a separately built SOURCE_ROOT and a server of its dist.
const fs = require('fs'), path = require('path'), { createRequire } = require('module');
const root = process.env.SOURCE_ROOT || '/tmp/gb-pr2352';
const req = createRequire(path.join(root, 'package.json'));
const ts = req('typescript'), { chromium } = req('playwright');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, f);
const dir = path.join(root, 'src/components/article-pilots/_shared/series');
const { projectSeriesReaderToc, projectStandaloneReaderToc } = req(path.join(dir, 'readerTocProjection.ts'));
const { GILL_SERIES } = req(path.join(dir, 'seriesConfig.ts'));
const { HARD_TEXTS_SERIES } = req(path.join(dir, 'hardTextsSeriesConfig.ts'));
const flatten = nodes => nodes.flatMap(n => [n, ...flatten(n.children)]);
const routes = [
  ['series', '/articles/dzhon-gill-chast-2-uchenyi/', GILL_SERIES, 'part2'],
  ['book', '/articles/krajne-li-isporcheno-serdce/', HARD_TEXTS_SERIES, 'krajne'],
  ['article', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', null, null],
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  const results = [];
  try {
    for (const [kind, route, cfg, pageId] of routes) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        const response = await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8083') + route, { waitUntil: 'load' });
        await page.waitForTimeout(800);
        const refs = cfg ? cfg.pages[pageId].partToc.map(x => ({ href: x.href, label: x.label, level: x.level })) :
          await page.locator('#hrailToc a[href^="#"]').evaluateAll(es => es.map(a => ({ href: a.getAttribute('href'), label: a.textContent.trim() })));
        const dom = await page.evaluate(refs => refs.map(ref => {
          const id = decodeURIComponent(ref.href.slice(1));
          const els = [...document.querySelectorAll('[id]')].filter(e => e.id === id), e = els[0], r = e?.getBoundingClientRect();
          return { ...ref, id, count: els.length, tag: e?.tagName || null,
            level: e && /^H[2-6]$/.test(e.tagName) ? Number(e.tagName[1]) : null,
            visible: !!r && r.width > 0 && r.height > 0, outer: e?.outerHTML.slice(0, 200) || null };
        }), refs);
        const order = await page.evaluate(refs => refs.every((v, i) => !i || !!(
          document.getElementById(decodeURIComponent(refs[i - 1].href.slice(1)))?.compareDocumentPosition(
            document.getElementById(decodeURIComponent(v.href.slice(1)))) & Node.DOCUMENT_POSITION_FOLLOWING)), refs);
        let projection = null, projectionError = null;
        try {
          if (cfg) {
            const v = projectSeriesReaderToc(cfg, pageId);
            projection = { actualPageId: v.actualPageId, activePath: v.activePath, rootKinds: v.nodes.map(x => x.kind),
              rootLabels: v.nodes.map(x => x.label), headings: flatten(v.nodes).filter(x => x.kind === 'heading').map(x => ({ href: x.href, label: x.label, depth: x.depth })) };
          } else {
            const v = projectStandaloneReaderToc(route, dom.map(x => ({ id: x.id, label: x.label, level: x.level })));
            projection = { rootKinds: v.map(x => x.kind), headings: flatten(v).map(x => ({ href: x.href, label: x.label, depth: x.depth })) };
          }
        } catch (e) { projectionError = String(e); }
        const row = { kind, route, status: response.status(), shape: cfg ? (cfg.shape || 'flat') : null, sourceRows: refs.length,
          missing: dom.filter(x => x.count === 0).length, duplicate: dom.filter(x => x.count > 1).length,
          notVisible: dom.filter(x => !x.visible).length, order, dom, projection, projectionError };
        results.push(row);
        console.log(kind, 'rows', row.sourceRows, 'missing', row.missing, 'duplicates', row.duplicate,
          'no layout box', row.notVisible, 'order', row.order, 'projectionError', row.projectionError);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(process.env.OUTPUT || '/tmp/445-3-shapes.json', JSON.stringify(results, null, 2));
  // Fail-closed fixture harness; measurements are not accessibility or functional navigation acceptance.
  if (results.some(x => x.status !== 200 || !x.sourceRows || x.missing || x.duplicate || x.notVisible || !x.order || x.projectionError)) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
