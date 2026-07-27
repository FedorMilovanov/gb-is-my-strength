#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ROOT,
  ARTICLE_ROUTE_TYPES,
  loadRouteRecords,
  validateRecord,
} = require('./lib/route-source-contract');

const DIST = path.join(ROOT, 'dist');
const BASELINE_FILE = path.join(ROOT, 'data/public-content-baseline.json');
const NO_BUILD = process.argv.includes('--no-build');
const REQUIRE_CONTENT_PARITY = process.argv.includes('--require-content-parity');
const ARTICLES_ONLY = process.argv.includes('--articles-only');
const SERIES_ONLY = process.argv.includes('--series-only');
const SITE = 'https://gospod-bog.ru';
const RETIRED_PREVIEW_REL = 'dev/article-mdx-pilot/index.html';
const HERMENEUTIKA_ROUTE = '/articles/hermenevticheskaya-otsenka-hristotsentrichnoy-germenevtiki/';
const HERMENEUTIKA_SOURCE_REL = 'src/components/article-pilots/hermenevtika/HermenevtikaBody.astro';
const HERMENEUTIKA_STATIC_FOOTNOTES = ['40', '72', '75', '77', '82', '83', '107'];

if (ARTICLES_ONLY && SERIES_ONLY) {
  console.error('❌ Use only one of --articles-only or --series-only');
  process.exit(2);
}

const errors = [];
const warnings = [];

function ok(message) { console.log(`✅ ${message}`); }
function warn(message) { warnings.push(message); console.log(`ℹ️ ${message}`); }
function bad(message) { errors.push(message); console.log(`❌ ${message}`); }

