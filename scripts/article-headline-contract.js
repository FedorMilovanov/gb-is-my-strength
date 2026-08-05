#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';
const AUDIT_REL = 'scripts/legacy-reference-inventory-audit.mjs';
const OBSOLETE_REL = 'scripts/legacy-generators/update-meta-git-history-v2.js';

const manifestPath = path.join(ROOT, MANIFEST_REL);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const obsolete = manifest.dependencies.filter((item) => item.path === OBSOLETE_REL);
assert.equal(obsolete.length, 1, 'exactly one obsolete writer registration must exist');
assert.equal(obsolete[0].access, 'writer');
assert.equal(obsolete[0].classification, 'obsolete');

manifest.policy.obsoleteWritersAllowed = false;
manifest.dependencies = manifest.dependencies.filter((item) => item.path !== OBSOLETE_REL);
manifest.summary.dependencies = manifest.dependencies.length;
manifest.summary.dependencyUnknownBlockers = manifest.dependencies.filter((item) => item.classification === 'unknown-blocker').length;
manifest.summary.obsoleteWriters = manifest.dependencies.filter((item) => item.classification === 'obsolete' && item.access === 'writer').length;
assert.equal(manifest.summary.dependencies, 32);
assert.equal(manifest.summary.dependencyUnknownBlockers, 13);
assert.equal(manifest.summary.obsoleteWriters, 0);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const auditPath = path.join(ROOT, AUDIT_REL);
let audit = fs.readFileSync(auditPath, 'utf8');
const policyNeedle = "  if (ledger.policy?.moveAllowedWhenUnknownBlockers !== false) problem('moves must remain blocked while unknown blockers exist');\n";
assert.ok(audit.includes(policyNeedle), 'obsolete-writer policy insertion point must exist');
audit = audit.replace(
  policyNeedle,
  `${policyNeedle}  if (ledger.policy?.obsoleteWritersAllowed !== false) problem('obsolete writers must remain forbidden');\n`,
);

const summaryNeedle = '  const expectedSummary = {\n';
assert.ok(audit.includes(summaryNeedle), 'obsolete-writer validation insertion point must exist');
audit = audit.replace(
  summaryNeedle,
  "  const obsoleteWriters = dependencies.filter((item) => item.classification === 'obsolete' && item.access === 'writer');\n"
    + "  if (obsoleteWriters.length > 0) problem(`obsolete writers must be removed: ${obsoleteWriters.map((item) => item.path).join(', ')}`);\n\n"
    + summaryNeedle,
);

const mutationNeedle = `  ['writer laundering', (copy) => {\n    const target = copy.dependencies.find((item) => item.access === 'writer');\n    target.classification = 'migration-reference-only';\n  }],\n`;
assert.ok(audit.includes(mutationNeedle), 'writer mutation replacement point must exist');
audit = audit.replace(
  mutationNeedle,
  `  ['obsolete writer reintroduction', (copy) => {\n`
    + `    copy.dependencies.push({\n`
    + `      path: 'scripts/legacy-generators/update-meta-git-history-v2.js',\n`
    + `      access: 'writer',\n`
    + `      classification: 'obsolete',\n`
    + `      quarantineImpact: 'remove-or-repoint-before-move',\n`
    + `      evidenceToken: 'articles/\\${slug}/index.html',\n`
    + `      owner: 'legacy-reference-quarantine',\n`
    + `    });\n`
    + `    copy.dependencies.sort((a, b) => a.path.localeCompare(b.path));\n`
    + `    copy.summary.dependencies++;\n`
    + `    copy.summary.obsoleteWriters++;\n`
    + `  }],\n`,
);
fs.writeFileSync(auditPath, audit);

const obsoletePath = path.join(ROOT, OBSOLETE_REL);
assert.ok(fs.existsSync(obsoletePath), 'obsolete writer file must exist before removal');
fs.rmSync(obsoletePath);

// Remove this disposable materializer from dependency discovery before permanent validation.
execFileSync('git', ['checkout', 'origin/main', '--', 'scripts/article-headline-contract.js'], { cwd: ROOT, stdio: 'inherit' });

execFileSync(process.execPath, [AUDIT_REL], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'workflows:check'], { cwd: ROOT, stdio: 'inherit' });
execFileSync('npm', ['run', 'control-plane:audit'], { cwd: ROOT, stdio: 'inherit' });

const expected = new Set([MANIFEST_REL, AUDIT_REL, OBSOLETE_REL]);
const changed = execFileSync('git', ['diff', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
assert.deepEqual(new Set(changed), expected, `unexpected changed paths: ${changed.join(', ')}`);
const status = execFileSync('git', ['diff', '--name-status'], { cwd: ROOT, encoding: 'utf8' });
assert.match(status, new RegExp(`D\\t${OBSOLETE_REL.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
console.log('Obsolete legacy metadata writer removed; zero-writer policy and permanent contracts passed.');
