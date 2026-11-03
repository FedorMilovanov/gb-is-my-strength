#!/usr/bin/env node
/**
 * GBS-CHROME-LABEL-IN-NAME-MISMATCH — permanent native focus-traversal contract.
 *
 * The class-level source guard in scripts/interactive-audit.js covers static
 * markup, but the remaining findings of the narrowed row were RUNTIME families:
 * JS-injected chrome (the docked Highlights FAB badge) and hydrated labels only
 * appear after the page settles. This contract performs the row's closure
 * method as a permanent guard: a native full-focus traversal with WCAG 2.5.3
 * per-run name matching on wide Home, desktop/mobile app surfaces and both
 * schemes, plus the article and Nagornaya surfaces that own the FAB/TTS speed
 * families. The wave proof additionally ran settled axe
 * `label-content-name-mismatch` on the same surfaces (0 violations); the
 * native traversal is the stricter of the two — it is the check that caught
 * the FAB badge, which axe did not flag — so the permanent guard keeps the
 * native method and needs no extra runtime dependency.
 *
 * Self-serves production-like dist/ unless AUDIT_BASE is provided (runner).
 * Chromium only; webkit stays in CI (sandbox egress policy).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { serve } from './lib/a04-contract.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const explicitBase = process.env.AUDIT_BASE || '';
// Known sandbox/egress noise — filtered explicitly by URL, never silently (§7).
const EGRESS_NOISE = ['mc.yandex.ru', 'yandex.ru/metrika', 'googletagmanager.com', 'google-analytics.com', 'doubleclick.net'];

// Wide Home + desktop/mobile app surfaces in both schemes (row closure),
// plus the article + Nagornaya surfaces that own the FAB and TTS families.
const SURFACES = [
  { id: 'home-1600-light', url: '/', width: 1600, height: 1000, scheme: 'light' },
  { id: 'home-1600-dark', url: '/', width: 1600, height: 1000, scheme: 'dark' },
  { id: 'app-desktop-light', url: '/app/', width: 1440, height: 900, scheme: 'light' },
  { id: 'app-desktop-dark', url: '/app/', width: 1440, height: 900, scheme: 'dark' },
  { id: 'app-mobile-light', url: '/app/', width: 390, height: 844, scheme: 'light', mobile: true },
  { id: 'app-mobile-dark', url: '/app/', width: 390, height: 844, scheme: 'dark', mobile: true },
  { id: 'article-mobile-light', url: '/articles/dzhon-gill-chast-1-chelovek/', width: 390, height: 844, scheme: 'light', mobile: true },
  { id: 'nagornaya-desktop-light', url: '/nagornaya/chast-1/', width: 1440, height: 900, scheme: 'light' },
  { id: 'nagornaya-mobile-dark', url: '/nagornaya/chast-1/', width: 390, height: 844, scheme: 'dark', mobile: true },
];

const TAB_TRAVERSAL = () => {
  const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // Accessible name per spec: aria-labelledby > aria-label > text content.
  const accName = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' ').trim();
      if (t) return t;
    }
    const al = el.getAttribute('aria-label');
    if (al) return al.trim();
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const hiddenRun = (node, root) => {
    let cur = node;
    while (cur && cur !== root) {
      if (cur.nodeType === 1 && cur.getAttribute?.('aria-hidden') === 'true') return true;
      cur = cur.parentNode;
    }
    return false;
  };
  const problems = [];
  const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(visible);
  for (const el of focusables) {
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) continue;
    const explicit = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
    // No explicit name → the accessible name IS the text content → matches by construction.
    if (!explicit) continue;
    // Scroll-region pattern: aria-label names the region, inner text is content.
    if (el.getAttribute('role') === 'region') continue;
    if (el.tagName === 'DIV' && el.getAttribute('tabindex') && el.getAttribute('aria-label')) continue;
    const name = accName(el);
    const runs = [...el.childNodes]
      .filter((n) => n.nodeType === 3 || n.nodeType === 1) // text or elements — never comments
      .filter((n) => !hiddenRun(n, el))
      .map((n) => (n.nodeType === 3 ? n.textContent : n.innerText || n.textContent || ''))
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0);
    if (!runs.length) continue;
    const missing = runs.filter((run) => !norm(name).includes(norm(run)));
    if (missing.length) {
      problems.push({
        el: `${el.tagName.toLowerCase()}#${el.id || ''}.${String(el.className || '').split(/\s+/)[0] || ''}`,
        name: name.slice(0, 80),
        missing: missing.map((m) => m.slice(0, 40)),
      });
    }
  }
  return problems;
};

const failures = [];
const summary = [];
let own = null;
let base = explicitBase;
if (!base) {
  own = await serve();
  base = own.base;
}

const browser = await chromium.launch({ headless: true });
try {
  for (const surface of SURFACES) {
    const context = await browser.newContext({
      viewport: { width: surface.width, height: surface.height },
      colorScheme: surface.scheme,
      isMobile: Boolean(surface.mobile),
      hasTouch: Boolean(surface.mobile),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 160)));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const location = message.location() || {};
      const text = `${message.text()} ${location.url || ''}`;
      if (EGRESS_NOISE.some((needle) => text.includes(needle))) return;
      if (message.text().startsWith('Failed to load resource') && location.url && !location.url.startsWith(base)) return;
      pageErrors.push(message.text().slice(0, 160));
    });
    // CI runs with real egress: analytics keep the connection busy, so
    // `networkidle` never settles there (measured TimeoutError on /).
    // Settle deterministically instead: load + fonts + a fixed quiet window.
    await page.goto(base + surface.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())).catch(() => {});
    await page.waitForTimeout(800);
    const tabProblems = await page.evaluate(TAB_TRAVERSAL);
    await context.close();
    const entry = { id: surface.id, tab: tabProblems.length, pageErrors: pageErrors.length };
    summary.push(entry);
    if (tabProblems.length) failures.push(`${surface.id}: focus traversal ${JSON.stringify(tabProblems.slice(0, 5))}`);
    if (pageErrors.length) failures.push(`${surface.id}: product console/page errors ${JSON.stringify(pageErrors.slice(0, 3))}`);
    console.log(`${tabProblems.length || pageErrors.length ? '✖' : '✔'} ${surface.id}: tab=${tabProblems.length} errors=${pageErrors.length}`);
  }
} finally {
  await browser.close();
  if (own) await own.server.close();
}

const reportPath = path.join(ROOT, 'reports', 'chrome-label-focus-traversal', 'contract.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({ summary, failures }, null, 2));

if (failures.length) {
  console.error(`\n❌ chrome-label focus-traversal contract failed (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`\n✅ chrome-label focus-traversal contract passed (${SURFACES.length} surfaces; native full-focus per-run traversal, WCAG 2.5.3 name containment)`);
