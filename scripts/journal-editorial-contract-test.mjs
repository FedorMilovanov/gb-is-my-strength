#!/usr/bin/env node
/**
 * Local guardrails for the NEWS/JOURNAL/G3 editorial surface.
 * This test validates Product-side publication boundaries; it is not a Research
 * handoff and must never be treated as permission to publish held history.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');
const sourceFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(relativePath));
    else files.push(relativePath);
  }
  return files;
};

const handoff = read('src/data/journal/g3PublicationHandoff.ts');
const dossier = read('src/components/journal/G3Dossier.astro');
const bibliography = read('src/data/journal/g3SourceBibliography.ts');
const historyArticle = read('src/components/journal/G3HistoryArticle.astro');
const historyFeature = read('src/components/journal/G3HistoryFeature.astro');
const historyMetadata = read('src/data/journal/g3HistoryDraftMetadata.ts');
const masthead = read('src/components/journal/JournalMasthead.astro');
const historyCss = read('src/components/journal/g3History.css');
const editorialCss = read('src/components/journal/journalEditorial.css');

function idsFromArray(source, propertyName, pattern) {
  const match = source.match(new RegExp(`${propertyName}:\\s*\\[([\\s\\S]*?)\\]`));
  assert.ok(match, `Expected ${propertyName} array`);
  return [...match[1].matchAll(pattern)].map((item) => item[1]);
}

const approvedClaims = idsFromArray(handoff, 'claimIds', /'([^']+)'/g);
const approvedSources = idsFromArray(handoff, 'sourceIds', /'([^']+)'/g);
const projectedClaimBlock = dossier.match(/const projectedClaims[^=]*=\s*\[([\s\S]*?)\];/)?.[1];
assert.ok(projectedClaimBlock, 'Expected the G3 dossier projected-claims array');
const projectedClaims = [...projectedClaimBlock.matchAll(/'([^']+)'/g)].map((item) => item[1]);
const bibliographySources = [...bibliography.matchAll(/^\s*id:\s*'(G3-S\d{3})',?$/gm)].map((item) => item[1]);

assert.equal(approvedClaims.length, 16, 'The crisis dossier must keep the sealed 16-claim publication scope');
assert.equal(new Set(approvedClaims).size, approvedClaims.length, 'Approved claim IDs must be unique');
assert.deepEqual(projectedClaims, approvedClaims, 'Rendered G3 claims must match the immutable handoff claim set');
assert.equal(approvedSources.length, 21, 'The crisis dossier must keep the sealed 21-source publication scope');
assert.equal(new Set(approvedSources).size, approvedSources.length, 'Approved source IDs must be unique');
assert.deepEqual(bibliographySources, approvedSources, 'Reader-facing bibliography must match the immutable source set and order');
assert.match(dossier, /projectedClaims\.forEach\(assertG3PublicationProjection\)/, 'Each projected claim must pass the publication guard');

for (const [profilePath, expectedSource] of [
  ['data/route-profiles/journal.json', 'src/pages/journal/index.astro'],
  ['data/route-profiles/journal-dossiers-g3.json', 'src/pages/journal/dossiers/g3/index.astro'],
]) {
  const profile = JSON.parse(read(profilePath));
  assert.equal(profile.currentStatus, 'production-dist', `${profilePath}: route must remain production-dist`);
  assert.equal(profile.source, expectedSource, `${profilePath}: route owner/source drifted`);
  assert.equal(profile.migrationMode, 'strict-native', `${profilePath}: migration contract drifted`);
}

assert.match(historyMetadata, /publicationStatus:\s*'PUBLICATION_HOLD'/, 'History draft must remain on PUBLICATION_HOLD');
assert.match(historyArticle, /if \(import\.meta\.env\.PROD\)[\s\S]*?PUBLICATION_HOLD/, 'History component must fail closed in production');
assert.match(historyFeature, /data-research-publication-status="HOLD"/, 'History feature must visibly retain its Research HOLD marker');
const pageFiles = sourceFiles('src/pages').filter((file) => file.endsWith('.astro'));
assert.ok(!pageFiles.some((file) => /(?:^|[/\\])journal[/\\]dossiers[/\\]g3[/\\]history(?:[/\\]|\.astro$)/i.test(file)), 'No public G3 history route may be registered');
assert.ok(!pageFiles.some((file) => /G3HistoryArticle/.test(read(file))), 'No public page may import the held history manuscript');

const identityLink = masthead.match(/<a class="je-masthead__identity"[^>]*>/)?.[0];
assert.ok(identityLink, 'Expected the visible Journal brand link');
assert.doesNotMatch(identityLink, /\baria-label=/, 'Use the visible brand text as the link name instead of overriding it');
assert.match(masthead, /<svg class="je-masthead__mark"[^>]*aria-hidden="true"[^>]*focusable="false"/, 'The decorative brand icon must not pollute the link name');
assert.match(masthead, /class="je-masthead__publication">Господь Бог — Сила Моя/);
assert.match(masthead, /class="je-masthead__series">ЖУРНАЛ[\s\S]*?ИССЛЕДОВАНИЯ/);
assert.match(dossier, /class="editorial-meta" role="group" aria-label="Сведения о материале"/, 'The labelled G3 metadata group must use a role that supports aria-label');
assert.match(historyArticle, /class="editorial-meta" role="group" aria-label="Сведения о рукописи"/, 'The held-history metadata group must also use a valid labelled role');

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
const storyTagRule = editorialCss.match(/\.journal-edition \.journal-story-tag\s*\{([^}]*)\}/)?.[1];
assert.ok(storyTagRule, 'Expected the Journal dossier tag CSS rule');
const storyTagStops = storyTagRule.match(/background:\s*linear-gradient\(120deg,\s*(#[\da-f]{6}),\s*(#[\da-f]{6})\)/i);
const storyTagText = storyTagRule.match(/color:\s*(#[\da-f]{6})/i)?.[1];
assert.ok(storyTagStops && storyTagText, 'Expected explicit dossier tag text and gradient colors');
for (const stop of storyTagStops.slice(1)) {
  assert.ok(contrastRatio(storyTagText, stop) >= 4.5, `Dossier tag contrast must be at least 4.5:1; ${storyTagText} on ${stop} is ${contrastRatio(storyTagText, stop).toFixed(2)}:1`);
}

const milestonesRule = historyCss.match(/\.journal-edition \.je-history-milestones\s*\{([^}]*)\}/)?.[1];
assert.ok(milestonesRule, 'Expected the G3 history milestones CSS rule');
assert.match(milestonesRule, /border-block-start:\s*2px solid var\(--je-gold\)/, 'Milestones must have the intended top rule');
assert.match(milestonesRule, /border-block-end:\s*1px solid var\(--je-rule\)/, 'Milestones must have the intended bottom rule');
assert.doesNotMatch(milestonesRule, /(?:^|;)\s*border-block\s*:/, 'Do not combine two border declarations in the invalid border-block shorthand');

const historyOutput = path.join(root, 'dist/journal/dossiers/g3/history');
assert.ok(!existsSync(historyOutput), 'The production-like dist must not publish a G3 history route');
for (const relativePath of ['dist/sitemap.xml', 'dist/feed.xml', 'dist/data/search-manifest.json']) {
  if (!existsSync(path.join(root, relativePath))) continue;
  assert.doesNotMatch(read(relativePath), /\/journal\/dossiers\/g3\/history\/|G3-HIST-PUB|G3HistoryArticle/i, `${relativePath} must not expose held G3 history`);
}

console.log('JOURNAL EDITORIAL CONTRACT: PASS');
console.log(`- Crisis dossier: ${approvedClaims.length} authorized claims / ${approvedSources.length} bibliography sources`);
console.log('- Route ownership: /journal/ and /journal/dossiers/g3/ remain Astro production-dist owners');
console.log('- G3 history: un-routed, production-guarded, PUBLICATION_HOLD retained; absent from sitemap, RSS, and search');
console.log('- Journal brand name, labelled metadata groups, dossier-tag contrast, and G3 milestones border: PASS');
