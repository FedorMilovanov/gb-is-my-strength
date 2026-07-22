#!/usr/bin/env node
/**
 * Failure-only diagnostics for public-surface-browser-matrix.mjs.
 * Reads the matrix JSON, revisits routes with horizontal overflow, records the
 * concrete DOM nodes crossing the viewport, and writes screenshots + JSON.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = process.argv[2] || join(ROOT, 'reports/public-surface-browser-matrix.json');
const base = process.argv[3] || 'http://127.0.0.1:4177';
const outDir = join(ROOT, 'reports/public-surface-browser-diagnostics');

function safeName(route, viewport) {
  return `${route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9а-яё_-]+/gi, '-') || 'home'}--${viewport}`;
}

function selectorFor(node) {
  if (!(node instanceof Element)) return '<unknown>';
  if (node.id) return `#${CSS.escape(node.id)}`;
  const parts = [];
  let current = node;
  while (current && current !== document.documentElement && parts.length < 5) {
    let part = current.tagName.toLowerCase();
    const stableClasses = [...current.classList].filter((name) => !/^(is-|has-|active|open|current|reveal)/.test(name)).slice(0, 3);
    if (stableClasses.length) part += `.${stableClasses.map((name) => CSS.escape(name)).join('.')}`;
    const siblings = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current.tagName) : [];
    if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

const report = JSON.parse(await readFile(reportPath, 'utf8'));
const viewportMap = new Map((report.viewports || []).map((item) => [item.id, item]));
const failures = (report.failures || []).filter((item) => item.contract === 'layout:no-horizontal-overflow');
if (!failures.length) {
  console.log('No horizontal-overflow failures to diagnose.');
  process.exit(0);
}

await mkdir(outDir, { recursive: true });
const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const repoImage = '/opt/pw-browsers/chromium';
const options = explicit && existsSync(explicit)
  ? { executablePath: explicit }
  : existsSync(repoImage) ? { executablePath: repoImage } : {};
const browser = await chromium.launch(options);
const diagnostics = [];
try {
  for (const failure of failures) {
    const viewport = viewportMap.get(failure.viewport);
    if (!viewport) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'ru-RU' });
    const page = await context.newPage();
    await page.goto(base + failure.route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);
    const data = await page.evaluate(selectorForSource => {
      // Recreate selectorFor inside the browser without relying on closures.
      const selectorFor = eval(`(${selectorForSource})`);
      const width = innerWidth;
      const offenders = [...document.querySelectorAll('body *')].map(node => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const overflowRight = Math.max(0, rect.right - width);
        const overflowLeft = Math.max(0, -rect.left);
        if (overflowRight <= 1 && overflowLeft <= 1 && node.scrollWidth <= node.clientWidth + 1) return null;
        if (rect.width === 0 || rect.height === 0 || style.display === 'none' || style.visibility === 'hidden') return null;
        return {
          selector: selectorFor(node),
          tag: node.tagName.toLowerCase(),
          text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 180),
          rect: { left: Math.round(rect.left * 10) / 10, right: Math.round(rect.right * 10) / 10, width: Math.round(rect.width * 10) / 10 },
          overflowRight: Math.round(overflowRight * 10) / 10,
          overflowLeft: Math.round(overflowLeft * 10) / 10,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          display: style.display,
          position: style.position,
          whiteSpace: style.whiteSpace,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          overflowX: style.overflowX,
        };
      }).filter(Boolean).sort((a, b) => Math.max(b.overflowRight, b.overflowLeft, b.scrollWidth - b.clientWidth) - Math.max(a.overflowRight, a.overflowLeft, a.scrollWidth - a.clientWidth)).slice(0, 40);
      return {
        documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        viewportWidth: width,
        bodyRect: document.body.getBoundingClientRect().toJSON(),
        offenders,
      };
    }, selectorFor.toString());
    const name = safeName(failure.route, failure.viewport);
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true });
    diagnostics.push({ route: failure.route, viewport: failure.viewport, ...data });
    console.log(`OVERFLOW ${failure.route} ${failure.viewport}: document=${data.documentWidth}, viewport=${data.viewportWidth}`);
    for (const offender of data.offenders.slice(0, 8)) console.log(`  ${offender.selector} right=+${offender.overflowRight}px scroll=${offender.scrollWidth}/${offender.clientWidth} ${offender.text}`);
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(outDir, 'diagnostics.json'), `${JSON.stringify(diagnostics, null, 2)}\n`);
