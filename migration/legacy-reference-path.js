'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_REL = 'data/legacy-reference-ledger/manifest.json';
const REFERENCE_STORAGE_ROOT_REL = 'migration/legacy-reference';
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

function resolveInsideRoot(root, repositoryPath) {
  const normalized = normalizeRepositoryPath(repositoryPath);
  const absoluteRoot = path.resolve(root);
  const absolutePath = path.resolve(absoluteRoot, normalized);
  const rootPrefix = `${absoluteRoot}${path.sep}`;
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(rootPrefix)) {
    throw new Error(`reference escaped repository root: ${normalized}`);
  }
  return { absoluteRoot, absolutePath, repositoryPath: normalized };
}

function assertRegularRepositoryFile(repositoryPath, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const mustExist = options.mustExist !== false;
  const resolved = resolveInsideRoot(root, repositoryPath);
  const { absoluteRoot, absolutePath } = resolved;
  const rootPrefix = `${absoluteRoot}${path.sep}`;

  if (!fs.existsSync(absolutePath)) {
    if (mustExist) throw new Error(`ledger-owned reference file is missing: ${resolved.repositoryPath}`);
    return { ...resolved, exists: false };
  }

  let cursor = absoluteRoot;
  for (const segment of resolved.repositoryPath.split('/')) {
    cursor = path.join(cursor, segment);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink()) throw new Error(`reference path contains a symlink: ${resolved.repositoryPath}`);
  }
  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile()) throw new Error(`reference path is not a regular file: ${resolved.repositoryPath}`);

  const realPath = fs.realpathSync(absolutePath);
  if (realPath !== absoluteRoot && !realPath.startsWith(rootPrefix)) {
    throw new Error(`reference real path escaped repository root: ${resolved.repositoryPath}`);
  }
  return { ...resolved, exists: true };
}

function referenceStorageCandidates(logicalPath) {
  const normalized = normalizeRepositoryPath(logicalPath);
  return Object.freeze([
    normalized,
    normalizeRepositoryPath(path.posix.join(REFERENCE_STORAGE_ROOT_REL, normalized)),
  ]);
}

function resolveLogicalReferenceStorage(logicalPath, options = {}) {
  const root = options.root ? path.resolve(options.root) : ROOT;
  const mustExist = options.mustExist !== false;
  const candidates = referenceStorageCandidates(logicalPath);
  const existing = candidates
    .map((repositoryPath) => assertRegularRepositoryFile(repositoryPath, { root, mustExist: false }))
    .filter((candidate) => candidate.exists);

  if (existing.length > 1) {
    throw new Error(`legacy reference storage is ambiguous for ${normalizeRepositoryPath(logicalPath)}: ${existing.map((item) => item.repositoryPath).join(', ')}`);
  }
  if (existing.length === 1) return Object.freeze(existing[0]);
  if (mustExist) {
    throw new Error(`ledger-owned reference file is missing from both active and quarantine storage: ${normalizeRepositoryPath(logicalPath)}`);
  }
  return Object.freeze(assertRegularRepositoryFile(candidates[0], { root, mustExist: false }));
}

function resolveReferenceForRoute(route, options = {}) {
  const normalizedRoute = normalizeRoute(route);
  const ledger = loadLedger();
  const entry = ledger.byRoute.get(normalizedRoute);
  if (!entry) throw new Error(`route is not owned by the legacy reference ledger: ${normalizedRoute}`);
  const storage = resolveLogicalReferenceStorage(entry.legacyPath, options);
  return Object.freeze({
    ...storage,
    route: normalizedRoute,
    logicalPath: entry.legacyPath,
    entry,
  });
}

function resolveReferencePath(repositoryPath, options = {}) {
  const normalizedPath = normalizeRepositoryPath(repositoryPath);
  const ledger = loadLedger();
  const entry = ledger.byPath.get(normalizedPath);
  if (!entry) throw new Error(`path is not owned by the legacy reference ledger: ${normalizedPath}`);
  const storage = resolveLogicalReferenceStorage(entry.legacyPath, options);
  return Object.freeze({
    ...storage,
    route: entry.route,
    logicalPath: entry.legacyPath,
    entry,
  });
}

function listReferenceRoutes() {
  return Object.freeze(loadLedger().entries.map((entry) => entry.route));
}

module.exports = {
  MANIFEST_REL,
  REFERENCE_STORAGE_ROOT_REL,
  listReferenceRoutes,
  normalizeRepositoryPath,
  normalizeRoute,
  referenceStorageCandidates,
  resolveLogicalReferenceStorage,
  resolveReferenceForRoute,
  resolveReferencePath,
};
