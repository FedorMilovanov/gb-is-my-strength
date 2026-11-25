/** Presentation-only validation. This component never grants publication or media rights. */
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const route = /^\/(?:journal\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)+|articles\/[a-z0-9]+(?:-[a-z0-9]+)*\/)$/;
const image = /^\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:avif|webp|png|jpe?g)$/i;
function date(value) {
  const m = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!m || !Number.isFinite(Date.parse(value))) return false;
  const y=Number(m[1]), month=Number(m[2]), day=Number(m[3]);
  // Date.UTC remaps years 00–99 into 1900–1999; use the authored Gregorian year.
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month>=1 && month<=12 && day>=1 && day<=days[month-1];
}
function srcset(value, extension) {
  if (typeof value !== 'string') return false;
  const widths = new Set();
  const urls = new Set();
  return value.split(',').every(part => {
    const m=part.trim().match(/^(\S+) ([1-9]\d*)w$/);
    if (!m || !image.test(m[1]) || !m[1].toLowerCase().endsWith('.'+extension)) return false;
    const w=Number(m[2]);
    if (!Number.isSafeInteger(w) || widths.has(w) || urls.has(m[1])) return false;
    widths.add(w);
    urls.add(m[1]);
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
  const variant = card.variant === undefined ? 'analysis' : card.variant;
  const headingLevel = card.headingLevel === undefined ? 3 : card.headingLevel;
  if (!['feature','analysis','brief'].includes(variant)) throw new Error('Unknown story variant');
  if (![2,3].includes(headingLevel)) throw new Error('Invalid heading level');
  for (const key of ['deck','readingLabel','actionLabel']) if (card[key] !== undefined && !text(card[key])) throw new Error('Empty optional editorial text: '+key);
  if (card.publishedAt !== undefined || card.publishedLabel !== undefined) {
    if (!date(card.publishedAt) || !text(card.publishedLabel)) throw new Error('Explicit valid publication timestamp and label required');
  }
  if (card.companion !== undefined && typeof card.companion !== 'boolean') throw new Error('Invalid companion flag');
  if (card.companion && variant !== 'analysis') throw new Error('Companion uses analysis variant');
  if (card.landingLead !== undefined && typeof card.landingLead !== 'boolean') throw new Error('Invalid landing image hook');
  if (card.landingLead && (variant !== 'feature' || !card.media)) throw new Error('Landing image hook requires illustrated feature');
  const m=card.media;
  if (m !== undefined) {
    if (!m || !text(m.alt) || !text(m.caption) || !sizes(m.sizes) || typeof m.src !== 'string' || !image.test(m.src) || !Number.isSafeInteger(m.width) || !Number.isSafeInteger(m.height) || m.width<1 || m.height<1) throw new Error('Local image, intrinsic dimensions, alt, caption and sizes required');
    if (m.note !== undefined && !text(m.note)) throw new Error('Empty image caption note');
    const presentation = m.presentation;
    if (presentation !== undefined) {
      if (!presentation || typeof presentation !== 'object' || !['intrinsic','crop'].includes(presentation.mode)) throw new Error('Unknown media presentation');
      if (presentation.mode === 'intrinsic' && Object.keys(presentation).some(key=>key !== 'mode')) throw new Error('Intrinsic media has no crop options');
      if (presentation.mode === 'crop' && (!['16:9','4:3','3:4','1:1'].includes(presentation.ratio) || ![presentation.focalX,presentation.focalY].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=100) || Object.keys(presentation).some(key=>!['mode','ratio','focalX','focalY'].includes(key)))) throw new Error('Crop requires explicit ratio and focal point');
    }
    for (const key of ['avifSrcset','webpSrcset']) if (m[key] !== undefined && !srcset(m[key], key === 'avifSrcset' ? 'avif' : 'webp')) throw new Error('Invalid local responsive image list');
  }
}
