/** Presentation-only validation. This component never grants publication or media rights. */
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const route = /^\/journal\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+$/;
const image = /^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:avif|webp|png|jpe?g)$/i;
function date(value) {
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!m || !Number.isFinite(Date.parse(value))) return false;
  const y=Number(m[1]), month=Number(m[2]), day=Number(m[3]);
  return month>=1 && month<=12 && day>=1 && day<=new Date(Date.UTC(y,month,0)).getUTCDate();
}
function srcset(value, extension) {
  if (typeof value !== 'string') return false;
  const widths = new Set();
  return value.split(',').every(part => {
    const m=part.trim().match(/^(\S+) ([1-9]\d*)w$/);
    if (!m || !image.test(m[1]) || !m[1].toLowerCase().endsWith('.'+extension)) return false;
    const w=Number(m[2]);
    if (!Number.isSafeInteger(w) || widths.has(w)) return false;
    widths.add(w);
    return true;
  });
}
// Deliberately limited editorial sizes vocabulary, not a general CSS parser.
// The final fallback is unconditional; earlier clauses descend by min-width.
function sizes(value) {
  if (!text(value)) return false;
  const clauses=value.split(',').map(x=>x.trim());
  const length=/^(?:[1-9]\d*(?:\.\d+)?(?:px|vw)|calc\([1-9]\d*(?:\.\d+)?vw - [1-9]\d*(?:\.\d+)?px\))$/;
  let last=Infinity;
  return clauses.every((clause,i)=>{
    if(i===clauses.length-1) return length.test(clause);
    const m=clause.match(/^\(min-width: ([1-9]\d*)px\) (.+)$/);
    if(!m || !length.test(m[2])) return false;
    const w=Number(m[1]);
    if(!Number.isSafeInteger(w)||w>=last) return false;
    last=w; return true;
  });
}
/** @param {any} card */
export function assertNewsStoryCard(card) {
  if (!card || !text(card.title) || !text(card.label) || typeof card.href !== 'string' || !route.test(card.href)) throw new Error('Required editorial title, label and canonical internal article route');
  if (!['feature','analysis','brief'].includes(card.variant ?? 'analysis')) throw new Error('Unknown story variant');
  if (![2,3].includes(card.headingLevel ?? 3)) throw new Error('Invalid heading level');
  for (const key of ['deck','readingLabel','actionLabel']) if (card[key] !== undefined && !text(card[key])) throw new Error('Empty optional editorial text: '+key);
  if (card.publishedAt !== undefined || card.publishedLabel !== undefined) {
    if (!date(card.publishedAt) || !text(card.publishedLabel)) throw new Error('Explicit valid publication timestamp and label required');
  }
  if (card.companion !== undefined && typeof card.companion !== 'boolean') throw new Error('Invalid companion flag');
  if (card.companion && (card.variant ?? 'analysis') !== 'analysis') throw new Error('Companion uses analysis variant');
  const m=card.media;
  if (m !== undefined) {
    if (!m || !text(m.alt) || !text(m.caption) || !sizes(m.sizes) || typeof m.src !== 'string' || !image.test(m.src) || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width<1 || m.height<1) throw new Error('Local image, intrinsic dimensions, alt, caption and sizes required');
    if (m.note !== undefined && !text(m.note)) throw new Error('Empty image caption note');
    for (const key of ['avifSrcset','webpSrcset']) if (m[key] !== undefined && !srcset(m[key], key === 'avifSrcset' ? 'avif' : 'webp')) throw new Error('Invalid local responsive image list');
  }
}
