'use strict';

const fs = require('fs');
const path = require('path');

const READY_STATUS = 'ready';
const HUB_VISIBLE_STATES = new Set(['featured', 'listed']);

function isAtlasSheetDraft(route) {
  return Boolean(route?.meta?.sheet_no != null && route?.meta?.id == null);
}

function readRouteRecord(routesRoot, slug) {
  const file = path.join(routesRoot, slug, 'route.json');
  const route = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.freeze({
    slug,
    route,
    publication: route.publication || null,
  });
}

function isTechnicalReady(record) {
  const publication = record.publication;
  return Boolean(
    publication &&
    publication.status === READY_STATUS &&
    publication.indexable === true &&
    publication.sitemap === true &&
    publication.pagefind === true &&
    typeof publication.llms === 'boolean'
  );
}

function isHubPublished(record) {
  const publication = record.publication;
  return isTechnicalReady(record) && HUB_VISIBLE_STATES.has(publication.hub);
}

function getKartyHubInventory(root = process.cwd()) {
  const routesRoot = path.join(root, 'karty');
  const records = fs.readdirSync(routesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(path.join(routesRoot, slug, 'route.json')))
    .map((slug) => readRouteRecord(routesRoot, slug))
    .filter((record) => !isAtlasSheetDraft(record.route))
    .sort((left, right) => left.slug.localeCompare(right.slug));

  const routeSlugs = records.map((record) => record.slug);
  const readyRecords = records.filter(isTechnicalReady);
  const publishedRecords = records
    .filter(isHubPublished)
    .sort((left, right) => {
      const a = Number(left.publication?.hub_order ?? Number.MAX_SAFE_INTEGER);
      const b = Number(right.publication?.hub_order ?? Number.MAX_SAFE_INTEGER);
      return a - b || left.slug.localeCompare(right.slug);
    });
  const publishedSet = new Set(publishedRecords.map((record) => record.slug));
  const readySlugs = readyRecords.map((record) => record.slug);
  const publishedSlugs = publishedRecords.map((record) => record.slug);
  const auditSlugs = routeSlugs.filter((slug) => !publishedSet.has(slug));

  return Object.freeze({
    records: Object.freeze(records),
    routeSlugs: Object.freeze(routeSlugs),
    readySlugs: Object.freeze(readySlugs),
    publishedSlugs: Object.freeze(publishedSlugs),
    auditSlugs: Object.freeze(auditSlugs),
    publishedRecords: Object.freeze(publishedRecords),
    routeCount: routeSlugs.length,
    readyCount: readySlugs.length,
    publishedCount: publishedSlugs.length,
    auditCount: auditSlugs.length,
  });
}

module.exports = {
  READY_STATUS,
  HUB_VISIBLE_STATES,
  getKartyHubInventory,
  isAtlasSheetDraft,
  isTechnicalReady,
  isHubPublished,
};
