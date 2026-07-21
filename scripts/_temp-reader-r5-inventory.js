#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'pagefind', 'reports', 'audit', '.astro',
  'docs', 'coverage', 'vendor',
]);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.astro', '.html']);

const RULES = [
  {
    id: 'body-style-writer',
    severity: 'migration',
    regex: /(?:document\.)?body\.style\.(?:overflow|position|top|width|left|right|height)\s*=/g,
  },
  {
    id: 'html-style-writer',
    severity: 'migration',
    regex: /document\.documentElement\.style\.(?:overflow|position|top|width|height)\s*=/g,
  },
  {
    id: 'style-set-property-writer',
    severity: 'migration',
    regex: /\.style\.setProperty\(\s*['"](?:overflow|position|top|width|height)['"]/g,
  },
  {
    id: 'style-remove-property-writer',
    severity: 'migration',
    regex: /\.style\.removeProperty\(\s*['"](?:overflow|position|top|width|height)['"]/g,
  },
  {
    id: 'scroll-api',
    severity: 'coordination',
    regex: /\b(?:lockScroll|unlockScroll|scrollLock|scrollUnlock|forceUnlock|forceRecover|ensureLockState|_scrollLock\w*)\b/g,
  },
  {
    id: 'global-scroll-api-write',
    severity: 'conflict',
    regex: /(?:window\.)?SiteUtils\.(?:lockScroll|unlockScroll)\s*=|Object\.assign\(\s*(?:window\.)?SiteUtils/g,
  },
  {
    id: 'overlay-dialog-semantics',
    severity: 'lifecycle',
    regex: /(?:role\s*=\s*['"]dialog['"]|aria-modal|aria-hidden|\binert\b)/g,
  },
  {
    id: 'overlay-naming',
    severity: 'lifecycle',
    regex: /(?:data-[\w-]*(?:overlay|sheet|dialog|modal)|\b(?:overlay|sheet|dialog|modal|backdrop)\b)/gi,
  },
  {
    id: 'escape-handler',
    severity: 'keyboard',
    regex: /(?:\.key\s*===?\s*['"]Escape['"]|\.key\s*==\s*['"]Escape['"]|keyCode\s*===?\s*27|case\s+['"]Escape['"])/g,
  },
  {
    id: 'keydown-handler',
    severity: 'keyboard',
    regex: /addEventListener\(\s*['"]keydown['"]|onkeydown\s*=/g,
  },
  {
    id: 'focus-operation',
    severity: 'focus',
    regex: /(?:\.focus\s*\(|document\.activeElement|focusTrap|trapFocus|restoreFocus|returnFocus)/g,
  },
  {
    id: 'route-recovery',
    severity: 'recovery',
    regex: /addEventListener\(\s*['"](?:pagehide|beforeunload|popstate|visibilitychange)['"]/g,
  },
];

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

function excerptAt(text, index) {
  const start = text.lastIndexOf('\n', index) + 1;
  const endRaw = text.indexOf('\n', index);
  const end = endRaw === -1 ? text.length : endRaw;
  return text.slice(start, end).trim().replace(/\s+/g, ' ').slice(0, 300);
}

const matches = [];
for (const file of walk(ROOT)) {
  const rel = relative(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match;
    while ((match = rule.regex.exec(text))) {
      matches.push({
        rule: rule.id,
        severity: rule.severity,
        file: rel,
        line: lineNumberAt(text, match.index),
        token: match[0].slice(0, 160),
        excerpt: excerptAt(text, match.index),
      });
      if (match[0].length === 0) rule.regex.lastIndex += 1;
    }
  }
}

matches.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));

const byRule = {};
const byFile = new Map();
for (const item of matches) {
  byRule[item.rule] = (byRule[item.rule] || 0) + 1;
  if (!byFile.has(item.file)) byFile.set(item.file, []);
  byFile.get(item.file).push(item);
}

const directWriterRules = new Set([
  'body-style-writer', 'html-style-writer', 'style-set-property-writer', 'style-remove-property-writer',
]);
const directWriterFiles = [...byFile.entries()]
  .filter(([, items]) => items.some((item) => directWriterRules.has(item.rule)))
  .map(([file, items]) => ({ file, matches: items.filter((item) => directWriterRules.has(item.rule)) }));
const conflictFiles = [...byFile.entries()]
  .filter(([, items]) => items.some((item) => item.rule === 'global-scroll-api-write'))
  .map(([file, items]) => ({ file, matches: items.filter((item) => item.rule === 'global-scroll-api-write') }));
const lifecycleCandidates = [...byFile.entries()]
  .map(([file, items]) => ({
    file,
    categories: [...new Set(items.map((item) => item.severity))].sort(),
    rules: [...new Set(items.map((item) => item.rule))].sort(),
    matchCount: items.length,
  }))
  .filter((item) => item.categories.filter((category) => ['lifecycle', 'keyboard', 'focus', 'coordination', 'migration'].includes(category)).length >= 2)
  .sort((a, b) => b.matchCount - a.matchCount || a.file.localeCompare(b.file));

const result = {
  generatedAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
  scannedFiles: walk(ROOT).length,
  matchCount: matches.length,
  countsByRule: Object.fromEntries(Object.entries(byRule).sort()),
  directWriterFiles,
  globalApiConflictFiles: conflictFiles,
  lifecycleCandidates,
  matches,
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'reports/reader-r5-overlay-runtime-inventory.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

const md = [];
md.push('# Reader R5 overlay runtime inventory');
md.push('');
md.push(`- Source: \`${result.sourceHead}\``);
md.push(`- Scanned files: **${result.scannedFiles}**`);
md.push(`- Pattern matches: **${result.matchCount}**`);
md.push(`- Direct writer files: **${directWriterFiles.length}**`);
md.push(`- Global scroll API overwrite files: **${conflictFiles.length}**`);
md.push(`- Multi-category lifecycle candidates: **${lifecycleCandidates.length}**`);
md.push('');
md.push('## Counts by rule');
md.push('');
for (const [rule, count] of Object.entries(result.countsByRule)) md.push(`- \`${rule}\`: ${count}`);
md.push('');
md.push('## Direct body/html style writers');
md.push('');
for (const entry of directWriterFiles) {
  md.push(`### \`${entry.file}\``);
  md.push('');
  for (const item of entry.matches) md.push(`- L${item.line} · \`${item.rule}\` · ${item.excerpt}`);
  md.push('');
}
md.push('## Global scroll API writes');
md.push('');
for (const entry of conflictFiles) {
  md.push(`### \`${entry.file}\``);
  md.push('');
  for (const item of entry.matches) md.push(`- L${item.line} · ${item.excerpt}`);
  md.push('');
}
md.push('## Highest-density lifecycle candidates');
md.push('');
md.push('| File | Matches | Categories | Rules |');
md.push('|---|---:|---|---|');
for (const item of lifecycleCandidates.slice(0, 100)) {
  md.push(`| \`${item.file}\` | ${item.matchCount} | ${item.categories.join(', ')} | ${item.rules.join(', ')} |`);
}
fs.writeFileSync(path.join(ROOT, 'reports/reader-r5-overlay-runtime-inventory.md'), md.join('\n') + '\n', 'utf8');

console.log(JSON.stringify({
  sourceHead: result.sourceHead,
  scannedFiles: result.scannedFiles,
  matchCount: result.matchCount,
  directWriterFiles: directWriterFiles.length,
  globalApiConflictFiles: conflictFiles.length,
  lifecycleCandidates: lifecycleCandidates.length,
  countsByRule: result.countsByRule,
}, null, 2));
