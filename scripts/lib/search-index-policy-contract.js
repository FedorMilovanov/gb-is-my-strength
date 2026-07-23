'use strict';

const { normalizeRoute } = require('./rss-route-contract');

const POLICY_FIELDS = Object.freeze([
  'indexPolicy',
  'pagefindPolicy',
  'searchManifestPolicy',
  'sitemapPolicy',
  'rssPolicy',
  'contentKind',
  'librarySection',
  'topicCategory',
]);

const POLICY_ENUMS = Object.freeze({
  indexPolicy: new Set(['index', 'noindex']),
  pagefindPolicy: new Set(['include', 'metadata-only', 'exclude']),
  searchManifestPolicy: new Set(['include', 'exclude']),
  sitemapPolicy: new Set(['include', 'exclude']),
  rssPolicy: new Set(['include', 'exclude']),
  contentKind: new Set(['article', 'translation', 'series-article', 'landing', 'tool', 'app', 'personal']),
});

function normalizePolicyRoutes(registry) {
  const routes = registry && typeof registry.routes === 'object' && registry.routes !== null
    ? registry.routes
    : {};
  return new Map(Object.entries(routes).map(([route, policy]) => [normalizeRoute(route), policy]));
}

function boolPolicy(value) {
  return value === 'include';
}

function validatePolicyShape(route, policy) {
  const problems = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return [`${route}: policy must be an object`];
  }

  for (const field of POLICY_FIELDS) {
    const value = policy[field];
    if (value == null || value === '') {
      problems.push(`${route}: missing ${field}`);
      continue;
    }
    if (POLICY_ENUMS[field] && !POLICY_ENUMS[field].has(value)) {
      problems.push(`${route}: invalid ${field}=${JSON.stringify(value)}`);
    }
    if (!POLICY_ENUMS[field] && typeof value !== 'string') {
      problems.push(`${route}: ${field} must be a non-empty string`);
    }
  }

  if (policy.indexPolicy === 'noindex') {
    for (const field of ['pagefindPolicy', 'searchManifestPolicy', 'sitemapPolicy', 'rssPolicy']) {
      if (policy[field] !== 'exclude') {
        problems.push(`${route}: noindex requires ${field}=exclude`);
      }
    }
  }

  if (policy.contentKind === 'personal' && policy.indexPolicy !== 'noindex') {
    problems.push(`${route}: personal content must be noindex`);
  }

  return problems;
}

function compareObserved(route, policy, observed) {
  const problems = [];
  if (!observed) return [`${route}: production observation missing`];

  const expectedNoindex = policy.indexPolicy === 'noindex';
  if (observed.dist.noindex !== expectedNoindex) {
    problems.push(`${route}: indexPolicy=${policy.indexPolicy} but dist.noindex=${observed.dist.noindex}`);
  }

  if (policy.pagefindPolicy === 'include') {
    if (observed.dist.pagefindBodyCount < 1) {
      problems.push(`${route}: pagefindPolicy=include but dist has no data-pagefind-body`);
    }
  } else if (policy.pagefindPolicy === 'metadata-only') {
    if (observed.dist.pagefindBodyCount !== 0) {
      problems.push(`${route}: pagefindPolicy=metadata-only but dist has data-pagefind-body`);
    }
    if (observed.dist.pagefindMetaCount < 1 && observed.dist.pagefindFilterCount < 1) {
      problems.push(`${route}: pagefindPolicy=metadata-only but dist has no Pagefind metadata/filter marker`);
    }
  } else if (policy.pagefindPolicy === 'exclude' && observed.dist.pagefindBodyCount !== 0) {
    problems.push(`${route}: pagefindPolicy=exclude but dist has data-pagefind-body`);
  }

  const membershipChecks = [
    ['searchManifestPolicy', 'searchManifest'],
    ['sitemapPolicy', 'sitemap'],
    ['rssPolicy', 'rss'],
  ];
  for (const [policyField, observedField] of membershipChecks) {
    const expected = boolPolicy(policy[policyField]);
    const actual = Boolean(observed.membership[observedField]);
    if (actual !== expected) {
      problems.push(`${route}: ${policyField}=${policy[policyField]} but observed ${observedField}=${actual}`);
    }
  }

  return problems;
}

function auditSearchIndexPolicy({ registry, productionRecords, observations }) {
  const policyRoutes = normalizePolicyRoutes(registry);
  const productionRoutes = new Set(
    (productionRecords || [])
      .filter((record) => record?.owner?.status === 'production-dist')
      .map((record) => normalizeRoute(record.route))
  );
  const observationsByRoute = new Map((observations || []).map((item) => [normalizeRoute(item.route), item]));
  const missingPolicyRoutes = [...productionRoutes].filter((route) => !policyRoutes.has(route)).sort();
  const unexpectedPolicyRoutes = [...policyRoutes.keys()].filter((route) => !productionRoutes.has(route)).sort();
  const problems = [
    ...missingPolicyRoutes.map((route) => `${route}: production route missing policy`),
    ...unexpectedPolicyRoutes.map((route) => `${route}: policy exists for non-production route`),
  ];

  const routeResults = [];
  for (const route of [...productionRoutes].sort()) {
    const policy = policyRoutes.get(route);
    const observed = observationsByRoute.get(route);
    const routeProblems = [
      ...validatePolicyShape(route, policy),
      ...(policy ? compareObserved(route, policy, observed) : []),
    ];
    problems.push(...routeProblems);
    routeResults.push({ route, policy: policy || null, observed: observed || null, problems: routeProblems });
  }

  return {
    version: registry?.version || null,
    productionRouteCount: productionRoutes.size,
    policyRouteCount: policyRoutes.size,
    missingPolicyRoutes,
    unexpectedPolicyRoutes,
    problems,
    routeResults,
  };
}

module.exports = {
  POLICY_FIELDS,
  POLICY_ENUMS,
  normalizePolicyRoutes,
  validatePolicyShape,
  compareObserved,
  auditSearchIndexPolicy,
};
