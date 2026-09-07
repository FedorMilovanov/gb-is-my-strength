#!/usr/bin/env node
/**
 * Repository control-plane integrity audit.
 *
 * Filesystem-derived references, workflow permission inheritance, mutation
 * boundaries, privileged action identities, and current document authority are
 * checked together. Any new effective write scope or required governance
 * document must be registered before it can enter the control plane.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditWorkflowPermissionPolicy, parseWorkflow } from './lib/workflow-permission-policy.mjs';
import { runWorkflowPermissionPolicyRegressionTests } from './workflow-permission-policy-regression-test.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = path.join(ROOT, 'reports');
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');
const POLICY_PATH = 'data/workflow-permission-policy.json';
const DOCUMENT_AUTHORITY_PATH = 'data/document-authority.json';
const issues = [];
const warnings = [];
const references = [];

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

try {
  runWorkflowPermissionPolicyRegressionTests();
} catch (error) {
  addIssue(`workflow permission policy regressions failed: ${error.stack || error.message}`);
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

const parsedWorkflows = [];
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

  if (/releases\/download\/v[0-9.]+\/actionlint_/.test(text)) {
    addIssue(`${file}: inline actionlint installer duplicates scripts/run-actionlint.mjs`);
  }

  try {
    parsedWorkflows.push(parseWorkflow(text, file));
  } catch (error) {
    addIssue(`${file}: cannot parse workflow control plane: ${error.message}`);
  }
}

let permissionRegistry = null;
try {
  permissionRegistry = JSON.parse(fs.readFileSync(path.join(ROOT, POLICY_PATH), 'utf8'));
} catch (error) {
  addIssue(`${POLICY_PATH}: cannot parse workflow permission registry: ${error.message}`);
}

const permissionAudit = auditWorkflowPermissionPolicy(parsedWorkflows, permissionRegistry);
for (const issue of permissionAudit.issues) addIssue(issue);

let documentAuthority = null;
try {
  documentAuthority = JSON.parse(fs.readFileSync(path.join(ROOT, DOCUMENT_AUTHORITY_PATH), 'utf8'));
} catch (error) {
  addIssue(`${DOCUMENT_AUTHORITY_PATH}: cannot parse document authority registry: ${error.message}`);
}

let requiredDocs = [];
if (documentAuthority) {
  if (documentAuthority.schemaVersion !== 1 || documentAuthority.authorityId !== 'GB-DOCUMENT-AUTHORITY-V1') {
    addIssue(`${DOCUMENT_AUTHORITY_PATH}: document authority identity/schema drift`);
  }
  if (!Array.isArray(documentAuthority.documents)) {
    addIssue(`${DOCUMENT_AUTHORITY_PATH}: documents must be an array`);
  } else {
    requiredDocs = documentAuthority.documents
      .filter((doc) => doc && doc.required === true)
      .map((doc) => doc.path);
    for (const doc of documentAuthority.documents) {
      if (doc?.required === true && doc.status !== 'current') {
        addIssue(`${DOCUMENT_AUTHORITY_PATH}: required document is not current: ${doc.path}`);
      }
      if (doc?.required === true && (typeof doc.path !== 'string' || !doc.path)) {
        addIssue(`${DOCUMENT_AUTHORITY_PATH}: required document has invalid path`);
      }
    }
  }
}

for (const file of requiredDocs) {
  if (!exists(file)) addIssue(`required governance document is missing: ${file}`);
}
for (const file of [POLICY_PATH, DOCUMENT_AUTHORITY_PATH]) {
  if (!exists(file)) addIssue(`required control-plane registry is missing: ${file}`);
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
  requiredGovernanceDocuments: requiredDocs.length,
  effectivePermissionJobs: permissionAudit.effectivePermissions.length,
  privilegedJobs: permissionAudit.privilegedJobs,
  effectivePermissions: permissionAudit.effectivePermissions,
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
    `- Required governance documents: ${report.requiredGovernanceDocuments}`,
    `- Jobs with explicit effective permissions: ${report.effectivePermissionJobs}`,
    `- Registered privileged jobs: ${report.privilegedJobs.length}`,
    `- Issues: ${issues.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## Issues',
    ...(issues.length ? issues.map((item) => `- ${item}`) : ['- None']),
    '',
    '## Registered privileged jobs',
    ...(report.privilegedJobs.length
      ? report.privilegedJobs.map((item) => `- ${item.workflow} / ${item.job}: ${item.writeScopes.join(', ')} — ${item.purpose}`)
      : ['- None']),
    '',
    '## Effective permission inventory',
    ...report.effectivePermissions.map((item) => `- ${item.workflow} / ${item.job}: ${JSON.stringify(item.permissions)}`),
    '',
    '## Warnings',
    ...(warnings.length ? warnings.map((item) => `- ${item}`) : ['- None']),
    '',
  ].join('\n'),
);

console.log(`Control-plane audit: ${report.workflows} workflows, ${report.packageScripts} npm scripts, ${report.localReferences} local references, ${report.requiredGovernanceDocuments} required governance documents, ${report.privilegedJobs.length} privileged jobs`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
if (issues.length) {
  for (const issue of issues) console.error(`ERROR ${issue}`);
  process.exit(1);
}
console.log('✅ Repository control-plane integrity passed');
