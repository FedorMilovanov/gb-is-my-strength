#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { collectProductionHtmlTargets } = require('./lib/seo-route-targets');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://gospod-bog.ru';
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
const auditRoot = path.resolve(ROOT, rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : 'dist');

function metaValues(html, attr, name) {
  const tags = [...String(html).matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const values = [];
  for (const tag of tags) {
    const key = tag.match(new RegExp(`\\b${attr}=["']([^"']+)["']`, 'i'))?.[1];
    if (key !== name) continue;
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    values.push(content ?? '');
  }
  return values;
}

function localAssetExists(url) {
  if (!url.startsWith(`${BASE}/`)) return true;
  const relative = url.slice(BASE.length + 1).split(/[?#]/)[0];
  return fs.existsSync(path.join(auditRoot, relative));
}

let errors = 0;
const targets = collectProductionHtmlTargets(auditRoot);
for (const target of targets) {
  if (!target.exists) {
    console.log(`❌ ${target.route}: production HTML missing: ${target.htmlRelative}`);
    errors++;
    continue;
  }
  const html = fs.readFileSync(target.absolute, 'utf8');
  const card = metaValues(html, 'name', 'twitter:card');
  if (!card.includes('summary_large_image')) continue;

  const checks = [
    ['og:image', metaValues(html, 'property', 'og:image')],
    ['og:image:width', metaValues(html, 'property', 'og:image:width')],
    ['og:image:height', metaValues(html, 'property', 'og:image:height')],
    ['twitter:image', metaValues(html, 'name', 'twitter:image')],
    ['twitter:site', metaValues(html, 'name', 'twitter:site')],
    ['twitter:creator', metaValues(html, 'name', 'twitter:creator')],
  ];
  for (const [name, values] of checks) {
    if (values.length !== 1 || !values[0]) {
      console.log(`❌ ${target.route}: expected exactly one non-empty ${name}, found ${values.length}`);
      errors++;
    }
  }

  for (const image of [
    ...metaValues(html, 'property', 'og:image'),
    ...metaValues(html, 'name', 'twitter:image'),
  ]) {
    if (image && !localAssetExists(image)) {
      console.log(`❌ ${target.route}: social image file missing: ${image}`);
      errors++;
    }
  }
}

if (errors) {
  console.log(`\nSocial card audit failed: ${errors} errors across ${targets.length} production routes.`);
  process.exit(1);
}
console.log(`✅ Social card audit passed: ${targets.length} production routes, unique large-card metadata.`);
