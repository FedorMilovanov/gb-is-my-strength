'use strict';

const GLOSSARY_WORKFLOW = '.github/workflows/glossary-contract.yml';
const WRITER_PATTERN = /(?:node\s+)?scripts\/cache-bust\.js\s+--write\b/;

function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start === -1) return '';
  const offset = start + marker.length;
  if (!nextName) return workflow.slice(offset);
  const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
  return end === -1 ? workflow.slice(offset) : workflow.slice(offset, end);
}

function validateCacheBustWorkflowPolicy(input) {
  const shared = input.sharedFiles || '';
  const diagnostics = input.readiness || '';
  const release = input.deploy || '';
  const cacheBust = input.cacheBust || '';
  const workflowTexts = input.workflowTexts || {};
  const issues = [];
  const releaseReadiness = jobSection(release, 'readiness', 'deploy');
  const releaseDeploy = jobSection(release, 'deploy');

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

  requireMatch('shared-files-guard', shared, /^\s*pull_request:\s*$/m, 'must run on pull_request before stale revisions can merge');
  requireMatch('shared-files-guard', shared, /^\s*push:\s*$[\s\S]{0,180}?branches:\s*\[[^\]]*\bmain\b[^\]]*\]/m, 'must run on pushes to main');
  requireMatch('shared-files-guard', shared, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m, 'must remain read-only');
  requireMatch('shared-files-guard', shared, /name:\s*Asset revision drift \(read-only\)[\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m, 'must execute the default read-only asset revision check');

  requireMatch('metadata-diagnostics', diagnostics, /^\s*push:\s*$[\s\S]{0,120}?branches:\s*\[main\]/m, 'must retain main-push diagnostics');
  requireMatch('metadata-diagnostics', diagnostics, /^\s*-\s*['"]\*\*['"]\s*$/m, 'must retain catch-all diagnostic coverage');
  requireMatch('metadata-diagnostics', diagnostics, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m, 'must remain read-only');
  requireMatch('metadata-diagnostics', diagnostics, /name:\s*Check source asset revisions without writing[\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m, 'must execute the read-only revision check');
  forbidMatch('metadata-diagnostics', diagnostics, /\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit|playwright install/, 'must not duplicate release installation or dist generation');
  forbidMatch('metadata-diagnostics', diagnostics, /pages:\s*write|id-token:\s*write|actions\/deploy-pages|actions\/upload-pages-artifact/, 'must not own Pages publication');

  requireMatch('release-workflow', release, /^\s*push:\s*$[\s\S]{0,120}?branches:\s*\[main\]/m, 'must own every direct release push to main');
  requireMatch('release-workflow', release, /^\s*-\s*['"]\*\*['"]\s*$/m, 'must retain catch-all production coverage');
  requireMatch('release-workflow', release, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m, 'top-level release permissions must remain read-only');
  requireMatch('release-readiness', releaseReadiness, /permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m, 'candidate builder must remain read-only');
  requireMatch('release-readiness', releaseReadiness, /name:\s*Check source asset revisions without writing[\s\S]{0,160}?run:\s*node scripts\/cache-bust\.js\s*$/m, 'candidate builder must run the default read-only revision check');
  requireBefore('release-readiness', releaseReadiness, /run:\s*node scripts\/cache-bust\.js\s*$/m, /run:\s*npm run strangler:build:production-like\s*$/m, 'revision check must precede the one candidate build');
  requireMatch('release-deploy', releaseDeploy, /needs:\s*readiness/, 'privileged deploy must depend on the verified candidate');
  forbidMatch('release-deploy', releaseDeploy, /cache-bust\.js|strangler:build|\bnpm ci\b|actions\/checkout/, 'privileged deploy must not check, rebuild or checkout source');

  requireMatch('cache-bust.js', cacheBust, /const WRITE\s*=\s*process\.argv\.includes\(['"]--write['"]\);/, 'write mode must require an explicit --write argument');
  requireMatch('cache-bust.js', cacheBust, /const CHECK\s*=\s*!WRITE;/, 'default mode must remain the inverse read-only check');
  requireMatch('cache-bust.js', cacheBust, /if \(WRITE\) fs\.writeFileSync\(/, 'source rewriting must remain guarded by explicit write mode');
  requireMatch('cache-bust.js', cacheBust, /console\.error\(['"]Run explicitly to regenerate:[^\n]*--write['"]\);[\s\S]{0,80}?process\.exit\(1\);/, 'detected drift must fail instead of silently rewriting');

  const writerWorkflows = Object.entries(workflowTexts).filter(([, text]) => WRITER_PATTERN.test(text)).map(([name]) => name);
  for (const name of writerWorkflows) {
    if (name !== GLOSSARY_WORKFLOW) issues.push(`${name}: only the explicitly labeled same-repository glossary normalizer may use cache-bust --write`);
  }

  const glossary = workflowTexts[GLOSSARY_WORKFLOW] || '';
  if (WRITER_PATTERN.test(glossary)) {
    const writerCount = (glossary.match(/(?:node\s+)?scripts\/cache-bust\.js\s+--write\b/g) || []).length;
    if (writerCount !== 1) issues.push(`${GLOSSARY_WORKFLOW}: expected exactly one constrained cache-bust writer, found ${writerCount}`);
    requireMatch(GLOSSARY_WORKFLOW, glossary, /^permissions:\s*$[\s\S]{0,80}?contents:\s*read\b/m, 'top-level workflow permissions must remain read-only');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /placement-autofix:[\s\S]{0,520}?github\.event_name\s*==\s*['"]pull_request['"][\s\S]{0,240}?contains\(github\.event\.pull_request\.labels\.\*\.name,\s*['"]autofix['"]\)[\s\S]{0,240}?github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/, 'writer must require pull_request, explicit autofix label and same-repository head');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /placement-autofix:[\s\S]{0,760}?permissions:\s*$[\s\S]{0,80}?contents:\s*write\b/m, 'write permission must stay scoped to the guarded autofix job');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /name:\s*Checkout pull request branch[\s\S]{0,180}?ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.ref\s*\}\}/, 'writer must checkout the explicit pull-request head branch');
    requireBefore(GLOSSARY_WORKFLOW, glossary, /node scripts\/cache-bust\.js --write/, /node scripts\/cache-bust\.js\s*$/m, 'writer output must be followed by the default read-only validation');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /git add -u\s*$/m, 'writer may stage only already tracked normalized files');
    forbidMatch(GLOSSARY_WORKFLOW, glossary, /git add -A\b|git add --all\b/, 'writer must not stage unrelated or newly created files');
    requireMatch(GLOSSARY_WORKFLOW, glossary, /git push origin ["']HEAD:\$\{HEAD_REF\}["']/, 'writer must push only back to the requesting pull-request branch');
  }
  return issues;
}

function runCacheBustWorkflowPolicyMutationSuite(baseline) {
  const baselineIssues = validateCacheBustWorkflowPolicy(baseline);
  if (baselineIssues.length) return baselineIssues.map((issue) => `baseline invalid: ${issue}`);
  function swapped(text, first, second) {
    const marker = '__CACHE_BUST_POLICY_SWAP__';
    return text.replace(first, marker).replace(second, first).replace(marker, second);
  }
  function withWorkflow(input, name, text) { return { ...input, workflowTexts: { ...input.workflowTexts, [name]: text } }; }
  const glossary = baseline.workflowTexts[GLOSSARY_WORKFLOW] || '';
  const mutations = [
    ['PR trigger removed', { ...baseline, sharedFiles: baseline.sharedFiles.replace('  pull_request:\n', '  pull_request-disabled:\n') }],
    ['main guard push removed', { ...baseline, sharedFiles: baseline.sharedFiles.replace('branches: [main, "lane/**", "agent/**"]', 'branches: ["lane/**", "agent/**"]') }],
    ['shared revision check becomes writer', { ...baseline, sharedFiles: baseline.sharedFiles.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust.js --write') }],
    ['diagnostic catch-all removed', { ...baseline, readiness: baseline.readiness.replace("      - '**'", "      - 'src/**'") }],
    ['diagnostic revision check removed', { ...baseline, readiness: baseline.readiness.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust-disabled.js') }],
    ['diagnostics gain Pages permission', { ...baseline, readiness: baseline.readiness.replace('contents: read', 'contents: read\n  pages: write') }],
    ['diagnostics duplicate npm install', { ...baseline, readiness: baseline.readiness.replace('name: Validate registry structure', 'run: npm ci\n\n      - name: Validate registry structure') }],
    ['diagnostics duplicate production build', { ...baseline, readiness: baseline.readiness.replace('name: Ensure diagnostics left tracked sources clean', 'run: npm run strangler:build:production-like\n\n      - name: Ensure diagnostics left tracked sources clean') }],
    ['release direct push removed', { ...baseline, deploy: baseline.deploy.replace('  push:\n', '  push-disabled:\n') }],
    ['release catch-all removed', { ...baseline, deploy: baseline.deploy.replace("      - '**'", "      - 'src/**'") }],
    ['release readiness revision check removed', { ...baseline, deploy: baseline.deploy.replace('run: node scripts/cache-bust.js', 'run: node scripts/cache-bust-disabled.js') }],
    ['release revision check moved after build', { ...baseline, deploy: swapped(baseline.deploy, 'run: node scripts/cache-bust.js', 'run: npm run strangler:build:production-like') }],
    ['deploy loses readiness dependency', { ...baseline, deploy: baseline.deploy.replace('needs: readiness', 'needs: []') }],
    ['deploy rebuilds candidate', { ...baseline, deploy: baseline.deploy.replace('name: Download exact same-run release candidate', 'run: npm run strangler:build:production-like\n\n      - name: Download exact same-run release candidate') }],
    ['cache-bust defaults to writer', { ...baseline, cacheBust: baseline.cacheBust.replace("const WRITE = process.argv.includes('--write');", 'const WRITE = true;') }],
  ];
  if (WRITER_PATTERN.test(glossary)) {
    mutations.push(
      ['glossary writer loses label', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace("'autofix'", "'unreviewed'"))],
      ['glossary writer accepts fork', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('github.event.pull_request.head.repo.full_name == github.repository', 'true'))],
      ['glossary writer stages all files', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git add -u', 'git add -A'))],
      ['glossary writer pushes main', withWorkflow(baseline, GLOSSARY_WORKFLOW, glossary.replace('git push origin "HEAD:${HEAD_REF}"', 'git push origin HEAD:main'))],
    );
  }
  return mutations.filter(([, value]) => validateCacheBustWorkflowPolicy(value).length === 0).map(([name]) => `mutation escaped: ${name}`);
}

module.exports = { validateCacheBustWorkflowPolicy, runCacheBustWorkflowPolicyMutationSuite };
