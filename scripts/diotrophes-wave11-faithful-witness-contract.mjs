#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = 'data/diotrophes-wave11-faithful-witness-manifest.json';
const casesPath = 'data/diotrophes-wave11-faithful-witness-cases.json';
const responsesPath = 'data/diotrophes-wave11-faithful-witness-responses.json';
const sourcesPath = 'data/diotrophes-wave11-faithful-witness-sources.json';
const supplementPath = 'src/components/article-pilots/diotrophes/FaithfulWitnessSupplement.astro';
const wrapperPath = 'src/components/article-pilots/diotrophes/DiotrophesWave11Draft.astro';
const baseDraftPath = 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro';
const publicRoutePath = 'src/pages/articles/diotrefy-nashego-vremeni/index.astro';
const releasePath = 'data/diotrophes-wave12-release-manifest.json';
const reportPath = 'research/WAVE11_DIOTROPHES_FAITHFUL_WITNESS_2026-08-01.md';

const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
const caseData = JSON.parse(readFileSync(casesPath, 'utf8'));
const responseData = JSON.parse(readFileSync(responsesPath, 'utf8'));
const sourceDataRaw = readFileSync(sourcesPath, 'utf8');
const sourceData = JSON.parse(sourceDataRaw);
const supplement = readFileSync(supplementPath, 'utf8');
const wrapper = readFileSync(wrapperPath, 'utf8');
const report = readFileSync(reportPath, 'utf8');
const errors = [];
const requireValue = (condition, message) => { if (!condition) errors.push(message); };

requireValue(data.authorityId === 'PRODUCT-OSK-WAVE11-FAITHFUL-WITNESS-2026-08-01', 'authority id drift');
requireValue(data.researchAuthorityId === 'RESEARCH-OSK-AUTHORITY-2026-08-01-W10-FAITHFUL-WITNESS', 'wrong Research authority');
requireValue(data.researchMergeSha === 'f50b21ad6af5dd7aaa53c5be381929b353b26d58', 'wrong Research merge SHA');
requireValue(data.productBaseSha === '6645112103e00112a569e8738dda2e2791364662', 'wrong Product base SHA');
requireValue(data.status === 'EDITORIAL_DRAFT_PUBLICATION_HOLD', 'Wave 11 snapshot status must remain historical draft hold');
requireValue(data.publicRouteRegistered === false && data.indexingApproved === false, 'Wave 11 snapshot route/indexing fields must remain false');
requireValue(data.directQuotesApproved === false, 'new direct quotations must remain blocked');
requireValue(existsSync(baseDraftPath), 'Wave 10 base draft is missing');

let successorRelease = null;
if (existsSync(releasePath)) {
  successorRelease = JSON.parse(readFileSync(releasePath, 'utf8'));
  requireValue(successorRelease.authorityId === 'PRODUCT-OSK-WAVE12-PUBLICATION-2026-08-02', 'unapproved successor authority');
  requireValue(successorRelease.route === '/articles/diotrefy-nashego-vremeni/', 'successor route drift');
  requireValue(successorRelease.predecessorAuthorityIds?.includes(data.authorityId), 'Wave 12 does not declare Wave 11 predecessor');
  requireValue(successorRelease.safety?.directQuotesApproved === false, 'Wave 12 weakened quote boundary');
  requireValue(successorRelease.counts?.authoritySources === 181, 'Wave 12 source count drift');
  requireValue(successorRelease.counts?.readerLinks === 73, 'Wave 12 reader-link count drift');
  requireValue(existsSync(publicRoutePath), 'approved Wave 12 route missing');
} else {
  requireValue(!existsSync(publicRoutePath), 'public route exists without approved Wave 12 successor');
}

const counts = data.counts ?? {};
const expected = {
  existingAuthoritySources: 148,
  newAuthoritySources: 33,
  totalAuthoritySources: 181,
  existingReaderLinks: 40,
  newReaderLinks: 33,
  totalReaderLinks: 73,
  casePathways: 15,
  faithfulResponses: 20,
  publicRoutesAdded: 0,
};
for (const [key, value] of Object.entries(expected)) requireValue(counts[key] === value, `count drift: ${key}=${counts[key]} expected ${value}`);

const pathways = caseData.casePathways ?? [];
const responses = responseData.faithfulResponses ?? [];
const sources = sourceData.readerSources ?? [];
requireValue(pathways.length === 15, `expected 15 pathways, found ${pathways.length}`);
requireValue(responses.length === 20, `expected 20 responses, found ${responses.length}`);
requireValue(sources.length === 33, `expected 33 reader sources, found ${sources.length}`);

