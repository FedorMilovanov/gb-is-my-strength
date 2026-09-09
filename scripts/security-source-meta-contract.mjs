#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.astro', '.html', '.mdx', '.jsx', '.tsx']);
const EXCLUDED_DIRS = new Set([
  '.git',
  '.astro',
  'node_modules',
  'dist',
  'reports',
  'coverage',
  'playwright-report',
  'test-results',
]);
const CHANGED_ONLY = process.argv.includes('--changed');

const META_TAG = /<meta\b[^>]*>/gi;
const TRANSPORT_ONLY_HTTP_EQUIV = /\bhttp-equiv\s*=\s*(["'])?x-content-type-options\1?/i;

function isSourceFile(file) {
  return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known' && entry.isDirectory()) continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;

    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(absolute, output);
      continue;
    }
    if (!entry.isFile() || !isSourceFile(entry.name)) continue;
    output.push(absolute);
  }
  return output;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function changedFiles() {
  let base = String(process.env.BASE_SHA || '').trim();
  const head = String(process.env.HEAD_SHA || '').trim();
  if (!base || !head) throw new Error('BASE_SHA and HEAD_SHA are required with --changed');
  if (/^0+$/.test(base)) base = git(['rev-parse', `${head}^`]);

  const names = git(['diff', '--name-only', '--diff-filter=ACMR', base, head, '--']);
  if (!names) return [];
  return names
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
    .filter(isSourceFile)
    .map((name) => path.join(ROOT, name))
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}

const failures = [];
const files = CHANGED_ONLY ? changedFiles() : walk(ROOT);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(META_TAG)) {
    const tag = match[0];
    if (!TRANSPORT_ONLY_HTTP_EQUIV.test(tag)) continue;
    const offset = match.index ?? 0;
    const line = source.slice(0, offset).split('\n').length;
    failures.push({
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      line,
      tag: tag.replace(/\s+/g, ' ').trim(),
    });
  }
}

if (failures.length) {
  console.error('❌ Transport-only HTTP response directives must not be represented as HTML meta pragmas.');
  console.error('   X-Content-Type-Options belongs to the real HTTP transport owner.');
  for (const failure of failures) {
    console.error(`   - ${failure.file}:${failure.line}: ${failure.tag}`);
  }
  process.exit(1);
}

const mode = CHANGED_ONLY ? 'changed-source ratchet' : 'full source census';
console.log(`✅ Security source meta contract (${mode}): ${files.length} HTML-producing source files checked; forbidden transport meta pragmas = 0.`);
