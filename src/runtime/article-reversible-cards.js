const OWNER = 'native-v1';
const SELECTOR = '.flip-card, .error-flip-card, .heart-flip-card';
const FRONT_SELECTOR = '.flip-card-front, .error-flip-front, .heart-flip-front';
const BACK_SELECTOR = '.flip-card-back, .error-flip-back, .heart-flip-back';
/* Interactive descendants that keep their own activation semantics. */
const INTERACTIVE_SELECTOR = 'a[href], button, input, select, textarea, summary, [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])';
const HINT_CLASS = 'gb-reversible-card-hint';
const HINT_TEXT = 'Перевернуть карточку';
// Instruction-only labels that never contained the card's own text. WCAG 2.5.3
// requires the accessible name to contain the visible label, so a card that
// shows real content (a poem, a claim, a fact) cannot be named by a generic
// caption: the name has to come from the content plus this sr-only hint.
const GENERIC_LABEL = /^(?:Нажмите, чтобы перевернуть|Перевернуть карточку|Раскрыть термин)/iu;

function feature() {
  return window.SITE_CONFIG?.features?.flipCards || {};
}

function syncState(card) {
  const flipped = card.classList.contains('flipped');
  card.setAttribute('aria-pressed', String(flipped));
  card.setAttribute('aria-expanded', String(flipped));
  const front = card.querySelector(FRONT_SELECTOR);
  const back = card.querySelector(BACK_SELECTOR);
  front?.setAttribute('aria-hidden', String(flipped));
  back?.setAttribute('aria-hidden', String(!flipped));
}

function ensureHint(card) {
  const existing = [...card.children].find((child) => child.classList.contains(HINT_CLASS));
  if (existing) return existing;
  const hint = document.createElement('span');
  hint.className = `sr-only ${HINT_CLASS}`;
  hint.textContent = HINT_TEXT;
  card.appendChild(hint);
  return hint;
}

function ensureSemantics(card) {
  if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
  if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
  const authored = (card.getAttribute('aria-label') || '').trim();
  if (authored && GENERIC_LABEL.test(authored)) card.removeAttribute('aria-label');
  ensureHint(card);
  syncState(card);
}

function measureCard(card) {
  const selectors = card.classList.contains('heart-flip-card')
    ? ['.heart-flip-inner', '.heart-flip-front', '.heart-flip-back']
    : card.classList.contains('error-flip-card')
      ? ['.error-flip-inner', '.error-flip-front', '.error-flip-back']
      : ['.flip-card-inner', '.flip-card-front', '.flip-card-back'];
  const inner = card.querySelector(selectors[0]);
  const front = card.querySelector(selectors[1]);
  const back = card.querySelector(selectors[2]);
  if (!inner || !front || !back) return;

  const previous = {
    cardMin: card.style.minHeight,
    innerMin: inner.style.minHeight,
    front: front.style.cssText,
    back: back.style.cssText,
  };

  card.style.minHeight = '0px';
  inner.style.minHeight = '0px';
  for (const face of [front, back]) {
    face.style.position = 'relative';
    face.style.inset = 'auto';
    face.style.height = 'auto';
    face.style.visibility = 'hidden';
  }
  const maxHeight = Math.max(front.offsetHeight, back.offsetHeight);

  front.style.cssText = previous.front;
  back.style.cssText = previous.back;
  if (maxHeight > 0) {
    card.style.minHeight = `${maxHeight}px`;
    inner.style.minHeight = `${maxHeight}px`;
  } else {
    card.style.minHeight = previous.cardMin;
    inner.style.minHeight = previous.innerMin;
  }
}

export function installArticleReversibleCards() {
  const config = feature();
  if (config.enabled === false) return Object.freeze({ enabled: false, cards: 0 });

  const cards = [...document.querySelectorAll(SELECTOR)];
  if (!cards.length) return Object.freeze({ enabled: true, cards: 0 });

  for (const card of cards) {
    card.dataset.gbReversibleCardOwner = OWNER;
    ensureSemantics(card);
    measureCard(card);

    if (card.dataset.gbReversibleCardBound === OWNER) continue;
    card.dataset.gbReversibleCardBound = OWNER;

    card.addEventListener('click', (event) => {
      // SYS-REVERSIBLE-CARD-DESCENDANT-ACTIVATION-COLLISION: card faces can
      // carry their own interactive descendants (projected heading anchors,
      // citation links). Whole-card flip must only answer events that did
      // not originate in a descendant, otherwise activating the descendant
      // also flips the card (and pointer activation did both at once).
      const activated = event.target instanceof Element
        ? event.target.closest(INTERACTIVE_SELECTOR)
        : null;
      if (activated && activated !== card) return;
      card.classList.toggle('flipped');
      syncState(card);
    });

    if (config.keyboard !== false) {
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        // A focused descendant owns its Enter/Space (link activation, button
        // press); the capture-phase card handler must not swallow it.
        if (event.target !== card) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        card.click();
      }, { capture: true });
    }
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => cards.forEach(measureCard), 150);
  }, { passive: true });

  document.documentElement.dataset.gbReversibleCardsReady = '1';
  return Object.freeze({ enabled: true, cards: cards.length });
}
