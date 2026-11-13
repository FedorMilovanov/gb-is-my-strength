#!/usr/bin/env node
/**
 * §2.6 — Typograf: Fail-closed Russian material typography gate & helper
 * (`SYS-MATERIAL-TYPOGRAPHY-GATE-FAILOPEN`).
 *
 * Authority rules:
 * 1. Immutable `reference-only` and `built-app` HTML snapshots declared in
 *    route profiles are NEVER mutated or flagged as mutable source targets.
 * 2. Both `--dry-run` (`npm run typograf:dry`) and `--check` fail closed
 *    (exit code 1) whenever any mutable HTML surface or built `dist/` HTML
 *    page contains Russian straight ASCII quotes (`"…кириллица…"`) or spaced
 *    ASCII hyphens between Cyrillic words (`слово - слово`) in visible prose
 *    text nodes (parsed via `parse5`, skipping code/script/noscript/foreign
 *    `[lang]`).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const parse5 = require('parse5');
const { loadRouteRecords } = require('./lib/route-source-contract');
const {
  classifyLegacyAuthority,
  resolveDeclaredLegacyReference,
} = require('./lib/legacy-source-authority');

const ROOT = path.resolve(__dirname, '..');
const SKIP_TAG_RE = /^(?:script|style|noscript|code|pre|kbd|samp|svg|math|textarea)$/i;
const CYRILLIC_RE = /[А-Яа-яЁё]/;
const STRAIGHT_QUOTE_RE = /"([^"\n]{1,240})"/g;
const SPACED_HYPHEN_RE = /[А-Яа-яЁё]\s+-\s+[А-Яа-яЁё]/g;

function getAttr(node, name) {
  return node.attrs ? (node.attrs.find((a) => a.name === name)?.value ?? null) : null;
}

function scanHtmlTypography(html) {
  const doc = parse5.parse(String(html));
  const issues = [];

  function walk(node, ctx) {
    const tag = node.tagName || '';
    const skip = ctx.skip || SKIP_TAG_RE.test(tag);
    const langAttr = getAttr(node, 'lang');
    const foreign = langAttr ? !/^ru\b/i.test(langAttr) : ctx.foreign;

    if (node.nodeName === '#text' && !skip && !foreign) {
      const value = node.value || '';
      for (const match of value.matchAll(STRAIGHT_QUOTE_RE)) {
        if (CYRILLIC_RE.test(match[1])) {
          issues.push({ kind: 'straight-quotes', sample: match[0] });
        }
      }
      for (const match of value.matchAll(SPACED_HYPHEN_RE)) {
        issues.push({ kind: 'spaced-ascii-hyphen', sample: match[0] });
      }
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        walk(child, { skip, foreign });
      }
    }
  }

  walk(doc, { skip: false, foreign: false });
  return issues;
}

function collectImmutableHtmlPaths(root = ROOT) {
  const protectedPaths = new Set();
  const { records } = loadRouteRecords(root);
  for (const record of records) {
    const profile = record.profile || {};
    const authority = classifyLegacyAuthority(profile);
    if (record.owner?.owner === 'built-app' || authority.status === 'reference-only') {
      const resolved = resolveDeclaredLegacyReference(profile, {
        route: record.route,
        mustExist: false,
      });
      if (resolved?.logicalPath) {
        protectedPaths.add(path.resolve(root, resolved.logicalPath));
      }
    }
  }
  return protectedPaths;
}

function collectHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'pagefind') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtmlFiles(abs, out);
    else if (entry.name.endsWith('.html')) out.push(abs);
  }
  return out;
}

function collectTargetFiles(root = ROOT) {
  const immutable = collectImmutableHtmlPaths(root);
  const targets = [];

  const root404 = path.join(root, '404.html');
  if (fs.existsSync(root404) && !immutable.has(path.resolve(root404))) {
    targets.push(root404);
  }

  const articlesDir = path.join(root, 'articles');
  for (const fp of collectHtmlFiles(articlesDir)) {
    if (!immutable.has(path.resolve(fp))) {
      targets.push(fp);
    }
  }

  const distDir = path.join(root, 'dist');
  if (fs.existsSync(distDir)) {
    for (const fp of collectHtmlFiles(distDir)) {
      targets.push(fp);
    }
  }

  return targets.sort();
}

function runCli(argv = process.argv.slice(2), root = ROOT) {
  const checkMode = argv.includes('--check') || argv.includes('--dry-run') || argv.length === 0;
  const targets = collectTargetFiles(root);
  console.log(`\nGB TYPOGRAF ${checkMode ? '(fail-closed check)' : ''}`);
  let failedFiles = 0;

  for (const fp of targets) {
    const html = fs.readFileSync(fp, 'utf8');
    const issues = scanHtmlTypography(html);
    if (issues.length > 0) {
      failedFiles += 1;
      const rel = path.relative(root, fp).replace(/\\/g, '/');
      const preview = issues.slice(0, 3).map((i) => `${i.kind}: ${i.sample}`).join('; ');
      console.log(`  [drift] ${rel} (${issues.length}): ${preview}`);
    }
  }

  console.log(`\nScanned: ${targets.length} active/built HTML file(s) · Would change: ${failedFiles} files\n`);
  return failedFiles > 0 ? 1 : 0;
}

module.exports = {
  collectImmutableHtmlPaths,
  collectTargetFiles,
  runCli,
  scanHtmlTypography,
};

if (require.main === module) {
  process.exitCode = runCli();
}
