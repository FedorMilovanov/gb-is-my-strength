#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'fonts');
const REPORTS = path.join(ROOT, 'reports');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(absolute));
    else if (entry.isFile()) out.push(absolute);
  }
  return out;
}

if (!fs.existsSync(FONTS)) throw new Error('fonts directory is missing');

const files = walk(FONTS)
  .filter((absolute) => absolute.endsWith('.woff2'))
  .map((absolute) => {
    const bytes = fs.readFileSync(absolute);
    const relativePath = path.relative(ROOT, absolute).split(path.sep).join('/');
    return {
      path: relativePath,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      magic: bytes.subarray(0, 4).toString('ascii'),
      gitBlobSha: crypto.createHash('sha1').update(Buffer.concat([
        Buffer.from(`blob ${bytes.length}\0`, 'utf8'),
        bytes,
      ])).digest('hex'),
    };
  });

const invalid = files.filter((entry) => entry.magic !== 'wOF2' || entry.bytes < 1024);
if (invalid.length) throw new Error(`invalid WOFF2 files: ${JSON.stringify(invalid)}`);

const report = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  files,
};

fs.mkdirSync(REPORTS, { recursive: true });
fs.writeFileSync(path.join(REPORTS, 'font-assets-inventory.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
