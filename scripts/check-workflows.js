#!/usr/bin/env node
/**
 * Workflow Policy v2.
 *
 * The guard protects capabilities and release boundaries rather than historical
 * route names. Validation remains source-read-only; production route coverage
 * is derived from migration/page-ownership.json through check-page-ownership.js.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  validateCacheBustWorkflowPolicy,
  runCacheBustWorkflowPolicyMutationSuite,
} = require('./lib/cache-bust-workflow-policy');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW_DIR = path.join(ROOT, '.github/workflows');
const issues = [];

const RELEASE_ACTION_PINS = Object.freeze({
  checkout: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1',
  setupNode: 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0',
  uploadArtifact: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1',
  downloadArtifact: 'actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1',
  uploadPages: 'actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0',
  deployPages: 'actions/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128 # v5.0.0',
});

const ACTIONLINT_OFFLINE_AUTHORITY = Object.freeze({
  version: '1.7.7',
  tagCommit: '03d0035246f3e81f36aed592ffb4bebf33a03106',
  releaseId: 195510160,
  checksums: Object.freeze({
    file: 'actionlint_1.7.7_checksums.txt',
    assetId: 221573261,
    size: 1119,
    sha256: 'ac22e6577b8d133c7cd779682e65712ef722e719a297633699a4da05e9f351e0',
  }),
  targets: Object.freeze({
    'darwin-x64': Object.freeze({ file: 'actionlint_1.7.7_darwin_amd64.tar.gz', assetId: 221573249, size: 2092389, sha256: '28e5de5a05fc558474f638323d736d822fff183d2d492f0aecb2b73cc44584f5' }),
    'darwin-arm64': Object.freeze({ file: 'actionlint_1.7.7_darwin_arm64.tar.gz', assetId: 221573250, size: 1962532, sha256: '2693315b9093aeacb4ebd91a993fea54fc215057bf0da2659056b4bc033873db' }),
    'linux-x64': Object.freeze({ file: 'actionlint_1.7.7_linux_amd64.tar.gz', assetId: 221573254, size: 2080472, sha256: '023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757' }),
    'linux-arm64': Object.freeze({ file: 'actionlint_1.7.7_linux_arm64.tar.gz', assetId: 221573255, size: 1911516, sha256: '401942f9c24ed71e4fe71b76c7d638f66d8633575c4016efd2977ce7c28317d0' }),
    'win32-x64': Object.freeze({ file: 'actionlint_1.7.7_windows_amd64.zip', assetId: 221573260, size: 2229473, sha256: '7f12f1801bca3d480d67aaf7774f4c2a6359a3ca8eebe382c95c10c9704aa731' }),
    'win32-arm64': Object.freeze({ file: 'actionlint_1.7.7_windows_arm64.zip', assetId: 221573259, size: 2020826, sha256: '76e9514cfac18e5677aa04f3a89873c981f16a2f2353bb97372a86cd09b1f5a8' }),
  }),
});

const FORBIDDEN_VALIDATION_WRITES = [
  [/(?:^|\s)(?:node\s+scripts\/)?cache-bust\.js\s+--write(?:\s|$)/m, 'asset revision writer'],
  [/(?:^|\s)(?:node\s+scripts\/)?update-meta\.js(?:\s|$)/m, 'metadata writer'],
  [/npm\s+run\s+content:baseline(?:\s|$)/m, 'content baseline writer'],
  [/editorial-metadata-registry\.js\s+--write(?:\s|$)/m, 'editorial metadata writer'],
  [/\bgit\s+(?:commit|push)\b/m, 'git publication command'],
];

function read(rel) {
  const absolute = path.join(ROOT, rel);
  if (!fs.existsSync(absolute)) {
    issues.push(`${rel}: missing`);
    return '';
  }
  return fs.readFileSync(absolute, 'utf8');
}

function verifyPinnedFile(rel, expectedSize, expectedSha256) {
  const absolute = path.join(ROOT, rel);
  let value;
  try { value = fs.readFileSync(absolute); }
  catch (error) {
    issues.push(`${rel}: missing or unreadable (${error.message})`);
    return;
  }
  if (value.length !== expectedSize) issues.push(`${rel}: size drifted; expected ${expectedSize}, got ${value.length}`);
  const actualSha256 = crypto.createHash('sha256').update(value).digest('hex');
  if (actualSha256 !== expectedSha256) issues.push(`${rel}: SHA-256 drifted; expected ${expectedSha256}, got ${actualSha256}`);
}

function must(file, text, pattern, message) {
  if (!pattern.test(text)) issues.push(`${file}: ${message}`);
}

function mustNot(file, text, pattern, message) {
  if (pattern.test(text)) issues.push(`${file}: ${message}`);
}

function mustScript(scripts, name, pattern, message) {
  const value = scripts && scripts[name];
  if (typeof value !== 'string') issues.push(`package.json scripts.${name}: missing`);
  else if (!pattern.test(value)) issues.push(`package.json scripts.${name}: ${message}`);
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

const ATTRIBUTE_PATHSPECS = Object.freeze(['.gitattributes', '**/.gitattributes']);

function parseGitAttributeIndex(output) {
  const files = [];
  const problems = [];
  for (const record of output.split('\0').filter(Boolean)) {
    const match = record.match(/^([0-7]{6}) [a-f0-9]{40,64} ([0-3])\t([\s\S]+)$/);
    if (!match) {
      problems.push(`unparseable git index record: ${JSON.stringify(record)}`);
      continue;
    }
    const [, mode, stage, rel] = match;
    if (stage !== '0') {
      problems.push(`${rel}: tracked .gitattributes is unmerged at index stage ${stage}`);
      continue;
    }
    if (!['100644', '100755'].includes(mode)) {
      problems.push(`${rel}: tracked .gitattributes mode ${mode} is not a regular file`);
      continue;
    }
    files.push(rel);
  }
  return { files, problems };
}

