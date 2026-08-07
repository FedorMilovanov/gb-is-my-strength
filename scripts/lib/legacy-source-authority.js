'use strict';

const fs = require('fs');
const { findProfileFile } = require('./route-source-contract');

const AUTHORITATIVE_LEGACY_STATUSES = new Set(['canonical', 'runtime-required']);
const NON_AUTHORITATIVE_LEGACY_STATUSES = new Set(['reference-only', 'absent']);

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

function legacyIsAuthoritative(profile) {
  return classifyLegacyAuthority(profile).kind === 'authoritative';
}

module.exports = {
  AUTHORITATIVE_LEGACY_STATUSES,
  NON_AUTHORITATIVE_LEGACY_STATUSES,
  classifyLegacyAuthority,
  legacyIsAuthoritative,
  loadRouteProfile,
};
