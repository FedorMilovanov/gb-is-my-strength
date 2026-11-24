/** Private design specimen: source selection, not event or publication authority. */
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function groupSourceChronicle(sources, selection) {
  if (!Array.isArray(sources) || !Array.isArray(selection) || !selection.length) throw new Error('Sources and explicit groups required');
  const lookup = new Map();
  for (const source of sources) {
    if (!source || !nonempty(source.id) || lookup.has(source.id)) throw new Error('Invalid or duplicate authority ID');
    lookup.set(source.id, source);
  }
  const used = new Set(), labels = new Set();
  let previousYear = 0;
  return selection.map(group => {
    if (!group || !nonempty(group.label) || !nonempty(group.title) || labels.has(group.label) || !Array.isArray(group.rows) || !group.rows.length) throw new Error('Explicit nonempty source group required');
    labels.add(group.label);
    return { label: group.label, title: group.title, rows: group.rows.map(row => {
      if (!row || !Number.isInteger(row.year) || row.year < 1 || row.year > 9999 || row.year < previousYear || used.has(row.id)) throw new Error('Invalid, duplicate or out-of-order source selection');
      const source = lookup.get(row.id);
      if (!source || !['title','role','boundary','url'].every(key => nonempty(source[key]))) throw new Error('Source not available with full boundary');
      let url;
      try { url = new URL(source.url); } catch { throw new Error('Invalid source URL'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS source URL required');
      previousYear = row.year;
      used.add(row.id);
      return { year: row.year, source };
    }) };
  });
}
