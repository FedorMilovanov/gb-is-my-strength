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
  const unsafe = `      if (combined <= pageHeight * 0.94) {\n        var group = createClosingGroup(previous, tail);`;
  const guarded = `      if (isPrintMedia() && combined <= pageHeight * 0.94) {\n        var group = createClosingGroup(previous, tail);`;
  if (text.includes(unsafe)) text = text.replace(unsafe, guarded);
  if (!text.includes(guarded)) throw new Error('print-only closing-group guard missing');
  if (!text.includes("function () { if (isPrintMedia()) prepare(); }")) {
    throw new Error('DOMContentLoaded print-only lifecycle guard missing');
  }

  if (!text.includes('data-print-terminal-flow')) {
    const cssAnchor = `      '  html body [data-print-flow] { box-shadow: none; }',`;
    if (!text.includes(cssAnchor)) throw new Error('terminal-flow CSS insertion point missing');
    text = text.replace(
      cssAnchor,
      `      '  html body [data-print-terminal-flow] { break-after: auto !important; page-break-after: auto !important; }',\n${cssAnchor}`
    );

    const clearAnchor = `      nodes[i].removeAttribute('data-print-closing-group');`;
    if (!text.includes(clearAnchor)) throw new Error('terminal-flow cleanup insertion point missing');
    text = text.replace(
      clearAnchor,
      `${clearAnchor}\n      nodes[i].removeAttribute('data-print-terminal-flow');`
    );

    const groupAnchor = `        if (group) {\n          stats.tailPairs += 1;`;
    if (!text.includes(groupAnchor)) throw new Error('terminal-flow grouping insertion point missing');
    text = text.replace(
      groupAnchor,
      `        if (group) {\n          var terminal = group.parentElement;\n          while (terminal && terminal !== document.body && terminal !== document.documentElement) {\n            mark(terminal, 'data-print-terminal-flow', '1');\n            terminal = terminal.parentElement;\n          }\n          stats.tailPairs += 1;`
    );
  }
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

const contractPath = path.join(ROOT, 'scripts/print-pagination-contract.mjs');
updateFile(contractPath, (text) => {
  const oldHosts = `      function hosts(node) {\n        if (node.matches?.('table')) {`;
  const newHosts = `      function hosts(node) {\n        if (node.matches?.('.gb-print-closing-group')) {\n          return { start: node.firstElementChild || node, end: node.lastElementChild || node };\n        }\n        if (node.matches?.('table')) {`;
  if (text.includes(oldHosts)) text = text.replace(oldHosts, newHosts);
  if (!text.includes(newHosts)) throw new Error('closing-group marker hosts missing');
  return text;
});

