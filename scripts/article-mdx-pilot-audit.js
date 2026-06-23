#!/usr/bin/env node
/*
 * article-mdx-pilot-audit.js — audit MDX article public shadow routes.
 *
 * Current contract:
 * - repository root legacy HTML remains production truth until deploy switch;
 * - strangler dist may shadow-own selected public article URLs with Astro output;
 * - retired /dev/article-mdx-pilot/ route must stay absent;
 * - public Astro output must mirror each legacy article SEO/content contract.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SITE = 'https://gospod-bog.ru';
const RETIRED_PREVIEW_REL = 'dev/article-mdx-pilot/index.html';
const NO_BUILD = process.argv.includes('--no-build');
const REQUIRE_CONTENT_PARITY = process.argv.includes('--require-content-parity');

const MIGRATED_ARTICLES = [
  {
    slug: 'dzhon-gill-spravochnik',
    rel: 'articles/dzhon-gill-spravochnik/index.html',
    canonical: `${SITE}/articles/dzhon-gill-spravochnik/`,
    visualShadow: true,
  },
  {
    slug: 'dzhon-gill-istoricheskiy-kontekst',
    rel: 'articles/dzhon-gill-istoricheskiy-kontekst/index.html',
    canonical: `${SITE}/articles/dzhon-gill-istoricheskiy-kontekst/`,
    visualShadow: true,
  },
  {
    slug: 'rimlyanam-7-veruyushchiy-ili-neveruyushchiy',
    rel: 'articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/index.html',
    canonical: `${SITE}/articles/rimlyanam-7-veruyushchiy-ili-neveruyushchiy/`,
    visualShadow: true,
    visualMarkers: ['gbs-world', 'data-gbs2-series="hard-texts"', 'gbs2-rail'],
    bodyClass: 'article-body',
  },
  {
    slug: 'kod-da-vinchi',
    rel: 'articles/kod-da-vinchi/index.html',
    canonical: `${SITE}/articles/kod-da-vinchi/`,
    visualShadow: true,
    visualMarkers: ['article-body', 'data-pagefind-body'],
    bodyClass: 'article-body',
  },
  {
    slug: 'dzhon-gill-chast-1-chelovek',
    rel: 'articles/dzhon-gill-chast-1-chelovek/index.html',
    canonical: `${SITE}/articles/dzhon-gill-chast-1-chelovek/`,
    visualShadow: true,
  },
  {
    slug: 'dzhon-gill-chast-2-uchenyi',
    rel: 'articles/dzhon-gill-chast-2-uchenyi/index.html',
    canonical: `${SITE}/articles/dzhon-gill-chast-2-uchenyi/`,
    visualShadow: true,
  },
  {
    slug: 'dzhon-gill-chast-3-nasledie',
    rel: 'articles/dzhon-gill-chast-3-nasledie/index.html',
    canonical: `${SITE}/articles/dzhon-gill-chast-3-nasledie/`,
    visualShadow: true,
  },
  {
    slug: 'krajne-li-isporcheno-serdce',
    rel: 'articles/krajne-li-isporcheno-serdce/index.html',
    canonical: `${SITE}/articles/krajne-li-isporcheno-serdce/`,
    visualShadow: true,
    visualMarkers: ['gbs-world', 'data-gbs2-series="hard-texts"', 'gbs2-rail'],
    bodyClass: 'article-body',
  },
  {
    slug: 'hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki',
    rel: 'articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/index.html',
    canonical: `${SITE}/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/`,
    visualShadow: true,
    visualMarkers: ['article-body', 'data-pagefind-body'],
    bodyClass: 'article-body',
  },
  {
    slug: '20-antisovetov-pastoru',
    rel: 'articles/20-antisovetov-pastoru/index.html',
    canonical: `${SITE}/articles/20-antisovetov-pastoru/`,
    visualShadow: true,
    visualMarkers: ['article-body', 'data-pagefind-body'],
    bodyClass: 'article-body',
  },
];

const problems = [];
const warnings = [];

function ok(msg) { console.log(`✅ ${msg}`); }
function warn(msg) { warnings.push(msg); console.log(`ℹ️ ${msg}`); }
function bad(msg) { problems.push(msg); console.log(`❌ ${msg}`); }
function file(rel) { return path.join(ROOT, rel); }
function distFile(rel) { return path.join(DIST, rel); }
function read(abs) { return fs.readFileSync(abs, 'utf8'); }
function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function ownText(html, tag, attrs = '') {
  const re = new RegExp(`<${tag}\\b${attrs}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  return stripTags(html.match(re)?.[1] || '');
}
function title(html) { return ownText(html, 'title'); }
function h1(html) { return ownText(html, 'h1'); }
function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i');
  const m = html.match(re);
  return m?.[1]?.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}
function canonical(html) {
  const links = [...html.matchAll(/<link\b([^>]+)>/gi)];
  for (const link of links) {
    const attrs = link[1];
    if (!/\brel=["']canonical["']/i.test(attrs)) continue;
    return attrs.match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
}
function headings(html) {
  return [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
}
function bodyHtml(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
}
function articleHtml(html, className) {
  const re = new RegExp(`<article\\b([^>]*class=["'][^"']*${className}[^"']*["'][^>]*)>([\\s\\S]*?)<\\/article>`, 'i');
  return html.match(re)?.[2] || bodyHtml(html);
}
function wordCount(html) {
  const text = stripTags(html);
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}
function jsonLdNodes(html) {
  const nodes = [];
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else if (parsed && Array.isArray(parsed['@graph'])) nodes.push(...parsed['@graph']);
      else if (parsed) nodes.push(parsed);
    } catch (e) {
      bad(`invalid JSON-LD block: ${e.message}`);
    }
  }
  return nodes;
}
function firstNode(nodes, type) {
  return nodes.find((node) => {
    const t = node && node['@type'];
    return Array.isArray(t) ? t.includes(type) : t === type;
  });
}
function normalizeUrl(url) {
  return (url || '').replace(/^https:\/\/gospod-bog\.ru/, SITE);
}
function iso(value) {
  const d = new Date(value);
  return Number.isFinite(d.valueOf()) ? d.toISOString() : '';
}

function checkKodDaVinchiBreakoutSource() {
  const base = path.join(ROOT, 'src/components/article-pilots/kod-da-vinchi');
  const component = path.join(base, 'KodDaVinchiArticleBody.astro');
  const sectionDir = path.join(base, '_legacy/article-sections');
  if (!fs.existsSync(component)) return bad('kod-da-vinchi ArticleBody component missing');
  const src = read(component);
  if (src.includes("article-body.html?raw")) bad('kod-da-vinchi ArticleBody still imports the monolithic article-body.html');
  else ok('kod-da-vinchi ArticleBody no longer imports monolithic article-body.html');
  // The section glob is required only while raw fragments remain. In the
  // terminal state (all sections promoted to Astro components) the glob is
  // retired, so skip this check once promotion is complete.
  const _sectionDir = path.join(base, '_legacy/article-sections');
  const _hasRawFragments = fs.existsSync(_sectionDir) && fs.readdirSync(_sectionDir).some((f) => f.endsWith('.html'));
  if (_hasRawFragments) mustContain('kod-da-vinchi ArticleBody uses section glob', src, 'article-sections/*.html');
  else ok('kod-da-vinchi all sections promoted — section glob retired (no raw fragments remain)');
  mustContain('kod-da-vinchi ArticleBody imports Astro Pagefind meta component', src, 'KodDaVinchiPagefindMeta');
  // Verify every promoted KodDaVinchiSection*.astro component is actually imported
  // by ArticleBody. The list is derived from the filesystem, so this stays correct
  // as more sections get promoted one-at-a-time (no manual per-section line).
  const promotedComponents = fs.readdirSync(base)
    .filter((f) => /^KodDaVinchiSection[A-Z]\w*\.astro$/.test(f))
    .sort();
  for (const comp of promotedComponents) {
    const ident = comp.replace(/\.astro$/, '');
    mustContain(`kod-da-vinchi ArticleBody imports ${ident}`, src, ident);
  }
  mustContain('kod-da-vinchi ArticleBody preserves article-body wrapper', src, '<article class="article-body" data-pagefind-body>');
  if (fs.existsSync(path.join(base, '_legacy/article-body.html'))) bad('kod-da-vinchi monolithic _legacy/article-body.html still exists; keep section seams authoritative');
  else ok('kod-da-vinchi monolithic article-body.html removed after section breakout');
  // Total visible content sections: 20 (the pagefind-meta island is a separate
  // non-visible component, not counted). Promoted ones are Astro components;
  // remaining are raw fragments. Count must equal 20 - promoted.
  const totalSections = 20;
  if (!fs.existsSync(sectionDir)) {
    // Terminal state: every section promoted → no raw fragments left.
    if (promotedComponents.length < totalSections) bad('kod-da-vinchi article-sections directory missing before full promotion');
    else ok(`kod-da-vinchi ALL ${totalSections} sections promoted to Astro (no raw fragments remain)`);
  } else {
    const fragments = fs.readdirSync(sectionDir).filter((f) => f.endsWith('.html')).sort();
    const expectedRemaining = totalSections - promotedComponents.length;
    if (fragments.length !== expectedRemaining) bad(`kod-da-vinchi section fragment count drift: expected ${expectedRemaining} remaining legacy visible section fragments (${promotedComponents.length} promoted), got ${fragments.length}`);
    else ok(`kod-da-vinchi remaining legacy visible section fragment count: ${expectedRemaining} (${promotedComponents.length} promoted)`);
  }
  // Verify each promoted section component exists and carries its legacy h2 anchor.
  // The anchor id is derived from the section slug (e.g. KodDaVinchiSectionIntro → sec-intro).
  const anchorMap = { Gnostic: 'sec-gnostic', Qumran: 'sec-qumran', Lie3: 'sec-lie3', Lie4: 'sec-lie4', Lie5: 'sec-lie5', Lie6: 'sec-lie6', Dates: 'sec-dates', Errors: 'sec-errors', Lie1: 'sec-lie1', Feminine: 'sec-feminine', Lie2: 'sec-lie2', Canon: 'sec-canon', Intro: 'sec-intro', Phenomenon: 'sec-phenomenon', Church: 'sec-church', Why: 'sec-why', Quiz: 'sec-quiz', Faq: 'sec-faq', Conclusion: 'sec-conclusion', SummaryTitleAuto: null };
  for (const comp of promotedComponents) {
    const compName = comp.replace(/\.astro$/, '').replace(/^KodDaVinchiSection/, '');
    const anchor = anchorMap[compName];
    const compFile = path.join(base, comp);
    if (!fs.existsSync(compFile)) { bad(`kod-da-vinchi Astro ${compName} section component missing`); continue; }
    if (anchor) mustContain(`kod-da-vinchi ${compName} component h2 anchor`, read(compFile), `id="${anchor}"`);
  }
  const metaComponent = path.join(base, 'KodDaVinchiPagefindMeta.astro');
  if (!fs.existsSync(metaComponent)) bad('kod-da-vinchi Astro Pagefind meta component missing');
  else {
    const metaSrc = read(metaComponent);
    for (const marker of ['data-pagefind-meta="image"', 'data-pagefind-meta="author"', 'data-pagefind-meta="readTime"', 'data-pagefind-meta="category"']) {
      mustContain(`kod-da-vinchi Pagefind meta component ${marker}`, metaSrc, marker);
    }
  }
  // Phase 5: body-segment chrome promotion — zero remaining raw ?raw imports.
  const pageSrc = read(path.join(ROOT, 'src/pages/articles/kod-da-vinchi/index.astro'));
  if (pageSrc.includes('body-segment-0.html?raw')) bad('kod-da-vinchi index.astro still imports raw body-segment-0.html');
  else ok('kod-da-vinchi index.astro no longer imports raw body-segment-0.html');
  if (pageSrc.includes('body-segment-1.html?raw')) bad('kod-da-vinchi index.astro still imports raw body-segment-1.html');
  else ok('kod-da-vinchi index.astro no longer imports raw body-segment-1.html');
  mustContain('kod-da-vinchi index.astro imports PageHead component', pageSrc, 'KodDaVinchiPageHead');
  mustContain('kod-da-vinchi index.astro imports PageChrome component', pageSrc, 'KodDaVinchiPageChrome');
  mustContain('kod-da-vinchi index.astro imports PageFooter component', pageSrc, 'KodDaVinchiPageFooter');
  mustNotContain('kod-da-vinchi index.astro no legacy document loader', pageSrc, 'loadLegacyFullDocument');
  mustNotContain('kod-da-vinchi index.astro no headHtml transport', pageSrc, 'headHtml');
  mustNotContain('kod-da-vinchi index.astro no bodyAttributes transport', pageSrc, 'bodyAttributes');
  const seg0 = path.join(base, '_legacy/body-segment-0.html');
  const seg1 = path.join(base, '_legacy/body-segment-1.html');
  if (fs.existsSync(seg0)) warn('kod-da-vinchi _legacy/body-segment-0.html still present (unused but harmless)');
  if (fs.existsSync(seg1)) warn('kod-da-vinchi _legacy/body-segment-1.html still present (unused but harmless)');
}

function runBuild() {
  if (NO_BUILD) return;
  console.log('▶ Building strangler dist for MDX article shadow audit…');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['run', 'strangler:build'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}
function mustEqual(label, actual, expected) {
  if (actual === expected) ok(`${label}: ${expected}`);
  else bad(`${label}: expected "${expected}", got "${actual}"`);
}
function mustNotContain(label, actual, needle) {
  if (!String(actual || '').includes(needle)) ok(`${label}: does not contain "${needle}"`);
  else bad(`${label}: must not contain "${needle}"`);
}
function mustEqualInstant(label, actual, expected) {
  const actualIso = iso(actual);
  const expectedIso = iso(expected);
  if (actualIso && actualIso === expectedIso) ok(`${label}: ${actualIso}`);
  else bad(`${label}: expected instant "${expectedIso || expected}", got "${actualIso || actual}"`);
}
function mustContain(label, actual, needle) {
  if (String(actual || '').includes(needle)) ok(`${label}: contains "${needle}"`);
  else bad(`${label}: missing "${needle}"`);
}
function hasNoindex(html) {
  return /\bnoindex\b/i.test(meta(html, 'robots'));
}
function legacyFacts(legacy) {
  const nodes = jsonLdNodes(legacy);
  const breadcrumbs = firstNode(nodes, 'BreadcrumbList');
  const breadcrumbItems = Array.isArray(breadcrumbs?.itemListElement) ? breadcrumbs.itemListElement : [];
  return {
    title: title(legacy),
    description: meta(legacy, 'description'),
    canonical: canonical(legacy),
    h1: h1(legacy),
    ogType: meta(legacy, 'og:type'),
    ogImage: normalizeUrl(meta(legacy, 'og:image')),
    published: meta(legacy, 'article:published_time'),
    modified: meta(legacy, 'article:modified_time'),
    author: meta(legacy, 'article:author'),
    words: wordCount(articleHtml(legacy, 'article-body')),
    h2: headings(legacy),
    breadcrumbFinalName: breadcrumbItems.at(-1)?.name || title(legacy),
  };
}
function assertArticleContract(item, label, html, facts) {
  mustEqual(`${label} canonical`, canonical(html), item.canonical);
  if (hasNoindex(html)) bad(`${label} must be indexable but has robots: ${meta(html, 'robots')}`);
  else ok(`${label} is indexable`);

  mustEqual(`${label} title mirrors legacy`, title(html), facts.title);
  mustEqual(`${label} meta description mirrors legacy`, meta(html, 'description'), facts.description);
  mustEqual(`${label} visible h1 mirrors legacy`, h1(html), facts.h1);
  mustEqual(`${label} og:type mirrors legacy article type`, meta(html, 'og:type'), facts.ogType);
  mustEqual(`${label} og:image mirrors legacy`, normalizeUrl(meta(html, 'og:image')), facts.ogImage);
  mustEqualInstant(`${label} article:published_time mirrors legacy instant`, meta(html, 'article:published_time'), facts.published);
  mustEqualInstant(`${label} article:modified_time mirrors legacy instant`, meta(html, 'article:modified_time'), facts.modified);
  mustEqual(`${label} article:author mirrors legacy`, meta(html, 'article:author'), facts.author);
  if (!item.visualShadow) mustContain(`${label} article slug marker`, html, `data-article-slug="${item.slug}"`);
  else ok(`${label} visual-first full-document shadow does not require Astro data-article-slug marker`);

  const nodes = jsonLdNodes(html);
  const article = firstNode(nodes, 'Article') || firstNode(nodes, 'ScholarlyArticle');
  const breadcrumbs = firstNode(nodes, 'BreadcrumbList');
  if (!article) bad(`${label} JSON-LD missing Article/ScholarlyArticle node`);
  else {
    ok(`${label} JSON-LD Article/ScholarlyArticle node exists`);
    if (item.visualShadow) {
      // Refactoring 5.0: Gill/GBS pages preserve legacy JSON-LD until a
      // componentized rewrite proves visual parity and owner approval.
      mustEqual(`${label} Article @id uses public canonical`, article['@id'] || '', `${item.canonical}#article`);
      mustEqual(`${label} Article url uses public canonical`, article.url || '', item.canonical);
      mustEqualInstant(`${label} Article datePublished mirrors legacy instant`, article.datePublished, facts.published);
      mustEqualInstant(`${label} Article dateModified mirrors legacy instant`, article.dateModified, facts.modified);
      ok(`${label} legacy JSON-LD headline/author shape preserved without Astro normalization`);
    } else {
      mustEqual(`${label} Article headline mirrors legacy title`, article.headline || '', facts.title);
      mustEqual(`${label} Article description mirrors legacy`, article.description || '', facts.description);
      mustEqual(`${label} Article @id uses public canonical`, article['@id'] || '', `${item.canonical}#article`);
      mustEqual(`${label} Article url uses public canonical`, article.url || '', item.canonical);
      mustEqualInstant(`${label} Article datePublished mirrors legacy instant`, article.datePublished, facts.published);
      mustEqualInstant(`${label} Article dateModified mirrors legacy instant`, article.dateModified, facts.modified);
      mustEqual(`${label} Article author mirrors legacy`, article.author?.name || '', facts.author);
      mustEqual(`${label} Article mainEntityOfPage uses public canonical`, article.mainEntityOfPage?.['@id'] || '', item.canonical);
    }
  }
  if (!breadcrumbs) bad(`${label} JSON-LD missing BreadcrumbList node`);
  else {
    ok(`${label} JSON-LD BreadcrumbList node exists`);
    if (!item.visualShadow) mustEqual(`${label} BreadcrumbList @id uses public canonical`, breadcrumbs['@id'] || '', `${item.canonical}#breadcrumbs`);
    else ok(`${label} legacy BreadcrumbList id shape preserved without Astro normalization`);
    const items = Array.isArray(breadcrumbs.itemListElement) ? breadcrumbs.itemListElement : [];
    mustEqual(`${label} BreadcrumbList final item uses public canonical`, items.at(-1)?.item || '', item.canonical);
    mustEqual(`${label} BreadcrumbList final item title mirrors legacy JSON-LD`, items.at(-1)?.name || '', item.visualShadow ? facts.breadcrumbFinalName : facts.title);
  }
}
function assertBodyParity(label, html, className, facts) {
  const words = wordCount(articleHtml(html, className));
  const h2 = headings(html);
  const ratio = words / Math.max(1, facts.words);
  console.log(`${label} words: ${words}; legacy words: ${facts.words}; ratio: ${ratio.toFixed(2)}`);
  console.log(`${label} h2 count: ${h2.length}; legacy h2 count: ${facts.h2.length}`);
  const h2Parity = JSON.stringify(facts.h2) === JSON.stringify(h2);
  if (h2Parity) ok(`${label} H2 parity matches legacy`);
  else {
    const msg = `${label} H2 parity differs (legacy: ${JSON.stringify(facts.h2)}; ${label}: ${JSON.stringify(h2)})`;
    if (REQUIRE_CONTENT_PARITY) bad(msg);
    else warn(`${msg}; acceptable before full body migration`);
  }
  if (ratio < 0.72) {
    const msg = `${label} body is not content-complete yet (${words}/${facts.words} words, ratio ${ratio.toFixed(2)})`;
    if (REQUIRE_CONTENT_PARITY) bad(msg);
    else warn(`${msg}; acceptable for advisory mode, not acceptable for public URL promotion`);
  } else ok(`${label} body word-count parity is within migration threshold`);
}
function auditArticle(item) {
  console.log(`\nARTICLE: ${item.slug}`);
  const legacyPath = file(item.rel);
  const publicPath = distFile(item.rel);
  if (!fs.existsSync(legacyPath)) bad(`${item.slug}: legacy article missing: ${item.rel}`);
  if (!fs.existsSync(publicPath)) bad(`${item.slug}: dist public article missing: ${item.rel}`);
  if (problems.length) return;

  const legacy = read(legacyPath);
  const publicArticle = read(publicPath);
  const facts = legacyFacts(legacy);

  mustEqual(`${item.slug} legacy canonical baseline`, facts.canonical, item.canonical);
  if (/class="astro-article"/.test(legacy)) bad(`${item.slug}: repository root legacy article contains Astro article output`);
  else ok(`${item.slug}: repository root article remains legacy production truth`);

  if (item.visualShadow) {
    if (/class="astro-article"/.test(publicArticle)) bad(`${item.slug}: visual-first route unexpectedly uses generic astro-article output`);
    else ok(`${item.slug}: dist route is visual-first full-document/shadow-breakout output, not generic astro-article`);
    const markers = item.visualMarkers || ['gbs-world', 'data-gbs2-series="dzhon-gill"', 'gbs2-rail', 'gbs2-hero'];
    for (const marker of markers) {
      mustContain(`${item.slug} visual marker`, publicArticle, marker);
    }
    mustNotContain(`${item.slug} visual shadow generic marker`, publicArticle, 'astro-series-nav');
    mustNotContain(`${item.slug} visual shadow generic marker`, publicArticle, 'class="astro-article"');
  } else {
    if (!/class="astro-article"/.test(publicArticle)) bad(`${item.slug}: dist public article path is not Astro shadow output`);
    else ok(`${item.slug}: dist public article path is Astro shadow-owned`);
  }
  if (legacy === publicArticle) bad(`${item.slug}: dist public article is still byte-identical legacy copy; shadow ownership did not engage`);
  else ok(`${item.slug}: dist public article is no longer byte-identical legacy copy`);

  assertArticleContract(item, `${item.slug} public shadow article`, publicArticle, facts);
  mustNotContain(`${item.slug} public shadow article pilot note`, publicArticle, 'Build-only MDX pilot');
  assertBodyParity(`${item.slug} public shadow article`, publicArticle, item.bodyClass || (item.visualShadow ? 'article-body' : 'astro-article'), facts);
}

function main() {
  console.log(`ARTICLE MDX PUBLIC SHADOW AUDIT (${NO_BUILD ? 'no-build' : 'build'}, content parity ${REQUIRE_CONTENT_PARITY ? 'required' : 'advisory'})`);
  checkKodDaVinchiBreakoutSource();
  runBuild();

  const retiredPreviewPath = distFile(RETIRED_PREVIEW_REL);
  if (fs.existsSync(retiredPreviewPath)) bad(`retired MDX preview route must stay absent: ${RETIRED_PREVIEW_REL}`);
  else ok('retired MDX preview route absent');

  for (const item of MIGRATED_ARTICLES) auditArticle(item);

  finish();
}
function finish() {
  console.log('');
  if (problems.length) {
    console.log(`❌ article MDX public shadow audit failed: ${problems.length} issue(s)`);
    process.exit(1);
  }
  console.log(`✅ article MDX public shadow audit passed (${MIGRATED_ARTICLES.length} article(s))`);
  if (warnings.length) console.log('ℹ️ Advisory warnings remain until every migrated article is public-shadow reviewed.');
}

main();
