'use strict';

const fs = require('fs');
const path = require('path');
const { resolveReferenceForRoute } = require('../../migration/legacy-reference-path');

const VERIFICATION_FILE_RE = /^(google|yandex)[^/]*\.html$/i;
const LEDGER_REFERENCE_STATUSES = new Set(['canonical', 'reference-only', 'runtime-required']);

function routeToRootHtml(root, route) {
  const clean = String(route || '/').split(/[?#]/, 1)[0];
  if (clean === '/') return path.join(root, 'index.html');
  if (clean.endsWith('/')) return path.join(root, clean.replace(/^\/+/, ''), 'index.html');
  return path.join(root, clean.replace(/^\/+/, ''));
}

function normalizeFile(file) {
  return path.resolve(file);
}

function isUtilityHtml(root, file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === '404.html') return true;
  return !rel.includes('/') && VERIFICATION_FILE_RE.test(rel);
}

function resolveEntryStorage({ root, entry, resolveReference }) {
  const logicalRootFile = normalizeFile(routeToRootHtml(root, entry.route));
  const shouldResolve = entry.status === 'production-dist'
    && LEDGER_REFERENCE_STATUSES.has(entry.legacyStatus);
  if (!shouldResolve) {
    return {
      file: logicalRootFile,
      logicalRootFile,
      exists: fs.existsSync(logicalRootFile),
    };
  }

  const reference = resolveReference(entry.route, { root, mustExist: false });
  return {
    file: normalizeFile(reference.absolutePath),
    logicalRootFile,
    exists: Boolean(reference.exists),
  };
}

function buildAuditProSourceCorpus({
  root,
  entries,
  allHtmlFiles = [],
  resolveReference = resolveReferenceForRoute,
}) {
  const normalizedRoot = path.resolve(root);
  const records = [...entries].sort((a, b) => String(a.route).localeCompare(String(b.route), 'en'));
  const registeredByFile = new Map();
  const sourcePages = [];
  const currentRuntimePages = [];
  const referenceOnly = [];
  const distOnly = [];
  const registeredNonProduction = [];
  const duplicateRootMappings = [];

  for (const entry of records) {
    const storage = resolveEntryStorage({ root: normalizedRoot, entry, resolveReference });
    const previous = registeredByFile.get(storage.logicalRootFile);
    if (previous) duplicateRootMappings.push({ file: storage.logicalRootFile, routes: [previous.route, entry.route] });
    else registeredByFile.set(storage.logicalRootFile, entry);

    if (!storage.exists) {
      if (entry.status === 'production-dist') distOnly.push({ route: entry.route, file: storage.file, entry });
      continue;
    }

    const record = { route: entry.route, file: storage.file, entry };
    if (entry.status === 'production-dist') {
      // Keep every committed production shadow in the broad source corpus so
      // structural/forensic checks still inspect retained evidence. Physical
      // storage for ledger-owned references is resolved through the explicit
      // reference API, so quarantine moves do not rewrite this consumer.
      sourcePages.push(record);
      if (entry.legacyStatus === 'reference-only') {
        referenceOnly.push(record);
      } else if (entry.legacyStatus !== 'absent') {
        currentRuntimePages.push(record);
      }
    } else {
      registeredNonProduction.push(record);
    }
  }

  const unregisteredRootHtml = [...new Set(allHtmlFiles.map(normalizeFile))]
    .filter((file) => file.startsWith(normalizedRoot + path.sep) || file === normalizedRoot)
    .filter((file) => !registeredByFile.has(file))
    .filter((file) => !isUtilityHtml(normalizedRoot, file))
    .sort()
    .map((file) => ({ file, relative: path.relative(normalizedRoot, file).replace(/\\/g, '/') }));

  return {
    sourcePages,
    currentRuntimePages,
    referenceOnly,
    distOnly,
    registeredNonProduction,
    unregisteredRootHtml,
    duplicateRootMappings,
    registeredRoutes: records.length,
    productionRoutes: records.filter((entry) => entry.status === 'production-dist').length,
  };
}

module.exports = {
  VERIFICATION_FILE_RE,
  LEDGER_REFERENCE_STATUSES,
  routeToRootHtml,
  isUtilityHtml,
  resolveEntryStorage,
  buildAuditProSourceCorpus,
};
