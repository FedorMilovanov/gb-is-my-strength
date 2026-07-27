#!/usr/bin/env node
/**
 * Build-time article projection for the canonical relation engine.
 *
 * Reads the prerendered compiled relation endpoint, removes legacy backlink
 * blocks, injects deterministic semantic HTML and materializes the one CSS
 * asset. Article content never fetches graph data at runtime.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const COMPILED_PATH = join(DIST, 'data', 'relations.compiled.json');
const CSS_SOURCE = join(ROOT, 'src', 'runtime', 'relationship-panel.css');
const CSS_PUBLIC_PATH = 'css/relationship-panel.css';
const CSS_TARGET = join(DIST, CSS_PUBLIC_PATH);
const DRY_RUN = process.argv.includes('--dry-run');
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrl(value) {
  let path = String(value || '/').split(/[?#]/)[0].replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  return path.length > 1 && !path.endsWith('/') ? `${path}/` : path || '/';
}

function classOpenRegex() {
  return /<([a-zA-Z][\w:-]*)\b[^>]*\bclass\s*=\s*(["'])([^"']*)\2[^>]*>/gi;
}

function findElementRangeByClass(html, className, fromIndex = 0) {
  const fragment = html.slice(fromIndex);
  const openRe = classOpenRegex();
  let match = null;
  let candidate;
  while ((candidate = openRe.exec(fragment))) {
    const classes = candidate[3].trim().split(/\s+/).filter(Boolean);
    if (classes.includes(className)) {
      match = candidate;
      break;
    }
  }
  if (!match) return null;
  const start = fromIndex + match.index;
  const openEnd = start + match[0].length;
  const tag = match[1].toLowerCase();
  if (VOID_TAGS.has(tag) || /\/\s*>$/.test(match[0])) return { start, end: openEnd };

  const tagRe = new RegExp(`<\/?${escapeRegExp(tag)}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = openEnd;
  let depth = 1;
  let tagMatch;
  while ((tagMatch = tagRe.exec(html))) {
    const token = tagMatch[0];
    if (/^<\//.test(token)) depth -= 1;
    else if (!/\/\s*>$/.test(token) && !VOID_TAGS.has(tag)) depth += 1;
    if (depth === 0) return { start, end: tagRe.lastIndex };
  }
  throw new Error(`Unbalanced <${tag}> while removing .${className}`);
}

function removeElementsByClass(html, className) {
  let updated = html;
  let removed = 0;
  while (true) {
    const range = findElementRangeByClass(updated, className);
    if (!range) break;
    updated = `${updated.slice(0, range.start)}${updated.slice(range.end)}`;
    removed += 1;
  }
  return { html: updated, removed };
}

function removeRuntimeTags(html) {
  let updated = html;
  updated = updated.replace(/\s*<script\b[^>]*(?:id=["']gbRelationshipPanelJs["']|src=["'][^"']*\/js\/relationship-panel\.js(?:\?[^"']*)?["'])[^>]*><\/script>\s*/gi, '\n');
  updated = updated.replace(/\s*<link\b[^>]*(?:id=["']gbRelationshipPanelCss["']|href=["'][^"']*\/css\/relationship-panel\.css(?:\?[^"']*)?["'])[^>]*>\s*/gi, '\n');
  return updated;
}

function routeForFile(file) {
  let rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) rel = rel.slice(0, -'index.html'.length);
  return normalizeUrl(`/${rel}`);
}

function materialType(node) {
  if (node.isHub || node.group === 'landing') return 'Каталог';
  if (node.group === 'karty') return 'Интерактивная карта';
  return 'Материал';
}

function buildPanel(current, projection, nodeMap) {
  const items = projection.article
    .map((entry) => ({ entry, node: nodeMap.get(entry.targetId) }))
    .filter(({ node }) => node && node.url)
    .slice(0, 4);
  if (!items.length) return '';

  const isSeries = Boolean(current.seriesId);
  const title = isSeries ? 'Контекст и связи' : 'Продолжить исследование';
  const intro = isSeries
    ? 'Внешние материалы, которые помогают увидеть эту часть в более широком контексте.'
    : 'Материалы, которые естественно продолжают тему и расширяют аргумент статьи.';
  const headingId = `gbRelationsTitle-${String(current.id).replace(/[^a-z0-9_-]+/gi, '-')}`;

  const rows = items.map(({ entry, node }, index) => {
    const description = String(entry.rationale || node.desc || '').trim();
    const meta = [materialType(node), Number(node.readingTime) > 0 ? `${node.readingTime} мин.` : ''].filter(Boolean).join(' · ');
    return `<a class="gb-relations-panel__item${index === 0 ? ' gb-relations-panel__item--featured' : ''}" href="${escapeHtml(node.url)}" data-relation-kind="${escapeHtml(entry.kind)}" data-relation-edge="${escapeHtml(entry.edgeId)}">`
      + '<span class="gb-relations-panel__copy">'
      + `<span class="gb-relations-panel__kind">${escapeHtml(entry.label)}</span>`
      + `<strong class="gb-relations-panel__title">${escapeHtml(node.title)}</strong>`
      + (description ? `<span class="gb-relations-panel__desc">${escapeHtml(description)}</span>` : '')
      + `<span class="gb-relations-panel__meta">${escapeHtml(meta)}</span>`
      + '</span><span class="gb-relations-panel__arrow" aria-hidden="true">→</span></a>';
  }).join('');

  return `<nav class="gb-relations-panel" data-relation-engine="1" data-relation-source="${escapeHtml(current.id)}" aria-labelledby="${headingId}">`
    + '<div class="gb-relations-panel__head"><div>'
    + '<span class="gb-relations-panel__eyebrow">Навигация по исследованию</span>'
    + `<h2 id="${headingId}">${escapeHtml(title)}</h2><p>${escapeHtml(intro)}</p>`
    + `</div><span class="gb-relations-panel__count" aria-label="Материалов: ${items.length}">${items.length}</span></div>`
    + `<div class="gb-relations-panel__list">${rows}</div>`
    + `<a class="gb-relations-panel__atlas" href="/map/?focus=${encodeURIComponent(current.id)}">`
    + '<span class="gb-relations-panel__atlas-mark" aria-hidden="true">✦</span>'
    + '<span><strong>Открыть окружение в Атласе</strong><small>Приблизить узел, увидеть темы и соседние материалы</small></span>'
    + '<span class="gb-relations-panel__atlas-arrow" aria-hidden="true">→</span></a></nav>';
}

