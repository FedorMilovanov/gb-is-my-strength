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
  for (const term of terms) {
    if (text.includes(term)) ok(`${slug}: Pagefind body contains ${term}`);
    else bad(`${slug}: Pagefind body missing ${term}`);
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
  ['Кларендонский кодекс','Солтерс-Холл','Диссентерские академии','Саутварк','Кеттеринг','Goat&rsquo;s Yard','Корпоративный акт','Акт о единообразии']
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
if (problems.length){ console.log(`\n❌ Gill Pagefind body audit failed: ${problems.length} issue(s)`); process.exit(1); }
console.log('\n✅ Gill Pagefind body audit passed');
