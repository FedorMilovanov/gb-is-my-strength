#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT = path.resolve(process.env.GB_LIVE_READER_OUT || 'reports/live-reader-production');
const PROD = 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/';
const LOCAL_HTML = path.resolve('articles/dzhon-gill-chast-1-chelovek/index.html');
const ASSETS = [
  'reader-preferences-head.js',
  'reader-preferences.js',
  'site.css',
  'floating-cluster.css',
  'site.js',
];

fs.mkdirSync(OUT, { recursive: true });

function assetVersions(html) {
  const result = {};
  for (const asset of ASSETS) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`(?:src|href)=["'][^"']*${escaped}\\?v=([a-f0-9]+)`, 'i'));
    result[asset] = match?.[1] || null;
  }
  return result;
}

function equalAssets(a, b) {
  return ASSETS.every((asset) => a[asset] && a[asset] === b[asset]);
}

async function fetchRemoteHtml(attempt) {
  const url = `${PROD}?_gb_reader_verify=${Date.now()}-${attempt}`;
  const response = await fetch(url, {
    redirect: 'follow',
    cache: 'no-store',
    headers: {
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
      'user-agent': 'GB-Reader-Postmerge-Smoke/1.0',
    },
  });
  if (!response.ok) throw new Error(`production HTML ${response.status} ${response.statusText}`);
  return { url, html: await response.text(), headers: Object.fromEntries(response.headers.entries()) };
}

const localHtml = fs.readFileSync(LOCAL_HTML, 'utf8');
const expectedAssets = assetVersions(localHtml);
if (Object.values(expectedAssets).some((value) => !value)) {
  throw new Error(`local asset extraction incomplete: ${JSON.stringify(expectedAssets)}`);
}

let remote = null;
let observedAssets = null;
const attempts = [];
for (let attempt = 1; attempt <= 24; attempt += 1) {
  try {
    remote = await fetchRemoteHtml(attempt);
    observedAssets = assetVersions(remote.html);
    attempts.push({ attempt, at: new Date().toISOString(), observedAssets, match: equalAssets(expectedAssets, observedAssets) });
    console.log(`[asset poll ${attempt}/24]`, JSON.stringify({ expectedAssets, observedAssets }));
    if (equalAssets(expectedAssets, observedAssets)) break;
  } catch (error) {
    attempts.push({ attempt, at: new Date().toISOString(), error: String(error) });
    console.error(`[asset poll ${attempt}/24]`, error);
  }
  await new Promise((resolve) => setTimeout(resolve, 20_000));
}

fs.writeFileSync(path.join(OUT, 'production.html'), remote?.html || '');
fs.writeFileSync(path.join(OUT, 'asset-report.json'), JSON.stringify({
  checkedAt: new Date().toISOString(),
  productionUrl: PROD,
  expectedAssets,
  observedAssets,
  matched: equalAssets(expectedAssets, observedAssets || {}),
  responseHeaders: remote?.headers || null,
  attempts,
}, null, 2));

if (!equalAssets(expectedAssets, observedAssets || {})) {
  throw new Error(`production assets did not converge to main: ${JSON.stringify({ expectedAssets, observedAssets })}`);
}

const browser = await chromium.launch({ headless: true });
const report = {
  checkedAt: new Date().toISOString(),
  productionUrl: PROD,
  expectedAssets,
  observedAssets,
  desktop: null,
  compactDesktop: null,
  print: null,
};

async function makeContext(viewport) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: 'ru-RU',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gb:reader-preferences:v1', JSON.stringify({
        version: 1,
        theme: 'light',
        fontScale: 1,
        lineHeight: 'normal',
        measure: 'wide',
        textMode: 'rich',
        motion: 'system',
      }));
    } catch (_) {}
  });
  return context;
}

