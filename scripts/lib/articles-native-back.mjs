/** Opt-in test-driver observations, never a Product scroll/focus owner. */
import assert from 'node:assert/strict';

export const NATIVE_BACK_OBSERVATION_MS = 4000;
export const NATIVE_BACK_SCROLL_TOLERANCE_PX = 1;

/** Serialized read-only by Playwright, including when Product JS is disabled. */
export function nativeBackSnapshot(selector) {
  const active = document.activeElement, nodes = document.querySelectorAll(selector), last = nodes[nodes.length - 1];
  const rect = last?.getBoundingClientRect(), title = active?.querySelector('.h-article-title') || active;
  const heading = title?.getBoundingClientRect(), style = active && getComputedStyle(active);
  const bar = document.querySelector('.mcp-top'), br = bar?.getBoundingClientRect(), bs = bar && getComputedStyle(bar);
  return {
    url: location.href, referrer: document.referrer, y: scrollY, documentHeight: document.documentElement.scrollHeight, viewport: innerHeight,
    ready: document.readyState, fonts: document.fonts.status, timeOrigin: performance.timeOrigin,
    hash: location.hash, historyLength: history.length, scrollRestoration: history.scrollRestoration,
    rootScrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    active: { tag: active?.tagName, id: active?.id, href: active?.getAttribute('href'),
      focusVisible: active?.matches(':focus-visible'), outlineWidth: parseFloat(style?.outlineWidth || '0'),
      outlineStyle: style?.outlineStyle, titleTop: heading?.top, titleBottom: heading?.bottom,
      headerBottom: br && bs.display !== 'none' && bs.visibility !== 'hidden' && br.bottom > 0 ? br.bottom : 0 },
    last: { href: last?.getAttribute('href'), top: rect?.top, bottom: rect?.bottom },
    navigation: performance.getEntriesByType('navigation').map((n) => ({ type: n.type,
      domContentLoadedEventEnd: n.domContentLoadedEventEnd, loadEventEnd: n.loadEventEnd,
      notRestoredReasons: n.notRestoredReasons?.toJSON?.() ?? n.notRestoredReasons ?? null })),
  };
}

/** Host-side polling; no timers/scripts injected into a no-JS page and no repair. */
export async function settleNativeScroll(page, selector = '[data-catalog-series]') {
  let previous = '', stable = 0;
  const start = Date.now(), samples = [];
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(60);
    const current = await page.evaluate(nativeBackSnapshot, selector);
    samples.push({ elapsedMs: Date.now() - start, y: current.y, height: current.documentHeight, fonts: current.fonts });
    const key = [current.y, current.documentHeight, current.fonts].join(':');
    stable = key === previous ? stable + 1 : 0; previous = key;
    if (stable >= 5 && current.fonts === 'loaded') return { ...current, settling: samples };
  }
  throw Error('Native scroll/layout did not settle; no forced scroll/focus repair is permitted');
}

/** Exact URL and one-pixel scroll gate, after a full observation window. A large
 * history.length, a momentary restored frame or a reset focus cannot imply PASS. */
