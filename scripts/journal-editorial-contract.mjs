#!/usr/bin/env node
/**
 * Scoped, read-only Journal regression witness. Not a publication approval.
 * Node >= repository minimum; run after the canonical production-like build.
 * Optional --source-only omits dist checks. Reports are ignored build artifacts.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const baseline = '560ad663c6985e94eefbc67609e654660e142eb7';
const args = new Set(process.argv.slice(2));
for (const arg of args) assert.ok(['--source-only', '--probe-publication', '--require-dist'].includes(arg) || /^--output=.+/.test(arg), `Unknown option: ${arg}`);
assert.ok(!(args.has('--source-only') && args.has('--require-dist')), 'Source-only cannot prove dist acceptance');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const previous = (name) => execFileSync('git', ['show', `${baseline}:${name}`], { cwd: root, encoding: 'utf8' });
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
const hasClass = (node, name) => (attr(node, 'class') || '').split(/\s+/).includes(name);
function all(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap((child) => all(child, predicate))];
}
const byId = (doc, id) => all(doc, (node) => attr(node, 'id') === id)[0];
const text = (node) => node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join('');
const normalize = (value) => value.replace(/\s+/gu, '');

// Journal narration imports shared runtime directly. The workflow's deliberately
// explicit quoted path lists must cover those inputs on both PR and main push.
function assertNarrationWorkflowPaths(workflow, runtimeSource) {
  const imports = [...runtimeSource.matchAll(/^import ['"]\.\.\/\.\.\/(runtime\/[^'"]+)['"];?$/gm)]
    .map(match => 'src/' + match[1]);
  assert.ok(imports.length > 0, 'Journal narration runtime import inventory missing');
  const required = [...imports, 'src/components/reader-platform/ReaderSpeedContract.ts', 'scripts/lib/browser-runtime-noise.js'];
  for (const event of ['pull_request', 'push']) {
    // This is a source-format contract for the checked-in literal list, not a YAML parser.
    const body = workflow.split('\n  ' + event + ':\n')[1]?.split(/\n  [a-z_]+:/)[0];
    assert.ok(body, event + ' workflow trigger missing');
    const list = body.match(/\n    paths:\n((?:      - '[^'\n]+'\n)+)/)?.[1];
    assert.ok(list, event + ' explicit paths list missing');
    const entries = new Set([...list.matchAll(/^      - '([^']+)'$/gm)].map(match => match[1]));
    for (const file of required) assert.ok(entries.has(file), event + ' missing Journal narration dependency: ' + file);
  }
}
{
  const workflow = read('.github/workflows/journal-g3-history-publication-qa.yml');
  const runtimeSource = read('src/components/journal/journalNarrationRuntime.ts');
  assertNarrationWorkflowPaths(workflow, runtimeSource);
  // Real mutation controls: removing one path from either event must fail.
  const line = "      - 'src/runtime/reader-tts-media-session.js'\n";
  const first = workflow.indexOf(line), last = workflow.lastIndexOf(line);
  assert.ok(first >= 0 && last > first);
  for (const offset of [first, last]) {
    const broken = workflow.slice(0, offset) + workflow.slice(offset + line.length);
    assert.throws(() => assertNarrationWorkflowPaths(broken, runtimeSource), /missing Journal narration dependency/);
  }
}

/** Assert the actual ordered chronology, not a regex-filtered subset of
 * descendant IDs: an extra/missing/misnested row must fail as well. */
function assertLaterConferenceChronology(doc) {
  const section = byId(doc, 'g3-later-conferences');
  assert.ok(section, 'later conference section is present');
  const lists = all(section, node => node.tagName === 'ol' && hasClass(node, 'je-history-years'));
  assert.equal(lists.length, 1, 'one native chronological list');
  assert.equal(lists[0].parentNode, section, 'chronology is a direct section child');
  const rows = (lists[0].childNodes || []).filter(node => node.tagName);
  const years = ['2019', '2020', '2021', '2022', '2023', '2024'];
  assert.deepEqual(rows.map(row => [row.tagName, attr(row, 'id')]),
    years.map(year => ['li', 'g3-year-' + year]), 'historical conference chronology includes 2021 in exact order');
  rows.forEach((row, index) => {
    const marks = all(row, node => hasClass(node, 'je-history-year-mark'));
    assert.equal(marks.length, 1, 'one visible year marker per chronological row');
    const dates = all(marks[0], node => node.tagName === 'time');
    assert.equal(dates.length, 1, 'one semantic date per year marker');
    assert.equal(attr(dates[0], 'datetime'), years[index]);
    assert.equal(text(dates[0]).trim(), years[index]);
  });
  return rows[2];
}
// Native parse5 positive/negative controls run even with --source-only.
{
  const year = value => '<li id="g3-year-' + value + '"><div class="je-history-year-mark"><time datetime="' + value + '">' + value + '</time></div></li>';
  const valid = ['2019', '2020', '2021', '2022', '2023', '2024'].map(year);
  const fixture = rows => parse('<section id="g3-later-conferences"><ol class="je-history-years">' + rows.join('') + '</ol></section>');
  assert.equal(attr(assertLaterConferenceChronology(fixture(valid)), 'id'), 'g3-year-2021');
  assert.throws(() => assertLaterConferenceChronology(fixture(valid.filter((_, i) => i !== 2))), /chronology includes 2021/);
  assert.throws(() => assertLaterConferenceChronology(fixture([valid[0], valid[2], valid[1], ...valid.slice(3)])), /chronology includes 2021/);
  assert.throws(() => assertLaterConferenceChronology(fixture([...valid, year('2025')])), /chronology includes 2021/);
  assert.throws(() => assertLaterConferenceChronology(fixture(valid.map((row, i) => i === 2 ? row.replace('datetime="2021"', 'datetime="2020"') : row))));
  assert.throws(() => assertLaterConferenceChronology(fixture(valid.map((row, i) => i === 2 ? row.replace('>2021</time>', '>2020</time>') : row))));
}

