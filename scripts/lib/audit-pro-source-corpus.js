'use strict';

const fs = require('fs');
const path = require('path');

const VERIFICATION_FILE_RE = /^(google|yandex)[^/]*\.html$/i;

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

function buildAuditProSourceCorpus({ root, entries, allHtmlFiles = [] }) {
  const normalizedRoot = path.resolve(root);
  const records = [...entries].sort((a, b) => String(a.route).localeCompare(String(b.route), 'en'));
  const registeredByFile = new Map();
  const sourcePages = [];
  const distOnly = [];
  const registeredNonProduction = [];
  const duplicateRootMappings = [];

  for (const entry of records) {
    const file = normalizeFile(routeToRootHtml(normalizedRoot, entry.route));
    const previous = registeredByFile.get(file);
    if (previous) duplicateRootMappings.push({ file, routes: [previous.route, entry.route] });
    else registeredByFile.set(file, entry);

    if (!fs.existsSync(file)) {
      if (entry.status === 'production-dist') distOnly.push({ route: entry.route, file, entry });
      continue;
    }

    const record = { route: entry.route, file, entry };
    if (entry.status === 'production-dist') sourcePages.push(record);
    else registeredNonProduction.push(record);
  }

  const unregisteredRootHtml = [...new Set(allHtmlFiles.map(normalizeFile))]
    .filter((file) => file.startsWith(normalizedRoot + path.sep) || file === normalizedRoot)
    .filter((file) => !registeredByFile.has(file))
    .filter((file) => !isUtilityHtml(normalizedRoot, file))
    .sort()
    .map((file) => ({ file, relative: path.relative(normalizedRoot, file).replace(/\\/g, '/') }));

  return {
    sourcePages,
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
  routeToRootHtml,
  isUtilityHtml,
  buildAuditProSourceCorpus,
};
