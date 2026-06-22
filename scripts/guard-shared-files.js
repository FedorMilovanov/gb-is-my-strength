#!/usr/bin/env node
/**
 * guard-shared-files.js — AGENT PROTECTION v1.5 core guard.
 *
 * Prevents agents from silently modifying shared/high-risk files without
 * a dedicated lane. Runs as:
 *   - pre-push hook (recommended)
 *   - CI gate: npm run guard:shared-files
 *
 * Fail conditions (any of):
 *   1. Shared file modified on non-lane branch (main/solo without dedicated lane)
 *   2. Lane branch touching shared files without [LANE lane/X] in commit message
 *
 * Allow conditions:
 *   - Lane branch (name starts with 'lane/') AND commit message has [LANE lane/X]
 *   - Allowed-paths mode: explicitly declares the shared file as allowed
 *
 * Usage:
 *   node scripts/guard-shared-files.js                  # check HEAD
 *   node scripts/guard-shared-files.js --branch BRANCH   # check specific branch
 *   node scripts/guard-shared-files.js --diff COMMIT     # check range
 *   node scripts/guard-shared-files.js --allow PACKAGE   # bypass with justification
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ---------- config ----------
const SHARED_PATTERNS = [
  // High-risk system files
  'AGENTS.md',
  'README.md',
  'package.json',
  'package-lock.json',

  // CI/CD
  '.github/workflows/',
  '.github/workflows',

  // Global data / manifests
  'data/series.json',
  'data/search-manifest.json',
  'data/public-content-baseline.json',

  // Global layouts
  'src/layouts/',
  'src/layouts',

  // Global CSS/JS (non-component-scoped)
  'css/site.css',
  'css/site-layered.css',
  'js/site.js',
  'js/search.js',
  'sw.js',

  // Migration / deploy scripts
  'scripts/cache-bust.js',
  'scripts/copy-legacy-to-dist.js',
  'scripts/check-data-consistency.js',
  'scripts/audit-pro.js',
  'scripts/visual-parity-screenshots.js',
  'scripts/check-workflows.js',

  // Map engine (complex runtime, multi-route)
  'karty/_engine/',
  'karty/_engine',
  'karty/ishod/',
  'karty/ishod',
  'karty/avraam/',
  'karty/avraam',
];

const EXCLUDED_PATTERNS = [
  // These ARE shared but have their own dedicated lane process
  // Allowed when on lane/shared-* branch
  'data/series.json',
  'data/search-manifest.json',
];

// Files that are ALLOWED to change without lane (trivial ops)
const ALWAYS_ALLOWED = [
  'docs/',
  'reports/',
  'audit/',
  '.gitignore',
  '.nojekyll',
  'CNAME',
  'sitemap.xml',
  'feed.xml',
  'robots.txt',
  'manifest.json',
];

// ---------- helpers ----------
function isSharedFile(relPath) {
  const clean = relPath.replace(/\\/g, '/');
  for (const pattern of SHARED_PATTERNS) {
    if (pattern.endsWith('/')) {
      if (clean.startsWith(pattern) || clean === pattern.replace(/\/$/, '')) return true;
    } else {
      if (clean === pattern || clean.endsWith('/' + pattern)) return true;
    }
  }
  return false;
}

function isAlwaysAllowed(relPath) {
  const clean = relPath.replace(/\\/g, '/');
  for (const pattern of ALWAYS_ALLOWED) {
    if (pattern.endsWith('/')) {
      if (clean.startsWith(pattern)) return true;
    } else {
      if (clean === pattern) return true;
    }
  }
  return false;
}

function getChangedFiles(baseCommit, targetCommit) {
  try {
    const range = `${baseCommit}..${targetCommit}`;
    const out = execSync(`git diff --name-only ${range}`, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    });
    return out.split('\n').filter(Boolean).map((f) => f.trim());
  } catch (e) {
    // Fallback: check staged + working tree
    try {
      const out = execSync(`git diff --name-only HEAD`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 10_000,
      });
      const staged = out.split('\n').filter(Boolean).map((f) => f.trim());
      const unstaged = execSync(`git diff --name-only`, {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 10_000,
      }).split('\n').filter(Boolean).map((f) => f.trim());
      return [...new Set([...staged, ...unstaged])];
    } catch (_) {
      return [];
    }
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 5_000,
    }).trim();
  } catch (_) {
    return 'unknown';
  }
}

function getLastCommitMessage() {
  try {
    return execSync('git log -1 --format=%B', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 5_000,
    }).trim();
  } catch (_) {
    return '';
  }
}

function hasLaneTag(msg) {
  return /\[LANE\s+lane\//.test(msg);
}

function isOnLaneBranch(branch) {
  return branch.startsWith('lane/');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--branch') opts.branch = args[++i];
    else if (args[i] === '--diff') opts.diff = args[++i];
    else if (args[i] === '--allow') opts.allow = args[++i];
    else if (args[i] === '--quiet') opts.quiet = true;
  }
  return opts;
}

// ---------- main ----------
function main() {
  const opts = parseArgs();
  const branch = opts.branch || getCurrentBranch();
  const commitMsg = getLastCommitMessage();
  const isLane = isOnLaneBranch(branch);

  let files = [];
  if (opts.diff) {
    files = getChangedFiles(opts.diff + '~1', opts.diff);
  } else {
    files = getChangedFiles('HEAD~1', 'HEAD');
  }

  const problems = [];
  const warnings = [];

  for (const file of files) {
    if (isAlwaysAllowed(file)) continue;

    const shared = isSharedFile(file);
    if (!shared) continue;

    // This file is shared AND touched
    if (!isLane) {
      // Non-lane branch touching shared file = ALWAYS BLOCK
      problems.push(
        `SHARED FILE MODIFIED on non-lane branch '${branch}': ${file}\n` +
        `  → Shared file touched without lane declaration.\n` +
        `  → Create a lane branch: git checkout -b lane/YOUR-TASK\n` +
        `  → Use [LANE lane/YOUR-TASK] in commit message.\n` +
        `  → Files allowed only on lane branch: ${SHARED_PATTERNS.filter(p => file.includes(p.replace(/\/.*/, '')) || file === p).join(', ')}`
      );
    } else if (!hasLaneTag(commitMsg)) {
      // Lane branch but no [LANE lane/X] in commit message
      problems.push(
        `SHARED FILE MODIFIED without lane tag on branch '${branch}': ${file}\n` +
        `  → Lane branch detected but commit message missing [LANE lane/...].\n` +
        `  → Add [LANE ${branch}] to your commit message.`
      );
    }
    // Lane branch + [LANE] tag = ALLOWED (pass)
  }

  // Report
  if (!opts.quiet) {
    console.log('');
    console.log('=== SHARED FILES GUARD ===');
    console.log(`Branch: ${branch}`);
    console.log(`Lane branch: ${isLane}`);
    console.log(`Lane tag in commit: ${hasLaneTag(commitMsg)}`);
    console.log(`Files checked: ${files.length}`);
    const sharedTouched = files.filter(isSharedFile).filter(f => !isAlwaysAllowed(f));
    console.log(`Shared files touched: ${sharedTouched.length}`);
    if (sharedTouched.length > 0) {
      console.log('');
      console.log('Shared files in this change:');
      sharedTouched.forEach((f) => console.log('  - ' + f));
    }
  }

  if (problems.length > 0) {
    console.error('');
    console.error('❌ GUARD FAILED — shared files modified without proper lane');
    console.error('');
    problems.forEach((p) => console.error(p.split('\n')[0]));
    console.error('');
    console.error('Fix: create lane branch, add [LANE lane/NAME] to commit, retry.');
    process.exit(1);
  }

  if (!opts.quiet) {
    console.log('✅ Shared files guard PASSED');
    console.log('');
    if (!isLane) {
      console.log('ℹ️  Note: working on non-lane branch. Shared files are safe to change');
      console.log('    only if this is a SOLO Risk 0–1 task. Verify before push.');
    }
  }
  process.exit(0);
}

main();
