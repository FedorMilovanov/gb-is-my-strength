#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const BASE = String(process.env.AUDIT_BASE || '').trim().replace(/\/$/, '');
const REPORT_DIR = path.join(ROOT, 'reports', 'hermenevtika-focus-guard');

assert.ok(BASE, 'AUDIT_BASE is required');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const checks = [];
function record(id, description, pass, evidence = null) {
  checks.push({ id, area: 'hermenevtika-inline-focus', description, pass: Boolean(pass), evidence });
}

const routeCss = fs.readFileSync(path.join(ROOT, 'src/components/article-pilots/hermenevtika/hermenevtika-footnotes.css'), 'utf8');
record('HGF-S01', 'route focus treatment removes generic outline and box-shadow', /\.gterm:focus-visible,[\s\S]*?\.bref:focus-visible[\s\S]*?outline:\s*none;[\s\S]*?box-shadow:\s*none;/.test(routeCss));
record('HGF-S02', 'glossary focus keeps a two-pixel dotted border indicator', /\.gterm:focus-visible[\s\S]*?border-bottom-style:\s*dotted;[\s\S]*?border-bottom-width:\s*2px;/.test(routeCss));
record('HGF-S03', 'Scripture focus keeps a two-pixel dotted underline indicator', /\.bref:focus-visible[\s\S]*?text-decoration-style:\s*dotted;[\s\S]*?text-decoration-thickness:\s*2px;/.test(routeCss));
record('HGF-S04', 'forced-colors mode retains an explicit underline fallback', /@media\s*\(forced-colors:\s*active\)[\s\S]*?text-decoration-line:\s*underline;/.test(routeCss));

async function keyboardFocusState(page, selector) {
  const prepared = await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    if (!(target instanceof HTMLElement)) return false;
    target.setAttribute('tabindex', '0');
    const sentinel = document.createElement('button');
    sentinel.type = 'button';
    sentinel.dataset.hgfSentinel = '1';
    sentinel.textContent = 'focus sentinel';
    sentinel.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;';
    target.before(sentinel);
    sentinel.focus();
    return document.activeElement === sentinel;
  }, selector);
  if (!prepared) return null;

  await page.keyboard.press('Tab');
  const state = await page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    const sentinel = document.querySelector('[data-hgf-sentinel="1"]');
    if (!(target instanceof HTMLElement)) return null;
    const style = getComputedStyle(target);
    const normalizedBackground = style.backgroundColor.replace(/\s+/g, '');
    const value = {
      focused: document.activeElement === target,
      focusVisible: target.matches(':focus-visible'),
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      outlineStyle: style.outlineStyle,
      boxShadow: style.boxShadow,
      backgroundColor: style.backgroundColor,
      backgroundVisible: normalizedBackground !== 'rgba(0,0,0,0)' && normalizedBackground !== 'transparent',
      borderBottomWidth: parseFloat(style.borderBottomWidth) || 0,
      borderBottomStyle: style.borderBottomStyle,
      textDecorationLine: style.textDecorationLine,
      textDecorationStyle: style.textDecorationStyle,
      textDecorationThickness: parseFloat(style.textDecorationThickness) || 0,
    };
    sentinel?.remove();
    return value;
  }, selector);
  return state;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(String(error?.stack || error)));
try {
  await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.GBArticleTooltips?.version >= 14 && document.querySelector('.gterm') && document.querySelector('.bref[data-ref]'), null, { timeout: 15000 });

  const glossary = await keyboardFocusState(page, '.gterm');
  record('HGF-B01', 'glossary receives real keyboard-visible focus', Boolean(glossary?.focused && glossary?.focusVisible), glossary);
  record('HGF-B02', 'glossary focus has no rectangular outline or box-shadow', Boolean(glossary && glossary.outlineWidth === 0 && glossary.boxShadow === 'none'), glossary);
  record('HGF-B03', 'glossary focus remains visible through tint and dotted border', Boolean(glossary && glossary.backgroundVisible && glossary.borderBottomStyle === 'dotted' && glossary.borderBottomWidth >= 1.5), glossary);

  const scripture = await keyboardFocusState(page, '.bref[data-ref]');
  record('HGF-B04', 'Scripture reference receives real keyboard-visible focus', Boolean(scripture?.focused && scripture?.focusVisible), scripture);
  record('HGF-B05', 'Scripture focus has no rectangular outline or box-shadow', Boolean(scripture && scripture.outlineWidth === 0 && scripture.boxShadow === 'none'), scripture);
  record('HGF-B06', 'Scripture focus remains visible through tint and dotted underline', Boolean(scripture && scripture.backgroundVisible && scripture.textDecorationLine.includes('underline') && scripture.textDecorationStyle === 'dotted' && scripture.textDecorationThickness >= 1.5), scripture);
} finally {
  await context.close();
  await browser.close();
}

assert.equal(pageErrors.length, 0, `Hermenevtika focus guard page errors: ${pageErrors.join('\n')}`);
assert.equal(new Set(checks.map((item) => item.id)).size, checks.length, 'focus guard check IDs must be unique');
assert.equal(checks.length, 10, `Hermenevtika focus guard requires exactly 10 checks, got ${checks.length}`);
const failed = checks.filter((item) => !item.pass);
const summary = { sha: process.env.GITHUB_SHA || null, checks: checks.length, passed: checks.length - failed.length, failed: failed.length };
fs.writeFileSync(path.join(REPORT_DIR, 'report.json'), JSON.stringify({ summary, checks, pageErrors }, null, 2));
fs.writeFileSync(path.join(REPORT_DIR, 'report.md'), [
  '# Hermenevtika inline focus guard',
  '',
  `- SHA: \`${summary.sha || 'local'}\``,
  `- Checks: **${summary.checks}**`,
  `- Passed: **${summary.passed}**`,
  `- Failed: **${summary.failed}**`,
  '',
  '| ID | Result | Description |',
  '|---|---|---|',
  ...checks.map((item) => `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.description.replace(/\|/g, '\\|')} |`),
].join('\n'));
checks.forEach((item) => console.log(`[HERMENEVTIKA-FOCUS] ${item.pass ? 'PASS' : 'FAIL'} ${item.id} :: ${item.description}`));
console.log('[HERMENEVTIKA-FOCUS-SUMMARY]', JSON.stringify(summary));
assert.equal(failed.length, 0, `Hermenevtika focus guard failed: ${failed.map((item) => item.id).join(', ')}`);
console.log('Hermenevtika inline focus guard: PASS');
