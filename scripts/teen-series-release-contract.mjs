#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readImageDimensions } = require('./lib/sitemap-image-projection');

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const RELEASE_DATE = '2026-09-10T00:00:00+03:00';
const LANDING = '/podrostok-za-kadrom/';
const SERIES_KEY = 'teen-double-life';
const ADULT_KEY = 'adult-children-family';
const SERIES_OG = '/images/teen-series/series-cover.webp';
const SERIES_RAIL = '/images/teen-series/series-cover-600w.webp';
const ITEMS = [
  ['I', 'teen-double-life', 'podrostok-za-kadrom-dvoynaya-zhizn', 32, 0, '01-double-life.webp'],
  ['II', 'teen-parents-after-disclosure', 'podrostok-za-kadrom-roditelyam-posle-razoblacheniya', 43, 32, '02-after-disclosure.webp'],
  ['III', 'teen-church-response', 'podrostok-za-kadrom-chto-delat-tserkvi', 39, 75, '03-church-response.webp'],
  ['ОСНОВА', 'adult-child-authority', 'sovershennoletie-roditelskaya-vlast-chto-menyaetsya', 35, 0, '06-adult-authority.webp'],
  ['ДОМ', 'adult-child-home-money', 'vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya', 36, 0, '05-home-money.webp'],
  ['УХОД', 'adult-child-left-home', 'vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie', 37, 0, '04-left-home.webp'],
  ['БРАК', 'adult-daughter-marriage', 'vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti', 42, 0, '07-daughter-marriage.webp'],
];
const GROUPS = [
  { key: SERIES_KEY, configName: 'TEEN_DOUBLE_LIFE_SERIES', rows: ITEMS.slice(0, 3), kind: 'roman', total: 114 },
  { key: ADULT_KEY, configName: 'ADULT_CHILDREN_SERIES', rows: ITEMS.slice(3), kind: 'label' },
];
const railFor = (heroFile) => heroFile.replace(/\.webp$/, '-600w.webp');

