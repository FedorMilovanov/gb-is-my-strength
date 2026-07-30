'use strict';

const fs = require('fs');
const assert = require('assert/strict');

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected exactly one source match, found ${count}`);
  return source.replace(before, after);
}

const normalizerPath = 'scripts/search-manifest-policy-normalizer.js';
let normalizer = fs.readFileSync(normalizerPath, 'utf8');
normalizer = replaceExact(
  normalizer,
  `function writeJson(file, value) {\n  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');\n}\n`,
  `function writeJson(file, value) {\n  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\\n');\n}\n\nfunction manifestMaxModifiedAt(manifest) {\n  let max = null;\n  for (const item of Array.isArray(manifest?.items) ? manifest.items : []) {\n    const value = Date.parse(String(item?.modifiedTime || ''));\n    if (Number.isFinite(value) && (max === null || value > max)) max = value;\n  }\n  return max === null ? null : new Date(max).toISOString().replace(/\\.\\d{3}Z$/, 'Z');\n}\n\nfunction refreshGeneratedAt(manifest) {\n  const maxModifiedAt = manifestMaxModifiedAt(manifest);\n  if (!maxModifiedAt) return false;\n  const current = Date.parse(String(manifest?.generatedAt || ''));\n  const target = Date.parse(maxModifiedAt);\n  if (Number.isFinite(current) && current >= target) return false;\n  manifest.generatedAt = maxModifiedAt;\n  return true;\n}\n`,
  'insert generatedAt helpers'
);
normalizer = replaceExact(
  normalizer,
  `  const result = applyMigration({\n    policyRegistry,\n    manifest,\n    seriesData,\n    productionRecords: loaded.records,\n    distRoot,\n    promoteRssArticles: options.promoteRssArticles,\n  });\n\n  console.log(\`Search policy seeds: \${result.seeded.length}\`);\n`,
  `  const result = applyMigration({\n    policyRegistry,\n    manifest,\n    seriesData,\n    productionRecords: loaded.records,\n    distRoot,\n    promoteRssArticles: options.promoteRssArticles,\n  });\n  const generatedAtRefreshed = refreshGeneratedAt(manifest);\n\n  console.log(\`Search policy seeds: \${result.seeded.length}\`);\n`,
  'refresh generatedAt in main'
);
normalizer = replaceExact(
  normalizer,
  `  for (const route of result.added) console.log(\`ADD \${route}\`);\n\n  if (!options.write) {\n    if (result.seeded.length || result.promoted.length || result.added.length) process.exitCode = 1;\n    return;\n  }\n\n  if (!result.seeded.length && !result.promoted.length && !result.added.length) {\n    console.log('No search policy or manifest migration changes required.');\n    return;\n  }\n  policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);\n  manifest.generatedAt = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');\n  writeJson(policyFile, policyRegistry);\n  writeJson(manifestFile, manifest);\n  console.log(\`Wrote \${result.seeded.length} policy seed(s), \${result.promoted.length} promotion(s) and \${result.added.length} manifest item(s).\`);\n`,
  `  for (const route of result.added) console.log(\`ADD \${route}\`);\n  console.log(\`Search manifest generatedAt refreshed: \${generatedAtRefreshed ? 'yes' : 'no'}\`);\n\n  if (!options.write) {\n    if (result.seeded.length || result.promoted.length || result.added.length || generatedAtRefreshed) process.exitCode = 1;\n    return;\n  }\n\n  const migrationChanged = Boolean(result.seeded.length || result.promoted.length || result.added.length);\n  if (!migrationChanged && !generatedAtRefreshed) {\n    console.log('No search policy or manifest migration changes required.');\n    return;\n  }\n  if (migrationChanged) {\n    policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);\n    writeJson(policyFile, policyRegistry);\n  }\n  writeJson(manifestFile, manifest);\n  console.log(\`Wrote \${result.seeded.length} policy seed(s), \${result.promoted.length} promotion(s), \${result.added.length} manifest item(s) and generatedAt refresh=\${generatedAtRefreshed}.\`);\n`,
  'make generatedAt refresh a first-class change'
);
normalizer = replaceExact(
  normalizer,
  `  SEARCHABLE_ARTICLE_KINDS,\n  parseArgs,\n`,
  `  SEARCHABLE_ARTICLE_KINDS,\n  parseArgs,\n  manifestMaxModifiedAt,\n  refreshGeneratedAt,\n`,
  'export generatedAt helpers'
);
fs.writeFileSync(normalizerPath, normalizer, 'utf8');

const testPath = 'scripts/search-manifest-policy-normalizer-test.js';
let test = fs.readFileSync(testPath, 'utf8');
test = replaceExact(
  test,
  `  buildManifestItem,\n  seriesReadingTimes,\n`,
  `  buildManifestItem,\n  manifestMaxModifiedAt,\n  refreshGeneratedAt,\n  seriesReadingTimes,\n`,
  'import generatedAt helpers'
);
test = replaceExact(
  test,
  `const htmlWithoutRuntimeReadTime = html.replace('<script>window.SITE_CONFIG={page:{readingTime: 17}}</script>', '');\n\nconst item = buildManifestItem(route, policy, html);\n`,
  `const htmlWithoutRuntimeReadTime = html.replace('<script>window.SITE_CONFIG={page:{readingTime: 17}}</script>', '');\n\nconst staleGeneratedAtManifest = {\n  generatedAt: '2026-07-29T00:12:25Z',\n  items: [\n    { modifiedTime: '2026-07-20T00:00:00+03:00' },\n    { modifiedTime: '2026-07-30T00:00:00+03:00' },\n    { modifiedTime: 'not-a-date' },\n  ],\n};\nassert.equal(manifestMaxModifiedAt(staleGeneratedAtManifest), '2026-07-29T21:00:00Z');\nassert.equal(refreshGeneratedAt(staleGeneratedAtManifest), true);\nassert.equal(staleGeneratedAtManifest.generatedAt, '2026-07-29T21:00:00Z');\nassert.equal(refreshGeneratedAt(staleGeneratedAtManifest), false);\nconst newerGeneratedAtManifest = {\n  generatedAt: '2026-07-30T01:00:00Z',\n  items: [{ modifiedTime: '2026-07-30T00:00:00+03:00' }],\n};\nassert.equal(refreshGeneratedAt(newerGeneratedAtManifest), false);\nassert.equal(newerGeneratedAtManifest.generatedAt, '2026-07-30T01:00:00Z');\nassert.equal(manifestMaxModifiedAt({ items: [] }), null);\nassert.equal(refreshGeneratedAt({ items: [] }), false);\n\nconst item = buildManifestItem(route, policy, html);\n`,
  'add generatedAt regression tests'
);
fs.writeFileSync(testPath, test, 'utf8');

const manifestPath = 'data/search-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.generatedAt, '2026-07-29T00:12:25Z');
manifest.generatedAt = '2026-07-29T21:00:00Z';
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

for (const file of [
  'scripts/_temp-patch-search-manifest-generatedat.cjs',
  '.github/workflows/_temp-patch-search-manifest-generatedat.yml',
]) {
  fs.rmSync(file, { force: true });
}

console.log('Patched generatedAt contract and removed temporary bootstrap files.');
