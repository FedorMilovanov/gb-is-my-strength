#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, process.env.GB_LIVE_PRINT_ARTIFACT_DIR || 'reports/live-print-decoration-proof');
const URL = process.env.GB_LIVE_PRINT_URL || 'https://gospod-bog.ru/articles/dzhon-gill-chast-1-chelovek/';
const expected = {
  site: process.env.GB_EXPECT_SITE_CSS || '226fbe6b',
  floating: process.env.GB_EXPECT_FLOATING_CSS || 'd26d83c2',
  readerHead: process.env.GB_EXPECT_READER_HEAD || '2db7a79e',
};
const pinned = process.env.GB_PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const report = { url: URL, expected, failures: [] };

function tokenPage(text, token) {
  const pages = text.split('\f');
  const index = pages.findIndex((page) => page.includes(token));
  return index < 0 ? 0 : index + 1;
}

function requireCondition(condition, message) {
  if (!condition) report.failures.push(message);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(existsSync(pinned) ? { executablePath: pinned } : {});
try {
  const context = await browser.newContext({
    viewport: { width: 1240, height: 900 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.route(/mc\.yandex|yandex\.ru/, (route) => route.abort());
  await page.goto(`${URL}?proof=${Date.now()}`, { waitUntil: 'networkidle', timeout: 120000 });
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });

  const screen = await page.evaluate(() => {
    const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((node) => node.href);
    const scripts = [...document.scripts].map((node) => node.src).filter(Boolean);
    const before = getComputedStyle(document.body, '::before');
    return {
      links,
      scripts,
      bodyBefore: {
        content: before.content,
        position: before.position,
        height: before.height,
        backgroundImage: before.backgroundImage,
        transform: before.transform,
      },
      runtimeVersion: window.GBPrintPagination?.version || 0,
      cardCount: document.querySelectorAll('.flip-card,.heart-flip-card,.error-flip-card').length,
    };
  });
  report.screen = screen;
  requireCondition(screen.links.some((url) => url.includes(`/css/site.css?v=${expected.site}`)), 'live site.css revision mismatch');
  requireCondition(screen.links.some((url) => url.includes(`/css/floating-cluster.css?v=${expected.floating}`)), 'live floating-cluster.css revision mismatch');
  requireCondition(screen.scripts.some((url) => url.includes(`/js/reader-preferences-head.js?v=${expected.readerHead}`)), 'live reader-preferences-head.js revision mismatch');
  requireCondition(screen.runtimeVersion === 1, 'GBPrintPagination v1 missing on live page');
  requireCondition(screen.cardCount === 1, `expected one live reversible card, found ${screen.cardCount}`);
  const screenProgressLooksGone = screen.bodyBefore.content === 'none' || screen.bodyBefore.content === 'normal' || screen.bodyBefore.content === '""';
  requireCondition(screenProgressLooksGone && screen.bodyBefore.backgroundImage === 'none', `screen body::before still looks like progress decoration: ${JSON.stringify(screen.bodyBefore)}`);

  await page.emulateMedia({ media: 'print' });
  const originalFlipped = await page.locator('.flip-card,.heart-flip-card,.error-flip-card').evaluate((card) => card.classList.contains('flipped'));
  const START = 'GBLIVE_CARD_START';
  const END = 'GBLIVE_CARD_END';

  const prepared = await page.evaluate(({ startToken, endToken }) => {
    const card = document.querySelector('.flip-card,.heart-flip-card,.error-flip-card');
    if (!card) return { error: 'live reversible card missing' };
    card.classList.add('flipped');
    const runtime = window.GBPrintPagination?.prepare?.() || null;
    if (!runtime?.prepared) return { error: 'live print runtime did not prepare' };
    const faces = [...card.querySelectorAll('.flip-card-front,.flip-card-back,.heart-flip-front,.heart-flip-back,.error-flip-front,.error-flip-back')];
    const active = faces.filter((face) => {
      const style = getComputedStyle(face);
      const rect = face.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 8 && rect.height > 4;
    });
    if (active.length !== 1) return { error: `expected one active print face, found ${active.length}` };
    const face = active[0];
    const auditStyle = document.createElement('style');
    auditStyle.id = 'gb-live-card-marker-style';
    auditStyle.textContent = `@media print {
      .gb-live-card-marker-host { position: relative !important; }
      .gb-live-card-marker { position:absolute!important;left:1px!important;display:block!important;height:4px!important;font:4px/4px monospace!important;color:#fff!important;background:transparent!important;z-index:2147483647!important; }
      .gb-live-card-marker--start { top:1px!important; }
      .gb-live-card-marker--end { bottom:1px!important; }
    }`;
    document.head.appendChild(auditStyle);
    face.classList.add('gb-live-card-marker-host');
    const marker = (token, kind) => {
      const span = document.createElement('span');
      span.className = `gb-live-card-marker gb-live-card-marker--${kind}`;
      span.setAttribute('aria-hidden', 'true');
      span.textContent = token;
      return span;
    };
    face.prepend(marker(startToken, 'start'));
    face.append(marker(endToken, 'end'));
    const cardStyle = getComputedStyle(card);
    const faceStyle = getComputedStyle(face);
    const inner = card.querySelector('.flip-card-inner,.heart-flip-inner,.error-flip-inner');
    const innerStyle = inner ? getComputedStyle(inner) : null;
    return {
      runtime,
      cardFlow: card.getAttribute('data-print-flow') || '',
      cardBreakInside: cardStyle.breakInside,
      cardHeight: Math.round(card.getBoundingClientRect().height),
      activeFaceClass: face.className,
      activeFaceText: String(face.textContent || '').replace(/\s+/g, ' ').trim().replace(/GBLIVE_CARD_(?:START|END)/g, '').slice(0, 240),
      facePosition: faceStyle.position,
      faceTransform: faceStyle.transform,
      innerPosition: innerStyle?.position || '',
      innerTransform: innerStyle?.transform || '',
      visibleFaceCount: active.length,
    };
  }, { startToken: START, endToken: END });
  report.prepared = prepared;
  if (prepared.error) report.failures.push(prepared.error);
  else {
    requireCondition(prepared.cardFlow === 'atomic', `live card is not atomic: ${prepared.cardFlow}`);
    requireCondition(String(prepared.cardBreakInside).includes('avoid'), `live card break-inside is ${prepared.cardBreakInside}`);
    requireCondition(prepared.visibleFaceCount === 1, `live card has ${prepared.visibleFaceCount} visible print faces`);
    requireCondition(prepared.innerPosition === 'static' && prepared.innerTransform === 'none', `live card inner remains 3D: ${prepared.innerPosition}/${prepared.innerTransform}`);
    requireCondition(!['absolute','fixed','sticky'].includes(prepared.facePosition) && prepared.faceTransform === 'none', `live active face remains transformed: ${prepared.facePosition}/${prepared.faceTransform}`);
    requireCondition(prepared.activeFaceText.toUpperCase().includes('РУССКИЙ ПЕРЕВОД'), 'live active face is not the Russian translation');
  }

  const markerPdf = join(OUT, 'live-gill-card-markers.pdf');
  const markerTxt = join(OUT, 'live-gill-card-markers.txt');
  await page.pdf({ path: markerPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  execFileSync('pdftotext', ['-layout', markerPdf, markerTxt]);
  const markerText = await readFile(markerTxt, 'utf8');
  const startPage = tokenPage(markerText, START);
  const endPage = tokenPage(markerText, END);
  report.markerPages = { startPage, endPage };
  requireCondition(startPage > 0 && endPage > 0, `live card PDF markers missing: ${startPage}/${endPage}`);
  requireCondition(startPage === endPage, `live card split across pages: ${startPage}/${endPage}`);

  await page.evaluate((wasFlipped) => {
    document.getElementById('gb-live-card-marker-style')?.remove();
    document.querySelectorAll('.gb-live-card-marker').forEach((node) => node.remove());
    document.querySelectorAll('.gb-live-card-marker-host').forEach((node) => node.classList.remove('gb-live-card-marker-host'));
    const card = document.querySelector('.flip-card,.heart-flip-card,.error-flip-card');
    if (card) card.classList.add('flipped');
    window.GBPrintPagination?.prepare?.();
  }, originalFlipped);

  await page.locator('.flip-card,.heart-flip-card,.error-flip-card').screenshot({ path: join(OUT, 'live-russian-translation-card.png') });
  const cleanPdf = join(OUT, 'live-gill-print-a4.pdf');
  const cleanTxt = join(OUT, 'live-gill-print-a4.txt');
  await page.pdf({ path: cleanPdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  execFileSync('pdftotext', ['-layout', cleanPdf, cleanTxt]);
  const cleanText = await readFile(cleanTxt, 'utf8');
  const cleanPages = cleanText.split('\f');
  const russianPageIndex = cleanPages.findIndex((text) => text.toUpperCase().includes('РУССКИЙ ПЕРЕВОД'));
  report.cleanPdf = {
    pages: Number((execFileSync('pdfinfo', [cleanPdf], { encoding: 'utf8' }).match(/^Pages:\s+(\d+)/m) || [])[1] || 0),
    russianTranslationPage: russianPageIndex < 0 ? 0 : russianPageIndex + 1,
    russianPageHasSource: russianPageIndex >= 0 && /Джон\s+Гилл/i.test(cleanPages[russianPageIndex]),
    russianPageHasFollowingParagraph: russianPageIndex >= 0 && /Гимн\s+соединяет/i.test(cleanPages[russianPageIndex]),
  };
  requireCondition(report.cleanPdf.russianTranslationPage > 0, 'Russian translation missing from clean live PDF');
  requireCondition(report.cleanPdf.russianPageHasSource, 'Russian translation source separated from card in clean live PDF');
  requireCondition(report.cleanPdf.russianPageHasFollowingParagraph, 'following paragraph not retained after Russian translation card');

  const restored = await page.evaluate((wasFlipped) => {
    const card = document.querySelector('.flip-card,.heart-flip-card,.error-flip-card');
    if (card) card.classList.toggle('flipped', wasFlipped);
    return {
      generated: document.querySelectorAll('[data-gb-print-generated]').length,
      groups: document.querySelectorAll('.gb-print-closing-group').length,
      cardFlow: card?.getAttribute('data-print-flow') || '',
      flipped: card?.classList.contains('flipped') || false,
    };
  }, originalFlipped);
  report.restored = restored;
  requireCondition(restored.generated === 0 && restored.groups === 0 && restored.cardFlow === '', `live DOM not restored after print: ${JSON.stringify(restored)}`);
  requireCondition(restored.flipped === originalFlipped, 'live card state not restored after proof');

  await context.close();
} finally {
  await browser.close().catch(() => {});
}

await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.failures.length) process.exitCode = 1;
