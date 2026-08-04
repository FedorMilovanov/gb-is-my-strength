import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBibleRegistry, parseBibleReference } from '../src/lib/bible-reference-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEARCH_FILE = path.join(ROOT, 'js/search.js');
const MANIFEST_FILE = path.join(ROOT, 'data/search-manifest.json');

const EXPECTED_SUGGESTIONS = ['Иер 17:9', 'Рим 7:14–25', '1 Тим 3', 'Тит 1'];
const FORBIDDEN_SUGGESTIONS = ['Ин 3:16', 'Мф 5:3', 'Рим 8:28'];
const REQUIRED_COPY = [
  'Поиск по статьям и ссылкам…',
  '<span>Ссылки</span>',
  'Ссылки в материалах',
  'Введите библейскую ссылку, указанную в материалах:'
];
const FORBIDDEN_COPY = [
  'Поиск по статьям, Писанию…',
  '<span>Писание</span>',
  'Поиск по Писанию',
  'Введите ссылку или слово из текста:'
];

function fail(message) {
  console.error(`SEARCH SCRIPTURE SUGGESTION CONTRACT FAILED: ${message}`);
  process.exitCode = 1;
}

function referenceId(input, registry) {
  const parsed = parseBibleReference(input, registry);
  if (!parsed?.ok) return null;
  return `${parsed.bookId}:${parsed.key}`;
}

function splitReferences(value) {
  return String(value || '')
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const source = fs.readFileSync(SEARCH_FILE, 'utf8');
const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
const registry = loadBibleRegistry(ROOT);
const manifestReferences = new Map();

for (const item of manifest.items || []) {
  for (const reference of splitReferences(item.scripture)) {
    const id = referenceId(reference, registry);
    if (!id) {
      fail(`manifest scripture reference does not parse: ${item.id || item.url}: ${reference}`);
      continue;
    }
    const owners = manifestReferences.get(id) || [];
    owners.push(item.url || item.id || '(unknown)');
    manifestReferences.set(id, owners);
  }
}

for (const text of REQUIRED_COPY) {
  if (!source.includes(text)) fail(`required truthful copy is absent: ${text}`);
}
for (const text of FORBIDDEN_COPY) {
  if (source.includes(text)) fail(`misleading legacy copy remains: ${text}`);
}

for (const suggestion of EXPECTED_SUGGESTIONS) {
  const id = referenceId(suggestion, registry);
  if (!id) {
    fail(`public suggestion does not parse: ${suggestion}`);
    continue;
  }
  if (!manifestReferences.has(id)) {
    fail(`public suggestion has no exact manifest owner: ${suggestion} (${id})`);
  }
  const occurrences = source.split(`\"${suggestion}\"`).length - 1;
  if (occurrences !== 1) {
    fail(`public suggestion must occur exactly once in the governed list: ${suggestion}; found ${occurrences}`);
  }
}

for (const suggestion of FORBIDDEN_SUGGESTIONS) {
  if (source.includes(`\"${suggestion}\"`)) {
    fail(`unsupported public suggestion remains: ${suggestion}`);
  }
}

const expectedArray = `var se=[\"Нагорная проповедь\",\"Иер 17:9\",\"Код да Винчи\",\"благодать\",\"Павел\"]`;
if (!source.includes(expectedArray)) {
  fail('general popular-query list drifted; this contract governs only the Scripture-scope suggestion list');
}

if (!process.exitCode) {
  console.log(`Search Scripture suggestion contract passed: ${EXPECTED_SUGGESTIONS.length} truthful suggestions, ${manifestReferences.size} canonical manifest references.`);
}
