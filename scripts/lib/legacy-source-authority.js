'use strict';

const fs = require('fs');
const { findProfileFile } = require('./route-source-contract');

const AUTHORITATIVE_LEGACY_STATUSES = new Set(['canonical', 'runtime-required']);

function loadRouteProfile(route) {
  const file = findProfileFile(route);
  if (!file) return { file: null, profile: null };
  return {
    file,
    profile: JSON.parse(fs.readFileSync(file, 'utf8')),
  };
}

function legacyIsAuthoritative(profile) {
  // Unprofiled historical routes retain the conservative legacy oracle until
  // they receive an explicit source contract.
  if (!profile) return true;
  return AUTHORITATIVE_LEGACY_STATUSES.has(profile.legacyStatus);
}

module.exports = {
  AUTHORITATIVE_LEGACY_STATUSES,
  legacyIsAuthoritative,
  loadRouteProfile,
};
