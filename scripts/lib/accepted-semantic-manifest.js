'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_REL = 'data/preservation/accepted-semantic-manifests.json';

function decodeEntities(value) {
  const named = new Map([
    ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', ' '],
    ['laquo', '«'], ['raquo', '»'], ['ndash', '–'], ['mdash', '—'], ['hellip', '…'],
  ]);
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const raw = entity.slice(hex ? 2 : 1);
      const code = Number.parseInt(raw, hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return named.get(entity.toLowerCase()) ?? full;
  });
}

function normalizeVisibleText(raw) {
  return decodeEntities(
    String(raw || '')
      .replace(/^---[\s\S]*?---\s*/m, ' ')
      .replace(/<!--[^]*?-->/g, ' ')
      .replace(/<script\b[^>]*>[^]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[^]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

function loadManifest(root = ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, MANIFEST_REL), 'utf8'));
}

function validateEntryText(entry, raw, surface) {
  const issues = [];
  const text = normalizeVisibleText(raw);
  for (const unit of entry.requiredUnits || []) {
    const anchor = normalizeVisibleText(unit.anchor);
    if (!anchor) {
      issues.push(`${entry.id}:${surface}:${unit.id}: empty anchor`);
      continue;
    }
    if (!text.includes(anchor)) issues.push(`${entry.id}:${surface}:${unit.id}: required semantic unit missing`);
  }
  return issues;
}

function validateManifestShape(manifest, root = ROOT) {
  const issues = [];
  if (manifest.schemaVersion !== 1) issues.push(`schemaVersion must be 1, got ${manifest.schemaVersion}`);
  if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) {
    issues.push('routes must be a non-empty array');
    return issues;
  }

  const routeIds = manifest.routes.map((entry) => entry.id);
  if (new Set(routeIds).size !== routeIds.length) issues.push('route manifest IDs must be unique');

  for (const entry of manifest.routes) {
    if (!entry.id || !entry.route || !entry.owner || !entry.distPath) issues.push(`${entry.id || '(missing-id)'}: incomplete route identity`);
    if (!Array.isArray(entry.sourceFiles) || entry.sourceFiles.length === 0) issues.push(`${entry.id}: sourceFiles must be non-empty`);
    if (!Array.isArray(entry.requiredUnits) || entry.requiredUnits.length === 0) issues.push(`${entry.id}: requiredUnits must be non-empty`);

    const unitIds = (entry.requiredUnits || []).map((unit) => unit.id);
    if (new Set(unitIds).size !== unitIds.length) issues.push(`${entry.id}: semantic unit IDs must be unique`);
    for (const unit of entry.requiredUnits || []) {
      if (!unit.id || !unit.anchor) issues.push(`${entry.id}: semantic unit requires id + anchor`);
    }

    if (!fs.existsSync(path.join(root, entry.owner))) issues.push(`${entry.id}: declared owner missing: ${entry.owner}`);
    for (const relative of entry.sourceFiles || []) {
      if (!fs.existsSync(path.join(root, relative))) issues.push(`${entry.id}: source file missing: ${relative}`);
    }
    for (const relative of entry.delegatedGuards || []) {
      if (!fs.existsSync(path.join(root, relative))) issues.push(`${entry.id}: delegated guard missing: ${relative}`);
    }
  }
  return issues;
}

function sourceCorpus(entry, root = ROOT) {
  return (entry.sourceFiles || []).map((relative) => fs.readFileSync(path.join(root, relative), 'utf8')).join('\n');
}

function validateAcceptedSemanticManifests(options = {}) {
  const root = options.root || ROOT;
  const requireDist = Boolean(options.requireDist);
  const manifest = options.manifest || loadManifest(root);
  const issues = [...validateManifestShape(manifest, root)];
  const results = [];

  for (const entry of manifest.routes || []) {
    const routeIssues = [];
    let sourceRaw = '';
    try {
      sourceRaw = sourceCorpus(entry, root);
      routeIssues.push(...validateEntryText(entry, sourceRaw, 'source'));
    } catch (error) {
      routeIssues.push(`${entry.id}:source: ${error.message}`);
    }

    if (requireDist) {
      const distFile = path.join(root, 'dist', entry.distPath);
      if (!fs.existsSync(distFile)) routeIssues.push(`${entry.id}:dist: missing ${entry.distPath}`);
      else routeIssues.push(...validateEntryText(entry, fs.readFileSync(distFile, 'utf8'), 'dist'));
    }

    issues.push(...routeIssues);
    results.push({ id: entry.id, route: entry.route, requiredUnits: (entry.requiredUnits || []).length, issues: routeIssues.length });
  }

  return { manifest, issues, results, requireDist };
}

function runAcceptedSemanticMutationChecks(options = {}) {
  const root = options.root || ROOT;
  const manifest = options.manifest || loadManifest(root);
  let killed = 0;

  for (const entry of manifest.routes || []) {
    const baseline = sourceCorpus(entry, root);
    const baselineIssues = validateEntryText(entry, baseline, 'mutation-baseline');
    if (baselineIssues.length) throw new Error(`Cannot mutation-test invalid baseline for ${entry.id}: ${baselineIssues.join('; ')}`);

    const firstUnit = entry.requiredUnits?.[0];
    if (!firstUnit) throw new Error(`${entry.id}: no required semantic unit available for mutation`);
    const anchor = normalizeVisibleText(firstUnit.anchor);
    const normalizedBaseline = normalizeVisibleText(baseline);
    if (!normalizedBaseline.includes(anchor)) throw new Error(`${entry.id}: mutation anchor not found in baseline`);

    const mutated = normalizedBaseline.replace(anchor, '');
    const mutationIssues = validateEntryText(entry, mutated, 'mutation-delete');
    if (!mutationIssues.some((issue) => issue.includes(`${firstUnit.id}: required semantic unit missing`))) {
      throw new Error(`${entry.id}: deletion mutation survived for ${firstUnit.id}`);
    }
    killed += 1;
  }
  return killed;
}

function runAcceptedSemanticManifestAudit(options = {}) {
  const killed = runAcceptedSemanticMutationChecks(options);
  const report = validateAcceptedSemanticManifests(options);
  if (report.issues.length) {
    const error = new Error(`Accepted semantic manifest failed:\n- ${report.issues.join('\n- ')}`);
    error.report = report;
    throw error;
  }
  return { ...report, mutationCasesKilled: killed };
}

module.exports = {
  MANIFEST_REL,
  loadManifest,
  normalizeVisibleText,
  runAcceptedSemanticManifestAudit,
  runAcceptedSemanticMutationChecks,
  validateAcceptedSemanticManifests,
  validateEntryText,
  validateManifestShape,
};
