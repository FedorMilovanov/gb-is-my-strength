#!/usr/bin/env python3
from pathlib import Path

ROOT = Path('.')
HASH = '3c7e0bdd'


def once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: {label}: expected one match, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


cache = ROOT / 'scripts/cache-bust.js'
once(
    cache,
    "    const re = new RegExp(`((?:\\.\\.\\/)*|/?)${escapedAsset}\\?v=[a-f0-9]{8}`, 'g');",
    "    const re = new RegExp(`((?:\\.\\.\\/)*|/?)${escapedAsset}\\?v=[^\\s\"'&}>]+`, 'g');",
    'accept arbitrary stale Astro revision values',
)

for part in range(1, 6):
    footer = ROOT / f'src/components/nagornaya/chast-{part}/NagornayaChast{part}PageFooter.astro'
    once(
        footer,
        '../../js/nagornaya-bar-extras.js?v=1',
        f'../../js/nagornaya-bar-extras.js?v={HASH}',
        'canonical bar asset revision',
    )

    shadow = ROOT / f'nagornaya/chast-{part}/index.html'
    text = shadow.read_text(encoding='utf-8')
    expected = f'<script src="../../js/nagornaya-bar-extras.js?v={HASH}" defer></script>'
    if expected in text:
        raise SystemExit(f'{shadow}: canonical bar asset already present; patch must be one-shot')
    anchor = '<script src="../../js/nagornaya-mobile-toc.js?v=649d9217" defer></script>'
    if text.count(anchor) != 1:
        raise SystemExit(f'{shadow}: mobile toc anchor expected once, found {text.count(anchor)}')
    text = text.replace(anchor, anchor + '\n' + expected, 1)
    shadow.write_text(text, encoding='utf-8')

contract = r'''#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSET = 'js/nagornaya-bar-extras.js';
const assetAbs = path.join(ROOT, ASSET);
const expectedHash = crypto.createHash('md5').update(fs.readFileSync(assetAbs)).digest('hex').slice(0, 8);

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assertPageContract(rel) {
  const source = read(rel);
  const escaped = ASSET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const refs = [...source.matchAll(new RegExp(`(?:\\.\\.\\/)*${escaped}\\?v=([a-f0-9]{8})`, 'g'))];
  assert.strictEqual(refs.length, 1, `${rel}: expected exactly one canonical ${ASSET} reference`);
  assert.strictEqual(refs[0][1], expectedHash, `${rel}: stale ${ASSET} revision`);
  assert(!source.includes(`${ASSET}?v=1`), `${rel}: legacy v=1 must never return`);

  const mobile = source.indexOf('nagornaya-mobile-toc.js');
  const bar = source.indexOf('nagornaya-bar-extras.js');
  const floating = source.indexOf('floating-cluster-controller.js');
  assert(mobile >= 0 && bar > mobile && floating > bar,
    `${rel}: required order is mobile-toc -> bar-extras -> floating-cluster`);
}

for (let part = 1; part <= 5; part += 1) {
  assertPageContract(`src/components/nagornaya/chast-${part}/NagornayaChast${part}PageFooter.astro`);
  assertPageContract(`nagornaya/chast-${part}/index.html`);
}

const adversarial = path.join(ROOT, 'src', '__nagornaya_bar_revision_adversarial.astro');
try {
  fs.writeFileSync(adversarial, '<script src="/js/nagornaya-bar-extras.js?v=1"></script>\n');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  assert.notStrictEqual(result.status, 0, 'cache-bust must reject arbitrary stale Astro revisions');
  assert(output.includes('src/__nagornaya_bar_revision_adversarial.astro'),
    'cache-bust negative witness must identify the adversarial Astro source');
} finally {
  fs.rmSync(adversarial, { force: true });
}

const clean = spawnSync(process.execPath, [path.join(ROOT, 'scripts/cache-bust.js')], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.strictEqual(clean.status, 0, `clean cache-bust failed:\n${clean.stdout}\n${clean.stderr}`);

console.log(`✅ Nagornaya bar asset contract: 10 page sources, revision ${expectedHash}, adversarial v=1 rejected`);
'''
(ROOT / 'scripts/nagornaya-bar-asset-contract-test.js').write_text(contract, encoding='utf-8')

