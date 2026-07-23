#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const {
  auditSearchIndexPolicy,
  validatePolicyShape,
} = require('./lib/search-index-policy-contract');

const route = '/fixture/';
const record = {
  route,
  owner: { status: 'production-dist' },
};
const policy = {
  indexPolicy: 'index',
  pagefindPolicy: 'include',
  searchManifestPolicy: 'include',
  sitemapPolicy: 'include',
  rssPolicy: 'exclude',
  contentKind: 'article',
  librarySection: 'Богословие',
  topicCategory: 'Тест',
};
const observed = {
  route,
  dist: {
    exists: true,
    noindex: false,
    pagefindBodyCount: 1,
    pagefindMetaCount: 0,
    pagefindFilterCount: 0,
  },
  membership: {
    searchManifest: true,
    sitemap: true,
    rss: false,
  },
};

function audit(registry, observations = [observed], records = [record]) {
  return auditSearchIndexPolicy({
    registry,
    productionRecords: records,
    observations,
  });
}

const clean = audit({ version: 1, routes: { [route]: policy } });
assert.deepEqual(clean.problems, [], clean.problems.join('\n'));
assert.equal(clean.productionRouteCount, 1);
assert.equal(clean.policyRouteCount, 1);

const missing = audit({ version: 1, routes: {} });
assert.ok(missing.problems.some((problem) => problem.includes('production route missing policy')));

const unexpected = audit({
  version: 1,
  routes: {
    [route]: policy,
    '/ghost/': policy,
  },
});
assert.ok(unexpected.problems.some((problem) => problem.includes('policy exists for non-production route')));

const invalidKind = validatePolicyShape(route, { ...policy, contentKind: 'essay' });
assert.ok(invalidKind.some((problem) => problem.includes('invalid contentKind')));

const noindexLeak = validatePolicyShape(route, {
  ...policy,
  indexPolicy: 'noindex',
  pagefindPolicy: 'include',
  searchManifestPolicy: 'include',
  sitemapPolicy: 'include',
  rssPolicy: 'include',
});
assert.equal(noindexLeak.filter((problem) => problem.includes('noindex requires')).length, 4);

const robotsDrift = audit(
  { version: 1, routes: { [route]: policy } },
  [{ ...observed, dist: { ...observed.dist, noindex: true } }]
);
assert.ok(robotsDrift.problems.some((problem) => problem.includes('dist.noindex=true')));

const pagefindDrift = audit(
  { version: 1, routes: { [route]: policy } },
  [{ ...observed, dist: { ...observed.dist, pagefindBodyCount: 0 } }]
);
assert.ok(pagefindDrift.problems.some((problem) => problem.includes('no data-pagefind-body')));

const manifestDrift = audit(
  { version: 1, routes: { [route]: policy } },
  [{ ...observed, membership: { ...observed.membership, searchManifest: false } }]
);
assert.ok(manifestDrift.problems.some((problem) => problem.includes('searchManifestPolicy=include')));

const sitemapDrift = audit(
  { version: 1, routes: { [route]: policy } },
  [{ ...observed, membership: { ...observed.membership, sitemap: false } }]
);
assert.ok(sitemapDrift.problems.some((problem) => problem.includes('sitemapPolicy=include')));

const rssDrift = audit(
  { version: 1, routes: { [route]: { ...policy, rssPolicy: 'include' } } },
  [observed]
);
assert.ok(rssDrift.problems.some((problem) => problem.includes('rssPolicy=include')));

console.log('✅ search/index policy mutation contract');
