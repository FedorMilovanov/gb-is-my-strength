#!/usr/bin/env node
/**
 * guard-shared-files.js — AGENT PROTECTION v3.0 (simplified FAST/LANE/SYSTEM)
 *
 * Runs as:
 *   - pre-push hook (recommended)
 *   - CI gate: npm run guard:shared-files
 *
 * Rules:
 *   1. shared/system file changed outside lane/* -> FAIL
 *   2. shared/system file changed on lane/* without [LANE lane/X] -> FAIL
 *   3. SYSTEM file changed in a route lane -> FAIL
 *   4. SYSTEM file changed in lane/system-* or lane/protection-* -> PASS
 *   5. shared data changed in lane/shared-* -> PASS
 *   6. SAFE docs/reports/audit -> PASS
 */
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// SYSTEM files: only lane/system-* or lane/protection-*
const SYSTEM_PATTERNS = [
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  '.github/workflows/',
  'astro.config.',
  'tsconfig.',
  'sw.js',
  'migration/',
  'scripts/cache-bust.js',
  'scripts/copy-legacy-to-dist.js',
  'scripts/check-workflows.js',
  'src/layouts/',
  'css/',
  'js/',
  'karty/_engine/',
];

// SHARED data/docs: only lane/shared-*, lane/system-* or lane/protection-*
const SHARED_PATTERNS = [
  'docs/WORK_MODES.md',
  'docs/LANE_LOCK_POLICY.md',
  'data/series.json',
  'data/search-manifest.json',
  'data/public-content-baseline.json',
  'scripts/guard-shared-files.js',
  'scripts/check-data-consistency.js',
  'scripts/audit-pro.js',
  'scripts/visual-parity-screenshots.js',
];

// SAFE: always allowed
const SAFE_PATTERNS = [
  'docs/refactor-2026/lanes/',
  'docs/research/',
  'reports/',
  'audit/',
  'sitemap.xml',
  'feed.xml',
  'robots.txt',
  'CNAME',
  '.gitignore',
  '.nojekyll',
  'llms.txt',
];

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/')) {
    return file.startsWith(pattern) || file === pattern.slice(0, -1);
  }
  if (pattern.endsWith('.')) {
    return file.startsWith(pattern);
  }
  return file === pattern;
}

function isSafe(file) {
  return SAFE_PATTERNS.some((p) => matchesPattern(file, p));
}

function isSystem(file) {
  return SYSTEM_PATTERNS.some((p) => matchesPattern(file, p));
}

function isShared(file) {
  return SHARED_PATTERNS.some((p) => matchesPattern(file, p));
}


function collectFilesRecursive(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFilesRecursive(abs, predicate, acc);
    else if (predicate(abs)) acc.push(abs);
  }
  return acc;
}

function contextAllowsSupersededFormula(lines, idx) {
  const start = Math.max(0, idx - 3);
  const end = Math.min(lines.length, idx + 4);
  const window = lines.slice(start, end).join(' ');
  return /SUPERSEDED|FORBIDDEN|WRONG|POS-01|NEVER\s+re-?introduce/i.test(window);
}

function guardHermeneuticsPositionTruth(problems) {
  const agentsPath = path.join(ROOT, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agents = fs.readFileSync(agentsPath, 'utf8');
    if (!agents.includes('right: max(8.5vw, env(safe-area-inset-right, 0px));') ||
        !agents.includes('right: max(4.5vw, env(safe-area-inset-right, 0px));')) {
      problems.push('FAIL: AGENTS.md §3.10 must preserve Hermeneutics canonical position: desktop 8.5vw and mobile 4.5vw.');
    }
  }

  const candidates = [agentsPath]
    .concat(collectFilesRecursive(path.join(ROOT, 'docs'), (abs) => /\.(md|mdx|txt)$/i.test(abs)))
    .concat(collectFilesRecursive(path.join(ROOT, 'css'), (abs) => /\.css$/i.test(abs)))
    .concat(collectFilesRecursive(path.join(ROOT, 'scripts'), (abs) => /\.(js|mjs|cjs)$/i.test(abs)));

  const forbiddenFormula = /right:\s*max\(calc\(\(100vw\s*-\s*min\(820px,\s*92vw\)\)\s*\/\s*2\s*-\s*28px\),\s*16px\)/;
  const forbiddenCalc = /100vw\s*-\s*min\(820px,\s*92vw\)[^\n]{0,120}-\s*28px/;
  const seen = new Set();
  for (const abs of candidates) {
    if (seen.has(abs) || !fs.existsSync(abs)) continue;
    seen.add(abs);
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if ((forbiddenFormula.test(line) || forbiddenCalc.test(line)) && !contextAllowsSupersededFormula(lines, idx)) {
        problems.push(
          `FAIL: ${rel}:${idx + 1} reintroduces old Hermeneutics POS-01 -28px formula without SUPERSEDED/FORBIDDEN/POS-01 context.`
        );
      }
    });
  }
}


function guardFloatingClusterCssSanitation(problems) {
  const cssPath = path.join(ROOT, 'css', 'floating-cluster.css');
  if (!fs.existsSync(cssPath)) return;
  const lines = fs.readFileSync(cssPath, 'utf8').split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (/^\s*\[data-gill-v16\]\s+(background|border-color|color|transform|opacity|box-shadow)\b/.test(line)) {
      problems.push(
        `FAIL: css/floating-cluster.css:${idx + 1} has malformed transition/declaration fragment with [data-gill-v16] inside a property value.`
      );
    }
    if (/,\s*\[data-gill-v16\]\s*$/.test(line)) {
      problems.push(
        `FAIL: css/floating-cluster.css:${idx + 1} has dangling [data-gill-v16] selector fragment from a malformed comma split.`
      );
    }
  });

  lines.forEach((line, idx) => {
    if (!line.includes('{') || !line.includes(',') || !line.includes('[data-gill-v16]')) return;
    const selector = line.split('{', 1)[0];
    const parts = selector.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2 || !parts[0].includes('[data-gill-v16]')) return;
    for (let i = 1; i < parts.length; i++) {
      if (!parts[i].includes('[data-gill-v16]')) {
        problems.push(
          `FAIL: css/floating-cluster.css:${idx + 1} has unscoped Gill v16 comma selector segment: "${parts[i]}".`
        );
      }
    }
  });
}

