'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const OWNERSHIP_FILE = path.join(ROOT, 'migration/page-ownership.json');
const MATRIX_FILE = path.join(ROOT, 'migration/route-migration-matrix.json');
const PROFILES_DIR = path.join(ROOT, 'data/route-profiles');

const ARTICLE_ROUTE_TYPES = new Set(['article', 'series-article']);
const STRICT_NATIVE_MODES = new Set(['strict-native', 'strict-native-app']);
const CONTENT_SOURCE_MODES = new Set([
  'astro-native-entry',
  'mdx-native',
  'legacy-runtime',
  'native-app-entry',
]);
const METADATA_SOURCE_MODES = new Set([
  'astro-head-import',
  'inline-head',
  'content-frontmatter',
  'app-manifest',
]);
const REFERENCE_STATUSES = new Set(['canonical', 'reference-only', 'runtime-required', 'absent']);
const TRAVERSABLE_EXTENSIONS = new Set(['.astro', '.mdx', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
const MAX_IMPORT_GRAPH_FILES = 1200;

const LEGACY_SOURCE_PATTERNS = [
  ['loadLegacyFullDocument', /\bloadLegacyFullDocument\s*\(/],
  ['headHtml', /\bheadHtml\b/],
  ['bodyHtml', /\bbodyHtml\b/],
  ['bodyAttributes', /\bbodyAttributes\b/],
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function existsRel(rel) {
  return Boolean(rel) && fs.existsSync(path.join(ROOT, rel));
}

function routeToFlatProfileNames(route) {
  const clean = route.replace(/^\/+|\/+$/g, '') || 'home';
  return [
    `${clean}.json`,
    `${clean.replace(/\//g, '-')}.json`,
    `${clean.replace(/\//g, '__')}.json`,
  ];
}

function findProfileFile(route) {
  for (const name of routeToFlatProfileNames(route)) {
    const file = path.join(PROFILES_DIR, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function toRepoRel(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function resolveImport(importerRel, specifier) {
  if (!specifier || (!specifier.startsWith('@/') && !specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return null;
  }

  const cleanSpecifier = specifier.replace(/[?#].*$/, '');
  let base;
  if (cleanSpecifier.startsWith('@/')) {
    base = path.join(ROOT, 'src', cleanSpecifier.slice(2));
  } else if (cleanSpecifier.startsWith('/')) {
    base = path.join(ROOT, cleanSpecifier.replace(/^\/+/, ''));
  } else {
    base = path.resolve(path.dirname(path.join(ROOT, importerRel)), cleanSpecifier);
  }

  const candidates = [
    base,
    `${base}.astro`,
    `${base}.mdx`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, 'index.astro'),
    path.join(base, 'index.mdx'),
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? toRepoRel(found) : toRepoRel(base);
}

function parseImports(source, importerRel) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*$\s{},]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bexport\s+(?:type\s+)?(?:\*|{[^}]*})\s+from\s+['"]([^'"]+)['"]/g,
  ];

  for (const re of patterns) {
    let match;
    while ((match = re.exec(source))) specifiers.add(match[1]);
  }

  return [...specifiers].map((specifier) => ({
    importer: importerRel,
    specifier,
    resolved: resolveImport(importerRel, specifier),
  }));
}

function stripComments(source) {
  return String(source || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

function inspectReferenceContent(rel) {
  if (!existsRel(rel)) return null;
  const source = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { sourceMode: '', body: source, validFrontmatter: false };
  const sourceMode = match[1].match(/^sourceMode:\s*["']([^"']+)["']\s*$/m)?.[1] || '';
  return { sourceMode, body: match[2], validFrontmatter: true };
}

function hasUnsafeSetHtml(source) {
  const withoutJsonLdSerialization = String(source || '').replace(
    /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])(?=[^>]*\bset:html\s*=)[^>]*\/?>/gi,
    '<script type="application/ld+json">'
  );
  return /\bset:html\s*=/.test(withoutJsonLdSerialization);
}

function sourceLegacyMarkers(source, fileRel) {
  const clean = stripComments(source);
  const markers = [];
  for (const [name, re] of LEGACY_SOURCE_PATTERNS) {
    if (re.test(clean)) markers.push({ file: fileRel, marker: name });
  }
  if (hasUnsafeSetHtml(clean)) markers.push({ file: fileRel, marker: 'non-JSON-LD set:html' });
  return markers;
}

function importLegacyMarkers(importItem) {
  const markers = [];
  if (/[?&]raw(?:[=&]|$)/.test(importItem.specifier)) {
    markers.push({ file: importItem.importer, marker: `raw import ${importItem.specifier}` });
  }
  if (/(?:^|\/)\_legacy(?:\/|$)/.test(importItem.specifier) || /(?:^|\/)\_legacy(?:\/|$)/.test(importItem.resolved || '')) {
    markers.push({ file: importItem.importer, marker: `legacy import ${importItem.specifier}` });
  }
  return markers;
}

function inspectRouteSource(sourceRel) {
  const entryAbs = path.join(ROOT, sourceRel);
  if (!fs.existsSync(entryAbs)) {
    return {
      exists: false,
      source: '',
      files: [],
      imports: [],
      localImports: [],
      unresolvedLocalImports: [],
      mdxImports: [],
      astroImports: [],
      headImports: [],
      legacyMarkers: [],
      graphTruncated: false,
    };
  }

  const queue = [sourceRel];
  const visited = new Set();
  const files = [];
  const imports = [];
  const legacyMarkers = [];
  let entrySource = '';
  let graphTruncated = false;

  while (queue.length) {
    const fileRel = queue.shift();
    if (visited.has(fileRel)) continue;
    if (visited.size >= MAX_IMPORT_GRAPH_FILES) {
      graphTruncated = true;
      break;
    }

    const abs = path.join(ROOT, fileRel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    visited.add(fileRel);

    const source = fs.readFileSync(abs, 'utf8');
    if (fileRel === sourceRel) entrySource = source;
    files.push(fileRel);
    legacyMarkers.push(...sourceLegacyMarkers(source, fileRel));

    for (const item of parseImports(source, fileRel)) {
      imports.push(item);
      legacyMarkers.push(...importLegacyMarkers(item));
      if (!item.resolved || !existsRel(item.resolved)) continue;
      if (!TRAVERSABLE_EXTENSIONS.has(path.extname(item.resolved).toLowerCase())) continue;
      if (!visited.has(item.resolved)) queue.push(item.resolved);
    }
  }

  const localImports = imports.filter((item) => item.resolved);
  const unresolvedLocalImports = localImports.filter((item) => !existsRel(item.resolved));
  const mdxImports = localImports.filter((item) => /\.mdx$/i.test(item.resolved || item.specifier));
  const astroImports = localImports.filter((item) => /\.astro$/i.test(item.resolved || item.specifier));
  const headImports = astroImports.filter((item) => /(?:PageHead|Head)\.astro$/i.test(item.resolved || ''));

  return {
    exists: true,
    source: entrySource,
    files,
    imports,
    localImports,
    unresolvedLocalImports,
    mdxImports,
    astroImports,
    headImports,
    legacyMarkers,
    graphTruncated,
  };
}

function loadRouteRecords() {
  const ownership = readJson(OWNERSHIP_FILE);
  const matrix = readJson(MATRIX_FILE);
  const records = [];

  for (const [route, owner] of Object.entries(ownership.routes || {})) {
    const profileFile = findProfileFile(route);
    const profile = profileFile ? readJson(profileFile) : null;
    const matrixEntry = matrix.routes?.[route] || null;
    const sourceRel = profile?.renderSource || owner.source || matrixEntry?.source || profile?.source || '';
    const inspection = sourceRel ? inspectRouteSource(sourceRel) : inspectRouteSource('__missing__');

    records.push({
      route,
      owner,
      matrix: matrixEntry,
      profile,
      profileFile: profileFile ? toRepoRel(profileFile) : null,
      sourceRel,
      inspection,
    });
  }

  return {
    root: ROOT,
    ownership,
    matrix,
    records,
  };
}

function validateRecord(record, options = {}) {
  const strict = Boolean(options.strict);
  const errors = [];
  const warnings = [];
  const { route, owner, matrix, profile, profileFile, sourceRel, inspection } = record;
  const migrationMode = profile?.migrationMode || matrix?.mode || '';
  const isStrictNative = STRICT_NATIVE_MODES.has(migrationMode);
  const isArticle = ARTICLE_ROUTE_TYPES.has(profile?.routeType);

  const issue = (message, blocking = true) => {
    if (blocking || strict) errors.push(`${route}: ${message}`);
    else warnings.push(`${route}: ${message}`);
  };

  if (owner.owner === 'astro' && owner.status === 'production-dist') {
    if (!matrix) issue('missing route-migration-matrix entry');
    if (!profile) issue(`missing route profile${profileFile ? '' : ' in data/route-profiles'}`);
  }

  if (!profile) return { errors, warnings, isArticle, isStrictNative };

  if (profile.route && profile.route !== route) issue(`profile.route mismatch (${profile.route})`);
  if (owner.source && profile.source && owner.source !== profile.source) {
    issue(`page-ownership source (${owner.source}) != profile.source (${profile.source})`);
  }
  if (matrix?.source && owner.source && matrix.source !== owner.source) {
    issue(`matrix source (${matrix.source}) != page-ownership source (${owner.source})`);
  }

  if (profile.renderSource && profile.renderSource !== owner.source) {
    issue(`renderSource (${profile.renderSource}) must equal Astro route entry (${owner.source})`);
  }
  if (!inspection.exists) issue(`render source not found: ${sourceRel}`);
  if (inspection.graphTruncated) issue(`import graph exceeded ${MAX_IMPORT_GRAPH_FILES} files`);
  if (inspection.unresolvedLocalImports.length) {
    const sample = inspection.unresolvedLocalImports.slice(0, 8)
      .map((item) => `${item.importer} -> ${item.specifier}`)
      .join(', ');
    issue(`unresolved local import(s): ${sample}`);
  }

  if (isStrictNative && inspection.legacyMarkers.length) {
    const markers = inspection.legacyMarkers.slice(0, 12)
      .map((item) => `${item.file}: ${item.marker}`)
      .join(', ');
    issue(`strict-native import graph contains legacy runtime marker(s): ${markers}`);
  }

  if (isStrictNative && isArticle) {
    if (!profile.sourceContractVersion) issue('missing sourceContractVersion', false);
    if (!profile.contentSourceMode) issue('missing contentSourceMode', false);
    if (!profile.metadataSourceMode) issue('missing metadataSourceMode', false);
    if (!profile.mdxStatus) issue('missing mdxStatus', false);
    if (!profile.legacyStatus) issue('missing legacyStatus', false);

    if (profile.contentSourceMode && !CONTENT_SOURCE_MODES.has(profile.contentSourceMode)) {
      issue(`unknown contentSourceMode: ${profile.contentSourceMode}`);
    }
    if (profile.metadataSourceMode && !METADATA_SOURCE_MODES.has(profile.metadataSourceMode)) {
      issue(`unknown metadataSourceMode: ${profile.metadataSourceMode}`);
    }
    if (profile.mdxStatus && !REFERENCE_STATUSES.has(profile.mdxStatus)) {
      issue(`unknown mdxStatus: ${profile.mdxStatus}`);
    }
    if (profile.legacyStatus && !REFERENCE_STATUSES.has(profile.legacyStatus)) {
      issue(`unknown legacyStatus: ${profile.legacyStatus}`);
    }

    if (profile.contentSourceMode === 'astro-native-entry') {
      if (inspection.mdxImports.length) {
        issue(`astro-native-entry imports MDX: ${inspection.mdxImports.map((item) => item.resolved || item.specifier).join(', ')}`);
      }
      if (!inspection.astroImports.length) issue('astro-native-entry has no local Astro component imports');
    }

    if (profile.contentSourceMode === 'mdx-native' && !inspection.mdxImports.length) {
      issue('mdx-native route does not import an MDX content source');
    }

    if (profile.metadataSourceMode === 'astro-head-import' && !inspection.headImports.length) {
      issue('metadataSourceMode=astro-head-import but no PageHead/Head Astro import was resolved');
    }

    if (profile.mdxStatus === 'canonical' && !inspection.mdxImports.length) {
      issue('mdxStatus=canonical but public route import graph does not include MDX');
    }
    if (profile.mdxStatus === 'reference-only') {
      if (!profile.mdxPath) issue('mdxStatus=reference-only requires mdxPath');
      else if (!existsRel(profile.mdxPath)) issue(`reference MDX not found: ${profile.mdxPath}`);
      if (inspection.mdxImports.some((item) => item.resolved === profile.mdxPath)) {
        issue('reference-only MDX is imported by the public route graph');
      }
      const referenceContent = inspectReferenceContent(profile.mdxPath);
      if (referenceContent?.sourceMode === 'metadata-only') {
        if (!referenceContent.validFrontmatter) issue('metadata-only reference MDX has invalid frontmatter envelope');
        if (stripComments(referenceContent.body).trim()) issue('metadata-only reference MDX contains substantive body content');
      }
    }

    if (profile.legacyStatus === 'reference-only') {
      if (!profile.legacyPath) issue('legacyStatus=reference-only requires legacyPath');
      else if (!existsRel(profile.legacyPath)) issue(`legacy reference not found: ${profile.legacyPath}`);
    }

    if (profile.hasMDX === true && profile.mdxStatus === 'reference-only') {
      issue('deprecated hasMDX=true contradicts mdxStatus=reference-only', false);
    }
  }

  return { errors, warnings, isArticle, isStrictNative };
}

module.exports = {
  ROOT,
  ARTICLE_ROUTE_TYPES,
  STRICT_NATIVE_MODES,
  CONTENT_SOURCE_MODES,
  METADATA_SOURCE_MODES,
  REFERENCE_STATUSES,
  TRAVERSABLE_EXTENSIONS,
  existsRel,
  findProfileFile,
  inspectRouteSource,
  inspectReferenceContent,
  loadRouteRecords,
  validateRecord,
};
