#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const bootstrapPath = path.join(ROOT, 'js/reader-preferences-head.js');
const paginationPath = path.join(ROOT, 'js/print-pagination.js');
const headPath = path.join(ROOT, 'src/components/reader-platform/ReaderPreferencesHead.astro');

if (!fs.existsSync(paginationPath)) throw new Error('js/print-pagination.js missing before integration');
const pagination = fs.readFileSync(paginationPath, 'utf8').trim();
let bootstrap = fs.readFileSync(bootstrapPath, 'utf8').trimEnd();
if (bootstrap.includes('GB Print Pagination v1')) throw new Error('print pagination already embedded in reader-preferences-head.js');
bootstrap += `\n\n${pagination}\n`;
fs.writeFileSync(bootstrapPath, bootstrap, 'utf8');
fs.unlinkSync(paginationPath);
console.log('[integrate] embedded print runtime and removed standalone file');

let head = fs.readFileSync(headPath, 'utf8');
head = head.replace(/^const printPaginationSrc = assetUrl\('js\/print-pagination\.js'\);\r?\n/m, '');
head = head.replace(/^<script is:inline defer src=\{printPaginationSrc\}><\/script>\r?\n?/m, '');
if (head.includes('printPaginationSrc') || head.includes('print-pagination.js')) {
  throw new Error('ReaderPreferencesHead.astro still references standalone pagination runtime');
}
fs.writeFileSync(headPath, head, 'utf8');
console.log('[integrate] removed standalone Astro script tag');

const skipped = new Set(['.git', 'node_modules', 'dist', 'reports', 'audit', 'pagefind', '.astro']);
let htmlChanged = 0;
let otherStandaloneRefs = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (file.endsWith('.html')) {
      const before = fs.readFileSync(file, 'utf8');
      const after = before.replace(/<script\b[^>]*\bsrc=["'][^"']*js\/print-pagination\.js(?:\?v=[^"']*)?["'][^>]*><\/script>\s*/gi, '');
      if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        htmlChanged += 1;
      }
    }
  }
}
walk(ROOT);
console.log('[integrate] removed standalone tags from HTML files:', htmlChanged);

function scanRefs(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanRefs(file);
      continue;
    }
    if (!/\.(?:html|astro|js|mjs|json|yml|yaml)$/.test(file)) continue;
    if (file.endsWith('_temp-integrate-print-pagination-runtime.mjs')) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('js/print-pagination.js')) otherStandaloneRefs.push(path.relative(ROOT, file));
  }
}
scanRefs(ROOT);
if (otherStandaloneRefs.length) {
  throw new Error(`standalone runtime references remain: ${otherStandaloneRefs.join(', ')}`);
}

execFileSync(process.execPath, ['scripts/cache-bust.js', '--write'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/cache-bust.js'], { stdio: 'inherit' });
console.log('[integrate] cache-bust canon updated');
