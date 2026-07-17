#!/usr/bin/env node
/**
 * apply-etymology-research.mjs — вливание исследовательских батчей этимологий
 * (data/genealogy/v2/research/etymology/*.json) в name-etymology.json.
 *
 * Правила:
 *  - ключ записи = persons.json key (En@Ref); en→key резолвится по persons,
 *    известные расхождения — в KEY_OVERRIDES;
 *  - идемпотентно: существующие key не перезатираются (ядро 70 — курируемый
 *    слой, победа за ним);
 *  - детерминизм: без Date.now()/Math.random(); сортировка стабильная.
 *
 * Pure Node, без зависимостей.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.resolve(HERE, '..', '..', 'data', 'genealogy', 'v2');
const RES = path.join(V2, 'research', 'etymology');

// en в батче → key в persons (когда автоматика не находит)
const KEY_OVERRIDES = {
  Arphaxad: 'Arpachshad@Gen.10.22',
  Jeconiah: 'Jehoiachin@2Ki.24.6',
  Abijah: 'Abijah@1Ki.14.31',
  'Jehoram': 'Jehoram@1Ki.22.50',
  'Uzziah': 'Uzziah@2Ki.15.13',
  Jehoash: 'Joash@2Ki.13.9',        // Иоас, царь Израиля (4Цар 13:9)
  'James son of Alphaeus': 'James@Mat.10.3',
  'Thaddaeus': 'Judas@Mat.10.3',    // Иуда Иаковлев = Фаддей (Лк 6:16)
  'Judas Iscariot': 'Judas@Mat.10.4',
  'Simon the Zealot': 'Simon@Mat.10.4',
  Jonathan: 'Jonathan@1Sa.13.2',    // сын Саула (первый — левит Суд 18:30)
  Nathan: 'Nathan@2Sa.7.2',         // пророк (первый — сын Давида)
  Jeremiah: 'Jeremiah@2Ch.35.25',   // пророк (первый — дед Иоахаза)
  Hilkiah: 'Hilkiah@2Ki.22.4',      // первосвященник при Иосии
  Baruch: 'Baruch@Jer.32.12',       // писец Иеремии (первый — строитель Неем 3:20)
  Daniel: 'Daniel@Ezk.14.14',       // пророк (второй Даниил — Езд 8:2)
  Hananiah: 'Hananiah@Dan.1.6',     // Анания-Седрах (тёзок 15)
  Mishael: 'Mishael@Dan.1.6',       // Мисаил-Мисах (первый — дядя Моисея)
  Azariah: 'Azariah@Dan.1.6',       // Азария-Авденаго (тёзок 19)
  'Mary Magdalene': 'Mary@Mat.27.56',
  Naaman: 'Naaman@2Ki.5.1',          // сириец-прокажённый (первый — сын Вениамина)
  'Ben-Hadad': 'Ben-hadad@1Ki.15.18',
  Jair: 'Jair@Jdg.10.3',             // судья (первый — сын Манассии)
  Tola: 'Tola@Jdg.10.1',             // судья (первый — сын Иссахара)
};

async function main() {
  const main = JSON.parse(await readFile(path.join(V2, 'name-etymology.json'), 'utf8'));
  const persons = JSON.parse(await readFile(path.join(V2, 'persons.json'), 'utf8'));
  const parr = Array.isArray(persons) ? persons : (persons.persons || Object.values(persons));
  const enToKey = new Map();
  for (const p of parr) if (p.en && p.key && !enToKey.has(p.en)) enToKey.set(p.en, p.key);
  const haveKey = new Set(main.entries.map(e => e.key));

  const files = (await readdir(RES)).filter(f => f.endsWith('.json')).sort();
  const byKey = new Map(main.entries.map(e => [e.key, e]));
  let added = 0, skipped = 0, enriched = 0; const noKey = [];
  for (const f of files) {
    const batch = JSON.parse(await readFile(path.join(RES, f), 'utf8'));
    for (const e of batch.entries || []) {
      const key = KEY_OVERRIDES[e.en] || enToKey.get(e.en);
      if (!key) { noKey.push(`${f}: ${e.en}`); continue; }
      if (haveKey.has(key)) {
        // существующую запись не перезатираем (ядро побеждает), но
        // пустые поля дозаполняем из батча — например, отображаемое ru
        const cur = byKey.get(key);
        if (cur && !cur.ru && e.ru) { cur.ru = e.ru; enriched++; }
        skipped++; continue;
      }
      const rec = { key, heb: e.heb ?? null, translit: e.translit ?? null,
        meaningRu: e.meaningRu ?? null, note: e.note ?? null,
        sources: e.sources ?? [], confidence: e.confidence ?? 'probable', elements: [] };
      if (e.ru) rec.ru = e.ru;
      main.entries.push(rec);
      byKey.set(key, rec); haveKey.add(key); added++;
    }
  }
  await writeFile(path.join(V2, 'name-etymology.json'), JSON.stringify(main, null, 1) + '\n');
  console.log(`[apply-etymology] батчей ${files.length} · добавлено ${added} · уже были ${skipped} · дозаполнено ru ${enriched} · всего ${main.entries.length}`);
  if (noKey.length) console.log('  без key (проверить вручную):', noKey.join('; '));
}

main().catch(e => { console.error(e); process.exit(1); });
