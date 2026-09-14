#!/usr/bin/env node
/**
 * build.mjs — оркестратор пайплайна «Генеалогии Спасителя» (Phase 1).
 *
 *   node scripts/genealogy-build/build.mjs all        # полный прогон
 *   node scripts/genealogy-build/build.mjs fetch      # только источники → .cache/
 *   node scripts/genealogy-build/build.mjs test       # самопроверки на fixtures
 *   node scripts/genealogy-build/build.mjs validate   # только валидаторы на emit-нутом v2
 *
 * Никаких npm-зависимостей: Node ≥ 22 (fetch/crypto/fs). См. README.md рядом.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { PATHS, SOURCES, PIPELINE_VERSION, HARD_INVARIANTS } from './config.mjs';
import { SynodalText, refToRu, parseRef } from './lib/refs.mjs';
import { parseTipnr, resolveRelations, parseUnifiedRef, parseRelField } from './lib/tipnr-parser.mjs';
import { extractRuName, translitEnRu, similarity, normalizeRuCandidate } from './lib/ru-extract.mjs';
import { computeClusters, nationsLayer } from './lib/clusters.mjs';
import { traceSpine } from './lib/spine.mjs';
import { buildLayoutL0 } from './lib/layout-l0.mjs';
import { renderL0Svg } from './lib/render-l0-svg.mjs';
import { buildTribes12 } from './lib/layout-l1.mjs';
import { renderTribes12Svg } from './lib/render-l1-tribes.mjs';
import { buildMatthewLuke } from './lib/layout-l1-lineages.mjs';
import { renderMatthewLukeSvg } from './lib/render-l1-lineages.mjs';
import { buildNationsTree } from './lib/layout-l1-nations.mjs';
import { renderNationsSvg } from './lib/render-l1-nations.mjs';
import { renderAppShell } from './lib/render-app-shell.mjs';
import { buildViews, buildSearchIndex } from './lib/views.mjs';
import { renderNationsMapSvg } from './lib/render-map-nations.mjs';
import { renderPersonL2Svg } from './lib/render-l2-person.mjs';
import { renderMorphFramesSvg } from './lib/render-morph-frames.mjs';
import { renderTimelineSvg } from './lib/render-timeline.mjs';
import { matchSkeleton } from './lib/skeleton-matcher.mjs';

const log = (...a) => console.log('[genealogy-build]', ...a);

/**
 * Авторазметка теофорных элементов в ивритском имени (по согласному скелету):
 * приставка יהו (Йехо-), суффикс יהו/-יה (-я́ху/-ья) — имя Яхве; אל в начале/конце — Эл
 * «Бог». Отдаёт undefined, если элементов нет. Разметка автоматическая (review:auto) —
 * редакционная сверка обязательна для UI-подписей; ядро вручную — name-etymology.json.
 */
function analyzeTheophoric(nameForms) {
  const heb = (nameForms ?? []).find(n => n.lang === 'H')?.original;
  if (!heb) return undefined;
  // согласный скелет: снять огласовки/кантилляцию/макаф
  const sk = heb.replace(/[֑-ׇ־\s]/g, '').split(',')[0];
  if (sk.length < 3) return undefined;
  const t = {};
  if (/^יהו/.test(sk)) t.yahPrefix = true;
  if (/(יהו|יה)$/.test(sk)) t.yahSuffix = true;
  if (/^אל/.test(sk) && sk.length >= 4) t.elPrefix = true;
  if (/אל$/.test(sk) && sk.length >= 4) t.elSuffix = true;
  return Object.keys(t).length ? { ...t, source: 'auto-skeleton', review: true } : undefined;
}

// ─────────────────────────── fetch ───────────────────────────

