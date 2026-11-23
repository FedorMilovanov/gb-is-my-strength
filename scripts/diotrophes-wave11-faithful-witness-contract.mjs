#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const manifestPath = 'data/diotrophes-wave11-faithful-witness-manifest.json';
const casesPath = 'data/diotrophes-wave11-faithful-witness-cases.json';
const responsesPath = 'data/diotrophes-wave11-faithful-witness-responses.json';
const sourcesPath = 'data/diotrophes-wave11-faithful-witness-sources.json';
const supplementPath = 'src/components/article-pilots/diotrophes/FaithfulWitnessSupplement.astro';
const publishedPagePath = 'src/components/article-pilots/diotrophes/DiotrophesPublishedPage.astro';
const wrapperPath = 'src/components/article-pilots/diotrophes/DiotrophesWave11Draft.astro';
const baseDraftPath = 'src/components/article-pilots/diotrophes/DiotrophesDraft.astro';
const publicRoutePath = 'src/pages/articles/diotrefy-nashego-vremeni/index.astro';
const releasePath = 'data/diotrophes-wave12-release-manifest.json';
const reportPath = 'research/WAVE11_DIOTROPHES_FAITHFUL_WITNESS_2026-08-01.md';
const seriesCardsPath = 'src/components/pastor-series/PastorSeriesCardsSection.astro';
const seriesConfigPath = 'src/components/article-pilots/_shared/series/pastorSeriesConfig.ts';

const data = JSON.parse(readFileSync(manifestPath, 'utf8'));
const caseData = JSON.parse(readFileSync(casesPath, 'utf8'));
const responseData = JSON.parse(readFileSync(responsesPath, 'utf8'));
const sourceDataRaw = readFileSync(sourcesPath, 'utf8');
const sourceData = JSON.parse(sourceDataRaw);
const supplement = readFileSync(supplementPath, 'utf8');
const publishedPage = readFileSync(publishedPagePath, 'utf8');
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
const historicalJourneySources = sources.filter((item) => item.href === 'https://www.thejourney.org/about/our-story-new');
requireValue(
  historicalJourneySources.length === 1 && historicalJourneySources[0]?.id === 'FW10-DPA-01',
  'exactly one frozen Journey 404 source record must remain identifiable',
);
const nonDisabledReaderLinks = sources.length - historicalJourneySources.length;
requireValue(nonDisabledReaderLinks === 32, `expected 32 non-disabled reader URLs, found ${nonDisabledReaderLinks}`);

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
    label: 'Christianity Today: обвинения Detwiler и независимое рассмотрение SGM',
    href: 'https://www.christianitytoday.com/2012/01/sovereign-grace-ministries-reinstates-cj-mahaney-as/',
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
  'https://abrentdetwiler.squarespace.com/my-story-resume/',
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
  'Документы и свидетельства: дополнительная подборка',
  'id="positive-board-comparator"',
]) requireValue(supplement.includes(marker), `supplement marker missing: ${marker}`);
requireValue(supplement.includes("data-evidence-records={pathway.sourceIds.join(',')}"), 'internal source provenance should remain machine-readable');
requireValue(supplement.includes('readerSources.filter((source) => pathway.sourceIds.includes(source.id))'), 'reader source ids must resolve against curated public sources');
requireValue(supplement.includes('<a href={source.href}'), 'the reader must be able to open a cited public document');
requireValue(supplement.includes('<a href={`#faithful-${pathway.id}`}'), 'evidence examples must link to actual case headings');

// Reader-facing corrections must not rewrite the preserved Wave 11 evidence snapshot.
// One known historical case references documents already listed in the main dossier,
// while the other fourteen pathways have directly curated Wave 11 URLs.
const seriesConfig = readFileSync(seriesConfigPath, 'utf8');
const seriesCards = readFileSync(seriesCardsPath, 'utf8');
requireValue(
  !seriesCards.includes('181 источник') && seriesCards.includes('Источники и сверка'),
  'dossier catalog confuses full Research authority count with reader-openable links',
);

const missingNewLinkCases = pathways
  .filter((pathway) => !pathway.sourceIds.some((id) => sourceIds.includes(id)))
  .map((pathway) => pathway.id);
