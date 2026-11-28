#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const ROOT = path.resolve(process.cwd());
const DIST = path.join(ROOT, 'dist');
const REPORT_DIR = path.join(ROOT, 'reports', 'article-capability');
const BROWSERS = { chromium, webkit };
const browserNames = String(process.env.ARTICLE_CAPABILITY_BROWSERS || 'chromium,webkit')
  .split(',').map((value) => value.trim()).filter(Boolean);
const routes = [
  { id: 'antisovetov', path: '/articles/20-antisovetov-pastoru/' },
  { id: 'krajne', path: '/articles/krajne-li-isporcheno-serdce/' },
];
const viewports = [{ width: 390, height: 844 }, { width: 1366, height: 900 }];
const faqRoutes = [
  { path: '/articles/20-antisovetov-pastoru/', count: 7 },
  { path: '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/', count: 3 },
  { path: '/articles/kod-da-vinchi/', count: 8 },
  { path: '/articles/krajne-li-isporcheno-serdce/', count: 3 },
];
const faqOnly = process.argv.includes('--faq-only');

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.woff2': 'font/woff2',
  }[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function resolveRequestPath(urlValue) {
  const url = new URL(urlValue || '/', 'http://127.0.0.1');
  const decoded = decodeURIComponent(url.pathname);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const candidate = path.resolve(DIST, `.${relative}`);
  assert.ok(candidate === DIST || candidate.startsWith(`${DIST}${path.sep}`), 'request escaped dist root');
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  const indexCandidate = path.join(candidate, 'index.html');
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) return indexCandidate;
  return null;
}

