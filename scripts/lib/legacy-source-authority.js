'use strict';

const fs = require('fs');
const { findProfileFile } = require('./route-source-contract');

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

  if (typeof options.pathExists === 'function' && !options.pathExists(referencePath)) {
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
  validateLegacyAuthorityProfile,
};
