#!/usr/bin/env node
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

export function analyzeCollisions({ current, currentFiles, candidates }) {
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
    const overlap = candidateFiles.filter((file) => currentSet.has(file));
    if (!overlap.length) continue;

    const derived = overlap.filter(isDerivedProjectionPath);
    const exclusive = overlap.filter((file) => !isDerivedProjectionPath(file));

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

function prModel(pr, files = []) {
  return {
    number: Number(pr.number),
    title: pr.title || '',
    body: pr.body || '',
    baseRef: pr.base && pr.base.ref ? pr.base.ref : '',
    headRepo: pr.head && pr.head.repo && pr.head.repo.full_name ? pr.head.repo.full_name : '',
    files,
  };
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
    candidateModels.push(candidate);
  }

  const result = analyzeCollisions({
    current: { number: prNumber, repo, baseRef },
    currentFiles,
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
