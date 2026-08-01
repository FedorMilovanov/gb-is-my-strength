import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { serve, configureContext, MOBILE } from './lib/a04-contract.mjs';

const require = createRequire(import.meta.url);
const playwright = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const engineName = process.env.GB_NOTE_BROWSER || 'chromium';
const browserType = playwright[engineName];
if (!browserType) throw new Error(`unsupported GB_NOTE_BROWSER=${engineName}`);

const route = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const result = {
  schemaVersion: 1,
  contract: 'A03-temporary-touch-event-trace',
  engine: engineName,
  route,
  triggerIndex: 1,
  point: null,
  before: null,
  after: null,
  trace: [],
  error: '',
};

function state() {
  const trigger = document.querySelectorAll('.fn-marker:not(.map-trigger)')[1] || null;
  const tip = [...document.querySelectorAll('.tooltip')]
    .find((node) => node.classList.contains('gb-floating-tip') && node.classList.contains('is-open')) || null;
  const close = tip?.querySelector('[data-tooltip-close]') || null;
  const closeRect = close?.getBoundingClientRect() || null;
  return {
    triggerOpen: Boolean(trigger?.classList.contains('is-open')),
    ariaExpanded: trigger?.getAttribute('aria-expanded') || null,
    tipOpen: Boolean(tip),
    tipParent: tip?.parentElement?.tagName || null,
    closeCount: tip?.querySelectorAll('[data-tooltip-close]').length || 0,
    closeRect: closeRect ? {
      left: closeRect.left,
      top: closeRect.top,
      right: closeRect.right,
      bottom: closeRect.bottom,
      width: closeRect.width,
      height: closeRect.height,
    } : null,
    rootOpen: document.documentElement.classList.contains('gb-tooltip-open'),
    overlayTop: document.documentElement.getAttribute('data-overlay-top'),
    overlayCount: document.documentElement.getAttribute('data-overlay-count'),
  };
}

const { server, base } = await serve();
const browser = await browserType.launch();
try {
  const context = await browser.newContext({
    viewport: MOBILE,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  await configureContext(context, base);
  const page = await context.newPage();
  await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const trigger = page.locator('.fn-marker:not(.map-trigger)').nth(1);
  await trigger.scrollIntoViewIfNeeded();
  await trigger.tap({ timeout: 4000 });
  await page.waitForTimeout(220);

  result.before = await page.evaluate(state);
  if (!result.before.tipOpen || !result.before.closeRect) throw new Error(`mobile sheet or close control missing: ${JSON.stringify(result.before)}`);
  result.point = {
    x: result.before.closeRect.left + result.before.closeRect.width / 2,
    y: result.before.closeRect.top + result.before.closeRect.height / 2,
  };

  await page.evaluate(() => {
    const describe = (value) => {
      if (value === window) return 'window';
      if (value === document) return 'document';
      if (!(value instanceof Element)) return value?.constructor?.name || String(value);
      const id = value.id ? `#${value.id}` : '';
      const classes = [...value.classList].slice(0, 4).map((name) => `.${name}`).join('');
      return `${value.tagName.toLowerCase()}${id}${classes}`;
    };
    const trace = [];
    const registrations = [];
    const record = (stage) => (event) => {
      const point = event.changedTouches?.[0] || event.touches?.[0] || event;
      trace.push({
        stage,
        type: event.type,
        eventPhase: event.eventPhase,
        target: describe(event.target),
        currentTarget: describe(event.currentTarget),
        defaultPrevented: event.defaultPrevented,
        cancelBubble: event.cancelBubble,
        composed: event.composed,
        isTrusted: event.isTrusted,
        detail: Number.isFinite(event.detail) ? event.detail : null,
        pointerType: event.pointerType || null,
        touches: event.touches?.length ?? null,
        changedTouches: event.changedTouches?.length ?? null,
        clientX: Number.isFinite(point?.clientX) ? point.clientX : null,
        clientY: Number.isFinite(point?.clientY) ? point.clientY : null,
        path: event.composedPath?.().slice(0, 8).map(describe) || [],
      });
    };
    const add = (node, type, stage, capture) => {
      const handler = record(stage);
      node.addEventListener(type, handler, { capture, passive: true });
      registrations.push(() => node.removeEventListener(type, handler, { capture }));
    };
    const types = ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'];
    const close = document.querySelector('.gb-floating-tip.is-open [data-tooltip-close]');
    for (const type of types) {
      add(window, type, 'window-capture', true);
      add(document, type, 'document-capture-late', true);
      if (close) {
        add(close, type, 'close-capture', true);
        add(close, type, 'close-bubble', false);
      }
      add(document, type, 'document-bubble', false);
      add(window, type, 'window-bubble', false);
    }
    window.__a03TouchTrace = trace;
    window.__a03TouchTraceCleanup = () => registrations.splice(0).forEach((remove) => remove());
  });

  await page.touchscreen.tap(result.point.x, result.point.y);
  await page.waitForTimeout(350);
  result.after = await page.evaluate(state);
  result.trace = await page.evaluate(() => {
    const trace = [...(window.__a03TouchTrace || [])];
    window.__a03TouchTraceCleanup?.();
    delete window.__a03TouchTrace;
    delete window.__a03TouchTraceCleanup;
    return trace;
  });
  await context.close();
} catch (error) {
  result.error = String(error?.stack || error);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

fs.mkdirSync(REPORTS, { recursive: true });
const output = path.join(REPORTS, `a03-touch-event-trace-${engineName}.json`);
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
