#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gatePath = path.join(ROOT, 'data/genesis6-enoch-footnote-gates.json');

const fail = (message) => {
  console.error(`ERROR genesis6 enoch footnote gate: ${message}`);
  process.exitCode = 1;
};

const frontmatterValue = (source, key) => {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.replace(/^["']|["']$/g, '');
};

if (!fs.existsSync(gatePath)) {
  fail('missing data/genesis6-enoch-footnote-gates.json');
  process.exit();
}

const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
if (gate.schemaVersion !== 1 || gate.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (gate.releaseState !== 'blocked') fail('releaseState must remain blocked while targets are incomplete');
if (!Array.isArray(gate.articles) || gate.articles.length !== 2) fail('exactly two extension articles are required');

const seen = new Set();
const results = [];
for (const article of gate.articles) {
  if (!['6A', '6B'].includes(article.articleKey)) fail(`unsupported articleKey ${article.articleKey}`);
  if (seen.has(article.articleKey)) fail(`duplicate articleKey ${article.articleKey}`);
  seen.add(article.articleKey);

  if (!Number.isInteger(article.minimumExistingFootnoteDefinitions) || article.minimumExistingFootnoteDefinitions < 1) {
    fail(`${article.articleKey} invalid minimumExistingFootnoteDefinitions`);
  }
  if (!Number.isInteger(article.targetClaimLevelFootnoteGroups) || article.targetClaimLevelFootnoteGroups < article.minimumExistingFootnoteDefinitions) {
    fail(`${article.articleKey} invalid targetClaimLevelFootnoteGroups`);
  }
  if (!/^GEN6-ENOCH-6[AB]-.+-LIX$/.test(article.researchDocumentId || '')) {
    fail(`${article.articleKey} invalid Research document id`);
  }

  const file = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
  if (!fs.existsSync(file)) {
    fail(`${article.articleKey} missing article file ${article.slug}.mdx`);
    continue;
  }
  const source = fs.readFileSync(file, 'utf8');
  const definitions = source.match(/^\[\^[^\]]+\]:/gm) || [];
  const references = source.match(/\[\^[^\]]+\]/g) || [];
  const uniqueDefinitions = new Set(definitions.map((value) => value.slice(2, -2)));

  if (frontmatterValue(source, 'slug') !== article.slug) fail(`${article.articleKey} slug drift`);
  if (frontmatterValue(source, 'series') !== 'genesis-6') fail(`${article.articleKey} series drift`);
  if (gate.policy?.requireDraft && frontmatterValue(source, 'draft') !== true) fail(`${article.articleKey} must remain draft`);
  if (gate.policy?.requireNoindex && frontmatterValue(source, 'noindex') !== true) fail(`${article.articleKey} must remain noindex`);
  if (gate.policy?.requireSourcesRequired && frontmatterValue(source, 'sourcesRequired') !== true) fail(`${article.articleKey} must require sources`);
  if (gate.policy?.failOnFootnoteRegression && definitions.length < article.minimumExistingFootnoteDefinitions) {
    fail(`${article.articleKey} footnote definitions regressed: ${definitions.length} < ${article.minimumExistingFootnoteDefinitions}`);
  }
  if (uniqueDefinitions.size !== definitions.length) fail(`${article.articleKey} contains duplicate footnote definitions`);

  const targetMet = definitions.length >= article.targetClaimLevelFootnoteGroups;
  if (!gate.policy?.allowDraftBelowTarget && !targetMet) {
    fail(`${article.articleKey} target not met: ${definitions.length} < ${article.targetClaimLevelFootnoteGroups}`);
  }

  results.push({
    articleKey: article.articleKey,
    definitions: definitions.length,
    references: references.length,
    target: article.targetClaimLevelFootnoteGroups,
    targetMet,
  });
}

if ([...seen].sort().join(',') !== '6A,6B') fail('article keys must be exactly 6A and 6B');

if (!process.exitCode) {
  const detail = results
    .map((item) => `${item.articleKey} ${item.definitions}/${item.target}${item.targetMet ? ' target-met' : ' draft-hold'}`)
    .join(', ');
  console.log(`Genesis 6 Enoch footnote gate: PASS (${detail}; release blocked)`);
}
