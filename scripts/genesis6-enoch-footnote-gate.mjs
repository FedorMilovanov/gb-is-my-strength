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

const sortedUnique = (values) => [...new Set(values)].sort((a, b) =>
  a.localeCompare(b, 'en', { numeric: true }),
);

const exactNumericIds = (count) => Array.from({ length: count }, (_, index) => String(index + 1));

if (!fs.existsSync(gatePath)) {
  fail('missing data/genesis6-enoch-footnote-gates.json');
  process.exit();
}

const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
if (gate.schemaVersion !== 2 || gate.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (!['blocked', 'published'].includes(gate.releaseState)) {
  fail('releaseState must be blocked or published');
}
if (!Array.isArray(gate.articles) || gate.articles.length !== 2) {
  fail('exactly two extension articles are required');
}

const seen = new Set();
const results = [];
for (const article of gate.articles) {
  if (!['6A', '6B'].includes(article.articleKey)) fail(`unsupported articleKey ${article.articleKey}`);
  if (seen.has(article.articleKey)) fail(`duplicate articleKey ${article.articleKey}`);
  seen.add(article.articleKey);

  if (!Number.isInteger(article.minimumExistingFootnoteDefinitions) || article.minimumExistingFootnoteDefinitions < 1) {
    fail(`${article.articleKey} invalid minimumExistingFootnoteDefinitions`);
  }
  if (!Number.isInteger(article.targetClaimLevelFootnoteGroups) || article.targetClaimLevelFootnoteGroups < 1) {
    fail(`${article.articleKey} invalid targetClaimLevelFootnoteGroups`);
  }
  if (article.minimumExistingFootnoteDefinitions !== article.targetClaimLevelFootnoteGroups) {
    fail(`${article.articleKey} minimum and target must match after source insertion`);
  }
  if (!/^GEN6-ENOCH-6[AB]-.+-LIX$/.test(article.researchDocumentId || '')) {
    fail(`${article.articleKey} invalid Research document id`);
  }
  if (article.status !== 'claim-level-sources-inserted') {
    fail(`${article.articleKey} status must be claim-level-sources-inserted`);
  }

  const expectedIds = exactNumericIds(article.targetClaimLevelFootnoteGroups);
  if (!Array.isArray(article.requiredFootnoteIds)) {
    fail(`${article.articleKey} requiredFootnoteIds must be an array`);
  } else if (article.requiredFootnoteIds.join(',') !== expectedIds.join(',')) {
    fail(`${article.articleKey} requiredFootnoteIds must be exactly ${expectedIds.join(',')}`);
  }

  const file = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
  if (!fs.existsSync(file)) {
    fail(`${article.articleKey} missing article file ${article.slug}.mdx`);
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  const definitionIds = [...source.matchAll(/^\[\^([^\]]+)\]:/gm)].map((match) => match[1]);
  const referenceIds = [...source.matchAll(/\[\^([^\]]+)\](?!:)/g)].map((match) => match[1]);
  const uniqueDefinitions = new Set(definitionIds);
  const uniqueReferences = new Set(referenceIds);
  const requiredIds = new Set(article.requiredFootnoteIds || []);

  if (frontmatterValue(source, 'slug') !== article.slug) fail(`${article.articleKey} slug drift`);
  if (frontmatterValue(source, 'series') !== 'genesis-6') fail(`${article.articleKey} series drift`);
  if (typeof gate.policy?.requireDraft === 'boolean' && frontmatterValue(source, 'draft') !== gate.policy.requireDraft) {
    fail(`${article.articleKey} draft must be ${gate.policy.requireDraft}`);
  }
  if (typeof gate.policy?.requireNoindex === 'boolean' && frontmatterValue(source, 'noindex') !== gate.policy.requireNoindex) {
    fail(`${article.articleKey} noindex must be ${gate.policy.requireNoindex}`);
  }
  if (gate.policy?.requireSourcesRequired && frontmatterValue(source, 'sourcesRequired') !== true) {
    fail(`${article.articleKey} must require sources`);
  }

  if (gate.policy?.failOnFootnoteRegression && definitionIds.length < article.minimumExistingFootnoteDefinitions) {
    fail(`${article.articleKey} footnote definitions regressed: ${definitionIds.length} < ${article.minimumExistingFootnoteDefinitions}`);
  }
  if (uniqueDefinitions.size !== definitionIds.length) {
    fail(`${article.articleKey} contains duplicate footnote definitions`);
  }

  if (gate.policy?.requireDefinedReferences) {
    const missing = sortedUnique(referenceIds.filter((id) => !uniqueDefinitions.has(id)));
    if (missing.length) fail(`${article.articleKey} references undefined footnotes: ${missing.join(', ')}`);
  }

  if (gate.policy?.requireUsedDefinitions) {
    const unused = sortedUnique(definitionIds.filter((id) => !uniqueReferences.has(id)));
    if (unused.length) fail(`${article.articleKey} contains unused footnote definitions: ${unused.join(', ')}`);
  }

  if (gate.policy?.requireContiguousNumericFootnotes) {
    const nonNumeric = definitionIds.filter((id) => !/^\d+$/.test(id));
    if (nonNumeric.length) {
      fail(`${article.articleKey} contains non-numeric footnote ids: ${sortedUnique(nonNumeric).join(', ')}`);
    }
    const numericIds = definitionIds.map(Number).sort((a, b) => a - b).map(String);
    if (numericIds.join(',') !== expectedIds.join(',')) {
      fail(`${article.articleKey} footnote numbering must be exactly ${expectedIds.join(',')}`);
    }
  }

  if (gate.policy?.requireExactDefinitionSet) {
    const missingDefinitions = expectedIds.filter((id) => !uniqueDefinitions.has(id));
    const unexpectedDefinitions = sortedUnique(definitionIds.filter((id) => !requiredIds.has(id)));
    if (missingDefinitions.length) {
      fail(`${article.articleKey} missing required definitions: ${missingDefinitions.join(', ')}`);
    }
    if (unexpectedDefinitions.length) {
      fail(`${article.articleKey} contains unexpected definitions: ${unexpectedDefinitions.join(', ')}`);
    }
    const missingClaimReferences = expectedIds.filter((id) => !uniqueReferences.has(id));
    if (missingClaimReferences.length) {
      fail(`${article.articleKey} missing claim references: ${missingClaimReferences.join(', ')}`);
    }
  }

  const targetMet = definitionIds.length === article.targetClaimLevelFootnoteGroups;
  if (!gate.policy?.allowDraftBelowTarget && !targetMet) {
    fail(`${article.articleKey} exact target not met: ${definitionIds.length} != ${article.targetClaimLevelFootnoteGroups}`);
  }

  results.push({
    articleKey: article.articleKey,
    definitions: definitionIds.length,
    references: referenceIds.length,
    uniqueReferences: uniqueReferences.size,
    target: article.targetClaimLevelFootnoteGroups,
    targetMet,
  });
}

if ([...seen].sort().join(',') !== '6A,6B') fail('article keys must be exactly 6A,6B');

if (!process.exitCode) {
  const detail = results
    .map((item) => `${item.articleKey} ${item.definitions}/${item.target} exact definitions, ${item.uniqueReferences} used ids, ${item.references} references`)
    .join('; ');
  console.log(`Genesis 6 Enoch footnote gate: PASS (${detail}; release state ${gate.releaseState}, sourcesRequired preserved)`);
}
