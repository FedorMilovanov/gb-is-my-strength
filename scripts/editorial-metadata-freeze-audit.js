#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const parse5 = require('parse5');
const {
  ROOT,
  REGISTRY_FILE,
  eligibleRecords,
  observeRoute,
  readRegistry,
  normalizeInstant,
} = require('./lib/editorial-metadata');
const {
  validateRegistryV3,
  readDatelineSlotAuthority,
  classifyDatelineSlot,
} = require('./lib/editorial-metadata-v3');

const DIST = path.join(ROOT, 'dist');
const errors = [];
const warnings = [];

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

function same(a, b) {
  return (a || null) === (b || null);
}

function distSharedProjectionData() {
  const sitemapFiles = fs.existsSync(DIST)
    ? fs.readdirSync(DIST)
        .filter((name) => /^sitemap(?:-\d+)?\.xml$/i.test(name))
        .sort()
    : [];
  return {
    searchItems: readJson(path.join(DIST, 'data', 'search-manifest.json'), { items: [] }).items || [],
    sitemapXml: sitemapFiles.map((name) => fs.readFileSync(path.join(DIST, name), 'utf8')).join('\n'),
    feedXml: fs.existsSync(path.join(DIST, 'feed.xml'))
      ? fs.readFileSync(path.join(DIST, 'feed.xml'), 'utf8')
      : '',
  };
}

function compareProjection(route, label, actual, expected, required) {
  const normalizedExpected = normalizeInstant(expected);
  const normalizedActual = normalizeInstant(actual);
  if (normalizedExpected === null) {
    if (normalizedActual !== null) errors.push(`${route}: ${label} must be absent while approved editorial date is unknown`);
    return;
  }
  if (required && normalizedActual === null) {
    errors.push(`${route}: ${label} missing; expected ${normalizedExpected}`);
    return;
  }
  if (normalizedActual !== null && normalizedActual !== normalizedExpected) {
    errors.push(`${route}: ${label}=${normalizedActual} != ${normalizedExpected}`);
  }
}

function nodeAttr(node, name) {
  return node?.attrs?.find((a) => a.name === name)?.value ?? '';
}

function nodeText(node) {
  if (!node) return '';
  if (node.nodeName === '#text') return node.value || '';
  return (node.childNodes || []).map(nodeText).join('');
}

function hasClassToken(node, token) {
  return nodeAttr(node, 'class').split(/\s+/).includes(token);
}

function walkDom(node, fn, ancestors = []) {
  if (!node) return;
  fn(node, ancestors);
  const nextAncestors = node.tagName ? [...ancestors, node] : ancestors;
  for (const child of node.childNodes || []) walkDom(child, fn, nextAncestors);
}

function textBeforeInContainer(container, target) {
  const chunks = [];
  let done = false;
  (function collect(curr) {
    if (!curr || done) return;
    if (curr === target) {
      done = true;
      return;
    }
    if (curr.nodeName === '#text') chunks.push(curr.value || '');
    for (const c of curr.childNodes || []) collect(c);
  })(container);
  return chunks.join(' ');
}

function visibleSlotSemanticsChecks(route, record, distRoot, slotAuthority) {
  const htmlFile = path.join(distRoot, route.replace(/^\/+|\/+$/g, ''), 'index.html');
  if (!fs.existsSync(htmlFile)) return;
  const doc = parse5.parse(fs.readFileSync(htmlFile, 'utf8'));
  const published = normalizeInstant(record.editorialPublishedAt);
  const modified = normalizeInstant(record.editorialModifiedAt);

  walkDom(doc, (node, ancestors) => {
    if (node.tagName !== 'time') return;
    const updatedOwner = [...ancestors, node].reverse().find(
      (el) => hasClassToken(el, 'article-updated') || hasClassToken(el, 'article-byline__updated')
    );
    const bylineOwner = [...ancestors].reverse().find((el) => hasClassToken(el, 'article-byline'));
    if (!updatedOwner && !bylineOwner) return;

    const owner = updatedOwner || bylineOwner;
    const attrsBlob = [owner, node]
      .filter(Boolean)
      .map((el) => (el.attrs || []).map((a) => `${a.name}="${a.value}"`).join(' '))
      .join(' ');
    const prefix = textBeforeInContainer(owner, node);
    const slot = classifyDatelineSlot(attrsBlob, prefix, updatedOwner ? 'modified' : 'published');
    const dtRaw = nodeAttr(node, 'datetime') || null;
    const dt = normalizeInstant(dtRaw);

    if (slot === 'published' && published && dt !== published) {
      errors.push(`${route}: published dateline slot projected ${dt || dtRaw || 'null'} != ${published}`);
    }
    if (slot === 'modified' && modified && dt !== modified) {
      errors.push(`${route}: modified dateline slot projected ${dt || dtRaw || 'null'} != ${modified}`);
    }
    const authorityEntry = slotAuthority?.publishedSlotRoutes?.[route];
    if (slot === 'published' && authorityEntry && authorityEntry.visibleLabel) {
      const visibleText = nodeText(node).replace(/\s+/g, ' ').trim();
      if (visibleText !== authorityEntry.visibleLabel) {
        errors.push(`${route}: published dateline visible label ${JSON.stringify(visibleText)} != ${JSON.stringify(authorityEntry.visibleLabel)}`);
      }
    }
  });
}