const errors = [];
const fail = (message) => errors.push(message);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const routeFile = (route) => path.join(DIST, route.replace(/^\//, ''), 'index.html');
const meta = (html, key) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i'))?.[1] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
};
const canonical = (html) => {
  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    if (!/\brel=["']canonical["']/i.test(match[1])) continue;
    return match[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
};

const frontmatterScalar = (source, key) => {
  const block = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/u)?.[1] || '';
  const raw = block.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'))?.[1]?.trim() || '';
  return raw.replace(/^["']|["']$/g, '');
};
const ownership = readJson('migration/page-ownership.json');
const series = readJson('data/series.json');
const publishedAnchorBaseline = readJson('data/teen-series-anchor-baseline.json');
const config = read('src/components/article-pilots/_shared/series/teenSeriesConfig.ts');
const mediaSource = read('src/components/article-pilots/_shared/series/teenSeriesMedia.ts');
const mediaAltFor = (pageId) => {
  const start = mediaSource.indexOf(`'${pageId}': {`);
  if (start < 0) return '';
  const end = mediaSource.indexOf('\n    },', start);
  const block = end < 0 ? mediaSource.slice(start) : mediaSource.slice(start, end);
  return block.match(/\balt:\s*'([^']+)'/u)?.[1] || '';
};
// Reader anchors may be attached to spans after editorial H2/H3 consolidation;
// never treat a valid span id as a missing destination.
const teenTocAnchorsFor = (pageId) => {
  const pagesStart = config.indexOf('  pages: {', config.indexOf('export const TEEN_DOUBLE_LIFE_SERIES'));
  const pageStart = config.indexOf("'" + pageId + "': {", pagesStart);
  const pageEnd = config.indexOf('\n    },', pageStart);
  if (pagesStart < 0 || pageStart < 0 || pageEnd < 0) return null;
  const tocName = config.slice(pageStart, pageEnd).match(/\bpartToc:\s*(\w+)/)?.[1];
  if (!tocName) return null;
  const tocStart = config.indexOf('const ' + tocName + ' = toc(');
  const tocEnd = config.indexOf('\n);', tocStart);
  if (tocStart < 0 || tocEnd < 0) return null;
  return [...config.slice(tocStart, tocEnd).matchAll(/\bhref:\s*'#([^']+)'/g)].map((x) => x[1]);
};
const siteData = read('src/data/site.ts');
const wrapper = read('src/components/article-pilots/teen-series/TeenSeriesArticlePage.astro');
const readerProjector = read('scripts/project-reader-linear-text-to-dist.mjs');
const landingSource = read('src/pages/podrostok-za-kadrom/index.astro');
const deployWorkflow = read('.github/workflows/deploy.yml');
const deployCandidateWorkflow = read('.github/workflows/deploy-candidate-contract.yml');

const mediaUrls = [
  SERIES_OG,
  SERIES_RAIL,
  ...ITEMS.flatMap(([, , , , , heroFile]) => [
    `/images/teen-series/${heroFile}`,
    `/images/teen-series/${railFor(heroFile)}`,
  ]),
];

if (!exists('src/pages/podrostok-za-kadrom/index.astro')) fail('series landing source missing');
for (const url of mediaUrls) {
  const rel = `public${url}`;
  if (!exists(rel)) {
    fail(`missing teen media asset: ${rel}`);
    continue;
  }
  const bytes = fs.readFileSync(path.join(ROOT, rel));
  if (bytes.length < 16 || bytes.subarray(0, 4).toString('ascii') !== 'RIFF' || bytes.subarray(8, 12).toString('ascii') !== 'WEBP') {
    fail(`${rel}: expected valid WebP container`);
  }
  const isRail = url.endsWith('-600w.webp');
  const budget = isRail ? 48 * 1024 : 128 * 1024;
  if (bytes.length > budget) fail(`${rel}: ${bytes.length} bytes exceeds ${budget}-byte media budget`);
  const dimensions = readImageDimensions(path.join(ROOT, rel));
  const expectedWidth = isRail ? 600 : 1200;
  const expectedHeight = isRail ? 315 : 630;
  if (dimensions.width !== expectedWidth || dimensions.height !== expectedHeight) {
    fail(`${rel}: ${dimensions.width}x${dimensions.height}, expected ${expectedWidth}x${expectedHeight}`);
  }
  if (!mediaSource.includes(url)) fail(`${url}: missing from teenSeriesMedia authority`);
}
const teenMediaNames = fs.readdirSync(path.join(ROOT, 'public/images/teen-series'));
const forbiddenOriginals = teenMediaNames.filter((name) => /\.(?:png|jpe?g)$/iu.test(name));
if (forbiddenOriginals.length) fail(`unoptimized teen originals leaked into public assets: ${forbiddenOriginals.join(', ')}`);
const supersededLegacy = teenMediaNames.filter((name) => /^series-hero\.(?:svg|webp)$/iu.test(name));
if (supersededLegacy.length) fail(`superseded teen series hero leaked into production assets: ${supersededLegacy.join(', ')}`);
for (const rel of ['images/teen-series/series-hero.svg', 'images/teen-series/series-hero.webp']) {
  if (exists(rel)) fail(`superseded root teen asset must stay deleted: ${rel}`);
}

if (!config.includes("seriesId: 'teen-double-life'") ||
    !config.includes("seriesId: 'adult-children-family'"))
  fail('reader configs must include separate teen/adult series IDs');
if (config.includes("coreSequence: { stepLabel: 'Шаг' }"))
  fail('forbidden forced seven-step core sequence');
if (!read('src/components/article-pilots/gill-series/GillSeriesRail.astro').includes('coreStepMeta(config, parentId)'))
  fail('shared rail no longer consumes optional typed core progress');
if (!wrapper.includes('const series = TEEN_DOUBLE_LIFE_SERIES.pages[pageId]') ||
    !wrapper.includes('ADULT_CHILDREN_SERIES.pages[pageId]') ||
    !wrapper.includes('config={series}') ||
    !wrapper.includes('data-gbs2-series={series.seriesId}'))
  fail('article wrapper must select correct series by pageId');
if (!config.includes("railBackHref: '/podrostok-za-kadrom/'") ||
    !config.includes("railBackHref: '/podrostok-za-kadrom/#adult-studies'"))
  fail('independent series landing destinations missing');
if (!config.includes('teenSeriesMediaFor')) fail('route-specific media authority missing');
if (/PREPUBLICATION_RAIL_COVER|icons\/icon-512\.png|TEEN_SERIES_RAIL_COVER/.test(config))
  fail('legacy/prepublication rail cover leaked into reader config');
for (const [, pageId] of ITEMS) {
  if (!config.includes("railCover: teenSeriesMediaFor('" + pageId + "').rail"))
    fail(pageId + ': route-specific rail cover missing');
}
if (!landingSource.includes('adultCards') || !landingSource.includes('id="adult-studies"'))
  fail('separate adult thematic landing section missing');
if (wrapper.includes('PASTOR_SERIES') || wrapper.includes('pastor-series/og-hero')) fail('pastor-series metadata leaked into teen wrapper');
if (!wrapper.includes('const media = teenSeriesMediaFor(pageId);')) fail('article wrapper media authority missing');
if (!wrapper.includes('srcset={`${media.rail} 600w, ${media.hero} 1200w`}')) fail('article responsive hero contract missing');
if (!wrapper.includes('<slot />')) fail('teen wrapper must preserve native Astro slot rendering');
if (/Astro\.slots\.render\(['"]default['"]\)|set:html|document\.querySelector\(['"]\.teen-series-prose['"]\)/u.test(wrapper)) {
  fail('teen bibliography projection must not use raw-HTML or client-side DOM rewriting');
}
if (!readerProjector.includes('projectTeenSourcesBoundary') || !readerProjector.includes('class="sources-block"') || !readerProjector.includes('data-reader-exclude') || !readerProjector.includes('data-pagefind-ignore')) {
  fail('canonical reader projector is missing teen bibliography boundary ownership');
}
if (!landingSource.includes('const ogImagePath = TEEN_SERIES_MEDIA.series.hero;')) fail('landing social image must use media authority');
if (!landingSource.includes('{cards.map((item, index) => (')) fail('landing route-specific visual cards missing');
if (!landingSource.includes('srcset={`${item.media.rail} 600w, ${item.media.hero} 1200w`}')) fail('landing cards must expose 600w/1200w responsive srcset');
if (!landingSource.includes('sizes="(max-width: 47.499rem) 100vw, 410px"')) fail('landing card responsive sizes contract missing');
if (!landingSource.includes("'@type': 'Organization'") || !landingSource.includes("'@id': SITE.orgId")) fail('landing source lacks Organization JSON-LD owner');
if (!landingSource.includes("'@type': 'WebSite'") || !landingSource.includes("'@id': SITE.websiteId")) fail('landing source lacks WebSite JSON-LD owner');
for (const [name, workflow] of [
  ['deploy', deployWorkflow],
  ['deploy-candidate', deployCandidateWorkflow],
]) {
  if (!workflow.includes('node scripts/teen-series-quality-browser-audit.mjs')) {
    fail(`${name}: Teen browser quality release gate missing`);
  }
}

const expectedSlugs = ITEMS.map(([, , slug]) => slug);
for (const group of GROUPS) {
  const registered = series[group.key];
  if (!registered) { fail('data/series.json missing ' + group.key); continue; }
  const cfgIndex = config.indexOf('export const ' + group.configName);
  const configItemStart = config.indexOf('  items: [', cfgIndex);
  const configItemEnd = config.indexOf('\n  pages: {', configItemStart);
  if (cfgIndex < 0 || configItemStart < 0 || configItemEnd < 0)
    fail(group.key + ': config item/page boundaries missing');
  const itemSource = configItemStart < 0 || configItemEnd < 0 ? '' : config.slice(configItemStart, configItemEnd);
  const foundOrder = [...itemSource.matchAll(/\bhref:\s*'\/articles\/([^/]+)\/'/g)].map((x) => x[1]);
  const expected = group.rows.map(([, , slug]) => slug);
  if (foundOrder.length !== expected.length || foundOrder.some((slug, i) => slug !== expected[i]))
    fail(group.key + ': reader item order mismatch: ' + foundOrder.join(' -> '));
  for (const [mark, pageId, slug, minutes, done] of group.rows) {
    const start = itemSource.indexOf("id: '" + pageId + "'");
    const stop = itemSource.indexOf('\n    },', start);
    const item = start < 0 || stop < 0 ? '' : itemSource.slice(start, stop);
    const expectedMark = "mark: { kind: '" + group.kind + "', value: '" + mark + "' }";
    if (!item.includes(expectedMark)) fail(slug + ': reader mark must reflect separate series');
    if (!item.includes("readingTime: '" + minutes + " мин'")) fail(slug + ': reading minutes drift');
    const pageStart = config.indexOf("'" + pageId + "': {", configItemEnd);
    const pageEnd = config.indexOf('\n    },', pageStart);
    const page = pageStart < 0 || pageEnd < 0 ? '' : config.slice(pageStart, pageEnd);
    if (!page.includes('readingProgressDoneMin: ' + done)) fail(slug + ': progress offset drift');
    if (!page.includes('readingProgressPartMin: ' + minutes)) fail(slug + ': reading minutes drift');
    const total = group.kind === 'roman' ? 'TEEN_TOTAL_MIN' : String(minutes);
    if (!page.includes('readingProgressTotalMin: ' + total))
      fail(slug + ': independent progress total missing');
  }
  const siteKey = "'" + group.key + "': [";
  const ix = siteData.indexOf(siteKey);
  const siteBody = ix >= 0 ? siteData.slice(ix + siteKey.length, siteData.indexOf(']', ix)) : '';
  const order = [...siteBody.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
  if (order.length !== expected.length || order.some((slug, i) => slug !== expected[i]))
    fail(group.key + ': src/data/site.ts SERIES_ORDER mismatch');
  if (registered.baseUrl !== '/articles/') fail(group.key + ': wrong registry baseUrl');
  if (registered.searchPolicy?.landingRoute !== LANDING) fail(group.key + ': wrong landing');
  if ((registered.parts || []).length !== group.rows.length)
    fail(group.key + ': series part count mismatch');
  group.rows.forEach(([mark, , slug, minutes], i) => {
    const entry = registered.parts?.[i];
    const n = group.kind === 'roman' ? mark : String(i + 1);
    if (!entry || String(entry.n) !== n || entry.slug !== slug ||
        entry.readingTime !== minutes || entry.status !== 'published')
      fail(group.key + ': registry/reader mismatch for ' + slug);
  });
}
if (new Set(expectedSlugs).size !== 7)
  fail('seven canonical source article routes must remain unique');
const requiredOwnership = [
  [LANDING, 'src/pages/podrostok-za-kadrom/index.astro'],
  ...ITEMS.map(([, , slug]) => [`/articles/${slug}/`, `src/pages/articles/${slug}/index.astro`]),
];
for (const [route, source] of requiredOwnership) {
  const owner = ownership.routes?.[route];
  if (!owner) fail(`${route}: missing page ownership`);
  else if (owner.owner !== 'astro' || owner.status !== 'production-dist' || owner.source !== source) {
    fail(`${route}: ownership mismatch`);
  }
  if (!exists(source)) fail(`${route}: source missing ${source}`);
  const profileName = route === LANDING
    ? 'data/route-profiles/podrostok-za-kadrom.json'
    : `data/route-profiles/articles-${route.split('/').filter(Boolean).at(-1)}.json`;
  if (!exists(profileName)) fail(`${route}: route profile missing`);
  else {
    const profile = readJson(profileName);
    if (profile.route !== route || profile.currentStatus !== 'production-dist' || profile.source !== source || profile.surface !== 'series') {
      fail(`${route}: route profile mismatch`);
    }
  }
}

for (const [mark, pageId, slug, minutes, done, heroFile] of ITEMS) {
  const sourceRel = `src/content/articles/${slug}.mdx`;
  const group = GROUPS.find((g) => g.rows.some((row) => row[1] === pageId));
  if (!group) { fail(slug + ': unexpected source series ownership'); continue; }
  const mdx = read(sourceRel);
  const requiredSourceFields = [
    'contentStatus: "published"',
    'draft: false',
    'noindex: false',
    'sourcesRequired: true',
    'series: "' + group.key + '"',
    `canonicalOverride: "${SITE}/articles/${slug}/"`,
    `ogImage: "/images/teen-series/${heroFile}"`,
  ];
  for (const field of requiredSourceFields) {
    if (!mdx.includes(field)) fail(`${slug}: canonical publication source missing ${field}`);
  }
  const expectedMediaAlt = mediaAltFor(pageId);
  const canonicalMediaAlt = frontmatterScalar(mdx, 'ogImageAlt');
  if (!expectedMediaAlt) fail(`${slug}: media authority alt is missing`);
  else if (canonicalMediaAlt !== expectedMediaAlt) fail(`${slug}: ogImageAlt drift from teenSeriesMedia authority`);
  const publishedAt = frontmatterScalar(mdx, 'publishedAt');
  const updatedAt = frontmatterScalar(mdx, 'updatedAt');
  if (publishedAt !== RELEASE_DATE) fail(`${slug}: publishedAt=${publishedAt || 'missing'}, expected ${RELEASE_DATE}`);
  if (!Number.isFinite(Date.parse(updatedAt)) || Date.parse(updatedAt) < Date.parse(publishedAt)) {
    fail(`${slug}: updatedAt must be a valid instant on/after publishedAt`);
  }
  if (/<!--|-->/.test(mdx)) fail(`${slug}: raw HTML comment marker remains in published MDX`);

  const tocAnchors = teenTocAnchorsFor(pageId);
  if (!tocAnchors?.length) {
    fail(`${slug}: Reader partToc missing or unparsable`);
  } else {
    const ids = [...mdx.matchAll(/<[a-z][^>]*\bid=["']([^"']+)["']/gi)].map((x) => x[1]);
    const available = new Set(ids);
    for (const id of tocAnchors) {
      if (!available.has(id)) fail(`${slug}: Reader TOC #${id} has no MDX target`);
    }
    if (new Set(tocAnchors).size !== tocAnchors.length) fail(`${slug}: Reader TOC duplicates target IDs`);
    if (available.size !== ids.length) fail(`${slug}: duplicate id attributes in published MDX`);
    const legacy = publishedAnchorBaseline.articles?.[slug];
    if (publishedAnchorBaseline.seriesId !== SERIES_KEY || publishedAnchorBaseline.version !== 1 || !Array.isArray(legacy) || !legacy.length) {
      fail(`${slug}: missing stable published deep-link baseline`);
    } else {
      for (const id of legacy) {
        if (!available.has(id)) fail(`${slug}: published deep-link #${id} removed; restore an id alias`);
      }
    }
  }

  const routeRel = `src/pages/articles/${slug}/index.astro`;
  const source = read(routeRel);
  if (!source.includes(`pageId="${pageId}"`)) fail(`${slug}: pageId mismatch`);
  if (!source.includes('frontmatter={frontmatter}')) fail(`${slug}: route must pass canonical MDX frontmatter directly`);
  if (/publishedFrontmatter|\b(?:draft|noindex|publishedAt|updatedAt|canonicalOverride)\s*:/.test(source)) {
    fail(`${slug}: route must not shadow canonical publication frontmatter`);
  }
  if (!config.includes('readingProgressDoneMin: ' + done))
    fail(slug + ': series progress offset drift');
  if (!config.includes('readingProgressPartMin: ' + minutes))
    fail(slug + ': reading-time witness drift');
  if (!config.includes("mark: { kind: '" + group.kind + "', value: '" + mark + "' }"))
    fail(slug + ': typed mark drift');

}

if (exists('data/route-search-policy.json')) {
  const policy = readJson('data/route-search-policy.json');
  for (const [route] of requiredOwnership) {
    const row = policy.routes?.[route];
    if (!row) continue;
    if (row.indexPolicy !== 'index' || row.pagefindPolicy !== 'include' || row.searchManifestPolicy !== 'include' || row.sitemapPolicy !== 'include') {
      fail(`${route}: discovery policy is not fully public`);
    }
    const expectedRss = route === LANDING ? 'exclude' : 'include';
    if (row.rssPolicy !== expectedRss) fail(`${route}: rssPolicy=${row.rssPolicy}, expected ${expectedRss}`);
  }
}

let checkedInternalLinks = 0;
let checkedInternalAnchors = 0;
if (fs.existsSync(DIST)) {
  // Validate actual rendered links, not merely declared Reader TOC / historic anchors.
  // Missing target files and fragment IDs must fail the atomic 3+4 release contract.
  const linkedHtml = new Map();
  const linkedIds = new Map();
  const scanRenderedLinks = (route, html) => {
    for (const hit of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const href = (hit[1] ?? hit[2]).replace(/&amp;/g, '&');
      let target;
      try {
        target = new URL(href, SITE + route);
      } catch {
        fail(route + ': malformed rendered link ' + href);
        continue;
      }
      if (target.origin !== SITE) continue;
      checkedInternalLinks += 1;
      let relative;
      try {
        relative = decodeURIComponent(target.pathname).replace(/^\/+/, '');
      } catch {
        fail(route + ': invalid percent encoding in local link ' + href);
        continue;
      }
      const candidate = path.join(DIST, relative.endsWith('/') || !path.extname(relative)
        ? relative + 'index.html' : relative);
      if (!fs.existsSync(candidate)) {
        fail(route + ': rendered internal link is missing from dist: ' + href);
        continue;
      }
      if (!target.hash) continue;
      checkedInternalAnchors += 1;
      let id;
      try {
        id = decodeURIComponent(target.hash.slice(1));
      } catch {
        fail(route + ': invalid anchor encoding ' + href);
        continue;
      }
      if (!linkedHtml.has(candidate)) {
        linkedHtml.set(candidate, candidate === routeFile(route) ? html : fs.readFileSync(candidate, 'utf8'));
      }
      if (!linkedIds.has(candidate)) {
        linkedIds.set(candidate, new Set([...linkedHtml.get(candidate).matchAll(
          /<[a-z][^>]*\s+id=["']([^"']+)["'][^>]*>/gi
        )].map((match) => match[1])));
      }
      if (!linkedIds.get(candidate).has(id)) {
        fail(route + ': rendered internal anchor is missing from dist: ' + href);
      }
    }
  };
  for (const [route] of requiredOwnership) {
    const file = routeFile(route);
    if (!fs.existsSync(file)) { fail(`${route}: missing production-like dist HTML`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    scanRenderedLinks(route, html);
    const expectedCanonical = `${SITE}${route}`;
    if (canonical(html) !== expectedCanonical) fail(`${route}: canonical mismatch`);
    if (/\bnoindex\b/i.test(meta(html, 'robots'))) fail(`${route}: live candidate remains noindex`);
    if (!html.includes('data-pagefind-body')) fail(`${route}: data-pagefind-body missing`);
    const rowIndex = route === LANDING
      ? -1
      : ITEMS.findIndex(([, , slug]) => route === `/articles/${slug}/`);
    const row = rowIndex >= 0 ? ITEMS[rowIndex] : null;
    const expectedOg = route === LANDING ? SERIES_OG : `/images/teen-series/${row?.[5] || ''}`;
    if (!html.includes(expectedOg)) fail(`${route}: route-specific raster social metadata missing (${expectedOg})`);
    if (route !== LANDING && rowIndex >= 0) {
      // A source-level id is not sufficient when the MDX renderer changes.
      // Keep every previously published deep link in the actual dist DOM.
      const renderBaselineIds = publishedAnchorBaseline.articles?.[row[2]] || [];
      const rendered = [...html.matchAll(/<[a-z][^>]*\s+id=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
      const renderedSet = new Set(rendered);
      for (const id of renderBaselineIds) {
        if (!renderedSet.has(id)) fail(`${route}: published deep-link #${id} missing from built HTML`);
        if (rendered.filter((value) => value === id).length !== 1) {
          fail(`${route}: published deep-link #${id} is not unique in built HTML`);
        }
      }
      const adult = rowIndex >= 3;
      const groupName = adult ? ADULT_KEY : SERIES_KEY;
      if (/Шаг\s+[0-9]+\s+из\s+7/u.test(html))
        fail(route + ': forced seven-stage reader still published');
      if (!html.includes('data-gbs2-series="' + groupName + '"'))
        fail(route + ': rendered article series identity drifted');
      const total = adult ? row[3] : 114;
      if (!html.includes('data-gbs2-done-min="' + row[4] + '"') ||
          !html.includes('data-gbs2-total-min="' + total + '"'))
        fail(route + ': independent-cycle progress mismatch');
    }
    if (route === LANDING) {
      if (!html.includes(SERIES_RAIL)) fail(route + ': responsive hero derivative missing');
      if (!html.includes('id="adult-studies"') || !html.includes('adult-studies-title'))
        fail(route + ': independent adult study group missing');
      if (/Шаг\s+[0-9]+\s+из\s+7/u.test(html))
        fail(route + ': forced seven-step landing remains');
      for (const [, , , , , heroFile] of ITEMS) {
        const cardImage = `/images/teen-series/${railFor(heroFile)}`;
        if (!html.includes(cardImage)) fail(`${route}: card derivative missing (${cardImage})`);
      }
    } else {
      const expectedRail = `/images/teen-series/${railFor(row?.[5] || '')}`;
      if (!html.includes(expectedRail)) fail(`${route}: responsive card/rail derivative missing (${expectedRail})`);
    }
    if (route !== LANDING) {
      const groupName = rowIndex >= 3 ? ADULT_KEY : SERIES_KEY;
      if (!html.includes('data-gbs2-series="' + groupName + '"'))
        fail(route + ': rendered series identity missing');
      if (!/<section\b[^>]*class="sources-block"[^>]*data-reader-exclude[^>]*data-pagefind-ignore/iu.test(html)) {
        fail(`${route}: bibliography boundary is not static in built HTML before Pagefind`);
      }
    } else {
      if (!html.includes(SITE + '/#organization')) fail(`${route}: Organization JSON-LD node missing`);
      if (!html.includes(SITE + '/#website')) fail(`${route}: WebSite JSON-LD node missing`);
    }
  }
}

if (errors.length) {
  console.error(`❌ Teen series release contract failed (${errors.length})`);
  errors.forEach((error) => console.error(`  ❌ ${error}`));
  process.exit(1);
}
console.log('✅ Teen series release contract PASS');
console.log('  routes: ' + requiredOwnership.length + ' (shared landing, 3 teen + 4 adult articles)');
console.log('  groups: teen trilogy 114m and four independent adult topics');
console.log('  publication source: seven MDX canonical + raw HTML comments rejected');
console.log('  publication date: 2026-09-10; updatedAt stays owned by canonical frontmatter');
console.log('  media: route-specific 1200x630 WebP hero/OG + 600x315 card/rail family');
console.log('  bibliography: canonical reader projector owns build-time data-pagefind-ignore boundary');
if (fs.existsSync(DIST)) console.log('  rendered links: ' + checkedInternalLinks + ' internal, ' + checkedInternalAnchors + ' fragment anchors, 0 missing targets');
console.log('  production ownership: astro/production-dist');
