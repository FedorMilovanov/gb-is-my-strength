#!/usr/bin/env python3
from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts/source-link-audit.js"
WORKFLOW = ROOT / ".github/workflows/source-links.yml"
CONTRACT = ROOT / "scripts/source-link-audit-source-contract-test.cjs"
SELF = Path(__file__).resolve()
TEMP_WORKFLOW = ROOT / ".github/workflows/_temp-harden-source-link-evidence.yml"

EXPECTED_SOURCE_BLOB = "d0b0be2d65aad88d17c78235bf01cbef82524d04"
EXPECTED_WORKFLOW_BLOB = "ac61d0f4926fc4589a4984968f16fe1f8d2eca7f"

CHECKOUT_PIN = "actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4"
SETUP_NODE_PIN = "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4"
UPLOAD_PIN = "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4"


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{label}: expected {expected} matches, found {count}")
    return text.replace(old, new)


if run("git", "hash-object", str(SOURCE.relative_to(ROOT))) != EXPECTED_SOURCE_BLOB:
    raise SystemExit("source-link-audit.js drifted; refusing to patch")
if run("git", "hash-object", str(WORKFLOW.relative_to(ROOT))) != EXPECTED_WORKFLOW_BLOB:
    raise SystemExit("source-links.yml drifted; refusing to patch")
if CONTRACT.exists():
    raise SystemExit("source-link audit source contract already exists")

source = SOURCE.read_text(encoding="utf-8")
source = replace_exact(
    source,
    "const dns = require('node:dns').promises;\n",
    "const crypto = require('node:crypto');\nconst dns = require('node:dns').promises;\n",
    1,
    "crypto import",
)
source = replace_exact(
    source,
    """function sanitizeUrlForEvidence(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.hash = '';
    if (url.search) url.search = '?redacted=1';
    return url.href;
  } catch {
    return String(value || '').slice(0, 300);
  }
}
""",
    """function sanitizeUrlForEvidence(value) {
  const raw = String(value ?? '');
  try {
    const url = new URL(raw);
    url.username = '';
    url.password = '';
    url.hash = '';
    if (url.search) url.search = '?redacted=1';
    return url.href;
  } catch {
    const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);
    return `invalid-url:sha256:${digest}:bytes:${Buffer.byteLength(raw, 'utf8')}`;
  }
}
""",
    1,
    "malformed URL redaction",
)
SOURCE.write_text(source, encoding="utf-8")

workflow = WORKFLOW.read_text(encoding="utf-8")
workflow = replace_exact(
    workflow,
    "      - 'scripts/source-link-audit-contract-test.cjs'\n",
    "      - 'scripts/source-link-audit-contract-test.cjs'\n      - 'scripts/source-link-audit-source-contract-test.cjs'\n",
    1,
    "PR path ownership",
)
workflow = replace_exact(workflow, "actions/checkout@v4", CHECKOUT_PIN, 2, "checkout pins")
workflow = replace_exact(workflow, "actions/setup-node@v4", SETUP_NODE_PIN, 2, "setup-node pins")
workflow = replace_exact(workflow, "actions/upload-artifact@v4", UPLOAD_PIN, 1, "upload-artifact pin")
workflow = replace_exact(
    workflow,
    """          node --check scripts/source-link-audit.js
          node --check scripts/source-link-audit-contract-test.cjs
      - name: Prove redirect-chain and destination policy
        run: node scripts/source-link-audit-contract-test.cjs
""",
    """          node --check scripts/source-link-audit.js
          node --check scripts/source-link-audit-contract-test.cjs
          node --check scripts/source-link-audit-source-contract-test.cjs
      - name: Prove redirect-chain, evidence redaction and workflow policy
        run: |
          node scripts/source-link-audit-contract-test.cjs
          node scripts/source-link-audit-source-contract-test.cjs
""",
    1,
    "contract execution",
)
WORKFLOW.write_text(workflow, encoding="utf-8")

