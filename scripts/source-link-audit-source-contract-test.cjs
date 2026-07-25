#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createPinnedLookup, isSystemicTransportFailure, sanitizeUrlForEvidence } = require('./source-link-audit.js');

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
  must('pinned lookup supports Node all-address mode', source, /function createPinnedLookup[\s\S]{0,500}options && options\.all[\s\S]{0,180}callback\(null, \[\{ address, family \}\]\)/);
  must('native request uses validated pinned lookup', source, /lookup: createPinnedLookup\(address\)/);
  must('report records systemic transport failure', source, /systemicTransportFailure: isSystemicTransportFailure\(results\)/);
  must('systemic transport failure exits nonzero', source, /if \(report\.systemicTransportFailure\)[\s\S]{0,220}process\.exitCode = 1/);
  must('native response probe caps stored bytes', source, /const remaining = maxProbeBytes - storedBytes;[\s\S]{0,300}finish\(null, snapshot\(true\)\);[\s\S]{0,80}response\.destroy\(\)/);
  mustNot('large response is treated as transport failure', source, /RESPONSE_TOO_LARGE/);
  must('bot and auth response statuses remain warnings', source, /\[401, 403, 405, 418, 429\]\.includes\(status\)/);

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

const pinnedLookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });
pinnedLookup('example.com', { all: true }, (error, addresses) => {
  assert.ifError(error);
  assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
});
assert.throws(() => createPinnedLookup({ address: '93.184.216.34', family: 6 }), /pinned DNS address record is invalid/);
assert.equal(isSystemicTransportFailure([{ result: 'warn', reason: 'ERR_INVALID_IP_ADDRESS', hops: [] }]), true);
assert.equal(isSystemicTransportFailure([{ result: 'pass', status: 200, final: 'https://example.com/', hops: [] }]), false);

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
  ['all-address lookup support removed', { source: source.replace(
    "if (options && options.all) {\n      callback(null, [{ address, family }]);\n      return;\n    }",
    "if (false) {\n      callback(null, [{ address, family }]);\n      return;\n    }",
  ), workflow }],
  ['request bypasses pinned lookup helper', { source: source.replace('lookup: createPinnedLookup(address)', 'lookup: (_hostname, _options, callback) => callback(null, address.address, address.family)'), workflow }],
  ['systemic failure report field removed', { source: source.replace('    systemicTransportFailure: isSystemicTransportFailure(results),\n', ''), workflow }],
  ['systemic failure nonzero guard removed', { source: source.replace(/  if \(report\.systemicTransportFailure\) \{[\s\S]*?\n  \}\n  console\.log\('✅ Source links hard-check passed'\);/, "  console.log('✅ Source links hard-check passed');"), workflow }],
  ['bounded prefix storage removed', { source: source.replace('const remaining = maxProbeBytes - storedBytes;', 'const remaining = chunk.length;'), workflow }],
  ['large response transport error reintroduced', { source: source.replace('          finish(null, snapshot(true));\n          response.destroy();', "          request.destroy(Object.assign(new Error('probe too large'), { code: 'RESPONSE_TOO_LARGE' }));"), workflow }],
  ['HTTP 418 bot block made hard', { source: source.replace('[401, 403, 405, 418, 429]', '[401, 403, 405, 429]'), workflow }],
];

for (const [name, mutated] of mutations) {
  assert.ok(validate(mutated).length > 0, `${name}: mutation must be rejected`);
}

console.log(`Source-link evidence source contract: PASS (${mutations.length} adversarial mutations rejected).`);