async function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function fetchSources() {
  await mkdir(PATHS.cache, { recursive: true });
  for (const [key, src] of Object.entries(SOURCES)) {
    const dest = path.join(PATHS.cache, src.file);
    let cached = null;
    try { cached = await readFile(dest); } catch { /* нет кеша */ }
    if (cached && (await sha256(cached)) === src.sha256) {
      log(`fetch: ${key} — кеш валиден (${src.file})`);
      continue;
    }
    log(`fetch: ${key} ← ${src.url}`);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`fetch ${key}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const digest = await sha256(buf);
    if (digest !== src.sha256) {
      throw new Error(
        `fetch ${key}: SHA256 расходится!\n  ожидали ${src.sha256}\n  получили ${digest}\n` +
        `Upstream изменился — сверить diff и осознанно обновить пин в config.mjs.`,
      );
    }
    await writeFile(dest, buf);
    log(`fetch: ${key} — сохранён и сверен (${buf.length} байт)`);
  }
}

async function loadCached(key) {
  const src = SOURCES[key];
  const dest = path.join(PATHS.cache, src.file);
  try { await access(dest); } catch {
    throw new Error(`Нет ${src.file} в .cache/ — сначала: node scripts/genealogy-build/build.mjs fetch`);
  }
  return readFile(dest, 'utf8');
}

// ─────────────────────────── v1-скелет ───────────────────────────

/** Identity matching lives in lib/skeleton-matcher.mjs so build and
 * publication audit share one pure, reproducible implementation. */

// ─────────────────────────── сборка ───────────────────────────

function personId(rec) {
  const p = parseRef(rec.ref);
  const slug = String(rec.name).split('|')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug}--${p.osis.toLowerCase()}-${p.chapter}-${p.verse}${p.sub}`; // sub различает тёзок одного стиха
}

async function runAll() {
  await fetchSources();

  // 1. Парсинг TIPNR
  const tipnrText = await loadCached('tipnr');
  const { persons, groups, stats: parseStats } = parseTipnr(tipnrText);
  const relStats = resolveRelations(persons);
  log(`parse: персон ${parseStats.personRecords}, групп-народов ${parseStats.groupRecords}, ` +
      `топ-строк ${parseStats.topLines}, типы ${JSON.stringify(parseStats.byType)}, дубликатов ${parseStats.duplicates.length}`);
  log(`resolve: связей ${relStats.resolved}, нерезолв ${relStats.unresolvedRefs.length}, (d)-пропущено ${relStats.skippedDescendedGroup}`);

  // 2. Синодальный текст
  const synRaw = await loadCached('synodal');
  const synodal = new SynodalText(JSON.parse(synRaw.replace(/^﻿/, '')));

  // 3. v1-скелет
  const v1 = JSON.parse(await readFile(PATHS.v1Skeleton, 'utf8'));
  const { matches: v1Matches, decisions: v1Decisions, unmatched: v1Unmatched, soft: v1Soft, collisions: v1Collisions } = matchSkeleton(v1.persons, persons);
  if (v1Collisions.length) log(`skeleton COLLISIONS (два v1-id → один ключ): ${v1Collisions.map(c => `${c.key}=[${c.ids.join(',')}]`).join('; ')}`);
  const v1ByTipnrKey = new Map();
  for (const p of v1.persons) {
    const key = v1Matches.get(p.id);
    if (key) v1ByTipnrKey.set(key, p);
  }
  log(`skeleton: v1 сопоставлено ${v1Matches.size}/${v1.persons.length}, немэпнуто ${v1Unmatched.length}`);

  // 4. Overrides (ручной слой)
  let overrides = {};
  try { overrides = JSON.parse(await readFile(path.join(PATHS.outDir, 'ru-overrides.json'), 'utf8')).names ?? {}; }
  catch { /* первого прогона может не быть */ }

  // 5. Русские имена
  const ruStats = { override: 0, seed: 0, pattern: 0, candidate: 0, translit: 0, none: 0, review: 0 };
  const outPersons = [];
  for (const rec of [...persons.values()].sort((a, b) => cmpRef(a.ref, b.ref) || a.name.localeCompare(b.name))) {
    const id = personId(rec);
    const seed = v1ByTipnrKey.get(rec.key);
    const isAnon = /^Unnamed#\d+$/i.test(rec.name);
    let ru;
    if (overrides[id]) {
      ru = { name: overrides[id], source: 'override', confidence: 1, review: false };
    } else if (isAnon) {
      // структурный безымянный узел TIPNR (Strong G0000, имя "[ ]") — несёт рёбра
      // родословия (напр. Матфан→…→Иаков в Мф 1), но именем не является
      ru = { name: '(без имени)', source: 'structural', confidence: 1, review: false, anonymous: true };
    } else if (seed?.name?.ru) {
      ru = { name: seed.name.ru, source: 'seed', confidence: 1, review: false };
    } else {
      ru = extractRuName(rec.name, synodal.verseWindow(rec.ref, 2)) ?? { name: null, source: 'none', confidence: 0, review: true };
    }
    ruStats[ru.source] = (ruStats[ru.source] ?? 0) + 1;
    if (ru.review) ruStats.review += 1;

    outPersons.push({
      id,
      key: rec.key,
      en: rec.name,
      ru: ru.name ? { name: ru.name, source: ru.source, confidence: ru.confidence, review: ru.review, verseRef: ru.verseRef ?? null, ...(ru.anonymous ? { anonymous: true } : {}) } : null,
      gender: rec.type === 'Male' ? 'm' : 'f',
      firstRef: { osis: rec.ref, ru: refToRu(rec.ref) },
      tribe: rec.tribe,
      description: rec.description || null,
      uncertainIdentity: rec.uncertainIdentity || undefined,
      // имя в оригинале (иврит/греческий) из TIPNR «– Named/Greek» — слой сверки
      // с первоисточником и тултипов «имя в оригинале»
      names: rec.nameForms?.length ? rec.nameForms : undefined,
      // теофорные элементы в ивритском написании (Яхве/Эл) — авторазметка по скелету
      theophoric: analyzeTheophoric(rec.nameForms),
      skeleton: seed ? {
        v1Id: seed.id,
        sourceRef: seed.ref ?? null,
        sourceGender: seed.gender ?? null,
        lineage: seed.lineage,
        era: seed.era,
        role: seed.role,
        significance: seed.significance ?? null,
        chronology: seed.chronology ?? null,
        disputed: seed.disputed ?? null,
        he: seed.name?.he ?? null,
      } : undefined,
    });
  }

  // 6. Рёбра
  const keyToId = new Map([...persons.values()].map(r => [r.key, personId(r)]));
  const edges = [];
  const spouseSeen = new Set();
  for (const rec of persons.values()) {
    const childId = keyToId.get(rec.key);
    for (const rel of rec.parents) {
      if (!rel.resolved) continue;
      const parentRec = persons.get(rel.refKey);
      edges.push({
        kind: rel.markers.ancestor ? 'ancestor' : 'parent',
        from: keyToId.get(rel.refKey),
        to: childId,
        role: parentRec.type === 'Male' ? 'father' : 'mother',
        uncertain: rel.markers.uncertain || undefined,
      });
    }
    for (const rel of rec.partners) {
      if (!rel.resolved) continue;
      const a = keyToId.get(rec.key), b = keyToId.get(rel.refKey);
      const pairKey = [a, b].sort().join('~');
      if (spouseSeen.has(pairKey)) continue;
      spouseSeen.add(pairKey);
      edges.push({ kind: 'spouse', from: a, to: b, uncertain: rel.markers.uncertain || undefined });
    }
  }
  log(`edges: ${edges.length} (parent/ancestor/spouse)`);

  // 6.1. Аннотации рёбер (редакционный слой поверх TIPNR — напр. юридическое
  // отцовство Иосифа по Мф 1; файл создаётся с дефолтом при первом прогоне)
  const annPath = path.join(PATHS.outDir, 'edge-annotations.json');
  let annotations;
  try { annotations = JSON.parse(await readFile(annPath, 'utf8')); }
  catch {
    annotations = {
      _readme: 'Редакционные пометки рёбер поверх TIPNR: match по from+to(+kind), set — присваиваемые поля.',
      annotations: [
        {
          from: 'joseph--mat-1-16', to: 'jesus--isa-7-14', kind: 'parent',
          set: {
            legal: true,
            biology: 'legal',
            assertion: 'explicit-textual',
            confidence: 'certain',
            directScripture: true,
            editorialPosition: 'text',
            refs: ['Мф 1:16', 'Лк 3:23'],
          },
          note: 'Иосиф назван мужем Марии и считается отцом Иисуса по закону/общественному восприятию; биологическое отцовство ему не приписывается.',
        },
        {
          from: 'heli--luk-3-23', to: 'mary--mat-1-16', kind: 'parent',
          set: {
            biology: 'unknown',
            assertion: 'editorial-harmonization',
            confidence: 'disputed',
            directScripture: false,
            editorialPosition: 'preferred',
            refs: ['Лк 3:23', 'Мф 1:16'],
          },
          note: 'Илий как отец Марии — предпочитаемая гармонизация проекта. Лк 3:23 прямо этого не утверждает.',
        },
      ],
    };
    await mkdir(PATHS.outDir, { recursive: true });
    await writeFile(annPath, JSON.stringify(annotations, null, 2) + '\n');
  }
  let annotated = 0;
  for (const a of annotations.annotations ?? []) {
    for (const e of edges) {
      if (e.from === a.from && e.to === a.to && (!a.kind || e.kind === a.kind)) {
        Object.assign(e, a.set);
        annotated += 1;
      }
    }
  }
  log(`annotations: применено ${annotated}`);

  // 6.2. Зеркальная проверка offspring↔parents (информационная)
  const parentPairs = new Set(edges.filter(e => e.kind === 'parent' || e.kind === 'ancestor').map(e => `${e.from}→${e.to}`));
  const mirrorMisses = [];
  for (const rec of persons.values()) {
    const pid = keyToId.get(rec.key);
    for (const rel of rec.offspring) {
      if (!rel.resolved) continue;
      const cid = keyToId.get(rel.refKey);
      if (!parentPairs.has(`${pid}→${cid}`)) mirrorMisses.push(`${rec.key} → ${rel.refKey}`);
    }
  }

  // 6.3. Кластеры генеалогии + слой народов
  const clusters = computeClusters(outPersons, edges);
  const byKeyOut = new Map(outPersons.map(p => [p.key, p]));
  const nations = nationsLayer(groups, byKeyOut);
  log(`clusters: ${clusters.map(c => `${c.id}:${c.count}`).join(', ')}`);
  log(`nations: ${nations.length} (с прародителем: ${nations.filter(n => n.progenitorId).length})`);

  // 6.4. Золотой хребет (Адам→Христос) — L0-якоря + валидатор связности
  const spine = traceSpine(outPersons, edges);
  log(`spine: Христос→Адам ${spine.reachedRoot ? 'СВЯЗАН' : 'РАЗОРВАН'}, длина ${spine.length}` +
      (spine.missingAnchors.length ? `, нет якорей: ${spine.missingAnchors.join(',')}` : ''));

  const theoCount = outPersons.filter(p => p.theophoric).length;
  const namesCount = outPersons.filter(p => p.names?.length).length;
  log(`иврит-слой: оригиналы у ${namesCount}/${outPersons.length}, теофорных (авто, review) ${theoCount}`);

  // 6.5. L0 build-time layout + статический SVG-превью (санитарная проверка + seed §8)
  const erasV1 = v1.eras ?? [];
  const layoutL0 = buildLayoutL0(outPersons, clusters, erasV1);
  // временная шкала (курируемая, консервативная МТ/Ашшер) — для датировок на обзоре
  const chrono = JSON.parse(await readFile(path.join(PATHS.outDir, 'chronology.json'), 'utf8'));
  const l0Svg = renderL0Svg(layoutL0, { chrono });
  // фокус-вариант: мессианская линия Давида ярко, остальное приглушено (демо цели §3)
  const spineIds = new Set(layoutL0.nodes.filter(n => n.kind === 'spine').map(n => n.id));
  const l0FocusSvg = renderL0Svg(layoutL0, { focus: { label: 'Фокус: линия Давида', brightIds: spineIds }, chrono });
  const l0DarkSvg = renderL0Svg(layoutL0, { theme: 'dark', chrono });   // обе темы (interface-spec требование)
  // L1: развёртка «12 колен» (демо семантического зума — раскрытие сжатой группы)
  const tribes12 = buildTribes12(outPersons);
  const l1TribesSvg = renderTribes12Svg(tribes12);
  const l1TribesDarkSvg = renderTribes12Svg(tribes12, { theme: 'dark' });
  log(`layout-l1: «12 колен» — центр Иаков + ${tribes12.sons.length} сыновей радиально`);
  const mtLk = buildMatthewLuke();
  const l1MtLkSvg = renderMatthewLukeSvg(mtLk);
  const l1MtLkDarkSvg = renderMatthewLukeSvg(mtLk, { theme: 'dark' });
  log(`layout-l1: «Матфей/Лука» — колоночная развёртка (${mtLk.nodes.length} узлов)`);
  // L1: архетип 3 «Народы от Ноя» (Таблица народов, Быт 10) — отступный список-дерево
  const tonData = JSON.parse(await readFile(path.join(PATHS.outDir, 'table-of-nations.json'), 'utf8'));
  const nationsTree = buildNationsTree(tonData);
  const l1NationsSvg = renderNationsSvg(nationsTree);
  const l1NationsDarkSvg = renderNationsSvg(nationsTree, { theme: 'dark' });
  // Гео-подложка: стилизованная карта расселения (Иафет/Хам/Сим по направлениям)
  const mapNationsSvg = renderNationsMapSvg();
  const mapNationsDarkSvg = renderNationsMapSvg({ theme: 'dark' });
  log(`map: карта расселения народов (стилизованная), обе темы`);
  // L2 «лица»: личная карточка Давида — отец/сыновья из данных, стих из Синодального
  const byKeyL2 = new Map(outPersons.map(p => [p.key, p]));
  const dvd = byKeyL2.get('David@Rut.4.17');
  const l2Data = {
    person: { ru: dvd?.ru?.name ?? 'Давид', sub: 'Царь Израиля · завет о вечном престоле (2Цар 7)',
      icon: 'crown', refRu: dvd?.firstRef?.ru ?? 'Руф 4:17', tribeRu: 'колено Иудино',
      // иврит — из TIPNR (persons.names), этимология — из name-etymology.json
      heb: dvd?.names?.find(n => n.lang === 'H')?.original ?? 'דָּוִד',
      hebTranslit: 'Дави́д (Dāwīḏ)', hebMeaning: 'возлюбленный',
      hebNote: 'корень דוד (дод) — «любить; любимый»' },
    father: { ru: byKeyL2.get('Jesse@Rut.4.17')?.ru?.name ?? 'Иессей', refRu: 'Руф 4:17' },
    sons: [
      { ru: byKeyL2.get('Solomon@2Sa.5.14')?.ru?.name ?? 'Соломон', refRu: '2Цар 5:14',
        line: 'matthew', lineRu: 'Матфей · царская линия', icon: 'temple' },
      { ru: byKeyL2.get('Nathan@2Sa.5.14')?.ru?.name ?? 'Нафан', refRu: '2Цар 5:14',
        line: 'luke', lineRu: 'Лука · ветвь через Нафана', icon: 'scroll' },
    ],
    // Источник-JSON Синодального опускает Руф 4:17 (в главе 21 стих вместо 22),
    // хвост сдвинут на −1 от канонической нумерации. Ищем стих с Давидом в широком
    // окне и восстанавливаем каноническую ссылку (json v≥17 → канонич. v+1).
    verse: (() => {
      const win = synodal.verseWindow('Rut.4.17', 5);
      const hit = win.find(v => /Давид/.test(v.text ?? ''));
      if (!hit) return { text: synodal.verse('Rut.4.17') ?? '', refRu: refToRu('Rut.4.17') };
      const p = parseRef(hit.ref);
      const canonical = p && p.osis === 'Rut' && p.chapter === 4 && p.verse >= 17
        ? `Rut.4.${p.verse + 1}` : hit.ref;
      return { text: hit.text, refRu: refToRu(canonical) };
    })(),
    chips: [
      { label: 'Эпоха V · Царства', kind: 'era' },
      { label: 'Мессианская линия', kind: 'messianic' },
      { label: 'Хребет Спасителя', kind: 'spine' },
    ],
    related: [
      { label: 'Дом Давида', hint: '+173 имён' },
      { label: 'Родословие Матфея', hint: 'Мф 1:6' },
      { label: 'Родословие Луки', hint: 'Лк 3:31' },
    ],
  };
  const l2PersonSvg = renderPersonL2Svg(l2Data);
  const l2PersonDarkSvg = renderPersonL2Svg(l2Data, { theme: 'dark' });
  log(`l2: личная карточка «${l2Data.person.ru}» (стих ${l2Data.verse.refRu}), обе темы`);
  // Пре-виз FLIP-морфа «сжатая группа → 12 колен» — визуальное ТЗ аниматору Phase 2
  const morphSvg = renderMorphFramesSvg();
  const morphDarkSvg = renderMorphFramesSvg({ theme: 'dark' });
  log(`morph: три кадра FLIP-раскрытия (L0 → переход → L1), обе темы`);
  // Шкала времени: линейка AM (МТ/Ашшер) + сравнительная дорожка LXX
  const timelineSvg = renderTimelineSvg(chrono);
  const timelineDarkSvg = renderTimelineSvg(chrono, { theme: 'dark' });
  log(`timeline: шкала AM 0–4040 (МТ) + сравнение LXX, обе темы`);
  log(`layout-l1: «Народы от Ноя» — 3 ветви, ${nationsTree.columns.reduce((s, c) => s + c.rows.length, 0)} народов (Таблица народов)`);
  // Быстрые виды + поисковый индекс (данные, на которые опирается панель интерфейса)
  const views = buildViews({ clusters, persons: outPersons, nationsCount: 70 });
  const searchIndex = buildSearchIndex({ persons: outPersons, nationsTree: tonData });
  log(`views: ${views.length} быстрых видов; search-index: персон ${searchIndex.persons.length}, народов ${searchIndex.nations.length}`);
  // Камертон интерфейса: оболочка приложения (карта + панель-навигатор + миникарта)
  const appShellSvg = renderAppShell(layoutL0, { views, personsCount: outPersons.length });
  const appShellDarkSvg = renderAppShell(layoutL0, { theme: 'dark', views, personsCount: outPersons.length });
  log(`app-shell: прототип интерфейса (карта + навигатор + миникарта), обе темы`);
  log(`layout-l0: узлов ${layoutL0.nodes.length} (хребет ${layoutL0.nodes.filter(n => n.kind === 'spine').length} + мега ${layoutL0.nodes.filter(n => n.kind === 'mega').length}), bbox ${Math.round(layoutL0.bbox.w)}×${Math.round(layoutL0.bbox.h)}`);

  // 7. Валидация
  const report = validate(outPersons, edges, { parseStats, relStats, ruStats, v1Unmatched, v1Soft, v1Decisions, v1Collisions, v1Total: v1.persons.length, v1Matched: v1Matches.size, mirrorMisses, clusters, nations, spine });

  // 8. Emit
  await mkdir(PATHS.outDir, { recursive: true });
  const meta = {
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    counts: report.counts,
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { url: s.url, sha256: s.sha256, license: s.license }])),
    attribution: [SOURCES.tipnr.attribution, SOURCES.synodal.attribution,
      'Хронология (MT AM), спорные узлы, значимость: редакция проекта (v1-скелет)'],
    license: 'Derived dataset: CC BY 4.0 (attribution: STEPBible.org / Tyndale House Cambridge)',
    status: 'phase1-draft — НЕ подключать в рантайм до exit-критериев Phase 1',
    // Machine-readable publication evidence. VALIDATION.md is a human report,
    // never the authority for runtime/publication decisions.
    publicationEvidence: {
      skeleton: {
        total: v1.persons.length,
        matched: v1Matches.size,
        decisions: v1Decisions,
        soft: v1Soft,
        unmatched: v1Unmatched,
        collisions: v1Collisions,
      },
      relations: {
        unresolvedCount: relStats.unresolvedRefs.length,
        unresolved: relStats.unresolvedRefs,
      },
      ruReviewQueue: ruStats.review,
    },
  };
  await writeFile(path.join(PATHS.outDir, 'persons.json'), JSON.stringify(outPersons, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'edges.json'), JSON.stringify(edges, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'groups.json'), JSON.stringify({
    _status: 'phase1-draft: членство кластеров — воспроизводимые эвристики (rule хранится рядом), сверка редактором обязательна',
    clusters,
    nations,
  }, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'spine.json'), JSON.stringify({
    _status: 'phase1-draft: интерпретационная мессианская проекция (Христос→Адам), L0-persistent якоря',
    model: spine.model,
    reachedRoot: spine.reachedRoot,
    length: spine.length,
    missingAnchors: spine.missingAnchors,
    chain: spine.chain,
  }, null, 1) + '\n');
  await mkdir(path.join(PATHS.outDir, 'build'), { recursive: true });
  await writeFile(path.join(PATHS.outDir, 'build', 'layout-l0.json'), JSON.stringify(layoutL0, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l0-preview.svg'), l0Svg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l0-focus-david.svg'), l0FocusSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l0-dark.svg'), l0DarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'layout-l1-tribes-12.json'), JSON.stringify(tribes12, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-tribes-12.svg'), l1TribesSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-tribes-12-dark.svg'), l1TribesDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'layout-l1-matthew-luke.json'), JSON.stringify(mtLk, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-matthew-luke.svg'), l1MtLkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-matthew-luke-dark.svg'), l1MtLkDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'layout-l1-nations.json'), JSON.stringify(nationsTree, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-nations.svg'), l1NationsSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l1-nations-dark.svg'), l1NationsDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-map-nations.svg'), mapNationsSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-map-nations-dark.svg'), mapNationsDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l2-person-david.svg'), l2PersonSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-l2-person-david-dark.svg'), l2PersonDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-morph-frames.svg'), morphSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-morph-frames-dark.svg'), morphDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-timeline.svg'), timelineSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-timeline-dark.svg'), timelineDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-app-shell.svg'), appShellSvg);
  await writeFile(path.join(PATHS.outDir, 'build', 'genealogy-app-shell-dark.svg'), appShellDarkSvg);
  await writeFile(path.join(PATHS.outDir, 'views.json'), JSON.stringify({
    _status: 'phase1: быстрые виды панели-навигатора; счётчики из данных пайплайна',
    views,
  }, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'search-index.json'), JSON.stringify(searchIndex) + '\n');
  await writeFile(path.join(PATHS.outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  try { await access(path.join(PATHS.outDir, 'ru-overrides.json')); }
  catch {
    await writeFile(path.join(PATHS.outDir, 'ru-overrides.json'),
      JSON.stringify({ _readme: 'Ручные русские имена: { names: { "<person id>": "Имя" } } — побеждают seed/авто.', names: {} }, null, 2) + '\n');
  }
  await writeFile(path.join(PATHS.outDir, 'VALIDATION.md'), report.markdown);
  log(`emit: data/genealogy/v2/ — persons ${outPersons.length}, edges ${edges.length}`);

  if (!report.ok) {
    console.error('[genealogy-build] ЖЁСТКИЕ ИНВАРИАНТЫ НАРУШЕНЫ — см. VALIDATION.md');
    process.exitCode = 1;
  }
}

function cmpRef(a, b) {
  const [ba, ca, va] = refSortKey(a), [bb, cb, vb] = refSortKey(b);
  return ba - bb || ca - cb || va - vb;
}
function refSortKey(ref) {
  const p = parseRef(ref);
  const order = ['Gen','Exo','Lev','Num','Deu','Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est','Job','Psa','Pro','Ecc','Sng','Isa','Jer','Lam','Ezk','Dan','Hos','Jol','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal','Mat','Mrk','Luk','Jhn','Act','Rom','1Co','2Co','Gal','Eph','Php','Col','1Th','2Th','1Ti','2Ti','Tit','Phm','Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev'];
  return [order.indexOf(p.osis), p.chapter, p.verse];
}

// ─────────────────────────── валидаторы ───────────────────────────

function validate(personsArr, edges, ctx) {
  const ids = new Set();
  const dup = [];
  for (const p of personsArr) { if (ids.has(p.id)) dup.push(p.id); else ids.add(p.id); }

  const dangling = edges.filter(e => !ids.has(e.from) || !ids.has(e.to));

  // Циклы только по parent-рёбрам (ancestor — тоже направленная «предковость», включаем)
  const up = new Map();
  for (const e of edges) {
    if (e.kind !== 'parent' && e.kind !== 'ancestor') continue;
    if (!up.has(e.to)) up.set(e.to, []);
    up.get(e.to).push(e.from);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const cycles = [];
  for (const start of ids) {
    if (color.get(start)) continue;
    const stack = [[start, 0]];
    color.set(start, GRAY);
    const path = [start];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const nexts = up.get(top[0]) ?? [];
      if (top[1] < nexts.length) {
        const nxt = nexts[top[1]++];
        if (color.get(nxt) === GRAY) { cycles.push([...path, nxt]); continue; }
        if (!color.get(nxt)) { color.set(nxt, GRAY); stack.push([nxt, 0]); path.push(nxt); }
      } else {
        color.set(top[0], BLACK); stack.pop(); path.pop();
      }
    }
  }

  const degree = new Map();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const isolated = personsArr.filter(p => !degree.has(p.id)).length;

  const ru = ctx.ruStats;
  const ruNamed = personsArr.filter(p => p.ru?.name).length;
  const counts = {
    persons: personsArr.length,
    edges: edges.length,
    parentEdges: edges.filter(e => e.kind === 'parent').length,
    ancestorEdges: edges.filter(e => e.kind === 'ancestor').length,
    spouseEdges: edges.filter(e => e.kind === 'spouse').length,
    isolatedPersons: isolated,
    ruNamed,
    ruCoveragePct: Number((100 * ruNamed / personsArr.length).toFixed(1)),
    skeletonMerged: ctx.v1Matched,
    clusters: (ctx.clusters ?? []).length,
    nations: (ctx.nations ?? []).length,
    mirrorMisses: (ctx.mirrorMisses ?? []).length,
  };

  const ok =
    cycles.length <= HARD_INVARIANTS.maxParentGraphCycles &&
    dup.length <= HARD_INVARIANTS.maxDuplicatePersonIds &&
    dangling.length <= HARD_INVARIANTS.maxDanglingEdgeRefs;

  const md = `# VALIDATION — data/genealogy/v2 (генерируется build.mjs)

Пайплайн: ${PIPELINE_VERSION} · ${new Date().toISOString()}

## Жёсткие инварианты — ${ok ? '✅ OK' : '❌ НАРУШЕНЫ'}

| Инвариант | Значение | Лимит |
|---|---:|---:|
| Дубликаты id | ${dup.length} | ${HARD_INVARIANTS.maxDuplicatePersonIds} |
| Битые ссылки рёбер | ${dangling.length} | ${HARD_INVARIANTS.maxDanglingEdgeRefs} |
| Циклы родительского графа | ${cycles.length} | ${HARD_INVARIANTS.maxParentGraphCycles} |
${cycles.length ? '\nЦиклы:\n' + cycles.slice(0, 5).map(c => '- ' + c.join(' → ')).join('\n') + '\n' : ''}
## Счётчики

| Метрика | Значение |
|---|---:|
| Персон | ${counts.persons} |
| Рёбер всего | ${counts.edges} |
| — parent | ${counts.parentEdges} |
| — ancestor (a) | ${counts.ancestorEdges} |
| — spouse | ${counts.spouseEdges} |
| Изолированных персон (без рёбер) | ${counts.isolatedPersons} |
| Русское имя есть | ${counts.ruNamed} (${counts.ruCoveragePct}%) |
| Слито из v1-скелета | ${counts.skeletonMerged} / ${ctx.v1Total} |

## Русские имена по источникам

| source | персон |
|---|---:|
| override (курировано) | ${ru.override} |
| seed (v1-скелет) | ${ru.seed} |
| structural (безымянные узлы) | ${ru.structural ?? 0} |
| pattern (стих) | ${ru.pattern} |
| candidate (стих+транслит) | ${ru.candidate} |
| translit (fallback) | ${ru.translit} |
| none | ${ru.none} |
| **review-очередь** | **${ru.review}** |

## TIPNR-парсер

- Топ-строк: ${ctx.parseStats.topLines}; персон (M/F): ${ctx.parseStats.personRecords}; битых топ-строк: ${ctx.parseStats.badTopLines}
- Типы: ${JSON.stringify(ctx.parseStats.byType)}
- Дубликаты ключей: ${ctx.parseStats.duplicates.length}${ctx.parseStats.duplicates.length ? ' — ' + ctx.parseStats.duplicates.slice(0, 5).join(', ') : ''}
- Связей резолвнуто: ${ctx.relStats.resolved}; нерезолв: ${ctx.relStats.unresolvedRefs.length}; (d)-народы пропущены: ${ctx.relStats.skippedDescendedGroup}

### Нерезолвнутые ссылки (первые 20 — вход для Phase 1 доводки)
${ctx.relStats.unresolvedRefs.slice(0, 20).map(u => `- ${u.from} · ${u.field}: \`${u.raw}\``).join('\n') || '- нет'}

