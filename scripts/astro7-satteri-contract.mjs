import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const fail = (message) => {
  console.error('ASTRO 7 SATTERI CONTRACT: FAIL — ' + message);
  process.exit(1);
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const findInstalledPackage = (specifier) => {
  let current = path.dirname(require.resolve(specifier));
  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      const pkg = readJson(candidate);
      if (pkg.name === specifier) return pkg;
    }
    current = path.dirname(current);
  }
  fail('cannot locate installed package metadata for ' + specifier);
};

const parseVersion = (version) => {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    fail('exact x.y.z dependency version required, got ' + JSON.stringify(version));
  }
  return version.split('.').map(Number);
};
const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
};
const checkEngineFloor = (pkg, required = false) => {
  const requirement = pkg.engines?.node;
  if (typeof requirement !== 'string') {
    if (required) fail(pkg.name + ' has no Node engine constraint');
    return; // Some supported integrations do not declare a Node engine.
  }
  const match = requirement.match(/^>=([0-9]+\.[0-9]+\.[0-9]+)$/);
  if (!match) fail(pkg.name + ' has unreviewed Node engine constraint: ' + requirement);
  if (compareVersions(process.versions.node, match[1]) < 0) {
    fail(pkg.name + ' requires Node ' + requirement + ', installed ' + process.versions.node);
  }
};

const manifest = readJson(path.join(root, 'package.json'));
const lock = readJson(path.join(root, 'package-lock.json'));
const config = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
const tracked = ['astro', '@astrojs/mdx', '@astrojs/react', '@astrojs/rss', '@astrojs/sitemap', '@astrojs/check', 'parse5'];

if (lock.lockfileVersion !== 3) fail('npm lockfile v3 is required');
for (const name of tracked) {
  const declared = manifest.devDependencies?.[name];
  parseVersion(declared);
  if (lock.packages?.['']?.devDependencies?.[name] !== declared) {
    fail('root lockfile dependency must equal manifest: ' + name);
  }
  if (lock.packages?.['node_modules/' + name]?.version !== declared) {
    fail('lockfile resolution must equal declared version: ' + name);
  }
  const installed = findInstalledPackage(name);
  if (installed.version !== declared) fail('installed dependency differs from manifest: ' + name);
  checkEngineFloor(installed, name === 'astro' || name === '@astrojs/mdx');
}

// Fix floor for GHSA-98hj-9722-w3j8 and GHSA-mpr7-6m5w-76rw: first version fixing both is Astro 7.3.3.
// A future compiler-major migration needs a separate reviewed SYSTEM change.
const astro = findInstalledPackage('astro');
const mdx = findInstalledPackage('@astrojs/mdx');
if (parseVersion(astro.version)[0] !== 7 || compareVersions(astro.version, '7.3.3') < 0) {
  fail('Astro must be a reviewed, security-patched 7.x release (>= 7.3.3)');
}
if (parseVersion(mdx.version)[0] !== 8) fail('Astro 7 native Satteri requires @astrojs/mdx 8.x');
if (!mdx.peerDependencies?.astro?.startsWith('^7.')) {
  fail('@astrojs/mdx peer range is not for Astro 7');
}
if (!mdx.peerDependencies?.['@astrojs/markdown-satteri']?.startsWith('^0.4.')) {
  fail('@astrojs/mdx must support native Satteri 0.4.x');
}
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (manifest[section]?.['@astrojs/markdown-remark']) {
    fail('direct Unified markdown compatibility dependency found in ' + section);
  }
}
for (const [pattern, label] of [
  [/compressHTML\s*:\s*true/u, 'compressHTML: true compatibility override'],
  [/processor\s*:/u, 'explicit Markdown processor override'],
  [/@astrojs\/markdown-remark/u, 'Unified compatibility import'],
  [/\bunified\s*\(/u, 'unified() processor call'],
]) {
  if (pattern.test(config)) fail(label + ' is forbidden');
}

const bundledVersion = astro.dependencies?.['@astrojs/markdown-satteri'];
if (typeof bundledVersion !== 'string') fail('Astro must depend on native Satteri');
const resolvedVersion = lock.packages?.['node_modules/@astrojs/markdown-satteri']?.version;
const satteri = findInstalledPackage('@astrojs/markdown-satteri');
if (parseVersion(bundledVersion)[0] !== 0 || parseVersion(bundledVersion)[1] !== 4) {
  fail('native Satteri 0.4.x is required for this migration');
}
if (bundledVersion !== resolvedVersion || resolvedVersion !== satteri.version) {
  fail('Astro, lockfile and installed native Satteri must resolve to the same version');
}
checkEngineFloor(satteri);
const satteriApi = await import('@astrojs/markdown-satteri');
for (const name of ['satteri', 'isSatteriProcessor', 'createSatteriMarkdownProcessor']) {
  if (typeof satteriApi[name] !== 'function') fail('native Satteri export is unavailable: ' + name);
}
const processor = satteriApi.satteri();
if (!satteriApi.isSatteriProcessor(processor) ||
    processor.name !== 'satteri' ||
    typeof processor.createRenderer !== 'function') {
  fail('native Satteri processor identity/renderer contract failed');
}

const astroCliPath = path.join(root, 'scripts', 'astro-cli.mjs');
if (!fs.existsSync(astroCliPath)) fail('cross-platform Astro CLI launcher is missing');
const astroCli = fs.readFileSync(astroCliPath, 'utf8');
if (!/ASTRO_TELEMETRY_DISABLED:\s*'1'/u.test(astroCli)) {
  fail('Astro CLI launcher must disable telemetry through the child environment');
}
if (!/spawnSync\(process\.execPath/u.test(astroCli)) {
  fail('Astro CLI launcher must execute Astro through Node without a platform shell');
}
for (const [name, command] of [
  ['astro:dev', 'node scripts/astro-cli.mjs dev'],
  ['astro:check', 'npm run astro:7:satteri:contract && node scripts/astro-cli.mjs check'],
  ['astro:build', 'npm run dist:clean && npm run astro:check && node scripts/astro-cli.mjs build'],
  ['astro:preview', 'node scripts/astro-cli.mjs preview'],
]) {
  if (manifest.scripts?.[name] !== command) fail(name + ' must retain the guarded Astro CLI path');
}
console.log('ASTRO 7 SATTERI CONTRACT: PASS (Astro ' + astro.version + ', MDX ' + mdx.version +
  ', native Satteri ' + satteri.version + '; Node ' + process.versions.node + '; no Unified override)');