function enumerateGitAttributeFiles(root) {
  const tracked = spawnSync('git', ['ls-files', '-z', '--stage', '--', ...ATTRIBUTE_PATHSPECS], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  if (tracked.error || tracked.status !== 0) {
    const detail = tracked.error?.message || tracked.stderr?.trim() || `exit ${tracked.status}`;
    return { files: [], problems: [`cannot enumerate tracked .gitattributes: ${detail}`] };
  }
  const parsed = parseGitAttributeIndex(tracked.stdout);
  const files = new Set(parsed.files);
  const problems = [...parsed.problems];

  const untracked = spawnSync('git', [
    'ls-files', '-z', '--others', '--exclude-standard', '--', ...ATTRIBUTE_PATHSPECS,
  ], { cwd: root, encoding: 'utf8', shell: false });
  if (untracked.error || untracked.status !== 0) {
    const detail = untracked.error?.message || untracked.stderr?.trim() || `exit ${untracked.status}`;
    problems.push(`cannot enumerate untracked .gitattributes: ${detail}`);
  } else {
    for (const rel of untracked.stdout.split('\0').filter(Boolean)) {
      let stat;
      try { stat = fs.lstatSync(path.join(root, rel)); }
      catch (error) {
        problems.push(`${rel}: cannot lstat untracked .gitattributes (${error.message})`);
        continue;
      }
      if (!stat.isFile()) {
        problems.push(`${rel}: untracked .gitattributes is not a regular file`);
        continue;
      }
      files.add(rel);
    }
  }
  return { files: [...files].sort(), problems };
}

function listGitAttributeFiles(root) {
  const result = enumerateGitAttributeFiles(root);
  for (const problem of result.problems) issues.push(`.gitattributes: ${problem}`);
  return result.files;
}

function runGitAttributeEnumerationMutationSuite() {
  const failures = [];
  const synthetic = parseGitAttributeIndex([
    `100644 ${'0'.repeat(40)} 0\t.cache/.gitattributes`,
    `100644 ${'1'.repeat(40)} 0\tnode_modules/vendor/.gitattributes`,
    `120000 ${'2'.repeat(40)} 0\tlinked/.gitattributes`,
  ].join('\0'));
  if (!synthetic.files.includes('.cache/.gitattributes')) failures.push('index parser skipped tracked .cache/.gitattributes');
  if (!synthetic.files.includes('node_modules/vendor/.gitattributes')) failures.push('index parser skipped tracked node_modules .gitattributes');
  if (!synthetic.problems.some((problem) => /linked\/\.gitattributes.*120000/.test(problem))) failures.push('index parser accepted a tracked symlink .gitattributes');

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'gitattributes-authority-'));
  try {
    const init = spawnSync('git', ['init', '--quiet'], { cwd: fixture, encoding: 'utf8', shell: false });
    if (init.error || init.status !== 0) return [...failures, 'could not initialize enumeration fixture'];
    for (const rel of ['.gitattributes', '.cache/.gitattributes', 'node_modules/vendor/.gitattributes']) {
      const absolute = path.join(fixture, rel);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, '* text=auto\n');
    }
    const add = spawnSync('git', ['add', '--force', '--', ...ATTRIBUTE_PATHSPECS], { cwd: fixture, encoding: 'utf8', shell: false });
    if (add.error || add.status !== 0) return [...failures, 'could not stage enumeration fixture'];
    const enumerated = enumerateGitAttributeFiles(fixture);
    for (const rel of ['.gitattributes', '.cache/.gitattributes', 'node_modules/vendor/.gitattributes']) {
      if (!enumerated.files.includes(rel)) failures.push(`tracked boundary fixture was skipped: ${rel}`);
    }
    if (enumerated.problems.length) failures.push(`enumeration fixture reported: ${enumerated.problems.join('; ')}`);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
  return failures;
}

function parseGitAttributeAuthority(rel, attributes) {
  const active = attributes
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line && !line.startsWith('#'));
  const macroDefinitions = new Map();
  const findings = [];
  const macroTokenName = (token) => token.replace(/^[-!]/, '').split('=', 1)[0];

  for (const { line, number } of active) {
    const tokens = line.split(/\s+/);
    const macro = tokens[0].match(/^\[attr\]([^\s]+)$/);
    if (macro) macroDefinitions.set(macro[1], { tokens: tokens.slice(1), rel, number, line });
    if (tokens.slice(1).some((token) => /^(?:whitespace(?:=|$)|-whitespace$|!whitespace$)/.test(token))) {
      findings.push({ rel, number, line, kind: 'whitespace-token' });
    }
  }

  const whitespaceMacros = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, definition] of macroDefinitions) {
      if (whitespaceMacros.has(name)) continue;
      if (definition.tokens.some((token) =>
        /^(?:whitespace(?:=|$)|-whitespace$|!whitespace$)/.test(token)
        || whitespaceMacros.has(macroTokenName(token)))) {
        whitespaceMacros.add(name);
        changed = true;
      }
    }
  }

  for (const name of whitespaceMacros) {
    const definition = macroDefinitions.get(name);
    findings.push({ ...definition, kind: 'whitespace-macro-definition' });
  }
  for (const { line, number } of active) {
    const tokens = line.split(/\s+/).slice(1);
    if (tokens.some((token) => whitespaceMacros.has(macroTokenName(token)))) {
      findings.push({ rel, number, line, kind: 'whitespace-macro-application' });
    }
  }
  return findings;
}

function validateActionlintLicenseWhitespacePolicy(attributeFiles) {
  const expected = 'tools/actionlint/v1.7.7/LICENSE.txt whitespace=-blank-at-eof';
  const findings = [];
  for (const [rel, attributes] of Object.entries(attributeFiles)) {
    findings.push(...parseGitAttributeAuthority(rel, attributes));
  }
  if (
    findings.length !== 1
    || findings[0].rel !== '.gitattributes'
    || findings[0].kind !== 'whitespace-token'
    || findings[0].line !== expected
  ) {
    return [`repository-wide whitespace authority must equal exactly root rule: ${expected}`];
  }
  return [];
}