requireValue(
  missingNewLinkCases.length === 1 && missingNewLinkCases[0] === 'paige-patterson',
  'unaccounted-for case pathway without direct Wave 11 reader source',
);
requireValue(
  supplement.includes("pathway.id === 'paige-patterson'") &&
  supplement.includes('href="#sources"') &&
  supplement.includes('https://swbts.edu/news/statement-by-kevin-ueckert-chairman-of-the-board-of-trustees/'),
  'Patterson must link both the three original bibliography entries and the primary June 1 trustee clarification',
);
requireValue(
  !supplement.includes('Для этой истории отдельная прямая ссылка пока не представлена'),
  'misleading missing-source statement returned',
);
requireValue(
  supplement.includes('совет старейшин публично поддерживает служение Махейни и осуждает обвинения Брента Детуайлера'),
  'Mahaney chronology again blurs the object of the council statement',
);
requireValue(
  supplement.includes('проверка сведений из студенческого дела, доступ к которым был предоставлен с разрешения'),
  'Patterson chronology lost the record-permission clarification',
);
requireValue(
  supplement.includes('их номера не образуют') && !supplement.includes('Предыдущая часть показала'),
  'thematic numbering or same-page transition regressed',
);

// Safety is an immediate gate, not the second step after collecting evidence,
// and editorial cross-links are not claims that a case proves an anti-advice item.
// Public introduction must distinguish Scripture from a contemporary analogy
// and make the trilogy navigable without labeling every case by a stage.
requireValue(
  publishedPage.includes('В 3 Ин. 9 сказано, что Диотреф «не принимает нас»') &&
  publishedPage.includes('Послание не называет') &&
  publishedPage.includes('должность Диотрефа') &&
  publishedPage.includes('поддержку других членов общины') &&
  publishedPage.includes('не является буквальным переводом'),
  '3 John text vs institutional-review analogy must remain explicit',
);
requireValue(
  publishedPage.includes('/articles/20-antisovetov-pastoru/') &&
  publishedPage.includes('/articles/anatomiya-padeniya-pyat-stadiy/') &&
  publishedPage.includes('Нельзя автоматически приписывать'),
  'three-article editorial bridge and anti-overclassification guard missing',
);
requireValue(
  publishedPage.includes("20-antisovetov-pastoru/\">«20 антисоветов пастору»</a>{' '}") &&
  publishedPage.includes("разрушительные решения;{' '}") &&
  publishedPage.includes("anatomiya-padeniya-pyat-stadiy/\">«Анатомия падения»</a>{' '}"),
  'intro links must render explicit whitespace on mobile and desktop (no glued words)',
);
requireValue(
  /а не\s+репрезентативная выборка церквей/.test(publishedPage) &&
  publishedPage.includes('нельзя рассчитывать'),
  'documentary case selection must not imply prevalence or deterministic stage transitions',
);

