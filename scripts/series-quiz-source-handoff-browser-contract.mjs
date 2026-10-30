#!/usr/bin/env node
/**
 * Series quiz source handoff — permanent native mobile browser contract.
 *
 * Matrix: GBS-GILL-QUIZ-SOURCE-LINK-MOBILE-NOOP. After answering a question
 * in the series learning sheet, the «Перечитать…» source link must deliver the
 * reader to the source fragment: modal closed, body unlocked, URL keeps the
 * page identity + fragment, target inside the viewport and winning centre
 * hit-testing with stable focus.
 *
 * Coverage: first/middle/final Gill pages, the generic SeriesReaderChrome
 * adapter (apostasy), cross-document source → normal navigation, missing-
 * fragment negative fixture (never a silent hash-only success). Native clicks
 * only (no `force`), mobile 390×844 Dark, reduced-motion profile.
 *
 * Self-serves production-like dist/ unless AUDIT_BASE is provided (runner).
 * Chromium: Playwright install or GB_PLAYWRIGHT_CHROMIUM_EXECUTABLE.
 * Precondition: npm run strangler:build:production-like
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './lib/a04-contract.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'reports', 'series-quiz-source-handoff');
fs.mkdirSync(OUT, { recursive: true });

// Known sandbox/egress noise — filtered explicitly by URL, never silently (§7).
const EGRESS_NOISE = ['mc.yandex.ru', 'yandex.ru/metrika', 'googletagmanager.com', 'google-analytics.com', 'doubleclick.net'];

const MOBILE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  reducedMotion: 'reduce',
};

// Gill rail display order (gillSeriesData.ts, guarded by
// gill:series:data:consistency:audit): Введение → I → II → III → IV →
// Справочник. first/middle/final filter the quiz pool by relatedPageId, so
// their sourceHref values always resolve into the SAME document.
const FIRST_PAGE = '/articles/dzhon-gill-istoricheskiy-kontekst/';
const MIDDLE_PAGE = '/articles/dzhon-gill-chast-4-ekzeget/';
const FINAL_PAGE = '/articles/dzhon-gill-spravochnik/';
// Generic SeriesReaderChrome adapter with the apostasy config.
const ADAPTER_PAGE = '/articles/otstuplenie-chto-govorit-bibliya/';
// part2 has <4 related questions → full 32-item pool → natural cross-doc case.
const CROSS_DOC_PAGE = '/articles/dzhon-gill-chast-2-uchenyi/';

const failures = [];
const summary = {
  generatedAt: new Date().toISOString(),
  base: '',
  scenarios: [],
  checks: 0,
};
let currentScenario = null;

function check(name, ok, detail) {
  summary.checks += 1;
  if (ok) {
    console.log(`  ✔ ${name}`);
  } else {
    console.log(`  ✘ ${name}${detail ? ` — ${detail}` : ''}`);
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  }
  return ok;
}

async function scenario(name, fn) {
  console.log(`\n▶ ${name}`);
  const record = { name, ok: false, details: [] };
  summary.scenarios.push(record);
  currentScenario = record;
  try {
    await fn();
    record.ok = record.details.every((d) => d.ok);
    record.details.forEach((d) => check(d.name, d.ok, d.detail));
  } catch (error) {
    record.error = String(error && error.message ? error.message : error);
    console.log(`  ✘ scenario error: ${record.error}`);
    failures.push(`${name}: ${record.error}`);
  } finally {
    currentScenario = null;
  }
}

function rec(name, ok, detail) {
  currentScenario.details.push({ name, ok: Boolean(ok), detail: detail || '' });
  return Boolean(ok);
}

function attachErrorProbe(page, base, label) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push({ kind: 'pageerror', text: String(error), url: '' });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location() || {};
    errors.push({ kind: 'console.error', text: message.text(), url: location.url || '' });
  });
  return () => {
    // Explicit egress-noise policy: blocked third-party resources (metrika et al)
    // are sandbox/egress artifacts — filtered BY URL and labeled, never silent.
    const product = errors.filter((entry) => {
      if (entry.kind === 'pageerror') return true;
      if (EGRESS_NOISE.some((needle) => `${entry.text} ${entry.url}`.includes(needle))) return false;
      if (entry.text.startsWith('Failed to load resource') && entry.url && !entry.url.startsWith(base)) {
        return false; // external resource the sandbox cannot reach
      }
      return true;
    });
    const filtered = errors
      .map((entry) => entry.url || entry.text)
      .filter((_, index) => !product.includes(errors[index]));
    if (filtered.length) console.log(`    (egress noise filtered: ${filtered.join(', ')})`);
    if (product.length) console.log(`    product errors: ${product.map((e) => `${e.text}${e.url ? ` @${e.url}` : ''}`).join(' | ')}`);
    return { product, label };
  };
}

async function openSheetToQuiz(page) {
  const opener = page.locator('#mobLearningBtn');
  await opener.waitFor({ state: 'visible', timeout: 10000 });
  await opener.click();
  const overlay = page.locator('#gillLearningOverlay');
  await page.waitForFunction(
    () => {
      const el = document.getElementById('gillLearningOverlay');
      return Boolean(el && el.classList.contains('is-open') && el.getAttribute('aria-hidden') === 'false');
    },
    undefined,
    { timeout: 10000 },
  );
  await page.locator('#tabQuiz').click();
  await page.locator('.quiz-conf__btn').first().click();
  await page.locator('.quiz-option').first().click();
  const source = page.locator('#glsQuizSource');
  await source.waitFor({ state: 'visible', timeout: 10000 });
}

async function answerNextQuestion(page) {
  await page.locator('#glsQuizNext').click();
  await page.locator('.quiz-conf__btn').first().click();
  await page.locator('.quiz-option').first().click();
  await page.locator('#glsQuizSource').waitFor({ state: 'visible', timeout: 10000 });
}

async function readSource(page) {
  return page.evaluate(() => {
    const source = document.getElementById('glsQuizSource');
    const raw = source ? source.getAttribute('href') || '' : '';
    const resolved = new URL(raw, location.href);
    return {
      raw,
      resolved: resolved.href,
      fragment: decodeURIComponent(resolved.hash.replace(/^#/, '')),
      sameDocument:
        resolved.origin === location.origin &&
        resolved.pathname === location.pathname &&
        resolved.search === location.search,
    };
  });
}

async function assertSheetClosedUnlocked(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('gillLearningOverlay');
    const style = getComputedStyle(document.body);
    return {
      overlayGone: Boolean(
        overlay && !overlay.classList.contains('is-open') && overlay.getAttribute('aria-hidden') === 'true',
      ),
      bodyUnlocked: document.body.style.overflow !== 'hidden' && style.overflow !== 'hidden' && style.overflowY !== 'hidden',
    };
  });
}

async function assertLanding(page, expected) {
  return page.evaluate((exp) => {
    const target = document.getElementById(exp.fragment);
    if (!target) return { targetExists: false };
    const rect = target.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const inViewport = rect.height > 0 && rect.top >= -1 && rect.bottom <= vh + 1 && rect.left >= -1 && rect.right <= vw + 1;
    const cx = Math.min(vw - 1, Math.max(0, rect.left + rect.width / 2));
    const cy = Math.min(vh - 1, Math.max(0, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(cx, cy);
    return {
      targetExists: true,
      inViewport,
      hitWins: Boolean(hit && (hit === target || target.contains(hit) || hit.contains(target))),
      focusOnTarget: document.activeElement === target,
      hash: location.hash,
      pathname: location.pathname,
      rectTop: Math.round(rect.top),
      rectBottom: Math.round(rect.bottom),
    };
  }, expected);
}

async function run() {
  const explicitBase = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
  let server = null;
  let base = explicitBase;
  if (!base) {
    if (!fs.existsSync(DIST) || !fs.statSync(DIST).isDirectory()) {
      throw new Error(`dist not found at ${DIST} — run npm run strangler:build:production-like first`);
    }
    ({ server, base } = await serve());
  }
  summary.base = base;
  console.log(`series quiz source handoff contract base: ${base}`);

  const executablePath = process.env.GB_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const pageErrors = [];
  try {
    // ── Same-document landing: first / middle / final Gill + generic adapter ──
    for (const route of [FIRST_PAGE, MIDDLE_PAGE, FINAL_PAGE, ADAPTER_PAGE]) {
      await scenario(`same-document handoff on ${route}`, async () => {
        const context = await browser.newContext(MOBILE);
        const page = await context.newPage();
        const drain = attachErrorProbe(page, base, route);
        try {
          await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await openSheetToQuiz(page);
          const source = await readSource(page);
          rec('source link visible after answer', Boolean(source.raw), source.raw);
          rec('source resolves same-document', source.sameDocument, source.resolved);
          if (!source.sameDocument || !source.fragment) return;

          const before = await page.evaluate(() => ({ hash: location.hash, scrollY: window.scrollY }));
          // Native pointer click, no force.
          await page.locator('#glsQuizSource').click();

          const closed = await assertSheetClosedUnlocked(page);
          rec('modal sheet closed', closed.overlayGone, JSON.stringify(closed));
          rec('body scroll lock released', closed.bodyUnlocked, JSON.stringify(closed));

          const landing = await assertLanding(page, source);
          rec('url keeps page identity + fragment',
            landing.pathname === route && landing.hash === `#${source.fragment}`,
            `pathname=${landing.pathname} hash=${landing.hash} want=#${source.fragment}`);
          rec('target element exists', landing.targetExists, source.fragment);
          rec('target inside viewport', landing.targetExists && landing.inViewport,
            landing.targetExists ? `rect ${landing.rectTop}..${landing.rectBottom} vh=${MOBILE.viewport.height}` : 'no target');
          rec('target wins centre hit-test', landing.targetExists && landing.hitWins);
          rec('focus lands on target (stable identity)', landing.focusOnTarget && landing.targetExists,
            landing.focusOnTarget ? '' : 'activeElement is not the target');
          rec('hash placement occurred for the source', before.hash !== landing.hash || before.scrollY > 0,
            `before=${JSON.stringify(before)} after hash=${landing.hash}`);

          const drained = drain();
          rec('no product console/page errors', drained.product.length === 0,
            drained.product.map((e) => e.text).join(' | '));
          pageErrors.push(...drained.product);
        } finally {
          await context.close();
        }
      });
    }

    // ── Cross-document source → normal navigation ──
    await scenario(`cross-document handoff on ${CROSS_DOC_PAGE}`, async () => {
      const context = await browser.newContext(MOBILE);
      const page = await context.newPage();
      const drain = attachErrorProbe(page, base, CROSS_DOC_PAGE);
      try {
        await page.goto(`${base}${CROSS_DOC_PAGE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await openSheetToQuiz(page);
        let source = await readSource(page);
        // part2's fallback pool is mostly cross-document; bounded question cycle.
        for (let attempt = 0; attempt < 24 && source.sameDocument; attempt += 1) {
          await answerNextQuestion(page);
          source = await readSource(page);
        }
        rec('a cross-document source appeared in the natural pool', source.sameDocument === false, source.resolved);
        if (source.sameDocument) return;

        await page.locator('#glsQuizSource').click();
        await page.waitForFunction(
          (exp) => location.pathname === exp.pathname && location.hash === exp.hash,
          { pathname: new URL(source.resolved).pathname, hash: `#${source.fragment}` },
          { timeout: 15000 },
        );
        await page.waitForFunction(
          (fragment) => {
            const target = document.getElementById(fragment);
            if (!target) return false;
            const rect = target.getBoundingClientRect();
            return rect.height > 0 && rect.top >= -1 && rect.bottom <= window.innerHeight + 1;
          },
          source.fragment,
          { timeout: 15000 },
        );

        const landing = await page.evaluate(() => {
          const overlay = document.getElementById('gillLearningOverlay');
          const style = getComputedStyle(document.body);
          return {
            overlayClosed: Boolean(overlay && overlay.getAttribute('aria-hidden') === 'true'),
            bodyUnlocked: document.body.style.overflow !== 'hidden' && style.overflowY !== 'hidden',
          };
        });
        rec('navigated to the source page identity', page.url().startsWith(`${base}${new URL(source.resolved).pathname}`), page.url());
        rec('fresh page renders sheet closed + body unlocked', landing.overlayClosed && landing.bodyUnlocked, JSON.stringify(landing));

        const drained = drain();
        rec('no product console/page errors', drained.product.length === 0,
          drained.product.map((e) => e.text).join(' | '));
        pageErrors.push(...drained.product);
      } finally {
        await context.close();
      }
    });

    // ── Missing-fragment negative fixture: never a silent hash-only success ──
    await scenario(`missing-fragment negative fixture on ${ADAPTER_PAGE}`, async () => {
      const context = await browser.newContext(MOBILE);
      const page = await context.newPage();
      const drain = attachErrorProbe(page, base, `${ADAPTER_PAGE}#negative`);
      try {
        await page.goto(`${base}${ADAPTER_PAGE}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await openSheetToQuiz(page);
        // Fixture: point the visible source at a fragment that does not exist.
        await page.evaluate(() => {
          document.getElementById('glsQuizSource').href =
            `${location.pathname}#gbs-quiz-source-missing-probe`;
        });
        const before = await page.evaluate(() => ({ hash: location.hash, open: document.getElementById('gillLearningOverlay').classList.contains('is-open') }));
        await page.locator('#glsQuizSource').click();

        const after = await page.evaluate(() => ({
          hash: location.hash,
          open: document.getElementById('gillLearningOverlay').classList.contains('is-open'),
          sourceVisible: !document.getElementById('glsQuizSource').hidden,
        }));
        rec('missing fragment does not fake a hash-only success', after.hash === before.hash,
          `hash ${before.hash} → ${after.hash}`);
        rec('sheet stays open when there is nowhere to land', after.open === true && before.open === true);
        rec('source link stays operable for a retry', after.sourceVisible === true);

        // Recovery: closing must still unlock the reader.
        await page.locator('#gillLearningOverlay [data-overlay-close]').last().click();
        const closed = await assertSheetClosedUnlocked(page);
        rec('manual close still releases the modal + scroll lock', closed.overlayGone && closed.bodyUnlocked, JSON.stringify(closed));

        const drained = drain();
        rec('no product console/page errors', drained.product.length === 0,
          drained.product.map((e) => e.text).join(' | '));
        pageErrors.push(...drained.product);
      } finally {
        await context.close();
      }
    });
  } finally {
    await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  }

  summary.failureCount = failures.length;
  summary.productErrors = pageErrors.length;
  fs.writeFileSync(path.join(OUT, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  if (failures.length) {
    console.error(`\n❌ series quiz source handoff contract failed (${failures.length} of ${summary.checks} checks):`);
    failures.forEach((f) => console.error(`   - ${f}`));
    process.exit(1);
  }
  console.log(`\n✅ series quiz source handoff contract passed (${summary.checks} checks; mobile 390×844 Dark, reduced-motion, native clicks)`);
}

run().catch((error) => {
  console.error('FATAL', error);
  process.exit(1);
});
