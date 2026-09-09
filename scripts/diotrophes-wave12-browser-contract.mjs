#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'reports', 'diotrophes-wave12');
const ROUTE = '/articles/diotrefy-nashego-vremeni/';
const PRECONDITIONING_MAX_PASSES = 5;
const PRECONDITIONING_REQUIRED_STABLE_PASSES = 2;
const PAGE_HEIGHT_EPSILON_PX = 1;
const PRECONDITIONING_STEP_WAIT_MS = 80;
const MOBILE_CHROME_EVIDENCE_PIN_ID = 'wave12-mobile-chrome-evidence-pin';
const EXPECTED_SHARED_READER_LINKS = [
  'https://www.childabuseroyalcommission.gov.au/case-studies/case-study-18-australian-christian-churches',
  'https://www.childabuseroyalcommission.gov.au/media-releases/findings-released-australian-christian-churches-and-affiliated-pentecostal-churches',
  'https://www.churchofengland.org/media/press-releases/concerns-substantiated-mike-pilavachi-investigation',
  'https://www.thejourney.org/about/our-story-new',
].sort();
const STALE_READER_LINKS = [
  'https://www.thejourney.org/our-story',
  'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
];
const CANONICAL_BASE_READER_LINKS = [
  'https://www.thejourney.org/about/our-story-new',
  'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
];
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2' };
const failures = [];
const results = [];
mkdirSync(OUT, { recursive: true });

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  if (!clean || pathname.endsWith('/')) return join(DIST, clean, 'index.html');
  return join(DIST, clean);
}

const server = createServer((req, res) => {
  try {
    let file = routeFile(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control':'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function record(engine, profile, contract, ok, detail = '') {
  results.push({ engine, profile, contract, ok:Boolean(ok), detail:String(detail || '') });
  if (!ok) failures.push(`${engine}/${profile}/${contract}: ${detail}`);
}

async function stabilizeVisualState(page) {
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    if (document.fonts?.ready) await document.fonts.ready;
    for (const image of document.images) {
      image.loading = 'eager';
      image.fetchPriority = 'high';
    }
    await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
  });
  await page.waitForTimeout(100);
}

async function pinMobileChromeForScreenshotEvidence(page) {
  const pin = await page.evaluate((pinId) => {
    const topBar = document.querySelector('.mobile-top-bar[data-gill-mobile-bar]');
    if (!topBar || getComputedStyle(topBar).display === 'none') {
      return { applicable:false, active:true, owner:'none' };
    }

    let sink = document.getElementById(pinId);
    if (!sink) {
      sink = document.createElement('button');
      sink.id = pinId;
      sink.type = 'button';
      sink.tabIndex = -1;
      sink.setAttribute('aria-hidden', 'true');
      sink.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:1px',
        'height:1px',
        'padding:0',
        'margin:0',
        'border:0',
        'outline:0',
        'opacity:0',
        'pointer-events:none',
        'background:transparent',
      ].join(';');
      topBar.appendChild(sink);
    }
    sink.focus({ preventScroll:true });
    return {
      applicable:true,
      active:topBar.contains(document.activeElement),
      owner:'top-bar-focus-containment',
      activeElementId:document.activeElement?.id || '',
    };
  }, MOBILE_CHROME_EVIDENCE_PIN_ID);
  await page.waitForTimeout(100);
  return pin;
}

function readPngDimensions(path) {
  const png = readFileSync(path);
  const signatureOk =
    png.length >= 24 &&
    png[0] === 0x89 &&
    png[1] === 0x50 &&
    png[2] === 0x4e &&
    png[3] === 0x47 &&
    png[4] === 0x0d &&
    png[5] === 0x0a &&
    png[6] === 0x1a &&
    png[7] === 0x0a;
  return {
    signatureOk,
    width: signatureOk ? png.readUInt32BE(16) : 0,
    height: signatureOk ? png.readUInt32BE(20) : 0,
  };
}

async function readScrollGeometry(page) {
  return page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    return {
      scrollTop: Math.round(window.scrollY),
      pageHeight: Math.round(scrollingElement.scrollHeight),
      viewportHeight: Math.round(scrollingElement.clientHeight),
    };
  });
}

