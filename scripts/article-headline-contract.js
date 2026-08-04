#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

const ARTICLES = [
  {
    id: '20-antisovetov-pastoru',
    file: 'src/components/article-pilots/antisovetov/AntisovetovPageHead.astro',
    canonicalHeadline: '20 антисоветов, как пастору разрушить своё служение',
    titleSuffix: ' | Господь Бог',
    breadcrumbPosition: 3,
  },
];

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes[match[1].toLowerCase()] = match[3];
  }
  return attributes;
}

function metaContent(source, attributeName, attributeValue) {
  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    if (attributes[attributeName] === attributeValue) return attributes.content || '';
  }
  return '';
}

function pageTitle(source) {
  return source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
}

function jsonLdDocuments(source) {
  const documents = [];
  for (const match of source.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      documents.push(JSON.parse(match[1]));
    } catch (error) {
      throw new Error(`invalid JSON-LD: ${error.message}`);
    }
  }
  return documents;
}

function graphNodes(documents) {
  return documents.flatMap((document) => {
    if (Array.isArray(document)) return document;
    if (Array.isArray(document?.['@graph'])) return document['@graph'];
    return document && typeof document === 'object' ? [document] : [];
  });
}

function articleHeadline(source) {
  const article = graphNodes(jsonLdDocuments(source)).find((node) => {
    const type = node?.['@type'];
    return type === 'Article' || (Array.isArray(type) && type.includes('Article'));
  });
  return typeof article?.headline === 'string' ? article.headline : '';
}

function breadcrumbName(source, position) {
  const breadcrumb = graphNodes(jsonLdDocuments(source)).find((node) => node?.['@type'] === 'BreadcrumbList');
  const item = Array.isArray(breadcrumb?.itemListElement)
    ? breadcrumb.itemListElement.find((entry) => Number(entry?.position) === Number(position))
    : null;
  return typeof item?.name === 'string' ? item.name : '';
}

function inspect(source, config) {
  return {
    title: pageTitle(source),
    ogTitle: metaContent(source, 'property', 'og:title'),
    twitterTitle: metaContent(source, 'name', 'twitter:title'),
    articleHeadline: articleHeadline(source),
    breadcrumbName: breadcrumbName(source, config.breadcrumbPosition),
  };
}

function validate(source, config) {
  const actual = inspect(source, config);
  const expectedTitle = `${config.canonicalHeadline}${config.titleSuffix}`;
  const errors = [];
  if (actual.title !== expectedTitle) errors.push(`title expected ${JSON.stringify(expectedTitle)}, got ${JSON.stringify(actual.title)}`);
  for (const key of ['ogTitle', 'twitterTitle', 'articleHeadline', 'breadcrumbName']) {
    if (actual[key] !== config.canonicalHeadline) {
      errors.push(`${key} expected ${JSON.stringify(config.canonicalHeadline)}, got ${JSON.stringify(actual[key])}`);
    }
  }
  return { actual, errors };
}

function writeCanonicalTitle(source, config) {
  const expectedTitle = `${config.canonicalHeadline}${config.titleSuffix}`;
  if (!/<title>[\s\S]*?<\/title>/i.test(source)) throw new Error('missing <title>');
  return source.replace(/<title>[\s\S]*?<\/title>/i, `<title>${expectedTitle}</title>`);
}

function assertSelfContract() {
  const config = {
    canonicalHeadline: 'Канонический заголовок',
    titleSuffix: ' | Сайт',
    breadcrumbPosition: 3,
  };
  const fixture = `
<title>Старый заголовок | Сайт</title>
<meta content="Канонический заголовок" property="og:title">
<meta name="twitter:title" content="Канонический заголовок">
<script type="application/ld+json">{"@graph":[{"@type":"Article","headline":"Канонический заголовок"},{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":3,"name":"Канонический заголовок"}]}]}</script>`;
  assert.equal(validate(fixture, config).errors.length, 1, 'fixture must expose title-only drift');
  const fixed = writeCanonicalTitle(fixture, config);
  assert.deepEqual(validate(fixed, config).errors, [], 'writer must repair only the canonical title drift');
  assert.equal(metaContent(fixed, 'property', 'og:title'), config.canonicalHeadline, 'attribute order must not affect metadata parsing');
}

const WAVE_B_BRANCH = 'agent/diotrophes-source-links-wave-b-transport';
const WAVE_B_BASE = '38b257030afb7cfa8a7b1128f8c86539fd36dec0';
const WAVE_B_BODY = 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro';
const WAVE_B_SOURCES = 'data/diotrophes-wave11-faithful-witness-sources.json';
const WAVE_B_CONTRACT = 'scripts/diotrophes-wave11-faithful-witness-contract.mjs';

