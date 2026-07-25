#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

OLD_RULE = ".foliant-mark{float:right;font-variant-numeric:oldstyle-nums;font-size:15px;color:var(--color-accent-selection);margin:var(--s-4) 0 var(--s-4) var(--s-5);padding:var(--s-2) var(--s-4);border:1px solid var(--color-border-strong);background:var(--color-surface-quote);font-family:ui-serif,Georgia,serif;font-style:italic;position:relative}"
OLD_PSEUDO = ".foliant-mark::before{content:'';position:absolute;inset:-4px;border:1px solid var(--color-border);pointer-events:none;opacity:.5}"
MARKER_RE = re.compile(r'<div class="foliant-mark">(.*?)</div>', re.S)

CSS_BLOCK = r'''

/* =========================================================
   GB EDITORIAL DATELINE v1 — quiet place/period metadata.
   It is deliberately not a heading, card, badge or floating widget.
   ========================================================= */
.editorial-dateline {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: .25em .72em;
  width: 100%;
  margin: clamp(18px, 2.4vw, 26px) 0 clamp(10px, 1.5vw, 15px);
  padding: 8px 0 9px;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  border-color: color-mix(in srgb, var(--color-border-strong) 62%, transparent);
  background: transparent;
  color: var(--color-text-muted);
  font-family: ui-serif, Georgia, Cambria, "Times New Roman", serif;
  font-size: clamp(13px, 1.55vw, 15px);
  font-style: italic;
  font-weight: 400;
  line-height: 1.42;
  letter-spacing: .008em;
  text-wrap: pretty;
  break-inside: avoid-page;
  page-break-inside: avoid;
  break-after: avoid-page;
  page-break-after: avoid;
}
.editorial-dateline__place {
  min-width: 0;
  color: var(--color-text-secondary);
}
.editorial-dateline__date {
  color: var(--color-accent);
  font-family: "Source Sans 3", system-ui, sans-serif;
  font-size: .78em;
  font-style: normal;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: .075em;
  white-space: nowrap;
}
.editorial-dateline__place + .editorial-dateline__date::before {
  content: "·";
  margin-right: .72em;
  color: var(--color-border-strong);
  font-weight: 400;
}
@media (max-width: 560px) {
  .editorial-dateline {
    gap: .18em .58em;
    margin-top: 18px;
    padding-block: 7px 8px;
    font-size: 13.5px;
  }
  .editorial-dateline__place + .editorial-dateline__date::before {
    margin-right: .58em;
  }
}
@media print {
  html body .editorial-dateline {
    display: flex;
    width: 100%;
    margin: 4mm 0 3mm;
    padding: 2.2mm 0 2.4mm;
    border-color: #c9c9c4;
    background: transparent;
    color: #444;
    font-size: 9.5pt;
    line-height: 1.35;
    box-shadow: none;
    text-shadow: none;
    break-inside: avoid-page;
    page-break-inside: avoid;
    break-after: avoid-page;
    page-break-after: avoid;
  }
  html body .editorial-dateline__place { color: #333; }
  html body .editorial-dateline__date { color: #555; }
}
'''

CONTRACT = r'''#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function grep(args) {
  try { return cp.execFileSync('git', ['grep', ...args], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch (error) { return error.status === 1 ? '' : (() => { throw error; })(); }
}
const legacy = grep(['-n', 'foliant-mark', '--', ':!docs/**', ':!scripts/editorial-dateline-contract-test.js']);
assert.equal(legacy, '', `legacy foliant-mark remains:\n${legacy}`);
const listed = grep(['-l', 'class="editorial-dateline"', '--', '*.html', '*.astro']);
assert.ok(listed, 'no editorial dateline markup found');
const files = listed.split(/\r?\n/).filter(Boolean);
let total = 0;
let htmlCount = 0;
let sourceCount = 0;
for (const rel of files) {
  const source = read(rel);
  const matches = [...source.matchAll(/<p class="editorial-dateline">([\s\S]*?)<\/p>/g)];
  assert.ok(matches.length > 0, `${rel}: dateline must use a semantic p element`);
  total += matches.length;
  if (rel.endsWith('.html')) htmlCount += matches.length;
  if (rel.endsWith('.astro')) sourceCount += matches.length;
  for (const match of matches) {
    assert.ok(!/<h[1-6]\b/i.test(match[1]), `${rel}: dateline may not contain a heading`);
    assert.ok(/editorial-dateline__(?:place|date)/.test(match[1]), `${rel}: dateline lacks structured metadata spans`);
  }
  assert.ok(!/class="editorial-dateline"[^>]*(?:role="heading"|aria-level=)/i.test(source), `${rel}: dateline was promoted to heading semantics`);
}
assert.ok(htmlCount >= 11, `expected published datelines, found ${htmlCount}`);
assert.ok(sourceCount >= 10, `expected canonical source datelines, found ${sourceCount}`);
assert.ok(total >= 21, `expected the full migrated corpus, found ${total}`);
const css = read('css/site.css');
const rule = css.match(/\.editorial-dateline\s*\{([\s\S]*?)\}/);
assert.ok(rule, 'editorial dateline CSS rule missing');
for (const forbidden of [/\bfloat\s*:/, /border-radius\s*:/, /box-shadow\s*:/, /position\s*:\s*(?:absolute|fixed)/]) {
  assert.ok(!forbidden.test(rule[1]), `editorial dateline regained card/float styling: ${forbidden}`);
}
assert.match(rule[1], /background\s*:\s*transparent/, 'dateline must not have a card background');
assert.match(rule[1], /font-size\s*:\s*clamp\(13px[^;]*15px\)/, 'dateline must stay typographically subordinate');
assert.match(rule[1], /break-after\s*:\s*avoid-page/, 'dateline must stay with following content in print');
assert.ok(!/\.editorial-dateline::before\s*\{[^}]*content\s*:\s*["'][^·"']/s.test(css), 'dateline may not introduce a visible label-heading');
const runtime = read('js/reader-preferences-head.js');
assert.match(runtime, /\.editorial-dateline/, 'print pagination runtime does not keep datelines with next content');
assert.ok(!runtime.includes('.foliant-mark'), 'runtime still contains the legacy selector');
console.log(`✅ Editorial dateline contract passed (${total} synchronized occurrences across ${files.length} files)`);
'''