function runActionlintLicenseWhitespaceMutationSuite(attributeFiles) {
  const rootAttributes = attributeFiles['.gitattributes'];
  const mutations = [
    { ...attributeFiles, '.gitattributes': `${rootAttributes.trimEnd()}\n* whitespace=-blank-at-eof\n` },
    { ...attributeFiles, '.gitattributes': `${rootAttributes.trimEnd()}\n* whitespace=-trailing-space\n` },
    { ...attributeFiles, '.gitattributes': `${rootAttributes.trimEnd()}\n* -whitespace\n` },
    { ...attributeFiles, '.gitattributes': `${rootAttributes.trimEnd()}\n[attr]noeof whitespace=-blank-at-eof\n* noeof\n` },
    { ...attributeFiles, '.gitattributes': `${rootAttributes.trimEnd()}\n* whitespace=-blank-at-eof\n* !whitespace\n` },
    { ...attributeFiles, 'nested/.gitattributes': '* whitespace=-blank-at-eof\n' },
    {
      ...attributeFiles,
      '.gitattributes': rootAttributes.replace(
        'tools/actionlint/v1.7.7/LICENSE.txt whitespace=-blank-at-eof',
        'tools/actionlint/** whitespace=-blank-at-eof',
      ),
    },
  ];
  const undetected = mutations.filter((mutation) => validateActionlintLicenseWhitespacePolicy(mutation).length === 0);
  return undetected.length ? [`${undetected.length} repository-wide whitespace authority mutation(s) escaped detection`] : [];
}

function jobSection(workflow, name, nextName = null) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return '';
  const offset = start + marker.length;
  if (nextName) {
    const end = workflow.indexOf(`\n  ${nextName}:\n`, offset);
    return end < 0 ? workflow.slice(offset) : workflow.slice(offset, end);
  }
  const rest = workflow.slice(offset);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next);
}

function withoutJob(workflow, name) {
  const marker = `\n  ${name}:\n`;
  const start = workflow.indexOf(marker);
  if (start < 0) return workflow;
  const offset = start + marker.length;
  const rest = workflow.slice(offset);
  const next = rest.search(/\n  [A-Za-z0-9_-]+:\n/);
  const end = next < 0 ? workflow.length : offset + next;
  return workflow.slice(0, start) + workflow.slice(end);
}

function loadWorkflowTexts() {
  if (!fs.existsSync(WORKFLOW_DIR)) {
    issues.push('.github/workflows: missing');
    return {};
  }
  return Object.fromEntries(
    fs.readdirSync(WORKFLOW_DIR)
      .filter((name) => /\.ya?ml$/.test(name))
      .sort()
      .map((name) => {
        const rel = `.github/workflows/${name}`;
        return [rel, read(rel)];
      }),
  );
}

function checkNoUndeclaredWrites(file, text) {
  for (const [pattern, label] of FORBIDDEN_VALIDATION_WRITES) {
    mustNot(file, text, pattern, `active workflow contains undeclared source mutation: ${label}`);
  }
  mustNot(file, text, /^\s{4,}contents:\s*write\s*$/m, 'job-level contents: write requires an explicit capability contract');
}

function checkAutofixCapability(file, text, jobName, requiredPatterns) {
  const job = jobSection(text, jobName);
  if (!job) {
    issues.push(`${file}: explicit autofix job missing: ${jobName}`);
    return;
  }

  must(file, job, /github\.event_name == 'pull_request'/, `${jobName} must be pull-request-only`);
  must(file, job, /contains\(github\.event\.pull_request\.labels\.\*\.name,\s*'autofix'\)/, `${jobName} must require the autofix label`);
  must(file, job, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/, `${jobName} must reject fork write capability`);
  must(file, job, /permissions:\s*\n\s*contents:\s*write/, `${jobName} must declare job-local contents: write`);
  must(file, job, /pull-requests:\s*read/, `${jobName} must receive read-only PR metadata for live lease verification`);
  must(file, job, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\}\}/, `${jobName} must checkout the immutable queued PR head`);
  must(file, job, /node scripts\/writer-lease\.mjs snapshot/, `${jobName} must snapshot the queued machine writer lease`);
  must(file, job, /writer-lease\.mjs assert-live --phase=pre-mutation/, `${jobName} must reject a stale lease before local mutation`);
  must(file, job, /writer-lease\.mjs assert-live --phase=pre-commit/, `${jobName} must prove live lease + expected head before commit`);
  must(file, job, /writer-lease\.mjs assert-live --phase=pre-push/, `${jobName} must re-prove live lease + expected head immediately before push`);
  must(file, job, /git diff --check/, `${jobName} must validate generated diff`);
  must(file, job, /\bgit commit\b/, `${jobName} must publish only an intentional commit`);
  must(file, job, /--force-with-lease="refs\/heads\/\$\{HEAD_REF\}:\$\{EXPECTED_HEAD\}"/, `${jobName} must CAS-push against the queued expected head`);
  must(file, job, /Writer-Lease:|writer-lease\.mjs trailer/, `${jobName} must stamp the machine lease identity into its commit`);
  mustNot(file, job, /\bgit push origin "HEAD:\$\{HEAD_REF\}"/, `${jobName} must not blind-push a mutable branch ref`);
  must(file, job, /--write\b/, `${jobName} must invoke an explicit writer`);
  const writeAt = job.search(/--write\b/);
  const validateAt = job.search(/\n\s*- name:\s+Validate/i);
  const commitAt = job.search(/\bgit commit\b/);
  if (writeAt < 0 || validateAt < writeAt || commitAt < validateAt) {
    issues.push(`${file}: ${jobName} must write, validate, then commit in that order`);
  }
  mustNot(file, job, /\bgit add (?:-A|\.)\b/, `${jobName} must not stage untracked repository-wide changes`);

  for (const [pattern, message] of requiredPatterns) must(file, job, pattern, `${jobName} ${message}`);
}