/** Immutable G44 editorial witness, accepted ART/E36 on #2381. */
const G44_ROWS = [
  [
    "cite-r6-challies-2018-video",
    "#history-source-challies-2018-video",
    "Тим Чаллис. From Every Tribe and Language and People and Nation",
    "2018-01-23",
    "publication",
    "#g3-year-2018",
    "Тим Чаллис: опыт общины",
    "23 января 2018 · публикация сообщения"
  ],
  [
    "cite-r6-firstlove-2018",
    "#history-source-firstlove-2018",
    "FirstLove Missions. G3 Conference in Atlanta, Georgia",
    "2018-01-30",
    "publication",
    "#g3-year-2018",
    "FirstLove: отчёт о выставке",
    "30 января 2018 · публикация отчёта"
  ],
  [
    "cite-r6-challies-2018-lessons",
    "#history-source-challies-2018-lessons",
    "Тим Чаллис. Seven Key Lessons in Diversity from Grace Fellowship Church",
    "2018-02-02",
    "publication",
    "#g3-year-2018",
    "Тим Чаллис: гостеприимство",
    "2 февраля 2018 · публикация статьи"
  ],
  [
    "cite-g3-year-2018-ascol-2018",
    "#history-source-ascol-2018",
    "Датированное свидетельство Тома Аскола",
    "2018-06-19",
    "attributed_event",
    "#g3-year-2018",
    "Встреча в Далласе",
    "19 июня 2018 · дата встречи по рассказу Аскола"
  ],
  [
    "cite-g3-year-2018-statement-2018",
    "#history-source-statement-2018",
    "Текст и история подготовки заявления",
    "2018-09-04",
    "publication",
    "#g3-year-2018",
    "Заявление о социальной справедливости и Евангелии",
    "4 сентября 2018 · публикация заявления"
  ],
  [
    "cite-g3-year-2018-responses-2018",
    "#history-source-responses-2018",
    "Отклики современников",
    "2018-09",
    "publication_month",
    "#g3-year-2018",
    "Отклики на заявление",
    "Сентябрь 2018 · месяц освещения"
  ],
  [
    "cite-g3-year-2018-challies",
    "#history-source-challies",
    "Позиция Чаллиса",
    "2025-05-23",
    "publication",
    "#g3-history",
    "Тим Чаллис: взгляд спустя годы",
    "23 мая 2025 · публикация воспоминаний"
  ]
];
const g44VisibleText=value=>value.replace(/\s+/gu,' ').trim();
// Negative controls preserve meaningful word boundaries; wrapping is benign.
const g44TextControls=[...G44_ROWS.flatMap(r=>[r[2],r[6],r[7]]),'Две линии одного года','Жизнь общины','Ретроспектива · 2025'];
for(const label of g44TextControls){
  assert.ok(label.includes(' '));
  assert.notEqual(g44VisibleText(label.replace(' ','')),g44VisibleText(label),'G44 missing word separator must fail');
  assert.equal(g44VisibleText(' \n '+label.replaceAll(' ',' \n ')+' \t '),g44VisibleText(label),'G44 benign wrapping must pass');
}
function assertG44Dist(doc) {
  const one=(parent,predicate,label)=>{const matches=all(parent,predicate);assert.equal(matches.length,1,label);return matches[0];};
  const id=(parent,key)=>one(parent,n=>attr(n,'id')===key,'unique ID '+key);
  const section=id(doc,'g3-year-2018');
  const prose=one(section,n=>hasClass(n,'je-history-text'),'history prose owner');
  const paragraphs=(prose.childNodes||[]).filter(n=>n.tagName==='p'&&!hasClass(n,'je-history-footnote'));
  const pinnedSource=execFileSync('git',['show','3ce78622de90705a11c37648cdef98021ff64b83:src/components/journal/G3HistoryFeature.astro'],{cwd:root,encoding:'utf8'});
  const pinnedStart=pinnedSource.indexOf('<section id="g3-year-2018"');
  assert.ok(pinnedStart>=0);
  const pinned=parse(pinnedSource.slice(pinnedStart,pinnedSource.indexOf('</section>',pinnedStart)+10));
  const pinnedOwner=one(pinned,n=>hasClass(n,'je-history-text'),'pinned prose owner');
  const baselineParagraphs=pinnedOwner.childNodes.filter(n=>n.tagName==='p'&&!hasClass(n,'je-history-footnote')).map(n=>g44VisibleText(text(n)));
  assert.equal(baselineParagraphs.length,3);
  assert.deepEqual(paragraphs.map(n=>g44VisibleText(text(n))),[baselineParagraphs[2],baselineParagraphs[0],baselineParagraphs[1]],'same three immutable paragraphs in chronological editorial order');
  assert.equal(one(section,n=>attr(n,'data-history-expansion-claim')==='G3-HIST-PUB-13','PUB13 exactly once'),paragraphs[0]);
  const index=id(section,'g3-2018-document-index');
  assert.equal(index.parentNode,prose);
  assert.equal(attr(section,'data-editorial-measure'),'feature','G44 explicit wide admission');
  const origin=id(doc,'g3-history');
  assert.equal(attr(origin,'data-editorial-measure'),'feature','atlas explicit wide admission');
  const grid=one(doc,n=>attr(n,'data-editorial-layout')==='wide','one existing wide editorial grid');
  assert.deepEqual(all(grid,n=>attr(n,'data-editorial-measure')==='feature').map(n=>attr(n,'id')),['g3-history','g3-year-2018'],'only the first two approved feature chapters');
  assert.equal(all(grid,n=>attr(n,'data-editorial-measure')==='wide').length,0,'no premature additional wide modules');
  assert.equal(paragraphs[2],(prose.childNodes||[]).filter(n=>n.tagName).at(-2),'index follows reordered complete narrative');
  assert.equal(g44VisibleText(text(one(index,n=>n.tagName==='h3','index heading'))),g44VisibleText('Две линии одного года'));
  const groups=all(index,n=>hasClass(n,'jcdi-group'));
  assert.equal(groups.length,3);
  assert.deepEqual(groups.map(n=>g44VisibleText(text(one(n,x=>x.tagName==='h4','group heading')))),['Жизнь общины','Заявление','Ретроспектива · 2025'].map(g44VisibleText));
  assert.ok(hasClass(groups[2],'jcdi-retrospective'));
  const lists=groups.map(n=>one(n,x=>x.tagName==='ol'&&hasClass(x,'jcdi-records'),'native ordered group'));
  assert.deepEqual(lists.map(n=>n.childNodes.filter(x=>x.tagName==='li').length),[3,3,1]);
  const links=all(section,n=>n.tagName==='a'&&attr(n,'data-journal-citation')!==undefined);
  assert.deepEqual(links.map(n=>attr(n,'id')),G44_ROWS.map(r=>r[0]),'ordered source vector');
  for(const [i,[citation,href,label,date,kind,backHref,heading,dateLabel]] of G44_ROWS.entries()){
    const link=id(doc,citation);assert.equal(link,links[i]);assert.equal(attr(link,'href'),href);
    assert.equal(g44VisibleText(text(link)),g44VisibleText(label));
    const row=link.parentNode;assert.equal(row.tagName,'li');assert.equal(row.parentNode,lists[i<3?0:i<6?1:2]);
    assert.equal(attr(row,'data-g44-date-kind'),kind);
    assert.equal(attr(one(row,n=>n.tagName==='time','one date '+citation),'datetime'),date);
    assert.equal(g44VisibleText(text(one(row,n=>hasClass(n,'jcdi-date'),'date role'))),g44VisibleText(dateLabel));
    assert.equal(g44VisibleText(text(one(row,n=>hasClass(n,'jcdi-label'),'row heading'))),g44VisibleText(heading));
    const source=id(doc,href.slice(1));
    const back=one(source,n=>n.tagName==='a'&&attr(n,'data-journal-source-return')!==undefined,'one return '+citation);
    assert.equal(attr(back,'href'),backHref);id(doc,backHref.slice(1));
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex');
const load = (name) => import(pathToFileURL(path.join(root, name)).href);

const { journalBreadcrumbItems, assertJournalDocumentMetadata } = await load('src/components/journal/journalDocumentMetadata.ts');
const metadataDateWitness = Object.freeze({
  kind: 'Article',
  publishedAt: '2024-02-29T23:59:59+03:00',
  modifiedAt: '2026-11-25T00:00:00Z',
  socialImage: 'https://gospod-bog.ru/images/journal/g3-ministries-og-1200x630.webp',
  socialImageAlt: 'Обложка G3 Ministries.',
});
for (const date of ['2024-02-29T23:59:59+03:00', '2000-02-29T00:00:00Z', '0000-02-29T00:00:00Z', '0096-02-29T00:00:00Z']) {
  assert.doesNotThrow(() => assertJournalDocumentMetadata({ ...metadataDateWitness, publishedAt: date }), 'valid calendar timestamp: '+date);
}
for (const date of ['2026-11-24T24:00:00Z', '2026-11-24T23:60:00Z', '2026-11-24T23:59:60Z', '1900-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-11-24T00:00:00+24:00', Symbol('date'), null]) {
  assert.throws(() => assertJournalDocumentMetadata({ ...metadataDateWitness, publishedAt: date }), /JournalDocumentHead: publishedAt must be an explicit valid ISO timestamp with timezone/);
}
assert.throws(() => assertJournalDocumentMetadata({ ...metadataDateWitness, modifiedAt: '2026-11-24T24:00:00Z' }), /JournalDocumentHead: modifiedAt/);
// Independent expected vectors: do not derive expectations from the production helper.
const breadcrumbVectors = new Map([
  ['https://gospod-bog.ru/journal/', [
    ['Главная', 'https://gospod-bog.ru/'], ['Журнал', 'https://gospod-bog.ru/journal/'],
  ]],
  ['https://gospod-bog.ru/journal/dossiers/g3/', [
    ['Главная', 'https://gospod-bog.ru/'], ['Журнал', 'https://gospod-bog.ru/journal/'],
    ['Досье G3', 'https://gospod-bog.ru/journal/dossiers/g3/'],
  ]],
  ['https://gospod-bog.ru/journal/dossiers/g3/history/', [
    ['Главная', 'https://gospod-bog.ru/'], ['Журнал', 'https://gospod-bog.ru/journal/'],
    ['Досье G3', 'https://gospod-bog.ru/journal/dossiers/g3/'],
    ['История G3 (2011–2024)', 'https://gospod-bog.ru/journal/dossiers/g3/history/'],
  ]],
]);
const expectedBreadcrumbItems = canonical => breadcrumbVectors.get(canonical).map(([name, item], index) => ({ '@type': 'ListItem', position: index + 1, name, item }));
for (const canonical of breadcrumbVectors.keys()) {
  assert.deepEqual(journalBreadcrumbItems(canonical), expectedBreadcrumbItems(canonical), 'breadcrumb source drift: ' + canonical);
}
for (const canonical of [
  'https://gospod-bog.ru/journal/fake/',
  'https://gospod-bog.ru/journal/dossiers/g3/other/',
  'https://example.com/journal/',
  'http://gospod-bog.ru/journal/',
  'https://gospod-bog.ru/journal/?preview=1',
  'https://gospod-bog.ru/journal/dossiers/g3/history/#intro',
]) assert.throws(() => journalBreadcrumbItems(canonical), /unregistered breadcrumb canonical/);

const { G3_PRODUCT_METADATA: metadata } = await load('src/data/journal/g3ProductMetadata.ts');
const { JOURNAL_PRODUCT_METADATA: journal } = await load('src/data/journal/journalProductMetadata.ts');
const { G3_HISTORY_METADATA: history } = await load('src/data/journal/g3HistoryMetadata.ts');
const { G3_HISTORY_SOURCES: historySources } = await load('src/data/journal/g3HistorySources.ts');
const { G3_SOURCE_BIBLIOGRAPHY: sources } = await load('src/data/journal/g3SourceBibliography.ts');
const { G3_EXPANSION_HANDOFF: expansion } = await load('src/data/journal/g3ExpansionHandoff.ts');
const annual = JSON.parse(read('src/components/journal/g3-visual/adopted-visual-data.json')).finance;
// Independent exact fixture from merged Research #632; the frozen crisis handoff is untouched.
const annualRows = [[2019,100,0,100,100],[2020,204510,29901,174609,174709],[2021,1471335,1054265,417070,591779],[2022,1735978,1010186,725792,1318931],[2023,1705689,2071986,-366297,1043850],[2024,1212253,1401429,-189176,854674],[2025,399645,950642,-550997,304459]];
assert.equal(annual.claimId, 'G3-PUB-017');
assert.equal(annual.currency, 'USD');
assert.equal(annual.fiscalYearEnd, 'December');
assert.deepEqual(annual.rows.map(r => [r.fy,r.revenue,r.expenses,r.result,r.netAssets]), annualRows);
assert.ok(annualRows.every(r => r[1]-r[2]===r[3]));
assert.ok(expansion.activeComponentClaimIds.includes('G3-PUB-017'));
const r6=JSON.parse(read('src/data/journal/g3R6Adopted.json'));
assert.equal(r6.researchMerge,'efecb12fea0fcc481cf4930154dcae53d4e033f6');
assert.deepEqual(r6.projections.map(p=>p.id),['G3-HIST-PUB-13','G3-HIST-PUB-14','G3-HIST-PUB-15','G3-HIST-PUB-16','G3-PUB-018']);
const r6Crisis=r6.projections[4];
const current = read('src/components/journal/G3Dossier.astro');
const old = previous('src/components/journal/G3Dossier.astro');
assert.match(current,/<G3ExpenseWaterfall total=\{financeDeltas\[0\].value\} conferences=\{financeDeltas\[1\].value\} advertising=\{financeDeltas\[2\].value\} \/>/);
assert.match(current,/<G3EcosystemSpread \/>/);
assert.doesNotMatch(current,/<JournalDataFigure\b/);
const { financeModel } = await load('src/components/journal/g3-graphics/finance-model.mjs');
assert.deepEqual(financeModel({total:1061800,conferences:817283,advertising:246511}).rows.map(r=>r.value),[817283,246511,-1994,1061800]);
assert.match(current, /<G3AnnualFinance projection=\{adoptedAnnualFinance\(\)\} \/>/);
const annualSource=read('src/components/journal/g3-visual/G3AnnualFinance.astro');
assert.match(annualSource,/data-publication-claims=\{review \? undefined : "G3-PUB-017"\}/);
assert.match(annualSource,/assertAdoptedAnnualFinance\(props.projection\)/);
for (const id of ['G3-S002','G3-S028']) {
  assert.ok(sources.some(s=>s.id===id));
  assert.ok(annualSource.includes('href="#src-'+id+'"'));
}
const values = [...current.match(/const financeDeltas = \[([\s\S]*?)\];/)[1].matchAll(/value:\s*(\d+)/g)].map((match) => Number(match[1]));
assert.deepEqual(values, [1061800, 817283, 246511], 'the comparison must retain the exact pinned G3-PUB-002 deltas');
function sourceDoc(value) {
  return parse(value
    .replace(/\{formatNumber\(financeDeltas\[(\d)\]\.value\)\}/g, (_, index) => String(values[index]))
    .replace(/\{['"] ['"]\}/g, ' '));
}
const before = sourceDoc(old);
const after = sourceDoc(current);
// Compare every non-citation paragraph in factual modules, including timeline.
// Only whitespace is normalized (explicit Astro inline separators were repaired).
// Header/dek, source labels, bibliography and two translated h3s are editorial UI.
const factualModules = ['overview', 'timeline', 'finance', 'governance', 'buice', 'buck', 'wind-down', 'unknowns', 'documents', 'corrections'];
let paragraphCount = 0;
const proseHashes = {};
for (const id of factualModules) {
  const paragraphs = (doc) => {
    const section = byId(doc, id);
    assert.ok(section, `missing factual module: ${id}`);
    return all(section, (node) => node.tagName === 'p' && !hasClass(node, 'source-note-paragraph')).map((node) => normalize(text(node)));
  };
  const a = paragraphs(before), b = paragraphs(after);
  if(id==='buice') {
    assert.ok(a[0].includes(normalize('В мае 2025 года G3 опубликовала заявление')));
    assert.deepEqual(b,[normalize(r6Crisis.readerSafeText),...a.slice(1)],'only approved R6 replacement in crisis narrative');
    assert.equal(all(byId(after,id),node=>attr(node,'data-publication-claims')===r6Crisis.id).length,1);
  } else assert.deepEqual(b, a, `factual narrative changed in #${id}`);
  paragraphCount += a.length;
  proseHashes[id] = digest(b.join('\n'));
}
for (const name of ['g3ProductMetadata', 'g3PublicationHandoff', 'g3SourceBibliography', 'journalProductMetadata']) {
  const file = `src/data/journal/${name}.ts`;
  assert.equal(read(file), previous(file), `${file} is an unchanged authority owner in this lane`);
}
assert.equal(sources.length, 21);
// Reader link routes are not a new claim or alteration of the sealed ledger.
// Independent expected grouping: every sealed source has an honest SSR destination.
const expectedSourceSections = new Map(Object.entries({
  "timeline": [
    "G3-S001"
  ],
  "finance": [
    "G3-S002",
    "G3-S028"
  ],
  "buice": [
    "G3-S008",
    "G3-S009",
    "G3-S010",
    "G3-S023",
    "G3-S024"
  ],
  "buck": [
    "G3-S012",
    "G3-S015",
    "G3-S035",
    "G3-S042"
  ],
  "wind-down": [
    "G3-S011",
    "G3-S017",
    "G3-S033",
    "G3-S050",
    "G3-S053"
  ],
  "governance": [
    "G3-S046",
    "G3-S047",
    "G3-S096"
  ],
  "documents": [
    "G3-S054"
  ]
}).flatMap(([section, ids]) => ids.map(id => [id, '#'+section])));
assert.equal(expectedSourceSections.size, sources.length);
for (const source of sources) {
  const target = expectedSourceSections.get(source.id);
  assert.ok(target && byId(after, target.slice(1)), `Missing section fallback: ${source.id}`);
  assert.ok(current.includes(`'${source.id}': '${target}'`), `Wrong source section: ${source.id}`);
}
const readerLinks = new Map([
  ['G3-S002', 'https://projects.propublica.org/nonprofits/organizations/842403597'],
  ['G3-S008', 'https://web.archive.org/web/20250512232856id_/https://g3min.org/statement-regarding-josh-buice/'],
  ['G3-S012', 'https://teampyro.blogspot.com/2026/08/hamans-gallows.html'],
  ['G3-S015', 'https://www.christianpost.com/news/g3-church-network-shuts-down-after-leaders-apologize-report.html'],
  ['G3-S017', 'https://ministrywatch.com/g3-ministries-closes-amid-anonymous-smear-campaign/'],
  ['G3-S042', 'https://www.christianpost.com/news/g3-church-network-shuts-down-after-leaders-apologize-report.html'],
]);
for (const [id, href] of readerLinks) {
  assert.ok(sources.some(source => source.id === id), `Unknown source: ${id}`);
  assert.ok(current.includes(`'${id}': { href: '${href}'`), `Reader link missing: ${id}`);
}
const claimIds = [...new Set(current.match(/G3-PUB-\d{3}/g) || [])].sort();
const frozenClaimIds = [...new Set(old.match(/G3-PUB-\d{3}/g) || [])].sort();
assert.deepEqual(claimIds, [...frozenClaimIds,r6Crisis.id].sort(), 'only adopted R6 crisis ID expands the frozen projection');
// Research Q020 (2026-11-21) withdrew G3-PUB-015 from reader-visible prose.
// The immutable 16-ID Research handoff remains preserved; do not reinstate its
// disproven Jenkins reissue inference merely to satisfy an obsolete test count.
const readerSafeClaims = Array.from({ length: 16 }, (_, i) => `G3-PUB-${String(i + 1).padStart(3, '0')}`)
  .filter(id => id !== 'G3-PUB-015');
assert.deepEqual(frozenClaimIds,readerSafeClaims,'Q020-corrected frozen crisis projection remains exactly 15 IDs');
assert.deepEqual(claimIds,[...readerSafeClaims,r6Crisis.id].sort());
assert.ok(!current.includes('G3-PUB-015'), 'withdrawn G3-PUB-015 cannot return in crisis reader prose');
assert.ok(!current.includes('G3-HIST-PUB-'), 'historical candidates must not enter the crisis claim projection');
assert.deepEqual([...history.approvedClaimIds], Array.from({ length: 9 }, (_, i) => `G3-HIST-PUB-${String(i + 1).padStart(2, '0')}`));
assert.ok(history.researchHandoffUrl.includes('389de7b1fca6bf2317aa4e0bf187f13600792384'), 'adopted Research #628 is pinned');
assert.equal(new Set(historySources.map(s => s.id)).size, historySources.length);
assert.ok(historySources.length >= 22);
for (const name of ['G3HistoryArticle', 'G3HistoryFeature']) {
  const source = read(`src/components/journal/${name}.astro`);
  assert.doesNotMatch(source, /PUBLICATION_HOLD|RESEARCH_DRAFT|Не опубликовано|data-research-candidates/, `${name} must be public-ready`);
}
// HIST-09/10: the 10 Sep 2018 sponsored invitation is not a record of
// who spoke in January 2019. Paul Washer is absent from its advertised
// speaker list, but his titled session is present in the GNL catalog.
// Sources: announcement-2019 and gnl-2019 in the public registry.
function assertMissionAttribution(doc) {
  const row = byId(doc, 'g3-year-2019');
  assert.ok(row, '2019 mission chapter is present');
  const paragraphs = all(row, node => node.tagName === 'p' && !hasClass(node, 'je-history-footnote'));
  const advertised = paragraphs.filter(node => text(node).includes('В рекламном анонсе'));
  const recorded = paragraphs.filter(node => text(node).includes('В опубликованных записях 2019 года'));
  assert.equal(advertised.length, 1, 'advertising witness is separate');
  assert.equal(recorded.length, 1, 'recorded-session witness is separate');
  assert.ok(paragraphs.indexOf(advertised[0]) < paragraphs.indexOf(recorded[0]), 'announcement precedes recorded sessions');
  const announcement = g44VisibleText(text(advertised[0]));
  for (const name of ['Джон Пайпер','Дэвид Платт','Марк Девер','Водди Бокам','Конрад Мбеве','Стивен Лоусон','Тим Чаллис']) {
    assert.ok(announcement.includes(name), 'advertised name preserved: ' + name);
  }
  assert.doesNotMatch(announcement, /Вошер|Уошер|Washer/iu, 'do not place Washer in the sponsored invitation');
  assert.match(g44VisibleText(text(recorded[0])), /Пол Вошер — обсуждением определения миссии/u, 'preserve the separately catalogued session');
  for (const id of ['cite-g3-year-2019-announcement-2019', 'cite-g3-year-2019-gnl-2019']) {
    assert.equal(all(row, node => node.tagName === 'a' && attr(node, 'id') === id).length, 1, 'retain separate source: ' + id);
  }
}

assertMissionAttribution(parse(read('src/components/journal/G3HistoryFeature.astro')));
const historyRoute = '/journal/dossiers/g3/history/';
assert.ok(fs.existsSync(path.join(root, 'src/pages/journal/dossiers/g3/history/index.astro')));
assert.equal(JSON.parse(read('migration/page-ownership.json')).routes[historyRoute]?.status, 'production-dist');
for (const name of ['data/route-search-policy.json', 'data/search-manifest.json', 'sitemap.xml', 'feed.xml']) {
  assert.ok(read(name).includes(historyRoute), `${name} must register public historical article`);
  assert.ok(!read(name).includes('/_review/g3-history/'), 'review route may not leak');
}
const css = read('src/components/journal/journalEditorial.css') + read('src/components/journal/g3History.css');
assert.ok(!css.includes('!important'), 'route-local cascade must not rely on important patches');

let literalParagraphs = 0;
const built = [];
if (!process.argv.includes('--source-only')) {
  for (const [route, data, type] of [['/journal/', journal, 'CollectionPage'], ['/journal/dossiers/g3/', metadata, 'Article'], [historyRoute, history, 'Article']]) {
    const html = read(`dist${route}index.html`);
    const doc = parse(html);
    const nodes = all(doc, (node) => Boolean(node.tagName));
    const metas = (key, value) => nodes.filter((node) => node.tagName === 'meta' && attr(node, key) === value);
    const oneMeta = (key, value, expected) => {
      const matched = metas(key, value);
      assert.equal(matched.length, 1, `duplicate/missing ${value} at ${route}`);
      assert.equal(attr(matched[0], 'content'), expected, `${value} drift at ${route}`);
    };
    assert.equal(nodes.filter((node) => node.tagName === 'h1').length, 1);
    const canonicals = nodes.filter((node) => node.tagName === 'link' && attr(node, 'rel') === 'canonical');
    assert.equal(canonicals.length, 1);
    assert.equal(attr(canonicals[0], 'href'), data.canonical);
    oneMeta('name', 'description', data.description);
    oneMeta('property', 'og:url', data.canonical);
    oneMeta('property', 'og:type', type === 'Article' ? 'article' : 'website');
    if (type === 'Article') {
      oneMeta('property', 'article:published_time', data.publishedAt);
      oneMeta('property', 'article:modified_time', data.modifiedAt);
      const dateGroups = nodes.filter(node => hasClass(node, 'je-article-dates'));
      assert.equal(dateGroups.length, 1, 'one visible article dateline at '+route);
      const visibleDates = all(dateGroups[0], node => node.tagName === 'time');
      const expectedDates = data.modifiedAt === data.publishedAt ? [data.publishedAt] : [data.publishedAt, data.modifiedAt];
      assert.deepEqual(visibleDates.map(node => attr(node, 'datetime')), expectedDates, 'visible article dates match route metadata at '+route);
      assert.ok(visibleDates.every(node => text(node).trim()), 'visible article dates must have text at '+route);
    } else {
      for (const field of ['article:published_time', 'article:modified_time']) assert.equal(metas('property', field).length, 0, `CollectionPage must not leak ${field}`);
    }
    const imageAlt = metas('property', 'og:image:alt');
    assert.equal(imageAlt.length, 1, 'one route-owned image description');
    assert.ok(attr(imageAlt[0], 'content')?.trim());
    oneMeta('name', 'twitter:image:alt', attr(imageAlt[0], 'content'));
    assert.equal(metas('name', 'robots').length, 1);
    assert.match(attr(metas('name', 'robots')[0], 'content'), /^index, follow/);
    const graphs = nodes.filter((node) => node.tagName === 'script' && attr(node, 'type') === 'application/ld+json').map((node) => JSON.parse(text(node)));
    const entities = graphs.flatMap((graph) => graph['@graph'] || [graph]);
    const breadcrumbs = entities.filter((item) => item['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumbs.length, 1, `exactly one BreadcrumbList at ${route}`);
    assert.deepEqual(breadcrumbs[0].itemListElement, expectedBreadcrumbItems(data.canonical), `breadcrumb dist drift at ${route}`);
    const entity = entities.filter((item) => item['@type'] === type);
    assert.equal(entity.length, 1, `exactly one ${type} schema at ${route}`);
    assert.equal(entity[0].headline, data.title);
    assert.equal(entity[0].datePublished, data.publishedAt);
    assert.equal(entity[0].dateModified, data.modifiedAt);
    const narration = nodes.filter(node=>attr(node,'data-journal-narration')!==undefined);
    const ranges = nodes.filter(node=>attr(node,'data-reader-range')!==undefined);
    assert.equal(narration.length,type==='Article'?1:0,'Journal narration is explicitly article-only');
    assert.equal(ranges.length,type==='Article'?1:0,'one canonical reader projection range per opted-in article');
    if(type==='Article') {
      assert.equal(attr(ranges[0],'id'),'main-content');
      assert.notEqual(attr(narration[0],'hidden'),undefined,'no inert controls without JS');
      assert.notEqual(attr(narration[0],'data-pagefind-ignore'),undefined);
      assert.equal(all(narration[0],node=>attr(node,'data-fc-action')==='play').length,1);
      assert.deepEqual(all(narration[0],node=>node.tagName==='option').map(node=>Number(attr(node,'value'))),[.75,1,1.25,1.5,1.75,2]);
    }
    const ids = nodes.map((node) => attr(node, 'id')).filter(Boolean);
    assert.equal(ids.length, new Set(ids).size, `duplicate element IDs at ${route}`);
    for (const node of nodes.filter((node) => node.tagName === 'a' && attr(node, 'href')?.startsWith('#'))) {
      const hash = decodeURIComponent(attr(node, 'href').slice(1));
      assert.ok(ids.includes(hash), `broken anchor #${hash} at ${route}`);
    }
    assert.ok(!html.includes('PUBLICATION_HOLD') && !html.includes('/_review/'), 'draft history must not enter public HTML');
    if (route !== historyRoute) {
      // The ecosystem deliberately links to two sources on the companion route.
      // Forbid duplicated local bibliography ownership, not valid cross-route links.
      assert.ok(!ids.some(id=>id.startsWith('history-source-')), 'history bibliography IDs must remain separate');
      assert.ok(!nodes.some(node=>node.tagName==='a'&&attr(node,'href')?.startsWith('#history-source-')), 'no local history bibliography links on other routes');
      const cross=nodes.filter(node=>node.tagName==='a'&&attr(node,'href')?.includes('/history/#history-source-')).map(node=>attr(node,'href'));
      const expected=route==='/journal/dossiers/g3/'?['challies','aniol-2021'].map(id=>historyRoute+'#history-source-'+id):[];
      assert.deepEqual(cross.sort(),expected.sort(),'only the adopted companion-source links');
      for(const href of cross) {
        const id=href.split('#history-source-')[1];
        assert.ok(historySources.some(source=>source.id===id),'cross-route source must be in history registry');
        assert.ok(byId(parse(read('dist'+historyRoute+'index.html')),'history-source-'+id),'cross-route source must exist in built history');
      }
    }
    const covers = nodes.filter((node) => node.tagName === 'source' && attr(node, 'type') === 'image/avif');
    assert.equal(covers.length, 1, `exactly one responsive AVIF cover at ${route}`);
    const fontHints = nodes.filter((node) => node.tagName === 'link' && attr(node, 'rel') === 'preload' && attr(node, 'as') === 'font');
    // Journal collection and both G3 articles use semibold Source Sans
    // for visible labels. Only the dossier uses semibold Lora.
    // Other Journal routes must NOT preload the unused face
    // (Firefox reports a genuine unused-WOFF2 console warning).
    // Reject any missing, extra, or duplicate font hint.
    const expectedFontHints = [
      '/fonts/PlayfairDisplay/playfairdisplay-cyrillic-600.woff2',
      '/fonts/Lora/lora-cyrillic-400.woff2',
      '/fonts/SourceSans3/sourcesans3-cyrillic-400.woff2',
      '/fonts/SourceSans3/sourcesans3-latin-400.woff2',
      '/fonts/SourceSans3/sourcesans3-cyrillic-600.woff2',
      ...(route === '/journal/dossiers/g3/' ? [
        '/fonts/Lora/lora-cyrillic-600.woff2',
      ] : []),
    ];
    const actualFontHints = fontHints.map((node) => attr(node, 'href'));
    assert.deepEqual([...actualFontHints].sort(), [...expectedFontHints].sort(),
      `exact Journal/G3 critical local font-hint set at ${route}`);
    assert.equal(new Set(actualFontHints).size, expectedFontHints.length, 'no duplicate font hints');
    for (const hint of fontHints) assert.ok(fs.existsSync(path.join(root, attr(hint, 'href'))), 'font hints must reuse existing local files');
    assert.ok(!html.includes('localhost') && !html.includes('127.0.0.1'), 'browser-facing URLs must not point to the sandbox loopback');
    const sourceAdapters = nodes.filter((node) => node.tagName === 'script' && text(node).includes('journalSourceNavigationBound'));
    assert.equal(sourceAdapters.length, type === 'Article' ? 1 : 0, 'Astro must deduplicate the bounded adapter, not emit one script per source');
    // Adapted from QA#2344: semantic owner counts, not another UI implementation.
    for (const [tag, className] of [['header', 'je-masthead'], ['nav', 'je-masthead__nav'], ['header', 'mcp-top'], ['button', 'mcp-search']]) {
      assert.equal(nodes.filter((node) => node.tagName === tag && hasClass(node, className)).length, 1, `${route}: one ${className} owner`);
    }
    assert.equal(nodes.filter((node) => node.tagName === 'main' && attr(node, 'id') === 'main-content').length, 1);
    if (route === '/journal/dossiers/g3/') {
      // Agent1's literal source→compressed-DOM word-boundary witness, adapted to
      // selected Agent8 markup. The existing baseline factual-parity gate stays.
      const words = (value) => value.replace(/\s+/gu, ' ').trim();
      // Classify literals BEFORE sourceDoc projects formatNumber expressions.
      // Dynamic formatted currency is covered by the exact values/baseline gate,
      // not compared as an ungrouped literal against real Intl-grouped numbers.
      const literalSource = parse(current.replace(/\{['"] ['"]\}/g, ' '));
      for (const value of values) assert.ok(normalize(text(byId(doc, 'finance'))).includes(String(value)), `Exact finance projection missing: ${value}`);
      // The correction journal is an Astro conditional. Only its active
      // branch is emitted: when dated correction records exist, the
      // "no material corrections" placeholder must NOT appear in dist.
      // Compare its real source-owned date and replacement text instead.
      const waterfallSections=nodes.filter(node=>hasClass(node,'g3g-finance'));
      assert.equal(waterfallSections.length,1,'one waterfall instead of duplicate comparison figures');
      const waterfall=waterfallSections[0];
      assert.equal(attr(waterfall,'data-publication-claims'),'G3-PUB-002');
      assert.deepEqual(all(waterfall,node=>node.tagName==='td').map(cell=>Number(normalize(text(cell)).replace('−','-'))),[817283,246511,-1994,1061800]);
      assert.equal(all(waterfall,node=>attr(node,'id')==='cite-finance-G3-S002-2').length,1,'preserve existing citation deep link');
      const ecosystem=nodes.filter(node=>hasClass(node,'g3g-ecosystem'));
      assert.equal(ecosystem.length,1);
      assert.equal(all(ecosystem[0],node=>node.tagName==='a'&&attr(node,'data-journal-citation')!==undefined).length,7);
      const annualSections=nodes.filter(node=>hasClass(node,'g3-annual-finance'));
      assert.equal(annualSections.length,1,'single adopted annual finance module');
      const annualSection=annualSections[0];
      assert.equal(attr(annualSection,'data-publication-claims'),'G3-PUB-017');
      assert.equal(all(annualSection,node=>hasClass(node,'gaf-hold')).length,0);
      const annualTable=all(annualSection,node=>node.tagName==='table');
      assert.equal(annualTable.length,1);
      const actualRows=all(annualTable[0],node=>node.tagName==='tbody').flatMap(body=>all(body,node=>node.tagName==='tr')).map(row=>all(row,node=>['th','td'].includes(node.tagName)).map(cell=>Number(normalize(text(cell)).replace('−','-'))));
      assert.deepEqual(actualRows,annualRows,'all 28 annual values and year labels must render exactly');
      for (const id of ['G3-S002','G3-S028']) {
        const links=all(annualSection,node=>node.tagName==='a'&&attr(node,'href')==='#src-'+id);
        assert.equal(links.length,1);
        assert.equal(attr(links[0],'id'),'cite-finance-annual-'+id);
        assert.notEqual(attr(links[0],'data-journal-citation'),undefined);
      }
      const correctionDeclaration = current.match(/const corrections:[\s\S]*?=\s*\[([\s\S]*?)\];\s*const contents/);
      assert.ok(correctionDeclaration, 'correction record declaration must remain inspectable');
      const expectedCorrections = [...correctionDeclaration[1].matchAll(/correctedAt:\s*'([^']+)'[\s\S]*?newMeaning:\s*'([^']+)'/g)];
      const correctionSection = byId(doc, 'corrections');
      const actualCorrections = all(correctionSection, (node) => node.tagName === 'li');
      assert.equal(actualCorrections.length, expectedCorrections.length, 'published correction entries must match source records');
      assert.equal(all(correctionSection, (node) => hasClass(node, 'empty-corrections')).length,
        expectedCorrections.length ? 0 : 1, 'inactive correction placeholder must not be published');
      for (const [index, [, when, meaning]] of expectedCorrections.entries()) {
        const entry = actualCorrections[index];
        const stamps = all(entry, (node) => node.tagName === 'time');
        assert.equal(stamps.length, 1, `correction ${index + 1}: exactly one dated record`);
        assert.equal(attr(stamps[0], 'datetime'), when, `correction ${index + 1}: source date drift`);
        assert.ok(normalize(text(entry)).includes(normalize(meaning)), `correction ${index + 1}: source meaning drift`);
      }
      for (const id of factualModules) {
        const expected = all(byId(literalSource, id), (node) => node.tagName === 'p' &&
          !hasClass(node, 'source-note-paragraph') &&
          !(id === 'corrections' && expectedCorrections.length && hasClass(node, 'empty-corrections')))
          .map(text).filter((value) => !/[{}]/.test(value)).map(words);
        const rendered = all(byId(doc, id), (node) => node.tagName === 'p').map((node) => words(text(node)));
        for (const paragraph of expected) {
          assert.ok(rendered.includes(paragraph), `#${id}: compressed DOM changed source word boundaries: ${paragraph.slice(0, 100)}`);
          literalParagraphs++;
        }
      }
      assert.ok(literalParagraphs >= 30, 'Literal paragraph witness must not silently lose coverage');
      assert.ok(nodes.some((node) => hasClass(node, 'article-header')));
      assert.ok(nodes.some((node) => hasClass(node, 'author-card')));
      assert.equal(nodes.filter((node) => hasClass(node, 'je-contents')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'bibliography-item')).length, 21);
      for (const source of sources) {
        const entry = byId(doc, `src-${source.id}`);
        assert.ok(entry);
        if (source.id === 'G3-S008') {
          assert.equal(all(entry,node=>node.tagName==='a'&&attr(node,'href')===r6.sources['buice-board-2025-reproduction']).length,1,'same statement reproduction, separate from archive');
        }
        if (source.id === 'G3-S015') {
          assert.match(text(entry), /Скотт Аниол, Джон Нортон, Дилан Джойнер и Мэтт Сайкс/);
          assert.doesNotMatch(text(entry), /четвёртый пастор/);
        }
        if (source.id === 'G3-S017') {
          assert.match(text(entry), /2026-08-27/);
          assert.doesNotMatch(text(entry), /2026-09-04/);
        }
        const summaries = all(entry, node => node.tagName === 'summary');
        assert.equal(summaries.length, 1);
        assert.ok(attr(summaries[0], 'aria-label')?.includes('Локатор и доступ: '), 'contextual disclosure name');
        if (readerLinks.has(source.id)) {
          const links = all(entry, node => node.tagName === 'a' && attr(node, 'href') === readerLinks.get(source.id));
          assert.equal(links.length, 1, `reader link ${source.id}`);
          assert.ok(text(links[0]).trim(), 'external link must have a meaningful name');
        }
        const returns = all(entry, (node) => node.tagName === 'a' && attr(node, 'data-journal-source-return') !== undefined);
        assert.equal(returns.length, 1, `one honest SSR return at ${source.id}`);
        assert.equal(attr(returns[0], 'href'), expectedSourceSections.get(source.id));
        assert.ok(byId(doc, expectedSourceSections.get(source.id).slice(1)), `Missing rendered source context ${source.id}`);
        assert.notEqual(attr(returns[0], 'data-pagefind-ignore'), undefined, 'navigation-only fallback text must not pollute search');
        assert.match(text(returns[0]), expectedSourceSections.get(source.id) === '#documents' ? /К методике проверки/ : /К связанному разделу статьи/);
      }
      assert.equal(nodes.filter((node) => attr(node, 'data-journal-source-navigation') !== undefined).length, 1);
      const citations = nodes.filter((node) => node.tagName === 'a' && attr(node, 'href')?.startsWith('#src-'));
      assert.ok(citations.length > 0);
      for (const citation of citations) {
        assert.ok(attr(citation, 'id')?.startsWith('cite-'), 'citations need stable, SSR-owned fragment IDs');
        assert.notEqual(attr(citation, 'data-journal-citation'), undefined, 'every existing source citation must be enhanced, not a parallel map');
      }
    }
    if (route === historyRoute) {
      // Internal handoff is checked against the canonical metadata above;
      // it is editorial provenance, not a public bibliographic source.
      assert.ok(!nodes.some(node => node.tagName === 'a' &&
        /github\.com\/FedorMilovanov\/Research(?:\/|$)/i.test(attr(node, 'href') || '')),
        'internal Research links must not appear in public history');
      assert.equal(nodes.filter(node => hasClass(node, 'research-disclosure')).length, 0);
      assert.doesNotMatch(text(doc), /Принятый редакционный пакет Research|Основание источниковой сверки/u);
      for(const projection of r6.projections.slice(0,4)) {
        const paragraphs=nodes.filter(node=>node.tagName==='p'&&attr(node,'data-history-expansion-claim')===projection.id);
        assert.equal(paragraphs.length,1);
        assert.equal(normalize(text(paragraphs[0])),normalize(projection.readerSafeText));
        for(const id of projection.sources) {
          const entry=byId(doc,'history-source-'+id);
          assert.ok(entry);
          assert.equal(all(entry,node=>node.tagName==='a'&&attr(node,'href')===r6.sources[id]).length,1);
          assert.ok(byId(doc,'cite-r6-'+id));
        }
      }
      assertMissionAttribution(doc);
      const christYear=assertLaterConferenceChronology(doc);
      assert.equal(all(christYear,n=>attr(n,'data-history-expansion-claim')==='G3-HIST-PUB-14').length,1,'2021 testimony belongs to its chronological chapter');
      assert.equal(all(christYear,n=>attr(n,'id')==='cite-r6-crotts-2021').length,1,'2021 source remains next to testimony');
      assert.equal(all(byId(doc,'g3-growth'),n=>attr(n,'data-history-expansion-claim')==='G3-HIST-PUB-15').length,1,'network account remains in institutional growth');
      assertG44Dist(doc);
      const atlas=nodes.filter(node=>hasClass(node,'g3g-history'));
      assert.equal(atlas.length,1);
      const atlasCitations=all(atlas[0],node=>node.tagName==='a'&&attr(node,'data-journal-citation')!==undefined);
      // Independent reviewed evidence binding: a real bibliography destination
      // is not sufficient if it belongs to another historical event.
      const expectedAtlasSourceIds = [
        'challies', 'ascol-2018', 'reformation-2024', 'cessationist-2024',
        'peters-2024', 'invitation-2011', 'challies', 'gnl-2014', 'gnl-2015',
        'gnl-2016', 'gnl-2017', 'statement-2018', 'gnl-2019', 'gnl-2020',
        'aniol-2021', 'announcement-2023', 'reformation-2024', 'cessationist-2024',
      ];
      const expectedAtlasBindings = expectedAtlasSourceIds.map((sourceId,i)=>[
        `cite-g3g-history-${i+1}`, `#history-source-${sourceId}`,
      ]);
      assert.deepEqual(atlasCitations.map(link=>[attr(link,'id'),attr(link,'href')]),
        expectedAtlasBindings,'atlas ordered citation ID/source identity must survive layout changes');
      for (const link of atlasCitations) assert.ok(byId(doc,attr(link,'href').slice(1)),'atlas citation has exact rendered destination');
      assert.equal(nodes.filter((node) => hasClass(node, 'bibliography-item')).length, historySources.length);
      assert.equal(nodes.filter((node) => hasClass(node, 'je-contents')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'article-header')).length, 1);
      assert.equal(nodes.filter((node) => hasClass(node, 'author-card')).length, 1);
      assert.equal(nodes.filter((node) => attr(node,'data-journal-source-navigation') !== undefined).length, 1);
      for (const source of historySources) {
        const entry = byId(doc, `history-source-${source.id}`);
        assert.ok(entry, `Missing history citation bibliography ${source.id}`);
        const disclosure = all(entry, node => node.tagName === 'summary');
        assert.equal(disclosure.length, 1);
        assert.equal(attr(disclosure[0], 'aria-label'), `О документе: ${source.title}`);
        assert.equal(all(entry, node => node.tagName === 'a' && attr(node, 'href') === source.url).length, 1, 'original source link preserved');
        assert.equal(all(entry, node => node.tagName === 'details' && hasClass(node, 'biblio-details')).length, 1, 'one native source disclosure');
        assert.ok(normalize(text(entry)).includes(normalize(source.boundary)), 'source context preserved in disclosure');
        const returns = all(entry, node => node.tagName === 'a' && attr(node,'data-journal-source-return') !== undefined);
        assert.equal(returns.length, 1, `${source.id}: exactly one bibliography return`);
        assert.equal(attr(returns[0],'href'), source.returnHref, `${source.id}: return must target its source context`);
      }
    }
    built.push({ route, schema: type, bytes: Buffer.byteLength(html), canonical: data.canonical });
  }
  assert.ok(!fs.existsSync(path.join(root,'dist/_review/g3-history/index.html')), 'local preview must not ship');
  for (const file of ['dist/sitemap.xml', 'dist/feed.xml', 'dist/data/search-manifest.json']) {
    assert.ok(read(file).includes(historyRoute), `${file}: published history must be discoverable`);
    assert.ok(!read(file).includes('/_review/g3-history/'), `${file}: preview leaked`);
  }
}
// Read actual Pagefind artifacts, adapted from QA#2344. A positive G3 control
// is mandatory; held-token queries may honestly yield zero results.
async function inspectPagefind() {
  const pagefindRoot = path.join(root, 'dist/pagefind');
  assert.ok(JSON.parse(read('dist/pagefind/pagefind-entry.json')).languages?.ru?.page_count > 0);
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(pagefindRoot, decodeURIComponent(pathname).replace(/^\/pagefind\//, ''));
    if (!pathname.startsWith('/pagefind/') || !file.startsWith(pagefindRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end();
    response.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(file).pipe(response);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const module = await import(`data:text/javascript;base64,${Buffer.from(read('dist/pagefind/pagefind.js')).toString('base64')}`);
    const index = await module.createInstance({ basePath: `${baseUrl}/pagefind/`, baseUrl, primary: true, language: 'ru' });
    const probes = [];
    for (const query of ['G3', 'конференция G3', 'PUBLICATION_HOLD', '_review/g3-history']) {
      const result = await index.search(query);
      const items = await Promise.all(result.results.map(item => item.data()));
      const paths = items.map(item => new URL(item.url,baseUrl).pathname);
      assert.ok(!paths.some(value => value.startsWith('/_review/')), `Preview was indexed for ${query}`);
      for (const item of items) assert.doesNotMatch(item.content || '', /PUBLICATION_HOLD|RESEARCH_DRAFT/);
      if (query === 'G3') {
        assert.ok(paths.includes('/journal/dossiers/g3/'), 'Crisis dossier must remain indexed');
        assert.ok(paths.includes(historyRoute), 'Historical G3 must be indexed');
      }
      probes.push({ query, hits: items.length, paths });
    }
    return { actualIndex: true, probes };
  } finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
function probePublishedRoute() {
  const routeFile='dist/journal/dossiers/g3/history/index.html';
  assert.ok(fs.existsSync(path.join(root,routeFile)), 'production history HTML missing');
  const html=read(routeFile);
  assert.ok(html.includes(history.canonical));
  assert.ok(!html.includes('PUBLICATION_HOLD') && !html.includes('/_review/'));
  return {route:historyRoute,htmlFile:routeFile,exists:true,proof:'production-like generated HTML; not a live deploy'};
}
const pagefind = !args.has('--source-only') ? await inspectPagefind() : null;
const productionProbes = args.has('--probe-publication') ? probePublishedRoute() : 'NOT RUN (use --probe-publication)';
const report = { baseline, head: execFileSync('git', ['rev-parse','HEAD'], {cwd:root,encoding:'utf8'}).trim(),
  literalParagraphs, pagefind, productionProbes,
  note: 'Built Journal and G3 history publication contract; not a completed live GitHub Pages deployment',
  dossierSourceSha256: digest(current), factualParagraphsUnchanged: paragraphCount, proseHashes,
  approvedClaims: claimIds.length, approvedSourceObjects: sources.length, historySourceLinks: historySources.length,
  historyApprovedClaims: history.approvedClaimIds.length, historyResearchHandoff: history.researchHandoffUrl, historyPublished: true, built };
const outputDirectory = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || 'reports/g3-editorial-local-20261118';
const output = path.resolve(root, outputDirectory, 'contract.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS: ${paragraphCount} crisis factual paragraphs unchanged; ${claimIds.length}/21 reader-visible crisis claim/source projection (Q020 withdrawal preserved; 16-ID historical handoff unchanged), 9 approved historical groups, ${historySources.length} historical sources; ${built.length} built routes.`);
console.log(path.relative(root, output));
