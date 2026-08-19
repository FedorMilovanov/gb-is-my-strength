#!/usr/bin/env node
/**
 * Adjudicate the raw Bible App browser report without hiding product failures.
 *
 * The deep contract intentionally runs with outbound Telegram and telemetry
 * isolated from the public network. Chromium/WebKit differ in how they expose
 * a target=_blank navigation whose response is locally fulfilled (popup page
 * may remain blank or never materialize), and WebKit reports two known browser
 * environment diagnostics that are not site failures. Those are excluded here;
 * all geometry, navigation, href/startapp, focus, page/runtime and asset
 * failures remain fail-closed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORTS = join(ROOT, 'reports', 'bible-app-browser');
const engine = String(process.env.GB_APP_BROWSER || '').trim().toLowerCase();
if (!['chromium', 'webkit'].includes(engine)) throw new Error(`Unsupported engine: ${engine}`);

const rawPath = join(REPORTS, `bible-app-browser-${engine}.json`);
const raw = JSON.parse(await readFile(rawPath, 'utf8'));

function isEnvironmentNoise(failure) {
  const contract = String(failure.contract || '');
  const detail = String(failure.detail || '');

  // The anchor click itself already ran. With t.me fulfilled locally as 204,
  // engines do not guarantee a materialized popup document or final popup URL.
  // Exact href/startapp, target and rel assertions remain mandatory in raw data.
  if (/:popup(?:-url)?$/.test(contract)) return true;

  // WebKit emits these from the isolated browser environment. They do not come
  // from a same-origin production asset or application exception.
  if (engine === 'webkit' && contract === 'runtime:pageerror' && /mc\.yandex\.com\/watch|XMLHttpRequest cannot load https:\/\/mc\.yandex\.com/i.test(detail)) return true;
  if (engine === 'webkit' && contract === 'runtime:console-error' && /interactive-widget/i.test(detail)) return true;

  return false;
}

const ignored = raw.failures.filter(isEnvironmentNoise);
const actionable = raw.failures.filter((failure) => !isEnvironmentNoise(failure));
const adjudicated = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  engine,
  rawContracts: raw.contracts,
  rawPassed: raw.passed,
  rawFailed: raw.failed,
  ignoredEnvironmentNoise: ignored.length,
  actionableFailures: actionable.length,
  ignored,
  failures: actionable,
};

await writeFile(join(REPORTS, `bible-app-browser-${engine}-adjudicated.json`), `${JSON.stringify(adjudicated, null, 2)}\n`);
await writeFile(join(REPORTS, `bible-app-browser-${engine}-adjudicated.md`), [
  `# Bible App browser adjudication — ${engine}`,
  '',
  `- Raw: **${raw.passed}/${raw.contracts} PASS**`,
  `- Browser-environment noise excluded: **${ignored.length}**`,
  `- Actionable failures: **${actionable.length}**`,
  '',
  ...(actionable.length
    ? ['## Actionable failures', '', ...actionable.map((f) => `- \`${f.viewport}\` · \`${f.route}\` · **${f.contract}** — ${f.detail || 'failed'}`)]
    : ['✅ No actionable product failures remain after environment adjudication.']),
  '',
].join('\n'));

for (const f of actionable) console.error(`ACTIONABLE [${f.viewport}] ${f.route} ${f.contract} :: ${f.detail}`);
console.log(`BIBLE APP ADJUDICATED ${engine.toUpperCase()}: ${actionable.length} actionable failure(s); ${ignored.length} environment-only failure(s)`);
if (actionable.length) process.exitCode = 1;
