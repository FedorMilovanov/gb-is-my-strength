#!/usr/bin/env node
/*
 * Gill Pagefind body audit.
 * Ensures Gill context/spravochnik index their real article body, not only a
 * short sr-only search hint.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const problems = [];
function ok(msg){ console.log(`✅ ${msg}`); }
function bad(msg){ problems.push(msg); console.log(`❌ ${msg}`); }
function read(rel){ return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function strip(html){ return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&[a-z0-9#]+;/gi,' ').replace(/\s+/g,' ').trim(); }
function words(text){ return (strip(text).match(/[A-Za-zА-Яа-яЁё0-9]{2,}/g)||[]).length; }
function ensureNoSrOnlyRoute(slug){
  const rel = `src/pages/articles/${slug}/index.astro`;
  const src = read(rel);
  if (!/sr-only[\s\S]{0,300}data-pagefind-body/.test(src)) ok(`${slug}: no short sr-only Pagefind body in route`);
  else bad(`${slug}: route still has short sr-only data-pagefind-body`);
}
function auditComponent(slug, componentRel, sectionRels, minWords, terms){
  ensureNoSrOnlyRoute(slug);
  const comp = read(componentRel);
  if (/<article class="article-body" data-pagefind-body>/.test(comp)) ok(`${slug}: article-body owns data-pagefind-body`);
  else bad(`${slug}: article-body missing data-pagefind-body`);
  const text = sectionRels.map(read).join('\n');
  const wc = words(text);
  if (wc >= minWords) ok(`${slug}: indexed body word count ${wc} >= ${minWords}`);
  else bad(`${slug}: indexed body word count ${wc} < ${minWords}`);
  for (const requirement of terms) {
    const options = Array.isArray(requirement) ? requirement : [requirement];
    const match = options.find((term) => text.includes(term));
    const label = options.join(' | ');
    if (match) ok(`${slug}: Pagefind body contains ${match}`);
    else bad(`${slug}: Pagefind body missing semantic marker (${label})`);
  }
}

console.log('GILL PAGEFIND BODY AUDIT');
const contextSections = [
  'GillContextSectionSummaryIntro.astro',
  'GillContextSectionFromPuritansToBaptists.astro',
  'GillContextSectionParticularVsGeneral.astro',
  'GillContextSectionGreatEjection.astro',
  'GillContextSectionClarendon.astro',
  'GillContextSectionAcademies.astro',
  'GillContextSectionSaltersHall.astro',
  'GillContextSectionCoffeeHouse.astro',
  'GillContextSectionSouthwark.astro',
  'GillContextSectionBooks.astro',
  'GillContextSectionConclusion.astro',
  'GillContextSectionSourcesAndSeriesTail.astro',
].map((f)=>`src/components/article-pilots/gill-context/${f}`);
auditComponent(
  'dzhon-gill-istoricheskiy-kontekst',
  'src/components/article-pilots/gill-context/GillContextArticleBody.astro',
  contextSections,
  1200,
  [
    ['Кларендонским кодексом','Кларендонского кодекса','Кларендонский кодекс'],
    'Солтерс-Холл','Диссентерские академии','Саутварк','Кеттеринг',
    ['Goat Yard','Goat’s Yard',"Goat's Yard",'Goat&rsquo;s Yard'],
    ['Corporation Act','Акт о корпорациях','Корпоративный акт'],
    'Акт о единообразии'
  ]
);
const sprBase = 'src/components/article-pilots/gill-spravochnik';
const sprSections = [
  `${sprBase}/GillSpravochnikSectionSummary.astro`,
  `${sprBase}/GillSpravochnikSectionPrdl.astro`,
  `${sprBase}/GillSpravochnikSectionTimeline.astro`,
  `${sprBase}/GillSpravochnikSectionWorks.astro`,
  `${sprBase}/GillSpravochnikSectionBodyStructure.astro`,
  `${sprBase}/GillSpravochnikSectionNetwork.astro`,
  `${sprBase}/GillSpravochnikSectionDisputes.astro`,
  `${sprBase}/GillSpravochnikSectionTerms.astro`,
  `${sprBase}/GillSpravochnikSectionLinks.astro`,
  `${sprBase}/GillSpravochnikSectionSources.astro`,
  `${sprBase}/GillSpravochnikSectionQuizTail.astro`,
];
auditComponent(
  'dzhon-gill-spravochnik',
  `${sprBase}/GillSpravochnikArticleBody.astro`,
  sprSections,
  900,
  ['Масштаб корпуса','Хронология жизни','Body of Divinity','Богословский словарь','Источники справочника']
);
const part1Base = 'src/components/article-pilots/gill-part1';
const part1Sections = [
  `${part1Base}/GillPart1SectionSeriesAndHero.astro`,
  `${part1Base}/GillPart1SectionCallingHeading.astro`,
  `${part1Base}/GillPart1SectionIntro.astro`,
  `${part1Base}/GillPart1SectionBirthProphecy.astro`,
  `${part1Base}/GillPart1SectionEducation.astro`,
  `${part1Base}/GillPart1SectionConversion.astro`,
  `${part1Base}/GillPart1SectionPastorHeading.astro`,
  `${part1Base}/GillPart1SectionPastor.astro`,
  `${part1Base}/GillPart1SectionIllnessFamily.astro`,
  `${part1Base}/GillPart1SectionEvangelism.astro`,
  `${part1Base}/GillPart1SectionGoatyardDecl.astro`,
  `${part1Base}/GillPart1SectionDaughterSermon.astro`,
  `${part1Base}/GillPart1SectionFamilyDeep.astro`,
  `${part1Base}/GillPart1SectionOrdination1720.astro`,
  `${part1Base}/GillPart1SectionPersonalCredo.astro`,
  `${part1Base}/GillPart1SectionContextSouthwark.astro`,
  `${part1Base}/GillPart1SectionLastWordsWife.astro`,
  `${part1Base}/GillPart1SectionSkeppDetail.astro`,
  `${part1Base}/GillPart1SectionSourcesPart1.astro`,
  `${part1Base}/GillPart1SectionQuizTail.astro`,
];
auditComponent(
  'dzhon-gill-chast-1-chelovek',
  `${part1Base}/GillPart1ArticleBody.astro`,
  part1Sections,
  3000,
  ['Кеттеринг','Бытие 3:9','Хорслидаун','Декларация Козьего Двора','Источники и литература к Части I']
);
const part2Base = 'src/components/article-pilots/gill-part2';
auditComponent(
  'dzhon-gill-chast-2-uchenyi',
  `${part2Base}/GillPart2ArticleBody.astro`,
  [`${part2Base}/GillPart2ArticleBody.astro`],
  4500,
  ['Учение о Троице','раввинист','девятитомный комментарий','Body of Doctrinal Divinity','Уитби']
);
const part3Base = 'src/components/article-pilots/gill-part3';
auditComponent(
  'dzhon-gill-chast-3-nasledie',
  `${part3Base}/GillPart3ArticleBody.astro`,
  [`${part3Base}/GillPart3ArticleBody.astro`],
  6000,
  ['Уэсли','гиперкальвинизм','Сперджен','Америка','Банхилл-Филдс']
);
const part4Base = 'src/components/article-pilots/gill-part4';
auditComponent(
  'dzhon-gill-chast-4-ekzeget',
  `${part4Base}/GillPart4ArticleBody.astro`,
  [`${part4Base}/GillPart4ArticleBody.astro`],
  3000,
  ['Уитби','глашатая','супралапсарианскую','Йоханана']
);
if (problems.length){ console.log(`\n❌ Gill Pagefind body audit failed: ${problems.length} issue(s)`); process.exit(1); }
console.log('\n✅ Gill Pagefind body audit passed');
