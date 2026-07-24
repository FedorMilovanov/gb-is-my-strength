#!/usr/bin/env node
/**
 * Repository control-plane integrity audit.
 *
 * This is deliberately filesystem-derived: package commands and GitHub Actions
 * may not point at deleted local files, temporary workflows may not survive
 * their transaction, and long-lived workflows may not retain one-off lane
 * branch names.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const issues = [];
const warnings = [];
const references = [];
const acceptedWriteWorkflows = [];

function exists(repoPath) {
  return fs.existsSync(path.join(ROOT, repoPath));
}

function addIssue(message) {
  if (!issues.includes(message)) issues.push(message);
}

function addWarning(message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function cleanToken(value) {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^\.\//, '')
    .replace(/[),;]+$/g, '');
}

const STATIC_PATH_RX = /(?:^|[\s"'=(:])((?:\.\/)?(?:scripts|js|css|data|migration|src|audit|docs|\.github)\/[A-Za-z0-9_./-]+\.(?:js|mjs|cjs|sh|py|ps1|json|ya?ml|md|css))(?![A-Za-z0-9_.-])/g;

function inspectStaticReferences(owner, text) {
  for (const match of text.matchAll(STATIC_PATH_RX)) {
    const target = cleanToken(match[1]);
    references.push({ owner, target });
    if (!exists(target)) addIssue(`${owner}: local reference is missing: ${target}`);
  }
}

function inspectNpmReferences(owner, command, scripts) {
  const runRx = /\bnpm\s+run(?:\s+--silent)?\s+([A-Za-z0-9:_-]+)/g;
  for (const match of command.matchAll(runRx)) {
    if (typeof scripts[match[1]] !== 'string') {
      addIssue(`${owner}: npm script reference is missing: ${match[1]}`);
    }
  }
}

function workflowFiles() {
  return fs.readdirSync(WORKFLOW_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
}

function triggerSection(text) {
  const boundary = text.search(/^\s*(?:concurrency|permissions|jobs):\s*$/m);
  return boundary >= 0 ? text.slice(0, boundary) : text;
}

let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
} catch (error) {
  addIssue(`package.json: cannot parse: ${error.message}`);
  pkg = { scripts: {} };
}

const scripts = pkg.scripts || {};
for (const [name, command] of Object.entries(scripts)) {
  inspectNpmReferences(`package.json scripts.${name}`, command, scripts);
  inspectStaticReferences(`package.json scripts.${name}`, command);
}

if (scripts['workflows:lint'] !== 'node scripts/run-actionlint.mjs') {
  addIssue('package.json scripts.workflows:lint must use scripts/run-actionlint.mjs');
}
if (scripts['control-plane:audit'] !== 'node scripts/repository-control-plane-audit.mjs') {
  addIssue('package.json scripts.control-plane:audit must expose the repository control-plane audit');
}

for (const name of workflowFiles()) {
  const file = `.github/workflows/${name}`;
  const text = fs.readFileSync(path.join(WORKFLOW_DIR, name), 'utf8');

  if (name.startsWith('_temp-')) {
    addIssue(`${file}: temporary workflow remains in the default-branch control plane`);
  }

  inspectStaticReferences(file, text);

  for (const match of text.matchAll(/uses:\s*["']?(\.\/[A-Za-z0-9_./-]+)["']?/g)) {
    const target = cleanToken(match[1]);
    references.push({ owner: file, target });
    if (!exists(target)) addIssue(`${file}: local action/workflow reference is missing: ${target}`);
  }

  for (const match of triggerSection(text).matchAll(/\b(?:lane|agent)\/(?!\*\*)[A-Za-z0-9._/-]+/g)) {
    addIssue(`${file}: long-lived workflow targets one-off branch ${match[0]}`);
  }

  if (/permissions:[\s\S]{0,240}?contents:\s*write/.test(text)) {
    const guardedAutofix = /contains\(github\.event\.pull_request\.labels\.\*\.name,\s*['"]autofix['"]\)/.test(text)
      && /github\.event\.pull_request\.head\.repo\.full_name\s*==\s*github\.repository/.test(text);
    if (guardedAutofix) acceptedWriteWorkflows.push(file);
    else addIssue(`${file}: contents: write has no accepted same-repository autofix guard`);
  }

  if (/releases\/download\/v[0-9.]+\/actionlint_/.test(text)) {
    addIssue(`${file}: inline actionlint installer duplicates scripts/run-actionlint.mjs`);
  }
}

const requiredDocs = [
  'AGENTS.md',
  'docs/WORK_MODES.md',
  'docs/LANE_LOCK_POLICY.md',
  'docs/AGENT_PUSH_MODEL.md',
  'docs/OWNER-INVARIANTS.md',
  'docs/SANDBOX-ENV-2026-06-21.md',
  'docs/refactor-2026/lanes/README.md',
  'docs/refactor-2026/REFRACTOR_AUDIT_LIVING.md',
  'audit/external-checks/README.md',
];
for (const file of requiredDocs) {
  if (!exists(file)) addIssue(`required governance document is missing: ${file}`);
}

const sharedGuardPath = '.github/workflows/shared-files-guard.yml';
const sharedGuard = exists(sharedGuardPath)
  ? fs.readFileSync(path.join(ROOT, sharedGuardPath), 'utf8')
  : '';
if (!/npm run control-plane:audit/.test(sharedGuard)) {
  addIssue(`${sharedGuardPath}: must run npm run control-plane:audit`);
}
if (!/npm run workflows:lint/.test(sharedGuard)) {
  addIssue(`${sharedGuardPath}: must run npm run workflows:lint`);
}

fs.mkdirSync(REPORTS, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  workflows: workflowFiles().length,
  packageScripts: Object.keys(scripts).length,
  localReferences: references.length,
  acceptedWriteWorkflows,
  issues,
  warnings,
};
fs.writeFileSync(
  path.join(REPORTS, 'repository-control-plane-audit.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(REPORTS, 'repository-control-plane-audit.md'),
  [
    '# Repository control-plane audit',
    '',
    `- Workflows: ${report.workflows}`,
    `- Package scripts: ${report.packageScripts}`,
    `- Static local references checked: ${report.localReferences}`,
    `- Accepted same-repository autofix writers: ${acceptedWriteWorkflows.length}`,
    `- Issues: ${issues.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Issues',
    ...(issues.length ? issues.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Accepted write workflows',
    ...(acceptedWriteWorkflows.length ? acceptedWriteWorkflows.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- None']),
    '',
  ].join('\n'),
);

console.log(`Control-plane audit: ${report.workflows} workflows, ${report.packageScripts} npm scripts, ${report.localReferences} local references`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
if (issues.length) {
  for (const issue of issues) console.error(`ERROR ${issue}`);
  process.exit(1);
}
console.log('✅ Repository control-plane integrity passed');
