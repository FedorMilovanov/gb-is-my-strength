/**
 * v1 skeleton → TIPNR identity matcher.
 *
 * Pure module: no I/O, no CLI side effects. Build and publication audit MUST use
 * this same implementation so candidate identity decisions are reproducible.
 */
import { OSIS_RU, parseRef } from './refs.mjs';
import { similarity, translitEnRu } from './ru-extract.mjs';

const RU_BOOK_TO_OSIS = Object.fromEntries(Object.entries(OSIS_RU).map(([osis, ru]) => [ru, osis]));

export const V1_EXCEPTIONS = Object.freeze({
  abram: 'Abraham@Gen.11.26',
  jesus: 'Jesus@Isa.7.14',
  jacob: 'Israel@Gen.25.26',
  jacob_mt: 'Jacob@Mat.1.15',
  arphaxad: 'Arpachshad@Gen.10.22',
  jeconiah: 'Jehoiachin@2Ki.24.6',
  shelah: 'Shelah@Gen.10.24',
  mizraim: 'Egypt@Gen.10.6',
  joseph_nt: 'Joseph@Mat.1.16',
  joseph_lk: 'Joseph@Luk.3.30',
  joseph_lk2: 'Joseph@Luk.3.24',
  simeon_lk: 'Simeon@Luk.3.30',
  levi_lk: 'Levi@Luk.3.29',
  levi_lk2: 'Levi@Luk.3.24',
  melki_lk: 'Melchi@Luk.3.28',
  melchi_lk2: 'Melchi@Luk.3.24',
  mattathias_lk: 'Mattathias@Luk.3.26',
  mattathias2_lk: 'Mattathias@Luk.3.25',
  naggesi_lk: 'Naggai@Luk.3.25',
  judah_lk: 'Judah@Luk.3.30',
});

export const V1_NO_MATCH = new Set(['judah_lk2', 'simeon_lk2', 'joseph_lk3']);

export const MATCH_THRESHOLDS = Object.freeze({
  fuzzyMinScore: 0.80,
  fuzzyContextMinScore: 0.76,
  fuzzyMinMargin: 0.06,
  ruNameMinScore: 0.55,
  ruNameMinMargin: 0.03,
});

