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
    const focused = document.activeElement === fab;
    if (before?.parentNode === host) {
      if (fab.nextElementSibling !== before) host.insertBefore(fab, before);
    } else if (fab.parentNode !== host || fab.nextElementSibling) host.append(fab);
    if (focused && (document.activeElement === document.body || document.activeElement === document.documentElement) &&
        fab.isConnected && !fab.disabled && fab.getClientRects().length &&
        !fab.closest('[hidden],[inert],[aria-hidden="true"]') && getComputedStyle(fab).visibility === 'visible') {
      fab.focus({preventScroll:true});
    }
  }


export function contextFromSelection(selection, text) {
  return window.GBReaderAnchors?.selectionContext(selection,text) || {before:'',after:''};
}

export function shouldWarmReading() {
  try {
    const key = location.pathname.replace(/\/+$/, '') || '/';
    const reading = JSON.parse(localStorage.getItem('gb-library-reading-v1') || '{}');
    return reading[key]?.state === 'reading' || sessionStorage.getItem('gb-library-resume-once') === key ||
      !!sessionStorage.getItem('gb-library-progress-navigation-v1');
  } catch { return false; }
}
