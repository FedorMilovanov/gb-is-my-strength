#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_OWNERS = [
  'src/pages/rodosloviye',
  'src/components/rodosloviye',
  'src/components/genealogy',
  'rodosloviye',
];
const TEXT_EXTENSIONS = new Set(['.astro', '.html', '.js', '.mjs', '.ts', '.tsx']);
const RAW_V2_PATH = /data\/genealogy\/v2\/(?!publishable(?:\/|['"`]))/gu;

const fail = message => { throw new Error(message); };

function collectFiles(relative) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const out = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(path.relative(ROOT, child)));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) out.push(child);
  }
  return out;
}

const files = RUNTIME_OWNERS.flatMap(collectFiles);
const violations = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').replaceAll('\\', '/');
  const matches = [...text.matchAll(RAW_V2_PATH)];
  if (!matches.length) continue;
  violations.push({
    file: path.relative(ROOT, file).replaceAll('\\', '/'),
    count: matches.length,
  });
}

if (violations.length) {
  fail(`Genealogy runtime referenced raw v2 data outside publishable/: ${JSON.stringify(violations)}`);
}

const routePath = path.join(ROOT, 'src', 'pages', 'rodosloviye', 'index.astro');
const route = fs.readFileSync(routePath, 'utf8').replaceAll('\\', '/');
const usesLegacyPersons = /genealogyData\.persons/u.test(route);
const usesPublishable = /data\/genealogy\/v2\/publishable\//u.test(route);

if (usesLegacyPersons && usesPublishable) {
  fail('Rodosloviye runtime mixes legacy person authority with v2 publishable person authority');
}

const mode = usesPublishable ? 'publishable-v2' : usesLegacyPersons ? 'legacy-curated-v1' : 'unknown';
if (mode === 'unknown') {
  fail('Rodosloviye runtime person authority is not explicit');
}

console.log(JSON.stringify({
  status: 'genealogy-runtime-data-boundary-ok',
  runtimeFiles: files.length,
  mode,
  rawV2References: 0,
}, null, 2));
