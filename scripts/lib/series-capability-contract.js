'use strict';

const fs = require('fs');
const path = require('path');
const {
  SERIES_FACADE,
  buildPublicSurfaceRegistry,
} = require('./public-surface-registry');
const { loadRouteRecords } = require('./effective-route-registry');

const ROOT = path.resolve(__dirname, '../..');
const EXCEPTIONS_FILE = path.join(ROOT, 'data/series-capability-exceptions.json');
const SERIES_CONFIG_CORE = 'src/components/article-pilots/_shared/series/seriesConfig.ts';
const REQUIRED_EXCEPTION_CAPABILITIES = Object.freeze([
  'readerState',
  'navigation',
  'settings',
  'tts',
  'print',
  'accessibility',
  'publication',
]);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function defaultReadText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function defaultFileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, String(relativePath).split('#', 1)[0]));
}

function loadExceptions(readText = defaultReadText) {
  const parsed = JSON.parse(readText('data/series-capability-exceptions.json'));
  if (parsed.version !== 1 || !parsed.exceptions || typeof parsed.exceptions !== 'object') {
    throw new Error('data/series-capability-exceptions.json must contain version 1 and an exceptions object');
  }
  return parsed.exceptions;
}

function importDeclarations(source) {
  const rows = [];
  const re = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g;
  let match;
  while ((match = re.exec(source))) rows.push({ clause: match[1].trim(), specifier: match[2] });
  return rows;
}

function defaultImportName(source, specifier) {
  const row = importDeclarations(source).find((item) => item.specifier === specifier);
  if (!row) return null;
  const match = row.clause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
  return match ? match[1] : null;
}

function namedImport(source, localIdentifier) {
  for (const row of importDeclarations(source)) {
    const braces = row.clause.match(/\{([\s\S]*?)\}/);
    if (!braces) continue;
    for (const raw of braces[1].split(',')) {
      const part = raw.trim().replace(/^type\s+/, '');
      if (!part) continue;
      const pieces = part.split(/\s+as\s+/);
      const imported = pieces[0].trim();
      const local = (pieces[1] || pieces[0]).trim();
      if (local === localIdentifier) return { imported, specifier: row.specifier };
    }
  }
  return null;
}

function resolvedImport(record, importer, specifier) {
  return (record.inspection?.imports || []).find(
    (item) => item.importer === importer && item.specifier === specifier
  )?.resolved || null;
}

function facadeUsages(record, readText = defaultReadText) {
  const usages = [];
  for (const file of record.inspection?.files || []) {
    if (!/\.astro$/i.test(file) || file === SERIES_FACADE) continue;
    let source;
    try {
      source = readText(file);
    } catch {
      continue;
    }
    const facadeImports = (record.inspection?.imports || []).filter(
      (item) => item.importer === file && item.resolved === SERIES_FACADE
    );
    for (const item of facadeImports) {
      const localName = defaultImportName(source, item.specifier);
      if (!localName) continue;
      const usageRe = new RegExp(`<${escapeRegExp(localName)}\\b([\\s\\S]*?)>`, 'g');
      let usage;
      while ((usage = usageRe.exec(source))) {
        const configMatch = usage[1].match(/\bconfig\s*=\s*\{\s*([A-Za-z_$][\w$]*)\s*\}/);
        if (!configMatch) {
          usages.push({
            componentFile: file,
            componentName: localName,
            configIdentifier: 'GILL_SERIES',
            configSource: SERIES_CONFIG_CORE,
            implicitDefault: true,
          });
          continue;
        }
        const configIdentifier = configMatch[1];
        const binding = namedImport(source, configIdentifier);
        usages.push({
          componentFile: file,
          componentName: localName,
          configIdentifier: binding?.imported || configIdentifier,
          configSource: binding ? resolvedImport(record, file, binding.specifier) : null,
          implicitDefault: false,
        });
      }
    }
  }
  return usages;
}

