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
function srcset(value) {
  return typeof value === 'string' && value.split(',').every(part => {
    const m=part.trim().match(/^(\S+) ([1-9]\d*)w$/);
    return !!m && image.test(m[1]);
  });
}
/** @param {any} card */
export function assertNewsStoryCard(card) {
  if (!card || !text(card.title) || !text(card.label) || typeof card.href !== 'string' || !route.test(card.href)) throw new Error('Required editorial title, label and canonical internal article route');
  if (!['feature','analysis','brief'].includes(card.variant ?? 'analysis')) throw new Error('Unknown story variant');
  if (![2,3].includes(card.headingLevel ?? 3)) throw new Error('Invalid heading level');
  for (const key of ['deck','readingLabel']) if (card[key] !== undefined && !text(card[key])) throw new Error('Empty optional editorial text: '+key);
  if (card.publishedAt !== undefined || card.publishedLabel !== undefined) {
    if (!date(card.publishedAt) || !text(card.publishedLabel)) throw new Error('Explicit valid publication timestamp and label required');
  }
  const m=card.media;
  if (m !== undefined) {
    if (!m || !text(m.alt) || !text(m.caption) || !text(m.sizes) || typeof m.src !== 'string' || !image.test(m.src) || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width<1 || m.height<1) throw new Error('Local image, intrinsic dimensions, alt, caption and sizes required');
    for (const key of ['avifSrcset','webpSrcset']) if (m[key] !== undefined && !srcset(m[key])) throw new Error('Invalid local responsive image list');
  }
}
