/** Article-local collision geometry. No runtime singleton or new overlay. */
export type Box = { left: number; right: number; top: number; bottom: number };
export type Size = { width: number; height: number };
export function resolveLawsonPopover(anchor: Box, viewport: Box, size: Size, gap: number) {
  const width = Math.min(size.width, Math.max(0, viewport.right - viewport.left));
  const left = Math.max(viewport.left, Math.min(anchor.left, viewport.right - width));
  const above = Math.max(0, Math.min(viewport.bottom, anchor.top - gap) - viewport.top);
  const below = Math.max(0, viewport.bottom - Math.max(viewport.top, anchor.bottom + gap));
  const side = size.height <= above || above >= below ? 'above' : 'below';
  const maxHeight = side === 'above' ? above : below;
  const height = Math.min(size.height, maxHeight);
  const top = side === 'above' ? Math.min(viewport.bottom, anchor.top - gap) - height : Math.max(viewport.top, anchor.bottom + gap);
  return { side, left, top, width, height, maxHeight };
}

/** Only desktop collision positioning; native mobile sheet and print remain CSS-owned. */
export function placeLawsonPopover(anchor: HTMLElement, card: HTMLElement, gap: number) {
  const scrollTop = card.scrollTop;
  for (const key of ['left', 'top', 'bottom', 'max-height', 'max-width']) card.style.removeProperty(key);
  if (card.hidden || !matchMedia('(min-width: 1200px)').matches) return;
  // Measure the actual absolute-position containing block, rather than assuming
  // the anchor and its inline wrapper share an origin (wrapped text may not).
  const inset = 16;
  const viewport = {left: inset, top: inset, right: document.documentElement.clientWidth - inset, bottom: document.documentElement.clientHeight - inset};
  const anchorBox = anchor.getBoundingClientRect();
  card.style.left = '0px';
  card.style.top = '0px';
  card.style.bottom = 'auto';
  card.style.maxWidth = `${Math.max(0, viewport.right - viewport.left)}px`;
  const natural = card.getBoundingClientRect();
  const result = resolveLawsonPopover(anchorBox, viewport, natural, gap);
  card.style.maxHeight = `${Math.min(natural.height, result.maxHeight)}px`;
  // The actual constrained height accounts for padding, borders and overflow.
  const constrained = card.getBoundingClientRect();
  const targetTop = result.side === 'above' ? Math.min(viewport.bottom, anchorBox.top - gap) - constrained.height : Math.max(viewport.top, anchorBox.bottom + gap);
  card.style.left = `${result.left - constrained.left}px`;
  card.style.top = `${targetTop - constrained.top}px`;
  card.scrollTop = scrollTop;
}
