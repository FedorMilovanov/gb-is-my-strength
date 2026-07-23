#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadRouteRecords } = require('./lib/effective-route-registry');
const { auditRss, renderRss } = require('./lib/rss-route-contract');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');
const FEED_FILE = path.join(ROOT, 'feed.xml');
const args = new Set(process.argv.slice(2));
const write = args.has('--write');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
const loaded = loadRouteRecords();
const expected = renderRss(manifest, loaded);
const current = fs.existsSync(FEED_FILE) ? fs.readFileSync(FEED_FILE, 'utf8') : '';

if (write) {
  if (current === expected) {
    console.log('✅ feed.xml already matches the canonical RSS route contract');
  } else {
    fs.writeFileSync(FEED_FILE, expected, 'utf8');
    console.log(`✅ feed.xml regenerated from search manifest (${auditRss(expected, manifest, loaded).expectedRoutes.length} routes)`);
  }
  process.exit(0);
}

const audit = auditRss(current, manifest, loaded);
if (current !== expected || audit.errors.length) {
  console.error('❌ feed.xml does not match the canonical RSS route contract');
  for (const error of audit.errors.slice(0, 80)) console.error(`- ${error}`);
  if (audit.errors.length > 80) console.error(`- ... ${audit.errors.length - 80} more`);
  console.error('Run: node scripts/rss-route-contract.js --write');
  process.exit(1);
}

console.log(`✅ RSS route contract: ${audit.expectedRoutes.length} deterministic manifest-backed routes`);
