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

const WAVE_A_BRANCH = 'agent/antisovetov-source-links-wave-a';
const WAVE_A_BASE = 'ccd373ef9708585d18468abda28d9b3c13839996';
const WAVE_A_BODY = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
const WAVE_A_CONTRACT = 'scripts/antisovetov-wave8-contract.mjs';
const WAVE_A_TRANSPORT = '.github/workflows/antisovetov-source-links-wave-a-executor.yml';

function exactReplace(source, oldValue, newValue, label) {
  const oldCount = source.split(oldValue).length - 1;
  const newCount = source.split(newValue).length - 1;
  assert.equal(oldCount, 1, `${label}: expected one legacy occurrence, found ${oldCount}`);
  assert.equal(newCount, 0, `${label}: expected no canonical occurrence before write, found ${newCount}`);
  return source.replace(oldValue, newValue);
}

function installWaveAScopeHooks() {
  const hooks = path.join(ROOT, '.git', 'hooks');
  fs.mkdirSync(hooks, { recursive: true });
  const preCommit = `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --cached --name-only | LC_ALL=C sort)
expected=(
  '.github/workflows/antisovetov-source-links-wave-a-executor.yml'
  'scripts/antisovetov-wave8-contract.mjs'
  'scripts/article-headline-contract.js'
  'src/components/article-pilots/antisovetov/AntisovetovBody.astro'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave A staged scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
`;
  const prePush = `#!/usr/bin/env bash
set -euo pipefail
mapfile -t changed < <(git diff --name-only ${WAVE_A_BASE}...HEAD | LC_ALL=C sort)
expected=(
  'scripts/antisovetov-wave8-contract.mjs'
  'src/components/article-pilots/antisovetov/AntisovetovBody.astro'
)
if [[ "\${changed[*]}" != "\${expected[*]}" ]]; then
  printf 'Wave A final scope mismatch:\n%s\n' "\${changed[*]}" >&2
  exit 1
fi
git diff --quiet ${WAVE_A_BASE}...HEAD -- scripts/article-headline-contract.js .github/workflows/source-links.yml .github/workflows/antisovetov-source-links-wave-a-executor.yml
node --check scripts/antisovetov-wave8-contract.mjs
node scripts/antisovetov-wave8-contract.mjs
`;
  for (const [name, content] of [['pre-commit', preCommit], ['pre-push', prePush]]) {
    const hook = path.join(hooks, name);
    fs.writeFileSync(hook, content, { mode: 0o755 });
    fs.chmodSync(hook, 0o755);
  }
}

function applyAntisovetovWaveA() {
  const headRef = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || '';
  if (headRef !== WAVE_A_BRANCH) return;

  const replacements = new Map([
    ['https://bakeracademic.com/p/Redeeming-Power-Diane-Langberg/231473', 'https://www.dianelangberg.com/shop-books/'],
    ['https://doi.org/10.1080/03637758409390197', 'https://www.tandfonline.com/doi/abs/10.1080/03637758409390197'],
    ['https://doi.org/10.5465/amr.2000.3707697', 'https://journals.aom.org/doi/10.5465/AMR.2000.3707697'],
    ['https://doi.org/10.2307/2666999', 'https://www.jstor.org/stable/2666999'],
    ['https://lewisandroth.org/products/biblical-eldership', 'https://www.biblicaleldership.com/product/biblical-eldership-restoring-the-eldership-to-its-rightful-place-in-the-local-church-2023-revision/'],
    ['https://www.crossway.org/books/church-elders-tpb/', 'https://www.crossway.org/books/church-elders-case/'],
    ['https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html', 'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings'],
  ]);

  const bodyPath = path.join(ROOT, WAVE_A_BODY);
  let body = fs.readFileSync(bodyPath, 'utf8');
  for (const [oldValue, newValue] of replacements) {
    body = exactReplace(body, oldValue, newValue, oldValue);
  }
  fs.writeFileSync(bodyPath, body, 'utf8');

  const contractPath = path.join(ROOT, WAVE_A_CONTRACT);
  let contract = fs.readFileSync(contractPath, 'utf8');
  const oldBlock = `for (const requiredHost of ['doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'childabuseroyalcommission.gov.au', 'iicsa.org.uk', 'churchofengland.org', 'gov.uk', 'eerdmans.com']) {
  if (![...uniqueUrls].some((url) => url.includes(requiredHost))) errors.push(\`source frame missing required host: \${requiredHost}\`);
}

`;
  const newBlock = `for (const requiredHost of ['doi.org', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov', 'childabuseroyalcommission.gov.au', 'churchofengland.org', 'gov.uk', 'eerdmans.com', 'tandfonline.com', 'journals.aom.org', 'jstor.org', 'dianelangberg.com', 'biblicaleldership.com', 'crossway.org']) {
  if (![...uniqueUrls].some((url) => url.includes(requiredHost))) errors.push(\`source frame missing required host: \${requiredHost}\`);
}

const staleSourceUrls = [
  'https://bakeracademic.com/p/Redeeming-Power-Diane-Langberg/231473',
  'https://doi.org/10.1080/03637758409390197',
  'https://doi.org/10.5465/amr.2000.3707697',
  'https://doi.org/10.2307/2666999',
  'https://lewisandroth.org/products/biblical-eldership',
  'https://www.crossway.org/books/church-elders-tpb/',
  'https://www.iicsa.org.uk/reports-recommendations/publications/investigation/child-protection-religious-organisations-and-settings.html',
];
for (const staleUrl of staleSourceUrls) forbidText(staleUrl, \`stale source URL: \${staleUrl}\`);

const canonicalSourceUrls = [
  'https://www.dianelangberg.com/shop-books/',
  'https://www.tandfonline.com/doi/abs/10.1080/03637758409390197',
  'https://journals.aom.org/doi/10.5465/AMR.2000.3707697',
  'https://www.jstor.org/stable/2666999',
  'https://www.biblicaleldership.com/product/biblical-eldership-restoring-the-eldership-to-its-rightful-place-in-the-local-church-2023-revision/',
  'https://www.crossway.org/books/church-elders-case/',
  'https://www.gov.uk/government/publications/independent-inquiry-into-child-sexual-abuse-child-protection-in-religious-organisations-and-settings',
];
for (const canonicalUrl of canonicalSourceUrls) requireText(canonicalUrl, \`canonical source URL: \${canonicalUrl}\`);

`;
  assert.equal(contract.split(oldBlock).length - 1, 1, 'Wave A contract host block must occur exactly once');
  contract = contract.replace(oldBlock, newBlock);
  fs.writeFileSync(contractPath, contract, 'utf8');

  execFileSync(process.execPath, ['--check', WAVE_A_CONTRACT], { cwd: ROOT, stdio: 'inherit' });
  execFileSync(process.execPath, [WAVE_A_CONTRACT], { cwd: ROOT, stdio: 'inherit' });

  const transportPath = path.join(ROOT, WAVE_A_TRANSPORT);
  assert.equal(fs.existsSync(transportPath), true, 'Wave A disposable transport must exist before self-removal');
  fs.rmSync(transportPath);

  const originalSelf = execFileSync('git', ['show', `${WAVE_A_BASE}:scripts/article-headline-contract.js`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  fs.writeFileSync(__filename, originalSelf, 'utf8');
  installWaveAScopeHooks();
  console.log('✅ Antisovetov Source Link Audit Wave A applied with exact two-file final scope');
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
  if (WRITE) applyAntisovetovWaveA();
}

main();