async function startServer() {
  for (const route of routes) assert.ok(resolveRequestPath(route.path), `built route missing: ${route.path}`);
  const server = http.createServer((request, response) => {
    try {
      const filePath = resolveRequestPath(request.url);
      response.setHeader('Cache-Control', 'no-store');
      if (!filePath) { response.statusCode = 404; response.end('Not found'); return; }
      response.setHeader('Content-Type', contentType(filePath));
      if (request.method === 'HEAD') { response.statusCode = 200; response.end(); return; }
      fs.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.statusCode = 400;
      response.end(String(error?.message || error));
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function exerciseFaq(page, label) {
  const button = page.locator('.faq-accordion__q[data-gb-faq-owner="native-v1"]').first();
  await button.waitFor({ state: 'visible' });
  const firstTransition = await button.evaluate((node) => {
    const before = node.getAttribute('aria-expanded');
    node.click();
    return {
      before,
      after: node.getAttribute('aria-expanded'),
      itemOpen: node.closest('.faq-accordion__item')?.classList.contains('is-open') === true,
    };
  });
  assert.notEqual(firstTransition.after, firstTransition.before, `${label}: FAQ click did not toggle aria-expanded`);
  assert.equal(firstTransition.itemOpen, firstTransition.after === 'true', `${label}: FAQ visual/open state diverges from aria-expanded`);

  const restored = await button.evaluate((node) => {
    node.click();
    return {
      expanded: node.getAttribute('aria-expanded'),
      itemOpen: node.closest('.faq-accordion__item')?.classList.contains('is-open') === true,
    };
  });
  assert.equal(restored.expanded, firstTransition.before, `${label}: FAQ second click did not restore state`);
  assert.equal(restored.itemOpen, restored.expanded === 'true', `${label}: FAQ restored visual/open state diverges from aria-expanded`);
}

// The real built route must keep all answer text readable if the native
// owner is unavailable, but keep the normal interactive controls collapsed.
async function exerciseFaqProgressive(browser, browserName, baseUrl, route, viewport, mode) {
  const context = await browser.newContext({
    viewport, javaScriptEnabled: mode !== 'no-js', reducedMotion: 'reduce', serviceWorkers: 'block',
  });
  const label = [browserName, route.path, viewport.width, mode].join(' ');
  let blocked = 0;
  try {
    await context.route('**/*', request => {
      const url = new URL(request.request().url());
      if (url.origin !== baseUrl) return request.abort('blockedbyclient');
      if (mode === 'bundle-blocked' && /\/_astro\/ReaderActionsRuntime\.astro_astro_type_script_/.test(url.pathname)) {
        blocked += 1;
        return request.abort('failed');
      }
      return request.continue();
    });
    const page = await context.newPage();
    const response = await page.goto(baseUrl + route.path, { waitUntil: 'load' });
    assert.ok(response?.ok(), label + ': route failed');
    if (route.path === '/articles/kod-da-vinchi/') {
      const preloads = await page.locator('head noscript[data-gb-faq-font-preloads] link[rel=preload][as=font]').evaluateAll(nodes => nodes.map(link => ({ href: new URL(link.href).pathname, type: link.type, crossOrigin: link.crossOrigin })));
      assert.equal(preloads.length, mode === 'no-js' ? 9 : 0, label + ': static font preload isolation');
      assert.equal(new Set(preloads.map(link => link.href)).size, preloads.length, label + ': duplicate static font preload');
      assert.ok(preloads.every(link => link.type === 'font/woff2' && link.crossOrigin === 'anonymous' && /^\/fonts\/(Lora|SourceSans3)\/[^/]+\.woff2$/.test(link.href)), label + ': invalid static font preload');
    }
    if (mode === 'normal') await page.waitForFunction(() => document.documentElement.dataset.gbArticleFaqReady === '1');
    if (mode === 'bundle-blocked') assert.ok(blocked > 0, label + ': did not block actual native entry');
    const buttons = page.locator('.faq-accordion__q');
    assert.equal(await buttons.count(), route.count, label + ': FAQ count drift');
    const states = await buttons.evaluateAll(nodes => nodes.map(q => {
      const b = document.getElementById(q.getAttribute('aria-controls'));
      const inner = b?.querySelector('.faq-accordion__body-inner');
      return { marker: q.hasAttribute('data-gb-faq-static'), disabled: q.disabled,
        expanded: q.getAttribute('aria-expanded'), owner: q.dataset.gbFaqOwner || null,
        inert: b?.inert, height: b?.getBoundingClientRect().height,
        content: inner?.getBoundingClientRect().height, scroll: inner?.scrollHeight };
    }));
    for (const state of states) {
      if (mode === 'normal') {
        assert.equal(state.owner, 'native-v1', label + ': missing native owner');
        assert.equal(state.disabled, false); assert.equal(state.expanded, 'false');
        assert.equal(state.inert, true); assert.ok(state.height <= 1, label + ': closed answer visible');
      } else {
        assert.ok(state.scroll > 0 && state.height >= state.scroll - 2, label + ': fallback answer clipped');
        assert.equal(state.owner, null); assert.equal(state.disabled, true);
        assert.equal(state.expanded, 'true'); assert.equal(state.inert, false);
        assert.ok(state.scroll > 0 && state.height >= state.scroll - 2 && state.content >= state.scroll - 2,
          label + ': fallback answer clipped: ' + JSON.stringify(state));
      }
      assert.equal(state.marker, true, label + ': missing progressive server marker');
    }
    if (mode === 'normal') {
      const button = buttons.first();
      const id = await button.getAttribute('aria-controls');
      await button.click();
      await page.waitForFunction(id => {
        const b = document.getElementById(id);
        const inner = b.querySelector('.faq-accordion__body-inner');
        return !b.inert && b.getBoundingClientRect().height >= inner.scrollHeight - 2;
      }, id);
      assert.equal(await button.getAttribute('aria-expanded'), 'true');
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => {
        const b = document.getElementById(id);
        return b.inert && b.getBoundingClientRect().height <= 1;
      }, id);
      assert.equal(await button.getAttribute('aria-expanded'), 'false');
      assert.equal(await button.evaluate(q => document.activeElement === q), true, label + ': keyboard focus lost');
    }
    // Real answer IDs are also public Scripture-index destinations. A valid
    // URL alone is insufficient if the native owner hides the answer.
    const ids = await buttons.evaluateAll(nodes => nodes.map(q => q.getAttribute('aria-controls')));
    const coldId = ids.at(-1), nextId = ids.at(-2);
    assert.ok(coldId && nextId, label + ': fragment fixture IDs missing');
    const fragmentState = id => page.evaluate(id => {
      const body = document.getElementById(id);
      const q = document.getElementById(body.getAttribute('aria-labelledby'));
      const inner = body.querySelector('.faq-accordion__body-inner');
      const r = body.getBoundingClientRect();
      return { expanded: q.getAttribute('aria-expanded'), inert: body.inert,
        height: r.height, content: inner.scrollHeight, top: r.top, bottom: r.bottom,
        viewport: innerHeight, hash: location.hash, focus: document.activeElement?.id || null };
    }, id);
    const assertFragment = async id => {
      // Poll the real rendered answer, not an injected open state.
      let s;
      for (let attempt = 0; attempt < 30; attempt++) {
        s = await fragmentState(id);
        if (s.expanded === 'true' && !s.inert && s.content > 0 &&
            s.height >= s.content - 2 && s.top >= -2 && s.top < s.viewport - 24) break;
        await page.waitForTimeout(100);
      }
      assert.equal(s.hash, '#' + id, label + ': wrong answer fragment');
      assert.ok(s.expanded === 'true' && !s.inert && s.content > 0 &&
        s.height >= s.content - 2 && s.top >= -2 && s.top < s.viewport - 24,
        label + ': fragment answer hidden or out of view: ' + JSON.stringify(s));
      return s;
    };
    await page.goto(baseUrl + route.path + '?faq-fragment=1#' + encodeURIComponent(coldId), { waitUntil: 'load' });
    if (mode === 'normal') await page.waitForFunction(() => document.documentElement.dataset.gbArticleFaqReady === '1');
    const cold = await assertFragment(coldId);
    if (mode === 'normal') {
      const opened = await page.locator('.faq-accordion__q[aria-expanded="true"]').evaluateAll(nodes => nodes.map(q => q.getAttribute('aria-controls')));
      assert.deepEqual(opened, [coldId], label + ': cold fragment opened unrelated answers');
    }
    await page.evaluate(id => { location.hash = id; }, nextId);
    const changed = await assertFragment(nextId);
    if (mode === 'normal') {
      const q = page.locator('.faq-accordion__q[aria-controls="' + nextId + '"]');
      await q.click();
      await page.waitForFunction(id => document.getElementById(id).inert, nextId);
      await page.evaluate(() => { location.hash = '#nonexistent-faq-fragment'; });
      await page.waitForTimeout(150);
      assert.equal(await q.getAttribute('aria-expanded'), 'false', label + ': unrelated fragment reopened a manually closed answer');
    }
    return { browser: browserName, route: route.path, viewport, mode, answers: states.length, blocked, fragments: { cold, changed } };
  } finally { await context.close(); }
}

async function waitForPageMotionToSettle(page, label) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  try {
    await page.waitForFunction(
      () => document.getAnimations().every((animation) => {
        if (animation.playState !== 'running' && animation.playState !== 'pending') return true;
        // Scroll/view-driven animations follow scroll position, which is fixed here; they do not drift.
        if (animation.timeline !== document.timeline) return true;
        // Endless decorative loops (e.g. image shimmer) never finish and must not block the check.
        return animation.effect?.getComputedTiming?.().iterations === Infinity;
      }),
      null,
      { timeout: 10000, polling: 50 },
    );
  } catch (error) {
    const running = await page.evaluate(() => document.getAnimations()
      .filter((animation) => (animation.playState === 'running' || animation.playState === 'pending') && animation.timeline === document.timeline)
      .slice(0, 6)
      .map((animation) => {
        const timing = animation.effect?.getComputedTiming?.() || {};
        const target = animation.effect?.target;
        return {
          type: animation.transitionProperty ? `transition:${animation.transitionProperty}` : `animation:${animation.animationName || ''}`,
          target: target instanceof Element ? `${target.tagName}.${typeof target.className === 'string' ? target.className : ''}` : '',
          iterations: timing.iterations,
          duration: timing.duration,
          delay: timing.delay,
          endTime: timing.endTime,
          playState: animation.playState,
        };
      }));
    throw new Error(`${label}: page motion did not settle before heading-anchor hit-test: ${JSON.stringify(running)}`);
  }
}

async function exerciseHeadingAnchor(page, label) {
  const anchors = page.locator('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
  const count = await anchors.count();
  assert.ok(count > 0, `${label}: no owned heading anchors found`);

  let anchor = null;
  const diagnostics = [];
  for (let index = 0; index < count; index += 1) {
    const candidate = anchors.nth(index);
    const href = await candidate.getAttribute('href');
    if (!href?.startsWith('#')) continue;
    if (await page.locator(href).count() === 0) continue;

    try {
      await candidate.scrollIntoViewIfNeeded({ timeout: 3000 });
    } catch {
      // Keep searching; diagnostics below explain why a retained target did not materialize.
    }
    if (await candidate.isVisible()) {
      anchor = candidate;
      break;
    }

    if (diagnostics.length < 5) {
      diagnostics.push(await candidate.evaluate((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        let ancestor = node.parentElement;
        let blocker = null;
        while (ancestor && ancestor !== document.documentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          if (ancestor.hidden || ancestorStyle.display === 'none' || ancestorStyle.visibility === 'hidden' || ancestorRect.width === 0 || ancestorRect.height === 0) {
            blocker = {
              tag: ancestor.tagName,
              id: ancestor.id || '',
              className: typeof ancestor.className === 'string' ? ancestor.className : '',
              hidden: ancestor.hidden,
              display: ancestorStyle.display,
              visibility: ancestorStyle.visibility,
              width: ancestorRect.width,
              height: ancestorRect.height,
              contentVisibility: ancestorStyle.contentVisibility,
            };
            break;
          }
          ancestor = ancestor.parentElement;
        }
        return {
          href: node.getAttribute('href'),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: rect.width,
          height: rect.height,
          contentVisibility: style.contentVisibility,
          blocker,
        };
      }));
    }
  }

  assert.ok(anchor, `${label}: no user-visible retained heading anchor with a live fragment target after normal scroll; ${JSON.stringify(diagnostics)}`);
  const href = await anchor.getAttribute('href');
  assert.ok(href?.startsWith('#'), `${label}: heading anchor missing fragment href`);
  assert.equal(await anchor.getAttribute('aria-label'), 'Скопировать ссылку на раздел', `${label}: heading anchor accessibility label drift`);

  const expectedUrl = await page.evaluate((fragment) => new URL(fragment, window.location.href).toString(), href);
  // Hover first: the heading hover rule (h2:hover .heading-anchor) runs a 0.2s transform/opacity
  // transition, which moves the icon under a pointer that was sampled before hover (WebKit, 390 px).
  // Then wait for finite time-based motion (reveal, hover transition) and sample the settled target.
  await anchor.hover();
  await waitForPageMotionToSettle(page, label);
  // Re-align AFTER any hover/scroll-driven animation has settled.
  // WebKit 390px can reposition the heading icon by the time the pointer
  // action runs. The first scroll during candidate selection is not final.
  await anchor.scrollIntoViewIfNeeded({ timeout: 4000 });
  await page.evaluate(() => new Promise(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const hitTestBeforeClick = await anchor.evaluate(async (node) => {
    const describe = (target) => {
      if (!(target instanceof Element)) {
        return {
          nodeName: target?.nodeName || '',
          nodeType: target?.nodeType || null,
        };
      }
      return {
        tag: target.tagName,
        id: target.id || '',
        className: typeof target.className === 'string' ? target.className : (target.className?.baseVal || ''),
        closestAnchorHref: target.closest('.heading-anchor')?.getAttribute('href') || '',
      };
    };
    const sample = () => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        center: { x, y },
        pointerEvents: getComputedStyle(node).pointerEvents,
        opacity: getComputedStyle(node).opacity,
        hit: describe(hit),
        ownedHit: hit instanceof Element
          && hit.closest('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]') === node,
      };
    };
    const stable = (left, right) => left && right
      && Math.abs(left.rect.x - right.rect.x) <= 0.25
      && Math.abs(left.rect.y - right.rect.y) <= 0.25
      && Math.abs(left.rect.width - right.rect.width) <= 0.25
      && Math.abs(left.rect.height - right.rect.height) <= 0.25;

    let previous = null;
    let stableFrames = 0;
    for (let frame = 0; frame < 120; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const next = sample();
      stableFrames = stable(previous, next) && next.ownedHit ? stableFrames + 1 : 0;
      previous = next;
      if (stableFrames >= 3) return { ...next, stableFrames };
    }
    return { ...sample(), stableFrames };
  });
  assert.equal(hitTestBeforeClick.ownedHit, true, `${label}: heading-anchor center is not a stable native hit target; ${JSON.stringify(hitTestBeforeClick)}`);
  assert.ok(hitTestBeforeClick.stableFrames >= 3, `${label}: heading-anchor geometry did not settle before pointer activation; ${JSON.stringify(hitTestBeforeClick)}`);
  await page.evaluate(() => {
    window.__gbAnchorFeedbackSeen = false;
    const markFeedback = () => {
      const toast = document.getElementById('anchor-copy-toast');
      if (toast?.classList.contains('is-visible')) window.__gbAnchorFeedbackSeen = true;
    };
    markFeedback();
    const observer = new MutationObserver(markFeedback);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    window.__gbAnchorFeedbackObserver = observer;

    const describeTarget = (target) => {
      if (!(target instanceof Element)) {
        return {
          nodeName: target?.nodeName || '',
          nodeType: target?.nodeType || null,
        };
      }
      return {
        tag: target.tagName,
        id: target.id || '',
        className: typeof target.className === 'string' ? target.className : (target.className?.baseVal || ''),
        closestAnchorHref: target.closest('.heading-anchor')?.getAttribute('href') || '',
        closestOwnedAnchorHref: target.closest('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]')?.getAttribute('href') || '',
      };
    };
    // Earlier document-capture owners can synchronously replace the anchor SVG after handling
    // the click. event.target may then be detached; composedPath() preserves the dispatch path.
    const matchesAnchor = (event) => event.composedPath().some((target) => target instanceof Element
      && target.matches('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]'));
    window.__gbAnchorClickTrace = {
      windowCapture: 0,
      documentCapture: 0,
      documentBubble: 0,
      windowDefaultPrevented: null,
      documentCaptureDefaultPrevented: null,
      documentBubbleDefaultPrevented: null,
      windowTarget: null,
      windowPath: [],
    };
    const windowCapture = (event) => {
      window.__gbAnchorClickTrace.windowCapture += 1;
      window.__gbAnchorClickTrace.windowDefaultPrevented = event.defaultPrevented;
      window.__gbAnchorClickTrace.windowTarget = describeTarget(event.target);
      window.__gbAnchorClickTrace.windowPath = event.composedPath().slice(0, 8).map(describeTarget);
    };
    const capture = (event) => {
      if (!matchesAnchor(event)) return;
      window.__gbAnchorClickTrace.documentCapture += 1;
      window.__gbAnchorClickTrace.documentCaptureDefaultPrevented = event.defaultPrevented;
    };
    const bubble = (event) => {
      if (!matchesAnchor(event)) return;
      window.__gbAnchorClickTrace.documentBubble += 1;
      window.__gbAnchorClickTrace.documentBubbleDefaultPrevented = event.defaultPrevented;
    };
    window.addEventListener('click', windowCapture, true);
    document.addEventListener('click', capture, true);
    document.addEventListener('click', bubble);
    window.__gbAnchorWindowProbe = windowCapture;
    window.__gbAnchorCaptureProbe = capture;
    window.__gbAnchorBubbleProbe = bubble;
  });
  // Do not dispatch at a cached point: WebKit can finish a page/toolbar transition between
  // the geometry probe and the mouse action. A locator click rechecks visibility, stability and
  // the actual hit target immediately before dispatch, while still producing a real pointer click.
  await anchor.click({ timeout: 5000 });
  const activationTrace = await page.evaluate(() => window.__gbAnchorClickTrace);
  assert.equal(
    activationTrace?.documentCapture,
    1,
    `${label}: pointer activation did not reach the owned heading-anchor handler: ${JSON.stringify(activationTrace)}`,
  );
  assert.equal(
    activationTrace?.windowTarget?.closestOwnedAnchorHref,
    href,
    `${label}: pointer activation landed on a different target: ${JSON.stringify(activationTrace)}`,
  );
  try {
    await page.waitForFunction(
      () => document.getElementById('anchor-copy-toast')?.classList.contains('is-visible') === true
        || window.__gbAnchorFeedbackSeen === true,
      null,
      { timeout: 5000 },
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const toast = document.getElementById('anchor-copy-toast');
      const owned = document.querySelector('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
      const snapshot = {
        trace: window.__gbAnchorClickTrace || null,
        toastExists: Boolean(toast),
        toastConnected: toast?.isConnected === true,
        toastClass: toast?.className || '',
        toastText: toast?.textContent || '',
        hash: window.location.hash,
        anchorConnected: owned?.isConnected === true,
        anchorCopied: owned?.classList.contains('copied') === true,
        anchorHref: owned?.getAttribute('href') || '',
        anchorsReady: document.documentElement.dataset.gbHeadingAnchorsReady || '',
        interactionVersion: window.GBArticleInteractions?.version || null,
        headingAnchors: window.GBArticleInteractions?.headingAnchors || null,
      };
      window.__gbAnchorFeedbackObserver?.disconnect();
      if (window.__gbAnchorWindowProbe) window.removeEventListener('click', window.__gbAnchorWindowProbe, true);
      if (window.__gbAnchorCaptureProbe) document.removeEventListener('click', window.__gbAnchorCaptureProbe, true);
      if (window.__gbAnchorBubbleProbe) document.removeEventListener('click', window.__gbAnchorBubbleProbe);
      return snapshot;
    });
    throw new Error(`${label}: heading-anchor feedback timeout: ${JSON.stringify({ hitTestBeforeClick, diagnostics })}; ${String(error?.message || error)}`);
  }

  const feedback = await page.evaluate(() => {
    const toast = document.getElementById('anchor-copy-toast');
    const toastSeen = toast?.classList.contains('is-visible') === true || window.__gbAnchorFeedbackSeen === true;
    window.__gbAnchorFeedbackObserver?.disconnect();
    delete window.__gbAnchorFeedbackObserver;
    if (window.__gbAnchorWindowProbe) window.removeEventListener('click', window.__gbAnchorWindowProbe, true);
    if (window.__gbAnchorCaptureProbe) document.removeEventListener('click', window.__gbAnchorCaptureProbe, true);
    if (window.__gbAnchorBubbleProbe) document.removeEventListener('click', window.__gbAnchorBubbleProbe);
    delete window.__gbAnchorWindowProbe;
    delete window.__gbAnchorCaptureProbe;
    delete window.__gbAnchorBubbleProbe;
    return {
      toastSeen,
      toastConnected: toast?.isConnected === true,
      hash: window.location.hash,
    };
  });
  assert.equal(feedback.toastSeen, true, `${label}: heading-anchor activation produced no user feedback`);

  const clipboard = await page.evaluate(async () => {
    try {
      if (!navigator.clipboard?.readText) return { readable: false, value: '', error: 'readText unavailable' };
      return { readable: true, value: await navigator.clipboard.readText(), error: '' };
    } catch (error) {
      return { readable: false, value: '', error: String(error?.message || error) };
    }
  });

  if (clipboard.readable) {
    assert.equal(clipboard.value, expectedUrl, `${label}: heading-anchor clipboard value drift`);
  } else {
    assert.equal(feedback.hash, href, `${label}: clipboard was unreadable and hash fallback did not activate (${clipboard.error})`);
  }
}

async function exerciseStrategicMap(page, label) {
  const trigger = page.locator('.map-trigger[data-gb-strategic-map-owner="native-v1"]').first();
  await trigger.waitFor({ state: 'visible' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const popover = page.locator('#gb-strategic-map-popover');
  await popover.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const trigger = document.querySelector('.map-trigger[data-gb-strategic-map-owner="native-v1"]');
    return trigger?.getAttribute('aria-expanded') === 'true';
  });
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true', `${label}: strategic map did not expose expanded state`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const popover = document.getElementById('gb-strategic-map-popover');
    const trigger = document.querySelector('.map-trigger[data-gb-strategic-map-owner="native-v1"]');
    return popover?.hidden === true
      && trigger?.getAttribute('aria-expanded') === 'false'
      && document.activeElement === trigger;
  });
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', `${label}: strategic map Escape did not collapse trigger`);
  assert.equal(await trigger.evaluate((node) => document.activeElement === node), true, `${label}: strategic map Escape did not restore focus`);
}

async function exerciseReversibleCard(page, label) {
  const card = page.locator('.heart-flip-card[data-gb-reversible-card-owner="native-v1"]').first();
  await card.waitFor({ state: 'visible' });
  await card.focus();
  const selector = '.heart-flip-card[data-gb-reversible-card-owner="native-v1"]';
  const before = await card.evaluate((node) => node.classList.contains('flipped'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(({ selector, before }) => {
    const card = document.querySelector(selector);
    if (!card) return false;
    const flipped = card.classList.contains('flipped');
    return flipped !== before && card.getAttribute('aria-expanded') === String(flipped);
  }, { selector, before });
  const afterEnter = await card.evaluate((node) => node.classList.contains('flipped'));
  assert.notEqual(afterEnter, before, `${label}: reversible card Enter did not toggle exactly once`);
  assert.equal(await card.getAttribute('aria-expanded'), String(afterEnter), `${label}: reversible card aria-expanded drift after Enter`);
  await page.keyboard.press('Space');
  await page.waitForFunction(({ selector, expected }) => {
    const card = document.querySelector(selector);
    if (!card) return false;
    const flipped = card.classList.contains('flipped');
    return flipped === expected && card.getAttribute('aria-expanded') === String(flipped);
  }, { selector, expected: before });
  const afterSpace = await card.evaluate((node) => node.classList.contains('flipped'));
  assert.equal(afterSpace, before, `${label}: reversible card Space did not restore state`);
  assert.equal(await card.getAttribute('aria-expanded'), String(afterSpace), `${label}: reversible card aria-expanded drift after Space`);
}

async function runCase(browser, browserName, baseUrl, route, viewport, { clipboardMode = 'normal' } = {}) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript((mode) => {
    let clipboardValue = '';
    const clipboard = {
      writeText: mode === 'hang'
        ? async () => new Promise(() => {})
        : async (value) => { clipboardValue = String(value); },
      readText: mode === 'hang'
        ? async () => { throw new Error('clipboard read disabled for hanging-write regression'); }
        : async () => clipboardValue,
    };
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => clipboard,
    });
  }, clipboardMode);
  const page = await context.newPage();
  // Hermetic run: only the local contract server is reachable. Third-party analytics and embeds
  // (e.g. mc.yandex.ru) can stall 'networkidle' on shared runners; they are not part of this contract.
  await page.route((url) => !url.toString().startsWith(baseUrl), (route) => route.abort('blockedbyclient'));
  const pageErrors = [];
  const legacyRequests = [];
  page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
  page.on('request', (request) => {
    if (/\/js\/(?:enhancements|site)\.js(?:\?|$)/.test(request.url())) legacyRequests.push(request.url());
  });

  const label = `${browserName} ${route.path} ${viewport.width}${clipboardMode === 'normal' ? '' : ` clipboard=${clipboardMode}`}`;
  try {
    const response = await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
    assert.ok(response?.ok(), `${label}: route did not load`);
    await page.waitForFunction(() => document.documentElement.dataset.gbArticleInteractionsReady === '1');

    const baseline = await page.evaluate(() => ({
      version: window.GBArticleInteractions?.version,
      strategicMap: window.GBArticleInteractions?.strategicMap,
      faq: window.GBArticleInteractions?.faq,
      headingAnchors: window.GBArticleInteractions?.headingAnchors,
      reversibleCards: window.GBArticleInteractions?.reversibleCards,
      legacyScriptNodes: [...document.scripts].map((node) => node.src).filter((src) => /\/js\/(?:enhancements|site)\.js(?:\?|$)/.test(src)),
    }));

    assert.equal(baseline.version, 3, `${label}: article capability composer version mismatch`);
    assert.equal(baseline.faq?.enabled, true, `${label}: FAQ owner not enabled`);
    assert.ok((baseline.headingAnchors?.anchors || 0) > 0, `${label}: heading-anchor owner has zero retained targets`);
    assert.deepEqual(baseline.legacyScriptNodes, [], `${label}: legacy enhancements/site transport restored`);
    assert.deepEqual(legacyRequests, [], `${label}: browser requested legacy enhancements/site transport`);

    if (route.id === 'antisovetov') {
      assert.equal(baseline.strategicMap?.enabled, true, `${label}: strategic-map owner not enabled`);
      assert.equal(baseline.strategicMap?.unresolved, 0, `${label}: strategic-map data has unresolved triggers`);
      const counts = await page.evaluate(() => ({
        all: document.querySelectorAll('.map-trigger[data-tip]').length,
        owned: document.querySelectorAll('.map-trigger[data-gb-strategic-map-owner="native-v1"]').length,
      }));
      assert.ok(counts.all > 0, `${label}: no strategic-map triggers found`);
      assert.equal(counts.owned, counts.all, `${label}: strategic-map ownership cardinality mismatch`);
      await exerciseStrategicMap(page, label);
    }

    if (route.id === 'krajne') {
      assert.equal(baseline.reversibleCards?.enabled, true, `${label}: reversible-card owner not enabled`);
      assert.ok((baseline.reversibleCards?.cards || 0) > 0, `${label}: reversible-card owner has zero targets`);
      await exerciseReversibleCard(page, label);
    }

    await exerciseFaq(page, label);
    await exerciseHeadingAnchor(page, label);
    assert.deepEqual(pageErrors, [], `${label}: uncaught page errors`);

    return { browser: browserName, route: route.path, viewport, clipboardMode, baseline, legacyRequests, pageErrors };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  assert.ok(fs.existsSync(DIST), 'dist missing; build production-like output first');
  const server = await startServer();
  const results = [], faqResults = [];
  try {
    for (const browserName of browserNames) {
      const browserType = BROWSERS[browserName];
      assert.ok(browserType, `unsupported browser: ${browserName}`);
      const browser = await browserType.launch({ headless: true });
      try {
        for (const viewport of viewports) {
          for (const route of faqRoutes) for (const mode of ['no-js', 'bundle-blocked', 'normal']) {
            faqResults.push(await exerciseFaqProgressive(browser, browserName, server.baseUrl, route, viewport, mode));
          }
          if (!faqOnly) for (const route of routes) results.push(await runCase(browser, browserName, server.baseUrl, route, viewport));
        }
        if (!faqOnly && browserName === 'chromium') {
          results.push(await runCase(
            browser,
            browserName,
            server.baseUrl,
            routes[0],
            viewports[0],
            { clipboardMode: 'hang' },
          ));
        }
      } finally {
        await browser.close();
      }
    }
  } finally {
    await server.close();
  }

  console.log('Progressive FAQ cases: ' + faqResults.length + ' PASS');
  const report = { schemaVersion: 1, conclusion: 'success', sha: process.env.SOURCE_SHA || '', browsers: browserNames, routes, viewports, results, faqResults };
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Article capability browser contract: PASS (${results.length} cases, including bounded hanging-clipboard fallback)`);
}

// Short failure summary for the GitHub run page. Full raw logs can be truncated by the
// Actions UI when a Playwright call log is very large; this keeps the root cause readable.
function writeStepSummary(error) {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  const lines = String(error?.message || error).split('\n');
  const callLogAt = lines.findIndex((line) => line.startsWith('Call log:'));
  const head = (callLogAt === -1 ? lines : lines.slice(0, callLogAt)).slice(0, 40).join('\n').slice(0, 4000);
  const tail = callLogAt === -1 ? '' : lines.slice(callLogAt, callLogAt + 15).join('\n').slice(0, 2000);
  fs.appendFileSync(target, `### Article capability browser contract failed\n\n\`\`\`\n${head}\n${tail}\n\`\`\`\n`);
}

main().catch((error) => {
  writeStepSummary(error);
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORT_DIR, 'result.json'), `${JSON.stringify({ schemaVersion: 1, conclusion: 'failure', error: String(error?.stack || error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});
