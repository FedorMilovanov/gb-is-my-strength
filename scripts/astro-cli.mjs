import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fail = (message) => {
  console.error(`ASTRO CLI: FAIL — ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.length === 0) fail('missing Astro command');

let current = path.dirname(require.resolve('astro'));
let packageJsonPath = null;
while (current !== path.dirname(current)) {
  const candidate = path.join(current, 'package.json');
  if (fs.existsSync(candidate)) {
    const metadata = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    if (metadata.name === 'astro') {
      packageJsonPath = candidate;
      break;
    }
  }
  current = path.dirname(current);
}

if (!packageJsonPath) fail('cannot locate installed Astro package metadata');

const astroPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const bin = typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin?.astro;
if (typeof bin !== 'string' || bin.length === 0) fail('Astro package does not declare its CLI');

const cliPath = path.resolve(path.dirname(packageJsonPath), bin);
const result = spawnSync(process.execPath, [cliPath, ...args], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
  },
  stdio: 'inherit',
});

if (result.error) fail(`unable to start Astro: ${result.error.message}`);
if (result.signal) fail(`Astro terminated by signal ${result.signal}`);
process.exit(result.status ?? 1);