## Мессианский хребет — интерпретационная проекция (Христос→Адам) — ${ctx.spine?.reachedRoot ? '✅ СВЯЗАН' : '❌ РАЗОРВАН'}

Длина цепи: ${ctx.spine?.length ?? '—'} узлов.${(ctx.spine?.missingAnchors?.length) ? ` Отсутствуют якоря: ${ctx.spine.missingAnchors.join(', ')}` : ' Все контрольные якоря на месте.'}

${(ctx.spine?.chain ?? []).map(c => c.ru ?? c.key).join(' → ')}

## Кластеры генеалогии (${(ctx.clusters ?? []).length}) и народы (${(ctx.nations ?? []).length})

${(ctx.clusters ?? []).map(c => `- **${c.titleRu}** (${c.id}): ${c.count} · правило: \`${JSON.stringify(c.rule)}\``).join('\n') || '- нет'}

Народов из TIPNR Group-записей: ${(ctx.nations ?? []).length}, из них с известным
прародителем-персоной: ${(ctx.nations ?? []).filter(n => n.progenitorId).length}.

## Зеркальность offspring↔parents (информационно): ${(ctx.mirrorMisses ?? []).length} расхождений
${(ctx.mirrorMisses ?? []).slice(0, 12).map(m => `- ${m}`).join('\n') || '- нет'}

