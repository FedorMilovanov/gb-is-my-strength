// Structural guard only: the caller owns the accepted Research projection and rights.
const clean = v => typeof v === 'string' && v.length > 0 && v.trim() === v;
const token = v => clean(v) && /^[a-z0-9][a-z0-9-]*$/.test(v);
const anchor = v => clean(v) && /^#[A-Za-z][A-Za-z0-9._:-]*$/.test(v);
const fail = message => { throw new Error('Journal document exhibit: ' + message); };
function date(v) {
  if (v === null) return null;
  if (!clean(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) fail('invalid date');
  const d = new Date(v + 'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== v) fail('invalid calendar date');
  return v;
}
function text(v, name) {
  if (!clean(v)) fail('missing ' + name);
  return v;
}
/**
 * Only editorial paraphrase, never a reproduction or quote. Source and claim
 * IDs resolve against caller-supplied canonical admitted registries. This does
 * not grant publication authority; route-level evidence gates remain mandatory.
 */
export function documentExhibitView(input, authority) {
  if (!input || !token(input.id) || input.mode !== 'editorial-paraphrase') fail('unsupported exhibit');
  if (!authority || !Array.isArray(authority.claimIds) || !Array.isArray(authority.sources)) fail('missing authority');
  const sourceMap = new Map();
  const targets = new Set();
  for (const s of authority.sources) {
    if (!clean(s?.id) || !anchor(s.href) || !clean(s.label) || sourceMap.has(s.id) || targets.has(s.href)) fail('invalid source registry');
    sourceMap.set(s.id, s);
    targets.add(s.href);
  }
  const claims = new Set(authority.claimIds);
  if (claims.size !== authority.claimIds.length || [...claims].some(c => !clean(c))) fail('invalid claim registry');
  if (!Array.isArray(input.sections) || !input.sections.length) fail('empty document');
  const ids = new Set();
  const sections = input.sections.map((row, index) => {
    if (!token(row?.id) || ids.has(row.id)) fail('duplicate or invalid section');
    ids.add(row.id);
    if (!claims.has(row.claimId)) fail('claim outside admitted projection');
    const source = sourceMap.get(row.sourceId);
    if (!source) fail('unknown source');
    return { id: row.id, number: String(index + 1).padStart(2, '0'),
      heading: text(row.heading, 'heading'), locator: text(row.locator, 'locator'),
      summary: text(row.summary, 'summary'), significance: text(row.significance, 'significance'),
      limitation: text(row.limitation, 'limitation'), claimId: row.claimId,
      source, citationId: 'cite-' + input.id + '-document-' + row.id };
  });
  const documentDate = date(input.documentDate);
  const publicationDate = date(input.publicationDate);
  const captureDate = date(input.captureDate);
  return { id: input.id, title: text(input.title, 'title'), issuer: text(input.issuer, 'issuer'),
    deck: text(input.deck, 'deck'), documentDate, publicationDate, captureDate, sections };
}
