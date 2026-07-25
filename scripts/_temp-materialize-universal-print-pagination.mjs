#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

function updateFile(file, transform) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(file, after, 'utf8');
  console.log('[materialize]', path.relative(ROOT, file));
  return true;
}

function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'reports', 'pagefind'].includes(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(target, visit);
    else visit(target);
  }
}

const paginationPath = path.join(ROOT, 'js/print-pagination.js');
updateFile(paginationPath, (text) => {
  if (!text.includes('function isPrintMediaActive()')) {
    const anchor = `  function measureMm(mm) {`;
    if (!text.includes(anchor)) throw new Error('print media helper insertion point missing');
    text = text.replace(anchor, `  function isPrintMediaActive() {\n    try { return !!(window.matchMedia && window.matchMedia('print').matches); }\n    catch (_) { return false; }\n  }\n\n${anchor}`);
  }
  const unsafe = `      if (combined <= pageHeight * 0.94) {\n        var group = createClosingGroup(previous, tail);`;
  const guarded = `      if (isPrintMediaActive() && combined <= pageHeight * 0.94) {\n        var group = createClosingGroup(previous, tail);`;
  if (text.includes(unsafe)) text = text.replace(unsafe, guarded);
  if (!text.includes(guarded)) throw new Error('print-only closing-group guard missing');
  return text;
});

const readerHead = path.join(ROOT, 'src/components/reader-platform/ReaderPreferencesHead.astro');
updateFile(readerHead, (text) => {
  if (!text.includes("const printPaginationSrc = assetUrl('js/print-pagination.js');")) {
    text = text.replace(
      "const readerStateSrc = assetUrl('js/reader-state.js');",
      "const readerStateSrc = assetUrl('js/reader-state.js');\nconst printPaginationSrc = assetUrl('js/print-pagination.js');"
    );
  }
  if (!text.includes('src={printPaginationSrc}')) {
    text = text.replace(
      '<script is:inline defer src={readerStateSrc}></script>',
      '<script is:inline defer src={readerStateSrc}></script>\n<script is:inline defer src={printPaginationSrc}></script>'
    );
  }
  return text;
});

let injectedHtml = 0;
walk(ROOT, (file) => {
  if (!file.endsWith('.html')) return;
  updateFile(file, (text) => {
    if (text.includes('js/print-pagination.js')) return text;
    if (!/<article\b|data-pagefind-body|data-reader-root|data-gill-v16/.test(text)) return text;
    const re = /(<script\b[^>]*\bsrc="([^"]*?)js\/reader-state\.js\?v=[^"]+"[^>]*><\/script>)/i;
    const match = text.match(re);
    if (!match) return text;
    const tag = `<script defer src="${match[2]}js/print-pagination.js?v=00000000"></script>`;
    injectedHtml += 1;
    return text.replace(re, `$1${tag}`);
  });
});
console.log('[materialize] injected legacy/static HTML:', injectedHtml);

const cssPath = path.join(ROOT, 'css/site.css');
updateFile(cssPath, (css) => {
  css = css.replace(/\n\/\* GB PRINT CONTRACT v2\.8[\s\S]*?(?=\n\/\* GB PRINT CONTRACT v2\.9)/, '\n');
  css = css.replace(/\n\/\* GB PRINT CONTRACT v2\.9[\s\S]*$/, '\n');
  if (/\[data-gill-v16="part1"\][\s\S]{0,180}note-box:first-child/.test(css)) {
    throw new Error('Gill-only print pagination selector remains in css/site.css');
  }
  return css.trimEnd() + '\n';
});

const sweepPath = path.join(ROOT, 'scripts/engine-sweep.mjs');
updateFile(sweepPath, (text) => {
  const marker = '/* ============ UNIVERSAL PRINT PAGINATION — COMPONENT CONTRACT ============ */';
  if (text.includes(marker)) return text;
  const insertionPoint = '/* ============ READERSTATE R6 — ЕДИНЫЙ ДИАПАЗОН/ПРОГРЕСС/RESUME ============ */';
  if (!text.includes(insertionPoint)) throw new Error('engine-sweep insertion point missing');
  const block = `${marker}\nfor (const [id, url] of [\n  ['paginate-gill', '/articles/dzhon-gill-chast-1-chelovek/'],\n  ['paginate-book', '/articles/novoe-serdce/'],\n  ['paginate-baptist', '/baptisty-rossii/podpolnaya-pechat/'],\n  ['paginate-single', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],\n]) {\n  const { ctx, page } = await newPage({ width: 1240, height: 900 });\n  await page.goto(base + url, { waitUntil: 'networkidle' });\n  const screenState = await page.evaluate(() => ({\n    groups: document.querySelectorAll('.gb-print-closing-group').length,\n  }));\n  R(id, 'print: screen DOM remains structurally untouched', screenState.groups === 0, JSON.stringify(screenState));\n  await page.emulateMedia({ media: 'print' });\n  await page.waitForTimeout(250);\n  const pagination = await page.evaluate(() => {\n    const api = window.GBPrintPagination;\n    const first = api?.prepare?.() || null;\n    const firstGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    const atomic = [...document.querySelectorAll('[data-print-flow="atomic"]')];\n    const badAtomic = atomic.filter((node) => !String(getComputedStyle(node).breakInside).includes('avoid'));\n    const keepers = [...document.querySelectorAll('[data-print-keep-next]')];\n    const badKeep = keepers.filter((node) => !String(getComputedStyle(node).breakAfter).includes('avoid'));\n    const legacyPattern = /\\[data-gill-v16=["']part1["']\\][\\s\\S]{0,240}note-box:first-child/;\n    api?.reset?.();\n    const resetGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    const resetGenerated = document.querySelectorAll('[data-gb-print-generated]').length;\n    const second = api?.prepare?.() || null;\n    const secondGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    return {\n      version: api?.version || 0, report: second, atomic: atomic.length, keepers: keepers.length,\n      firstGroups, resetGroups, resetGenerated, secondGroups,\n      firstClosingGroups: first?.stats?.closingGroups || 0,\n      secondClosingGroups: second?.stats?.closingGroups || 0,\n      badAtomic: badAtomic.slice(0, 5).map((node) => node.className || node.tagName),\n      badKeep: badKeep.slice(0, 5).map((node) => node.className || node.tagName),\n      legacyRoutePatch: [...document.styleSheets].some((sheet) => {\n        try { return [...sheet.cssRules].some((rule) => legacyPattern.test(String(rule.cssText || ''))); } catch { return false; }\n      })\n    };\n  });\n  R(id, 'print: shared pagination runtime classifies semantic components',\n    pagination.version === 1 && pagination.report?.prepared && pagination.atomic > 0 && pagination.keepers > 0,\n    JSON.stringify(pagination));\n  R(id, 'print: closing groups are print-only, reversible and idempotent',\n    pagination.resetGroups === 0 && pagination.resetGenerated === 0 && pagination.firstGroups === pagination.firstClosingGroups && pagination.secondGroups === pagination.secondClosingGroups,\n    JSON.stringify(pagination));\n  R(id, 'print: atomic and keep-next computed contracts are effective',\n    pagination.badAtomic.length === 0 && pagination.badKeep.length === 0,\n    JSON.stringify({ badAtomic: pagination.badAtomic, badKeep: pagination.badKeep }));\n  R(id, 'print: legacy route-specific pagination patch is absent', !pagination.legacyRoutePatch, JSON.stringify(pagination));\n  await ctx.close();\n}\n\n`;
  return text.replace(insertionPoint, block + insertionPoint);
});

execFileSync('node', ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });