#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ROOT,
  loadRouteRecords,
} = require('./lib/route-source-contract');
const {
  resolveDeclaredLegacyReference,
} = require('./lib/legacy-source-authority');

const strict = process.argv.includes('--strict');
const SERIES_FILE = path.join(ROOT, 'data/series.json');
const MDX_DIR = path.join(ROOT, 'src/content/articles');
const ALLOWED_REFERENCE_STATUS = new Set(['canonical', 'reference-only', 'runtime-required', 'absent']);
const errors = [];
const warnings = [];

function issue(message, blocking = true) {
  if (blocking || strict) errors.push(message);
  else warnings.push(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function repoRel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function existsRel(rel) {
  return Boolean(rel) && fs.existsSync(path.join(ROOT, rel));
}

function parseFrontmatter(source) {
  const match = String(source).match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*?)\s*$/);
    if (!item) continue;
    let value = item[2].replace(/^['"]|['"]$/g, '');
    if (/^(true|false)$/i.test(value)) value = value.toLowerCase() === 'true';
    data[item[1]] = value;
  }
  return data;
}

function routeForPart(seriesData, part) {
  const base = seriesData.baseUrl || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${part.slug}/`.replace(/\/{2,}/g, '/');
}

console.log('=== Content Source Provenance Audit ===');
console.log(`Mode: ${strict ? 'STRICT' : 'WARN'}`);
console.log('Policy: this audit proves ownership and provenance only; search/index membership is a separate contract.');
console.log('');

const { records } = loadRouteRecords();
const recordByRoute = new Map(records.map((record) => [record.route, record]));
const profiles = records.map((record) => record.profile).filter(Boolean);
const series = fs.existsSync(SERIES_FILE) ? readJson(SERIES_FILE) : {};
const mdxFiles = fs.existsSync(MDX_DIR)
  ? fs.readdirSync(MDX_DIR).filter((name) => name.endsWith('.mdx')).sort()
  : [];

const mdxOwners = new Map();
const legacyOwners = new Map();
let publishedParts = 0;
let canonicalMdx = 0;
let referenceMdx = 0;
let draftMdx = 0;

for (const profile of profiles) {
  if (profile.mdxStatus && !ALLOWED_REFERENCE_STATUS.has(profile.mdxStatus)) {
    issue(`${profile.route}: unknown mdxStatus=${profile.mdxStatus}`);
  }
  if (profile.legacyStatus && !ALLOWED_REFERENCE_STATUS.has(profile.legacyStatus)) {
    issue(`${profile.route}: unknown legacyStatus=${profile.legacyStatus}`);
  }

  if (profile.mdxStatus === 'canonical' || profile.mdxStatus === 'reference-only' || profile.mdxStatus === 'runtime-required') {
    if (!profile.mdxPath) issue(`${profile.route}: mdxStatus=${profile.mdxStatus} requires mdxPath`);
    else {
      if (!existsRel(profile.mdxPath)) issue(`${profile.route}: MDX source missing: ${profile.mdxPath}`);
      const owners = mdxOwners.get(profile.mdxPath) || [];
      owners.push({ route: profile.route, status: profile.mdxStatus });
      mdxOwners.set(profile.mdxPath, owners);
      if (profile.mdxStatus === 'canonical') canonicalMdx++;
      if (profile.mdxStatus === 'reference-only') referenceMdx++;
    }
  }

  if (profile.mdxStatus === 'absent' && profile.mdxPath) {
    issue(`${profile.route}: mdxStatus=absent contradicts mdxPath=${profile.mdxPath}`);
  }

  if (profile.contentSourceMode === 'mdx-native' && profile.mdxStatus !== 'canonical') {
    issue(`${profile.route}: contentSourceMode=mdx-native requires mdxStatus=canonical`);
  }
  if (profile.contentSourceMode === 'astro-native-entry' && profile.mdxStatus === 'canonical') {
    issue(`${profile.route}: astro-native-entry cannot declare MDX canonical`);
  }
  if (profile.hasMDX === true && profile.mdxStatus !== 'canonical' && profile.mdxStatus !== 'runtime-required') {
    issue(`${profile.route}: deprecated hasMDX=true contradicts mdxStatus=${profile.mdxStatus || '(missing)'}`);
  }

  if (profile.legacyStatus === 'reference-only' || profile.legacyStatus === 'runtime-required' || profile.legacyStatus === 'canonical') {
    if (!profile.legacyPath) issue(`${profile.route}: legacyStatus=${profile.legacyStatus} requires legacyPath`);
    else {
      try {
        const reference = resolveDeclaredLegacyReference(profile);
        const owners = legacyOwners.get(reference.logicalPath) || [];
        owners.push({
          route: profile.route,
          status: profile.legacyStatus,
          storagePath: reference.repositoryPath,
        });
        legacyOwners.set(reference.logicalPath, owners);
      } catch (error) {
        issue(`${profile.route}: legacy source unavailable through reference API: ${error.message}`);
      }
    }
  }
  if (profile.legacyStatus === 'absent' && profile.legacyPath) {
    issue(`${profile.route}: legacyStatus=absent contradicts legacyPath=${profile.legacyPath}`);
  }
}

for (const [seriesKey, seriesData] of Object.entries(series)) {
  const seenPositions = new Set();
  const seenSlugs = new Set();
  for (const part of seriesData.parts || []) {
    if (seenPositions.has(part.n)) issue(`series[${seriesKey}]: duplicate position ${part.n}`);
    if (seenSlugs.has(part.slug)) issue(`series[${seriesKey}]: duplicate slug ${part.slug}`);
    seenPositions.add(part.n);
    seenSlugs.add(part.slug);

    if (part.status !== 'published') continue;
    publishedParts++;
    const route = routeForPart(seriesData, part);
    const record = recordByRoute.get(route);
    if (!record) {
      issue(`series[${seriesKey}] ${part.slug}: published part has no page-ownership route ${route}`);
      continue;
    }
    if (!record.profile) issue(`series[${seriesKey}] ${part.slug}: published part has no route profile`);
    if (record.owner.owner !== 'astro' || record.owner.status !== 'production-dist') {
      issue(`series[${seriesKey}] ${part.slug}: published route is ${record.owner.owner}/${record.owner.status}, expected astro/production-dist`);
    }
    if (!record.sourceRel || !existsRel(record.sourceRel)) {
      issue(`series[${seriesKey}] ${part.slug}: public render source missing: ${record.sourceRel || '(missing)'}`);
    }
  }
}

for (const mdxName of mdxFiles) {
  const rel = `src/content/articles/${mdxName}`;
  const owners = mdxOwners.get(rel) || [];
  if (owners.length > 1) {
    issue(`${rel}: multiple route owners: ${owners.map((owner) => `${owner.route}(${owner.status})`).join(', ')}`);
  }
  if (owners.length) continue;

  const source = fs.readFileSync(path.join(MDX_DIR, mdxName), 'utf8');
  const frontmatter = parseFrontmatter(source);
  if (frontmatter.draft === true || frontmatter.contentStatus === 'draft' || frontmatter.migrationStatus === 'draft') {
    draftMdx++;
    continue;
  }
  issue(`${rel}: unowned non-draft MDX; add profile mdxPath/mdxStatus or mark it draft explicitly`);
}

for (const [mdxPath, owners] of mdxOwners) {
  if (!existsRel(mdxPath)) continue;
  if (!mdxPath.startsWith('src/content/articles/')) {
    issue(`${mdxPath}: article MDX source is outside canonical content directory`, false);
  }
  if (owners.some((owner) => owner.status === 'canonical') && owners.some((owner) => owner.status === 'reference-only')) {
    issue(`${mdxPath}: cannot be canonical and reference-only simultaneously`);
  }
}

for (const [legacyPath, owners] of legacyOwners) {
  if (owners.length > 1) {
    issue(`${legacyPath}: multiple legacy owners: ${owners.map((owner) => `${owner.route}(${owner.status})`).join(', ')}`);
  }
}

console.log(`Published series parts: ${publishedParts}`);
console.log(`Route profiles: ${profiles.length}`);
console.log(`MDX files: ${mdxFiles.length}`);
console.log(`Canonical MDX declarations: ${canonicalMdx}`);
console.log(`Reference-only MDX declarations: ${referenceMdx}`);
console.log(`Explicit draft MDX files: ${draftMdx}`);
console.log(`Legacy reference/runtime paths: ${legacyOwners.size}`);

if (warnings.length) {
  console.log('');
  console.log(`⚠️ Warnings (${warnings.length}):`);
  warnings.slice(0, 50).forEach((warning) => console.log(`  ⚠️ ${warning}`));
}

if (errors.length) {
  console.log('');
  console.error(`❌ Content source provenance failed (${errors.length} error(s)):`);
  errors.slice(0, 100).forEach((error) => console.error(`  ❌ ${error}`));
  if (errors.length > 100) console.error(`  …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log('');
console.log('✅ Every published part and source representation has explicit provenance');
