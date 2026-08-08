'use strict';

const assert = require('assert');
const fs = require('fs');
const { findProfileFile } = require('./route-source-contract');
const {
  normalizeRepositoryPath,
  resolveReferenceForRoute,
} = require('../../migration/legacy-reference-path');

const AUTHORITATIVE_LEGACY_STATUSES = new Set(['canonical', 'runtime-required']);
const NON_AUTHORITATIVE_LEGACY_STATUSES = new Set(['reference-only', 'absent']);
const VALID_LEGACY_STATUSES = new Set([
  ...AUTHORITATIVE_LEGACY_STATUSES,
  ...NON_AUTHORITATIVE_LEGACY_STATUSES,
]);

function loadRouteProfile(route) {
  const file = findProfileFile(route);
  if (!file) return { file: null, profile: null };
  return {
    file,
    profile: JSON.parse(fs.readFileSync(file, 'utf8')),
  };
}

function classifyLegacyAuthority(profile) {
  // Unprofiled historical routes retain the conservative legacy oracle until
  // they receive an explicit source contract.
  if (!profile) {
    return {
      kind: 'authoritative',
      status: 'unprofiled-conservative',
      explicit: false,
    };
  }

  const status = typeof profile.legacyStatus === 'string'
    ? profile.legacyStatus.trim()
    : '';

  if (AUTHORITATIVE_LEGACY_STATUSES.has(status)) {
    return { kind: 'authoritative', status, explicit: true };
  }
  if (NON_AUTHORITATIVE_LEGACY_STATUSES.has(status)) {
    return { kind: 'non-authoritative', status, explicit: true };
  }
  if (!status) {
    return { kind: 'undeclared', status: 'undeclared', explicit: false };
  }
  return { kind: 'invalid', status, explicit: true };
}

function resolveDeclaredLegacyReference(profile, options = {}) {
  const status = typeof profile?.legacyStatus === 'string'
    ? profile.legacyStatus.trim()
    : '';
  if (status === 'absent') return null;

  const route = options.route || profile?.route || '';
  const logicalPath = typeof profile?.legacyPath === 'string'
    ? normalizeRepositoryPath(profile.legacyPath)
    : '';
  if (!route) throw new Error('declared legacy reference requires route identity');
  if (!logicalPath) throw new Error(`declared legacy reference requires legacyPath for ${route}`);

  const resolver = typeof options.resolveReferenceForRoute === 'function'
    ? options.resolveReferenceForRoute
    : resolveReferenceForRoute;
  const resolved = resolver(route, { mustExist: options.mustExist !== false });
  if (resolved.logicalPath !== logicalPath) {
    throw new Error(`route/profile legacy identity mismatch for ${route}: profile=${logicalPath}, ledger=${resolved.logicalPath}`);
  }
  return resolved;
}

function validateLegacyAuthorityProfile(profile, options = {}) {
  const issues = [];
  const status = typeof profile?.legacyStatus === 'string'
    ? profile.legacyStatus.trim()
    : '';
  const referencePath = typeof profile?.legacyPath === 'string'
    ? profile.legacyPath.trim()
    : '';

  if (!status) {
    issues.push('production profile missing explicit legacyStatus');
    return issues;
  }
  if (!VALID_LEGACY_STATUSES.has(status)) {
    issues.push(`unknown legacyStatus=${status}`);
    return issues;
  }

  if (status === 'absent') {
    if (referencePath) issues.push(`legacyStatus=absent must not declare legacyPath=${referencePath}`);
    return issues;
  }

  if (!referencePath) {
    issues.push(`legacyStatus=${status} requires legacyPath`);
    return issues;
  }

  const route = options.route || profile?.route || '';
  if (route && options.verifyReference !== false) {
    try {
      resolveDeclaredLegacyReference(profile, {
        route,
        mustExist: options.mustExist !== false,
        resolveReferenceForRoute: options.resolveReferenceForRoute,
      });
    } catch (error) {
      issues.push(error.message);
    }
  } else if (typeof options.pathExists === 'function' && !options.pathExists(referencePath)) {
    // Synthetic/unit fixtures without route identity may inject a logical-path
    // validator. Production route profiles must use the explicit route API.
    issues.push(`declared legacyPath not found: ${referencePath}`);
  }
  return issues;
}

