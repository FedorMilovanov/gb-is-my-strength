#!/usr/bin/env node
/**
 * build.mjs — оркестратор пайплайна «Библейского атласа родословий» (Phase 1).
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
import { SynodalText, refToRu, parseRef, OSIS_RU } from './lib/refs.mjs';
import { parseTipnr, resolveRelations, parseUnifiedRef, parseRelField } from './lib/tipnr-parser.mjs';
import { extractRuName, translitEnRu, similarity } from './lib/ru-extract.mjs';

const log = (...a) => console.log('[genealogy-build]', ...a);

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

/** Мэппинг v1-id → TIPNR-key: имя + при неоднозначности книга первого упоминания. */
const RU_BOOK_TO_OSIS = Object.fromEntries(Object.entries(OSIS_RU).map(([o, r]) => [r, o]));

const V1_EXCEPTIONS = {
  // v1-id: точный TIPNR-ключ (по отчёту unmatched; решения — по father/children v1
  // против канонического порядка Лк 3:23-31 и текста Быт)
  abram: 'Abraham@Gen.11.26',
  jesus: 'Jesus@Isa.7.14',
  arphaxad: 'Arpachshad@Gen.10.22',
  shelah: 'Shelah@Gen.10.24',        // сын Арфаксада (не Шела сын Иуды Gen.38.5)
  mizraim: 'Egypt@Gen.10.6',         // Мицраим = Egypt в ESV-номенклатуре TIPNR
  joseph_nt: 'Joseph@Mat.1.16',      // Обручник
  joseph_lk: 'Joseph@Luk.3.30',      // отец jonam → Лк 3:30
  joseph_lk2: 'Joseph@Luk.3.24',     // сын Маттафии (Лк 3:24-25)
  simeon_lk: 'Simeon@Luk.3.30',
  levi_lk: 'Levi@Luk.3.29',
  levi_lk2: 'Levi@Luk.3.24',
  melki_lk: 'Melchi@Luk.3.28',       // сын Аддия
  melchi_lk2: 'Melchi@Luk.3.24',
  mattathias_lk: 'Mattathias@Luk.3.26',  // сын Семеина
  mattathias2_lk: 'Mattathias@Luk.3.25', // сын Амоса
  naggesi_lk: 'Naggai@Luk.3.25',
  // joseph_lk3, simeon_lk2 — v1-структурные надстройки без 1:1 в TIPNR/каноне:
  // остаются unmatched намеренно, решение за редактором (см. VALIDATION.md)
};