const caseIds = pathways.map((item) => item.id);
requireValue(new Set(caseIds).size === 15, 'case pathway ids must be unique');
const sourceIds = sources.map((item) => item.id);
requireValue(new Set(sourceIds).size === 33, 'source ids must be unique');
const urls = sources.map((item) => item.href);
requireValue(new Set(urls).size === 33, 'reader URLs must be unique');
for (const item of sources) {
  requireValue(/^https:\/\//.test(item.href), `non-HTTPS source: ${item.id}`);
  requireValue(['A1','A2','A3','B1'].includes(item.class), `invalid source class: ${item.id}`);
}
requireValue(sources.filter((item) => ['A1','A2','A3'].includes(item.class)).length >= 17, 'new A-class count below 17');

const waveBSourceOwners = {
  'FW10-BIC-01': {
    label: 'IHOPKC: обновление процесса 10 ноября 2023',
    href: 'https://www.ihopkc.org/press-releases/blog-post-title-three-y3peb-cy296',
    class: 'A3',
  },
  'FW10-BIC-02': {
    label: 'IHOPKC: официальный архив пресс-релизов, включая письмо 15 ноября 2023',
    href: 'https://www.ihopkc.org/press-releases',
    class: 'A3',
  },
  'FW10-MAH-02': {
    label: 'Brent Detwiler: рассказ о многолетней внутренней попытке реформы',
    href: 'https://abrentdetwiler.squarespace.com/my-story-resume/',
    class: 'B1',
  },
};
for (const [id, expectedSource] of Object.entries(waveBSourceOwners)) {
  const actual = sources.find((item) => item.id === id);
  requireValue(Boolean(actual), `Wave B source owner missing: ${id}`);
  requireValue(actual?.label === expectedSource.label, `Wave B source label drift: ${id}`);
  requireValue(actual?.href === expectedSource.href, `Wave B source URL drift: ${id}`);
  requireValue(actual?.class === expectedSource.class, `Wave B source class drift: ${id}`);
}

const staleRegistryUrls = [
  'https://ihopkc.org/press-releases/press-center/press-releases/ihopkc-elt-update-11-10-2023',
  'https://ihopkc.org/press-releases/press-center/press-releases/elt-update-letter-11-15-2023',
  'https://www.brentdetwiler.com/my-story-resume/',
  'https://brentdetwiler.com/my-story-resume/',
];
for (const staleUrl of staleRegistryUrls) {
  requireValue(!sourceDataRaw.includes(staleUrl), `stale registry URL retained: ${staleUrl}`);
}

const requiredPathFields = ['id','name','actors','loyaltyTension','steps','lesson','boundary','sourceIds'];
for (const item of pathways) {
  for (const field of requiredPathFields) requireValue(field in item, `missing pathway field ${field}: ${item.id}`);
  requireValue(item.steps.length >= 4, `pathway too short: ${item.id}`);
  requireValue(item.sourceIds.length >= 4, `source path too short: ${item.id}`);
  requireValue(item.boundary.length >= 45, `weak boundary: ${item.id}`);
}
requireValue(pathways.some((item) => item.id === 'darrin-patrick' && item.steps.includes('единогласное отстранение')), 'positive board comparator missing');
requireValue(pathways.some((item) => /сестр|студентк|пострадавш/i.test(item.actors)), 'sister/survivor role missing');
requireValue(pathways.some((item) => /пастор/i.test(item.actors)), 'pastor-peer role missing');
requireValue(pathways.some((item) => /старейшин|попечител/i.test(item.actors)), 'elder/trustee role missing');

for (const item of responses) {
  requireValue(item.caseIds.length >= 3, `response lacks case grounding: ${item.id}`);
  requireValue(item.scriptures.length >= 2, `response lacks biblical controls: ${item.id}`);
  requireValue(item.caseIds.every((id) => caseIds.includes(id)), `response references unknown case: ${item.id}`);
}
requireValue(responses.map((item) => item.id).join(',') === Array.from({length:20}, (_,i) => `FW-${String(i+1).padStart(2,'0')}`).join(','), 'response ids/order drift');

for (const [key, value] of Object.entries(data.safety ?? {})) requireValue(value === true, `safety control disabled: ${key}`);
for (const marker of [
  'data-wave11-faithful-witness="true"',
  'Пятнадцать реальных путей',
  'Двадцать верных ответов',
  'Практическая лестница различения',
  'Новые источники Wave 11',
  'Контрпример: когда совет действительно действует',
]) requireValue(supplement.includes(marker), `supplement marker missing: ${marker}`);
requireValue(!supplement.includes('<blockquote') && !supplement.includes('<q'), 'new direct quotations are forbidden');
requireValue(!supplement.includes('<main'), 'supplement must not create a second main landmark');
requireValue(wrapper.includes("import DiotrophesDraft from './DiotrophesDraft.astro'"), 'wrapper lost Wave 10 draft');
requireValue(wrapper.includes("import FaithfulWitnessSupplement from './FaithfulWitnessSupplement.astro'"), 'wrapper lost supplement');
requireValue(wrapper.includes('<DiotrophesDraft publicationMode={publicationMode} />'), 'base draft must render once with publication state');
requireValue((wrapper.match(/<FaithfulWitnessSupplement\s*\/>/g) ?? []).length === 1, 'supplement must render exactly once');

const russianWords = [caseData, responseData, sourceData].map(JSON.stringify).join(' ').match(/[А-Яа-яЁё]{2,}/g)?.length ?? 0;
requireValue(russianWords >= 1300, `reader data below depth floor: ${russianWords}`);
for (const marker of ['15 actor pathways', '20 faithful responses', '181-source authority', '0 public routes']) requireValue(report.includes(marker), `report marker missing: ${marker}`);
requireValue(!report.includes('production deployment complete'), 'Wave 11 report must not make a retroactive deployment claim');

if (errors.length) {
  console.error(`❌ Diotrophes Wave 11 faithful-witness contract failed (${errors.length})`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`✅ Diotrophes Wave 11 evidence snapshot passed: 15 pathways, 20 responses, 33 links, 181-source authority, ${russianWords} Russian data words, successor=${successorRelease?.authorityId ?? 'none'}`);
