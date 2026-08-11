#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const input = process.argv[2] || 'reports/npm-security/npm-audit.json';
const file = path.resolve(process.cwd(), input);

if (!fs.existsSync(file)) {
  console.error(`NPM SECURITY CONTRACT: missing audit report: ${input}`);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`NPM SECURITY CONTRACT: invalid JSON: ${error.message}`);
  process.exit(2);
}

if (report?.auditReportVersion !== 2 || !report?.metadata?.vulnerabilities || !report?.vulnerabilities) {
  console.error('NPM SECURITY CONTRACT: unsupported npm audit schema (expected auditReportVersion=2)');
  process.exit(2);
}

const counts = report.metadata.vulnerabilities;
for (const key of ['info', 'low', 'moderate', 'high', 'critical', 'total']) {
  if (!Number.isInteger(counts[key]) || counts[key] < 0) {
    console.error(`NPM SECURITY CONTRACT: invalid metadata.vulnerabilities.${key}`);
    process.exit(2);
  }
}

const severityRank = new Map([
  ['critical', 4],
  ['high', 3],
  ['moderate', 2],
  ['low', 1],
  ['info', 0],
]);

const rows = Object.values(report.vulnerabilities)
  .filter((entry) => entry && typeof entry === 'object')
  .map((entry) => {
    const advisories = Array.isArray(entry.via)
      ? entry.via.filter((via) => via && typeof via === 'object').map((via) => ({
          source: via.source ?? null,
          title: via.title ?? null,
          severity: via.severity ?? null,
          range: via.range ?? null,
          url: via.url ?? null,
        }))
      : [];

    return {
      name: entry.name || '(unknown)',
      severity: entry.severity || 'unknown',
      direct: Boolean(entry.isDirect),
      range: entry.range || '',
      nodes: Array.isArray(entry.nodes) ? entry.nodes : [],
      fixAvailable: entry.fixAvailable ?? false,
      advisories,
      viaPackages: Array.isArray(entry.via) ? entry.via.filter((via) => typeof via === 'string') : [],
    };
  })
  .sort((a, b) => (severityRank.get(b.severity) ?? -1) - (severityRank.get(a.severity) ?? -1) || a.name.localeCompare(b.name));

console.log(`NPM SECURITY AUDIT: total=${counts.total} critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low} info=${counts.info}`);

for (const row of rows) {
  const fix = row.fixAvailable && typeof row.fixAvailable === 'object'
    ? `${row.fixAvailable.name || row.name}@${row.fixAvailable.version || '?'}${row.fixAvailable.isSemVerMajor ? ' (major)' : ''}`
    : String(Boolean(row.fixAvailable));
  console.log(`- ${row.name}: severity=${row.severity}; direct=${row.direct}; range=${row.range || '(none)'}; fix=${fix}`);
  if (row.nodes.length) console.log(`  nodes: ${row.nodes.join(', ')}`);
  if (row.viaPackages.length) console.log(`  via packages: ${row.viaPackages.join(', ')}`);
  for (const advisory of row.advisories) {
    console.log(`  advisory ${advisory.source ?? '?'}: ${advisory.title || '(untitled)'}; severity=${advisory.severity || '?'}; range=${advisory.range || '(none)'}; ${advisory.url || '(no url)'}`);
  }
}

const blocking = counts.moderate + counts.high + counts.critical;
if (blocking > 0) {
  console.error(`NPM SECURITY CONTRACT: FAIL (${blocking} moderate/high/critical vulnerabilities)`);
  process.exit(1);
}

console.log('NPM SECURITY CONTRACT: PASS (0 moderate/high/critical vulnerabilities)');
