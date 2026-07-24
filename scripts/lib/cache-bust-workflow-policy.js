'use strict';

const GLOSSARY_WORKFLOW = '.github/workflows/glossary-contract.yml';
const WRITER_PATTERN = /(?:node\s+)?scripts\/cache-bust\.js\s+--write\b/;

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

  const writerWorkflows = Object.entries(workflowTexts)
    .filter(([, text]) => WRITER_PATTERN.test(text))
    .map(([name]) => name);
  for (const name of writerWorkflows) {
    if (name !== GLOSSARY_WORKFLOW) {
      issues.push(`${name}: only the explicitly labeled same-repository glossary normalizer may use cache-bust --write`);
    }
  }

  const glossary = workflowTexts[GLOSSARY_WORKFLOW] || '';
  if (WRITER_PATTERN.test(glossary)) {
    const writerCount = (glossary.match(/(?:node\s+)?scripts\/cache-bust\.js\s+--write\b/g) || []).length;
    if (writerCount !== 1) {
      issues.push(`${GLOSSARY_WORKFLOW}: expected exactly one constrained cache-bust writer, found ${writerCount}`);
    }
    requireMatch(GLOSSARY_WORKFLOW, glossary, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m,
      'top-level workflow permissions must remain read-only');
    requireMatch(GLOSSARY_WORKFLOW, glossary,
      /placement-autofix:[\s\S]{0,520}?github\.event_name\s*==\s*['"]pull_request['"][\s\S]{0,240}?contains\(github\.event\.pull_request\.labels\.\*\.name,\s*['"]autofix['"]\)[\s\S]{0,240}?github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/,
      'writer must require pull_request, the explicit autofix label and a same-repository head');
    requireMatch(GLOSSARY_WORKFLOW, glossary,
      /placement-autofix:[\s\S]{0,760}?permissions:\s*$[\s\S]{0,80}?contents:\s*write\b/m,
      'write permission must stay scoped to the guarded autofix job');
    requireMatch(GLOSSARY_WORKFLOW, glossary,
      /name:\s*Checkout pull request branch[\s\S]{0,180}?ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}/,
      'writer must checkout the explicit pull-request head branch');
    requireBefore(GLOSSARY_WORKFLOW, glossary,
      /node scripts\/cache-bust\.js --write/,
      /node scripts\/cache-bust\.js\s*$/m,
      'writer output must be followed by the default read-only validation');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /git add -u\s*$/m,
      'writer may stage only already tracked normalized files');
    forbidMatch(GLOSSARY_WORKFLOW, glossary, /git add -A\b|git add --all\b/,
      'writer must not stage unrelated or newly created files');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /git push origin ["']HEAD:\$\{HEAD_REF\}["']/,
      'writer must push only back to the requesting pull-request branch');
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

  function withWorkflow(input, name, text) {
    return { ...input, workflowTexts: { ...input.workflowTexts, [name]: text } };
  }

  const glossary = baseline.workflowTexts[GLOSSARY_WORKFLOW] || '';
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
      name: 'unauthorized workflow writer introduced',
      value: withWorkflow(
        { ...baseline, sharedFiles: baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust.js --write') },
        '.github/workflows/shared-files-guard.yml',
        baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust.js --write')
      ),
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

  if (WRITER_PATTERN.test(glossary)) {
    mutations.push(
      {
        name: 'glossary writer loses explicit label guard',
        value: withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace("'autofix'", "'unreviewed'")),
      },
      {
        name: 'glossary writer accepts fork heads',
        value: withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('github.event.pull_request.head.repo.full_name == github.repository', 'true')),
      },
      {
        name: 'glossary writer stages untracked files',
        value: withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git add -u', 'git add -A')),
      },
      {
        name: 'glossary writer loses read-only validation',
        value: withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace(/node scripts\/cache-bust\.js\n/, 'node scripts/cache-bust-disabled.js\n')),
      },
      {
        name: 'glossary writer pushes to main',
        value: withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git push origin "HEAD:${HEAD_REF}"', 'git push origin HEAD:main')),
      }
    );
  }

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
