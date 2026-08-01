#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WRITE = process.argv.includes('--write');
const REGISTRY = path.join(ROOT, 'scripts', 'lib', 'note-registry.mjs');
const CONTRACT = path.join(ROOT, 'scripts', 'note-registry-contract-test.mjs');

const BEFORE_CSS = '@media print{.gb-note-endnotes{position:static!important;width:auto!important;height:auto!important;margin:2rem 0!important;overflow:visible!important;clip:auto!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}';
const AFTER_CSS = '@media print{.gb-note-endnotes{display:block!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;margin:2rem 0 0!important;padding:0!important;overflow:visible!important;clip:auto!important;visibility:visible!important;opacity:1!important;break-before:auto!important;page-break-before:auto!important;break-after:auto!important;page-break-after:auto!important}.gb-note-endnotes h2{display:block!important;break-after:avoid-page!important;page-break-after:avoid!important}.gb-note-endnotes ol{display:block!important;margin:.75rem 0 0!important;padding-left:1.5rem!important;list-style:decimal!important;overflow:visible!important}.gb-note-endnotes li{display:list-item!important;position:static!important;width:auto!important;height:auto!important;max-height:none!important;overflow:visible!important;clip:auto!important;visibility:visible!important;opacity:1!important;break-inside:avoid-page!important;page-break-inside:avoid!important}.fn-marker>.tooltip{display:none!important}.gb-note-endnotes__back{display:none!important}}';
const BEFORE_EMPTY_GUARD = 'function buildEndnotes(route, notes) {\n  const routeSlug = stableRouteSlug(route);';
const AFTER_EMPTY_GUARD = "function buildEndnotes(route, notes) {\n  if (!notes.length) return '';\n  const routeSlug = stableRouteSlug(route);";
const BEFORE_CONTRACT = "execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'site-tooltip-touch-normalizer.js')], { stdio: 'inherit' });";
const AFTER_CONTRACT = `${BEFORE_CONTRACT}\nexecFileSync(process.execPath, [path.join(ROOT, 'scripts', 'note-print-normalizer.js')], { stdio: 'inherit' });`;

function count(source, needle) {
  return source.split(needle).length - 1;
}

function residualBeforeCount(source, before, after) {
  return count(source.split(after).join(''), before);
}

function normalize(file, before, after, label) {
  const source = fs.readFileSync(file, 'utf8');
  const afterCount = count(source, after);
  const residualCount = residualBeforeCount(source, before, after);
  if (afterCount === 1 && residualCount === 0) return false;
  if (afterCount !== 0 || residualCount !== 1) {
    throw new Error(`${label} normalizer refused input: residualBefore=${residualCount}, after=${afterCount}`);
  }
  if (!WRITE) throw new Error(`${label} is stale; rerun with --write`);
  const next = source.replace(before, after);
  const nextAfterCount = count(next, after);
  const nextResidualCount = residualBeforeCount(next, before, after);
  if (nextAfterCount !== 1 || nextResidualCount !== 0) {
    throw new Error(`${label} target verification failed: residualBefore=${nextResidualCount}, after=${nextAfterCount}`);
  }
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

const changed = [
  normalize(REGISTRY, BEFORE_CSS, AFTER_CSS, 'NoteRegistry print CSS'),
  normalize(REGISTRY, BEFORE_EMPTY_GUARD, AFTER_EMPTY_GUARD, 'NoteRegistry empty-endnotes guard'),
  normalize(CONTRACT, BEFORE_CONTRACT, AFTER_CONTRACT, 'NoteRegistry print source contract'),
].some(Boolean);

console.log(changed
  ? '✅ NoteRegistry print projection normalized'
  : '✅ NoteRegistry print projection contract already normalized');
