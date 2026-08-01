#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = 'data/diotrophes-wave10-product-draft.json';
const draftPath = 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro';
const publicRoutePath = 'src/pages/articles/diotrefy-nashego-vremeni/index.astro';

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const draft = readFileSync(draftPath, 'utf8');
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };
const extractArrayBlock = (name) => {
  const declaration = new RegExp(String.raw`\bconst\s+${name}(?:\s*:\s*[^=]+)?\s*=\s*\[([\s\S]*?)\n\];`);
  return draft.match(declaration)?.[1] ?? '';
};

requireValue(manifest.authorityId === 'PRODUCT-OSK-WAVE10-DRAFT-2026-08-01', 'unexpected authorityId');
requireValue(manifest.researchAuthorityId === 'RESEARCH-OSK-AUTHORITY-2026-08-01-W9', 'wrong Research authority');
requireValue(manifest.researchMergeSha === '0f2a706dff1682117fad54c45c8d7b25c98b62eb', 'wrong Research merge SHA');
requireValue(manifest.productBaseSha === '41617252e18939599e1e3f45e62d8d10d0fd1b27', 'wrong Product base SHA');
requireValue(manifest.status === 'EDITORIAL_DRAFT_PUBLICATION_HOLD', 'draft must remain on publication hold');
requireValue(manifest.routeCandidate === '/articles/diotrefy-nashego-vremeni/', 'unexpected route candidate');
requireValue(manifest.publicRouteRegistered === false, 'public route must not be registered in Wave 10');
requireValue(manifest.productPageCreated === false, 'public page must not be created in Wave 10');
requireValue(manifest.indexingApproved === false, 'indexing must remain blocked');
requireValue(manifest.newDirectQuotesApproved === false, 'new direct quotations must remain blocked');
requireValue(!existsSync(publicRoutePath), 'Wave 10 must not create a public route');

const expectedCases = [
  'sbc-systemic', 'bill-hybels', 'brian-houston', 'rzim', 'mark-driscoll',
  'james-macdonald', 'cj-mahaney', 'doug-wilson', 'bill-gothard', 'steve-timmis',
  'jonathan-fletcher', 'paige-patterson', 'jerry-falwell-jr', 'mike-pilavachi',
  'mike-bickle', 'robert-morris', 'nikolay-kuznetsov', 'evgeny-shin',
  'stanislav-moskvitin', 'darrin-patrick', 'bethel-bolz-armstrong'
];
const expectedCaseSet = new Set(expectedCases);
const manifestCaseSet = new Set(manifest.caseIds);
requireValue(manifest.caseIds.length === 21 && manifestCaseSet.size === 21, 'manifest must contain 21 unique core cases');
requireValue(expectedCases.every((id) => manifestCaseSet.has(id)), 'manifest core case set drifted');

