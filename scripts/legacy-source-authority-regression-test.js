#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  legacyIsAuthoritative,
  loadRouteProfile,
} = require('./lib/legacy-source-authority');

const ROOT = path.resolve(__dirname, '..');
const GILL_ROUTES = [
  {
    route: '/articles/dzhon-gill-istoricheskiy-kontekst/',
    audit: 'scripts/gill-context-visual-parity-audit.js',
  },
  {
    route: '/articles/dzhon-gill-spravochnik/',
    audit: 'scripts/gill-spravochnik-visual-parity-audit.js',
  },
];

assert.strictEqual(legacyIsAuthoritative(null), true, 'unprofiled historical routes remain conservative');
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'canonical' }), true);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'runtime-required' }), true);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'reference-only' }), false);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'absent' }), false);

const coverage = fs.readFileSync(path.join(ROOT, 'scripts/content-coverage-audit.js'), 'utf8');
assert(coverage.includes("require('./lib/legacy-source-authority')"), 'content coverage must use shared source authority');
assert(!/function\s+legacyIsAuthoritative\s*\(/.test(coverage), 'content coverage must not fork the authority helper');

for (const item of GILL_ROUTES) {
  const { file, profile } = loadRouteProfile(item.route);
  assert(file, `${item.route}: route profile must exist`);
  assert(profile, `${item.route}: route profile must parse`);
  assert.strictEqual(profile.route, item.route);
  assert.strictEqual(profile.migrationMode, 'strict-native');
  assert.strictEqual(profile.legacyStatus, 'reference-only');
  assert.strictEqual(legacyIsAuthoritative(profile), false);

  const audit = fs.readFileSync(path.join(ROOT, item.audit), 'utf8');
  assert(audit.includes("require('./lib/legacy-source-authority')"), `${item.audit}: must use shared source authority`);
  assert(/if \(legacyIsAuthoritative\(profile\)\)[\s\S]*?drift <= 200/.test(audit), `${item.audit}: legacy drift tolerance must be scoped to authoritative legacy`);
  assert(/profile\.legacyStatus === 'reference-only'[\s\S]*?rw >= lw/.test(audit), `${item.audit}: reference-only legacy must be a lower-bound safeguard`);
  assert(!/var drift = Math\.abs\(lw - rw\);\s*drift <= 200 \?/.test(audit), `${item.audit}: unconditional legacy oracle must not return`);
}

console.log('✅ Legacy source authority contract passed for both strict-native Gill audits');
