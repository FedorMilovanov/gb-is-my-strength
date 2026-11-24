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
export function documentCitationId(exhibitId, rowId) {
  // Length prefix makes the concatenation injective even with hyphenated IDs.
  return 'cite-' + exhibitId.length + '-' + exhibitId + '-document-' + rowId;
}
export function documentExhibitView(input, authority) {
  if (!input || !token(input.id) || input.mode !== 'editorial-paraphrase') fail('unsupported exhibit');
  if (!authority || !Array.isArray(authority.claims) || !Array.isArray(authority.sources)) fail('missing authority');
  const sourceMap = new Map();
  const targets = new Set();
  for (const s of authority.sources) {
    if (!clean(s?.id) || !anchor(s.href) || !clean(s.label) || sourceMap.has(s.id) || targets.has(s.href)) fail('invalid source registry');
    sourceMap.set(s.id, s);
    targets.add(s.href);
  }
  const claims = new Map();
  for (const claim of authority.claims) {
    if (!clean(claim?.id) || claims.has(claim.id) || !Array.isArray(claim.references) || !claim.references.length) fail('invalid claim registry');
    const refs = new Map();
    for (const ref of claim.references) {
      if (!sourceMap.has(ref?.sourceId) || !clean(ref.locator)) fail('invalid claim reference');
      const key = JSON.stringify([ref.sourceId, ref.locator]);
      if (refs.has(key)) fail('duplicate claim reference');
      refs.set(key, { sourceId: ref.sourceId, locator: ref.locator });
    }
    claims.set(claim.id, refs);
  }
  if (!Array.isArray(input.sections) || !input.sections.length) fail('empty document');
  const ids = new Set();
  const sections = input.sections.map((row, index) => {
    if (!token(row?.id) || ids.has(row.id)) fail('duplicate or invalid section');
    ids.add(row.id);
    if (!claims.has(row.claimId)) fail('claim outside admitted projection');
    const source = sourceMap.get(row.sourceId);
    if (!source) fail('unknown source');
    const admitted = claims.get(row.claimId);
    const primaryKey = JSON.stringify([row.sourceId, row.locator]);
    if (!admitted.has(primaryKey)) fail('source or locator outside admitted claim');
    // The row chooses its primary document fragment, not which evidence to omit.
    // All remaining admitted references are projected from the same authority.
    const ordered = [admitted.get(primaryKey), ...[...admitted.entries()].filter(([key]) => key !== primaryKey).map(([, ref]) => ref)];
    const citationId = documentCitationId(input.id, row.id);
    const citations = ordered.map((ref, i) => ({
      source: sourceMap.get(ref.sourceId),
      locator: ref.locator,
      citationId: i === 0 ? citationId : citationId + ':ref-' + (i + 1),
    }));
    return { id: row.id, number: String(index + 1).padStart(2, '0'),
      heading: text(row.heading, 'heading'), locator: text(row.locator, 'locator'),
      summary: text(row.summary, 'summary'), significance: text(row.significance, 'significance'),
      limitation: text(row.limitation, 'limitation'), claimId: row.claimId,
      source, citationId, citations };
  });
  const documentDate = date(input.documentDate);
  const publicationDate = date(input.publicationDate);
  const captureDate = date(input.captureDate);
  return { id: input.id, title: text(input.title, 'title'), issuer: text(input.issuer, 'issuer'),
    deck: text(input.deck, 'deck'), documentDate, publicationDate, captureDate, sections };
}