function currentLegacyReferenceDisposition(profile, profilePath = 'route-profile') {
  const status = typeof profile?.legacyStatus === 'string'
    ? profile.legacyStatus.trim()
    : '';
  if (status === 'reference-only') {
    return {
      declaredLegacyStatus: status,
      classification: 'migration-reference-only',
      decisionSource: `${profilePath}:legacyStatus`,
    };
  }
  if (status === 'canonical' || status === 'runtime-required') {
    return {
      declaredLegacyStatus: status,
      classification: 'production-required',
      decisionSource: `${profilePath}:legacyStatus`,
    };
  }
  if (status === 'absent') {
    return {
      declaredLegacyStatus: status,
      classification: 'absent',
      decisionSource: `${profilePath}:legacyStatus`,
    };
  }
  return {
    declaredLegacyStatus: status || null,
    classification: 'unknown-blocker',
    decisionSource: profilePath ? `${profilePath}:legacyStatus-missing` : 'route-profile-missing',
  };
}

function runLegacyAuthorityContractChecks() {
  const cases = [
    [{}, 1, 'missing status is rejected'],
    [{ legacyStatus: 'unknown-state' }, 1, 'unknown status is rejected'],
    [{ legacyStatus: 'absent', legacyPath: 'old/index.html' }, 1, 'absent with a path is rejected'],
    [{ legacyStatus: 'reference-only' }, 1, 'reference-only without a path is rejected'],
    [{ legacyStatus: 'absent' }, 0, 'explicit absent is valid'],
    [{ legacyStatus: 'reference-only', legacyPath: 'old/index.html' }, 0, 'explicit reference-only shape is valid'],
  ];
  for (const [profile, expectedIssues, label] of cases) {
    assert.equal(validateLegacyAuthorityProfile(profile).length, expectedIssues, label);
  }

  const syntheticResolver = (route) => ({
    route,
    logicalPath: 'old/index.html',
    repositoryPath: 'migration/legacy-reference/old/index.html',
    absolutePath: '/tmp/reference.html',
    exists: true,
  });
  assert.equal(
    resolveDeclaredLegacyReference(
      { route: '/old/', legacyStatus: 'reference-only', legacyPath: 'old/index.html' },
      { resolveReferenceForRoute: syntheticResolver }
    ).repositoryPath,
    'migration/legacy-reference/old/index.html',
    'declared reference resolution must be storage-agnostic'
  );
  assert.throws(
    () => resolveDeclaredLegacyReference(
      { route: '/old/', legacyStatus: 'reference-only', legacyPath: 'wrong/index.html' },
      { resolveReferenceForRoute: syntheticResolver }
    ),
    /route\/profile legacy identity mismatch/,
    'profile/ledger identity mismatch must fail closed'
  );

  assert.equal(currentLegacyReferenceDisposition({ legacyStatus: 'reference-only' }, 'p').classification, 'migration-reference-only');
  assert.equal(currentLegacyReferenceDisposition({ legacyStatus: 'runtime-required' }, 'p').classification, 'production-required');
  assert.equal(currentLegacyReferenceDisposition({}, 'p').classification, 'unknown-blocker');
  return cases.length + 5;
}

function legacyIsAuthoritative(profile) {
  return classifyLegacyAuthority(profile).kind === 'authoritative';
}

module.exports = {
  AUTHORITATIVE_LEGACY_STATUSES,
  NON_AUTHORITATIVE_LEGACY_STATUSES,
  VALID_LEGACY_STATUSES,
  classifyLegacyAuthority,
  currentLegacyReferenceDisposition,
  legacyIsAuthoritative,
  loadRouteProfile,
  resolveDeclaredLegacyReference,
  runLegacyAuthorityContractChecks,
  validateLegacyAuthorityProfile,
};
