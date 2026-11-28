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

const dispositionsInput = process.argv[3] || 'data/security-advisory-dispositions.json';
const dispositionsFile = path.resolve(process.cwd(), dispositionsInput);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_DECISIONS = new Set(['accept-risk', 'suppress-false-positive']);
const ALLOWED_SEVERITIES = new Set(['moderate', 'high', 'critical']);

function failDispositionSchema(message) {
  console.error(`NPM SECURITY CONTRACT: invalid dispositions file ${dispositionsInput}: ${message}`);
  process.exit(2);
}

function loadDispositions() {
  if (!fs.existsSync(dispositionsFile)) return [];
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(dispositionsFile, 'utf8'));
  } catch (error) {
    failDispositionSchema(`invalid JSON: ${error.message}`);
  }
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.dispositions)) {
    failDispositionSchema('expected { schemaVersion: 1, dispositions: [] }');
  }
  parsed.dispositions.forEach((entry, index) => {
    const where = `dispositions[${index}]`;
    if (!entry || typeof entry !== 'object') failDispositionSchema(`${where}: not an object`);
    for (const key of ['package', 'advisoryUrl', 'reason', 'owner']) {
      if (typeof entry[key] !== 'string' || entry[key].trim() === '') failDispositionSchema(`${where}: ${key} must be a non-empty string`);
    }
    if (!ALLOWED_SEVERITIES.has(entry.severity)) failDispositionSchema(`${where}: severity must be one of moderate/high/critical`);
    if (!ALLOWED_DECISIONS.has(entry.decision)) failDispositionSchema(`${where}: decision must be one of accept-risk/suppress-false-positive`);
    for (const key of ['decidedAt', 'expiresAt']) {
      if (typeof entry[key] !== 'string' || !DATE_RE.test(entry[key])) failDispositionSchema(`${where}: ${key} must be YYYY-MM-DD`);
    }
    if (entry.decidedAt > entry.expiresAt) failDispositionSchema(`${where}: decidedAt ${entry.decidedAt} is after expiresAt ${entry.expiresAt}`);
  });
  return parsed.dispositions;
}

const dispositions = loadDispositions();
const today = process.env.SECURITY_CONTRACT_TODAY || new Date().toISOString().slice(0, 10);
if (!DATE_RE.test(today)) {
  console.error(`NPM SECURITY CONTRACT: invalid SECURITY_CONTRACT_TODAY override: ${today}`);
  process.exit(2);
}

const blocking = rows.filter((row) => (severityRank.get(row.severity) ?? -1) >= severityRank.get('moderate'));
const uncovered = [];
const expired = [];
const matchedDispositions = new Set();

for (const row of blocking) {
  const advisoryUrls = new Set(row.advisories.map((advisory) => advisory.url).filter(Boolean));
  const matches = dispositions
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.package === row.name && (advisoryUrls.size === 0 || advisoryUrls.has(entry.advisoryUrl)));
  const valid = matches.filter(({ entry }) => entry.expiresAt >= today);
  for (const { index } of valid) matchedDispositions.add(index);
  if (valid.length > 0) {
    for (const { entry } of valid) {
      console.log(`  disposition: ${row.name} covered by ${entry.decision} (owner=${entry.owner}, decidedAt=${entry.decidedAt}, expiresAt=${entry.expiresAt})`);
    }
    continue;
  }
  const staleExpired = matches.filter(({ entry }) => entry.expiresAt < today);
  for (const { entry } of staleExpired) {
    expired.push(`${row.name}: disposition expired ${entry.expiresAt} (owner=${entry.owner}) — re-decide or patch`);
  }
  uncovered.push(row);
}

dispositions.forEach((entry, index) => {
  if (!matchedDispositions.has(index)) {
    const stillPresent = blocking.some((row) => row.name === entry.package);
    if (!stillPresent) {
      console.log(`NPM SECURITY AUDIT: stale disposition for ${entry.package} (${entry.advisoryUrl}) — advisory no longer reported; remove the entry`);
    }
  }
});

if (expired.length > 0) {
  console.error(`NPM SECURITY CONTRACT: FAIL (${expired.length} expired disposition(s))`);
  for (const line of expired) console.error(`- ${line}`);
  process.exit(1);
}

if (uncovered.length > 0) {
  console.error(`NPM SECURITY CONTRACT: FAIL (${uncovered.length} undispositioned moderate/high/critical vulnerabilities)`);
  for (const row of uncovered) console.error(`- ${row.name}: severity=${row.severity}; range=${row.range || '(none)'}`);
  console.error('Add a dated owner disposition to data/security-advisory-dispositions.json or patch the dependency.');
  process.exit(1);
}

if (blocking.length > 0) {
  console.log(`NPM SECURITY CONTRACT: PASS (${blocking.length} moderate/high/critical vulnerabilities covered by valid dispositions)`);
} else {
  console.log('NPM SECURITY CONTRACT: PASS (0 moderate/high/critical vulnerabilities)');
}
