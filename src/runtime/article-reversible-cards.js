const OWNER = 'native-v1';
const SELECTOR = '.flip-card, .error-flip-card, .heart-flip-card';
const FRONT_SELECTOR = '.flip-card-front, .error-flip-front, .heart-flip-front';
const BACK_SELECTOR = '.flip-card-back, .error-flip-back, .heart-flip-back';

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

function ensureSemantics(card) {
  if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
  if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
  if (!card.hasAttribute('aria-label')) {
    const labelNode = card.querySelector(`${FRONT_SELECTOR} h3, ${FRONT_SELECTOR}`);
    const label = (labelNode?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    card.setAttribute('aria-label', label ? `Перевернуть карточку: ${label}` : 'Перевернуть карточку');
  }
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

    card.addEventListener('click', () => {
      card.classList.toggle('flipped');
      syncState(card);
    });

    if (config.keyboard !== false) {
      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
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
