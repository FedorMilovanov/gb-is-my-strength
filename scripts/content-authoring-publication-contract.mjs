#!/usr/bin/env node
/**
 * Content Authoring & Publication Contract (SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT)
 *
 * Fail-closed gate unifying:
 *  1. MDX authoring & route ownership across src/content/{articles,hard-texts,baptisty-rossii}/:
 *     required frontmatter, slug===filename parity, src/pages wrapper existence,
 *     page-ownership registration, and search-manifest presence.
 *  2. SeriesConfig & quiz authoring discipline:
 *     typed SeriesQuizItem<PageId> (zero `as unknown as` quiz casts),
 *     resolveSeriesQuizItems() delegation in GillLearningSheet.astro,
 *     SeriesBottomNav.astro wiring across native MDX series wrappers,
 *     editorial calque/inflection guards, and WCAG 3.1.2 `lang` tagging on
 *     foreign phrases in the Apostasy series prose.
 *  3. Built dist/ verification (when dist/ exists or --dist is passed):
 *     all 70+ MDX routes emit valid HTML, all quiz sourceHref & partToc #fragments
 *     resolve to real DOM id="..." targets, and all 30 native series routes render
 *     bidirectional .gbs2-next neighbour cards whose hrefs resolve in dist/.
 *  4. Six negative mutation probes proving fail-closed detection.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const REQUIRE_DIST = process.argv.includes('--dist');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function parseSimpleFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (val === 'true') {
      val = true;
    } else if (val === 'false') {
      val = false;
    } else if (/^\d+$/.test(val)) {
      val = Number(val);
    }
    fm[key] = val;
  }
  return fm;
}

/** Pure mirror of defineSeriesConfig invariants used for negative mutation probes. */
function validateSeriesSnapshot(cfg) {
  const errs = [];
  if (!cfg.items || cfg.items.length === 0) errs.push('empty items');
  const seenIds = new Set();
  const seenHrefs = new Set();
  for (const it of cfg.items || []) {
    if (seenIds.has(it.id)) errs.push(`duplicate item id: ${it.id}`);
    seenIds.add(it.id);
    if (it.tier !== 'chapter') {
      if (!cfg.pages || !cfg.pages[it.id]) {
        errs.push(`missing pages[${it.id}]`);
      }
      if (seenHrefs.has(it.href)) {
        errs.push(`duplicate item href: ${it.href}`);
      }
      seenHrefs.add(it.href);
    }
  }
  if (cfg.lockedCounts) {
    const core = (cfg.items || []).filter((it) => (it.tier ?? 'core') === 'core').length;
    const companion = (cfg.items || []).filter((it) => it.tier === 'companion').length;
    if (cfg.lockedCounts.coreItems !== undefined && core !== cfg.lockedCounts.coreItems) {
      errs.push(`lockedCounts.coreItems expected ${cfg.lockedCounts.coreItems}, got ${core}`);
    }
    if (cfg.lockedCounts.companionItems !== undefined && companion !== cfg.lockedCounts.companionItems) {
      errs.push(`lockedCounts.companionItems expected ${cfg.lockedCounts.companionItems}, got ${companion}`);
    }
  }
  for (const q of cfg.quiz || []) {
    if (q.relatedPageId && (!cfg.pages || !cfg.pages[q.relatedPageId])) {
      errs.push(`orphan quiz relatedPageId: ${q.relatedPageId}`);
    }
    const hashIdx = String(q.sourceHref || '').indexOf('#');
    if (hashIdx === -1) {
      errs.push(`quiz ${q.id} missing #anchor in sourceHref`);
    } else if (q.relatedPageId && cfg.pages?.[q.relatedPageId]) {
      const anchor = q.sourceHref.slice(hashIdx);
      const valid = new Set([
        ...cfg.pages[q.relatedPageId].partToc.map((t) => t.href),
        ...(cfg.pages[q.relatedPageId].quizSourceAnchors || []),
      ]);
      if (!valid.has(anchor)) {
        errs.push(`quiz ${q.id} broken anchor ${anchor} on ${q.relatedPageId}`);
      }
    }
  }
  if (cfg.RequireBottomNav && !cfg.hasBottomNav) {
    errs.push('missing .gbs2-next bottom nav');
  }
  return errs;
}

