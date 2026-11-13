#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRangeFiles } from './shared-diff-authority.mjs';

const DERIVED_PROJECTION_PATTERNS = Object.freeze([
  /^data\/legacy-reference-ledger\/(?:manifest\.json|references-\d+\.json)$/,
  /^data\/scripture-search-index\.json$/,
  /^src\/lib\/asset-version\.js$/,
  /^feed\.xml$/,
  /^sitemap\.xml$/,
  /^data\/search-manifest\.json$/,
  /^data\/route-search-policy\.json$/,
]);

const CACHE_BUST_PROJECTION_SURFACE_RE = /\.(?:html|astro)$/;
const CACHE_BUST_TOKEN_RE = /(\?v=)[0-9a-f]{6,12}\b/gi;

function maskCacheBustTokens(line) {
  return String(line).replace(CACHE_BUST_TOKEN_RE, '$1__CACHE_BUST_HASH__');
}

/**
 * Returns true iff a unified diff patch modifies at least one line and every
 * hunk consists strictly of 1:1 line replacements whose only differences are
 * `?v=<hex>` cache-bust query tokens rewritten by `scripts/cache-bust.js`.
 * Fails closed (`false`) on missing/truncated patches, insertions, deletions,
 * or any markup/copy/code change.
 */
export function isCacheBustOnlyPatch(patch) {
  if (typeof patch !== 'string' || patch.trim().length === 0) return false;
  const lines = patch.split(/\r?\n/);
  let sawHunk = false;
  let removed = [];
  let added = [];

  const verifyBlock = () => {
    if (removed.length === 0 && added.length === 0) return true;
    if (removed.length === 0 || removed.length !== added.length) return false;
    for (let i = 0; i < removed.length; i += 1) {
      if (removed[i] === added[i]) return false;
      if (!CACHE_BUST_TOKEN_RE.test(removed[i])) return false;
      CACHE_BUST_TOKEN_RE.lastIndex = 0;
      if (!CACHE_BUST_TOKEN_RE.test(added[i])) return false;
      CACHE_BUST_TOKEN_RE.lastIndex = 0;
      if (maskCacheBustTokens(removed[i]) !== maskCacheBustTokens(added[i])) return false;
    }
    removed = [];
    added = [];
    return true;
  };

  for (const line of lines) {
    if (
      line.startsWith('diff --git ')
      || line.startsWith('index ')
      || line.startsWith('--- ')
      || line.startsWith('+++ ')
    ) {
      continue;
    }
    if (line.startsWith('@@ ')) {
      if (!verifyBlock()) return false;
      sawHunk = true;
      continue;
    }
    if (!sawHunk) continue;
    if (line.startsWith('-')) {
      if (added.length > 0 && !verifyBlock()) return false;
      removed.push(line.slice(1));
    } else if (line.startsWith('+')) {
      added.push(line.slice(1));
    } else if (line.startsWith(' ') || line === '') {
      if (!verifyBlock()) return false;
    } else if (line.startsWith('\\')) {
      continue;
    } else {
      return false;
    }
  }

  return sawHunk && verifyBlock();
}

export function normalizeRepoPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Repository path must be a non-empty string');
  }
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '');
  if (
    normalized.startsWith('/')
    || normalized.includes('\0')
    || normalized.split('/').includes('..')
  ) {
    throw new Error(`Unsafe repository path: ${value}`);
  }
  return normalized;
}

export function isDerivedProjectionPath(value) {
  const file = normalizeRepoPath(value);
  return DERIVED_PROJECTION_PATTERNS.some((pattern) => pattern.test(file));
}

export function predecessorSupersededByCurrent(candidate, currentNumber) {
  const title = typeof candidate.title === 'string' ? candidate.title : '';
  const body = typeof candidate.body === 'string' ? candidate.body : '';
  const text = `${title}\n${body}`;
  const current = String(currentNumber).replace(/[^0-9]/g, '');
  if (!current) return false;
  return [
    new RegExp(`superseded(?:\\s+without\\s+merge)?(?:\\s+by)?\\s+#${current}\\b`, 'i'),
    new RegExp(`replaced(?:\\s+by)?\\s+#${current}\\b`, 'i'),
    new RegExp(`canonical\\s+successor(?:\\s+is|:)?\\s+#${current}\\b`, 'i'),
  ].some((pattern) => pattern.test(text));
}

function normalizeFileList(files) {
  if (!Array.isArray(files)) throw new Error('PR files must be an array');
  return [...new Set(files.map((file) => normalizeRepoPath(file)))].sort();
}