async function materializeScrollGeometry(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const initial = await readScrollGeometry(page);
  const heightChanges = [];
  const observedPageHeights = [initial.pageHeight];
  let lastHeight = null;
  let requestedTop = 0;
  let reachedLiveBottom = false;
  let steps = 0;

  for (; steps < 500; steps += 1) {
    const before = await readScrollGeometry(page);
    observedPageHeights.push(before.pageHeight);
    const maxTop = Math.max(0, before.pageHeight - before.viewportHeight);
    const targetTop = Math.min(requestedTop, maxTop);
    await page.evaluate((top) => window.scrollTo(0, top), targetTop);
    await page.waitForTimeout(PRECONDITIONING_STEP_WAIT_MS);
    const after = await readScrollGeometry(page);
    observedPageHeights.push(after.pageHeight);
    if (after.pageHeight !== lastHeight) {
      heightChanges.push({
        step: steps + 1,
        requestedTop: targetTop,
        scrollTop: after.scrollTop,
        pageHeight: after.pageHeight,
      });
      lastHeight = after.pageHeight;
    }
    const layoutBottom = after.scrollTop + after.viewportHeight;
    if (layoutBottom >= after.pageHeight - PAGE_HEIGHT_EPSILON_PX) {
      reachedLiveBottom = true;
      break;
    }
    const nextTop = Math.max(targetTop + before.viewportHeight, layoutBottom);
    if (nextTop <= requestedTop) break;
    requestedTop = nextTop;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  const final = await readScrollGeometry(page);
  observedPageHeights.push(final.pageHeight);
  const minObservedPageHeight = Math.min(...observedPageHeights);
  const maxObservedPageHeight = Math.max(...observedPageHeights);
  const stableDuringPass =
    maxObservedPageHeight - minObservedPageHeight <= PAGE_HEIGHT_EPSILON_PX;

  return {
    complete: reachedLiveBottom && final.scrollTop === 0 && final.pageHeight > 0,
    reachedLiveBottom,
    initialPageHeight: initial.pageHeight,
    finalPageHeight: final.pageHeight,
    viewportHeight: final.viewportHeight,
    steps: steps + 1,
    heightChanges,
    minObservedPageHeight,
    maxObservedPageHeight,
    stableDuringPass,
  };
}

async function convergeScrollGeometry(page) {
  const passes = [];
  let consecutiveStablePasses = 0;
  let previousSettledPageHeight = null;

  for (let passIndex = 1; passIndex <= PRECONDITIONING_MAX_PASSES; passIndex += 1) {
    await stabilizeVisualState(page);
    const pass = await materializeScrollGeometry(page);
    await stabilizeVisualState(page);
    const settled = await readScrollGeometry(page);
    const stableRelativeToPrevious =
      previousSettledPageHeight === null ||
      Math.abs(pass.initialPageHeight - previousSettledPageHeight) <= PAGE_HEIGHT_EPSILON_PX;
    const stableAfterReturn =
      settled.scrollTop === 0 &&
      Math.abs(settled.pageHeight - pass.initialPageHeight) <= PAGE_HEIGHT_EPSILON_PX;
    const stable =
      pass.complete &&
      pass.stableDuringPass &&
      stableRelativeToPrevious &&
      stableAfterReturn;

    consecutiveStablePasses = stable ? consecutiveStablePasses + 1 : 0;
    passes.push({
      pass: passIndex,
      ...pass,
      postStabilizePageHeight: settled.pageHeight,
      postStabilizeScrollTop: settled.scrollTop,
      stableRelativeToPrevious,
      stableAfterReturn,
      stable,
    });
    previousSettledPageHeight = settled.pageHeight;

    if (consecutiveStablePasses >= PRECONDITIONING_REQUIRED_STABLE_PASSES) break;
  }

  const first = passes[0];
  const last = passes.at(-1);
  const converged = consecutiveStablePasses >= PRECONDITIONING_REQUIRED_STABLE_PASSES;

  return {
    complete: converged,
    converged,
    reachedLiveBottom: Boolean(last?.reachedLiveBottom),
    initialPageHeight: first?.initialPageHeight ?? 0,
    finalPageHeight: last?.postStabilizePageHeight ?? 0,
    viewportHeight: last?.viewportHeight ?? 0,
    steps: passes.reduce((sum, pass) => sum + pass.steps, 0),
    heightChanges: passes.flatMap((pass) =>
      pass.heightChanges.map((change) => ({ pass: pass.pass, ...change })),
    ),
    passCount: passes.length,
    requiredStablePasses: PRECONDITIONING_REQUIRED_STABLE_PASSES,
    consecutiveStablePasses,
    maxPasses: PRECONDITIONING_MAX_PASSES,
    passes,
  };
}

async function captureSegmentedScreenshot(page, engine, profile) {
  const mobileChromePin = await pinMobileChromeForScreenshotEvidence(page);
  const preconditioning = await convergeScrollGeometry(page);
  const metrics = await page.evaluate(() => {
    const scrollingElement = document.scrollingElement || document.documentElement;
    return {
      pageHeight: scrollingElement.scrollHeight,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  const maxScreenshotTop = Math.max(0, metrics.pageHeight - metrics.viewportHeight);
  const positions = [];
  for (let requested = 0; requested < metrics.pageHeight; requested += metrics.viewportHeight) {
    const top = Math.min(requested, maxScreenshotTop);
    if (positions.at(-1) !== top) positions.push(top);
    if (top === maxScreenshotTop) break;
  }
  if (!positions.length) positions.push(0);
  if (positions.at(-1) !== maxScreenshotTop) positions.push(maxScreenshotTop);

  const ranges = [];
  const tiles = [];
  const terminalClips = [];
  for (let index = 0; index < positions.length; index += 1) {
    const requestedTop = positions[index];
    await page.evaluate((top) => window.scrollTo(0, top), requestedTop);
    await page.waitForTimeout(80);
    const viewportPosition = await page.evaluate(() => {
      const scrollingElement = document.scrollingElement || document.documentElement;
      const visualViewport = window.visualViewport;
      return {
        layoutScrollTop: Math.round(window.scrollY),
        livePageHeight: Math.round(scrollingElement.scrollHeight),
        layoutViewportHeight: Math.round(scrollingElement.clientHeight),
        innerHeight: Math.round(window.innerHeight),
        visualViewportPageTop: visualViewport ? Math.round(visualViewport.pageTop) : null,
        visualViewportOffsetTop: visualViewport ? Math.round(visualViewport.offsetTop) : null,
        visualViewportHeight: visualViewport ? Math.round(visualViewport.height) : null,
      };
    });
    const actualTop = viewportPosition.visualViewportPageTop ?? viewportPosition.layoutScrollTop;
    const actualTopSource = viewportPosition.visualViewportPageTop === null
      ? 'layout-scroll-top'
      : 'visual-viewport-page-top';
    const tilePath = join(OUT, `${engine}-${profile.id}-tile-${String(index + 1).padStart(3, '0')}.png`);
    await page.screenshot({ path: tilePath, fullPage: false });
    const bytes = statSync(tilePath).size;
    const png = readPngDimensions(tilePath);
    const pngGeometryValid =
      png.signatureOk &&
      png.width === metrics.viewportWidth &&
      png.height === metrics.viewportHeight;
    const pageHeightStable = Math.abs(viewportPosition.livePageHeight - metrics.pageHeight) <= 1;
    const layoutViewportBottom = viewportPosition.layoutScrollTop + viewportPosition.layoutViewportHeight;
    const layoutAtLiveBottom = Math.abs(layoutViewportBottom - viewportPosition.livePageHeight) <= 1;
    const terminalRequested = Math.abs(requestedTop - maxScreenshotTop) <= 1;

    const start = Math.max(0, Math.min(actualTop, metrics.pageHeight));
    const end = Math.max(start, Math.min(start + png.height, metrics.pageHeight));
    ranges.push({ start, end, source:'viewport-tile', index:index + 1 });

    const tile = {
      index: index + 1,
      requestedTop,
      layoutScrollTop: viewportPosition.layoutScrollTop,
      livePageHeight: viewportPosition.livePageHeight,
      layoutViewportHeight: viewportPosition.layoutViewportHeight,
      layoutViewportBottom,
      innerHeight: viewportPosition.innerHeight,
      visualViewportPageTop: viewportPosition.visualViewportPageTop,
      visualViewportOffsetTop: viewportPosition.visualViewportOffsetTop,
      visualViewportHeight: viewportPosition.visualViewportHeight,
      pngWidth: png.width,
      pngHeight: png.height,
      pngGeometryValid,
      pageHeightStable,
      layoutAtLiveBottom,
      terminalRequested,
      actualTop,
      actualTopSource,
      start,
      end,
      bytes,
    };
    tiles.push(tile);

    const terminalTailStart = end;
    const terminalTailEnd = metrics.pageHeight;
    const terminalTailHeight = Math.max(0, terminalTailEnd - terminalTailStart);
    const terminalTailInsideLayoutViewport =
      terminalTailHeight > 0 &&
      terminalTailStart >= viewportPosition.layoutScrollTop - 1 &&
      terminalTailEnd <= layoutViewportBottom + 1;
    const terminalClipEligible =
      terminalRequested &&
      pageHeightStable &&
      pngGeometryValid &&
      layoutAtLiveBottom &&
      Math.abs(layoutViewportBottom - metrics.pageHeight) <= 1 &&
      terminalTailInsideLayoutViewport;

    if (terminalClipEligible) {
      const clipPath = join(OUT, `${engine}-${profile.id}-terminal-tail.png`);
      await page.screenshot({
        path: clipPath,
        clip: {
          x: 0,
          y: terminalTailStart,
          width: metrics.viewportWidth,
          height: terminalTailHeight,
        },
      });
      const clipBytes = statSync(clipPath).size;
      const clipPng = readPngDimensions(clipPath);
      const clipGeometryValid =
        clipPng.signatureOk &&
        clipPng.width === metrics.viewportWidth &&
        clipPng.height === terminalTailHeight;
      const postClipPageHeight = await page.evaluate(() => {
        const scrollingElement = document.scrollingElement || document.documentElement;
        return Math.round(scrollingElement.scrollHeight);
      });
      const clipPageHeightStable = Math.abs(postClipPageHeight - metrics.pageHeight) <= 1;
      const clip = {
        start: terminalTailStart,
        end: terminalTailEnd,
        height: terminalTailHeight,
        bytes: clipBytes,
        pngWidth: clipPng.width,
        pngHeight: clipPng.height,
        pngGeometryValid: clipGeometryValid,
        pageHeightStable: clipPageHeightStable,
        postClipPageHeight,
        layoutViewportBottom,
        source:'page-coordinate-terminal-clip',
      };
      terminalClips.push(clip);
      if (clipGeometryValid && clipPageHeightStable) {
        ranges.push({ start:terminalTailStart, end:terminalTailEnd, source:clip.source, index:terminalClips.length });
      }
    }
  }

  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  const gaps = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < metrics.pageHeight) gaps.push({ start: cursor, end: metrics.pageHeight });
  const gapPixels = gaps.reduce((sum, gap) => sum + Math.max(0, gap.end - gap.start), 0);
  const coveredPixels = Math.max(0, metrics.pageHeight - gapPixels);
  const emptyTiles = tiles.filter((tile) => tile.bytes < 1000);
  const pngGeometryValid = tiles.every((tile) => tile.pngGeometryValid);
  const pageHeightStable =
    tiles.every((tile) => tile.pageHeightStable) &&
    terminalClips.every((clip) => clip.pageHeightStable);
  const terminalClipGeometryValid = terminalClips.every((clip) => clip.pngGeometryValid);
  const terminalTile = tiles.at(-1);
  const terminalViewportCoversBottom =
    Boolean(terminalTile) &&
    terminalTile.end >= metrics.pageHeight - 1;
  const terminalClipCoversBottom = terminalClips.some((clip) =>
    clip.pngGeometryValid &&
    clip.pageHeightStable &&
    clip.end >= metrics.pageHeight - 1,
  );
  const terminalScreenshotReachable = terminalViewportCoversBottom || terminalClipCoversBottom;
  const complete =
    mobileChromePin.active &&
    preconditioning.complete &&
    metrics.pageHeight > 0 &&
    pngGeometryValid &&
    terminalClipGeometryValid &&
    pageHeightStable &&
    terminalScreenshotReachable &&
    gaps.length === 0 &&
    emptyTiles.length === 0 &&
    coveredPixels === metrics.pageHeight;

  return {
    complete,
    mobileChromePin,
    preconditioning,
    pageHeight: metrics.pageHeight,
    viewportHeight: metrics.viewportHeight,
    viewportWidth: metrics.viewportWidth,
    maxScreenshotTop,
    pngGeometryValid,
    terminalClipGeometryValid,
    pageHeightStable,
    terminalScreenshotReachable,
    terminalViewportCoversBottom,
    terminalClipCoversBottom,
    coveredPixels,
    gaps,
    emptyTiles: emptyTiles.map((tile) => tile.index),
    tileCount: tiles.length,
    terminalClips,
    totalPngBytes:
      tiles.reduce((sum, tile) => sum + tile.bytes, 0) +
      terminalClips.reduce((sum, clip) => sum + clip.bytes, 0),
    tiles,
  };
}

async function inspect(browserType, engine, profile) {
  const browser = await browserType.launch();
  try {
    for (const javaScriptEnabled of [true, false]) {
      const mode = javaScriptEnabled ? 'js' : 'no-js';
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        isMobile: profile.mobile,
        hasTouch: profile.mobile,
        javaScriptEnabled,
        colorScheme: 'light',
      });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (message) => {
        const text = message.text();
        const knownWebKitViewportWarning = engine === 'webkit' && text === 'Viewport argument key "interactive-widget" not recognized and ignored.';
        if (
          message.type() === 'error' &&
          !knownWebKitViewportWarning &&
          !/mc\.yandex|ERR_BLOCKED_BY_CLIENT|Failed to load resource|Load failed/i.test(text)
        ) consoleErrors.push(text);
      });
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.route(/mc\.yandex|gospod-bog\.ru/, (request) => request.abort());
      const response = await page.goto(base + ROUTE, { waitUntil: javaScriptEnabled ? 'networkidle' : 'domcontentloaded' });
      record(engine, `${profile.id}-${mode}`, 'http-200', response?.status() === 200, `status=${response?.status()}`);
      const state = await page.evaluate(({ staleReaderLinks, canonicalBaseReaderLinks }) => {
        const bodyText = document.body.innerText;
        const baseLinks = [...document.querySelectorAll('#sources a[href^="https://"]')].map((node) => node.href);
        const supplementLinks = [...document.querySelectorAll('#faithful-witness-sources a[href^="https://"]')].map((node) => node.href);
        const allReaderLinks = [...baseLinks, ...supplementLinks];
        const linkCounts = new Map();
        for (const href of allReaderLinks) linkCounts.set(href, (linkCounts.get(href) || 0) + 1);
        const duplicateReaderLinks = [...linkCounts.entries()]
          .filter(([, count]) => count > 1)
          .map(([href]) => href)
          .sort();
        const viewportWidth = document.documentElement.clientWidth;
        const overflowOwners = [...document.querySelectorAll('body *')]
          .map((node) => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            const rightOverflow = Math.max(0, rect.right - viewportWidth);
            const leftOverflow = Math.max(0, -rect.left);
            const internalOverflow = Math.max(0, node.scrollWidth - node.clientWidth);
            return {
              tag: node.tagName.toLowerCase(),
              id: node.id || '',
              classes: String(node.className || '').slice(0, 180),
              text: (node.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
              rect: {
                left: Math.round(rect.left * 10) / 10,
                right: Math.round(rect.right * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
              },
              clientWidth: node.clientWidth,
              scrollWidth: node.scrollWidth,
              rightOverflow: Math.round(rightOverflow * 10) / 10,
              leftOverflow: Math.round(leftOverflow * 10) / 10,
              internalOverflow,
              position: style.position,
              display: style.display,
              transform: style.transform,
              width: style.width,
              minWidth: style.minWidth,
              maxWidth: style.maxWidth,
              overflowX: style.overflowX,
            };
          })
          .filter((row) => row.rightOverflow > 1 || row.leftOverflow > 1 || row.internalOverflow > 1)
          .sort((left, right) => {
            const leftScore = Math.max(left.rightOverflow, left.leftOverflow, left.internalOverflow);
            const rightScore = Math.max(right.rightOverflow, right.leftOverflow, right.internalOverflow);
            return rightScore - leftScore;
          })
          .slice(0, 12);
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim() || '',
          mainCount: document.querySelectorAll('main').length,
          articleCount: document.querySelectorAll('article.article-body').length,
          publicationMarker: document.body.dataset.wave12Publication,
          sourceAuthority: document.querySelector('[data-source-authority]')?.getAttribute('data-source-authority'),
          readerLinkSections: {
            base: baseLinks.length,
            supplement: supplementLinks.length,
            total: allReaderLinks.length,
          },
          readerLinks: new Set(allReaderLinks).size,
          duplicateReaderLinks,
          staleReaderLinksPresent: staleReaderLinks.filter((href) => allReaderLinks.includes(href)),
          canonicalBaseReaderLinkCounts: Object.fromEntries(
            canonicalBaseReaderLinks.map((href) => [href, baseLinks.filter((candidate) => candidate === href).length]),
          ),
          hasFaithful: Boolean(document.querySelector('#faithful-witness-under-pressure')),
          hasResponses: Boolean(document.querySelector('#twenty-faithful-responses')),
          draftLeak: /PUBLICATION_HOLD|ещё не зарегистрирован как публичный маршрут/.test(bodyText),
          horizontalOverflow: document.documentElement.scrollWidth - viewportWidth,
          overflowOwners,
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          robots: document.querySelector('meta[name="robots"]')?.content || '',
        };
      }, { staleReaderLinks: STALE_READER_LINKS, canonicalBaseReaderLinks: CANONICAL_BASE_READER_LINKS });
      record(engine, `${profile.id}-${mode}`, 'single-main', state.mainCount === 1, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'single-article', state.articleCount === 1, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'title-h1', state.h1 === 'Диотрефы нашего времени' && state.title.includes('Диотрефы нашего времени'), JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'publication-marker', state.publicationMarker === 'true', JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'authority-marker', state.sourceAuthority === '148', JSON.stringify(state));
      record(
        engine,
        `${profile.id}-${mode}`,
        'reader-link-sections',
        state.readerLinkSections.base === 40 && state.readerLinkSections.supplement === 33 && state.readerLinkSections.total === 73,
        JSON.stringify(state.readerLinkSections),
      );
      record(engine, `${profile.id}-${mode}`, 'reader-link-uniqueness', state.readerLinks === 69, `unique=${state.readerLinks}`);
      record(
        engine,
        `${profile.id}-${mode}`,
        'reader-link-overlap-receipt',
        JSON.stringify(state.duplicateReaderLinks) === JSON.stringify(EXPECTED_SHARED_READER_LINKS),
        JSON.stringify(state.duplicateReaderLinks),
      );
      record(
        engine,
        `${profile.id}-${mode}`,
        'reader-link-migration-receipt',
        state.staleReaderLinksPresent.length === 0 &&
          CANONICAL_BASE_READER_LINKS.every((href) => state.canonicalBaseReaderLinkCounts[href] === 1),
        JSON.stringify({
          stale: state.staleReaderLinksPresent,
          canonicalBaseCounts: state.canonicalBaseReaderLinkCounts,
        }),
      );
      record(engine, `${profile.id}-${mode}`, 'faithful-sections', state.hasFaithful && state.hasResponses, JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'no-draft-leak', !state.draftLeak, JSON.stringify(state));
      record(
        engine,
        `${profile.id}-${mode}`,
        'no-horizontal-overflow',
        state.horizontalOverflow <= 1,
        JSON.stringify({ overflow: state.horizontalOverflow, owners: state.overflowOwners }),
      );
      record(engine, `${profile.id}-${mode}`, 'canonical-index', state.canonical.endsWith(ROUTE) && /index/.test(state.robots), JSON.stringify(state));
      record(engine, `${profile.id}-${mode}`, 'console-clean', consoleErrors.length === 0, consoleErrors.join(' | '));
      record(engine, `${profile.id}-${mode}`, 'page-clean', pageErrors.length === 0, pageErrors.join(' | '));
      if (javaScriptEnabled) {
        const screenshotCoverage = await captureSegmentedScreenshot(page, engine, profile);
        record(engine, `${profile.id}-${mode}`, 'screenshot-coverage', screenshotCoverage.complete, JSON.stringify(screenshotCoverage));
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  await inspect(chromium, 'chromium', { id:'android-390', width:390, height:844, mobile:true });
  await inspect(chromium, 'chromium', { id:'desktop-1440', width:1440, height:900, mobile:false });
  await inspect(webkit, 'webkit', { id:'iphone-390', width:390, height:844, mobile:true });
  await inspect(webkit, 'webkit', { id:'desktop-1440', width:1440, height:900, mobile:false });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width:1240, height:900 } });
    await page.route(/mc\.yandex|gospod-bog\.ru/, (request) => request.abort());
    await page.goto(base + ROUTE, { waitUntil:'networkidle' });
    await page.emulateMedia({ media:'print' });
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
      for (const image of document.images) { image.loading = 'eager'; image.fetchPriority = 'high'; }
      await Promise.all([...document.images].map((image) => image.decode?.().catch(() => {})));
    });
    const pdfPath = join(OUT, 'diotrophes-wave12.pdf');
    await page.pdf({ path:pdfPath, format:'A4', printBackground:true, margin:{ top:'12mm', right:'10mm', bottom:'12mm', left:'10mm' } });
    const bytes = statSync(pdfPath).size;
    record('chromium', 'print-a4', 'pdf-size', bytes > 150_000, `bytes=${bytes}`);
    if (existsSync('/usr/bin/pdfinfo') && existsSync('/usr/bin/pdftotext')) {
      const info = execFileSync('/usr/bin/pdfinfo', [pdfPath], { encoding:'utf8' });
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1] || 0);
      const textPath = join(OUT, 'diotrophes-wave12.txt');
      execFileSync('/usr/bin/pdftotext', [pdfPath, textPath]);
      const pdfText = readFileSync(textPath, 'utf8');
      record('chromium', 'print-a4', 'page-count', pages >= 8 && pages <= 120, `pages=${pages}`);
      record('chromium', 'print-a4', 'first-and-last-content', pdfText.includes('Диотрефы нашего времени') && pdfText.includes('Практическая лестница различения'), `pages=${pages}`);
    } else {
      record('chromium', 'print-a4', 'poppler-present', false, 'pdfinfo/pdftotext missing');
    }
  } finally {
    await browser.close();
  }
} finally {
  server.close();
}

writeFileSync(join(OUT, 'browser-contract.json'), JSON.stringify({ route:ROUTE, results, failures }, null, 2));
if (failures.length) {
  console.error(`❌ Wave 12 browser contract failed (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✅ Wave 12 browser contract passed (${results.length} checks)`);