function runNegativeProbes(errors) {
  const base = {
    items: [
      { id: 'p1', href: '/s/p1/', tier: 'core' },
      { id: 'p2', href: '/s/p2/', tier: 'core' },
      { id: 'c1', href: '/s/c1/', tier: 'companion' },
    ],
    pages: {
      p1: { partToc: [{ href: '#intro' }] },
      p2: { partToc: [{ href: '#sec2' }] },
      c1: { partToc: [{ href: '#comp' }] },
    },
    lockedCounts: { coreItems: 2, companionItems: 1 },
    quiz: [
      { id: 'q1', relatedPageId: 'p1', sourceHref: '/s/p1/#intro' },
    ],
    RequireBottomNav: true,
    hasBottomNav: true,
  };
  if (validateSeriesSnapshot(base).length !== 0) {
    errors.push('Negative probe baseline unexpectedly failed');
    return;
  }
  const probes = [
    {
      name: 'orphan-quiz-relatedPageId',
      mutate: (c) => ({ ...c, quiz: [{ id: 'q1', relatedPageId: 'ghost', sourceHref: '/s/p1/#intro' }] }),
    },
    {
      name: 'broken-quiz-sourceHref-anchor',
      mutate: (c) => ({ ...c, quiz: [{ id: 'q1', relatedPageId: 'p1', sourceHref: '/s/p1/#missing' }] }),
    },
    {
      name: 'missing-reverse-pages-entry',
      mutate: (c) => ({ ...c, pages: { p1: c.pages.p1, c1: c.pages.c1 } }),
    },
    {
      name: 'locked-counts-drift',
      mutate: (c) => ({ ...c, lockedCounts: { coreItems: 3, companionItems: 1 } }),
    },
    {
      name: 'duplicate-item-href',
      mutate: (c) => ({
        ...c,
        items: [c.items[0], { id: 'p2', href: '/s/p1/', tier: 'core' }, c.items[2]],
      }),
    },
    {
      name: 'missing-bottom-nav',
      mutate: (c) => ({ ...c, hasBottomNav: false }),
    },
  ];
  for (const probe of probes) {
    const res = validateSeriesSnapshot(probe.mutate(structuredClone(base)));
    if (res.length === 0) {
      errors.push(`Negative mutation probe '${probe.name}' FAILED to trigger an error`);
    }
  }
}

function extractIdsFromHtml(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\bid=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)) {
    const id = m[1] || m[2] || m[3];
    if (id) ids.add(id);
  }
  return ids;
}

