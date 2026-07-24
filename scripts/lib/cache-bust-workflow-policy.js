'use strict';

function validateCacheBustWorkflowPolicy(input) {
  const shared = input.sharedFiles || '';
  const readiness = input.readiness || '';
  const deploy = input.deploy || '';
  const cacheBust = input.cacheBust || '';
  const workflowTexts = input.workflowTexts || {};
  const issues = [];

  function requireMatch(label, text, pattern, message) {
    if (!pattern.test(text)) issues.push(`${label}: ${message}`);
  }

  function forbidMatch(label, text, pattern, message) {
    if (pattern.test(text)) issues.push(`${label}: ${message}`);
  }

  function requireBefore(label, text, firstPattern, secondPattern, message) {
    const first = text.search(firstPattern);
    const second = text.search(secondPattern);
    if (first === -1 || second === -1 || first >= second) issues.push(`${label}: ${message}`);
  }

  requireMatch('shared-files-guard', shared, /^\s*pull_request:\s*$/m,
    'must run on pull_request before stale revisions can merge');
  requireMatch('shared-files-guard', shared, /^\s*push:\s*$[\s\S]{0,180}?branches:\s*\[[^\]]*\bmain\b[^\]]*\]/m,
    'must run on pushes to main');
  requireMatch('shared-files-guard', shared, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m,
    'must remain read-only');
  requireMatch('shared-files-guard', shared, /name:\s*Asset revision drift \(read-only\)[\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m,
    'must execute the default read-only asset revision check');

  requireMatch('readiness', readiness, /^\s*push:\s*$[\s\S]{0,120}?branches:\s*\[main\]/m,
    'must own every push to main');
  requireMatch('readiness', readiness, /^\s*-\s*['"]\*\*['"]\s*$/m,
    'must retain the catch-all path so new or mixed changes cannot bypass readiness');
  requireMatch('readiness', readiness, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m,
    'must remain read-only');
  requireMatch('readiness', readiness, /name:\s*Check source asset revisions without writing[\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m,
    'must execute the read-only asset revision check');
  requireBefore('readiness', readiness,
    /run:\s*node scripts\/cache-bust\.js\s*$/m,
    /run:\s*npm run strangler:build:production-like\s*$/m,
    'asset revisions must be checked before the production-like build');

  requireMatch('deploy', deploy, /^\s*workflow_run:\s*$/m,
    'automatic deploy must be triggered by readiness, not by a competing direct push');
  requireMatch('deploy', deploy, /workflows:\s*\["Metadata & IndexNow Readiness"\]/,
    'automatic deploy must follow the canonical readiness workflow');
  requireMatch('deploy', deploy, /github\.event\.workflow_run\.conclusion\s*==\s*['"]success['"]/,
    'automatic deploy must require successful readiness');
  requireMatch('deploy', deploy, /ref:\s*\$\{\{[\s\S]{0,180}?github\.event\.workflow_run\.head_sha[\s\S]{0,180}?\}\}/,
    'deploy must checkout the exact readiness-verified SHA');
  requireMatch('deploy', deploy, /name:\s*Check asset revisions for manual deploys[\s\S]{0,220}?if:\s*github\.event_name\s*==\s*['"]workflow_dispatch['"][\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m,
    'manual recovery deploys must run the same read-only check');

  requireMatch('cache-bust.js', cacheBust, /const WRITE\s*=\s*process\.argv\.includes\(['"]--write['"]\);/,
    'write mode must require an explicit --write argument');
  requireMatch('cache-bust.js', cacheBust, /const CHECK\s*=\s*!WRITE;/,
    'default mode must remain the inverse read-only check');
  requireMatch('cache-bust.js', cacheBust, /if \(WRITE\) fs\.writeFileSync\(/,
    'source rewriting must remain guarded by explicit write mode');
  requireMatch('cache-bust.js', cacheBust, /console\.error\(['"]Run explicitly to regenerate:[^\n]*--write['"]\);[\s\S]{0,80}?process\.exit\(1\);/,
    'detected drift must fail instead of silently rewriting');

  for (const [name, text] of Object.entries(workflowTexts)) {
    forbidMatch(name, text, /(?:node\s+)?scripts\/cache-bust\.js\s+--write\b/,
      'workflows must not auto-write source revisions over concurrent agents');
  }

  return issues;
}

function runCacheBustWorkflowPolicyMutationSuite(baseline) {
  const baselineIssues = validateCacheBustWorkflowPolicy(baseline);
  if (baselineIssues.length) {
    return baselineIssues.map((issue) => `baseline invalid: ${issue}`);
  }

  function swapped(text, first, second) {
    const marker = '__CACHE_BUST_POLICY_SWAP__';
    return text.replace(first, marker).replace(second, first).replace(marker, second);
  }

  const mutations = [
    {
      name: 'PR trigger removed',
      value: { ...baseline, sharedFiles: baseline.sharedFiles.replace('  pull_request:\n', '  pull_request-disabled:\n') },
    },
    {
      name: 'main push coverage removed',
      value: { ...baseline, sharedFiles: baseline.sharedFiles.replace('branches: [main, "lane/**", "agent/**"]', 'branches: ["lane/**", "agent/**"]') },
    },
    {
      name: 'PR cache-bust step removed',
      value: { ...baseline, sharedFiles: baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust-disabled.js') },
    },
    {
      name: 'workflow auto-writer introduced',
      value: {
        ...baseline,
        sharedFiles: baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust.js --write'),
        workflowTexts: { ...baseline.workflowTexts, '.github/workflows/shared-files-guard.yml': baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust.js --write') },
      },
    },
    {
      name: 'readiness catch-all removed',
      value: { ...baseline, readiness: baseline.readiness.replace("      - '**'", "      - 'only-known-paths/**'") },
    },
    {
      name: 'readiness revision check removed',
      value: { ...baseline, readiness: baseline.readiness.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust-disabled.js') },
    },
    {
      name: 'revision check moved after build',
      value: {
        ...baseline,
        readiness: swapped(
          baseline.readiness,
          'run: node scripts/cache-bust.js',
          'run: npm run strangler:build:production-like'
        ),
      },
    },
    {
      name: 'deploy readiness owner removed',
      value: { ...baseline, deploy: baseline.deploy.replace('workflows: ["Metadata & IndexNow Readiness"]', 'workflows: ["Other Workflow"]') },
    },
    {
      name: 'deploy accepts failed readiness',
      value: { ...baseline, deploy: baseline.deploy.replace("github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.conclusion == 'failure'") },
    },
    {
      name: 'deploy checks out moving main',
      value: { ...baseline, deploy: baseline.deploy.replace('github.event.workflow_run.head_sha', "'main'") },
    },
    {
      name: 'manual deploy revision check removed',
      value: { ...baseline, deploy: baseline.deploy.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust-disabled.js') },
    },
    {
      name: 'cache-bust defaults to writer',
      value: { ...baseline, cacheBust: baseline.cacheBust.replace("const WRITE = process.argv.includes('--write');", 'const WRITE = true;') },
    },
  ];

  const escaped = [];
  for (const mutation of mutations) {
    if (validateCacheBustWorkflowPolicy(mutation.value).length === 0) {
      escaped.push(`mutation escaped: ${mutation.name}`);
    }
  }
  return escaped;
}

module.exports = {
  validateCacheBustWorkflowPolicy,
  runCacheBustWorkflowPolicyMutationSuite,
};
