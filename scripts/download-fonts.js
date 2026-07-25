#!/usr/bin/env node
'use strict';

console.error([
  'Legacy opportunistic font downloader is disabled.',
  'Production and CI must run: node scripts/verify-font-assets.mjs',
  'Maintainers may regenerate the complete staged set with:',
  '  node scripts/generate-font-assets.mjs --write',
  'Upstream byte changes require explicit review and --accept-upstream.',
].join('\n'));
process.exit(2);