browser = r'''#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2',
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(DIST, rel);
      if (!file.startsWith(DIST + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function visible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

(async () => {
  assert(fs.existsSync(path.join(DIST, 'nagornaya/chast-1/index.html')), 'run production-like build first');
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    for (const width of [360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (let part = 1; part <= 5; part += 1) {
        await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-${part}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#bottomBar .nag-bar-controls', { state: 'attached' });
        await page.waitForTimeout(350);
        const state = await page.evaluate((isVisibleSource) => {
          const isVisible = eval(`(${isVisibleSource})`);
          const bar = document.getElementById('bottomBar');
          const cluster = document.querySelectorAll('#bottomBar .nag-bar-controls');
          const visibleEmbers = [...document.querySelectorAll('.gb-ember')].filter(isVisible).length;
          const visibleSaves = [...document.querySelectorAll('.gb-save')].filter(isVisible).length;
          return {
            barVisible: isVisible(bar),
            clusterCount: cluster.length,
            clusterEmberCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-ember').length,
            clusterSaveCount: document.querySelectorAll('#bottomBar .nag-bar-controls .gb-save').length,
            clusterThemeCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-sidebar-theme-btn').length,
            clusterFontCount: document.querySelectorAll('#bottomBar .nag-bar-controls .nag-fontsize-btns').length,
            visibleEmbers,
            visibleSaves,
          };
        }, visible.toString());
        assert(state.barVisible, `part ${part} @ ${width}: bottom bar hidden`);
        assert.strictEqual(state.clusterCount, 1, `part ${part} @ ${width}: duplicate/missing bar cluster`);
        assert.strictEqual(state.clusterEmberCount, 1, `part ${part} @ ${width}: bar Play count`);
        assert.strictEqual(state.clusterSaveCount, 1, `part ${part} @ ${width}: bar Save count`);
        assert.strictEqual(state.clusterThemeCount, 0, `part ${part} @ ${width}: cloned theme must be removed`);
        assert.strictEqual(state.clusterFontCount, 0, `part ${part} @ ${width}: cloned font controls must be removed`);
        assert.strictEqual(state.visibleEmbers, 1, `part ${part} @ ${width}: competing visible Play controls`);
        assert.strictEqual(state.visibleSaves, 1, `part ${part} @ ${width}: competing visible Save controls`);
      }
    }

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`http://127.0.0.1:${port}/nagornaya/chast-1/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(350);
    const desktop = await page.evaluate(() => {
      const bar = document.getElementById('bottomBar');
      const style = bar ? getComputedStyle(bar) : null;
      return {
        displayed: !!bar && style.display !== 'none',
        inlineDisplay: bar ? bar.style.getPropertyValue('display') : null,
      };
    });
    assert.strictEqual(desktop.displayed, false, 'desktop: bottom bar must remain hidden');
    assert.strictEqual(desktop.inlineDisplay, '', 'desktop: mobile inline display override must be removed');
    assert.deepStrictEqual(pageErrors, [], `browser page errors:\n${pageErrors.join('\n')}`);
    console.log('✅ Nagornaya bar browser matrix: parts 1–5 @ 360/390 and desktop 1024');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
'''
(ROOT / 'scripts/nagornaya-bar-asset-browser-test.js').write_text(browser, encoding='utf-8')

package = ROOT / 'package.json'
once(
    package,
    '    "cache-bust": "node scripts/cache-bust.js",\n',
    '    "cache-bust": "node scripts/cache-bust.js",\n    "nagornaya:bar-asset:contract": "node scripts/nagornaya-bar-asset-contract-test.js",\n    "nagornaya:bar-asset:browser:test": "node scripts/nagornaya-bar-asset-browser-test.js",\n',
    'add Nagornaya contract scripts',
)
once(
    package,
    '    "engine:contracts": "node scripts/check-engine-contracts.js && npm run series:facade:guard",',
    '    "engine:contracts": "node scripts/check-engine-contracts.js && npm run series:facade:guard && npm run nagornaya:bar-asset:contract",',
    'wire permanent contract into engine gate',
)

print('Nagornaya bar asset patch applied')
