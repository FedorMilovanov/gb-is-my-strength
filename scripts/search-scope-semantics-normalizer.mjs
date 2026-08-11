#!/usr/bin/env node
// Permanent fail-closed normalizer for the checked-in Search scope semantics.
// It accepts only the canonical legacy or normalized shape; mixed/unknown states are errors.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_PATH = path.join(ROOT, 'js/search.js');
const WRITE = process.argv.includes('--write');
const SELF_TEST = process.argv.includes('--self-test');

const LEGACY_MARKUP = '<div class="cp-scope-chips" role="tablist"><button class="cp-scope-chip active" data-scope="all" role="tab" aria-selected="true"><span class="cp-scope-icon">'+"'"+'+v+'+"'"+'</span><span>Все</span></button><button class="cp-scope-chip" data-scope="articles" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+u+'+"'"+'</span><span>Статьи</span></button><button class="cp-scope-chip" data-scope="scripture" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+f+'+"'"+'</span><span>Ссылки</span></button><button class="cp-scope-chip" data-scope="authors" role="tab" aria-selected="false"><span class="cp-scope-icon">'+"'"+'+w+'+"'"+'</span><span>Авторы</span></button></div>';
const NORMALIZED_MARKUP = '<div class="cp-scope-chips" role="group" aria-label="Область поиска"><button type="button" class="cp-scope-chip active" data-scope="all" aria-pressed="true"><span class="cp-scope-icon">'+"'"+'+v+'+"'"+'</span><span>Все</span></button><button type="button" class="cp-scope-chip" data-scope="articles" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+u+'+"'"+'</span><span>Статьи</span></button><button type="button" class="cp-scope-chip" data-scope="scripture" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+f+'+"'"+'</span><span>Ссылки</span></button><button type="button" class="cp-scope-chip" data-scope="authors" aria-pressed="false"><span class="cp-scope-icon">'+"'"+'+w+'+"'"+'</span><span>Авторы</span></button></div>';
const LEGACY_STATE = 'e.setAttribute("aria-selected",t?"true":"false")';
const NORMALIZED_STATE = 'e.setAttribute("aria-pressed",t?"true":"false")';
const CANONICAL_SUBHTML = 'e.subHtml&&e.subHtml.trim()?e.subHtml:e.sub?F(e.sub):""';
const CORRUPTED_SUBHTML = 'e.subHtml&&e.subHtml.trim()?e.sub?F(e.sub):"":e.sub?F(e.sub):""';

function count(source, needle) {
  return source.split(needle).length - 1;
}

function compile(source, label) {
  try {
    new vm.Script(source, { filename: label });
  } catch (error) {
    throw new Error(`${label} is not valid JavaScript: ${error.message}`);
  }
}

function inspect(source) {
  return {
    legacyMarkup: count(source, LEGACY_MARKUP),
    normalizedMarkup: count(source, NORMALIZED_MARKUP),
    legacyState: count(source, LEGACY_STATE),
    normalizedState: count(source, NORMALIZED_STATE),
    canonicalSubHtml: count(source, CANONICAL_SUBHTML),
    corruptedSubHtml: count(source, CORRUPTED_SUBHTML),
  };
}

function transform(source) {
  const before = inspect(source);
  if (before.corruptedSubHtml !== 0 || before.canonicalSubHtml !== 1) {
    throw new Error(`search result rendering authority drift: canonical=${before.canonicalSubHtml}, corrupted=${before.corruptedSubHtml}`);
  }

  const alreadyNormalized = before.normalizedMarkup === 1 && before.legacyMarkup === 0 && before.normalizedState === 2 && before.legacyState === 0;
  if (alreadyNormalized) {
    compile(source, 'js/search.js');
    return { source, changed: false, before };
  }

  if (before.legacyMarkup !== 1 || before.normalizedMarkup !== 0 || before.legacyState !== 2 || before.normalizedState !== 0) {
    throw new Error(`search scope authority drift: ${JSON.stringify(before)}`);
  }

  const output = source
    .replace(LEGACY_MARKUP, NORMALIZED_MARKUP)
    .replaceAll(LEGACY_STATE, NORMALIZED_STATE);
  const after = inspect(output);
  if (after.normalizedMarkup !== 1 || after.legacyMarkup !== 0 || after.normalizedState !== 2 || after.legacyState !== 0) {
    throw new Error(`search scope normalization postcondition failed: ${JSON.stringify(after)}`);
  }
  if (after.canonicalSubHtml !== 1 || after.corruptedSubHtml !== 0) {
    throw new Error(`search result rendering changed during scope normalization: ${JSON.stringify(after)}`);
  }
  compile(output, 'js/search.js.normalized');
  return { source: output, changed: true, before, after };
}

function selfTest() {
  const current = fs.readFileSync(SEARCH_PATH, 'utf8');
  const normalized = transform(current).source;
  const legacy = normalized
    .replace(NORMALIZED_MARKUP, LEGACY_MARKUP)
    .replaceAll(NORMALIZED_STATE, LEGACY_STATE);
  const first = transform(legacy);
  if (!first.changed || first.source !== normalized) throw new Error('self-test normalization failed');
  const second = transform(first.source);
  if (second.changed || second.source !== normalized) throw new Error('self-test idempotence failed');
  console.log('SEARCH SCOPE SEMANTICS NORMALIZER SELF-TEST: PASS');
}

if (SELF_TEST) {
  selfTest();
  process.exit(0);
}

const source = fs.readFileSync(SEARCH_PATH, 'utf8');
const result = transform(source);
if (result.changed) {
  if (!WRITE) {
    console.error('SEARCH SCOPE SEMANTICS NORMALIZER: DRIFT — run with --write');
    process.exit(1);
  }
  fs.writeFileSync(SEARCH_PATH, result.source);
  console.log('SEARCH SCOPE SEMANTICS NORMALIZER: WROTE 1 markup + 2 state assignments');
} else {
  console.log('SEARCH SCOPE SEMANTICS NORMALIZER: PASS');
}