function getChangedFiles() {
  const changed = new Set();
  try {
    const staged = execSync('git diff --name-only --cached', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    });
    staged.split('\n').filter(Boolean).forEach((f) => changed.add(f.trim()));
  } catch (_) {}
  try {
    const unstaged = execSync('git diff --name-only', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 10_000,
    });
    unstaged.split('\n').filter(Boolean).forEach((f) => changed.add(f.trim()));
  } catch (_) {}
  return [...changed];
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

function isLaneBranch(branch) {
  return branch.startsWith('lane/');
}

function isSystemLane(branch) {
  return branch.startsWith('lane/system-') || branch.startsWith('lane/protection-');
}

function isSharedLane(branch) {
  return branch.startsWith('lane/shared-');
}

function hasLaneTag(msg, branch) {
  return msg.includes(`[LANE ${branch}]`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--branch') opts.branch = args[++i];
    else if (args[i] === '--diff') opts.diff = args[++i];
    else if (args[i] === '--allow') opts.allow = args[++i];
    else if (args[i] === '--quiet') opts.quiet = true;
    else if (args[i] === '--warn') opts.warn = true;
  }
  return opts;
}

function main() {
  const opts = parseArgs();
  const branch = opts.branch || getCurrentBranch();
  const commitMsg = getLastCommitMessage();
  const lane = isLaneBranch(branch);
  const systemLane = isSystemLane(branch);
  const sharedLane = isSharedLane(branch);
  const laneTag = hasLaneTag(commitMsg, branch);

  let files = [];
  if (opts.diff) {
    files = getChangedFiles(); // range not implemented for simplicity
  } else {
    files = getChangedFiles();
  }

  const problems = [];

  guardHermeneuticsPositionTruth(problems);
  guardFloatingClusterCssSanitation(problems);

  for (const file of files) {
    if (isSafe(file)) continue;

    const system = isSystem(file);
    const shared = isShared(file);

    if (!system && !shared) continue;

    if (!lane) {
      problems.push(
        `FAIL: '${file}' is shared/system and was changed on non-lane branch '${branch}'.\n` +
        `  → Create a lane: git checkout -b lane/<name>.\n` +
        `  → Use [LANE lane/<name>] in commit message.`
      );
      continue;
    }

    if (!laneTag) {
      problems.push(
        `FAIL: '${file}' is shared/system and changed on lane branch '${branch}',\n` +
        `  but commit message lacks [LANE ${branch}].\n` +
        `  → Add [LANE ${branch}] to commit message.`
      );
      continue;
    }

    // NEW RULES (P1 Fix):
    // 1. system lanes (lane/system-*, lane/protection-*) CAN modify SYSTEM and SHARED files automatically.
    // 2. shared lanes (lane/shared-*) CAN modify SHARED files automatically.
    // 3. route lanes CANNOT modify SYSTEM or SHARED files without explicit [ALLOW_SHARED].

    if (system && !systemLane && !commitMsg.includes('[ALLOW_SHARED]')) {
      problems.push(
        `FAIL: '${file}' is a SYSTEM file.\n` +
        `  → Only lane/system-* or lane/protection-* can modify this automatically.\n` +
        `  → Current branch '${branch}' is a route lane, not system lane.\n` +
        `  → Use [ALLOW_SHARED] in commit message if absolutely critical.`
      );
      continue;
    }

    if (shared && !sharedLane && !systemLane && !commitMsg.includes('[ALLOW_SHARED]')) {
      problems.push(
        `FAIL: '${file}' is shared data.\n` +
        `  → Only lane/shared-*, lane/system-* or lane/protection-* can modify this automatically.\n` +
        `  → Current branch '${branch}' is a route lane.\n` +
        `  → Use [ALLOW_SHARED] in commit message if absolutely critical.`
      );
      continue;
    }
  }

  if (!opts.quiet) {
    console.log('');
    console.log('=== SHARED FILES GUARD v3.0 ===');
    console.log(`Branch: ${branch}`);
    console.log(`Lane: ${lane} | System lane: ${systemLane} | Shared lane: ${sharedLane}`);
    console.log(`[LANE] tag: ${laneTag}`);
    console.log(`Files checked: ${files.length}`);
    const touched = files.filter((f) => !isSafe(f) && (isSystem(f) || isShared(f)));
    console.log(`Shared/system files touched: ${touched.length}`);
    if (touched.length > 0) {
      console.log('');
      touched.forEach((f) => console.log('  - ' + f));
    }
  }

  if (problems.length > 0) {
    console.error('');
    if (opts.warn) {
      console.error('⚠️  GUARD WARNING (lane branch, not blocking CI)');
    } else {
      console.error('❌ GUARD FAILED');
    }
    console.error('');
    problems.forEach((p) => console.error(p));
    console.error('');
    if (!opts.warn) {
      console.error('Fix the issue or use a proper lane branch.');
      process.exit(1);
    }
  }

  if (!opts.quiet) {
    console.log('');
    console.log('✅ Shared files guard PASSED');
  }
  process.exit(0);
}

main();
