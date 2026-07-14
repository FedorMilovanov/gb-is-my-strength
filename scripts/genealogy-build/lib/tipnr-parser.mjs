/**
 * tipnr-parser.mjs — строгий парсер PERSON-секции TIPNR (STEPBible, CC BY 4.0).
 *
 * Формат (см. шапку самого TIPNR-файла):
 * - секции `$==========PERSON(s)` / PLACE(s) / OTHER(s);
 * - топ-строка записи: TAB-поля
 *   [0] UnifiedName═uStrong   → `Aaron@Exo.4.14-Heb═H0175`
 *   [1] Description
 *   [2] Parents  («Отец + Мать», элементы — те же Unified-ссылки)
 *   [3] Siblings [4] Partners [5] Offspring   (через запятую)
 *   [6] Tribe/Nation of father
 *   [7] #Summary (с <ref="…">)
 *   [8] Type (Male / Female / …)
 * - подстроки записи (формы имени) начинаются с пробела/таба — здесь только считаем;
 * - маркеры внутри ссылок: `(a)` предок (не прямой родитель), `(d)` народ-потомок,
 *   `(f)` основатель, `(?)` неоднозначность (решения Tyndale задокументированы).
 */
import { parseRef } from './refs.mjs';

/** `Aaron@Exo.4.14-Heb(?)═H0175` → структурная ссылка. */
export function parseUnifiedRef(raw) {
  const s = String(raw).trim();
  if (!s || s === '–' || s === '-' || s === '—') return null;
  // отрезаем uStrong-хвост (═H0175 / =H0175 / =G2424); '═' — U+2550
  const noStrong = s.split(/═|=(?=[HG]\d)/)[0].trim();
  const markers = {
    ancestor: /\(a\)/.test(noStrong),
    descendedGroup: /\(d\)/.test(noStrong),
    founder: /\(f\)/.test(noStrong),
    uncertain: /\(\?\)/.test(noStrong),
  };
  const clean = noStrong.replace(/\((?:a|d|f|\?)\)/g, '').trim();
  const at = clean.indexOf('@');
  if (at < 0) {
    // ссылка без адреса (редко: описательные «дочь фараона» и т.п.)
    return { raw: s, name: clean, ref: null, refKey: null, markers };
  }
  const name = clean.slice(0, at).trim();
  // после @: `Exo.4.14-Heb` | `Ezr.8.16b` (подстих различает тёзок) | `Exo.4.14`
  const refPart = clean.slice(at + 1).trim();
  const m = /^([1-3]?[A-Za-z]{2,3}\.\d+\.\d+[a-z]?)/.exec(refPart);
  const ref = m ? m[1] : null;
  return {
    raw: s,
    name,
    ref,
    refKey: ref && parseRef(ref) ? `${name}@${ref}` : null,
    markers,
  };
}

/** Поле отношений → массив ссылок. Для Parents разделитель ещё и `+`. */
export function parseRelField(field, { plusSeparated = false } = {}) {
  const s = String(field ?? '').trim();
  if (!s || s === '–' || s === '-' || s === '—') return [];
  const parts = plusSeparated ? s.split(/\s*\+\s*|\s*,\s*/) : s.split(/\s*,\s*/);
  const out = [];
  for (const [i, part] of parts.entries()) {
    const r = parseUnifiedRef(part);
    if (r) out.push({ ...r, position: i });
  }
  return out;
}

const SECTION_RE = /^\$=+\s*(PERSON|PLACE|OTHER)/i;

/**
 * Полный проход по TIPNR.
 * @returns {{ persons: Map<string, object>, stats: object }}
 *   ключ persons — refKey (`Name@Book.c.v`).
 */