function injectPanel(html, panel) {
  const seriesRange = findElementRangeByClass(html, 'astro-series-nav');
  if (seriesRange) return `${html.slice(0, seriesRange.end)}\n${panel}${html.slice(seriesRange.end)}`;

  for (const className of ['astro-author-card', 'author-card', 'related-articles']) {
    const range = findElementRangeByClass(html, className);
    if (range) return `${html.slice(0, range.start)}${panel}\n${html.slice(range.start)}`;
  }

  const articleClose = html.lastIndexOf('</article>');
  if (articleClose !== -1) return `${html.slice(0, articleClose)}${panel}\n${html.slice(articleClose)}`;
  throw new Error('Article projection target has no </article> boundary');
}

function injectCss(html, cssHref) {
  if (html.includes(cssHref)) return html;
  const tag = `<link id="gbRelationshipPanelCss" rel="stylesheet" href="${cssHref}">`;
  if (!/<\/head>/i.test(html)) throw new Error('Article HTML has no </head> boundary');
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path, out);
    else if (path.endsWith('.html')) out.push(path);
  }
  return out;
}

if (!existsSync(DIST)) throw new Error('dist/ is missing; run the Astro and strangler build first');
if (!existsSync(COMPILED_PATH)) throw new Error('dist/data/relations.compiled.json is missing; the Astro relation endpoint did not prerender');
if (!existsSync(CSS_SOURCE)) throw new Error('src/runtime/relationship-panel.css is missing');

const compiled = JSON.parse(await readFile(COMPILED_PATH, 'utf8'));
if (Number(compiled.schemaVersion) !== 1 || !Array.isArray(compiled.nodes) || !compiled.projections?.byNode) {
  throw new Error('Compiled relation endpoint has an unsupported shape');
}
const nodeMap = new Map(compiled.nodes.map((node) => [node.id, node]));
const nodeByUrl = new Map(compiled.nodes.map((node) => [normalizeUrl(node.url), node]));
const cssBytes = await readFile(CSS_SOURCE);
const cssHash = createHash('md5').update(cssBytes).digest('hex').slice(0, 8);
const cssHref = `/${CSS_PUBLIC_PATH}?v=${cssHash}`;
if (!DRY_RUN) {
  await mkdir(dirname(CSS_TARGET), { recursive: true });
  await writeFile(CSS_TARGET, cssBytes);
  await rm(join(DIST, 'js', 'relationship-panel.js'), { force: true });
}

const files = await walk(DIST);
const report = {
  schemaVersion: 1,
  engineVersion: compiled.engineVersion,
  htmlFiles: files.length,
  articleFiles: 0,
  projectedPanels: 0,
  legacyBlocksRemoved: 0,
  stalePanelsRemoved: 0,
  runtimeTagsRemoved: 0,
  skippedWithoutProjection: 0,
  missingProjectionRoutes: [],
};

for (const file of files) {
  const original = await readFile(file, 'utf8');
  if (!/<article\b/i.test(original)) continue;
  report.articleFiles += 1;
  const route = routeForFile(file);
  const current = nodeByUrl.get(route);

  let updated = removeRuntimeTags(original);
  if (updated !== original) report.runtimeTagsRemoved += 1;
  const oldResult = removeElementsByClass(updated, 'gbx-backlinks');
  updated = oldResult.html;
  report.legacyBlocksRemoved += oldResult.removed;
  const panelResult = removeElementsByClass(updated, 'gb-relations-panel');
  updated = panelResult.html;
  report.stalePanelsRemoved += panelResult.removed;

  if (current) {
    const projection = compiled.projections.byNode[current.id];
    if (!projection) {
      report.missingProjectionRoutes.push(route);
    } else {
      const panel = buildPanel(current, projection, nodeMap);
      if (panel) {
        updated = injectPanel(updated, panel);
        updated = injectCss(updated, cssHref);
        report.projectedPanels += 1;
      } else {
        report.skippedWithoutProjection += 1;
      }
    }
  }

  if (!DRY_RUN && updated !== original) await writeFile(file, updated, 'utf8');
}

if (report.missingProjectionRoutes.length) {
  throw new Error(`Missing relation projections for: ${report.missingProjectionRoutes.join(', ')}`);
}
if (!DRY_RUN) {
  await mkdir(join(DIST, 'reports'), { recursive: true });
  await writeFile(join(DIST, 'reports', 'relation-projection.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
console.log(`✅ relation projection: ${report.projectedPanels} panels, ${report.legacyBlocksRemoved} legacy blocks removed, runtime fetch eliminated`);
