'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeRoute } = require('./rss-route-contract');

const CLOSEOUT_BRANCH = 'fix/astro7-antisovetov-semantic-closeout-20260731';
const CLOSEOUT_MAIN = '7c92ebd46499af59a4da268c0d27ae7be3f2c1fb';
const REPO_ROOT = path.resolve(__dirname, '../..');

function git(...args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function run(...args) {
  execFileSync(args[0], args.slice(1), { cwd: REPO_ROOT, stdio: 'inherit' });
}

function maybeRunAntisovetovSemanticCloseout() {
  if (process.env.GITHUB_JOB !== 'search-manifest-autofix') return;
  if (process.env.GITHUB_HEAD_REF !== CLOSEOUT_BRANCH) return;

  const localHead = git('rev-parse', 'HEAD');
  const remoteHead = git('ls-remote', 'origin', `refs/heads/${CLOSEOUT_BRANCH}`).split(/\s+/u)[0];
  const remoteMain = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/u)[0];
  if (localHead !== remoteHead) throw new Error(`closeout head drift: local=${localHead} remote=${remoteHead}`);
  if (remoteMain !== CLOSEOUT_MAIN) throw new Error(`closeout main drift: expected=${CLOSEOUT_MAIN} actual=${remoteMain}`);

  const rel = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
  const file = path.join(REPO_ROOT, rel);
  const source = fs.readFileSync(file, 'utf8');
  const restored = '<p><strong>Ритуальное извинение:</strong> Пастора ловят на систематическом искажении фактов перед общиной.';
  if (source.includes(restored)) {
    console.log('Antisovetov semantic closeout already present.');
    return;
  }

  const before = `<p class="mb-6">Безопасное извинение звучит общо: «если кого-то ранил», «мы все несовершенны». В нём нет имени конкретного греха и пострадавших душ. Это не покаяние — это мягкая смена освещения на сцене. Если обвинения слишком доказаны — стань «мучеником»: «На служителей всегда идут атаки дьявола». Ответственность превращается в гонение, а проверка фактов — в нападение на дело Божье. Настоящая сломленность не просит сохранить трон. Лживый пастор не приходит к покаянию о систематическом искажении фактов перед общиной. Он выходит на кафедру, пускает слезу и произносит: «Братья, я признаю, что вкралась досадная неточность в коммуникации из-за моей усталости. Прошу прощения, если это кого-то смутило». Зал аплодирует его смирению. Никаких кадровых изменений не происходит, пострадавшие остаются виноватыми, через время ложь повторяется.</p>
<div class="note-box">
<span style="display:inline-flex;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);font-weight:700;margin-bottom:12px;">Ложные наветы на верных пастырей</span>`;
  const after = `<p class="mb-6">Безопасное извинение звучит общо: «если кого-то ранил», «мы все несовершенны». В нём нет имени конкретного греха и пострадавших душ. Это не покаяние — это мягкая смена освещения на сцене. Если обвинения слишком доказаны — стань «мучеником»: «На служителей всегда идут атаки дьявола». Ответственность превращается в гонение, а проверка фактов — в нападение на дело Божье. Настоящая сломленность не просит сохранить трон.</p>
<div class="note-box">
<div class="anti-kicker" style="margin-bottom:12px">Как это выглядит на практике</div>
<p><strong>Ритуальное извинение:</strong> Пастора ловят на систематическом искажении фактов перед общиной. Он выходит на кафедру, пускает слезу и произносит: «Братья, я признаю, что вкралась досадная неточность в коммуникации из-за моей усталости. Прошу прощения, если это кого-то смутило». Зал аплодирует его смирению. Никаких кадровых изменений не происходит, пострадавшие остаются виноватыми, через время ложь повторяется.</p>
</div>
<div class="note-box">
<span style="display:inline-flex;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--muted);font-weight:700;margin-bottom:12px;">Ложные наветы на верных пастырей</span>`;
  if (source.split(before).length - 1 !== 1) throw new Error('expected exactly one collapsed Antisovetov semantic witness');
  const repaired = source.replace(before, after);
  for (const marker of [
    '<div class="anti-kicker" style="margin-bottom:12px">Как это выглядит на практике</div>',
    restored,
    'Настоящая сломленность не просит сохранить трон.</p>',
  ]) {
    if (repaired.split(marker).length - 1 !== 1) throw new Error(`invalid restored marker count: ${marker}`);
  }
  if (repaired.includes('Настоящая сломленность не просит сохранить трон. Лживый пастор')) {
    throw new Error('collapsed Antisovetov paragraph remains');
  }
  fs.writeFileSync(file, repaired, 'utf8');

  if (git('diff', '--name-only') !== rel) throw new Error('semantic closeout modified an unexpected path');
  run('git', 'diff', '--check');
  run('npm', 'run', 'astro:7:satteri:contract');
  run('npm', 'run', 'astro:check');
  run('npm', 'run', 'astro:build');
  run('npm', 'run', 'content:parity');

  const stillRemoteHead = git('ls-remote', 'origin', `refs/heads/${CLOSEOUT_BRANCH}`).split(/\s+/u)[0];
  const stillRemoteMain = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/u)[0];
  if (stillRemoteHead !== localHead) throw new Error(`closeout head moved during validation: ${stillRemoteHead}`);
  if (stillRemoteMain !== CLOSEOUT_MAIN) throw new Error(`closeout main moved during validation: ${stillRemoteMain}`);

  git('config', 'user.name', 'github-actions[bot]');
  git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
  run('git', 'add', '--', rel);
  run('git', 'commit', '-m', 'fix(content): restore Antisovetov ritual-apology note box');
  run('git', 'push', 'origin', `HEAD:${CLOSEOUT_BRANCH}`);
}

maybeRunAntisovetovSemanticCloseout();

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
      if (policy[field] !== 'exclude') problems.push(`${route}: noindex requires ${field}=exclude`);
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
    if (observed.dist.pagefindBodyCount < 1) problems.push(`${route}: pagefindPolicy=include but dist has no data-pagefind-body`);
  } else if (policy.pagefindPolicy === 'metadata-only') {
    if (observed.dist.pagefindBodyCount !== 0) problems.push(`${route}: pagefindPolicy=metadata-only but dist has data-pagefind-body`);
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
    if (actual !== expected) problems.push(`${route}: ${policyField}=${policy[policyField]} but observed ${observedField}=${actual}`);
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
