import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts ||= {};
pkg.scripts['astro7:migration:guard'] = 'node scripts/astro7-migration-guard.mjs';
fs.writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

fs.writeFileSync('astro.config.mjs', `import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';

export default defineConfig({
  site: 'https://gospod-bog.ru',
  trailingSlash: 'always',
  output: 'static',

  // Phase 1: preserve Astro 6 inline-whitespace semantics while all
  // text, MDX and visual contracts validate the Astro 7 compiler.
  compressHTML: true,

  // Phase 1: retain the proven unified Markdown pipeline. Sätteri is
  // evaluated later in a separate content-parity migration.
  markdown: {
    processor: unified(),
  },

  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/izbrannoe'), // personal/localStorage page — noindex, not for search engines
    }),
    react(),
  ],
});
`);

fs.writeFileSync('scripts/astro7-migration-guard.mjs', `import assert from 'node:assert/strict';
import fs from 'node:fs';

const expected = Object.freeze({
  astro: '7.1.6',
  '@astrojs/mdx': '7.0.5',
  '@astrojs/react': '6.0.2',
  '@astrojs/check': '0.9.10',
  '@astrojs/rss': '4.0.19',
  '@astrojs/sitemap': '3.7.3',
  '@astrojs/markdown-remark': '7.2.2',
});

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const rootLock = lock.packages?.['']?.devDependencies ?? {};

for (const [name, version] of Object.entries(expected)) {
  assert.equal(pkg.devDependencies?.[name], version,
    \`package.json must pin \${name}@\${version}\`);
  assert.equal(rootLock[name], version,
    \`package-lock root must pin \${name}@\${version}\`);
  assert.equal(lock.packages?.[\`node_modules/\${name}\`]?.version, version,
    \`package-lock must resolve \${name}@\${version}\`);
}

const config = fs.readFileSync('astro.config.mjs', 'utf8');
assert.match(config, /compressHTML:\\s*true/,
  'phase 1 must preserve Astro 6 whitespace semantics');
assert.match(config,
  /import\\s*\\{\\s*unified\\s*\\}\\s*from\\s*['\"]@astrojs\\/markdown-remark['\"]/,
  'phase 1 must import the unified processor');
assert.match(config, /processor:\\s*unified\\(\\)/,
  'phase 1 must retain the unified Markdown processor');

const [major, minor] = process.versions.node.split('.').map(Number);
assert.ok(major > 22 || (major === 22 && minor >= 12),
  \`Astro 7 requires Node >=22.12; found \${process.versions.node}\`);

console.log('ASTRO 7 COORDINATED MIGRATION GUARD: PASS');
`);

fs.mkdirSync('docs/dependency-migrations', { recursive: true });
fs.writeFileSync('docs/dependency-migrations/ASTRO_7_PHASE_1.md', `# Astro 7 phase-one migration

This lane upgrades Astro as one compatible package set instead of merging the
incomplete single-package Dependabot bump.

## Pinned set

- Astro 7.1.6
- MDX integration 7.0.5
- React integration 6.0.2
- Astro Check 0.9.10
- RSS 4.0.19
- Sitemap 3.7.3
- Unified Markdown processor 7.2.2

## Safety boundaries

1. \`compressHTML: true\` preserves Astro 6 inline whitespace.
2. \`unified()\` preserves the proven Markdown and MDX processor.
3. Sätteri and JSX whitespace are deferred to separate measured PRs.
4. \`npm run astro7:migration:guard\` prevents dependency/config drift.
5. Screenshot baselines must not be rewritten merely to make this green.

## Required merge evidence

- clean \`npm ci\` on Node 22.12 and npm 10.9.0;
- Astro check and production build;
- strict content and MDX parity;
- URL, Pagefind, JSON-LD and service-worker contracts;
- production visual parity and browser smoke;
- complete publication gate.
`);

console.log('Astro 7 phase-one files written.');
