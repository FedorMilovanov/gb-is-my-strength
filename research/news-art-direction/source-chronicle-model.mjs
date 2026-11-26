/** Private design specimen: source selection, not event or publication authority. */
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export function groupSourceChronicle(sources, selection) {
  if (!Array.isArray(sources) || !Array.isArray(selection) || !selection.length) throw new Error('Sources and explicit groups required');
  const lookup = new Map();
  for (const source of sources) {
    if (!source || !nonempty(source.id) || lookup.has(source.id)) throw new Error('Invalid or duplicate authority ID');
    lookup.set(source.id, source);
  }
  const used = new Set(), yearsUsed = new Set();
  let previousYear = 0;
  return Array.from(selection, group => {
    if (!group || typeof group !== 'object' || 'label' in group || !nonempty(group.title) || !Array.isArray(group.rows) || !group.rows.length || !Array.isArray(group.years) || !group.years.length) throw new Error('Explicit selected years and nonempty group required');
    const years = Array.from(group.years);
    if (years.some((year,i)=>!Number.isInteger(year)||year<1||year>9999||(i>0&&year<=years[i-1])||yearsUsed.has(year))) throw new Error('Invalid, duplicate or overlapping selected years');
    const represented = new Set(Array.from(group.rows, row=>row?.year));
    if (represented.size!==years.length || years.some(year=>!represented.has(year))) throw new Error('Selected years must match source rows');
    for (const year of years) yearsUsed.add(year);
    // A gap in the selection is never presented as continuous coverage.
    const label = years.join(', ');
    return { label, title: group.title, rows: Array.from(group.rows, row => {
      if (!row || !Number.isInteger(row.year) || row.year < 1 || row.year > 9999 || row.year < previousYear || used.has(row.id)) throw new Error('Invalid, duplicate or out-of-order source selection');
      const source = lookup.get(row.id);
      if (!source || !['title','role','boundary','url'].every(key => nonempty(source[key]))) throw new Error('Source not available with full boundary');
      // URL() normalizes special-scheme input that the browser may resolve relative to the current page.
      // Keep the authored evidence link unambiguous, just as in the AV exhibit.
      if (!/^https:\/\/[^/\\?#]/i.test(source.url) || /[\\\s\u0000-\u001f\u007f]/u.test(source.url)) throw new Error('Absolute HTTPS source URL required');
      let url;
      try { url = new URL(source.url); } catch { throw new Error('Invalid source URL'); }
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS source URL required');
      previousYear = row.year;
      used.add(row.id);
      return { year: row.year, source };
    }) };
  });
}
