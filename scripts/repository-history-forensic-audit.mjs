#!/usr/bin/env node
/**
 * Read-only forensic inventory of repository branch and pull-request history.
 *
 * The audit answers the narrow loss question Git alone cannot answer after a
 * branch ref is deleted: does GitHub still retain the PR head commit, what did
 * that unmerged PR change, and are any paths introduced there absent from the
 * current default branch?
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const REPOSITORY = process.env.GITHUB_REPOSITORY || 'FedorMilovanov/gb-is-my-strength';
const TOKEN = process.env.GITHUB_TOKEN || '';
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const strict = process.argv.includes('--strict');
const problems = [];

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr || result.stdout}`);
  }
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function request(apiPath, { allowNotFound = false } = {}) {
  const response = await fetch(`${API}${apiPath}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      'User-Agent': 'gb-repository-history-forensic-audit',
    },
  });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${apiPath} failed ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.json();
}

async function listPaged(apiPath) {
  const items = [];
  for (let page = 1; ; page += 1) {
    const separator = apiPath.includes('?') ? '&' : '?';
    const batch = await request(`${apiPath}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`Expected array from ${apiPath}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

function classifyClosedPr(pr) {
  const text = `${pr.title || ''}\n${pr.body || ''}`;
  if (/(?:do not merge|не\s+сливать|diagnostic|диагност|\bprobe\b|\bwitness\b|evidence[- ]only|temporary|временн(?:ый|ая|ое)|эксперимент)/i.test(text)) {
    return 'diagnostic';
  }
  if (/(?:superseded|replaced|replacement|rebuilt|duplicate|замен(?:ён|ен|ена|ено)|пересобран|дубликат|уже\s+слит[а-я]*\s+(?:pr\s*)?#?\d+)/i.test(text)) {
    return 'superseded';
  }
  if (/(?:parked|deferred|hold|follow[- ]?up|later|запаркован|отложен|позже|не\s+готов)/i.test(text)) {
    return 'parked';
  }
  return 'unclassified';
}

function referencedPrNumbers(pr) {
  const own = Number(pr.number);
  return [...new Set([...`${pr.title || ''}\n${pr.body || ''}`.matchAll(/#(\d+)/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isInteger(number) && number !== own))]
    .sort((a, b) => a - b);
}

function currentPathExists(filename) {
  return fs.existsSync(path.join(ROOT, filename));
}

function branchInventory() {
  const rows = git([
    'for-each-ref',
    '--format=%(refname:short)\t%(objectname)\t%(committerdate:iso8601-strict)\t%(subject)',
    'refs/remotes/origin',
  ]).stdout.split(/\r?\n/).filter(Boolean);

  return rows
    .map((row) => {
      const [name, sha, committedAt, ...subjectParts] = row.split('\t');
      return { name, sha, committedAt, subject: subjectParts.join('\t') };
    })
    .filter((branch) => branch.name !== 'origin/HEAD')
    .map((branch) => {
      const mergedIntoMain = git(['merge-base', '--is-ancestor', branch.sha, 'origin/main'], { allowFailure: true }).status === 0;
      const counts = git(['rev-list', '--left-right', '--count', `origin/main...${branch.sha}`], { allowFailure: true });
      let mainOnly = null;
      let branchOnly = null;
      if (counts.status === 0) {
        [mainOnly, branchOnly] = counts.stdout.split(/\s+/).map(Number);
      }
      return { ...branch, mergedIntoMain, mainOnly, branchOnly };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function closedUnmergedInventory(prs) {
  const candidates = prs.filter((pr) => pr.state === 'closed' && !pr.merged_at);
  const results = [];
  for (const pr of candidates) {
    const headSha = pr.head?.sha || null;
    const commit = headSha
      ? await request(`/repos/${REPOSITORY}/commits/${headSha}`, { allowNotFound: true })
      : null;
    const files = await listPaged(`/repos/${REPOSITORY}/pulls/${pr.number}/files`);
    const normalizedFiles = files.map((file) => ({
      filename: file.filename,
      previousFilename: file.previous_filename || null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      existsInMain: currentPathExists(file.filename),
    }));
    const missingIntroducedPaths = normalizedFiles
      .filter((file) => ['added', 'renamed'].includes(file.status) && !file.existsInMain)
      .map((file) => file.filename);
    const category = classifyClosedPr(pr);
    const references = referencedPrNumbers(pr);
    const headAccessible = Boolean(commit);
    if (!headAccessible) {
      problems.push(`PR #${pr.number}: head commit ${headSha || '(missing sha)'} is not accessible through GitHub`);
    }
    let reviewPriority = 0;
    if (!headAccessible) reviewPriority += 100;
    if (missingIntroducedPaths.length) reviewPriority += 20 + missingIntroducedPaths.length;
    if (category === 'unclassified') reviewPriority += 10;
    if (category === 'parked') reviewPriority += 8;
    if (!references.length && ['unclassified', 'parked'].includes(category)) reviewPriority += 3;

    results.push({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      headRef: pr.head?.ref || null,
      headRepo: pr.head?.repo?.full_name || null,
      headSha,
      headAccessible,
      category,
      referencedPrNumbers: references,
      files: normalizedFiles,
      missingIntroducedPaths,
      reviewPriority,
    });
  }
  return results.sort((a, b) => b.reviewPriority - a.reviewPriority || b.number - a.number);
}

function markdown(report) {
  const branchRows = report.branches
    .filter((branch) => branch.name !== 'origin/main' && !branch.mergedIntoMain)
    .map((branch) => `| \`${branch.name}\` | \`${branch.sha.slice(0, 10)}\` | ${branch.branchOnly ?? '?'} | ${branch.mainOnly ?? '?'} | ${branch.subject.replace(/\|/g, '\\|')} |`);
  const prRows = report.closedUnmerged.map((pr) =>
    `| #${pr.number} | ${pr.category} | ${pr.headAccessible ? 'yes' : '**NO**'} | ${pr.missingIntroducedPaths.length} | ${pr.reviewPriority} | ${pr.title.replace(/\|/g, '\\|')} |`
  );
  const missingRows = report.closedUnmerged
    .filter((pr) => pr.missingIntroducedPaths.length)
    .flatMap((pr) => pr.missingIntroducedPaths.map((filename) => `- PR #${pr.number}: \`${filename}\` — ${pr.title}`));

  return [
    '# Repository history forensic audit',
    '',
    `- Repository: \`${report.repository}\``,
    `- Main SHA: \`${report.mainSha}\``,
    `- Remote branches: ${report.summary.remoteBranches}`,
    `- Remote branches not merged into main: ${report.summary.unmergedRemoteBranches}`,
    `- Pull requests: ${report.summary.pullRequests}`,
    `- Merged PRs: ${report.summary.mergedPrs}`,
    `- Closed without merge: ${report.summary.closedUnmergedPrs}`,
    `- Open PRs: ${report.summary.openPrs}`,
    `- Inaccessible closed PR heads: ${report.summary.inaccessibleClosedHeads}`,
    `- Missing paths introduced by closed-unmerged PRs: ${report.summary.missingIntroducedPaths}`,
    '',
    '## Remote branches not merged into main',
    '',
    '| Branch | SHA | Branch-only commits | Main-only commits | Head subject |',
    '|---|---:|---:|---:|---|',
    ...(branchRows.length ? branchRows : ['| — | — | 0 | 0 | None |']),
    '',
    '## Closed PRs without merge',
    '',
    '| PR | Classification | Head accessible | Missing introduced paths | Priority | Title |',
    '|---:|---|---|---:|---:|---|',
    ...prRows,
    '',
    '## Introduced paths absent from current main',
    '',
    ...(missingRows.length ? missingRows : ['- None']),
    '',
    '## Interpretation boundary',
    '',
    '- A reachable PR head proves that pushed code is still recoverable even when its branch ref was deleted.',
    '- A missing introduced path is a review candidate, not automatic proof that production code was accidentally lost.',
    '- Commits that were never pushed to GitHub cannot be discovered by a remote forensic audit.',
    '',
  ].join('\n');
}

async function main() {
  git(['fetch', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  const mainSha = git(['rev-parse', 'origin/main']).stdout;
  const branches = branchInventory();
  const prs = await listPaged(`/repos/${REPOSITORY}/pulls?state=all&sort=created&direction=asc`);
  const closedUnmerged = await closedUnmergedInventory(prs);
  const report = {
    generatedAt: new Date().toISOString(),
    repository: REPOSITORY,
    mainSha,
    summary: {
      remoteBranches: branches.length,
      unmergedRemoteBranches: branches.filter((branch) => branch.name !== 'origin/main' && !branch.mergedIntoMain).length,
      pullRequests: prs.length,
      mergedPrs: prs.filter((pr) => Boolean(pr.merged_at)).length,
      closedUnmergedPrs: closedUnmerged.length,
      openPrs: prs.filter((pr) => pr.state === 'open').length,
      inaccessibleClosedHeads: closedUnmerged.filter((pr) => !pr.headAccessible).length,
      missingIntroducedPaths: closedUnmerged.reduce((sum, pr) => sum + pr.missingIntroducedPaths.length, 0),
    },
    branches,
    openPullRequests: prs.filter((pr) => pr.state === 'open').map((pr) => ({
      number: pr.number,
      title: pr.title,
      headRef: pr.head?.ref || null,
      headSha: pr.head?.sha || null,
      url: pr.html_url,
    })),
    closedUnmerged,
    problems,
  };

  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, 'repository-history-forensic-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(REPORTS, 'repository-history-forensic-audit.md'), markdown(report));

  console.log(`Repository history: ${report.summary.remoteBranches} branches, ${report.summary.pullRequests} PRs, ${report.summary.closedUnmergedPrs} closed-unmerged PRs`);
  console.log(`Recoverability: ${report.summary.inaccessibleClosedHeads} inaccessible heads; ${report.summary.missingIntroducedPaths} missing introduced paths`);
  for (const problem of problems) console.error(`ERROR ${problem}`);
  if (strict && problems.length) process.exit(1);
  console.log('✅ Repository history forensic inventory completed');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
