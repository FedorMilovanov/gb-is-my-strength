#!/usr/bin/env node
'use strict';
// GATE-GAP-NATIVE-TEXT-PARITY (2026-07-05) — authoritative word-coverage guard.
//
// Regression class: CONTENT-PARITY-LOSS-01. Only routes whose legacy HTML is
// explicitly canonical/runtime-required (or still unprofiled under the legacy
// conservative fallback) are compared with built dist.
//
// Strict-native routes must declare their retained legacy surface as
// reference-only/absent and are protected by their native source/dist contracts.
// This audit intentionally does not promote reference-only legacy HTML back into
// a blocking oracle.
//
// Thresholds: warn > WARN_PCT, fail > FAIL_PCT of authoritative legacy word
// OCCURRENCES missing from dist. Comparison is a true frequency deficit, not a
// set-membership proxy.
//
// Selected high-value strict-native articles are additionally protected by one
// positive semantic manifest that is checked against both canonical source and
// the built dist projection.
//
// Usage: node scripts/content-coverage-audit.js   (requires built dist/)
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  classifyLegacyAuthority,
  loadRouteProfile,
} = require('./lib/legacy-source-authority');
const {
  runAcceptedSemanticManifestAudit,
} = require('./lib/accepted-semantic-manifest');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.DIST_ROOT || path.join(ROOT, 'dist');
const WARN_PCT = 2;
const FAIL_PCT = 10;

