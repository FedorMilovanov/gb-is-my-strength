#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const SLUGS = [
  'podrostok-za-kadrom-dvoynaya-zhizn',
  'podrostok-za-kadrom-roditelyam-posle-razoblacheniya',
  'podrostok-za-kadrom-chto-delat-tserkvi',
  'vzroslyy-rebenok-ushel-kontakt-pokayanie-vozvrashchenie',
  'vzroslyy-rebenok-doma-dengi-pomoshch-posledstviya',
  'sovershennoletie-roditelskaya-vlast-chto-menyaetsya',
  'vzroslaya-doch-otets-brak-soglasie-granitsy-vlasti',
];

const EXACT_VISIBLE = [
  [
    '**LOVE DOES NOT CREATE A DUTY TO CO-SIGN EVERY LOAN.**',
    '**Любовь не создаёт обязанности становиться поручителем по каждому кредиту.**',
    1,
  ],
];

const CASE_INSENSITIVE_VISIBLE = [
  [/\bstewardship\b/giu, 'ответственное распоряжение'],
  [/\bhouse rules?\b/giu, 'правила дома'],
  [/\bco-residence\b/giu, 'совместное проживание'],
  [/\bcourtship\b/giu, 'ухаживание'],
  [/\bconsent\b/giu, 'согласие'],
  [/\bhousehold\b/giu, 'дом'],
  [/\bcounsel\b/giu, 'совет'],
  [/\bdependence\b/giu, 'зависимость'],
  [/\bprudence\b/giu, 'благоразумие'],
  [/\bprudential\b/giu, 'практический'],
  [/\bsafeguards?\b/giu, 'меры защиты'],
  [/\bno-contact\b/giu, 'полное прекращение контакта'],
  [/\bevidence ladder\b/giu, 'иерархия доказательств'],
  [/\blease agreement\b/giu, 'договор аренды'],
  [/\bcash transfer\b/giu, 'денежная выплата'],
  [/\bestate planning\b/giu, 'планирование наследства'],
];

function preNormalizeVisible(source) {
  const frontmatter = source.match(/^---\n[\s\S]*?\n---\n/);
  if (!frontmatter) throw new Error('missing frontmatter');
  const head = frontmatter[0];
  const body = source.slice(head.length);
  const parts = body.split(/(\{\/\*[\s\S]*?\*\/\})/g);
  const normalizedBody = parts.map((part, index) => {
    if (index % 2) return part;
    let next = part;
    for (const [from, to] of EXACT_VISIBLE) next = next.split(from).join(to);
    for (const [pattern, replacement] of CASE_INSENSITIVE_VISIBLE) next = next.replace(pattern, replacement);
    return next;
  }).join('');
  for (const [from, _to, expectedCount] of EXACT_VISIBLE) {
    const originalCount = parts.filter((_part, index) => index % 2 === 0).reduce((sum, part) => sum + part.split(from).length - 1, 0);
    if (originalCount !== expectedCount) throw new Error(`exact reader replacement count drifted for ${JSON.stringify(from)}: expected ${expectedCount}, got ${originalCount}`);
  }
  return head + normalizedBody;
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'teen-reader-export-'));
try {
  const tempScripts = path.join(temp, 'scripts');
  const tempArticles = path.join(temp, 'src', 'content', 'articles');
  fs.mkdirSync(tempScripts, { recursive: true });
  fs.mkdirSync(tempArticles, { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'teen-series-source-promotion.mjs'),
    path.join(tempScripts, 'teen-series-source-promotion.mjs'),
  );
  for (const slug of SLUGS) {
    const source = fs.readFileSync(path.join(ROOT, 'src', 'content', 'articles', `${slug}.mdx`), 'utf8');
    fs.writeFileSync(path.join(tempArticles, `${slug}.mdx`), preNormalizeVisible(source), 'utf8');
  }

  const write = spawnSync(process.execPath, ['scripts/teen-series-source-promotion.mjs', '--write'], {
    cwd: temp,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  process.stdout.write(write.stdout || '');
  process.stderr.write(write.stderr || '');
  if (write.status !== 0) process.exit(write.status ?? 1);

  const check = spawnSync(process.execPath, ['scripts/teen-series-source-promotion.mjs'], {
    cwd: temp,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  process.stdout.write(check.stdout || '');
  process.stderr.write(check.stderr || '');
  if (check.status !== 0) process.exit(check.status ?? 1);

  let emitted = 0;
  for (const slug of SLUGS) {
    const rel = `src/content/articles/${slug}.mdx`;
    const original = fs.readFileSync(path.join(ROOT, rel));
    const normalized = fs.readFileSync(path.join(temp, rel));
    if (original.equals(normalized)) continue;
    emitted += 1;
    console.log(`TEEN_CLEAN_BLOB\t${rel}\t${normalized.toString('base64')}`);
  }
  console.log(`TEEN_CLEAN_EXPORT_COUNT\t${emitted}`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