const sweepPath = path.join(ROOT, 'scripts/engine-sweep.mjs');
updateFile(sweepPath, (text) => {
  const marker = '/* ============ UNIVERSAL PRINT PAGINATION — COMPONENT CONTRACT ============ */';
  if (text.includes(marker)) return text;
  const insertionPoint = '/* ============ READERSTATE R6 — ЕДИНЫЙ ДИАПАЗОН/ПРОГРЕСС/RESUME ============ */';
  if (!text.includes(insertionPoint)) throw new Error('engine-sweep insertion point missing');
  const block = `${marker}\nfor (const [id, url] of [\n  ['paginate-gill', '/articles/dzhon-gill-chast-1-chelovek/'],\n  ['paginate-book', '/articles/novoe-serdce/'],\n  ['paginate-baptist', '/baptisty-rossii/podpolnaya-pechat/'],\n  ['paginate-single', '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/'],\n]) {\n  const { ctx, page } = await newPage({ width: 1240, height: 900 });\n  await page.goto(base + url, { waitUntil: 'networkidle' });\n  const screenState = await page.evaluate(() => {\n    const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');\n    const scope = root?.parentElement || document.body;\n    return {\n      groups: document.querySelectorAll('.gb-print-closing-group').length,\n      text: String(scope.textContent || '').replace(/\\s+/g, ' ').trim(),\n    };\n  });\n  R(id, 'print: screen DOM remains structurally untouched', screenState.groups === 0, JSON.stringify({ groups: screenState.groups }));\n  await page.emulateMedia({ media: 'print' });\n  await page.waitForTimeout(250);\n  const pagination = await page.evaluate(() => {\n    const semanticText = () => {\n      const root = document.querySelector('[data-reader-range], [data-reader-root] article.article-body, [data-gill-v16] article.article-body, article.article-body, article[data-pagefind-body], main article, article');\n      const scope = root?.parentElement || document.body;\n      return String(scope.textContent || '').replace(/\\s+/g, ' ').trim();\n    };\n    const api = window.GBPrintPagination;\n    const first = api?.prepare?.() || null;\n    const firstGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    const groupOrder = [...document.querySelectorAll('.gb-print-closing-group')].every((group) =>\n      group.children.length >= 2 && group.lastElementChild?.matches('[data-print-tail],.article-end-block,.article-end-sdg-wrap,.article-end-sdg,.closing-mark,.devotional-tail,.epilogue')\n    );\n    const atomic = [...document.querySelectorAll('[data-print-flow="atomic"]')];\n    const badAtomic = atomic.filter((node) => !String(getComputedStyle(node).breakInside).includes('avoid'));\n    const keepers = [...document.querySelectorAll('[data-print-keep-next]')];\n    const badKeep = keepers.filter((node) => !String(getComputedStyle(node).breakAfter).includes('avoid'));\n    const legacyPattern = /\\[data-gill-v16=["']part1["']\\][\\s\\S]{0,240}note-box:first-child/;\n    api?.reset?.();\n    const resetGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    const resetGenerated = document.querySelectorAll('[data-gb-print-generated]').length;\n    const resetText = semanticText();\n    const second = api?.prepare?.() || null;\n    const secondGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    api?.reset?.();\n    const secondResetGroups = document.querySelectorAll('.gb-print-closing-group').length;\n    const secondResetGenerated = document.querySelectorAll('[data-gb-print-generated]').length;\n    const secondResetText = semanticText();\n    return {\n      version: api?.version || 0, report: second, atomic: atomic.length, keepers: keepers.length, groupOrder,\n      firstGroups, resetGroups, resetGenerated, resetText, secondGroups, secondResetGroups, secondResetGenerated, secondResetText,\n      firstClosingGroups: first?.stats?.closingGroups || 0,\n      secondClosingGroups: second?.stats?.closingGroups || 0,\n      badAtomic: badAtomic.slice(0, 5).map((node) => node.className || node.tagName),\n      badKeep: badKeep.slice(0, 5).map((node) => node.className || node.tagName),\n      legacyRoutePatch: [...document.styleSheets].some((sheet) => {\n        try { return [...sheet.cssRules].some((rule) => legacyPattern.test(String(rule.cssText || ''))); } catch { return false; }\n      })\n    };\n  });\n  R(id, 'print: shared pagination runtime classifies semantic components',\n    pagination.version === 1 && pagination.report?.prepared && pagination.atomic > 0 && pagination.keepers > 0,\n    JSON.stringify(pagination));\n  R(id, 'print: closing groups are print-only, ordered, reversible and idempotent',\n    pagination.groupOrder && pagination.resetGroups === 0 && pagination.resetGenerated === 0 && pagination.secondResetGroups === 0 && pagination.secondResetGenerated === 0 && pagination.firstGroups === pagination.firstClosingGroups && pagination.secondGroups === pagination.secondClosingGroups,\n    JSON.stringify({ groupOrder: pagination.groupOrder, firstGroups: pagination.firstGroups, resetGroups: pagination.resetGroups, resetGenerated: pagination.resetGenerated, secondGroups: pagination.secondGroups, secondResetGroups: pagination.secondResetGroups, secondResetGenerated: pagination.secondResetGenerated }));\n  R(id, 'print: source semantic order is restored after every reset',\n    pagination.resetText === screenState.text && pagination.secondResetText === screenState.text,\n    JSON.stringify({ screen: screenState.text.slice(-180), reset: pagination.resetText.slice(-180), secondReset: pagination.secondResetText.slice(-180) }));\n  R(id, 'print: atomic and keep-next computed contracts are effective',\n    pagination.badAtomic.length === 0 && pagination.badKeep.length === 0,\n    JSON.stringify({ badAtomic: pagination.badAtomic, badKeep: pagination.badKeep }));\n  R(id, 'print: legacy route-specific pagination patch is absent', !pagination.legacyRoutePatch, JSON.stringify(pagination));\n  await ctx.close();\n}\n\n`;
  return text.replace(insertionPoint, block + insertionPoint);
});

execFileSync('node', ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