export function assessNativeBack({ before, after, samples, observedForMs }) {
  assert.ok(Number.isFinite(observedForMs) && observedForMs >= NATIVE_BACK_OBSERVATION_MS, 'Observe native Back for at least4000ms; an early restored frame is not final');
  assert.ok(Array.isArray(samples) && samples.length >= 5, 'Native Back needs a timing series');
  for (const state of [before, after, ...samples]) {
    assert.ok(Number.isFinite(state.y) && state.y >= 0 && Number.isFinite(state.documentHeight) && state.documentHeight > 0, 'Finite native scroll/layout facts required');
  }
  assert.ok(typeof before.url === 'string' && typeof after.url === 'string', 'Actual before/after URLs required');
  let priorTime = -1;
  for (const s of samples) {
    assert.ok(Number.isFinite(s.elapsedMs) && s.elapsedMs > priorTime && s.elapsedMs <= observedForMs, 'Strictly increasing measured Back timestamps required');
    priorTime = s.elapsedMs;
  }
  assert.ok(observedForMs - samples.at(-1).elapsedMs <= 500, 'Final native sample is stale');
  const tail = samples.slice(-5), stable = tail.at(-1).elapsedMs - tail[0].elapsedMs >= 300 && tail.every((s) => Math.abs(s.y - after.y) <= .5 && s.documentHeight === after.documentHeight && s.fonts === 'loaded');
  const routeRestored = before.url === after.url, delta = after.y - before.y;
  const scrollRestored = routeRestored && stable && after.fonts === 'loaded' && Math.abs(delta) <= NATIVE_BACK_SCROLL_TOLERANCE_PX;
  assert.ok(Number.isFinite(before.timeOrigin) && Number.isFinite(after.timeOrigin), 'Measured document time origins required');
  const focusRestored = Boolean(before.active?.href) && before.active.href === after.active?.href && (!before.active.id || before.active.id === after.active?.id);
  return { status: !stable || after.fonts !== 'loaded' ? 'INCONCLUSIVE_UNSETTLED' : scrollRestored ? 'PASS_OBSERVED_SCROLL' : 'FAIL_NATIVE_SCROLL',
    routeRestored, scrollRestored, delta, stable, focusRestored,
    focusStatus: focusRestored ? 'OBSERVED_EXACT_LINK' : after.active?.id && after.hash && after.active.id === decodeURIComponent(after.hash.slice(1)) ? 'FRAGMENT_TARGET_NOT_PREVIOUS_LINK' : 'NOT_RESTORED',
    documentReloaded: before.timeOrigin !== after.timeOrigin,
    observationMs: observedForMs, scrollTolerancePx: NATIVE_BACK_SCROLL_TOLERANCE_PX };
}

/** Script-free native platform control, not a newsroom/publisher or mock UI. */
export function nativeBackFixture({ rows, behavior }) {
  assert.ok(Number.isInteger(rows) && rows > 0 && rows <= 500, 'Bounded positive diagnostic row count required');
  assert.ok(['auto', 'smooth'].includes(behavior), 'Explicit native CSS behavior required');
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Native Back — TEST ONLY</title><style>html{scroll-behavior:${behavior}}body{margin:0;font:18px/1.5 sans-serif}header{height:900px;padding:20px}main{padding:20px}a{display:block;padding:20px;border-top:1px solid}li{min-height:300px}h1,h2{margin:0}</style><header><h1>Тест browser history, не публикация</h1><a href="#native-back-materials">К тестовым ссылкам</a></header><main id="native-back-materials" tabindex="-1"><h2>Native control</h2><ol>${Array.from({ length: rows }, (_, i) => `<li><a id="native-back-fixture-${i + 1}" data-native-back-fixture href="/__agent1_native_back__/destination.html">ТЕСТ, НЕ ПУБЛИКАЦИЯ ${i + 1}</a></li>`).join('')}</ol></main></html>`;
}

/** These are temporary serving endpoints/build receipts, never publication data. */
export function validateNativeBackMatrix(input) {
  assert.ok(input && Object.keys(input).every((k) => k === 'candidates') && Array.isArray(input.candidates), 'Only a candidate endpoint matrix is accepted');
  assert.ok(input.candidates.length > 0 && input.candidates.length <= 4, 'Use1–4 exact candidate endpoints');
  const names = new Set();
  for (const c of input.candidates) {
    assert.ok(c && Object.keys(c).every((k) => ['name', 'origin', 'sourceSha', 'artifactRoot', 'provenance', 'role'].includes(k)), 'Unknown candidate field; this is not a publication registry');
    assert.match(c.name || '', /^[a-z0-9][a-z0-9-]{0,50}$/, 'Safe unique diagnostic name required');
    assert.ok(!names.has(c.name), 'Duplicate candidate name'); names.add(c.name);
    assert.ok(!/^(?:neutral|virtual)-/.test(c.name), 'Reserved diagnostic control name');
    const url = new URL(c.origin);
    assert.ok(['http:', 'https:'].includes(url.protocol) && url.origin === c.origin, 'Canonical HTTP origin without credentials/path required');
    assert.match(c.sourceSha || '', /^[a-f0-9]{40}$/, 'Pin actual source SHA40');
    for (const key of ['artifactRoot', 'provenance']) assert.ok(typeof c[key] === 'string' && c[key], `Required ${key}`);
    assert.ok(['target', 'comparison'].includes(c.role), 'Explicit target/comparison role required');
  }
  assert.ok(input.candidates.some((c) => c.role === 'target'), 'At least one actual target is required');
  return input;
}
