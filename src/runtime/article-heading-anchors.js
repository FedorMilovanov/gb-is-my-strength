const OWNER = 'native-v1';
const TOAST_ID = 'anchor-copy-toast';
const CLIPBOARD_TIMEOUT_MS = 1200;
const ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M13.5 6.5L7 13a3.536 3.536 0 0 1-5-5l7-7a2.121 2.121 0 0 1 3 3L5.5 10.5a.707.707 0 0 1-1-1L11 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let delegatedBound = false;
let toastTimer = 0;

function enabled() {
  return window.SITE_CONFIG?.features?.headingAnchors?.enabled !== false;
}

function ensureToast() {
  let toast = document.getElementById(TOAST_ID);
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.className = 'gb-anchor-copy-toast';
  toast.dataset.gbHeadingAnchorOwner = OWNER;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.textContent = 'Ссылка на раздел скопирована';
  document.body.appendChild(toast);
  return toast;
}

function showToast(message = 'Ссылка на раздел скопирована') {
  const toast = ensureToast();
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.textContent = 'Ссылка на раздел скопирована';
  }, 2000);
}

function copyText(value) {
  if (navigator.clipboard?.writeText) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('clipboard write timed out'));
      }, CLIPBOARD_TIMEOUT_MS);
      Promise.resolve()
        .then(() => navigator.clipboard.writeText(value))
        .then(
          (result) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve(result);
          },
          (error) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            reject(error);
          },
        );
    });
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;inset:0 auto auto 0;opacity:0;pointer-events:none';
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    input.remove();
    copied ? resolve() : reject(new Error('copy failed'));
  });
}

function headingAnchorFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const anchor = target.closest('.heading-anchor[data-gb-heading-anchor-owner="native-v1"]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  const heading = anchor.closest('h2[id], h3[id], h4[id]');
  if (!(heading instanceof HTMLElement) || !heading.id) return null;
  return { anchor, heading };
}

function handleHeadingAnchorClick(event) {
  const owned = headingAnchorFromEvent(event);
  if (!owned) return;

  event.preventDefault();
  const { anchor, heading } = owned;
  const id = heading.id;
  const url = new URL(window.location.href);
  url.hash = id;

  copyText(url.toString()).then(() => {
    try { navigator.vibrate?.(30); } catch {}
    anchor.innerHTML = CHECK;
    anchor.classList.add('copied');
    showToast();
    window.setTimeout(() => {
      if (!anchor.isConnected) return;
      anchor.innerHTML = ICON;
      anchor.classList.remove('copied');
    }, 1800);
  }).catch(() => {
    history.replaceState(null, '', `#${id}`);
    showToast('Ссылка на раздел открыта');
  });
}

function ensureDelegatedOwner() {
  if (delegatedBound) return;
  delegatedBound = true;
  // Capture-phase delegation survives heading/anchor replacement and cannot be
  // disabled by bubble-phase stopPropagation in unrelated reader controls.
  document.addEventListener('click', handleHeadingAnchorClick, true);
}

export function installArticleHeadingAnchors() {
  if (!enabled()) return Object.freeze({ enabled: false, headings: 0 });

  const headings = [...document.querySelectorAll('h2[id], h3[id], h4[id]')]
    .filter((heading) => !heading.closest('.summary-card, .author-card, [data-gb-no-heading-anchor]'));
  if (!headings.length) return Object.freeze({ enabled: true, headings: 0, anchors: 0 });

  ensureToast();
  ensureDelegatedOwner();
  let anchors = 0;

  for (const heading of headings) {
    let anchor = heading.querySelector(':scope > .heading-anchor');
    if (!anchor) {
      anchor = document.createElement('a');
      anchor.className = 'heading-anchor';
      anchor.href = `#${heading.id}`;
      heading.appendChild(anchor);
    }

    anchor.dataset.gbHeadingAnchorOwner = OWNER;
    anchor.removeAttribute('data-gb-heading-anchor-bound');
    anchor.setAttribute('aria-label', 'Скопировать ссылку на раздел');
    anchor.innerHTML = ICON;
    anchors += 1;
  }

  document.documentElement.dataset.gbHeadingAnchorsReady = anchors === headings.length ? '1' : 'invalid';
  return Object.freeze({ enabled: true, headings: headings.length, anchors });
}
