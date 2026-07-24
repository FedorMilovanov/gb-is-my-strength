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
const GILL_ROUTE = '/articles/dzhon-gill-istoricheskiy-kontekst/';

assert.strictEqual(legacyIsAuthoritative(null), true, 'unprofiled historical routes remain conservative');
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'canonical' }), true);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'runtime-required' }), true);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'reference-only' }), false);
assert.strictEqual(legacyIsAuthoritative({ legacyStatus: 'absent' }), false);

const { file, profile } = loadRouteProfile(GILL_ROUTE);
assert(file, 'Gill context route profile must exist');
assert(profile, 'Gill context route profile must parse');
assert.strictEqual(profile.route, GILL_ROUTE);
assert.strictEqual(profile.migrationMode, 'strict-native');
assert.strictEqual(profile.legacyStatus, 'reference-only');
assert.strictEqual(legacyIsAuthoritative(profile), false);

const coverage = fs.readFileSync(path.join(ROOT, 'scripts/content-coverage-audit.js'), 'utf8');
const gillAudit = fs.readFileSync(path.join(ROOT, 'scripts/gill-context-visual-parity-audit.js'), 'utf8');

assert(coverage.includes("require('./lib/legacy-source-authority')"), 'content coverage must use shared source authority');
assert(!/function\s+legacyIsAuthoritative\s*\(/.test(coverage), 'content coverage must not fork the authority helper');
assert(gillAudit.includes("require('./lib/legacy-source-authority')"), 'Gill audit must use shared source authority');
assert(/if \(legacyIsAuthoritative\(profile\)\)[\s\S]*?drift <= 200/.test(gillAudit), 'legacy drift tolerance must be scoped to authoritative legacy');
assert(/profile\.legacyStatus === 'reference-only'[\s\S]*?rw >= lw/.test(gillAudit), 'reference-only legacy must be a lower-bound safeguard, not an exact oracle');
assert(!/var drift = Math\.abs\(lw - rw\);\s*drift <= 200 \?/.test(gillAudit), 'unconditional legacy word-count oracle must not return');

console.log('✅ Legacy source authority contract passed');