function configDeclaration(source, identifier) {
  const declaration = new RegExp(
    `(?:export\\s+)?const\\s+${escapeRegExp(identifier)}(?:\\s*:\\s*[^=]+)?\\s*=\\s*defineSeriesConfig\\s*\\(`
  );
  const match = declaration.exec(source);
  if (!match) return null;
  const tail = source.slice(match.index);
  const end = tail.indexOf('\n});');
  const block = end >= 0 ? tail.slice(0, end + 4) : tail.slice(0, 12000);
  const seriesId = block.match(/\bseriesId\s*:\s*['"]([^'"]+)['"]/)?.[1] || null;
  const shape = block.match(/\bshape\s*:\s*['"](flat|book)['"]/)?.[1] || 'flat';
  return { seriesId, shape, block };
}

function declaredSeriesIds(record, readText = defaultReadText) {
  const ids = new Set();
  for (const file of record.inspection?.files || []) {
    let source;
    try {
      source = readText(file);
    } catch {
      continue;
    }
    for (const match of source.matchAll(/\bdata-gbs2-series\s*=\s*['"]([^'"]+)['"]/g)) {
      ids.add(match[1]);
    }
  }
  return ids;
}

function validateException(route, exception, fileExists = defaultFileExists) {
  const errors = [];
  const issue = (message) => errors.push(`${route}: ${message}`);
  if (!exception || typeof exception !== 'object') return [`${route}: missing series capability exception`];
  for (const field of ['seriesId', 'owner', 'approvedBy', 'approvedAt', 'reason', 'expiresWhen']) {
    if (typeof exception[field] !== 'string' || !exception[field].trim()) issue(`exception.${field} must be a non-empty string`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(exception.seriesId || '')) issue('exception.seriesId must be a stable lowercase id');
  const capabilities = exception.capabilities;
  if (!capabilities || typeof capabilities !== 'object') {
    issue('exception.capabilities must be an object');
    return errors;
  }
  for (const capability of REQUIRED_EXCEPTION_CAPABILITIES) {
    const evidence = capabilities[capability];
    if (typeof evidence !== 'string' || !evidence.trim()) {
      issue(`exception capability ${capability} requires an evidence path`);
    } else if (!fileExists(evidence)) {
      issue(`exception capability ${capability} references missing evidence ${evidence}`);
    }
  }
  const extras = Object.keys(capabilities).filter((key) => !REQUIRED_EXCEPTION_CAPABILITIES.includes(key));
  if (extras.length) issue(`exception contains unsupported capabilities: ${extras.join(', ')}`);
  return errors;
}

function validateSeriesCapabilityContract(options = {}) {
  const loaded = options.loaded || loadRouteRecords();
  const registry = options.registry || buildPublicSurfaceRegistry({ loaded });
  const records = options.records || loaded.records;
  const entries = options.entries || registry.entries;
  const readText = options.readText || defaultReadText;
  const fileExists = options.fileExists || defaultFileExists;
  const exceptions = options.exceptions || loadExceptions(readText);
  const errors = [];
  const recordByRoute = new Map(records.map((record) => [record.route, record]));
  const entryByRoute = new Map(entries.map((entry) => [entry.route, entry]));
  const governedReadingRoutes = new Set();

  for (const record of records) {
    const entry = entryByRoute.get(record.route);
    if (!entry || entry.surface !== 'series' || entry.routeRole !== 'reading') continue;
    governedReadingRoutes.add(record.route);
    const usages = facadeUsages(record, readText);
    const exception = exceptions[record.route];

    if (usages.length === 0) {
      errors.push(...validateException(record.route, exception, fileExists));
      continue;
    }
    if (exception) errors.push(`${record.route}: stale exception is forbidden after SeriesReaderChrome adoption`);
    if (usages.length !== 1) {
      errors.push(`${record.route}: expected exactly one SeriesReaderChrome usage, found ${usages.length}`);
      continue;
    }

    const usage = usages[0];
    if (!usage.configSource) {
      errors.push(`${record.route}: SeriesReaderChrome config {${usage.configIdentifier}} is not bound to a resolved import`);
      continue;
    }
    let source;
    try {
      source = readText(usage.configSource);
    } catch {
      errors.push(`${record.route}: bound series config source is unreadable: ${usage.configSource}`);
      continue;
    }
    const contract = configDeclaration(source, usage.configIdentifier);
    if (!contract) {
      errors.push(`${record.route}: ${usage.configIdentifier} in ${usage.configSource} is not declared through defineSeriesConfig(...)`);
      continue;
    }
    if (!contract.seriesId) errors.push(`${record.route}: bound defineSeriesConfig declaration has no literal seriesId`);
    if (contract.shape !== entry.seriesShape) {
      errors.push(`${record.route}: bound config shape=${contract.shape} does not match profile seriesShape=${entry.seriesShape}`);
    }
    const bodyIds = declaredSeriesIds(record, readText);
    if (bodyIds.size > 0 && contract.seriesId && !bodyIds.has(contract.seriesId)) {
      errors.push(`${record.route}: data-gbs2-series ${[...bodyIds].join(', ')} does not match bound config seriesId=${contract.seriesId}`);
    }
  }

  for (const route of Object.keys(exceptions)) {
    if (!recordByRoute.has(route)) errors.push(`${route}: exception route is absent from the effective route registry`);
    else if (!governedReadingRoutes.has(route)) errors.push(`${route}: exception is allowed only for a surface=series reading route`);
  }

  return {
    errors,
    governedReadingRoutes: [...governedReadingRoutes].sort(),
    exceptionRoutes: Object.keys(exceptions).sort(),
  };
}

function syntheticRecord({ route, source, files, imports, surface = 'series', shape = 'flat' }) {
  return {
    route,
    profile: { surface, seriesShape: shape, routeType: 'series-article' },
    owner: { status: 'production-dist' },
    sourceRel: source,
    inspection: { files, imports },
  };
}

function runSeriesCapabilityMutationSuite() {
  const failures = [];
  const check = (name, predicate) => {
    try {
      if (!predicate()) failures.push(name);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    }
  };
  const facadeSpecifier = '@/components/article-pilots/_shared/series/SeriesReaderChrome.astro';
  const configSpecifier = '@/components/article-pilots/_shared/series/seriesConfig';
  const bookSpecifier = '@/series/bookSeriesConfig';
  const markerSpecifier = '@/components/article-pilots/_shared/series/hardTextsSeriesConfig';
  const fileMap = new Map([
    [SERIES_CONFIG_CORE, "export const GILL_SERIES: SeriesConfig = defineSeriesConfig({ seriesId: 'dzhon-gill', items, pages });"],
    ['src/config/bookSeriesConfig.ts', "export const BOOK_CFG: SeriesConfig = defineSeriesConfig({ seriesId: 'book-demo', shape: 'book', items, pages });"],
    ['src/config/marker.ts', "export const MARKER: SeriesConfig = defineSeriesConfig({ seriesId: 'hard-texts', shape: 'book', items, pages });"],
  ]);
  const readText = (file) => {
    if (!fileMap.has(file)) throw new Error(`missing synthetic file ${file}`);
    return fileMap.get(file);
  };
  const fileExists = (file) => fileMap.has(String(file).split('#', 1)[0]);
  const entry = (route, shape = 'flat') => ({ route, surface: 'series', seriesShape: shape, routeRole: 'reading' });
  const validate = (record, routeEntry, exceptions = {}) => validateSeriesCapabilityContract({
    loaded: { records: [record] },
    registry: { entries: [routeEntry] },
    records: [record],
    entries: [routeEntry],
    exceptions,
    readText,
    fileExists,
  }).errors;

  {
    const source = 'src/pages/flat.astro';
    fileMap.set(source, `import SeriesReaderChrome from '${facadeSpecifier}';\n<body data-gbs2-series="dzhon-gill"><SeriesReaderChrome pageId="part1"></SeriesReaderChrome></body>`);
    const record = syntheticRecord({
      route: '/flat/', source, files: [source],
      imports: [{ importer: source, specifier: facadeSpecifier, resolved: SERIES_FACADE }],
    });
    check('valid default flat façade passes', () => validate(record, entry('/flat/')).length === 0);
  }

  {
    const source = 'src/pages/private.astro';
    fileMap.set(source, '<body>private series</body>');
    const record = syntheticRecord({ route: '/private/', source, files: [source], imports: [] });
    check('new private reading series fails without exception', () => validate(record, entry('/private/')).some((error) => error.includes('missing series capability exception')));
  }

  {
    const source = 'src/pages/book-marker.astro';
    fileMap.set(source, `import SeriesReaderChrome from '${facadeSpecifier}';\nimport { GILL_SERIES } from '${configSpecifier}';\nimport { MARKER } from '${markerSpecifier}';\n<body data-gbs2-series="dzhon-gill"><SeriesReaderChrome pageId="x" config={GILL_SERIES}></SeriesReaderChrome></body>`);
    const record = syntheticRecord({
      route: '/book-marker/', source, files: [source, SERIES_CONFIG_CORE, 'src/config/marker.ts'], shape: 'book',
      imports: [
        { importer: source, specifier: facadeSpecifier, resolved: SERIES_FACADE },
        { importer: source, specifier: configSpecifier, resolved: SERIES_CONFIG_CORE },
        { importer: source, specifier: markerSpecifier, resolved: 'src/config/marker.ts' },
      ],
    });
    check('unrelated book-config marker cannot satisfy bound config', () => validate(record, entry('/book-marker/', 'book')).some((error) => error.includes('bound config shape=flat')));
  }

  {
    const source = 'src/pages/book-valid.astro';
    fileMap.set(source, `import SeriesReaderChrome from '${facadeSpecifier}';\nimport { BOOK_CFG } from '${bookSpecifier}';\n<body data-gbs2-series="book-demo"><SeriesReaderChrome pageId="x" config={BOOK_CFG}></SeriesReaderChrome></body>`);
    const record = syntheticRecord({
      route: '/book-valid/', source, files: [source, 'src/config/bookSeriesConfig.ts'], shape: 'book',
      imports: [
        { importer: source, specifier: facadeSpecifier, resolved: SERIES_FACADE },
        { importer: source, specifier: bookSpecifier, resolved: 'src/config/bookSeriesConfig.ts' },
      ],
    });
    check('generic defineSeriesConfig book passes', () => validate(record, entry('/book-valid/', 'book')).length === 0);
  }

  {
    const source = 'src/pages/exception.astro';
    fileMap.set(source, '<body>native</body>');
    fileMap.set('evidence.md', 'evidence');
    const record = syntheticRecord({ route: '/exception/', source, files: [source], imports: [] });
    const exception = {
      seriesId: 'native', owner: 'owner', approvedBy: 'owner', approvedAt: '2026-07-25',
      reason: 'legacy native', expiresWhen: 'shared façade adopted',
      capabilities: Object.fromEntries(REQUIRED_EXCEPTION_CAPABILITIES.map((key) => [key, 'evidence.md'])),
    };
    delete exception.capabilities.print;
    check('exception missing one capability fails', () => validate(record, entry('/exception/'), { '/exception/': exception }).some((error) => error.includes('capability print')));
  }

  return failures;
}

module.exports = {
  REQUIRED_EXCEPTION_CAPABILITIES,
  configDeclaration,
  facadeUsages,
  loadExceptions,
  runSeriesCapabilityMutationSuite,
  validateSeriesCapabilityContract,
};
