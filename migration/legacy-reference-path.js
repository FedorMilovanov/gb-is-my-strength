'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';
const FORBIDDEN_STORAGE_ROOTS = new Set(['dist', 'public']);

let cachedLedger = null;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function normalizeRoute(route) {
  if (typeof route !== 'string') throw new TypeError('reference route must be a string');
  const value = route.trim();
  if (!value || value.includes('\0') || value.includes('\\') || value.includes('?') || value.includes('#')) {
    throw new Error(`invalid reference route: ${JSON.stringify(route)}`);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) {
    throw new Error(`reference route must be repository-local: ${value}`);
  }
  const segments = value.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`reference route traversal is forbidden: ${value}`);
  }
  return segments.length ? `/${segments.join('/')}/` : '/';
}

function normalizeRepositoryPath(relativePath) {
  if (typeof relativePath !== 'string') throw new TypeError('reference path must be a string');
  const value = relativePath.trim().replaceAll('\\', '/');
  if (!value || value.includes('\0') || path.posix.isAbsolute(value) || /^[a-z]:/i.test(value)) {
    throw new Error(`invalid repository reference path: ${JSON.stringify(relativePath)}`);
  }
  const normalized = path.posix.normalize(value).replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (normalized === '.' || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error(`reference path traversal is forbidden: ${value}`);
  }
  if (FORBIDDEN_STORAGE_ROOTS.has(segments[0])) {
    throw new Error(`reference storage cannot live under ${segments[0]}/`);
  }
  return normalized;
}

function loadLedger() {
  if (cachedLedger) return cachedLedger;
  const manifest = readJson(MANIFEST_REL);
  if (manifest.schemaVersion !== '1.0.0' || manifest.issue !== 62) {
    throw new Error('legacy reference ledger authority is invalid');
  }
  if (!Array.isArray(manifest.referenceShards) || manifest.referenceShards.length !== 4) {
    throw new Error('legacy reference ledger must declare exactly four shards');
  }

  const entries = manifest.referenceShards.flatMap((relativePath) => {
    const shard = readJson(normalizeRepositoryPath(relativePath));
    if (shard.schemaVersion !== '1.0.0' || !Array.isArray(shard.entries)) {
      throw new Error(`invalid legacy reference shard: ${relativePath}`);
    }
    return shard.entries;
  });

  const byRoute = new Map();
  const byPath = new Map();
  for (const entry of entries) {
    const route = normalizeRoute(entry.route);
    const repositoryPath = normalizeRepositoryPath(entry.legacyPath);
    if (byRoute.has(route)) throw new Error(`duplicate reference route in ledger: ${route}`);
    if (byPath.has(repositoryPath)) throw new Error(`duplicate reference path in ledger: ${repositoryPath}`);
    byRoute.set(route, Object.freeze({ ...entry, route, legacyPath: repositoryPath }));
    byPath.set(repositoryPath, byRoute.get(route));
  }

  if (entries.length !== manifest.summary?.references) {
    throw new Error(`reference ledger count drift: manifest=${manifest.summary?.references}, entries=${entries.length}`);
  }

  cachedLedger = Object.freeze({
    manifest: Object.freeze(manifest),
    entries: Object.freeze([...byRoute.values()]),
    byRoute,
    byPath,
  });
  return cachedLedger;
}

function assertRegularRepositoryFile(repositoryPath, options = {}) {
  const mustExist = options.mustExist !== false;
  const normalized = normalizeRepositoryPath(repositoryPath);
  const absolutePath = path.resolve(ROOT, normalized);
  const rootPrefix = `${ROOT}${path.sep}`;
  if (absolutePath !== ROOT && !absolutePath.startsWith(rootPrefix)) {
    throw new Error(`reference escaped repository root: ${normalized}`);
  }

  if (!fs.existsSync(absolutePath)) {
    if (mustExist) throw new Error(`ledger-owned reference file is missing: ${normalized}`);
    return { absolutePath, repositoryPath: normalized, exists: false };
  }

  let cursor = ROOT;
  for (const segment of normalized.split('/')) {
    cursor = path.join(cursor, segment);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`reference path contains a symlink: ${normalized}`);
  }
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile()) throw new Error(`reference path is not a regular file: ${normalized}`);

  const realPath = fs.realpathSync(absolutePath);
  if (realPath !== ROOT && !realPath.startsWith(rootPrefix)) {
    throw new Error(`reference real path escaped repository root: ${normalized}`);
  }
  return { absolutePath, repositoryPath: normalized, exists: true };
}

function resolveReferenceForRoute(route, options = {}) {
  const normalizedRoute = normalizeRoute(route);
  const ledger = loadLedger();
  const entry = ledger.byRoute.get(normalizedRoute);
  if (!entry) throw new Error(`route is not owned by the legacy reference ledger: ${normalizedRoute}`);
  return Object.freeze({ ...assertRegularRepositoryFile(entry.legacyPath, options), route: normalizedRoute, entry });
}

function resolveReferencePath(repositoryPath, options = {}) {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  const ledger = loadLedger();
  const entry = ledger.byPath.get(normalizedPath);
  if (!entry) throw new Error(`path is not owned by the legacy reference ledger: ${normalizedPath}`);
  return Object.freeze({ ...assertRegularRepositoryFile(normalizedPath, options), route: entry.route, entry });
}

function listReferenceRoutes() {
  return Object.freeze(loadLedger().entries.map((entry) => entry.route));
}

module.exports = {
  MANIFEST_REL,
  listReferenceRoutes,
  normalizeRepositoryPath,
  normalizeRoute,
  resolveReferenceForRoute,
  resolveReferencePath,
};
