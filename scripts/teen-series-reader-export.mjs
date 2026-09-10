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
    fs.copyFileSync(
      path.join(ROOT, 'src', 'content', 'articles', slug + '.mdx'),
      path.join(tempArticles, slug + '.mdx'),
    );
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
