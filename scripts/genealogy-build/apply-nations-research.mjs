#!/usr/bin/env node
// Влить верифицированную (веб + консерв. библеистика/ассириология) разметку народов
// в table-of-nations.json: confidence, spravka, sources, mythWatch; ident ← identRu.
// Структура дерева (кто чей сын) НЕ трогается — она из Быт 10 и достоверна.
import { readFile, writeFile } from 'node:fs/promises';
const RES = '/home/user/gb-is-my-strength/data/genealogy/v2/research/nations';
const OUT = '/home/user/gb-is-my-strength/data/genealogy/v2/table-of-nations.json';

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = (en, ref) => norm(en) + '|' + norm(ref);

const map = new Map();
for (const f of ['japheth.json', 'ham.json', 'shem.json']) {
  const arr = JSON.parse(await readFile(`${RES}/${f}`, 'utf8'));
  for (const e of arr) map.set(key(e.en, e.ref), e);
}
console.log('research entries:', map.size);

const doc = JSON.parse(await readFile(OUT, 'utf8'));
let hit = 0; const miss = [];
(function walk(list) {
  for (const n of list ?? []) {
    if (n.en && n.ref) {
      const r = map.get(key(n.en, n.ref));
      if (r) {
        n.confidence = r.confidence;
        n.spravka = r.spravkaRu;
        n.sources = r.sources;
        n.mythWatch = r.mythWatch ?? null;
        if (r.identRu) n.ident = r.identRu;          // верифицированное отождествление
        map.delete(key(n.en, n.ref));
        hit++;
      } else if (n.kind !== undefined || n.children?.length >= 0) {
        // узел-народ без совпадения (кроме ветвей/корня) — на контроль
        if (!['Japheth', 'Ham', 'Shem'].includes(n.en)) miss.push(`${n.ru} (${n.en}, ${n.ref})`);
      }
    }
    walk(n.children);
  }
})(doc.branches);

doc._meta.status = 'phase2-verified: отождествления перепроверены (веб + ISBE/ABD/ассириология/эпиграфика); confidence + spravka + sources + mythWatch';
doc._meta.confidenceLegend = { certain: 'широкий консенсус', probable: 'хорошо обосновано, не бесспорно', disputed: 'мнения расходятся', obscure: 'данных мало' };
doc._meta.mythWatchNote = 'mythWatch отмечает популярные, но НЕнаучные отождествления, которые не следует распространять (напр. Магог=Россия, Фарсис=Британия, «проклятие Хама» как оправдание расизма, Фалек=раскол континентов).';

await writeFile(OUT, JSON.stringify(doc, null, 1) + '\n');
console.log(`влито в узлы: ${hit}`);
console.log('не сопоставлены (research, лишние ключи):', [...map.keys()]);
console.log('узлы-народы без разметки:', miss.length ? miss : '—');