function runBuild() {
  if (NO_BUILD) return;
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  console.log('▶ Building production-like strangler dist for native article audit…');
  const result = spawnSync(npm, ['run', 'strangler:build:production-like'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(html) {
  return (stripTags(html).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g) || []).length;
}

function bodyHtml(html) {
  return html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || html;
}

function matchingSpanClose(html, openStart) {
  const tags = /<\/?span\b[^>]*>/gi;
  tags.lastIndex = openStart;
  let depth = 0;
  for (let match; (match = tags.exec(html));) {
    if (/^<\/span/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return { start: match.index, end: tags.lastIndex };
  }
  return null;
}

function footnoteTooltips(html) {
  const result = [];
  const markers = /<span\b(?=[^>]*\bclass=["'][^"']*\bfn-marker\b[^"']*["'])[^>]*>/gi;
  for (let marker; (marker = markers.exec(html));) {
    const markerClose = matchingSpanClose(html, marker.index);
    if (!markerClose) break;
    const markerInner = html.slice(markers.lastIndex, markerClose.start);
    const tooltip = /<span\b(?=[^>]*\bclass=["'][^"']*\btooltip\b[^"']*["'])[^>]*>/i.exec(markerInner);
    if (!tooltip) { markers.lastIndex = markerClose.end; continue; }
    const tooltipOpenStart = markers.lastIndex + tooltip.index;
    const tooltipOpenEnd = tooltipOpenStart + tooltip[0].length;
    const tooltipClose = matchingSpanClose(html, tooltipOpenStart);
    if (!tooltipClose || tooltipClose.end > markerClose.end) break;
    const direct = html.slice(markers.lastIndex, tooltipOpenStart).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    result.push({
      number: direct.match(/^\d+$/)?.[0] || '',
      content: html.slice(tooltipOpenEnd, tooltipClose.start),
    });
    markers.lastIndex = markerClose.end;
  }
  return result;
}

function assertHermenevtikaFootnotes(label, html) {
  const tooltips = footnoteTooltips(html);
  const byNumber = new Set(tooltips.map((item) => item.number));
  for (const number of HERMENEUTIKA_STATIC_FOOTNOTES) {
    if (!byNumber.has(number)) bad(label + ': footnote ' + number + ' missing from native contract');
  }
  const forbidden = /<(?:button|a)\b|\bdata-ref\s*=|\btabindex\s*=|\brole\s*=\s*["']button["']|\bclass\s*=\s*["'][^"']*\bbref\b/i;
  const interactive = tooltips.filter((item) => forbidden.test(item.content)).map((item) => item.number || '(unnumbered)');
  if (interactive.length) bad(label + ': interactive descendants inside footnotes ' + interactive.join(', '));
  else ok(label + ': footnote tooltip descendants are static');
  const ordinaryScripture = (html.match(/<button\b(?=[^>]*\bclass=["'][^"']*\bbref\b[^"']*["'])(?=[^>]*\bdata-ref=)[^>]*>/gi) || []).length;
  if (ordinaryScripture < 20) bad(label + ': ordinary Scripture controls unexpectedly missing (' + ordinaryScripture + ')');
  else ok(label + ': ordinary Scripture controls remain active (' + ordinaryScripture + ')');
}

function auditHermenevtikaSource() {
  const sourcePath = path.join(ROOT, HERMENEUTIKA_SOURCE_REL);
  if (!fs.existsSync(sourcePath)) { bad('Hermenevtika source missing: ' + HERMENEUTIKA_SOURCE_REL); return; }
  assertHermenevtikaFootnotes('hermenevtika source', fs.readFileSync(sourcePath, 'utf8'));
}

function articleHtml(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1];
  const main = html.match(/<main\b[^>]*data-pagefind-body[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  return article || main || bodyHtml(html);
}

function textOf(html, tag) {
  return stripTags(html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] || '');
}

function h1s(html) {
  return [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripTags(match[1])).filter(Boolean);
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tag = html.match(new RegExp(`<meta\\b([^>]*\\b(?:name|property)=["']${escaped}["'][^>]*)>`, 'i'))?.[1] || '';
  return tag.match(/\bcontent=["']([^"']*)["']/i)?.[1]?.trim() || '';
}

function canonical(html) {
  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    if (!/\brel=["']canonical["']/i.test(match[1])) continue;
    return match[1].match(/\bhref=["']([^"']+)["']/i)?.[1]?.trim() || '';
  }
  return '';
}

function jsonLdNodes(html, label) {
  const nodes = [];
  for (const block of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(block[1].trim());
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else if (Array.isArray(parsed?.['@graph'])) nodes.push(...parsed['@graph']);
      else if (parsed) nodes.push(parsed);
    } catch (error) {
      bad(`${label}: invalid JSON-LD (${error.message})`);
    }
  }
  return nodes;
}

function firstNode(nodes, type) {
  return nodes.find((node) => {
    const value = node?.['@type'];
    return Array.isArray(value) ? value.includes(type) : value === type;
  });
}

function normalizeInstant(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? date.toISOString() : '';
}

function routeToRel(route) {
  const clean = route.replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/index.html` : 'index.html';
}

function expectedCanonical(route) {
  return `${SITE}${route}`;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) return new Map();
  const data = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  return new Map((data.pages || []).filter((page) => page?.url).map((page) => [page.url, page]));
}

function assertSelfConsistentMetadata(label, html, expectedUrl) {
  const published = meta(html, 'article:published_time');
  const modified = meta(html, 'article:modified_time');
  const publishedIso = normalizeInstant(published);
  const modifiedIso = normalizeInstant(modified);

  if (published && !publishedIso) bad(`${label}: invalid article:published_time ${published}`);
  if (modified && !modifiedIso) bad(`${label}: invalid article:modified_time ${modified}`);

  const nodes = jsonLdNodes(html, label);
  const article = firstNode(nodes, 'Article') || firstNode(nodes, 'ScholarlyArticle');
  const breadcrumbs = firstNode(nodes, 'BreadcrumbList');

  if (!article) {
    bad(`${label}: JSON-LD Article/ScholarlyArticle node missing`);
  } else {
    const articleUrl = article.url || article.mainEntityOfPage?.['@id'] || '';
    if (articleUrl && articleUrl !== expectedUrl) bad(`${label}: JSON-LD article URL ${articleUrl} != ${expectedUrl}`);
    if (article['@id'] && article['@id'] !== `${expectedUrl}#article`) {
      bad(`${label}: JSON-LD article @id ${article['@id']} != ${expectedUrl}#article`);
    }
    if (published && normalizeInstant(article.datePublished) !== publishedIso) {
      bad(`${label}: JSON-LD datePublished does not match article:published_time`);
    }
    if (modified && normalizeInstant(article.dateModified) !== modifiedIso) {
      bad(`${label}: JSON-LD dateModified does not match article:modified_time`);
    }
  }

  if (breadcrumbs) {
    const items = Array.isArray(breadcrumbs.itemListElement) ? breadcrumbs.itemListElement : [];
    const finalItem = items.at(-1)?.item || '';
    if (finalItem && finalItem !== expectedUrl) bad(`${label}: BreadcrumbList final URL ${finalItem} != ${expectedUrl}`);
  }
}

function routeTypeSelected(routeType) {
  if (!ARTICLE_ROUTE_TYPES.has(routeType)) return false;
  if (ARTICLES_ONLY) return routeType === 'article';
  if (SERIES_ONLY) return routeType === 'series-article';
  return true;
}

function auditArticle(record, baselineByUrl) {
  const { route, profile, matrix } = record;
  const label = profile.slug || route;
  const rel = routeToRel(route);
  const distPath = path.join(DIST, rel);
  const expectedUrl = expectedCanonical(route);

  console.log(`\n${profile.routeType === 'series-article' ? 'SERIES ARTICLE' : 'ARTICLE'}: ${route}`);

  const sourceResult = validateRecord(record, { strict: true });
  sourceResult.errors.forEach((message) => bad(message));
  sourceResult.warnings.forEach((message) => warn(message));
  if (sourceResult.errors.length) return;

  if (!fs.existsSync(distPath)) {
    bad(`${label}: production-like dist route missing: ${rel}`);
    return;
  }

  const html = fs.readFileSync(distPath, 'utf8');
  if (route === HERMENEUTIKA_ROUTE) assertHermenevtikaFootnotes('hermenevtika dist', html);
  const pageCanonical = canonical(html);
  const title = textOf(html, 'title');
  const description = meta(html, 'description');
  const headings = h1s(html);

  if (pageCanonical !== expectedUrl) bad(`${label}: canonical ${pageCanonical || '(missing)'} != ${expectedUrl}`);
  else ok(`${label}: self canonical is correct`);

  if (!title) bad(`${label}: title is empty`);
  if (!description) bad(`${label}: meta description is empty`);
  if (headings.length !== 1) bad(`${label}: expected exactly one H1, got ${headings.length}`);
  if (/\bnoindex\b/i.test(meta(html, 'robots'))) bad(`${label}: production article is noindex`);
  if (!/data-pagefind-body/.test(html)) bad(`${label}: data-pagefind-body marker missing`);

  for (const marker of matrix?.requiredMarkers || []) {
    if (!html.includes(marker)) bad(`${label}: required route marker missing: ${marker}`);
  }

  const legacyPath = profile.legacyPath ? path.join(ROOT, profile.legacyPath) : null;
  if (legacyPath && fs.existsSync(legacyPath)) {
    const legacy = fs.readFileSync(legacyPath, 'utf8');
    if (legacy === html) bad(`${label}: strict-native dist is byte-identical to legacy reference`);
    else ok(`${label}: strict-native dist is not a legacy byte copy`);
  }

  assertSelfConsistentMetadata(label, html, expectedUrl);

  // public-content-baseline.json was generated by extract-url-contract.js from
  // the complete <body>. Compare the same semantic scope here. The article-only
  // count remains useful diagnostics but must not be compared to a body baseline.
  const currentBodyWords = wordCount(bodyHtml(html));
  const currentArticleWords = wordCount(articleHtml(html));
  const baseline = baselineByUrl.get(expectedUrl);
  if (!baseline) {
    warn(`${label}: no immutable migration baseline found for content floor`);
  } else {
    const oldWords = Number(baseline.words ?? baseline.wordCount ?? 0);
    const floor = Math.max(25, Math.floor(oldWords * 0.72));
    if (oldWords >= 80 && currentBodyWords < floor) {
      const message = `${label}: body content floor failed ${oldWords} -> ${currentBodyWords} (floor ${floor}; article ${currentArticleWords})`;
      REQUIRE_CONTENT_PARITY ? bad(message) : warn(message);
    } else {
      ok(`${label}: body content floor preserved (${currentBodyWords} words; baseline ${oldWords}; article ${currentArticleWords})`);
    }
  }
}

function main() {
  const scope = ARTICLES_ONLY ? 'standalone articles' : SERIES_ONLY ? 'series articles' : 'all native articles';
  console.log(`ARTICLE NATIVE CONTRACT AUDIT (${NO_BUILD ? 'no-build' : 'production-like build'}; ${scope})`);
  console.log('Legacy HTML and MDX references are migration evidence, not current production truth.');

  auditHermenevtikaSource();
  runBuild();

  const retired = path.join(DIST, RETIRED_PREVIEW_REL);
  if (fs.existsSync(retired)) bad(`retired preview route must stay absent: ${RETIRED_PREVIEW_REL}`);

  const { records } = loadRouteRecords();
  const articles = records.filter((record) =>
    record.owner.owner === 'astro' &&
    record.owner.status === 'production-dist' &&
    record.profile?.migrationMode === 'strict-native' &&
    routeTypeSelected(record.profile?.routeType)
  );
  const baselineByUrl = loadBaseline();

  for (const record of articles) auditArticle(record, baselineByUrl);

  console.log('');
  if (errors.length) {
    console.error(`❌ Article native contract audit failed (${errors.length} error(s))`);
    errors.slice(0, 80).forEach((message) => console.error(`  - ${message}`));
    process.exit(1);
  }

  console.log(`✅ Article native contract audit passed (${articles.length} route(s))`);
  if (warnings.length) console.log(`ℹ️ Warnings: ${warnings.length}`);
}

main();
