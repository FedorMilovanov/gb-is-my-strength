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

  const authorityBranch = audit.match(/if\s*\(\s*legacyIsAuthoritative\(profile\)\s*\)\s*\{([\s\S]*?)\}\s*else\s+if\s*\(\s*profile\.legacyStatus\s*===\s*'reference-only'/);
  assert(authorityBranch, `${item.audit}: authoritative and reference-only branches must remain explicit`);
  assert(/Math\.abs\s*\(/.test(authorityBranch[1]), `${item.audit}: authoritative branch must calculate word-count drift`);
  assert(/<=\s*200/.test(authorityBranch[1]), `${item.audit}: authoritative drift tolerance must remain 200 words`);

  const referenceBranch = audit.match(/profile\.legacyStatus\s*===\s*'reference-only'\s*\)\s*\{([\s\S]*?)\}\s*else/);
  assert(referenceBranch, `${item.audit}: reference-only lower-bound branch missing`);
  assert(/(?:rw|nativeWords)\s*>=\s*(?:lw|legacyWords)/.test(referenceBranch[1]), `${item.audit}: reference-only legacy must remain a lower-bound safeguard`);

  const toleranceOutsideAuthority = audit.replace(authorityBranch[0], "if (legacyIsAuthoritative(profile)) { /* authority branch verified */ } else if (profile.legacyStatus === 'reference-only'");
  assert(!/Math\.abs\s*\([^)]*\)[\s\S]{0,160}<=\s*200/.test(toleranceOutsideAuthority), `${item.audit}: unconditional legacy drift oracle must not return`);
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

const dataConsistency = fs.readFileSync(path.join(ROOT, 'scripts/check-data-consistency.js'), 'utf8');
assert(dataConsistency.includes("require('./lib/legacy-source-authority')"), 'data consistency must use shared source authority');
assert(dataConsistency.includes('function canonicalForRoute'), 'data consistency must have a route-aware canonical helper');
assert(dataConsistency.includes('const authoritativeLegacy = legacyIsAuthoritative(profile)'), 'manifest/HTML comparison must branch on legacy authority');
assert(dataConsistency.includes('const projectionFallback = !legacyIsAuthoritative(profile)'), 'series comparison must prefer canonical projections for strict-native routes');
assert(!/const canonical = canonicalFromHtml\(file, item\.readTime\);\s*assertEqual/.test(dataConsistency), 'unconditional manifest-vs-root HTML oracle must not return');
assert(!/const canonical = canonicalFromHtml\(file, search && search\.readTime\)/.test(dataConsistency), 'unconditional series-vs-root HTML oracle must not return');

console.log('✅ Gill source authority, reading-time, Pagefind and data-consistency contracts passed');
