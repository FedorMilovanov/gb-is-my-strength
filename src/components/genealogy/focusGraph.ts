import type { Person, LineageFilter } from './types.ts';

export function matchesLineage(person: Person, filter: LineageFilter): boolean {
  return filter === 'all' || (filter === 'messianic'
    ? person.lineage.startsWith('messianic')
    : person.lineage === filter);
}

/** Both parents and descendants of the selected person; never cousins by accident. */
export function computeFocusLineage(persons: Person[], personId: string): Set<string> {
  const byId = new Map(persons.map(person => [person.id, person]));
  if (!byId.has(personId)) return new Set();
  const children = new Map<string, Set<string>>();
  for (const person of persons) {
    // The rendered graph uses father/mother. Derive reverse edges from that
    // same source instead of trusting potentially stale children arrays.
    for (const parent of [person.father, person.mother]) {
      if (!parent || !byId.has(parent)) continue;
      if (!children.has(parent)) children.set(parent, new Set());
      children.get(parent)!.add(person.id);
    }
  }
  const visit = (next: (id: string) => string[]): Set<string> => {
    const visited = new Set<string>();
    const queue = [personId];
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      if (visited.has(id) || !byId.has(id)) continue;
      visited.add(id);
      queue.push(...next(id));
    }
    return visited;
  };
  const ancestors = visit(id => {
    const person = byId.get(id)!;
    return [person.father, person.mother].filter((parent): parent is string => Boolean(parent));
  });
  const descendants = visit(id => [...(children.get(id) ?? [])]);
  return new Set([...ancestors, ...descendants]);
}
