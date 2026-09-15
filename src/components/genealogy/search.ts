import type { Person } from './types';

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function compareText(left: unknown, right: unknown): number {
  const a = String(left ?? '');
  const b = String(right ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
}

function fieldScore(value: string | null | undefined, query: string, exact: number, prefix: number, contains: number): number | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (normalized === query) return exact;
  if (normalized.startsWith(query)) return prefix;
  if (normalized.includes(query)) return contains;
  return null;
}

export interface GenealogySearchResult {
  person: Person;
  score: number;
  matchedField: 'id' | 'ru' | 'altName' | 'birthName' | 'he' | 'greek' | 'ref';
}

function bestMatch(person: Person, query: string): Omit<GenealogySearchResult, 'person'> | null {
  const candidates: Array<{ score: number; matchedField: GenealogySearchResult['matchedField'] } | null> = [
    fieldScore(person.id, query, 0, 4, 12) == null ? null : {
      score: fieldScore(person.id, query, 0, 4, 12)!,
      matchedField: 'id',
    },
    fieldScore(person.name.ru, query, 1, 5, 10) == null ? null : {
      score: fieldScore(person.name.ru, query, 1, 5, 10)!,
      matchedField: 'ru',
    },
    fieldScore(person.name.altName, query, 2, 6, 11) == null ? null : {
      score: fieldScore(person.name.altName, query, 2, 6, 11)!,
      matchedField: 'altName',
    },
    fieldScore(person.name.birthName, query, 2, 6, 11) == null ? null : {
      score: fieldScore(person.name.birthName, query, 2, 6, 11)!,
      matchedField: 'birthName',
    },
    fieldScore(person.name.he, query, 3, 7, 13) == null ? null : {
      score: fieldScore(person.name.he, query, 3, 7, 13)!,
      matchedField: 'he',
    },
    fieldScore(person.name.greek, query, 3, 7, 13) == null ? null : {
      score: fieldScore(person.name.greek, query, 3, 7, 13)!,
      matchedField: 'greek',
    },
    fieldScore(person.ref, query, 8, 9, 14) == null ? null : {
      score: fieldScore(person.ref, query, 8, 9, 14)!,
      matchedField: 'ref',
    },
  ].filter((candidate): candidate is { score: number; matchedField: GenealogySearchResult['matchedField'] } => Boolean(candidate));

  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score || compareText(a.matchedField, b.matchedField));
  return candidates[0];
}

export function searchGenealogyPeople(persons: readonly Person[], rawQuery: string): GenealogySearchResult[] {
  const query = normalize(rawQuery);
  if (!query) return [];

  return persons.flatMap(person => {
    const match = bestMatch(person, query);
    return match ? [{ person, ...match }] : [];
  }).sort((a, b) =>
    a.score - b.score ||
    compareText(a.person.name.ru, b.person.name.ru) ||
    compareText(a.person.ref, b.person.ref) ||
    compareText(a.person.id, b.person.id)
  );
}

function isExactIdentityMatch(person: Person, query: string): boolean {
  return [
    person.id,
    person.name.ru,
    person.name.altName,
    person.name.birthName,
    person.name.he,
    person.name.greek,
  ].some(value => normalize(value) === query);
}

/**
 * Auto-select only when the query is unambiguous.
 * Multiple matches must be surfaced to the user rather than silently choosing
 * the first person in dataset order.
 */
export function automaticGenealogySearchResult(
  results: readonly GenealogySearchResult[],
  rawQuery: string,
): Person | null {
  const query = normalize(rawQuery);
  if (!query || results.length === 0) return null;
  if (results.length === 1) return results[0].person;

  const exact = results.filter(result => isExactIdentityMatch(result.person, query));
  return exact.length === 1 ? exact[0].person : null;
}

export function genealogySearchOptionContext(person: Person): string {
  return [
    person.ref,
    person.role === 'messiah' ? 'Мессия' :
      person.role === 'king' ? 'царь' :
      person.role === 'priest' ? 'священник' :
      person.role === 'prophet' ? 'пророк' :
      person.role === 'foster-father' ? 'обручник Марии' :
      null,
  ].filter(Boolean).join(' · ') || person.id;
}

export function genealogySearchOptionLabel(person: Person): string {
  return `${person.name.ru} — ${genealogySearchOptionContext(person)}`;
}
