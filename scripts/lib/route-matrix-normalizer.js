'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PROFILES_DIR = path.join(ROOT, 'data/route-profiles');
const CHANGELOG_TEXT = 'Native Source Contract v1: runtime matrix now covers all production routes; semantic edit exclusions moved to semanticEditExclusions; missing Astro production entries are derived from ownership + route profiles.';
const MARKER_CHANGELOG_TEXT = 'Runtime requiredMarkers normalized: source-only Astro component identifiers are not valid dist markers and are removed deterministically.';
const ORPHAN_CHANGELOG_TEXT = 'Orphan raw matrix overrides without page-ownership records are excluded from the effective runtime registry and reported for later quarantine cleanup.';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function routeToProfileNames(route) {
  const clean = route.replace(/^\/+|\/+$/g, '') || 'home';
  return [
    `${clean}.json`,
    `${clean.replace(/\//g, '-')}.json`,
    `${clean.replace(/\//g, '__')}.json`,
  ];
}

function findProfileFile(route) {
  for (const name of routeToProfileNames(route)) {
    const file = path.join(PROFILES_DIR, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function normalizeRouteForPattern(route) {
  return route.replace(/^\/+|\/+$/g, '');
}

function matchesGlob(value, pattern) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§DOUBLESTAR§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§DOUBLESTAR§§/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesAny(route, patterns) {
  const value = normalizeRouteForPattern(route);
  return patterns.some((pattern) => matchesGlob(value, pattern));
}

function isProductionAstro(owner) {
  return owner?.owner === 'astro' && owner?.status === 'production-dist';
}

function sourceHasPagefindBody(sourceRel) {
  if (!sourceRel) return false;
  const file = path.join(ROOT, sourceRel);
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('data-pagefind-body');
}

function isSourceOnlyComponentMarker(marker) {
  return typeof marker === 'string' &&
    /^[A-Z][A-Za-z0-9]*(?:Shell|Component|Page|Body|Head|Footer|Chrome)$/.test(marker);
}

function normalizeRequiredMarkers(contract) {
  if (!Array.isArray(contract.requiredMarkers)) contract.requiredMarkers = [];
  const removed = contract.requiredMarkers.filter(isSourceOnlyComponentMarker);
  contract.requiredMarkers = [...new Set(contract.requiredMarkers.filter((marker) => !isSourceOnlyComponentMarker(marker)))];
  return removed;
}

function createDerivedContract(route, owner, profile, semanticEditExclusions, matrixModes) {
  const mode = profile?.migrationMode;
  if (!mode) throw new Error(`${route}: route profile has no migrationMode`);
  if (!matrixModes.has(mode)) throw new Error(`${route}: profile migrationMode ${mode} is not declared in matrix.modes`);
  if (!owner.source) throw new Error(`${route}: page ownership has no source`);

  const contract = {
    mode,
    source: owner.source,
    requiredMarkers: sourceHasPagefindBody(owner.source) ? ['data-pagefind-body'] : [],
    audits: ['native-source-contract', 'native-runtime-taxonomy'],
    reason: 'Runtime ownership derived from page-ownership + route profile. Semantic edit protection never exempts runtime checks.',
    derived: true,
  };

  if (profile?.scope === 'excluded-semantic-lane' || matchesAny(route, semanticEditExclusions)) {
    contract.scope = 'excluded-semantic-lane';
  }
  return contract;
}

function normalizeRouteMatrix(matrix, ownership) {
  const next = JSON.parse(JSON.stringify(matrix));
  const legacyExclusions = Array.isArray(next.semanticEditExclusions)
    ? next.semanticEditExclusions
    : Array.isArray(next.exclude)
      ? next.exclude
      : [];

  next.version = '2026-07-09.native-source-contract-v1';
  next.scope = 'production-route-overrides-plus-derived-contracts';
  next.source = 'Effective runtime registry is derived from page-ownership + route profiles; this file stores modes, semantic edit policy and explicit route overrides';
  next.semanticEditExclusions = legacyExclusions;
  next.exclude = [];
  next.routes ||= {};
  next.changelog ||= [];

  const matrixModes = new Set(Object.keys(next.modes || {}));
  const derivedRoutes = [];
  const removedMarkers = [];
  const ignoredOrphanRoutes = [];

  // Raw matrix entries are overrides, not independent route declarations.
  // Overrides without page ownership cannot participate in the effective public
  // registry. Keep the raw file unchanged for migration archaeology, but remove
  // them from the normalized view and report them for validators/quarantine work.
  for (const route of Object.keys(next.routes)) {
    if (ownership.routes?.[route]) continue;
    ignoredOrphanRoutes.push(route);
    delete next.routes[route];
  }

  for (const [route, owner] of Object.entries(ownership.routes || {})) {
    if (!isProductionAstro(owner)) continue;
    const profileFile = findProfileFile(route);
    if (!profileFile) throw new Error(`${route}: production Astro route has no route profile`);
    const profile = readJson(profileFile);

    if (!next.routes[route]) {
      next.routes[route] = createDerivedContract(route, owner, profile, legacyExclusions, matrixModes);
      derivedRoutes.push(route);
      continue;
    }

    const contract = next.routes[route];
    for (const marker of normalizeRequiredMarkers(contract)) removedMarkers.push({ route, marker });

    if (!matrixModes.has(contract.mode)) throw new Error(`${route}: matrix mode ${contract.mode} is not declared`);
    if (contract.source !== owner.source) {
      throw new Error(`${route}: matrix source ${contract.source} != ownership source ${owner.source}`);
    }
    if (profile.migrationMode && contract.mode !== profile.migrationMode) {
      throw new Error(`${route}: matrix mode ${contract.mode} != profile migrationMode ${profile.migrationMode}`);
    }
    if (profile.scope === 'excluded-semantic-lane' || matchesAny(route, legacyExclusions)) {
      contract.scope = 'excluded-semantic-lane';
    }
    contract.derived = false;
  }

  if (!next.changelog.some((entry) => entry?.date === '2026-07-09' && entry?.change === CHANGELOG_TEXT)) {
    next.changelog.push({ date: '2026-07-09', change: CHANGELOG_TEXT });
  }
  if (removedMarkers.length && !next.changelog.some((entry) => entry?.date === '2026-07-09' && entry?.change === MARKER_CHANGELOG_TEXT)) {
    next.changelog.push({ date: '2026-07-09', change: MARKER_CHANGELOG_TEXT });
  }
  if (ignoredOrphanRoutes.length && !next.changelog.some((entry) => entry?.date === '2026-07-09' && entry?.change === ORPHAN_CHANGELOG_TEXT)) {
    next.changelog.push({ date: '2026-07-09', change: ORPHAN_CHANGELOG_TEXT });
  }

  return { next, derivedRoutes, removedMarkers, ignoredOrphanRoutes };
}

module.exports = {
  ROOT,
  PROFILES_DIR,
  findProfileFile,
  isProductionAstro,
  isSourceOnlyComponentMarker,
  normalizeRouteMatrix,
};