function checkTransactionalMetadataCapture(file, text) {
  mustNot(file, text, /^\s{4,}contents:\s*write\s*$/m, 'transactional observation capture must not receive write credentials');
  must(file, text, /editorial-metadata-registry\.js --write/, 'must retain explicit observation capture command');
  must(file, text, /restore_registry\(\)/, 'temporary registry write must define a restore function');
  must(file, text, /trap restore_registry EXIT/, 'temporary registry write must restore on failure');
  must(file, text, /git diff --exit-code -- data\/editorial-metadata\.json/, 'temporary registry write must prove exact-file restoration');
  mustNot(file, text, /\bgit\s+(?:commit|push)\b/, 'transactional observation capture must never publish source changes');

  const scrubbed = text.replace(/editorial-metadata-registry\.js --write/g, 'editorial-metadata-registry.js --transactional-observation');
  checkNoUndeclaredWrites(file, scrubbed);
}

function topLevelPermissions(workflow) {
  const match = workflow.match(/^permissions:\s*\n((?:^[ \t]+.*(?:\n|$))*)/m);
  return match ? match[1] : '';
}

const KNOWN_AUTOFIX_RATCHETS = Object.freeze({
  '.github/workflows/glossary-contract.yml:placement-autofix': [
    [/glossary-placement-normalizer\.js --write/, 'must own glossary placement generation'],
    [/tooltip-trigger-normalizer\.js --write/, 'must own tooltip trigger generation'],
    [/tooltip-style-normalizer\.js --write/, 'must own tooltip style generation'],
    [/cache-bust\.js --write/, 'must explicitly regenerate asset revisions'],
    [/glossary-contract-audit\.js[\s\S]*cache-bust\.js/, 'must validate generated source before commit'],
  ],
  '.github/workflows/search-manifest-policy.yml:search-manifest-autofix': [
    [/search-manifest-policy-normalizer\.js[\s\S]*--write/, 'must own search membership generation'],
    [/rss-feed-normalizer\.js --write/, 'must own deterministic RSS generation'],
    [/rss-feed-normalizer\.js --check[\s\S]*search-index-policy-inventory\.js/, 'must validate generated search policy before commit'],
    [/git diff --name-only[\s\S]*unexpected-search-autofix-paths/, 'must fail closed on undeclared output paths'],
  ],
  '.github/workflows/indexnow.yml:headline-autofix': [
    [/article-headline-contract\.js --write/, 'must own headline normalization'],
    [/article-headline-contract\.js[\s\S]*editorial-metadata-registry\.js --check[\s\S]*cache-bust\.js/, 'must validate headline, editorial registry and asset revisions before commit'],
  ],
});

function workflowJobNames(workflow) {
  const jobs = workflow.match(/^jobs:\s*\n([\s\S]*)$/m);
  if (!jobs) return [];
  const names = [];
  const pattern = /^  ([A-Za-z0-9_-]+):\s*$/gm;
  let match;
  while ((match = pattern.exec(jobs[1]))) names.push(match[1]);
  return names;
}

function isWriteCapabilityJob(job) {
  return /^\s*contents:\s*write\s*$/m.test(job)
    || FORBIDDEN_VALIDATION_WRITES.some(([pattern]) => pattern.test(job));
}

function checkWorkflowBasics(workflowTexts) {
  for (const [rel, text] of Object.entries(workflowTexts)) {
    must(rel, text, /^name:\s*.+/m, 'missing workflow name');
    must(rel, text, /^on:\s*$/m, 'missing on: block');
    const permissions = topLevelPermissions(text);
    if (!permissions) issues.push(`${rel}: missing top-level permissions block`);
    else {
      must(rel, permissions, /^\s{2}contents:\s*read\s*$/m, 'top-level permissions must include contents: read');
      mustNot(rel, permissions, /^\s{2}contents:\s*write\s*$/m, 'top-level contents: write is forbidden');
    }

    let ordinary = text;
    let capabilityScan = text;
    if (rel === '.github/workflows/editorial-metadata-v3.yml') {
      checkTransactionalMetadataCapture(rel, text);
      capabilityScan = capabilityScan.replace(
        /editorial-metadata-registry\.js --write/g,
        'editorial-metadata-registry.js --transactional-observation',
      );
      ordinary = capabilityScan;
    }

    for (const jobName of workflowJobNames(capabilityScan)) {
      const job = jobSection(capabilityScan, jobName);
      if (!isWriteCapabilityJob(job)) continue;
      const ratchets = KNOWN_AUTOFIX_RATCHETS[`${rel}:${jobName}`] || [];
      checkAutofixCapability(rel, text, jobName, ratchets);
      ordinary = withoutJob(ordinary, jobName);
    }

    checkNoUndeclaredWrites(rel, ordinary);
  }
}

function checkPackageScripts(scripts) {
  for (const [name, pattern, message] of [
    ['ci:check', /cache-bust/, 'must include read-only asset revision drift check'],
    ['ci:check', /validate:static-publication/, 'must include static publication validation'],
    ['ci:check', /workflows:check/, 'must include workflow policy validation'],
    ['validate:static-publication', /page-ownership:check/, 'must include page-ownership source guard'],
    ['strangler:validate', /page-ownership:dist/, 'must verify ownership after building dist'],
    ['strangler:audit', /page-ownership:dist/, 'must verify ownership before publication audit'],
    ['strangler:audit:pagefind', /page-ownership:dist/, 'must verify ownership before Pagefind audit'],
    ['strangler:audit:production-like', /page-ownership:dist:production-like/, 'must verify production-like ownership'],
    ['strangler:audit:production-like', /contract:compare:dist/, 'must compare public URL contract'],
    ['strangler:audit:production-like', /dist:jsonld:audit/, 'must parse JSON-LD'],
    ['strangler:audit:production-like', /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'must audit rich-results schema'],
    ['strangler:audit:production-like', /audit:premium-controls|premium-controls-rollout-audit\.js/, 'must enforce PremiumControls rollout'],
    ['strangler:deploy-readiness', /strangler:audit:production-like/, 'must include production-like artifact audit'],
    ['strangler:deploy-readiness', /visual:parity:production|visual-parity-contract\.js/, 'must include visual parity'],
    ['workflows:lint', /actionlint/, 'must run actionlint'],
  ]) mustScript(scripts, name, pattern, message);

  const cacheBust = scripts['cache-bust'];
  if (typeof cacheBust !== 'string') issues.push('package.json scripts.cache-bust: missing');
  else if (/--write\b/.test(cacheBust)) issues.push('package.json scripts.cache-bust: default command must remain read-only');

  for (const [name, command] of Object.entries(scripts)) {
    if (!/(?:^|:)(?:check|audit|validate|lint|guard|test)(?::|$)|^ci:check$/.test(name)) continue;
    for (const [pattern, label] of FORBIDDEN_VALIDATION_WRITES) {
      if (pattern.test(command)) issues.push(`package.json scripts.${name}: validation command contains forbidden source mutation: ${label}`);
    }
  }
}

