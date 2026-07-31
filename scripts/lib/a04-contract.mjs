/** Shared A04 source ownership and browser environment contract. */
import { createServer } from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIST = join(ROOT, 'dist');
export const REPORT = join(ROOT, 'reports', 'route-semantics-browser.json');
export const SNAPSHOT = Object.freeze({
  contract: 'A04-bible-glossary-unification',
  schemaVersion: 3,
  path: 'reports/salvage/A04-bible-glossary-ownership.json',
});
export const DESKTOP = Object.freeze({ width: 1280, height: 900 });
export const MOBILE = Object.freeze({ width: 390, height: 844 });
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2',
};
export const SURFACES = Object.freeze([
  Object.freeze({
    id: 'bible-reference', trigger: '.bref[data-ref]', tip: '.btip', exception: null,
    activation: 'desktop-focus-click/mobile-touch', mobileSheet: false,
    owner: 'data/bible/books.json + strict Bible reference contract + SiteUtils.makeTooltipController',
    decision: 'KEEP_CURRENT',
  }),
  Object.freeze({
    id: 'glossary-term', trigger: '.gterm', tip: '.gtip', exception: '.quiz-wrapper',
    activation: 'desktop-focus-click/mobile-touch', mobileSheet: true,
    owner: 'canonical glossary registry + glossary placement policy + SiteUtils.makeTooltipController',
    decision: 'KEEP_CURRENT',
  }),
  Object.freeze({
    id: 'footnote', trigger: '.fn-marker', tip: '.tooltip', exception: '.map-trigger',
    activation: 'desktop-focus-click/mobile-touch', mobileSheet: true,
    owner: 'authored static footnote + SiteUtils.makeTooltipController',
    decision: 'KEEP_CURRENT',
  }),
]);
export const LEGACY = Object.freeze([
  Object.freeze({ id: 'legacy-verse', trigger: '.gbx-verse', tip: '.gbx-verse-tip', decision: 'DELETE_DEAD_RUNTIME' }),
  Object.freeze({ id: 'legacy-original-word', trigger: '.gbx-ow', tip: '.gbx-ow-card', decision: 'DELETE_DEAD_RUNTIME_KEEP_DATA' }),
]);
export const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';
export const results = [];
export const record = (route, viewport, contract, ok, detail = '') => results.push({
  route, viewport, contract, ok: Boolean(ok), detail: String(detail || ''),
});

function routeFile(pathname) {
  const clean = decodeURIComponent(pathname.split('?')[0]).replace(/^\/+/, '');
  return join(DIST, clean, clean.endsWith('.html') ? '' : 'index.html');
}

export async function launchBrowser() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicit && existsSync(explicit)) return chromium.launch({ executablePath: explicit });
  return chromium.launch();
}

export async function serve() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      let file = pathname.includes('.') && !pathname.endsWith('/')
        ? join(DIST, pathname.replace(/^\/+/, ''))
        : routeFile(pathname);
      try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch {}
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

export async function configureContext(context, base) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (!url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:')) return route.abort();
    if (['image', 'media', 'font'].includes(request.resourceType())) return route.abort();
    return route.continue();
  });
}

export async function loadSourceContract() {
  const booksDocument = JSON.parse(await readFile(join(ROOT, 'data', 'bible', 'books.json'), 'utf8'));
  const books = Object.entries(booksDocument.books || {});
  const defaults = booksDocument.defaultTranslationByTestament || {};
  const testamentCounts = books.reduce((out, [, book]) => {
    const key = String(book?.testament || 'UNKNOWN');
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
  const ownerDrift = [];
  const materializedBooks = [];
  const registryOnlyBooks = [];
  for (const [id, book] of books) {
    const testament = String(book?.testament || 'UNKNOWN');
    const expectedTranslation = defaults[testament] || null;
    const file = typeof book?.file === 'string' ? book.file : '';
    if (!expectedTranslation || !file.startsWith(`${expectedTranslation}/`)) {
      ownerDrift.push(`${id}:${testament}:${file || '<missing>'}:${expectedTranslation || '<no-default>'}`);
    }
    if (file && existsSync(join(ROOT, 'data', 'bible', file))) materializedBooks.push(id);
    else registryOnlyBooks.push(id);
  }

  const originalWordsDocument = JSON.parse(await readFile(join(ROOT, 'data', 'original-words.json'), 'utf8'));
  const metadataKeys = Object.keys(originalWordsDocument).filter((key) => key.startsWith('_'));
  const entries = Object.entries(originalWordsDocument)
    .filter(([key, value]) => !key.startsWith('_') && value && typeof value === 'object' && !Array.isArray(value));
  const issues = [];
  for (const [key, value] of entries) {
    if (!['he', 'el'].includes(value.lang)) issues.push(`${key}:lang=${value.lang || '<missing>'}`);
    for (const field of ['original', 'transliteration', 'gloss', 'definition', 'source']) {
      if (typeof value[field] !== 'string' || !value[field].trim()) issues.push(`${key}:${field}=missing`);
      else if (/<[a-z][^>]*>/i.test(value[field])) issues.push(`${key}:${field}=html`);
    }
  }
  const firstClassGaps = Object.freeze(['lemma', 'morphology', 'verseLink']);
  const entriesWithAllFirstClassFields = entries.filter(([, value]) => firstClassGaps.every((field) => (
    typeof value[field] === 'string' && value[field].trim()
  ))).length;

  return {
    bibleRegistry: {
      path: 'data/bible/books.json', version: booksDocument.version ?? null,
      bookCount: books.length, testamentCounts,
      defaultTranslationByTestament: defaults,
      translations: booksDocument.translations || {}, ownerDrift,
      materializedBookCount: materializedBooks.length,
      registryOnlyBookCount: registryOnlyBooks.length,
      materializedBooks, registryOnlyBooks,
      completenessPolicy: 'partial-materialization-is-explicit; strict resolver blocks unresolved public references',
    },
    originalWords: {
      path: 'data/original-words.json', entryCount: entries.length, metadataKeys, issues,
      status: 'data-only', uiOwner: null, firstClassGaps,
      entriesWithAllFirstClassFields,
    },
    legacyVerses: {
      path: 'data/verses.json', exists: existsSync(join(ROOT, 'data', 'verses.json')),
      status: 'superseded-flat-dataset',
    },
  };
}
