#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTeenReadingTimes } from './lib/teen-reading-time-contract.mjs';

const config = `
const TOTAL_MIN = 12;
export const TEEN_DOUBLE_LIFE_SERIES = defineSeriesConfig({
  items: [
    { id: 'first', href: '/articles/a/', readingTime: '5 мин' },
    { id: 'second', href: '/articles/b/', readingTime: '7 мин' },
  ],
  pages: {
    'first': { readingProgressDoneMin: 0, readingProgressPartMin: 5, readingProgressTotalMin: TOTAL_MIN },
    'second': { readingProgressDoneMin: 5, readingProgressPartMin: 7, readingProgressTotalMin: TOTAL_MIN },
  },
});`;
const items = [['I', 'first', 'a'], ['II', 'second', 'b']];
const parts = [{ n: 'I', slug: 'a', readingTime: 5 }, { n: 'II', slug: 'b', readingTime: 7 }];
const frontmatterMinutes = { a: '5', b: '7' };
const check = (overrides = {}) => checkTeenReadingTimes({ config, items, parts, frontmatterMinutes, ...overrides });

test('matches metadata, each rail item, each page and total', () => {
  assert.deepEqual(check(), []);
});

test('detects changed rail, frontmatter, per-page progress and total independently', () => {
  assert.match(check({ config: config.replace("readingTime: '7 мин'", "readingTime: '8 мин'") }).join('\n'), /II .*rail readingTime/);
  assert.match(check({ frontmatterMinutes: { a: '6', b: '7' } }).join('\n'), /I .*frontmatter/);
  // A correct value on the first page must not mask the second page's error.
  assert.match(check({ config: config.replace('readingProgressDoneMin: 5,', 'readingProgressDoneMin: 0,') }).join('\n'), /II .*progress done/);
  assert.match(check({ config: config.replace('readingProgressPartMin: 7', 'readingProgressPartMin: 5') }).join('\n'), /II .*progress part/);
  assert.match(check({ config: config.replace('TOTAL_MIN = 12', 'TOTAL_MIN = 11') }).join('\n'), /TOTAL_MIN must equal 12/);
  assert.match(check({ config: config.replace('readingProgressTotalMin: TOTAL_MIN', 'readingProgressTotalMin: 12') }).join('\n'), /progress total must reference/);
});

test('fails closed on missing, reordered and malformed config', () => {
  assert.match(check({ config: config.replace("id: 'first'", "id: 'second'") }).join('\n'), /rail id\/order mismatch/);
  assert.match(check({ config: config.replace("'second': {", "'other': {") }).join('\n'), /expected one second property/);
  assert.match(check({ config: config.replace('TOTAL_MIN = 12', 'TOTAL_MIN = 5 + 7') }).join('\n'), /TOTAL_MIN must equal/);
  assert.match(check({ config: 'const =' }).join('\n'), /not valid TypeScript/);
  assert.match(check({ parts: [parts[0]] }).join('\n'), /metadata part count mismatch/);
});
