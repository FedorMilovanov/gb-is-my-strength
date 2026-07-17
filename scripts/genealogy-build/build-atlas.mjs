#!/usr/bin/env node
/**
 * build-atlas.mjs — «Библейский атлас родословий»: сцена карточного атласа.
 *
 * Парадигма референсов: карточки-узлы (иконка + имя + роль + стихи) вокруг
 * центрального мессианского хребта, кластеры-свитки по бокам, нижний ряд
 * истории (царство → плен → возвращение), эпохи-главы слева, мини-карта/зум/
 * поиск/фильтры/быстрые ссылки справа, легенда линий, обучающий тур.
 *
 * Этот скрипт СЧИТАЕТ сцену (позиции, связи, списки, честные счётчики из
 * TIPNR-данных) и впрыскивает JSON в atlas-template.html.
 * Pure Node, без зависимостей. Детерминизм.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconSymbolDefs } from './lib/icons.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2');
const SCRATCH = process.argv[2] || '/tmp/claude-0/-home-user/929a9a64-a6ab-5e37-bb8c-a4e74ec5a4cf/scratchpad';

// ── честные счётчики из вычисленных кластеров (layout-l0.json ← TIPNR) ──
async function clusterCounts() {
  try {
    const l0 = JSON.parse(await readFile(path.join(OUT, 'build', 'layout-l0.json'), 'utf8'));
    const m = new Map();
    for (const n of l0.nodes) if (n.id.startsWith('cluster--')) m.set(n.id.slice(9), n.count ?? null);
    return m;
  } catch { return new Map(); }
}

// ── списки членов кластеров (id→ru+стих) для раскрытия по клику ──
// atlas-id → groups.json cluster id
const CLUSTER_GROUP = {
  antediluvian: 'antediluvian-patriarchs', 'abr-desc': 'abraham-descendants',
  ishmael: 'ishmaelites', edom: 'esau-edom', levites: 'levites', priests: 'priests',
  'david-house': 'house-of-david', return: 'return-from-exile',
  tribes12: 'tribes-12', matthew1: 'matthew-1', luke3: 'luke-3', relatives: 'lords-relatives',
};
const MEMBER_CAP = 60;   // сколько имён показываем в раскрытии (остальное — «ещё N»)
// канонический порядок книг (OSIS) — чтобы выборка начиналась с Бытия, а не с «1Ki» по алфавиту
const BOOK_ORDER = ['Gen','Exod','Lev','Num','Deut','Josh','Judg','Ruth','1Sam','2Sam','1Kgs','2Kgs','1Chr','2Chr','Ezra','Neh','Esth','Job','Ps','Prov','Eccl','Song','Isa','Jer','Lam','Ezek','Dan','Hos','Joel','Amos','Obad','Jonah','Mic','Nah','Hab','Zeph','Hag','Zech','Mal','Matt','Mark','Luke','John','Acts','Rom','1Cor','2Cor','Gal','Eph','Phil','Col','1Thess','2Thess','1Tim','2Tim','Titus','Phlm','Heb','Jas','1Pet','2Pet','1John','2John','3John','Jude','Rev'];
const bookIdx = new Map(BOOK_ORDER.map((b, i) => [b.toLowerCase(), i]));
function osisSortKey(osis) {
  if (!osis) return [999, 999, 999];
  const [bk, ch, vs] = osis.split('.');
  return [bookIdx.get(String(bk).toLowerCase()) ?? 900, +ch || 0, +vs || 0];
}
async function clusterMembers() {
  const groups = JSON.parse(await readFile(path.join(OUT, 'groups.json'), 'utf8')).clusters || [];
  const persons = JSON.parse(await readFile(path.join(OUT, 'persons.json'), 'utf8'));
  const parr = Array.isArray(persons) ? persons : (persons.persons || Object.values(persons));
  const byId = new Map();
  for (const p of parr) byId.set(p.id, { ru: (p.ru && p.ru.name) || p.en || p.id, ref: p.firstRef && p.firstRef.ru, osis: p.firstRef && p.firstRef.osis });
  const gById = new Map(groups.map(g => [g.id, g]));
  const out = {};
  for (const [atlasId, gid] of Object.entries(CLUSTER_GROUP)) {
    const g = gById.get(gid); if (!g || !g.members) continue;
    const rows = g.members.map(id => byId.get(id)).filter(Boolean)
      .filter(r => r.ru && !/^[a-z-]+$/i.test(r.ru))          // отбрасываем нерусские заглушки
      .sort((a, b) => { const ka = osisSortKey(a.osis), kb = osisSortKey(b.osis);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2] || a.ru.localeCompare(b.ru, 'ru'); });
    out[atlasId] = { total: g.count ?? rows.length, shown: rows.slice(0, MEMBER_CAP).map(r => ({ ru: r.ru, ref: r.ref })) };
  }
  return out;
}

// ── честная сводка охвата («что уже есть / что ещё предстоит») из meta + данных ──
async function coverageStats() {
  const j = async f => { try { return JSON.parse(await readFile(path.join(OUT, f), 'utf8')); } catch { return null; } };
  const meta = await j('meta.json');
  const ety = await j('name-etymology.json');
  const nat = await j('table-of-nations.json');
  const c = meta?.counts || {};
  const etyN = ety?.entries?.length ?? 0;
  // confidence народов
  const conf = { certain: 0, probable: 0, disputed: 0, obscure: 0 };
  (function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.confidence && conf[node.confidence] != null) conf[node.confidence]++;
    (node.children || []).forEach(walk);
    (node.branches || []).forEach(walk);
  })(nat?.branches);
  const persons = c.persons ?? 3056;
  return {
    persons, ruPct: c.ruCoveragePct ?? 100, isolated: c.isolatedPersons ?? null,
    edges: c.parentEdges ?? null, clusters: c.clusters ?? null, nations: nat?._meta?.counts?.nationsProper ?? 70,
    etyDone: etyN, etyRemain: Math.max(0, persons - etyN), conf,
    // «что предстоит» — честный список открытых фронтов
    todo: [
      { done: false, ru: `Объяснения имён: ${etyN} готово, ещё ~${persons - etyN} без иврита/значения` },
      { done: false, ru: `Изолированные персоны (без связей в графе): ${c.isolatedPersons ?? '—'} — предстоит связать` },
      { done: false, ru: 'Трассировка народов до сынов Ноя (Сим/Хам/Иафет) через (d)-маркеры TIPNR' },
      { done: false, ru: 'Раскрытие кластеров на месте по клику (полные списки имён)' },
      { done: true,  ru: `Русские имена: ${c.ruCoveragePct ?? 100}% (${persons} персон)` },
      { done: true,  ru: `Народы размечены по достоверности: ${conf.certain}·${conf.probable}·${conf.disputed}·${conf.obscure}` },
      { done: true,  ru: 'Защита от мифов (mythWatch) на спорных отождествлениях' },
    ],
  };
}

// ── палитра линий (согласована с интерактивом/статикой) ──
const C = {
  spine: 'var(--spineGold)',
  sethites: '#6f8a4c', nations: '#3f7f8c', abr: '#8f7a3a', ishmael: '#c08a3e',
  edom: '#a0453a', tribes: '#4f7a4a', levites: '#8a6db0', priests: '#9a8b3c',
  david: '#6d4b9a', kings: '#9a5ba6', matthew: '#7d6ba0', luke: '#3f6f8c',
  relatives: '#a8683f', exile: '#7a5e46', returned: '#4f7a4a', after: '#6e5c3d',
};

// ── обогащение именами (иврит, транслит, значение, этимология) из genealogy-graph.json ──
// Данные уже выверены (теофорная разметка + переименования). Читаем детерминированно.
async function nameLexicon() {
  try {
    const g = JSON.parse(await readFile(path.join(OUT, 'build', 'genealogy-graph.json'), 'utf8'));
    const m = new Map();
    for (const nd of g.nodes) {
      if (!nd.key) continue;
      m.set(nd.key, { heb: nd.heb ?? null, translit: nd.translit ?? null, meaning: nd.meaning ?? null, note: nd.note ?? null, am: nd.am ?? null, bc: nd.bc ?? null });
    }
    return m;
  } catch { return new Map(); }
}

async function main() {
  const cc = await clusterCounts();
  const n = id => cc.get(id) ?? null;
  const lex = await nameLexicon();
  const L = key => lex.get(key) || {};

  // ── мессианский хребет (вертикаль, x=0) ── key связывает с лексиконом имён
  // minK: 0 — виден всегда (обзор); 0.55 — со среднего масштаба
  const spineRaw = [
    { id: 'adam',    y: 0,    icon: 'person', ru: 'Адам',            sub: 'сотворён по образу Божию', ref: 'Быт 2:7 · 5:1',            minK: 0,    key: 'Adam@Gen.2.19' },
    { id: 'noah',    y: 150,  icon: 'ark',    ru: 'Ной',             sub: 'потоп и завет',            ref: 'Быт 6–9',                  minK: 0,    key: 'Noah@Gen.5.29' },
    { id: 'abraham', y: 330,  icon: 'tent',   ru: 'Авраам',          sub: 'патриарх, друг Божий',     ref: 'Быт 12:1–4 · 15:6 · 17:1–8', minK: 0,  key: 'Abraham@Gen.11.26' },
    { id: 'isaac',   y: 480,  icon: 'ram',    ru: 'Исаак',           sub: 'сын обетования',           ref: 'Быт 21:1–7 · 26:2–5',      minK: 0,    key: 'Isaac@Gen.17.19' },
    { id: 'jacob',   y: 640,  icon: 'ladder', ru: 'Иаков (Израиль)', sub: 'патриарх 12 колен',        ref: 'Быт 25:21–28 · 35:9–12',   minK: 0, wide: true, key: 'Israel@Gen.25.26' },
    { id: 'judah',   y: 800,  icon: 'lion',   ru: 'Иуда',            sub: 'царское колено',           ref: 'Быт 29:35 · 49:8–10',      minK: 0.55, key: 'Judah@Gen.29.35' },
    { id: 'david',   y: 960,  icon: 'crown',  ru: 'Давид',           sub: 'царь Израиля',             ref: 'Пс 78:70–72 · 2Цар 7:12–16', minK: 0,  key: 'David@Rut.4.17' },
    { id: 'solomon', y: 1110, icon: 'temple', ru: 'Соломон',         sub: 'строитель храма',          ref: '3Цар 6 · 2Пар 3',          minK: 0.55, key: 'Solomon@2Sa.5.14' },
    { id: 'jesus',   y: 1280, icon: 'cross',  ru: 'Иисус Христос',   sub: 'Мессия, Сын Давидов',      ref: 'Мф 1:1',                   minK: 0, hero: true, wide: true, key: 'Jesus@Isa.7.14' },
  ];
  const spine = spineRaw.map(s => ({ ...s, ...L(s.key) }));   // heb/translit/meaning/note/am/bc
  const spineY = Object.fromEntries(spine.map(s => [s.id, s.y]));

  // ── боковые кластеры (карточки-свитки; счётчики честные — из TIPNR либо канон) ──
  const XL = -470, XR = 470;
  const clusters = [
    { id: 'antediluvian', x: XL, y: -10,  icon: 'people',  ru: 'Допотопные патриархи', gold: `→ ${n('antediluvian-patriarchs') ?? 25} имён`,  color: C.sethites, anchor: 'adam',   minK: 0 },
    { id: 'nations',      x: XR, y: 90,   icon: 'globe',   ru: 'Народы от Ноя',        gold: '→ 70 народов',                                   color: C.nations,  anchor: 'noah',   minK: 0, link: 'nations-interactive' },
    { id: 'abr-desc',     x: XL, y: 300,  icon: 'tent',    ru: 'Потомки Авраама',      gold: `→ ${n('abraham-descendants') ?? 764} имён`,      color: C.abr,      anchor: 'abraham', minK: 0 },
    { id: 'ishmael',      x: XR, y: 280,  icon: 'camel',   ru: 'Измаильтяне',          gold: '→ 12 князей',                                    color: C.ishmael,  anchor: 'abraham', minK: 0, ref: 'Быт 25:16' },
    { id: 'edom',         x: XR, y: 460,  icon: 'mountain', ru: 'Исав / Едом',         gold: `→ ${n('esau-edom') ?? 17} имён`,                 color: C.edom,     anchor: 'isaac',  minK: 0 },
    { id: 'levites',      x: XR, y: 660,  icon: 'menorah', ru: 'Левиты',               gold: `→ ${n('levites') ?? 266} имён`,                  color: C.levites,  anchor: 'jacob',  minK: 0 },
    { id: 'priests',      x: XL, y: 880,  icon: 'temple',  ru: 'Священники',           gold: `→ ${n('priests') ?? 61} род(ов)`,                color: C.priests,  anchor: 'david',  minK: 0.5 },
    { id: 'david-house',  x: XR, y: 930,  icon: 'crown',   ru: 'Дом Давида',           gold: `→ ${n('house-of-david') ?? 173} имён`,           color: C.david,    anchor: 'david',  minK: 0 },
    { id: 'relatives',    x: 0,  y: 1450, icon: 'people',  ru: 'Родственники Господа', gold: 'братья по традиции · Мк 6:3', color: C.relatives, anchor: 'jesus',  minK: 0, dashed: true, below: true },
  ];

  // ── связь народов: 3 сына Ноя как ветви-мини-карточки справа от «Народы от Ноя» ──
  // (появляются со среднего масштаба; клик ведёт на «Карту народов»). Числа из Быт 10.
  const nationBranches = [
    { id: 'br-japheth', x: 770, y: 10,  icon: 'globe',   ru: 'Иафет', gold: '14 народов', color: '#3f7f8c', region: 'Север · Анатолия · Эгеида · Причерноморье', anchor: 'nations', minK: 0.5 },
    { id: 'br-ham',     x: 770, y: 100, icon: 'globe',   ru: 'Хам',   gold: '30 народов', color: '#a8683f', region: 'Египет · Африка · Месопотамия · Ханаан',      anchor: 'nations', minK: 0.5 },
    { id: 'br-shem',    x: 770, y: 190, icon: 'scroll',  ru: 'Сим',   gold: '26 народов', color: '#9a7b3c', region: 'Месопотамия · Аравия · Сирия — семиты',        anchor: 'nations', minK: 0.5 },
  ];

  // ── 12 колен: карточка-список слева от Иакова ──
  const tribesRows = ['Рувим', 'Симеон', 'Левий', 'Иуда', 'Дан', 'Неффалим'];
  // ── Матфей 1 / Лука 3: карточки-свитки родословий Господа ──
  const mtRows = ['Авраам', 'Исаак', 'Иаков', 'Иуда и братья его', 'Фарес', 'Есром'];
  const lkRows = ['Адам', 'Сиф', 'Енос', 'Каинан', 'Малелеил', 'Иаред'];
  const listCards = [
    { id: 'tribes12', x: XL, y: 560, icon: 'tribes', ru: '12 колен Израиля', sub: 'сыновья Иакова', rows: tribesRows,
      more: '… ещё 6 колен', color: C.tribes, anchor: 'jacob', minK: 0 },
    { id: 'matthew1', x: XL, y: 1210, icon: 'book', ru: 'Матфей 1', sub: 'Авраам → Давид → Иисус', rows: mtRows,
      more: '… 42 поколения (3×14)', footer: 'Иосиф, муж Марии', color: C.matthew, anchor: 'jesus', minK: 0, dashed: true },
    { id: 'luke3', x: XR, y: 1210, icon: 'scroll', ru: 'Лука 3', sub: 'Адам → Иисус · 77 поколений', rows: lkRows,
      more: '… ещё 71 поколение', footer: 'Иосиф, муж Марии', color: C.luke, anchor: 'jesus', minK: 0, dashed: true },
  ];

  // ── нижний ряд истории (царство → плен → возвращение) ──
  const HY = 1660;
  const history = [
    { id: 'divided',  x: -640, y: HY, icon: 'crown',  ru: 'Разделённое царство',  gold: 'Израиль и Иуда',    ref: '3Цар 12',      color: C.kings,   minK: 0.5 },
    { id: 'kings',    x: -320, y: HY, icon: 'crown',  ru: 'Цари Иудеи',           gold: '→ 20 царей',        ref: '3–4 Царств',   color: C.kings,   minK: 0.5 },
    { id: 'exile',    x: 0,    y: HY, icon: 'temple', ru: 'Плен',                 gold: 'Вавилонский плен',  ref: '4Цар 25 · Дан 1', color: C.exile, minK: 0.5 },
    { id: 'return',   x: 320,  y: HY, icon: 'scroll', ru: 'Возвращение из плена', gold: `→ ${n('return-from-exile') ?? 583} имён`, ref: 'Ездра 2 · Неем 7', color: C.returned, minK: 0.5 },
    { id: 'after',    x: 640,  y: HY, icon: 'people', ru: 'После изгнания',       gold: 'роды возвращённых', ref: '1Пар 9',       color: C.after,   minK: 0.5 },
  ];

  // ── эпохи-главы (левый сайдбар) ──
  const epochs = [
    { id: 'creation', icon: 'tree',   ru: 'Сотворение', sub: 'Бытие 1–5',      target: 'adam' },
    { id: 'flood',    icon: 'ark',    ru: 'Потоп',      sub: 'Бытие 6–9',      target: 'noah' },
    { id: 'patri',    icon: 'tent',   ru: 'Патриархи',  sub: 'Бытие 10–50',    target: 'abraham' },
    { id: 'kingdom',  icon: 'crown',  ru: 'Царство',    sub: '1–2 Царств',     target: 'david' },
    { id: 'exileE',   icon: 'temple', ru: 'Плен',       sub: 'Иеремия, Даниил', target: 'exile' },
    { id: 'fulfil',   icon: 'cross',  ru: 'Исполнение', sub: 'Евангелия',      target: 'jesus' },
  ];

  // ── быстрые ссылки (правая рейка) ──
  const quickLinks = [
    { icon: 'person', ru: 'Адам → Иисус Христос', target: 'adam' },
    { icon: 'tribes', ru: '12 колен Израиля',     target: 'tribes12' },
    { icon: 'menorah', ru: 'Левиты',              target: 'levites' },
    { icon: 'crown',  ru: 'Дом Давида',           target: 'david-house' },
    { icon: 'book',   ru: 'Матфей 1',             target: 'matthew1' },
    { icon: 'scroll', ru: 'Лука 3',               target: 'luke3' },
    { icon: 'scroll', ru: 'Возвращение из плена', target: 'return' },
    { icon: 'camel',  ru: 'Измаильтяне',          target: 'ishmael' },
    { icon: 'mountain', ru: 'Едом (Исава)',       target: 'edom' },
    { icon: 'globe',  ru: 'Народы от Ноя',        target: 'nations' },
  ];

  // ── тур (8 шагов) ──
  const tour = [
    { target: 'adam',     title: 'От Адама начинается линия обетования',   text: 'Родословия Библии — не просто списки, а нить обетования о Семени (Быт 3:15), протянутая от Адама к Христу.' },
    { target: 'noah',     title: 'Ной: человечество начинается заново',    text: 'После потопа от трёх сыновей Ноя происходят 70 народов Таблицы народов (Быт 10) — карта доступна по ссылке справа.' },
    { target: 'abraham',  title: 'Авраам: благословение всем племенам',    text: '«И благословятся в тебе все племена земные» (Быт 12:3). От Авраама линия идёт через Исаака, а рядом — Измаильтяне и Едом.' },
    { target: 'jacob',    title: 'Иаков (Израиль) и 12 колен',             text: 'Сыновья Иакова становятся коленами Израиля. Слева — карточка колен; справа — Левиты, колено служения.' },
    { target: 'david',    title: 'От Иуды к Давиду — основание царской линии', text: 'Вы перешли от Иуды, одного из сыновей Иакова, к царю Давиду. Эта линия ведёт к Мессии — Иисусу Христу.' },
    { target: 'kings',    title: 'Дом Давида и цари Иудеи',                text: 'От Соломона — цари Иудеи до плена. Обетование Давиду (2Цар 7) хранит линию сквозь разделение царства.' },
    { target: 'return',   title: 'Плен и возвращение',                     text: 'Вавилонский плен не оборвал линию: родословия возвращённых (Ездра 2, Неемия 7) сохранили дом Давидов.' },
    { target: 'jesus',    title: 'Иисус Христос — исполнение',             text: 'Два родословия — Матфея (от Авраама) и Луки (до Адама) — сходятся на Христе. Пунктир — связи между линиями.' },
  ];

  // ── легенда линий ──
  const legend = [
    { color: C.spine,   ru: 'Мессианская линия', swatch: 'solid' },
    { color: C.sethites, ru: 'Линии патриархов', swatch: 'solid' },
    { color: C.nations, ru: 'Линии народов',     swatch: 'solid' },
    { color: C.kings,   ru: 'Царская линия',     swatch: 'solid' },
    { color: C.levites, ru: 'Левитская линия',   swatch: 'solid' },
    { color: C.matthew, ru: 'Линия Матфея',      swatch: 'solid' },
    { color: C.luke,    ru: 'Линия Луки',        swatch: 'solid' },
    { color: 'var(--gold)', ru: 'Пунктир — связь между линиями', swatch: 'dashed' },
  ];

  const coverage = await coverageStats();
  const members = await clusterMembers();

  const scene = {
    _status: 'atlas: карточный Библейский атлас родословий (по референсам)',
    iconDefs: iconSymbolDefs(),
    spine, spineY, clusters, listCards, history, nationBranches, epochs, quickLinks, tour, legend, coverage, members,
    counts: { spine: spine.length, clusters: clusters.length + listCards.length, history: history.length },
  };

  const tpl = await readFile(path.join(HERE, 'atlas-template.html'), 'utf8');
  if (!tpl.includes('/*__ATLAS__*/')) throw new Error('плейсхолдер /*__ATLAS__*/ не найден');
  const body = tpl.replace('/*__ATLAS__*/', JSON.stringify(scene));
  await writeFile(path.join(SCRATCH, 'atlas-interactive.artifact.html'), body);
  const doc = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Библейский атлас родословий — от Адама до Иисуса Христа</title>
</head>
<body>
${body}
</body>
</html>
`;
  await writeFile(path.join(OUT, 'build', 'atlas-interactive.html'), doc);
  console.log(`[build-atlas] atlas-interactive.html · тело ${body.length} симв. · хребет ${spine.length} · кластеров ${clusters.length + listCards.length} · истории ${history.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