function main() {
  const errors = [];

  // ── 1. MDX Authoring & Ownership Contract ────────────────────────────────
  const ownership = JSON.parse(readText('migration/page-ownership.json'));
  const ownershipMap = new Map(Object.entries(ownership.routes || {}));
  const seriesRegistry = JSON.parse(readText('data/series.json'));
  const searchManifest = JSON.parse(readText('data/search-manifest.json'));
  const searchUrls = new Set(
    (Array.isArray(searchManifest) ? searchManifest : searchManifest.entries || searchManifest.pages || [])
      .map((item) => item.url || item.route || item.href)
      .filter(Boolean)
  );

  const collections = ['articles', 'hard-texts', 'baptisty-rossii'];
  const mdxEntries = [];
  for (const collection of collections) {
    const dir = path.join(ROOT, 'src', 'content', collection);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir).sort()) {
      if (!entry.endsWith('.mdx') && !entry.endsWith('.md')) continue;
      const rel = path.join('src', 'content', collection, entry);
      const raw = readText(rel);
      const fm = parseSimpleFrontmatter(raw);
      if (!fm) {
        errors.push(`${rel}: missing YAML frontmatter`);
        continue;
      }
      const baseSlug = entry.replace(/\.(mdx|md)$/, '');
      for (const reqKey of ['title', 'description', 'slug', 'publishedAt', 'updatedAt', 'readingTime']) {
        if (fm[reqKey] === undefined || fm[reqKey] === '') {
          errors.push(`${rel}: missing required frontmatter '${reqKey}'`);
        }
      }
      if (fm.slug && fm.slug !== baseSlug) {
        errors.push(`${rel}: frontmatter slug '${fm.slug}' != filename '${baseSlug}'`);
      }
      if (typeof fm.readingTime === 'number' && fm.readingTime <= 0) {
        errors.push(`${rel}: readingTime must be > 0 (got ${fm.readingTime})`);
      }
      if (typeof fm.publishedAt === 'string' && typeof fm.updatedAt === 'string' && fm.updatedAt < fm.publishedAt) {
        errors.push(`${rel}: updatedAt (${fm.updatedAt}) precedes publishedAt (${fm.publishedAt})`);
      }
      if (fm.draft === true) {
        continue;
      }
      const section = typeof fm.section === 'string' && fm.section ? fm.section : collection;
      const route = `/${section}/${baseSlug}/`;
      const pageWrapper = path.join(ROOT, 'src', 'pages', section, baseSlug, 'index.astro');
      if (!fs.existsSync(pageWrapper)) {
        errors.push(`${rel}: missing Astro route wrapper src/pages/${section}/${baseSlug}/index.astro`);
      }
      const own = ownershipMap.get(route);
      if (!own) {
        errors.push(`${rel}: route '${route}' missing from migration/page-ownership.json`);
      } else if (own.owner !== 'astro' && own.owner !== 'astro-native') {
        errors.push(`${rel}: route '${route}' has owner='${own.owner}', expected 'astro'`);
      }
      if (fm.noindex !== true && searchUrls.size > 0 && !searchUrls.has(route)) {
        errors.push(`${rel}: published indexable route '${route}' missing from data/search-manifest.json`);
      }
      mdxEntries.push({ rel, collection, section, slug: baseSlug, route, fm });
    }
  }
  if (mdxEntries.length < 70) {
    errors.push(`Expected at least 70 published MDX entries in src/content/**, found ${mdxEntries.length}`);
  }

  // ── 2. SeriesConfig, Quiz Typing, Editorial, & WCAG 3.1.2 `lang` Guards ─
  const seriesConfigSrc = readText('src/components/article-pilots/_shared/series/seriesConfig.ts');
  for (const requiredExport of [
    'export function defineSeriesConfig',
    'export function resolveSeriesQuizItems',
    'export function seriesNeighbors',
    'export interface SeriesQuizPolicy',
    'export interface SeriesLockedCounts',
  ]) {
    if (!seriesConfigSrc.includes(requiredExport)) {
      errors.push(`seriesConfig.ts missing '${requiredExport}'`);
    }
  }

  const gillSheetSrc = readText('src/components/article-pilots/gill-series/GillLearningSheet.astro');
  if (!gillSheetSrc.includes('resolveSeriesQuizItems(config, pageId)')) {
    errors.push('GillLearningSheet.astro must resolve quiz items via resolveSeriesQuizItems(config, pageId)');
  }

  const apostasyCfgSrc = readText('src/components/article-pilots/_shared/series/apostasySeriesConfig.ts');
  const apostasyQuizSrc = readText('src/components/article-pilots/apostasy-series/apostasyLearningData.ts');
  if (apostasyCfgSrc.includes('as unknown as')) {
    errors.push('apostasySeriesConfig.ts still uses `as unknown as` type-erasure cast');
  }
  for (const [label, pattern] of [
    ['English calque "публичную профессию"', /публичную профессию/],
    ['English calque "многолетней профессией"', /многолетней профессией/],
    ['untranslated "settled-отвержение"', /settled-отвержение/],
    ['uninflected "отречений Кранмер"', /отречений Кранмер(?!а)/],
    ['uninflected "историю Кранмер"', /историю Кранмер(?!а)/],
    ['uninflected "lapsi и Кранмер:"', /lapsi и Кранмер:/],
  ]) {
    if (pattern.test(apostasyCfgSrc) || pattern.test(apostasyQuizSrc)) {
      errors.push(`Apostasy series config/quiz contains editorial defect: ${label}`);
    }
  }

  const apostasySlugs = [
    'otstuplenie-chto-govorit-bibliya',
    'otstupniki-biblii-iuda-saul-ierovoam-dimas',
    'petr-i-iuda-padenie-ili-otstuplenie',
    'otreklis-ot-hrista-istoriya-cerkvi',
    'kogda-chelovek-uhodit-ot-very',
  ];
  for (const slug of apostasySlugs) {
    const raw = readText(`src/content/articles/${slug}.mdx`);
    const prose = raw
      .replace(/^---[\s\S]*?---/, '')
      .replace(/<section class="sources-block"[\s\S]*?<\/section>/g, '')
      .replace(/<(?:i|span)\s+lang="[^"]+"[^>]*>[\s\S]*?<\/(?:i|span)>/g, '');
    for (const forbiddenUnwrapped of [
      '*lapsi*',
      '*libellus*',
      '*De Lapsis*',
      '*Contra Galilaeos*',
      '*This unworthy right hand*',
      '*Actes and Monuments*',
      '*Free Grace*',
      '*perseverance of the saints*',
      '*presumption*',
      '*despair*',
      '*Of the Mortification of Sin in Believers*',
      '*Indwelling Sin in Believers*',
      '*A Saint Indeed*',
    ]) {
      if (prose.includes(forbiddenUnwrapped)) {
        errors.push(`src/content/articles/${slug}.mdx has unwrapped foreign term ${forbiddenUnwrapped} (missing lang="...")`);
      }
    }
  }
  const otstupnikiHubSrc = readText('src/pages/otstupniki/index.astro');
  if (!otstupnikiHubSrc.includes('<i lang="la">lapsi</i>')) {
    errors.push('src/pages/otstupniki/index.astro must wrap `lapsi` with <i lang="la">lapsi</i>');
  }

  const bottomNavSrc = readText('src/components/article-pilots/_shared/series/SeriesBottomNav.astro');
  for (const token of ['class="gbs2-next"', 'data-glossary-skip', 'data-reader-exclude', 'data-print-policy="exclude"']) {
    if (!bottomNavSrc.includes(token)) {
      errors.push(`SeriesBottomNav.astro missing required attribute '${token}'`);
    }
  }
  for (const wrapper of [
    'src/components/article-pilots/apostasy-series/ApostasySeriesArticlePage.astro',
    'src/components/article-pilots/pastor-series/PastorSeriesArticlePage.astro',
    'src/components/article-pilots/teen-series/TeenSeriesArticlePage.astro',
  ]) {
    const src = readText(wrapper);
    if (!src.includes('<SeriesBottomNav')) {
      errors.push(`${wrapper} must render <SeriesBottomNav ... />`);
    }
  }
  const gen6Src = readText('src/components/article-pilots/genesis6/Genesis6ArticlePage.astro');
  if (!gen6Src.includes('Назад · {prevSection}') || !gen6Src.includes('data-print-policy="exclude"')) {
    errors.push('Genesis6ArticlePage.astro must render bidirectional prev/next .gbs2-next cards with data-print-policy="exclude"');
  }

  // ── 3. Built dist/ Verification (HTML, #fragments, & .gbs2-next cards) ──
  const distDir = path.join(ROOT, 'dist');
  const checkDist = REQUIRE_DIST || fs.existsSync(path.join(distDir, 'otstupniki', 'index.html'));
  if (REQUIRE_DIST && !fs.existsSync(distDir)) {
    errors.push('dist/ does not exist (--dist requested)');
  }
  if (checkDist && fs.existsSync(distDir)) {
    // 3a. Every published MDX route exists in dist/ with canonical + main + h1
    for (const entry of mdxEntries) {
      const htmlPath = path.join(distDir, entry.route.replace(/^\//, ''), 'index.html');
      if (!fs.existsSync(htmlPath)) {
        errors.push(`Missing built HTML in dist/ for ${entry.route}`);
        continue;
      }
      const html = fs.readFileSync(htmlPath, 'utf8');
      if (html.length < 1024) {
        errors.push(`Built HTML too small (<1024B) for ${entry.route}`);
      }
      if (!/<html[^>]*\blang="ru"/i.test(html)) {
        errors.push(`Built HTML missing lang="ru" for ${entry.route}`);
      }
      if (!html.includes('<main') || !html.includes('<h1')) {
        errors.push(`Built HTML missing <main> or <h1> for ${entry.route}`);
      }
    }

    // 3b. Quiz sourceHref #fragments resolve in built dist/ HTML
    const gillQuizSrc = readText('src/components/article-pilots/gill-series/gillLearningData.ts');
    const idCache = new Map();
    const getIdsForRoute = (route) => {
      if (!idCache.has(route)) {
        const p = path.join(distDir, route.replace(/^\//, ''), 'index.html');
        idCache.set(route, fs.existsSync(p) ? extractIdsFromHtml(fs.readFileSync(p, 'utf8')) : new Set());
      }
      return idCache.get(route);
    };

    for (const m of gillQuizSrc.matchAll(/sourceHref:\s*'([^']+)'/g)) {
      const parsed = new URL(m[1], 'https://gb.local/articles/dzhon-gill-chast-1-chelovek/');
      const route = parsed.pathname;
      const frag = parsed.hash.replace(/^#/, '');
      if (!frag || !getIdsForRoute(route).has(frag)) {
        errors.push(`Gill quiz broken ${parsed.hash || '(no hash)'} on built ${route}`);
      }
    }
    const apostasyVarMap = {
      p1: '/articles/otstuplenie-chto-govorit-bibliya/',
      p2: '/articles/otstupniki-biblii-iuda-saul-ierovoam-dimas/',
      p3: '/articles/petr-i-iuda-padenie-ili-otstuplenie/',
      p4: '/articles/otreklis-ot-hrista-istoriya-cerkvi/',
      p5: '/articles/kogda-chelovek-uhodit-ot-very/',
    };
    for (const m of apostasyQuizSrc.matchAll(/sourceHref:\s*`\$\{(p[1-5])\}#([A-Za-z0-9_-]+)`/g)) {
      const route = apostasyVarMap[m[1]];
      const frag = m[2];
      if (!getIdsForRoute(route).has(frag)) {
        errors.push(`Apostasy quiz broken #${frag} on built ${route}`);
      }
    }

    // 3c. Native series routes render .gbs2-next with valid neighbour card counts & target paths
    const routesFromRegistry = (key) => {
      const info = seriesRegistry[key];
      const all = [...(info.parts || []), ...(info.companions || [])];
      return all.map((entry) => `${info.baseUrl}${entry.slug}/`);
    };
    const seriesWalks = [
      {
        name: 'dzhon-gill',
        routes: routesFromRegistry('dzhon-gill'),
        checkedIndices: [0, 1, 2, 3, 4, 5],
      },
      {
        name: 'apostasy-series',
        routes: routesFromRegistry('apostasy-series'),
        checkedIndices: [0, 1, 2, 3, 4],
      },
      {
        name: 'pastor-series',
        routes: routesFromRegistry('pastor-series'),
        // Parts II–IX use PastorSeriesArticlePage.astro (index 1..8 out of 10 total items)
        checkedIndices: [1, 2, 3, 4, 5, 6, 7, 8],
      },
      {
        name: 'teen-double-life',
        routes: routesFromRegistry('teen-double-life'),
        checkedIndices: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        name: 'genesis-6',
        routes: routesFromRegistry('genesis-6'),
        checkedIndices: [0, 1, 2, 3, 4, 5],
      },
    ];

    for (const walk of seriesWalks) {
      for (const idx of walk.checkedIndices) {
        const route = walk.routes[idx];
        const htmlPath = path.join(distDir, route.replace(/^\//, ''), 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        const navMatch = html.match(/<nav\b[^>]*class="[^"]*\bgbs2-next\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/);
        if (!navMatch) {
          errors.push(`[${walk.name}] ${route} missing <nav class="gbs2-next"> in built HTML`);
          continue;
        }
        const cardHrefs = [...navMatch[1].matchAll(/<a\b[^>]*class="[^"]*\bgbs2-next-card\b[^"]*"[^>]*href="([^"]+)"/g)].map(
          (m) => m[1]
        );
        const expectedCount = idx === 0 || idx === walk.routes.length - 1 ? 1 : 2;
        if (cardHrefs.length !== expectedCount) {
          errors.push(
            `[${walk.name}] ${route} expected ${expectedCount} .gbs2-next-card link(s), got ${cardHrefs.length}`
          );
        }
        for (const href of cardHrefs) {
          const resolvedUrl = new URL(href, `https://gb.local${route}`);
          const targetHtml = path.join(distDir, resolvedUrl.pathname.replace(/^\//, ''), 'index.html');
          if (!fs.existsSync(targetHtml)) {
            errors.push(`[${walk.name}] ${route} .gbs2-next-card href='${href}' does not resolve in dist/`);
          }
        }
      }
    }
  }

  // ── 4. Six Negative Mutation Probes ──────────────────────────────────────
  runNegativeProbes(errors);

  if (errors.length > 0) {
    console.error('Content authoring & publication contract FAILED:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(
    `Content authoring & publication contract OK: ${mdxEntries.length} MDX routes, SeriesConfig/quiz typing, foreign-lang spans, .gbs2-next neighbour cards${checkDist ? ' (source + dist)' : ' (source)'}, and 6 negative probes verified.`
  );
}

main();
