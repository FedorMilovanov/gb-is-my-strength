#!/usr/bin/env node
/**
 * Validate that shared/system files are published through a canonical branch.
 *
 * CI must pass --base and --head so the guard inspects the actual commit range.
 * Local use without a range inspects staged and unstaged changes.
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PROTECTED_PATTERNS = [
  'AGENTS.md',
  'AGENTS-REFERENCE.md',
  'README.md',
  'package.json',
  'package-lock.json',
  '.github/',
  'docs/WORK_MODES.md',
  'docs/LANE_LOCK_POLICY.md',
  'docs/OWNER-INVARIANTS.md',
  'docs/AGENT_PUSH_MODEL.md',
  'docs/GIT_WORKTREE_POLICY.md',
  'docs/BRANCH_LIFECYCLE_V4.md',
  'astro.config.',
  'tsconfig.',
  'sw.js',
  'migration/',
  'data/series.json',
  'data/search-manifest.json',
  'data/public-content-baseline.json',
  'src/layouts/',
  'css/',
  'js/',
  'karty/_engine/',
  'scripts/guard-shared-files.js',
  'scripts/check-workflows.js',
  'scripts/repository-control-plane-audit.mjs',
  'scripts/cache-bust.js',
  'scripts/copy-legacy-to-dist.js',
];

const CANONICAL_BRANCH_PREFIXES = [
  'lane/',
  'agent/',
  'hotfix/',
  'release/',
  'dependabot/',
];

function runGit(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30_000,
  }).trim();
}

function matchesPattern(file, pattern) {
  if (pattern.endsWith('/')) {
    return file === pattern.slice(0, -1) || file.startsWith(pattern);
  }
  if (pattern.endsWith('.')) return file.startsWith(pattern);
  return file === pattern;
}

function isProtected(file) {
  return PROTECTED_PATTERNS.some((pattern) => matchesPattern(file, pattern));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { warn: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--base') options.base = args[++index];
    else if (arg === '--head') options.head = args[++index];
    else if (arg === '--branch') options.branch = args[++index];
    else if (arg === '--warn') options.warn = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function verifyCommit(ref, label) {
  if (!ref) throw new Error(`${label} SHA is required`);
  runGit(['rev-parse', '--verify', `${ref}^{commit}`]);
}

function getRangeFiles(base, head) {
  verifyCommit(base, 'Base');
  verifyCommit(head, 'Head');
  const output = runGit([
    'diff',
    '--name-only',
    '--diff-filter=ACMRD',
    base,
    head,
    '--',
  ]);
  return output ? output.split('\n').filter(Boolean) : [];
}

function getWorkingTreeFiles() {
  const files = new Set();
  for (const args of [
    ['diff', '--name-only', '--cached', '--'],
    ['diff', '--name-only', '--'],
  ]) {
    const output = runGit(args);
    if (output) output.split('\n').filter(Boolean).forEach((file) => files.add(file));
  }
  return [...files];
}

function currentBranch() {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

function branchIsCanonical(branch) {
  return branch === 'main' || CANONICAL_BRANCH_PREFIXES.some((prefix) => branch.startsWith(prefix));
}

function main() {
  const options = parseArgs();
  const ranged = Boolean(options.base || options.head);
  if (ranged && !(options.base && options.head)) {
    throw new Error('Use --base and --head together');
  }

  const files = ranged
    ? getRangeFiles(options.base, options.head)
    : getWorkingTreeFiles();

  if (process.env.GITHUB_ACTIONS === 'true' && !ranged) {
    throw new Error('CI must provide --base and --head; refusing an empty working-tree check');
  }

  const branch = options.branch || currentBranch();
  const protectedFiles = files.filter(isProtected);

  console.log(`Shared-files guard: ${files.length} changed file(s), ${protectedFiles.length} protected.`);
  if (protectedFiles.length) {
    console.log(protectedFiles.map((file) => `  - ${file}`).join('\n'));
  }

  if (!protectedFiles.length || branchIsCanonical(branch)) {
    console.log(`Shared-files guard passed for branch '${branch}'.`);
    return;
  }

  const message = [
    `Protected files changed on non-canonical branch '${branch}'.`,
    `Use one of: ${CANONICAL_BRANCH_PREFIXES.join(', ')}`,
  ].join('\n');

  if (options.warn) {
    console.warn(`WARNING: ${message}`);
    return;
  }
  throw new Error(message);
}

try {
  main();
} catch (error) {
  console.error(`Shared-files guard failed: ${error.message}`);
  process.exitCode = 1;
}
