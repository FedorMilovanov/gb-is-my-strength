#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT = path.join(ROOT, 'reports', 'editorial-metadata-observed.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'reports', 'editorial-metadata-semantic-divergence.json');
const MOSCOW_OFFSET_MINUTES = 180;

const PUBLICATION_FIELDS = [
  'visiblePublishedAt',
  'metaPublishedAt',
  'jsonLdPublishedAt',
  'searchPublishedAt',
  'rssPublishedAt',
];
const MODIFICATION_FIELDS = [
  'visibleModifiedAt',
  'metaModifiedAt',
  'jsonLdModifiedAt',
  'searchModifiedAt',
  'sitemapLastmod',
];
const COARSE_CALENDAR_FIELDS = new Set(['visiblePublishedAt', 'visibleModifiedAt']);

function argumentValue(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  return raw ? path.resolve(ROOT, raw.slice(prefix.length)) : fallback;
}

function parseInstant(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcCalendarDate(value) {
  const date = parseInstant(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function editorialCalendarDate(value) {
  const date = parseInstant(value);
  if (!date) return null;
  const shifted = new Date(date.getTime() + MOSCOW_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function classifyGroup(observations, fields) {
  const present = fields
    .map((field) => ({ field, value: observations?.[field] || null }))
    .filter(({ value }) => value && parseInstant(value));

  if (present.length <= 1) {
    return { status: 'insufficient', present, exactValues: [...new Set(present.map(({ value }) => parseInstant(value).toISOString()))] };
  }

  const exactValues = [...new Set(present.map(({ value }) => parseInstant(value).toISOString()))];
  if (exactValues.length === 1) return { status: 'exact-convergent', present, exactValues };

  const coarse = present.filter(({ field }) => COARSE_CALENDAR_FIELDS.has(field));
  const precise = present.filter(({ field }) => !COARSE_CALENDAR_FIELDS.has(field));
  if (coarse.length) {
    const coarseDates = [...new Set(coarse.map(({ value }) => utcCalendarDate(value)))];
    const preciseDates = [...new Set(precise.map(({ value }) => editorialCalendarDate(value)))];
    if (coarseDates.length === 1 && preciseDates.length === 1 && coarseDates[0] === preciseDates[0]) {
      return {
        status: 'calendar-convergent-precision-only',
        present,
        exactValues,
        editorialDate: coarseDates[0],
      };
    }
  }

  return {
    status: 'divergent',
    present,
    exactValues,
    editorialDates: [...new Set(present.map(({ field, value }) => (
      COARSE_CALENDAR_FIELDS.has(field) ? utcCalendarDate(value) : editorialCalendarDate(value)
    )))],
  };
}

function main() {
  const input = argumentValue('input', DEFAULT_INPUT);
  const output = argumentValue('out', DEFAULT_OUTPUT);
  if (!fs.existsSync(input)) throw new Error(`observed metadata snapshot missing: ${path.relative(ROOT, input)}`);

  const registry = JSON.parse(fs.readFileSync(input, 'utf8'));
  const records = [];
  const counts = {
    total: 0,
    exactConvergent: 0,
    precisionOnly: 0,
    divergent: 0,
    publicationDivergent: 0,
    modificationDivergent: 0,
  };

  for (const [route, record] of Object.entries(registry.records || {})) {
    const publication = classifyGroup(record.observations, PUBLICATION_FIELDS);
    const modification = classifyGroup(record.observations, MODIFICATION_FIELDS);
    const hasDivergence = publication.status === 'divergent' || modification.status === 'divergent';
    const hasPrecisionOnly = !hasDivergence && (
      publication.status === 'calendar-convergent-precision-only' ||
      modification.status === 'calendar-convergent-precision-only'
    );
    const status = hasDivergence ? 'divergent' : hasPrecisionOnly ? 'precision-only' : 'exact-convergent';

    counts.total += 1;
    if (status === 'divergent') counts.divergent += 1;
    else if (status === 'precision-only') counts.precisionOnly += 1;
    else counts.exactConvergent += 1;
    if (publication.status === 'divergent') counts.publicationDivergent += 1;
    if (modification.status === 'divergent') counts.modificationDivergent += 1;

    records.push({
      route,
      reviewStatus: record.reviewStatus,
      status,
      publication,
      modification,
    });
  }

  const report = {
    schemaVersion: 1,
    semantics: {
      editorialTimezone: 'UTC+03:00',
      coarseCalendarFields: [...COARSE_CALENDAR_FIELDS],
      rule: 'visible date-only projections compare by editorial calendar day; precise metadata/search/sitemap/RSS projections retain instant semantics',
    },
    counts,
    records,
  };

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(`Editorial metadata semantic divergence: ${counts.divergent} divergent / ${counts.precisionOnly} precision-only / ${counts.exactConvergent} exact-convergent (${counts.total} total)`);
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