VISUAL = r'''#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const BASE = process.env.DATELINE_BASE_URL || 'http://127.0.0.1:4173';
const OUT = path.resolve('reports/editorial-dateline');
const routes = [
  ['gill-part-1', '/articles/dzhon-gill-chast-1-chelovek/'],
  ['gill-part-2', '/articles/dzhon-gill-chast-2-uchenyi/'],
  ['gill-part-3', '/articles/dzhon-gill-chast-3-nasledie/'],
];
await fs.mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const [slug, route] of routes) {
    for (const mode of [
      { name: 'desktop', viewport: { width: 1440, height: 1000 } },
      { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    ]) {
      const context = await browser.newContext({ viewport: mode.viewport, isMobile: !!mode.isMobile, hasTouch: !!mode.hasTouch, locale: 'ru-RU' });
      const page = await context.newPage();
      await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 120000 });
      await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
      const markers = page.locator('.editorial-dateline');
      const count = await markers.count();
      assert.ok(count > 0, `${route}: no editorial datelines`);
      const audit = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('.editorial-dateline')];
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          nodes: nodes.map((node) => {
            const style = getComputedStyle(node);
            return {
              tag: node.tagName,
              role: node.getAttribute('role'),
              float: style.cssFloat,
              radius: style.borderRadius,
              background: style.backgroundColor,
              display: style.display,
              fontSize: parseFloat(style.fontSize),
              width: node.getBoundingClientRect().width,
              viewport: window.innerWidth,
            };
          }),
        };
      });
      assert.ok(audit.overflow <= 1, `${route}/${mode.name}: horizontal overflow ${audit.overflow}px`);
      for (const node of audit.nodes) {
        assert.equal(node.tag, 'P');
        assert.notEqual(node.role, 'heading');
        assert.equal(node.float, 'none');
        assert.equal(node.radius, '0px');
        assert.ok(node.background === 'rgba(0, 0, 0, 0)' || node.background === 'transparent', `unexpected background ${node.background}`);
        assert.equal(node.display, 'flex');
        assert.ok(node.fontSize <= 15.1, `dateline looks too much like a heading: ${node.fontSize}px`);
        assert.ok(node.width <= node.viewport + 1, 'dateline overflows viewport');
      }
      await markers.first().screenshot({ path: path.join(OUT, `${slug}-${mode.name}-first.png`) });
      if (slug === 'gill-part-1' && mode.name === 'desktop') {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
        await markers.nth(Math.min(1, count - 1)).screenshot({ path: path.join(OUT, `${slug}-dark.png`) });
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      }
      if (mode.name === 'desktop') {
        await page.emulateMedia({ media: 'print' });
        const prep = await page.evaluate(() => window.GBPrintPagination?.prepare?.() || null);
        assert.ok(prep?.prepared, `${route}: semantic print preparation failed`);
        const printAudit = await page.evaluate(() => [...document.querySelectorAll('.editorial-dateline')].map((node) => ({
          keepNext: node.hasAttribute('data-print-keep-next'),
          flow: node.getAttribute('data-print-flow'),
        })));
        assert.ok(printAudit.every((item) => item.keepNext), `${route}: a dateline can orphan from following content`);
        await page.pdf({ path: path.join(OUT, `${slug}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
        await page.emulateMedia({ media: 'screen' });
        await page.evaluate(() => window.GBPrintPagination?.reset?.());
        const leftovers = await page.evaluate(() => document.querySelectorAll('[data-gb-print-generated],.gb-print-closing-group').length);
        assert.equal(leftovers, 0, `${route}: print DOM did not restore`);
      }
      report.push({ slug, mode: mode.name, count, audit });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
await fs.writeFile(path.join(OUT, 'visual-report.json'), JSON.stringify(report, null, 2));
console.log(`✅ Editorial dateline visual contract passed (${report.length} viewport checks)`);
'''

