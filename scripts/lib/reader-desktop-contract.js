'use strict';

// Build-time desktop presentation contract. The route registry and accepted
// W57 manifest are the authorities; neither Astro nor localhost owns a second list.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { loadRouteRecords } = require('./effective-route-registry');
const { buildPublicSurfaceRegistry } = require('./public-surface-registry');

const ROOT = path.resolve(__dirname, '../..');
const PILOT = path.join(ROOT, 'research/reader-w57-pilot');
const SHARED_HEAD = 'src/components/reader-platform/ReaderPreferencesHead.astro';
const PROTECTED_PREFIXES = Object.freeze(['/nagornaya/', '/journal/', '/updates/', '/news/', '/novosti/']);

function isDesktopReaderRoute(entry) {
  return Boolean(entry && typeof entry.route === 'string' &&
    entry.owner === 'astro' && entry.status === 'production-dist' &&
    entry.routeRole === 'reading' && entry.settingsCapability === 'reader-ui' &&
    !PROTECTED_PREFIXES.some(prefix => entry.route.startsWith(prefix)));
}

function buildDesktopReaderContract() {
  const loaded = loadRouteRecords();
  const { entries, errors } = buildPublicSurfaceRegistry({ loaded });
  if (errors.length) throw new Error(errors.join('\n'));
  const records = new Map(loaded.records.map(record => [record.route, record]));
  const routes = entries.filter(isDesktopReaderRoute).map(entry => entry.route);
  if (!routes.length || new Set(routes).size !== routes.length) throw new Error('Invalid desktop reader route membership');
  for (const route of routes) {
    const graph = records.get(route)?.inspection;
    if (!graph || graph.graphTruncated || !graph.files.includes(SHARED_HEAD)) {
      throw new Error('Missing canonical Reader head for ' + route);
    }
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(PILOT, 'MANIFEST.json'), 'utf8'));
  const names = new Set();
  const styles = [], scripts = [];
  for (const asset of manifest.files) {
    if (!/^reader_[a-z0-9_]+\.(css|js)$/.test(asset.name) || names.has(asset.name) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid desktop reader asset ' + asset.name);
    names.add(asset.name);
    const bytes = fs.readFileSync(path.join(PILOT, 'assets', asset.name));
    if (bytes.length !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
      throw new Error('Desktop reader manifest drift: ' + asset.name);
    }
    (asset.name.endsWith('.css') ? styles : scripts).push(asset);
  }
  if (styles.length !== 6 || scripts.length !== 6) throw new Error('Incomplete W57 presentation asset chain');
  return { routes, styles, scripts };
}

module.exports = { isDesktopReaderRoute, buildDesktopReaderContract };