export function parseTipnr(text) {
  const stats = {
    topLines: 0, personRecords: 0, groupRecords: 0, byType: {}, duplicates: [],
    subRecordLines: 0, badTopLines: 0,
  };
  const persons = new Map();
  const groups = new Map();   // Type === 'Group': народы/роды (Быт 10 и др.)
  let section = null;
  let current = null;

  for (const line of text.split('\n')) {
    const sec = SECTION_RE.exec(line);
    if (sec) { section = sec[1].toUpperCase(); current = null; continue; }
    if (section !== 'PERSON') continue;
    // строки форм имени «– Named/Greek …»: dStrong«eStrong=Оригинал (иврит/греческий).
    // Именно здесь лежат оригинальные написания ВСЕХ имён — собираем для слоя
    // «имя в оригинале» (тултипы, сверка Синодального с первоисточником).
    if (line.startsWith('–')) {
      if (current) {
        const f = line.split('\t');
        const kind = (f[0] ?? '').replace(/^–\s*/, '').trim();
        const m = /^([HG]\d+[A-Za-z]?)«[^=]*=(.+)$/.exec((f[2] ?? '').trim());
        if (m && !/^Total/i.test(kind)) {
          const original = m[2].trim();
          const en = (f[3] ?? '').split('=')[0].trim();
          if (original && !current.nameForms.some(x => x.strong === m[1] && x.original === original)) {
            current.nameForms.push({ lang: m[1][0], strong: m[1], original, en });
          }
        }
        stats.subRecordLines += 1;
      }
      continue;
    }
    if (!line.trim() || line.startsWith('$') || line.startsWith('‖')) { current = null; continue; }
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // подстрока (форма имени / refs) текущей записи
      if (current) { current.nameFormLines += 1; stats.subRecordLines += 1; }
      continue;
    }

    const f = line.split('\t');
    if (f.length < 9 || !f[0].includes('@')) { stats.badTopLines += 1; continue; }
    stats.topLines += 1;

    const uid = parseUnifiedRef(f[0]);
    if (!uid?.refKey) { stats.badTopLines += 1; continue; }

    const type = (f[8] ?? '').trim();
    stats.byType[type] = (stats.byType[type] ?? 0) + 1;

    const rec = {
      key: uid.refKey,
      name: uid.name,
      ref: uid.ref,
      uncertainIdentity: uid.markers.uncertain,
      description: (f[1] ?? '').trim(),
      parents: parseRelField(f[2], { plusSeparated: true }),
      siblings: parseRelField(f[3]),
      partners: parseRelField(f[4]),
      offspring: parseRelField(f[5]),
      tribe: (f[6] ?? '').trim() || null,
      summary: (f[7] ?? '').trim(),
      type,
      nameFormLines: 0,
      nameForms: [],   // [{lang:'H'|'G', strong, original, en}] — из «– Named/Greek»
    };

    if (type === 'Male' || type === 'Female') {
      if (persons.has(rec.key)) {
        stats.duplicates.push(rec.key);
      } else {
        persons.set(rec.key, rec);
        stats.personRecords += 1;
      }
    } else if (type === 'Group') {
      if (!groups.has(rec.key)) {
        groups.set(rec.key, rec);
        stats.groupRecords += 1;
      }
    }
    current = rec;
  }
  return { persons, groups, stats };
}

/**
 * Резолюция ссылок отношений в ключи persons.
 * Мутирует: каждой ссылке проставляет resolved=true/false; возвращает счётчики.
 * Ссылки с маркером (d) «народ-потомок» на персон не резолвятся — это связь
 * персона→народ, она уйдёт в groups-слой (Phase 1.5), не в parent-рёбра.
 */
export function resolveRelations(persons) {
  const stats = { resolved: 0, unresolvedRefs: [], skippedDescendedGroup: 0 };
  for (const rec of persons.values()) {
    for (const relName of ['parents', 'siblings', 'partners', 'offspring']) {
      for (const rel of rec[relName]) {
        if (rel.markers.descendedGroup) { rel.resolved = false; stats.skippedDescendedGroup += 1; continue; }
        if (rel.refKey && persons.has(rel.refKey)) {
          rel.resolved = true;
          stats.resolved += 1;
        } else {
          rel.resolved = false;
          stats.unresolvedRefs.push({ from: rec.key, field: relName, raw: rel.raw });
        }
      }
    }
  }
  return stats;
}
