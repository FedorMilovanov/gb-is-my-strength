const OWNER = 'native-v1';

function resolveBody(button) {
  const id = button.getAttribute('aria-controls');
  if (id) {
    const target = document.getElementById(id);
    if (target) return target;
  }
  const sibling = button.nextElementSibling;
  return sibling?.classList?.contains('faq-accordion__body') ? sibling : null;
}

function innerHeight(body) {
  const inner = body.querySelector('.faq-accordion__body-inner');
  return Math.ceil((inner || body).scrollHeight);
}

/* SYS-FAQ-COLLAPSED-FOCUS-EXPOSURE: a closed answer is clipped with
   max-height:0/overflow only — its links stayed focusable and exposed to AT.
   Mirror the visual state with inert so collapsed content leaves the tab
   order and the accessibility tree; opening lifts it again. */
function setInert(body, on) {
  if (!body) return;
  try { body.inert = on; } catch (_) { /* very old engines: attribute only */ }
  if (on) body.setAttribute('inert', '');
  else body.removeAttribute('inert');
}

function setOpen(button, item, body, open, { animate = true } = {}) {
  button.setAttribute('aria-expanded', String(open));
  item.classList.toggle('is-open', open);
  item.classList.toggle('open', open);
  setInert(body, !open);

  if (!animate) {
    body.style.maxHeight = open ? 'none' : '0px';
    return;
  }

  if (open) {
    body.style.maxHeight = `${innerHeight(body)}px`;
    const settle = (event) => {
      if (event.propertyName !== 'max-height') return;
      body.removeEventListener('transitionend', settle);
      if (item.classList.contains('is-open')) body.style.maxHeight = 'none';
    };
    body.addEventListener('transitionend', settle);
  } else {
    if (body.style.maxHeight === 'none' || !body.style.maxHeight) body.style.maxHeight = `${innerHeight(body)}px`;
    requestAnimationFrame(() => requestAnimationFrame(() => { body.style.maxHeight = '0px'; }));
  }
}

export function installArticleFaqAccordions() {
  const buttons = [...document.querySelectorAll('.faq-accordion__q')];
  if (!buttons.length) return Object.freeze({ enabled: false, buttons: 0 });

  let owned = 0;
  for (const button of buttons) {
    const item = button.closest('.faq-accordion__item');
    const body = resolveBody(button);
    if (!item || !body) {
      button.dataset.gbFaqInvalid = 'missing-body';
      continue;
    }

    button.dataset.gbFaqOwner = OWNER;
    item.dataset.gbFaqOwner = OWNER;
    const initiallyOpen = item.classList.contains('is-open') || item.classList.contains('open') || button.getAttribute('aria-expanded') === 'true';
    setOpen(button, item, body, initiallyOpen, { animate: false });

    if (button.dataset.gbFaqBound !== OWNER) {
      button.dataset.gbFaqBound = OWNER;
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        setOpen(button, item, body, open);
      });
    }
    owned += 1;
  }

  const resize = () => {
    for (const button of buttons) {
      if (button.getAttribute('aria-expanded') !== 'true') continue;
      const body = resolveBody(button);
      if (body && body.style.maxHeight !== 'none') body.style.maxHeight = `${innerHeight(body)}px`;
    }
  };
  window.addEventListener('resize', resize, { passive: true });

  document.querySelectorAll('.faq-accordion').forEach((root) => { root.dataset.gbFaqEnhanced = OWNER; });
  document.documentElement.dataset.gbArticleFaqReady = owned === buttons.length ? '1' : 'invalid';
  return Object.freeze({ enabled: true, buttons: buttons.length, owned });
}
