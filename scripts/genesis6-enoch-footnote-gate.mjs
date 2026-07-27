#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gatePath = path.join(ROOT, 'data/genesis6-enoch-footnote-gates.json');
const fail = (message) => { console.error(`ERROR genesis6 enoch footnote gate: ${message}`); process.exitCode = 1; };
const frontmatterValue = (source, key) => {
  const match = source.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return undefined;
  const raw = match[1].trim();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.replace(/^["']|["']$/g, '');
};
const collect = (source, regex) => { const values = []; for (const match of source.matchAll(regex)) values.push(match[1]); return values; };
if (!fs.existsSync(gatePath)) { fail('missing data/genesis6-enoch-footnote-gates.json'); process.exit(); }
const gate = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
if (gate.schemaVersion !== 2 || gate.seriesId !== 'genesis-6') fail('invalid schemaVersion/seriesId');
if (gate.releaseState !== 'blocked') fail('releaseState must remain blocked until a separate publication transaction');
if (!Array.isArray(gate.articles) || gate.articles.length !== 2) fail('exactly two extension articles are required');
const seen = new Set();
const results = [];
for (const article of gate.articles) {
  if (!['6A', '6B'].includes(article.articleKey)) fail(`unsupported articleKey ${article.articleKey}`);
  if (seen.has(article.articleKey)) fail(`duplicate articleKey ${article.articleKey}`);
  seen.add(article.articleKey);
  if (!Number.isInteger(article.minimumExistingFootnoteDefinitions) || article.minimumExistingFootnoteDefinitions < 1) fail(`${article.articleKey} invalid minimumExistingFootnoteDefinitions`);
  if (!Number.isInteger(article.targetClaimLevelFootnoteGroups) || article.targetClaimLevelFootnoteGroups < 1) fail(`${article.articleKey} invalid targetClaimLevelFootnoteGroups`);
  if (!/^GEN6-ENOCH-6[AB]-.+-LIX$/.test(article.researchDocumentId || '')) fail(`${article.articleKey} invalid Research document id`);
  if (article.status !== 'claim-level-source-pass-complete') fail(`${article.articleKey} status must be claim-level-source-pass-complete`);
  if (!Array.isArray(article.requiredFootnoteIds) || article.requiredFootnoteIds.length < article.targetClaimLevelFootnoteGroups) fail(`${article.articleKey} requiredFootnoteIds incomplete`);
  const file = path.join(ROOT, 'src/content/articles', `${article.slug}.mdx`);
  if (!fs.existsSync(file)) { fail(`${article.articleKey} missing article file ${article.slug}.mdx`); continue; }
  const source = fs.readFileSync(file, 'utf8');
  const definitions = collect(source, /^\[\^([^\]]+)\]:/gm);
  const references = collect(source, /\[\^([^\]]+)\](?!:)/g);
  const uniqueDefinitions = new Set(definitions);
  const uniqueReferences = new Set(references);
  const required = new Set(article.requiredFootnoteIds);
  if (frontmatterValue(source, 'slug') !== article.slug) fail(`${article.articleKey} slug drift`);
  if (frontmatterValue(source, 'series') !== 'genesis-6') fail(`${article.articleKey} series drift`);
  if (gate.policy?.requireDraft && frontmatterValue(source, 'draft') !== true) fail(`${article.articleKey} must remain draft`);
  if (gate.policy?.requireNoindex && frontmatterValue(source, 'noindex') !== true) fail(`${article.articleKey} must remain noindex`);
  if (gate.policy?.requireSourcesRequired && frontmatterValue(source, 'sourcesRequired') !== true) fail(`${article.articleKey} must require sources`);
  if (gate.policy?.failOnFootnoteRegression && definitions.length < article.minimumExistingFootnoteDefinitions) fail(`${article.articleKey} footnote definitions regressed: ${definitions.length} < ${article.minimumExistingFootnoteDefinitions}`);
  if (uniqueDefinitions.size !== definitions.length) fail(`${article.articleKey} contains duplicate footnote definitions`);
  if (new Set(article.requiredFootnoteIds).size !== article.requiredFootnoteIds.length) fail(`${article.articleKey} requiredFootnoteIds contains duplicates`);
  for (const id of required) {
    if (!uniqueDefinitions.has(id)) fail(`${article.articleKey} missing required definition [^${id}]`);
    if (!uniqueReferences.has(id)) fail(`${article.articleKey} missing claim reference [^${id}]`);
  }
  if (gate.policy?.requireExactDefinitionSet) for (const id of uniqueDefinitions) if (!required.has(id)) fail(`${article.articleKey} unexpected definition [^${id}]`);
  if (gate.policy?.requireEveryDefinitionReferenced) for (const id of uniqueDefinitions) if (!uniqueReferences.has(id)) fail(`${article.articleKey} unreferenced definition [^${id}]`);
  const targetMet = definitions.length >= article.targetClaimLevelFootnoteGroups;
  if (!gate.policy?.allowDraftBelowTarget && !targetMet) fail(`${article.articleKey} target not met: ${definitions.length} < ${article.targetClaimLevelFootnoteGroups}`);
  results.push({ articleKey: article.articleKey, definitions: definitions.length, references: references.length, target: article.targetClaimLevelFootnoteGroups, targetMet });
}
if ([...seen].sort().join(',') !== '6A,6B') fail('article keys must be exactly 6A and 6B');
if (!process.exitCode) {
  const detail = results.map((item) => `${item.articleKey} ${item.definitions}/${item.target} target-met (${item.references} references)`).join(', ');
  console.log(`Genesis 6 Enoch footnote gate: PASS (${detail}; release blocked pending separate publication transaction)`);
}
