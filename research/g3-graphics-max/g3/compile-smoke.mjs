// Run only in the existing repository installation; no new dependency or route.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const compilerRequire = createRequire(require.resolve('astro/package.json'));
const { transform } = compilerRequire('@astrojs/compiler');
const root = new URL('../../../src/components/journal/g3-graphics/', import.meta.url);
const files = ['G3HistoricalPanorama.astro','G3ExpenseWaterfall.astro','G3EcosystemSpread.astro'];
for (const file of files) {
  const path = fileURLToPath(new URL(file, root));
  const result = await transform(await readFile(path, 'utf8'), { filename:path });
  const errors = result.diagnostics.filter(d => d.severity === 1);
  if (errors.length || !result.code) throw new Error(`${file}: ${JSON.stringify(errors)}`);
  console.log(`${file}: compiler transform PASS`);
}
console.log('Compiler transform smoke only; import resolution, types and rendered route still require Astro integration/build.');
