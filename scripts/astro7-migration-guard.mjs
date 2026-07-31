import assert from 'node:assert/strict';
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
    `package.json must pin ${name}@${version}`);
  assert.equal(rootLock[name], version,
    `package-lock root must pin ${name}@${version}`);
  assert.equal(lock.packages?.[`node_modules/${name}`]?.version, version,
    `package-lock must resolve ${name}@${version}`);
}

const config = fs.readFileSync('astro.config.mjs', 'utf8');
assert.match(config, /compressHTML:\s*true/,
  'phase 1 must preserve Astro 6 whitespace semantics');
assert.match(config,
  /import\s*\{\s*unified\s*\}\s*from\s*['"]@astrojs\/markdown-remark['"]/,
  'phase 1 must import the unified processor');
assert.match(config, /processor:\s*unified\(\)/,
  'phase 1 must retain the unified Markdown processor');

const [major, minor] = process.versions.node.split('.').map(Number);
assert.ok(major > 22 || (major === 22 && minor >= 12),
  `Astro 7 requires Node >=22.12; found ${process.versions.node}`);

console.log('ASTRO 7 COORDINATED MIGRATION GUARD: PASS');
