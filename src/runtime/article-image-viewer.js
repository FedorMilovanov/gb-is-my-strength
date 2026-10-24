const VERSION = 1;
const OWNER = 'article-image-viewer';
const SELECTOR = '.article-figure img, .article-img img, .nagornaya-hero-img';
let viewer = null;
let open = false;

function overlayRuntime() {
  return window.OverlayRuntime || window.SiteUtils?.OverlayRuntime || null;
}

function ensureViewer() {
  if (viewer) return viewer;
  viewer = document.createElement('div');
  viewer.className = 'img-viewer';
  viewer.setAttribute('aria-hidden', 'true');
  viewer.setAttribute('inert', '');
  viewer.innerHTML = '<div class="img-viewer__dialog" role="dialog" aria-modal="true" aria-label="Просмотр изображения"><button type="button" class="img-viewer__close" aria-label="Закрыть просмотр">×</button><figure><img class="img-viewer__image" alt=""><figcaption class="img-viewer__caption"></figcaption></figure></div>';
  document.body.appendChild(viewer);
  viewer.querySelector('.img-viewer__close').addEventListener('click', () => closeImageViewer('button'));
  viewer.addEventListener('click', (event) => event.target === viewer && closeImageViewer('backdrop'));
  return viewer;
}

export function closeImageViewer(reason = 'close') {
  if (!viewer || !open) return;
  open = false;
  viewer.classList.remove('is-open');
  viewer.setAttribute('aria-hidden', 'true');
  viewer.setAttribute('inert', '');
  const runtime = overlayRuntime();
  if (runtime) runtime.close(OWNER, reason);
  else window.SiteUtils?.unlockScroll?.(`overlay:${OWNER}`);
}

function openImageViewer(source) {
  const root = ensureViewer();
  const image = root.querySelector('.img-viewer__image');
  const caption = root.querySelector('.img-viewer__caption');
  const close = root.querySelector('.img-viewer__close');
  image.src = source.currentSrc || source.src;
  image.alt = source.alt || '';
  const figureCaption = source.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
  caption.textContent = figureCaption || source.alt || '';
  caption.hidden = !caption.textContent;
  root.classList.add('is-open');
  root.setAttribute('aria-hidden', 'false');
  root.removeAttribute('inert');
  open = true;

  const runtime = overlayRuntime();
  if (runtime) {
    runtime.open(OWNER, {
      element: root,
      opener: source,
      focusTarget: close,
      inertTargets: Array.from(document.body.children).filter((child) => child !== root),
      closeOnEscape: true,
      trapFocus: true,
      restoreFocus: true,
      lockScroll: true,
      onRequestClose: (reason) => {
        closeImageViewer(reason || 'request');
        return false;
      },
    });
  } else {
    window.SiteUtils?.lockScroll?.(`overlay:${OWNER}`);
    close.focus({ preventScroll: true });
  }
}

/* SYS-ARTICLE-IMAGE-VIEWER-OPENER-SEMANTICS: bare images were pointer-only
   openers (outside tab order), and the modal's restoreFocus returned focus to
   that same non-focusable image, dropping it to <body>. Make every opener a
   real keyboard target: tabindex + role + name + Enter/Space activation. The
   focusable opener also fixes the restore path, because OverlayRuntime can
   now hand focus back to it. */
function makeOpenerAccessible(image) {
  if (!image || image.dataset.gbImgOpener === OWNER) return;
  image.dataset.gbImgOpener = OWNER;
  image.setAttribute('tabindex', '0');
  if (!image.getAttribute('role')) image.setAttribute('role', 'button');
  if (!image.getAttribute('aria-label')) {
    const alt = (image.getAttribute('alt') || '').trim();
    image.setAttribute('aria-label', alt ? `${alt} — открыть просмотр` : 'Открыть просмотр изображения');
  }
}

export function installArticleImageViewer() {
  if (window.GBArticleImageViewer?.version === VERSION) return window.GBArticleImageViewer;
  document.querySelectorAll(SELECTOR).forEach(makeOpenerAccessible);
  document.addEventListener('click', (event) => {
    const image = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!image || event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    makeOpenerAccessible(image);
    event.preventDefault();
    openImageViewer(image);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    const image = event.target instanceof Element ? event.target.closest(SELECTOR) : null;
    if (!image || event.defaultPrevented) return;
    event.preventDefault();
    makeOpenerAccessible(image);
    openImageViewer(image);
  });
  window.GBArticleImageViewer = Object.freeze({ version: VERSION, close: closeImageViewer });
  return window.GBArticleImageViewer;
}
