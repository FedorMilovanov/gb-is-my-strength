'use strict';

const fs = require('fs');
const path = require('path');

const PUBLISHED_KARTY_SLUGS = Object.freeze(['avraam']);

function isAtlasSheetDraft(route) {
  return Boolean(route?.meta?.sheet_no != null && route?.meta?.id == null);
}

function getKartyHubInventory(root = process.cwd()) {
  const routesRoot = path.join(root, 'karty');
  const routeSlugs = fs.readdirSync(routesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(routesRoot, slug, 'route.json')))
    .filter((slug) => {
      const route = JSON.parse(fs.readFileSync(path.join(routesRoot, slug, 'route.json'), 'utf8'));
      return !isAtlasSheetDraft(route);
    })
    .sort();

  const routeSet = new Set(routeSlugs);
  const missingPublishedSlugs = PUBLISHED_KARTY_SLUGS.filter((slug) => !routeSet.has(slug));
  if (missingPublishedSlugs.length) {
    throw new Error(`Published Karty route(s) missing route.json: ${missingPublishedSlugs.join(', ')}`);
  }

  const publishedSlugs = PUBLISHED_KARTY_SLUGS.filter((slug) => routeSet.has(slug));
  const publishedSet = new Set(publishedSlugs);
  const auditSlugs = routeSlugs.filter((slug) => !publishedSet.has(slug));

  return Object.freeze({
    routeSlugs: Object.freeze(routeSlugs),
    publishedSlugs: Object.freeze(publishedSlugs),
    auditSlugs: Object.freeze(auditSlugs),
    routeCount: routeSlugs.length,
    publishedCount: publishedSlugs.length,
    auditCount: auditSlugs.length,
  });
}

module.exports = {
  PUBLISHED_KARTY_SLUGS,
  getKartyHubInventory,
  isAtlasSheetDraft,
};