CONTRACT.write_text(r'''#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitizeUrlForEvidence } = require('./source-link-audit.js');

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const PINS = Object.freeze({
  checkout: 'actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4',
  setupNode: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4',
  uploadArtifact: 'actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4',
});

function countLiteral(source, literal) {
  return source.split(literal).length - 1;
}

function validate({ source, workflow }) {
  const problems = [];
  const must = (label, text, pattern) => {
    if (!pattern.test(text)) problems.push(label);
  };
  const mustNot = (label, text, pattern) => {
    if (pattern.test(text)) problems.push(label);
  };

  must('crypto-backed malformed URL fingerprint exists', source, /crypto\.createHash\('sha256'\)[\s\S]{0,180}invalid-url:sha256:/);
  must('malformed URL evidence records byte count only', source, /invalid-url:sha256:\$\{digest\}:bytes:\$\{Buffer\.byteLength\(raw, 'utf8'\)\}/);
  mustNot('raw malformed URL slice remains', source, /String\(value \|\| ''\)\.slice\(0, 300\)/);
  mustNot('malformed URL fallback returns raw input', source, /catch\s*\{\s*return\s+(?:raw|String\(value)/);

  must('workflow owns source contract path', workflow, /- 'scripts\/source-link-audit-source-contract-test\.cjs'/);
  must('workflow syntax-checks source contract', workflow, /node --check scripts\/source-link-audit-source-contract-test\.cjs/);
  must('workflow executes source contract', workflow, /node scripts\/source-link-audit-source-contract-test\.cjs/);
  must('workflow retains manual entry', workflow, /workflow_dispatch:/);
  must('workflow retains scheduled network evidence', workflow, /schedule:[\s\S]{0,100}cron:/);
  must('workflow uploads evidence even on failure', workflow, /Upload source-link chain evidence[\s\S]{0,120}if: always\(\)/);
  must('workflow fails if evidence is missing', workflow, /if-no-files-found: error/);

  if (countLiteral(workflow, PINS.checkout) !== 2) problems.push('checkout full-SHA pin count drift');
  if (countLiteral(workflow, PINS.setupNode) !== 2) problems.push('setup-node full-SHA pin count drift');
  if (countLiteral(workflow, PINS.uploadArtifact) !== 1) problems.push('upload-artifact full-SHA pin count drift');
  mustNot('mutable privileged/source-evidence action tag remains', workflow, /uses:\s*actions\/(?:checkout|setup-node|upload-artifact)@v\d+/i);

  return problems;
}

const source = read('scripts/source-link-audit.js');
const workflow = read('.github/workflows/source-links.yml');
assert.deepEqual(validate({ source, workflow }), []);

const secret = 'https://reader:super-secret@[invalid?token=top-secret&session=abc#fragment';
const sanitized = sanitizeUrlForEvidence(secret);
assert.match(sanitized, /^invalid-url:sha256:[a-f0-9]{32}:bytes:\d+$/);
for (const forbidden of ['reader', 'super-secret', 'token', 'top-secret', 'session', 'fragment', '[invalid']) {
  assert.equal(sanitized.includes(forbidden), false, `malformed evidence leaked ${forbidden}`);
}
assert.equal(sanitizeUrlForEvidence(secret), sanitized, 'malformed fingerprint must be deterministic');
assert.notEqual(sanitizeUrlForEvidence(`${secret}x`), sanitized, 'different malformed values need different fingerprints');
assert.equal(
  sanitizeUrlForEvidence('https://user:secret@example.com/path?token=value#fragment'),
  'https://example.com/path?redacted=1',
);

const mutations = [
  ['raw malformed fallback', { source: source.replace(
    "const digest = crypto.createHash('sha256').update(raw, 'utf8').digest('hex').slice(0, 32);\n    return `invalid-url:sha256:${digest}:bytes:${Buffer.byteLength(raw, 'utf8')}`;",
    "return String(value || '').slice(0, 300);",
  ), workflow }],
  ['mutable checkout tag', { source, workflow: workflow.replaceAll(PINS.checkout, 'actions/checkout@v4') }],
  ['mutable setup-node tag', { source, workflow: workflow.replaceAll(PINS.setupNode, 'actions/setup-node@v4') }],
  ['mutable upload-artifact tag', { source, workflow: workflow.replace(PINS.uploadArtifact, 'actions/upload-artifact@v4') }],
  ['source contract execution removed', { source, workflow: workflow.replace('          node scripts/source-link-audit-source-contract-test.cjs\n', '') }],
  ['source contract path trigger removed', { source, workflow: workflow.replace("      - 'scripts/source-link-audit-source-contract-test.cjs'\n", '') }],
  ['evidence upload made optional', { source, workflow: workflow.replace('if-no-files-found: error', 'if-no-files-found: warn') }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Source-link evidence source contract: PASS (${mutations.length} adversarial mutations rejected).`);
''', encoding="utf-8")

# Temporary infrastructure must not survive the product commit.
SELF.unlink()
TEMP_WORKFLOW.unlink()

subprocess.check_call(["node", "--check", "scripts/source-link-audit.js"], cwd=ROOT)
subprocess.check_call(["node", "--check", "scripts/source-link-audit-contract-test.cjs"], cwd=ROOT)
subprocess.check_call(["node", "--check", "scripts/source-link-audit-source-contract-test.cjs"], cwd=ROOT)
subprocess.check_call(["node", "scripts/source-link-audit-contract-test.cjs"], cwd=ROOT)
subprocess.check_call(["node", "scripts/source-link-audit-source-contract-test.cjs"], cwd=ROOT)
subprocess.check_call([
    "node", "scripts/run-actionlint.mjs", "-no-color", ".github/workflows/source-links.yml"
], cwd=ROOT)

subprocess.check_call([
    "git", "add",
    "scripts/source-link-audit.js",
    "scripts/source-link-audit-source-contract-test.cjs",
    ".github/workflows/source-links.yml",
    str(SELF.relative_to(ROOT)),
    str(TEMP_WORKFLOW.relative_to(ROOT)),
], cwd=ROOT)
subprocess.check_call([
    "git", "commit", "-m", "fix(links): redact malformed evidence and pin audit actions"
], cwd=ROOT)
subprocess.check_call(["git", "push", "origin", "HEAD"], cwd=ROOT)
print("source-link evidence hardening materialized")