const decisionSection = supplement.split('id="faithful-decision-ladder"')[1] ?? '';
const immediateRisk = decisionSection.indexOf('<strong>Есть ли непосредственный риск?</strong>');
const caseDetails = decisionSection.indexOf('<strong>Что именно произошло?</strong>');
requireValue(
  immediateRisk >= 0 && caseDetails > immediateRisk,
  'immediate safety must precede case evidence collection in the reader-facing decision list',
);
requireValue(
  decisionSection.includes('не обязательная последовательность') &&
  decisionSection.includes('не откладываются'),
  'immediate safety gate must not be conditional on a private meeting or completing an evidence file',
);
requireValue(
  decisionSection.includes('соблюдать установленные законом обязанности') &&
  !decisionSection.includes('Гражданская власть обязательна при преступлении') &&
  decisionSection.includes('Публичное раскрытие — отдельное решение'),
  'risk reporting, statutory duties and responsible public disclosure must remain separate',
);
requireValue(
  supplement.includes('критика процедуры не доказывает') &&
  supplement.includes('не утверждают, будто каждый документальный случай доказывает'),
  'original acts, institutional responses and thematic links must remain distinct',
);
requireValue(
  supplement.includes('id="faithful-positive-conclusion"') &&
  supplement.includes('3 Ин. 11') &&
  supplement.includes('о Димитрии'),
  'Dossier must end with an evidence-bounded Christian positive conclusion',
);
requireValue(
  supplement.includes('gallery.mailchimp.com/403ae4d269435dd5dbbd5c310/files/RemovalfromOfficeLetter.pdf') &&
  /не\s+подтверждает,\s+что эти встречи позднее состоялись\./.test(supplement) &&
  !supplement.includes('позднее проводили встречи, где') &&
  supplement.includes('совет способен остановить лидера'),
  'The Journey comparator must cite the original 2016 elder letter and distinguish plans from completed meetings',
);
// The frozen Wave 11 steps compress two different source dates. Keep the
// original 2016 letter separate from the institution's later 2017–18 history,
// and retain both primary document locators in the rendered reader.
requireValue(
  supplement.includes("'единогласное отстранение': 'единогласное решение старейшин всех площадок") &&
  supplement.includes("'встречи для слушания членов': 'встречи с группами общины в начале 2017 года") &&
  supplement.includes("'восстановление миссии': 'новая формулировка видения и миссии к 2018 году") &&
  supplement.includes("readerStep(pathway.id, step)") &&
  supplement.includes("pathway.id === 'darrin-patrick'") &&
  supplement.includes('www.wthrockmorton.com/wp-content/uploads/2016/04/RemovalfromOfficeLetter.pdf') &&
  supplement.includes('Письмо подтверждает решение об отстранении и анонс') &&
  supplement.includes('официальная история The Journey') &&
  supplement.includes('встречах с группами общины в начале 2017 года') &&
  supplement.includes("source.id === 'FW10-DPA-01'") &&
  supplement.includes('data-locator-status="unavailable-404-2026-11-23"') &&
  !supplement.includes('<a href="https://www.thejourney.org/about/our-story-new"') &&
  supplement.includes('исторической страницы The Journey адрес сейчас недоступен'),
  'Journey paths must preserve 2016 vs 2017–18 provenance without offering the confirmed-404 historical URL as a working link',
);
requireValue(
  seriesConfig.includes("href: '#faithful-witness-sources'") &&
  seriesConfig.includes('33 библиографические записи и границы их доказательной силы') &&
  !seriesConfig.includes('33 библиографические ссылки') &&
  seriesConfig.includes("href: '#faithful-positive-conclusion'"),
  'supplementary bibliography and Gaius/Demetrius conclusion must be reachable from the series TOC',
);

const relatedPairs = [...supplement.matchAll(/'FW-(\d{2})':\s*\[([\d,\s]+)\]/g)];
const relatedIds = new Set(relatedPairs.map((pair) => `FW-${pair[1]}`));
requireValue(
  relatedPairs.length === 20 && responses.every((item) => relatedIds.has(item.id)),
  'thematic links must cover each of the 20 independent faithful responses',
);
for (const pair of relatedPairs) {
  const points = pair[2].split(',').map((point) => Number(point.trim()));
  requireValue(
    points.length > 0 && points.every((point) => Number.isInteger(point) && point >= 1 && point <= 20),
    `thematic anti-advice anchor out of range: FW-${pair[1]}`,
  );
}
requireValue(
  supplement.includes('/articles/20-antisovetov-pastoru/#point-${point}'),
  'thematic cross-links must target the 20 existing first-article anchors',
);
requireValue(!supplement.includes('Research records:'), 'raw Research ids leaked into public supplementary prose');
requireValue(!supplement.includes('<blockquote') && !supplement.includes('<q'), 'new direct quotations are forbidden');
requireValue(
  supplement.includes('data-total-bibliography-records={content.counts.totalReaderLinks}') &&
  supplement.includes('data-bibliography-records={content.counts.newReaderLinks}') &&
  supplement.includes("data-reader-source-links={readerSources.filter((source) => source.id !== 'FW10-DPA-01').length}") &&
  supplement.includes('33 библиографические записи') &&
  !supplement.includes('data-new-reader-links=') &&
  !supplement.includes('data-reader-links={content.counts.totalReaderLinks}'),
  'public supplement must distinguish 33 source records from 32 linkable URLs',
);
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

console.log(`✅ Diotrophes Wave 11 evidence snapshot passed: 15 pathways, 20 responses, 33 bibliography records, ${nonDisabledReaderLinks} non-disabled source links, 181-source authority, ${russianWords} Russian data words, successor=${successorRelease?.authorityId ?? 'none'}`);