const caseBlock = extractArrayBlock('caseCards');
const draftCaseIds = [...caseBlock.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
const draftCaseSet = new Set(draftCaseIds);
requireValue(draftCaseIds.length === 21 && draftCaseSet.size === 21, `draft must contain 21 unique case cards; found ${draftCaseIds.length}/${draftCaseSet.size}`);
requireValue(expectedCases.every((id) => draftCaseSet.has(id)), 'draft core case set drifted');
requireValue([...draftCaseSet].every((id) => expectedCaseSet.has(id)), 'draft contains a non-core case');

for (const field of ['mechanism', 'evidence', 'boundary', 'sources']) {
  const count = (caseBlock.match(new RegExp(`\\b${field}:`, 'g')) ?? []).length;
  requireValue(count === 21, `case field ${field}: expected 21, found ${count}`);
}

for (const blockedId of manifest.excludedCaseIds) {
  requireValue(!draft.includes(blockedId), `excluded case leaked into draft: ${blockedId}`);
}
for (const blockedName of ['David Platt', 'Steven Lawson', 'Tullian Tchividjian', 'Sam Allberry', 'Andy Savage', 'Carl Lentz', 'Eddie Long', 'Perry Noble', 'Sunday Adelaja']) {
  requireValue(!draft.includes(blockedName), `excluded person leaked into draft: ${blockedName}`);
}

requireValue(manifest.caseEvidenceSourceIds.length === 42, 'expected 42 curated case-evidence records');
requireValue(new Set(manifest.caseEvidenceSourceIds).size === 42, 'case-evidence source IDs must be unique');
requireValue(manifest.controlSourceIds.length === 12, 'expected 12 control records');
requireValue(new Set(manifest.controlSourceIds).size === 12, 'control source IDs must be unique');
requireValue(manifest.counts.curatedDraftSources === 54, 'curated source count must be 54');
requireValue(manifest.counts.researchAuthoritySources === 148, 'Research authority count must be 148');
requireValue(manifest.counts.approvedDirectQuotes === 0, 'direct quote count must remain zero');
requireValue(manifest.counts.publicRoutesAdded === 0, 'Wave 10 public route count must remain zero');

const sourceBlock = extractArrayBlock('sourceLinks');
const readerUrls = [...sourceBlock.matchAll(/'((?:https:\/\/)[^']+)'/g)].map((match) => match[1]);
const uniqueReaderUrls = new Set(readerUrls);
requireValue(readerUrls.length === 40, `expected exactly 40 reader URLs, found ${readerUrls.length}`);
requireValue(uniqueReaderUrls.size === 40, `reader URLs must be unique; found ${uniqueReaderUrls.size}`);

const allowedHosts = [
  'guidepostsolutions.com', 'sbc.net', 'willowcreek.org', 'childabuseroyalcommission.gov.au',
  'crechurches.org', 'thirtyoneeight.org', 'swbts.edu', 'liberty.edu', 'churchofengland.org',
  'tikkunglobal.org', 'governor.mo.gov', 'oklahoma.gov', 'capitol.texas.gov', 'sudrf.ru',
  'thejourney.org', 'bethel.com', 'github.com', 'furman.edu', 'uchicago.edu', 'eerdmans.com',
  'the1689confession.com', 'netbible.org', 'springer.com', 'gov.uk', 'iicsa.org.uk'
];
for (const rawUrl of readerUrls) {
  const host = new URL(rawUrl).hostname.replace(/^www\./, '');
  requireValue(allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)), `reader source host is not approved: ${host}`);
}

for (const sectionId of manifest.sections) {
  requireValue(draft.includes(`id=\"${sectionId}\"`), `missing required section: ${sectionId}`);
}
for (const requiredClass of ['article-header', 'summary-card', 'reading-list-section', 'quiz-wrapper', 'author-card']) {
  requireValue(draft.includes(requiredClass), `missing content-standard surface: ${requiredClass}`);
}
requireValue(draft.includes('Автор-редактор: Фёдор Милованов'), 'approved byline is missing');
requireValue(!draft.includes('Автор: Фёдор Милованов'), 'forbidden author byline leaked');
requireValue(draft.includes('data-source-authority=\"148\"'), '148-source authority marker missing');
requireValue(draft.includes('data-curated-sources=\"54\"'), '54-source draft marker missing');
requireValue(draft.includes('data-reader-links=\"40\"'), '40-link reader marker missing');
requireValue(!draft.includes('<blockquote'), 'new direct block quotations are forbidden');
requireValue(!draft.includes('<q'), 'new inline direct quotations are forbidden');
requireValue(!/[—:-]\s*Диотреф(?:ом|а|ы)?\b/u.test(draft), 'a person or case must not be headlined as Diotrephes');

const quizBlock = extractArrayBlock('quiz');
const quizQuestions = (quizBlock.match(/^\s*\['/gm) ?? []).length;
requireValue(quizQuestions === 10, `expected 10 quiz questions, found ${quizQuestions}`);

const russianWords = draft.match(/[А-Яа-яЁё]{2,}/g)?.length ?? 0;
requireValue(russianWords >= 2500, `draft is below premium depth floor: ${russianWords} Russian words`);

const forbiddenRegistryPaths = [
  'migration/page-ownership.json',
  'migration/route-migration-matrix.json',
  'data/route-search-policy.json',
  'data/search-manifest.json',
  'feed.xml',
  'sitemap.xml',
  'src/components/article-pilots/_shared/series/pastorSeriesConfig.ts'
];
for (const path of forbiddenRegistryPaths) {
  requireValue(!manifest.allowedFiles?.includes?.(path), `manifest must not authorize publication surface: ${path}`);
}

if (errors.length) {
  console.error(`❌ Diotrophes Wave 10 contract failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ Diotrophes Wave 10 draft passed: 21 cases, 54 curated records, ${uniqueReaderUrls.size} reader links, ${russianWords} Russian words, 0 public routes`);
