#!/usr/bin/env node
/**
 * Failure-only diagnostics for public-surface-browser-matrix.mjs.
 * Reads the matrix JSON, revisits routes with horizontal overflow at the same
 * early DOMContentLoaded timing as the matrix, then records a short timeline of
 * geometry, scroll-lock ownership, concrete offenders and screenshots.
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

async function takeSnapshot(page, elapsedMs) {
  return page.evaluate(({ selectorForSource, elapsedMs }) => {
    // Recreate selectorFor inside the browser without relying on closures.
    const selectorFor = eval(`(${selectorForSource})`);
    const width = innerWidth;
    const html = document.documentElement;
    const body = document.body;
    const bodyStyle = getComputedStyle(body);
    const openSelectors = [
      '.mobile-nav.active', '.mobile-nav[aria-hidden="false"]',
      '.cp-backdrop.is-open', '.cp-panel[aria-hidden="false"]',
      '#btocOverlay.open', '.btoc-panel[aria-hidden="false"]',
      '.sd-panel.open', '.toc-overlay.is-open',
      '#partTocOverlay.is-open', '#seriesTocOverlay.is-open',
      '#gb-hl-backdrop.is-open', '.img-viewer.is-open',
      '.gbx-imgview--open', '[role="dialog"][aria-hidden="false"]',
    ];
    const openOverlays = [...new Set(openSelectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)].map((node) => selectorFor(node))
    ))];
    const offenders = [...document.querySelectorAll('body *')].map((node) => {
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

    let lockSources = null;
    try {
      lockSources = window.SiteUtils?._scrollLockSources
        ? JSON.parse(JSON.stringify(window.SiteUtils._scrollLockSources))
        : null;
    } catch {
      lockSources = '<unserializable>';
    }
    return {
      elapsedMs,
      readyState: document.readyState,
      documentWidth: Math.max(html.scrollWidth, body.scrollWidth),
      viewportWidth: width,
      html: {
        clientWidth: html.clientWidth,
        scrollWidth: html.scrollWidth,
        dataScrollLocked: html.getAttribute('data-scroll-locked'),
        className: html.className,
        style: html.getAttribute('style') || '',
      },
      body: {
        clientWidth: body.clientWidth,
        scrollWidth: body.scrollWidth,
        rect: body.getBoundingClientRect().toJSON(),
        className: body.className,
        style: body.getAttribute('style') || '',
        computed: {
          width: bodyStyle.width,
          position: bodyStyle.position,
          left: bodyStyle.left,
          right: bodyStyle.right,
          top: bodyStyle.top,
          paddingRight: bodyStyle.paddingRight,
          overflow: bodyStyle.overflow,
          overflowX: bodyStyle.overflowX,
          overscrollBehavior: bodyStyle.overscrollBehavior,
        },
      },
      lockState: {
        count: window.SiteUtils?._scrollLockCount ?? null,
        sources: lockSources,
        overlayRuntimeLayers: window.OverlayRuntime?.getState?.() || null,
        openOverlays,
      },
      activeElement: selectorFor(document.activeElement),
      visualViewport: window.visualViewport ? {
        width: window.visualViewport.width,
        height: window.visualViewport.height,
        offsetLeft: window.visualViewport.offsetLeft,
        offsetTop: window.visualViewport.offsetTop,
        scale: window.visualViewport.scale,
      } : null,
      offenders,
    };
  }, { selectorForSource: selectorFor.toString(), elapsedMs });
}

try {
  for (const failure of failures) {
    const viewport = viewportMap.get(failure.viewport);
    if (!viewport) continue;
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'ru-RU' });
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return route.abort();
      return route.continue();
    });
    await page.goto(base + failure.route, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const timeline = [];
    let elapsed = 0;
    for (const target of [0, 100, 300, 1000, 3500]) {
      const delay = target - elapsed;
      if (delay > 0) await page.waitForTimeout(delay);
      elapsed = target;
      const snapshot = await takeSnapshot(page, elapsed);
      timeline.push(snapshot);
      if (target === 300) {
        await page.screenshot({ path: join(outDir, `${safeName(failure.route, failure.viewport)}--early.png`), fullPage: true });
      }
    }
    await page.screenshot({ path: join(outDir, `${safeName(failure.route, failure.viewport)}--settled.png`), fullPage: true });
    diagnostics.push({ route: failure.route, viewport: failure.viewport, timeline });
    for (const snapshot of timeline) {
      console.log(`OVERFLOW-TIMELINE ${failure.route} ${failure.viewport} +${snapshot.elapsedMs}ms: document=${snapshot.documentWidth}, viewport=${snapshot.viewportWidth}, lock=${snapshot.html.dataScrollLocked || '0'}, bodyPadding=${snapshot.body.computed.paddingRight}, sources=${JSON.stringify(snapshot.lockState.sources)}`);
    }
    const early = timeline.find((item) => item.elapsedMs === 300) || timeline[0];
    for (const offender of early.offenders.slice(0, 8)) console.log(`  ${offender.selector} right=+${offender.overflowRight}px left=+${offender.overflowLeft}px scroll=${offender.scrollWidth}/${offender.clientWidth} ${offender.text}`);
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(join(outDir, 'diagnostics.json'), `${JSON.stringify(diagnostics, null, 2)}\n`);
