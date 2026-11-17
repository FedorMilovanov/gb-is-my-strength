#!/usr/bin/env node
/**
 * Physical A4 witness for BaseLayout skip-link print exclusion.
 * The screen link must remain keyboard-focusable. Both long published
 * article families must omit it from the PDF text layer, in Light/Dark.
 * A deliberate print override proves this test fails for a real regression.
 * Requires built dist/, Playwright Chromium and pdftotext (Print Paper CI).
 */
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const REPORT = join(ROOT, process.env.GB_PRINT_SKIP_REPORT || 'reports/print-paper/base-layout-skip-link-proof.json');
const ROUTES = [
  ['lawson', '/articles/steven-lawson-samoobman-i-publichnyy-golos/', 'Лоусон'],
  ['hebrews', '/hard-texts/otstuplenie-ot-very-iuda-evreyam-6/', 'Евреям'],
];
const BAD = /Перейти\s+к\s+основному\s+содержимому/u;
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript',
  '.woff2':'font/woff2', '.json':'application/json', '.svg':'image/svg+xml',
  '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg' };
function insist(ok, reason) { if (!ok) throw new Error('BaseLayout print: ' + reason); }
function pdfText(file) {
  return execFileSync('pdftotext', ['-layout', file, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000,
  });
}
function pageCount(pdf) { return [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length; }
async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const source = decodeURIComponent(new URL(req.url, 'http://localhost/').pathname);
      const rel = source.replace(/^\/+/, '');
      if (rel.split('/').includes('..')) { res.writeHead(400); res.end('Invalid route'); return; }
      let file = join(DIST, rel);
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, origin: 'http://127.0.0.1:' + server.address().port };
}

const temp = await mkdtemp(join(tmpdir(), 'gb-baselayout-paper-'));
let browser, server;
const cases = [];
try {
  const served = await serve();
  server = served.server;
  browser = await chromium.launch({ headless: true });
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 }, colorScheme: scheme,
      reducedMotion: scheme === 'dark' ? 'reduce' : 'no-preference',
    });
    try {
      for (const [name, route, positive] of ROUTES) {
        const page = await context.newPage();
        try {
          const response = await page.goto(served.origin + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
          insist(response?.status() === 200, route + ': missing published page');
          await page.evaluate(() => document.fonts.ready);
          const skip = page.locator('.astro-skip-link');
          insist(await skip.count() === 1, route + ': expected one screen skip link');
          const screen = await skip.evaluate(el => ({
            display: getComputedStyle(el).display, text: el.textContent.trim(), href: el.getAttribute('href'),
          }));
          insist(screen.display !== 'none' && screen.href === '#main-content'
            && screen.text === 'Перейти к основному содержимому', route + ': screen behavior degraded');
          await skip.focus();
          insist(await skip.evaluate(el => document.activeElement === el), route + ': focus lost');

          await page.emulateMedia({ media: 'print' });
          const print = await skip.evaluate(el => ({
            display: getComputedStyle(el).display, box: el.getClientRects().length,
          }));
          insist(print.display === 'none' && print.box === 0, route + ': print link still visible');
          const pdfFile = join(temp, name + '-' + scheme + '.pdf');
          const buffer = await page.pdf({ path: pdfFile, format: 'A4',
            printBackground: true, preferCSSPageSize: true, timeout: 90000 });
          const sheets = pageCount(buffer), text = pdfText(pdfFile);
          insist(sheets >= 10, route + ': broken pagination (' + sheets + ')');
          insist(text.length > 10000 && text.includes(positive), route + ': body text lost');
          insist(!BAD.test(text), route + ': screen skip link leaked into A4 PDF');
          cases.push({ route, scheme, sheets, bodyCharacters: text.length,
            screenKeyboardFocus: true, printDisplay: print.display, leakedSkipLinks: 0 });
          if (name === 'hebrews' && scheme === 'light') {
            await page.addStyleTag({ content: '@media print { .astro-skip-link { display: block !important; position: fixed !important; transform: none !important; inset: auto auto 0 0 !important; } }' });
            const mutationPdf = join(temp, 'hebrews-mutated.pdf');
            await page.pdf({ path: mutationPdf, format: 'A4', printBackground: true, timeout: 90000 });
            insist(BAD.test(pdfText(mutationPdf)), 'mutation failed to reveal repeated link in real PDF text');
          }
        } finally { await page.close(); }
      }
    } finally { await context.close(); }
  }
  await mkdir(dirname(REPORT), { recursive: true });
  await writeFile(REPORT, JSON.stringify({
    status: 'PASS', owner: 'BaseLayout.astro', cases,
    mutation: 'repeated print link detected on Hebrews Light',
  }, null, 2) + '\n');
  console.log('BaseLayout A4 skip link contract: PASS (' + cases.length + ' profile PDFs; mutation detected)');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
}