function checkReleaseWorkflow(deployPath, deploy) {
  const releaseReadiness = jobSection(deploy, 'readiness', 'deploy');
  const releaseDeploy = jobSection(deploy, 'deploy');

  must(deployPath, deploy, /push:\s*\n\s*branches:\s*\[main\][\s\S]{0,100}- '\*\*'/, 'must own every main push through catch-all coverage');
  must(deployPath, deploy, /workflow_dispatch:[\s\S]{0,240}release_sha:/, 'must keep exact manual release recovery input');
  must(deployPath, deploy, /^permissions:\s*\n\s*contents:\s*read\s*$/m, 'top-level permissions must remain read-only');
  must(deployPath, deploy, /^concurrency:\s*$/m, 'must keep concurrency');
  must(deployPath, deploy, /CONTROL_PLANE_SHA:\s*\$\{\{ github\.sha \}\}/, 'control-plane SHA must remain workflow-source identity');
  must(deployPath, deploy, /RELEASE_SHA:\s*\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.release_sha \|\| github\.sha \}\}/, 'release SHA must remain independently selectable');

  must(deployPath, releaseReadiness, /permissions:\s*\n\s*contents:\s*read/, 'candidate readiness job must remain read-only');
  must(deployPath, releaseReadiness, /ref:\s*\$\{\{ env\.RELEASE_SHA \}\}[\s\S]{0,100}fetch-depth:\s*0[\s\S]{0,100}persist-credentials:\s*false/, 'candidate checkout must be exact, full-history and credential-free');
  must(deployPath, releaseReadiness, /git fetch --no-tags origin "\+main:refs\/remotes\/origin\/main"/, 'candidate job must fetch current-main control plane');
  must(deployPath, releaseReadiness, /git rev-parse --verify 'HEAD\^\{commit\}'[\s\S]{0,100}= "\$RELEASE_SHA"/, 'candidate job must verify exact release commit');
  must(deployPath, releaseReadiness, /'refs\/remotes\/origin\/main\^\{commit\}'[\s\S]{0,100}= "\$CONTROL_PLANE_SHA"/, 'candidate job must verify exact control plane');
  must(deployPath, releaseReadiness, /git merge-base --is-ancestor "\$RELEASE_SHA" "\$CONTROL_PLANE_SHA"/, 'manual release must prove ancestry');
  must(deployPath, releaseReadiness, /GITHUB_EVENT_NAME" = "push"[\s\S]{0,120}RELEASE_SHA" = "\$CONTROL_PLANE_SHA/, 'automatic release must use one SHA for both roles');
  must(deployPath, releaseReadiness, /node-version:\s*['"]22\.23\.1['"]/, 'candidate job must use exact Node 22.23.1');
  must(deployPath, releaseReadiness, /npm run validate:static-publication/, 'candidate job must run full source gates');
  must(deployPath, releaseReadiness, /npm run strangler:build:production-like/, 'candidate job must build production-like dist once');
  must(deployPath, releaseReadiness, /page-ownership:dist:production-like|check-page-ownership\.js[^\n]*--dist[^\n]*--production-like/, 'candidate job must derive route coverage from ownership registry');
  must(deployPath, releaseReadiness, /npm run pagefind:build:dist/, 'candidate job must build Pagefind');
  must(deployPath, releaseReadiness, /visual:parity:production|visual-parity-contract\.js/, 'candidate job must run visual parity');
  must(deployPath, releaseReadiness, /dist-publication-audit\.js[^\n]*--require-pagefind[^\n]*--forbid-dev|npm run strangler:audit:production-like/, 'candidate job must run strict publication audit');
  must(deployPath, releaseReadiness, /contract:compare:dist/, 'candidate job must compare public URL contract');
  must(deployPath, releaseReadiness, /dist:jsonld:audit|dist-jsonld-audit\.js[^\n]*--root\s+dist/, 'candidate job must parse JSON-LD');
  must(deployPath, releaseReadiness, /schema:rich-results:audit:dist|schema-rich-results-audit\.js[^\n]*--root\s+dist/, 'candidate job must audit rich-results schema');
  must(deployPath, releaseReadiness, /audit:premium-controls|premium-controls-rollout-audit\.js/, 'candidate job must enforce PremiumControls rollout');
  must(deployPath, releaseReadiness, /playwright install --with-deps chromium/, 'candidate job must install Chromium before browser gates');
  must(deployPath, releaseReadiness, /dist-smoke-audit\.js[^\n]*--no-build[^\n]*--production-like/, 'candidate job must run broad runtime smoke');
  must(deployPath, releaseReadiness, /sw:dist:audit:deploy-switch|sw-dist-readiness-audit\.js[^\n]*--require-cache-bump/, 'candidate job must enforce service-worker readiness');
  must(deployPath, releaseReadiness, /git diff --exit-code/, 'candidate validation must leave tracked source clean');
  must(deployPath, releaseReadiness, /actions\/upload-artifact@[a-f0-9]{40}/, 'candidate job must upload immutable evidence');

  must(deployPath, releaseDeploy, /needs:\s*readiness/, 'privileged deploy must depend on candidate readiness');
  must(deployPath, releaseDeploy, /permissions:\s*\n\s*actions:\s*read\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/, 'privileged deploy permissions must be exact');
  must(deployPath, releaseDeploy, /verify-release-candidate\.mjs[\s\S]*actions\/upload-pages-artifact@[a-f0-9]{40}/, 'candidate verification must precede Pages packaging');
  must(deployPath, releaseDeploy, /live-release-contract\.mjs[\s\S]*tts-live-deployment-contract\.mjs/, 'generic live witness must precede capability witness');
  mustNot(deployPath, releaseDeploy, /actions\/checkout@|\bnpm ci\b|strangler:build|cache-bust\.js|validate:static-publication|pagefind:build/, 'privileged deploy must not checkout, install, validate or rebuild source');
  mustNot(deployPath, deploy, /uses:\s*actions\/(?:checkout|setup-node|upload-artifact|download-artifact|upload-pages-artifact|deploy-pages)@v\d+/i, 'release workflow must not use mutable action tags');

  for (const [label, pin] of Object.entries(RELEASE_ACTION_PINS)) {
    must(deployPath, deploy, new RegExp(pin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `approved ${label} action identity drifted`);
  }
  if (count(deploy, /actions\/checkout@/g) !== 1) issues.push(`${deployPath}: exactly one checkout is allowed`);
  if (count(deploy, /\bnpm ci\b/g) !== 1) issues.push(`${deployPath}: exactly one npm ci is allowed`);
  if (count(deploy, /npm run strangler:build:production-like/g) !== 1) issues.push(`${deployPath}: exactly one production-like build is allowed`);
  if (count(deploy, /actions\/deploy-pages@/g) !== 1) issues.push(`${deployPath}: exactly one Pages deployment is allowed`);
}

function checkDistDryRun(file, text) {
  for (const [pattern, message] of [
    [/workflow_dispatch:/, 'must be manually runnable only'],
    [/node-version:\s*['"]?22(?:\.23\.1)?['"]?/, 'must use Node 22+'],
    [/npm ci/, 'must install dependencies via npm ci'],
    [/playwright install --with-deps chromium/, 'must install Chromium'],
    [/npm run ci:check/, 'must run source publication gates'],
    [/git diff --exit-code/, 'must prove source validation is read-only'],
    [/npm run astro:audit:about:shots/, 'must generate review screenshots'],
    [/npm run strangler:deploy-readiness/, 'must run production-like readiness'],
    [/check-page-ownership\.js\s+--dist\s+--production-like|npm run page-ownership:dist:production-like/, 'must derive route coverage from ownership registry'],
    [/test -f dist\/pagefind\/pagefind\.js/, 'must require Pagefind runtime'],
    [/test -f dist\/\.nojekyll/, 'must require Pages marker'],
    [/actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/, 'must upload review artifacts without deploying'],
  ]) must(file, text, pattern, message);

  mustNot(file, text, /^\s*test -f dist\/(?:index\.html|.+\/index\.html)\s*$/m, 'route files must not be hardcoded; ownership registry is the route authority');
  mustNot(file, text, /actions\/deploy-pages|actions\/upload-pages-artifact|pages:\s*write|id-token:\s*write/, 'must not own Pages capability');
  mustNot(file, text, /\bpush:|\bschedule:|workflow_run:/, 'must remain workflow_dispatch-only');
}

function checkActionlintOfflineAuthority(workflowTexts) {
  const workflowPath = '.github/workflows/node-toolchain-contract.yml';
  const workflow = workflowTexts[workflowPath] || read(workflowPath);
  const runnerPath = 'scripts/run-actionlint.mjs';
  const runner = read(runnerPath);
  const contractPath = 'scripts/run-actionlint-contract-test.mjs';
  const contract = read(contractPath);
  const policyPath = 'scripts/check-workflows.js';
  const policy = read(policyPath);
  const configPath = '.github/actionlint.yaml';
  const config = read(configPath);
  const toolRoot = `tools/actionlint/v${ACTIONLINT_OFFLINE_AUTHORITY.version}`;
  const manifestPath = `${toolRoot}/manifest.json`;
  const witnessPath = `${toolRoot}/ACQUISITION_WITNESS.json`;
  const provenancePath = `${toolRoot}/PROVENANCE.md`;

  for (const rel of [
    '.gitattributes',
    '**/.gitattributes',
    '.github/actionlint.yaml',
    'audit/external-checks/README.md',
    'scripts/run-actionlint.mjs',
    'scripts/run-actionlint-contract-test.mjs',
    'tools/actionlint/**',
  ]) {
    const occurrences = count(workflow, new RegExp(`- '${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'));
    if (occurrences !== 2) issues.push(`${workflowPath}: ${rel} must trigger both pull_request and main-push validation`);
  }

  must(workflowPath, workflow, /node scripts\/run-actionlint-contract-test\.mjs/, 'exact-pins job must execute the offline actionlint contract');
  must(workflowPath, workflow, /actionlint-portability:/, 'must retain permanent cross-platform actionlint evidence');
  for (const [target, runnerLabel] of [
    ['linux-x64', 'ubuntu-24.04'],
    ['win32-x64', 'windows-2025'],
    ['darwin-x64', 'macos-15-intel'],
  ]) {
    must(workflowPath, workflow, new RegExp(`target:\\s*${target}[\\s\\S]{0,100}runner:\\s*${runnerLabel}`), `portability matrix must execute ${target} on ${runnerLabel}`);
  }
  must(workflowPath, jobSection(workflow, 'actionlint-portability'), /github\.event\.pull_request\.head\.sha \|\| github\.sha/, 'portability job must checkout the exact event head');
  must(workflowPath, jobSection(workflow, 'actionlint-portability'), /git diff --exit-code/, 'portability job must prove validation is read-only');

  must(configPath, config, /self-hosted-runner:\s*\n\s*labels:\s*\n\s*- macos-15-intel/, 'pinned actionlint must admit the current GitHub-hosted Intel runner label');
  must(runnerPath, runner, /TOOL_VERSION = '1\.7\.7'/, 'tool version authority drifted');
  must(runnerPath, runner, new RegExp(ACTIONLINT_OFFLINE_AUTHORITY.tagCommit), 'tag-commit authority drifted');
  must(runnerPath, runner, /verifyFile\(archivePath[\s\S]{0,300}fs\.existsSync\(cacheDir\)/, 'selected archive must be verified before cache trust');
  must(runnerPath, runner, /target\.archiveSha256/, 'cache identity must include the archive digest');
  mustNot(runnerPath, runner, /\bfetch\s*\(|node:https|node:http|node:net|node:tls|releases\/download|api\.github\.com|\b(?:curl|wget|npx)\b/, 'runtime actionlint path must contain no network or installer path');

  for (const pattern of [
    /NETWORK_FORBIDDEN_BY_ACTIONLINT_CONTRACT/,
    /warm cache corruption must fail closed/,
    /manifest size corruption must fail closed/,
    /manifest hash corruption must fail closed/,
    /syntactically invalid workflow must fail/,
    /actual checked-in binary must report version 1\.7\.7/,
    /zero-argument default must lint the repository workflows/,
    /actionlintArgs\(\['-no-color', 'one\.yml', '--shellcheck='\]\)/,
  ]) must(contractPath, contract, pattern, `offline regression fixture missing: ${pattern}`);
  for (const pattern of [
    /\* whitespace=-trailing-space/,
    /\* -whitespace/,
    /\[attr\]noeof whitespace=-blank-at-eof/,
    /\* !whitespace/,
    /nested\/\.gitattributes/,
    /listGitAttributeFiles\(ROOT\)/,
    /\.cache\/\.gitattributes/,
    /node_modules\/vendor\/\.gitattributes/,
    /tracked \.gitattributes mode \$\{mode\} is not a regular file/,
  ]) must(policyPath, policy, pattern, `repository-wide whitespace authority fixture missing: ${pattern}`);

  let manifest = null;
  try { manifest = JSON.parse(read(manifestPath)); }
  catch (error) { issues.push(`${manifestPath}: invalid JSON (${error.message})`); }
  if (manifest) {
    if (manifest.version !== ACTIONLINT_OFFLINE_AUTHORITY.version) issues.push(`${manifestPath}: version authority drifted`);
    if (manifest.upstream?.tagCommit !== ACTIONLINT_OFFLINE_AUTHORITY.tagCommit) issues.push(`${manifestPath}: tag commit authority drifted`);
    if (manifest.upstream?.releaseId !== ACTIONLINT_OFFLINE_AUTHORITY.releaseId) issues.push(`${manifestPath}: release ID authority drifted`);
    const targetKeys = Object.keys(manifest.targets || {}).sort();
    const expectedKeys = Object.keys(ACTIONLINT_OFFLINE_AUTHORITY.targets).sort();
    if (JSON.stringify(targetKeys) !== JSON.stringify(expectedKeys)) issues.push(`${manifestPath}: target set must remain exactly six canonical mappings`);
    for (const [key, expected] of Object.entries(ACTIONLINT_OFFLINE_AUTHORITY.targets)) {
      const target = manifest.targets?.[key];
      if (!target) continue;
      for (const [field, value] of [['archive', expected.file], ['assetId', expected.assetId], ['archiveSize', expected.size], ['archiveSha256', expected.sha256]]) {
        if (target[field] !== value) issues.push(`${manifestPath}: ${key}.${field} drifted from pinned upstream authority`);
      }
      verifyPinnedFile(`${toolRoot}/${expected.file}`, expected.size, expected.sha256);
    }
    const checksum = manifest.upstream?.checksums || {};
    for (const [field, value] of [['file', ACTIONLINT_OFFLINE_AUTHORITY.checksums.file], ['assetId', ACTIONLINT_OFFLINE_AUTHORITY.checksums.assetId], ['size', ACTIONLINT_OFFLINE_AUTHORITY.checksums.size], ['sha256', ACTIONLINT_OFFLINE_AUTHORITY.checksums.sha256]]) {
      if (checksum[field] !== value) issues.push(`${manifestPath}: upstream checksums.${field} drifted`);
    }
  }

  verifyPinnedFile(`${toolRoot}/${ACTIONLINT_OFFLINE_AUTHORITY.checksums.file}`, ACTIONLINT_OFFLINE_AUTHORITY.checksums.size, ACTIONLINT_OFFLINE_AUTHORITY.checksums.sha256);
  verifyPinnedFile(`${toolRoot}/LICENSE.txt`, 1067, '03a26b06d224380a02bf100e05fff3b2dfc71b14d4e2fa685ec9963a87563c22');

  let witness = null;
  try { witness = JSON.parse(read(witnessPath)); }
  catch (error) { issues.push(`${witnessPath}: invalid JSON (${error.message})`); }
  if (witness) {
    if (witness.tagCommit !== ACTIONLINT_OFFLINE_AUTHORITY.tagCommit || witness.releaseId !== ACTIONLINT_OFFLINE_AUTHORITY.releaseId) issues.push(`${witnessPath}: release identity drifted`);
    if (witness.acquisition?.workflowRunId !== 31709241523 || witness.acquisition?.workflowRunAttempt !== 1 || witness.acquisition?.workflowSha !== 'b03f15784c991300d7bef65c857e5da4f18301bf') issues.push(`${witnessPath}: acquisition run identity drifted`);
  }
  const provenance = read(provenancePath);
  must(provenancePath, provenance, /03d0035246f3e81f36aed592ffb4bebf33a03106/, 'must bind the exact upstream tag commit');
  must(provenancePath, provenance, /31709241523/, 'must retain the exact acquisition run');
  must(provenancePath, provenance, /immutable[^\n]*false/i, 'must disclose that GitHub release metadata is not immutable');
  must(provenancePath, provenance, /unsigned/i, 'must disclose the unsigned lightweight tag limitation');
  const attributesPath = '.gitattributes';
  const attributeFiles = Object.fromEntries(listGitAttributeFiles(ROOT).map((rel) => [rel, read(rel)]));
  for (const issue of runGitAttributeEnumerationMutationSuite()) issues.push(`${attributesPath}: enumeration mutation suite: ${issue}`);
  for (const issue of validateActionlintLicenseWhitespacePolicy(attributeFiles)) issues.push(`${attributesPath}: ${issue}`);
  for (const issue of runActionlintLicenseWhitespaceMutationSuite(attributeFiles)) issues.push(`${attributesPath}: mutation suite: ${issue}`);
}

function checkSupportingWorkflows(workflowTexts) {
  const diagnosticsPath = '.github/workflows/indexnow.yml';
  const diagnostics = workflowTexts[diagnosticsPath] || read(diagnosticsPath);
  must(diagnosticsPath, diagnostics, /^permissions:\s*\n\s*contents:\s*read\s*$/m, 'must remain read-only at top level');
  must(diagnosticsPath, diagnostics, /editorial-metadata-registry\.js --check/, 'must validate metadata registry');
  must(diagnosticsPath, diagnostics, /node scripts\/cache-bust\.js/, 'must check asset revisions without writing');
  mustNot(diagnosticsPath, jobSection(diagnostics, 'diagnostics'), /\bnpm ci\b|strangler:build|pagefind:build|dist-publication-audit|playwright install/, 'diagnostics job must not duplicate candidate installation or build');

  const sourceLinksPath = '.github/workflows/source-links.yml';
  const sourceLinks = workflowTexts[sourceLinksPath] || read(sourceLinksPath);
  must(sourceLinksPath, sourceLinks, /workflow_dispatch:/, 'must be manually runnable');
  must(sourceLinksPath, sourceLinks, /schedule:/, 'must be scheduled');
  must(sourceLinksPath, sourceLinks, /npm run strangler:build:production-like/, 'must build production-like dist first');
  must(sourceLinksPath, sourceLinks, /source-link-audit\.js[^\n]*--root\s+dist/, 'must audit production-like dist');

  const interactivePath = '.github/workflows/interactive-audit.yml';
  const interactive = workflowTexts[interactivePath] || read(interactivePath);
  must(interactivePath, interactive, /workflow_dispatch:/, 'must be manually runnable');
  must(interactivePath, interactive, /schedule:/, 'must be scheduled');
  must(interactivePath, interactive, /playwright install --with-deps chromium/, 'must install Chromium');
  must(interactivePath, interactive, /npm run strangler:build:production-like/, 'must build production-like dist first');
  must(interactivePath, interactive, /npm run pagefind:build:dist/, 'must build Pagefind');
  must(interactivePath, interactive, /npm run interactive-audit/, 'must execute interactive audit');

  const sharedPath = '.github/workflows/shared-files-guard.yml';
  const shared = workflowTexts[sharedPath] || read(sharedPath);
  must(sharedPath, shared, /npm run workflows:check/, 'must run workflow policy contracts');
  must(sharedPath, shared, /npm run workflows:lint/, 'must run blocking actionlint');

  const notifyPath = '.github/workflows/notify-on-failure.yml';
  const notify = workflowTexts[notifyPath] || read(notifyPath);
  for (const workflowName of [
    'Native Source Contract',
    'Route Registry Validators',
    'Metadata & IndexNow Readiness',
    'Search Manifest Policy',
    'Deploy Candidate Contract',
    'Source Link Audit',
    'Runtime Interactive Audit',
    'Dist Strangler Dry Run',
    'Visual Parity Guard — pixel-diff',
    'Shared Files Guard',
  ]) must(notifyPath, notify, new RegExp(workflowName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `must listen for ${workflowName}`);
}

const workflowTexts = loadWorkflowTexts();
checkWorkflowBasics(workflowTexts);

let pkg = { scripts: {} };
try { pkg = JSON.parse(read('package.json')); }
catch (error) { issues.push(`package.json: invalid JSON: ${error.message}`); }
const scripts = pkg.scripts || {};
checkPackageScripts(scripts);

const deployPath = '.github/workflows/deploy.yml';
const deploy = workflowTexts[deployPath] || read(deployPath);
checkReleaseWorkflow(deployPath, deploy);

const distDryRunPath = '.github/workflows/dist-dry-run.yml';
const distDryRun = workflowTexts[distDryRunPath] || read(distDryRunPath);
checkDistDryRun(distDryRunPath, distDryRun);
checkActionlintOfflineAuthority(workflowTexts);
checkSupportingWorkflows(workflowTexts);

const shared = workflowTexts['.github/workflows/shared-files-guard.yml'] || '';
const diagnostics = workflowTexts['.github/workflows/indexnow.yml'] || '';
const cacheBustPolicyInput = {
  sharedFiles: shared,
  readiness: diagnostics,
  deploy,
  cacheBust: read('scripts/cache-bust.js'),
  workflowTexts,
};
for (const issue of validateCacheBustWorkflowPolicy(cacheBustPolicyInput)) issues.push(`cache-bust fail-closed policy: ${issue}`);
for (const issue of runCacheBustWorkflowPolicyMutationSuite(cacheBustPolicyInput)) issues.push(`cache-bust policy mutation: ${issue}`);

console.log('\nGB WORKFLOW POLICY V2 CHECK');
if (issues.length) {
  console.log(`❌ ${issues.length} issue(s):`);
  issues.forEach((issue) => console.log(`- ${issue}`));
  process.exit(1);
}
console.log('✅ Workflow Policy v2 passed');
console.log('✅ Validation is source-read-only and least-privilege');
console.log('✅ Explicit autofix capabilities require machine writer lease + exact-head CAS; transactional observation remains isolated');
console.log('✅ Production route coverage is registry-driven');
console.log('✅ Candidate build, immutable promotion and live witnesses remain separated');
console.log('✅ Actionlint and SYSTEM gate notification coverage remain blocking');
console.log('✅ Actionlint source authority is offline, checksum-bound and cross-platform');
