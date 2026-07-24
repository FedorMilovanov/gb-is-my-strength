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

const readingTimeAudit = fs.readFileSync(path.join(ROOT, 'scripts/gill-reading-time-canonical-audit.js'), 'utf8');
assert(readingTimeAudit.includes("require('./lib/legacy-source-authority')"), 'reading-time audit must use shared source authority');
assert(readingTimeAudit.includes('authoritativeLegacyRel'), 'reading-time stale-literal scan must be authority-aware');
assert(/if \(!legacyIsAuthoritative\(profile\)\)[\s\S]*?enforced through native\/data sources/.test(readingTimeAudit), 'reference-only mirrors must not be blocking reading-time oracles');
assert(!/\.\.\.GILL_ORDER\.map\(\(slug\) => `articles\/\$\{slug\}\/index\.html`\)/.test(readingTimeAudit), 'reading-time scan must not blindly include every legacy mirror');

const pagefindAudit = fs.readFileSync(path.join(ROOT, 'scripts/gill-pagefind-body-audit.js'), 'utf8');
assert(pagefindAudit.includes('Array.isArray(requirement)'), 'Pagefind audit must support semantic marker alternatives');
assert(pagefindAudit.includes("['Кларендонским кодексом','Кларендонского кодекса','Кларендонский кодекс']"), 'Clarendon marker alternatives missing');
assert(pagefindAudit.includes("['Goat Yard','Goat’s Yard',\"Goat's Yard\",'Goat&rsquo;s Yard']"), 'Goat Yard marker alternatives missing');
assert(pagefindAudit.includes("['Corporation Act','Акт о корпорациях','Корпоративный акт']"), 'Corporation marker alternatives missing');
assert(!pagefindAudit.includes("['Кларендонский кодекс','Солтерс-Холл'"), 'stale exact Pagefind marker list must not return');

console.log('✅ Gill source authority, reading-time and semantic Pagefind contracts passed');
