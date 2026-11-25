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

/** Reserve the canonical mobile chrome's full layout height, even while its
 * top bar animates out of view. This prevents a visible card from jumping or
 * becoming obscured when that bar returns. Safe-area padding is already in
 * the measured border box; CSS retains its own fallback for missing chrome. */
export function resolveLawsonMobileClearance(topHeight: number, bottomHeight: number, gap: number) {
  return {
    top: Math.max(0, topHeight) + gap,
    bottom: Math.max(0, bottomHeight) + gap,
  };
}

/** Article-local geometry only; mobile sheet/print presentation remains CSS-owned. */
export function placeLawsonPopover(anchor: HTMLElement, card: HTMLElement, gap: number) {
  const scrollTop = card.scrollTop;
  for (const key of ['left', 'top', 'bottom', 'max-height', 'max-width']) card.style.removeProperty(key);
  for (const key of ['--lawson-popover-chrome-top', '--lawson-popover-chrome-bottom']) card.style.removeProperty(key);
  if (card.hidden) return true;
  if (!matchMedia('(min-width: 1200px)').matches) {
    const shell = document.querySelector('[data-mobile-chrome][data-mobile-chrome-engine="article"]');
    const top = shell?.querySelector<HTMLElement>('[data-mobile-topbar]');
    const bottom = shell?.querySelector<HTMLElement>('[data-mobile-bottombar]');
    // offsetHeight intentionally excludes translateY but includes border and safe area.
    const clearance = resolveLawsonMobileClearance(top?.offsetHeight ?? 0, bottom?.offsetHeight ?? 0, Math.max(gap, .5 * parseFloat(getComputedStyle(document.documentElement).fontSize)));
    card.style.setProperty('--lawson-popover-chrome-top', `${clearance.top}px`);
    card.style.setProperty('--lawson-popover-chrome-bottom', `${clearance.bottom}px`);
    const rect = card.getBoundingClientRect();
    card.scrollTop = scrollTop;
    return rect.width > 0 && rect.height > 0 && rect.top >= clearance.top - 1;
  }
  // Measure the actual absolute-position containing block, rather than assuming
  // the anchor and its inline wrapper share an origin (wrapped text may not).
  const inset = 16;
  const viewport = {left: inset, top: inset, right: document.documentElement.clientWidth - inset, bottom: document.documentElement.clientHeight - inset};
  // Inline terms can wrap: their bounding box alone includes empty space
  // between fragments. A detached card must not survive an offscreen anchor.
  const intersects = (r: DOMRect) => r.width > 0 && r.height > 0 &&
    r.left < viewport.right && r.right > viewport.left &&
    r.top < viewport.bottom && r.bottom > viewport.top;
  if (!Array.from(anchor.getClientRects()).some(intersects)) return false;
  const anchorBox = anchor.getBoundingClientRect();
  card.style.left = '0px';
  card.style.top = '0px';
  card.style.bottom = 'auto';
  card.style.maxWidth = `${Math.max(0, viewport.right - viewport.left)}px`;
  const natural = card.getBoundingClientRect();
  const result = resolveLawsonPopover(anchorBox, viewport, natural, gap);
  if (result.maxHeight <= 0 || result.width <= 0) return false;
  card.style.maxHeight = `${Math.min(natural.height, result.maxHeight)}px`;
  // The actual constrained height accounts for padding, borders and overflow.
  const constrained = card.getBoundingClientRect();
  const targetTop = result.side === 'above' ? Math.min(viewport.bottom, anchorBox.top - gap) - constrained.height : Math.max(viewport.top, anchorBox.bottom + gap);
  card.style.left = `${result.left - constrained.left}px`;
  card.style.top = `${targetTop - constrained.top}px`;
  card.scrollTop = scrollTop;
  // Borders/padding can exceed the available space even with max-height set.
  const final = card.getBoundingClientRect();
  return final.width > 0 && final.height > 0 &&
    final.left >= viewport.left - 1 && final.right <= viewport.right + 1 &&
    final.top >= viewport.top - 1 && final.bottom <= viewport.bottom + 1;
}