function slugName(s) {
  return String(s).split('|')[0].toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function matchSkeleton(v1Persons, tipnrPersons) {
  const byName = new Map();
  const all = [...tipnrPersons.values()];
  for (const rec of all) {
    const k = slugName(rec.name);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(rec);
  }

  // выбор из нескольких кандидатов: сначала книга первого упоминания v1,
  // затем близость русского имени v1 к транслиту английского имени кандидата
  const disambiguate = (p, cands) => {
    if (p.ref) {
      const ruBook = String(p.ref).trim().split(/\s+/)[0].replace(/[;,.]$/, '');
      const osis = RU_BOOK_TO_OSIS[ruBook];
      const scoped = osis ? cands.filter(c => c.ref?.startsWith(osis + '.')) : [];
      if (scoped.length === 1) return scoped[0];
      if (scoped.length > 1) cands = scoped;
    }
    if (p.name?.ru) {
      let best = null;
      for (const c of cands) {
        const score = similarity(translitEnRu(c.name), p.name.ru);
        if (!best || score > best.score) best = { c, score };
      }
      if (best && best.score >= 0.55) return best.c;
    }
    return null;
  };

  const matches = new Map();   // v1.id → tipnr key
  const soft = [];             // сопоставлено эвристикой — в отчёт для сверки
  const unmatched = [];
  for (const p of v1Persons) {
    if (V1_EXCEPTIONS[p.id]) { matches.set(p.id, V1_EXCEPTIONS[p.id]); continue; }
    const base = p.id.replace(/_[a-z0-9]{1,6}$/i, ''); // joseph_nt / kenan_gen5 / melki_lk → базовое имя
    let cands = byName.get(slugName(base)) ?? [];
    if (cands.length === 0) {
      // фуззи по всем именам (melki↔Melchi, arphaxad↔Arpachshad, jeconiah↔Jechoniah)
      const target = slugName(base);
      let best = null;
      for (const rec of all) {
        const score = similarity(target, slugName(rec.name));
        if (!best || score > best.score) best = { rec, score };
      }
      if (best && best.score >= 0.74) {
        cands = byName.get(slugName(best.rec.name)) ?? [best.rec];
        soft.push({ id: p.id, via: `fuzzy:${best.rec.name}(${best.score.toFixed(2)})` });
      }
    }
    if (cands.length === 1) { matches.set(p.id, cands[0].key); continue; }
    if (cands.length > 1) {
      const pick = disambiguate(p, cands);
      if (pick) { matches.set(p.id, pick.key); soft.push({ id: p.id, via: `disamb:${pick.key}` }); continue; }
    }
    unmatched.push({ id: p.id, ru: p.name?.ru, ref: p.ref ?? null, candidates: cands.length });
  }
  return { matches, unmatched, soft };
}

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
  const { persons, stats: parseStats } = parseTipnr(tipnrText);
  const relStats = resolveRelations(persons);
  log(`parse: персон ${parseStats.personRecords}, топ-строк ${parseStats.topLines}, ` +
      `типы ${JSON.stringify(parseStats.byType)}, дубликатов ${parseStats.duplicates.length}`);
  log(`resolve: связей ${relStats.resolved}, нерезолв ${relStats.unresolvedRefs.length}, (d)-пропущено ${relStats.skippedDescendedGroup}`);

  // 2. Синодальный текст
  const synRaw = await loadCached('synodal');
  const synodal = new SynodalText(JSON.parse(synRaw.replace(/^﻿/, '')));

  // 3. v1-скелет
  const v1 = JSON.parse(await readFile(PATHS.v1Skeleton, 'utf8'));
  const { matches: v1Matches, unmatched: v1Unmatched, soft: v1Soft } = matchSkeleton(v1.persons, persons);
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
    let ru;
    if (overrides[id]) {
      ru = { name: overrides[id], source: 'override', confidence: 1, review: false };
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
      ru: ru.name ? { name: ru.name, source: ru.source, confidence: ru.confidence, review: ru.review, verseRef: ru.verseRef ?? null } : null,
      gender: rec.type === 'Male' ? 'm' : 'f',
      firstRef: { osis: rec.ref, ru: refToRu(rec.ref) },
      tribe: rec.tribe,
      description: rec.description || null,
      uncertainIdentity: rec.uncertainIdentity || undefined,
      skeleton: seed ? {
        v1Id: seed.id,
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

  // 7. Валидация
  const report = validate(outPersons, edges, { parseStats, relStats, ruStats, v1Unmatched, v1Soft, v1Total: v1.persons.length, v1Matched: v1Matches.size });

  // 8. Emit
  await mkdir(PATHS.outDir, { recursive: true });
  const meta = {
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    counts: report.counts,
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { url: s.url, sha256: s.sha256, license: s.license }])),
    attribution: [SOURCES.tipnr.attribution, SOURCES.synodal.attribution,
      'Хронология (MT AM), спорные узлы, значимость: редакция проекта (v1-скелет, 156 персон)'],
    license: 'Derived dataset: CC BY 4.0 (attribution: STEPBible.org / Tyndale House Cambridge)',
    status: 'phase1-draft — НЕ подключать в рантайм до exit-критериев Phase 1',
  };
  await writeFile(path.join(PATHS.outDir, 'persons.json'), JSON.stringify(outPersons, null, 1) + '\n');
  await writeFile(path.join(PATHS.outDir, 'edges.json'), JSON.stringify(edges, null, 1) + '\n');
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
| override | ${ru.override} |
| seed (v1) | ${ru.seed} |
| pattern | ${ru.pattern} |
| candidate | ${ru.candidate} |
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

## v1-скелет: немэпнутые (${ctx.v1Unmatched.length})
${ctx.v1Unmatched.slice(0, 30).map(u => `- ${u.id} (${u.ru ?? '?'}; ${u.ref ?? '—'}; кандидатов ${u.candidates})`).join('\n') || '- нет'}

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
      v1Unmatched: [], v1Total: '-', v1Matched: '-',
    });
    await writeFile(path.join(PATHS.outDir, 'VALIDATION.md'), report.markdown);
    log(report.ok ? 'validate: OK' : 'validate: НАРУШЕНИЯ'); if (!report.ok) process.exitCode = 1;
  }
  else { console.error(`Неизвестная команда: ${cmd} (fetch|test|all|validate)`); process.exitCode = 2; }
} catch (err) {
  console.error('[genealogy-build] ОШИБКА:', err.message);
  process.exitCode = 1;
}
