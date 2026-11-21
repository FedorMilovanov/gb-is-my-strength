export function dockLibraryFab(fab) {
    if (!fab) return;
    const visible = (node) => node && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    const gill = document.querySelector('.mobile-bottom-bar');
    const herm = document.querySelector('.hmbar');
    const legacy = document.querySelector('.bottom-bar-inner');
    const fallback = document.querySelector('.gb-mobile-fallback-controls');
    let host = null, before = null, cls = '';
    const grok = document.querySelector('.hrail--grok');
    if (visible(grok)) {
      host = grok.querySelector('.hrail-bottom');
      cls = 'hrail-bottom-btn';
    } else if (visible(herm)) {
      // Canonical mobile Reader: library belongs INSIDE the shared actions,
      // before PDF and Share. Share must be the rightmost visible action.
      const actions = herm.querySelector('.reader-mobile-action-cluster');
      host = actions || herm.querySelector('.hmbar-actions') || herm;
      before = actions
        ? actions.querySelector('[data-reader-pdf]')
        : document.getElementById('hmShareBtn');
      cls = 'hmbar-btn';
    }
    else if (visible(gill)) {
      const actions = gill.querySelector('.reader-mobile-action-cluster');
      host = actions || gill.querySelector('.mobile-icon-row') || gill;
      before = actions
        ? actions.querySelector('[data-reader-pdf]')
        : host.querySelector('[data-action="share"],[data-fc-action="share"]');
      cls = 'gb-icon';
    }
    else if (visible(legacy)) { host = legacy; before = document.getElementById('barShareBtn'); cls = 'bar-icon-btn'; }
    else if (visible(fallback)) { host = fallback; cls = 'gb-icon'; }
    fab.classList.remove('gb-hl-fab--docked', 'hrail-bottom-btn', 'hmbar-btn', 'gb-icon', 'bar-icon-btn');
    fab.style.bottom = '';
    if (!host) host = document.body;
    else fab.classList.add('gb-hl-fab--docked', cls);
    if (before?.parentNode === host) {
      if (fab.nextElementSibling !== before) host.insertBefore(fab, before);
    } else if (fab.parentNode !== host || fab.nextElementSibling) host.append(fab);
  }


export function contextFromSelection(selection, text) {
  // Reuse the single approved visible-text projection, not textContent:
  // hidden glossary popovers must never enter a reader's saved quotation.
  // Anchor to the actual Range, never the first matching phrase.
  const empty = { before: '', after: '' };
  try {
    if (!selection?.rangeCount || selection.isCollapsed) return empty;
    const range = selection.getRangeAt(0);
    const origin = range.startContainer.nodeType === 1
      ? range.startContainer : range.startContainer.parentElement;
    const block = origin?.closest?.('p,li,blockquote');
    if (!block || !block.contains(range.endContainer)) return empty;
    const core = window.GBReaderAnchors;
    if (!core?.visibleProjection) return empty;
    const projection = core.visibleProjection(block);
    if (!projection?.segments?.length) return empty;

    // A collapsed DOM boundary allows offsets to remain exact even when
    // the quote contains nested inline links and spans. Hidden segments
    // are already excluded by GBReaderAnchors.visibleProjection.
    const projectedOffset = (container, offset) => {
      const boundary = document.createRange();
      boundary.setStart(container, offset);
      boundary.collapse(true);
      for (const segment of projection.segments) {
        if (segment.node === container) return segment.start + offset;
        // comparePoint: -1 before the collapsed caret, +1 after it.
        if (boundary.comparePoint(segment.node, segment.node.nodeValue.length) < 0) continue;
        if (boundary.comparePoint(segment.node, 0) > 0) return segment.start;
        return segment.start;
      }
      return projection.text.length;
    };
    const start = projectedOffset(range.startContainer, range.startOffset);
    const end = projectedOffset(range.endContainer, range.endOffset);
    const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
    if (start < 0 || end <= start || end > projection.text.length ||
        normalize(projection.text.slice(start, end)) !== normalize(text)) return empty;
    return {
      before: projection.text.slice(Math.max(0, start - 240), start).replace(/\s+/g, ' '),
      after: projection.text.slice(end, end + 240).replace(/\s+/g, ' ')
    };
  } catch { return empty; }
}

export function shouldWarmReading() {
  try {
    const key = location.pathname.replace(/\/+$/, '') || '/';
    const reading = JSON.parse(localStorage.getItem('gb-library-reading-v1') || '{}');
    return reading[key]?.state === 'reading' || sessionStorage.getItem('gb-library-resume-once') === key;
  } catch { return false; }
}
