#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const path = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
let source = readFileSync(path, 'utf8');
const replacements = [
  ['письменные записи, несогласные пресвитеры и ответственные за защиту детей и уязвимых и межцерковные структуры', 'письменные записи, несогласные пресвитеры, ответственные за защиту детей и уязвимых, а также межцерковные структуры'],
  ['18 по защите детей и уязвимых и пастырскому управлению', '18 источников о защите детей и уязвимых и о пастырском управлении']
];
for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`expected one match for: ${before}; found ${count}`);
  source = source.replace(before, after);
}
writeFileSync(path, source);
const result = spawnSync(process.execPath, ['scripts/antisovetov-wave8-contract.mjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
console.log('✅ Applied final two Russian prose corrections');