WORKFLOW = r'''name: Editorial Dateline Contract

on:
  pull_request:
    branches: [main]
    paths:
      - 'articles/**'
      - 'src/components/article-pilots/**'
      - 'css/site.css'
      - 'js/reader-preferences-head.js'
      - 'src/lib/asset-version.js'
      - 'scripts/editorial-dateline-*.js'
      - 'scripts/editorial-dateline-*.mjs'
      - '.github/workflows/editorial-dateline-contract.yml'
  push:
    branches: [main]
    paths:
      - 'articles/**'
      - 'src/components/article-pilots/**'
      - 'css/site.css'
      - 'js/reader-preferences-head.js'
      - 'src/lib/asset-version.js'
      - 'scripts/editorial-dateline-*.js'
      - 'scripts/editorial-dateline-*.mjs'
      - '.github/workflows/editorial-dateline-contract.yml'

permissions:
  contents: read

jobs:
  contract:
    runs-on: ubuntu-latest
    timeout-minutes: 35
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22.12.0'
          cache: npm
      - run: npm ci
      - name: Semantic and architecture contract
        run: |
          node scripts/editorial-dateline-contract-test.js
          node --check js/reader-preferences-head.js
      - name: Build production-like dist
        run: npm run strangler:build:production-like
      - run: npx playwright install --with-deps chromium
      - name: Start dist server
        run: |
          python3 -m http.server 4173 --directory dist > /tmp/editorial-dateline-server.log 2>&1 &
          echo $! > /tmp/editorial-dateline-server.pid
          for attempt in $(seq 1 40); do
            curl --fail --silent http://127.0.0.1:4173/articles/dzhon-gill-chast-1-chelovek/ >/dev/null && break
            sleep 1
          done
          curl --fail --silent http://127.0.0.1:4173/articles/dzhon-gill-chast-1-chelovek/ >/dev/null
      - name: Browser, mobile and print contract
        run: node scripts/editorial-dateline-visual-test.mjs
      - name: Install PDF audit dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y poppler-utils python3-pil
      - name: Raster-audit all dateline PDFs
        run: |
          for pdf in reports/editorial-dateline/*.pdf; do
            slug="$(basename "$pdf" .pdf)"
            python3 scripts/print-paper-pdf-audit.py "$pdf" --out "reports/editorial-dateline/audit-$slug"
          done
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: editorial-dateline-proof-${{ github.sha }}
          path: reports/editorial-dateline
          if-no-files-found: warn
          retention-days: 14
'''


def marker_markup(raw: str) -> str:
    raw = re.sub(r'\s+', ' ', raw).strip()
    match = re.match(r'^(.*?),\s*(\d{4}(?:[–-]\d{4})?)$', raw)
    if match:
        place, date = match.groups()
        return f'<p class="editorial-dateline"><span class="editorial-dateline__place">{place}</span><span class="editorial-dateline__date">{date}</span></p>'
    if re.match(r'^\d{4}(?:[–-]\d{4})?$', raw):
        return f'<p class="editorial-dateline"><span class="editorial-dateline__date">{raw}</span></p>'
    return f'<p class="editorial-dateline"><span class="editorial-dateline__place">{raw}</span></p>'

changed = []
for path in ROOT.rglob('*'):
    if not path.is_file() or path.suffix not in {'.html', '.astro'}:
        continue
    source = path.read_text('utf-8')
    updated, count = MARKER_RE.subn(lambda match: marker_markup(match.group(1)), source)
    if count:
        path.write_text(updated, 'utf-8')
        changed.append((str(path.relative_to(ROOT)), count))

css_path = ROOT / 'css/site.css'
css = css_path.read_text('utf-8')
if '.foliant-mark' in css:
    if OLD_RULE not in css or OLD_PSEUDO not in css:
        raise SystemExit('legacy foliant CSS changed unexpectedly; refusing a partial migration')
    css = css.replace(OLD_RULE, '').replace(OLD_PSEUDO, '')
    css = css.replace('.foliant-mark', '.editorial-dateline')
if 'GB EDITORIAL DATELINE v1' not in css:
    css += CSS_BLOCK
css_path.write_text(css, 'utf-8')

runtime_path = ROOT / 'js/reader-preferences-head.js'
runtime = runtime_path.read_text('utf-8')
runtime = runtime.replace('.foliant-mark', '.editorial-dateline')
runtime_path.write_text(runtime, 'utf-8')

(ROOT / 'scripts/editorial-dateline-contract-test.js').write_text(CONTRACT, 'utf-8')
(ROOT / 'scripts/editorial-dateline-visual-test.mjs').write_text(VISUAL, 'utf-8')
(ROOT / '.github/workflows/editorial-dateline-contract.yml').write_text(WORKFLOW, 'utf-8')

legacy = []
for path in ROOT.rglob('*'):
    if path.is_file() and path != Path(__file__) and '.git' not in path.parts:
        try:
            if 'foliant-mark' in path.read_text('utf-8'):
                legacy.append(str(path.relative_to(ROOT)))
        except UnicodeDecodeError:
            pass
if legacy:
    raise SystemExit('legacy foliant-mark remains in: ' + ', '.join(legacy))
print('materialized editorial dateline:', changed)
