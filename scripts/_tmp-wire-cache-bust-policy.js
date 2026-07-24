#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const checkerPath = path.join(root, 'scripts/check-workflows.js');
let source = fs.readFileSync(checkerPath, 'utf8');

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first === -1) throw new Error(`Missing checker anchor: ${label}`);
  if (source.indexOf(needle, first + needle.length) !== -1) {
    throw new Error(`Non-unique checker anchor: ${label}`);
  }
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

replaceOnce(
  "const path = require('path');\n",
  "const path = require('path');\nconst {\n  validateCacheBustWorkflowPolicy,\n  runCacheBustWorkflowPolicyMutationSuite,\n} = require('./lib/cache-bust-workflow-policy');\n",
  'policy import'
);

replaceOnce(
  "const sharedFiles = read('.github/workflows/shared-files-guard.yml');\nmust('.github/workflows/shared-files-guard.yml', sharedFiles, /^name:\\s*.+/m, 'shared-files-guard must have a name');\nmust('.github/workflows/shared-files-guard.yml', sharedFiles, /guard-shared-files\\.js/, 'shared-files-guard must run guard-shared-files.js');\n",
  "const sharedFiles = read('.github/workflows/shared-files-guard.yml');\nmust('.github/workflows/shared-files-guard.yml', sharedFiles, /^name:\\s*.+/m, 'shared-files-guard must have a name');\nmust('.github/workflows/shared-files-guard.yml', sharedFiles, /guard-shared-files\\.js/, 'shared-files-guard must run guard-shared-files.js');\n\nconst workflowDir = path.join(ROOT, '.github/workflows');\nconst workflowTexts = Object.fromEntries(\n  fs.readdirSync(workflowDir)\n    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))\n    .map((name) => {\n      const rel = `.github/workflows/${name}`;\n      return [rel, fs.readFileSync(path.join(workflowDir, name), 'utf8')];\n    })\n);\nconst cacheBustPolicyInput = {\n  sharedFiles,\n  readiness: indexnow,\n  deploy,\n  cacheBust: read('scripts/cache-bust.js'),\n  workflowTexts,\n};\nfor (const issue of validateCacheBustWorkflowPolicy(cacheBustPolicyInput)) {\n  issues.push(`cache-bust fail-closed policy: ${issue}`);\n}\nfor (const issue of runCacheBustWorkflowPolicyMutationSuite(cacheBustPolicyInput)) {\n  issues.push(`cache-bust policy mutation: ${issue}`);\n}\n",
  'policy invocation'
);

fs.writeFileSync(checkerPath, source, 'utf8');
fs.unlinkSync(__filename);
console.log('Wired cache-bust fail-closed policy and adversarial mutations into workflows:check.');
