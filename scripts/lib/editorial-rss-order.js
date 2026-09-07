'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeRoute } = require('./rss-route-contract');

function elementText(xml, name) {
  const match = String(xml || '').match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? match[1].trim() : '';
}

function projectCanonicalRssOrder({ distRoot, registry, dryRun = false }) {
  const feedFile = path.join(distRoot, 'feed.xml');
  if (!fs.existsSync(feedFile)) throw new Error(`RSS projection missing: ${feedFile}`);

  const source = fs.readFileSync(feedFile, 'utf8');
  const itemPattern = /<item>([\s\S]*?)<\/item>/giu;
  const blocks = [...source.matchAll(itemPattern)].map((match) => match[0]);
  if (!blocks.length) throw new Error('RSS projection contains no items');

  const records = registry?.records || {};
  const entries = blocks.map((block) => {
    const link = elementText(block, 'link');
    if (!link) throw new Error('RSS item missing link while ordering by editorial authority');
    const route = normalizeRoute(link);
    const record = records[route];
    if (!record) throw new Error(`${route}: RSS item has no approved editorial metadata record`);
    const timestamp = Date.parse(record.editorialPublishedAt || '');
    if (!Number.isFinite(timestamp)) throw new Error(`${route}: RSS item has no valid editorialPublishedAt`);
    return { block, route, timestamp };
  });

  const sorted = [...entries].sort((left, right) => {
    const byDate = right.timestamp - left.timestamp;
    return byDate || left.route.localeCompare(right.route, 'ru');
  });
  let index = 0;
  const projected = source.replace(itemPattern, () => sorted[index++].block);
  const changed = projected !== source;

  if (dryRun && changed) {
    throw new Error('RSS item order differs from canonical editorial chronology');
  }
  if (!dryRun && changed) fs.writeFileSync(feedFile, projected, 'utf8');

  return {
    items: entries.length,
    changed,
    firstRoute: sorted[0]?.route || null,
    lastRoute: sorted[sorted.length - 1]?.route || null,
  };
}

module.exports = { projectCanonicalRssOrder };