function canonicalProjectionChecks(route, record, current, slotAuthority) {
  const published = record.editorialPublishedAt;
  const modified = record.editorialModifiedAt;

  compareProjection(route, 'metaPublishedAt', current.observations.metaPublishedAt, published, true);
  compareProjection(route, 'jsonLdPublishedAt', current.observations.jsonLdPublishedAt, published, true);
  compareProjection(route, 'searchPublishedAt', current.observations.searchPublishedAt, published, false);
  compareProjection(route, 'rssPublishedAt', current.observations.rssPublishedAt, published, false);
  compareProjection(route, 'visiblePublishedAt', current.observations.visiblePublishedAt, published, false);

  compareProjection(route, 'metaModifiedAt', current.observations.metaModifiedAt, modified, true);
  compareProjection(route, 'jsonLdModifiedAt', current.observations.jsonLdModifiedAt, modified, true);
  compareProjection(route, 'searchModifiedAt', current.observations.searchModifiedAt, modified, false);
  compareProjection(route, 'sitemapLastmod', current.observations.sitemapLastmod, modified || published, true);
  compareProjection(route, 'visibleModifiedAt', current.observations.visibleModifiedAt, modified, false);
  visibleSlotSemanticsChecks(route, record, DIST, slotAuthority);
}

function frozenProjectionChecks(route, record, current) {
  for (const [field, frozenValue] of Object.entries(record.observations || {})) {
    const currentValue = current.observations[field] ?? null;
    if (!same(frozenValue, currentValue)) {
      errors.push(`${route}: unapproved frozen ${field} changed ${frozenValue || 'null'} -> ${currentValue || 'null'}`);
    }
  }
}

console.log('=== Editorial Metadata v3 Projection Audit ===');
console.log('Approved decisions own final dist dates.');
console.log('Unapproved records retain their frozen observations until editorial review.');
console.log('RSS channel lastBuildDate is technical and is intentionally outside editorial comparison.');
console.log('');

if (!fs.existsSync(DIST)) {
  console.error('❌ dist/ missing; build production-like dist first');
  process.exit(1);
}
if (!fs.existsSync(REGISTRY_FILE)) {
  console.error('❌ editorial metadata registry missing');
  process.exit(1);
}

const registry = readRegistry();
const slotAuthority = readDatelineSlotAuthority();
errors.push(...validateRegistryV3(registry));
const shared = distSharedProjectionData();
const eligible = eligibleRecords();
const eligibleByRoute = new Map(eligible.map((record) => [record.route, record]));
let approved = 0;
let inconsistent = 0;
let frozen = 0;

for (const [route, record] of Object.entries(registry.records || {})) {
  const routeRecord = eligibleByRoute.get(route);
  if (!routeRecord) {
    errors.push(`${route}: registry route is no longer eligible/owned`);
    continue;
  }

  const current = observeRoute(routeRecord, DIST, shared);
  if (record.canonical !== current.canonical) errors.push(`${route}: canonical changed ${record.canonical} -> ${current.canonical}`);
  if (record.metadataSource !== current.metadataSource) errors.push(`${route}: metadataSource changed ${record.metadataSource} -> ${current.metadataSource}`);

  if (record.reviewStatus === 'approved') {
    approved += 1;
    canonicalProjectionChecks(route, record, current, slotAuthority);
    for (const [field, historical] of Object.entries(record.observations || {})) {
      const finalValue = current.observations[field] ?? null;
      if ((historical ?? null) !== finalValue) {
        warnings.push(`${route}: approved ${field} converged ${historical || 'null'} -> ${finalValue || 'null'}`);
      }
    }
  } else {
    frozenProjectionChecks(route, record, current);
    if (record.reviewStatus === 'inconsistent-needs-review') inconsistent += 1;
    else frozen += 1;
  }
}

for (const route of eligibleByRoute.keys()) {
  if (!registry.records?.[route]) errors.push(`${route}: eligible route missing from registry`);
}

console.log(`Eligible routes: ${eligible.length}`);
console.log(`Approved and projected: ${approved}`);
console.log(`Inconsistent, blocked pending editorial review: ${inconsistent}`);
console.log(`Migration freezes awaiting approval: ${frozen}`);
console.log(`Approved historical differences normalized by v3: ${warnings.length}`);

if (warnings.length) {
  warnings.slice(0, 20).forEach((warning) => console.log(`  - ${warning}`));
  if (warnings.length > 20) console.log(`  …and ${warnings.length - 20} more`);
}

if (errors.length) {
  console.error(`❌ Editorial Metadata v3 projection failed (${errors.length} error(s)):`);
  errors.slice(0, 100).forEach((error) => console.error(`  - ${error}`));
  if (errors.length > 100) console.error(`  …and ${errors.length - 100} more`);
  process.exit(1);
}

console.log('✅ Approved metadata converges; unapproved projections remain frozen');
