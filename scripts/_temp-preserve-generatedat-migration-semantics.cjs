'use strict';

const fs = require('fs');
const assert = require('assert/strict');

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, `${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const file = 'scripts/search-manifest-policy-normalizer.js';
let source = fs.readFileSync(file, 'utf8');
source = replaceExact(
  source,
  `  });\n  const generatedAtRefreshed = refreshGeneratedAt(manifest);\n\n  console.log(\`Search policy seeds: \${result.seeded.length}\`);\n`,
  `  });\n  const migrationChanged = Boolean(result.seeded.length || result.promoted.length || result.added.length);\n  const generatedAtRefreshed = migrationChanged ? false : refreshGeneratedAt(manifest);\n\n  console.log(\`Search policy seeds: \${result.seeded.length}\`);\n`,
  'separate migration and stale refresh semantics'
);
source = replaceExact(
  source,
  `  const migrationChanged = Boolean(result.seeded.length || result.promoted.length || result.added.length);\n  if (!migrationChanged && !generatedAtRefreshed) {\n`,
  `  if (!migrationChanged && !generatedAtRefreshed) {\n`,
  'remove duplicate migrationChanged declaration'
);
source = replaceExact(
  source,
  `  if (migrationChanged) {\n    policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);\n    writeJson(policyFile, policyRegistry);\n  }\n`,
  `  if (migrationChanged) {\n    policyRegistry.reviewedAt = new Date().toISOString().slice(0, 10);\n    manifest.generatedAt = new Date().toISOString().replace(/\\.\\d{3}Z$/, 'Z');\n    writeJson(policyFile, policyRegistry);\n  }\n`,
  'preserve generation-time timestamp for real migrations'
);
fs.writeFileSync(file, source, 'utf8');

for (const path of [
  'scripts/_temp-preserve-generatedat-migration-semantics.cjs',
  '.github/workflows/_temp-preserve-generatedat-migration-semantics.yml',
]) fs.rmSync(path, { force: true });

console.log('Preserved migration generatedAt semantics and removed bootstrap files.');
