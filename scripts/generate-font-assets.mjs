#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, generateFontAssets } from './font-assets-lib.mjs';

const flags = new Set(process.argv.slice(2));
const write = flags.has('--write');
const acceptUpstream = flags.has('--accept-upstream');

if (!write) {
  console.error('Font generation is maintainer-only and requires --write. Production builds must run scripts/verify-font-assets.mjs instead.');
  process.exit(2);
}

const result = await generateFontAssets({ write, acceptUpstream });
const reportPath = path.join(ROOT, 'reports', 'font-assets-generation.json');
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify({
  result: result.result,
  acceptUpstream,
  files: result.files,
}, null, 2)}\n`, 'utf8');
console.log(`Font asset generation: ${result.result} (${result.files.length} files; acceptUpstream=${acceptUpstream}).`);
