import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const fail = (message) => {
  console.error(`ASTRO 7 SATTERI CONTRACT: FAIL — ${message}`);
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
  fail(`cannot locate installed package metadata for ${specifier}`);
};

const packageJson = readJson(path.join(root, 'package.json'));
const lock = readJson(path.join(root, 'package-lock.json'));
const config = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
const expected = new Map([
  ['astro', '7.1.6'],
  ['@astrojs/mdx', '7.0.5'],
  ['@astrojs/react', '6.0.2'],
  ['@astrojs/rss', '4.0.19'],
  ['@astrojs/sitemap', '3.7.3'],
  ['@astrojs/check', '0.9.10'],
]);

for (const [name, version] of expected) {
  if (packageJson.devDependencies?.[name] !== version) fail(`${name} must be declared exactly as ${version}`);
  const key = `node_modules/${name}`;
  if (lock.packages?.[key]?.version !== version) fail(`${key} must resolve exactly to ${version}`);
  if (findInstalledPackage(name).version !== version) fail(`${name} installed version must be ${version}`);
}

for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  if (packageJson[section]?.['@astrojs/markdown-remark']) {
    fail(`direct @astrojs/markdown-remark compatibility dependency found in ${section}`);
  }
}
for (const [pattern, label] of [
  [/compressHTML\s*:\s*true/u, 'compressHTML: true compatibility override'],
  [/processor\s*:/u, 'explicit Markdown processor override'],
  [/@astrojs\/markdown-remark/u, 'Unified compatibility import'],
  [/\bunified\s*\(/u, 'unified() processor call'],
]) {
  if (pattern.test(config)) fail(`${label} is forbidden`);
}

const astroPackage = findInstalledPackage('astro');
if (astroPackage.dependencies?.['@astrojs/markdown-satteri'] !== '0.3.5') {
  fail('Astro must depend on native Satteri 0.3.5');
}
if (lock.packages?.['node_modules/@astrojs/markdown-satteri']?.version !== '0.3.5') {
  fail('lockfile must resolve @astrojs/markdown-satteri exactly to 0.3.5');
}
const satteriPackage = findInstalledPackage('@astrojs/markdown-satteri');
if (satteriPackage.version !== '0.3.5') fail('installed Satteri must be 0.3.5');
const satteriApi = await import('@astrojs/markdown-satteri');
for (const name of ['satteri', 'isSatteriProcessor', 'createSatteriMarkdownProcessor']) {
  if (typeof satteriApi[name] !== 'function') fail(`Satteri export ${name} is unavailable`);
}
const processor = satteriApi.satteri();
if (!satteriApi.isSatteriProcessor(processor)) fail('Satteri processor identity check failed');
if (processor.name !== 'satteri' || typeof processor.createRenderer !== 'function') {
  fail('Satteri processor did not initialize with the native renderer contract');
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
if (packageJson.scripts?.['astro:dev'] !== 'node scripts/astro-cli.mjs dev') {
  fail('astro:dev must use the cross-platform Astro CLI launcher');
}
if (packageJson.scripts?.['astro:check'] !== 'npm run astro:7:satteri:contract && node scripts/astro-cli.mjs check') {
  fail('astro:check must remain fail-closed through this contract');
}
if (packageJson.scripts?.['astro:build'] !== 'npm run dist:clean && npm run astro:check && node scripts/astro-cli.mjs build') {
  fail('astro:build must invoke the guarded astro:check path');
}
if (packageJson.scripts?.['astro:preview'] !== 'node scripts/astro-cli.mjs preview') {
  fail('astro:preview must use the cross-platform Astro CLI launcher');
}

console.log(`ASTRO 7 SATTERI CONTRACT: PASS (Astro ${astroPackage.version}; Satteri ${satteriPackage.version}; native defaults; no Unified override)`);