function words(txt) {
  const m = new Map();
  for (const w of String(txt || '').matchAll(/[А-Яа-яЁё]{3,}/g)) {
    const k = w[0].toLowerCase();
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function pageText(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function frequencyDeficit(legacyWords, distWords, sampleLimit = 10) {
  let total = 0;
  let missing = 0;
  const missingWords = [];

  for (const [word, legacyCount] of legacyWords) {
    total += legacyCount;
    const distCount = distWords.get(word) || 0;
    const deficit = Math.max(legacyCount - distCount, 0);
    if (!deficit) continue;
    missing += deficit;
    if (missingWords.length < sampleLimit) missingWords.push(`${word}(-${deficit})`);
  }

  return { total, missing, missingWords };
}

function coverageHealth({ expected, exercised, undeclared }) {
  const issues = [];
  if (!Number.isInteger(expected) || expected < 0) issues.push('expected must be a non-negative integer');
  if (!Number.isInteger(exercised) || exercised < 0) issues.push('exercised must be a non-negative integer');
  if (!Number.isInteger(undeclared) || undeclared < 0) issues.push('undeclared must be a non-negative integer');
  if (Number.isInteger(expected) && Number.isInteger(exercised) && exercised > expected) {
    issues.push(`exercised ${exercised} exceeds expected ${expected}`);
  }
  if (Number.isInteger(expected) && Number.isInteger(exercised) && expected > 0 && exercised === 0) {
    issues.push(`expected ${expected} authoritative comparison(s) but exercised 0`);
  }
  if (Number.isInteger(undeclared) && undeclared > 0) {
    issues.push(`${undeclared} production Astro route(s) have undeclared legacy authority`);
  }
  return issues;
}

function runContractChecks() {
  let checks = 0;
  const check = (name, fn) => {
    fn();
    checks++;
    console.log(`CONTRACT OK ${name}`);
  };

  check('frequency deficit counts repeated occurrence loss', () => {
    const result = frequencyDeficit(new Map([['слово', 3]]), new Map([['слово', 1]]));
    assert.equal(result.total, 3);
    assert.equal(result.missing, 2);
  });
  check('extra dist occurrences do not create negative loss', () => {
    assert.equal(frequencyDeficit(new Map([['слово', 1]]), new Map([['слово', 4]])).missing, 0);
  });
  check('health rejects expected-but-zero exercise', () => {
    assert.equal(coverageHealth({ expected: 1, exercised: 0, undeclared: 0 }).length, 1);
  });
  check('health accepts an intentional empty authoritative set', () => {
    assert.deepEqual(coverageHealth({ expected: 0, exercised: 0, undeclared: 0 }), []);
  });
  check('health rejects undeclared production authority', () => {
    assert.equal(coverageHealth({ expected: 0, exercised: 0, undeclared: 1 }).length, 1);
  });
  check('authority distinguishes reference-only from undeclared', () => {
    assert.equal(classifyLegacyAuthority({ legacyStatus: 'reference-only' }).kind, 'non-authoritative');
    assert.equal(classifyLegacyAuthority({}).kind, 'undeclared');
  });

  console.log(`Content coverage internal contract: ${checks}/${checks} checks passed`);
}

function loadOwnership() {
  const p = path.join(ROOT, 'migration', 'page-ownership.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return j.routes || j.pages || j;
}

function main() {
  runContractChecks();

  let failures = 0;
  let checks = 0;
  let warns = 0;
  let passed = 0;
  const ok = (m) => { checks++; passed++; console.log('OK ' + m); };
  const bad = (m) => { checks++; failures++; console.log('FAIL ' + m); };
  const warn = (m) => { checks++; warns++; console.log('WARN ' + m); };

  if (!fs.existsSync(DIST)) {
    console.error('dist not found at ' + DIST + ' — run a strangler build first');
    process.exit(1);
  }

  const ownership = loadOwnership();
  let expected = 0;
  let exercised = 0;
  let skippedExplicit = 0;
  let undeclared = 0;

  for (const [route, meta] of Object.entries(ownership)) {
    if (!meta || meta.owner !== 'astro') continue;

    const { profile } = loadRouteProfile(route);
    const authority = classifyLegacyAuthority(profile);

    if (authority.kind === 'invalid') {
      bad(`${route}: invalid legacyStatus=${authority.status}`);
      continue;
    }

    if (authority.kind === 'undeclared') {
      undeclared++;
      const source = profile?.renderSource || profile?.source || meta.source || 'declared Astro source';
      bad(`${route}: legacyStatus is not declared; production source=${source}`);
      continue;
    }

    if (authority.kind !== 'authoritative') {
      skippedExplicit++;
      const source = profile?.renderSource || profile?.source || meta.source || 'declared Astro source';
      console.log(`SKIP ${route}: legacyStatus=${authority.status}; production truth is ${source}`);
      continue;
    }

    expected++;
    const rel = route.replace(/^\//, '') + 'index.html';
    const legacyPath = path.join(ROOT, rel === 'index.html' ? 'index.html' : rel);
    const distPath = path.join(DIST, rel === 'index.html' ? 'index.html' : rel);

    if (!fs.existsSync(legacyPath)) {
      bad(`${route}: authoritative legacy surface missing at ${path.relative(ROOT, legacyPath)}`);
      continue;
    }
    if (!fs.existsSync(distPath)) {
      bad(`${route}: astro-owned authoritative route missing in dist`);
      continue;
    }

    const lw = words(pageText(fs.readFileSync(legacyPath, 'utf8')));
    const dw = words(pageText(fs.readFileSync(distPath, 'utf8')));
    const { total, missing, missingWords } = frequencyDeficit(lw, dw);

    if (!total) {
      bad(`${route}: authoritative legacy surface has zero auditable Russian word occurrences`);
      continue;
    }

    exercised++;
    const pct = (missing / total) * 100;
    if (pct > FAIL_PCT) {
      bad(`${route}: ${pct.toFixed(1)}% authoritative legacy word occurrences missing from dist (${missing}/${total}); sample: ${missingWords.join(', ')}`);
    } else if (pct > WARN_PCT) {
      warn(`${route}: ${pct.toFixed(1)}% authoritative legacy word occurrences missing from dist (${missing}/${total}); sample: ${missingWords.join(', ')} — review; fail threshold ${FAIL_PCT}%`);
    } else {
      ok(`${route}: content occurrence coverage ${(100 - pct).toFixed(1)}% (${missing}/${total} missing)`);
    }
  }

  for (const issue of coverageHealth({ expected, exercised, undeclared })) {
    if (!issue.includes('undeclared legacy authority')) bad(`health: ${issue}`);
  }

  try {
    const semantic = runAcceptedSemanticManifestAudit({ requireDist: true });
    ok(`accepted semantic source→dist manifests: ${semantic.results.length} routes, ${semantic.mutationCasesKilled} deletion mutations killed`);
  } catch (error) {
    bad(`accepted semantic source→dist manifests: ${error.message}`);
  }

  const health = {
    expected,
    exercised,
    skippedExplicit,
    undeclared,
    warnings: warns,
    failures,
    passed,
    checks,
  };

  console.log(`\nContent coverage audit: expected=${expected}, exercised=${exercised}, explicit-skips=${skippedExplicit}, undeclared=${undeclared}, warnings=${warns}, passed=${passed}/${checks}`);
  console.log(`CONTENT_COVERAGE_HEALTH ${JSON.stringify(health)}`);

  if (failures) {
    console.log('\nFAIL content coverage audit failed');
    process.exit(1);
  }
  if (warns) {
    console.log('\nPASS-WITH-WARNINGS content coverage audit completed; warnings require review');
    return;
  }
  console.log('\nOK content coverage audit passed');
}

if (require.main === module) main();

module.exports = {
  coverageHealth,
  frequencyDeficit,
  pageText,
  runContractChecks,
  words,
};
