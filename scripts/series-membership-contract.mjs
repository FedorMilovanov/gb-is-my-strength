#!/usr/bin/env node
/*
 * series-membership-contract.mjs — typed membership owner for
 * SYS-SERIES-DISCOVERY-CURRENT-AUTHORITY.
 *
 * data/series.json is the single authority for series membership; before this
 * contract its shape was untyped (any JSON object passed). This guard makes
 * the authority explicit:
 *
 *   series: id is a slug; title non-empty; parts non-empty; optional baseUrl
 *           route-like; optional searchPolicy with required subkeys
 *   part:   n unique per series — non-negative integer or authored string
 *           mark (intentional taxonomy: I/II/III/A/B/C/D, "6A"); slug
 *           ^[a-z0-9-]+$; title non-empty; status in {published, planned,
 *           draft}; readingTime positive int when present
 *   global: a slug belongs to exactly one series (membership authority)
 *
 * Usage: node scripts/series-membership-contract.mjs [--series=data/series.json]
 * Exit codes: 0 pass, 1 violations, 2 usage/schema error.
 */
import fs from 'node:fs';
import path from 'node:path';

const seriesArg = process.argv.slice(2).find((a) => a.startsWith('--series='));
const seriesFile = path.resolve(process.cwd(), seriesArg ? seriesArg.split('=').slice(1).join('=') : 'data/series.json');

function usage(message) {
  console.error(`SERIES MEMBERSHIP CONTRACT: ${message}`);
  process.exit(2);
}

if (!fs.existsSync(seriesFile)) usage(`missing series manifest: ${seriesFile}`);

let series;
try {
  series = JSON.parse(fs.readFileSync(seriesFile, 'utf8'));
} catch (error) {
  usage(`invalid JSON: ${error.message}`);
}
if (!series || typeof series !== 'object' || Array.isArray(series)) usage('manifest must be an object keyed by series id');

const SLUG_RE = /^[a-z0-9-]+$/;
const ROUTE_RE = /^\/[a-z0-9-/]*\/$/;
const ALLOWED_STATUS = new Set(['published', 'planned', 'draft']);
const ALLOWED_SERIES_KEYS = new Set(['title', 'baseUrl', 'searchPolicy', 'parts']);
const ALLOWED_PART_KEYS = new Set(['n', 'slug', 'title', 'status', 'readingTime']);
const SEARCH_POLICY_KEYS = ['landingRoute', 'librarySection', 'topicCategory'];

const violations = [];
let seriesCount = 0;
let partCount = 0;
const slugOwner = new Map();

for (const [seriesId, def] of Object.entries(series)) {
  seriesCount += 1;
  if (!SLUG_RE.test(seriesId)) violations.push(`series "${seriesId}": id must match ${SLUG_RE}`);
  if (!def || typeof def !== 'object' || Array.isArray(def)) {
    violations.push(`series "${seriesId}": definition must be an object`);
    continue;
  }
  for (const key of Object.keys(def)) {
    if (!ALLOWED_SERIES_KEYS.has(key)) violations.push(`series "${seriesId}": unknown key "${key}" (allowed: ${[...ALLOWED_SERIES_KEYS].join(', ')})`);
  }
  if (typeof def.title !== 'string' || def.title.trim() === '') violations.push(`series "${seriesId}": title must be a non-empty string`);
  if (def.baseUrl !== undefined && (typeof def.baseUrl !== 'string' || !ROUTE_RE.test(def.baseUrl))) {
    violations.push(`series "${seriesId}": baseUrl must be a root-absolute route ending with "/" (got ${JSON.stringify(def.baseUrl)})`);
  }
  if (def.searchPolicy !== undefined) {
    if (!def.searchPolicy || typeof def.searchPolicy !== 'object' || Array.isArray(def.searchPolicy)) {
      violations.push(`series "${seriesId}": searchPolicy must be an object`);
    } else {
      for (const key of SEARCH_POLICY_KEYS) {
        if (typeof def.searchPolicy[key] !== 'string' || def.searchPolicy[key].trim() === '') {
          violations.push(`series "${seriesId}": searchPolicy.${key} must be a non-empty string`);
        }
      }
    }
  }
  if (!Array.isArray(def.parts) || def.parts.length === 0) {
    violations.push(`series "${seriesId}": parts must be a non-empty array`);
    continue;
  }
  const seenN = new Set();
  for (const [index, part] of def.parts.entries()) {
    partCount += 1;
    const where = `series "${seriesId}" parts[${index}]`;
    if (!part || typeof part !== 'object' || Array.isArray(part)) {
      violations.push(`${where}: must be an object`);
      continue;
    }
    for (const key of Object.keys(part)) {
      if (!ALLOWED_PART_KEYS.has(key)) violations.push(`${where}: unknown key "${key}" (allowed: ${[...ALLOWED_PART_KEYS].join(', ')})`);
    }
    const nValid = (Number.isInteger(part.n) && part.n >= 0) || (typeof part.n === 'string' && part.n.trim() !== '');
    if (!nValid) violations.push(`${where}: n must be a non-negative integer or a non-empty string mark`);
    else {
      const mark = String(part.n);
      if (seenN.has(mark)) violations.push(`${where}: duplicate n=${JSON.stringify(part.n)} within the series`);
      else seenN.add(mark);
    }
    if (typeof part.slug !== 'string' || !SLUG_RE.test(part.slug)) violations.push(`${where}: slug must match ${SLUG_RE}`);
    else {
      const owner = slugOwner.get(part.slug);
      if (owner) violations.push(`${where}: slug "${part.slug}" already belongs to ${owner} (membership must be unique)`);
      else slugOwner.set(part.slug, `${seriesId}#${part.n}`);
    }
    if (typeof part.title !== 'string' || part.title.trim() === '') violations.push(`${where}: title must be a non-empty string`);
    if (!ALLOWED_STATUS.has(part.status)) violations.push(`${where}: status must be one of ${[...ALLOWED_STATUS].join('/')} (got ${JSON.stringify(part.status)})`);
    if (part.readingTime !== undefined && (!Number.isInteger(part.readingTime) || part.readingTime < 1)) {
      violations.push(`${where}: readingTime must be a positive integer when present`);
    }
  }
}

console.log(`SERIES MEMBERSHIP: series=${seriesCount}, parts=${partCount}, unique slugs=${slugOwner.size}`);

if (violations.length > 0) {
  console.error(`SERIES MEMBERSHIP CONTRACT: FAIL (${violations.length} violation(s))`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log('SERIES MEMBERSHIP CONTRACT: PASS (typed authority, unique membership)');