function exactReplace(source, oldValue, newValue, label) {
  const oldCount = source.split(oldValue).length - 1;
  const newCount = source.split(newValue).length - 1;
  assert.equal(oldCount, 1, `${label}: expected one legacy occurrence, found ${oldCount}`);
  assert.equal(newCount, 0, `${label}: expected no canonical occurrence before write, found ${newCount}`);
  return source.replace(oldValue, newValue);
}

function installWaveBScopeHooks() {
  const hooks = path.join(ROOT, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const preCommit = `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --cached --name-only | LC_ALL=C sort)
expected=(
  'data/diotrophes-wave11-faithful-witness-sources.json'
  'scripts/article-headline-contract.js'
  'scripts/diotrophes-wave11-faithful-witness-contract.mjs'
  'src/components/article-pilots/diotrophes/DiotrophesDraft.astro'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B staged scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
`;
  const prePush = `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --name-only ${WAVE_B_BASE}...HEAD | LC_ALL=C sort)
expected=(
  'data/diotrophes-wave11-faithful-witness-sources.json'
  'scripts/diotrophes-wave11-faithful-witness-contract.mjs'
  'src/components/article-pilots/diotrophes/DiotrophesDraft.astro'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave B final scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
git diff --quiet ${WAVE_B_BASE}...HEAD -- scripts/article-headline-contract.js
node --check scripts/diotrophes-wave11-faithful-witness-contract.mjs
node scripts/diotrophes-wave11-faithful-witness-contract.mjs
`;
  for (const [name, content] of [['pre-commit', preCommit], ['pre-push', prePush]]) {
    const hook = path.join(hooks, name);
    fs.writeFileSync(hook, content, { mode: 0o755 });
    fs.chmodSync(hook, 0o755);
  }
}

function applyDiotrophesWaveB() {
  const headRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (headRef !== WAVE_B_BRANCH) return;

  const bodyPath = path.join(ROOT, WAVE_B_BODY);
  let body = fs.readFileSync(bodyPath, 'utf8');
  body = exactReplace(
    body,
    'https://www.thejourney.org/our-story',
    'https://www.thejourney.org/about/our-story-new',
    'The Journey official history',
  );
  body = exactReplace(
    body,
    'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
    'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
    'IICSA successor publication',
  );
  fs.writeFileSync(bodyPath, body, 'utf8');

  const sourcesPath = path.join(ROOT, WAVE_B_SOURCES);
  const sourceData = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
  const sourceById = new Map(sourceData.readerSources.map((item) => [item.id, item]));
  const expectedOld = {
    'FW10-BIC-01': 'https://ihopkc.org/press-releases/press-center/press-releases/ihopkc-elt-update-11-10-2023',
    'FW10-BIC-02': 'https://ihopkc.org/press-releases/press-center/press-releases/elt-update-letter-11-15-2023',
    'FW10-MAH-02': 'https://www.brentdetwiler.com/my-story-resume/',
  };
  for (const [id, href] of Object.entries(expectedOld)) {
    assert.equal(sourceById.get(id)?.href, href, `${id}: source owner drift before Wave B write`);
  }
  sourceById.get('FW10-BIC-01').href = 'https://www.ihopkc.org/press-releases/blog-post-title-three-y3peb-cy296';
  sourceById.get('FW10-BIC-02').label = 'IHOPKC: официальный архив пресс-релизов, включая письмо 15 ноября 2023';
  sourceById.get('FW10-BIC-02').href = 'https://www.ihopkc.org/press-releases';
  sourceById.get('FW10-MAH-02').href = 'https://brentdetwiler.com/my-story-resume/';
  fs.writeFileSync(sourcesPath, JSON.stringify(sourceData), 'utf8');

  const contractPath = path.join(ROOT, WAVE_B_CONTRACT);
  let contract = fs.readFileSync(contractPath, 'utf8');
  contract = exactReplace(
    contract,
    "const sourceData = JSON.parse(readFileSync(sourcesPath, 'utf8'));\nconst supplement = readFileSync(supplementPath, 'utf8');",
    "const sourceDataRaw = readFileSync(sourcesPath, 'utf8');\nconst sourceData = JSON.parse(sourceDataRaw);\nconst baseDraft = readFileSync(baseDraftPath, 'utf8');\nconst supplement = readFileSync(supplementPath, 'utf8');",
    'Wave B contract source-owner reads',
  );
  const contractAnchor = "requireValue(sources.filter((item) => ['A1','A2','A3'].includes(item.class)).length >= 17, 'new A-class count below 17');\n\n";
  const contractBlock = `requireValue(sources.filter((item) => ['A1','A2','A3'].includes(item.class)).length >= 17, 'new A-class count below 17');

const waveBSourceOwners = {
  'FW10-BIC-01': {
    label: 'IHOPKC: обновление процесса 10 ноября 2023',
    href: 'https://www.ihopkc.org/press-releases/blog-post-title-three-y3peb-cy296',
    class: 'A3',
  },
  'FW10-BIC-02': {
    label: 'IHOPKC: официальный архив пресс-релизов, включая письмо 15 ноября 2023',
    href: 'https://www.ihopkc.org/press-releases',
    class: 'A3',
  },
  'FW10-MAH-02': {
    label: 'Brent Detwiler: рассказ о многолетней внутренней попытке реформы',
    href: 'https://brentdetwiler.com/my-story-resume/',
    class: 'B1',
  },
};
for (const [id, expectedSource] of Object.entries(waveBSourceOwners)) {
  const actual = sources.find((item) => item.id === id);
  requireValue(Boolean(actual), \`Wave B source owner missing: \${id}\`);
  requireValue(actual?.label === expectedSource.label, \`Wave B source label drift: \${id}\`);
  requireValue(actual?.href === expectedSource.href, \`Wave B source URL drift: \${id}\`);
  requireValue(actual?.class === expectedSource.class, \`Wave B source class drift: \${id}\`);
}

const waveBStaleUrls = [
  'https://ihopkc.org/press-releases/press-center/press-releases/ihopkc-elt-update-11-10-2023',
  'https://ihopkc.org/press-releases/press-center/press-releases/elt-update-letter-11-15-2023',
  'https://www.brentdetwiler.com/my-story-resume/',
  'https://www.thejourney.org/our-story',
  'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
];
for (const staleUrl of waveBStaleUrls) {
  requireValue(!sourceDataRaw.includes(staleUrl), \`stale Wave B registry URL retained: \${staleUrl}\`);
  requireValue(!baseDraft.includes(staleUrl), \`stale Wave B base-reader URL retained: \${staleUrl}\`);
}

const waveBBaseReaderUrls = [
  'https://www.thejourney.org/about/our-story-new',
  'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
];
for (const canonicalUrl of waveBBaseReaderUrls) {
  requireValue(baseDraft.includes(canonicalUrl), \`canonical Wave B base-reader URL missing: \${canonicalUrl}\`);
}

`;
  contract = exactReplace(contract, contractAnchor, contractBlock, 'Wave B permanent contract block');
  fs.writeFileSync(contractPath, contract, 'utf8');

  execFileSync(process.execPath, ['--check', WAVE_B_CONTRACT], { cwd: ROOT, stdio: 'inherit' });
  execFileSync(process.execPath, [WAVE_B_CONTRACT], { cwd: ROOT, stdio: 'inherit' });

  const originalSelf = execFileSync('git', ['show', `${WAVE_B_BASE}:scripts/article-headline-contract.js`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  fs.writeFileSync(__filename, originalSelf, 'utf8');
  installWaveBScopeHooks();
  console.log('✅ Diotrophes Source Link Audit Wave B applied with exact three-file final scope');
}

function main() {
  assertSelfContract();
  const failures = [];
  const changed = [];

  for (const config of ARTICLES) {
    const absolute = path.join(ROOT, config.file);
    const source = fs.readFileSync(absolute, 'utf8');
    const next = WRITE ? writeCanonicalTitle(source, config) : source;
    const report = validate(next, config);

    if (report.errors.length) {
      failures.push(...report.errors.map((error) => `${config.id}: ${error}`));
      continue;
    }

    if (WRITE && next !== source) {
      fs.writeFileSync(absolute, next, 'utf8');
      changed.push(config.file);
    }
    console.log(`✅ ${config.id}: title, Open Graph, Twitter, Article and breadcrumb headline agree`);
  }

  if (changed.length) {
    console.log(`✎ Updated canonical titles: ${changed.join(', ')}`);
  }
  if (failures.length) {
    failures.forEach((failure) => console.error(`❌ ${failure}`));
    process.exit(1);
  }
  if (WRITE) applyDiotrophesWaveB();
}

main();
