#!/usr/bin/env node
/**
 * Read-only forensic inventory of repository branch and pull-request history.
 *
 * The audit answers the narrow loss question Git alone cannot answer after a
 * branch ref is deleted: does GitHub still retain the PR head commit, what did
 * that unmerged PR change, and are any paths introduced there absent from the
 * current default branch?
 *
 * Git ancestry alone is not enough because this repository regularly uses
 * squash merges. Every remote branch is therefore also reconciled against PR
 * metadata, while closed-unmerged PR classification includes closure comments.
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

function evidenceText(pr, comments = []) {
  return [pr.title || '', pr.body || '', ...comments.map((comment) => comment.body || '')].join('\n');
}

function classifyClosedPr(pr, comments = []) {
  const text = evidenceText(pr, comments);
  if (/(?:superseded|replaced|replacement|rebuilt|duplicate|stale duplicate|замен(?:ён|ен|ена|ено)|пересобран|дубликат|уже\s+слит[а-я]*\s+(?:pr\s*)?#?\d+)/i.test(text)) {
    return 'superseded';
  }
  if (/(?:prototype|прототип|showcase|вариант(?:ы|ов)?\s+подменю)/i.test(text)) {
    return 'prototype';
  }
  if (/(?:do not merge|не\s+сливать|diagnostic|диагност|\bprobe\b|evidence[- ]only|temporary|временн(?:ый|ая|ое)|эксперимент|production\s+verification\s+only)/i.test(text)) {
    return 'diagnostic';
  }
  if (/(?:parked|deferred|\bon hold\b|follow[- ]?up|later|запаркован|отложен|позже|не\s+готов)/i.test(text)) {
    return 'parked';
  }
  return 'unclassified';
}

function referencedPrNumbers(pr, comments = []) {
  const own = Number(pr.number);
  return [...new Set([...evidenceText(pr, comments).matchAll(/#(\d+)/g)]
    .map((match) => Number(match[1]))
    .filter((number) => Number.isInteger(number) && number !== own))]
    .sort((a, b) => a - b);
}

function currentPathExists(filename) {
  return fs.existsSync(path.join(ROOT, filename));
}

function missingPathKind(filename) {
  if (/(?:^|\/)(?:_temp|_verification)|(?:proof|witness|diagnostic)(?:\.|-|\/)/i.test(filename)) return 'temporary-evidence';
  if (filename.startsWith('_build-tools/')) return 'prototype';
  if (filename.includes('/legacy-audits/')) return 'retired-legacy';
  if (/^(?:src\/components|src\/lib|js\/)/.test(filename)) return 'product-source';
  if (/^\.github\/workflows\//.test(filename)) return 'workflow';
  if (/^scripts\//.test(filename)) return 'audit-or-tooling';
  return 'other';
}

function associatedPrSnapshot(pr, closedByNumber) {
  const closed = closedByNumber.get(pr.number);
  return {
    number: pr.number,
    title: pr.title,
    state: pr.state,
    mergedAt: pr.merged_at || null,
    category: closed?.category || null,
    url: pr.html_url,
  };
}

function branchInventory(prs, closedByNumber) {
  const byHeadRef = new Map();
  for (const pr of prs) {
    if (pr.head?.repo?.full_name !== REPOSITORY || !pr.head?.ref) continue;
    const key = `origin/${pr.head.ref}`;
    const list = byHeadRef.get(key) || [];
    list.push(pr);
    byHeadRef.set(key, list);
  }

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
      const associatedPrs = (byHeadRef.get(branch.name) || [])
        .map((pr) => associatedPrSnapshot(pr, closedByNumber))
        .sort((a, b) => b.number - a.number);
      let reconciliation = 'orphan-branch';
      if (branch.name === 'origin/main') reconciliation = 'main';
      else if (mergedIntoMain) reconciliation = 'git-ancestor-of-main';
      else if (associatedPrs.some((pr) => pr.mergedAt)) reconciliation = 'merged-pr-head-squash-or-rebase';
      else if (associatedPrs.some((pr) => pr.state === 'open')) reconciliation = 'open-pr-head';
      else if (associatedPrs.some((pr) => pr.category === 'superseded')) reconciliation = 'closed-superseded-pr-head';
      else if (associatedPrs.some((pr) => pr.category === 'diagnostic')) reconciliation = 'closed-diagnostic-pr-head';
      else if (associatedPrs.some((pr) => pr.category === 'prototype')) reconciliation = 'closed-prototype-pr-head';
      else if (associatedPrs.some((pr) => pr.category === 'parked')) reconciliation = 'closed-parked-pr-head';
      else if (associatedPrs.length) reconciliation = 'closed-unclassified-pr-head';
      return { ...branch, mergedIntoMain, mainOnly, branchOnly, reconciliation, associatedPrs };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function closedUnmergedInventory(prs, prsByNumber) {
  const candidates = prs.filter((pr) => pr.state === 'closed' && !pr.merged_at);
  const results = [];
  for (const pr of candidates) {
    const [comments, files] = await Promise.all([
      listPaged(`/repos/${REPOSITORY}/issues/${pr.number}/comments`),
      listPaged(`/repos/${REPOSITORY}/pulls/${pr.number}/files`),
    ]);
    const headSha = pr.head?.sha || null;
    const commit = headSha
      ? await request(`/repos/${REPOSITORY}/commits/${headSha}`, { allowNotFound: true })
      : null;
    const normalizedFiles = files.map((file) => ({
      filename: file.filename,
      previousFilename: file.previous_filename || null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      existsInMain: currentPathExists(file.filename),
    }));
    const missingIntroduced = normalizedFiles
      .filter((file) => ['added', 'renamed'].includes(file.status) && !file.existsInMain)
      .map((file) => ({ filename: file.filename, kind: missingPathKind(file.filename) }));
    const missingIntroducedPaths = missingIntroduced.map((item) => item.filename);
    const missingProductPaths = missingIntroduced
      .filter((item) => item.kind === 'product-source')
      .map((item) => item.filename);
    const category = classifyClosedPr(pr, comments);
    const references = referencedPrNumbers(pr, comments);
    const referencedPullRequests = references
      .map((number) => prsByNumber.get(number))
      .filter(Boolean)
      .map((referenced) => ({
        number: referenced.number,
        title: referenced.title,
        state: referenced.state,
        mergedAt: referenced.merged_at || null,
        url: referenced.html_url,
      }));
    const verifiedMergedReplacement = referencedPullRequests.find((referenced) => referenced.mergedAt) || null;
    const headAccessible = Boolean(commit);
    if (!headAccessible) {
      problems.push(`PR #${pr.number}: head commit ${headSha || '(missing sha)'} is not accessible through GitHub`);
    }
    let reviewPriority = 0;
    if (!headAccessible) reviewPriority += 100;
    if (['unclassified', 'parked'].includes(category)) {
      reviewPriority += missingProductPaths.length * 20;
      reviewPriority += Math.max(0, missingIntroducedPaths.length - missingProductPaths.length) * 2;
    }
    if (category === 'unclassified') reviewPriority += 10;
    if (category === 'parked') reviewPriority += 8;
    if (!references.length && ['unclassified', 'parked'].includes(category)) reviewPriority += 3;
    if (verifiedMergedReplacement) reviewPriority = Math.max(0, reviewPriority - 20);

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
      closureComments: comments.map((comment) => ({
        createdAt: comment.created_at,
        author: comment.user?.login || null,
        body: comment.body || '',
      })),
      referencedPrNumbers: references,
      referencedPullRequests,
      verifiedMergedReplacement,
      files: normalizedFiles,
      missingIntroduced,
      missingIntroducedPaths,
      missingProductPaths,
      reviewPriority,
    });
  }
  return results.sort((a, b) => b.reviewPriority - a.reviewPriority || b.number - a.number);
}

function markdown(report) {
  const branchRows = report.branches
    .filter((branch) => branch.name !== 'origin/main' && !['git-ancestor-of-main', 'merged-pr-head-squash-or-rebase'].includes(branch.reconciliation))
    .map((branch) => `| \`${branch.name}\` | ${branch.reconciliation} | ${branch.branchOnly ?? '?'} | ${branch.mainOnly ?? '?'} | ${branch.associatedPrs.map((pr) => `#${pr.number}`).join(', ') || '—'} |`);
  const prRows = report.closedUnmerged.map((pr) =>
    `| #${pr.number} | ${pr.category} | ${pr.headAccessible ? 'yes' : '**NO**'} | ${pr.missingProductPaths.length} | ${pr.missingIntroducedPaths.length} | ${pr.verifiedMergedReplacement ? `#${pr.verifiedMergedReplacement.number}` : '—'} | ${pr.reviewPriority} | ${pr.title.replace(/\|/g, '\\|')} |`
  );
  const candidateRows = report.closedUnmerged
    .filter((pr) => pr.reviewPriority > 0)
    .flatMap((pr) => (pr.missingIntroduced.length ? pr.missingIntroduced : [{ filename: 'No absent path; semantic diff review required', kind: 'semantic' }])
      .map((item) => `- PR #${pr.number} [${pr.category}, priority ${pr.reviewPriority}]: \`${item.filename}\` (${item.kind}) — ${pr.title}`));

  return [
    '# Repository history forensic audit',
    '',
    `- Repository: \`${report.repository}\``,
    `- Main SHA: \`${report.mainSha}\``,
    `- Remote branches: ${report.summary.remoteBranches}`,
    `- Branch refs reconciled by Git ancestry or merged PR: ${report.summary.reconciledMergedBranches}`,
    `- Open PR branch refs: ${report.summary.openPrBranches}`,
    `- Closed/superseded/diagnostic/prototype branch refs: ${report.summary.explainedClosedBranches}`,
    `- Orphan or unclassified remote branch refs: ${report.summary.unexplainedRemoteBranches}`,
    `- Pull requests: ${report.summary.pullRequests}`,
    `- Merged PRs: ${report.summary.mergedPrs}`,
    `- Closed without merge: ${report.summary.closedUnmergedPrs}`,
    `- Open PRs: ${report.summary.openPrs}`,
    `- Inaccessible closed PR heads: ${report.summary.inaccessibleClosedHeads}`,
    `- Missing introduced paths: ${report.summary.missingIntroducedPaths}`,
    `- Missing product-source paths: ${report.summary.missingProductPaths}`,
    `- Manual review candidates: ${report.summary.manualReviewCandidates}`,
    '',
    '## Remote branch refs not yet fully explained',
    '',
    '| Branch | Reconciliation | Branch-only commits | Main-only commits | Associated PRs |',
    '|---|---|---:|---:|---|',
    ...(branchRows.length ? branchRows : ['| — | fully reconciled | 0 | 0 | — |']),
    '',
    '## Closed PRs without merge',
    '',
    '| PR | Classification | Head accessible | Missing product paths | All missing paths | Verified merged replacement | Priority | Title |',
    '|---:|---|---|---:|---:|---:|---:|---|',
    ...prRows,
    '',
    '## Manual recovery/review candidates',
    '',
    ...(candidateRows.length ? candidateRows : ['- None']),
    '',
    '## Interpretation boundary',
    '',
    '- A reachable PR head proves that pushed code is still recoverable even when its branch ref was deleted.',
    '- Squash/rebase merged PR heads are not Git ancestors of main; PR metadata is required to reconcile them.',
    '- A missing introduced path is a review candidate, not automatic proof that production code was accidentally lost.',
    '- Commits that were never pushed to GitHub cannot be discovered by a remote forensic audit.',
    '',
  ].join('\n');
}

async function main() {
  git(['fetch', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*']);
  const mainSha = git(['rev-parse', 'origin/main']).stdout;
  const prs = await listPaged(`/repos/${REPOSITORY}/pulls?state=all&sort=created&direction=asc`);
  const prsByNumber = new Map(prs.map((pr) => [pr.number, pr]));
  const closedUnmerged = await closedUnmergedInventory(prs, prsByNumber);
  const closedByNumber = new Map(closedUnmerged.map((pr) => [pr.number, pr]));
  const branches = branchInventory(prs, closedByNumber);
  const reconciledMerged = new Set(['main', 'git-ancestor-of-main', 'merged-pr-head-squash-or-rebase']);
  const explainedClosed = new Set(['closed-superseded-pr-head', 'closed-diagnostic-pr-head', 'closed-prototype-pr-head']);
  const report = {
    generatedAt: new Date().toISOString(),
    repository: REPOSITORY,
    mainSha,
    summary: {
      remoteBranches: branches.length,
      reconciledMergedBranches: branches.filter((branch) => reconciledMerged.has(branch.reconciliation)).length,
      openPrBranches: branches.filter((branch) => branch.reconciliation === 'open-pr-head').length,
      explainedClosedBranches: branches.filter((branch) => explainedClosed.has(branch.reconciliation)).length,
      unexplainedRemoteBranches: branches.filter((branch) => ['orphan-branch', 'closed-parked-pr-head', 'closed-unclassified-pr-head'].includes(branch.reconciliation)).length,
      pullRequests: prs.length,
      mergedPrs: prs.filter((pr) => Boolean(pr.merged_at)).length,
      closedUnmergedPrs: closedUnmerged.length,
      openPrs: prs.filter((pr) => pr.state === 'open').length,
      inaccessibleClosedHeads: closedUnmerged.filter((pr) => !pr.headAccessible).length,
      missingIntroducedPaths: closedUnmerged.reduce((sum, pr) => sum + pr.missingIntroducedPaths.length, 0),
      missingProductPaths: closedUnmerged.reduce((sum, pr) => sum + pr.missingProductPaths.length, 0),
      manualReviewCandidates: closedUnmerged.filter((pr) => pr.reviewPriority > 0).length,
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
  console.log(`Recoverability: ${report.summary.inaccessibleClosedHeads} inaccessible heads; ${report.summary.manualReviewCandidates} manual candidates`);
  console.log(`Branch reconciliation: ${report.summary.reconciledMergedBranches} merged, ${report.summary.openPrBranches} open, ${report.summary.explainedClosedBranches} explained closed, ${report.summary.unexplainedRemoteBranches} unexplained`);
  for (const problem of problems) console.error(`ERROR ${problem}`);
  if (strict && problems.length) process.exit(1);
  console.log('✅ Repository history forensic inventory completed');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
