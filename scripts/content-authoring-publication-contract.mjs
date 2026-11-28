#!/usr/bin/env node
/*
 * content-authoring-publication-contract.mjs — admission owner for
 * SYS-CONTENT-AUTHORING-PUBLICATION-CONTRACT.
 *
 * A publishable MDX entry must not pass the build without a route, and a
 * published series part must not exist only in data/series.json config
 * (the historical "config-only Pastor item → 30 broken links" defect).
 *
 * Checks (source-level, no build required):
 *   1. orphan-content: non-draft MDX in the content collection without
 *      src/pages/<section>/<slug>/index.astro
 *   2. config-only-series-item: series part with status "published"
 *      without src/pages/<baseUrl>/<slug>/index.astro
 *
 * Usage:
 *   node scripts/content-authoring-publication-contract.mjs \
 *     [--content-dir=src/content/articles] [--series=data/series.json] [--pages-dir=src/pages]
 *
 * Exit codes: 0 pass, 1 violations, 2 usage/schema error.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}

const contentDir = path.resolve(process.cwd(), arg('content-dir', 'src/content/articles'));
const seriesFile = path.resolve(process.cwd(), arg('series', 'data/series.json'));
const pagesDir = path.resolve(process.cwd(), arg('pages-dir', 'src/pages'));

function usage(message) {
  console.error(`CONTENT AUTHORING CONTRACT: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(contentDir)) usage(`missing content dir: ${contentDir}`);
if (!fs.existsSync(seriesFile)) usage(`missing series manifest: ${seriesFile}`);
if (!fs.existsSync(pagesDir)) usage(`missing pages dir: ${pagesDir}`);

let series;
try {
  series = JSON.parse(fs.readFileSync(seriesFile, 'utf8'));
} catch (error) {
  usage(`invalid series manifest JSON: ${error.message}`);
}
if (!series || typeof series !== 'object' || Array.isArray(series)) usage('series manifest must be an object keyed by series id');

function parseFrontmatter(file) {
  const src = fs.readFileSync(file, 'utf8');
  const match = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const fm = match[1];
  const get = (key) => {
    const row = fm.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
    if (!row) return null;
    return row[1].replace(/^["']|["']$/g, '');
  };
  return { slug: get('slug'), section: get('section'), draft: get('draft') };
}

function hasRoute(section, slug) {
  return fs.existsSync(path.join(pagesDir, section, slug, 'index.astro'));
}

const violations = [];
let contentChecked = 0;
let contentDrafts = 0;

for (const file of fs.readdirSync(contentDir).filter((f) => f.endsWith('.mdx')).sort()) {
  const meta = parseFrontmatter(path.join(contentDir, file));
  if (!meta) usage(`${file}: missing frontmatter block`);
  if (meta.draft === 'true') {
    contentDrafts += 1;
    continue;
  }
  contentChecked += 1;
  const section = meta.section || 'articles';
  const slug = meta.slug || file.replace(/\.mdx$/, '');
  if (!hasRoute(section, slug)) {
    violations.push(`orphan-content: ${section}/${slug} (${file}) is publishable but has no src/pages/${section}/${slug}/index.astro route`);
  }
}

let partsChecked = 0;
let partsPlanned = 0;

for (const [seriesId, def] of Object.entries(series)) {
  if (!def || typeof def !== 'object') usage(`series "${seriesId}": definition must be an object`);
  const base = String(def.baseUrl || '/articles/').replace(/^\//, '').replace(/\/+$/, '');
  const parts = Array.isArray(def.parts) ? def.parts : [];
  for (const part of parts) {
    if (!part || typeof part.slug !== 'string' || part.slug.trim() === '') usage(`series "${seriesId}": part without slug`);
    if (part.status !== 'published') {
      partsPlanned += 1;
      continue;
    }
    partsChecked += 1;
    if (!hasRoute(base, part.slug)) {
      violations.push(`config-only-series-item: "${seriesId}" part "${part.slug}" is published in data/series.json but has no src/pages/${base}/${part.slug}/index.astro route`);
    }
  }
}

console.log(`CONTENT AUTHORING: publishable entries checked=${contentChecked} (drafts skipped=${contentDrafts}); series parts checked=${partsChecked} (non-published skipped=${partsPlanned})`);

if (violations.length > 0) {
  console.error(`CONTENT AUTHORING CONTRACT: FAIL (${violations.length} violation(s))`);
  for (const violation of violations) console.error(`- ${violation}`);
  console.error('Create the route, mark the entry draft:true / status:"planned", or remove the publication claim.');
  process.exit(1);
}

console.log('CONTENT AUTHORING CONTRACT: PASS (every publishable entry and published series part owns a route)');
