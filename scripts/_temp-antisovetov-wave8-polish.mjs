#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const path = 'src/components/article-pilots/antisovetov/AntisovetovBody.astro';
let source = readFileSync(path, 'utf8');
const replacements = [
  ['письменные records, несогласные пресвитеры, safeguarding-ответственные', 'письменные записи, несогласные пресвитеры и ответственные за защиту детей и уязвимых'],
  ['квалифицированного safeguarding-специалиста', 'квалифицированного специалиста по защите детей и уязвимых'],
  ['компетентности в safeguarding, отсутствия конфликта интересов', 'компетентности в защите детей и уязвимых, отсутствия конфликта интересов'],
  ['Термины из психологии, организационных исследований и safeguarding используются', 'Термины из психологии, организационных исследований и практики защиты детей и уязвимых используются'],
  ['18 по safeguarding и пастырскому управлению', '18 по защите детей и уязвимых и пастырскому управлению'],
  ['<strong>Safeguarding и защищённые сообщения:</strong>', '<strong>Защита детей и уязвимых (safeguarding) и защищённые сообщения:</strong>']
];
for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`expected one match for: ${before}; found ${count}`);
  source = source.replace(before, after);
}
writeFileSync(path, source);
const validation = spawnSync(process.execPath, ['scripts/antisovetov-wave8-contract.mjs'], { stdio: 'inherit' });
if (validation.status !== 0) process.exit(validation.status ?? 1);
console.log(`✅ Applied ${replacements.length} Russian terminology polish replacements`);
