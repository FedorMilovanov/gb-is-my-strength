#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY = path.join(ROOT, 'data/home-component-lab-inventory-2026-08-01.json');
const LAB_ROOT = path.join(ROOT, 'research/component-lab/home');
const LAB_REFERENCE = 'research/component-lab/home/';
const SPECIMEN_RELATIVE = `${LAB_REFERENCE}specimen.html.txt`;
const allowedStatuses = new Set(['KEEP_CURRENT', 'LAB_ONLY', 'REFERENCE_ONLY', 'SUPERSEDED']);

const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
assert.equal(inventory.schema_version, 1);
assert.equal(inventory.authority_id, 'A17-HOME-COMPONENT-LAB-2026-08-01');
assert.equal(inventory.production_boundary.lab_root, LAB_REFERENCE);
assert.equal(inventory.production_boundary.specimen_source, SPECIMEN_RELATIVE);
assert.equal(inventory.production_boundary.reader_html_extension_allowed, false);
assert.equal(inventory.production_boundary.production_dependency_allowed, false);
assert.equal(inventory.production_boundary.route_registration_allowed, false);
assert.equal(inventory.visual_evidence.sha256.length, 64);
assert.ok(inventory.decisions.length >= 8);

const ids = new Set();
for (const decision of inventory.decisions) {
  assert.match(decision.id, /^[a-z0-9-]+$/);
  assert.ok(!ids.has(decision.id), `duplicate decision id: ${decision.id}`);
  ids.add(decision.id);
  assert.ok(allowedStatuses.has(decision.status), `invalid status: ${decision.status}`);
  if (decision.lab_specimen) assert.ok(decision.lab_specimen.startsWith(`${SPECIMEN_RELATIVE}#`));
}

const labFiles = fs.readdirSync(LAB_ROOT, { withFileTypes: true });
assert.ok(!labFiles.some((entry) => entry.isFile() && entry.name.endsWith('.html')), 'lab must not contain reader HTML files');
const specimen = fs.readFileSync(path.join(LAB_ROOT, 'specimen.html.txt'), 'utf8');
assert.match(specimen, /NON_PRODUCTION_COMPONENT_LAB/);
assert.match(specimen, /noindex,nofollow,noarchive/);
for (const id of ['sacred-word-inline-flip', 'legacy-functional-index', 'five-direction-gateway', 'route-card-tilt-motion']) {
  assert.ok(specimen.includes(`data-prototype-id="${id}"`), `missing lab specimen: ${id}`);
}
assert.match(specimen, /prefers-reduced-motion:\s*reduce/);
assert.doesNotMatch(specimen, /<(?:script|link)\b[^>]*(?:src|href)=/i);

const productionRoots = ['src', 'js', 'css', 'migration'];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
for (const root of productionRoots) {
  for (const file of walk(path.join(ROOT, root))) {
    if (!/\.(?:astro|[cm]?[jt]s|css|json|html|mdx?)$/i.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(!source.includes(LAB_REFERENCE), `production dependency on lab: ${path.relative(ROOT, file)}`);
  }
}

console.log(`A17 HOME COMPONENT LAB CONTRACT: PASS (${inventory.decisions.length} decisions; ${ids.size} unique ids; zero production dependencies; zero reader HTML files)`);