try {
  const context = await makeContext({ width: 1440, height: 1000 });
  const page = await context.newPage();
  await page.goto(`${PROD}?_gb_reader_live=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector('[data-gill-v16]', { timeout: 30_000 });

  const settingsButton = page.locator('#railSettingsBtn');
  await settingsButton.click();
  await page.waitForFunction(() => document.querySelector('#gillSettingsOverlay')?.classList.contains('is-open'));
  await page.waitForTimeout(350);

  report.desktop = await page.evaluate(() => {
    const wide = document.querySelector('#gillSettingsOverlay [data-measure="wide"]');
    const group = wide?.closest('.setting-group');
    const menu = document.querySelector('.gbs-rail-menu-btn');
    const menuStyle = menu ? getComputedStyle(menu) : null;
    const menuBefore = menu ? getComputedStyle(menu, '::before') : null;
    const badge = document.querySelector('.gbs-theme-corner .gbs-rail-spdbadge');
    const wrap = document.querySelector('.gbs-theme-corner .gbs-rail-playwrap');
    if (badge) badge.textContent = '1.75×';
    const br = badge?.getBoundingClientRect();
    const wr = wrap?.getBoundingClientRect();
    return {
      rootMeasure: document.documentElement.getAttribute('data-reader-measure'),
      cssMeasure: getComputedStyle(document.documentElement).getPropertyValue('--gb-reader-measure').trim(),
      settingsOpen: document.querySelector('#gillSettingsOverlay')?.classList.contains('is-open') || false,
      measureLabel: group?.querySelector('.setting-label')?.textContent?.trim() || null,
      wideVisible: !!wide && getComputedStyle(group).display !== 'none',
      menuBorderRight: menuStyle?.borderRightWidth || null,
      menuSeparatorWidth: menuBefore?.width || null,
      menuSeparatorHeight: menuBefore?.height || null,
      badgeDx: br && wr ? Math.round((br.left + br.width / 2) - (wr.left + wr.width / 2)) : null,
      badgeDy: br && wr ? Math.round((br.top + br.height / 2) - (wr.top + wr.height / 2)) : null,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    };
  });

  await page.screenshot({ path: path.join(OUT, 'live-settings-wide-1440.png'), fullPage: false });

  const d = report.desktop;
  if (!(d.rootMeasure === 'wide' && d.cssMeasure === '46rem' && d.settingsOpen && d.wideVisible &&
        d.measureLabel === 'Ширина статьи' && d.menuBorderRight === '0px' &&
        Number.parseFloat(d.menuSeparatorWidth) <= 2 && Number.parseFloat(d.menuSeparatorHeight) >= 8 &&
        d.badgeDx >= 8 && d.badgeDy >= 8 && d.horizontalOverflow <= 1)) {
    throw new Error(`desktop production contract failed: ${JSON.stringify(d)}`);
  }

  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.print = () => { window.__gbLivePrintCalls = (window.__gbLivePrintCalls || 0) + 1; }; });
  await page.locator('.gbs-rail-foot [data-action="print"]').click();
  await page.waitForFunction(() => window.__gbLivePrintCalls === 1 && window.GBPrintEngine?.getReport?.(), null, { timeout: 15_000 });

  report.print = await page.evaluate(() => ({
    calls: window.__gbLivePrintCalls,
    engine: window.GBPrintEngine?.getReport?.() || null,
  }));
  if (!(report.print.calls === 1 && report.print.engine?.version === 2.1 && report.print.engine?.source === 'button')) {
    throw new Error(`live print engine contract failed: ${JSON.stringify(report.print)}`);
  }

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(300);
  report.print.layout = await page.evaluate(() => {
    const selectors = ['.gbs-rail', '.gbs-theme-corner', '.mobile-top-bar', '.mobile-bottom-bar', '.toc-overlay', '.gb-floater', '.hrail'];
    const visibleChrome = selectors.filter((selector) => {
      const node = document.querySelector(selector);
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    const hero = document.querySelector('.gbs2-hero');
    const image = hero?.querySelector('img');
    return {
      visibleChrome,
      heroBefore: hero ? getComputedStyle(hero, '::before').display : null,
      heroAfter: hero ? getComputedStyle(hero, '::after').display : null,
      heroCap: document.querySelector('.gbs2-hero-cap') ? getComputedStyle(document.querySelector('.gbs2-hero-cap')).display : null,
      heroImagePosition: image ? getComputedStyle(image).position : null,
      bodyOpacity: getComputedStyle(document.querySelector('.article-body')).opacity,
    };
  });
  if (!(report.print.layout.visibleChrome.length === 0 && report.print.layout.heroBefore === 'none' &&
        report.print.layout.heroAfter === 'none' && report.print.layout.heroCap === 'none' &&
        report.print.layout.heroImagePosition !== 'fixed' && Number(report.print.layout.bodyOpacity) === 1)) {
    throw new Error(`live print media contract failed: ${JSON.stringify(report.print.layout)}`);
  }

  await page.screenshot({ path: path.join(OUT, 'live-print-preview.png'), fullPage: false });
  await page.pdf({
    path: path.join(OUT, 'live-reader-a4.pdf'),
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await context.close();

  const compact = await makeContext({ width: 1035, height: 851 });
  const compactPage = await compact.newPage();
  await compactPage.goto(`${PROD}?_gb_reader_compact=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120_000 });
  await compactPage.waitForSelector('[data-gill-v16]', { timeout: 30_000 });
  await compactPage.evaluate(() => {
    const paragraph = [...document.querySelectorAll('[data-gill-v16] .article-body p')]
      .find((node) => (node.textContent || '').trim().length > 180);
    if (paragraph) scrollTo(0, Math.max(0, paragraph.getBoundingClientRect().top + scrollY - 110));
  });
  await compactPage.waitForTimeout(250);
  await compactPage.hover('.gbs-theme-corner .gbs-rail-playwrap');
  await compactPage.waitForTimeout(450);

  report.compactDesktop = await compactPage.evaluate(() => {
    const panel = document.querySelector('.gbs-theme-corner .gb-ember-expand');
    const paragraph = [...document.querySelectorAll('[data-gill-v16] .article-body p')]
      .find((node) => {
        const rect = node.getBoundingClientRect();
        return (node.textContent || '').trim().length > 180 && rect.bottom > 0 && rect.top < innerHeight;
      });
    const pr = panel?.getBoundingClientRect();
    const ar = paragraph?.getBoundingClientRect();
    return pr && ar ? {
      articleRight: Math.round(ar.right),
      panelLeft: Math.round(pr.left),
      panelWidth: Math.round(pr.width),
      panelHeight: Math.round(pr.height),
      open: panel.classList.contains('is-open'),
      scrollWidth: document.documentElement.scrollWidth,
      viewport: innerWidth,
      rootMeasure: document.documentElement.getAttribute('data-reader-measure'),
    } : null;
  });
  await compactPage.screenshot({ path: path.join(OUT, 'live-wide-speed-1035.png'), fullPage: false });

  const c = report.compactDesktop;
  if (!(c && c.open && c.rootMeasure === 'wide' && c.panelHeight > c.panelWidth * 2 &&
        c.articleRight <= c.panelLeft - 12 && c.scrollWidth <= c.viewport + 1)) {
    throw new Error(`compact production contract failed: ${JSON.stringify(c)}`);
  }
  await compact.close();
} finally {
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'live-smoke-report.json'), JSON.stringify(report, null, 2));
}

console.log('LIVE READER PRODUCTION SMOKE: PASS');
console.log(JSON.stringify(report, null, 2));