export function analyzeCollisions({ current, currentFiles, currentPatches = {}, candidates }) {
  if (!current || !Number.isInteger(current.number) || current.number <= 0) {
    throw new Error('Current PR number is required');
  }
  if (typeof current.repo !== 'string' || !current.repo.includes('/')) {
    throw new Error('Current repository owner/name is required');
  }
  if (typeof current.baseRef !== 'string' || !current.baseRef) {
    throw new Error('Current PR base ref is required');
  }
  if (!Array.isArray(candidates)) throw new Error('Candidate PR list must be an array');

  const currentSet = new Set(normalizeFileList(currentFiles));
  const blockers = [];
  const warnings = [];
  const ignored = [];

  for (const candidate of candidates) {
    if (!candidate || !Number.isInteger(candidate.number) || candidate.number <= 0) {
      throw new Error('Candidate PR number must be a positive integer');
    }
    if (candidate.number === current.number) continue;

    if (candidate.number > current.number) {
      ignored.push({ number: candidate.number, reason: 'newer-pr-does-not-own-precedence' });
      continue;
    }
    if (candidate.baseRef !== current.baseRef) {
      ignored.push({ number: candidate.number, reason: 'different-base' });
      continue;
    }
    if (candidate.headRepo !== current.repo) {
      ignored.push({ number: candidate.number, reason: 'different-head-repository' });
      continue;
    }
    if (predecessorSupersededByCurrent(candidate, current.number)) {
      ignored.push({ number: candidate.number, reason: 'explicitly-superseded-by-current' });
      continue;
    }

    const candidateFiles = normalizeFileList(candidate.files || []);
    const candidatePatches = candidate.patches && typeof candidate.patches === 'object' ? candidate.patches : {};
    const overlap = candidateFiles.filter((file) => currentSet.has(file));
    if (!overlap.length) continue;

    const isDerivedOverlap = (file) => {
      if (isDerivedProjectionPath(file)) return true;
      if (!CACHE_BUST_PROJECTION_SURFACE_RE.test(file)) return false;
      return isCacheBustOnlyPatch(currentPatches[file]) || isCacheBustOnlyPatch(candidatePatches[file]);
    };

    const derived = overlap.filter(isDerivedOverlap);
    const exclusive = overlap.filter((file) => !isDerivedOverlap(file));

    if (exclusive.length) {
      blockers.push({
        number: candidate.number,
        title: candidate.title || '',
        files: exclusive,
      });
    }
    if (derived.length) {
      warnings.push({
        number: candidate.number,
        title: candidate.title || '',
        files: derived,
      });
    }
  }

  blockers.sort((a, b) => a.number - b.number);
  warnings.sort((a, b) => a.number - b.number);
  ignored.sort((a, b) => a.number - b.number);
  return { blockers, warnings, ignored };
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'gb-is-my-strength-lane-collision-guard',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${url}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function pagedGithubArray({ apiUrl, route, token, hardPageLimit = 30 }) {
  const items = [];
  for (let page = 1; page <= hardPageLimit; page += 1) {
    const separator = route.includes('?') ? '&' : '?';
    const pageItems = await githubJson(`${apiUrl}${route}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(pageItems)) throw new Error(`GitHub API did not return an array for ${route}`);
    items.push(...pageItems);
    if (pageItems.length < 100) return items;
  }
  throw new Error(`GitHub API pagination exceeded ${hardPageLimit} pages for ${route}`);
}

function readEvent(eventPath) {
  if (!eventPath) return {};
  const absolute = path.resolve(eventPath);
  return JSON.parse(fs.readFileSync(absolute, 'utf8'));
}

function prModel(pr, files = [], patches = {}) {
  return {
    number: Number(pr.number),
    title: pr.title || '',
    body: pr.body || '',
    baseRef: pr.base && pr.base.ref ? pr.base.ref : '',
    headRepo: pr.head && pr.head.repo && pr.head.repo.full_name ? pr.head.repo.full_name : '',
    files,
    patches,
  };
}

function loadRangePatchForFile(baseSha, headSha, file) {
  try {
    return execFileSync('git', ['diff', '-U0', `${baseSha}..${headSha}`, '--', file], {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

export async function runCli(env = process.env) {
  const event = readEvent(env.GITHUB_EVENT_PATH);
  const eventName = env.GITHUB_EVENT_NAME || '';
  const eventPr = event.pull_request || null;
  const prNumber = Number(env.PR_NUMBER || (eventPr && eventPr.number));

  if (eventName && eventName !== 'pull_request') {
    console.log(`Lane collision guard: skip event '${eventName}'.`);
    return 0;
  }
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.log('Lane collision guard: no pull request context; skipping.');
    return 0;
  }

  const repo = env.GITHUB_REPOSITORY;
  const token = env.GITHUB_TOKEN;
  const apiUrl = (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
  const baseRef = env.PR_BASE_REF || (eventPr && eventPr.base && eventPr.base.ref);
  const effectiveBaseSha = String(env.EFFECTIVE_BASE_SHA || '').trim();
  const effectiveHeadSha = String(env.EFFECTIVE_HEAD_SHA || '').trim();

  if (!repo || !repo.includes('/')) throw new Error('GITHUB_REPOSITORY owner/name is required');
  if (!token) throw new Error('GITHUB_TOKEN is required for pull-request collision checks');
  if (!baseRef) throw new Error('PR base ref is required');
  if (!effectiveBaseSha || !effectiveHeadSha) {
    throw new Error('EFFECTIVE_BASE_SHA and EFFECTIVE_HEAD_SHA are required; refusing independently based PR-file ownership');
  }

  const [owner, name] = repo.split('/');
  const encodedOwner = encodeURIComponent(owner);
  const encodedName = encodeURIComponent(name);
  const baseQuery = encodeURIComponent(baseRef);

  const currentFiles = listRangeFiles(effectiveBaseSha, effectiveHeadSha);
  const currentPatches = {};
  for (const file of currentFiles) {
    const normalized = normalizeRepoPath(file);
    if (CACHE_BUST_PROJECTION_SURFACE_RE.test(normalized)) {
      currentPatches[normalized] = loadRangePatchForFile(effectiveBaseSha, effectiveHeadSha, normalized);
    }
  }

  const openPulls = await pagedGithubArray({
    apiUrl,
    token,
    route: `/repos/${encodedOwner}/${encodedName}/pulls?state=open&base=${baseQuery}`,
  });

  const candidateModels = [];
  for (const pr of openPulls) {
    if (Number(pr.number) === prNumber) continue;
    const base = pr.base && pr.base.ref ? pr.base.ref : '';
    const headRepo = pr.head && pr.head.repo && pr.head.repo.full_name ? pr.head.repo.full_name : '';
    const candidate = prModel(pr);

    if (Number(pr.number) > prNumber || base !== baseRef || headRepo !== repo || predecessorSupersededByCurrent(candidate, prNumber)) {
      candidateModels.push(candidate);
      continue;
    }

    const filesRaw = await pagedGithubArray({
      apiUrl,
      token,
      route: `/repos/${encodedOwner}/${encodedName}/pulls/${pr.number}/files`,
    });
    candidate.files = filesRaw.map((entry) => entry.filename);
    candidate.patches = {};
    for (const entry of filesRaw) {
      if (typeof entry.filename === 'string' && typeof entry.patch === 'string') {
        candidate.patches[normalizeRepoPath(entry.filename)] = entry.patch;
      }
    }
    candidateModels.push(candidate);
  }

  const result = analyzeCollisions({
    current: { number: prNumber, repo, baseRef },
    currentFiles,
    currentPatches,
    candidates: candidateModels,
  });

  console.log(
    `Lane collision guard: PR #${prNumber}; effective range ${effectiveBaseSha}..${effectiveHeadSha}; `
    + `${currentFiles.length} changed file(s); ${openPulls.length - 1} other open PR(s) on '${baseRef}'.`,
  );

  for (const warning of result.warnings) {
    console.warn(`WARNING: PR #${warning.number} shares derived projection file(s):`);
    for (const file of warning.files) console.warn(`  - ${file}`);
    console.warn('Derived projection overlap does not claim lane ownership by itself; verify source owners remain disjoint.');
  }

  if (!result.blockers.length) {
    console.log('Lane collision guard passed: no earlier active same-repository PR owns an overlapping exclusive file.');
    return 0;
  }

  console.error('Lane collision guard failed: an earlier active same-repository PR owns overlapping exclusive file(s).');
  for (const blocker of result.blockers) {
    console.error(`PR #${blocker.number}${blocker.title ? ` — ${blocker.title}` : ''}`);
    for (const file of blocker.files) console.error(`  - ${file}`);
  }
  console.error('Use a non-overlapping lane, or complete the repository handoff/successor disposition before continuing.');
  return 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(`Lane collision guard error: ${error.message}`);
    process.exitCode = 1;
  });
}