## v1-скелет: немэпнутые (${ctx.v1Unmatched.length})
${ctx.v1Unmatched.slice(0, 30).map(u => `- ${u.id} (${u.ru ?? '?'}; ${u.ref ?? '—'}; кандидатов ${u.candidates})`).join('\n') || '- нет'}

## v1-скелет: методы принятых mappings

${Object.entries((ctx.v1Decisions ?? []).reduce((acc, item) => {
  acc[item.method] = (acc[item.method] ?? 0) + 1;
  return acc;
}, {})).map(([method, count]) => `- ${method}: ${count}`).join('\n') || '- нет'}

## v1-скелет: коллизии мэппинга (два v1-id → один TIPNR-ключ) — ${(ctx.v1Collisions ?? []).length}
${(ctx.v1Collisions ?? []).map(c => `- \`${c.key}\` ← [${c.ids.join(', ')}]`).join('\n') || '- нет'}

## v1-скелет: эвристические сопоставления — сверить редактору (${(ctx.v1Soft ?? []).length})
${(ctx.v1Soft ?? []).slice(0, 60).map(s => `- ${s.id} ← ${s.via}`).join('\n') || '- нет'}

> Статус: **phase1-draft**. В рантайм не подключать. Exit-критерии Phase 1 — см. scripts/genealogy-build/README.md.
`;

  return { ok, counts, markdown: md };
}

// ─────────────────────────── самопроверки ───────────────────────────

async function runTests() {
  const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else log('ok:', msg); };

  const u = parseUnifiedRef('Aaron@Exo.4.14-Heb═H0175');
  assert(u.name === 'Aaron' && u.ref === 'Exo.4.14' && u.refKey === 'Aaron@Exo.4.14', 'parseUnifiedRef базовый');
  const ua = parseUnifiedRef('Mahol@1Ki.4.31=H4235');
  assert(ua.ref === '1Ki.4.31', 'parseUnifiedRef ASCII-strong');
  const um = parseUnifiedRef('Zerah@Gen.38.30-Mat(a)');
  assert(um.markers.ancestor === true && um.ref === 'Gen.38.30', 'маркер (a)');
  const uq = parseUnifiedRef('Ham|Ammon@Deu.2.19-Zep(?)');
  assert(uq.markers.uncertain === true && uq.name === 'Ham|Ammon', 'маркер (?) и альтернативы');

  const rels = parseRelField('Amram@Exo.6.18-1Ch + Jochebed@Exo.6.20-Num', { plusSeparated: true });
  assert(rels.length === 2 && rels[0].name === 'Amram' && rels[1].name === 'Jochebed', 'parents через +');

  assert(translitEnRu('Abraham').toLowerCase().startsWith('авраа'), 'translit Abraham≈Авраам');
  assert(similarity('Фалек', 'Фалек') === 1, 'similarity идентичных');

  const fakeVerses = [{ ref: 'Gen.10.25', offset: 0, text: 'У Евера родились два сына; имя одному: Фалек, потому что во дни его земля разделена; имя брата его: Иоктан.' }];
  const ru = extractRuName('Peleg', fakeVerses);
  assert(ru?.name === 'Фалек' && ru.source === 'pattern', `extractRuName Peleg→Фалек (получили ${JSON.stringify(ru)})`);

  assert(normalizeRuCandidate('Elnathan', 'Елнафана') === 'Елнафан', 'нормализация вин. падежа (Елнафана→Елнафан)');
  assert(normalizeRuCandidate('Melchi', 'Мелхиев') === 'Мелхий', 'нормализация притяжательного (Мелхиев→Мелхий)');
  assert(normalizeRuCandidate('Mattathias', 'Маттафиев') === 'Маттафия', 'нормализация -ias (Маттафиев→Маттафия)');
  assert(normalizeRuCandidate('Judah', 'Иуда') === 'Иуда', 'именительный не трогаем (Иуда)');
  assert(normalizeRuCandidate('Reuben', 'Рувим') === 'Рувим', 'без ложных срабатываний (Рувим)');


  const matcherFixture = new Map([
    ['Jecoliah@2Ki.15.2', { key: 'Jecoliah@2Ki.15.2', name: 'Jecoliah', ref: '2Ki.15.2', type: 'Female' }],
    ['Jehoiachin@2Ki.24.6', { key: 'Jehoiachin@2Ki.24.6', name: 'Jehoiachin', ref: '2Ki.24.6', type: 'Male' }],
  ]);
  const jeconiahMatch = matchSkeleton([
    { id: 'jeconiah', name: { ru: 'Иехония' }, ref: '4Цар 24:8–17; Мф 1:11', gender: 'm' },
  ], matcherFixture);
  assert(jeconiahMatch.matches.get('jeconiah') === 'Jehoiachin@2Ki.24.6',
    'Иехония имеет явное соответствие Jehoiachin и никогда не смешивается с Jecoliah');

  // Regression against the original failure mode WITHOUT using the explicit exception.
  // The probe may resolve to the male/context-compatible Jehoiachin or stay unmatched,
  // but it must never be attracted to female Jecoliah by name similarity.
  const jeconiahProbe = matchSkeleton([
    { id: 'jeconiah_probe', name: { ru: 'Иехония' }, ref: '4Цар 24:8', gender: 'm' },
  ], matcherFixture);
  assert(jeconiahProbe.matches.get('jeconiah_probe') !== 'Jecoliah@2Ki.15.2',
    'gender/context guard запрещает fuzzy Jeconiah → Jecoliah');

  const missingExceptionTarget = matchSkeleton([
    { id: 'jesus', name: { ru: 'Иисус Христос' }, ref: 'Мф 1:16', gender: 'm' },
  ], new Map());
  assert(!missingExceptionTarget.matches.has('jesus') &&
    missingExceptionTarget.unmatched.some(item => item.id === 'jesus' && item.candidates === 'explicit-target-missing'),
    'explicit exception не засчитывается, если target отсутствует в TIPNR');

  const wrongGenderException = matchSkeleton([
    { id: 'jesus', name: { ru: 'Иисус Христос' }, ref: 'Мф 1:16', gender: 'm' },
  ], new Map([
    ['Jesus@Isa.7.14', { key: 'Jesus@Isa.7.14', name: 'Jesus', ref: 'Isa.7.14', type: 'Female' }],
  ]));
  assert(!wrongGenderException.matches.has('jesus') &&
    wrongGenderException.unmatched.some(item => item.id === 'jesus' && item.candidates === 'explicit-gender-mismatch'),
    'explicit exception fail-closed при несовместимом gender');

  const ambiguousFixture = new Map([
    ['Naham@1Ch.4.19', { key: 'Naham@1Ch.4.19', name: 'Naham', ref: '1Ch.4.19', type: 'Male' }],
    ['Nahar@1Ch.4.20', { key: 'Nahar@1Ch.4.20', name: 'Nahar', ref: '1Ch.4.20', type: 'Male' }],
  ]);
  const ambiguous = matchSkeleton([
    { id: 'nahaz', name: { ru: 'Нааз' }, ref: null, gender: 'm' },
  ], ambiguousFixture);
  assert(!ambiguous.matches.has('nahaz') &&
    ambiguous.unmatched.some(item => item.id === 'nahaz'),
    'неуверенный fuzzy без контекста остаётся unmatched');

  const spineFixture = traceSpine([
    { id: 'jesus--isa-7-14', key: 'Jesus@Isa.7.14', ru: { name: 'Иисус Христос' } },
    { id: 'mary--mat-1-16', key: 'Mary@Mat.1.16', ru: { name: 'Мария' } },
    { id: 'heli--luk-3-23', key: 'Heli@Luk.3.23', ru: { name: 'Илий' } },
    { id: 'adam--gen-2-19', key: 'Adam@Gen.2.19', ru: { name: 'Адам' } },
  ], [
    { kind: 'parent', role: 'mother', from: 'mary--mat-1-16', to: 'jesus--isa-7-14' },
    { kind: 'parent', role: 'father', from: 'heli--luk-3-23', to: 'mary--mat-1-16' },
    { kind: 'parent', role: 'father', from: 'adam--gen-2-19', to: 'heli--luk-3-23' },
  ]);
  assert(spineFixture.reachedRoot === true, 'spine fixture достигает Адама');
  assert(spineFixture.model?.assertion === 'editorial-harmonization' && spineFixture.model?.directScripture === false,
    'spine provenance явно отделяет гармонизацию от текста Писания');

  const mini = [
    '$==========PERSON(s)',
    'UnifiedName=uStrong\tDescription\tParents\tSiblings\tPartners\tOffspring\tTribe\t#Summary\tType',
    'Seth@Gen.4.25-1Ch═H8352\tson of Adam\tAdam@Gen.2.19-Jud + Eve@Gen.3.20\t–\t–\tEnosh@Gen.4.26-Luk\tof Adam\t#…\tMale',
    ' – Named\tSeth\tH8352\tСиф\t…\tGen.4.25',
    'Adam@Gen.2.19-Jud═H0121\tfirst man\t–\t–\tEve@Gen.3.20\tSeth@Gen.4.25-1Ch\t–\t#…\tMale',
    'Eve@Gen.3.20═H2332\tfirst woman\t–\t–\tAdam@Gen.2.19-Jud\tSeth@Gen.4.25-1Ch\t–\t#…\tFemale',
    'Enosh@Gen.4.26-Luk═H0583\tson of Seth\tSeth@Gen.4.25-1Ch\t–\t–\t–\tof Adam\t#…\tMale',
  ].join('\n');
  const { persons, stats } = parseTipnr(mini);
  assert(stats.personRecords === 4, `mini-парс: 4 персоны (got ${stats.personRecords})`);
  const rs = resolveRelations(persons);
  assert(persons.get('Seth@Gen.4.25').parents.every(p => p.resolved), 'mini-резолв родителей Сифа');
  assert(rs.unresolvedRefs.length === 0, 'mini-резолв без потерь');

  log('tests done');
}

// ─────────────────────────── CLI ───────────────────────────

const cmd = process.argv[2] ?? 'all';
try {
  if (cmd === 'fetch') await fetchSources();
  else if (cmd === 'test') await runTests();
  else if (cmd === 'all') await runAll();
  else if (cmd === 'validate') {
    const personsArr = JSON.parse(await readFile(path.join(PATHS.outDir, 'persons.json'), 'utf8'));
    const edges = JSON.parse(await readFile(path.join(PATHS.outDir, 'edges.json'), 'utf8'));
    const report = validate(personsArr, edges, {
      parseStats: { topLines: '-', personRecords: personsArr.length, badTopLines: '-', byType: {}, duplicates: [] },
      relStats: { resolved: '-', unresolvedRefs: [], skippedDescendedGroup: '-' },
      ruStats: { override: '-', seed: '-', pattern: '-', candidate: '-', translit: '-', none: '-', review: '-' },
      v1Unmatched: [], v1Soft: [], v1Decisions: [], v1Collisions: [], v1Total: '-', v1Matched: '-',
    });
    await writeFile(path.join(PATHS.outDir, 'VALIDATION.md'), report.markdown);
    log(report.ok ? 'validate: OK' : 'validate: НАРУШЕНИЯ'); if (!report.ok) process.exitCode = 1;
  }
  else { console.error(`Неизвестная команда: ${cmd} (fetch|test|all|validate)`); process.exitCode = 2; }
} catch (err) {
  console.error('[genealogy-build] ОШИБКА:', err.message);
  process.exitCode = 1;
}