function slugName(value) {
  return String(value).split('|')[0].toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function v1PrimaryRefScope(person) {
  const first = String(person.ref ?? '').split(';')[0].trim();
  const match = /^([1-4]?[А-Яа-яЁё]+)\s+(\d+):(\d+)/u.exec(first);
  if (!match) return null;
  const osis = RU_BOOK_TO_OSIS[match[1]];
  return osis ? { osis, chapter: Number(match[2]), verse: Number(match[3]) } : null;
}

function genderCompatible(person, rec) {
  if (!person.gender || person.gender === 'u') return true;
  if (person.gender === 'm') return rec.type === 'Male';
  if (person.gender === 'f') return rec.type === 'Female';
  return true;
}

function scopedFuzzyCandidates(person, all) {
  const genderScoped = all.filter(rec => genderCompatible(person, rec));
  const pool = genderScoped.length ? genderScoped : all;
  const scope = v1PrimaryRefScope(person);
  if (!scope) return { pool, scopeLevel: 'gender' };

  const sameChapter = pool.filter(rec => {
    const ref = parseRef(rec.ref);
    return ref?.osis === scope.osis && ref.chapter === scope.chapter;
  });
  if (sameChapter.length) return { pool: sameChapter, scopeLevel: 'chapter' };

  const sameBook = pool.filter(rec => parseRef(rec.ref)?.osis === scope.osis);
  if (sameBook.length) return { pool: sameBook, scopeLevel: 'book' };

  return { pool, scopeLevel: 'gender' };
}

function pickFuzzy(person, all) {
  const { pool, scopeLevel } = scopedFuzzyCandidates(person, all);
  const target = slugName(person.id.replace(/_[a-z0-9]{1,6}$/i, ''));
  const ranked = pool
    .map(rec => ({ rec, score: similarity(target, slugName(rec.name)) }))
    .sort((a, b) => b.score - a.score || a.rec.key.localeCompare(b.rec.key));
  const best = ranked[0];
  const second = ranked[1];
  if (!best) return null;

  const minScore = scopeLevel === 'chapter' || scopeLevel === 'book'
    ? MATCH_THRESHOLDS.fuzzyContextMinScore
    : MATCH_THRESHOLDS.fuzzyMinScore;
  const margin = second ? best.score - second.score : 1;
  if (best.score < minScore || margin < MATCH_THRESHOLDS.fuzzyMinMargin) return null;
  return { rec: best.rec, score: best.score, margin, scopeLevel };
}

function disambiguate(person, initialCandidates) {
  let candidates = initialCandidates.filter(rec => genderCompatible(person, rec));
  if (!candidates.length) return null;

  const scope = v1PrimaryRefScope(person);
  if (scope) {
    const sameChapter = candidates.filter(candidate => {
      const ref = parseRef(candidate.ref);
      return ref?.osis === scope.osis && ref.chapter === scope.chapter;
    });
    if (sameChapter.length === 1) return { rec: sameChapter[0], method: 'source-chapter' };
    if (sameChapter.length > 1) candidates = sameChapter;
    else {
      const sameBook = candidates.filter(candidate => parseRef(candidate.ref)?.osis === scope.osis);
      if (sameBook.length === 1) return { rec: sameBook[0], method: 'source-book' };
      if (sameBook.length > 1) candidates = sameBook;
    }
  }

  if (person.name?.ru) {
    const ranked = candidates
      .map(candidate => ({ candidate, score: similarity(translitEnRu(candidate.name), person.name.ru) }))
      .sort((a, b) => b.score - a.score || a.candidate.key.localeCompare(b.candidate.key));
    const best = ranked[0];
    const second = ranked[1];
    const margin = second ? best.score - second.score : 1;
    if (best && best.score >= MATCH_THRESHOLDS.ruNameMinScore && margin >= MATCH_THRESHOLDS.ruNameMinMargin) {
      return { rec: best.candidate, method: 'ru-name-similarity', score: best.score, margin };
    }
  }
  return null;
}

/**
 * @param {Array<object>} v1Persons
 * @param {Map<string, object>} tipnrPersons key→TIPNR-like record
 */
export function matchSkeleton(v1Persons, tipnrPersons) {
  const byName = new Map();
  const all = [...tipnrPersons.values()];
  for (const rec of all) {
    const key = slugName(rec.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(rec);
  }

  const matches = new Map();
  const decisions = [];
  const soft = [];
  const unmatched = [];

  for (const person of v1Persons) {
    if (V1_NO_MATCH.has(person.id)) {
      unmatched.push({ id: person.id, ru: person.name?.ru, ref: person.ref ?? null, candidates: 'no-tipnr-counterpart' });
      continue;
    }

    if (V1_EXCEPTIONS[person.id]) {
      const target = V1_EXCEPTIONS[person.id];
      if (!tipnrPersons.has(target)) {
        unmatched.push({ id: person.id, ru: person.name?.ru, ref: person.ref ?? null, candidates: 'explicit-target-missing', target });
        continue;
      }
      matches.set(person.id, target);
      decisions.push({ id: person.id, target, method: 'explicit-exception' });
      continue;
    }

    const base = person.id.replace(/_[a-z0-9]{1,6}$/i, '');
    let candidates = (byName.get(slugName(base)) ?? []).filter(rec => genderCompatible(person, rec));
    let fuzzy = null;
    if (candidates.length === 0) {
      fuzzy = pickFuzzy(person, all);
      if (fuzzy) {
        candidates = (byName.get(slugName(fuzzy.rec.name)) ?? [fuzzy.rec])
          .filter(rec => genderCompatible(person, rec));
      }
    }

    if (candidates.length === 1) {
      const target = candidates[0].key;
      const method = fuzzy ? 'fuzzy' : 'exact-name';
      matches.set(person.id, target);
      decisions.push({
        id: person.id,
        target,
        method,
        ...(fuzzy ? { score: fuzzy.score, margin: fuzzy.margin, scopeLevel: fuzzy.scopeLevel } : {}),
      });
      if (fuzzy) {
        soft.push({
          id: person.id,
          via: `fuzzy:${fuzzy.rec.name}(${fuzzy.score.toFixed(2)}; margin=${fuzzy.margin.toFixed(2)}; scope=${fuzzy.scopeLevel})`,
        });
      }
      continue;
    }

    if (candidates.length > 1) {
      const pick = disambiguate(person, candidates);
      if (pick) {
        const target = pick.rec.key;
        const method = fuzzy ? 'fuzzy' : pick.method;
        matches.set(person.id, target);
        decisions.push({
          id: person.id,
          target,
          method,
          ...(pick.score == null ? {} : { score: pick.score, margin: pick.margin }),
          ...(fuzzy ? { fuzzyScore: fuzzy.score, fuzzyMargin: fuzzy.margin, scopeLevel: fuzzy.scopeLevel } : {}),
        });
        if (fuzzy || pick.method === 'ru-name-similarity') {
          const via = fuzzy
            ? `fuzzy:${fuzzy.rec.name}(${fuzzy.score.toFixed(2)}; margin=${fuzzy.margin.toFixed(2)}; scope=${fuzzy.scopeLevel}) → ${pick.method}:${target}`
            : `${pick.method}:${target}(${pick.score.toFixed(2)}; margin=${pick.margin.toFixed(2)})`;
          soft.push({ id: person.id, via });
        }
        continue;
      }
    }

    unmatched.push({ id: person.id, ru: person.name?.ru, ref: person.ref ?? null, candidates: candidates.length });
  }

  const byTarget = new Map();
  for (const [id, key] of matches) {
    if (!byTarget.has(key)) byTarget.set(key, []);
    byTarget.get(key).push(id);
  }
  const collisions = [...byTarget.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));

  return { matches, decisions, unmatched, soft, collisions };
}

/** Adapt emitted v2 persons back to the matcher input shape for offline publication audits. */
export function emittedPersonsAsTipnrMap(persons) {
  return new Map(persons.map(person => [
    person.key,
    {
      key: person.key,
      name: person.en,
      ref: person.firstRef?.osis,
      type: person.gender === 'm' ? 'Male' : person.gender === 'f' ? 'Female' : '',
    },
  ]));
}
